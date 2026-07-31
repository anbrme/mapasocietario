import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_ROUTE, STORAGE_KEY } from './themeMode';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

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
