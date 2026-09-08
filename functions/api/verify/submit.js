/**
 * POST /api/verify/submit — the representative accepts a persisted draft.
 *
 * Two guarantees this endpoint has to actually deliver:
 *
 * 1. ONE acceptance per invitation, enforced by attestations.invitation_id
 *    UNIQUE. A conditional "UPDATE invitations SET used_at = ? WHERE used_at IS
 *    NULL" is NOT a mechanism: an update matching zero rows is a SUCCESSFUL
 *    statement in SQLite, and D1 rolls a batch back only when a statement
 *    FAILS. The duplicate INSERT failing is what rolls it back. used_at is
 *    written in the same batch as a record of what happened, never as the gate.
 *
 * 2. RETRY-SAFE evidence. Keys derive from the draft hash, which prevents
 *    duplicate names but not duplicate writes; putEvidenceOnce adds the
 *    conditional put plus digest verification of anything already there.
 *
 * Ordering: R2 first, then one D1 batch. A crash between them leaves orphan
 * evidence objects (harmless, swept later) and an unconsumed invitation, so the
 * representative can retry the same link. A crash inside the batch rolls
 * everything back.
 */
import { assembleDraft } from '../../../src/verify/assemble.js';
import { buildAcceptanceReceipt, consentsComplete } from '../../../src/verify/assertion.js';
import { newId, tokenHash } from '../../../src/verify/ids.js';
import { canonicalJson, sha256Hex } from '../../../src/verify/hash.js';
import {
  evidenceKeys, buildSealedEvidence, buildPersonalEvidence, putEvidenceOnce,
} from '../../../src/verify/evidence.js';
import {
  jsonResponse, fetchCompanyByGroupKey, invitationForToken, currentGroupKey, batchWithAudit,
} from './_db.js';

const notFound = () => jsonResponse({ ok: false, error: 'not_found' }, 404);

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ ok: false, error: 'invalid_json' }, 400); }

  const token = typeof body.t === 'string' ? body.t : '';
  const draftHash = typeof body.draft_hash === 'string' ? body.draft_hash : '';
  const consents = body.consents || {};
  if (!token || !draftHash) return notFound();

  const invitation = await invitationForToken(env, await tokenHash(token));
  if (!invitation) return notFound();

  if (!consentsComplete(consents)) {
    return jsonResponse({ ok: false, error: 'consents_required' }, 400);
  }

  // Retry AFTER a successful commit: from the representative's side the
  // submission did succeed, so return the same attestation rather than an error.
  const already = await env.VERIFY_DB
    .prepare('SELECT id, status, assertion_hash FROM attestations WHERE invitation_id = ?')
    .bind(invitation.id).first();
  if (already) {
    if (already.assertion_hash === draftHash) {
      return jsonResponse({ ok: true, attestation_id: already.id, status: already.status });
    }
    return jsonResponse({ ok: false, error: 'already_submitted_with_different_draft' }, 409);
  }

  const draft = await env.VERIFY_DB.prepare(
    'SELECT * FROM draft_assertions WHERE hash = ? AND invitation_id = ?')
    .bind(draftHash, invitation.id).first();
  if (!draft) return notFound();
  if (draft.superseded_by) {
    return jsonResponse({ ok: false, error: 'draft_superseded' }, 409);
  }

  const storedAssertion = JSON.parse(draft.canonical_json);
  const groupKey = await currentGroupKey(env, invitation.subject_id);
  if (!groupKey) return jsonResponse({ ok: false, error: 'subject_unresolved' }, 409);

  // Re-read the registry and rebuild the assertion, REUSING the draft's nonce
  // and drafted_at so the only thing that can move the hash is the registry.
  let fresh;
  try { fresh = await fetchCompanyByGroupKey(groupKey, env); }
  catch (e) { return jsonResponse({ ok: false, error: e.message }, 502); }

  const rebuilt = await assembleDraft({
    subjectId: invitation.subject_id,
    groupKey,
    company: fresh,
    seat: storedAssertion.seat,
    representationBasis: storedAssertion.representation_basis,
    declaredFacts: storedAssertion.facts,
    nonce: storedAssertion.nonce,
    draftedAt: storedAssertion.drafted_at,
  });

  // The registry moved while they were reading. They are NOT bound to a
  // statement they did not see: persist the new draft and ask again.
  if (rebuilt.hash !== draftHash) {
    const nextNonce = newId('non');
    const next = await assembleDraft({
      subjectId: invitation.subject_id, groupKey, company: fresh,
      seat: storedAssertion.seat, representationBasis: storedAssertion.representation_basis,
      declaredFacts: storedAssertion.facts,
      nonce: nextNonce, draftedAt: new Date().toISOString(),
    });
    await env.VERIFY_DB.batch([
      env.VERIFY_DB.prepare(
        `INSERT OR IGNORE INTO draft_assertions
          (hash, invitation_id, subject_id, canonical_json, registry_snapshot)
         VALUES (?,?,?,?,?)`)
        .bind(next.hash, invitation.id, invitation.subject_id,
              canonicalJson(next.assertion), canonicalJson(fresh)),
      env.VERIFY_DB.prepare('UPDATE draft_assertions SET superseded_by = ? WHERE hash = ?')
        .bind(next.hash, draftHash),
    ]);
    return jsonResponse({
      ok: false, error: 'registry_changed',
      draft_hash: next.hash, assertion: next.assertion,
    }, 409);
  }

  const acceptedAt = new Date().toISOString();
  // The consents the representative ACTUALLY gave. They used to be validated
  // above and then dropped: the assertion carried a draft-time placeholder of
  // all-false, so the hashed statement, the sealed evidence and the audit
  // receipt all recorded that they had consented to nothing.
  const receipt = buildAcceptanceReceipt(draftHash, acceptedAt, 'email-confirmed', consents);
  const identity = rebuilt.assertion.identity;
  const keys = evidenceKeys(draftHash);

  const sealedBody = buildSealedEvidence({
    assertion: rebuilt.assertion, registrySnapshot: fresh,
    seat: storedAssertion.seat, identity, acceptedAt, receipt,
  });
  const personalBody = buildPersonalEvidence({
    email: invitation.email, identificationNote: invitation.identification_note,
    emailDomainBasis: invitation.email_domain_basis, acceptedAt,
  });

  try {
    await putEvidenceOnce(env.VERIFY_EVIDENCE, keys.sealed, sealedBody);
    await putEvidenceOnce(env.VERIFY_EVIDENCE, keys.personal, personalBody);
  } catch (e) {
    // A different body under a hash-derived key means something is badly wrong.
    // Nothing is written to D1 and the operator is told loudly.
    return jsonResponse({ ok: false, error: e.message }, 500);
  }

  const attestationId = newId('att');
  const statements = [
    // THE GATE. A replay fails here and rolls the whole batch back.
    env.VERIFY_DB.prepare(
      `INSERT INTO attestations
        (id, subject_id, claimant_id, invitation_id, method, status, representation_basis,
         seat_officer_name, seat_position, seat_appointed_date, identity_snapshot,
         assertion_hash, registry_snapshot, sealed_key, sealed_hash, personal_key,
         personal_hash, accepted_at, expires_at, acceptance_receipt)
       VALUES (?,?,?,?, 'email-confirmed','pending_review', ?, ?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(attestationId, invitation.subject_id, invitation.claimant_id, invitation.id,
            storedAssertion.representation_basis,
            storedAssertion.seat?.name ?? null, storedAssertion.seat?.position ?? null,
            storedAssertion.seat?.appointed_date ?? null, canonicalJson(identity),
            draftHash, canonicalJson(fresh),
            keys.sealed, await sha256Hex(sealedBody),
            keys.personal, await sha256Hex(personalBody),
            receipt.accepted_at, receipt.expires_at, JSON.stringify(receipt)),
  ];

  for (const fact of rebuilt.facts) {
    statements.push(env.VERIFY_DB.prepare(
      `INSERT INTO attestation_facts
        (attestation_id, fact_key, declared_status, declared_value,
         registry_value_at_issue, check_source)
       VALUES (?,?,?,?,?,?)`)
      .bind(attestationId, fact.fact_key, fact.declared_status,
            fact.declared_value ?? null, fact.registry_value_at_issue ?? null,
            fact.check_source));
  }

  // A record of what happened, never the enforcement.
  statements.push(
    env.VERIFY_DB.prepare('UPDATE invitations SET used_at = ? WHERE id = ?')
      .bind(acceptedAt, invitation.id),
  );

  await batchWithAudit(env, statements, {
    attestation_id: attestationId, subject_id: invitation.subject_id,
    action: 'accepted', actor: 'representative',
    detail: JSON.stringify({ receipt, sealed_key: keys.sealed, personal_key: keys.personal }),
    public_summary: 'Accepted by the representative',
  });

  // "Received", never "verified": nothing is published until a review.
  return jsonResponse({ ok: true, attestation_id: attestationId, status: 'pending_review' });
}
