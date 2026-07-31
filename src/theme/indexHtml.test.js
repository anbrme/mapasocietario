import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_ROUTE, STORAGE_KEY } from './themeMode';
import { DARK_TOKENS, LIGHT_TOKENS } from './palette';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('index.html pre-paint theme script', () => {
  it('contains the inline theme script', () => {
    expect(html).toContain('data-theme');
  });

  it('references the current storage key', () => {
    expect(html).toContain(STORAGE_KEY);
  });

  it('references the current app route', () => {
    expect(html).toContain(`'${APP_ROUTE}'`);
  });

  it('gives the theme-color meta tag an id so the provider can update it', () => {
    expect(html).toMatch(/<meta[^>]*id="theme-color-meta"[^>]*>/);
  });

  it('runs the script before the app bundle so no dark frame is painted first', () => {
    expect(html.indexOf('data-theme')).toBeLessThan(html.indexOf('src="/src/main.jsx"'));
  });
});

// src/index.css hardcodes the pre-paint document-chrome colours (scrollbar,
// html/body background+text) rather than importing palette.js — the inline
// script above runs before any module graph exists, so this duplication is
// unavoidable (see the comment atop src/index.css). These assertions pin the
// duplication to the current palette tokens, sourced from palette.js rather
// than hardcoded a second time here, so changing a palette background without
// updating index.css fails the suite instead of leaving the scrollbar/overscroll
// silently stale (final review, finding 2).
describe('src/index.css pre-paint colour duplication', () => {
  it('pins the dark --ms-app-bg to the current dark background.default', () => {
    expect(css).toContain(`--ms-app-bg: ${DARK_TOKENS.background.default};`);
  });

  it('pins the dark --ms-app-fg to the current dark label colour', () => {
    expect(css).toContain(`--ms-app-fg: ${DARK_TOKENS.graph.surface.label};`);
  });

  it('pins the light --ms-app-bg to the current light background.default', () => {
    expect(css).toContain(`--ms-app-bg: ${LIGHT_TOKENS.background.default};`);
  });

  it('pins the light --ms-app-fg to the current light label colour', () => {
    expect(css).toContain(`--ms-app-fg: ${LIGHT_TOKENS.graph.surface.label};`);
  });
});
