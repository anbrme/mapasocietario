/**
 * GET /api/verify/admin/chain — recompute the audit chain end to end.
 *
 * Read through the D1 binding rather than the wrangler CLI: `wrangler d1
 * execute` renders SQL NULL as the JSON STRING "null", so a verifier fed CLI
 * output hashes "null" where the writer hashed null and reports a break that
 * does not exist. The binding returns real nulls.
 *
 * A passing result means no row was altered or removed since it was written. It
 * does NOT mean the log is immutable: whoever holds database access can rewrite
 * rows and recompute the chain, which is why the daily head is checkpointed
 * off-system (spec section 4.2).
 */
import { verifyChain } from '../../../../src/verify/chain.js';
import { requireAdmin, jsonResponse } from '../_db.js';

export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  const { results } = await env.VERIFY_DB.prepare(
    `SELECT seq, attestation_id, subject_id, action, actor, detail, public_summary,
            created_at, prev_hash, hash
       FROM audit_events ORDER BY seq`).all();

  const rows = results || [];
  const result = await verifyChain(rows);
  return jsonResponse({
    ok: true,
    events: rows.length,
    head: rows.length ? rows[rows.length - 1].hash : null,
    intact: result.ok,
    broken_at_seq: result.brokenAtSeq,
    note: 'Tamper-evident, not immutable. Integrity depends on the daily external checkpoint.',
  });
}
