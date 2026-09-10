/**
 * POST /api/verify/admin/grant — issue a viewer grant for a live attestation.
 * DELETE (via {"revoke": true}) — revoke one.
 *
 * The grant token IS the address of the attestation page, so it is returned
 * exactly once and only its hash is stored. `label` is an operator note ("Banco
 * X, onboarding"), never an identity claim: the grant records accesses through
 * a link, and links get forwarded.
 */
import { newToken, tokenHash } from '../../../../src/verify/ids.js';
import {
  normalizeGrantKind, grantPath, GRANT_KINDS, DEFAULT_TTL_DAYS, PREVIEW_TTL_DAYS,
} from '../../../../src/verify/grant.js';
import { adminDenial, jsonResponse, batchWithAudit } from '../_db.js';

const MIN_TTL_DAYS = 1;
const MAX_TTL_DAYS = 365;

export async function onRequestPost({ request, env }) {
  const denied = adminDenial(request, env);
  if (denied) return denied;

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ ok: false, error: 'invalid_json' }, 400); }

  const attestationId = typeof body.attestation_id === 'string' ? body.attestation_id : '';
  if (!attestationId) return jsonResponse({ ok: false, error: 'invalid_request' }, 400);

  if (body.revoke) {
    const hash = typeof body.token_hash === 'string' ? body.token_hash : '';
    if (!hash) return jsonResponse({ ok: false, error: 'token_hash_required' }, 400);
    // The row count is checked: a mistyped hash, or one belonging to a different
    // attestation, matched nothing and the operator was still told the link was
    // dead - while it stayed live until its expiry, up to 90 days later.
    const res = await env.VERIFY_DB.prepare(
      `UPDATE view_grants SET revoked_at = ?
        WHERE token_hash = ? AND attestation_id = ? AND revoked_at IS NULL`)
      .bind(new Date().toISOString(), hash, attestationId).run();
    if (!res?.meta?.changes) {
      return jsonResponse({ ok: false, error: 'grant_not_found_or_already_revoked' }, 404);
    }
    return jsonResponse({ ok: true, revoked: true });
  }

  const attestation = await env.VERIFY_DB
    .prepare('SELECT id, status FROM attestations WHERE id = ?').bind(attestationId).first();
  if (!attestation) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  // A grant for something never published would show a reader a statement no
  // one reviewed.
  if (attestation.status === 'pending_review' || attestation.status === 'rejected') {
    return jsonResponse({ ok: false, error: 'not_publishable', status: attestation.status }, 409);
  }

  const kind = normalizeGrantKind(body.kind);
  if (kind === null) {
    return jsonResponse({ ok: false, error: 'invalid_kind', allowed: GRANT_KINDS }, 400);
  }

  const token = newToken();
  const hash = await tokenHash(token);
  const label = typeof body.label === 'string' ? body.label.trim() : null;
  // Number.isFinite alone accepted 0 and negatives, minting a grant that
  // grantState() reports as expired on its first use while the endpoint
  // cheerfully returned a URL.
  const ttlDays = body.ttl_days === undefined
    ? (kind === 'preview' ? PREVIEW_TTL_DAYS : DEFAULT_TTL_DAYS)
    : body.ttl_days;
  if (!Number.isFinite(ttlDays) || ttlDays < MIN_TTL_DAYS || ttlDays > MAX_TTL_DAYS) {
    return jsonResponse({ ok: false, error: 'ttl_days_out_of_range',
                          min: MIN_TTL_DAYS, max: MAX_TTL_DAYS }, 400);
  }
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000).toISOString();

  await batchWithAudit(env, [
    env.VERIFY_DB.prepare(
      `INSERT INTO view_grants (token_hash, attestation_id, label, issued_by, expires_at, kind)
       VALUES (?,?,?,'admin',?,?)`).bind(hash, attestationId, label, expiresAt, kind),
  ], {
    attestation_id: attestationId, action: 'grant_issued', actor: 'operator',
    detail: JSON.stringify({ label, expires_at: expiresAt, kind }), public_summary: null,
  });

  const base = `https://mapasocietario.es${grantPath(kind, token)}`;
  return jsonResponse({
    ok: true, token_hash: hash, expires_at: expiresAt, kind,
    url: base,
    // The stated audience is a foreign professional, so the English rendering
    // needs a reachable address. There is no /en/ grant route, so language is a
    // query parameter on the same resource.
    url_en: `${base}?lang=en`,
    local_url: `http://localhost:5173${grantPath(kind, token)}`,
  });
}
