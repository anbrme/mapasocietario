/**
 * Response headers for a rendered company page.
 *
 * Extracted from _lib.js so the one case that must never be got wrong has a
 * test: a private response (a badge preview) carries a token-bearing address
 * and MUST NOT reach a shared cache, or a badge that is not public yet would be
 * served to whoever asked next.
 *
 * The `_` prefix means Cloudflare Pages does not route this file.
 */

// One hour, not one day. The registry publishes daily and the officer tables
// are rendered from it: a 24h edge cache could keep serving a board that
// changed this morning. stale-while-revalidate is kept for origin trouble but
// bounded to a day, so a rarely-visited page cannot serve a week-old board.
const PUBLIC_CACHE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
const NOINDEX_CACHE = 'public, max-age=0, s-maxage=600';

export function companyPageHeaders({ noindex = false, privateResponse = false } = {}) {
  if (privateResponse) {
    return {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
      'referrer-policy': 'no-referrer',
      'x-robots-tag': 'noindex, nofollow, noarchive',
    };
  }
  return {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': noindex ? NOINDEX_CACHE : PUBLIC_CACHE,
  };
}
