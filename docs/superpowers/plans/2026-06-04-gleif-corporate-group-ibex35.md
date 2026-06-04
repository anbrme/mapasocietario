# GLEIF Corporate Group on IBEX 35 Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the GLEIF corporate group (parent chain + all subsidiaries) to the server-rendered IBEX 35 company pages as crawlable lists plus an interactive double-click-expandable graph; polish the light theme; add a hub loading overlay; reorder sections; and default the search app's Datos panel to collapsed on mobile.

**Architecture:** The IBEX 35 pages are Cloudflare Pages Functions rendering static HTML in `functions/empresa/_lib.js`. GLEIF data comes from the existing public endpoint `POST https://api.ncdata.eu/lei-relationships` (keyed by LEI). We bake LEIs into the curated `SEED`, fetch relationships server-side for the initial render (crawlable lists), and progressively enhance with a self-hosted vanilla `force-graph` canvas that calls the same endpoint from the browser (CORS already allows `mapasocietario.es`) to expand nodes on double-click.

**Tech Stack:** Cloudflare Pages Functions (ES modules), vanilla `force-graph` UMD (self-hosted), React + MUI (search app), Node for build/check scripts. No test framework exists in this repo; pure render functions are verified with throwaway `node` check scripts, and UI behavior is verified manually via `npx wrangler pages dev`.

**Spec:** `docs/superpowers/specs/2026-06-04-gleif-corporate-group-ibex35-design.md`

---

## File Structure

- **Create** `scripts/resolve-ibex-leis.mjs` — one-off: resolve each SEED ISIN → LEI via public GLEIF API, print a paste-ready `lei:` line per company and list failures.
- **Modify** `functions/empresa/_ibex35.js` — add `lei` to each SEED entry.
- **Modify** `functions/empresa/_lib.js` — GLEIF fetch in `handleCompany`; `gleifBlock` + graph data/markup in `renderCompanyPage`; new `T` keys; section reorder; bump timeout; hub loading overlay in `renderHub` + `HUB_STYLE`; theme polish in `STYLE`/`HUB_STYLE`.
- **Create** `public/vendor/force-graph.min.js` — vendored UMD lib (copied from node_modules).
- **Create** `public/vendor/gleif-graph.js` — our graph hydrate + double-click-expand module.
- **Modify** `src/components/SpanishCompanyNetworkGraph.jsx` — Datos panel default collapsed on mobile.
- **Create** `scripts/check-gleif-render.mjs` — node assertions over `renderCompanyPage` (pure, no network).

---

## Task 1: Vendor the force-graph library

**Files:**
- Modify: `package.json` (devDependencies)
- Create: `public/vendor/force-graph.min.js`

- [ ] **Step 1: Add the library as a dev dependency (pinned)**

Run:
```bash
cd /Users/alessandronurnberg/mapasocietario
npm install -D force-graph@1.49.5
```
Expected: installs without error; `package.json` gains `"force-graph": "1.49.5"` under devDependencies and `package-lock.json` updates. (If 1.49.5 is unavailable, install `force-graph@latest`, then read the installed version with `node -p "require('force-graph/package.json').version"` and pin that exact version in `package.json`.)

- [ ] **Step 2: Confirm the self-contained UMD build exists**

Run:
```bash
ls -la node_modules/force-graph/dist/force-graph.min.js
head -c 120 node_modules/force-graph/dist/force-graph.min.js
```
Expected: the file exists and begins with a minified UMD preamble (e.g. `!function(e,t)...`). This bundle includes its d3-force dependencies — no extra files needed.

- [ ] **Step 3: Copy it into the served static dir**

Run:
```bash
mkdir -p public/vendor
cp node_modules/force-graph/dist/force-graph.min.js public/vendor/force-graph.min.js
ls -la public/vendor/
```
Expected: `public/vendor/force-graph.min.js` exists. (`public/` is Vite's static dir, copied to the site root on build, so it is served at `/vendor/force-graph.min.js` by Cloudflare Pages alongside the Functions.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json public/vendor/force-graph.min.js
git -c commit.gpgsign=false commit -m "chore: vendor force-graph UMD build for GLEIF group graph"
```

---

## Task 2: Resolve and bake LEIs into the seed

**Files:**
- Create: `scripts/resolve-ibex-leis.mjs`
- Modify: `functions/empresa/_ibex35.js`

- [ ] **Step 1: Write the resolver script**

Create `scripts/resolve-ibex-leis.mjs`:
```js
/**
 * One-off: resolve each IBEX 35 seed ISIN -> LEI via the public GLEIF API,
 * so the LEI can be baked into _ibex35.js (the /lei-relationships endpoint
 * needs a LEI, not an ISIN). Run: node scripts/resolve-ibex-leis.mjs
 */
import { SEED } from '../functions/empresa/_ibex35.js';

const GLEIF = 'https://api.gleif.org/api/v1/lei-records';

async function isinToLei(isin) {
  const url = `${GLEIF}?filter[isin]=${encodeURIComponent(isin)}&page[size]=5`;
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) return null;
  const d = await r.json();
  const rec = (d.data || [])[0];
  return rec ? { lei: rec.id, name: rec.attributes?.entity?.legalName?.name } : null;
}

const failures = [];
for (const [slug, v] of Object.entries(SEED)) {
  if (!v.isin) { failures.push([slug, 'no ISIN']); continue; }
  try {
    const hit = await isinToLei(v.isin);
    if (hit) {
      console.log(`  '${slug}': lei '${hit.lei}'  // ${hit.name}`);
    } else {
      failures.push([slug, `no LEI for ISIN ${v.isin}`]);
    }
  } catch (e) {
    failures.push([slug, e.message]);
  }
  await new Promise((res) => setTimeout(res, 250)); // be polite to GLEIF
}

if (failures.length) {
  console.error('\nUNRESOLVED (resolve by name at https://search.gleif.org and add manually):');
  for (const [slug, why] of failures) console.error(`  ${slug}: ${why}`);
}
```

- [ ] **Step 2: Run the resolver**

Run:
```bash
cd /Users/alessandronurnberg/mapasocietario
node scripts/resolve-ibex-leis.mjs
```
Expected: ~30+ lines of `'slug': lei '...'  // Legal Name`, and an UNRESOLVED list likely containing foreign-domiciled entities (e.g. `ferrovial`, `arcelormittal`). Note these for manual handling. Keep the printed LEIs.

- [ ] **Step 3: Add `lei` to each SEED entry**

In `functions/empresa/_ibex35.js`, add a `lei: '...'` field to each entry in `SEED` using the resolved values. Example (ACS — verified LEI `95980020140005558665`):
```js
  'acs':                          { name: 'ACS', v3Name: 'ACS ACTIVIDADES DE CONSTRUCCION Y SERVICIOS SA', nif: 'A-28004885', isin: 'ES0167050915', ticker: 'BME:ACS', sector: 'Construcción', website: 'https://www.grupoacs.com/', hoja: 'M 30221', lei: '95980020140005558665' },
```
For entries the script could not resolve, look up the LEI by legal name at https://search.gleif.org/ and add it; if no LEI exists for the Spanish entity, leave `lei` off entirely (that page will simply omit the GLEIF section — handled in Task 3).

- [ ] **Step 4: Verify the seed parses and most entries have a LEI**

Run:
```bash
node -e "import('./functions/empresa/_ibex35.js').then(({SEED})=>{const all=Object.entries(SEED);const with_=all.filter(([,v])=>v.lei);console.log('total',all.length,'with lei',with_.length);const bad=with_.filter(([,v])=>!/^[A-Z0-9]{20}$/.test(v.lei));console.log('malformed LEIs',bad.map(([s])=>s));});"
```
Expected: `total 35`, `with lei` ≈ 33–35, `malformed LEIs []` (LEIs are exactly 20 uppercase alphanumerics).

- [ ] **Step 5: Commit**

```bash
git add scripts/resolve-ibex-leis.mjs functions/empresa/_ibex35.js
git -c commit.gpgsign=false commit -m "feat: resolve and bake GLEIF LEIs into IBEX 35 seed"
```

---

## Task 3: Fetch GLEIF relationships server-side

**Files:**
- Modify: `functions/empresa/_lib.js` (`handleCompany` ~697–763; signature of `renderCompanyPage` line 482)

- [ ] **Step 1: Add a GLEIF fetch helper**

In `functions/empresa/_lib.js`, just after `jsonOrNull` (ends line 66), add a POST helper:
```js
async function postJsonOrNull(url, body, signal) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Bump the abort timeout to 10s**

In `handleCompany`, change line ~700:
```js
  const timeout = setTimeout(() => controller.abort(), 8000);
```
to:
```js
  const timeout = setTimeout(() => controller.abort(), 10000);
```

- [ ] **Step 3: Add the GLEIF fetch to the parallel block**

In `handleCompany`, extend the `Promise.all` (currently lines ~730–737). Replace:
```js
    const [profile, eventsResp, cnmvResp, chartSvg, boeResp] = await Promise.all([
      jsonOrNull(`${API_BASE}/bormes/v3/company/${encodeURIComponent(name)}`, controller.signal),
      jsonOrNull(`${API_BASE}/bormes/v3/events?company=${encodeURIComponent(name)}&size=8`, controller.signal),
      // Significant shareholders + history chart: only listed (curated) companies have CNMV data.
      seed ? jsonOrNull(`${API_BASE}/bormes/cnmv/shareholders?company=${encodeURIComponent(slug)}`, controller.signal) : Promise.resolve(null),
      seed ? textOrNull(`${API_BASE}/bormes/cnmv/history-chart?company=${encodeURIComponent(slug)}&lang=${lang}`, controller.signal) : Promise.resolve(null),
      boeUrl ? jsonOrNull(boeUrl, controller.signal) : Promise.resolve(null),
    ]);
```
with:
```js
    const [profile, eventsResp, cnmvResp, chartSvg, boeResp, gleifResp] = await Promise.all([
      jsonOrNull(`${API_BASE}/bormes/v3/company/${encodeURIComponent(name)}`, controller.signal),
      jsonOrNull(`${API_BASE}/bormes/v3/events?company=${encodeURIComponent(name)}&size=8`, controller.signal),
      // Significant shareholders + history chart: only listed (curated) companies have CNMV data.
      seed ? jsonOrNull(`${API_BASE}/bormes/cnmv/shareholders?company=${encodeURIComponent(slug)}`, controller.signal) : Promise.resolve(null),
      seed ? textOrNull(`${API_BASE}/bormes/cnmv/history-chart?company=${encodeURIComponent(slug)}&lang=${lang}`, controller.signal) : Promise.resolve(null),
      boeUrl ? jsonOrNull(boeUrl, controller.signal) : Promise.resolve(null),
      // GLEIF corporate group: only curated (seed) companies carry a verified LEI.
      seed && seed.lei
        ? postJsonOrNull(`${API_BASE}/lei-relationships`, { lei: seed.lei, isPublic: true }, controller.signal)
        : Promise.resolve(null),
    ]);
```

- [ ] **Step 4: Normalize the GLEIF payload and pass it to the renderer**

Still in `handleCompany`, after the `if (!company) {...}` block and before the `renderCompanyPage` call (~line 747), add:
```js
    const gleif = gleifResp && gleifResp.success ? gleifResp.data : null;
```
Then change the render call from:
```js
    const html = renderCompanyPage(company, (eventsResp && eventsResp.events) || [], slug, seed, lang, cnmvResp, sanitizeSvg(chartSvg), boeResp);
```
to:
```js
    const html = renderCompanyPage(company, (eventsResp && eventsResp.events) || [], slug, seed, lang, cnmvResp, sanitizeSvg(chartSvg), boeResp, gleif);
```

- [ ] **Step 5: Extend the renderCompanyPage signature**

Change line 482 from:
```js
export function renderCompanyPage(company, events, slug, seed, lang = 'es', cnmv = null, chartSvg = null, boe = null) {
```
to:
```js
export function renderCompanyPage(company, events, slug, seed, lang = 'es', cnmv = null, chartSvg = null, boe = null, gleif = null) {
```

- [ ] **Step 6: Smoke-check the module still imports**

Run:
```bash
node -e "import('./functions/empresa/_lib.js').then(m=>console.log('ok', typeof m.renderCompanyPage, typeof m.handleCompany)).catch(e=>{console.error(e);process.exit(1)})"
```
Expected: `ok function function`.

- [ ] **Step 7: Commit**

```bash
git add functions/empresa/_lib.js
git -c commit.gpgsign=false commit -m "feat: fetch GLEIF relationships server-side for IBEX 35 pages"
```

---

## Task 4: Render the GLEIF section (lists) + translations + reorder

**Files:**
- Modify: `functions/empresa/_lib.js` (`T.es`/`T.en`; `renderCompanyPage` body ~539–665)
- Create: `scripts/check-gleif-render.mjs`

- [ ] **Step 1: Add Spanish translation keys**

In `functions/empresa/_lib.js`, inside `T.es` (after the `boeSource` line ~223, before `positions:`), add:
```js
    gleifTitle: 'Grupo societario (GLEIF)',
    gleifSub: 'Estructura de matrices y filiales según el identificador LEI global (GLEIF). Haz doble clic en un nodo del gráfico para expandir su grupo.',
    gleifParents: 'Matrices',
    gleifDirectParent: 'Matriz directa',
    gleifUltimateParent: 'Matriz última',
    gleifNoParent: 'Sin matriz registrada — es cabecera de grupo.',
    gleifSubsidiaries: 'Filiales directas',
    gleifUltimateSubs: 'Filiales últimas',
    gleifSummary: (nDirect, nUlt, nCountries) =>
      `${nDirect} filiales directas, ${nUlt} filiales últimas en ${nCountries} ${nCountries === 1 ? 'país' : 'países'}.`,
    gleifThEntity: 'Entidad',
    gleifThCountry: 'País',
    gleifInactive: 'inactiva',
    gleifSource: (lei) => `Fuente: GLEIF — Global Legal Entity Identifier Foundation (LEI ${lei}). Datos abiertos disponibles en `,
```

- [ ] **Step 2: Add English translation keys**

Inside `T.en` (after the `boeSource` line ~317, mirroring the same position), add:
```js
    gleifTitle: 'Corporate group (GLEIF)',
    gleifSub: 'Parent and subsidiary structure from the global LEI identifier (GLEIF). Double-click a node in the graph to expand its group.',
    gleifParents: 'Parents',
    gleifDirectParent: 'Direct parent',
    gleifUltimateParent: 'Ultimate parent',
    gleifNoParent: 'No registered parent — this is a group head.',
    gleifSubsidiaries: 'Direct subsidiaries',
    gleifUltimateSubs: 'Ultimate subsidiaries',
    gleifSummary: (nDirect, nUlt, nCountries) =>
      `${nDirect} direct subsidiaries, ${nUlt} ultimate subsidiaries across ${nCountries} ${nCountries === 1 ? 'country' : 'countries'}.`,
    gleifThEntity: 'Entity',
    gleifThCountry: 'Country',
    gleifInactive: 'inactive',
    gleifSource: (lei) => `Source: GLEIF — Global Legal Entity Identifier Foundation (LEI ${lei}). Open data available at `,
```

- [ ] **Step 2b: Confirm `boeSource` lines exist at both insertion points**

Run:
```bash
grep -n "boeSource" functions/empresa/_lib.js
```
Expected: two matches (one in `T.es` ~223, one in `T.en` ~317). Insert the keys immediately after each respective `boeSource` line.

- [ ] **Step 3: Build the `gleifBlock` (lists) + embedded graph data**

In `renderCompanyPage`, after the `boeBlock` definition (ends ~line 597) and before the `const altPath = ...` line (~598), add:
```js
  // GLEIF corporate group (curated/listed companies with a verified LEI only).
  const flag = (cc) => (cc && cc !== 'N/A' ? `<span class="chip">${esc(cc)}</span>` : '');
  const gleifEntityRow = (e) =>
    `<tr><td>${e.lei
        ? `<a href="/app?search=${encodeURIComponent(e.legalName)}">${esc(e.legalName)}</a>`
        : esc(e.legalName)}${
        e.entityStatus && e.entityStatus !== 'ACTIVE' && e.entityStatus !== 'N/A'
          ? ` <span class="muted">(${t.gleifInactive})</span>`
          : ''
      }</td><td>${flag(e.country)}</td></tr>`;

  let gleifBlock = '';
  if (gleif && (gleif.directParent || gleif.ultimateParent || (gleif.directChildren || []).length || (gleif.ultimateChildren || []).length)) {
    const directChildren = gleif.directChildren || [];
    const ultimateChildren = gleif.ultimateChildren || [];
    const countries = new Set(
      [...directChildren, ...ultimateChildren].map((c) => c.country).filter((c) => c && c !== 'N/A'),
    );

    const parentsTable =
      gleif.directParent || gleif.ultimateParent
        ? `<table class="t"><tbody>
            ${gleif.directParent ? `<tr><th>${t.gleifDirectParent}</th><td><a href="/app?search=${encodeURIComponent(gleif.directParent.legalName)}">${esc(gleif.directParent.legalName)}</a></td></tr>` : ''}
            ${gleif.ultimateParent ? `<tr><th>${t.gleifUltimateParent}</th><td><a href="/app?search=${encodeURIComponent(gleif.ultimateParent.legalName)}">${esc(gleif.ultimateParent.legalName)}</a></td></tr>` : ''}
          </tbody></table>`
        : `<p class="more">${t.gleifNoParent}</p>`;

    const directTable = directChildren.length
      ? `<h3>${t.gleifSubsidiaries} (${directChildren.length})</h3>
         <table class="t"><thead><tr><th>${t.gleifThEntity}</th><th>${t.gleifThCountry}</th></tr></thead>
         <tbody>${directChildren.map(gleifEntityRow).join('')}</tbody></table>`
      : '';

    const ultimateTable = ultimateChildren.length
      ? `<details><summary>${t.gleifUltimateSubs} (${ultimateChildren.length})</summary>
         <table class="t"><thead><tr><th>${t.gleifThEntity}</th><th>${t.gleifThCountry}</th></tr></thead>
         <tbody>${ultimateChildren.map(gleifEntityRow).join('')}</tbody></table></details>`
      : '';

    // Graph seed data (consumed by /vendor/gleif-graph.js). Self node is the seed LEI.
    const graphData = {
      self: { lei: seed.lei, name, country: 'ES' },
      directParent: gleif.directParent || null,
      ultimateParent: gleif.ultimateParent || null,
      directChildren,
      ultimateChildren,
    };
    const graphJson = JSON.stringify(graphData)
      .replace(/</g, '\\u003c')
      .replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

    gleifBlock = `<section class="gleif">
        <h2>${t.gleifTitle}</h2>
        <p class="more">${t.gleifSub}</p>
        <p class="more">${t.gleifSummary(directChildren.length, ultimateChildren.length, countries.size)}</p>
        <div id="gleif-graph" class="gleif-graph" data-self-lei="${esc(seed.lei)}"></div>
        <script type="application/json" id="gleif-graph-data">${graphJson}</script>
        <h3>${t.gleifParents}</h3>
        ${parentsTable}
        ${directTable}
        ${ultimateTable}
        <p class="more">${t.gleifSource(seed.lei)}<a href="https://www.gleif.org/" rel="nofollow noopener" target="_blank">gleif.org</a>.</p>
        <script src="/vendor/force-graph.min.js" defer></script>
        <script src="/vendor/gleif-graph.js" defer></script>
      </section>`;
  }
```

- [ ] **Step 4: Reorder the body to spec order**

Replace the body region currently at lines ~637–665 (from `${cnmvBlock}` through `${eventsBlock(events, t, lang)}`) with:
```js
  ${cnmvBlock}
  ${chartBlock}

  ${
    (company.sole_shareholders && company.sole_shareholders.length) ||
    (company.sole_shareholder_individuals && company.sole_shareholder_individuals.length)
      ? `<h2>${t.shareholders}</h2>
         ${listBlock(t.soleCompanies, company.sole_shareholders)}
         ${listBlock(t.soleIndividuals, company.sole_shareholder_individuals)}`
      : ''
  }

  ${gleifBlock}

  ${active ? `<h2>${t.currentOfficers}</h2>${active}` : ''}
  ${resigned ? `<h2>${t.formerOfficers}</h2>${resigned}` : ''}
  ${active || resigned ? `<p class="more">${t.officerRoleNote}</p>` : ''}

  ${boeBlock}

  ${
    company.capital_history && company.capital_history.length
      ? `<h2>${t.capitalHistory}</h2>
         <table class="t"><thead><tr><th>${t.thDate}</th><th>${t.thCapital}</th></tr></thead><tbody>${company.capital_history
           .slice(-6)
           .reverse()
           .map((c) => `<tr><td>${esc(fmtDate(c.date, lang))}</td><td>${esc(fmtEur(c.amount, lang))}</td></tr>`)
           .join('')}</tbody></table>`
      : ''
  }

  ${eventsBlock(events, t, lang)}
```
Resulting order: facts → CNMV/chart → shareholders → GLEIF → current officers → former officers → BOE → capital history → events → CTA.

- [ ] **Step 5: Write a node check for the pure renderer**

Create `scripts/check-gleif-render.mjs`:
```js
/** Pure-function checks for renderCompanyPage GLEIF block + section order. */
import { renderCompanyPage } from '../functions/empresa/_lib.js';
import assert from 'node:assert';

const company = {
  company_name: 'ACS ACTIVIDADES DE CONSTRUCCION Y SERVICIOS SA',
  company_type: 'SA', province: 'Madrid', current_capital: 1000,
  // Non-empty so the "Estructura de socios" heading renders (used for the order check).
  sole_shareholders: ['EXAMPLE HOLDING, S.L.'], sole_shareholder_individuals: [],
  officers_active: [], officers_resigned: [], capital_history: [], identifiers: [], name_changes: [],
};
const seed = { name: 'ACS', isin: 'ES0167050915', lei: '95980020140005558665', ticker: 'BME:ACS', sector: 'Construcción' };
const gleif = {
  directParent: null, ultimateParent: null,
  directChildren: [{ lei: 'X'.repeat(20), legalName: 'NEXPLORE, S.A.', country: 'ES', entityStatus: 'ACTIVE' }],
  ultimateChildren: [{ lei: 'Y'.repeat(20), legalName: 'FLATIRON DRAGADOS USA, INC.', country: 'US', entityStatus: 'ACTIVE' }],
};
const boe = { mentions: [{ category: 'contrato', date: '2024-01-01', title: 'Contrato X', url: 'https://boe.es/x' }] };

const html = renderCompanyPage(company, [], 'acs', seed, 'es', null, null, boe, gleif);

assert(html.includes('Grupo societario (GLEIF)'), 'GLEIF heading missing');
assert(html.includes('NEXPLORE, S.A.'), 'direct child missing');
assert(html.includes('id="gleif-graph"'), 'graph container missing');
assert(html.includes('id="gleif-graph-data"'), 'graph data json missing');
assert(html.includes('/vendor/gleif-graph.js'), 'graph script missing');
assert(html.includes('cabecera de grupo'), 'no-parent label missing');

// Section order (asserted only on strings we fully control: shareholders heading,
// GLEIF heading, BOE heading). Officers sit between GLEIF and BOE in the template,
// so shareholders < GLEIF < BOE confirms the reorder without coupling to officersRows.
const iShareholders = html.indexOf('Estructura de socios');
const iGleif = html.indexOf('Grupo societario');
const iBoe = html.indexOf('Menciones del grupo en el BOE');
assert(iShareholders > -1 && iGleif > -1 && iBoe > -1, 'expected sections present');
assert(iShareholders < iGleif, 'shareholders must come before GLEIF');
assert(iGleif < iBoe, 'GLEIF must come before BOE (BOE moved below directors)');

// No-GLEIF company renders no section and does not throw.
const html2 = renderCompanyPage(company, [], 'acs', { name: 'ACS', isin: 'ES0167050915' }, 'es', null, null, null, null);
assert(!html2.includes('Grupo societario (GLEIF)'), 'GLEIF section should be absent without data');

console.log('check-gleif-render: OK');
```

- [ ] **Step 6: Run it (expect FAIL first if run before Steps 1–4, then PASS)**

Run:
```bash
node scripts/check-gleif-render.mjs
```
Expected after Steps 1–4: `check-gleif-render: OK`. If an assertion fires, fix the corresponding markup/order.

- [ ] **Step 7: Commit**

```bash
git add functions/empresa/_lib.js scripts/check-gleif-render.mjs
git -c commit.gpgsign=false commit -m "feat: render GLEIF corporate-group section and reorder company page"
```

---

## Task 5: Interactive expand-on-double-click graph

**Files:**
- Create: `public/vendor/gleif-graph.js`

- [ ] **Step 1: Write the graph hydrate + expand module**

Create `public/vendor/gleif-graph.js`:
```js
/* GLEIF corporate-group graph: hydrates #gleif-graph from #gleif-graph-data and
   expands a node on double-click via POST /lei-relationships. Progressive
   enhancement — if this fails, the server-rendered lists remain. */
(function () {
  var el = document.getElementById('gleif-graph');
  var dataEl = document.getElementById('gleif-graph-data');
  if (!el || !dataEl || typeof ForceGraph === 'undefined') return;

  var seed;
  try { seed = JSON.parse(dataEl.textContent); } catch (e) { return; }

  var COLORS = { self: '#2563eb', parent: '#7c3aed', child: '#0ea5e9', other: '#64748b' };
  var API = 'https://api.ncdata.eu/lei-relationships';

  var nodes = [];
  var links = [];
  var byId = {};
  var expanded = {};
  var inflight = {};

  function addNode(lei, name, role, country) {
    if (!lei) return null;
    if (byId[lei]) return byId[lei];
    var n = { id: lei, name: name || lei, role: role, country: country };
    byId[lei] = n; nodes.push(n); return n;
  }
  function addLink(parentLei, childLei) {
    if (!parentLei || !childLei) return;
    var key = parentLei + '>' + childLei;
    if (addLink._seen && addLink._seen[key]) return;
    (addLink._seen = addLink._seen || {})[key] = 1;
    links.push({ source: parentLei, target: childLei });
  }

  // Seed graph from server data.
  addNode(seed.self.lei, seed.self.name, 'self', seed.self.country);
  if (seed.directParent) { addNode(seed.directParent.lei, seed.directParent.legalName, 'parent'); addLink(seed.directParent.lei, seed.self.lei); }
  if (seed.ultimateParent && (!seed.directParent || seed.ultimateParent.lei !== seed.directParent.lei)) {
    addNode(seed.ultimateParent.lei, seed.ultimateParent.legalName, 'parent');
    addLink(seed.ultimateParent.lei, (seed.directParent || seed.self).lei);
  }
  (seed.directChildren || []).forEach(function (c) { addNode(c.lei, c.legalName, 'child', c.country); addLink(seed.self.lei, c.lei); });
  (seed.ultimateChildren || []).forEach(function (c) { addNode(c.lei, c.legalName, 'child', c.country); });
  expanded[seed.self.lei] = true;

  var Graph = ForceGraph()(el)
    .height(Math.min(480, Math.max(320, Math.round(window.innerWidth * 0.5))))
    .backgroundColor('#ffffff')
    .nodeLabel(function (n) { return n.name + (n.country ? ' (' + n.country + ')' : ''); })
    .nodeColor(function (n) { return COLORS[n.role] || COLORS.other; })
    .nodeRelSize(5)
    .linkColor(function () { return '#cbd5e1'; })
    .linkDirectionalArrowLength(4)
    .onNodeClick(handleNodeActivate) // touch/single fallback
    .graphData({ nodes: nodes, links: links });

  // Desktop double-click detection layered over onNodeClick.
  var lastClick = { id: null, t: 0 };
  function handleNodeActivate(node) {
    var now = Date.now();
    if (lastClick.id === node.id && now - lastClick.t < 350) { expand(node); lastClick = { id: null, t: 0 }; }
    else { lastClick = { id: node.id, t: now }; }
  }

  function expand(node) {
    if (!node || expanded[node.id] || inflight[node.id]) return;
    inflight[node.id] = true;
    el.style.cursor = 'progress';
    fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lei: node.id, isPublic: true }),
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (resp) {
        var d = resp && resp.success ? resp.data : null;
        if (!d) return;
        if (d.directParent) { addNode(d.directParent.lei, d.directParent.legalName, 'parent'); addLink(d.directParent.lei, node.id); }
        if (d.ultimateParent) { addNode(d.ultimateParent.lei, d.ultimateParent.legalName, 'parent'); addLink(d.ultimateParent.lei, node.id); }
        (d.directChildren || []).forEach(function (c) { addNode(c.lei, c.legalName, 'child', c.country); addLink(node.id, c.lei); });
        (d.ultimateChildren || []).forEach(function (c) { addNode(c.lei, c.legalName, 'child', c.country); addLink(node.id, c.lei); });
        expanded[node.id] = true;
        Graph.graphData({ nodes: nodes, links: links });
      })
      .catch(function () {})
      .then(function () { inflight[node.id] = false; el.style.cursor = ''; });
  }

  window.addEventListener('resize', function () {
    Graph.width(el.clientWidth).height(Math.min(480, Math.max(320, Math.round(window.innerWidth * 0.5))));
  });
  Graph.width(el.clientWidth);
})();
```

- [ ] **Step 2: Build and serve the site locally**

Run:
```bash
cd /Users/alessandronurnberg/mapasocietario
npm run build
npx wrangler pages dev dist --port 8788
```
Expected: a local URL (http://localhost:8788). (`wrangler` is fetched on first `npx` run; accept the install. The build copies `public/vendor/*` into `dist/vendor/*` and Pages Functions under `functions/` are served.)

- [ ] **Step 3: Manually verify the graph**

In a browser at `http://localhost:8788/empresa/acs`:
- The "Grupo societario (GLEIF)" section appears with a canvas graph + the lists below.
- The graph shows ACS (blue) with subsidiary nodes; hover shows name + country.
- Double-click a subsidiary node → after ~1–3s its own children/parents are added (node count grows, no duplicates).
- With JS disabled, the lists still render (the canvas is empty/absent).

Expected: all of the above hold. If `ForceGraph` is undefined, confirm `/vendor/force-graph.min.js` is reachable at `http://localhost:8788/vendor/force-graph.min.js`.

- [ ] **Step 4: Commit**

```bash
git add public/vendor/gleif-graph.js
git -c commit.gpgsign=false commit -m "feat: interactive GLEIF group graph with double-click expansion"
```

---

## Task 6: Hub loading overlay

**Files:**
- Modify: `functions/empresa/_lib.js` (`HUB_STYLE` ~769–787; `renderHub` body ~847–856)

- [ ] **Step 1: Add overlay styles to `HUB_STYLE`**

In `HUB_STYLE`, before the closing `</style>` (line ~786, after the `footer{...}` rule), add:
```css
  .nav-overlay{position:fixed;inset:0;background:rgba(248,250,252,.92);backdrop-filter:blur(2px);display:none;align-items:center;justify-content:center;flex-direction:column;gap:16px;z-index:9999}
  .nav-overlay.on{display:flex}
  .nav-overlay .spin{width:38px;height:38px;border:3px solid var(--line);border-top-color:var(--brand);border-radius:50%;animation:nv-rot .8s linear infinite}
  .nav-overlay .lbl{font-size:14px;color:var(--mut)}
  .nav-overlay .bar{width:180px;height:3px;border-radius:3px;background:var(--line);overflow:hidden}
  .nav-overlay .bar::after{content:"";display:block;height:100%;width:40%;background:var(--brand);animation:nv-slide 1.1s ease-in-out infinite}
  @keyframes nv-rot{to{transform:rotate(360deg)}}
  @keyframes nv-slide{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}
  @media (prefers-reduced-motion: reduce){.nav-overlay .spin,.nav-overlay .bar::after{animation:none}}
```

- [ ] **Step 2: Add the overlay markup + script to `renderHub`**

In `renderHub`, change the closing of the `.wrap` block (lines ~855–856) from:
```js
  <footer>${t.footer('—')}</footer>
</div>
</body>
```
to:
```js
  <footer>${t.footer('—')}</footer>
</div>
<div class="nav-overlay" id="navOverlay" role="status" aria-live="polite">
  <div class="spin"></div>
  <div class="lbl" id="navOverlayLbl"></div>
  <div class="bar"></div>
</div>
<script>
(function(){
  var ov=document.getElementById('navOverlay'), lbl=document.getElementById('navOverlayLbl');
  document.querySelectorAll('td.name a').forEach(function(a){
    a.addEventListener('click', function(){
      if (a.target==='_blank') return;
      lbl.textContent='${lang === 'en' ? 'Loading' : 'Cargando'} ' + (a.textContent||'').trim() + '…';
      ov.classList.add('on');
    });
  });
  window.addEventListener('pageshow', function(e){ if(e.persisted) ov.classList.remove('on'); });
})();
</script>
</body>
```

- [ ] **Step 3: Manually verify the overlay**

With `npx wrangler pages dev dist` running, open `http://localhost:8788/empresas-cotizadas` and click any company row.
Expected: a full-screen overlay with spinner, "Cargando <company>…", and a moving progress bar appears immediately, then the company page loads. Navigating back (bfcache) shows no stuck overlay.

- [ ] **Step 4: Commit**

```bash
git add functions/empresa/_lib.js
git -c commit.gpgsign=false commit -m "feat: loading overlay when opening a company from the IBEX 35 hub"
```

---

## Task 7: Light-theme polish

**Files:**
- Modify: `functions/empresa/_lib.js` (`STYLE` ~426–472; `HUB_STYLE` ~769–787)

- [ ] **Step 1: Add section-card, chip, and GLEIF-graph styles to `STYLE`**

In `STYLE`, before the closing `</style>` (line ~471, after the `footer{...}` rule), add:
```css
  section{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:18px 0;box-shadow:0 1px 2px rgba(15,23,42,.04)}
  section h2{margin-top:0;border-top:0;padding-top:0}
  .chip{display:inline-block;font-size:11px;font-weight:600;background:#f1f5f9;color:#475569;border:1px solid var(--line);border-radius:6px;padding:1px 7px;letter-spacing:.02em}
  .muted{color:var(--mut);font-size:12px}
  .gleif-graph{width:100%;min-height:320px;border:1px solid var(--line);border-radius:12px;background:#fff;margin:8px 0 14px;overflow:hidden}
  .gleif h3{margin-top:18px}
```
Note: existing `cnmvBlock`/`boeBlock`/`gleifBlock`/`cotizadaBlock` already render inside `<section>`, so they pick up the card treatment automatically.

- [ ] **Step 2: Tighten hub typography + add row hover to `HUB_STYLE`**

In `HUB_STYLE`, replace the `td.name a` rule (line ~783) and add hover. Change:
```css
  td.name a{font-weight:600;text-decoration:none}
```
to:
```css
  td.name a{font-weight:600;text-decoration:none}
  tbody tr{transition:background .12s ease}
  tbody tr:hover{background:#f8fafc;cursor:pointer}
  td.name a:hover{text-decoration:underline}
```

- [ ] **Step 3: Verify pages still render and the check passes**

Run:
```bash
node scripts/check-gleif-render.mjs
node -e "import('./functions/empresa/_lib.js').then(m=>console.log(m.renderHub('es').includes('nav-overlay')?'hub ok':'hub MISSING overlay'))"
```
Expected: `check-gleif-render: OK` and `hub ok`.

- [ ] **Step 4: Manually verify visual polish**

With `npx wrangler pages dev dist` running: `/empresa/acs` shows sectioned cards with subtle borders/shadow and country chips in the GLEIF lists; `/empresas-cotizadas` shows row hover. Confirm it reads as the same product family as `/app` (brand blue, clean spacing).

- [ ] **Step 5: Commit**

```bash
git add functions/empresa/_lib.js
git -c commit.gpgsign=false commit -m "style: polish IBEX 35 company + hub pages (section cards, chips, hover)"
```

---

## Task 8: Default the Datos panel to collapsed on mobile

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx:691`

- [ ] **Step 1: Change the initial state to a mobile-aware lazy initializer**

In `src/components/SpanishCompanyNetworkGraph.jsx`, change line 691 from:
```js
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);
```
to:
```js
  // Default collapsed on phones so the Datos panel doesn't cover half the screen; open on desktop.
  const [isTableCollapsed, setIsTableCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );
```

- [ ] **Step 2: Verify the dev build compiles**

Run:
```bash
cd /Users/alessandronurnberg/mapasocietario
npm run build
```
Expected: build succeeds with no errors referencing `SpanishCompanyNetworkGraph.jsx`.

- [ ] **Step 3: Manually verify in the dev server**

Run `npm run dev`, open `/app`, search a company to reveal the Datos panel:
- Desktop width (≥768px): panel starts expanded (width 520) as before.
- Narrow viewport (<768px, via devtools device toolbar, then reload): panel starts collapsed (`width:auto`); the toggle still expands it.

Expected: both behaviors hold.

- [ ] **Step 4: Commit**

```bash
git add src/components/SpanishCompanyNetworkGraph.jsx
git -c commit.gpgsign=false commit -m "fix: collapse Datos panel by default on mobile"
```

---

## Final verification

- [ ] **Run the pure-render check:** `node scripts/check-gleif-render.mjs` → `check-gleif-render: OK`.
- [ ] **Build:** `npm run build` → succeeds.
- [ ] **Serve & manual sweep** (`npx wrangler pages dev dist`):
  - `/empresa/acs`: shareholders → **GLEIF graph + lists** → directors → BOE → capital → events; double-click expands a node; country chips show; section cards styled.
  - A company without a LEI (if any unresolved in Task 2) shows no GLEIF section, no errors.
  - `/empresas-cotizadas`: row hover; clicking a company shows the loading overlay.
  - `/en/company/acs`: English labels for the GLEIF section.
- [ ] **Search app** (`npm run dev`, `/app`): Datos panel collapsed on mobile width, open on desktop.
- [ ] All tasks committed.

## Notes / known constraints

- The `/lei-relationships` endpoint fans out to ~5 GLEIF calls; cold company-page renders can approach the 10s budget but are edge-cached for 24h, and the hub overlay covers the wait. GLEIF failures degrade gracefully to "no section."
- `force-graph` is self-hosted (no third-party CDN/CSP concerns). The browser calls `api.ncdata.eu` directly for expansion; CORS for `mapasocietario.es` is already configured on that worker.
- LEIs that cannot be resolved from the Spanish ISIN (foreign-domiciled IBEX entities) are handled by omitting the GLEIF section for that company; revisit by adding their LEI manually from search.gleif.org if desired.
