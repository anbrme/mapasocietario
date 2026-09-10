// The interactive layer of the exported situation report, as a string injected
// into a <script> tag. Vanilla JS, no dependencies, no network.
//
// It must never contain the sequence "</script>" or it truncates the file it
// lives in — walkthroughScript.test.js pins that.
//
// Scope is deliberately small: pan/zoom the SVG, show a note on click, and step
// through the flagged notes. Anything more belongs in the app, not in a file
// that leaves our control the moment it is downloaded.

export const WALKTHROUGH_SCRIPT = `
(function () {
  var data = window.__SITREP__ || { steps: [] };
  var map = document.getElementById('map');
  var viewport = document.getElementById('viewport');
  if (!map) return;

  var panel = document.getElementById('wt-panel');
  var body = document.getElementById('wt-body');
  var counter = document.getElementById('wt-counter');
  var idx = -1;

  function nodeEl(id) {
    return map.querySelector('g.n[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
  }

  function clearFocus() {
    map.classList.remove('focused');
    Array.prototype.forEach.call(map.querySelectorAll('g.n.on'), function (el) {
      el.classList.remove('on');
    });
  }

  function show(i) {
    var step = data.steps[i];
    if (!step) return;
    idx = i;
    clearFocus();
    var el = nodeEl(step.nodeId);
    if (el) {
      map.classList.add('focused');
      el.classList.add('on');
    }
    if (body) {
      body.innerHTML = '';
      var h = document.createElement('strong');
      h.textContent = step.name;
      var p = document.createElement('p');
      p.textContent = step.text;
      body.appendChild(h);
      body.appendChild(p);
      body.setAttribute('data-flag', step.flag || 'none');
    }
    if (counter) counter.textContent = (i + 1) + ' / ' + data.steps.length;
    if (panel) panel.hidden = false;
  }

  function exit() {
    idx = -1;
    clearFocus();
    if (panel) panel.hidden = true;
  }

  function on(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

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

  // Clicking any node shows its note, whether or not it is a walkthrough step.
  map.addEventListener('click', function (e) {
    var g = e.target.closest ? e.target.closest('g.n') : null;
    if (!g) return;
    var id = g.getAttribute('data-id');
    for (var i = 0; i < data.steps.length; i++) {
      if (data.steps[i].nodeId === id) { show(i); return; }
    }
  });

  // Pan and zoom by rewriting one transform — no library, no re-layout.
  //
  // tx/ty live in the SVG's user-unit space (the transform is applied inside
  // the viewBox-scaled root), but mouse deltas arrive in screen pixels. The
  // two units only match by coincidence, so a drag has to be converted through
  // the ratio of rendered size to viewBox size before it is added.
  var tx = 0, ty = 0, scale = 1, dragging = false, lastX = 0, lastY = 0;
  function screenToUserScale() {
    var vb = map.viewBox && map.viewBox.baseVal;
    var rect = map.getBoundingClientRect();
    if (!vb || !vb.width || !vb.height || !rect.width || !rect.height) return 1;
    return Math.min(rect.width / vb.width, rect.height / vb.height);
  }
  function apply() {
    if (viewport) viewport.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + scale + ')');
  }
  map.addEventListener('mousedown', function (e) { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mouseup', function () { dragging = false; });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    var s = screenToUserScale();
    tx += (e.clientX - lastX) / s; ty += (e.clientY - lastY) / s;
    lastX = e.clientX; lastY = e.clientY;
    apply();
  });
  map.addEventListener('wheel', function (e) {
    e.preventDefault();
    scale = Math.min(6, Math.max(0.2, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    apply();
  }, { passive: false });
})();
`;
