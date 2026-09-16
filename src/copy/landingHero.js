// Hero and header copy for the homepage, shared by TWO renderers:
//
//   1. src/components/LandingPage.jsx (React, after the bundle runs), and
//   2. scripts/lib/staticHero.mjs (build-time HTML in the prerendered #root,
//      painted before any JavaScript arrives).
//
// Keep this file plain JavaScript with no JSX and no browser globals — the
// prerender script imports it under Node. Because both surfaces read the same
// strings, the static hero can never drift from what React draws over it.

export const LANDING_HERO_COPY = Object.freeze({
  en: Object.freeze({
    eyebrow: 'Corporate relationships, not just records',
    h1: 'Spanish company search and relationship intelligence',
    subtitle:
      'Search a company or officer and see who is connected to whom in an interactive BORME graph. Turn findings into due diligence reports when you need documentation.',
    intro:
      'Free to search, no account. Built from the BORME — the official gazette of Spain’s Commercial Registries — and rebuilt every business day, with continuous coverage since 2009.',
    searchPlaceholder: 'Search a Spanish company or officer',
    searchHint: 'Start typing, then choose a result or press Enter.',
    searchButton: 'Search',
    navLabel: 'Site',
    demoAlt: 'Illustration of a corporate relationship graph',
  }),
  es: Object.freeze({
    eyebrow: 'Relaciones societarias, más que una ficha registral',
    h1: 'Mapa de relaciones societarias en España',
    subtitle:
      'Busca una empresa o administrador y entiende quién está conectado con quién en un grafo BORME interactivo. Convierte los hallazgos en informes due diligence cuando necesites documentación.',
    intro:
      'Búsqueda gratuita, sin cuenta. Construido a partir del BORME —el boletín oficial de los Registros Mercantiles— y reconstruido cada día hábil, con cobertura continua desde 2009.',
    searchPlaceholder: 'Busca una empresa o administrador',
    searchHint: 'Empieza a escribir y elige un resultado o pulsa Intro.',
    searchButton: 'Buscar',
    navLabel: 'Sitio',
    demoAlt: 'Ilustración de un grafo de relaciones societarias',
  }),
});

// Header links, in display order. `alignRight` marks the language switcher,
// which both renderers draw in its own column at the far end of the bar.
export const LANDING_TOP_LINKS = Object.freeze({
  en: Object.freeze([
    { label: 'Spanish company due diligence', href: '/spanish-company-due-diligence', highlight: true },
    { label: 'Pricing', href: '/pricing' },
    { label: 'About', href: '/about.html' },
    { label: 'Terms', href: '/terms.html' },
    { label: 'Privacy', href: '/privacy.html' },
    { label: 'Español', href: '/es', alignRight: true },
  ].map(Object.freeze)),
  es: Object.freeze([
    { label: 'Due diligence de empresas españolas', href: '/es/informes-due-diligence-empresas', highlight: true },
    { label: 'Precios', href: '/pricing?lang=es' },
    { label: 'Acerca de', href: '/about-es.html' },
    { label: 'Términos', href: '/terms.html' },
    { label: 'Privacidad', href: '/privacy.html' },
    { label: 'English', href: '/', alignRight: true },
  ].map(Object.freeze)),
});

// Where the pre-hydration search form submits. /app reads ?search= (App.jsx)
// and the JSON-LD SearchAction in index.html advertises the same contract.
export const LANDING_SEARCH_ACTION = '/app/';
export const LANDING_SEARCH_SOURCE = 'home_search';
export const LANDING_SEARCH_MIN_LENGTH = 2;
