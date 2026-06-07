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

function main() {
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
