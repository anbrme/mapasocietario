/**
 * Generates public/sitemap-empresas.xml from the curated IBEX 35 seed.
 *
 * Run:  node scripts/generate-empresa-sitemap.mjs
 * Add the new file to robots.txt / Search Console, or reference it from a
 * sitemap index. As the launch expands beyond the IBEX 35, extend the source
 * list here (or generate from the API).
 */
import { SEED } from '../functions/empresa/_ibex35.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SITE = 'https://mapasocietario.es';
const today = new Date().toISOString().slice(0, 10);

const urls = Object.keys(SEED)
  .sort()
  .map(
    (slug) =>
      `  <url>\n    <loc>${SITE}/empresa/${slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sitemap-empresas.xml');
writeFileSync(out, xml);
console.log(`Wrote ${Object.keys(SEED).length} company URLs to ${out}`);
