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
import { buildTimeline, renderTimelineSvg } from '../../../src/verify/timeline.js';
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

  // The registry lane. Best-effort and time-boxed: the attestation is the
  // page's reason to exist, and it must render even when the upstream index is
  // slow or down - the timeline simply says it has nothing to draw.
  let events = [];
  try {
    const groupKey = JSON.parse(attestation.identity_snapshot || '{}').group_key;
    if (groupKey) {
      const r = await fetch(
        `https://api.ncdata.eu/bormes/v3/events?group_key=${encodeURIComponent(groupKey)}&size=100`,
        { headers: env.INTERNAL_API_KEY ? { 'X-Internal-Key': env.INTERNAL_API_KEY } : {},
          signal: AbortSignal.timeout(4000) });
      if (r.ok) events = ((await r.json()) || {}).events || [];
    }
  } catch { /* no lane is better than no page */ }

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

  // This Function is mounted only at /verificacion/g/*, so a pathname test for
  // '/en/' could never be true and the entire English rendering was unreachable
  // in production. Language is an explicit parameter on the same resource.
  const requested = (url.searchParams.get('lang') || '').toLowerCase();
  const lang = requested === 'en' ? 'en'
    : requested === 'es' ? 'es'
    : (request.headers.get('accept-language') || '').toLowerCase().startsWith('en') ? 'en'
    : 'es';
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
  .att-timeline { max-width: 44rem; margin: 2rem auto 0; }
  .att-timeline h2 { font-size: 1.05rem; }
  .tl { width: 100%; height: auto; }
  .tl-note, .tl-empty { font-size: .85rem; opacity: .75; }
</style></head><body>
${renderAttestationHtml(view, attestation.display_name, lang)}
<section class="att-timeline">
  <h2>${lang === 'en' ? 'Registry and statements' : 'Registro y declaraciones'}</h2>
  ${renderTimelineSvg(buildTimeline({ events, history: view.history,
      acceptedAt: view.accepted_at }), lang)}
  <p class="tl-note">${lang === 'en'
    ? 'Circles are registry filings; diamonds are statements. The dashed line marks acceptance: everything to its right is what the registry has recorded since.'
    : 'Los círculos son asientos registrales; los rombos, declaraciones. La línea discontinua marca la aceptación: a su derecha está lo que el registro ha recogido desde entonces.'}</p>
</section>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: privateHeaders('text/html; charset=utf-8'),
  });
}
