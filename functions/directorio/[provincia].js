/**
 * /directorio/:provincia — promoted companies with a registered address in
 * one province. Resolves the slug against the live province set, so hub
 * pages appear and disappear with the underlying promoted data.
 */
import { listPromotedProvinceCounts, listPromotedByProvinces } from '../empresa/_demand.js';
import { groupProvinces, renderProvincePage, HUB_HEADERS, HUB_NOT_FOUND_HEADERS } from './_lib.js';

export async function onRequestGet({ params, env }) {
  try {
    const slug = String(params.provincia || '').toLowerCase();
    const groups = groupProvinces(await listPromotedProvinceCounts(env?.SEO_DB));
    const group = groups.find((g) => g.slug === slug);
    if (!group) {
      return new Response('Not found', {
        status: 404,
        headers: HUB_NOT_FOUND_HEADERS,
      });
    }
    const companies = await listPromotedByProvinces(env.SEO_DB, group.variants);
    return new Response(renderProvincePage(group, companies), { headers: HUB_HEADERS });
  } catch (error) {
    console.error('[directorio] province failed:', error?.message || error);
    return new Response('Service unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
