# In-App "Full Company Page" Link — Design

**Date:** 2026-06-28
**Status:** Design approved; ready to plan
**Related:** [[2026-06-28-in-app-currency-confirmation-surfacing-design]] (same in-app panel), [[project_empresa_url_stability]] (the universal-coverage project this deliberately sidesteps)

---

## 1. Problem

The in-app company detail panel (`SpanishCompanyNetworkGraph.jsx`) has no link to the richer `/empresa` SEO page (registry data + the full confirmation panel + DD CTA). A user viewing a company in `/app` cannot get to its full page. We want a link — but `/empresa/:slug` only resolves for curated + IBEX companies (verified live: `nurnberg-consulting-sl` → 200; `surya-consulting-sl`, `natural-consulting-sl` → 404). Universal coverage is the separate `empresa-url-stability` project (stable canonical slug/ID, ideally hoja-anchored). This task does the honest interim: link **only when the page exists**, otherwise leave the panel as the data preview.

(The connector is out of scope and needs no change: its source link is `/app?search={name}`, which is universal and already works.)

## 2. Behavior

In the in-app company detail panel, at the **end of the Overview/"Resumen" section**, render a **"Ver ficha completa → / View full profile →"** link (with an `OpenInNew` icon, `target="_blank"` to preserve the graph session) **iff** the company's `/empresa` page resolves. For every other company the link is absent and the panel is byte-identical to today. No link ever points at a 404.

## 3. Architecture — a gated href helper

The decision "does this company have a real `/empresa` page, and what is its path?" is one pure function, unit-tested, with the React side staying a thin conditional render.

**`functions/empresa/_page_href.js` — `fullCompanyPageHref(name, lang) → string | null`:**
- `slug = nameToSlug(name)` (existing shared helper).
- `resolveSlug(slug)` (existing pure resolver — the SAME function the `/empresa` route uses to decide 200 vs 404, so the gate is exact).
- If `resolveSlug(...).kind === 'notfound'` → return `null`.
- Else return `lang === 'en' ? '/en/company/' + slug : '/empresa/' + slug` (relative path; the app is same-origin).

Both imports are pure, no network, no `_lib.js` (so no server renderer enters the SPA bundle). `resolveSlug` pulls in the `SEED` + `CURATED` data maps only — already acceptable in the bundle (the panel already imports `CONFIRMATIONS` and `nameToSlug`).

## 4. UI integration

In `src/components/SpanishCompanyNetworkGraph.jsx`:
- Import `fullCompanyPageHref` from `../../functions/empresa/_page_href.js` and MUI's `OpenInNewIcon`.
- At the end of the Overview section (after the facts `Paper`), compute `const fullHref = fullCompanyPageHref(previewData.name, uiLanguage);` and render, only when `fullHref` is truthy, a MUI link/button:
  - `component="a" href={fullHref} target="_blank" rel="noopener"`, label "Ver ficha completa" (es) / "View full profile" (en) + `OpenInNewIcon`.
- `previewData.name` and `uiLanguage` are already in scope in this panel (used by the existing facts + the confirmation card).

## 5. Testing

- **`fullCompanyPageHref`** (`node:test`, new `test/page-href.test.mjs`):
  - a curated name (`'NURNBERG CONSULTING SL'`) → `'/empresa/nurnberg-consulting-sl'` (es) and `'/en/company/nurnberg-consulting-sl'` (en).
  - an IBEX seed name → a non-null href.
  - a clearly non-curated name (`'Surya Consulting SL'`) → `null`.
  - empty/garbage name → `null`.
- **Link rendering**: manual in-app check (no React test framework in the repo — not adding one). Verify the link shows for Nürnberg, opens the `/empresa` page in a new tab, is absent for a non-curated company, and reads in English when the UI is English.

## 6. Out of scope
- Universal `/empresa` coverage (the `empresa-url-stability` project — canonical hoja → stored deduped slug → direct lookup → redirects).
- Any change to the connector / `local-rag` worker.
- Node-label or search-result links (still deferred).
- Any backend/API/data change.

## 7. Success criteria
In `/app`, the seeded/curated company's detail panel shows a "full profile" link at the end of the Overview that opens its `/empresa` page in a new tab; a non-curated company shows no link and is otherwise unchanged; `fullCompanyPageHref` unit tests pass; the full existing suite stays green.
