/**
 * POST /api/verify/admin/decide — approve or reject one attestation.
 *
 * Approval order matters. The evidence is re-read and its digest verified
 * BEFORE anything is published: an attestation whose evidence cannot be
 * produced must never go live. Then a single batch demotes whatever the
 * incumbent is — live, outdated, under_review, disputed or expired — and
 * promotes the successor. idx_attestations_current makes the promotion fail if
 * the demotion is skipped, so a stale record can never compete with its own
 * successor.
 *
 * expires_at is NEVER recomputed here. It was written once at acceptance, from
 * accepted_at: statement age runs from when the representative accepted, not
 * from when the operator got round to approving.
 */
import { sha256Hex } from '../../../../src/verify/hash.js';
import { requireAdmin, jsonResponse, auditStatement } from '../_db.js';

const CURRENT_STATES = "('live','outdated','under_review','disputed','expired')";

async function evidenceIntact(env, key, expectedHash) {
  if (!key) return true;                       // personal evidence is optional
  const object = await env.VERIFY_EVIDENCE.get(key);
  if (!object) return false;
  return (await sha256Hex(await object.text())) === expectedHash;
}

export async function onRequestPost({ request, env }) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ ok: false, error: 'invalid_json' }, 400); }

  const attestationId = typeof body.attestation_id === 'string' ? body.attestation_id : '';
  const decision = body.decision === 'approve' ? 'approve'
                 : body.decision === 'reject' ? 'reject' : null;
  const reviewer = typeof body.reviewer === 'string' ? body.reviewer.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';

  if (!attestationId || !decision) return jsonResponse({ ok: false, error: 'invalid_request' }, 400);
  // The reviewer is named publicly on the attestation. An anonymous approval
  // would remove the accountability the whole design rests on.
  if (!reviewer) return jsonResponse({ ok: false, error: 'reviewer_required' }, 400);
  if (decision === 'reject' && !note) {
    return jsonResponse({ ok: false, error: 'rejection_reason_required' }, 400);
  }

  const attestation = await env.VERIFY_DB
    .prepare('SELECT * FROM attestations WHERE id = ?').bind(attestationId).first();
  if (!attestation) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  if (attestation.status !== 'pending_review') {
    return jsonResponse({ ok: false, error: 'not_pending', status: attestation.status }, 409);
  }

  const now = new Date().toISOString();

  if (decision === 'reject') {
    await env.VERIFY_DB.batch([
      env.VERIFY_DB.prepare(
        `UPDATE attestations SET status='rejected', reviewer=?, reviewed_at=?, decision_note=?
          WHERE id = ?`).bind(reviewer, now, note, attestationId),
      // No public_summary: a rejected attestation was never published, so it has
      // no public history to add to.
      await auditStatement(env, {
        attestation_id: attestationId, subject_id: attestation.subject_id,
        action: 'rejected', actor: reviewer,
        detail: JSON.stringify({ note }), public_summary: null,
      }),
    ]);
    return jsonResponse({ ok: true, status: 'rejected' });
  }

  const sealedOk = await evidenceIntact(env, attestation.sealed_key, attestation.sealed_hash);
  const personalOk = await evidenceIntact(env, attestation.personal_key, attestation.personal_hash);
  if (!sealedOk || !personalOk) {
    return jsonResponse({
      ok: false, error: 'evidence_missing_or_altered',
      sealed_ok: sealedOk, personal_ok: personalOk,
    }, 409);
  }

  await env.VERIFY_DB.batch([
    env.VERIFY_DB.prepare(
      `UPDATE attestations SET status='superseded', superseded_by=?
        WHERE subject_id = ? AND id <> ? AND status IN ${CURRENT_STATES}`)
      .bind(attestationId, attestation.subject_id, attestationId),
    env.VERIFY_DB.prepare(
      `UPDATE attestations
          SET status='live', approved_at=?, reviewer=?, reviewed_at=?, decision_note=?,
              last_verified_at=?
        WHERE id = ?`)
      .bind(now, reviewer, now, note || null, now, attestationId),
    await auditStatement(env, {
      attestation_id: attestationId, subject_id: attestation.subject_id,
      action: 'approved', actor: reviewer,
      detail: JSON.stringify({ note }),
      public_summary: 'Reviewed and published',
    }),
  ]);

  return jsonResponse({ ok: true, status: 'live' });
}
