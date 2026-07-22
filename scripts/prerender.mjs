/**
 * Post-build prerendering script.
 *
 * For each SPA route it creates a dedicated HTML file (e.g. dist/due-diligence/index.html)
 * with route-specific <head> meta tags and static content for crawlers.
 * The React app still hydrates normally for real users.
 *
 * No headless browser required — works in any CI environment.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACEBOOK_URL } from '../src/utils/socialLinks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');

const siteUrl = (process.env.SITE_URL || 'https://mapasocietario.es').replace(/\/+$/, '');
const canonicalPath = (routePath) => {
  if (routePath === '/') return '/';
  if (path.extname(routePath)) return routePath;
  return `${routePath.replace(/\/+$/, '')}/`;
};
const disclaimerHtmlEs = `
        <section style="border:1px solid rgba(25,118,210,0.35);background:rgba(25,118,210,0.06);padding:0.9rem 1rem;border-radius:8px;margin:1.5rem 0;color:#a9b8cf">
          <p style="margin:0"><strong>Servicio independiente basado en fuentes oficiales.</strong> Mapa Societario utiliza datos de la <a href="https://www.boe.es">Agencia Estatal Boletín Oficial del Estado</a>, reutilizados conforme a sus <a href="https://www.boe.es/informacion/aviso_legal/index.php#reutilizacion">condiciones de reutilización</a>. Transforma, combina y analiza publicaciones oficiales del BOE/BORME mediante procesos automatizados; no es el Registro Mercantil, no emite certificaciones y no está avalado por la AEBOE. La información se ofrece tal cual y puede contener errores, omisiones o retrasos. Para cualquier decisión relevante, consulta siempre la edición oficial del <a href="https://www.boe.es/diario_borme/">BORME</a> y, cuando proceda, solicita documentación actualizada directamente al Registro Mercantil.</p>
        </section>`;
const disclaimerHtmlEn = `
        <section style="border:1px solid rgba(25,118,210,0.35);background:rgba(25,118,210,0.06);padding:0.9rem 1rem;border-radius:8px;margin:1.5rem 0;color:#a9b8cf">
          <p style="margin:0"><strong>Independent service based on official sources.</strong> Mapa Societario uses data from the <a href="https://www.boe.es">Agencia Estatal Boletín Oficial del Estado</a>, reused under its <a href="https://www.boe.es/informacion/aviso_legal/index.php#reutilizacion">reuse conditions</a>. It transforms, combines, and analyzes official BOE/BORME publications through automated processes; it is not the Registro Mercantil, does not issue certificates, and is not endorsed by the AEBOE. The information is provided as is and may contain errors, omissions, or delays. For any material decision, always verify the official <a href="https://www.boe.es/diario_borme/">BORME</a> edition and, where appropriate, obtain current documents directly from the Registro Mercantil.</p>
        </section>`;

// FAQPage structured data — injected ONLY on the homepage, the single route
// whose prerendered content actually renders these Q&As visibly. Per Google's
// FAQ structured-data guidelines, FAQPage must not appear on pages where the
// FAQ content is not present, so it lives here rather than in the shared head.
const homepageFaqSchema = `    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is Mapa Societario?",
          "acceptedAnswer": { "@type": "Answer", "text": "Mapa Societario is a relationship intelligence tool for Spanish companies and directors. It maps corporate relationships in an interactive graph built from daily BORME (Boletín Oficial del Registro Mercantil) publications — covering 3.2 million companies and 9.5 million published records since 2009 — and generates optional due diligence reports from EUR 22.50. It is not a direct search of the live Registro Mercantil." }
        },
        {
          "@type": "Question",
          "name": "Do I need an account to use this?",
          "acceptedAnswer": { "@type": "Answer", "text": "No. Mapa Societario is completely free to use without any registration or login. Due Diligence reports are an optional paid feature purchased per company from EUR 22.50. Only an email address is required to receive the report. The payment is processed securely through Stripe." }
        },
        {
          "@type": "Question",
          "name": "Can I search by officer name?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. Use the toggle at the top of the search to switch between company and officer search modes. Officer search lets you find a person and see all the companies they are linked to across 6.3 million recorded officer changes." }
        },
        {
          "@type": "Question",
          "name": "Is the data accurate and official?",
          "acceptedAnswer": { "@type": "Answer", "text": "The data originates from official BORME publications and is extracted using automated parsers. The service is unofficial and provided as is; automated parsing can produce occasional errors. Always cross-reference the official BORME and, for critical decisions, obtain current information directly from the Registro Mercantil." }
        },
        {
          "@type": "Question",
          "name": "Who built Mapa Societario?",
          "acceptedAnswer": { "@type": "Answer", "text": "Mapa Societario is built and operated by Nurnberg Consulting SL (NIF B86829538), a Madrid-based corporate intelligence consultancy active since 2013. The same team also runs NC Data, a broader multi-country investigative platform. It is independent and not affiliated with, or endorsed by, any government body." }
        }
      ]
    }
    </script>`;

// Spanish FAQPage for the /es homepage — mirrors homepageFaqSchema; the /es
// React page renders the matching Spanish Q&As visibly.
const homepageFaqSchemaEs = `    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "inLanguage": "es",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "¿Qué es Mapa Societario?",
          "acceptedAnswer": { "@type": "Answer", "text": "Mapa Societario es una herramienta de inteligencia de relaciones societarias para empresas y administradores españoles. Cartografía las relaciones societarias en un grafo interactivo construido con datos oficiales del BORME (Boletín Oficial del Registro Mercantil) —que abarca 3,1 millones de empresas y 9,4 millones de publicaciones registrales desde 2009— y genera informes due diligence opcionales desde 22,50 EUR." }
        },
        {
          "@type": "Question",
          "name": "¿Necesito una cuenta para usarlo?",
          "acceptedAnswer": { "@type": "Answer", "text": "No. Mapa Societario es completamente gratuito, sin registro ni inicio de sesión. Los informes due diligence son una función de pago opcional que se compra por empresa desde 22,50 EUR. Solo se necesita una dirección de correo electrónico para recibir el informe. El pago se procesa de forma segura a través de Stripe." }
        },
        {
          "@type": "Question",
          "name": "¿Puedo buscar por nombre de administrador?",
          "acceptedAnswer": { "@type": "Answer", "text": "Sí. Usa el conmutador en la parte superior de la búsqueda para alternar entre búsqueda por empresa y por administrador. La búsqueda por persona te permite encontrar a alguien y ver todas las empresas a las que está vinculado, a partir de 6,3 millones de cambios de administradores registrados." }
        },
        {
          "@type": "Question",
          "name": "¿Los datos son precisos y oficiales?",
          "acceptedAnswer": { "@type": "Answer", "text": "Los datos proceden de publicaciones oficiales del BORME y se extraen mediante analizadores automáticos. El servicio es no oficial y se ofrece tal cual; el análisis automático puede contener errores ocasionales. Contrasta siempre con el BORME oficial y, para decisiones importantes, obtén información actualizada directamente del Registro Mercantil." }
        },
        {
          "@type": "Question",
          "name": "¿Quién ha creado Mapa Societario?",
          "acceptedAnswer": { "@type": "Answer", "text": "Mapa Societario está creado y operado por Nurnberg Consulting SL (NIF B86829538), una consultora de inteligencia corporativa con sede en Madrid y activa desde 2013. El mismo equipo gestiona NC Data, una plataforma de investigación multinacional más amplia. Es independiente y no está afiliado ni avalado por ningún organismo público." }
        }
      ]
    }
    </script>`;

// Product/Offer structured data — injected ONLY on routes that describe and
// sell the Due Diligence report. Per Google's product structured-data
// guidelines, Product markup should represent a specific product present on the
// page, so it is kept off the homepage, /app, /dashboard, etc.
const PRODUCT_ROUTES = new Set([
  '/due-diligence',
  '/spanish-company-due-diligence',
  '/pricing',
  '/es/informes-due-diligence-empresas',
]);
const productSchema = `    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Due Diligence Report",
      "description": "AI-powered corporate due diligence report for Spanish companies, including sanctions screening, officer history, capital events, and risk analysis.",
      "image": "${siteUrl}/og-image.png",
      "url": "${siteUrl}/due-diligence",
      "brand": { "@type": "Brand", "name": "Mapa Societario" },
      "offers": {
        "@type": "Offer",
        "price": "22.50",
        "priceCurrency": "EUR",
        "availability": "https://schema.org/InStock",
        "url": "${siteUrl}/due-diligence",
        "seller": { "@type": "Organization", "name": "Mapa Societario" },
        "shippingDetails": {
          "@type": "OfferShippingDetails",
          "shippingRate": { "@type": "MonetaryAmount", "value": "0", "currency": "EUR" },
          "deliveryTime": {
            "@type": "ShippingDeliveryTime",
            "handlingTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 0, "unitCode": "DAY" },
            "transitTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 0, "unitCode": "DAY" }
          },
          "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "ES" }
        },
        "hasMerchantReturnPolicy": {
          "@type": "MerchantReturnPolicy",
          "applicableCountry": "ES",
          "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted",
          "returnFees": "https://schema.org/FreeReturn"
        }
      }
    }
    </script>`;

// Read the built index.html as base template
const baseHtml = readFileSync(path.join(distDir, 'index.html'), 'utf8');

// ---------------------------------------------------------------------------
// Route definitions — each entry overrides <head> tags and injects static
// content into <div id="root"> so crawlers see meaningful HTML.
// ---------------------------------------------------------------------------

const routes = [
  {
    // Homepage: the SPA shell ships an empty #root, so crawlers (and the rare
    // homepage crawl — see GSC crawl stats) get no link into the company SEO
    // content. Prerender real content + crawlable links into #root; React
    // replaces it on hydration. Writes dist/index.html (path.join collapses '/').
    path: '/',
    title: 'Spanish Company Search | Mapa Societario',
    description:
      'Search Spanish company and officer histories compiled from daily BORME publications, explore relationships in an interactive graph, and order reports when needed.',
    ogType: 'website',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Mapa Societario &mdash; Spanish Company Search</h1>
        <p>Search Spanish company and officer histories compiled from daily BORME (Boletín Oficial del Registro Mercantil) publications and see who is connected to whom. This is not a direct search of the live Registro Mercantil.</p>
        ${disclaimerHtmlEn}
        <h2>Coverage by the numbers</h2>
        <ul>
          <li><strong>3.2 million</strong> Spanish companies indexed</li>
          <li><strong>9.5 million</strong> BORME publication records</li>
          <li><strong>6.3 million</strong> director and officer changes tracked</li>
          <li><strong>1.7 million</strong> company formations recorded</li>
          <li>Continuous coverage <strong>since January 2009</strong>, updated on business days</li>
        </ul>
        <h2>Annotate and save your investigation</h2>
        <p>Add private notes to important graph nodes, filter the graph by note text, and export the complete investigation &mdash; including notes, data, links, filters, hidden nodes and layout. Import it later exactly as you left it without fetching the same data again.</p>
        <h2>Relationship graph vs. Due Diligence report</h2>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
          <thead>
            <tr><th align="left">Feature</th><th>Free relationship graph</th><th>Due Diligence report (from &euro;22.50)</th></tr>
          </thead>
          <tbody>
            <tr><td>Company &amp; officer search</td><td align="center">Yes</td><td align="center">Yes</td></tr>
            <tr><td>Interactive relationship graph</td><td align="center">Yes</td><td align="center">Yes</td></tr>
            <tr><td>Officer history timeline</td><td align="center">Yes</td><td align="center">Yes</td></tr>
            <tr><td>Private node notes &amp; note search</td><td align="center">Yes</td><td align="center">&mdash;</td></tr>
            <tr><td>Export &amp; import saved investigations</td><td align="center">Yes</td><td align="center">&mdash;</td></tr>
            <tr><td>Sanctions &amp; PEP screening</td><td align="center">&mdash;</td><td align="center">Yes</td></tr>
            <tr><td>AI risk analysis &amp; red flags</td><td align="center">&mdash;</td><td align="center">Yes</td></tr>
            <tr><td>Capital-events summary</td><td align="center">&mdash;</td><td align="center">Yes</td></tr>
            <tr><td>Downloadable PDF report</td><td align="center">&mdash;</td><td align="center">Yes</td></tr>
          </tbody>
        </table>
        <h2>Explore</h2>
        <ul>
          <li><a href="/app">Open the Spanish company relationship graph</a></li>
          <li><a href="/empresas-cotizadas">Empresas cotizadas (IBEX 35)</a> &middot; <a href="/en/listed-companies">IBEX 35 listed companies</a></li>
          <li><a href="/es/">Mapa societario de empresas espa&ntilde;olas</a></li>
          <li><a href="/es/buscar-administradores-empresas/">Buscar administradores de empresas</a></li>
          <li><a href="/es/borme-grafo-empresas/">Grafo de empresas BORME</a></li>
          <li><a href="/spanish-company-register-search/">Spanish company register guide and BORME publication search</a></li>
          <li><a href="/spanish-company-due-diligence/">Spanish company due diligence reports</a></li>
          <li><a href="${FACEBOOK_URL}">Mapa Societario on Facebook</a></li>
        </ul>
        <h2>Frequently asked questions</h2>
        <h3>What is Mapa Societario?</h3>
        <p>A relationship intelligence tool for Spanish companies and directors. It maps corporate relationships in an interactive graph built from daily BORME (Boletín Oficial del Registro Mercantil) publications &mdash; 3.2 million companies and 9.5 million published records since 2009 &mdash; and generates optional due-diligence reports from &euro;22.50. It is not a direct search of the live Registro Mercantil.</p>
        <h3>Do I need an account?</h3>
        <p>No. Mapa Societario is completely free to use without registration or login. Due Diligence reports are an optional paid feature purchased per company. Only an email address is required to receive the report. The payment is processed securely through Stripe.</p>
        <h3>Can I search by officer name?</h3>
        <p>Yes. Toggle between company and officer search at the top of the search. Officer search finds a person and shows every company they are linked to across 6.3 million recorded officer changes.</p>
        <h3>Is the data official?</h3>
        <p>The data originates from official BORME publications and is extracted with automated parsers. The service is unofficial and provided as is; always cross-reference the official BORME for critical decisions.</p>
        <h3>Who built it?</h3>
        <p>Mapa Societario is built and operated by Nurnberg Consulting SL (NIF B86829538), a Madrid-based corporate intelligence consultancy active since 2013. It is independent and not endorsed by any government body. <a href="/faq">More questions &rarr;</a></p>
      </main>`,
  },
  {
    path: '/app',
    title: 'Relationship Graph | Mapa Societario',
    description:
      'Search Spanish company and officer histories compiled from daily BORME publications and explore their relationships in an interactive graph.',
    ogType: 'website',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Mapa Societario &mdash; Spanish Company Relationship Graph</h1>
        <p>Search Spanish company and officer histories compiled from daily BORME publications and understand who is connected to whom. This is not a direct search of the live Registro Mercantil.</p>
        ${disclaimerHtmlEn}
        <ul>
          <li>Search by company name (e.g. Inditex, Repsol)</li>
          <li>Search by officer name (e.g. Amancio Ortega)</li>
          <li>Visualize corporate relationships in real time</li>
          <li>Purchase Due Diligence reports from the search toolbar</li>
        </ul>
        <p><a href="/">Back to Mapa Societario</a> | <a href="/spanish-company-register-search">Spanish company register and BORME publication guide</a> | <a href="${FACEBOOK_URL}">Facebook</a></p>
      </main>`,
  },
  {
    path: '/due-diligence',
    title: 'Spanish Company Due Diligence Reports | Mapa Societario',
    description:
      'Turn Spanish corporate relationship intelligence into due diligence reports with BORME registry data, officer history, relationship graphs, BOE sanctions checks, risk analysis, and PDF delivery from EUR 22.50.',
    ogType: 'product',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Spanish Company Due Diligence Reports</h1>
        <p>Start with the relationship graph, then generate a documented due diligence PDF for any Spanish company. From <strong>EUR&nbsp;22.50</strong> per report.</p>
        ${disclaimerHtmlEn}
        <h2>What's included</h2>
        <ul>
          <li><strong>Corporate Structure</strong> &mdash; Full mapping of officers, shareholders, and subsidiaries from official BORME filings.</li>
          <li><strong>Officer History</strong> &mdash; Complete timeline of appointments, resignations, and role changes.</li>
          <li><strong>Sanctions Screening</strong> &mdash; Automated cross-check against international sanctions lists and PEP databases.</li>
          <li><strong>Red Flags &amp; Risk Score</strong> &mdash; AI-powered analysis highlighting unusual patterns and compliance risks.</li>
          <li><strong>Capital Events</strong> &mdash; Track capital increases, reductions, mergers, and other corporate actions.</li>
          <li><strong>PDF Report</strong> &mdash; Professional, downloadable PDF for compliance files, investor reviews, or internal records.</li>
        </ul>
        <p><a href="/app">Search for a company to get started</a> | <a href="/spanish-company-due-diligence">Spanish company due diligence guide</a></p>
      </main>`,
  },
  {
    path: '/spanish-company-due-diligence',
    title: 'Spanish Company Due Diligence Reports | Mapa Societario',
    description:
      'Spanish company due diligence reports that start from BORME relationship intelligence: corporate graphs, officer history, BOE sanctions checks, sole shareholders, and fully-owned participations.',
    ogType: 'article',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Spanish company due diligence reports</h1>
        <p>Start from registry-based corporate relationship mapping, then document the company with officer history, sole-shareholder and fully-owned participation checks, BOE sanctions checks, and downloadable PDF reports.</p>
        ${disclaimerHtmlEn}
        <h2>What a Spanish company due diligence report covers</h2>
        <ul>
          <li>BORME corporate registry data and officer history.</li>
          <li>Corporate relationship graphs, sole shareholders, and fully-owned participations.</li>
          <li>BOE sanctions checks and Spanish Congress deputy matches where available.</li>
          <li>Downloadable PDF reports for compliance, KYB, supplier review, investment screening, and internal files.</li>
        </ul>
        <h2>Why registry context matters</h2>
        <p>Spanish due diligence often requires more than a company lookup. Understanding administrators, appointments, resignations, connected companies, political exposure signals, and changes over time gives better context for counterparty and investment review.</p>
        <h2>API access and higher-touch investigations</h2>
        <p>The self-serve report is the fast mid-tier option. For third-party data integrations, Spanish registry intelligence is available through NC Data API access and data feeds. For higher-stakes matters, Nurnberg Consulting SL can add human analyst work, source retrieval, document review, and bespoke conclusions.</p>
        <p><a href="mailto:mapasocietario@ncdata.eu?subject=NC%20Data%20Spanish%20API">Discuss NC Data API access</a> | <a href="https://nurnbergconsulting.com">Human-led investigations</a></p>
        <p><a href="/app">Open the relationship graph</a> | <a href="/due-diligence">See report details</a> | <a href="/spanish-company-register-search">Spanish company register and BORME publication guide</a></p>
      </main>`,
  },
  {
    path: '/spanish-company-register-search',
    title: 'Spanish Company Register Guide & BORME Search | Mapa Societario',
    description:
      "Understand Spain's company register and search daily BORME publications by company or officer. This is not a live Registro Mercantil or certificate search.",
    ogType: 'article',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Spanish company register guide and BORME publication search</h1>
        <p>Explore the daily BORME publications issued after Spanish Commercial Registry acts. Mapa Societario does not search the live Registro Mercantil or provide certified current registry records.</p>
        <p><a href="/app?source=register_guide">Open the relationship graph</a></p>
        <h2>Which source should you use?</h2>
        <p>The three services answer different questions. Registry history requires a paid offline request; Mapa Societario makes BORME publication history immediately explorable as a relationship graph.</p>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
          <thead><tr><th align="left">Source</th><th align="left">Best for</th><th align="left">Historical view</th><th align="left">Access</th><th align="left">Graph</th></tr></thead>
          <tbody>
            <tr><td><strong>Mapa Societario</strong></td><td>Exploring published company and officer history in one place</td><td>Consolidated BORME publication history since 2009</td><td>Free to explore</td><td>Yes</td></tr>
            <tr><td><strong>BORME</strong></td><td>Reading the original official notices published each day</td><td>Separate daily gazette editions</td><td>Free</td><td>No</td></tr>
            <tr><td><strong>Registro Mercantil</strong></td><td>Authoritative current extracts, certificates and filed documents</td><td>No immediately searchable online history; an offline request typically takes 3&ndash;5 days</td><td>Paid; historical requests typically cost EUR 20&ndash;30 or more</td><td>No</td></tr>
          </tbody>
        </table>
        <p>Consult the <a href="https://www.boe.es/diario_borme/">official BORME editions</a> or the <a href="https://www.mjusticia.gob.es/es/ciudadania/registros/propiedad-mercantiles/registro-mercantil">Ministry of Justice registry guidance</a> when you need the original publication or official registry services.</p>
        ${disclaimerHtmlEn}
        <h2>What this search is—and is not</h2>
        <p>Mapa Societario searches a structured index of acts published in the daily BORME editions. Those publications report acts that Spain's provincial Commercial Registries have recorded, such as incorporations, appointments, resignations, capital changes and dissolutions.</p>
        <p>This is not a direct search of the live Registro Mercantil, a company's registry sheet, or the Registro Mercantil Central. Mapa Societario does not issue certificates or current authoritative registry extracts. Use the relevant official registry when you need those documents.</p>
        <h2>How Spanish company-register acts reach BORME</h2>
        <p>The Registro Mercantil records company acts. Notices of many of those acts are then published in the BORME (Boletín Oficial del Registro Mercantil), the official commercial-registry gazette distributed through Spain's BOE publication system.</p>
        <p>Mapa Societario structures those daily notices into searchable company histories and relationship graphs. Its coverage therefore reflects what was published in BORME; it is not a mirror of every field or document held by the Commercial Registry.</p>
        <h2>What the BORME publication search can reveal</h2>
        <p>Published acts can include company formations, officer appointments and removals, capital increases or reductions, mergers, demergers, dissolutions, registered-office changes and sole-shareholder declarations.</p>
        <ul>
          <li>Published company history, registered-office changes, capital events and other corporate changes.</li>
          <li>Administrators, officers, proxies, appointments and resignations reported in BORME.</li>
          <li>Sole-shareholder declarations and fully owned participations when they are published.</li>
          <li>Connected companies and officer relationships derived from those publications.</li>
        </ul>
        <h2>When to use the Registro Mercantil instead</h2>
        <p>Use the relevant Registro Mercantil when you need a certified document, an authoritative current extract, filed annual accounts or information that may be held on the registry sheet but was not published in BORME.</p>
        <p>Use Mapa Societario to research published changes over time, find current and former officers inferred from those publications, inspect sole-shareholder declarations and explore cross-company relationships in one consolidated view.</p>
        <h2>What the service does not replace</h2>
        <p>BORME does not publish every piece of information held by the Commercial Registry or every fact a buyer, supplier, investor or compliance team may want. Partial shareholders are generally not visible unless a sole-shareholder declaration or another relevant act is published. Annual accounts, beneficial ownership information, websites, emails and commercial contact details require separate sources.</p>
        <h2>How to use Mapa Societario</h2>
        <ol>
          <li>Open the relationship graph and search by company name or officer name.</li>
          <li>Review the company profile, officers, capital events and connected companies derived from BORME publications.</li>
          <li>Expand the graph when a director, proxy, or related company needs more context.</li>
          <li>Order a due diligence report only when you need a PDF record.</li>
        </ol>
        <p><a href="/app?source=register_guide">Open the relationship graph</a> | <a href="/en/listed-companies">Browse IBEX 35 listed companies</a> | <a href="/spanish-company-due-diligence">Spanish company due diligence reports</a></p>
      </main>`,
  },
  {
    path: '/es/busqueda-registro-mercantil',
    title: 'Registro Mercantil, BORME y Mapa Societario | Comparativa',
    description:
      'Compara el Registro Mercantil, el BORME y Mapa Societario por historial, coste y grafo, y explora publicaciones mercantiles desde 2009.',
    ogType: 'article',
    lang: 'es',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Registro Mercantil, BORME y Mapa Societario: qu&eacute; fuente usar</h1>
        <p>Explora las publicaciones diarias del BORME posteriores a actos del Registro Mercantil. Mapa Societario no es una consulta directa del Registro ni ofrece certificaciones registrales actuales.</p>
        <p><a href="/app?lang=es&amp;source=register_guide">Abrir el grafo de relaciones</a></p>
        <h2>&iquest;Qu&eacute; fuente debes utilizar?</h2>
        <p>Las tres fuentes responden a necesidades distintas. El historial del Registro exige una solicitud offline de pago; Mapa Societario permite explorar inmediatamente el historial publicado en BORME como un grafo de relaciones.</p>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
          <thead><tr><th align="left">Fuente</th><th align="left">Mejor para</th><th align="left">Visi&oacute;n hist&oacute;rica</th><th align="left">Acceso</th><th align="left">Grafo</th></tr></thead>
          <tbody>
            <tr><td><strong>Mapa Societario</strong></td><td>Explorar en un solo lugar el historial publicado de empresas y administradores</td><td>Historial consolidado de publicaciones BORME desde 2009</td><td>Exploraci&oacute;n gratuita</td><td>S&iacute;</td></tr>
            <tr><td><strong>BORME</strong></td><td>Leer los anuncios oficiales originales publicados cada d&iacute;a</td><td>Ediciones diarias separadas</td><td>Gratis</td><td>No</td></tr>
            <tr><td><strong>Registro Mercantil</strong></td><td>Notas, certificaciones y documentos oficiales actuales</td><td>No ofrece un historial consultable en l&iacute;nea de forma inmediata; una solicitud offline suele tardar 3&ndash;5 d&iacute;as</td><td>De pago; las solicitudes hist&oacute;ricas suelen costar 20&ndash;30 EUR o m&aacute;s</td><td>No</td></tr>
          </tbody>
        </table>
        <p>Consulta las <a href="https://www.boe.es/diario_borme/">ediciones oficiales del BORME</a> o la <a href="https://www.mjusticia.gob.es/es/ciudadania/registros/propiedad-mercantiles/registro-mercantil">informaci&oacute;n del Ministerio de Justicia sobre el Registro Mercantil</a> cuando necesites el anuncio original o servicios registrales oficiales.</p>
        ${disclaimerHtmlEs}
        <h2>Qu&eacute; busca esta herramienta y qu&eacute; no</h2>
        <p>Mapa Societario busca en un &iacute;ndice estructurado de actos publicados en las ediciones diarias del BORME. Esas publicaciones recogen actos inscritos por los Registros Mercantiles provinciales, como constituciones, nombramientos, ceses, cambios de capital y disoluciones.</p>
        <p>No es una consulta directa del Registro Mercantil en vivo, de la hoja registral de una sociedad ni del Registro Mercantil Central. Mapa Societario no emite certificaciones ni notas registrales actuales con valor oficial.</p>
        <h2>C&oacute;mo llegan los actos registrales al BORME</h2>
        <p>El Registro Mercantil inscribe los actos societarios. Muchos de esos actos se publican despu&eacute;s en el BORME, el bolet&iacute;n oficial mercantil distribuido a trav&eacute;s del sistema de publicaci&oacute;n del BOE.</p>
        <p>Mapa Societario estructura esos anuncios diarios como historiales de empresas y grafos de relaciones. Su cobertura refleja lo publicado en BORME; no reproduce todos los campos ni documentos conservados por el Registro Mercantil.</p>
        <h2>Qu&eacute; puede revelar el historial publicado</h2>
        <p>Los actos publicados pueden incluir constituciones, nombramientos y ceses, ampliaciones o reducciones de capital, fusiones, escisiones, disoluciones, cambios de domicilio y declaraciones de socio &uacute;nico.</p>
        <h2>Cu&aacute;ndo utilizar el Registro Mercantil</h2>
        <p>Utiliza el Registro Mercantil correspondiente cuando necesites una certificaci&oacute;n, una nota actual con valor oficial, cuentas depositadas o informaci&oacute;n que pueda constar en la hoja registral pero no se haya publicado en BORME.</p>
        <p>Utiliza Mapa Societario para investigar cambios publicados a lo largo del tiempo, localizar administradores actuales y anteriores, revisar declaraciones de socio &uacute;nico y explorar relaciones entre empresas en una sola vista.</p>
        <h2>C&oacute;mo utilizar Mapa Societario</h2>
        <ol>
          <li>Abre el grafo de relaciones y busca por nombre de empresa o de administrador.</li>
          <li>Revisa la ficha, los cargos, los eventos de capital, las declaraciones de socio &uacute;nico y las sociedades conectadas.</li>
          <li>Ampl&iacute;a el grafo cuando un administrador, apoderado o empresa relacionada necesite m&aacute;s contexto.</li>
          <li>Solicita un informe due diligence cuando necesites un PDF documental.</li>
        </ol>
        <p><a href="/app?lang=es&amp;source=register_guide">Abrir el grafo de relaciones</a> | <a href="/empresas-cotizadas">Empresas del IBEX 35</a> | <a href="/due-diligence?lang=es">Informes due diligence</a></p>
      </main>`,
  },
  {
    path: '/pricing',
    title: 'Pricing | Mapa Societario',
    description:
      'Mapa Societario pricing: Spanish company due diligence reports from EUR 22.50, with an optional financial statements add-on (EUR 17.50). No subscription, no account required. Volume pricing for law firms and consultancies.',
    ogType: 'website',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Pricing</h1>
        <p>Explore the corporate relationship graph for free. Pay only when you need a documented report &mdash; no subscription, no account required.</p>
        ${disclaimerHtmlEn}
        <h2>One-off reports</h2>
        <ul>
          <li><strong>Company due diligence report</strong> &mdash; <strong>EUR&nbsp;22.50</strong>. AI analysis, corporate structure, full officer history, capital events, BOE sanctions checks, and red flags, delivered as a PDF.</li>
          <li><strong>Financial statements add-on (optional)</strong> &mdash; <strong>+EUR&nbsp;17.50</strong>. Optional. If selected, the report gains a dedicated financial analysis section: the official Cuentas Anuales from the Registro Mercantil plus an accurate AI analysis.</li>
          <li><strong>Full report with financial statements</strong> &mdash; <strong>EUR&nbsp;40.00</strong>.</li>
        </ul>
        <p>Prices exclude VAT, calculated at checkout. On Android, Google Play is the merchant of record and adds VAT per country.</p>
        <h2>Volume pricing</h2>
        <p>Law firms, consultancies, and compliance teams running repeat checks can get volume pricing. See the <a href="/pricing">pricing page</a> to get in touch.</p>
        <p><a href="/app">Search a company</a> | <a href="/spanish-company-due-diligence">What is in a report</a></p>
      </main>`,
  },
  {
    path: '/dashboard',
    title: 'Dashboard | Mapa Societario',
    description:
      'Live analytics dashboard tracking Spanish corporate activity — formations, dissolutions, officer changes, and trends by province and company type.',
    ogType: 'website',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Spanish Corporate Stats Dashboard</h1>
        <p>Real-time statistics on company formations, dissolutions, and officer changes across Spain, sourced from BORME (Boletín Oficial del Registro Mercantil).</p>
        ${disclaimerHtmlEn}
        <ul>
          <li>Company formations and dissolutions over time</li>
          <li>Officer appointment and resignation trends</li>
          <li>Filter by province, company type, and date range</li>
          <li>Year-over-year comparisons</li>
        </ul>
        <p><a href="/">Back to Mapa Societario</a></p>
      </main>`,
  },
  {
    path: '/es',
    title: 'Mapa Societario | Mapa de Relaciones Societarias en España',
    description:
      'Entiende quién está conectado con quién en empresas españolas. Grafo interactivo de relaciones societarias basado en BORME e informes due diligence desde 22,50 EUR.',
    ogType: 'website',
    lang: 'es',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Mapa Societario &mdash; Mapa de Relaciones Societarias en España</h1>
        <p>Busca una empresa o administrador y entiende quién está conectado con quién mediante un grafo interactivo basado en publicaciones oficiales del BORME (Boletín Oficial del Registro Mercantil). Genera informes due diligence cuando necesites documentación.</p>
        ${disclaimerHtmlEs}
        <h2>Anota y guarda tu investigación</h2>
        <p>Añade notas privadas a los nodos importantes, filtra el grafo por el texto de las notas y exporta la investigación completa &mdash; incluidas las notas, datos, enlaces, filtros, nodos ocultos y disposición. Impórtala después exactamente como la dejaste, sin volver a consultar los mismos datos.</p>
        <h2>Explorar</h2>
        <ul>
          <li><a href="/app">Buscar relaciones societarias</a></li>
          <li><a href="/empresas-cotizadas">Empresas cotizadas (IBEX 35)</a></li>
          <li><a href="/due-diligence">Informes due diligence</a></li>
          <li><a href="/es/informes-due-diligence-empresas/">Informes due diligence de empresas</a></li>
          <li><a href="/es/buscar-administradores-empresas/">Buscar administradores de empresas</a></li>
          <li><a href="/es/borme-grafo-empresas/">Grafo de empresas BORME</a></li>
          <li><a href="/es/mapa-relaciones-societarias/">Mapa de relaciones societarias</a></li>
          <li><a href="${FACEBOOK_URL}">Mapa Societario en Facebook</a></li>
          <li><a href="/">English version</a></li>
        </ul>
      </main>`,
  },
  {
    path: '/es/informes-due-diligence-empresas',
    title: 'Informe Due Diligence y Revisión de Estructura Societaria | Mapa Societario',
    description:
      'Informe due diligence y revisión de estructura societaria de empresas españolas: administradores, socios, eventos BORME, señales de riesgo e informe societario en PDF profesional.',
    ogType: 'article',
    lang: 'es',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Informe due diligence y revisión de estructura societaria</h1>
        <p>Compra un informe due diligence para una sociedad española cuando necesites documentar una revisión de contraparte, proveedor, cliente, inversión o adquisición. El informe societario reconstruye la estructura de la empresa a partir de datos oficiales del Registro Mercantil (BORME).</p>
        ${disclaimerHtmlEs}
        <h2>Qué incluye el informe</h2>
        <ul>
          <li>Revisión de la estructura societaria: administradores actuales e históricos, socios únicos y participaciones íntegramente poseídas.</li>
          <li>Eventos publicados en BORME, cambios de capital, comprobación de sanciones BOE, cruce con diputados del Congreso y señales de riesgo.</li>
          <li>Informe societario en PDF profesional para compliance, KYC, inversión o revisión interna.</li>
        </ul>
        <h2>Cuándo pedir una revisión de estructura societaria</h2>
        <p>Antes de firmar con una contraparte, incorporar un proveedor, invertir o adquirir una sociedad, una revisión de la estructura societaria muestra quién controla la empresa, qué administradores figuran, cómo ha evolucionado su capital y qué sociedades están vinculadas. Es el contexto que una simple consulta registral no ofrece.</p>
        <p><a href="/app">Buscar una empresa</a> | <a href="/empresas-cotizadas">Ver empresas del IBEX 35</a></p>
      </main>`,
  },
  {
    path: '/es/buscar-administradores-empresas',
    title: 'Buscar Administradores de Empresas en España | Mapa Societario',
    description:
      'Busca administradores, consejeros y cargos mercantiles en empresas españolas. Explora sociedades vinculadas y relaciones publicadas en BORME.',
    ogType: 'article',
    lang: 'es',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Buscar administradores de empresas en España</h1>
        <p>Localiza en qué empresas aparece una persona y explora sus cargos, nombramientos, ceses y sociedades relacionadas a partir de datos publicados en el BORME.</p>
        ${disclaimerHtmlEs}
        <h2>Cómo funciona la búsqueda</h2>
        <p>Cambia el buscador a modo persona y escribe el nombre de un administrador, consejero o apoderado. La herramienta muestra sociedades asociadas, permite expandir la red e identifica con una insignia amarilla a quienes tienen o tuvieron cargo político en el Congreso de los Diputados.</p>
        <p><a href="/app">Buscar administradores</a></p>
      </main>`,
  },
  {
    path: '/es/borme-grafo-empresas',
    title: 'Grafo de Empresas BORME | Relaciones Societarias en España',
    description:
      'Explora un grafo de empresas basado en BORME para descubrir administradores, cargos, sociedades relacionadas y conexiones mercantiles en España.',
    ogType: 'article',
    lang: 'es',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Grafo de empresas basado en BORME</h1>
        <p>Convierte publicaciones del Registro Mercantil en una red visual para explorar empresas, administradores, socios únicos, participaciones íntegramente poseídas y relaciones societarias con más rapidez que una búsqueda documental tradicional.</p>
        ${disclaimerHtmlEs}
        <h2>Del boletín al grafo</h2>
        <p>Las sociedades y personas son nodos, y los cargos, socios únicos, participaciones al 100% o relaciones societarias actúan como enlaces que permiten explorar la red.</p>
        <p><a href="/app">Buscar en el gráfico</a></p>
      </main>`,
  },
  {
    path: '/es/mapa-relaciones-societarias',
    title: 'Mapa de Relaciones Societarias en España | Mapa Societario',
    description:
      'Mapa de relaciones societarias para investigar conexiones entre empresas, administradores y cargos mercantiles en España con datos del BORME.',
    ogType: 'article',
    lang: 'es',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Mapa de relaciones societarias en España</h1>
        <p>Investiga relaciones entre sociedades españolas, cargos mercantiles, socios únicos, participaciones íntegramente poseídas y personas vinculadas para entender estructuras corporativas, grupos y posibles conexiones de riesgo.</p>
        ${disclaimerHtmlEs}
        <h2>Qué revela un mapa societario</h2>
        <p>Ayuda a ver administradores comunes, empresas vinculadas, socios únicos, participaciones al 100%, cambios en órganos de administración, cargos políticos en el Congreso de los Diputados y conexiones relevantes para una revisión de riesgo o investigación corporativa, incluyendo cruces con sanciones BOE cuando se solicita un informe.</p>
        <p><a href="/app">Explorar relaciones societarias</a></p>
      </main>`,
  },
  {
    path: '/connect-claude',
    title: 'Get Spanish Company Data in Claude | Mapa Societario',
    description:
      'Connect Mapa Societario to Claude as a custom MCP connector and query the Spanish company registry (BORME) in plain language: search companies and officers, read profiles, and map corporate relationships. Free, no account.',
    ogType: 'website',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Get Spanish Company Data in Claude</h1>
        <p>Mapa Societario is available as a connector for Claude. Add it once, then ask about Spanish companies, officers and corporate relationships in plain language &mdash; answers come from official BORME (Boletín Oficial del Registro Mercantil) data, each with a link to cite.</p>
        ${disclaimerHtmlEn}
        <h2>Add it in three steps</h2>
        <ol>
          <li>In Claude, open Settings &rarr; Connectors and choose &ldquo;Add custom connector&rdquo;.</li>
          <li>Paste the connector URL <code>https://mcp.mapasocietario.es/mcp</code> and save.</li>
          <li>Ask about a Spanish company &mdash; Claude uses the connector and asks permission the first time.</li>
        </ol>
        <p>No login, no API key, free to use.</p>
        <p><a href="/app">Search a company</a> | <a href="/es/conectar-claude">Versión en español</a></p>
      </main>`,
  },
  {
    path: '/es/conectar-claude',
    title: 'Usa el Registro Mercantil español en Claude | Mapa Societario',
    description:
      'Conecta Mapa Societario a Claude como conector MCP y consulta el registro de empresas español (BORME) en lenguaje natural: busca empresas y administradores, consulta perfiles y mapea relaciones societarias. Gratis, sin cuenta.',
    ogType: 'website',
    lang: 'es',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Consulta datos de empresas españolas dentro de Claude</h1>
        <p>Mapa Societario está disponible como conector para Claude. Añádelo una vez y pregunta sobre empresas, administradores y relaciones societarias en lenguaje natural &mdash; las respuestas proceden de datos oficiales del BORME (Boletín Oficial del Registro Mercantil), cada una con un enlace para citar.</p>
        ${disclaimerHtmlEs}
        <h2>Añádelo en tres pasos</h2>
        <ol>
          <li>En Claude, abre Ajustes &rarr; Conectores y elige &laquo;Añadir conector personalizado&raquo;.</li>
          <li>Pega la URL del conector <code>https://mcp.mapasocietario.es/mcp</code> y guarda.</li>
          <li>Pregunta por una empresa española &mdash; Claude usa el conector y pide permiso la primera vez.</li>
        </ol>
        <p>Sin registro, sin clave de API, uso gratuito.</p>
        <p><a href="/app">Buscar una empresa</a> | <a href="/connect-claude">English version</a></p>
      </main>`,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function replaceMetaTag(html, attr, attrValue, contentValue) {
  // Match <meta property="og:title" ... content="..."> allowing extra attrs and newlines
  const regex = new RegExp(
    `(<meta[\\s\\S]*?${attr}="${attrValue}"[\\s\\S]*?\\bcontent=")([^"]*)(")`,
    'i',
  );
  if (regex.test(html)) {
    return html.replace(regex, `$1${contentValue}$3`);
  }
  return html;
}

function replaceTag(html, tag, content) {
  const regex = new RegExp(`(<${tag}[^>]*>)([\\s\\S]*?)(</${tag}>)`, 'i');
  return html.replace(regex, `$1${content}$3`);
}

function injectHeadLinks(html, links) {
  return html.replace('</head>', `${links}\n  </head>`);
}

function removeNoscriptFallback(html) {
  return html.replace(/\s*<noscript>[\s\S]*?<\/noscript>/i, '');
}

function removeHreflangLinks(html) {
  return html.replace(/\s*<link\b(?=[^>]*\brel="alternate")(?=[^>]*\bhreflang=)[^>]*>/gi, '');
}

// ---------------------------------------------------------------------------
// Generate one HTML file per route
// ---------------------------------------------------------------------------

for (const route of routes) {
  let html = removeHreflangLinks(removeNoscriptFallback(baseHtml));

  const routeCanonicalPath = canonicalPath(route.path);
  const pageUrl = `${siteUrl}${routeCanonicalPath}`;

  // <title>
  html = replaceTag(html, 'title', route.title);

  if (route.lang) {
    html = html.replace(/<html\s+lang="[^"]*"/, `<html lang="${route.lang}"`);
  }

  // <meta name="description">
  html = replaceMetaTag(html, 'name', 'description', route.description);

  // Canonical
  html = html.replace(
    /(<link\s+rel="canonical"[^>]*href=")[^"]*(")/, `$1${pageUrl}$2`,
  );

  // hreflang reciprocity for the true translation pairs.
  if (route.path === '/' || route.path === '/es') {
    html = injectHeadLinks(
      html,
      `    <link rel="alternate" hreflang="en" href="${siteUrl}/" />
    <link rel="alternate" hreflang="es" href="${siteUrl}/es/" />
    <link rel="alternate" hreflang="x-default" href="${siteUrl}/" />`,
    );
  } else if (route.path === '/spanish-company-register-search' || route.path === '/es/busqueda-registro-mercantil') {
    html = injectHeadLinks(
      html,
      `    <link rel="alternate" hreflang="en" href="${siteUrl}/spanish-company-register-search/" />
    <link rel="alternate" hreflang="es" href="${siteUrl}/es/busqueda-registro-mercantil/" />
    <link rel="alternate" hreflang="x-default" href="${siteUrl}/spanish-company-register-search/" />`,
    );
  }

  // Open Graph
  if (route.lang === 'es') {
    html = replaceMetaTag(html, 'property', 'og:locale', 'es_ES');
  }
  html = replaceMetaTag(html, 'property', 'og:title', route.title);
  html = replaceMetaTag(html, 'property', 'og:description', route.description);
  html = replaceMetaTag(html, 'property', 'og:url', pageUrl);
  html = replaceMetaTag(html, 'property', 'og:type', route.ogType);

  // Twitter
  html = replaceMetaTag(html, 'name', 'twitter:title', route.title);
  html = replaceMetaTag(html, 'name', 'twitter:description', route.description);

  // FAQPage schema: the EN (/) and ES (/es) homepages only — the sole routes
  // whose React page renders the matching Q&As visibly (Google FAQ guidelines).
  if (route.path === '/') {
    html = injectHeadLinks(html, homepageFaqSchema);
  } else if (route.path === '/es') {
    html = injectHeadLinks(html, homepageFaqSchemaEs);
  }

  // Product/Offer schema: only on routes that describe/sell the report.
  if (PRODUCT_ROUTES.has(route.path)) {
    html = injectHeadLinks(html, productSchema);
  }

  // Inject static content into <div id="root"> for crawlers
  // React will replace this on hydration
  html = html.replace(
    '<div id="root"></div>',
    `<div id="root">${route.staticContent}</div>`,
  );

  // Write to dist/{route}/index.html
  const outDir = path.join(distDir, route.path);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');

  console.log(`  Prerendered: ${route.path}/index.html`);
}

console.log(`Prerendering complete (${routes.length} routes).`);
