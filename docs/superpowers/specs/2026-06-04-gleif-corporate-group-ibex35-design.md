# GLEIF corporate group on IBEX 35 pages — design

Date: 2026-06-04
Status: approved-for-planning

## Goal

Add the GLEIF corporate group (parent chain + subsidiaries) to the server-rendered
IBEX 35 company pages (`/empresa/:slug`, `/en/company/:slug`), as both crawlable
content and an interactive, expandable graph. Polish the light theme so the pages
feel like the same product as the React search app. Plus two smaller fixes:
a loading indicator when opening a company from the IBEX 35 hub, and reordering
BOE mentions. Separately, default the search app's "Datos" panel to collapsed on
mobile.

## Context / current state

- IBEX 35 pages are server-rendered HTML built in `functions/empresa/_lib.js`
  (`handleCompany` → `renderCompanyPage`; hub via `handleHub` → `renderHub`).
- Each data section is a `<section>` → `<h2>` → table/list → `.more` source note.
  All data is fetched server-side in one `Promise.all` with an 8s `AbortController`
  timeout, and renders to `null`/empty on failure. Pages are edge-cached
  (`s-maxage=86400, stale-while-revalidate=604800`).
- Curated seed: `functions/empresa/_ibex35.js` (`SEED`), keyed by slug, with
  `name, v3Name, nif, isin, ticker, sector, website, hoja` (+ optional `country`,
  `note`). **No `lei` field yet.**
- GLEIF endpoint is live and public: `POST https://api.ncdata.eu/lei-relationships`,
  body `{lei, isPublic:true}`. Returns
  `{success, data:{directParent, ultimateParent, directChildren[], ultimateChildren[]}}`.
  Parent = `{lei, legalName}`; child = `{lei, legalName, entityStatus, country}`.
  (Implemented in `standalone_rag/local-rag/workers/api-proxy/src/lei-api.js`,
  routed at `/lei-relationships`, no auth.) **Needs a LEI; the endpoint does not
  resolve ISIN.** CORS allows `https://mapasocietario.es` for GET/POST/OPTIONS, so
  the browser can call it directly.
- Search app: `src/components/SpanishCompanyNetworkGraph.jsx`. The "Datos" panel
  is the `isTableCollapsed` state (line ~691, defaults `false` = open); the panel
  renders at line ~5589. No `useMediaQuery`/`isMobile` helper exists, but
  `window.innerWidth` is already used (line ~3166).

## Decisions (from brainstorming)

- GLEIF data source: the existing **local-rag `/lei-relationships`** endpoint on
  `api.ncdata.eu` (not the public GLEIF API directly).
- Graph: **progressive enhancement** — server renders the lists (SEO + no-JS),
  an interactive canvas graph hydrates client-side and expands on double-click.
- Loading UX: **full-screen overlay on click** from the hub.
- Theme: **polish the existing light theme** (no dark mode).
- Show **all** ultimate parents and children when available (not just direct).

## Piece 1 — Seed LEI enrichment

Add a `lei` field to each of the 35 `SEED` entries in `_ibex35.js`.

- Resolve ISIN → LEI **once** via the public GLEIF API
  (`GET https://api.gleif.org/api/v1/lei-records?filter[isin]=<ISIN>`, verified
  working) using a throwaway script under `scripts/`. Bake the resulting LEIs into
  `SEED` statically, consistent with the existing curated/verified seed philosophy.
- The script prints any ISIN that fails to resolve so it can be hand-checked
  (e.g. foreign-domiciled entities: Ferrovial NL, ArcelorMittal LU). A seed entry
  with no `lei` simply omits the GLEIF section — graceful, no error.
- The script is run once by the developer; it is not part of the request path.

## Piece 2 — GLEIF corporate-group section (server render)

In `handleCompany`:
- Add a parallel branch to the existing `Promise.all`: only when `seed?.lei`,
  `POST ${API_BASE}/lei-relationships` with `{lei: seed.lei, isPublic:true}` and
  the shared abort signal; map to `null` on any failure (same pattern as CNMV/BOE).
- Bump the abort timeout from 8000ms → 10000ms (that endpoint fans out to ~5 GLEIF
  calls). Still bounded; still cached for 24h after first render.
- Pass the GLEIF result into `renderCompanyPage` as a new argument.

In `renderCompanyPage`, build `gleifBlock` (only when there is data), following the
existing `<section>` convention:
- **Summary line**: parent chain if present (direct parent → ultimate parent),
  otherwise label the company as group parent ("Matriz del grupo" / "Group
  parent"); plus counts — N direct subsidiaries, N ultimate subsidiaries, across
  M countries.
- **Parents** (if any): direct parent and ultimate parent, with country.
- **Subsidiaries**: direct children listed; ultimate children listed in a
  separate collapsed `<details>` (can be 60+). Each row shows legal name + a
  country chip; `entityStatus` other than ACTIVE is flagged subtly.
- **Coherence with search**: each entity name links to `/app?search=<name>` so a
  click opens it in the interactive search graph.
- **Attribution**: `.more` note crediting GLEIF (https://www.gleif.org/) per their
  open-data (CC0) terms, with the company's LEI shown.
- Add all strings to `T.es` and `T.en`.

### Interactive graph (progressive enhancement)

- Server embeds the initial group as JSON in a `<script type="application/json"
  id="gleif-graph-data">`: nodes = focal company + parents + all children, each
  carrying `{lei, name, role: 'self'|'parent'|'ultimateParent'|'child'|
  'ultimateChild', country, status}`; links = parent→company and company→child.
- A `<div id="gleif-graph">` container sits above the lists. If JS does not run,
  it stays empty and the lists provide the content (no SEO loss).
- A small inline script (or a self-hosted `/vendor/force-graph.min.js` — **self-host
  the vanilla `force-graph` UMD build in `public/vendor/`, not a third-party CDN**,
  for reliability/CSP) initialises a force graph from the embedded JSON.
  - Focal company node is brand-blue and centered; parents and children use
    distinct, app-coherent colors; labels show name + country.
  - **Double-click a node** → `POST /lei-relationships` with that node's `lei` →
    merge returned parents/children into the graph (dedupe by LEI), mark the node
    expanded, reheat the simulation. A node with no further relations is marked so
    it isn't re-fetched. Show a tiny inline spinner on the node/graph during fetch.
  - Sizing is responsive and contained within the section card; height capped so
    it does not dominate mobile.
- Library hosting: vendor the minified `force-graph` build into `public/vendor/`
  and reference it with an absolute path from the page. (These SEO routes are
  server-only and not bundled into the SPA/native app, so a normal `<script src>`
  is fine.)

## Piece 3 — Section order

Reorder the sections in `renderCompanyPage` so that: shareholders come before
current officers, the GLEIF group sits right after shareholders, and BOE mentions
move down to just before capital history / events. New order:

1. cotizada / registry facts
2. cnmv + chart
3. **shareholders** (moved up)
4. **GLEIF corporate group** (new — after shareholders)
5. current officers (directors)
6. former officers + role note
7. **BOE mentions** (moved here — before events)
8. capital history
9. events
10. CTA / footer

## Piece 4 — Hub loading overlay

In `renderHub` (and `HUB_STYLE`):
- Add a fixed full-screen overlay (hidden by default) with a branded spinner, the
  clicked company name, and an indeterminate progress bar.
- A small inline script intercepts clicks on company links: show the overlay, then
  allow normal navigation to proceed (the slow part is the server render of the
  target page). The overlay is naturally discarded when the new page loads.
- Respects `prefers-reduced-motion`. Pure progressive enhancement — links still
  work with JS disabled.

## Piece 5 — Theme polish (light)

Refine `STYLE` and `HUB_STYLE` (keep light, keep current HTML structure to protect
SEO):
- Section "cards": subtle border + soft shadow, consistent radius and spacing.
- Tighter, more deliberate typography scale; align brand blue with the app.
- Country chips and a small set of status/role accent colors reused by the GLEIF
  section and graph legend.
- Cleaner hub table (hover state, better column rhythm) and a short intro framing
  the IBEX 35 list, so a visitor arriving from the hub feels continuity with the
  search app.
- No structural/content changes that would affect crawlability.

## Piece 6 — Datos panel default (search app)

In `SpanishCompanyNetworkGraph.jsx`, change the `isTableCollapsed` initial state
from `useState(false)` to a lazy initializer that starts collapsed on mobile:
`useState(() => typeof window !== 'undefined' && window.innerWidth < 768)`.
Desktop keeps the panel open; phones start collapsed so it no longer covers half
the screen. No other behavior changes.

## Out of scope

- Adding GLEIF data into the React search app's own graph.
- Any new backend/endpoint (the `/lei-relationships` endpoint already exists).
- Dark theme for the SEO pages.
- Server-side rendering of the graph as an image.

## Risks / edge cases

- **Cold-load latency**: adding the GLEIF fetch widens the server render; mitigated
  by the 10s timeout, graceful null, 24h edge cache, and the hub loading overlay.
- **Large groups**: ultimate children can be 60+; collapse the list and let the
  graph carry the full structure. Graph may look busy — acceptable and expandable.
- **Unresolved LEIs**: a few foreign-domiciled IBEX entities may not map cleanly
  from the Spanish ISIN; those entries omit the section rather than error.
- **Double-click expansion cost**: each call hits GLEIF via the proxy (~seconds);
  guard against duplicate in-flight requests and already-expanded nodes.
- **Self-hosted lib size**: `force-graph` adds client weight, but only on these
  pages and only after the crawlable HTML; no impact on SEO content.

## Verification

- Script resolves all/most of the 35 ISIN→LEI; report unresolved.
- A seed company with children (e.g. ACS) renders the section + lists; the graph
  hydrates; double-click expands a child and merges nodes without duplicates.
- A company with no `lei` / no data renders no GLEIF section and no errors.
- Page order matches the spec: shareholders → GLEIF → directors → BOE → events.
- Hub: clicking a company shows the overlay immediately.
- Search app: on a narrow viewport the Datos panel starts collapsed; on desktop it
  starts open.
