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
import { registryScale } from '../src/copy/registryScale.js';
import {
  FREE_FIRST_REPORT_COPY,
  FREE_FIRST_REPORT_CODE,
  SAMPLE_REPORT_URL,
} from '../src/copy/freeFirstReport.js';

// Scale figures come from one build-time source; never retype them here.
const en = registryScale('en');
const es = registryScale('es');

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
          "acceptedAnswer": { "@type": "Answer", "text": "Mapa Societario is a relationship intelligence tool for Spanish companies and directors. It maps corporate relationships in an interactive graph built from daily BORME (Boletín Oficial del Registro Mercantil) publications — covering ${en.companies} million companies and ${en.filings} million published records since 2009 — and generates optional due diligence reports from EUR 22.50. Coverage is rebuilt from the official BORME every business day." }
        },
        {
          "@type": "Question",
          "name": "Do I need an account to use this?",
          "acceptedAnswer": { "@type": "Answer", "text": "No. Mapa Societario is completely free to use without any registration or login. Due Diligence reports are an optional paid feature purchased per company from EUR 22.50. Only an email address is required to receive the report. The payment is processed securely through Stripe." }
        },
        {
          "@type": "Question",
          "name": "Can I search by officer name?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. Use the toggle at the top of the search to switch between company and officer search modes. Officer search lets you find a person and see all the companies they are linked to across ${en.officerChanges} million recorded officer changes." }
        },
        {
          "@type": "Question",
          "name": "Is the data accurate and official?",
          "acceptedAnswer": { "@type": "Answer", "text": "The sources are official: the data comes from BORME publications, the authentic electronic edition of the commercial registry gazette since 2009. The service itself is independent — it is not the Registro Mercantil and is not endorsed by any government body. Notices are extracted with automated parsers, so occasional errors are possible; cross-reference the official BORME, and when you need a certified or current document request a nota simple or certificación from the Registro Mercantil." }
        },
        {
          "@type": "Question",
          "name": "How is this different from searching the Registro Mercantil?",
          "acceptedAnswer": { "@type": "Answer", "text": "They answer different questions. The Registro Mercantil is authoritative for a company's current situation and issues certificates and nota simple documents, but it offers no public API and no open historical search: its online search is basic, fuller information requires registration and payment, and historical records must be requested from the relevant provincial registry, paid in advance, one filing per company, by email or in person, and typically delivered in two to five working days. Mapa Societario makes the published BORME history of ${en.companies} million companies searchable for free, with no account and no per-company request. Use it to explore and to understand relationships; use the Registro Mercantil when you need a certified or current document." }
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
          "acceptedAnswer": { "@type": "Answer", "text": "Mapa Societario es una herramienta de inteligencia de relaciones societarias para empresas y administradores españoles. Cartografía las relaciones societarias en un grafo interactivo construido con datos oficiales del BORME (Boletín Oficial del Registro Mercantil) —que abarca ${es.companies} millones de empresas y ${es.filings} millones de publicaciones registrales desde 2009— y genera informes due diligence opcionales desde 22,50 EUR." }
        },
        {
          "@type": "Question",
          "name": "¿Necesito una cuenta para usarlo?",
          "acceptedAnswer": { "@type": "Answer", "text": "No. Mapa Societario es completamente gratuito, sin registro ni inicio de sesión. Los informes due diligence son una función de pago opcional que se compra por empresa desde 22,50 EUR. Solo se necesita una dirección de correo electrónico para recibir el informe. El pago se procesa de forma segura a través de Stripe." }
        },
        {
          "@type": "Question",
          "name": "¿Puedo buscar por nombre de administrador?",
          "acceptedAnswer": { "@type": "Answer", "text": "Sí. Usa el conmutador en la parte superior de la búsqueda para alternar entre búsqueda por empresa y por administrador. La búsqueda por persona te permite encontrar a alguien y ver todas las empresas a las que está vinculado, a partir de ${es.officerChanges} millones de cambios de administradores registrados." }
        },
        {
          "@type": "Question",
          "name": "¿Los datos son precisos y oficiales?",
          "acceptedAnswer": { "@type": "Answer", "text": "Las fuentes son oficiales: los datos proceden de publicaciones del BORME, edición electrónica auténtica del boletín de los Registros Mercantiles desde 2009. El servicio es independiente: no es el Registro Mercantil ni está avalado por ningún organismo público. Los anuncios se extraen mediante analizadores automáticos, por lo que puede haber errores ocasionales; contrasta con el BORME oficial y, cuando necesites un documento certificado o actualizado, solicita una nota simple o certificación al Registro Mercantil." }
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

// The free-first-report offer and the sample PDF exist in the React app but
// never reached the prerendered #root — which is what search crawlers and AI
// answer engines read. Same source of truth as the React surfaces, so the
// wording can never drift between what a crawler sees and what a user sees.
const freeReportHtml = (lang) => {
  const offer = FREE_FIRST_REPORT_COPY[lang] || FREE_FIRST_REPORT_COPY.en;
  const sampleLink = `<p><a href="${SAMPLE_REPORT_URL}">${offer.sample}</a></p>`;
  if (!FREE_FIRST_REPORT_CODE) return sampleLink;
  return `
        <h2>${offer.headline}</h2>
        <p>${offer.body}</p>
        ${sampleLink}`;
};

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
        <p>Search Spanish company and officer histories compiled from daily BORME (Boletín Oficial del Registro Mercantil) publications and see who is connected to whom. Rebuilt every business day, with continuous coverage since 2009.</p>
        ${disclaimerHtmlEn}
        <h2>Built for decisions where relationships matter</h2>
        <p>Start with public-source research, understand the network, and escalate to documented due diligence only when the decision requires it.</p>
        <ul>
          <li><strong>Compliance, legal and procurement:</strong> review management history, related companies, capital events and published changes before onboarding a supplier, client or counterparty.</li>
          <li><strong>Investigators and journalists:</strong> follow people across companies through shared roles, prior appointments and wider corporate networks.</li>
          <li><strong>Advisers, analysts and researchers:</strong> annotate and save an investigation, then generate a sourced report when a client or internal file needs documentation.</li>
        </ul>
        <p><a href="/app/?source=home_search">Search a Spanish company or officer</a> | <a href="/company-director-search/">Search company directors</a> | <a href="/spanish-company-due-diligence/">Document a due diligence review</a> | <a href="/glossary/">Spanish registry glossary</a></p>
        <h2>Data quality you can understand, not a black box</h2>
        <p>Mapa Societario reconciles companies across name changes, mergers, spin-offs and registry transfers; preserves appointments and resignations so historical and current roles are not silently mixed; and updates from official BOE/BORME publications on business days.</p>
        <p>Name matching, automated extraction and incomplete shareholder publication are disclosed so professionals know which findings still require verification against the original notice or current Registro Mercantil documents.</p>
        <h2>Coverage by the numbers</h2>
        <ul>
          <li><strong>${en.companies} million</strong> Spanish companies indexed</li>
          <li><strong>${en.filings} million</strong> BORME publication records</li>
          <li><strong>${en.officerChanges} million</strong> director and officer changes tracked</li>
          <li><strong>${en.constitutions} million</strong> company formations recorded</li>
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
            <tr><td>Sanctions &amp; adverse-media screening</td><td align="center">&mdash;</td><td align="center">Yes</td></tr>
            <tr><td>AI risk analysis &amp; red flags</td><td align="center">&mdash;</td><td align="center">Yes</td></tr>
            <tr><td>Capital-events summary</td><td align="center">&mdash;</td><td align="center">Yes</td></tr>
            <tr><td>Downloadable PDF report</td><td align="center">&mdash;</td><td align="center">Yes</td></tr>
          </tbody>
        </table>
        ${freeReportHtml('en')}
        <h2>Explore</h2>
        <ul>
          <li><a href="/app/">Open the Spanish company relationship graph</a></li>
          <li><a href="/empresas-cotizadas">Empresas cotizadas (IBEX 35)</a> &middot; <a href="/en/listed-companies">IBEX 35 listed companies</a></li>
          <li><a href="/es/">Mapa societario de empresas espa&ntilde;olas</a></li>
          <li><a href="/es/buscar-administradores-empresas/">Buscar administradores de empresas</a></li>
          <li><a href="/es/borme-grafo-empresas/">Grafo de empresas BORME</a></li>
          <li><a href="/spanish-company-register-search/">Search Spanish companies and understand the company register</a></li>
          <li><a href="/company-director-search/">Search Spanish company directors and officers</a></li>
          <li><a href="/spanish-company-due-diligence/">Spanish company due diligence reports</a></li>
          <li><a href="${FACEBOOK_URL}">Mapa Societario on Facebook</a></li>
        </ul>
        <h2>Frequently asked questions</h2>
        <h3>What is Mapa Societario?</h3>
        <p>A relationship intelligence tool for Spanish companies and directors. It maps corporate relationships in an interactive graph built from daily BORME (Boletín Oficial del Registro Mercantil) publications &mdash; ${en.companies} million companies and ${en.filings} million published records since 2009 &mdash; and generates optional due-diligence reports from &euro;22.50. Coverage is rebuilt from the official BORME every business day.</p>
        <h3>Do I need an account?</h3>
        <p>No. Mapa Societario is completely free to use without registration or login. Due Diligence reports are an optional paid feature purchased per company. Only an email address is required to receive the report. The payment is processed securely through Stripe.</p>
        <h3>Can I search by officer name?</h3>
        <p>Yes. Toggle between company and officer search at the top of the search. Officer search finds a person and shows every company they are linked to across ${en.officerChanges} million recorded officer changes.</p>
        <h3>Is the data official?</h3>
        <p>The sources are official: the data comes from BORME publications, the authentic electronic edition of the commercial registry gazette since 2009. The service itself is independent &mdash; not the Registro Mercantil, and not endorsed by any government body. Notices are extracted with automated parsers, so occasional errors are possible; cross-reference the official BORME for critical decisions.</p>
        <h3>How is this different from searching the Registro Mercantil?</h3>
        <p>They answer different questions. The Registro Mercantil is authoritative for a company&rsquo;s current situation and issues certificates and nota simple documents, but it offers no public API and no open historical search: its online search is basic, fuller information requires registration and payment, and historical records must be requested from the relevant provincial registry, paid in advance, one filing per company, by email or in person, and typically delivered in two to five working days. Mapa Societario makes the published BORME history of ${en.companies} million companies searchable for free, with no account and no per-company request. Use it to explore and to understand relationships; use the Registro Mercantil when you need a certified or current document.</p>
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
        <p>Search Spanish company and officer histories compiled from daily BORME publications and understand who is connected to whom. Rebuilt every business day, with continuous coverage since 2009.</p>
        ${disclaimerHtmlEn}
        <ul>
          <li>Search by company name (e.g. Inditex, Repsol)</li>
          <li>Search by officer name (e.g. Amancio Ortega)</li>
          <li>Visualize corporate relationships in real time</li>
          <li>Purchase Due Diligence reports from the search toolbar</li>
        </ul>
        <p><a href="/">Back to Mapa Societario</a> | <a href="/spanish-company-register-search/">Spanish company register and BORME publication guide</a> | <a href="${FACEBOOK_URL}">Facebook</a></p>
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
          <li><strong>Sanctions &amp; Adverse Media Screening</strong> &mdash; Screening against the OFAC SDN and EU consolidated sanctions lists, each dated in the report, plus an adverse-media screen with every finding traced to its source. Officer names are checked against the BOE and against Congreso deputies, flagged for verification.</li>
          <li><strong>Red Flags &amp; Risk Score</strong> &mdash; AI-powered analysis highlighting unusual patterns and compliance risks.</li>
          <li><strong>Capital Events</strong> &mdash; Track capital increases, reductions, mergers, and other corporate actions.</li>
          <li><strong>PDF Report</strong> &mdash; Professional, downloadable PDF for compliance files, investor reviews, or internal records.</li>
        </ul>
        ${freeReportHtml('en')}
        <p><a href="/app/">Search for a company to get started</a> | <a href="/spanish-company-due-diligence/">Spanish company due diligence guide</a></p>
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
        ${freeReportHtml('en')}
        <h2>Why registry context matters</h2>
        <p>Spanish due diligence often requires more than a company lookup. Understanding administrators, appointments, resignations, connected companies, political exposure signals, and changes over time gives better context for counterparty and investment review.</p>
        <h2>API access and higher-touch investigations</h2>
        <p>The self-serve report is the fast mid-tier option. For third-party data integrations, Spanish registry intelligence is available through NC Data API access and data feeds. For higher-stakes matters, Nurnberg Consulting SL can add human analyst work, source retrieval, document review, and bespoke conclusions.</p>
        <p><a href="mailto:mapasocietario@ncdata.eu?subject=NC%20Data%20Spanish%20API">Discuss NC Data API access</a> | <a href="https://nurnbergconsulting.com">Human-led investigations</a></p>
        <p><a href="/app/">Open the relationship graph</a> | <a href="/due-diligence/">See report details</a> | <a href="/spanish-company-register-search/">Spanish company register and BORME publication guide</a></p>
      </main>`,
  },
  {
    path: '/spanish-company-register-search',
    title: 'Spanish Company Search & Register Guide | Mapa Societario',
    description:
      'Search Spanish companies and directors, explore BORME filing history, and learn when to use Spain’s Commercial Registry for official documents.',
    ogType: 'article',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Search Spanish companies and understand the company register</h1>
        <p>Search company and director histories published in BORME, explore their relationships, and understand when you still need an official document from Spain’s Commercial Registry.</p>
        <p><a href="/app/?lang=en&amp;source=register_guide">Open the relationship graph</a></p>
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
        <p>The Registro Mercantil offers no public API and no open historical search: fuller information requires registration and payment, and historical records must be requested from the relevant provincial registry, paid in advance and typically delivered in two to five working days. Mapa Societario is not that registry &mdash; it issues no certificates or authoritative current extracts, and it does not read a company's registry sheet or the Registro Mercantil Central. Use the relevant official registry when you need those documents.</p>
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
        <p><a href="/app/?lang=en&amp;source=register_guide">Open the relationship graph</a> | <a href="/company-director-search/">Search company directors</a> | <a href="/en/listed-companies">Browse IBEX 35 listed companies</a> | <a href="/spanish-company-due-diligence/">Spanish company due diligence reports</a></p>
      </main>`,
  },
  {
    path: '/company-director-search',
    title: 'Spanish Company Director Search | Mapa Societario',
    description:
      'Search Spanish company directors, administrators and officers. Find their companies, appointments, resignations and relationships from BORME records.',
    ogType: 'article',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Search Spanish company directors and officers</h1>
        <p>Find the Spanish companies linked to a director, administrator, board member or proxy, then explore appointments, resignations and shared corporate relationships published in BORME.</p>
        ${disclaimerHtmlEn}
        <p><a href="/app/?lang=en&amp;type=officer&amp;source=director_search">Search a director in the relationship graph</a></p>
        <h2>Search a director across Spanish companies</h2>
        <p>Enter a director, administrator, board member or proxy and choose a person result. Mapa Societario brings together the Spanish companies where that name appears in published BORME records.</p>
        <p>Expand the graph to follow appointments, resignations, shared directors and connected companies instead of reviewing each company separately.</p>
        <h2>What the results can show</h2>
        <p>Results can reveal current and former roles, the companies connected to the same officer, role changes over time and wider corporate networks. Company profiles also surface registered addresses, share capital and recent BORME filing history when available.</p>
        <h2>Important identity limitation</h2>
        <p>BORME publications do not consistently provide a unique personal identifier for every officer. Treat name matches as research leads and verify identity, current authority and material findings against the original notice and current Commercial Registry documents.</p>
        <p><a href="/spanish-company-register-search/">Spanish company search and register guide</a> | <a href="/spanish-company-due-diligence/">Spanish company due diligence reports</a></p>
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
        <p><a href="/app/?lang=es&amp;source=register_guide">Abrir el grafo de relaciones</a></p>
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
        <p><a href="/app/?lang=es&amp;source=register_guide">Abrir el grafo de relaciones</a> | <a href="/empresas-cotizadas">Empresas del IBEX 35</a> | <a href="/due-diligence/?lang=es">Informes due diligence</a></p>
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
        ${freeReportHtml('en')}
        <h2>Volume pricing</h2>
        <p>Law firms, consultancies, and compliance teams running repeat checks can get volume pricing. See the <a href="/pricing/">pricing page</a> to get in touch.</p>
        <p><a href="/app/">Search a company</a> | <a href="/spanish-company-due-diligence/">What is in a report</a></p>
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
        <h2>Para decisiones donde las relaciones importan</h2>
        <p>Empieza con investigación sobre fuentes públicas, entiende la red y pasa a una due diligence documentada solo cuando la decisión lo requiera.</p>
        <ul>
          <li><strong>Compliance, legal y compras:</strong> revisa el historial de administración, empresas relacionadas, eventos de capital y cambios publicados antes de incorporar un proveedor, cliente o contraparte.</li>
          <li><strong>Investigación y periodismo:</strong> sigue a las personas entre empresas mediante cargos compartidos, nombramientos anteriores y redes societarias más amplias.</li>
          <li><strong>Asesoría, análisis e investigación:</strong> anota y guarda una investigación y genera un informe con fuentes cuando un cliente o expediente interno necesite documentación.</li>
        </ul>
        <p><a href="/app/?lang=es&amp;source=home_search">Buscar una empresa o administrador</a> | <a href="/es/buscar-administradores-empresas/">Buscar administradores</a> | <a href="/es/informes-due-diligence-empresas/">Documentar una due diligence</a> | <a href="/es/glosario/">Glosario del Registro Mercantil</a></p>
        <h2>Calidad de datos comprensible, no una caja negra</h2>
        <p>Mapa Societario reconcilia empresas entre cambios de denominación, fusiones, escisiones y traslados registrales; conserva nombramientos y ceses para no mezclar relaciones históricas y actuales; y se actualiza desde publicaciones oficiales BOE/BORME en días laborables.</p>
        <p>La coincidencia por nombre, la extracción automática y la publicación incompleta de accionistas se explican para que el profesional sepa qué hallazgos debe verificar en el anuncio original o con documentación actual del Registro Mercantil.</p>
        <h2>Anota y guarda tu investigación</h2>
        <p>Añade notas privadas a los nodos importantes, filtra el grafo por el texto de las notas y exporta la investigación completa &mdash; incluidas las notas, datos, enlaces, filtros, nodos ocultos y disposición. Impórtala después exactamente como la dejaste, sin volver a consultar los mismos datos.</p>
        ${freeReportHtml('es')}
        <h2>Explorar</h2>
        <ul>
          <li><a href="/app/">Buscar relaciones societarias</a></li>
          <li><a href="/empresas-cotizadas">Empresas cotizadas (IBEX 35)</a></li>
          <li><a href="/due-diligence/">Informes due diligence</a></li>
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
        ${freeReportHtml('es')}
        <p><a href="/app/">Buscar una empresa</a> | <a href="/empresas-cotizadas">Ver empresas del IBEX 35</a></p>
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
        <p><a href="/app/">Buscar administradores</a></p>
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
        <p><a href="/app/">Buscar en el gráfico</a></p>
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
        <p><a href="/app/">Explorar relaciones societarias</a></p>
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
        <p><a href="/app/">Search a company</a> | <a href="/es/conectar-claude/">Versión en español</a></p>
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
        <p><a href="/app/">Buscar una empresa</a> | <a href="/connect-claude/">English version</a></p>
      </main>`,
  },
  {
    path: '/glossary',
    title: 'Spanish Company Registry Glossary | Mapa Societario',
    description:
      'Plain-English definitions of Spanish company registry terms — socio unico, BORME, nota simple, hoja registral, administrador vs apoderado — and what Spanish records do and do not reveal about ownership.',
    ogType: 'article',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Spanish Company Registry Glossary</h1>
        <p>Spanish company records answer some questions precisely and others not at all. This glossary explains the terms that most often mislead people researching a Spanish company from abroad, and is written to correct the specific assumptions that do not transfer from other jurisdictions.</p>
        ${disclaimerHtmlEn}

        <h2>What does "socio unico" mean, and why is it the only ownership Spain publishes?</h2>
        <p>A <strong>socio unico</strong> is a sole shareholder &mdash; the single person or company that owns 100% of a Spanish company. Spain requires this to be declared to the registry, so it is the one ownership fact the public record reliably contains. It is not a general shareholder list.</p>
        <p>This is the single most misread part of Spanish company data. When a company has no socio unico recorded, that means it is not wholly owned by one party &mdash; it does <em>not</em> mean the owner is unknown, and it certainly does not mean the company has no owner. A company with three shareholders simply produces no ownership entry at all.</p>

        <h2>Why can I not find a Spanish company's shareholders or cap table?</h2>
        <p>Because Spain does not maintain one publicly. Unlike the UK's confirmation statement or similar filings elsewhere, there is no public register of a Spanish company's shareholders. Only sole ownership is disclosed, along with share transfers that happen to be inscribed for other reasons.</p>
        <p>If you need the full shareholder position of a Spanish company, the public record will not give it to you at any price. It generally requires the company's own corporate books, a notarial deed, or disclosure from the counterparty.</p>

        <h2>What is the BORME, and how does it differ from the Registro Mercantil?</h2>
        <p>The <strong>Registro Mercantil</strong> is the companies registry itself. The <strong>BORME</strong> (Boletin Oficial del Registro Mercantil) is the official daily bulletin that publishes what the registry has inscribed &mdash; incorporations, director appointments and cessations, capital changes, dissolutions.</p>
        <p>The practical consequence: BORME is a stream of published events, not a live snapshot of a company. Reconstructing a company's current state means reading its filings in order, which is what this site does.</p>

        <h2>What is a nota simple, and when do I need one instead?</h2>
        <p>A <strong>nota simple</strong> is an official informative extract issued by the Registro Mercantil summarising a company's current registry position. It is the document to request when you need something official, dated and attributable &mdash; for a transaction, a court filing or a regulator.</p>
        <p>Derived data, including everything on this site, is useful for research, screening and mapping relationships. It is not a substitute for a nota simple where an official document is required.</p>

        <h2>What is a hoja registral, and why does it matter more than the company name?</h2>
        <p>The <strong>hoja registral</strong> is the registry sheet opened for each company, identified by a province and sheet number. It is the company's durable identity in the registry.</p>
        <p>This matters because company names change and are reused, while the hoja does not. Two companies can share a name across provinces, and a company that renames keeps the same hoja. Tracking a company by name alone will eventually merge two different entities or lose one across a rename &mdash; a common and consequential research error.</p>

        <h2>Where are Spanish annual accounts (Cuentas Anuales)?</h2>
        <p><strong>Cuentas Anuales</strong> are the annual financial statements that Spanish companies deposit with the Registro Mercantil each year. They are deposited separately from the events published in the BORME and are obtained as registry documents, usually for a fee.</p>
        <p>So a company's registry history and its financial statements are two different sources. Directors, capital and structure come from BORME filings; revenue, assets and results do not appear there at all.</p>

        <h2>What is the difference between an administrador and an apoderado?</h2>
        <p>An <strong>administrador</strong> is a director &mdash; part of the body that governs and legally represents the company. An <strong>apoderado</strong> holds a power of attorney granting specific authority to act, often narrow and often operational.</p>
        <p>Confusing the two badly distorts a due-diligence picture. Large Spanish companies routinely have hundreds of apoderados, including branch and regional staff. Treating them as directors turns a five-person board into a list of hundreds and buries the people who actually control the company.</p>

        <h2>What does "cargo vigente" or "cesado" mean, and can a director look active when they are not?</h2>
        <p><strong>Vigente</strong> means a position is currently held; <strong>cesado</strong> means it has ended. Both derive from published appointment and cessation events.</p>
        <p>The trap is that a cessation only appears if someone inscribed it. Departures are not always filed, and a dissolved company frequently has no cessation entries at all &mdash; so directors can appear indefinitely active in the raw record. Treat a long-unchanged appointment at a dormant or dissolved company as unconfirmed rather than current.</p>

        <h2>What is a NIF, and is it the same as a CIF?</h2>
        <p>The <strong>NIF</strong> (Numero de Identificacion Fiscal) is the tax identification number of a Spanish company. <strong>CIF</strong> is the former name for the company equivalent and was superseded, though the term is still used informally and appears on older documents. In practice people asking for a CIF want the NIF.</p>
        <p>The NIF is a tax identifier rather than a registry one, so it is not part of what the BORME publishes. Where a NIF is shown here it comes from other sources and is labelled accordingly.</p>

        <h2>What is the minimum share capital of a Spanish SL?</h2>
        <p>Since the Ley 18/2022 reform, a <strong>sociedad de responsabilidad limitada</strong> (SL) can be incorporated with share capital as low as one euro, subject to reserve requirements until it reaches the previous threshold. Older sources widely cite around 3,000 euros, which was the long-standing minimum before the change.</p>
        <p>Consequently a very low stated capital in a recently incorporated company is not by itself a warning sign, and comparisons against the older figure will misread companies formed after the reform.</p>

        <h2>Disolucion and extincion &mdash; is a dissolved company gone?</h2>
        <p>Not necessarily. <strong>Disolucion</strong> opens the process of winding a company up; the company continues to exist in liquidation. <strong>Extincion</strong> is the final cancellation of its registry sheet, after which the entity is gone.</p>
        <p>A company can remain dissolved but not extinguished for years. It still exists, may still hold assets and obligations, and should not be read as struck off.</p>

        <p><a href="/app/">Search a Spanish company</a> | <a href="/faq">Data coverage and sources</a> | <a href="/es/glosario/">Version en espanol</a></p>
      </main>
      <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"DefinedTermSet","name":"Spanish Company Registry Glossary","url":"https://mapasocietario.es/glossary/","inDefinedTermSet":"https://mapasocietario.es/glossary/","hasDefinedTerm":[{"@type":"DefinedTerm","name":"Socio unico","description":"A sole shareholder owning 100% of a Spanish company. The only ownership fact the Spanish public registry reliably records; its absence does not imply unknown ownership."},{"@type":"DefinedTerm","name":"BORME","description":"Boletin Oficial del Registro Mercantil, the official daily bulletin publishing events inscribed by the Spanish companies registry."},{"@type":"DefinedTerm","name":"Nota simple","description":"An official informative extract issued by the Registro Mercantil summarising a company's current registry position."},{"@type":"DefinedTerm","name":"Hoja registral","description":"The registry sheet identifying a Spanish company by province and number; its durable identity across name changes."},{"@type":"DefinedTerm","name":"Cuentas Anuales","description":"Annual financial statements deposited with the Registro Mercantil, separate from BORME event publications."},{"@type":"DefinedTerm","name":"Administrador","description":"A director forming part of the governing body that legally represents a Spanish company."},{"@type":"DefinedTerm","name":"Apoderado","description":"A holder of a power of attorney with specific authority to act for a company; not a director."},{"@type":"DefinedTerm","name":"NIF","description":"Numero de Identificacion Fiscal, the tax identification number of a Spanish company; formerly called CIF for entities."},{"@type":"DefinedTerm","name":"Disolucion","description":"The opening of a winding-up process; the company continues to exist in liquidation until extincion."},{"@type":"DefinedTerm","name":"Extincion","description":"Final cancellation of a company's registry sheet, after which the entity no longer exists."}]}
      </script>`,
  },
  {
    path: '/es/glosario',
    title: 'Glosario del Registro Mercantil | Mapa Societario',
    description:
      'Definiciones claras de los terminos del registro mercantil espanol: socio unico, BORME, nota simple, hoja registral, administrador y apoderado, y que revelan realmente los registros espanoles sobre la propiedad.',
    ogType: 'article',
    lang: 'es',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Glosario del Registro Mercantil</h1>
        <p>Los registros mercantiles espanoles responden con precision a unas preguntas y a otras no responden en absoluto. Este glosario explica los terminos que mas confusion generan al investigar una sociedad espanola y corrige los supuestos que no se trasladan bien desde otras jurisdicciones.</p>
        ${disclaimerHtmlEs}

        <h2>Que significa socio unico y por que es la unica propiedad que se publica?</h2>
        <p>El <strong>socio unico</strong> es la persona fisica o juridica que posee el 100% de una sociedad. La ley obliga a declararlo al registro, por lo que es el unico dato de propiedad que el registro publico recoge de forma fiable. No es una lista de socios.</p>
        <p>Es la parte peor interpretada de los datos societarios espanoles. Que no conste socio unico significa que la sociedad no pertenece integramente a una sola parte; <em>no</em> significa que se desconozca quien es el propietario ni que no lo tenga. Una sociedad con tres socios simplemente no genera ninguna anotacion de propiedad.</p>

        <h2>Por que no aparecen los socios ni el reparto del capital?</h2>
        <p>Porque en Espana no existe un registro publico de socios. A diferencia de otros paises, solo se publica la propiedad integra y aquellas transmisiones que se inscriben por otros motivos.</p>
        <p>Si necesita conocer el accionariado completo, el registro publico no se lo va a facilitar. Normalmente hace falta el libro registro de socios de la propia sociedad, una escritura notarial o que la contraparte lo aporte.</p>

        <h2>Que es el BORME y en que se diferencia del Registro Mercantil?</h2>
        <p>El <strong>Registro Mercantil</strong> es el registro en si. El <strong>BORME</strong> (Boletin Oficial del Registro Mercantil) es el boletin diario que publica lo que el registro ha inscrito: constituciones, nombramientos y ceses, cambios de capital, disoluciones.</p>
        <p>La consecuencia practica es que el BORME es un flujo de hechos publicados, no una fotografia actual de la sociedad. Reconstruir su situacion exige leer los asientos en orden, que es justamente lo que hace esta web.</p>

        <h2>Que es una nota simple y cuando la necesito?</h2>
        <p>La <strong>nota simple</strong> es un extracto informativo oficial del Registro Mercantil que resume la situacion registral vigente de una sociedad. Es el documento a solicitar cuando se necesita algo oficial, fechado y atribuible: una operacion, un procedimiento judicial o un regulador.</p>
        <p>Los datos derivados, incluidos los de esta web, sirven para investigar, cribar y mapear relaciones. No sustituyen a una nota simple cuando se exige un documento oficial.</p>

        <h2>Que es la hoja registral y por que importa mas que el nombre?</h2>
        <p>La <strong>hoja registral</strong> es la hoja que el registro abre a cada sociedad, identificada por provincia y numero. Es su identidad duradera.</p>
        <p>Importa porque los nombres cambian y se reutilizan, y la hoja no. Dos sociedades pueden compartir denominacion en provincias distintas, y una sociedad que cambia de nombre conserva su hoja. Seguir a una sociedad solo por el nombre acaba fusionando entidades distintas o perdiendo el rastro tras un cambio de denominacion.</p>

        <h2>Donde estan las cuentas anuales?</h2>
        <p>Las <strong>cuentas anuales</strong> se depositan cada ejercicio en el Registro Mercantil, de forma independiente a los actos que publica el BORME, y se obtienen como documentos registrales, normalmente de pago.</p>
        <p>Por tanto el historial registral y los estados financieros son dos fuentes distintas. Administradores, capital y estructura proceden del BORME; ingresos, activos y resultados no aparecen alli.</p>

        <h2>Que diferencia hay entre un administrador y un apoderado?</h2>
        <p>El <strong>administrador</strong> forma parte del organo que gobierna y representa legalmente a la sociedad. El <strong>apoderado</strong> tiene un poder que le otorga facultades concretas para actuar, a menudo limitadas y operativas.</p>
        <p>Confundirlos distorsiona gravemente cualquier analisis. Las sociedades grandes acumulan cientos de apoderados, incluido personal de sucursal. Tratarlos como administradores convierte un consejo de cinco personas en un listado de cientos y oculta a quienes de verdad controlan la sociedad.</p>

        <h2>Que significa cargo vigente o cesado, y puede un administrador figurar activo sin serlo?</h2>
        <p><strong>Vigente</strong> indica que el cargo esta en vigor; <strong>cesado</strong>, que ha terminado. Ambos se derivan de los nombramientos y ceses publicados.</p>
        <p>El problema es que un cese solo consta si alguien lo inscribe. No siempre se inscriben, y una sociedad disuelta a menudo no tiene ningun cese anotado, de modo que sus administradores pueden figurar activos indefinidamente. Ante una sociedad inactiva o disuelta, conviene tratar el cargo como no confirmado y no como vigente.</p>

        <h2>Que es el NIF y es lo mismo que el CIF?</h2>
        <p>El <strong>NIF</strong> (Numero de Identificacion Fiscal) identifica fiscalmente a la sociedad. El <strong>CIF</strong> fue la denominacion anterior para las personas juridicas y quedo sustituida, aunque el termino sigue usandose de forma coloquial y aparece en documentos antiguos. Quien pide un CIF pide en realidad el NIF.</p>
        <p>Al ser un identificador fiscal y no registral, no forma parte de lo que publica el BORME. Cuando aqui se muestra un NIF procede de otras fuentes y se indica como tal.</p>

        <h2>Cual es el capital social minimo de una SL?</h2>
        <p>Desde la reforma de la Ley 18/2022, una <strong>sociedad de responsabilidad limitada</strong> puede constituirse con un capital social de tan solo un euro, con obligaciones de reserva hasta alcanzar el umbral anterior. Muchas fuentes siguen citando unos 3.000 euros, que era el minimo historico antes del cambio.</p>
        <p>Por tanto, un capital muy bajo en una sociedad de constitucion reciente no es por si mismo una senal de alarma, y comparar con la cifra antigua lleva a interpretar mal a las sociedades constituidas tras la reforma.</p>

        <h2>Disolucion y extincion: una sociedad disuelta ha desaparecido?</h2>
        <p>No necesariamente. La <strong>disolucion</strong> abre el proceso de liquidacion y la sociedad sigue existiendo. La <strong>extincion</strong> es la cancelacion definitiva de su hoja registral, tras la cual la entidad deja de existir.</p>
        <p>Una sociedad puede permanecer disuelta y no extinguida durante anos. Sigue existiendo, puede mantener activos y obligaciones, y no debe interpretarse como dada de baja.</p>

        <p><a href="/app/">Buscar una empresa</a> | <a href="/faq-es">Cobertura y fuentes</a> | <a href="/glossary/">English version</a></p>
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

const HREFLANG_PAIRS = [
  ['/', '/es'],
  ['/spanish-company-register-search', '/es/busqueda-registro-mercantil'],
  ['/connect-claude', '/es/conectar-claude'],
  ['/glossary', '/es/glosario'],
  ['/due-diligence', '/es/informes-due-diligence-empresas'],
  ['/company-director-search', '/es/buscar-administradores-empresas'],
];

function hreflangLinksFor(routePath) {
  const pair = HREFLANG_PAIRS.find(([en, es]) => routePath === en || routePath === es);
  if (!pair) return '';
  const [en, es] = pair.map(canonicalPath);
  return `    <link rel="alternate" hreflang="en" href="${siteUrl}${en}" />
    <link rel="alternate" hreflang="es" href="${siteUrl}${es}" />
    <link rel="alternate" hreflang="x-default" href="${siteUrl}${en}" />`;
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

  // Reciprocal hreflang for every true English/Spanish translation pair.
  const hreflangLinks = hreflangLinksFor(route.path);
  if (hreflangLinks) html = injectHeadLinks(html, hreflangLinks);

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
