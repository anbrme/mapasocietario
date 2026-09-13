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
    ['wt-next', 'wt-prev', 'wt-exit', 'wt-start'].forEach(id => {
      expect(WALKTHROUGH_SCRIPT, id).toContain(id);
    });
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
});
