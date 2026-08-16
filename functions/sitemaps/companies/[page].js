import { listPromotedCompanies } from '../../empresa/_demand.js';

const SITE = 'https://mapasocietario.es';
const COMPANIES_PER_SITEMAP = 20_000;

function escXml(value) {
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

export async function onRequestGet({ params, env }) {
  if (!env.SEO_DB) return new Response('Not configured', { status: 404 });
  const page = Number(params.page);
  if (!Number.isInteger(page) || page < 1) return new Response('Not found', { status: 404 });

  const companies = await listPromotedCompanies(env.SEO_DB, {
    limit: COMPANIES_PER_SITEMAP,
    offset: (page - 1) * COMPANIES_PER_SITEMAP,
  });
  if (companies.length === 0) return new Response('Not found', { status: 404 });

  const blocks = companies.flatMap(({ slug, promoted_at: lastmod }) => {
    const es = `${SITE}/empresa/${slug}`;
    const en = `${SITE}/en/company/${slug}`;
    return [urlBlock(es, es, en, lastmod), urlBlock(en, es, en, lastmod)];
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${blocks.join('\n')}
</urlset>
`;
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600',
    },
  });
}
