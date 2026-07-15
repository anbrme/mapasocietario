# Trademarks / Marcas Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public, free "Trademarks / Marcas" click-to-load panel to each `/empresa/:slug` page that surfaces a company's EU trademarks (EUIPO) plus eponymous Spanish national marks (OEPM), mirroring the existing subsidies panel.

**Architecture:** Frontend stays dumb (one fetch, one XSS-safe render) served from `functions/empresa/_lib.js`; the backend (`ncdata-bormes`, separate repo) does the dual-source fan-out because the EUIPO OAuth `client_secret` must never reach the browser; the new backend route must be allowlisted in the api-proxy worker (`local-rag`, separate repo). Feature flag `TRADEMARKS_PANEL_ENABLED` defaults off so the frontend can ship ahead of the backend.

**Tech Stack:** JavaScript (Cloudflare Pages Functions SSR string builder), vitest (node env), Flask/Python backend (other repo), Cloudflare Worker (other repo). Design spec: `docs/superpowers/specs/2026-07-15-oepm-trademarks-panel-design.md`.

## Global Constraints

- **Immutability:** never mutate inputs; build new strings/objects.
- **XSS-safe frontend:** DOM construction only (`textContent`, `createElement`, URL-guard `/^https?:\/\//`), never `innerHTML`. Escape all interpolated values in SSR strings via existing `esc()`.
- **Secrets server-side only:** no EUIPO/OEPM credential or token ever reaches the browser or the frontend repo.
- **Backend contract (verbatim):** `GET /bormes/trademarks-by-company?name=<canonical>&nif=<optional>&lang=es|en`. Success → `{ success:true, marks:[{source,denomination,status,type,niceClasses,date,imageUrl,holder,officeUrl}], counts:{euipo,oepm,total}, partial:false, coverageNote:"<localized>", source_url }`. Flag dark → `{ disabled:true }`. Error → `{ success:false }`.
- **Normalized enums:** `status` ∈ `Registered | Pending | Opposed | Expired | Withdrawn | Unknown`; `type` ∈ `Denominative | Figurative | Mixed | Other`.
- **Renders for every company** (no NIF gate — `company.name` always exists), unlike subsidies.
- **Compliance copy (must appear in panel):** "Data: EUIPO / TMview"; "unofficial, may be incomplete, verify at source"; "not affiliated with or endorsed by EUIPO"; no EUIPO logo. Do NOT display applicant postal addresses.
- **EUIPO chain (confirmed sandbox):** `GET /persons/applicants?name=&country=ES` → applicant `identifier` → `GET /trademark-search/trademarks?query=applicants.identifier==<id>`. Base sandbox `https://api-sandbox.euipo.europa.eu`, prod `https://api.euipo.europa.eu`.
- **i18n:** every new user-facing string exists in BOTH the `es` and `en` `t` dictionaries in `_lib.js`.
- `marks` sorted by `date` desc; response capped at 100 with `counts.total` = true total.

---

## File Structure

**This repo (`mapasocietario`) — Phase 1 frontend, shippable alone behind the dark flag:**
- Create: `functions/empresa/_trademarks.js` — pure builder `buildTrademarksBlock({ company, t, lang, apiBase, esc })` → SSR section string (extracted so it is unit-testable, keeps `_lib.js` from growing).
- Create: `functions/empresa/_trademarks.test.js` — vitest unit tests for the builder.
- Modify: `functions/empresa/_lib.js` — add `marks*` i18n keys to both `es`/`en` dicts; import and compose `buildTrademarksBlock(...)` right after `${subsidiesBlock}` (~line 1082).
- Modify: `vitest.config.js` — widen `include` so `functions/**/*.test.js` is scanned.

**Other repos — Phase 1 backend + proxy (documented here; execute in their own repos):**
- `ncdata-bormes`: new endpoint `/bormes/trademarks-by-company` + EUIPO adapter + status/type normalization + name-match filter + 24h cache + `TRADEMARKS_PANEL_ENABLED` flag.
- `local-rag`: add the new route to the api-proxy worker dispatch + allowlist.

Phase 2 (OEPM SOAP adapter in `ncdata-bormes`) is out of scope for this plan — same endpoint, no frontend change.

---

## Task 1: Frontend trademarks panel builder (this repo)

**Files:**
- Create: `functions/empresa/_trademarks.js`
- Test: `functions/empresa/_trademarks.test.js`
- Modify: `vitest.config.js`

**Interfaces:**
- Consumes: `esc` (existing HTML-escaper from `_lib.js`, signature `esc(s) => string`), the `t` dictionary (object with `marks*` keys added in Task 2), `lang` (`'es'|'en'`), `apiBase` (string), `company` (object with `.name`, optional `.nif`/`.enriched_nif`).
- Produces: `export function buildTrademarksBlock({ company, t, lang, apiBase, esc }) => string` — a `<section class="marks" id="marks-section">…</section>` SSR string containing the button, a `#marks-body` div carrying `data-name`/`data-nif`/`data-lang`/`data-api`, a `<script type="application/json" id="marks-i18n">` block, and the click-to-load IIFE. Returns `''` if `!company || !company.name`.

- [ ] **Step 1: Write the failing test**

```javascript
// functions/empresa/_trademarks.test.js
import { describe, it, expect } from 'vitest';
import { buildTrademarksBlock } from './_trademarks.js';

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const t = {
  marksTitle: 'Marcas', marksSub: 'sub', marksBtn: 'Ver marcas',
  marksLoading: 'Cargando…', marksEmpty: 'Sin marcas', marksError: 'Error',
  marksRetry: 'Reintentar', marksThMark: 'Marca', marksThStatus: 'Estado',
  marksThClasses: 'Clases', marksThDate: 'Fecha', marksSource: 'Fuente:',
  marksSearchLink: 'TMview', marksCoverage: 'cobertura', marksPartial: 'parcial',
  marksBadgeEu: 'UE', marksBadgeEs: 'ES', marksDisclaimer: 'no afiliado',
};

describe('buildTrademarksBlock', () => {
  it('returns empty string when company has no name', () => {
    expect(buildTrademarksBlock({ company: {}, t, lang: 'es', apiBase: 'https://api.x', esc })).toBe('');
  });

  it('renders a section shell with button, body data attrs and i18n json', () => {
    const html = buildTrademarksBlock({
      company: { name: 'FIESTAS GUIRCA SL', nif: 'B12345678' },
      t, lang: 'es', apiBase: 'https://api.ncdata.eu', esc,
    });
    expect(html).toContain('id="marks-section"');
    expect(html).toContain('id="marks-btn"');
    expect(html).toContain('id="marks-body"');
    expect(html).toContain('data-name="FIESTAS GUIRCA SL"');
    expect(html).toContain('data-nif="B12345678"');
    expect(html).toContain('data-lang="es"');
    expect(html).toContain('data-api="https://api.ncdata.eu"');
    expect(html).toContain('id="marks-i18n"');
    expect(html).toContain('/bormes/trademarks-by-company?name=');
    expect(html).toContain(t.marksDisclaimer);
  });

  it('escapes the company name in the data attribute', () => {
    const html = buildTrademarksBlock({
      company: { name: 'A & B "quote" <x>' },
      t, lang: 'en', apiBase: 'https://api.x', esc,
    });
    expect(html).toContain('data-name="A &amp; B &quot;quote&quot; &lt;x&gt;"');
    expect(html).not.toContain('data-name="A & B "quote" <x>"');
  });

  it('renders even when no nif is present (data-nif empty)', () => {
    const html = buildTrademarksBlock({ company: { name: 'ACME' }, t, lang: 'es', apiBase: 'https://api.x', esc });
    expect(html).toContain('data-nif=""');
  });

  it('does not use innerHTML in the client IIFE', () => {
    const html = buildTrademarksBlock({ company: { name: 'ACME' }, t, lang: 'es', apiBase: 'https://api.x', esc });
    expect(html).not.toContain('innerHTML');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run functions/empresa/_trademarks.test.js`
Expected: FAIL — `Failed to resolve import "./_trademarks.js"` / `buildTrademarksBlock is not a function`. (If vitest reports "No test files found", do Step 3's vitest.config change first, then re-run.)

- [ ] **Step 3: Widen vitest include to scan functions/**

In `vitest.config.js`, change `include: ['src/**/*.test.js'],` to `include: ['src/**/*.test.js', 'functions/**/*.test.js'],`.

- [ ] **Step 4: Write minimal implementation**

Create `functions/empresa/_trademarks.js`. Mirror the subsidies IIFE (`_lib.js:885–946`) exactly for structure, XSS-safety, and the `{disabled:true}`/`{success:false}` handling. The `\\` escapes inside the template are deliberate — the inline `<script>` runs in the browser, not at build time. The `.replace(/[  ]/…)` guard matches the subsidies JSON serialization.

```javascript
// Trademarks / Marcas panel — click-to-load expander on /empresa.
// Pull-not-push: SSR emits an empty shell; the inline script fetches on click.
// The endpoint ships behind TRADEMARKS_PANEL_ENABLED; while dark it answers
// {disabled:true} and the script hides the whole section. Renders for every
// company (name always exists), unlike subsidies which gate on NIF.

/**
 * @param {{ company: { name?: string, nif?: string, enriched_nif?: string },
 *           t: Record<string,string>, lang: string, apiBase: string,
 *           esc: (s: unknown) => string }} args
 * @returns {string}
 */
export function buildTrademarksBlock({ company, t, lang, apiBase, esc }) {
  if (!company || !company.name) return '';
  const rawNif = company.nif || company.enriched_nif || '';
  const marksI18n = {
    loading: t.marksLoading,
    empty: t.marksEmpty,
    error: t.marksError,
    retry: t.marksRetry,
    thMark: t.marksThMark,
    thStatus: t.marksThStatus,
    thClasses: t.marksThClasses,
    thDate: t.marksThDate,
    source: t.marksSource,
    searchLink: t.marksSearchLink,
    coverage: t.marksCoverage,
    partial: t.marksPartial,
    badgeEu: t.marksBadgeEu,
    badgeEs: t.marksBadgeEs,
  };
  const marksJson = JSON.stringify(marksI18n)
    .replace(/</g, '\\u003c')
    .replace(/[  ]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

  return `<section class="marks" id="marks-section">
        <h2>${t.marksTitle}</h2>
        <p class="more">${t.marksSub}</p>
        <button type="button" id="marks-btn" class="subs-btn">${t.marksBtn}</button>
        <div id="marks-body" data-name="${esc(company.name)}" data-nif="${esc(rawNif)}" data-lang="${esc(lang)}" data-api="${apiBase}"></div>
        <script type="application/json" id="marks-i18n">${marksJson}</script>
        <script>
        (function(){
          var btn=document.getElementById('marks-btn');
          var body=document.getElementById('marks-body');
          if(!btn||!body||!window.fetch)return;
          var L=JSON.parse(document.getElementById('marks-i18n').textContent);
          var lang=body.getAttribute('data-lang')||'es';
          function fdate(d){var m=/^(\\d{4})-(\\d{2})-(\\d{2})/.exec(d||'');return m?m[3]+'/'+m[2]+'/'+m[1]:(d||'')}
          function note(msg){body.textContent='';var p=document.createElement('p');p.className='more';p.textContent=msg;body.appendChild(p)}
          function fail(){btn.disabled=false;btn.textContent=L.retry;note(L.error)}
          function badge(src){var s=document.createElement('span');s.className='chip';s.textContent=(src==='OEPM'?L.badgeEs:L.badgeEu);return s}
          function render(j){
            btn.hidden=true;body.textContent='';
            var list=j.marks||[];
            if(!list.length){note(L.empty);
              var cov0=document.createElement('p');cov0.className='more';cov0.textContent=j.coverageNote||L.coverage;body.appendChild(cov0);
              return}
            var table=document.createElement('table');table.className='t';
            var thead=document.createElement('thead');var trh=document.createElement('tr');
            ['',L.thMark,L.thStatus,L.thClasses,L.thDate].forEach(function(h){var th=document.createElement('th');th.textContent=h;trh.appendChild(th)});
            thead.appendChild(trh);table.appendChild(thead);
            var tbody=document.createElement('tbody');
            list.forEach(function(m){
              var tr=document.createElement('tr');
              var tdB=document.createElement('td');tdB.appendChild(badge(m.source));tr.appendChild(tdB);
              var tdM=document.createElement('td');
              if(m.imageUrl&&/^https:\\/\\//.test(m.imageUrl)){
                var img=document.createElement('img');img.src=m.imageUrl;img.alt='';img.className='mark-img';img.loading='lazy';tdM.appendChild(img);tdM.appendChild(document.createTextNode(' '));
              }
              var label=m.denomination||'';
              if(m.officeUrl&&/^https?:\\/\\//.test(m.officeUrl)){
                var a=document.createElement('a');a.href=m.officeUrl;a.rel='nofollow noopener';a.target='_blank';a.textContent=label;tdM.appendChild(a);
              }else{tdM.appendChild(document.createTextNode(label))}
              if(m.holder){var hs=document.createElement('span');hs.className='muted';hs.textContent=' — '+m.holder;tdM.appendChild(hs)}
              tr.appendChild(tdM);
              var tdS=document.createElement('td');tdS.textContent=m.status||'';tr.appendChild(tdS);
              var tdC=document.createElement('td');tdC.textContent=(m.niceClasses||[]).join(', ');tr.appendChild(tdC);
              var tdD=document.createElement('td');tdD.textContent=fdate(m.date);tr.appendChild(tdD);
              tbody.appendChild(tr);
            });
            table.appendChild(tbody);body.appendChild(table);
            if(j.partial){var pp=document.createElement('p');pp.className='more';pp.textContent=L.partial;body.appendChild(pp)}
            var cov=document.createElement('p');cov.className='more';cov.textContent=j.coverageNote||L.coverage;body.appendChild(cov);
            var src=document.createElement('p');src.className='more';
            src.appendChild(document.createTextNode(L.source+' '));
            var a1=document.createElement('a');a1.href=(j.source_url&&/^https?:\\/\\//.test(j.source_url))?j.source_url:'https://www.tmdn.org/tmview/';a1.rel='nofollow noopener';a1.target='_blank';a1.textContent=L.searchLink;
            src.appendChild(a1);body.appendChild(src);
          }
          btn.addEventListener('click',function(){
            btn.disabled=true;btn.textContent=L.loading;
            fetch(body.getAttribute('data-api')+'/bormes/trademarks-by-company?name='+encodeURIComponent(body.getAttribute('data-name'))+'&nif='+encodeURIComponent(body.getAttribute('data-nif'))+'&lang='+encodeURIComponent(lang))
              .then(function(r){return r.json()})
              .then(function(j){
                if(j&&j.disabled){document.getElementById('marks-section').hidden=true;return}
                if(!j||!j.success){fail();return}
                render(j);
              })
              .catch(fail);
          });
        })();
        </scr${''}ipt>
        <p class="more">${t.marksDisclaimer}</p>
      </section>`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run functions/empresa/_trademarks.test.js`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add functions/empresa/_trademarks.js functions/empresa/_trademarks.test.js vitest.config.js
git commit -m "feat: add trademarks panel builder + tests"
```

---

## Task 2: Wire the panel into the page + i18n (this repo)

**Files:**
- Modify: `functions/empresa/_lib.js` (add `marks*` keys to `es` dict ~line 294, to `en` dict ~line 436; import builder at top; build `marksBlock` near `subsidiesBlock` ~line 947; compose after `${subsidiesBlock}` at ~line 1082).

**Interfaces:**
- Consumes: `buildTrademarksBlock` from Task 1; existing `esc`, `API_BASE`, `t`, `lang`, `company` in scope inside `renderCompanyPage`.
- Produces: rendered `marksBlock` string placed in the page body.

- [ ] **Step 1: Add the import at the top of `_lib.js`**

Add near the other module imports (`_lib.js` uses ESM `export`, so use `import`):

```javascript
import { buildTrademarksBlock } from './_trademarks.js';
```

- [ ] **Step 2: Add `marks*` keys to the Spanish `t` dictionary**

After the `subsAviso: 'Aviso legal',` line (~line 294), add:

```javascript
    marksTitle: 'Marcas registradas',
    marksSub: 'Marcas de la UE de esta empresa (EUIPO) y marcas nacionales españolas que llevan su nombre. Se cargan solo si lo solicitas.',
    marksBtn: 'Ver marcas registradas',
    marksLoading: 'Cargando…',
    marksEmpty: 'No se han encontrado marcas para esta empresa.',
    marksError: 'No se pudieron cargar las marcas.',
    marksRetry: 'Reintentar',
    marksThMark: 'Marca',
    marksThStatus: 'Estado',
    marksThClasses: 'Clases de Niza',
    marksThDate: 'Fecha',
    marksSource: 'Fuente: EUIPO / TMview.',
    marksSearchLink: 'Consultar en TMview',
    marksCoverage: 'Muestra las marcas de la UE de esta empresa y las marcas nacionales españolas que llevan su nombre. Una marca nacional con una denominación distinta puede no aparecer — consulta el registro completo de la OEPM.',
    marksPartial: 'Algunas fuentes no estaban disponibles; los resultados pueden estar incompletos.',
    marksBadgeEu: 'UE',
    marksBadgeEs: 'ES',
    marksDisclaimer: 'Datos: EUIPO / TMview. Información no oficial, puede estar incompleta; verifique en origen. No afiliado a la EUIPO ni respaldado por ella.',
```

- [ ] **Step 3: Add `marks*` keys to the English `t` dictionary**

After the `subsAviso: 'Legal notice',` line (~line 436), add:

```javascript
    marksTitle: 'Registered trademarks',
    marksSub: "This company's EU trademarks (EUIPO) plus Spanish national marks bearing its name. Loaded only on request.",
    marksBtn: 'View registered trademarks',
    marksLoading: 'Loading…',
    marksEmpty: 'No trademarks found for this company.',
    marksError: 'Could not load the trademarks.',
    marksRetry: 'Retry',
    marksThMark: 'Mark',
    marksThStatus: 'Status',
    marksThClasses: 'Nice classes',
    marksThDate: 'Date',
    marksSource: 'Source: EUIPO / TMview.',
    marksSearchLink: 'Check on TMview',
    marksCoverage: 'Shows this company’s EU trademarks plus Spanish national marks bearing its name. A national mark under a different brand name may not appear — search the full OEPM register.',
    marksPartial: 'Some sources were unavailable; results may be incomplete.',
    marksBadgeEu: 'EU',
    marksBadgeEs: 'ES',
    marksDisclaimer: 'Data: EUIPO / TMview. Unofficial, may be incomplete; verify at source. Not affiliated with or endorsed by EUIPO.',
```

- [ ] **Step 4: Compose the block into the page**

Near where `subsidiesBlock` is built (~line 947, before the `return`), add:

```javascript
  const marksBlock = buildTrademarksBlock({ company, t, lang, apiBase: API_BASE, esc });
```

and in the returned template, right after `${subsidiesBlock}` (~line 1082):

```javascript
  ${subsidiesBlock}

  ${marksBlock}
```

- [ ] **Step 5: Run the full test suite + SSR smoke check**

Run: `npx vitest run`
Expected: all existing tests PASS + the 5 new trademarks tests PASS.

Run: `node --input-type=module -e "import('./functions/empresa/_lib.js').then(m=>{const h=m.renderCompanyPage({name:'FIESTAS GUIRCA SL',nif:'B12345678'},[],'fiestas-guirca-sl',{lei:''},'es');if(!h.includes('id=\"marks-section\"'))throw new Error('marks section missing');if(!h.includes('Marcas registradas'))throw new Error('ES title missing');console.log('SSR OK: marks section present')})"`
Expected: `SSR OK: marks section present`

- [ ] **Step 6: Commit**

```bash
git add functions/empresa/_lib.js
git commit -m "feat: wire trademarks panel into /empresa page + bilingual copy"
```

---

## Task 3 (other repo `ncdata-bormes`): backend endpoint + EUIPO adapter

> Execute in the `ncdata-bormes` repo. Documented here for completeness; not runnable from `mapasocietario`. Follows the same pattern as the existing `subsidies-by-nif` endpoint. Contract is fully specified in Global Constraints.

**Deliverable:** `GET /bormes/trademarks-by-company?name=&nif=&lang=` behind `TRADEMARKS_PANEL_ENABLED` (default off → `{disabled:true}`).

- [ ] EUIPO OAuth2 `client_credentials` token fetch, cached until expiry; creds from env `EUIPO_CLIENT_ID`/`EUIPO_CLIENT_SECRET`, base URL from env (sandbox in staging, prod after approval).
- [ ] Step 1 — `GET /persons/applicants?name=<normalized name>&country=ES`; collect `identifier`s; filter by normalized-name match (reimplement `normalizeCompanyName` rules server-side: uppercase, strip legal-form suffixes/punctuation). **Never surface `address`.**
- [ ] Step 2 — for each identifier `GET /trademark-search/trademarks?query=applicants.identifier==<id>`; map each: `denomination` = `wordMarkSpecification.verbalElement` (WORD marks; figurative → label by type), `status` normalized to enum, `type` normalized, `niceClasses`, `date` = registrationDate||applicationDate, `holder` = matched applicant name, `officeUrl`, `imageUrl` (confirm URL pattern in sandbox; omit if none).
- [ ] Normalize status/type; sort by `date` desc; cap 100; set `counts.euipo`, `counts.oepm=0`, `counts.total`; `coverageNote` localized by `lang`; `source_url='https://www.tmdn.org/tmview/'`.
- [ ] Resilience: 8s timeout per upstream call; on EUIPO failure with no results → `{success:false}`; wrap so a partial (Phase 2) source failure sets `partial:true`. 24h cache keyed by `name`+`nif`.
- [ ] Unit tests with recorded EUIPO fixtures: status/type normalization, name-match filter (true positives kept, false positives dropped), cap/sort, disabled-flag path.
- [ ] Deploy: push `main` → CI fast-forwards `server-current` → ssh deploy → restart `borme-search.service`.

## Task 4 (other repo `local-rag`): api-proxy worker allowlist

> Execute in the `local-rag` repo.

- [ ] Add `/bormes/trademarks-by-company` to the api-proxy worker dispatch + allowlist (same place the subsidies route was added). Without this the worker 404s before Flask is reached.
- [ ] Deploy the worker.

## Go-live gates (human)

- [ ] EUIPO: build/test on Sandbox (no docs needed); for production, email required documentation to `docs.apiplatform@euipo.europa.eu` and await approval; set prod `EUIPO_CLIENT_ID`/`EUIPO_CLIENT_SECRET`.
- [ ] Read EUIPO data-protection statement before go-live (GDPR §3.5f).
- [ ] Flip `TRADEMARKS_PANEL_ENABLED` on; verify end-to-end on a live allowlisted origin (localhost fails on CORS) with a company that has known EUTMs.

---

## Self-Review

- **Spec coverage:** Goal ✓ (Tasks 1–2 frontend, 3 backend). Backend contract ✓ (Global Constraints + Task 3). Matching strategy/two-step EUIPO ✓ (Task 3). Frontend rendering incl. source badge, status chip, Nice, date, thumbnail URL-guard, coverage note, XSS-safe DOM ✓ (Task 1). i18n both langs ✓ (Task 2). Phasing ✓ (Task 3 EUIPO-only; OEPM deferred). Compliance copy (attribution/unofficial/non-endorsement, no address) ✓ (Global Constraints + disclaimer key). Testing ✓ (Task 1 vitest, Task 3 fixtures, go-live manual). Cross-repo deploy gates ✓ (Tasks 3–4 + go-live).
- **Placeholder scan:** frontend tasks (1–2) contain full code/commands, no placeholders. Tasks 3–4 are cross-repo and intentionally checklist-level (they run in repos not present here); their contract is fully specified in Global Constraints.
- **Type consistency:** `buildTrademarksBlock({ company, t, lang, apiBase, esc })` signature identical in Task 1 definition and Task 2 call site. i18n keys (`marks*`) identical between the builder's `marksI18n` map, the test's `t` stub, and the dictionaries in Task 2. Backend field names (`denomination,status,type,niceClasses,date,imageUrl,holder,officeUrl,source`) identical between contract and the client `render()`.
