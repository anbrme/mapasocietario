// Central, language-aware map of the site's secondary destinations.
//
// Both the workspace (/app) header menu and the landing page build their nav
// from this single source so links stay within the visitor's current language
// and never drift. Where a translated page exists, the ES and EN URLs differ;
// where it does not yet exist, both languages fall back to the page that does
// (called out inline) so nothing 404s.
//
// `isHtml` flags the static .html pages (served outside the SPA) so callers can
// choose full-page navigation vs in-app routing — all in the SAME tab.
export function siteNav(lang = 'en') {
  const es = lang === 'es';
  return {
    home: es ? '/es' : '/',
    guide: es ? '/es?guide=1' : '/?guide=1',
    // Due Diligence explainer — exists in both languages.
    reports: es ? '/spanish-company-due-diligence' : '/due-diligence',
    // Pricing is a single bilingual SPA page driven by ?lang.
    pricing: es ? '/pricing?lang=es' : '/pricing',
    dashboard: '/dashboard',
    // About + its FAQ exist as two static pages, one per language.
    about: es ? '/about-es.html' : '/about.html',
    faq: es ? '/about-es.html#faq' : '/about.html#faq',
    // Legal pages currently exist in Spanish only. English versions await real
    // (non-machine) translations, so both languages use the Spanish page for now.
    terms: '/terms.html',
    privacy: '/privacy.html',
  };
}

// True for the static .html destinations (need a full-page load, not SPA routing).
export function isHtmlNav(url) {
  return url.includes('.html');
}
