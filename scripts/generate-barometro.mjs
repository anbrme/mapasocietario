/**
 * Generates the Barómetro Empresarial (net creation) from the committed official
 * Colegio de Registradores CSVs. No network, no xlsx. Run in postbuild (before
 * prerender.mjs), reads dist/index.html as the template; strips the SPA + dark CSS
 * so the standalone static page renders.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCsv, latestFullYearFromRows, sumByProvince, sumByForm, sumYears, sumCapital,
  buildNetRows, buildTypeRows, intEs, pctChange, barChartSvg, trendDualSvg,
  renderNetArticle, netCsv, injectHead,
} from './barometro-lib.mjs';

const SITE = 'https://mapasocietario.es';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const dataDir = path.resolve(__dirname, '..', 'data', 'registradores');
const load = (f) => parseCsv(readFileSync(path.join(dataDir, f), 'utf8'));

// Temporary unpublish (default). Until the Colegio de Registradores data-reuse
// licence is confirmed, the barómetro must not redistribute the official figures:
// it serves a noindex placeholder and no CSV. Re-enable by setting the build env
// var BAROMETRO_PUBLISHED=1 — no code change needed. generate-seo-files.mjs reads
// the same flag to keep the route out of the sitemap while unpublished.
const PUBLISHED = process.env.BAROMETRO_PUBLISHED === '1' || process.env.BAROMETRO_PUBLISHED === 'true';

function writePlaceholder() {
  let html = readFileSync(path.join(distDir, 'index.html'), 'utf8');
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, '');
  html = injectHead(html, {
    title: 'Barómetro empresarial | Mapa Societario',
    description: 'El barómetro empresarial está temporalmente no disponible.',
    canonical: `${SITE}/es/barometro-empresarial/`,
  });
  html = html.replace(/<html\s+lang="[^"]*"/, '<html lang="es"');
  html = html.replace('</head>', '    <meta name="robots" content="noindex,follow" />\n  </head>');
  const body = `
    <style>body{background:#fff;color:#0f172a;margin:0}main{font-family:Arial,Helvetica,sans-serif}h1{font-size:1.6rem;margin:.4rem 0 1rem}a{color:#2563eb}</style>
    <main style="max-width:680px;margin:4rem auto;padding:0 1rem;line-height:1.6">
      <p style="margin:0 0 1.2rem"><a href="/" style="text-decoration:none;font-weight:700">Mapa Societario</a></p>
      <h1>Barómetro empresarial</h1>
      <p>Esta sección está temporalmente no disponible mientras revisamos nuestras fuentes de datos. Vuelve pronto.</p>
      <p><a href="/app">Buscar una empresa</a> · <a href="/empresas-cotizadas">Empresas cotizadas (IBEX 35)</a></p>
    </main>`;
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  html = html.replace(/<script[^>]*\btype="module"[^>]*>[\s\S]*?<\/script>/g, '');
  html = html.replace(/<link[^>]*\brel="modulepreload"[^>]*>/g, '');
  html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="\/assets\/[^"]*"[^>]*>/g, '');
  const outDir = path.join(distDir, 'es', 'barometro-empresarial');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
  console.log('  Barómetro: UNPUBLISHED — noindex placeholder, no data, no CSV (set BAROMETRO_PUBLISHED=1 to restore).');
}

function main() {
  if (!PUBLISHED) { writePlaceholder(); return; }
  const constRows = load('const.csv');
  const extinRows = load('extin.csv');
  const year = Number(process.env.BAROMETRO_YEAR) || latestFullYearFromRows(constRows);
  const prevYear = year - 1;

  const netRows = buildNetRows(
    sumByProvince(constRows, year), sumByProvince(extinRows, year),
    sumByProvince(constRows, prevYear), sumByProvince(extinRows, prevYear),
  );
  const nationalConst = Object.values(sumByProvince(constRows, year)).reduce((a, b) => a + b, 0);
  const nationalExtin = Object.values(sumByProvince(extinRows, year)).reduce((a, b) => a + b, 0);
  const nationalNet = nationalConst - nationalExtin;
  const nationalNetPrev = netRows.reduce((a, r) => a + r.netPrev, 0);

  const formMap = sumByForm(constRows, year);
  const typeRows = buildTypeRows(Object.entries(formMap).map(([type, count]) => ({ type, count })), nationalConst);

  const constYears = sumYears(constRows).filter((p) => p.year <= year);
  const extinYears = sumYears(extinRows).filter((p) => p.year <= year);

  const data = {
    year, prevYear, nationalConst, nationalExtin, nationalNet, nationalNetPrev,
    netPct: pctChange(nationalNet, nationalNetPrev),
    capital: sumCapital(constRows, year),
    netRows, typeRows,
    barSvg: barChartSvg(netRows.slice(0, 15).map((r) => ({ label: r.province, value: r.net }))),
    trendSvg: trendDualSvg(constYears, extinYears),
  };

  let html = readFileSync(path.join(distDir, 'index.html'), 'utf8');
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, '');
  html = injectHead(html, {
    title: `Barómetro empresarial ${year}: creación neta de empresas en España | Mapa Societario`,
    description: `Creación neta de empresas en España en ${year} por provincia (${intEs(nationalNet)} sociedades netas), con datos oficiales del Colegio de Registradores.`,
    canonical: `${SITE}/es/barometro-empresarial/`,
  });
  html = html.replace(/<html\s+lang="[^"]*"/, '<html lang="es"');
  html = html.replace(/(property="og:locale"[^>]*content=")[^"]*(")/, '$1es_ES$2');
  html = html.replace('</head>',
    `    <link rel="alternate" hreflang="es" href="${SITE}/es/barometro-empresarial/" />\n    <link rel="alternate" hreflang="x-default" href="${SITE}/" />\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${renderNetArticle(data)}</div>`);
  html = html.replace(/<script[^>]*\btype="module"[^>]*>[\s\S]*?<\/script>/g, '');
  html = html.replace(/<link[^>]*\brel="modulepreload"[^>]*>/g, '');
  html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="\/assets\/[^"]*"[^>]*>/g, '');

  const outDir = path.join(distDir, 'es', 'barometro-empresarial');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
  writeFileSync(path.join(distDir, 'es', 'barometro-empresarial.csv'), netCsv(netRows, year), 'utf8');

  console.log(`  Barómetro: ${year} net edition — net ${intEs(nationalNet)} (${intEs(nationalConst)} − ${intEs(nationalExtin)}), ${netRows.length} provinces.`);
}

try { main(); } catch (e) { console.error(`Barómetro generation failed: ${e.message}`); process.exit(1); }
