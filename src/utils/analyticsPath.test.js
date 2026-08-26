import { describe, expect, it } from 'vitest';
import { analyticsPageLocation, analyticsPagePath, normalizeAnalyticsPathname } from './analyticsPath';

describe('normalizeAnalyticsPathname', () => {
  it('merges bare and trailing-slash app paths into the canonical URL', () => {
    expect(normalizeAnalyticsPathname('/app')).toBe('/app/');
    expect(normalizeAnalyticsPathname('/app/')).toBe('/app/');
    expect(normalizeAnalyticsPathname('/app///')).toBe('/app/');
  });

  it('keeps the root path unchanged', () => {
    expect(normalizeAnalyticsPathname('/')).toBe('/');
  });

  it('preserves the query string after pathname normalisation', () => {
    expect(analyticsPagePath('/app', '?lang=es&source=test'))
      .toBe('/app/?lang=es&source=test');
  });
});

describe('analyticsPageLocation', () => {
  it('builds the absolute URL GA4 actually reads', () => {
    expect(analyticsPageLocation('/app', '', 'https://mapasocietario.es'))
      .toBe('https://mapasocietario.es/app/');
  });

  it('normalises the pathname and keeps the query string', () => {
    expect(analyticsPageLocation('/app///', '?lang=es', 'https://mapasocietario.es'))
      .toBe('https://mapasocietario.es/app/?lang=es');
  });

  it('keeps the root path unchanged', () => {
    expect(analyticsPageLocation('/', '', 'https://mapasocietario.es'))
      .toBe('https://mapasocietario.es/');
  });

  it('drops a trailing slash on the origin so the URL never doubles up', () => {
    expect(analyticsPageLocation('/app', '', 'https://mapasocietario.es/'))
      .toBe('https://mapasocietario.es/app/');
  });

  it('falls back to a bare path when no origin is available', () => {
    expect(analyticsPageLocation('/app', '', '')).toBe('/app/');
  });
});
