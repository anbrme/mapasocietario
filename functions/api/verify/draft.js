/**
 * POST /api/verify/draft — persist an EDITED draft.
 *
 * Corrections are not a client-side detail. A representative who changes a fact
 * is no longer accepting the draft they were served, so the edit produces a new
 * persisted draft and the old one is marked superseded. Acceptance always
 * references a draft the server recorded showing them.
 *
 * The base fact list is rebuilt from the draft's stored registry_snapshot, NOT
 * from its canonical_json: the assertion deliberately keeps only fact_key,
 * declared_status and declared_value, dropping registry_value_at_issue, which
 * the edit path needs as the evidence a declaration is compared against.
 */
import { assembleDraft } from '../../../src/verify/assemble.js';
import { newId, tokenHash } from '../../../src/verify/ids.js';
import { canonicalJson } from '../../../src/verify/hash.js';
import { jsonResponse, invitationForToken, currentGroupKey } from './_db.js';

const notFound = () => jsonResponse({ ok: false, error: 'not_found' }, 404);

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ ok: false, error: 'invalid_json' }, 400); }

  const token = typeof body.t === 'string' ? body.t : '';
  const baseHash = typeof body.base_hash === 'string' ? body.base_hash : '';
  const edits = Array.isArray(body.edits) ? body.edits : [];
  if (!token || !baseHash) return notFound();

  const invitation = await invitationForToken(env, await tokenHash(token));
  if (!invitation) return notFound();

  // Scoped to this invitation: one token may never edit another's draft.
  const base = await env.VERIFY_DB.prepare(
    'SELECT * FROM draft_assertions WHERE hash = ? AND invitation_id = ?')
    .bind(baseHash, invitation.id).first();
  if (!base) return notFound();
  if (base.superseded_by) return jsonResponse({ ok: false, error: 'draft_superseded' }, 409);

  const company = JSON.parse(base.registry_snapshot);
  const priorAssertion = JSON.parse(base.canonical_json);
  const groupKey = await currentGroupKey(env, invitation.subject_id);

  // Replay the declarations already made, then layer the new edits on top.
  const declaredFacts = [...priorAssertion.facts, ...edits];

  const { assertion, hash } = await assembleDraft({
    subjectId: invitation.subject_id,
    groupKey,
    company,
    seat: priorAssertion.seat,
    representationBasis: priorAssertion.representation_basis,
    declaredFacts,
    consents: priorAssertion.consents,
    nonce: newId('non'),
    draftedAt: new Date().toISOString(),
  });

  if (hash === baseHash) return jsonResponse({ ok: true, draft_hash: hash, assertion });

  await env.VERIFY_DB.batch([
    env.VERIFY_DB.prepare(
      `INSERT OR IGNORE INTO draft_assertions
        (hash, invitation_id, subject_id, canonical_json, registry_snapshot)
       VALUES (?,?,?,?,?)`)
      .bind(hash, invitation.id, invitation.subject_id,
            canonicalJson(assertion), base.registry_snapshot),
    env.VERIFY_DB.prepare('UPDATE draft_assertions SET superseded_by = ? WHERE hash = ?')
      .bind(hash, baseHash),
  ]);

  return jsonResponse({ ok: true, draft_hash: hash, assertion });
}
