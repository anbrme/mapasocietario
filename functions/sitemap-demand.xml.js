/**
 * /sitemap-demand.xml — every demand-promoted company page, in one <urlset>.
 *
 * This USED to be a <sitemapindex> pointing at /sitemaps/companies/N. But
 * /sitemap.xml is itself a <sitemapindex> and references this file, and the
 * sitemaps protocol does not allow an index to reference another index — so
 * Google silently ignored the entire branch. Search Console reported 151
 * submitted URLs, exactly sitemap-pages (26) + sitemap-empresas (78) +
 * sitemap-directorio (47), while 2,022 promoted companies went unannounced.
 * Half of them had never served an impression.
 *
 * Flattening it here rather than in /sitemap.xml is deliberate: that file is a
 * committed static asset written at build time, and the build has no D1 access
 * to know how many company pages exist. This route does.
 *
 * /sitemaps/companies/[page] is kept for the day the promoted set outgrows one
 * urlset — see MAX_COMPANIES_PER_SITEMAP below, which is the point at which
 * /sitemap.xml has to become dynamic and reference those pages directly.
 */
import { listPromotedCompanies } from './empresa/_demand.js';
import { companyUrlsetXml, MAX_COMPANIES_PER_SITEMAP, XML_HEADERS } from './sitemaps/_urlset.js';

export async function onRequestGet({ env }) {
  if (!env?.SEO_DB) return new Response('Not found', { status: 404 });

  const companies = await listPromotedCompanies(env.SEO_DB, {
    limit: MAX_COMPANIES_PER_SITEMAP,
    offset: 0,
  });
  // An empty <urlset> is not a valid sitemap — Search Console flags it as an
  // error on every fetch. Until the first company is promoted there is
  // genuinely nothing here, so say so with a 404.
  if (companies.length === 0) return new Response('Not found', { status: 404 });

  return new Response(companyUrlsetXml(companies), { headers: XML_HEADERS });
}
