# GLEIF Graph Fixes + Country Map Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the GLEIF graph so all subsidiaries appear (ultimate-only descendants linked to the focal node via a hybrid rule) with visible on-zoom node labels, and add a "Mapa" tab showing a jsVectorMap world choropleth shaded by group entities per country.

**Architecture:** The IBEX 35 pages are server-rendered HTML from a Cloudflare Pages Function (`functions/empresa/_lib.js`); the GLEIF visualization is progressive enhancement via vanilla client modules in `public/vendor/`. The graph uses the already-vendored `force-graph` UMD lib; the map uses the vanilla `jsVectorMap` (MIT) lib, lazy-loaded on first map-tab open. All data comes from the embedded `#gleif-graph-data` JSON already on the page.

**Tech Stack:** Cloudflare Pages Functions (ES-module HTML templating), vanilla `force-graph` + `jsvectormap` (self-hosted UMD), Node check script. No test framework; verify with `node` checks, `npm run build`, and `npx wrangler pages dev dist` + browser.

**Spec:** `docs/superpowers/specs/2026-06-04-gleif-graph-fixes-country-map-design.md`

---

## File Structure

- **Modify** `public/vendor/gleif-graph.js` — hybrid child linking, dashed indirect links, on-zoom node labels (full rewrite).
- **Modify** `functions/empresa/_lib.js` — `gleifBlock` (tab markup, `#gleif-map` panel, `gleif-map.js` script tag); `T.es`/`T.en` (`gleifTabGraph`, `gleifTabMap`, `gleifMapEntities`); `STYLE` (tab + map CSS).
- **Modify** `scripts/check-gleif-render.mjs` — assert tab markup + map panel + map script reference.
- **Create** `public/vendor/gleif-map.js` — tab switching + lazy choropleth init.
- **Vendor** `public/vendor/jsvectormap.min.js`, `jsvectormap-world.js`, `jsvectormap.min.css` (+ devDependency).

---

## Task 1: Graph fixes (hybrid children + dashed indirect links + on-zoom labels)

**Files:**
- Modify (full rewrite): `public/vendor/gleif-graph.js`

**Hybrid rule:** when a node has direct children, show those (true edges, solid); when it has none, fall back to its ultimate descendants (flat-linked, marked indirect/dashed). This fixes ArcelorMittal (0 direct, 1 ultimate) without turning large groups (Acciona) into a flat 88-node star.

- [ ] **Step 1: Replace the entire contents of `public/vendor/gleif-graph.js` with:**

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

  var COLORS = { self: '#2563eb', parent: '#7c3aed', child: '#0ea5e9', descendant: '#94a3b8', other: '#64748b' };
  var RADIUS = { self: 7, parent: 6, child: 6, descendant: 4, other: 5 };
  var API = 'https://api.ncdata.eu/lei-relationships';
  var LABEL_ZOOM = 1.4; // descendant labels appear at/after this zoom level

  var nodes = [];
  var links = [];
  var byId = {};
  var linkSeen = {};
  var expanded = {};
  var inflight = {};

  function addNode(lei, name, role, country) {
    if (!lei) return null;
    if (byId[lei]) return byId[lei];
    var n = { id: lei, name: name || lei, role: role, country: country };
    byId[lei] = n; nodes.push(n); return n;
  }
  function addLink(src, tgt, indirect) {
    if (!src || !tgt) return;
    var key = src + '>' + tgt;
    if (linkSeen[key]) return;
    linkSeen[key] = 1;
    links.push({ source: src, target: tgt, indirect: !!indirect });
  }

  // Hybrid: prefer DIRECT children (true edges); if none, fall back to ultimate
  // descendants flat-linked to the node and marked indirect (dashed/muted).
  function addChildrenOf(parentLei, directChildren, ultimateChildren) {
    var direct = directChildren || [];
    if (direct.length) {
      direct.forEach(function (c) { addNode(c.lei, c.legalName, 'child', c.country); addLink(parentLei, c.lei, false); });
    } else {
      (ultimateChildren || []).forEach(function (c) { addNode(c.lei, c.legalName, 'descendant', c.country); addLink(parentLei, c.lei, true); });
    }
  }

  // Seed graph.
  addNode(seed.self.lei, seed.self.name, 'self', seed.self.country);
  if (seed.directParent) { addNode(seed.directParent.lei, seed.directParent.legalName, 'parent'); addLink(seed.directParent.lei, seed.self.lei, false); }
  if (seed.ultimateParent && (!seed.directParent || seed.ultimateParent.lei !== seed.directParent.lei)) {
    addNode(seed.ultimateParent.lei, seed.ultimateParent.legalName, 'parent');
    addLink(seed.ultimateParent.lei, (seed.directParent || seed.self).lei, false);
  }
  addChildrenOf(seed.self.lei, seed.directChildren, seed.ultimateChildren);
  expanded[seed.self.lei] = true;

  function nodeRadius(n) { return RADIUS[n.role] || RADIUS.other; }

  function drawNode(node, ctx, globalScale) {
    var r = nodeRadius(node);
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = COLORS[node.role] || COLORS.other;
    ctx.fill();

    var showLabel = node.role === 'self' || node.role === 'parent' || node.role === 'child' || globalScale >= LABEL_ZOOM;
    if (!showLabel) return;
    var label = node.name.length > 28 ? node.name.slice(0, 27) + '…' : node.name;
    var fontSize = Math.max(10, 12 / globalScale);
    ctx.font = fontSize + 'px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var y = node.y + r + 1.5;
    ctx.lineWidth = 3 / globalScale;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(label, node.x, y);
    ctx.fillStyle = '#334155';
    ctx.fillText(label, node.x, y);
  }

  function paintPointerArea(node, color, ctx) {
    var r = nodeRadius(node);
    ctx.beginPath();
    ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function graphHeight() { return Math.min(480, Math.max(320, Math.round(window.innerWidth * 0.5))); }

  var Graph = ForceGraph()(el)
    .height(graphHeight())
    .backgroundColor('#ffffff')
    .nodeLabel(function (n) { return n.name + (n.country ? ' (' + n.country + ')' : ''); })
    .nodeCanvasObject(drawNode)
    .nodePointerAreaPaint(paintPointerArea)
    .linkColor(function (l) { return l.indirect ? '#e2e8f0' : '#cbd5e1'; })
    .linkLineDash(function (l) { return l.indirect ? [3, 3] : null; })
    .linkDirectionalArrowLength(4)
    .onNodeClick(handleNodeActivate)
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
        if (d.directParent) { addNode(d.directParent.lei, d.directParent.legalName, 'parent'); addLink(d.directParent.lei, node.id, false); }
        if (d.ultimateParent) { addNode(d.ultimateParent.lei, d.ultimateParent.legalName, 'parent'); addLink(d.ultimateParent.lei, d.directParent ? d.directParent.lei : node.id, false); }
        addChildrenOf(node.id, d.directChildren, d.ultimateChildren);
        expanded[node.id] = true;
        Graph.graphData({ nodes: nodes, links: links });
      })
      .catch(function () {})
      .then(function () { inflight[node.id] = false; el.style.cursor = ''; });
  }

  window.addEventListener('resize', function () {
    Graph.width(el.clientWidth).height(graphHeight());
  });
  Graph.width(el.clientWidth);
})();
```

- [ ] **Step 2: Syntax check**

Run: `node --check public/vendor/gleif-graph.js`
Expected: no output (valid).

- [ ] **Step 3: Confirm the hybrid + label logic is present**

Run:
```
grep -c "addChildrenOf" public/vendor/gleif-graph.js
grep -c "nodeCanvasObject" public/vendor/gleif-graph.js
grep -c "linkLineDash" public/vendor/gleif-graph.js
```
Expected: `addChildrenOf` ≥ 3 (defined + 2 call sites), `nodeCanvasObject` = 1, `linkLineDash` = 1.

- [ ] **Step 4: Commit**

```bash
git add public/vendor/gleif-graph.js
git -c commit.gpgsign=false commit -m "fix: GLEIF graph shows all subsidiaries (hybrid) with on-zoom labels"
```

---

## Task 2: Tab markup, i18n, styles, and check assertions

**Files:**
- Modify: `functions/empresa/_lib.js` (`T.es` ~line 252, `T.en` ~line 362, `STYLE` ~line 519, `gleifBlock` ~lines 698–713)
- Modify: `scripts/check-gleif-render.mjs`

- [ ] **Step 1: Add Spanish tab/tooltip keys.** In `functions/empresa/_lib.js`, find the `T.es` `gleifSource:` line (≈252) and insert immediately AFTER it:
```js
    gleifTabGraph: 'Gráfico',
    gleifTabMap: 'Mapa',
    gleifMapEntities: 'entidades',
```

- [ ] **Step 2: Add English tab/tooltip keys.** Find the `T.en` `gleifSource:` line (≈362) and insert immediately AFTER it:
```js
    gleifTabGraph: 'Graph',
    gleifTabMap: 'Map',
    gleifMapEntities: 'entities',
```
(Run `grep -n "gleifSource:" functions/empresa/_lib.js` first — two matches, es then en; insert after each.)

- [ ] **Step 3: Add tab + map CSS to `STYLE`.** Find this exact line (≈519):
```js
  .gleif-graph{width:100%;min-height:320px;border:1px solid var(--line);border-radius:12px;background:#fff;margin:8px 0 14px;overflow:hidden}
```
and insert immediately AFTER it:
```js
  .gleif-tabs{display:flex;gap:6px;margin:0 0 10px}
  .gleif-tab{font-size:13px;font-weight:600;border:1px solid var(--line);border-radius:8px;padding:5px 12px;background:#fff;color:var(--mut);cursor:pointer}
  .gleif-tab.on{background:var(--brand);color:#fff;border-color:var(--brand)}
  .gleif-panel[hidden]{display:none}
  .gleif-map{width:100%;min-height:360px;border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden}
```

- [ ] **Step 4: Add tab markup + map panel + map script to `gleifBlock`.** Replace this exact block (≈698–713):
```js
    gleifBlock = `<section class="gleif">
        <h2>${t.gleifTitle}</h2>
        <p class="more">${t.gleifSub}</p>
        ${(directChildren.length || ultimateChildren.length)
          ? `<p class="more">${t.gleifSummary(directChildren.length, ultimateChildren.length, countries.size)}</p>`
          : ''}
        <div id="gleif-graph" class="gleif-graph" data-self-lei="${esc(seed.lei)}"></div>
        <script type="application/json" id="gleif-graph-data">${graphJson}</script>
        <h3>${t.gleifParents}</h3>
        ${parentsTable}
        ${directTable}
        ${ultimateTable}
        <p class="more">${t.gleifSource(esc(seed.lei))}<a href="https://www.gleif.org/" rel="nofollow noopener" target="_blank">gleif.org</a>.</p>
        <script src="/vendor/force-graph.min.js" defer></script>
        <script src="/vendor/gleif-graph.js" defer></script>
      </section>`;
```
with:
```js
    gleifBlock = `<section class="gleif">
        <h2>${t.gleifTitle}</h2>
        <p class="more">${t.gleifSub}</p>
        ${(directChildren.length || ultimateChildren.length)
          ? `<p class="more">${t.gleifSummary(directChildren.length, ultimateChildren.length, countries.size)}</p>`
          : ''}
        <div class="gleif-tabs" role="tablist">
          <button type="button" class="gleif-tab on" data-panel="graph">${t.gleifTabGraph}</button>
          <button type="button" class="gleif-tab" data-panel="map">${t.gleifTabMap}</button>
        </div>
        <div id="gleif-graph" class="gleif-graph gleif-panel on" data-self-lei="${esc(seed.lei)}"></div>
        <div id="gleif-map" class="gleif-map gleif-panel" data-word-entities="${esc(t.gleifMapEntities)}" hidden></div>
        <script type="application/json" id="gleif-graph-data">${graphJson}</script>
        <h3>${t.gleifParents}</h3>
        ${parentsTable}
        ${directTable}
        ${ultimateTable}
        <p class="more">${t.gleifSource(esc(seed.lei))}<a href="https://www.gleif.org/" rel="nofollow noopener" target="_blank">gleif.org</a>.</p>
        <script src="/vendor/force-graph.min.js" defer></script>
        <script src="/vendor/gleif-graph.js" defer></script>
        <script src="/vendor/gleif-map.js" defer></script>
      </section>`;
```

- [ ] **Step 5: Extend the check script.** In `scripts/check-gleif-render.mjs`, immediately before the final `console.log('check-gleif-render: OK');`, add:
```js
// Tab UI + map panel present, with the map script referenced.
assert(html.includes('class="gleif-tabs"'), 'gleif tabs missing');
assert(html.includes('data-panel="map"'), 'map tab button missing');
assert(html.includes('id="gleif-map"'), 'map panel missing');
assert(html.includes('data-word-entities="entidades"'), 'map tooltip word missing (es)');
assert(html.includes('/vendor/gleif-map.js'), 'gleif-map.js script missing');
assert(html.includes('>Gráfico<'), 'graph tab label missing');
```

- [ ] **Step 6: Run the check + import smoke test**

Run:
```
node scripts/check-gleif-render.mjs
node -e "import('./functions/empresa/_lib.js').then(()=>console.log('import ok'))"
```
Expected: `check-gleif-render: OK` and `import ok`.

- [ ] **Step 7: Commit**

```bash
git add functions/empresa/_lib.js scripts/check-gleif-render.mjs
git -c commit.gpgsign=false commit -m "feat: GLEIF graph/map tab UI, i18n, and styles"
```

---

## Task 3: Vendor jsVectorMap

**Files:**
- Modify: `package.json` (devDependencies)
- Create: `public/vendor/jsvectormap.min.js`, `public/vendor/jsvectormap-world.js`, `public/vendor/jsvectormap.min.css`

- [ ] **Step 1: Install jsVectorMap (pinned)**

Run:
```
cd /Users/alessandronurnberg/mapasocietario
npm install -D jsvectormap
node -p "require('jsvectormap/package.json').version"
```
Then pin that exact version in `package.json` devDependencies (replace any `^`/`~` with the bare version). Expected: install succeeds; version printed.

- [ ] **Step 2: Locate the dist files**

Run:
```
ls node_modules/jsvectormap/dist/
ls node_modules/jsvectormap/dist/maps/ 2>/dev/null
```
Expected: a core file (`jsvectormap.min.js`), a CSS file under `dist/` or `dist/css/` (`jsvectormap.min.css`), and a world map under `dist/maps/` (e.g. `world.js` and/or `world-merc.js`). Note the exact paths; if names differ, use the actual minified core, the world (equirectangular) map, and the css.

- [ ] **Step 3: Copy the three assets into `public/vendor/`**

Run (adjust source paths to what Step 2 found):
```
cp node_modules/jsvectormap/dist/jsvectormap.min.js public/vendor/jsvectormap.min.js
cp node_modules/jsvectormap/dist/maps/world.js public/vendor/jsvectormap-world.js
cp "$(ls node_modules/jsvectormap/dist/css/jsvectormap.min.css node_modules/jsvectormap/dist/jsvectormap.min.css 2>/dev/null | head -1)" public/vendor/jsvectormap.min.css
ls -la public/vendor/jsvectormap*
```
Expected: all three files exist and are non-empty.

- [ ] **Step 4: Verify the UMD global, the map name, and the region-code case**

Run:
```
grep -o "jsVectorMap" public/vendor/jsvectormap.min.js | head -1
grep -oE "addMap\(['\"][a-z_]+['\"]|maps\.[a-z_]+|['\"]world['\"]" public/vendor/jsvectormap-world.js | head -3
grep -oE "\"[A-Za-z]{2}\":" public/vendor/jsvectormap-world.js | head -8
```
Expected: the global `jsVectorMap` exists; the world map registers under the name `world` (note the exact name used by `addMap`/registry); the region ids are 2-letter ISO codes — **note whether they are UPPERCASE (e.g. `"US"`) or lowercase (`"us"`)**. This case is needed by Task 4 (the choropleth `values` keys must match the region-id case). Record: map name = `<world?>`, region-code case = `<UPPER|lower>`.

- [ ] **Step 5: Build and confirm assets ship to dist**

Run:
```
npm run build
ls -la dist/vendor/jsvectormap.min.js dist/vendor/jsvectormap-world.js dist/vendor/jsvectormap.min.css
```
Expected: build succeeds (the `prebuild` check passes); all three present in `dist/vendor/`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json public/vendor/jsvectormap.min.js public/vendor/jsvectormap-world.js public/vendor/jsvectormap.min.css
git -c commit.gpgsign=false commit -m "chore: vendor jsVectorMap (lib + world map + css) for GLEIF country map"
```

---

## Task 4: Country map module (tabs + lazy choropleth)

**Files:**
- Create: `public/vendor/gleif-map.js`

**IMPORTANT (integration):** jsVectorMap's option/callback names and the world-map region-id case can vary by version. Use the version installed in Task 3. The code below targets jsVectorMap v1.x. Before finalizing, confirm against the installed package (Task 3 Step 4 findings + `node_modules/jsvectormap/README.md`): (a) constructor option `selector` + `map`, (b) `series.regions[].scale/normalizeFunction/values/attribute`, (c) the tooltip callback name and signature, and (d) the region-code case. Adjust the two marked spots if the installed version differs, keeping behavior identical.

- [ ] **Step 1: Create `public/vendor/gleif-map.js` with:**

```js
/* GLEIF country map: a "Mapa" tab drawing a world choropleth (jsVectorMap)
   shaded by the number of group entities per country, plus tab switching.
   Progressive enhancement — if the lib or data is missing it no-ops and the
   server-rendered subsidiary tables remain the fallback. */
(function () {
  var tabs = document.querySelectorAll('.gleif-tab');
  var graphPanel = document.getElementById('gleif-graph');
  var mapPanel = document.getElementById('gleif-map');
  var dataEl = document.getElementById('gleif-graph-data');
  if (!tabs.length || !graphPanel || !mapPanel || !dataEl) return;

  var mapReady = false;
  var loading = false;

  function show(panel) {
    var target = panel === 'map' ? mapPanel : graphPanel;
    var other = panel === 'map' ? graphPanel : mapPanel;
    other.hidden = true; other.classList.remove('on');
    target.hidden = false; target.classList.add('on');
    tabs.forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-panel') === panel); });
    if (panel === 'map') initMap();
  }
  tabs.forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-panel')); });
  });

  // Distinct entities per country code. NOTE (Task 3 Step 4): region-id case must
  // match the vendored world map. jsVectorMap v1 world ids are UPPERCASE ISO-2,
  // same as GLEIF — so we keep the original case. If the installed map uses
  // lowercase ids, change `code` to `String(c.country).toLowerCase()` below.
  function countByCountry() {
    var seed;
    try { seed = JSON.parse(dataEl.textContent); } catch (e) { return null; }
    var seen = {};
    var counts = {};
    function add(lei, country) {
      if (!lei || !country || seen[lei]) return;
      seen[lei] = 1;
      var code = String(country); // matches jsVectorMap UPPERCASE world ids
      counts[code] = (counts[code] || 0) + 1;
    }
    add(seed.self.lei, seed.self.country);
    (seed.directChildren || []).forEach(function (c) { add(c.lei, c.country); });
    (seed.ultimateChildren || []).forEach(function (c) { add(c.lei, c.country); });
    return counts;
  }

  function loadAsset(tag, props) {
    return new Promise(function (resolve, reject) {
      var node = document.createElement(tag);
      Object.keys(props).forEach(function (k) { node[k] = props[k]; });
      node.onload = resolve; node.onerror = reject;
      document.head.appendChild(node);
    });
  }

  function buildMap() {
    if (typeof jsVectorMap === 'undefined' || mapReady) return;
    var counts = countByCountry();
    if (!counts) return;
    var word = mapPanel.getAttribute('data-word-entities') || '';
    try {
      // --- jsVectorMap construction (verify option/callback names vs installed version) ---
      new jsVectorMap({
        selector: '#gleif-map',
        map: 'world',
        zoomButtons: true,
        regionStyle: { initial: { fill: '#e2e8f0' } },
        series: {
          regions: [{
            attribute: 'fill',
            scale: ['#dbeafe', '#1e3a8a'],
            normalizeFunction: 'polynomial',
            values: counts,
          }],
        },
        onRegionTooltipShow: function (event, tooltip, code) {
          var n = counts[code] || counts[String(code).toUpperCase()] || 0;
          tooltip.text(tooltip.text() + ': ' + n + ' ' + word, true);
        },
      });
      mapReady = true;
    } catch (e) { /* no-op: tables remain the fallback */ }
  }

  function initMap() {
    if (mapReady || loading) return;
    if (typeof jsVectorMap !== 'undefined') { buildMap(); return; }
    loading = true;
    loadAsset('link', { rel: 'stylesheet', href: '/vendor/jsvectormap.min.css' });
    loadAsset('script', { src: '/vendor/jsvectormap.min.js' })
      .then(function () { return loadAsset('script', { src: '/vendor/jsvectormap-world.js' }); })
      .then(function () { loading = false; buildMap(); })
      .catch(function () { loading = false; });
  }
})();
```

- [ ] **Step 2: Syntax check**

Run: `node --check public/vendor/gleif-map.js`
Expected: no output (valid).

- [ ] **Step 3: Build and confirm it ships**

Run:
```
npm run build
ls -la dist/vendor/gleif-map.js
```
Expected: build succeeds; `dist/vendor/gleif-map.js` present.

- [ ] **Step 4: Commit**

```bash
git add public/vendor/gleif-map.js
git -c commit.gpgsign=false commit -m "feat: GLEIF country map tab (jsVectorMap choropleth, lazy-loaded)"
```

---

## Final verification (controller, after all tasks)

- [ ] `node scripts/check-gleif-render.mjs` → `check-gleif-render: OK` (includes tab/map assertions).
- [ ] `npm run build` → succeeds; `dist/vendor/` has `gleif-graph.js`, `gleif-map.js`, `jsvectormap.min.js`, `jsvectormap-world.js`, `jsvectormap.min.css`, `force-graph.min.js`.
- [ ] Serve (`npx wrangler pages dev dist --port 8788 --compatibility-date=2024-01-01`) and verify in a browser:
  - `/empresa/arcelormittal`: graph shows the focal node **plus** its ultimate child connected by a dashed link (no lone node).
  - `/empresa/acciona`: direct subsidiaries solid/bright; focal + direct labels visible; more labels appear on zoom-in; not a flat hairball.
  - Click **Mapa**: world choropleth shades ES + subsidiary countries by count; hovering a country shows "Country: N entidades"; clicking **Gráfico** returns to the graph.
  - `/en/company/acciona`: tab labels show "Graph"/"Map" and the tooltip word is "entities".
  - Double-click a node on the graph: still expands (works on production origin; local dev blocked by CORS — known/expected).

## Notes / known constraints

- Flat-linking ultimate descendants is approximate (GLEIF's ultimate-children call lacks per-entity parentage); the hybrid rule only does it when a node has no direct children, dashed/muted styling signals "indirect," and the tables carry exact hierarchy. Double-click reveals true direct relationships.
- jsVectorMap region-id case must match the choropleth `values` keys — verified in Task 3 Step 4; the Task 4 code assumes UPPERCASE (jsVectorMap v1 + GLEIF both uppercase) with a documented one-line switch if lowercase.
- `/vendor/*` already has a 1-day cache header (`public/_headers`).
- Map weight loads only when the user opens the "Mapa" tab (lazy); the SEO-critical content (lists) is server-rendered regardless.
