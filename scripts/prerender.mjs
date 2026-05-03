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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');

const siteUrl = (process.env.SITE_URL || 'https://mapasocietario.es').replace(/\/+$/, '');
const disclaimerHtmlEs = `
        <section style="border:1px solid rgba(25,118,210,0.35);background:rgba(25,118,210,0.06);padding:0.9rem 1rem;border-radius:8px;margin:1.5rem 0;color:#a9b8cf">
          <p style="margin:0"><strong>Información no oficial.</strong> Basado en datos de la <a href="https://www.boe.es">Agencia Estatal Boletín Oficial del Estado</a>, reutilizados conforme a sus <a href="https://www.boe.es/informacion/aviso_legal/index.php#reutilizacion">condiciones de reutilización</a>. Mapa Societario transforma, combina y analiza publicaciones del BOE/BORME mediante procesos automatizados; no tiene carácter oficial ni está avalado por la AEBOE. La información se ofrece tal cual y puede contener errores, omisiones o retrasos. Para cualquier decisión relevante, consulta siempre la edición oficial del <a href="https://www.boe.es/diario_borme/">BORME</a> y, cuando proceda, solicita documentación actualizada directamente al Registro Mercantil.</p>
        </section>`;
const disclaimerHtmlEn = `
        <section style="border:1px solid rgba(25,118,210,0.35);background:rgba(25,118,210,0.06);padding:0.9rem 1rem;border-radius:8px;margin:1.5rem 0;color:#a9b8cf">
          <p style="margin:0"><strong>Unofficial information.</strong> Based on data from the <a href="https://www.boe.es">Agencia Estatal Boletín Oficial del Estado</a>, reused under its <a href="https://www.boe.es/informacion/aviso_legal/index.php#reutilizacion">reuse conditions</a>. Mapa Societario transforms, combines, and analyzes BOE/BORME publications through automated processes; it is not official and is not endorsed by the AEBOE. The information is provided as is and may contain errors, omissions, or delays. For any material decision, always verify the official <a href="https://www.boe.es/diario_borme/">BORME</a> edition and, where appropriate, obtain current documents directly from the Registro Mercantil.</p>
        </section>`;

// Read the built index.html as base template
const baseHtml = readFileSync(path.join(distDir, 'index.html'), 'utf8');

// ---------------------------------------------------------------------------
// Route definitions — each entry overrides <head> tags and injects static
// content into <div id="root"> so crawlers see meaningful HTML.
// ---------------------------------------------------------------------------

const routes = [
  {
    path: '/app',
    title: 'Search | Mapa Societario',
    description:
      'Search Spanish companies and officers by name. Explore corporate relationships in an interactive network graph based on official BORME data.',
    ogType: 'website',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Mapa Societario &mdash; Company &amp; Officer Search</h1>
        <p>Search for any Spanish company or officer and explore their corporate relationships in an interactive network graph.</p>
        ${disclaimerHtmlEn}
        <ul>
          <li>Search by company name (e.g. Inditex, Repsol)</li>
          <li>Search by officer name (e.g. Amancio Ortega)</li>
          <li>Visualize corporate connections in real time</li>
          <li>Purchase Due Diligence reports from the search toolbar</li>
        </ul>
        <p><a href="/">Back to Mapa Societario</a></p>
      </main>`,
  },
  {
    path: '/due-diligence',
    title: 'Spanish Company Due Diligence Reports | Mapa Societario',
    description:
      'Spanish company due diligence reports with BORME registry data, officer history, corporate relationship graphs, BOE sanctions checks, risk analysis, and PDF delivery from EUR 22.50.',
    ogType: 'product',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Spanish Company Due Diligence Reports</h1>
        <p>Comprehensive, AI-powered due diligence reports for any Spanish company. From <strong>EUR&nbsp;22.50</strong> per report.</p>
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
      'Spanish company due diligence reports using BORME registry data, corporate relationship graphs, officer history, BOE sanctions checks, sole shareholders, and fully-owned participations.',
    ogType: 'article',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Spanish company due diligence reports</h1>
        <p>Investigate Spanish companies with registry-based corporate relationship mapping, officer history, sole-shareholder and fully-owned participation checks, BOE sanctions checks, and downloadable PDF reports.</p>
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
        <p><a href="/app">Search a Spanish company</a> | <a href="/due-diligence">See report details</a></p>
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
        <h1>Spanish Corporate Activity Dashboard</h1>
        <p>Real-time statistics on company formations, dissolutions, and officer changes across Spain, sourced from BORME (Registro Mercantil).</p>
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
    title: 'Mapa Societario de Empresas Españolas | Mapa Societario',
    description:
      'Busca empresas y administradores en España. Visualiza relaciones societarias basadas en BORME y genera informes due diligence desde EUR 22.50.',
    ogType: 'article',
    lang: 'es',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Mapa societario de empresas españolas</h1>
        <p>Explora empresas, administradores, cargos y conexiones societarias en España con un grafo interactivo basado en publicaciones oficiales del BORME.</p>
        ${disclaimerHtmlEs}
        <h2>Qué puedes investigar</h2>
        <p>Busca una sociedad española y ve sus administradores, cargos, socios únicos y participaciones íntegramente poseídas por otras sociedades. También puedes buscar por persona para descubrir en qué sociedades aparece como administrador, consejero, apoderado u otro cargo mercantil.</p>
        <h2>Por qué es útil</h2>
        <p>El BORME contiene información pública esencial, pero no siempre es cómodo para una investigación rápida. Mapa Societario convierte esas publicaciones en un índice consultable y en un grafo navegable, incorpora comprobación de sanciones publicadas en el BOE para informes due diligence y marca con una insignia amarilla a administradores que tienen o tuvieron cargo político en el Congreso de los Diputados.</p>
        <p><a href="/app">Buscar en el grafo</a> | <a href="/due-diligence">Ver informes due diligence</a></p>
      </main>`,
  },
  {
    path: '/es/informes-due-diligence-empresas',
    title: 'Informes Due Diligence de Empresas Españolas | Mapa Societario',
    description:
      'Informes due diligence para empresas españolas con estructura societaria, historial de administradores, eventos BORME, señales de riesgo y PDF profesional.',
    ogType: 'article',
    lang: 'es',
    staticContent: `
      <main style="font-family:Arial,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6">
        <h1>Informes due diligence de empresas españolas</h1>
        <p>Compra un informe due diligence para una sociedad española cuando necesites documentar una revisión de contraparte, proveedor, cliente, inversión o adquisición.</p>
        ${disclaimerHtmlEs}
        <h2>Qué incluye el informe</h2>
        <ul>
          <li>Estructura societaria, administradores actuales e históricos, socios únicos y participaciones íntegramente poseídas.</li>
          <li>Eventos publicados en BORME, cambios de capital, comprobación de sanciones BOE, cruce con diputados del Congreso y señales de riesgo.</li>
          <li>PDF profesional para compliance, KYC, inversion o revision interna.</li>
        </ul>
        <p><a href="/app">Buscar una empresa</a></p>
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
        <p><a href="/app">Abrir el grafo</a></p>
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

// ---------------------------------------------------------------------------
// Generate one HTML file per route
// ---------------------------------------------------------------------------

for (const route of routes) {
  let html = removeNoscriptFallback(baseHtml);

  const pageUrl = `${siteUrl}${route.path}`;

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

  if (route.lang === 'es') {
    html = injectHeadLinks(
      html,
      `    <link rel="alternate" hreflang="es" href="${pageUrl}" />
    <link rel="alternate" hreflang="en" href="${siteUrl}/" />
    <link rel="alternate" hreflang="x-default" href="${siteUrl}/" />`,
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
