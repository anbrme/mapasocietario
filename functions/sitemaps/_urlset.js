/**
 * The company <urlset> both sitemap surfaces emit.
 *
 * Shared because they diverged into a bug: /sitemap-demand.xml was a
 * <sitemapindex> pointing at /sitemaps/companies/N, and it is itself referenced
 * from /sitemap.xml, which is ALSO a <sitemapindex>. The sitemaps protocol does
 * not allow an index to reference another index, so Google silently ignored the
 * whole branch: Search Console reported 151 submitted URLs — exactly
 * sitemap-pages (26) + sitemap-empresas (78) + sitemap-directorio (47) — while
 * 2,022 promoted companies went unannounced and were discovered, if at all,
 * only through the directorio hub mesh.
 */

const SITE = 'https://mapasocietario.es';

// The sitemaps protocol caps one urlset at 50,000 URLs. Each company emits two
// (ES and EN), so one file can carry half that many companies.
export const MAX_URLS_PER_SITEMAP = 50_000;
export const MAX_COMPANIES_PER_SITEMAP = MAX_URLS_PER_SITEMAP / 2;

export function escXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlBlock(loc, esHref, enHref, lastmod) {
  return `  <url>
    <loc>${escXml(loc)}</loc>
    <xhtml:link rel="alternate" hreflang="es" href="${escXml(esHref)}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${escXml(enHref)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${escXml(esHref)}"/>
    <lastmod>${escXml((lastmod || new Date().toISOString()).slice(0, 10))}</lastmod>
  </url>`;
}

/** @param {Array<{slug: string, promoted_at?: string}>} companies */
export function companyUrlsetXml(companies) {
  const blocks = (companies || []).flatMap(({ slug, promoted_at: lastmod }) => {
    const es = `${SITE}/empresa/${slug}`;
    const en = `${SITE}/en/company/${slug}`;
    return [urlBlock(es, es, en, lastmod), urlBlock(en, es, en, lastmod)];
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${blocks.join('\n')}
</urlset>
`;
}

export const XML_HEADERS = {
  'content-type': 'application/xml; charset=utf-8',
  'cache-control': 'public, max-age=0, s-maxage=3600',
};
