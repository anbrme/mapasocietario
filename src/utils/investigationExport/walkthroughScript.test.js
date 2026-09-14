import { describe, expect, it } from 'vitest';
import { WALKTHROUGH_SCRIPT } from './walkthroughScript';

describe('WALKTHROUGH_SCRIPT', () => {
  it('never contains a closing script tag that would truncate the file', () => {
    expect(WALKTHROUGH_SCRIPT).not.toMatch(/<\/script/i);
  });

  it('reads its steps from the global the template writes', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('__SITREP__');
  });

  it('binds the controls the template renders', () => {
    ['wt-next', 'wt-prev', 'wt-exit', 'wt-slider'].forEach(id => {
      expect(WALKTHROUGH_SCRIPT, id).toContain(id);
    });
    expect(WALKTHROUGH_SCRIPT).not.toContain('wt-start');
  });

  it('drives focus from scroll position with an IntersectionObserver at mid-viewport', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('IntersectionObserver');
    expect(WALKTHROUGH_SCRIPT).toContain("'-50% 0px -50% 0px'");
  });

  it('renders the registry state for a date through data-state, never innerHTML', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('renderAt');
    expect(WALKTHROUGH_SCRIPT).toContain("'data-state'");
    expect(WALKTHROUGH_SCRIPT).toContain('data-key');
    expect(WALKTHROUGH_SCRIPT).not.toMatch(/\.innerHTML/);
  });

  it('detaches the slider from the chapters when scrubbed by hand and re-attaches on the next chapter', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('detached');
  });

  it('animates the pan with a CSS transform and disables it while dragging', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('style.transform');
    expect(WALKTHROUGH_SCRIPT).toContain("'dragging'");
    expect(WALKTHROUGH_SCRIPT).not.toContain("setAttribute('transform'");
  });

  it('binds the annex tabs with roving focus', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('role="tab"');
    expect(WALKTHROUGH_SCRIPT).toContain('aria-selected');
    expect(WALKTHROUGH_SCRIPT).toContain('aria-controls');
  });

  it('falls back to click-through when IntersectionObserver is missing', () => {
    expect(WALKTHROUGH_SCRIPT).toContain("'IntersectionObserver' in window");
  });

  // block:'center' centres the chapter's scroll-margin box, so a short chapter
  // never reaches the observer's mid-viewport band; 'start' is what the 45vh
  // scroll-margin was written for.
  it('scrolls a chapter to the top of its scroll-margin, never to the centre', () => {
    expect(WALKTHROUGH_SCRIPT).toContain("block: 'start'");
    expect(WALKTHROUGH_SCRIPT).not.toContain("block: 'center'");
  });

  it('releases the drag class only when no pointer is down', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('pointers.size === 0 && !dragging');
  });

  it('hides a link whose endpoint node is hidden, so no line is drawn to nowhere', () => {
    expect(WALKTHROUGH_SCRIPT).toContain("nodeState[L.a] === 'hidden' || nodeState[L.b] === 'hidden'");
  });

  // renderAt duplicates stateAt() from src/utils/walkthrough/registryTimeline.js
  // (the module cannot run inside the exported file). These three pins fail the
  // moment one copy is edited without the other.
  it('pins the node and link date comparisons that mirror stateAt', () => {
    expect(WALKTHROUGH_SCRIPT).toContain(
      "n.from && d < n.from ? 'hidden' : (n.to && d >= n.to ? 'ghost' : 'live')"
    );
    expect(WALKTHROUGH_SCRIPT).toContain(
      "L.from && d < L.from ? 'hidden' : (L.to && d >= L.to ? 'ceased' : 'live')"
    );
  });

  it('pins the undated-node fallback that mirrors stateAt: its links decide', () => {
    expect(WALKTHROUGH_SCRIPT).toContain(
      "mine.length === 0 || mine.indexOf('live') >= 0 ? 'live' : (mine.indexOf('ceased') >= 0 ? 'ghost' : 'hidden')"
    );
  });

  it('reads the slider out as the day it stands on, not as its index', () => {
    expect(WALKTHROUGH_SCRIPT).toContain("slider.setAttribute('aria-valuetext', asOf)");
  });

  it('indexes the map elements once instead of querying per node and link on every date', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('function buildIndex');
    expect(WALKTHROUGH_SCRIPT).toContain('querySelectorAll');
    const renderAtBody = WALKTHROUGH_SCRIPT.split('function renderAt')[1].split('\n  function ')[0];
    expect(renderAtBody).not.toContain('querySelector');
  });

  it('gives the chapters the date back when the reader navigates after scrubbing', () => {
    expect(WALKTHROUGH_SCRIPT).toMatch(/detached = false/g);
    expect((WALKTHROUGH_SCRIPT.match(/detached = false/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('no longer writes the unread ghost-title attribute', () => {
    expect(WALKTHROUGH_SCRIPT).not.toContain('data-ghost-title');
  });

  it('is parseable JavaScript', () => {
    expect(() => new Function(WALKTHROUGH_SCRIPT)).not.toThrow();
  });

  it('guards on a missing map so a step-less file still opens', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('if (!map)');
  });

  it('pans to the step, highlights its links, and uses pointer events', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('data-x');
    expect(WALKTHROUGH_SCRIPT).toContain("addEventListener('pointerdown'");
    expect(WALKTHROUGH_SCRIPT).toContain('linkKeys');
    expect(WALKTHROUGH_SCRIPT).toContain('__sitrepShow');
    expect(WALKTHROUGH_SCRIPT).not.toContain("addEventListener('mousedown'");
  });

  it('only zooms the map on a ctrl/cmd-modified wheel, letting the page scroll otherwise', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('ctrlKey');
  });

  it('renders the registry text and the author note as separate blocks', () => {
    expect(WALKTHROUGH_SCRIPT).toContain("'wt-note'");
    expect(WALKTHROUGH_SCRIPT).toContain("'wt-text'");
  });

  it('zooms a single-node step to 1.3, not the old 2', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('1.3');
    expect(WALKTHROUGH_SCRIPT).not.toMatch(/xs\.length === 1 \? 2\b/);
  });

  it('reads and shows the opening block only on the first step', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('wt-opening');
    expect(WALKTHROUGH_SCRIPT).toContain('wt-open-title');
    expect(WALKTHROUGH_SCRIPT).toContain('wt-open-line');
    expect(WALKTHROUGH_SCRIPT).toContain('i !== 0');
  });

  it('shows the precomputed evidence line', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('wt-ev');
    expect(WALKTHROUGH_SCRIPT).toContain('evidenceLine');
  });

  it('builds the note with createElement/textContent, never innerHTML', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('createElement');
    expect(WALKTHROUGH_SCRIPT).toContain('noteLabel');
    expect(WALKTHROUGH_SCRIPT).toContain('createTextNode');
    expect(WALKTHROUGH_SCRIPT).not.toMatch(/\.innerHTML/);
  });
});


describe('presenter mode', () => {
  it('enters fullscreen behind a body class, pauses the observer, and leaves on Escape or fullscreenchange', () => {
    expect(WALKTHROUGH_SCRIPT).toContain("document.body.classList.add('presenting')");
    expect(WALKTHROUGH_SCRIPT).toContain('root.requestFullscreen()');
    expect(WALKTHROUGH_SCRIPT).toContain('if (presenting || !en.isIntersecting) return;');
    expect(WALKTHROUGH_SCRIPT).toContain("document.addEventListener('fullscreenchange'");
    expect(WALKTHROUGH_SCRIPT).toContain('if (presenting) exitPresent(); else renderOpening();');
  });
  it('drives slides from the keyboard: arrows, space, page keys, home and end', () => {
    expect(WALKTHROUGH_SCRIPT).toContain("e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown'");
    expect(WALKTHROUGH_SCRIPT).toContain("e.key === 'ArrowLeft' || e.key === 'PageUp'");
    expect(WALKTHROUGH_SCRIPT).toContain("if (e.key === 'Home')");
    expect(WALKTHROUGH_SCRIPT).toContain("if (e.key === 'End')");
  });
  it('shows slides directly instead of scrolling while presenting, and restores the scroll on exit', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('if (presenting) { detached = false; if (i < 0) renderOpening(); else show(n); return; }');
    expect(WALKTHROUGH_SCRIPT).toContain('window.scrollTo(0, savedScroll)');
    expect(WALKTHROUGH_SCRIPT).toContain("on('wt-present', enterPresent)");
  });
});


describe('print and share', () => {
  it('prints through the browser and shares the pristine file, saving a copy when Web Share cannot take files', () => {
    expect(WALKTHROUGH_SCRIPT).toContain("on('wt-print', function () { window.print(); });");
    expect(WALKTHROUGH_SCRIPT).toContain("var pristine = '<!doctype html>\\n' + document.documentElement.outerHTML;");
    expect(WALKTHROUGH_SCRIPT).toContain('navigator.canShare({ files: [file] })');
    expect(WALKTHROUGH_SCRIPT).toContain('a.download = fileName();');
  });
});
