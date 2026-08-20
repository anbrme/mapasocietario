import { describe, expect, it } from 'vitest';
import { analyticsPagePath, normalizeAnalyticsPathname } from './analyticsPath';

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
