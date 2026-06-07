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
  provinceSlug, sumYearsByProvince, renderProvinceArticle,
} from './barometro-lib.mjs';

const SITE = 'https://mapasocietario.es';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const dataDir = path.resolve(__dirname, '..', 'data', 'registradores');
const load = (f) => parseCsv(readFileSync(path.join(dataDir, f), 'utf8'));

// Turn the SPA shell (dist/index.html) into a standalone static article page:
// inject head, force Spanish locale + hreflang, drop the SPA scripts/styles, and
// render `body` into #root. Shared by the national page and every province page.
function buildPage(template, { title, description, canonical, hreflang, body }) {
  let html = template.replace(/<noscript>[\s\S]*?<\/noscript>/, '');
  html = injectHead(html, { title, description, canonical });
  html = html.replace(/<html\s+lang="[^"]*"/, '<html lang="es"');
  html = html.replace(/(property="og:locale"[^>]*content=")[^"]*(")/, '$1es_ES$2');
  const links = hreflang.map((h) => `    <link rel="alternate" hreflang="${h.lang}" href="${h.href}" />`).join('\n');
  html = html.replace('</head>', `${links}\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  html = html.replace(/<script[^>]*\btype="module"[^>]*>[\s\S]*?<\/script>/g, '');
  html = html.replace(/<link[^>]*\brel="modulepreload"[^>]*>/g, '');
  html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="\/assets\/[^"]*"[^>]*>/g, '');
  return html;
}

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

  const template = readFileSync(path.join(distDir, 'index.html'), 'utf8');
  const outDir = path.join(distDir, 'es', 'barometro-empresarial');
  mkdirSync(outDir, { recursive: true });

  const nationalHtml = buildPage(template, {
    title: `Barómetro empresarial ${year}: creación neta de empresas en España | Mapa Societario`,
    description: `Creación neta de empresas en España en ${year} por provincia (${intEs(nationalNet)} sociedades netas), con datos oficiales del Colegio de Registradores.`,
    canonical: `${SITE}/es/barometro-empresarial/`,
    hreflang: [
      { lang: 'es', href: `${SITE}/es/barometro-empresarial/` },
      { lang: 'x-default', href: `${SITE}/` },
    ],
    body: renderNetArticle(data),
  });
  writeFileSync(path.join(outDir, 'index.html'), nationalHtml, 'utf8');
  writeFileSync(path.join(distDir, 'es', 'barometro-empresarial.csv'), netCsv(netRows, year), 'utf8');

  // Per-province drill-down pages — one indexable page per province, each with
  // its own trend chart + yearly series. Rank/share are vs the national totals.
  const rankByConst = new Map([...netRows].sort((a, b) => b.const_ - a.const_).map((r, i) => [r.province, i + 1]));
  const seenSlugs = new Map();
  const provinceUrls = [];
  for (const r of netRows) {
    const slug = provinceSlug(r.province);
    if (seenSlugs.has(slug)) {
      console.warn(`  ⚠ province slug collision: "${r.province}" and "${seenSlugs.get(slug)}" both → "${slug}" (skipping the second)`);
      continue;
    }
    seenSlugs.set(slug, r.province);

    const cSeries = sumYearsByProvince(constRows, r.province).filter((p) => p.year <= year);
    const eByYear = Object.fromEntries(sumYearsByProvince(extinRows, r.province).filter((p) => p.year <= year).map((p) => [p.year, p.count]));
    const eSeries = cSeries.map((p) => ({ year: p.year, count: eByYear[p.year] || 0 }));
    const yearRows = cSeries.map((p) => ({ year: p.year, const_: p.count, extin: eByYear[p.year] || 0, net: p.count - (eByYear[p.year] || 0) }));

    const canonical = `${SITE}/es/barometro-empresarial/${slug}/`;
    const page = buildPage(template, {
      title: `Creación de empresas en ${r.province} (${year}) | Barómetro empresarial | Mapa Societario`,
      description: `Constituciones, extinciones y creación neta de empresas en ${r.province} en ${year} (${intEs(r.net)} sociedades netas), con datos oficiales del Colegio de Registradores.`,
      canonical,
      hreflang: [{ lang: 'es', href: canonical }, { lang: 'x-default', href: canonical }],
      body: renderProvinceArticle({
        province: r.province, year, prevYear,
        const_: r.const_, extin: r.extin, net: r.net, pct: r.pct,
        share: nationalConst ? (r.const_ / nationalConst) * 100 : null,
        rank: rankByConst.get(r.province), totalProvinces: netRows.length,
        trendSvg: trendDualSvg(cSeries, eSeries), yearRows, site: SITE,
      }),
    });
    const pDir = path.join(outDir, slug);
    mkdirSync(pDir, { recursive: true });
    writeFileSync(path.join(pDir, 'index.html'), page, 'utf8');
    provinceUrls.push(canonical);
  }

  // Dedicated sitemap for the province pages (referenced by the sitemap index in
  // generate-seo-files.mjs). Written to dist/ in postbuild, after vite copied public/.
  const smUrls = provinceUrls
    .map((u) => `  <url>\n    <loc>${u}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`)
    .join('\n');
  writeFileSync(
    path.join(distDir, 'sitemap-barometro.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${smUrls}\n</urlset>\n`,
    'utf8',
  );

  console.log(`  Barómetro: ${year} net edition — net ${intEs(nationalNet)} (${intEs(nationalConst)} − ${intEs(nationalExtin)}), ${netRows.length} provinces.`);
  console.log(`  Barómetro: ${provinceUrls.length} province pages + sitemap-barometro.xml.`);
}

try { main(); } catch (e) { console.error(`Barómetro generation failed: ${e.message}`); process.exit(1); }
