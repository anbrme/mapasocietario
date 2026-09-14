/**
 * Serve one demand-sitemap wave as a <urlset>. See _waves.js for why the
 * promoted set is split into files by promotion date.
 */
import { listPromotedCompanies } from '../empresa/_demand.js';
import { companyUrlsetXml, MAX_COMPANIES_PER_SITEMAP, XML_HEADERS } from './_urlset.js';
import { DEMAND_WAVES, waveBounds } from './_waves.js';

const notFound = () => new Response('Not found', { status: 404 });

export async function demandWaveResponse(env, number, waves = DEMAND_WAVES) {
  if (!env?.SEO_DB) return notFound();
  const bounds = waveBounds(number, waves);
  if (!bounds) return notFound();

  const companies = await listPromotedCompanies(env.SEO_DB, {
    limit: MAX_COMPANIES_PER_SITEMAP,
    offset: 0,
    ...bounds,
  });
  // An empty <urlset> is not a valid sitemap — Search Console flags it as an
  // error on every fetch — so an empty wave says 404 instead.
  if (companies.length === 0) return notFound();

  return new Response(companyUrlsetXml(companies), { headers: XML_HEADERS });
}
