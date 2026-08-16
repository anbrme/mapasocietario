import { countPromotedCompanies } from './empresa/_demand.js';

const SITE = 'https://mapasocietario.es';
const COMPANIES_PER_SITEMAP = 20_000;

export async function onRequestGet({ env }) {
  const total = await countPromotedCompanies(env.SEO_DB);
  // An empty <sitemapindex> is not a valid sitemap — Search Console flags it as
  // an error on every fetch. Until the first company is promoted there is
  // genuinely nothing here, so say so with a 404.
  if (total === 0) return new Response('Not found', { status: 404 });
  const pages = Math.ceil(total / COMPANIES_PER_SITEMAP);
  const today = new Date().toISOString().slice(0, 10);
  const entries = Array.from({ length: pages }, (_, index) => `  <sitemap>
    <loc>${SITE}/sitemaps/companies/${index + 1}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>
`;
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600',
    },
  });
}
