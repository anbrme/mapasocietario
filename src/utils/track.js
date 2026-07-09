/**
 * GA4 event helper. Safe no-op when gtag is absent (blocked by an ad
 * blocker, SSR, or tests) so tracking can never break the purchase flow.
 */
export function trackEvent(name, params = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, params);
  }
}
