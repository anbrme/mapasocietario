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
