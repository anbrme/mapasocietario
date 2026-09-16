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

  it('lets the landing follow the system colour scheme before first paint', () => {
    // The provider applies the same rule after hydration; without this the
    // pre-paint script would stamp dark and a light-system visitor would see
    // a dark frame flash on the homepage.
    expect(html).toContain('prefers-color-scheme: light');
    expect(html).toContain("'/es'");
  });

  it('runs the script before the app bundle so no dark frame is painted first', () => {
    expect(html.indexOf('data-theme')).toBeLessThan(html.indexOf('src="/src/main.jsx"'));
  });
});

// IBM Plex is self-hosted from public/fonts. The Google Fonts stylesheet was
// render-blocking (about 0.8 s on Lighthouse's mobile profile) and cost two
// extra origins before the first paint; the hero weight is preloaded instead.
describe('index.html fonts', () => {
  it('does not load a render-blocking Google Fonts stylesheet', () => {
    expect(html).not.toContain('fonts.googleapis.com/css');
    expect(html).not.toMatch(/<link[^>]*preconnect[^>]*fonts\.g(oogleapis|static)\.com/);
  });

  it('preloads the self-hosted IBM Plex Sans face the hero paints with', () => {
    expect(html).toMatch(/<link[^>]*rel="preload"[^>]*href="\/fonts\/ibm-plex-sans-latin-v23\.woff2"[^>]*as="font"[^>]*crossorigin/);
  });

  it('declares the self-hosted faces in src/index.css with swap so text never waits', () => {
    expect(css).toContain("font-family: 'IBM Plex Sans';");
    expect(css).toContain("font-family: 'IBM Plex Mono';");
    expect(css).toContain("url('/fonts/ibm-plex-sans-latin-v23.woff2')");
    expect(css).toMatch(/font-display:\s*swap/);
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
