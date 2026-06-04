# GLEIF graph fixes + country map tab — design

Date: 2026-06-04
Status: approved-for-planning

## Goal

Follow-up refinements to the GLEIF corporate-group section on the IBEX 35 SEO
pages (`/empresa/:slug`, `/en/company/:slug`):

1. **Show all subsidiaries in the graph** (including ultimate-only descendants),
   linked to the focal node so nothing floats — fixes companies like
   ArcelorMittal whose graph showed only a lone node.
2. **Visible node labels** (drawn on the nodes, revealed on zoom for dense groups)
   instead of hover-only tooltips.
3. **A "Mapa" tab** with a world choropleth (jsVectorMap) shading countries by the
   number of group entities.

Out of scope this round: the BOE-mentions relevance problem (the bad matching is
on the upstream bormes backend, not reachable from these repos — leave BOE as-is).

## Context / current state

- The GLEIF section is built in `renderCompanyPage` (`functions/empresa/_lib.js`)
  as `gleifBlock`. It already emits: a summary line, `<div id="gleif-graph">`,
  `<script type="application/json" id="gleif-graph-data">` (shape
  `{ self:{lei,name,country}, directParent:{lei,legalName}|null, ultimateParent:{lei,legalName}|null, directChildren:[{lei,legalName,country,entityStatus}], ultimateChildren:[…] }`),
  the parents/subsidiary tables, and `<script defer>` tags for
  `/vendor/force-graph.min.js` and `/vendor/gleif-graph.js`.
- `public/vendor/gleif-graph.js` currently hydrates a force-graph from that JSON
  with **direct children only** (a prior fix removed ultimate children to stop
  floating nodes — that was wrong: it hid real subsidiaries). Labels are
  hover-only (`nodeLabel` tooltip). Double-click expands via
  `POST https://api.ncdata.eu/lei-relationships`.
- `public/` is Vite's static dir → served at `/vendor/...`. `/vendor/*` has a
  1-day `Cache-Control` header in `public/_headers`.
- These pages are server-rendered HTML (no React runtime), so the map must be
  vanilla. GLEIF country codes are ISO 3166-1 alpha-2 uppercase (ES, US, GB, BR,
  PL, LU, NL…). Parent objects carry no country (only children/self do).
- `force-graph` (UMD global `ForceGraph`) is already vendored. It supports
  `nodeCanvasObject`, `nodePointerAreaPaint`, `linkLineDash`, `linkColor`,
  `linkDirectionalArrowLength`, and passes `globalScale` to `nodeCanvasObject`.
  Per the project's known caveat, custom **linkCanvasObject** disables directional
  arrows — but we only override **nodeCanvasObject**, so arrows keep working.

## Decisions (from brainstorming)

- Show all children, ultimate-only ones linked to the focal node, visually
  distinguished from direct subsidiaries.
- Labels visible, revealed on zoom (focal + parents + direct children always).
- Map: **jsVectorMap** (vanilla, MIT), lazy-loaded on first "Mapa" tab open.
- Map shows country distribution only (no extra metrics). Count the focal
  company's own country (ES) too.
- BOE left as-is.

## Part A — graph fixes (`public/vendor/gleif-graph.js`)

### A1. Show all children, linked — HYBRID rule

GLEIF's ultimate-children call returns a flat descendant list with **no
per-entity parentage**, so ultimate-only descendants can only be flat-linked to
the focal node, not to their true parent. To avoid a misleading flat star for
large groups while still fixing sparse ones, use a **hybrid** rule via a single
helper `addChildrenOf(parentLei, directChildren, ultimateChildren)`:

- If `directChildren` is non-empty → add them as role `child`, solid link to the
  parent (true edges). Do NOT pre-load ultimate descendants (deeper levels appear
  via double-click expansion).
- If `directChildren` is empty → add `ultimateChildren` as role `descendant`,
  flat-linked to the parent and marked `indirect: true` (dashed/muted). This is
  what makes ArcelorMittal (0 direct, 1 ultimate) show its subsidiary instead of
  a lone node.

Apply the same helper for the focal node's seed children AND inside `expand()`
for a double-clicked node, so behavior is uniform. `addNode` dedupes by LEI.
`expand()` also adds the clicked node's direct/ultimate parent (chaining
`ultimateParent` through `directParent` when both exist).

### A2. Visual roles and link styles

- `COLORS = { self:'#2563eb', parent:'#7c3aed', child:'#0ea5e9', descendant:'#94a3b8', other:'#64748b' }`
- `.linkColor(l => l.indirect ? '#e2e8f0' : '#cbd5e1')`
- `.linkLineDash(l => l.indirect ? [3,3] : null)`
- Keep `.linkDirectionalArrowLength(4)`.

### A3. Labels on zoom (custom node drawing)

Replace `.nodeLabel(...)`-only with a `nodeCanvasObject(node, ctx, globalScale)`:

- Draw the node circle: radius by role (self/parent/child ≈ 6, descendant ≈ 4),
  filled with the role color.
- Draw the label when `node.role === 'self' || node.role === 'parent' || node.role === 'child'`
  **OR** `globalScale >= 1.4` (so dense `descendant` nodes only label when zoomed
  in). Font: `${Math.max(10, 12 / globalScale) }px` sans-serif (≈ constant screen
  size); text centered below the node; truncate names longer than 28 chars with `…`.
  Use a subtle white text-halo (stroke) for legibility over links.
- Add `nodePointerAreaPaint(node, color, ctx, globalScale)` that fills a circle of
  the node's radius in `color` so click/double-click hit-testing matches the drawn
  node.
- Keep the existing double-click detection and `expand()`.

Retain `nodeLabel` as a fallback tooltip is optional; with on-node labels it can be
dropped. Keep it (harmless) for the full name on hover when labels are truncated.

## Part B — "Mapa" tab + jsVectorMap choropleth

### B1. Tab UI (in `gleifBlock`, `functions/empresa/_lib.js`)

Above the graph container, render two tab buttons and wrap the two panels:

```
<div class="gleif-tabs" role="tablist">
  <button class="gleif-tab on" data-panel="graph">${t.gleifTabGraph}</button>
  <button class="gleif-tab" data-panel="map">${t.gleifTabMap}</button>
</div>
<div id="gleif-graph" class="gleif-graph gleif-panel on" data-self-lei="…"></div>
<div id="gleif-map" class="gleif-map gleif-panel" hidden></div>
```

- Add i18n keys `gleifTabGraph` ('Gráfico' / 'Graph') and `gleifTabMap`
  ('Mapa' / 'Map') to `T.es` and `T.en`.
- The graph panel keeps the default-visible state so force-graph still sizes
  correctly on load. The embedded `#gleif-graph-data` JSON is unchanged (already
  carries all country data).

### B2. Vendored assets (MIT-licensed)

Into `public/vendor/`:
- `jsvectormap.min.js` (core lib; UMD global `jsVectorMap`)
- `jsvectormap-world.js` (world map geometry; registers the `world` map, ISO
  alpha-2 **lowercase** region ids)
- `jsvectormap.min.css`

Pin via a devDependency (`npm i -D jsvectormap`) and copy from
`node_modules/jsvectormap/dist/...`, mirroring how `force-graph.min.js` was
vendored. Record the exact version.

### B3. `public/vendor/gleif-map.js`

- Wire the tab buttons: clicking toggles `.on` on buttons and `hidden`/`.on` on
  panels. The first time the "Mapa" panel is shown, lazy-init the map.
- Lazy init (runs once): if `jsVectorMap` isn't loaded yet, inject the CSS `<link>`
  and the two `<script>`s (`jsvectormap.min.js` then `jsvectormap-world.js`),
  awaiting load; then build the map.
- Build map data: parse `#gleif-graph-data`; tally distinct entities per country
  from the union (by LEI) of `self` + `directChildren` + `ultimateChildren`;
  lowercase the alpha-2 codes; produce `{ es: n, us: n, … }`.
- Instantiate `new jsVectorMap({ selector:'#gleif-map', map:'world', … })` with a
  choropleth via `series.regions` (scale `['#dbeafe','#1e3a8a']`,
  `normalizeFunction:'polynomial'`, `values:` the tally), zoom enabled, and a
  tooltip (`onRegionTooltipShow`) showing `${regionName}: ${count||0} ${t-ish}`.
  (Tooltip label text is built in JS; pass the localized "entidades/entities" word
  via a `data-` attribute on `#gleif-map`, e.g. `data-word-entities`, set from `t`
  server-side, so the client string is localized without hardcoding.)
- Guard everything: if the lib fails to load or `#gleif-graph-data` is missing,
  no-op (the tab simply shows nothing). Progressive enhancement — the subsidiary
  tables already carry the country data.
- Append `<script src="/vendor/gleif-map.js" defer></script>` to `gleifBlock`.

### B4. Styles (in `STYLE`, `functions/empresa/_lib.js`)

- `.gleif-tabs{display:flex;gap:6px;margin:0 0 10px}`
- `.gleif-tab{font:13px;…;border:1px solid var(--line);border-radius:8px;padding:5px 12px;background:#fff;color:var(--mut);cursor:pointer}`
- `.gleif-tab.on{background:var(--brand);color:#fff;border-color:var(--brand)}`
- `.gleif-panel[hidden]{display:none}` ; `.gleif-map{width:100%;min-height:360px;border:1px solid var(--line);border-radius:12px;overflow:hidden}`
- jsVectorMap's own CSS is loaded from the vendored file (lazy).

## Files

- **Modify** `functions/empresa/_lib.js`: `gleifBlock` (tab markup, `#gleif-map`
  panel, `data-word-entities`, `gleif-map.js` script tag); `T.es`/`T.en`
  (`gleifTabGraph`, `gleifTabMap`); `STYLE` (tab + map CSS).
- **Modify** `public/vendor/gleif-graph.js`: A1–A3.
- **Create** `public/vendor/gleif-map.js`.
- **Vendor** `public/vendor/jsvectormap.min.js`, `jsvectormap-world.js`,
  `jsvectormap.min.css` (+ devDependency in `package.json`).
- `scripts/check-gleif-render.mjs`: extend to assert the tab markup and map panel
  render (and that `gleif-map.js` is referenced).

## Risks / edge cases

- **Dense graphs**: the hybrid rule means a company WITH direct children (e.g.
  Acciona) shows only those direct children initially (≤ a few dozen), not all
  ~88 ultimate descendants — deeper levels come via double-click. The label-on-zoom
  rule and muted/dashed descendant styling keep it legible.
- **Flat indirect linking is approximate**: when used (focal/expanded node has no
  direct children), ultimate-only descendants are linked to that node, not to
  their true parent (GLEIF's ultimate-children call doesn't return per-entity
  parentage). The dashed/muted style signals "indirect," the tables give exact
  hierarchy, and double-click reveals true direct relationships. Accepted.
- **jsVectorMap region ids**: world map uses lowercase alpha-2; GLEIF gives
  uppercase — lowercase before building the series. Unknown/oddball codes (e.g.
  territories) simply won't match a region and are ignored (counted in totals but
  not shaded). Acceptable.
- **Panel sizing**: `#gleif-map` starts `hidden`; jsVectorMap is initialized only
  after the panel is shown, so it measures a non-zero container. The graph panel
  is visible by default so force-graph sizes correctly on load.
- **Lazy-load failure**: if vendored scripts 404 or error, the map tab no-ops; the
  graph tab and tables are unaffected.

## Verification

- `node scripts/check-gleif-render.mjs` passes, including new assertions for the
  tab markup, `#gleif-map`, and the `gleif-map.js`/map script references.
- `npm run build` succeeds; `dist/vendor/` contains the four vendored map assets
  + `gleif-map.js`.
- Live (`wrangler pages dev dist`):
  - ArcelorMittal (`/empresa/arcelormittal`): the graph now shows the focal node
    **plus** its ultimate child (connected, dashed link), not a lone node.
  - Acciona (`/empresa/acciona`): direct subsidiaries solid + bright; deeper
    descendants muted + dashed; node labels visible for focal/direct, more on zoom.
  - "Mapa" tab: world choropleth shades ES + subsidiary countries by count; hover
    shows "Country: N entidades"; switching back to "Gráfico" still works.
  - EN page (`/en/company/acciona`): tab labels and tooltip word are in English.
- Double-click expansion still works on production origin (CORS allowlist
  unchanged); local dev expansion remains blocked by CORS (known).
