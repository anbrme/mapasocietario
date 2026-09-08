/**
 * GET /api/verify/session?t=<token> — build and persist the FIRST draft.
 *
 * The draft is written to the database before it is shown, so what the
 * representative saw is recoverable later and so acceptance can reference it by
 * hash rather than trusting a client-assembled payload.
 *
 * Every failure returns 404 with the same body. A 403, or a distinct "expired"
 * message, would confirm that a token exists.
 */
import { matchSeat } from '../../../src/verify/seat.js';
import { assembleDraft } from '../../../src/verify/assemble.js';
import { newId, tokenHash } from '../../../src/verify/ids.js';
import { canonicalJson } from '../../../src/verify/hash.js';
import {
  jsonResponse, fetchCompanyByGroupKey, invitationForToken, currentGroupKey,
} from './_db.js';

const notFound = () => jsonResponse({ ok: false, error: 'not_found' }, 404);

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('t') || '';
  if (!token) return notFound();

  const invitation = await invitationForToken(env, await tokenHash(token));
  if (!invitation) return notFound();

  // An invitation already turned into an attestation should send the
  // representative to the outcome, not back to a blank form.
  const already = await env.VERIFY_DB
    .prepare('SELECT id, status FROM attestations WHERE invitation_id = ?')
    .bind(invitation.id).first();
  if (already) {
    return jsonResponse({ ok: true, already_submitted: true, status: already.status });
  }

  const groupKey = await currentGroupKey(env, invitation.subject_id);
  if (!groupKey) return jsonResponse({ ok: false, error: 'subject_unresolved' }, 409);

  let company;
  try { company = await fetchCompanyByGroupKey(groupKey, env); }
  catch (e) { return jsonResponse({ ok: false, error: e.message }, 502); }

  // The seat is re-checked here, not just at invite time: a cessation published
  // in between means the person no longer holds the position we would name.
  const seat = matchSeat(invitation.declared_name, company.officers_active);
  if (!seat) return jsonResponse({ ok: false, error: 'seat_no_longer_active' }, 409);

  const { assertion, hash } = await assembleDraft({
    subjectId: invitation.subject_id,
    groupKey,
    company,
    seat,
    representationBasis: invitation.representation_basis,
    declaredFacts: [],
    nonce: newId('non'),
    draftedAt: new Date().toISOString(),
  });

  await env.VERIFY_DB.prepare(
    `INSERT OR IGNORE INTO draft_assertions
      (hash, invitation_id, subject_id, canonical_json, registry_snapshot)
     VALUES (?,?,?,?,?)`)
    .bind(hash, invitation.id, invitation.subject_id,
          canonicalJson(assertion), canonicalJson(company)).run();

  return jsonResponse({
    ok: true,
    draft_hash: hash,
    assertion,
    company_name: company.company_name,
    seat,
    representative: invitation.declared_name,
    claimed_role: invitation.claimed_role,
  });
}
