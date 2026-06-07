# Barómetro Empresarial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a build-time generator that produces the static Spanish data story `/es/barometro-empresarial` (gross company formations by province + legal type, latest full year vs prior) with crawlable tables, inline-SVG charts, and a CSV download — re-runnable each year on a stable URL.

**Architecture:** A pure, unit-tested logic module (`scripts/barometro-lib.mjs`) does all computation and HTML/SVG/CSV rendering with no network or filesystem access. A thin orchestrator (`scripts/generate-barometro.mjs`) fetches the `api.ncdata.eu` stats at build time, calls the lib, injects the article into the built `dist/index.html` template (same pattern as `prerender.mjs`), and writes `dist/es/barometro-empresarial/index.html` + `dist/es/barometro-empresarial.csv`. Runs in `postbuild` after `prerender.mjs`. Internal links + sitemap tie it into the crawl graph.

**Tech Stack:** Node ESM, `node:test`/`node:assert` (no test runner), global `fetch`, hand-rolled inline SVG. Spec: `docs/superpowers/specs/2026-06-07-barometro-empresarial-design.md`.

---

### Task 1: Lib — date & number helpers

**Files:**
- Create: `scripts/barometro-lib.mjs`
- Test: `test/barometro.test.mjs`

- [ ] **Step 1: Write the failing test**

`test/barometro.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestFullYear, pctChange, intEs, pctEs } from '../scripts/barometro-lib.mjs';

test('latestFullYear returns the most recent year with 12 months', () => {
  const series = [];
  for (let m = 1; m <= 12; m++) series.push({ date: `2024-${String(m).padStart(2, '0')}-01`, count: 1 });
  for (let m = 1; m <= 12; m++) series.push({ date: `2025-${String(m).padStart(2, '0')}-01`, count: 1 });
  for (let m = 1; m <= 6; m++) series.push({ date: `2026-${String(m).padStart(2, '0')}-01`, count: 1 });
  assert.equal(latestFullYear(series), 2025);
});

test('pctChange handles normal and zero-prev', () => {
  assert.equal(Math.round(pctChange(110, 100)), 10);
  assert.equal(pctChange(5, 0), null);
});

test('intEs formats with es-ES thousands separators', () => {
  assert.equal(intEs(38459), '38.459');
});

test('pctEs shows sign and one decimal, em-dash for null', () => {
  assert.equal(pctEs(12.34), '+12,3 %');
  assert.equal(pctEs(-1), '-1,0 %');
  assert.equal(pctEs(null), '—');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/barometro.test.mjs`
Expected: FAIL — `scripts/barometro-lib.mjs` not found.

- [ ] **Step 3: Implement the helpers**

`scripts/barometro-lib.mjs`:
```js
// Pure logic + rendering for the Barómetro Empresarial data story. No network, no fs.

export function latestFullYear(series) {
  const byYear = {};
  for (const { date } of series) {
    const y = Number(String(date).slice(0, 4));
    byYear[y] = (byYear[y] || 0) + 1;
  }
  const full = Object.keys(byYear).map(Number).filter((y) => byYear[y] >= 12);
  if (!full.length) throw new Error('latestFullYear: no complete year in series');
  return Math.max(...full);
}

export function pctChange(cur, prev) {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

export function intEs(n) {
  return Number(n).toLocaleString('es-ES');
}

export function pctEs(p) {
  if (p == null) return '—';
  const sign = p >= 0 ? '+' : '';
  return `${sign}${p.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/barometro.test.mjs`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/barometro-lib.mjs test/barometro.test.mjs
git commit -m "feat(barometro): date/number/format helpers"
```

---

### Task 2: Lib — data shaping (province rows, type rows, yearly totals, CSV)

**Files:**
- Modify: `scripts/barometro-lib.mjs`
- Test: `test/barometro.test.mjs`

- [ ] **Step 1: Write the failing test** (append to `test/barometro.test.mjs`)

```js
import { buildProvinceRows, buildTypeRows, yearlyTotals, toCsv } from '../scripts/barometro-lib.mjs';

test('buildProvinceRows joins prev year and sorts desc by current', () => {
  const cur = [{ province: 'Madrid', formations: 100 }, { province: 'Soria', formations: 10 }];
  const prev = [{ province: 'Madrid', formations: 80 }];
  const rows = buildProvinceRows(cur, prev);
  assert.equal(rows[0].province, 'Madrid');
  assert.equal(rows[0].cur, 100);
  assert.equal(rows[0].prev, 80);
  assert.equal(Math.round(rows[0].pct), 25);
  assert.equal(rows[1].province, 'Soria');
  assert.equal(rows[1].prev, 0);
  assert.equal(rows[1].pct, null);
});

test('buildTypeRows adds Otras remainder and share, sorted desc', () => {
  const rows = buildTypeRows([{ type: 'SL', count: 96 }, { type: 'SA', count: 2 }], 100);
  assert.equal(rows[0].type, 'SL');
  assert.equal(Math.round(rows[0].share), 96);
  assert.equal(rows.at(-1).type, 'Otras');
  assert.equal(rows.at(-1).count, 2);
});

test('yearlyTotals sums monthly counts per year up to maxYear', () => {
  const s = [
    { date: '2024-01-01', count: 5 }, { date: '2024-02-01', count: 5 },
    { date: '2025-01-01', count: 3 }, { date: '2026-01-01', count: 9 },
  ];
  assert.deepEqual(yearlyTotals(s, 2025), [{ year: 2024, count: 10 }, { year: 2025, count: 3 }]);
});

test('toCsv escapes, includes header with years', () => {
  const csv = toCsv([{ province: 'A,B', cur: 10, prev: 8, pct: 25 }], 2025);
  assert.match(csv, /provincia,formaciones_2025,formaciones_2024,variacion_pct/);
  assert.match(csv, /"A,B",10,8,25\.0/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/barometro.test.mjs`
Expected: FAIL — `buildProvinceRows` etc. not exported.

- [ ] **Step 3: Implement** (append to `scripts/barometro-lib.mjs`)

```js
export function buildProvinceRows(curData, prevData) {
  const prev = Object.fromEntries(prevData.map((r) => [r.province, r.formations]));
  return curData
    .map((r) => ({ province: r.province, cur: r.formations, prev: prev[r.province] || 0 }))
    .map((r) => ({ ...r, pct: pctChange(r.cur, r.prev) }))
    .sort((a, b) => b.cur - a.cur);
}

export function buildTypeRows(typeCounts, total) {
  const sum = typeCounts.reduce((a, t) => a + t.count, 0);
  const rows = typeCounts.slice();
  const otras = total - sum;
  if (otras > 0) rows.push({ type: 'Otras', count: otras });
  return rows
    .map((t) => ({ ...t, share: total ? (t.count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);
}

export function yearlyTotals(series, maxYear) {
  const byYear = {};
  for (const { date, count } of series) {
    const y = Number(String(date).slice(0, 4));
    if (y <= maxYear) byYear[y] = (byYear[y] || 0) + count;
  }
  return Object.keys(byYear).map(Number).sort((a, b) => a - b).map((y) => ({ year: y, count: byYear[y] }));
}

function csvCell(s) {
  const str = String(s);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(rows, year) {
  const head = `provincia,formaciones_${year},formaciones_${year - 1},variacion_pct`;
  const body = rows
    .map((r) => `${csvCell(r.province)},${r.cur},${r.prev},${r.pct == null ? '' : r.pct.toFixed(1)}`)
    .join('\n');
  return `${head}\n${body}\n`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/barometro.test.mjs`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/barometro-lib.mjs test/barometro.test.mjs
git commit -m "feat(barometro): province/type/yearly data shaping + CSV"
```

---

### Task 3: Lib — inline SVG charts

**Files:**
- Modify: `scripts/barometro-lib.mjs`
- Test: `test/barometro.test.mjs`

- [ ] **Step 1: Write the failing test** (append)

```js
import { barChartSvg, trendChartSvg } from '../scripts/barometro-lib.mjs';

test('barChartSvg renders one <rect> per item and is valid svg', () => {
  const svg = barChartSvg([{ label: 'Madrid', value: 100 }, { label: 'Soria', value: 10 }]);
  assert.match(svg, /^<svg /);
  assert.match(svg, /<\/svg>$/);
  assert.equal((svg.match(/<rect /g) || []).length, 2);
  assert.match(svg, /Madrid/);
});

test('trendChartSvg renders a polyline with one point per year', () => {
  const svg = trendChartSvg([{ year: 2023, count: 5 }, { year: 2024, count: 8 }, { year: 2025, count: 6 }]);
  assert.match(svg, /<polyline /);
  const pts = svg.match(/points="([^"]+)"/)[1].trim().split(/\s+/);
  assert.equal(pts.length, 3);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/barometro.test.mjs`
Expected: FAIL — chart functions not exported.

- [ ] **Step 3: Implement** (append)

```js
export function barChartSvg(items, { w = 680, barH = 22, gap = 8, pad = 8, labelW = 130 } = {}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const valW = 70;
  const chartW = w - labelW - valW - pad;
  const h = pad * 2 + items.length * (barH + gap) - gap;
  const bars = items
    .map((it, i) => {
      const y = pad + i * (barH + gap);
      const bw = Math.max(1, Math.round((it.value / max) * chartW));
      return (
        `<text x="0" y="${y + barH * 0.7}" font-size="12">${esc(it.label)}</text>` +
        `<rect x="${labelW}" y="${y}" width="${bw}" height="${barH}" fill="#2563eb" rx="3"></rect>` +
        `<text x="${labelW + bw + 6}" y="${y + barH * 0.7}" font-size="12">${esc(intEs(it.value))}</text>`
      );
    })
    .join('');
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" width="100%" font-family="Arial,sans-serif" fill="#0f172a">${bars}</svg>`;
}

export function trendChartSvg(yearly, { w = 680, h = 220, pad = 30 } = {}) {
  const max = Math.max(...yearly.map((p) => p.count), 1);
  const n = Math.max(1, yearly.length - 1);
  const x = (i) => pad + (i / n) * (w - pad * 2);
  const y = (v) => h - pad - (v / max) * (h - pad * 2);
  const pts = yearly.map((p, i) => `${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join(' ');
  const labels = yearly
    .map((p, i) => (i % 2 === 0 || i === yearly.length - 1
      ? `<text x="${x(i).toFixed(1)}" y="${h - 8}" font-size="10" text-anchor="middle">${p.year}</text>`
      : ''))
    .join('');
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" width="100%" font-family="Arial,sans-serif" fill="#64748b"><polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="2"></polyline>${labels}</svg>`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/barometro.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/barometro-lib.mjs test/barometro.test.mjs
git commit -m "feat(barometro): inline SVG bar + trend charts"
```

---

### Task 4: Lib — article HTML + head injection

**Files:**
- Modify: `scripts/barometro-lib.mjs`
- Test: `test/barometro.test.mjs`

- [ ] **Step 1: Write the failing test** (append)

```js
import { renderArticleHtml, injectHead } from '../scripts/barometro-lib.mjs';

const DATA = {
  year: 2025, prevYear: 2024,
  nationalCur: 155399, nationalPrev: 150000, nationalPct: 3.6,
  provinceRows: [
    { province: 'Barcelona', cur: 38459, prev: 30229, pct: 27.2 },
    { province: 'Madrid', cur: 30287, prev: 29900, pct: 1.3 },
  ],
  typeRows: [{ type: 'SL', count: 150337, share: 96.7 }, { type: 'Otras', count: 5062, share: 3.3 }],
  barSvg: '<svg id="bar"></svg>', trendSvg: '<svg id="trend"></svg>',
};

test('renderArticleHtml includes a row per province and the charts', () => {
  const html = renderArticleHtml(DATA);
  assert.match(html, /Barcelona/);
  assert.match(html, /Madrid/);
  assert.match(html, /38\.459/);            // intEs formatting
  assert.match(html, /id="bar"/);
  assert.match(html, /id="trend"/);
  assert.match(html, /barometro-empresarial\.csv/); // CSV link
  assert.match(html, /href="\/app"/);       // internal link out
});

test('injectHead sets title, description and canonical', () => {
  const tpl = '<title>x</title><meta name="description" content="y"><link rel="canonical" id="canonical-link" href="z" />';
  const out = injectHead(tpl, { title: 'T', description: 'D', canonical: 'https://mapasocietario.es/es/barometro-empresarial' });
  assert.match(out, /<title>T<\/title>/);
  assert.match(out, /content="D"/);
  assert.match(out, /href="https:\/\/mapasocietario\.es\/es\/barometro-empresarial"/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/barometro.test.mjs`
Expected: FAIL — `renderArticleHtml`/`injectHead` not exported.

- [ ] **Step 3: Implement** (append). The article is Spanish; tables carry the citeable numbers; charts are the visual layer; methodology includes the honest "dissolutions coming" note.

```js
function provinceTable(rows, year) {
  const body = rows
    .map((r) => `<tr><td>${esc(r.province)}</td><td>${intEs(r.cur)}</td><td>${intEs(r.prev)}</td><td>${pctEs(r.pct)}</td></tr>`)
    .join('');
  return `<table><thead><tr><th>Provincia</th><th>${year}</th><th>${year - 1}</th><th>Variación</th></tr></thead><tbody>${body}</tbody></table>`;
}

function typeTable(rows, year) {
  const body = rows
    .map((r) => `<tr><td>${esc(r.type)}</td><td>${intEs(r.count)}</td><td>${pctEs(r.share)}</td></tr>`)
    .join('');
  return `<table><thead><tr><th>Forma jurídica</th><th>Constituciones ${year}</th><th>% del total</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function renderArticleHtml(d) {
  const top = d.provinceRows[0];
  return `
    <main style="font-family:Arial,sans-serif;max-width:880px;margin:2rem auto;padding:0 1rem;line-height:1.6">
      <h1>Barómetro empresarial: dónde se crean empresas en España (${d.year})</h1>
      <p>En ${d.year} se constituyeron <strong>${intEs(d.nationalCur)}</strong> nuevas sociedades en España
         (${pctEs(d.nationalPct)} frente a ${d.prevYear}). <strong>${esc(top.province)}</strong> lidera con
         ${intEs(top.cur)} constituciones. Datos oficiales del BORME.</p>

      <h2>Constituciones por provincia (${d.year} vs ${d.prevYear})</h2>
      ${d.barSvg}
      ${provinceTable(d.provinceRows, d.year)}

      <h2>Por forma jurídica</h2>
      <p>Casi todas las nuevas sociedades son SL: la sociedad limitada concentra la gran mayoría de constituciones.</p>
      ${typeTable(d.typeRows, d.year)}

      <h2>Evolución de las constituciones (2009–${d.year})</h2>
      ${d.trendSvg}

      <h2>Metodología y datos</h2>
      <p>Fuente: Boletín Oficial del Registro Mercantil (BORME), procesado por Mapa Societario. "Constitución" =
         primera inscripción de la sociedad en el BORME. Cobertura desde 2009. Mapa Societario no es un registro oficial.</p>
      <p>Las disoluciones y la creación neta (constituciones − disoluciones) se incorporarán en una próxima edición,
         una vez validada la cobertura de los datos de disolución por registro.</p>
      <p><a href="/es/barometro-empresarial.csv">Descargar datos (CSV)</a></p>
      <p><a href="/app">Buscar una empresa</a> · <a href="/empresas-cotizadas">Empresas cotizadas (IBEX 35)</a></p>
    </main>`;
}

export function injectHead(template, { title, description, canonical }) {
  let html = template.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`);
  html = html.replace(/(<link\s+rel="canonical"[^>]*href=")[^"]*(")/, `$1${canonical}$2`);
  return html;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/barometro.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/barometro-lib.mjs test/barometro.test.mjs
git commit -m "feat(barometro): article HTML + head injection"
```

---

### Task 5: Orchestrator + postbuild wiring

**Files:**
- Create: `scripts/generate-barometro.mjs`
- Modify: `package.json` (`postbuild`)

- [ ] **Step 1: Write the orchestrator**

`scripts/generate-barometro.mjs`:
```js
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

  const typeCounts = [];
  for (const t of TYPES) {
    const rows = provincesData(await getJson(`${API}/bormes/stats/provinces?${range(year)}&company_type=${t}`));
    const count = sumFormations(rows);
    if (count > 0) typeCounts.push({ type: t, count });
  }
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
```

- [ ] **Step 2: Wire into postbuild.** In `package.json`, change:
```json
"postbuild": "node scripts/prerender.mjs",
```
to:
```json
"postbuild": "node scripts/prerender.mjs && node scripts/generate-barometro.mjs",
```

- [ ] **Step 3: Run the full build and verify the page + CSV are generated**

Run:
```bash
npm run build 2>&1 | grep -iE "Barómetro|error" | head
test -f dist/es/barometro-empresarial/index.html && echo "PAGE OK"
test -f dist/es/barometro-empresarial.csv && echo "CSV OK"
grep -c "<tr>" dist/es/barometro-empresarial/index.html   # province + type rows
grep -c "," dist/es/barometro-empresarial.csv             # CSV data rows (>= 52)
grep -oE "<h1>[^<]*</h1>" dist/es/barometro-empresarial/index.html | head -1
```
Expected: the `Barómetro: … edition` log line; `PAGE OK`; `CSV OK`; the page has 50+ `<tr>` rows; the CSV has 50+ comma rows; the `<h1>` shows "Barómetro empresarial … (YEAR)".

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-barometro.mjs package.json
git commit -m "feat(barometro): build-time generator + postbuild wiring"
```

---

### Task 6: Internal links + sitemap

**Files:**
- Modify: `scripts/prerender.mjs` (homepage `/` and `/es` staticContent)
- Modify: `scripts/generate-seo-files.mjs` (sitemap-pages)

- [ ] **Step 1: Add a homepage link.** In `scripts/prerender.mjs`, inside the `/` route's `staticContent` `<ul>`, add a list item after the BORME-grafo line:
```js
          <li><a href="/es/barometro-empresarial/">Bar&oacute;metro empresarial: empresas creadas en Espa&ntilde;a</a></li>
```

- [ ] **Step 2: Add an /es link.** In `scripts/prerender.mjs`, in the `/es` route's `staticContent`, change the final links paragraph:
```js
        <p><a href="/app">Buscar en el grafo</a> | <a href="/due-diligence">Ver informes due diligence</a></p>
```
to:
```js
        <p><a href="/app">Buscar en el grafo</a> | <a href="/es/barometro-empresarial/">Bar&oacute;metro empresarial</a> | <a href="/due-diligence">Ver informes due diligence</a></p>
```

- [ ] **Step 3: Add to the sitemap.** In `scripts/generate-seo-files.mjs` there is a `const sitemapRoutes = [ ... ]` array of objects like `{ path: '/es/borme-grafo-empresas/', changefreq: 'weekly', priority: '0.8' }`. Add this entry to that array (e.g. right after the `/es/borme-grafo-empresas/` line):
```js
  { path: '/es/barometro-empresarial/', changefreq: 'monthly', priority: '0.8' },
```

- [ ] **Step 4: Rebuild and verify links + sitemap**

Run:
```bash
npm run build >/dev/null 2>&1
grep -c "es/barometro-empresarial" dist/index.html             # homepage link present (>=1)
grep -c "es/barometro-empresarial" dist/es/index.html          # /es link present (>=1)
grep -c "barometro-empresarial" public/sitemap-pages.xml        # in sitemap (>=1)
```
Expected: each grep returns ≥ 1.

- [ ] **Step 5: Commit**

```bash
git add scripts/prerender.mjs scripts/generate-seo-files.mjs public/sitemap-pages.xml
git commit -m "feat(barometro): link from homepage + /es and add to sitemap"
```

---

## After deploy (verification)

```bash
curl -s -o /dev/null -w "page %{http_code}\n" https://mapasocietario.es/es/barometro-empresarial
curl -s -o /dev/null -w "csv  %{http_code} %{content_type}\n" https://mapasocietario.es/es/barometro-empresarial.csv
```
Expected: `page 200`; `csv 200 text/csv` (or `application/octet-stream`). Then URL-inspect `/es/barometro-empresarial` in GSC and Request Indexing.

## Notes / out of scope

- **Net creation / dissolutions** and **sole-vs-multiple** are deferred (backend work in `ncdata-bormes`); the methodology section already flags the dissolutions follow-up.
- EN mirror, per-year archive, interactive map: out of scope.
- The article content lives inside `#root`; React replaces it on hydration (same pattern as `prerender.mjs`), so the SPA still works for users while crawlers get the static tables/charts.
