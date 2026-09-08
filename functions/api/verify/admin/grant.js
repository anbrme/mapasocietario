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
import { requireAdmin, jsonResponse, auditStatement } from '../_db.js';

const DEFAULT_TTL_DAYS = 90;

export async function onRequestPost({ request, env }) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ ok: false, error: 'invalid_json' }, 400); }

  const attestationId = typeof body.attestation_id === 'string' ? body.attestation_id : '';
  if (!attestationId) return jsonResponse({ ok: false, error: 'invalid_request' }, 400);

  if (body.revoke) {
    const hash = typeof body.token_hash === 'string' ? body.token_hash : '';
    if (!hash) return jsonResponse({ ok: false, error: 'token_hash_required' }, 400);
    await env.VERIFY_DB.prepare(
      'UPDATE view_grants SET revoked_at = ? WHERE token_hash = ? AND attestation_id = ?')
      .bind(new Date().toISOString(), hash, attestationId).run();
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

  const token = newToken();
  const hash = await tokenHash(token);
  const label = typeof body.label === 'string' ? body.label.trim() : null;
  const ttlDays = Number.isFinite(body.ttl_days) ? body.ttl_days : DEFAULT_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000).toISOString();

  await env.VERIFY_DB.batch([
    env.VERIFY_DB.prepare(
      `INSERT INTO view_grants (token_hash, attestation_id, label, issued_by, expires_at)
       VALUES (?,?,?,'admin',?)`).bind(hash, attestationId, label, expiresAt),
    await auditStatement(env, {
      attestation_id: attestationId, action: 'grant_issued', actor: 'operator',
      detail: JSON.stringify({ label, expires_at: expiresAt }), public_summary: null,
    }),
  ]);

  return jsonResponse({
    ok: true, token_hash: hash, expires_at: expiresAt,
    url: `https://mapasocietario.es/verificacion/g/${token}`,
    local_url: `http://localhost:5173/verificacion/g/${token}`,
  });
}
