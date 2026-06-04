/* GLEIF corporate-group graph: hydrates #gleif-graph from #gleif-graph-data and
   expands a node on double-click via POST /lei-relationships. Progressive
   enhancement — if this fails, the server-rendered lists remain. */
(function () {
  var el = document.getElementById('gleif-graph');
  var dataEl = document.getElementById('gleif-graph-data');
  if (!el || !dataEl || typeof ForceGraph === 'undefined') return;

  var seed;
  try { seed = JSON.parse(dataEl.textContent); } catch (e) { return; }

  var COLORS = { self: '#2563eb', parent: '#7c3aed', child: '#0ea5e9', other: '#64748b' };
  var API = 'https://api.ncdata.eu/lei-relationships';

  var nodes = [];
  var links = [];
  var byId = {};
  var expanded = {};
  var inflight = {};

  function addNode(lei, name, role, country) {
    if (!lei) return null;
    if (byId[lei]) return byId[lei];
    var n = { id: lei, name: name || lei, role: role, country: country };
    byId[lei] = n; nodes.push(n); return n;
  }
  function addLink(parentLei, childLei) {
    if (!parentLei || !childLei) return;
    var key = parentLei + '>' + childLei;
    if (addLink._seen && addLink._seen[key]) return;
    (addLink._seen = addLink._seen || {})[key] = 1;
    links.push({ source: parentLei, target: childLei });
  }

  // Seed graph from server data.
  addNode(seed.self.lei, seed.self.name, 'self', seed.self.country);
  if (seed.directParent) { addNode(seed.directParent.lei, seed.directParent.legalName, 'parent'); addLink(seed.directParent.lei, seed.self.lei); }
  if (seed.ultimateParent && (!seed.directParent || seed.ultimateParent.lei !== seed.directParent.lei)) {
    addNode(seed.ultimateParent.lei, seed.ultimateParent.legalName, 'parent');
    addLink(seed.ultimateParent.lei, (seed.directParent || seed.self).lei);
  }
  (seed.directChildren || []).forEach(function (c) { addNode(c.lei, c.legalName, 'child', c.country); addLink(seed.self.lei, c.lei); });
  (seed.ultimateChildren || []).forEach(function (c) { addNode(c.lei, c.legalName, 'child', c.country); });
  expanded[seed.self.lei] = true;

  var Graph = ForceGraph()(el)
    .height(Math.min(480, Math.max(320, Math.round(window.innerWidth * 0.5))))
    .backgroundColor('#ffffff')
    .nodeLabel(function (n) { return n.name + (n.country ? ' (' + n.country + ')' : ''); })
    .nodeColor(function (n) { return COLORS[n.role] || COLORS.other; })
    .nodeRelSize(5)
    .linkColor(function () { return '#cbd5e1'; })
    .linkDirectionalArrowLength(4)
    .onNodeClick(handleNodeActivate) // touch/single fallback
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
        if (d.directParent) { addNode(d.directParent.lei, d.directParent.legalName, 'parent'); addLink(d.directParent.lei, node.id); }
        if (d.ultimateParent) { addNode(d.ultimateParent.lei, d.ultimateParent.legalName, 'parent'); addLink(d.ultimateParent.lei, node.id); }
        (d.directChildren || []).forEach(function (c) { addNode(c.lei, c.legalName, 'child', c.country); addLink(node.id, c.lei); });
        (d.ultimateChildren || []).forEach(function (c) { addNode(c.lei, c.legalName, 'child', c.country); addLink(node.id, c.lei); });
        expanded[node.id] = true;
        Graph.graphData({ nodes: nodes, links: links });
      })
      .catch(function () {})
      .then(function () { inflight[node.id] = false; el.style.cursor = ''; });
  }

  window.addEventListener('resize', function () {
    Graph.width(el.clientWidth).height(Math.min(480, Math.max(320, Math.round(window.innerWidth * 0.5))));
  });
  Graph.width(el.clientWidth);
})();
