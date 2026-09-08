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
import { requireAdmin, jsonResponse, batchWithAudit } from '../_db.js';

const CURRENT_STATES = "('live','outdated','under_review','disputed','expired')";

/**
 * 'absent' and 'altered' are materially different and must not be conflated.
 * evidence/personal/ is deliberately unlocked so it stays erasable, so a subject
 * who exercises erasure between acceptance and review makes that object absent.
 * Treating that as tampering would make the attestation permanently
 * unapprovable and would report a fulfilled erasure request as an integrity
 * failure.
 */
async function evidenceState(env, key, expectedHash) {
  if (!key) return 'none_recorded';
  const object = await env.VERIFY_EVIDENCE.get(key);
  if (!object) return 'absent';
  return (await sha256Hex(await object.text())) === expectedHash ? 'intact' : 'altered';
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
    await batchWithAudit(env, [
      env.VERIFY_DB.prepare(
        `UPDATE attestations SET status='rejected', reviewer=?, reviewed_at=?, decision_note=?
          WHERE id = ?`).bind(reviewer, now, note, attestationId),
    ], {
      // No public_summary: a rejected attestation was never published, so it has
      // no public history to add to.
      attestation_id: attestationId, subject_id: attestation.subject_id,
      action: 'rejected', actor: reviewer,
      detail: JSON.stringify({ note }), public_summary: null,
    });
    return jsonResponse({ ok: true, status: 'rejected' });
  }

  const sealed = await evidenceState(env, attestation.sealed_key, attestation.sealed_hash);
  const personal = await evidenceState(env, attestation.personal_key, attestation.personal_hash);

  // Sealed evidence is bucket-locked, so anything but 'intact' is a real
  // integrity problem and blocks publication.
  if (sealed !== 'intact') {
    return jsonResponse({ ok: false, error: `sealed_evidence_${sealed}`, sealed, personal }, 409);
  }
  // Personal evidence may legitimately be gone (erasure). Only ALTERATION blocks.
  if (personal === 'altered') {
    return jsonResponse({ ok: false, error: 'personal_evidence_altered', sealed, personal }, 409);
  }

  await batchWithAudit(env, [
    env.VERIFY_DB.prepare(
      `UPDATE attestations SET status='superseded', superseded_by=?
        WHERE subject_id = ? AND id <> ? AND status IN ${CURRENT_STATES}`)
      .bind(attestationId, attestation.subject_id, attestationId),
    // last_verified_at is NOT touched here: it records when the FACTS were last
    // checked against the registry, which happened at acceptance. Approval
    // verifies evidence digests and judgement, not the registry.
    env.VERIFY_DB.prepare(
      `UPDATE attestations
          SET status='live', approved_at=?, reviewer=?, reviewed_at=?, decision_note=?
        WHERE id = ?`)
      .bind(now, reviewer, now, note || null, attestationId),
  ], {
    attestation_id: attestationId, subject_id: attestation.subject_id,
    action: 'approved', actor: reviewer,
    detail: JSON.stringify({ note, evidence: { sealed, personal } }),
    public_summary: 'Reviewed and published',
  });

  return jsonResponse({ ok: true, status: 'live', evidence: { sealed, personal } });
}
