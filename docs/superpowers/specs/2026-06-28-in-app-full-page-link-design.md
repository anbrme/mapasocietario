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

## 3. Architecture — a gated href helper (reverse lookup by name)

The decision "does this company have a real `/empresa` page, and what is its path?" is one pure function, unit-tested, with the React side staying a thin conditional render.

**Why a reverse lookup, not `resolveSlug(nameToSlug(name))`:** the `/empresa` page resolves for two sets with *different* slug conventions. `CURATED` keys equal `nameToSlug(name)` (Nürnberg's key IS `nurnberg-consulting-sl`), but `SEED` (IBEX) keys are short hand-chosen slugs (`acciona`) that do **not** equal `nameToSlug('ACCIONA SA')` (`acciona-sa`). So `resolveSlug(nameToSlug(name))` would miss every IBEX company (whose page is a live 200). The robust gate is to index both maps by name and look the company up.

**`functions/empresa/_page_href.js` — `fullCompanyPageHref(name, lang) → string | null`:**
- Build once a reverse index over `{ ...SEED, ...CURATED }`: for each `[slug, entry]`, map `nameToSlug(entry.v3Name) → slug`.
- `key = nameToSlug(name)`; if empty → `null`.
- `slug = index[key]`; if absent → `null` (company has no `/empresa` page).
- Else return `lang === 'en' ? '/en/company/' + slug : '/empresa/' + slug` (relative path; the app is same-origin).

This matches the in-app company name (`previewData.name`, the v3 `company_name`) against each curated/seed entry's `v3Name` via the same `nameToSlug` normalisation on both sides — so accent/punctuation/case differences fold away. Imports are pure (`SEED` from `_ibex35.js`, `CURATED` from `_curated.js`, `nameToSlug` from `_slug.js`) — no `_lib.js`, no network, no server renderer in the SPA bundle (the panel already bundles `CONFIRMATIONS`/`nameToSlug`).

## 4. UI integration

In `src/components/SpanishCompanyNetworkGraph.jsx`:
- Import `fullCompanyPageHref` from `../../functions/empresa/_page_href.js` and MUI's `OpenInNewIcon`.
- At the end of the Overview section (after the facts `Paper`), compute `const fullHref = fullCompanyPageHref(previewData.name, uiLanguage);` and render, only when `fullHref` is truthy, a MUI link/button:
  - `component="a" href={fullHref} target="_blank" rel="noopener"`, label "Ver ficha completa" (es) / "View full profile" (en) + `OpenInNewIcon`.
- `previewData.name` and `uiLanguage` are already in scope in this panel (used by the existing facts + the confirmation card).

## 5. Testing

- **`fullCompanyPageHref`** (`node:test`, new `test/page-href.test.mjs`):
  - a curated name (`'NURNBERG CONSULTING SL'`) → `'/empresa/nurnberg-consulting-sl'` (es) and `'/en/company/nurnberg-consulting-sl'` (en).
  - an IBEX seed name (`'ACCIONA SA'`) → `'/empresa/acciona'` (proves the reverse lookup covers the short SEED slugs, which `nameToSlug` alone would miss).
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
