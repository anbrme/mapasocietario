/**
 * /en/directory — English province index of the company directory.
 *
 * The ES twin is functions/directorio/index.js; both render from
 * ../../directorio/_lib.js so the pair cannot drift.
 */
import { listPromotedProvinceCounts, listRecentlyPromoted } from '../../empresa/_demand.js';
import { groupProvinces, renderDirectoryIndex } from '../../directorio/_lib.js';

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  // Counts move slowly (batch promotions + a trickle of organic ones); an
  // hour of edge cache keeps D1 reads negligible.
  'cache-control': 'public, max-age=0, s-maxage=3600',
};

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
    return new Response(renderDirectoryIndex(groups, 'en', { recent }), { headers: HTML_HEADERS });
  } catch (error) {
    console.error('[en/directory] index failed:', error?.message || error);
    return new Response('Service unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
