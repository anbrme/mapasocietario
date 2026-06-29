// User-visible copy for the homepage, which is now a first-run how-to guide.
// The page teaches the basics (search → graph → reports) and points users to
// bookmark the real workspace at /app. Detailed reference material still lives
// on the dedicated pages (about.html, /due-diligence, /pricing, /es).
export const LANDING_COPY = {
  en: {
    meta: {
      title: 'Spanish Company Search | Mapa Societario',
      description:
        'Search Spanish companies and directors, explore BORME corporate relationships in an interactive graph, and order due diligence reports when you need documentation. Free to use; no account.',
      ogDescription:
        'Search Spanish companies and directors, explore who is connected to whom, and turn BORME filings into actionable corporate intelligence.',
      twitterDescription:
        'Relationship intelligence for Spain: search companies, explore the BORME graph, order reports when needed.',
      ogLocale: 'en_US',
    },
    topLinks: [
      { label: 'Company register search', href: '/spanish-company-register-search' },
      { label: 'Spanish company due diligence', href: '/spanish-company-due-diligence' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'About', href: '/about.html' },
      { label: 'Terms', href: '/terms.html' },
      { label: 'Privacy', href: '/privacy.html' },
      { label: 'Español', href: '/es', alignRight: true },
    ],
    hero: {
      eyebrow: 'Corporate relationships, not just records',
      h1: 'Spanish company search and relationship intelligence',
      subtitle:
        'Search a company or officer and see who is connected to whom in an interactive BORME graph. Turn findings into due diligence reports when you need documentation.',
      openCta: 'Open the relationship graph',
      bookmarkTip: 'Tip: bookmark the graph so you can jump straight into relationship analysis next time.',
    },
    quickLinks: {
      listed: 'Browse IBEX 35 companies',
      dashboard: 'Stats dashboard',
    },
    howItWorks: {
      heading: 'How it works',
      sub: 'Three steps from a name to a connected corporate picture.',
      demoCaption: 'Real BORME data: the board and corporate connections of ACERINOX SA.',
      demoCta: 'Open this graph live →',
      demoAlt: 'Interactive BORME corporate relationship graph of a Spanish company: directors, officers and connected companies',
      demoFallback: 'Interactive relationship graph',
      steps: [
        {
          title: '1 · Start with a company or officer',
          desc: 'Type a company or a director’s name. Use the toggle to switch between company and officer search, then pick a suggestion to load it into the graph.',
        },
        {
          title: '2 · Explore the graph',
          desc: 'Double-click a node to expand the network, right-click for actions, and follow shared officers, roles, sole shareholders, and connected companies. The graph is free, with no account.',
        },
        {
          title: '3 · Document what matters',
          desc: 'Open a company’s data preview to read its current officers, address, share capital and corporate events, then order a report only when you need a PDF record.',
        },
      ],
    },
    reports: {
      heading: 'Reports after exploration',
      sub: 'Use the graph to understand the relationships first; order a report when you need documentation.',
      dd: {
        title: 'Due Diligence report',
        badge: 'Paid · EUR 22.50 · one company',
        desc: 'A comprehensive PDF on a single company, with AI-powered analysis and official-source cross-checks.',
        bullets: [
          'AI analysis & risk score',
          'Sanctions & PEP screening',
          'Full officer history',
          'Traceability of address and registry changes',
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
      heading: 'Bookmark the relationship graph',
      body: 'This page introduces the workflow. Your actual workspace is the interactive relationship graph — bookmark it so you can jump straight in next time:',
      url: 'mapasocietario.es/app',
      shortcut: 'Press ⌘/Ctrl + D to bookmark',
      cta: 'Open the relationship graph',
    },
    stats: {
      heading: 'Built on official BORME data',
      sub: 'The graph connects companies, officers, and corporate events drawn from Spain’s official commercial registry gazette.',
      sinceLabel: 'Continuous coverage since',
      sinceValue: '2009',
      items: [
        { key: 'companies', label: 'Spanish companies' },
        { key: 'events', label: 'BORME registry filings' },
        { key: 'officerChanges', label: 'Director / officer changes' },
        { key: 'formations', label: 'Company formations' },
      ],
    },
    faq: {
      heading: 'Frequently asked questions',
      items: [
        {
          q: 'What is Mapa Societario?',
          a: 'Mapa Societario is a relationship intelligence tool for Spanish companies and directors. It maps corporate relationships in an interactive graph built from official BORME (Boletín Oficial del Registro Mercantil) data — covering 3.1 million companies and 9.4 million registry filings since 2009 — and generates optional due diligence reports from EUR 22.50.',
        },
        {
          q: 'Do I need an account to use this?',
          a: 'No. Mapa Societario is completely free to use without any registration or login. Due Diligence reports are an optional paid feature purchased per company from EUR 22.50.',
        },
        {
          q: 'Can I search by officer name?',
          a: 'Yes. Use the toggle at the top of the search to switch between company and officer search modes. Officer search lets you find a person and see all the companies they are linked to across 6.3 million recorded officer changes.',
        },
        {
          q: 'Is the data accurate and official?',
          a: 'The data originates from official BORME publications and is extracted using automated parsers. The service is unofficial and provided as is; automated parsing can produce occasional errors. Always cross-reference the official BORME and, for critical decisions, obtain current information directly from the Registro Mercantil.',
        },
        {
          q: 'Who built Mapa Societario?',
          a: 'Mapa Societario is built and operated by Nurnberg Consulting SL (NIF B86829538), a Madrid-based corporate intelligence consultancy active since 2013. The same team also runs NC Data, a broader multi-country investigative platform. It is independent and not affiliated with, or endorsed by, any government body.',
        },
      ],
    },
    operatedBy: 'Operated by Nurnberg Consulting SL, Madrid, since 2013. Unofficial service based on public BOE/BORME data.',
    proofItems: [
      'By Nurnberg Consulting SL (Madrid, since 2013)',
      'Based on official BORME publications',
      'Free relationship graph',
      'No account required',
    ],
    footer: {
      productOf: 'A product of',
      productOfSuffix: ' (Madrid, Spain) · Data sourced from BORME (Boletín Oficial del Registro Mercantil)',
      basedOnPrefix: 'Based on data from the ',
      basedOnSuffix: '. This service is unofficial and is not endorsed by the AEBOE.',
      ddReports: 'Due Diligence Reports',
      dashboard: 'Dashboard',
      about: 'About',
      apiDocs: 'Public API docs',
      connectClaude: 'Use in Claude',
      ncdata: 'NC Data (multi-country)',
      facebook: 'Facebook',
      privacy: 'Privacy & Cookies',
      terms: 'Terms',
    },
  },

  es: {
    meta: {
      title: 'Inteligencia de Relaciones Societarias en España | Mapa Societario',
      description:
        'Entiende quién está conectado con quién en empresas españolas. Explora relaciones societarias en un grafo BORME interactivo y pide informes due diligence cuando necesites documentación. Gratis; sin cuenta.',
      ogDescription:
        'Busca empresas y administradores españoles, explora quién está conectado con quién y convierte publicaciones BORME en inteligencia societaria accionable.',
      twitterDescription:
        'Inteligencia de relaciones societarias en España: busca empresas, explora el grafo BORME y pide informes cuando los necesites.',
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
      eyebrow: 'Relaciones societarias, no solo fichas',
      h1: 'Inteligencia de relaciones societarias en España',
      subtitle:
        'Busca una empresa o administrador y entiende quién está conectado con quién en un grafo BORME interactivo. Convierte los hallazgos en informes due diligence cuando necesites documentación.',
      openCta: 'Abrir el grafo de relaciones',
      bookmarkTip: 'Consejo: guarda el grafo en marcadores para entrar directamente al análisis de relaciones la próxima vez.',
    },
    quickLinks: {
      listed: 'Ver empresas del IBEX 35',
      dashboard: 'Panel estadístico',
    },
    howItWorks: {
      heading: 'Cómo funciona',
      sub: 'Tres pasos para pasar de un nombre a una visión societaria conectada.',
      demoCaption: 'Datos reales del BORME: el consejo y las conexiones societarias de ACERINOX SA.',
      demoCta: 'Abrir este grafo en vivo →',
      demoAlt: 'Grafo interactivo de relaciones societarias BORME de una empresa española: administradores, cargos y empresas conectadas',
      demoFallback: 'Grafo de relaciones interactivo',
      steps: [
        {
          title: '1 · Empieza con una empresa o administrador',
          desc: 'Escribe el nombre de una empresa o de un administrador. Usa el conmutador para alternar entre búsqueda de empresas y de personas, y elige una sugerencia para cargarla en el grafo.',
        },
        {
          title: '2 · Explora el grafo',
          desc: 'Haz doble clic en un nodo para expandir la red, clic derecho para acciones y sigue administradores compartidos, cargos, socios únicos y empresas conectadas. El grafo es gratis y sin cuenta.',
        },
        {
          title: '3 · Documenta lo importante',
          desc: 'Abre la vista previa de una empresa para ver administradores, domicilio, capital social y eventos societarios, y pide un informe solo cuando necesites un PDF documental.',
        },
      ],
    },
    reports: {
      heading: 'Informes después de explorar',
      sub: 'Usa primero el grafo para entender las relaciones; pide un informe cuando necesites documentación.',
      dd: {
        title: 'Informe due diligence',
        badge: 'De pago · 22,50 € · una empresa',
        desc: 'Un PDF completo sobre una sola empresa, con análisis por IA y cruces con fuentes oficiales.',
        bullets: [
          'Análisis por IA y puntuación de riesgo',
          'Comprobación de sanciones y PEP',
          'Historial completo de administradores',
          'Trazabilidad de cambios de domicilio y registro',
          'Eventos de capital y señales de alerta',
          'Cuentas anuales opcionales',
          'Monitorización empresa gratuita incluida',
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
      heading: 'Guarda el grafo de relaciones',
      body: 'Esta página presenta el flujo de trabajo. Tu espacio real es el grafo interactivo de relaciones: guárdalo en marcadores para entrar directamente la próxima vez:',
      url: 'mapasocietario.es/app',
      shortcut: 'Pulsa ⌘/Ctrl + D para guardar',
      cta: 'Abrir el grafo de relaciones',
    },
    stats: {
      heading: 'Construido sobre datos oficiales del BORME',
      sub: 'El grafo conecta empresas, administradores y eventos societarios procedentes del Boletín Oficial del Registro Mercantil.',
      sinceLabel: 'Cobertura continua desde',
      sinceValue: '2009',
      items: [
        { key: 'companies', label: 'Empresas españolas' },
        { key: 'events', label: 'Publicaciones BORME' },
        { key: 'officerChanges', label: 'Cambios de administradores' },
        { key: 'formations', label: 'Constituciones de empresas' },
      ],
    },
    faq: {
      heading: 'Preguntas frecuentes',
      items: [
        {
          q: '¿Qué es Mapa Societario?',
          a: 'Mapa Societario es una herramienta de inteligencia de relaciones societarias para empresas y administradores españoles. Cartografía las relaciones societarias en un grafo interactivo construido con datos oficiales del BORME (Boletín Oficial del Registro Mercantil) —que abarca 3,1 millones de empresas y 9,4 millones de publicaciones registrales desde 2009— y genera informes due diligence opcionales desde 22,50 EUR.',
        },
        {
          q: '¿Necesito una cuenta para usarlo?',
          a: 'No. Mapa Societario es completamente gratuito, sin registro ni inicio de sesión. Los informes due diligence son una función de pago opcional que se compra por empresa desde 22,50 EUR.',
        },
        {
          q: '¿Puedo buscar por nombre de administrador?',
          a: 'Sí. Usa el conmutador en la parte superior de la búsqueda para alternar entre búsqueda por empresa y por administrador. La búsqueda por persona te permite encontrar a alguien y ver todas las empresas a las que está vinculado, a partir de 6,3 millones de cambios de administradores registrados.',
        },
        {
          q: '¿Los datos son precisos y oficiales?',
          a: 'Los datos proceden de publicaciones oficiales del BORME y se extraen mediante analizadores automáticos. El servicio es no oficial y se ofrece tal cual; el análisis automático puede contener errores ocasionales. Contrasta siempre con el BORME oficial y, para decisiones importantes, obtén información actualizada directamente del Registro Mercantil.',
        },
        {
          q: '¿Quién ha creado Mapa Societario?',
          a: 'Mapa Societario está creado y operado por Nurnberg Consulting SL (NIF B86829538), una consultora de inteligencia corporativa con sede en Madrid y activa desde 2013. El mismo equipo gestiona NC Data, una plataforma de investigación multinacional más amplia. Es independiente y no está afiliado ni avalado por ningún organismo público.',
        },
      ],
    },
    operatedBy: 'Operado por Nurnberg Consulting SL, Madrid, desde 2013. Servicio no oficial basado en datos públicos del BOE/BORME.',
    proofItems: [
      'De Nurnberg Consulting SL (Madrid, desde 2013)',
      'Basado en publicaciones oficiales del BORME',
      'Grafo de relaciones gratuito',
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
      connectClaude: 'Usar en Claude',
      ncdata: 'NC Data (multipaís)',
      facebook: 'Facebook',
      privacy: 'Privacidad y cookies',
      terms: 'Términos',
    },
  },
};
