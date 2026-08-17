/**
 * /directorio — province index of the company directory.
 */
import { listPromotedProvinceCounts } from '../empresa/_demand.js';
import { groupProvinces, renderDirectoryIndex } from './_lib.js';

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  // Counts move slowly (batch promotions + a trickle of organic ones); an
  // hour of edge cache keeps D1 reads negligible.
  'cache-control': 'public, max-age=0, s-maxage=3600',
};

export async function onRequestGet({ env }) {
  try {
    const counts = await listPromotedProvinceCounts(env?.SEO_DB);
    const groups = groupProvinces(counts);
    if (!groups.length) return new Response('Not found', { status: 404 });
    return new Response(renderDirectoryIndex(groups), { headers: HTML_HEADERS });
  } catch (error) {
    console.error('[directorio] index failed:', error?.message || error);
    return new Response('Service unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
