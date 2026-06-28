/**
 * The canonical company-name → URL-slug function, shared by the server page
 * renderer (_lib.js) and the SPA (which matches a selected company to a
 * curated confirmation by slug). Kept in its own tiny module so the browser
 * bundle does not import the whole _lib.js server renderer. The `_` prefix
 * means Cloudflare Pages does not route this file.
 */
export function nameToSlug(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ñ/gi, 'n')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// From a list of (fuzzy) search hits, return the company_name whose slug EXACTLY
// equals `slug`, else null. This is the round-trip guard applied to a search
// result: nameToSlug is lossy ("&"→"y", "ñ"→"n"), so an exact backend name lookup
// misses those companies; search tokenizes past the substitution, and this picks
// the hit that round-trips — keeping resolution exact, never a fuzzy near-miss.
export function pickSlugMatch(slug, hits) {
  for (const h of hits || []) {
    const name = h && (h.company_name || h.company_name_normalized);
    if (name && nameToSlug(name) === slug) return name;
  }
  return null;
}
