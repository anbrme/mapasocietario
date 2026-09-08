/**
 * GET /verificacion/g/<token> — the attestation, reachable only through a grant.
 *
 * The grant token IS the address, so the attestation id never travels
 * separately. Every invalid state — unknown, expired, revoked — returns the
 * SAME 404: a 403, or a distinct message, would confirm the record exists.
 *
 * One resource, two representations: JSON to a machine, HTML to a browser, both
 * from publicProjection, so a reader and an API can never disagree.
 */
import { tokenHash } from '../../../src/verify/ids.js';
import { grantState } from '../../../src/verify/grant.js';
import { publicProjection } from '../../../src/verify/projection.js';
import { renderAttestationHtml } from '../../../src/verify/render.js';
import { privateHeaders } from '../../api/verify/_db.js';

const NOT_FOUND_BODY = JSON.stringify({ ok: false, error: 'not_found' });
const notFound = () => new Response(NOT_FOUND_BODY, { status: 404, headers: privateHeaders() });

const wantsJson = (request, url) =>
  url.pathname.endsWith('.json') ||
  (request.headers.get('accept') || '').includes('application/json');

export async function onRequestGet({ request, params, env }) {
  const url = new URL(request.url);
  const raw = String(params.token || '').replace(/\.json$/, '');
  if (!raw) return notFound();

  const grant = await env.VERIFY_DB
    .prepare('SELECT * FROM view_grants WHERE token_hash = ?')
    .bind(await tokenHash(raw)).first();

  if (grantState(grant) !== 'valid') return notFound();

  const attestation = await env.VERIFY_DB
    .prepare(`SELECT a.*, s.display_name FROM attestations a
                JOIN subjects s ON s.subject_id = a.subject_id
               WHERE a.id = ?`).bind(grant.attestation_id).first();
  if (!attestation) return notFound();

  const { results: facts } = await env.VERIFY_DB
    .prepare('SELECT * FROM attestation_facts WHERE attestation_id = ? ORDER BY id')
    .bind(attestation.id).all();

  // Only rows carrying a public_summary are selected. The private `detail`
  // column is not even read, rather than being read and then filtered.
  const { results: history } = await env.VERIFY_DB
    .prepare(`SELECT seq, action, created_at, public_summary
                FROM audit_events
               WHERE attestation_id = ? AND public_summary IS NOT NULL
               ORDER BY seq`).bind(attestation.id).all();

  const view = publicProjection(attestation, facts || [], history || []);

  // Counts LINK ACCESSES, not viewers: forwarded links and email scanners both
  // land here. Best-effort — a failed counter must never break the read.
  try {
    await env.VERIFY_DB.prepare(
      `UPDATE view_grants SET access_count = access_count + 1, last_access_at = ?
        WHERE token_hash = ?`).bind(new Date().toISOString(), grant.token_hash).run();
  } catch { /* the record matters more than the metric */ }

  if (wantsJson(request, url)) {
    return new Response(JSON.stringify({ ok: true, attestation: view }),
      { status: 200, headers: privateHeaders() });
  }

  const lang = url.pathname.startsWith('/en/') ? 'en' : 'es';
  const title = `${attestation.display_name} — Mapa Societario`;
  const html = `<!doctype html><html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<title>${title.replace(/[<>&"]/g, '')}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.55 system-ui, sans-serif; margin: 0; padding: 2rem 1rem; }
  .att { max-width: 44rem; margin: 0 auto; }
  .att-status { padding: .9rem 1rem; border-left: 3px solid currentColor; background: #0001; }
  .att-facts { width: 100%; border-collapse: collapse; margin: 1.25rem 0; }
  .att-facts th, .att-facts td { text-align: left; padding: .5rem .6rem;
    border-bottom: 1px solid #8884; vertical-align: top; }
  .att-disclaimer { font-size: .9rem; opacity: .8; border-top: 1px solid #8884; padding-top: 1rem; }
  table { display: block; overflow-x: auto; }
</style></head><body>
${renderAttestationHtml(view, attestation.display_name, lang)}
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: privateHeaders('text/html; charset=utf-8'),
  });
}
