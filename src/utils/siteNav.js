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
  // Every SPA/prerendered path below carries its trailing slash. Cloudflare
  // Pages serves those routes as directories and 308s the unslashed form, so an
  // unslashed link costs Googlebot two fetches instead of one and surfaces in
  // Search Console as "Page with redirect". Crawl budget here is scarce enough
  // that the slash is not cosmetic. React Router matches with or without it, so
  // in-app routing is unaffected. The .html entries below are the exception:
  // isHtmlNav() keys on that suffix to pick full-page over SPA navigation.
  return {
    home: es ? '/es/' : '/',
    guide: es ? '/es/?guide=1' : '/?guide=1',
    userGuidePdf: '/mapa-societario-user-guide-en-es.pdf',
    registerGuide: es ? '/es/busqueda-registro-mercantil/' : '/spanish-company-register-search/',
    directorSearch: es ? '/es/buscar-administradores-empresas/' : '/company-director-search/',
    // Due Diligence product page is bilingual (?lang=es). The English-targeted
    // /spanish-company-due-diligence SEO page is NOT the ES destination.
    reports: es ? '/due-diligence/?lang=es' : '/due-diligence/',
    // Pricing is a single bilingual SPA page driven by ?lang.
    pricing: es ? '/pricing/?lang=es' : '/pricing/',
    // "Use in Claude" connector page — bilingual SPA route per language.
    connectClaude: es ? '/es/conectar-claude/' : '/connect-claude/',
    // Registry glossary — prerendered static route per language.
    glossary: es ? '/es/glosario/' : '/glossary/',
    dashboard: '/dashboard/',
    // Manage everything an address monitors. Deliberately reachable with no
    // token — the page offers to mail a fresh one — which is the whole point:
    // view tokens are minted only when a digest goes out, so anyone watching a
    // company that has filed nothing has never been sent a link.
    monitoring: es ? '/es/alerts/view' : '/alerts/view',
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
