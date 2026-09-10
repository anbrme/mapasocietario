/**
 * GET /api/verify/admin/attestations — every attestation that still means
 * something, with its grants.
 *
 * The review queue lists only pending submissions, which left the console
 * asking the operator to paste an attestation_id they had no way to look up.
 * This is that lookup: the current record per company, its status, and the
 * grants already issued against it so a link can be revoked without going to
 * the database.
 */
import { adminDenial, jsonResponse } from '../_db.js';

const LISTED = ['live', 'outdated', 'under_review', 'disputed', 'expired'];

export async function onRequestGet({ request, env }) {
  const denied = adminDenial(request, env);
  if (denied) return denied;

  const { results } = await env.VERIFY_DB.prepare(
    `SELECT a.id, a.status, a.accepted_at, a.expires_at, a.last_verified_at, a.reviewer,
            a.status_reason, a.seat_officer_name, a.seat_position, s.display_name
       FROM attestations a
       JOIN subjects s ON s.subject_id = a.subject_id
      WHERE a.status IN (${LISTED.map(() => '?').join(',')})
      ORDER BY a.accepted_at DESC`).bind(...LISTED).all();

  const items = [];
  for (const row of results || []) {
    const { results: grants } = await env.VERIFY_DB.prepare(
      `SELECT token_hash, label, kind, created_at, expires_at, revoked_at, access_count, last_access_at
         FROM view_grants WHERE attestation_id = ? ORDER BY created_at DESC`)
      .bind(row.id).all();
    items.push({
      ...row,
      // access_count counts LINK ACCESSES, not readers. The label is an operator
      // note and never an identity claim.
      grants: (grants || []).map((g) => ({
        token_hash: g.token_hash, label: g.label, kind: g.kind, created_at: g.created_at,
        expires_at: g.expires_at, revoked_at: g.revoked_at,
        access_count: g.access_count, last_access_at: g.last_access_at,
      })),
    });
  }

  return jsonResponse({ ok: true, count: items.length, items });
}
