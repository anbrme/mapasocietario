# In-App Currency Confirmation Surfacing — Design

**Date:** 2026-06-28
**Status:** Design approved; ready to plan
**Related:** [[2026-06-28-company-currency-confirmation-design]] (Phase 1, the SEO-page panel this mirrors in-app), [[project_company_context_layer]]

---

## 1. Problem

Phase 1 shipped the currency-confirmation panel on the server-rendered SEO pages (`/empresa/:slug`, `/en/company/:slug`). But the primary product surface is the in-app search canvas (`/app`), and **the canvas never links to `/empresa/:slug`** — the SEO pages are reached only from Google, the IBEX hub, and the curated set. So a visitor who searches a company in the app **never sees the confirmation**. This task surfaces the same confirmation in the in-app **selected-company detail panel** so searchers actually encounter it.

Scope decision (user, 2026-06-28): **detail panel only** — no node-label marker, no search-result marker (deferred).

## 2. Approach — reuse the logic, re-skin the view

The decay logic, thresholds, copy, and data already exist in `functions/empresa/_confirmation.js` and `_confirmations.js` as plain ESM in this same repo. The SPA imports them at **build time** — no API, no backend, no new data store. The only thing not reused is the HTML-string renderer (`renderConfirmationBlock`), which is styled for the light SEO page and would clash with the dark in-app theme. The in-app view gets its own thin MUI component. **Single source of truth for thresholds and wording stays shared; only presentation forks.**

## 3. Data flow

1. The graph component imports `CONFIRMATIONS` (from `_confirmations.js`), and `confirmationStatus` + `CONFIRMATION_I18N` + `confirmationViewModel` (from `_confirmation.js`).
2. On company selection, derive the slug from the selected company's name via the shared `nameToSlug`, and look up `CONFIRMATIONS[slug]`.
3. If a record exists → render `<CurrencyConfirmationCard>`. If not → render nothing (every other company unchanged — identical gating to the SEO page).

**Slug source — extract a shared helper.** `nameToSlug` currently lives in `functions/empresa/_lib.js:41`, but importing `_lib.js` into the SPA bundle would drag in the whole 1,100-line server renderer plus `SEED`/`resolveSlug`. So extract `nameToSlug` into a tiny new `functions/empresa/_slug.js`; `_lib.js` re-imports it (no behavior change), and the SPA imports it directly. One slug function, no duplication, no server-only code in the bundle.

**Match key:** for the seeded company, in-app `name` (`NURNBERG CONSULTING SL`) → `nameToSlug` → `nurnberg-consulting-sl` → matches the curated key. Matching by derived slug is correct for the curated Phase-1 set (one company). Renamed/variant-name edge cases are out of scope here (same limitation as the curated SEO set).

## 4. Components

### 4.1 `confirmationViewModel(rec, lang, nowMs?)` — pure, in `_confirmation.js`
Returns the render-ready view model so the React layer carries no logic and stays testable without a React test framework (the repo has none):

```
{ title, level: 'fresh'|'aging'|'stale', statusLine, asOf, facts: [{label, status}], disclaimer } | null
```

- `null` when `rec` is missing/invalid (mirrors `renderConfirmationBlock`'s `''`).
- `statusLine` uses the existing fresh vs aged wording; `level` comes from `confirmationStatus`.
- Strings come from the existing i18n table, which is **exported** from `_confirmation.js` as `CONFIRMATION_I18N` (today it's a private `I18N` const) so both the HTML renderer and the view model read identical copy. `renderConfirmationBlock` is refactored to consume `confirmationViewModel` internally so the two surfaces can never drift — same thresholds, same strings, same fresh/aged decision.

### 4.2 `src/components/CurrencyConfirmationCard.jsx` — thin MUI view
Props: `{ rec, lang }`. Calls `confirmationViewModel(rec, lang)`; returns `null` if that's `null`. Renders a dark-theme card:
- Header: `VerifiedIcon` + `title`.
- Status line, color-coded by `level` (fresh = green, aging = amber, stale = grey) — border/tint appropriate to the `#0a0e1a` background, not the SEO page's light palette.
- `asOf` line + affirmed facts as MUI `Chip`s (`current` → success, `none` → neutral).
- Provenance disclaimer (`disclaimer`) verbatim, in muted caption type.

### 4.3 Injection — `SpanishCompanyNetworkGraph.jsx`
At the top of the selected-company detail panel (above the facts grid, ~line 7890), render `<CurrencyConfirmationCard rec={CONFIRMATIONS[nameToSlug(<selected company name>)]} lang={uiLanguage} />`. The card self-suppresses when there's no record, so the lookup can be inline and unconditional. This is the single insertion point in this file.

## 5. Testing

- **`confirmationViewModel`**: node:test cases in `test/confirmation.test.mjs` (or a sibling) — fresh/aging/stale `level` + `statusLine` shape, facts mapping (`current`/`none`), missing record → `null`, ES and EN copy.
- **`renderConfirmationBlock` refactor**: the existing 12 confirmation tests must stay green after it's rewired through `confirmationViewModel` (proves no drift).
- **`nameToSlug` extraction**: existing `test/resolve.test.mjs` and the SEO render tests stay green (no behavior change); a direct `nameToSlug` assertion is added to lock the shared helper.
- **React rendering**: verified manually in-app (no jsdom/RTL in the repo; not adding a framework for one component).

## 6. Out of scope
- Node-label and search-result markers (deferred 2/3 from the discussion).
- Any API/backend change; any new confirmation record or company.
- The free-DD `cs_free` malformed-redirect bug (tracked separately).
- Renamed/variant-name slug resolution beyond the curated set.

## 7. Open questions
1. Exact selected-company name field on the panel object `e` (`e.name` / `e.companyName` / `e.label`) — resolve during implementation by reading the panel header.
2. Whether the in-app card should show the full affirmed-facts list or a condensed form on small screens — default: full list, revisit if cramped.

## 8. Success criteria
Searching the seeded company in `/app`, opening its detail panel, shows the dark-theme confirmation card at the top with the correct decay state, facts, and disclaimer; every other company's panel is unchanged; all existing confirmation/resolve/SEO tests stay green.
