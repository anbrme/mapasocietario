// User-visible copy for the (deliberately light) landing page, keyed by locale.
// The homepage only needs a headline, a one-line value prop, a trust line, a
// few link labels and the footer — all the detailed marketing/explanatory copy
// now lives on the dedicated pages (about.html, /due-diligence, /pricing, the
// /es SEO pages).
export const LANDING_COPY = {
  en: {
    meta: {
      title: 'Mapa Societario | Spanish Company Search & Corporate Relationship Graph',
      description:
        'Search Spanish companies and directors and explore their corporate relationships in an interactive graph based on official BORME data. Free to use; due diligence reports available.',
      ogDescription:
        'Search Spanish companies and directors and explore their corporate relationships in an interactive BORME-based graph.',
      twitterDescription:
        'Search Spanish companies and directors. Interactive BORME-based corporate relationship graph.',
      ogLocale: 'en_US',
    },
    topLinks: [
      { label: 'Spanish company due diligence', href: '/spanish-company-due-diligence' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'About', href: '/about.html' },
      { label: 'Terms', href: '/terms.html' },
      { label: 'Privacy', href: '/privacy.html' },
      { label: 'Español', href: '/es', alignRight: true },
    ],
    hero: {
      h1: 'Explore the corporate network of Spanish companies',
      subtitle:
        'Search any Spanish company or director and see their relationships in an interactive graph, based on official BORME data.',
      operatedBy: 'Operated by Nurnberg Consulting SL, Madrid, since 2013. Unofficial service based on public BOE/BORME data.',
      searchCta: 'Search companies and officers',
      listedCta: 'Publicly-traded companies (IBEX 35)',
      statsCta: 'Spain company statistics',
    },
    proofItems: [
      'By Nurnberg Consulting SL (Madrid, since 2013)',
      'Based on official BORME publications',
      'Free graph exploration',
      'No account required',
    ],
    footer: {
      productOf: 'A product of',
      productOfSuffix: ' (Madrid, Spain) · Data sourced from BORME (Registro Mercantil)',
      basedOnPrefix: 'Based on data from the ',
      basedOnSuffix: '. This service is unofficial and is not endorsed by the AEBOE.',
      ddReports: 'Due Diligence Reports',
      dashboard: 'Dashboard',
      about: 'About',
      apiDocs: 'Public API docs',
      ncdata: 'NC Data (multi-country)',
      privacy: 'Privacy & Cookies',
      terms: 'Terms',
    },
  },

  es: {
    meta: {
      title: 'Mapa Societario | Buscador de Empresas Españolas y Grafo de Relaciones Societarias',
      description:
        'Busca empresas y administradores españoles y explora sus relaciones societarias en un grafo interactivo basado en datos oficiales del BORME. Gratis; con informes due diligence disponibles.',
      ogDescription:
        'Busca empresas y administradores españoles y explora sus relaciones societarias en un grafo interactivo basado en el BORME.',
      twitterDescription:
        'Busca empresas y administradores españoles. Grafo interactivo de relaciones societarias basado en el BORME.',
      ogLocale: 'es_ES',
    },
    topLinks: [
      { label: 'Due diligence de empresas españolas', href: '/spanish-company-due-diligence' },
      { label: 'Precios', href: '/pricing' },
      { label: 'Acerca de', href: '/about.html' },
      { label: 'Términos', href: '/terms.html' },
      { label: 'Privacidad', href: '/privacy.html' },
      { label: 'English', href: '/', alignRight: true },
    ],
    hero: {
      h1: 'Explora la red societaria de las empresas españolas',
      subtitle:
        'Busca cualquier empresa o administrador español y ve sus relaciones en un grafo interactivo, basado en datos oficiales del BORME.',
      operatedBy: 'Operado por Nurnberg Consulting SL, Madrid, desde 2013. Servicio no oficial basado en datos públicos del BOE/BORME.',
      searchCta: 'Buscar empresas y administradores',
      listedCta: 'Empresas cotizadas (IBEX 35)',
      statsCta: 'Estadísticas de empresas en España',
    },
    proofItems: [
      'De Nurnberg Consulting SL (Madrid, desde 2013)',
      'Basado en publicaciones oficiales del BORME',
      'Exploración del grafo gratuita',
      'Sin necesidad de cuenta',
    ],
    footer: {
      productOf: 'Un producto de',
      productOfSuffix: ' (Madrid, España) · Datos procedentes del BORME',
      basedOnPrefix: 'Basado en datos de la ',
      basedOnSuffix: '. Este servicio no es oficial ni está avalado por la AEBOE.',
      ddReports: 'Informes due diligence',
      dashboard: 'Panel de estadísticas',
      about: 'Acerca de',
      apiDocs: 'Documentación API pública',
      ncdata: 'NC Data (multipaís)',
      privacy: 'Privacidad y cookies',
      terms: 'Términos',
    },
  },
};
