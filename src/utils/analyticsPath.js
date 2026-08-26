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

/**
 * Return the absolute URL to send as GA4's `page_location`.
 *
 * GA4 has no `page_path` parameter — that is Universal Analytics, and gtag
 * drops it. It builds every page dimension from `page_location`, defaulting to
 * the browser's raw URL when we omit it, which is how the normalisation above
 * ended up doing nothing. Sending it explicitly is what makes it apply.
 */
export function analyticsPageLocation(pathname, search = '', origin) {
  const resolved = origin === undefined && typeof window !== 'undefined'
    ? window.location.origin
    : origin;
  const base = String(resolved || '').replace(/\/+$/, '');
  return `${base}${analyticsPagePath(pathname, search)}`;
}
