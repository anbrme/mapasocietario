/**
 * Resolve an in-app company name to its public /empresa page path, or null if
 * no such page exists. The /empresa route only serves curated (CURATED) and
 * IBEX (SEED) companies; everything else 404s. CURATED keys equal
 * nameToSlug(name), but SEED keys are short hand-chosen slugs (e.g. 'acciona'),
 * so we reverse-index BOTH maps by nameToSlug(v3Name) -> slug and look the
 * company up there. Pure; safe to import into the SPA bundle (no _lib.js, no
 * network). The `_` prefix means Cloudflare Pages does not route this file.
 */
import { SEED } from './_ibex35.js';
import { CURATED } from './_curated.js';
import { nameToSlug } from './_slug.js';

// nameToSlug(v3Name) -> public slug, for every company that has an /empresa page.
const SLUG_BY_NAME = (() => {
  const index = {};
  for (const [slug, entry] of Object.entries({ ...SEED, ...CURATED })) {
    if (entry && entry.v3Name) index[nameToSlug(entry.v3Name)] = slug;
  }
  return index;
})();

export function fullCompanyPageHref(name, lang = 'es') {
  const key = nameToSlug(name);
  if (!key) return null;
  // Prefer the curated/IBEX slug (a real indexed page); otherwise use the
  // name-slug, which the route now resolves via its name-lookup fallback.
  const slug = SLUG_BY_NAME[key] || key;
  return lang === 'en' ? `/en/company/${slug}` : `/empresa/${slug}`;
}
