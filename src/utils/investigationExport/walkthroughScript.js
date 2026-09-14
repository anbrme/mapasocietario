// The interactive layer of the exported situation report, as a string injected
// into a <script> tag. Vanilla JS, no dependencies, no network.
//
// It must never contain the sequence "</script>" or it truncates the file it
// lives in — walkthroughScript.test.js pins that.
//
// Scope is deliberately small, and driven by the reader's scroll: the chapter
// crossing the middle of the viewport focuses its nodes on the map, pans to
// them and dates the map to that chapter's moment. A slider re-dates the map
// by hand; the annex tab strip switches panels. Anything more belongs in the
// app, not in a file that leaves our control the moment it is downloaded.

export const WALKTHROUGH_SCRIPT = `
(function () {
  var data = window.__SITREP__ || { steps: [] };
  // The file as it was written, captured before any state class touches the
  // DOM: this is what "Compartir" hands on, never the reader's current view.
  var pristine = '<!doctype html>\\n' + document.documentElement.outerHTML;
  var map = document.getElementById('map');
  var viewport = document.getElementById('viewport');
  if (!map) return;

  var opening = document.getElementById('wt-opening');
  var openTitle = document.getElementById('wt-open-title');
  var openLine = document.getElementById('wt-open-line');
  var eyebrow = document.getElementById('wt-eyebrow');
  var title = document.getElementById('wt-title');
  var text = document.getElementById('wt-text');
  var ev = document.getElementById('wt-ev');
  var note = document.getElementById('wt-note');
  var counter = document.getElementById('wt-counter');
  var slider = document.getElementById('wt-slider');
  var dateLabel = document.getElementById('wt-date');
  var steps = data.steps || [];
  var tl = data.timeline || null;
  var dates = (tl && tl.dates) || [];
  var idx = -1;
  // True once the reader has scrubbed the slider: the chapters stop re-dating
  // the map until a scroll puts them back in charge.
  var detached = false;
  // Presenter mode: one chapter at a time, keyboard-driven, scroll observer
  // paused. savedScroll brings the reader back where they were on exit.
  var presenting = false;
  var savedScroll = 0;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var tx = 0, ty = 0, scale = 1;
  function apply() {
    if (viewport) viewport.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
  }
  function vb() { return map.viewBox && map.viewBox.baseVal; }
  function screenToUserScale() {
    var v = vb(); var rect = map.getBoundingClientRect();
    if (!v || !v.width || !v.height || !rect.width || !rect.height) return 1;
    return Math.min(rect.width / v.width, rect.height / v.height);
  }
  function esc(id) { return window.CSS && CSS.escape ? CSS.escape(id) : id; }
  function nodeEl(id) { return map.querySelector('g.n[data-id="' + esc(id) + '"]'); }

  // Dragging the slider re-dates the whole map on every step, so the elements
  // are found once here and never queried again: id -> node group, timeline
  // key -> the lines carrying it (a key can be drawn more than once), and the
  // keys touching each node.
  var nodeEls = Object.create(null);
  var lineEls = Object.create(null);
  var linksOf = Object.create(null);
  function buildIndex() {
    var nodes = (tl && tl.nodes) || {}, links = (tl && tl.links) || {};
    Object.keys(nodes).forEach(function (id) {
      var el = nodeEl(id); if (el) nodeEls[id] = el;
      linksOf[id] = [];
    });
    Object.keys(links).forEach(function (k) {
      var found = map.querySelectorAll('line.l[data-key="' + esc(k) + '"]');
      if (found.length) lineEls[k] = Array.prototype.slice.call(found);
      [links[k].a, links[k].b].forEach(function (id) {
        if (!linksOf[id]) linksOf[id] = [];
        linksOf[id].push(k);
      });
    });
  }

  function clearFocus() {
    map.classList.remove('focused');
    Array.prototype.forEach.call(map.querySelectorAll('.on'), function (el) { el.classList.remove('on'); });
  }

  // A bare 'YYYY-MM-DD' read as UTC midnight renders as the previous day west
  // of Greenwich; noon keeps the day the registry meant.
  function fmtDay(d) {
    var parts = String(d).split('-');
    var dt = new Date(+parts[0], +parts[1] - 1, +parts[2], 12);
    return dt.toLocaleDateString(data.lang === 'en' ? 'en-GB' : 'es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // The same rule as stateAt() in registryTimeline.js — keep them in step.
  function renderAt(d) {
    if (!tl || !d) return;
    var nodeState = {};
    var links = tl.links || {}, nodes = tl.nodes || {};
    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id];
      if (n.from === null && n.to === null && !n.dissolved) return;
      nodeState[id] = n.from && d < n.from ? 'hidden' : (n.to && d >= n.to ? 'ghost' : 'live');
    });
    var linkState = {};
    Object.keys(links).forEach(function (k) {
      var L = links[k];
      var st = L.from && d < L.from ? 'hidden' : (L.to && d >= L.to ? 'ceased' : 'live');
      // A line to a company that does not exist yet is a line to nowhere.
      if (nodeState[L.a] === 'hidden' || nodeState[L.b] === 'hidden') st = 'hidden';
      else if (st !== 'hidden' && (nodeState[L.a] === 'ghost' || nodeState[L.b] === 'ghost')) st = 'ceased';
      linkState[k] = st;
      var els = lineEls[k];
      if (els) els.forEach(function (el) { el.setAttribute('data-state', st); });
    });
    Object.keys(nodes).forEach(function (id) {
      if (nodeState[id]) return;
      var mine = (linksOf[id] || []).map(function (k) { return linkState[k]; });
      nodeState[id] = mine.length === 0 || mine.indexOf('live') >= 0 ? 'live' : (mine.indexOf('ceased') >= 0 ? 'ghost' : 'hidden');
    });
    Object.keys(nodeState).forEach(function (id) {
      var el = nodeEls[id];
      if (el) el.setAttribute('data-state', nodeState[id]);
    });
    var asOf = (data.registryAsOf || '{d}').replace('{d}', fmtDay(d));
    if (dateLabel) dateLabel.textContent = asOf;
    if (slider) {
      // A range input reads out its raw index otherwise ("7 of 12"), which
      // tells a screen-reader user nothing about the day they are standing on.
      slider.setAttribute('aria-valuetext', asOf);
      if (dates.indexOf(d) >= 0) slider.value = String(dates.indexOf(d));
    }
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
    scale = xs.length === 1 ? 1.3 : Math.max(0.5, Math.min(2.5, (Math.min(v.width, v.height) * 0.6) / span));
    tx = v.x + v.width / 2 - cx * scale;
    ty = v.y + v.height / 2 - cy * scale;
    apply();
  }

  // Fills the opening block and reports whether it has anything to say.
  function fillOpening() {
    if (openTitle) openTitle.textContent = (data.opening && data.opening.title) || '';
    if (openLine) openLine.textContent = (data.opening && data.opening.line) || '';
    return !!(data.opening && (data.opening.title || data.opening.line));
  }
  function clearCard() {
    if (eyebrow) eyebrow.textContent = '';
    if (title) title.textContent = '';
    if (text) { text.textContent = ''; text.hidden = true; }
    if (ev) { ev.textContent = ''; ev.hidden = true; }
    if (note) { note.textContent = ''; note.hidden = true; note.setAttribute('data-flag', 'none'); }
    if (counter) counter.textContent = '';
  }
  function clearCurrent() {
    Array.prototype.forEach.call(document.querySelectorAll('.chapter.current'), function (el) { el.classList.remove('current'); });
  }

  // The state before (and after) the story: the whole map, read on the day the
  // document was written, with the opening note in the panel.
  function renderOpening() {
    idx = -1;
    detached = false;
    clearFocus();
    clearCard();
    clearCurrent();
    if (opening) opening.hidden = !fillOpening();
    document.body.classList.toggle('at-opening', presenting);
    renderAt(tl && tl.readOn);
  }

  function show(i, opts) {
    var step = steps[i];
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
    var m = step.moment;
    if (!detached || (opts && opts.fromScroll)) { detached = false; renderAt(m && dates.indexOf(m) >= 0 ? m : (tl && tl.readOn)); }
    if (opening) opening.hidden = !fillOpening() || i !== 0;
    if (eyebrow) eyebrow.textContent = (step.kindLabel || '') + (step.sourceLabel ? ' · ' + step.sourceLabel : '');
    if (title) title.textContent = step.title || '';
    if (text) { text.textContent = step.summary || ''; text.hidden = !text.textContent; }
    if (ev) { ev.textContent = step.evidenceLine || ''; ev.hidden = !ev.textContent; }
    if (note) {
      note.textContent = '';
      var n = step.narrative;
      if (n && n.text) {
        var who = document.createElement('span');
        who.className = 'who';
        who.textContent = data.noteLabel || '';
        note.appendChild(who);
        note.appendChild(document.createTextNode(n.text));
        note.hidden = false;
        note.setAttribute('data-flag', n.flag || 'none');
      } else {
        note.hidden = true;
        note.setAttribute('data-flag', 'none');
      }
    }
    if (counter) counter.textContent = (i + 1) + ' / ' + steps.length;
    clearCurrent();
    var chapter = document.getElementById('ch-' + i);
    if (chapter) chapter.classList.add('current');
    document.body.classList.remove('at-opening');
    if (presenting) {
      var column = document.getElementById('walkthrough');
      if (column) column.scrollTop = 0;
    }
  }

  function enterPresent() {
    if (presenting) return;
    presenting = true;
    savedScroll = window.scrollY || 0;
    document.body.classList.add('presenting');
    var root = document.documentElement;
    if (root.requestFullscreen) { try { root.requestFullscreen().catch(function () {}); } catch (err) { /* stays in-page */ } }
    if (idx < 0) renderOpening(); else show(idx);
    window.scrollTo(0, 0);
  }
  function exitPresent() {
    if (!presenting) return;
    presenting = false;
    document.body.classList.remove('presenting');
    document.body.classList.remove('at-opening');
    if (document.fullscreenElement && document.exitFullscreen) { try { document.exitFullscreen().catch(function () {}); } catch (err) { /* already out */ } }
    window.scrollTo(0, savedScroll);
  }
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && presenting) exitPresent();
  });

  // The one way in: scroll the chapter into view and let the observer focus it.
  // Without an observer (old browser, print preview) focus it directly.
  window.__sitrepShow = function (i) {
    var n = Math.max(0, Math.min(i, steps.length - 1));
    // Presenting: slides, not scroll. Going back past the first is slide zero.
    if (presenting) { detached = false; if (i < 0) renderOpening(); else show(n); return; }
    var ch = document.getElementById('ch-' + n);
    // 'start' lands the chapter top on its 45vh scroll-margin, just above the
    // observer's mid-viewport band; 'center' would centre that margin box and
    // a short chapter would never cross the band at all.
    if (ch && ch.scrollIntoView) ch.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (!('IntersectionObserver' in window)) { detached = false; show(n); }
  };

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (presenting || !en.isIntersecting) return;
        var i = parseInt(en.target.getAttribute('data-i'), 10);
        if (i !== idx) show(i, { fromScroll: true });
      });
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    Array.prototype.forEach.call(document.querySelectorAll('.chapter[data-i]'), function (el) { io.observe(el); });
  }

  if (slider) {
    slider.addEventListener('input', function () { detached = true; renderAt(dates[+slider.value]); });
  }

  // Leaving the story hands the map back whole; the chapters stay where the
  // reader left them.
  function exit() { if (presenting) exitPresent(); else renderOpening(); }
  function on(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); }
  on('wt-next', function () { window.__sitrepShow(idx + 1); });
  on('wt-prev', function () { window.__sitrepShow(idx - 1); });
  on('wt-exit', exit);
  on('wt-present', enterPresent);
  on('wt-print', function () { window.print(); });
  // Share the FILE, not a URL: a blob: or file: address means nothing to the
  // recipient. Web Share with files where the platform has it (phones, Safari,
  // Chrome on Android); otherwise a copy is saved for the reader to attach.
  function fileName() {
    var base = (document.title || 'informe').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\\s+/g, ' ').trim();
    return base + '.html';
  }
  function saveCopy() {
    var blob = new Blob([pristine], { type: 'text/html' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  on('wt-save', saveCopy);
  on('wt-share', function () {
    var blob = new Blob([pristine], { type: 'text/html' });
    var file = (typeof File === 'function') ? new File([blob], fileName(), { type: 'text/html' }) : null;
    if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: document.title }).catch(function () {});
      return;
    }
    saveCopy();
  });
  // The slider and the tab strip own the arrow keys while they are focused.
  function ownsArrows(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      || (el.getAttribute && el.getAttribute('role') === 'tab');
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { exit(); return; }
    if (ownsArrows(e.target)) return;
    if (presenting) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); window.__sitrepShow(idx + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); window.__sitrepShow(idx - 1); }
      if (e.key === 'Home') { e.preventDefault(); renderOpening(); }
      if (e.key === 'End') { e.preventDefault(); window.__sitrepShow(steps.length - 1); }
      return;
    }
    if (idx < 0) return;
    if (e.key === 'ArrowRight') window.__sitrepShow(idx + 1);
    if (e.key === 'ArrowLeft') window.__sitrepShow(idx - 1);
  });
  map.addEventListener('click', function (e) {
    var g = e.target.closest ? e.target.closest('g.n') : null;
    if (!g) return;
    var id = g.getAttribute('data-id');
    for (var i = 0; i < steps.length; i++) {
      if ((steps[i].nodeIds || [])[0] === id) { window.__sitrepShow(i); return; }
    }
  });

  // Pan and pinch with pointer events — a forwarded file opens on a phone.
  // 'dragging' suspends the CSS transition so the map tracks the finger.
  var pointers = new Map(), lastDist = 0, dragging = false, lastX = 0, lastY = 0;
  map.addEventListener('pointerdown', function (e) {
    map.setPointerCapture(e.pointerId);
    map.classList.add('dragging');
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
  function up(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastDist = 0;
    if (pointers.size === 0) { dragging = false; map.classList.remove('dragging'); }
  }
  map.addEventListener('pointerup', up);
  map.addEventListener('pointercancel', up);
  // A trackpad pinch arrives as a burst of wheel events: releasing the class
  // per event would restart the 0.6s transition on every frame. Only the end
  // of the burst releases it, and never while a finger is still down.
  var WHEEL_IDLE_MS = 140;
  var wheelTimer = 0;
  map.addEventListener('wheel', function (e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    map.classList.add('dragging');
    scale = Math.min(6, Math.max(0.2, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    apply();
    if (wheelTimer) clearTimeout(wheelTimer);
    wheelTimer = setTimeout(function () {
      wheelTimer = 0;
      if (pointers.size === 0 && !dragging) map.classList.remove('dragging');
    }, WHEEL_IDLE_MS);
  }, { passive: false });

  // The annex explorer: one tab strip, roving tabindex, panels toggled by
  // the hidden attribute so print can show them all.
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.annex-tabs [role="tab"]'));
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var isOn = t === tab;
      t.setAttribute('aria-selected', isOn ? 'true' : 'false');
      t.tabIndex = isOn ? 0 : -1;
      var pane = document.getElementById(t.getAttribute('aria-controls'));
      if (pane) pane.hidden = !isOn;
    });
    if (tab.focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') selectTab(tabs[(i + 1) % tabs.length]);
      if (e.key === 'ArrowLeft') selectTab(tabs[(i - 1 + tabs.length) % tabs.length]);
    });
  });

  buildIndex();
  renderOpening();
})();
`;
