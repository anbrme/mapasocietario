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
    expect(printBlock).toContain('#wt-panel,.wt-controls,.hide-print{display:none!important}');
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
});
