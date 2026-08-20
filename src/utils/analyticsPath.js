/**
 * Return the canonical analytics pathname used by SPA page_view events.
 *
 * Prerendered SPA routes are deployed as {route}/index.html, so Cloudflare
 * Pages serves their canonical URLs with a trailing slash. Client-side React
 * navigation bypasses that edge redirect; normalising here keeps direct loads
 * and in-app route changes in the same GA4 row.
 */
export function normalizeAnalyticsPathname(pathname) {
  const trimmed = String(pathname || '/').replace(/\/+$/, '') || '/';
  return trimmed === '/' ? '/' : `${trimmed}/`;
}

export function analyticsPagePath(pathname, search = '') {
  return `${normalizeAnalyticsPathname(pathname)}${search || ''}`;
}
