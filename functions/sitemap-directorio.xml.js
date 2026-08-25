/**
 * /sitemap-directorio.xml — the directory index page plus one URL per
 * province hub, derived from the live promoted set in D1.
 */
import { listPromotedProvinceCounts } from './empresa/_demand.js';
import {
  MIN_INDEXABLE_PROVINCE_COMPANIES,
  groupProvinces,
  esc,
} from './directorio/_lib.js';

const SITE = 'https://mapasocietario.es';

export function directorySitemapUrls(groups) {
  return [
    `${SITE}/directorio`,
    ...groups
      .filter((group) => group.total >= MIN_INDEXABLE_PROVINCE_COMPANIES)
      .map((group) => `${SITE}/directorio/${group.slug}`),
  ];
}

export async function onRequestGet({ env }) {
  const groups = groupProvinces(await listPromotedProvinceCounts(env?.SEO_DB).catch(() => []));
  if (!groups.length) return new Response('Not found', { status: 404 });
  const urls = directorySitemapUrls(groups);
  const body = urls.map((loc) => `  <url><loc>${esc(loc)}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600',
    },
  });
}
