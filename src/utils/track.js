/**
 * GA4 event helper. Safe no-op when gtag is absent (blocked by an ad
 * blocker, SSR, or tests) so tracking can never break the purchase flow.
 */
export function trackEvent(name, params = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, params);
  }
}

/**
 * Track an attempt to open/download the bilingual user manual. Keeping this
 * event in one helper prevents the landing page and graph menu from drifting
 * onto different event names or parameter shapes.
 */
export function trackUserManualDownload(placement, language) {
  trackEvent('user_manual_download', {
    placement,
    language,
    file_name: 'mapa-societario-user-guide-en-es.pdf',
  });
}
