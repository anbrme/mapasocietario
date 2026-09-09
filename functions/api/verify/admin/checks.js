/**
 * GET /api/verify/admin/checks?attestation_id=&limit= — the continuity record.
 *
 * INTERNAL ONLY, and it must stay that way. A public daily-check lane would
 * invite the reading that each check independently confirmed the statement,
 * which section 4.1 of the pilot design forbids: a check compares a declaration
 * against the registry; it does not establish that the declaration is true.
 */
import { requireAdmin, jsonResponse } from '../_db.js';
import { summariseRuns } from '../../../../src/verify/reconcile.js';

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 400;

export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  const url = new URL(request.url);
  const id = (url.searchParams.get('attestation_id') || '').trim();
  if (!id) return jsonResponse({ ok: false, error: 'attestation_id_required' }, 400);

  const raw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(raw) && raw >= 1 && raw <= MAX_LIMIT
    ? Math.floor(raw) : DEFAULT_LIMIT;

  const { results } = await env.VERIFY_DB.prepare(
    `SELECT checked_at, source_failed, outcomes, status_before, status_after
       FROM reconciliation_runs
      WHERE attestation_id = ?
      ORDER BY checked_at DESC
      LIMIT ?`).bind(id, limit).all();

  const items = results || [];
  return jsonResponse({ ok: true, count: items.length, summary: summariseRuns(items), items });
}
