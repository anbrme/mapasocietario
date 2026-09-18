/**
 * /en/directory/:province — English twin of /directorio/:provincia.
 *
 * The slug is the SAME on both sides (provinces are proper nouns), which is
 * what makes the two pages a valid hreflang pair; it is resolved against the
 * live province set, so hubs appear and disappear with the promoted data.
 */
import { listPromotedProvinceCounts, listPromotedByProvinces } from '../../empresa/_demand.js';
import { groupProvinces, renderProvincePage } from '../../directorio/_lib.js';

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=0, s-maxage=3600',
};

export async function onRequestGet({ params, env }) {
  try {
    const slug = String(params.province || '').toLowerCase();
    const groups = groupProvinces(await listPromotedProvinceCounts(env?.SEO_DB));
    const group = groups.find((g) => g.slug === slug);
    if (!group) {
      return new Response('Not found', {
        status: 404,
        headers: { 'cache-control': 'public, s-maxage=600' },
      });
    }
    const companies = await listPromotedByProvinces(env.SEO_DB, group.variants);
    return new Response(renderProvincePage(group, companies, 'en'), { headers: HTML_HEADERS });
  } catch (error) {
    console.error('[en/directory] province failed:', error?.message || error);
    return new Response('Service unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
