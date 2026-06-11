import React from 'react';

// All user-visible copy for the landing page, keyed by locale. Icons, colors,
// hrefs and layout stay in LandingPage.jsx — per-locale arrays here must keep
// the same length and order as their structural counterparts there.
export const LANDING_COPY = {
  en: {
    meta: {
      title: 'Mapa Societario | Spanish Company Search & Corporate Relationship Graph',
      description:
        'Due diligence on Spanish companies and directors instantly. Interactive BORME-based corporate relationship graph, officer history lookup, and AI-powered due diligence reports from EUR 22.50.',
      ogDescription:
        'Due diligence on Spanish companies and directors instantly. Interactive BORME-based corporate relationship graph, officer history, and AI-powered due diligence reports.',
      twitterDescription:
        'Due diligence on Spanish companies and directors instantly. BORME-based corporate graph, officer history, and due diligence reports from EUR 22.50.',
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
      h1: 'Due diligence on Spanish companies and directors in seconds',
      subtitle: 'BORME-based corporate relationship search, officer history, and instant due diligence reports.',
      operatedBy: 'Operated by Nurnberg Consulting SL, Madrid, since 2013. Unofficial service based on public BOE/BORME data.',
      searchCta: 'Search companies and officers',
      listedCta: 'Publicly-traded companies (IBEX 35)',
      statsCta: 'Spain company statistics',
      sampleReportCta: 'See a sample report',
      moneyBack: 'Money-back if the data is wrong or inaccurate',
      playBadgeAlt: 'Get it on Google Play',
    },
    proofItems: [
      'By Nurnberg Consulting SL (Madrid, since 2013)',
      'Based on official BORME publications',
      'Free graph exploration',
      'Reports from EUR 22.50',
    ],
    capabilities: {
      label: 'What you can do',
      heading: 'Explore corporate relationships, perform due diligence on officers, and generate reports',
      items: [
        {
          title: 'Company network graph',
          desc: 'Search any Spanish company and instantly see its directors, officers, and corporate connections in an interactive force graph.',
        },
        {
          title: 'Officer lookup',
          desc: 'Search an officer by name and discover every company they are or were associated with — appointments, resignations, roles. This includes a comprehensive history of all their corporate affiliations, sorted by seniority and recency, with key details like appointment dates, roles, and even current or former political positions highlighted.',
        },
        {
          title: 'Due Diligence PDF',
          desc: 'Purchase a comprehensive AI-powered report with sanctions screening, risk scoring, capital history, and red flag analysis. Add financial statements with AI analysis.',
        },
        {
          title: 'Analytics dashboard',
          desc: 'Monitor formations, dissolutions, officer changes, and capital trends across Spain — filterable by province and date.',
        },
      ],
    },
    howItWorks: {
      label: 'How it works',
      heading: 'From search to insight in seconds',
      sub: "The graph is fully interactive. Here's what you can do:",
      demoAlt: (company) => `Interactive BORME corporate relationship graph of ${company}: directors, officers and connected companies`,
      demoCaption: (company) => `Real BORME data: the board and corporate connections of ${company}.`,
      demoCta: 'Explore this graph live →',
      steps: [
        {
          title: 'Search',
          desc: 'Type a company or officer name in the search bar. Select from the autocomplete suggestions to load the entity and its connections into the graph.',
        },
        {
          title: 'Double-click to expand',
          desc: 'Double-click any node in the graph to expand it — for a company, this loads all its officers; for an officer, it loads all their companies.',
        },
        {
          title: 'Right-click for actions',
          desc: 'Right-click any node to open a context menu. You can edit or merge nodes, hide them, delete them, preview the full data, or buy a Due Diligence report.',
        },
        {
          title: 'Preview company data',
          desc: 'Select "Vista previa de datos" from the right-click menu to see a detailed overview: current officers sorted by seniority, address, capital, corporate events — all before buying a report.',
        },
        {
          title: 'Navigate the graph',
          desc: 'Scroll to zoom in/out. Drag the canvas to pan. Drag individual nodes to reposition them. Use the settings panel to adjust node size, label size, and physics.',
        },
        {
          title: 'Buy a Due Diligence report',
          desc: 'From the right-click menu or the data preview, purchase a comprehensive PDF with AI analysis, sanctions screening, red flags, officer network, and optional financial statements.',
        },
      ],
      tryCta: 'Try it now',
      sampleCta: 'See sample report',
    },
    useCases: {
      label: "Who it's for",
      heading: 'Built for anyone who needs corporate intelligence in Spain',
      items: [
        { label: 'Compliance / KYC', desc: 'Screen counterparties and verify corporate structures before onboarding.' },
        { label: 'Sales / lead research', desc: 'Identify decision-makers and map corporate groups for targeted outreach.' },
        { label: 'Journalists / investigators', desc: 'Trace connections between companies and individuals across the registry.' },
        { label: 'Investors / M&A screening', desc: 'Evaluate corporate history, officer track records, and red flags before deals.' },
      ],
    },
    differentiators: {
      label: 'Why Mapa Societario',
      heading: 'Purpose-built for the Spanish corporate registry',
      items: [
        { title: 'Spanish registry focus', desc: 'Purpose-built for BORME data — not a generic international database.' },
        { title: 'Relationship graph', desc: 'Visual network exploration, not just record lookup. See connections at a glance.' },
        { title: 'Cheap one-off reports', desc: 'EUR 22.50 per Due Diligence report (plus VAT — on Android, Google Play adds it per country). No subscription, no account required.' },
        { title: 'Fast exploratory workflow', desc: 'From search to insight in seconds. Type a name, explore the graph, buy a report.' },
      ],
    },
    professional: {
      label: 'For professional use',
      heading: 'From free exploration to API access and human investigations',
      intro:
        'Mapa Societario is the public Spanish workflow. The same data and tooling can support self-serve reports, monitoring, third-party integrations, and analyst-led work by Nurnberg Consulting for higher-stakes cases.',
      items: [
        {
          title: 'Instant self-serve reports',
          desc: 'One-off Spanish company due diligence PDFs for quick KYB, supplier checks, investor screening, and internal files.',
          action: 'See report details',
        },
        {
          title: 'Monitoring included',
          desc: 'Every Spanish due diligence purchase can include free BORME and IOSCO alert monitoring for the reviewed company.',
          action: 'Open due diligence',
        },
        {
          title: 'NC Data API and licensing',
          desc: 'For platforms, compliance providers, and data resellers that need Spanish registry intelligence through NC Data API access or data feeds.',
          action: 'Discuss NC Data API access',
        },
        {
          title: 'Human-led investigations',
          desc: 'For higher-stakes matters, Nurnberg Consulting uses these platforms internally and adds analyst judgment, source retrieval, and bespoke research.',
          action: 'Visit Nurnberg Consulting',
        },
      ],
    },
    spanishResources: {
      label: 'Spanish resources',
      heading: 'Research Spanish companies in Spanish',
      intro:
        'Spanish-language pages for common corporate registry workflows: finding administrators, mapping company relationships, understanding BORME data, and ordering due diligence reports.',
      links: [
        { label: 'Mapa societario de empresas españolas', href: '/es' },
        { label: 'Informes due diligence de empresas', href: '/es/informes-due-diligence-empresas' },
        { label: 'Buscar administradores de empresas', href: '/es/buscar-administradores-empresas' },
        { label: 'Grafo de empresas BORME', href: '/es/borme-grafo-empresas' },
        { label: 'Mapa de relaciones societarias', href: '/es/mapa-relaciones-societarias' },
      ],
    },
    whoIsBehind: {
      label: "Who's behind it",
      heading: 'A real company with real professionals behind it',
      intro: (
        <>
          Mapa Societario is operated by <strong>Nurnberg Consulting SL</strong>, a Madrid-based
          consultancy specialised in corporate intelligence and business research. We&apos;ve been helping
          clients navigate European corporate registries since 2013.
        </>
      ),
      companyTagline: 'Corporate intelligence & business research consultancy',
      location: 'Madrid, Spain',
      since: 'Operating since 2013',
      ncdata: {
        heading: 'Need a full investigation platform? Try NC Data',
        body: (
          <>
            Mapa Societario is our dedicated Spanish product. For professional investigators,
            we also operate <strong>NC Data</strong>, a full-fledged investigation platform
            covering companies in Spain, the United Kingdom, France, Switzerland and Italy. Beyond corporate due diligence, NC Data includes one-of-a-kind,
            cutting-edge tools such as <strong>Document Studio</strong>, which lets users
            fine-tune AI for sophisticated analysis of complex, context-heavy documents, along
            with deeper entity resolution, cross-border linking and advanced investigative
            workflows for demanding use cases.
          </>
        ),
        cta: 'Visit ncdata.eu →',
      },
    },
    faq: {
      label: 'FAQ',
      heading: 'Frequently asked questions',
      items: [
        {
          question: 'Is the data accurate and up-to-date?',
          answer: 'Data is sourced from official Spanish public registries (BORME) and updated daily. The data covers the period from 1 January 2009 to the present, so companies formed or having registry activity before 1 January 2009 may show missing information (precisely, the information filed before 1 January 2009). Since the data is parsed from PDF publications, you should be aware of some caveats — specifically, officers are identified by name, and while we use several techniques to avoid mismatches, always verify critical information with official sources.',
        },
        {
          question: 'Do I need to pay or create an account?',
          answer: 'The network graph as well as all options available by right-clicking on a node are completely free — no account, no signup. Due Diligence reports are a paid feature available via a one-time purchase per company (EUR 22.50). Spanish financial statements (Cuentas Anuales) are an optional add-on for an additional EUR 17.50 per company. There are no subscriptions or recurring fees — just pay for the reports you need, when you need them. On the web, taxes are calculated by Stripe at checkout; in the Android app, Google Play is the merchant of record and adds VAT per country, so the final price shown there may differ from EUR 22.50.',
        },
        {
          question: 'What is a Due Diligence report?',
          answer: 'A comprehensive PDF with AI-powered analysis and sanctions cross-checking, covering corporate structure, full officer history, capital events, red flags, and key changes over time — far more detail than the network graph alone. You can also add official financial statements (Cuentas Anuales) from the Registro Mercantil, including an AI-powered financial analysis with key ratios and trends.',
        },
        {
          question: 'Can I get API access?',
          answer: 'Yes. Please write to app@ncdata.eu with a brief description of your intended use case, so that we can tailor our response to your needs.',
        },
      ],
    },
    finalCta: {
      heading: 'Ready to investigate?',
      sub: 'Search companies and officers for free. Purchase a Due Diligence report when you need deeper analysis.',
      searchCta: 'Search now',
      reportCta: 'Order a due diligence report',
    },
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
        'Due diligence de empresas y administradores españoles al instante. Grafo interactivo de relaciones societarias basado en BORME, historial de administradores e informes due diligence por IA desde 22,50 EUR.',
      ogDescription:
        'Due diligence de empresas y administradores españoles al instante. Grafo interactivo de relaciones societarias basado en BORME, historial de administradores e informes due diligence por IA.',
      twitterDescription:
        'Due diligence de empresas y administradores españoles al instante. Grafo societario basado en BORME, historial de administradores e informes due diligence desde 22,50 EUR.',
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
      h1: 'Due diligence de empresas y administradores españoles en segundos',
      subtitle: 'Búsqueda de relaciones societarias basada en BORME, historial de administradores e informes due diligence al instante.',
      operatedBy: 'Operado por Nurnberg Consulting SL, Madrid, desde 2013. Servicio no oficial basado en datos públicos del BOE/BORME.',
      searchCta: 'Buscar empresas y administradores',
      listedCta: 'Empresas cotizadas (IBEX 35)',
      statsCta: 'Estadísticas de empresas en España',
      sampleReportCta: 'Ver un informe de ejemplo',
      moneyBack: 'Devolución del importe si los datos son erróneos o inexactos',
      playBadgeAlt: 'Disponible en Google Play',
    },
    proofItems: [
      'De Nurnberg Consulting SL (Madrid, desde 2013)',
      'Basado en publicaciones oficiales del BORME',
      'Exploración del grafo gratuita',
      'Informes desde 22,50 EUR',
    ],
    capabilities: {
      label: 'Qué puedes hacer',
      heading: 'Explora relaciones societarias, investiga administradores y genera informes',
      items: [
        {
          title: 'Grafo societario de empresas',
          desc: 'Busca cualquier empresa española y ve al instante sus administradores, cargos y conexiones societarias en un grafo interactivo.',
        },
        {
          title: 'Búsqueda de administradores',
          desc: 'Busca a una persona por nombre y descubre todas las empresas con las que está o estuvo vinculada: nombramientos, ceses y cargos. Incluye un historial completo de todos sus vínculos mercantiles, ordenado por relevancia y antigüedad, con detalles clave como fechas de nombramiento, cargos e incluso cargos políticos actuales o pasados destacados.',
        },
        {
          title: 'Informe due diligence en PDF',
          desc: 'Compra un informe completo con análisis por IA, comprobación de sanciones, puntuación de riesgo, historial de capital y señales de alerta. Añade las cuentas anuales con análisis financiero por IA.',
        },
        {
          title: 'Panel de estadísticas',
          desc: 'Sigue constituciones, disoluciones, cambios de administradores y tendencias de capital en toda España, con filtros por provincia y fecha.',
        },
      ],
    },
    howItWorks: {
      label: 'Cómo funciona',
      heading: 'De la búsqueda al análisis en segundos',
      sub: 'El grafo es totalmente interactivo. Esto es lo que puedes hacer:',
      demoAlt: (company) => `Grafo interactivo de relaciones societarias BORME de ${company}: administradores, cargos y empresas conectadas`,
      demoCaption: (company) => `Datos reales del BORME: el consejo y las conexiones societarias de ${company}.`,
      demoCta: 'Explorar este grafo en vivo →',
      steps: [
        {
          title: 'Buscar',
          desc: 'Escribe el nombre de una empresa o administrador en el buscador. Selecciona una sugerencia del autocompletado para cargar la entidad y sus conexiones en el grafo.',
        },
        {
          title: 'Doble clic para expandir',
          desc: 'Haz doble clic en cualquier nodo del grafo para expandirlo: en una empresa carga todos sus administradores; en una persona, todas sus empresas.',
        },
        {
          title: 'Clic derecho para acciones',
          desc: 'Haz clic derecho en cualquier nodo para abrir el menú contextual. Puedes editar o fusionar nodos, ocultarlos, eliminarlos, previsualizar los datos completos o comprar un informe due diligence.',
        },
        {
          title: 'Vista previa de los datos',
          desc: 'Selecciona "Vista previa de datos" en el menú contextual para ver un resumen detallado: administradores actuales ordenados por antigüedad, domicilio, capital y eventos societarios, todo antes de comprar un informe.',
        },
        {
          title: 'Navegar por el grafo',
          desc: 'Usa la rueda del ratón para acercar o alejar. Arrastra el lienzo para desplazarte. Arrastra nodos individuales para recolocarlos. Ajusta el tamaño de nodos, etiquetas y la física en el panel de configuración.',
        },
        {
          title: 'Comprar un informe due diligence',
          desc: 'Desde el menú contextual o la vista previa de datos, compra un PDF completo con análisis por IA, comprobación de sanciones, señales de alerta, red de administradores y cuentas anuales opcionales.',
        },
      ],
      tryCta: 'Pruébalo ahora',
      sampleCta: 'Ver informe de ejemplo',
    },
    useCases: {
      label: 'Para quién es',
      heading: 'Pensado para quien necesita inteligencia corporativa en España',
      items: [
        { label: 'Compliance / KYC', desc: 'Verifica contrapartes y estructuras societarias antes del onboarding.' },
        { label: 'Ventas / prospección', desc: 'Identifica a los decisores y mapea grupos empresariales para una prospección dirigida.' },
        { label: 'Periodistas / investigadores', desc: 'Sigue conexiones entre empresas y personas en todo el registro.' },
        { label: 'Inversores / análisis M&A', desc: 'Evalúa historial societario, trayectoria de administradores y señales de alerta antes de una operación.' },
      ],
    },
    differentiators: {
      label: 'Por qué Mapa Societario',
      heading: 'Diseñado en base a datos del BORME',
      items: [
        { title: 'Especializado en el datos registrales españoles', desc: 'Construido específicamente en base a datos del BORME, no una base de datos internacional genérica.' },
        { title: 'Grafo de relaciones', desc: 'Exploración visual de la red, no solo consulta de registros. Las conexiones, de un vistazo.' },
        { title: 'Informes sueltos y económicos', desc: '22,50 EUR por informe due diligence (más IVA; en Android, Google Play lo añade por país). Sin suscripción y sin necesidad de cuenta.' },
        { title: 'Flujo de trabajo ágil', desc: 'De la búsqueda al análisis en segundos. Escribe un nombre, explora el grafo, compra un informe.' },
      ],
    },
    professional: {
      label: 'Uso profesional',
      heading: 'De la exploración gratuita al acceso API y las investigaciones con analistas',
      intro:
        'Mapa Societario es el flujo de trabajo público para España. Los mismos datos y herramientas sirven para informes autoservicio, monitorización, integraciones de terceros y trabajo de analistas de Nurnberg Consulting en casos de mayor exigencia.',
      items: [
        {
          title: 'Informes autoservicio al instante',
          desc: 'PDFs sueltos de due diligence de empresas españolas para KYB rápido, revisión de proveedores, análisis de inversiones y archivo interno.',
          action: 'Ver detalles del informe',
        },
        {
          title: 'Monitorización incluida',
          desc: 'Cada compra de due diligence puede incluir monitorización gratuita de alertas BORME e IOSCO para la empresa revisada.',
          action: 'Abrir due diligence',
        },
        {
          title: 'API NC Data y licencias',
          desc: 'Para plataformas, proveedores de compliance y distribuidores de datos que necesitan inteligencia del registro español mediante la API de NC Data o feeds de datos.',
          action: 'Consultar acceso a la API NC Data',
        },
        {
          title: 'Investigaciones con analistas',
          desc: 'Para asuntos de mayor exigencia, Nurnberg Consulting usa estas plataformas internamente y añade criterio de analista, obtención de fuentes e investigación a medida.',
          action: 'Visitar Nurnberg Consulting',
        },
      ],
    },
    spanishResources: {
      label: 'Recursos en español',
      heading: 'Guías sobre los datos basados en el BORME',
      intro:
        'Páginas en español sobre cómo buscar administradores, mapear relaciones societarias, entender los datos del BORME y pedir informes due diligence.',
      links: [
        { label: 'Informes due diligence de empresas', href: '/es/informes-due-diligence-empresas' },
        { label: 'Buscar administradores de empresas', href: '/es/buscar-administradores-empresas' },
        { label: 'Grafo de empresas BORME', href: '/es/borme-grafo-empresas' },
        { label: 'Mapa de relaciones societarias', href: '/es/mapa-relaciones-societarias' },
      ],
    },
    whoIsBehind: {
      label: 'Quiénes somos',
      heading: 'Una empresa real con profesionales reales',
      intro: (
        <>
          Mapa Societario está operado por <strong>Nurnberg Consulting SL</strong>, una consultora con
          sede en Madrid especializada en inteligencia corporativa e investigación empresarial. Ayudamos
          a nuestros clientes a navegar los registros mercantiles europeos desde 2013.
        </>
      ),
      companyTagline: 'Consultora de inteligencia corporativa e investigación empresarial',
      location: 'Madrid, España',
      since: 'En activo desde 2013',
      ncdata: {
        heading: '¿Necesitas una plataforma de investigación completa? Prueba NC Data',
        body: (
          <>
            Mapa Societario es nuestro producto dedicado a España. Para investigadores profesionales
            operamos también <strong>NC Data</strong>, una plataforma de investigación completa que
            cubre empresas de España, Reino Unido, Francia, Suiza e Italia. Además de la due diligence
            corporativa, NC Data incluye herramientas únicas y avanzadas como <strong>Document Studio</strong>,
            que permite ajustar la IA para el análisis sofisticado de documentos complejos y con mucho
            contexto, junto con resolución de entidades más profunda, vinculación transfronteriza y
            flujos de investigación avanzados para casos exigentes.
          </>
        ),
        cta: 'Visitar ncdata.eu →',
      },
    },
    faq: {
      label: 'Preguntas frecuentes',
      heading: 'Preguntas frecuentes',
      items: [
        {
          question: '¿Los datos son precisos y están actualizados?',
          answer: 'Los datos proceden de datos públicos del BORME y se actualizan a diario. Cubren el periodo desde el 1 de enero de 2009 hasta la actualidad, por lo que las empresas constituidas o con actividad registral anterior al 1 de enero de 2009 pueden mostrar información incompleta (en concreto, la información presentada antes de esa fecha). Como los datos se extraen de publicaciones en PDF, conviene tener en cuenta algunas salvedades: los administradores se identifican por nombre y, aunque aplicamos varias técnicas para evitar confusiones, verifica siempre la información crítica con fuentes oficiales.',
        },
        {
          question: '¿Tengo que pagar o crear una cuenta?',
          answer: 'El grafo y todas las opciones disponibles con clic derecho sobre un nodo son completamente gratuitos: sin cuenta y sin registro. Los informes due diligence son una función de pago mediante compra única por empresa (22,50 EUR). Las cuentas anuales son un complemento opcional por 17,50 EUR adicionales por empresa. No hay suscripciones ni cuotas recurrentes: pagas solo los informes que necesitas, cuando los necesitas. En la web, los impuestos los calcula Stripe al pagar; en la app de Android, Google Play es el vendedor registrado y añade el IVA por país, por lo que el precio final mostrado allí puede diferir de 22,50 EUR.',
        },
        {
          question: '¿Qué es un informe due diligence?',
          answer: 'Un PDF completo con análisis por IA y cruce de sanciones que cubre la estructura societaria, el historial completo de administradores, los eventos de capital, las señales de alerta y los cambios clave a lo largo del tiempo: mucho más detalle que el grafo por sí solo. También puedes añadir las cuentas anuales oficiales del Registro Mercantil, con un análisis financiero por IA que incluye ratios clave y tendencias.',
        },
        {
          question: '¿Ofrecéis acceso por API?',
          answer: 'Sí. Escríbenos a app@ncdata.eu con una breve descripción de tu caso de uso para que podamos adaptar la respuesta a tus necesidades.',
        },
      ],
    },
    finalCta: {
      heading: '¿Listo para investigar?',
      sub: 'Busca empresas y administradores gratis. Compra un informe due diligence cuando necesites un análisis más profundo.',
      searchCta: 'Buscar ahora',
      reportCta: 'Pedir un informe due diligence',
    },
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
