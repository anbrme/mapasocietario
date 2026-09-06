/**
 * Interactivity for the directorships study. Inlined into the generated page:
 * plain browser JS, no build step, no external library. Every label comes from
 * the #study-data payload, so this file carries no copy and serves both
 * languages unchanged.
 *
 * Two populations share one panel shape: ES (Spain, one national graph) and
 * MAD (Madrid). One piece of state, the selected year, drives the concentration
 * chart, the province table, the connectivity bars and the explorer.
 */
(function () {
  'use strict';
  var D = JSON.parse(document.getElementById('study-data').textContent);
  var L = D.labels;
  var ES = D.lang === 'es';
  var FIRST = D.first, LAST = D.last, N = D.pops.ES.length - 1;
  var COUNTS = { pairs: 1, companies: 1, officers: 1 };
  var RATIOS = { pairs_per_officer: 1, pairs_per_company: 1 };
  var year = LAST;

  function num(v, dp) {
    var s = Number(v).toFixed(dp);
    if (ES) s = s.replace('.', ',');
    return s;
  }
  function grp(v) {
    var s = String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '#');
    return s.replace(/#/g, ES ? '.' : ',');
  }
  function pct(v, dp) { return num(v * 100, dp == null ? 1 : dp) + L.pct; }
  function fmt(v, m) {
    if (COUNTS[m]) return grp(v);
    if (RATIOS[m]) return num(v, 2);
    if (m === 'gini') return num(v, 3);
    return pct(v, 2);
  }
  function delta(v, m) {
    var sign = v >= 0 ? '+' : '';
    if (COUNTS[m]) return sign + grp(v);
    if (RATIOS[m]) return sign + num(v, 2);
    if (m === 'gini') return sign + num(v, 3);
    return sign + num(v * 100, 2) + ' pp';
  }
  function el(name, attrs, text) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  function niceTicks(max, m) {
    var ladder = COUNTS[m] ? [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000]
      : RATIOS[m] ? [0.1, 0.2, 0.25, 0.5, 1] : m === 'gini' ? [0.01, 0.02, 0.05, 0.1, 0.2] : [0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2];
    var step = ladder[ladder.length - 1];
    for (var i = 0; i < ladder.length; i++) if (max / ladder[i] <= 5) { step = ladder[i]; break; }
    var top = Math.ceil(max / step - 1e-9) * step, ticks = [];
    for (var v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return ticks;
  }
  function tickLabel(v, m) {
    if (COUNTS[m]) return grp(v / 1000) + 'k';
    if (RATIOS[m]) return num(v, 2);
    if (m === 'gini') return num(v, 2);
    var p = v * 100;
    return num(p, p % 1 ? 1 : 0) + '%';
  }

  /* ---------- line chart: series = [{pop, key, label, color, dash}] ---------- */
  function lineChart(cfg) {
    var svg = document.getElementById(cfg.svg);
    var readout = document.getElementById(cfg.readout);
    var hover = null;
    function draw() {
      clear(svg);
      var W = 760, H = 320, ml = 62, mr = 22, mt = 24, mb = 42;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var series = cfg.series();
      var m = cfg.metric();
      var all = [];
      series.forEach(function (s) { D.pops[s.pop].forEach(function (r) { all.push(r[s.key][m]); }); });
      var ticks = niceTicks(Math.max.apply(null, all), m), max = ticks[ticks.length - 1];
      var x = function (i) { return ml + i * (W - ml - mr) / N; };
      var y = function (v) { return H - mb - v / max * (H - mt - mb); };
      var ax = el('g', { 'class': 'ax' });
      ticks.forEach(function (v) {
        ax.appendChild(el('line', { x1: ml, x2: W - mr, y1: y(v), y2: y(v) }));
        ax.appendChild(el('text', { x: ml - 10, y: y(v) + 4, 'text-anchor': 'end' }, tickLabel(v, m)));
      });
      [0, Math.round(N / 4), Math.round(N / 2), Math.round(3 * N / 4), N].forEach(function (i) {
        ax.appendChild(el('text', { x: x(i), y: H - 10, 'text-anchor': 'middle' }, String(D.pops.ES[i].year)));
      });
      svg.appendChild(ax);
      var active = Math.max(0, Math.min(N, (hover == null ? year : hover) - FIRST));
      var s0 = series[0], rows0 = D.pops[s0.pop];
      var area = 'M ' + x(0) + ' ' + y(0) + ' ' + rows0.map(function (r, i) { return 'L ' + x(i) + ' ' + y(r[s0.key][m]); }).join(' ') + ' L ' + x(N) + ' ' + y(0) + ' Z';
      svg.appendChild(el('path', { d: area, fill: s0.color, opacity: '.08' }));
      series.forEach(function (s) {
        var rows = D.pops[s.pop];
        var d = rows.map(function (r, i) { return (i ? 'L ' : 'M ') + x(i) + ' ' + y(r[s.key][m]); }).join(' ');
        svg.appendChild(el('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': s.dash ? 2 : 3, 'stroke-dasharray': s.dash ? '5 6' : '', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      });
      svg.appendChild(el('line', { x1: x(active), x2: x(active), y1: mt, y2: H - mb, stroke: css('--rule'), 'stroke-dasharray': '3 4' }));
      series.forEach(function (s) {
        var v = D.pops[s.pop][active][s.key][m];
        svg.appendChild(el('circle', { cx: x(active), cy: y(v), r: 10, fill: s.color, opacity: '.15' }));
        svg.appendChild(el('circle', { cx: x(active), cy: y(v), r: 4.5, fill: s.color, stroke: css('--raise'), 'stroke-width': 2 }));
      });
      clear(readout);
      var yr = document.createElement('span'); yr.className = 'eyebrow'; yr.textContent = String(FIRST + active); readout.appendChild(yr);
      var box = document.createElement('div'); readout.appendChild(box);
      series.forEach(function (s) {
        var v = document.createElement('span'); v.className = 'rv'; v.style.color = s.color;
        var b = document.createElement('b'); b.textContent = fmt(D.pops[s.pop][active][s.key][m], m); v.appendChild(b);
        var sm = document.createElement('small'); sm.textContent = s.label; v.appendChild(sm);
        box.appendChild(v);
      });
      if (cfg.after) cfg.after(m, series);
    }
    var wrap = svg.parentNode;
    wrap.addEventListener('pointermove', function (ev) {
      var r = svg.getBoundingClientRect();
      var xx = (ev.clientX - r.left) / r.width * 760;
      hover = FIRST + Math.max(0, Math.min(N, Math.round((xx - 62) / (760 - 62 - 22) * N)));
      draw();
    });
    wrap.addEventListener('pointerleave', function () { hover = null; draw(); });
    wrap.addEventListener('click', function () { if (hover != null) setYear(hover); });
    return { draw: draw };
  }

  var charts = [];
  function setYear(y) {
    year = y;
    var sl = document.getElementById('year-range');
    if (sl && Number(sl.value) !== y) sl.value = String(y);
    var outs = document.querySelectorAll('.year-out');
    for (var i = 0; i < outs.length; i++) outs[i].textContent = String(y);
    charts.forEach(function (c) { c.draw(); });
    drawBars();
    drawProvinces();
    drawExplorerTable();
  }

  /* ---------- 1. concentration: Spain vs Madrid, variant B ---------- */
  charts.push(lineChart({
    svg: 's-conc', readout: 'r-conc',
    series: function () {
      return [{ pop: 'ES', key: 'B', label: L.pops.ES, color: css('--stamp') },
              { pop: 'MAD', key: 'B', label: L.pops.MAD, color: css('--amber'), dash: true }];
    },
    metric: function () { return 'top1pct'; },
  }));
  var slider = document.getElementById('year-range');
  slider.addEventListener('input', function () { setYear(Number(slider.value)); });
  var playing = null;
  var playBtn = document.getElementById('year-play');
  function stopPlay() { if (playing) clearInterval(playing); playing = null; playBtn.setAttribute('aria-pressed', 'false'); playBtn.textContent = L.play; }
  playBtn.addEventListener('click', function () {
    if (playing) { stopPlay(); return; }
    if (year === LAST) setYear(FIRST);
    playBtn.setAttribute('aria-pressed', 'true'); playBtn.textContent = L.pause;
    playing = setInterval(function () { if (year >= LAST) { stopPlay(); return; } setYear(year + 1); }, 900);
  });

  /* ---------- 2. provinces ---------- */
  var sortKey = 'companies', sortDir = -1;
  var KEYS = ['name', 'companies', 'top1', 'delta', 'gini', 'interlocked', 'giant', 'ratio', 'closure'];
  var headBtns = document.querySelectorAll('#prov-head button');
  for (var hi = 0; hi < headBtns.length; hi++) (function (b, i) {
    b.addEventListener('click', function () {
      var k = KEYS[i];
      if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'name' ? 1 : -1; }
      drawProvinces();
    });
  })(headBtns[hi], hi);
  function provRows() {
    var y = String(year), y0 = String(FIRST), rows = [];
    D.provinces.forEach(function (p) {
      var b = p.years[y] && p.years[y].B, b0 = p.years[y0] && p.years[y0].B;
      if (!b || !b0) return;
      rows.push({ name: p.province, small: p.small, spain: false, companies: b.companies, top1: b.top1pct, delta: b.top1pct - b0.top1pct, gini: b.gini, interlocked: b.interlocked, giant: b.giant, ratio: b.giant / (b.giant_rnd_mean || 1), closure: p.years[y].closure_removed_share });
    });
    var n = D.pops.ES[year - FIRST], n0 = D.pops.ES[0];
    var spain = { name: L.spainRow, small: false, spain: true, companies: n.B.companies, top1: n.B.top1pct, delta: n.B.top1pct - n0.B.top1pct, gini: n.B.gini, interlocked: n.B.interlocked, giant: n.B.giant, ratio: n.B.giant / (n.B.giant_rnd_mean || 1), closure: null };
    rows.sort(function (a, b) {
      if (sortKey === 'name') return sortDir * a.name.localeCompare(b.name, ES ? 'es' : 'en');
      return sortDir * (a[sortKey] - b[sortKey]);
    });
    return [spain].concat(rows);
  }
  function provCell(r, k) {
    switch (k) {
      case 'name': return r.name + (r.small ? ' *' : '');
      case 'companies': return grp(r.companies);
      case 'top1': return pct(r.top1, 1);
      case 'delta': return delta(r.delta, 'top1pct');
      case 'gini': return num(r.gini, 3);
      case 'interlocked': return pct(r.interlocked, 1);
      case 'giant': return pct(r.giant, 1);
      case 'ratio': return num(r.ratio, 2);
      case 'closure': return r.closure == null ? '—' : pct(r.closure, 1);
    }
    return '';
  }
  function drawProvinces() {
    var body = document.getElementById('prov-body');
    clear(body);
    var rows = provRows();
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      if (r.spain) tr.className = 'spain'; else if (r.small) tr.className = 'small';
      KEYS.forEach(function (k) {
        var td = document.createElement('td'); if (k !== 'name') td.className = 'mono';
        td.textContent = provCell(r, k); tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    var ths = document.querySelectorAll('#prov-head th');
    for (var i = 0; i < ths.length; i++) ths[i].setAttribute('aria-sort', KEYS[i] === sortKey ? (sortDir === 1 ? 'ascending' : 'descending') : 'none');
    var big = rows.filter(function (r) { return !r.spain && !r.small; });
    var sum = document.getElementById('prov-summary');
    if (big.length) {
      var up = 0, down = 0, top = big[0], flat = null;
      big.forEach(function (r) {
        if (r.delta > 0.01) up++;
        if (r.delta < 0) down++;
        if (r.delta > top.delta) top = r;
        if (r.companies > 30000 && (flat == null || Math.abs(r.delta) < Math.abs(flat.delta))) flat = r;
      });
      sum.textContent = L.summary.replace('{n}', big.length).replace('{up}', up).replace('{down}', down)
        .replace('{top}', top.name).replace('{delta}', num(top.delta * 100, 1)).replace('{flat}', flat ? flat.name : '—').replace('{year}', year);
    }
  }

  /* ---------- 3. connectivity bars: population x variant ---------- */
  var netPop = 'ES', netVariant = 'B';
  function wireTabs(id, onPick) {
    var tabs = document.querySelectorAll('#' + id + ' [role=tab]');
    for (var i = 0; i < tabs.length; i++) (function (b) {
      b.addEventListener('click', function () {
        for (var j = 0; j < tabs.length; j++) tabs[j].setAttribute('aria-selected', tabs[j] === b ? 'true' : 'false');
        onPick(b.getAttribute('data-k'));
      });
    })(tabs[i]);
  }
  wireTabs('net-pop', function (k) { netPop = k; drawBars(); });
  wireTabs('net-var', function (k) { netVariant = k; drawBars(); });
  function drawBars() {
    var host = document.getElementById('net-bars');
    clear(host);
    var years = year === FIRST ? [FIRST] : [FIRST, year];
    years.forEach(function (yr) {
      var r = D.pops[netPop][yr - FIRST][netVariant];
      var block = document.createElement('div'); block.className = 'net-year';
      var h = document.createElement('div'); h.className = 'net-h';
      var big = document.createElement('b'); big.textContent = String(yr); h.appendChild(big);
      var sm = document.createElement('small'); sm.textContent = (yr === FIRST ? L.start : L.selected) + ' · ' + L.pops[netPop] + ' · ' + L.variants[netVariant]; h.appendChild(sm);
      block.appendChild(h);
      [[L.observed, r.giant, 'obs'], [L.random, r.giant_rnd_mean, 'rnd']].forEach(function (it) {
        var line = document.createElement('div'); line.className = 'bar-line';
        var name = document.createElement('span'); name.className = 'bar-name'; name.textContent = it[0]; line.appendChild(name);
        var track = document.createElement('div'); track.className = 'bar-track';
        var fill = document.createElement('div'); fill.className = 'bar-fill ' + it[2]; fill.style.width = Math.min(100, it[1] / 0.4 * 100) + '%'; track.appendChild(fill);
        line.appendChild(track);
        var val = document.createElement('strong'); val.textContent = pct(it[1], 2); line.appendChild(val);
        block.appendChild(line);
      });
      var range = document.createElement('small'); range.className = 'range';
      range.textContent = L.range + ': ' + pct(r.giant_rnd_min, 2) + '–' + pct(r.giant_rnd_max, 2);
      block.appendChild(range);
      host.appendChild(block);
    });
  }

  /* ---------- 4. explorer: population x variant x measure ---------- */
  var selP = document.getElementById('ex-pop'), selV = document.getElementById('ex-variant'), selM = document.getElementById('ex-metric');
  var explorer = lineChart({
    svg: 's-ex', readout: 'r-ex',
    series: function () { return [{ pop: selP.value, key: selV.value, label: L.pops[selP.value] + ' · ' + L.variants[selV.value], color: css('--stamp') }]; },
    metric: function () { return selM.value; },
    after: function (m) {
      var rows = D.pops[selP.value];
      var first = rows[0][selV.value][m], cur = rows[year - FIRST][selV.value][m];
      document.getElementById('ex-first').textContent = fmt(first, m);
      document.getElementById('ex-cur').textContent = fmt(cur, m);
      document.getElementById('ex-delta').textContent = delta(cur - first, m);
      document.getElementById('ex-note').textContent = L.variantNotes[selV.value];
      document.getElementById('ex-title').textContent = L.metrics[m] + ' · ' + L.pops[selP.value] + ' · ' + L.variants[selV.value];
    },
  });
  charts.push(explorer);
  [selP, selV, selM].forEach(function (s) { s.addEventListener('change', function () { explorer.draw(); drawExplorerTable(); }); });
  var EX_COLS = ['pairs', 'companies', 'officers', 'pairs_per_company', 'top1pct', 'gini', 'interlocked', 'giant'];
  function drawExplorerTable() {
    var body = document.getElementById('ex-body');
    clear(body);
    D.pops[selP.value].forEach(function (r) {
      var tr = document.createElement('tr'); if (r.year === year) tr.className = 'sel';
      var td = document.createElement('td'); td.textContent = String(r.year); tr.appendChild(td);
      EX_COLS.forEach(function (m) { var c = document.createElement('td'); c.className = 'mono'; c.textContent = fmt(r[selV.value][m], m); tr.appendChild(c); });
      body.appendChild(tr);
    });
  }

  setYear(LAST);
})();
