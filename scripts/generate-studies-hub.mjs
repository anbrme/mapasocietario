/**
 * Build-time generator for the studies hub:
 *   ES → dist/estudios/index.html
 *   EN → dist/en/studies/index.html
 *
 * Why this exists: the studies were reachable only by knowing their exact URL —
 * /estudios/ and /en/studies/ both returned 404. An orphaned study is a page
 * whose earned links dead-end instead of flowing on to the rest of the site,
 * and there was nowhere to point "our research" at. The hub is the container
 * every future study lands in, so it is generated from the registry in
 * src/copy/studies.js rather than hand-maintained.
 *
 * Standalone documents, like the study pages themselves, so Cloudflare Pages
 * serves them directly with no React route collision. Runs in POSTBUILD, after
 * `vite build` has emptied dist/.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUDIES, HUB_PATHS, LANGS, studyPath, hubPath } from '../src/copy/studies.js';
import { registryScale } from '../src/copy/registryScale.js';
import { esc, gaSnippet, CITE_STYLE, formatMonth } from './_study_chrome.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const SITE = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://mapasocietario.es').replace(/\/+$/, '');

// The address already published across the site — a press block that routes to
// a dead #contact anchor is worse than no press block.
const PRESS_EMAIL = 'mapasocietario@ncdata.eu';

// The date belongs to the snapshot, never to the registry: page and citation
// must not be able to disagree about when the data was taken.
const asOfById = Object.fromEntries(
  STUDIES.map((s) => [s.id, JSON.parse(readFileSync(path.join(root, 'src/data', s.dataFile), 'utf8')).as_of])
);

const T = {
  es: {
    htmlLang: 'es', ogLocale: 'es_ES',
    title: 'Estudios de datos sobre las empresas españolas | Mapa Societario',
    desc: `Estudios originales elaborados a partir del Registro Mercantil (BORME): ${registryScale('es').companies} millones de sociedades y ${registryScale('es').filings} millones de publicaciones. Datos, metodología y cifras citables.`,
    h1: 'Estudios de datos',
    lead: `Investigaciones propias sobre la estructura societaria española, calculadas sobre las publicaciones oficiales del BORME: ${registryScale('es').companies} millones de sociedades y ${registryScale('es').filings} millones de asientos desde 2009. Cada estudio publica su metodología y sus cifras para que puedan comprobarse y citarse.`,
    crumbHome: 'Mapa Societario', crumbHub: 'Estudios',
    listTitle: 'Estudios publicados',
    dataTitle: 'Sobre los datos',
    dataBody: `Todos los estudios se calculan sobre el BORME, el boletín oficial del Registro Mercantil, procesado desde 2009. No son estadísticas oficiales ni certificaciones registrales: son análisis independientes, elaborados mediante procesos automatizados, que pueden contener errores u omisiones. Cada estudio indica la fecha de los datos y las decisiones metodológicas que afectan a sus cifras.`,
    pressTitle: '¿Periodista o investigador?',
    pressBody: 'Las cifras de estos estudios pueden reproducirse citando la fuente. Si necesitas un corte concreto de los datos, los datos subyacentes o una comprobación antes de publicar, escríbenos.',
    pressCta: 'Escríbenos →',
    pressSubject: 'Consulta de prensa — Estudios de Mapa Societario',
    ctaTitle: 'Explora cualquier empresa española',
    ctaText: `Los estudios miran el conjunto. La herramienta hace lo mismo con una sola empresa: busca una sociedad o un administrador y explora sus vínculos en un grafo interactivo.`,
    ctaBtn: 'Abrir el buscador →',
    dateLabel: 'Datos a',
  },
  en: {
    htmlLang: 'en', ogLocale: 'en_GB',
    title: 'Data studies on Spanish companies | Mapa Societario',
    desc: `Original studies built from the Spanish commercial registry (BORME): ${registryScale('en').companies} million companies and ${registryScale('en').filings} million filings. Data, methodology and citable figures.`,
    h1: 'Data studies',
    lead: `Original research on Spanish corporate structure, computed over the official BORME registry publications: ${registryScale('en').companies} million companies and ${registryScale('en').filings} million filings since 2009. Every study publishes its methodology and its figures so they can be checked and cited.`,
    crumbHome: 'Mapa Societario', crumbHub: 'Studies',
    listTitle: 'Published studies',
    dataTitle: 'About the data',
    dataBody: `Every study is computed over BORME, the official gazette of the Spanish commercial registry, processed from 2009 onwards. These are not official statistics nor registry certificates: they are independent analyses produced through automated processes and may contain errors or omissions. Each study states the date of its data and the methodological choices that affect its figures.`,
    pressTitle: 'Journalist or researcher?',
    pressBody: 'Figures from these studies may be reproduced with attribution. If you need a specific cut of the data, the underlying records, or a check before you publish, get in touch.',
    pressCta: 'Get in touch →',
    pressSubject: 'Press enquiry — Mapa Societario data studies',
    ctaTitle: 'Explore any Spanish company',
    ctaText: `The studies look at the whole. The tool does the same for a single company: search a company or a director and explore their links in an interactive graph.`,
    ctaBtn: 'Open the search →',
    dateLabel: 'Data as of',
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
  .lead{color:var(--mut);font-size:17px;margin:0 0 8px}
  ul.studies{list-style:none;margin:0;padding:0;display:grid;gap:14px}
  .card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px 22px}
  .card h3{margin:0 0 6px;font-size:19px;line-height:1.25}
  .card h3 a{text-decoration:none}
  .card h3 a:hover{text-decoration:underline}
  .card .meta{color:var(--mut);font-size:12.5px;margin:0 0 8px;text-transform:uppercase;letter-spacing:.04em}
  .card p.blurb{margin:0;color:#334155;font-size:14.5px}
  .note{color:#334155;font-size:14px}
  .press{background:#fff;border:1px solid var(--line);border-left:3px solid var(--brand);border-radius:12px;padding:18px 20px;margin:14px 0 0}
  .press h3{margin:0 0 6px;font-size:16px}
  .press p{margin:0 0 10px;font-size:14px;color:#334155}
  .press a{font-weight:600;text-decoration:none}
  .cta{margin:40px 0 0;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;border-radius:16px;padding:28px;text-align:center}
  .cta h2{border:0;color:#fff;margin:0 0 8px;padding:0}
  .cta p{margin:0 auto 18px;opacity:.92;max-width:560px}
  .cta a{display:inline-block;font-weight:700;text-decoration:none;padding:12px 26px;border-radius:10px;background:#fff;color:#1e3a8a}
  footer{margin-top:44px;font-size:12px;color:var(--mut);border-top:1px solid var(--line);padding-top:16px}
${CITE_STYLE}
</style>`;

function jsonLd(t, lang) {
  const url = `${SITE}${hubPath(lang)}`;
  const collection = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: t.h1, description: t.desc, url, inLanguage: lang,
    isBasedOn: 'https://www.boe.es/diario_borme/',
    publisher: { '@type': 'Organization', name: 'Mapa Societario', '@id': 'https://nurnbergconsulting.com/#org' },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: STUDIES.map((s, i) => ({
        '@type': 'ListItem', position: i + 1, name: s[lang].title, url: `${SITE}${studyPath(s, lang)}`,
      })),
    },
  };
  const crumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.crumbHome, item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: t.crumbHub, item: url },
    ],
  };
  const ser = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  return [collection, crumb].map((o) => `<script type="application/ld+json">${ser(o)}</script>`).join('');
}

function cards(t, lang) {
  // Newest first: a hub whose top card is two years old reads abandoned.
  const ordered = [...STUDIES].sort((a, b) => String(asOfById[b.id]).localeCompare(String(asOfById[a.id])));
  return ordered.map((s) => {
    const href = studyPath(s, lang);
    return `<li class="card">
      <p class="meta">${esc(t.dateLabel)} ${esc(formatMonth(asOfById[s.id], lang))}</p>
      <h3><a href="${href}">${esc(s[lang].title)}</a></h3>
      <p class="blurb">${esc(s[lang].blurb)}</p>
    </li>`;
  }).join('');
}

function render(lang) {
  const t = T[lang];
  const url = `${SITE}${hubPath(lang)}`;
  const altLang = lang === 'en' ? 'es' : 'en';
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
<link rel="alternate" hreflang="es" href="${SITE}${hubPath('es')}">
<link rel="alternate" hreflang="en" href="${SITE}${hubPath('en')}">
<link rel="alternate" hreflang="x-default" href="${SITE}${hubPath('es')}">
<meta property="og:type" content="website">
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
${gaSnippet()}
</head>
<body>
<div class="wrap">
  <nav class="crumbs"><span class="langs"><a href="${hubPath(altLang)}">${altLabel}</a></span><a href="/">${esc(t.crumbHome)}</a> › ${esc(t.crumbHub)}</nav>
  <h1>${esc(t.h1)}</h1>
  <p class="lead">${esc(t.lead)}</p>

  <h2>${esc(t.listTitle)}</h2>
  <ul class="studies">${cards(t, lang)}</ul>

  <h2>${esc(t.dataTitle)}</h2>
  <p class="note">${esc(t.dataBody)}</p>

  <div class="press">
    <h3>${esc(t.pressTitle)}</h3>
    <p>${esc(t.pressBody)}</p>
    <a href="mailto:${PRESS_EMAIL}?subject=${encodeURIComponent(t.pressSubject)}">${esc(t.pressCta)}</a>
  </div>

  <div class="cta">
    <h2>${esc(t.ctaTitle)}</h2>
    <p>${esc(t.ctaText)}</p>
    <a href="/app/">${esc(t.ctaBtn)}</a>
  </div>

  <footer>Mapa Societario · BORME</footer>
</div>
</body>
</html>`;
}

const distDir = path.resolve(root, 'dist');
for (const lang of LANGS) {
  const outDir = path.join(distDir, HUB_PATHS[lang]);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'index.html'), render(lang), 'utf8');
  console.log(`  Studies hub: ${HUB_PATHS[lang]}/index.html`);
}
