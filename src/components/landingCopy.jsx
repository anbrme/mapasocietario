// User-visible copy for the homepage, which is now a first-run how-to guide.
// The page teaches the basics (search → graph → reports) and points users to
// bookmark the real workspace at /app. Detailed reference material still lives
// on the dedicated pages (about.html, /due-diligence, /pricing, /es).
export const LANDING_COPY = {
  en: {
    meta: {
      title: 'How Mapa Societario Works | Spanish Company Search & Due Diligence',
      description:
        'A quick guide to Mapa Societario: search Spanish companies and directors, explore their relationships in an interactive BORME graph, and order due diligence reports. Free to use; no account.',
      ogDescription:
        'How to search Spanish companies and directors, explore the corporate graph, and order due diligence reports — based on official BORME data.',
      twitterDescription:
        'How Mapa Societario works: search Spanish companies, explore the BORME graph, order due diligence reports.',
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
      eyebrow: 'New here? Start in 30 seconds',
      h1: 'How Mapa Societario works',
      subtitle:
        'Search Spanish companies and directors, explore their relationships in an interactive graph, and order due diligence reports — all based on official BORME data.',
      openCta: 'Open the search graph',
      bookmarkTip: 'Tip: bookmark the search page so you can skip this guide next time.',
    },
    howItWorks: {
      heading: 'How it works',
      sub: 'Three steps from a name to a full corporate picture.',
      demoCaption: 'Real BORME data: the board and corporate connections of ACERINOX SA.',
      demoCta: 'Open this graph live →',
      demoAlt: 'Interactive BORME corporate relationship graph of a Spanish company: directors, officers and connected companies',
      demoFallback: 'Interactive relationship graph',
      steps: [
        {
          title: '1 · Search a company or officer',
          desc: 'Type a company or a director’s name. Use the toggle to switch between company and officer search, then pick a suggestion to load it into the graph.',
        },
        {
          title: '2 · Explore the graph',
          desc: 'Double-click a node to expand it, right-click for actions (preview data, hide, buy a report), and scroll to zoom or drag to pan. The graph is free, with no account.',
        },
        {
          title: '3 · See the data',
          desc: 'Open a company’s data preview to read its current officers by seniority, address, share capital and corporate events — before deciding whether to buy a report.',
        },
      ],
    },
    reports: {
      heading: 'Reports you can get',
      sub: 'Two kinds of report — make sure you pick the right one.',
      dd: {
        title: 'Due Diligence report',
        badge: 'Paid · EUR 22.50 · one company',
        desc: 'A comprehensive PDF on a single company, with AI-powered analysis and official-source cross-checks.',
        bullets: [
          'AI analysis & risk score',
          'Sanctions & PEP screening',
          'Full officer history',
          'Capital events & red flags',
          'Optional financial statements (Cuentas Anuales)',
          'Free BORME monitoring included',
        ],
        sampleCta: 'See a sample report (PDF)',
        buyCta: 'Get a due diligence report',
      },
      rel: {
        title: 'Relationship report',
        badge: 'Free · two or more companies',
        desc: 'When several companies are in the graph, generate a report of the links between them — shared directors and cross-company connections — at no cost. To activate the relationship report option, you must search for at least two companies.',
      },
      howToBuy: 'How to buy a Due Diligence report: search a company → open it in the graph → click the Due Diligence button.',
    },
    bookmark: {
      heading: 'Bookmark the search page',
      body: 'This page is just a quick guide. Your actual workspace is the interactive search graph — bookmark it so you can jump straight in next time:',
      url: 'mapasocietario.es/app',
      shortcut: 'Press ⌘/Ctrl + D to bookmark',
      cta: 'Open the search graph',
    },
    operatedBy: 'Operated by Nurnberg Consulting SL, Madrid, since 2013. Unofficial service based on public BOE/BORME data.',
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
      title: 'Cómo funciona Mapa Societario | Buscador de Empresas y Due Diligence',
      description:
        'Guía rápida de Mapa Societario: busca empresas y administradores españoles, explora sus relaciones en un grafo BORME interactivo y pide informes due diligence. Gratis; sin cuenta.',
      ogDescription:
        'Cómo buscar empresas y administradores españoles, explorar el grafo societario y pedir informes due diligence, con datos oficiales del BORME.',
      twitterDescription:
        'Cómo funciona Mapa Societario: busca empresas, explora el grafo del BORME, pide informes due diligence.',
      ogLocale: 'es_ES',
    },
    topLinks: [
      { label: 'Due diligence de empresas españolas', href: '/es/informes-due-diligence-empresas' },
      { label: 'Precios', href: '/pricing?lang=es' },
      { label: 'Acerca de', href: '/about-es.html' },
      { label: 'Términos', href: '/terms.html' },
      { label: 'Privacidad', href: '/privacy.html' },
      { label: 'English', href: '/', alignRight: true },
    ],
    hero: {
      eyebrow: '¿Primera vez? Empieza en 30 segundos',
      h1: 'Cómo funciona Mapa Societario',
      subtitle:
        'Busca empresas y administradores españoles, explora sus relaciones en un grafo interactivo y pide informes due diligence, todo con datos oficiales del BORME.',
      openCta: 'Abrir el grafo de búsqueda',
      bookmarkTip: 'Consejo: guarda la página de búsqueda en marcadores para saltarte esta guía la próxima vez.',
    },
    howItWorks: {
      heading: 'Cómo funciona',
      sub: 'Tres pasos para pasar de un nombre a una visión societaria completa.',
      demoCaption: 'Datos reales del BORME: el consejo y las conexiones societarias de ACERINOX SA.',
      demoCta: 'Abrir este grafo en vivo →',
      demoAlt: 'Grafo interactivo de relaciones societarias BORME de una empresa española: administradores, cargos y empresas conectadas',
      demoFallback: 'Grafo de relaciones interactivo',
      steps: [
        {
          title: '1 · Busca una empresa o administrador',
          desc: 'Escribe el nombre de una empresa o de un administrador. Usa el conmutador para alternar entre búsqueda de empresas y de personas, y elige una sugerencia para cargarla en el grafo.',
        },
        {
          title: '2 · Explora el grafo',
          desc: 'Haz doble clic en un nodo para expandirlo, clic derecho para acciones (vista previa, ocultar, comprar un informe) y usa la rueda para acercar o arrastra para desplazarte. El grafo es gratis y sin cuenta.',
        },
        {
          title: '3 · Consulta los datos',
          desc: 'Abre la vista previa de una empresa para ver sus administradores por antigüedad, domicilio, capital social y eventos societarios, antes de decidir si compras un informe.',
        },
      ],
    },
    reports: {
      heading: 'Informes que puedes obtener',
      sub: 'Dos tipos de informe: asegúrate de elegir el correcto.',
      dd: {
        title: 'Informe due diligence',
        badge: 'De pago · 22,50 € · una empresa',
        desc: 'Un PDF completo sobre una sola empresa, con análisis por IA y cruces con fuentes oficiales.',
        bullets: [
          'Análisis por IA y puntuación de riesgo',
          'Comprobación de sanciones y PEP',
          'Historial completo de administradores',
          'Eventos de capital y señales de alerta',
          'Cuentas anuales opcionales',
          'Monitorización BORME gratuita incluida',
        ],
        sampleCta: 'Ver un informe de ejemplo (PDF)',
        buyCta: 'Pedir un informe due diligence',
      },
      rel: {
        title: 'Informe de relaciones',
        badge: 'Gratis · dos o más empresas',
        desc: 'Cuando hay varias empresas en el grafo, genera un informe de los vínculos entre ellas (administradores compartidos y conexiones entre empresas) sin coste. Para que se active la opción de informe de relaciones, hay que buscar al menos dos empresas.',
      },
      howToBuy: 'Cómo comprar un informe due diligence: busca una empresa → ábrela en el grafo → pulsa el botón Due Diligence.',
    },
    bookmark: {
      heading: 'Guarda la página de búsqueda',
      body: 'Esta página es solo una guía rápida. Tu espacio de trabajo es el grafo de búsqueda interactivo: guárdalo en marcadores para entrar directamente la próxima vez:',
      url: 'mapasocietario.es/app',
      shortcut: 'Pulsa ⌘/Ctrl + D para guardar',
      cta: 'Abrir el grafo de búsqueda',
    },
    operatedBy: 'Operado por Nurnberg Consulting SL, Madrid, desde 2013. Servicio no oficial basado en datos públicos del BOE/BORME.',
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
