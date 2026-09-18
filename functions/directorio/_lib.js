/**
 * Provincial directory hubs — crawl scaffolding for the promoted company set.
 *
 * /directorio               → index of provinces with promoted-company counts
 * /directorio/:provincia    → alphabetical list of promoted companies there
 * /en/directory             → the same index in English
 * /en/directory/:province   → the same province list, linking EN company pages
 *
 * The hubs list ONLY indexable pages (D1-promoted companies), so every link
 * hands Googlebot a crawl path that ends on an index,follow page — linking
 * noindex profiles here would waste crawl budget on dead ends.
 *
 * Why English exists now. This file used to be Spanish-only, on the reasoning
 * that the query it targets ("empresas en <provincia>") is Spanish. That was
 * right about search intent and wrong about the job: measured 2026-09-18 with
 * scripts/gsc-inspect-sample.mjs, the ES batch-2 sample was 32% indexed and the
 * EN sample 16%, with crawl→index conversion at 100% (ES) and 80% (EN) — Google
 * indexes these pages whenever it actually fetches them, so the whole deficit
 * is discovery. And the EN corpus had no hub at all: /directorio links only to
 * /empresa/*, so all ~2,000 /en/company/* URLs were reachable from the sitemap
 * and from each other's sibling blocks, but from no hub — the orphan condition
 * that functions/empresa/_siblings.js exists to fix, never applied to English.
 * A hub is crawl plumbing first and a search target second; the EN one earns
 * its place on the first count even where the second is weak.
 *
 * Both languages render from one parameterized shell (the idiom in
 * functions/empresa/_lib.js): the province slug is shared, so the two pages are
 * a clean hreflang pair and cannot drift apart structurally.
 *
 * The `_` filename prefix keeps Cloudflare Pages from routing this file.
 */

import { nameToSlug } from '../empresa/_slug.js';
import { HUB_STYLE } from '../empresa/_lib.js';
import { DIRECTORY_LANGS, directoryPath, provincePath } from './_paths.js';

const SITE = 'https://mapasocietario.es';

// A one- or two-company province page is useful as crawl plumbing while the
// promoted set grows, but too thin to present as a search result in its own
// right. It remains crawlable (`follow`) and becomes indexable automatically
// as soon as the next promotions take it over this threshold.
export const MIN_INDEXABLE_PROVINCE_COMPANIES = 3;

// Re-exported so the sitemap and the hub pages share one import site.
export { DIRECTORY_LANGS, directoryPath, provincePath };

function companyPath(lang, slug) {
  return lang === 'en' ? `/en/company/${slug}` : `/empresa/${slug}`;
}

export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const T = {
  es: {
    htmlLang: 'es',
    ogLocale: 'es_ES',
    home: 'Mapa Societario',
    crumb: 'Directorio',
    indexTitle: 'Selección de empresas por provincia | Mapa Societario',
    indexH1: 'Selección de empresas por provincia',
    indexDesc: (total) =>
      `Selección creciente de ${total} fichas societarias verificadas, organizadas por provincia. El buscador de Mapa Societario cubre más de 3 millones de sociedades.`,
    indexLead: (total) =>
      `Incorporamos progresivamente fichas societarias verificadas para su navegación pública. Esta selección contiene ${total} empresas; el buscador completo cubre más de 3 millones de sociedades españolas.`,
    indexLdName: 'Selección de empresas por provincia',
    colProvince: 'Provincia',
    colCompanies: 'Empresas',
    colCompany: 'Empresa',
    colNif: 'NIF / CIF',
    provinceRow: (name) => `Empresas en ${name}`,
    provinceTitle: (name) => `Selección de empresas en ${name} | Mapa Societario`,
    provinceH1: (name) => `Empresas con ficha pública en ${name}`,
    provinceDesc: (name, count) =>
      `${count} fichas societarias verificadas de ${name}: CIF, administradores, capital social e historial BORME. El directorio crece progresivamente.`,
    provinceLead: (name, count) =>
      `Esta selección incorpora progresivamente fichas verificadas. Actualmente incluye ${count} sociedades con domicilio en ${name}; utilice el buscador para consultar el conjunto completo.`,
    recentTitle: 'Nuevas incorporaciones',
    recentLead: 'Las fichas publicadas más recientemente.',
    relatedIndexTitle: 'También en Mapa Societario',
    relatedListed: '<a href="/empresas-cotizadas">Empresas cotizadas (IBEX 35)</a> — accionistas significativos y consejos de administración.',
    relatedSearch: '<a href="/app/">Buscador de empresas y administradores</a> — más de 3 millones de sociedades españolas.',
    notFoundTitle: '¿No encuentra una empresa?',
    notFoundSearch: '<a href="/app/">Busque entre más de 3 millones de sociedades españolas</a> — el directorio recoge una selección; el buscador lo cubre todo.',
    allProvinces: '<a href="/directorio">Ver todas las provincias</a>',
    footer: 'Datos extraídos del BORME (Registro Mercantil). Información no oficial — consulte el BORME para usos con efectos legales.',
  },
  en: {
    htmlLang: 'en',
    ogLocale: 'en_GB',
    home: 'Mapa Societario',
    crumb: 'Directory',
    indexTitle: 'Spanish companies by province | Mapa Societario',
    indexH1: 'Spanish companies by province',
    indexDesc: (total) =>
      `A growing selection of ${total} verified Spanish company profiles, organised by province. The Mapa Societario search covers more than 3 million companies.`,
    indexLead: (total) =>
      `We publish verified company profiles progressively for public browsing. This selection holds ${total} companies; the full search covers more than 3 million Spanish companies.`,
    indexLdName: 'Spanish companies by province',
    colProvince: 'Province',
    colCompanies: 'Companies',
    colCompany: 'Company',
    colNif: 'Tax ID (NIF / CIF)',
    provinceRow: (name) => `Companies in ${name}`,
    provinceTitle: (name) => `Spanish companies in ${name} | Mapa Societario`,
    provinceH1: (name) => `Companies with a public profile in ${name}`,
    provinceDesc: (name, count) =>
      `${count} verified company profiles registered in ${name}: tax ID, directors, share capital and BORME filing history. The directory grows progressively.`,
    provinceLead: (name, count) =>
      `This selection publishes verified profiles progressively. It currently holds ${count} companies with a registered address in ${name}; use the search to reach the full set.`,
    recentTitle: 'Recently added',
    recentLead: 'The most recently published company profiles.',
    relatedIndexTitle: 'Also on Mapa Societario',
    relatedListed: '<a href="/en/listed-companies">Listed companies (IBEX 35)</a> — significant shareholders and boards of directors.',
    relatedSearch: '<a href="/app/">Company and director search</a> — more than 3 million Spanish companies.',
    notFoundTitle: 'Cannot find a company?',
    notFoundSearch: '<a href="/app/">Search more than 3 million Spanish companies</a> — the directory holds a selection; the search covers all of them.',
    allProvinces: '<a href="/en/directory">See every province</a>',
    footer: 'Data sourced from the Spanish Official Commercial Registry Gazette (BORME). Unofficial information — consult the BORME where legal effect is required.',
  },
};

const pick = (lang) => T[lang] || T.es;

function jsonLdScript(payload) {
  const ld = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/-->/g, '--\\u003e')
    .replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return `<script type="application/ld+json">${ld}</script>`;
}

/**
 * Both language variants of one hub page. x-default points at Spanish: the
 * data is a Spanish registry and the ES page is the one that ranks today.
 * `slug` is omitted for the index pages.
 */
function hreflangTags(slug) {
  const href = (lang) => `${SITE}${slug ? provincePath(lang, slug) : directoryPath(lang)}`;
  return [
    `<link rel="alternate" hreflang="es" href="${href('es')}">`,
    `<link rel="alternate" hreflang="en" href="${href('en')}">`,
    `<link rel="alternate" hreflang="x-default" href="${href('es')}">`,
  ].join('\n');
}

function pageShell({ lang, title, desc, canonical, breadcrumbName, slug, ld, body, indexable = true }) {
  const t = pick(lang);
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.home, item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: t.crumb, item: `${SITE}${directoryPath(lang)}` },
      ...(breadcrumbName ? [{ '@type': 'ListItem', position: 3, name: breadcrumbName }] : []),
    ],
  };
  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
${hreflangTags(slug)}
<meta name="robots" content="${indexable ? 'index, follow' : 'noindex, follow'}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="${t.ogLocale}">
<meta property="og:image" content="${SITE}/og-image.svg">
${jsonLdScript(breadcrumb)}
${ld ? jsonLdScript(ld) : ''}
${HUB_STYLE}
</head>
<body>
<div class="wrap">
  <nav class="crumbs"><a href="/">${esc(t.home)}</a> › <a href="${directoryPath(lang)}">${esc(t.crumb)}</a>${breadcrumbName ? ` › ${esc(breadcrumbName)}` : ''}</nav>
${body}
  <footer>${t.footer}</footer>
</div>
</body>
</html>`;
}

/**
 * `recent` comes from listRecentlyPromoted and is optional: when D1 answers
 * nothing the block is omitted and the rest of the page is unaffected, exactly
 * as the sibling block behaves on a company page.
 */
export function renderDirectoryIndex(groups, lang = 'es', { recent = [] } = {}) {
  const t = pick(lang);
  const recentBlock = recent.length
    ? `  <div class="related">
    <h2>${esc(t.recentTitle)}</h2>
    <p>${esc(t.recentLead)}</p>
    <ul class="siblings">${recent
      .map((c) => `<li><a href="${companyPath(lang, esc(c.slug))}">${esc(c.canonical_name)}</a>${c.province ? ` — ${esc(c.province)}` : ''}</li>`)
      .join('')}</ul>
  </div>`
    : '';
  const total = groups.reduce((sum, g) => sum + g.total, 0);
  const rows = groups
    .map(
      (g) => `<tr>
        <td class="name"><a href="${provincePath(lang, esc(g.slug))}">${esc(t.provinceRow(g.name))}</a></td>
        <td class="tk">${g.total}</td>
      </tr>`,
    )
    .join('');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t.indexLdName,
    url: `${SITE}${directoryPath(lang)}`,
    numberOfItems: groups.length,
    itemListElement: groups.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.provinceRow(g.name),
      url: `${SITE}${provincePath(lang, g.slug)}`,
    })),
  };
  return pageShell({
    lang,
    title: t.indexTitle,
    desc: t.indexDesc(total),
    canonical: `${SITE}${directoryPath(lang)}`,
    ld,
    body: `  <h1>${esc(t.indexH1)}</h1>
  <p class="lead">${esc(t.indexLead(total))}</p>
  <table><thead><tr><th>${esc(t.colProvince)}</th><th>${esc(t.colCompanies)}</th></tr></thead><tbody>${rows}</tbody></table>
${recentBlock}
  <div class="related">
    <h2>${esc(t.relatedIndexTitle)}</h2>
    <p>${t.relatedListed}</p>
    <p>${t.relatedSearch}</p>
  </div>`,
  });
}

export function renderProvincePage(group, companies, lang = 'es') {
  const t = pick(lang);
  const indexable = companies.length >= MIN_INDEXABLE_PROVINCE_COMPANIES;
  const rows = companies
    .map(
      (c) => `<tr>
        <td class="name"><a href="${companyPath(lang, esc(c.slug))}">${esc(c.canonical_name)}</a></td>
        <td class="tk">${esc(c.nif || '')}</td>
      </tr>`,
    )
    .join('');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t.provinceRow(group.name),
    url: `${SITE}${provincePath(lang, group.slug)}`,
    numberOfItems: companies.length,
    itemListElement: companies.slice(0, 100).map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.canonical_name,
      url: `${SITE}${companyPath(lang, c.slug)}`,
    })),
  };
  return pageShell({
    lang,
    title: t.provinceTitle(group.name),
    desc: t.provinceDesc(group.name, companies.length),
    canonical: `${SITE}${provincePath(lang, group.slug)}`,
    breadcrumbName: group.name,
    slug: group.slug,
    ld,
    indexable,
    body: `  <h1>${esc(t.provinceH1(group.name))}</h1>
  <p class="lead">${esc(t.provinceLead(group.name, companies.length))}</p>
  <table><thead><tr><th>${esc(t.colCompany)}</th><th>${esc(t.colNif)}</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="related">
    <h2>${esc(t.notFoundTitle)}</h2>
    <p>${t.notFoundSearch}</p>
    <p>${t.allProvinces}</p>
  </div>`,
  });
}

/**
 * Group raw province counts by URL slug. The same province may be stored
 * under several spellings ("Madrid" / "MADRID"); one hub page serves them
 * all, displaying the variant with the most companies.
 */
export function groupProvinces(counts) {
  const bySlug = new Map();
  for (const { province, total } of counts) {
    const slug = nameToSlug(province);
    if (!slug) continue;
    const group = bySlug.get(slug) || { slug, name: province, total: 0, variants: [] };
    const updated = {
      ...group,
      total: group.total + Number(total || 0),
      variants: [...group.variants, province],
      name: Number(total || 0) > group.total ? province : group.name,
    };
    bySlug.set(slug, updated);
  }
  return [...bySlug.values()].sort((a, b) => b.total - a.total);
}
