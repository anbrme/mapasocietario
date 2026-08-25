/**
 * Provincial directory hubs — crawl scaffolding for the promoted company set.
 *
 * /directorio            → index of provinces with promoted-company counts
 * /directorio/:provincia → alphabetical list of promoted companies there
 *
 * The hubs list ONLY indexable pages (D1-promoted companies), so every link
 * hands Googlebot a crawl path that ends on an index,follow page — linking
 * noindex profiles here would waste crawl budget on dead ends. Spanish only:
 * the query these pages target ("empresas en <provincia>") is Spanish.
 * The `_` filename prefix keeps Cloudflare Pages from routing this file.
 */

import { nameToSlug } from '../empresa/_slug.js';
import { HUB_STYLE } from '../empresa/_lib.js';

const SITE = 'https://mapasocietario.es';

// A one- or two-company province page is useful as crawl plumbing while the
// promoted set grows, but too thin to present as a search result in its own
// right. It remains crawlable (`follow`) and becomes indexable automatically
// as soon as the next promotions take it over this threshold.
export const MIN_INDEXABLE_PROVINCE_COMPANIES = 3;

export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function jsonLdScript(payload) {
  const ld = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/-->/g, '--\\u003e')
    .replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return `<script type="application/ld+json">${ld}</script>`;
}

function pageShell({ title, desc, canonical, breadcrumbName, ld, body, indexable = true }) {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Mapa Societario', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Directorio', item: `${SITE}/directorio` },
      ...(breadcrumbName ? [{ '@type': 'ListItem', position: 3, name: breadcrumbName }] : []),
    ],
  };
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="${indexable ? 'index, follow' : 'noindex, follow'}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="es_ES">
<meta property="og:image" content="${SITE}/og-image.svg">
${jsonLdScript(breadcrumb)}
${ld ? jsonLdScript(ld) : ''}
${HUB_STYLE}
</head>
<body>
<div class="wrap">
  <nav class="crumbs"><a href="/">Mapa Societario</a> › <a href="/directorio">Directorio</a>${breadcrumbName ? ` › ${esc(breadcrumbName)}` : ''}</nav>
${body}
  <footer>Datos extraídos del BORME (Registro Mercantil). Información no oficial — consulte el BORME para usos con efectos legales.</footer>
</div>
</body>
</html>`;
}

export function renderDirectoryIndex(groups) {
  const total = groups.reduce((sum, g) => sum + g.total, 0);
  const rows = groups
    .map(
      (g) => `<tr>
        <td class="name"><a href="/directorio/${esc(g.slug)}">Empresas en ${esc(g.name)}</a></td>
        <td class="tk">${g.total}</td>
      </tr>`,
    )
    .join('');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Selección de empresas por provincia',
    url: `${SITE}/directorio`,
    numberOfItems: groups.length,
    itemListElement: groups.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `Empresas en ${g.name}`,
      url: `${SITE}/directorio/${g.slug}`,
    })),
  };
  return pageShell({
    title: 'Selección de empresas por provincia | Mapa Societario',
    desc: `Selección creciente de ${total} fichas societarias verificadas, organizadas por provincia. El buscador de Mapa Societario cubre más de 3 millones de sociedades.`,
    canonical: `${SITE}/directorio`,
    ld,
    body: `  <h1>Selección de empresas por provincia</h1>
  <p class="lead">Incorporamos progresivamente fichas societarias verificadas para su navegación pública. Esta selección contiene ${total} empresas; el buscador completo cubre más de 3 millones de sociedades españolas.</p>
  <table><thead><tr><th>Provincia</th><th>Empresas</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="related">
    <h2>También en Mapa Societario</h2>
    <p><a href="/empresas-cotizadas">Empresas cotizadas (IBEX 35)</a> — accionistas significativos y consejos de administración.</p>
    <p><a href="/app/">Buscador de empresas y administradores</a> — más de 3 millones de sociedades españolas.</p>
  </div>`,
  });
}

export function renderProvincePage(group, companies) {
  const indexable = companies.length >= MIN_INDEXABLE_PROVINCE_COMPANIES;
  const rows = companies
    .map(
      (c) => `<tr>
        <td class="name"><a href="/empresa/${esc(c.slug)}">${esc(c.canonical_name)}</a></td>
        <td class="tk">${esc(c.nif || '')}</td>
      </tr>`,
    )
    .join('');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Empresas en ${group.name}`,
    url: `${SITE}/directorio/${group.slug}`,
    numberOfItems: companies.length,
    itemListElement: companies.slice(0, 100).map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.canonical_name,
      url: `${SITE}/empresa/${c.slug}`,
    })),
  };
  return pageShell({
    title: `Selección de empresas en ${group.name} | Mapa Societario`,
    desc: `${companies.length} fichas societarias verificadas de ${group.name}: CIF, administradores, capital social e historial BORME. El directorio crece progresivamente.`,
    canonical: `${SITE}/directorio/${group.slug}`,
    breadcrumbName: group.name,
    ld,
    indexable,
    body: `  <h1>Empresas con ficha pública en ${esc(group.name)}</h1>
  <p class="lead">Esta selección incorpora progresivamente fichas verificadas. Actualmente incluye ${companies.length} sociedades con domicilio en ${esc(group.name)}; utilice el buscador para consultar el conjunto completo.</p>
  <table><thead><tr><th>Empresa</th><th>NIF / CIF</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="related">
    <h2>¿No encuentra una empresa?</h2>
    <p><a href="/app/">Busque entre más de 3 millones de sociedades españolas</a> — el directorio recoge una selección; el buscador lo cubre todo.</p>
    <p><a href="/directorio">Ver todas las provincias</a></p>
  </div>`,
  });
}
