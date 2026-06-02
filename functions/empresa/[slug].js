/**
 * Cloudflare Pages Function — server-rendered, indexable company page.
 *
 * Route:  /empresa/:slug   (e.g. /empresa/repsol-sa)
 *
 * Why this exists: the React app is a client-side SPA, so Googlebot sees an
 * empty shell for every company. This function runs at the edge, fetches the
 * company straight from the live v3 index (api.ncdata.eu -> borme_companies_v3)
 * and returns fully-rendered HTML with real text, tables and structured data.
 * The interactive force-graph stays behind the app — this page is the SEO entry
 * point + conversion hook into /app.
 *
 * Data freshness: rendered on demand, cached at the edge for 24h
 * (s-maxage) with stale-while-revalidate, so pages track the daily BORME
 * pipeline without any rebuild.
 */

import { SEED } from './_ibex35.js';

const API_BASE = 'https://api.ncdata.eu';
const SITE = 'https://mapasocietario.es';

// ---------------------------------------------------------------------------
// slug helpers  (kept reversible-enough; exact name is resolved via the index)
// ---------------------------------------------------------------------------

export function nameToSlug(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/ñ/gi, 'n')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')     // anything else -> hyphen
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function slugToQuery(slug) {
  return (slug || '').replace(/-+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// data access (live v3 index via the public proxy)
// ---------------------------------------------------------------------------

async function jsonOrNull(url, signal) {
  try {
    const r = await fetch(url, { signal, headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/**
 * Resolve a lossy slug to the exact canonical company name held in the index.
 * We use the directory autocomplete (id === company_name_normalized) so we
 * never rely on the fuzzy profile endpoint for identity.
 */
async function resolveCompanyName(slug, signal) {
  const data = await jsonOrNull(
    `${API_BASE}/bormes/companies/directory/autocomplete?q=${encodeURIComponent(slugToQuery(slug))}&limit=10`,
    signal,
  );
  const suggestions = (data && data.suggestions) || [];
  if (!suggestions.length) return null;
  const exact = suggestions.find((s) => nameToSlug(s.company_name) === slug);
  return exact || suggestions[0];
}

// ---------------------------------------------------------------------------
// rendering
// ---------------------------------------------------------------------------

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmtDate = (d) => {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
};

const fmtEur = (n) =>
  typeof n === 'number'
    ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
    : '';

// Public pages show only board/governance roles. Apoderados (powers of
// attorney), committee members and auditors are hidden — for large listed firms
// they number in the hundreds and add no signal. BORME stores positions as
// cryptic abbreviations, so we exclude non-board patterns first, then include.
const MAX_OFFICERS = 40;

function isBoardRole(o) {
  const p = (o.position_normalized || o.position || '').toUpperCase();
  if (!p) return false;
  // Exclusions first (order matters): apoderados, committee members, auditors.
  if (/(APO\.|APODER)/.test(p)) return false;
  if (/(COM\.|CTE\.|COMIS|COMITE|VOCCOM|MIEMCOM|MMBR|MBRO|M\.COM)/.test(p)) return false;
  if (/(AUDITOR|AUD\.)/.test(p)) return false;
  // Inclusions: administradores, consejeros (incl. CON.IND./CON.DEL. forms),
  // presidencia, secretaría, liquidador.
  return /(PRESIDENT|VICEPRESID|CONSEJ|CONS\.|CON\.IND|CON\.DEL|ADMINISTR|ADM\.|SECRE|LIQUIDAD)/.test(p);
}

// Expand the most common BORME abbreviations for readability (SEO + humans).
const POSITION_LABELS = {
  'ADM. UNICO': 'Administrador único',
  'ADM. SOLIDARIO': 'Administrador solidario',
  'ADM. MANCOMUNADO': 'Administrador mancomunado',
  'CON.DELEGADO': 'Consejero delegado',
  'CONS.EJECUTI': 'Consejero ejecutivo',
  'CONS.EXTERNO': 'Consejero externo',
  'CONS.EXT.IND': 'Consejero externo independiente',
  'SECRENOCONSJ': 'Secretario no consejero',
  'VICESECR': 'Vicesecretario',
};
function prettyPosition(pos) {
  const p = (pos || '').toUpperCase();
  return POSITION_LABELS[p] || pos || '';
}

function selectOfficers(list) {
  const all = list || [];
  const board = all.filter(isBoardRole);
  const shown = board.slice(0, MAX_OFFICERS);
  const hiddenOther = all.length - board.length; // apoderados/committees/auditors
  const hiddenOverflow = Math.max(0, board.length - MAX_OFFICERS);
  return { shown, hiddenOther, hiddenOverflow };
}

// noBoardNote: when there are no board roles (only apoderados etc.), emit a note
// instead of listing them — used for the "vigentes" table, not the resigned one.
function officersRows(rawList, dateKey, dateLabel, { noBoardNote = false } = {}) {
  const { shown: list, hiddenOther, hiddenOverflow } = selectOfficers(rawList);
  if (!list.length) {
    if (noBoardNote && hiddenOther) {
      return `<p class="more">No constan administradores ni consejeros vigentes en esta denominación (${hiddenOther} apoderado(s) u otros cargos registrados).</p>`;
    }
    return '';
  }
  const rows = list
    .map(
      (o) => `<tr>
        <td>${esc(o.name || o.name_normalized)}</td>
        <td>${esc(prettyPosition(o.position_normalized || o.position))}</td>
        <td>${esc(fmtDate(o[dateKey]))}</td>
      </tr>`,
    )
    .join('');
  const notes = [];
  if (hiddenOther) notes.push(`${hiddenOther} apoderado(s) y otros cargos no incluidos`);
  if (hiddenOverflow) notes.push(`${hiddenOverflow} más`);
  const more = notes.length ? `<p class="more">${notes.join('; ')}.</p>` : '';
  return `<table class="t">
    <thead><tr><th>Nombre</th><th>Cargo</th><th>${dateLabel}</th></tr></thead>
    <tbody>${rows}</tbody></table>${more}`;
}

function listBlock(title, arr) {
  if (!arr || !arr.length) return '';
  return `<h3>${esc(title)}</h3><ul class="pill">${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
}

function eventsBlock(events) {
  if (!events || !events.length) return '';
  const rows = events
    .slice(0, 8)
    .map((e) => {
      const types = (e.event_types || []).map((t) => t.type).join(', ');
      const summary = (e.full_entry || '').slice(0, 180);
      return `<li><span class="date">${esc(fmtDate(e.event_date))}</span>
        <strong>${esc(types || 'Acto registral')}</strong>
        <p>${esc(summary)}${(e.full_entry || '').length > 180 ? '…' : ''}</p></li>`;
    })
    .join('');
  return `<section><h2>Historial reciente (BORME)</h2><ol class="timeline">${rows}</ol></section>`;
}

function jsonLd(company, slug) {
  const officers = [
    ...(company.officers_active || []).map((o) => o.name || o.name_normalized),
  ].filter(Boolean);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.company_name,
    url: `${SITE}/empresa/${slug}`,
    ...(company.current_address ? { address: company.current_address } : {}),
    ...(company.first_seen ? { foundingDate: company.first_seen } : {}),
    ...(company.province ? { areaServed: company.province } : {}),
    ...(officers.length ? { employee: officers.slice(0, 10).map((n) => ({ '@type': 'Person', name: n })) } : {}),
    identifier: (company.identifiers || []).join(', '),
    description: `Estructura societaria de ${company.company_name}: administradores, socios, capital social e historial mercantil oficial (BORME).`,
  };
  // Escape characters that could break out of the <script> context. HTML esc()
  // can't be used here (it would corrupt the JSON), so neutralize <, --> and the
  // JS line separators that are invalid raw in a script body.
  const safe = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/-->/g, '--\\u003e')
    .replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return `<script type="application/ld+json">${safe}</script>`;
}

export function renderCompanyPage(company, events, slug, seed) {
  const name = company.company_name || company.company_name_normalized || '';
  // Curated (IBEX) entries own a clean canonical slug; otherwise derive it.
  const canonicalSlug = seed ? slug : nameToSlug(name);

  // Name-change handling: if this record points to a newer name, the canonical
  // SEO page is the NEW name's page (prevents the duplicate that the v3
  // name-variant problem creates). Skipped for curated entries.
  const renamedTo = !seed && company.has_new_name ? company.new_company_name : null;
  const canonicalUrl = renamedTo
    ? `${SITE}/empresa/${nameToSlug(renamedTo)}`
    : `${SITE}/empresa/${canonicalSlug}`;

  const title = `${name} — Administradores, socios y estructura societaria | Mapa Societario`;
  const desc = `Ficha societaria de ${name}: administradores actuales y cesados, socios, capital social (${
    fmtEur(company.current_capital) || 'n/d'
  }), domicilio${company.province ? ` en ${company.province}` : ''} e historial mercantil oficial (BORME).`;

  const badges = [
    company.company_type ? `<span class="badge">${esc(company.company_type)}</span>` : '',
    company.is_dissolved ? `<span class="badge danger">Disuelta</span>` : '',
    company.is_in_concurso ? `<span class="badge danger">Concurso</span>` : '',
    company.is_unipersonal ? `<span class="badge">Unipersonal</span>` : '',
  ].join('');

  const facts = [
    ['Forma jurídica', company.company_type],
    ['Provincia', company.province],
    ['Domicilio', company.current_address],
    ['Capital social', fmtEur(company.current_capital)],
    ['Primera inscripción', fmtDate(company.first_seen)],
    ['Última actualización', fmtDate(company.last_seen)],
    ['Identificadores BORME', (company.identifiers || []).join(', ')],
    ['Publicaciones', company.total_publications],
  ]
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join('');

  // Prior denominations, excluding self-references (BORME logs no-op
  // redenominaciones where old_name == new_name, and punctuation-only variants).
  const nameKey = (s) => (s || '').toUpperCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
  const currentKey = nameKey(name);
  const priorNames = [
    ...new Set(
      (company.name_changes || [])
        .map((c) => (typeof c === 'string' ? c : c.old_name || c.previous_name || ''))
        .filter(Boolean)
        .filter((n) => nameKey(n) !== currentKey),
    ),
  ];

  const renameNotice = renamedTo
    ? `<div class="notice">Esta sociedad pasó a denominarse <a href="/empresa/${nameToSlug(
        renamedTo,
      )}">${esc(renamedTo)}</a>. Consulta la ficha actualizada.</div>`
    : priorNames.length
    ? `<div class="notice">Denominaciones anteriores: ${priorNames.map(esc).join(', ')}.</div>`
    : '';

  // Curated listed-company card (NIF/ISIN/ticker/hoja from the IBEX seed).
  const cotizadaBlock = seed
    ? `<section class="cotizada">
        <h2>Sociedad cotizada${seed.ticker ? ` · ${esc(seed.ticker)}` : ''}</h2>
        <table class="facts"><tbody>
          ${seed.sector ? `<tr><th>Sector</th><td>${esc(seed.sector)}</td></tr>` : ''}
          ${seed.nif ? `<tr><th>NIF / CIF</th><td>${esc(seed.nif)}</td></tr>` : ''}
          ${seed.isin ? `<tr><th>ISIN</th><td>${esc(seed.isin)}</td></tr>` : ''}
          ${seed.hoja ? `<tr><th>Hoja registral</th><td>${esc(seed.hoja)}</td></tr>` : ''}
          ${seed.website ? `<tr><th>Web</th><td><a href="${esc(seed.website)}" rel="nofollow noopener" target="_blank">${esc(seed.website)}</a></td></tr>` : ''}
        </tbody></table>
        ${seed.note ? `<p class="more">${esc(seed.note)}</p>` : ''}
      </section>`
    : '';

  const active = officersRows(company.officers_active, 'appointed_date', 'Nombramiento', { noBoardNote: true });
  const resigned = officersRows(company.officers_resigned, 'resigned_date', 'Cese');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonicalUrl)}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(name)} — Estructura societaria">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonicalUrl)}">
<meta property="og:locale" content="es_ES">
<meta property="og:image" content="${SITE}/og-image.svg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(name)} — Estructura societaria">
<meta name="twitter:description" content="${esc(desc)}">
${jsonLd(company, canonicalSlug)}
<style>
  :root{--ink:#0f172a;--mut:#64748b;--line:#e2e8f0;--bg:#f8fafc;--brand:#2563eb}
  *{box-sizing:border-box}
  body{margin:0;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg)}
  .wrap{max-width:880px;margin:0 auto;padding:32px 20px 80px}
  a{color:var(--brand)}
  nav.crumbs{font-size:13px;color:var(--mut);margin-bottom:18px}
  h1{font-size:30px;line-height:1.15;margin:0 0 10px}
  h2{font-size:20px;margin:34px 0 12px;padding-top:18px;border-top:1px solid var(--line)}
  h3{font-size:15px;color:var(--mut);text-transform:uppercase;letter-spacing:.04em;margin:18px 0 8px}
  .lead{color:var(--mut);margin:0 0 16px}
  .badges{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}
  .badge{font-size:12px;font-weight:600;background:#e0e7ff;color:#3730a3;border-radius:999px;padding:3px 10px}
  .badge.danger{background:#fee2e2;color:#991b1b}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:14px}
  table.t th{background:#f1f5f9;text-align:left}
  th,td{padding:9px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
  tr:last-child td{border-bottom:0}
  .facts th{width:200px;color:var(--mut);font-weight:600}
  ul.pill{list-style:none;padding:0;display:flex;gap:8px;flex-wrap:wrap;margin:0}
  ul.pill li{background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px 12px;font-size:14px}
  .timeline{list-style:none;padding:0;margin:0}
  .timeline li{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin-bottom:10px}
  .timeline .date{display:inline-block;font-size:12px;color:var(--mut);margin-right:8px}
  .timeline p{margin:6px 0 0;font-size:13px;color:#334155}
  .more{font-size:13px;color:var(--mut);margin:8px 2px 0}
  .cotizada h2{border-top-color:#bfdbfe}
  .cotizada table{border-color:#bfdbfe}
  .notice{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:10px;padding:12px 16px;margin:0 0 18px;font-size:14px}
  .cta{margin:36px 0 0;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;border-radius:16px;padding:28px;text-align:center}
  .cta h2{border:0;color:#fff;margin:0 0 8px;padding:0}
  .cta p{margin:0 0 18px;opacity:.9}
  .cta a{display:inline-block;background:#fff;color:#1e3a8a;font-weight:700;text-decoration:none;padding:12px 26px;border-radius:10px}
  footer{margin-top:48px;font-size:12px;color:var(--mut);border-top:1px solid var(--line);padding-top:16px}
</style>
</head>
<body>
<div class="wrap">
  <nav class="crumbs"><a href="/">Mapa Societario</a> › Empresas › ${esc(name)}</nav>

  <h1>${esc(name)}</h1>
  <div class="badges">${badges}</div>
  <p class="lead">Ficha societaria oficial extraída del BORME: administradores, socios, capital e historial mercantil.</p>

  ${renameNotice}
  ${cotizadaBlock}

  <h2>Datos registrales</h2>
  <table class="facts"><tbody>${facts}</tbody></table>

  ${active ? `<h2>Administradores y cargos vigentes</h2>${active}` : ''}
  ${resigned ? `<h2>Cargos cesados o revocados</h2>${resigned}` : ''}

  ${
    (company.sole_shareholders && company.sole_shareholders.length) ||
    (company.sole_shareholder_individuals && company.sole_shareholder_individuals.length)
      ? `<h2>Estructura de socios</h2>
         ${listBlock('Socio único (sociedades)', company.sole_shareholders)}
         ${listBlock('Socio único (personas físicas)', company.sole_shareholder_individuals)}`
      : ''
  }

  ${
    company.capital_history && company.capital_history.length
      ? `<h2>Evolución del capital social</h2>
         <table class="t"><thead><tr><th>Fecha</th><th>Capital</th></tr></thead><tbody>${company.capital_history
           .slice(-6)
           .reverse()
           .map((c) => `<tr><td>${esc(fmtDate(c.date))}</td><td>${esc(fmtEur(c.amount))}</td></tr>`)
           .join('')}</tbody></table>`
      : ''
  }

  ${eventsBlock(events)}

  <div class="cta">
    <h2>Ver el mapa societario interactivo</h2>
    <p>Explora la red de participaciones, administradores compartidos y filiales de ${esc(name)}.</p>
    <a href="/app?search=${encodeURIComponent(name)}">Abrir mapa interactivo →</a>
  </div>

  <footer>
    Datos procedentes del Boletín Oficial del Registro Mercantil (BORME). Última actualización del registro: ${esc(
      fmtDate(company.last_seen),
    )}. Mapa Societario no es un registro oficial.
  </footer>
</div>
</body>
</html>`;
}

function notFoundPage(slug) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Empresa no encontrada | Mapa Societario</title>
<meta name="robots" content="noindex, follow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:640px;margin:80px auto;padding:0 20px;color:#0f172a}</style>
</head><body>
<h1>No hemos encontrado esa empresa</h1>
<p>No existe una ficha para «${esc(slugToQuery(slug))}» en nuestro índice del BORME.</p>
<p><a href="/app">Buscar empresas →</a></p>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Pages Function entrypoint
// ---------------------------------------------------------------------------

export async function onRequestGet({ params, waitUntil }) {
  const slug = String(params.slug || '').toLowerCase();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    // 1) Curated IBEX entries: clean slug → exact verified v3 doc (authoritative,
    //    skips fuzzy autocomplete which picks the wrong entity for listed firms).
    const seed = SEED[slug] || null;
    let name;

    if (seed) {
      name = seed.v3Name;
    } else {
      const match = await resolveCompanyName(slug, controller.signal);
      if (!match) {
        return new Response(notFoundPage(slug), {
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      name = match.company_name;

      // Redirect lossy/alias slugs to the canonical one (good for SEO + dedup).
      const canonical = nameToSlug(name);
      if (canonical && canonical !== slug) {
        return new Response(null, {
          status: 301,
          headers: { location: `/empresa/${canonical}`, 'cache-control': 'public, max-age=3600' },
        });
      }
    }

    const [profile, eventsResp] = await Promise.all([
      jsonOrNull(`${API_BASE}/bormes/v3/company/${encodeURIComponent(name)}`, controller.signal),
      jsonOrNull(`${API_BASE}/bormes/v3/events?company=${encodeURIComponent(name)}&size=8`, controller.signal),
    ]);

    const company = profile && profile.company ? profile.company : null;
    if (!company) {
      return new Response(notFoundPage(slug), {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    const events = (eventsResp && eventsResp.events) || [];
    const html = renderCompanyPage(company, events, slug, seed);

    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // fresh-ish: edge-cached 24h, served stale up to 7d while revalidating
        'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (err) {
    return new Response(notFoundPage(slug), {
      status: 503,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  } finally {
    clearTimeout(timeout);
  }
}
