# Conversion visuals: show the product + quick wins

**Date:** 2026-06-09
**Status:** Approved
**Goal:** Increase visitor → report-purchase conversion by showing the actual product (the graph) on the landing page and fixing visual/funnel issues at decision points. No theme refresh, no video, no live embedded graph (explicitly deferred).

## Background

The landing, pricing, and due-diligence pages are well-structured but never *show* the product — the interactive force graph is described only in text cards. Additional conversion issues found in review:

- Hero has three equally-loud CTAs; the green IBEX button visually outshines the primary action.
- `/empresa/:slug` SEO pages link their main CTA to `/app?search=<name>` (`functions/empresa/_lib.js:842`), but nothing consumes the `search` param — visitors land on an empty graph and must retype the name. Dead funnel.
- `DueDiligencePage.jsx` shows a stale **"Coming Soon"** chip on the financial-statements add-on, which is live and sold on /pricing, in the landing FAQ, and in checkout (`dd_include_fs`).
- The two strongest trust assets (sample report PDF, money-back guarantee) are absent from `/pricing` — the page where hesitating buyers decide.
- On the DD page the sample report is only reachable via a collapsed accordion.
- The DD page mixes a Spanish-language monitoring section into an otherwise English page.

## Changes

### 1. Wire `/app?search=` to the graph (enabler + funnel fix)

`src/App.jsx` reads the `search` query param (via `URLSearchParams` on `window.location.search` or `useSearchParams`) and passes it to `SpanishCompanyNetworkGraph` as `initialCompanyName`. The prop already exists and auto-searches in standalone/embedded mode (`SpanishCompanyNetworkGraph.jsx:1013-1017`). No change to the graph component expected.

This fixes the dead CTA on every /empresa page and powers the click-to-try link in change 2.

### 2. Landing page product visual

A real screenshot of a loaded graph for a recognizable IBEX company, placed at the top of the **"How it works"** section of `LandingPage.jsx` (above the six step cards), full width within the 960px section.

- Styled as a browser-window frame (rounded corners, subtle top bar with traffic-light dots, border consistent with existing card borders).
- Plain `<img>` (or `Box component="img"`) with explicit `width`/`height` to avoid CLS; `loading="lazy"` (it is below the fold); prerender-safe (no JS dependency).
- Caption/CTA: "Explore this graph live →" linking to `/app?search=<company>` for the company in the screenshot.
- **Asset:** provided by the user (captured manually from /app). Canonical path: `public/graph-demo.png` (if the user supplies webp/jpg, rename references accordingly). The component ships wired to that filename with an `onError` handler that hides the whole framed-image block, so a missing asset never renders a broken image.

### 3. Hero CTA hierarchy

In `LandingPage.jsx` hero:

- Keep **one** dominant contained button: "Search companies and officers" (unchanged).
- Demote "Publicly-traded companies (IBEX 35)" and "Spain company statistics": smaller (`size="medium"`), neutral outlined styling (subtle border, `text.secondary`-ish color), no green fill/loud accent. They remain in the same row (wrap on mobile) but visually subordinate.
- Trust row, Google Play badge, and legal disclaimer remain unchanged.

### 4. Remove stale "Coming Soon" chip

Delete the `Coming Soon` chip on the financial-statements card in `DueDiligencePage.jsx` (~line 185). Copy stays otherwise; the card already describes the live add-on correctly.

### 5. Trust assets on /pricing

In `PricingPage.jsx`, inside the one-off pricing card near its action buttons, add the same compact trust row used in the landing hero:

- "See a sample report" → `/sample-dd-report.pdf` (orange/warning accent, document icon).
- "Money-back if the data is wrong or inaccurate" (verified icon, green accent).

Same visual pattern as `LandingPage.jsx:443-485` — consider extracting a small shared `TrustRow` component if it stays trivially small; duplication is acceptable if extraction adds friction.

### 6. Sample report visibility on DD page

In `DueDiligencePage.jsx` hero chip row, add a chip/link "See a sample report (PDF)" pointing directly at `/sample-dd-report.pdf` (opens in new tab). The existing accordion with the embedded viewer stays as-is.

### 7. Language consistency on DD page

Translate the "Monitorización gratuita incluida" monitoring card (title, body, chips) to English to match the rest of the page. Meaning unchanged: free BORME + IOSCO monitoring included with every report.

## Out of scope

- Theme/palette refresh, typography pass, color-semantics overhaul.
- Video demo or live embedded mini-graph on the landing page.
- Text-density rewrite of landing copy.
- Any pricing or copy changes beyond what is listed.

## Testing / verification

- `npm run build` passes (includes prerender; landing prerender must still succeed with the new image markup).
- Manual: `/app?search=Inditex` (and an /empresa CTA click) auto-loads the company graph; `/app` with no param behaves exactly as today.
- Manual: landing, pricing, DD pages render correctly at mobile width (hero buttons wrap acceptably; demo image scales).
- No broken-image state if the screenshot asset is absent.
