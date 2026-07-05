# IBEX 35 market-data sidebar — design spec

## Context

Mapa Societario's interactive relationship graph is built entirely from BORME
data. For IBEX 35 companies, the app already has richer context available
elsewhere:

- `functions/empresa/_ibex35.js` — a curated, verified `SEED` map (keyed by a
  clean slug) of the 35 companies, each with `name`, `v3Name` (the exact
  BORME/v3 registry name), `nif`, `isin`, `ticker`, `hoja`, `sector`,
  `website`. Used today only by the SSR `/empresa/:slug` and
  `/empresas-cotizadas` pages — not visible to the SPA graph.
- `ibex35dashboard.ncdata.eu` (separate Cloudflare Worker, same account) — a
  public, rate-limited (`GET /api/companies`, CORS `*`) JSON endpoint
  returning live price/market data and CNMV-sourced significant-shareholder
  data for all 35 companies.

This feature surfaces that data inside the main graph app: when the user is
looking at an IBEX 35 company, a sidebar card shows live market data and
significant shareholders, without requiring any new backend work — both data
sources already exist and are publicly reachable.

Out of scope for this spec: recent-news integration. `ibex35dashboard`'s
`/api/news*` routes exist in code but aren't populated/live, and the
Brave-News proxy that could supply news (`local-rag/workers/api-proxy/src/brave-news.js`)
requires an authenticated, billed local-rag user — incompatible with Mapa
Societario's anonymous, no-login model. That needs its own unauthenticated,
cost-controlled endpoint and is deferred to a follow-up spec.

## Data flow & sourcing

**"Is this company IBEX 35?"** — the existing `SEED` object is the single
source of truth; no new list, no duplication. A new pure utility,
`src/utils/ibex35Match.js`, imports `SEED` directly from
`functions/empresa/_ibex35.js` (the same cross-import pattern
`src/components/CurrencyConfirmationCard.jsx` already uses for
`_confirmation.js`) and exposes:

```js
matchIbexSeed(companyName) // -> SEED entry (with .ticker) | null
```

Matching is a normalized (uppercase + trim) comparison against each entry's
`v3Name`, mirroring the exact-match approach already used elsewhere in the
graph component for GLEIF/AI-panel company resolution.

**Live price + shareholder data** — a new `src/services/ibex35DashboardClient.js`:

- Fetches `https://ibex35dashboard.ncdata.eu/api/companies` (with the
  existing public API key header), caching the full ~35-row array in
  module-level memory for 5 minutes (matching the freshness the upstream
  worker itself targets) so hopping between several IBEX companies in one
  session doesn't re-fetch every time.
- Exposes `getIbexCompanyData(ticker)`, stripping the `BME:` prefix and
  looking up by ticker. Returns the full row (including the `shareholders`
  array) or `null`.
- No new backend/proxy is introduced — the client calls the existing public
  worker endpoint directly, same as any other public consumer of that API.

**Trigger wiring** — `SpanishCompanyNetworkGraph.jsx` already resolves the
focused company via `resolveFocusedCompany()` → `{ name, groupKey }`. A new
`useEffect` keyed on `primarySubject`:

1. Calls `matchIbexSeed(name)`.
2. If matched, calls `getIbexCompanyData(match.ticker)`.
3. Populates sidebar state; a non-match or fetch failure clears it (sidebar
   renders nothing).

## UI placement & precedence

**Component:** `src/components/Ibex35MarketSidebar.jsx`, modeled directly on
`src/components/ApoderadosSidebar.jsx` — non-modal, fixed
`top:0; right:0; bottom:0`, no backdrop (graph stays fully interactive
behind it), narrower (~320px vs Apoderados' 380px) so it reads as a
distinct, lighter element. Renders nothing when there's no match or no data
yet — same "render nothing" convention as `CurrencyConfirmationCard`.

**Trigger behavior:** fully automatic and always in sync with focus — the
card shows whenever the focused node matches an IBEX 35 company, and
disappears the moment focus moves to a non-match. No manual dismiss/sticky
state (unlike Apoderados, which the user explicitly opens/closes).

**Precedence with `ApoderadosSidebar`:** both dock to the same right edge.
`ApoderadosSidebar` is explicit (user clicked to open it); the IBEX card is
automatic. When both would apply, Apoderados wins:

```js
ibexSidebarOpen = Boolean(ibexMatch) && !apoderadosSidebar.open
```

The IBEX card hides while Apoderados is open and reappears automatically
once Apoderados closes, if the focused company is still a match.

`AIInvestigationGate` is a centered `Dialog`, not right-docked, so it has no
positional collision with this sidebar.

## Card content

- **Market-data snapshot** (full set, all fields the API provides): current
  price, change %, market cap, volume, P/E ratio, EPS, 52-week high/low,
  dividend yield. Numbers formatted via `Intl.NumberFormat` with
  `es-ES`/`en-US` locale and EUR currency, consistent with the rest of the
  app.
- **Significant shareholders** (CNMV-sourced, weekly): list of
  `name — percentage%`, sorted by percentage descending, using only
  `is_active` records already filtered server-side. A single "as of
  `reportDate`" line covers the whole section (the data refreshes weekly as
  a batch, not per-shareholder).
- Section/field labels follow the existing `STRINGS = { es: {...}, en: {...} }`
  object pattern from `ApoderadosSidebar.jsx`.

## Error handling

Three states: loading (small spinner in the header, same convention as
Apoderados' `loading` string), loaded (full card as above), and failure
(network error, or ticker not found in the dashboard's dataset). On failure
the sidebar renders nothing — this is a bonus enrichment, not core data, so
a broken-looking card would be worse than no card. A `console.warn` is
logged for diagnosis, matching the existing `[Preview]` warning convention
elsewhere in the graph component.

## Testing

- Unit tests for `matchIbexSeed`: name normalization, no-match, exact-match
  against a handful of real `SEED` entries.
- Unit tests for `ibex35DashboardClient`: ticker lookup, session-level
  caching, and failure handling (mocked `fetch`).
- Component test for `Ibex35MarketSidebar`: renders nothing without a
  match/data, renders the full snapshot + shareholders list given mock data.

Follows the existing test style already in the repo (`graphUnify.test.js`,
`chrome-extension/test/shared/buildGraph.test.js`).
