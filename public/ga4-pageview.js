window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
window.gtag('js', new Date());
window.gtag('config', 'G-HHWT6ZTKZD', { send_page_view: false });
const canonicalLink = document.querySelector('link[rel="canonical"]');
const pagePath = canonicalLink
  ? new URL(canonicalLink.href, window.location.origin).pathname
  : (window.location.pathname.replace(/\/+$/, '') || '/');
window.gtag('event', 'page_view', {
  page_path: pagePath + window.location.search,
  page_title: document.title,
});
