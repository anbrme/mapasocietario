/**
 * GET /verificacion/p/<token> — a pilot company's own /empresa page, rendered
 * with its badge visible before the badge is public.
 *
 * Why a route of its own rather than /empresa/<slug>?preview=<token>: /empresa
 * pages carry s-maxage=3600, so putting a token on that path is one missed
 * header away from a shared cache holding a badge that is not public yet. Here
 * the token stays inside the /verificacion/* family, which is private, no-store
 * and noindex, and the public /empresa handler never learns preview tokens
 * exist.
 *
 * Every invalid state returns the SAME 404 as the attestation route: unknown,
 * expired, revoked, wrong kind, or an attestation that is not publishable.
 */
import { tokenHash } from '../../../src/verify/ids.js';
import { publicProjection } from '../../../src/verify/projection.js';
import { insertPreviewBanner, previewGrantAllows } from '../../../src/verify/preview.js';
import { nameToSlug } from '../../empresa/_slug.js';
import { handleCompany } from '../../empresa/_lib.js';
import { privateHeaders } from '../../api/verify/_db.js';

const NOT_FOUND_BODY = JSON.stringify({ ok: false, error: 'not_found' });
const notFound = () => new Response(NOT_FOUND_BODY, { status: 404, headers: privateHeaders() });

export async function onRequestGet(ctx) {
  const { request, params, env } = ctx;
  const url = new URL(request.url);
  const raw = String(params.token || '');
  if (!raw || !env.VERIFY_DB) return notFound();

  const grant = await env.VERIFY_DB
    .prepare('SELECT * FROM view_grants WHERE token_hash = ?')
    .bind(await tokenHash(raw)).first();

  // Both are read before deciding, because the guard needs both and every
  // failing condition must produce the SAME 404.
  const attestation = grant ? await env.VERIFY_DB
    .prepare(`SELECT a.*, s.display_name FROM attestations a
                JOIN subjects s ON s.subject_id = a.subject_id
               WHERE a.id = ?`).bind(grant.attestation_id).first() : null;

  if (!previewGrantAllows(grant, attestation)) return notFound();

  const { results: facts } = await env.VERIFY_DB
    .prepare('SELECT * FROM attestation_facts WHERE attestation_id = ? ORDER BY id')
    .bind(attestation.id).all();

  const { results: history } = await env.VERIFY_DB
    .prepare(`SELECT seq, action, created_at, public_summary
                FROM audit_events
               WHERE attestation_id = ? AND public_summary IS NOT NULL
               ORDER BY seq`).bind(attestation.id).all();

  // Counts LINK ACCESSES, not viewers. Best-effort: a failed counter must never
  // break the read.
  try {
    await env.VERIFY_DB.prepare(
      `UPDATE view_grants SET access_count = access_count + 1, last_access_at = ?
        WHERE token_hash = ?`).bind(new Date().toISOString(), grant.token_hash).run();
  } catch { /* the preview matters more than the metric */ }

  const requested = (url.searchParams.get('lang') || '').toLowerCase();
  const lang = requested === 'en' ? 'en'
    : requested === 'es' ? 'es'
    : (request.headers.get('accept-language') || '').toLowerCase().startsWith('en') ? 'en'
    : 'es';

  // The slug is derived from the subject's display name. A company renamed
  // since its subject row was created will not resolve, and the preview lands
  // on the fallback page - which the operator sees when they open the link
  // themselves before sending it.
  const slug = nameToSlug(attestation.display_name);

  const response = await handleCompany(
    { params: { slug }, env, waitUntil: ctx.waitUntil }, lang,
    {
      attestationOverride: publicProjection(attestation, facts || [], history || []),
      privateResponse: true,
    },
  );

  const html = insertPreviewBanner(await response.text(), lang);
  return new Response(html, { status: response.status, headers: response.headers });
}
