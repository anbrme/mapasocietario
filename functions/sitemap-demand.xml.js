/**
 * /sitemap-demand.xml — wave 1 of the demand-promoted company pages: batch 1
 * and every organic promotion before batch 2. Later batches get their own file
 * (sitemap-demand-2.xml, …) — see sitemaps/_waves.js for the crawl-stats
 * reason and the recipe for adding one.
 *
 * History: this USED to be a <sitemapindex> pointing at /sitemaps/companies/N,
 * but /sitemap.xml is itself an index and an index may not reference another,
 * so Google silently ignored the branch. It is a flat <urlset> served here
 * because /sitemap.xml is a static build asset with no D1 access.
 */
import { demandWaveResponse } from './sitemaps/_demandWave.js';

export const onRequestGet = ({ env }) => demandWaveResponse(env, 1);
