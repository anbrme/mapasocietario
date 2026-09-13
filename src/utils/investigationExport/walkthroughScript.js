// The interactive layer of the exported situation report, as a string injected
// into a <script> tag. Vanilla JS, no dependencies, no network.
//
// It must never contain the sequence "</script>" or it truncates the file it
// lives in — walkthroughScript.test.js pins that.
//
// Scope is deliberately small: pan to each step's nodes, highlight its links,
// show its text/note, and step through the flagged notes. Anything more
// belongs in the app, not in a file that leaves our control the moment it is
// downloaded.

export const WALKTHROUGH_SCRIPT = `
(function () {
  var data = window.__SITREP__ || { steps: [] };
  var map = document.getElementById('map');
  var viewport = document.getElementById('viewport');
  if (!map) return;

  var panel = document.getElementById('wt-panel');
  var eyebrow = document.getElementById('wt-eyebrow');
  var title = document.getElementById('wt-title');
  var text = document.getElementById('wt-text');
  var note = document.getElementById('wt-note');
  var counter = document.getElementById('wt-counter');
  var idx = -1;

  var tx = 0, ty = 0, scale = 1;
  function apply() {
    if (viewport) viewport.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + scale + ')');
  }
  function vb() { return map.viewBox && map.viewBox.baseVal; }
  function screenToUserScale() {
    var v = vb(); var rect = map.getBoundingClientRect();
    if (!v || !v.width || !v.height || !rect.width || !rect.height) return 1;
    return Math.min(rect.width / v.width, rect.height / v.height);
  }
  function esc(id) { return window.CSS && CSS.escape ? CSS.escape(id) : id; }
  function nodeEl(id) { return map.querySelector('g.n[data-id="' + esc(id) + '"]'); }

  function clearFocus() {
    map.classList.remove('focused');
    Array.prototype.forEach.call(map.querySelectorAll('.on'), function (el) { el.classList.remove('on'); });
  }

  // Centre the step's nodes in the viewBox; fit when there are several.
  function panTo(ids) {
    var v = vb(); if (!v) return;
    var xs = [], ys = [];
    ids.forEach(function (id) {
      var el = nodeEl(id); if (!el) return;
      xs.push(parseFloat(el.getAttribute('data-x'))); ys.push(parseFloat(el.getAttribute('data-y')));
    });
    if (!xs.length) return;
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    var span = Math.max(maxX - minX, maxY - minY, 1);
    scale = xs.length === 1 ? 2 : Math.max(0.5, Math.min(2.5, (Math.min(v.width, v.height) * 0.6) / span));
    tx = v.x + v.width / 2 - cx * scale;
    ty = v.y + v.height / 2 - cy * scale;
    apply();
  }

  function show(i) {
    var step = data.steps[i];
    if (!step) return;
    idx = i;
    clearFocus();
    map.classList.add('focused');
    (step.nodeIds || []).forEach(function (id) { var el = nodeEl(id); if (el) el.classList.add('on'); });
    (step.linkKeys || []).forEach(function (k) {
      var parts = k.split('|');
      var sel = 'line.l[data-a="' + esc(parts[0]) + '"][data-b="' + esc(parts[1]) + '"],' +
                'line.l[data-a="' + esc(parts[1]) + '"][data-b="' + esc(parts[0]) + '"]';
      Array.prototype.forEach.call(map.querySelectorAll(sel), function (el) { el.classList.add('on'); });
    });
    panTo(step.nodeIds || []);
    if (eyebrow) eyebrow.textContent = (step.sectionLabel || '') + (step.sourceLabel ? ' · ' + step.sourceLabel : '') + (step.date ? ' · ' + step.date : '');
    if (title) title.textContent = step.title || '';
    if (text) { text.textContent = step.source === 'author' ? '' : (step.text || ''); text.hidden = !text.textContent; }
    if (note) {
      var n = step.source === 'author' ? { text: step.text, flag: step.flag } : step.authorNote;
      note.textContent = n && n.text ? n.text : '';
      note.hidden = !note.textContent;
      note.setAttribute('data-flag', (n && n.flag) || 'none');
    }
    if (counter) counter.textContent = (i + 1) + ' / ' + data.steps.length;
    if (panel) panel.hidden = false;
    var chapter = document.getElementById('ch-' + i);
    Array.prototype.forEach.call(document.querySelectorAll('.chapter.current'), function (el) { el.classList.remove('current'); });
    if (chapter) chapter.classList.add('current');
  }
  window.__sitrepShow = function (i) {
    show(i);
    var fig = document.getElementById('graph');
    if (fig && fig.scrollIntoView) fig.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  function exit() { idx = -1; clearFocus(); if (panel) panel.hidden = true; }
  function on(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); }
  on('wt-start', function () { show(0); });
  on('wt-next', function () { show(Math.min(idx + 1, data.steps.length - 1)); });
  on('wt-prev', function () { show(Math.max(idx - 1, 0)); });
  on('wt-exit', exit);
  document.addEventListener('keydown', function (e) {
    if (idx < 0) return;
    if (e.key === 'ArrowRight') show(Math.min(idx + 1, data.steps.length - 1));
    if (e.key === 'ArrowLeft') show(Math.max(idx - 1, 0));
    if (e.key === 'Escape') exit();
  });
  map.addEventListener('click', function (e) {
    var g = e.target.closest ? e.target.closest('g.n') : null;
    if (!g) return;
    var id = g.getAttribute('data-id');
    for (var i = 0; i < data.steps.length; i++) {
      if ((data.steps[i].nodeIds || [])[0] === id) { show(i); return; }
    }
  });

  // Pan and pinch with pointer events — a forwarded file opens on a phone.
  var pointers = new Map(), lastDist = 0, dragging = false, lastX = 0, lastY = 0;
  map.addEventListener('pointerdown', function (e) {
    map.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, e);
    if (pointers.size === 1) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
  });
  map.addEventListener('pointermove', function (e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e);
    if (pointers.size === 2) {
      var pts = Array.from(pointers.values());
      var d = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      if (lastDist) { scale = Math.min(6, Math.max(0.2, scale * (d / lastDist))); apply(); }
      lastDist = d;
      return;
    }
    if (!dragging) return;
    var s = screenToUserScale();
    tx += (e.clientX - lastX) / s; ty += (e.clientY - lastY) / s;
    lastX = e.clientX; lastY = e.clientY;
    apply();
  });
  function up(e) { pointers.delete(e.pointerId); if (pointers.size < 2) lastDist = 0; if (pointers.size === 0) dragging = false; }
  map.addEventListener('pointerup', up);
  map.addEventListener('pointercancel', up);
  map.addEventListener('wheel', function (e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    scale = Math.min(6, Math.max(0.2, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    apply();
  }, { passive: false });
})();
`;
