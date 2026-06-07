/**
 * Generates the Barómetro Empresarial static page + CSV from live BORME stats.
 * Run in postbuild (after prerender.mjs), reads dist/index.html as the template.
 * On any fetch failure it exits non-zero so a broken edition is never deployed.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  latestFullYear, intEs, pctChange, buildProvinceRows, buildTypeRows,
  yearlyTotals, toCsv, barChartSvg, trendChartSvg, renderArticleHtml, injectHead,
} from './barometro-lib.mjs';

const API = 'https://api.ncdata.eu';
const SITE = 'https://mapasocietario.es';
const TYPES = ['SL', 'SLP', 'SA', 'SLL', 'SC', 'SAL', 'SAU', 'COOP'];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');

async function getJson(url) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ac.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

const provincesData = (d) => (d && d.data) || [];
const sumFormations = (rows) => rows.reduce((a, r) => a + (r.formations || 0), 0);

async function main() {
  const series = (await getJson(`${API}/bormes/stats/formations`)).data;
  const year = Number(process.env.BAROMETRO_YEAR) || latestFullYear(series);
  const prevYear = year - 1;
  const range = (y) => `from=${y}-01-01&to=${y}-12-31`;

  const curProv = provincesData(await getJson(`${API}/bormes/stats/provinces?${range(year)}`));
  const prevProv = provincesData(await getJson(`${API}/bormes/stats/provinces?${range(prevYear)}`));
  const provinceRows = buildProvinceRows(curProv, prevProv);

  const nationalCur = sumFormations(curProv);
  const nationalPrev = sumFormations(prevProv);

  const typeCounts = (
    await Promise.all(
      TYPES.map(async (t) => {
        const rows = provincesData(await getJson(`${API}/bormes/stats/provinces?${range(year)}&company_type=${t}`));
        const count = sumFormations(rows);
        return count > 0 ? { type: t, count } : null;
      }),
    )
  ).filter(Boolean);
  const typeRows = buildTypeRows(typeCounts, nationalCur);

  const barSvg = barChartSvg(provinceRows.slice(0, 15).map((r) => ({ label: r.province, value: r.cur })));
  const trendSvg = trendChartSvg(yearlyTotals(series, year));

  const data = {
    year, prevYear, nationalCur, nationalPrev,
    nationalPct: pctChange(nationalCur, nationalPrev),
    provinceRows, typeRows, barSvg, trendSvg,
  };

  let html = readFileSync(path.join(distDir, 'index.html'), 'utf8');
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, '');
  html = injectHead(html, {
    title: `Barómetro empresarial ${year}: constituciones de empresas en España | Mapa Societario`,
    description: `Constituciones de empresas en España en ${year} por provincia y forma jurídica (${intEs(nationalCur)} nuevas sociedades), con datos oficiales del BORME.`,
    canonical: `${SITE}/es/barometro-empresarial/`,
  });
  html = html.replace('<div id="root"></div>', `<div id="root">${renderArticleHtml(data)}</div>`);

  const outDir = path.join(distDir, 'es', 'barometro-empresarial');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
  writeFileSync(path.join(distDir, 'es', 'barometro-empresarial.csv'), toCsv(provinceRows, year), 'utf8');

  console.log(`  Barómetro: ${year} edition — ${intEs(nationalCur)} formations, ${provinceRows.length} provinces.`);
}

main().catch((e) => { console.error(`Barómetro generation failed: ${e.message}`); process.exit(1); });
