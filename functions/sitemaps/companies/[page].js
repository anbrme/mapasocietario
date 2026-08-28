/**
 * /sitemaps/companies/:page — one page of promoted company URLs.
 *
 * Not referenced by any index today: /sitemap-demand.xml lists every promoted
 * company directly, because an index inside an index is invalid and Google
 * ignored it. Kept for the day the set outgrows one urlset, at which point
 * /sitemap.xml must become dynamic and reference these pages itself.
 */
import { listPromotedCompanies } from '../../empresa/_demand.js';
import { companyUrlsetXml, XML_HEADERS } from '../_urlset.js';

const COMPANIES_PER_SITEMAP = 20_000;

export async function onRequestGet({ params, env }) {
  if (!env.SEO_DB) return new Response('Not configured', { status: 404 });
  const page = Number(params.page);
  if (!Number.isInteger(page) || page < 1) return new Response('Not found', { status: 404 });

  const companies = await listPromotedCompanies(env.SEO_DB, {
    limit: COMPANIES_PER_SITEMAP,
    offset: (page - 1) * COMPANIES_PER_SITEMAP,
  });
  if (companies.length === 0) return new Response('Not found', { status: 404 });

  return new Response(companyUrlsetXml(companies), { headers: XML_HEADERS });
}
