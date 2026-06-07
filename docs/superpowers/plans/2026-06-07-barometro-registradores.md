# Barómetro Empresarial — Registradores Re-source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Re-source the Barómetro (`/es/barometro-empresarial`) from the official Colegio de Registradores CSVs (committed at `data/registradores/{const,extin,ampli}.csv`) and lead with **net creation** (constituciones − extinciones) by province, replacing the inaccurate BORME stats.

**Architecture:** Extend the existing pure lib `scripts/barometro-lib.mjs` (already has `pctChange, intEs, pctEs, shareEs, esc, buildTypeRows, barChartSvg, trendChartSvg, injectHead` — REUSE them) with a Registradores CSV parser, province normalization, aggregators, and net-row builder. Rewrite `renderArticleHtml` for the net table + capital. Swap `scripts/generate-barometro.mjs` to read the committed CSVs (no network, no xlsx dep). The build wiring, internal links, sitemap, and the SPA-strip + self-`<style>` standalone-page handling already exist on `main` and are unchanged.

**Tech Stack:** Node ESM, `node:test`. Spec: `docs/superpowers/specs/2026-06-07-barometro-empresarial-design.md` (v2 block).

**Data:** `data/registradores/const.csv` & `ampli.csv` cols `province,year,month,form,count,capital_subscribed`; `extin.csv` cols `province,year,month,form,count`. 28,548 rows each. Verified 2025: const 128,871, extin 34,259, net 94,612.

---

### Task 1: Lib — CSV parser, province normalization, latest-full-year

**Files:** Modify `scripts/barometro-lib.mjs`; Test `test/barometro-reg.test.mjs` (new file, keep the existing `test/barometro.test.mjs`).

- [ ] **Step 1: Write the failing test** — `test/barometro-reg.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, normProvince, latestFullYearFromRows } from '../scripts/barometro-lib.mjs';

test('parseCsv parses headers and coerces numbers', () => {
  const rows = parseCsv('province,year,month,form,count,capital_subscribed\nMadrid,2025,1,SL,10,5000\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].province, 'Madrid');
  assert.equal(rows[0].year, 2025);
  assert.equal(rows[0].count, 10);
  assert.equal(rows[0].capital_subscribed, 5000);
});

test('normProvince merges both bilingual orderings to one Castilian name', () => {
  assert.equal(normProvince('Alacant / Alicante'), 'Alicante');
  assert.equal(normProvince('Alicante / Alacant'), 'Alicante');
  assert.equal(normProvince('València / Valencia'), 'Valencia');
  assert.equal(normProvince('Araba / Álava'), 'Álava');
  assert.equal(normProvince('Bizkaia'), 'Vizcaya');
  assert.equal(normProvince('Madrid'), 'Madrid'); // pass-through
});

test('latestFullYearFromRows returns the latest year with 12 distinct months', () => {
  const rows = [];
  for (const y of [2024, 2025]) for (let m = 1; m <= 12; m++) rows.push({ year: y, month: m });
  for (let m = 1; m <= 6; m++) rows.push({ year: 2026, month: m });
  assert.equal(latestFullYearFromRows(rows), 2025);
});
```

- [ ] **Step 2: Run, verify it fails** — `node --test test/barometro-reg.test.mjs`.

- [ ] **Step 3: Append to `scripts/barometro-lib.mjs`:**
```js
// --- Official Registradores CSV layer ---------------------------------------

export function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
  const head = lines[0].split(',');
  const numCols = new Set(['year', 'month', 'count', 'capital_subscribed']);
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const o = {};
    head.forEach((h, i) => { o[h] = numCols.has(h) ? Number(cells[i]) : cells[i]; });
    return o;
  });
}

// Province names appear under both bilingual orderings (e.g. "Alacant / Alicante"
// AND "Alicante / Alacant") — they MUST be merged before aggregating or the
// province is split/undercounted. Unmapped names pass through unchanged.
const PROV_NORM = {
  'Alacant / Alicante': 'Alicante', 'Alicante / Alacant': 'Alicante',
  'Castelló / Castellón': 'Castellón', 'Castellón / Castelló': 'Castellón',
  'Valencia / València': 'Valencia', 'València / Valencia': 'Valencia',
  'Araba / Álava': 'Álava',
  'Bizkaia': 'Vizcaya', 'Gipuzkoa': 'Guipúzcoa',
  'Girona': 'Gerona', 'Lleida': 'Lérida', 'Ourense': 'Orense',
  'Illes Balears': 'Baleares',
};
export function normProvince(p) { return PROV_NORM[p] || p; }

export function latestFullYearFromRows(rows) {
  const months = {};
  for (const r of rows) (months[r.year] ??= new Set()).add(r.month);
  const full = Object.keys(months).map(Number).filter((y) => months[y].size >= 12);
  if (!full.length) throw new Error('latestFullYearFromRows: no complete year');
  return Math.max(...full);
}
```

- [ ] **Step 4: Run, verify pass** — `node --test test/barometro-reg.test.mjs` (3 pass).
- [ ] **Step 5: Commit** — `git add scripts/barometro-lib.mjs test/barometro-reg.test.mjs && git commit -m "feat(barometro): Registradores CSV parser + province normalization"`

---

### Task 2: Lib — aggregators + net-row builder

**Files:** Modify `scripts/barometro-lib.mjs`; Test `test/barometro-reg.test.mjs`.

- [ ] **Step 1: Append tests:**
```js
import { sumByProvince, sumByForm, sumYears, sumCapital, buildNetRows } from '../scripts/barometro-lib.mjs';

const CONST = [
  { province: 'Madrid', year: 2025, month: 1, form: 'SL', count: 100, capital_subscribed: 9 },
  { province: 'Alacant / Alicante', year: 2025, month: 1, form: 'SL', count: 30, capital_subscribed: 1 },
  { province: 'Alicante / Alacant', year: 2025, month: 2, form: 'SA', count: 20, capital_subscribed: 1 },
  { province: 'Madrid', year: 2024, month: 1, form: 'SL', count: 80, capital_subscribed: 5 },
];
const EXTIN = [
  { province: 'Madrid', year: 2025, month: 1, form: 'SL', count: 40 },
  { province: 'Alacant / Alicante', year: 2025, month: 1, form: 'SL', count: 10 },
  { province: 'Madrid', year: 2024, month: 1, form: 'SL', count: 30 },
];

test('sumByProvince merges normalized provinces', () => {
  const m = sumByProvince(CONST, 2025);
  assert.equal(m.Madrid, 100);
  assert.equal(m.Alicante, 50); // 30 + 20 merged across both spellings
});

test('sumByForm and sumCapital for a year', () => {
  assert.equal(sumByForm(CONST, 2025).SL, 130);
  assert.equal(sumCapital(CONST, 2025), 11);
});

test('sumYears returns ascending yearly totals', () => {
  assert.deepEqual(sumYears(CONST), [{ year: 2024, count: 80 }, { year: 2025, count: 150 }]);
});

test('buildNetRows computes net, prior-year net, YoY, sorted desc by net', () => {
  const rows = buildNetRows(sumByProvince(CONST, 2025), sumByProvince(EXTIN, 2025),
                            sumByProvince(CONST, 2024), sumByProvince(EXTIN, 2024));
  assert.equal(rows[0].province, 'Madrid');
  assert.equal(rows[0].const_, 100);
  assert.equal(rows[0].extin, 40);
  assert.equal(rows[0].net, 60);
  assert.equal(rows[0].netPrev, 50); // 80 - 30
  assert.equal(Math.round(rows[0].pct), 20);
  assert.equal(rows[1].province, 'Alicante'); // net 50-10=40
  assert.equal(rows[1].net, 40);
});
```

- [ ] **Step 2: Run, verify it fails.**
- [ ] **Step 3: Append to `scripts/barometro-lib.mjs`:**
```js
export function sumByProvince(rows, year) {
  const m = {};
  for (const r of rows) if (r.year === year) { const p = normProvince(r.province); m[p] = (m[p] || 0) + r.count; }
  return m;
}
export function sumByForm(rows, year) {
  const m = {};
  for (const r of rows) if (r.year === year) m[r.form] = (m[r.form] || 0) + r.count;
  return m;
}
export function sumYears(rows) {
  const m = {};
  for (const r of rows) m[r.year] = (m[r.year] || 0) + r.count;
  return Object.keys(m).map(Number).sort((a, b) => a - b).map((y) => ({ year: y, count: m[y] }));
}
export function sumCapital(rows, year) {
  let t = 0;
  for (const r of rows) if (r.year === year) t += (r.capital_subscribed || 0);
  return t;
}
export function buildNetRows(constCur, extinCur, constPrev, extinPrev) {
  const provs = new Set([...Object.keys(constCur), ...Object.keys(extinCur)]);
  return [...provs]
    .map((p) => {
      const c = constCur[p] || 0, e = extinCur[p] || 0;
      const netPrev = (constPrev[p] || 0) - (extinPrev[p] || 0);
      return { province: p, const_: c, extin: e, net: c - e, netPrev, pct: pctChange(c - e, netPrev) };
    })
    .sort((a, b) => b.net - a.net);
}
```

- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `git commit -am "feat(barometro): Registradores aggregators + net-row builder"`

---

### Task 3: Lib — net article render + dual-line trend + net CSV

**Files:** Modify `scripts/barometro-lib.mjs`; Test `test/barometro-reg.test.mjs`.

- [ ] **Step 1: Append tests:**
```js
import { trendDualSvg, renderNetArticle, netCsv } from '../scripts/barometro-lib.mjs';

test('trendDualSvg renders two polylines', () => {
  const svg = trendDualSvg([{ year: 2024, count: 5 }, { year: 2025, count: 8 }],
                           [{ year: 2024, count: 2 }, { year: 2025, count: 3 }]);
  assert.equal((svg.match(/<polyline /g) || []).length, 2);
  assert.match(svg, /^<svg /);
});

test('netCsv has header + one row per province', () => {
  const csv = netCsv([{ province: 'Madrid', const_: 100, extin: 40, net: 60 }], 2025);
  assert.match(csv, /provincia,constituciones_2025,extinciones_2025,neto_2025/);
  assert.match(csv, /Madrid,100,40,60/);
});

test('renderNetArticle includes net hero, province net table, charts, source', () => {
  const d = {
    year: 2025, prevYear: 2024, nationalConst: 128871, nationalExtin: 34259,
    nationalNet: 94612, nationalNetPrev: 90000, netPct: 5.1, capital: 1234567,
    netRows: [{ province: 'Madrid', const_: 28899, extin: 8341, net: 20558, netPrev: 20000, pct: 2.8 }],
    typeRows: [{ type: 'SL', count: 127138, share: 98.7 }],
    barSvg: '<svg id="bar"></svg>', trendSvg: '<svg id="trend"></svg>',
  };
  const html = renderNetArticle(d);
  assert.match(html, /94\.612/);          // net hero (intEs)
  assert.match(html, /Madrid/);
  assert.match(html, /20\.558/);          // Madrid net
  assert.match(html, /Registradores/);    // source
  assert.match(html, /id="bar"/);
  assert.match(html, /barometro-empresarial\.csv/);
  assert.match(html, /href="\/app"/);
});
```

- [ ] **Step 2: Run, verify it fails.**
- [ ] **Step 3: Append to `scripts/barometro-lib.mjs`** (reuses `esc`, `intEs`, `pctEs`, `shareEs`):
```js
export function trendDualSvg(seriesA, seriesB, { w = 680, h = 220, pad = 30 } = {}) {
  const all = [...seriesA, ...seriesB];
  const max = Math.max(...all.map((p) => p.count), 1);
  const years = seriesA.map((p) => p.year);
  const n = Math.max(1, years.length - 1);
  const x = (i) => pad + (i / n) * (w - pad * 2);
  const y = (v) => h - pad - (v / max) * (h - pad * 2);
  const line = (s, color) =>
    `<polyline points="${s.map((p, i) => `${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2"></polyline>`;
  const labels = years
    .map((yr, i) => (i % 2 === 0 || i === years.length - 1
      ? `<text x="${x(i).toFixed(1)}" y="${h - 8}" font-size="10" text-anchor="middle">${esc(yr)}</text>` : ''))
    .join('');
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" width="100%" font-family="Arial,sans-serif" fill="#64748b">${line(seriesA, '#2563eb')}${line(seriesB, '#ef4444')}${labels}</svg>`;
}

function netTable(rows, year) {
  const body = rows
    .map((r) => `<tr><td>${esc(r.province)}</td><td>${intEs(r.const_)}</td><td>${intEs(r.extin)}</td><td>${intEs(r.net)}</td><td>${pctEs(r.pct)}</td></tr>`)
    .join('');
  return `<table><thead><tr><th>Provincia</th><th>Constituciones</th><th>Extinciones</th><th>Neto ${year}</th><th>Neto vs ${year - 1}</th></tr></thead><tbody>${body}</tbody></table>`;
}

function regTypeTable(rows, year) {
  const body = rows
    .map((r) => `<tr><td>${esc(r.type)}</td><td>${intEs(r.count)}</td><td>${shareEs(r.share)}</td></tr>`)
    .join('');
  return `<table><thead><tr><th>Forma jurídica</th><th>Constituciones ${year}</th><th>% del total</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function netCsv(rows, year) {
  const head = `provincia,constituciones_${year},extinciones_${year},neto_${year}`;
  const cell = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : s);
  const body = rows.map((r) => `${cell(r.province)},${r.const_},${r.extin},${r.net}`).join('\n');
  return `${head}\n${body}\n`;
}

export function renderNetArticle(d) {
  const top = d.netRows[0];
  return `
    <style>
      body{background:#fff;color:#0f172a;margin:0}
      main{font-family:Arial,Helvetica,sans-serif}
      h1{font-size:1.9rem;line-height:1.2;margin:.4rem 0 1rem}
      h2{font-size:1.3rem;margin:2.2rem 0 .6rem;border-top:1px solid #e2e8f0;padding-top:1.2rem}
      table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:14px}
      th,td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left}
      th{background:#f1f5f9;font-weight:600}
      tbody td:nth-child(n+2),thead th:nth-child(n+2){text-align:right;font-variant-numeric:tabular-nums}
      a{color:#2563eb}
      svg{max-width:100%;height:auto;margin:.5rem 0}
    </style>
    <main style="max-width:880px;margin:2rem auto;padding:0 1rem;line-height:1.6">
      <p style="margin:0 0 1.2rem"><a href="/" style="text-decoration:none;font-weight:700">Mapa Societario</a></p>
      <h1>Barómetro empresarial: creación neta de empresas en España (${d.year})</h1>
      <p>En ${d.year} España registró una <strong>creación neta de ${intEs(d.nationalNet)} sociedades</strong>
         (${intEs(d.nationalConst)} constituciones − ${intEs(d.nationalExtin)} extinciones; ${pctEs(d.netPct)} frente a ${d.prevYear}).
         <strong>${esc(top.province)}</strong> lidera con ${intEs(top.net)} netas. Datos del Colegio de Registradores.</p>

      <h2>Creación neta por provincia (${d.year})</h2>
      ${d.barSvg}
      ${netTable(d.netRows, d.year)}

      <h2>Por forma jurídica</h2>
      <p>Casi todas las nuevas sociedades son SL.</p>
      ${regTypeTable(d.typeRows, d.year)}

      <h2>Constituciones y extinciones (2011–${d.year})</h2>
      <p>Azul: constituciones. Rojo: extinciones.</p>
      ${d.trendSvg}

      <h2>Capital</h2>
      <p>Capital suscrito en las nuevas sociedades en ${d.year}: <strong>${intEs(d.capital)} €</strong>.</p>

      <h2>Metodología y fuente</h2>
      <p>Fuente: <strong>Colegio de Registradores de España</strong> (estadística mercantil). "Constitución" y "extinción"
         según inscripción registral; "creación neta" = constituciones − extinciones. Cobertura 2011–${d.year}. Sin desestacionalizar.</p>
      <p><a href="/es/barometro-empresarial.csv">Descargar datos (CSV)</a></p>
      <p><a href="/app">Buscar una empresa</a> · <a href="/empresas-cotizadas">Empresas cotizadas (IBEX 35)</a></p>
    </main>`;
}
```

- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `git commit -am "feat(barometro): net-creation article render + dual trend + net CSV"`

---

### Task 4: Orchestrator — read Registradores CSVs, render net edition

**Files:** Modify `scripts/generate-barometro.mjs`.

- [ ] **Step 1: Replace `scripts/generate-barometro.mjs` with:**
```js
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
  // Spanish standalone page: language signals + hreflang.
  html = html.replace(/<html\s+lang="[^"]*"/, '<html lang="es"');
  html = html.replace(/(property="og:locale"[^>]*content=")[^"]*(")/, '$1es_ES$2');
  html = html.replace('</head>',
    `    <link rel="alternate" hreflang="es" href="${SITE}/es/barometro-empresarial/" />\n    <link rel="alternate" hreflang="x-default" href="${SITE}/" />\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${renderNetArticle(data)}</div>`);
  // Standalone static page — strip the SPA entry + the dark app stylesheet (see git history).
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
```

- [ ] **Step 2: Run the full build and verify**
```bash
npm run build 2>&1 | grep -iE "Barómetro|error" | head
P=dist/es/barometro-empresarial/index.html
grep -oE "<h1>[^<]*</h1>" $P | head -1
echo "net hero 94.612 present: $(grep -c '94.612' $P)   provinces rows: $(grep -o '<tr>' $P | wc -l)"
echo "module script (0): $(grep -oE '<script[^>]*type=\"module\"' $P | wc -l)   app css (0): $(grep -oE 'href=\"/assets/[^\"]*\\.css\"' $P | wc -l)"
echo "csv header: $(head -1 dist/es/barometro-empresarial.csv)"
node --test test/barometro-reg.test.mjs 2>&1 | grep -E "pass |fail "
```
Expected: `Barómetro: 2025 net edition — net 94.612 (128.871 − 34.259), 52 provinces.`; `<h1>` = "…creación neta…(2025)"; net hero present; ~57 `<tr>`; 0 module scripts; 0 app css; CSV header `provincia,constituciones_2025,extinciones_2025,neto_2025`; reg tests pass.

- [ ] **Step 3: Commit** — `git add scripts/generate-barometro.mjs && git commit -m "feat(barometro): generate net-creation edition from Registradores CSVs"`

---

## Notes
- The old `api.ncdata.eu`-based exports in `barometro-lib.mjs` (`latestFullYear`, `buildProvinceRows`, `yearlyTotals`, `trendChartSvg`, `renderArticleHtml`, `toCsv`) become unused by the generator but are left in place (still unit-tested by `test/barometro.test.mjs`); a later cleanup task may remove them. Do NOT delete them in this plan — out of scope.
- Build wiring (`postbuild`), internal links (homepage + `/es`), and the sitemap entry already exist on `main` — unchanged.
- Province display uses `normProvince`; the Registradores province count collapses to 52 after merging bilingual spellings.
- After deploy: `curl -s https://mapasocietario.es/es/barometro-empresarial/ | grep -c '94.612'` (≥1); open in browser; Request Indexing in GSC.
