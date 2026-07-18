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
import { FACEBOOK_URL } from './socialLinks';

export function siteNav(lang = 'en') {
  const es = lang === 'es';
  return {
    home: es ? '/es' : '/',
    guide: es ? '/es?guide=1' : '/?guide=1',
    userGuidePdf: '/mapa-societario-user-guide-en-es.pdf',
    registerGuide: es ? '/es/borme-grafo-empresas' : '/spanish-company-register-search',
    // Due Diligence product page is bilingual (?lang=es). The English-targeted
    // /spanish-company-due-diligence SEO page is NOT the ES destination.
    reports: es ? '/due-diligence?lang=es' : '/due-diligence',
    // Pricing is a single bilingual SPA page driven by ?lang.
    pricing: es ? '/pricing?lang=es' : '/pricing',
    // "Use in Claude" connector page — bilingual SPA route per language.
    connectClaude: es ? '/es/conectar-claude' : '/connect-claude',
    dashboard: '/dashboard',
    // IBEX 35 listed-companies hub — server-rendered (Cloudflare Pages Function),
    // NOT a SPA route, so callers must full-page load (web) or open a Custom Tab
    // (native) via openListedCompanies(); never client-route to it.
    listed: es ? '/empresas-cotizadas' : '/en/listed-companies',
    // About exists per language; the FAQ is its own top-of-page static page.
    about: es ? '/about-es.html' : '/about.html',
    faq: es ? '/faq-es.html' : '/faq.html',
    // Legal pages currently exist in Spanish only. English versions await real
    // (non-machine) translations, so both languages use the Spanish page for now.
    terms: '/terms.html',
    privacy: '/privacy.html',
    facebook: FACEBOOK_URL,
  };
}

// True for the static .html destinations (need a full-page load, not SPA routing).
export function isHtmlNav(url) {
  return url.includes('.html');
}

export function isExternalNav(url) {
  return /^https?:\/\//.test(url);
}
