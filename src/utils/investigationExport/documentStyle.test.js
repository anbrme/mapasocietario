import { describe, expect, it } from 'vitest';
import { DOCUMENT_STYLE, FLAG_COLORS, flagVar } from './documentStyle';

describe('DOCUMENT_STYLE', () => {
  it('embeds both Plex faces as data URIs', () => {
    const faces = DOCUMENT_STYLE.match(/@font-face/g) || [];
    expect(faces).toHaveLength(2);
    expect(DOCUMENT_STYLE).toContain('url(data:font/woff2;base64,');
    expect(DOCUMENT_STYLE).toMatch(/font-weight:\s*400/);
    expect(DOCUMENT_STYLE).toMatch(/font-weight:\s*700/);
  });

  it('carries print rules: A4 page, breaks before chapters and annexes, player hidden', () => {
    expect(DOCUMENT_STYLE).toContain('@page');
    expect(DOCUMENT_STYLE).toContain('@media print');
    expect(DOCUMENT_STYLE).toContain('#walkthrough{page-break-before:always');
    expect(DOCUMENT_STYLE).toContain('#annexes{page-break-before:always');

    const printBlock = DOCUMENT_STYLE.slice(DOCUMENT_STYLE.indexOf('@media print{'));
    expect(printBlock).toContain('#wt-panel,.hide-print{display:none!important}');
    expect(printBlock).toContain(':root{');
    expect(printBlock).toContain('--muted:#58677D');
    expect(printBlock).toContain('--line:#CCD6E3');
    expect(printBlock).toContain('#walkthrough{page-break-before:always');
  });

  it('uses the guide teal as the single accent and no external url', () => {
    expect(DOCUMENT_STYLE).toContain('#0E8178');
    expect(DOCUMENT_STYLE).not.toMatch(/url\(https?:/);
  });

  it('flagVar maps known flags and falls back to none', () => {
    expect(flagVar('red')).toBe(`--f:${FLAG_COLORS.red}`);
    expect(flagVar('bogus')).toBe(`--f:${FLAG_COLORS.none}`);
  });

  it('the walkthrough card is no longer pinned over the map', () => {
    expect(DOCUMENT_STYLE).not.toMatch(/#wt-panel\{[^}]*position:sticky/);
    expect(DOCUMENT_STYLE).toContain('#wt-panel{margin-top:12px');
  });

  it('lays the story out as a sticky pane beside the chapters, animates, respects reduced motion, stacks annex tabs in print', () => {
    expect(DOCUMENT_STYLE).toContain('.story{display:grid');
    expect(DOCUMENT_STYLE).toContain('position:sticky');
    expect(DOCUMENT_STYLE).toContain('#viewport{transition:transform');
    expect(DOCUMENT_STYLE).toContain('prefers-reduced-motion');
    expect(DOCUMENT_STYLE).toContain('[data-state="hidden"]');
    expect(DOCUMENT_STYLE).toContain('[data-state="ceased"]');
    expect(DOCUMENT_STYLE).toContain('[data-state="ghost"]');
    expect(DOCUMENT_STYLE).toMatch(/@media print\{[\s\S]*\.annex-panel\[hidden\]\{display:block!important\}/);
    expect(DOCUMENT_STYLE).toMatch(/@media print\{[\s\S]*\.story\{display:block\}/);
    expect(DOCUMENT_STYLE).toMatch(/@media print\{[\s\S]*#viewport\{transform:none!important/);
    // One grid column would make the pane's own grid area its sticky
    // containing block, so below the two-column breakpoint .story is a block.
    expect(DOCUMENT_STYLE).toContain('@media (max-width:959px){.story{display:block}}');
  });

  it('carries no rule for chrome the document no longer renders', () => {
    expect(DOCUMENT_STYLE).not.toContain('.wt-controls');
  });

  it('styles the note eyebrow span in both the walkthrough card and the chapter note', () => {
    expect(DOCUMENT_STYLE).toContain('#wt-note .who,.chapter .note .who{display:block');
  });

  it('styles the opening block, the evidence line and the chapter sub-heads', () => {
    expect(DOCUMENT_STYLE).toContain('#wt-opening{');
    expect(DOCUMENT_STYLE).toContain('#wt-ev{');
    expect(DOCUMENT_STYLE).toContain('.chapter h4{');
    expect(DOCUMENT_STYLE).toContain('.kv{');
    expect(DOCUMENT_STYLE).toContain('nav.contents a.sub{');
  });
});
