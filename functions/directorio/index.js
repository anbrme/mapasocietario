/**
 * /directorio — province index of the company directory.
 */
import { listPromotedProvinceCounts, listRecentlyPromoted } from '../empresa/_demand.js';
import { groupProvinces, renderDirectoryIndex, HUB_HEADERS, HUB_NOT_FOUND_HEADERS } from './_lib.js';

export async function onRequestGet({ env }) {
  try {
    // Both reads in flight together: they are independent, and the page is
    // edge-cached for an hour, so this costs one round trip, not two.
    const [counts, recent] = await Promise.all([
      listPromotedProvinceCounts(env?.SEO_DB),
      listRecentlyPromoted(env?.SEO_DB),
    ]);
    const groups = groupProvinces(counts);
    if (!groups.length) return new Response('Not found', { status: 404 });
    return new Response(renderDirectoryIndex(groups, 'es', { recent }), { headers: HUB_HEADERS });
  } catch (error) {
    console.error('[directorio] index failed:', error?.message || error);
    return new Response('Service unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
