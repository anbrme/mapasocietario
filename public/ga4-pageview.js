// Manual GA4 page_view for the hand-written static pages (about, faq, terms,
// privacy). They share the SPA's measurement ID but not its React tracker, so
// send_page_view stays off here too and the view is sent once, below.
//
// GA4 reads the page dimension from page_location only — page_path is a
// Universal Analytics field that gtag drops — so the canonical URL has to go
// into page_location to have any effect at all.
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
window.gtag('js', new Date());
window.gtag('config', 'G-HHWT6ZTKZD', { send_page_view: false });
const canonicalLink = document.querySelector('link[rel="canonical"]');
const pageOrigin = canonicalLink
  ? new URL(canonicalLink.href, window.location.origin).origin
  : window.location.origin;
const pagePath = canonicalLink
  ? new URL(canonicalLink.href, window.location.origin).pathname
  : (window.location.pathname.replace(/\/+$/, '') || '/');
window.gtag('event', 'page_view', {
  page_location: pageOrigin + pagePath + window.location.search,
  page_title: document.title,
});
