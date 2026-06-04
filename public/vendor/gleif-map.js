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

  // Distinct entities per country code. jsVectorMap v1.7 world ids are UPPERCASE
  // ISO-2, same as GLEIF — keep the original case so choropleth values match.
  function countByCountry() {
    var seed;
    try { seed = JSON.parse(dataEl.textContent); } catch (e) { return null; }
    if (!seed || !seed.self) return null;
    var seen = {};
    var counts = {};
    function add(lei, country) {
      if (!lei || !country || seen[lei]) return;
      seen[lei] = 1;
      var code = String(country);
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
      // --- jsVectorMap v1.7.0 choropleth ---
      // v1.7.0's `series.regions` scale is an OrdinalScale (direct key lookup,
      // no gradient / no normalizeFunction). The gradient choropleth engine in
      // this version is the `visualizeData` option (DataVisualization), which
      // takes scale:[fromColor,toColor] + values:{CODE:number} and auto-computes
      // min/max. Verified: node_modules/jsvectormap/src/js/map.js:134 and
      // src/js/dataVisualization.js. Region ids are UPPERCASE ISO-2 (matches
      // counts keys / GLEIF). Tooltip event signature
      // onRegionTooltipShow(event, tooltip, code) verified at
      // src/js/core/setupElementEvents.js:54; tooltip.text() with no arg returns
      // the current (region-name) text, src/js/components/tooltip.js:69.
      new jsVectorMap({
        selector: '#gleif-map',
        map: 'world',
        zoomButtons: true,
        regionStyle: { initial: { fill: '#e2e8f0' } },
        visualizeData: {
          scale: ['#dbeafe', '#1e3a8a'],
          values: counts,
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
