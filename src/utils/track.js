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

/**
 * Track the hand-off from the graph's company preview to the full company
 * page. The destination is public and lets GA4 report which profiles attract
 * the strongest interest without sending the user's search query.
 */
export function trackFullCompanyProfileClick({ href, language, entrySource }) {
  trackEvent('company_full_profile_click', {
    placement: 'graph_company_preview',
    language,
    entry_source: entrySource,
    link_url: href,
    link_text: language === 'en' ? 'View full profile' : 'Ver ficha completa',
  });
}
