/**
 * Demand-sitemap waves: one sitemap FILE per promotion batch.
 *
 * Why a new file per batch rather than one growing urlset: GSC crawl stats
 * (read 2026-09-14) show batch 1 (2026-08-17) got a bulk-discovery burst of
 * ~6,700 crawl requests in ten days, the week the demand sitemap first
 * appeared. Batch 2 (2026-09-07) only grew that existing file — lastmod set,
 * index re-downloaded, 8,280 URLs "submitted" — and got NO burst: 80 requests
 * a day against a 48/day baseline, 0 of 60 sampled pages indexed after a week.
 * A brand-new sitemap file is the one condition that has produced a burst, so
 * every batch gets its own.
 *
 * A wave is a half-open promoted_at range [from, next.from). The first wave has
 * no lower bound; the last has no upper bound, so organic (demand-driven)
 * promotions always land in the newest file. To publish a batch: add a wave
 * here with the batch's apply date and add the matching
 * functions/<file>.js route (three lines, see sitemap-demand-2.xml.js).
 * /sitemap.xml is a static asset written at build time by
 * scripts/generate-seo-files.mjs, which imports this list — so the index and
 * the routes cannot drift.
 *
 * Dates are compared as strings against D1's CURRENT_TIMESTAMP
 * ('YYYY-MM-DD HH:MM:SS', UTC), so 'YYYY-MM-DD' means midnight UTC that day.
 * repointStaleSlug and the resync sweep never touch promoted_at, so a healed
 * batch-1 row stays in wave 1.
 */

export const DEMAND_WAVES = Object.freeze([
  // batch 1 (applied 2026-08-17) plus every organic promotion before batch 2
  Object.freeze({ file: 'sitemap-demand.xml' }),
  // batch 2 (applied 2026-09-07 ~10:20Z)
  Object.freeze({ file: 'sitemap-demand-2.xml', from: '2026-09-07' }),
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Fail fast on a malformed wave list: it feeds both the index and the routes. */
export function assertWaves(waves) {
  if (!Array.isArray(waves) || waves.length === 0) throw new Error('waves: list is empty');
  const files = new Set();
  waves.forEach((wave, i) => {
    if (!wave?.file) throw new Error(`waves[${i}]: missing file`);
    if (files.has(wave.file)) throw new Error(`waves[${i}]: duplicate file ${wave.file}`);
    files.add(wave.file);
    if (i === 0) return;
    if (!ISO_DATE.test(wave.from || '')) throw new Error(`waves[${i}]: every wave after the first needs a from date (YYYY-MM-DD)`);
    const previous = waves[i - 1].from;
    if (previous && wave.from <= previous) throw new Error(`waves[${i}]: from dates must increase (${previous} → ${wave.from})`);
  });
  return waves;
}

assertWaves(DEMAND_WAVES);

/**
 * Half-open promoted_at bounds for a 1-based wave number, or null when the
 * wave is not declared.
 * @returns {{ from: string|null, before: string|null } | null}
 */
export function waveBounds(number, waves = DEMAND_WAVES) {
  if (!Number.isInteger(number) || number < 1 || number > waves.length) return null;
  return {
    from: waves[number - 1].from || null,
    before: waves[number]?.from || null,
  };
}

/** Sitemap file names in wave order, for the static index. */
export function demandSitemapFiles(waves = DEMAND_WAVES) {
  return waves.map((wave) => wave.file);
}
