/**
 * Charts for the capital-filings study. Inlined into the generated page, so it
 * is plain ES5-ish browser JS with no build step and no external library: the
 * page must render on its own, and a study that depends on a CDN is a study
 * that breaks quietly.
 *
 * Every label and number arrives in the #study-data JSON payload, so this file
 * contains no copy and works unchanged for both languages.
 */
(function () {
  'use strict';
  var D = JSON.parse(document.getElementById('study-data').textContent);
  var L = D.labels;
  var ES = D.lang === 'es';

  function n(v, dp) {
    var s = Number(v).toFixed(dp == null ? 1 : dp);
    return ES ? s.replace('.', ',') : s;
  }
  function pct(v, dp) { return n(v, dp) + L.pct; }
  function grp(v) {
    var s = String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '#');
    return s.replace(/#/g, ES ? '.' : ',');
  }
  function money(v) { return L.currencyBefore ? L.currency + grp(v) : grp(v) + L.currency; }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function el(name, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }

  function mkTip(host) {
    var box = document.createElement('div');
    box.className = 'tip'; box.hidden = true; host.appendChild(box);
    return {
      show: function (title, sub, ev) {
        box.replaceChildren();
        var b = document.createElement('b'); b.textContent = title; box.appendChild(b);
        box.appendChild(document.createElement('br'));
        var s = document.createElement('span'); s.className = 's'; s.textContent = sub; box.appendChild(s);
        box.hidden = false;
        var r = host.getBoundingClientRect();
        box.style.left = Math.min(Math.max(ev.clientX - r.left, 62), r.width - 62) + 'px';
        box.style.top = Math.max(ev.clientY - r.top - 12, 30) + 'px';
      },
      hide: function () { box.hidden = true; }
    };
  }

  /* ---------- 1. windows ---------- */
  var winKey = 'inc';
  var tipWin = mkTip(document.getElementById('p-win'));

  function drawWin() {
    var svg = document.getElementById('s-win'); clear(svg);
    var W = 760, H = 330, ml = 44, mr = 14, mt = 30, mb = 54;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var iw = W - ml - mr, ih = H - mt - mb, max = 24;
    var y = function (v) { return mt + ih - (v / max) * ih; };
    var col = winKey === 'inc' ? css('--teal') : css('--amber');
    var lab = winKey === 'inc' ? L.inc : L.red;
    document.getElementById('k-col').style.background = col;
    document.getElementById('k-lab').textContent = lab;

    var defs = el('defs', {});
    var pat = el('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    pat.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: css('--base-ink'), 'stroke-width': 2, 'stroke-opacity': 0.55 }));
    defs.appendChild(pat); svg.appendChild(defs);

    var g = el('g', { 'class': 'ax' });
    [0, 6, 12, 18, 24].forEach(function (tk) {
      g.appendChild(el('line', { x1: ml, x2: W - mr, y1: y(tk), y2: y(tk) }));
      var tx = el('text', { x: ml - 9, y: y(tk) + 4, 'text-anchor': 'end' });
      tx.textContent = n(tk, 0) + L.pct; g.appendChild(tx);
    });
    svg.appendChild(g);

    var band = iw / D.bars.length, bw = Math.min(46, band * 0.30), gap = 6;
    /* The claim is the GAP, not the height: a 180-day window is naturally taller
       than a single day, so the tallest bar is not the finding. Tint the same-day
       group so the eye lands on the pair that actually diverges. */
    svg.appendChild(el('rect', { x: ml + 3, y: mt - 4, width: band - 6, height: ih + 8, rx: 4, fill: css('--teal'), 'fill-opacity': 0.07 }));

    D.bars.forEach(function (d, i) {
      var cx = ml + band * i + band / 2;
      var v = d[winKey];
      var xT = cx - bw - gap / 2, xB = cx + gap / 2;
      var rT = el('rect', { x: xT, y: y(v), width: bw, height: Math.max(ih - (y(v) - mt), 1.5), rx: 4, fill: col });
      rT.style.cursor = 'pointer'; svg.appendChild(rT);
      var rB = el('rect', { x: xB, y: y(d.base), width: bw, height: Math.max(ih - (y(d.base) - mt), 1.5), rx: 4, fill: 'url(#hatch)', stroke: css('--base-ink'), 'stroke-width': 1 });
      rB.style.cursor = 'pointer'; svg.appendChild(rB);

      var t1 = el('text', { x: xT + bw / 2, y: y(v) - 7, 'text-anchor': 'middle', 'class': 'val' + (i === 0 ? ' hi' : '') });
      t1.textContent = pct(v); svg.appendChild(t1);
      var lb = el('text', { x: cx, y: mt + ih + 20, 'text-anchor': 'middle', 'class': 'lbl' });
      lb.textContent = d.k; svg.appendChild(lb);
      var lb2 = el('text', { x: cx, y: mt + ih + 35, 'text-anchor': 'middle', 'class': 'lbl' });
      lb2.textContent = L.base + ' ' + pct(d.base); lb2.style.opacity = 0.75; svg.appendChild(lb2);

      /* The multiple is the study's PUBLISHED figure, never recomputed from the
         rounded percentages on this chart - 13.4/0.2 rounds to 67 and would
         contradict the ~65x the study reports from the unrounded rates. Shown
         only for the series that has one. */
      if (i === 0 && winKey === 'inc' && L.mult) {
        var mt2 = el('text', { x: cx, y: mt - 10, 'text-anchor': 'middle', 'class': 'val hi' });
        mt2.textContent = L.mult; svg.appendChild(mt2);
      }
      rT.addEventListener('pointerenter', function (e) { tipWin.show(lab + ' · ' + d.k, pct(v), e); });
      rB.addEventListener('pointerenter', function (e) { tipWin.show(L.base + ' · ' + d.k, pct(d.base), e); });
      rT.addEventListener('pointerleave', tipWin.hide);
      rB.addEventListener('pointerleave', tipWin.hide);
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[role=tab]'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('[role=tab]'), function (o) {
        o.setAttribute('aria-selected', String(o === b));
      });
      winKey = b.dataset.k; drawWin();
    });
  });
  var tblBtn = document.getElementById('win-tbl'), tbl = document.getElementById('win-table');
  tblBtn.addEventListener('click', function () {
    var on = this.getAttribute('aria-pressed') === 'true';
    this.setAttribute('aria-pressed', String(!on));
    tbl.hidden = on;
    this.textContent = on ? this.dataset.show : this.dataset.hide;
  });

  /* ---------- 2. years ---------- */
  var tipYr = mkTip(document.getElementById('p-yr'));
  function drawYears() {
    var svg = document.getElementById('s-yr'); clear(svg);
    var W = 760, H = 250, ml = 44, mr = 16, mt = 20, mb = 40;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var R = D.years.rates, iw = W - ml - mr, ih = H - mt - mb, lo = 11.5, hi = 15.5;
    var x = function (i) { return ml + (iw / (R.length - 1)) * i; };
    var y = function (v) { return mt + ih - ((v - lo) / (hi - lo)) * ih; };
    var g = el('g', { 'class': 'ax' });
    [12, 13, 14, 15].forEach(function (tk) {
      g.appendChild(el('line', { x1: ml, x2: W - mr, y1: y(tk), y2: y(tk) }));
      var tx = el('text', { x: ml - 9, y: y(tk) + 4, 'text-anchor': 'end' });
      tx.textContent = n(tk, 0) + L.pct; g.appendChild(tx);
    });
    svg.appendChild(g);
    var mn = Math.min.apply(null, R), mx = Math.max.apply(null, R);
    svg.appendChild(el('rect', { x: ml, y: y(mx), width: iw, height: y(mn) - y(mx), fill: css('--teal'), 'fill-opacity': 0.08 }));
    var d = R.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
    svg.appendChild(el('path', { d: d, fill: 'none', stroke: css('--teal'), 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    R.forEach(function (v, i) {
      svg.appendChild(el('circle', { cx: x(i), cy: y(v), r: 4, fill: css('--teal'), stroke: css('--raise'), 'stroke-width': 2 }));
      var hit = el('circle', { cx: x(i), cy: y(v), r: 13, fill: 'transparent' });
      hit.style.cursor = 'pointer'; svg.appendChild(hit);
      hit.addEventListener('pointerenter', function (e) { tipYr.show(String(D.years.from + i), pct(v), e); });
      hit.addEventListener('pointerleave', tipYr.hide);
      if (i % 4 === 0 || i === R.length - 1) {
        var tx = el('text', { x: x(i), y: mt + ih + 22, 'text-anchor': 'middle', 'class': 'lbl' });
        tx.textContent = String(D.years.from + i); svg.appendChild(tx);
      }
    });
    var bl = el('text', { x: ml + 6, y: y(mx) - 7, 'class': 'val' });
    bl.textContent = L.band; svg.appendChild(bl);
  }

  /* ---------- 3. legal form ---------- */
  var tipForm = mkTip(document.getElementById('p-form'));
  function drawForm() {
    var svg = document.getElementById('s-form'); clear(svg);
    var W = 760, H = 280, ml = 54, mr = 14, mt = 22, mb = 58;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var iw = W - ml - mr, ih = H - mt - mb, max = 24;
    var y = function (v) { return mt + ih - (v / max) * ih; };
    var g = el('g', { 'class': 'ax' });
    [0, 6, 12, 18, 24].forEach(function (tk) {
      g.appendChild(el('line', { x1: ml, x2: W - mr, y1: y(tk), y2: y(tk) }));
      var tx = el('text', { x: ml - 9, y: y(tk) + 4, 'text-anchor': 'end' });
      tx.textContent = n(tk, 0) + L.pct; g.appendChild(tx);
    });
    svg.appendChild(g);
    var half = iw / D.forms.length, bw = 52, gap = 8;
    D.forms.forEach(function (f) {
      var cx = ml + half * D.forms.indexOf(f) + half / 2;
      f.cols.forEach(function (v, j) {
        var bx = cx - bw - gap / 2 + (bw + gap) * j;
        var c = j === 0 ? css('--teal') : css('--amber');
        var r = el('rect', { x: bx, y: y(v), width: bw, height: Math.max(ih - (y(v) - mt), 1.5), rx: 4, fill: c });
        r.style.cursor = 'pointer'; svg.appendChild(r);
        var tv = el('text', { x: bx + bw / 2, y: y(v) - 7, 'text-anchor': 'middle', 'class': 'val' + (f.k === 'SA' && j === 1 ? ' hi' : '') });
        tv.textContent = pct(v); svg.appendChild(tv);
        var lb = el('text', { x: bx + bw / 2, y: mt + ih + 19, 'text-anchor': 'middle', 'class': 'lbl' });
        lb.textContent = L.formCols[j]; svg.appendChild(lb);
        r.addEventListener('pointerenter', function (e) { tipForm.show(f.k + ' · ' + L.formCols[j], pct(v) + ' · ' + f.n, e); });
        r.addEventListener('pointerleave', tipForm.hide);
      });
      svg.appendChild(el('line', { x1: cx - bw - gap / 2 - 8, x2: cx + bw + gap / 2 + 8, y1: y(f.base), y2: y(f.base), stroke: css('--base-ink'), 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
      var bt = el('text', { x: cx + bw + gap / 2 + 12, y: y(f.base) + 4, 'class': 'lbl' });
      bt.textContent = L.base + ' ' + pct(f.base); svg.appendChild(bt);
      var ft = el('text', { x: cx, y: mt + ih + 43, 'text-anchor': 'middle', 'class': 'lbl' });
      ft.textContent = f.k + ' · ' + f.n; ft.style.fontWeight = '600'; ft.style.fill = css('--ink-2'); svg.appendChild(ft);
    });
  }

  /* ---------- 4. amounts ---------- */
  function drawAmounts() {
    var svg = document.getElementById('s-amt'); clear(svg);
    var W = 760, H = 150, ml = 14, mr = 14, mt = 14;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var iw = W - ml - mr, max = 70000, rowH = 52;
    D.amounts.forEach(function (a, i) {
      var yy = mt + i * (rowH + 16);
      var w = Math.max((a.v / max) * iw, 2);
      var c = i === 0 ? css('--teal') : css('--base-ink');
      svg.appendChild(el('rect', { x: ml, y: yy + 20, width: w, height: 22, rx: 4, fill: c, 'fill-opacity': i === 0 ? 1 : 0.35, stroke: i === 0 ? 'none' : c, 'stroke-width': 1 }));
      var lb = el('text', { x: ml, y: yy + 13, 'class': 'lbl' });
      lb.textContent = a.k + '  ·  ' + a.n; svg.appendChild(lb);
      var vl = el('text', { x: ml + w + 10, y: yy + 36, 'class': 'val' + (i === 0 ? ' hi' : '') });
      vl.textContent = money(a.v); svg.appendChild(vl);
    });
  }

  /* ---------- 5. reverse view ---------- */
  function drawReverse() {
    var svg = document.getElementById('s-rev'); clear(svg);
    var W = 760, H = 112, ml = 14, mr = 14, barY = 44, barH = 30;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var iw = W - ml - mr;
    svg.appendChild(el('rect', { x: ml, y: barY, width: iw, height: barH, rx: 4, fill: css('--base-ink'), 'fill-opacity': 0.22 }));
    svg.appendChild(el('rect', { x: ml, y: barY, width: Math.max(iw * (D.reverse.pct / 100), 3), height: barH, rx: 2, fill: css('--teal') }));
    var t1 = el('text', { x: ml, y: barY - 12, 'class': 'val hi' });
    t1.textContent = D.reverse.inLabel; svg.appendChild(t1);
    var t2 = el('text', { x: ml + iw, y: barY + barH + 20, 'text-anchor': 'end', 'class': 'lbl' });
    t2.textContent = D.reverse.allLabel; svg.appendChild(t2);
  }

  /* ---------- boot ---------- */
  /* Reveal first: it must not depend on the charts succeeding. */
  if (window.IntersectionObserver && !window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
    document.documentElement.classList.add('js-anim');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (s) { io.observe(s); });
  }

  function drawAll() { drawWin(); drawYears(); drawForm(); drawAmounts(); drawReverse(); }
  drawAll();

  /* Dark mode reads its colours from CSS custom properties at draw time, so the
     charts have to be redrawn when the viewer's theme flips. */
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme:dark)');
    if (mq.addEventListener) mq.addEventListener('change', drawAll);
    else if (mq.addListener) mq.addListener(drawAll);
  }
})();
