/**
 * GET /api/verify/admin/queue — everything awaiting review, as a comparison.
 *
 * The queue shows declared beside registry with the differences marked, so
 * review is a comparison rather than a reading and the reviewer's attention
 * lands where a judgement is actually required.
 */
import { factDiff } from '../../../../src/verify/diff.js';
import { requireAdmin, jsonResponse } from '../_db.js';

export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  const { results: pending } = await env.VERIFY_DB.prepare(
    `SELECT a.*, c.declared_name, c.email, c.claimed_role, c.identification_note,
            c.email_domain_basis, s.display_name
       FROM attestations a
       JOIN claimants c ON c.id = a.claimant_id
       JOIN subjects  s ON s.subject_id = a.subject_id
      WHERE a.status = 'pending_review'
      ORDER BY a.accepted_at ASC`).all();

  const items = [];
  for (const row of pending || []) {
    const { results: facts } = await env.VERIFY_DB.prepare(
      'SELECT * FROM attestation_facts WHERE attestation_id = ? ORDER BY id')
      .bind(row.id).all();

    // The incumbent is surfaced because approving this record will supersede it,
    // whatever state it is in — the reviewer should see what they are replacing.
    const incumbent = await env.VERIFY_DB.prepare(
      `SELECT id, status, accepted_at FROM attestations
        WHERE subject_id = ?
          AND status IN ('live','outdated','under_review','disputed','expired')`)
      .bind(row.subject_id).first();

    items.push({
      attestation_id: row.id,
      company: row.display_name,
      representative: row.declared_name,
      claimed_role: row.claimed_role,
      representation_basis: row.representation_basis,
      seat: { name: row.seat_officer_name, position: row.seat_position,
              appointed_date: row.seat_appointed_date },
      // Operator-only context; this endpoint is admin-guarded and its payload
      // never reaches publicProjection.
      identification_note: row.identification_note,
      email_domain_basis: row.email_domain_basis,
      accepted_at: row.accepted_at,
      expires_at: row.expires_at,
      diff: factDiff(facts || []),
      incumbent: incumbent || null,
    });
  }

  return jsonResponse({ ok: true, count: items.length, items });
}
