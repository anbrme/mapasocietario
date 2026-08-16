/**
 * Build-time generator for the "interlocking boards of the IBEX 35" data study
 * (Pillar-2 authority artifact). Reads the committed snapshot
 * src/data/interlock-ibex35.json (regenerate deliberately for a new edition —
 * a data study is a dated, citable snapshot, not a live widget) and writes two
 * standalone, crawlable HTML pages:
 *   ES → dist/estudios/consejos-cruzados-ibex-35/index.html
 *   EN → dist/en/studies/ibex-35-interlocking-boards/index.html
 *
 * Standalone docs (not the SPA shell) so Cloudflare Pages serves them directly
 * and no React route collides — same approach as the /empresa entity pages.
 * Runs in POSTBUILD (after `vite build` empties dist/), alongside the barometro
 * and prerender generators. The two URLs are listed in the static
 * public/sitemap-pages.xml, so no build-ordering dependency on the sitemap.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEED } from '../functions/empresa/_ibex35.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const SITE = 'https://mapasocietario.es';

const data = JSON.parse(readFileSync(path.join(root, 'src/data/interlock-ibex35.json'), 'utf8'));

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// "APELLIDO1 APELLIDO2 NOMBRE" → "Apellido1 Apellido2 Nombre"
const titleCase = (s) =>
  String(s).toLowerCase().replace(/(^|[\s-])([\p{L}])/gu, (_, sep, ch) => sep + ch.toUpperCase());

const PATHS = {
  es: '/estudios/consejos-cruzados-ibex-35',
  en: '/en/studies/ibex-35-interlocking-boards',
};

const fmtDate = (iso, lang) => {
  const [y, m] = iso.split('-');
  const months = lang === 'en'
    ? ['January','February','March','April','May','June','July','August','September','October','November','December']
    : ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return lang === 'en' ? `${months[+m - 1]} ${y}` : `${months[+m - 1]} de ${y}`;
};

// ---------------------------------------------------------------------------
// Arc diagram: connected companies on a baseline (grouped by sector, sized by
// board), semicircular arcs above linking companies that share a director.
// Amber arcs = a director on three boards; grey dashed = same corporate group.
// Deterministic, crawlable, no JS — reads left-to-right like prose.
// ---------------------------------------------------------------------------
const SECTOR_COLORS = [
  '#2563eb', '#0891b2', '#059669', '#65a30d', '#ca8a04', '#dc2626',
  '#db2777', '#9333ea', '#4f46e5', '#0d9488', '#b45309', '#be123c',
  '#7c3aed', '#0369a1', '#15803d', '#9f1239',
];

function arcDiagramSvg() {
  const nameOf = {}, sizeOf = {}, sectorOf = {};
  data.board_sizes.forEach((b) => {
    nameOf[b.slug] = b.name;
    sizeOf[b.slug] = b.count;
    sectorOf[b.slug] = (SEED[b.slug] && SEED[b.slug].sector) || '—';
  });

  const connected = new Set();
  data.edges.forEach((e) => { connected.add(e.a); connected.add(e.b); });

  // Sectors present, in a stable order; one colour each.
  const sectors = [...new Set([...connected].map((s) => sectorOf[s]))].sort((a, b) => a.localeCompare(b, 'es'));
  const colorFor = {};
  sectors.forEach((s, i) => { colorFor[s] = SECTOR_COLORS[i % SECTOR_COLORS.length]; });

  // Order nodes by sector (so same-sector links are short), then board size.
  const nodes = [...connected].sort((a, b) => {
    const sa = sectors.indexOf(sectorOf[a]), sb = sectors.indexOf(sectorOf[b]);
    return sa !== sb ? sa - sb : (sizeOf[b] || 0) - (sizeOf[a] || 0);
  });

  const n = nodes.length;
  const W = 1000, marginX = 46, baselineY = 470, H = 690;
  const step = n > 1 ? (W - 2 * marginX) / (n - 1) : 0;
  const x = {};
  nodes.forEach((s, i) => { x[s] = marginX + i * step; });
  const rOf = (s) => 3 + Math.sqrt(sizeOf[s] || 1) * 1.4;

  // Directors on three boards → their arcs get the amber accent.
  const triNames = new Set(data.people_multi.filter((p) => p.count >= 3).map((p) => p.name));
  const maxH = baselineY - 40;

  const arcs = data.edges.map((e) => {
    const ax = x[e.a], bx = x[e.b], dx = Math.abs(bx - ax);
    const h = Math.min(dx * 0.55, maxH);
    const isHub = e.shared.some((nm) => triNames.has(nm));
    const stroke = e.affiliated ? '#94a3b8' : (isHub ? '#d97706' : '#2563eb');
    const dash = e.affiliated ? ' stroke-dasharray="5 4"' : '';
    const w = Math.min(1.2 + e.shared.length * 0.9, 4.5);
    const op = e.affiliated ? 0.55 : (isHub ? 0.9 : 0.5);
    const d = `M ${ax.toFixed(1)} ${baselineY} C ${ax.toFixed(1)} ${(baselineY - h).toFixed(1)}, ${bx.toFixed(1)} ${(baselineY - h).toFixed(1)}, ${bx.toFixed(1)} ${baselineY}`;
    const shared = e.shared.map((nm) => titleCase(nm)).join(', ');
    return `<g class="arc" data-a="${e.a}" data-b="${e.b}" data-an="${esc(e.a_name)}" data-bn="${esc(e.b_name)}" data-shared="${esc(shared)}">`
      + `<path class="hit" d="${d}" fill="none" stroke="transparent" stroke-width="16"/>`
      + `<path class="ln" d="${d}" fill="none" stroke="${stroke}" stroke-opacity="${op}" stroke-width="${w.toFixed(1)}"${dash}/></g>`;
  }).join('');

  const baseline = `<line x1="${marginX - 12}" y1="${baselineY}" x2="${(W - marginX + 12).toFixed(1)}" y2="${baselineY}" stroke="#cbd5e1" stroke-width="1"/>`;

  const marks = nodes.map((s) => {
    const cx = x[s], r = rOf(s), col = colorFor[sectorOf[s]];
    const ly = baselineY + 14;
    return `<g class="node" data-slug="${s}" data-name="${esc(nameOf[s])}">`
      + `<circle cx="${cx.toFixed(1)}" cy="${baselineY}" r="${r.toFixed(1)}" fill="${col}" stroke="#fff" stroke-width="1"/>`
      + `<text x="${cx.toFixed(1)}" y="${ly}" transform="rotate(90 ${cx.toFixed(1)} ${ly})" font-size="11" fill="#475569">${esc(nameOf[s])}</text></g>`;
  }).join('');

  const legend = sectors.map((s) => `<span class="lg"><i style="background:${colorFor[s]}"></i>${esc(s)}</span>`).join('');

  const svg = `<svg id="arcsvg" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">${arcs}${baseline}${marks}</svg>`;
  return { svg, legend };
}

// ---------------------------------------------------------------------------
// i18n copy
// ---------------------------------------------------------------------------
const T = {
  es: {
    htmlLang: 'es', ogLocale: 'es_ES',
    title: 'Consejos cruzados del IBEX 35: los consejeros que se sientan en varios consejos | Mapa Societario',
    desc: `Estudio de datos: ${data.stats.total_people_multi} personas se sientan en dos o más consejos de administración del IBEX 35 y ${data.stats.companies_connected} de las 35 mayores cotizadas están conectadas por un consejero común. Datos del Registro Mercantil (BORME).`,
    h1: 'Los consejos cruzados del IBEX 35',
    lead: `Quién se sienta en más de un consejo de administración entre las 35 mayores empresas cotizadas de España. Un estudio a partir de datos del Registro Mercantil (BORME), a fecha de ${fmtDate(data.as_of, 'es')}.`,
    heroA: `${data.stats.total_people_multi} personas`,
    heroAt: 'se sientan en dos o más consejos del IBEX 35',
    heroB: `${data.stats.companies_connected} de 35`,
    heroBt: 'empresas están conectadas por al menos un consejero común',
    heroC: `${data.stats.on_three} personas`,
    heroCt: 'se sientan en tres consejos distintos a la vez',
    netTitle: 'El mapa de consejos compartidos',
    netCaption: `Cada punto sobre la línea es una empresa del IBEX 35, ordenada por sector y con el tamaño proporcional a su consejo; cada arco une a dos empresas que comparten consejero. En ámbar, los arcos de las ${data.stats.on_three} personas que se sientan en tres consejos a la vez. Las líneas discontinuas unen sociedades del mismo grupo. Las ${data.stats.companies_isolated} empresas que no comparten ningún consejero con el resto no aparecen. Pasa el ratón o toca un arco para ver qué consejero conecta cada par.`,
    tableTitle: 'Consejeros en dos o más consejos',
    thName: 'Consejero', thN: 'Consejos', thCos: 'Empresas',
    affilNote: '(mismo grupo)',
    linksWord: 'empresas conectadas',
    methodTitle: 'Metodología',
    method: [
      `Universo: las 35 empresas del IBEX 35 tal como las cataloga Mapa Societario (una entidad española por índice; matrices cotizadas fuera de España se representan por su sociedad española).`,
      `Fuente: miembros del órgano de administración vigentes según las publicaciones del BORME, a fecha de ${fmtDate(data.as_of, 'es')}. Se incluyen únicamente personas físicas con cargo de consejo (presidencia, vicepresidencia, consejeros, administradores); se excluyen auditores, apoderados y consejeros que sean personas jurídicas.`,
      `La identidad de cada persona entre empresas se resuelve por coincidencia de apellidos y nombre, tolerante al orden y a los segundos nombres, y se verifica a mano mediante una capa de correcciones que descarta homónimos y une variantes de un mismo nombre (por ejemplo, Josep y José).`,
      `Acciona y Acciona Energía forman parte del mismo grupo; los consejeros que solo comparten esas dos sociedades se cuentan aparte de los ${data.stats.cross_group_people} que conectan grupos distintos.`,
    ],
    disclaimer: 'Análisis independiente basado en publicaciones oficiales del BORME y elaborado mediante procesos automatizados. Puede contener errores u omisiones. Mapa Societario no es el Registro Mercantil y no emite certificaciones.',
    ctaTitle: 'Explora cualquier empresa española, no solo el IBEX',
    ctaText: 'Este mapa cubre 35 empresas. La herramienta hace lo mismo con cualquiera de los 3,2 millones de sociedades españolas del BORME: busca una empresa o un administrador y explora sus vínculos en un grafo interactivo.',
    ctaBtn: 'Abrir el buscador →',
    crumbHome: 'Mapa Societario', crumbStudies: 'Estudios',
  },
  en: {
    htmlLang: 'en', ogLocale: 'en_GB',
    title: 'The Interlocking Boards of the IBEX 35 | Mapa Societario',
    desc: `Data study: ${data.stats.total_people_multi} people sit on two or more IBEX 35 boards, and ${data.stats.companies_connected} of Spain's 35 largest listed companies are linked by a shared director. Built from Spanish commercial-registry (BORME) data.`,
    h1: 'The interlocking boards of the IBEX 35',
    lead: `Who sits on more than one board among Spain's 35 largest listed companies. A study built from Spanish commercial-registry (BORME) data, as of ${fmtDate(data.as_of, 'en')}.`,
    heroA: `${data.stats.total_people_multi} people`,
    heroAt: 'sit on two or more IBEX 35 boards',
    heroB: `${data.stats.companies_connected} of 35`,
    heroBt: 'companies are linked by at least one shared director',
    heroC: `${data.stats.on_three} people`,
    heroCt: 'sit on three separate boards at once',
    netTitle: 'The map of shared boards',
    netCaption: `Each dot on the line is an IBEX 35 company, ordered by sector and sized by its board; each arc links two companies that share a director. Amber arcs mark the ${data.stats.on_three} people who sit on three boards at once. Dashed lines link companies in the same group. The ${data.stats.companies_isolated} companies that share no director with the rest are not shown. Hover or tap an arc to see which director links each pair.`,
    tableTitle: 'Directors on two or more boards',
    thName: 'Director', thN: 'Boards', thCos: 'Companies',
    affilNote: '(same group)',
    linksWord: 'companies linked',
    methodTitle: 'Methodology',
    method: [
      `Universe: the 35 IBEX 35 companies as catalogued by Mapa Societario (one Spanish entity per index; parents listed outside Spain are represented by their Spanish company).`,
      `Source: sitting board members per current BORME registry publications, as of ${fmtDate(data.as_of, 'en')}. Only individuals holding a board role (chair, deputy chair, directors) are included; auditors, holders of power of attorney, and corporate directors are excluded.`,
      `Each person's identity across companies is resolved by surname and given-name matching, tolerant to name order and middle names, and then hand-verified through a corrections layer that rejects namesakes and merges spelling variants of one person (for example, Josep and José).`,
      `Acciona and Acciona Energía belong to the same group; directors who share only those two companies are counted separately from the ${data.stats.cross_group_people} who connect distinct groups.`,
    ],
    disclaimer: 'Independent analysis based on official BORME publications and produced through automated processes. It may contain errors or omissions. Mapa Societario is not the Registro Mercantil and does not issue certificates.',
    ctaTitle: 'Explore any Spanish company, not just the IBEX',
    ctaText: 'This map covers 35 companies. The tool does the same for any of the 3.2 million Spanish companies in BORME: search a company or a director and explore their links in an interactive graph.',
    ctaBtn: 'Open the search →',
    crumbHome: 'Mapa Societario', crumbStudies: 'Studies',
  },
};

const STYLE = `<style>
  :root{--ink:#0f172a;--mut:#64748b;--line:#e2e8f0;--bg:#f8fafc;--brand:#2563eb}
  *{box-sizing:border-box}
  body{margin:0;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg)}
  .wrap{max-width:860px;margin:0 auto;padding:32px 20px 80px}
  a{color:var(--brand)}
  nav.crumbs{font-size:13px;color:var(--mut);margin-bottom:18px}
  .langs{float:right}
  h1{font-size:32px;line-height:1.12;margin:0 0 12px}
  h2{font-size:21px;margin:40px 0 14px;padding-top:20px;border-top:1px solid var(--line)}
  .lead{color:var(--mut);font-size:17px;margin:0 0 28px}
  .heroes{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:0 0 8px}
  .hero{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px 22px}
  .hero .n{font-size:30px;font-weight:800;color:var(--brand);line-height:1.1}
  .hero .t{color:var(--mut);font-size:14px;margin-top:6px}
  figure{margin:14px 0 0}
  .net{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;position:relative}
  figcaption{color:var(--mut);font-size:13px;margin-top:10px}
  .legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin:12px 2px 0}
  .legend .lg{display:inline-flex;align-items:center;font-size:11.5px;color:var(--mut)}
  .legend .lg i{width:10px;height:10px;border-radius:3px;margin-right:5px;display:inline-block}
  #arcsvg .arc{cursor:pointer}
  #arcsvg .arc .ln,#arcsvg .node{transition:opacity .12s}
  #arcsvg.faded .arc:not(.on) .ln{opacity:.07}
  #arcsvg.faded .node:not(.on){opacity:.22}
  #arcsvg .arc.on .ln{stroke-opacity:1}
  #arcsvg .node.on text{font-weight:700;fill:#0f172a}
  #arcsvg .node.on circle{stroke:#0f172a;stroke-width:1.5}
  .tt{position:absolute;pointer-events:none;background:#0f172a;color:#fff;font-size:12px;line-height:1.4;padding:7px 11px;border-radius:8px;max-width:280px;transform:translate(-50%,-100%);box-shadow:0 6px 18px rgba(15,23,42,.22);z-index:5}
  .tt b{font-weight:700}
  .tt .sub{opacity:.8;font-size:11px}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:14px}
  th{background:#f1f5f9;text-align:left;color:var(--mut);font-size:13px}
  th,td{padding:10px 13px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
  tr:last-child td{border-bottom:0}
  .cos{color:var(--mut)}
  .aff{color:#94a3b8;font-size:12px}
  ol.method{color:#334155;font-size:14px;padding-left:20px}
  ol.method li{margin-bottom:8px}
  .disc{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:10px;padding:12px 16px;font-size:13px;margin:18px 0 0}
  .cta{margin:40px 0 0;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;border-radius:16px;padding:28px;text-align:center}
  .cta h2{border:0;color:#fff;margin:0 0 8px;padding:0}
  .cta p{margin:0 auto 18px;opacity:.92;max-width:560px}
  .cta a{display:inline-block;font-weight:700;text-decoration:none;padding:12px 26px;border-radius:10px;background:#fff;color:#1e3a8a}
  footer{margin-top:44px;font-size:12px;color:var(--mut);border-top:1px solid var(--line);padding-top:16px}
</style>`;

function peopleRows(t) {
  return data.people_multi.map((p) => {
    const cos = p.companies.map((c) => esc(c.name)).join(', ');
    const aff = p.affiliated ? ` <span class="aff">${t.affilNote}</span>` : '';
    return `<tr><td>${esc(titleCase(p.name))}</td><td>${p.count}</td><td class="cos">${cos}${aff}</td></tr>`;
  }).join('');
}

function jsonLd(t, lang) {
  const url = `${SITE}${PATHS[lang]}/`;
  const article = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: t.h1, description: t.desc, url,
    datePublished: data.as_of, inLanguage: lang,
    isBasedOn: 'https://www.boe.es/diario_borme/',
    publisher: { '@type': 'Organization', name: 'Mapa Societario', '@id': 'https://nurnbergconsulting.com/#org' },
  };
  const crumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.crumbHome, item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: t.h1, item: url },
    ],
  };
  const ser = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  return [article, crumb].map((o) => `<script type="application/ld+json">${ser(o)}</script>`).join('');
}

function render(lang) {
  const t = T[lang];
  const arc = arcDiagramSvg();
  const url = `${SITE}${PATHS[lang]}/`;
  const altLang = lang === 'en' ? 'es' : 'en';
  const altPath = PATHS[altLang];
  const altLabel = lang === 'en' ? 'Español' : 'English';
  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow">
<link rel="alternate" hreflang="es" href="${SITE}${PATHS.es}/">
<link rel="alternate" hreflang="en" href="${SITE}${PATHS.en}/">
<link rel="alternate" hreflang="x-default" href="${SITE}${PATHS.es}/">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(t.h1)}">
<meta property="og:description" content="${esc(t.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${t.ogLocale}">
<meta property="og:image" content="${SITE}/og-image.svg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(t.h1)}">
<meta name="twitter:description" content="${esc(t.desc)}">
${jsonLd(t, lang)}
${STYLE}
</head>
<body>
<div class="wrap">
  <nav class="crumbs"><span class="langs"><a href="${altPath}/">${altLabel}</a></span><a href="/">${t.crumbHome}</a> › ${t.crumbStudies}</nav>
  <h1>${esc(t.h1)}</h1>
  <p class="lead">${esc(t.lead)}</p>

  <div class="heroes">
    <div class="hero"><div class="n">${esc(t.heroA)}</div><div class="t">${esc(t.heroAt)}</div></div>
    <div class="hero"><div class="n">${esc(t.heroB)}</div><div class="t">${esc(t.heroBt)}</div></div>
    <div class="hero"><div class="n">${esc(t.heroC)}</div><div class="t">${esc(t.heroCt)}</div></div>
  </div>

  <h2>${esc(t.netTitle)}</h2>
  <figure>
    <div class="net">${arc.svg}<div class="tt" id="tt" hidden></div></div>
    <figcaption>${esc(t.netCaption)}</figcaption>
    <div class="legend">${arc.legend}</div>
  </figure>

  <h2>${esc(t.tableTitle)}</h2>
  <table>
    <thead><tr><th>${t.thName}</th><th>${t.thN}</th><th>${t.thCos}</th></tr></thead>
    <tbody>${peopleRows(t)}</tbody>
  </table>

  <h2>${esc(t.methodTitle)}</h2>
  <ol class="method">${t.method.map((m) => `<li>${esc(m)}</li>`).join('')}</ol>
  <p class="disc">${esc(t.disclaimer)}</p>

  <div class="cta">
    <h2>${esc(t.ctaTitle)}</h2>
    <p>${esc(t.ctaText)}</p>
    <a href="/app">${esc(t.ctaBtn)}</a>
  </div>

  <footer>Mapa Societario · ${fmtDate(data.as_of, lang)}</footer>
</div>
<script>
(function(){
  var svg=document.getElementById('arcsvg'); if(!svg) return;
  var tt=document.getElementById('tt');
  var arcs=[].slice.call(svg.querySelectorAll('.arc'));
  var nodes=[].slice.call(svg.querySelectorAll('.node'));
  var bySlug={}; nodes.forEach(function(n){ bySlug[n.getAttribute('data-slug')]=n; });
  var locked=false;
  function reset(){ arcs.forEach(function(a){a.classList.remove('on');}); nodes.forEach(function(n){n.classList.remove('on');}); }
  function hide(){ svg.classList.remove('faded'); reset(); tt.hidden=true; }
  function tip(title,sub,e){ tt.replaceChildren(); var b=document.createElement('b'); b.textContent=title; tt.appendChild(b); tt.appendChild(document.createElement('br')); var s=document.createElement('span'); s.className='sub'; s.textContent=sub; tt.appendChild(s); tt.hidden=false; var r=svg.getBoundingClientRect(); var px=(e.clientX!=null?e.clientX:r.left+r.width/2)-r.left; var py=(e.clientY!=null?e.clientY:r.top)-r.top; tt.style.left=Math.min(Math.max(px,52),r.width-52)+'px'; tt.style.top=Math.max(py-14,26)+'px'; }
  function arcOn(a,e){ svg.classList.add('faded'); reset(); a.classList.add('on'); var A=a.getAttribute('data-a'),B=a.getAttribute('data-b'); if(bySlug[A])bySlug[A].classList.add('on'); if(bySlug[B])bySlug[B].classList.add('on'); tip(a.getAttribute('data-an')+' \\u2194 '+a.getAttribute('data-bn'), a.getAttribute('data-shared'), e); }
  function nodeOn(n,e){ svg.classList.add('faded'); reset(); n.classList.add('on'); var s=n.getAttribute('data-slug'),c=0; arcs.forEach(function(a){ var A=a.getAttribute('data-a'),B=a.getAttribute('data-b'); if(A===s||B===s){ a.classList.add('on'); var o=A===s?B:A; if(bySlug[o])bySlug[o].classList.add('on'); c++; } }); tip(n.getAttribute('data-name'), c+' ${t.linksWord}', e); }
  svg.addEventListener('pointermove',function(e){ if(locked) return; var a=e.target.closest('.arc'); if(a){ arcOn(a,e); return; } var n=e.target.closest('.node'); if(n){ nodeOn(n,e); return; } hide(); });
  svg.addEventListener('pointerleave',function(){ if(!locked) hide(); });
  svg.addEventListener('click',function(e){ var el=e.target.closest('.arc')||e.target.closest('.node'); locked=false; if(!el){ hide(); return; } if(el.classList.contains('arc')) arcOn(el,e); else nodeOn(el,e); locked=true; });
  document.addEventListener('click',function(e){ if(locked && !e.target.closest('#arcsvg')){ locked=false; hide(); } });
})();
</script>
</body>
</html>`;
}

const distDir = path.resolve(root, 'dist');
for (const lang of ['es', 'en']) {
  const outDir = path.join(distDir, PATHS[lang]);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'index.html'), render(lang), 'utf8');
  console.log(`  Study: ${PATHS[lang]}/index.html`);
}
