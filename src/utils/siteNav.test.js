import { describe, test, expect } from 'vitest';
import { siteNav, isStaticNav } from './siteNav';

// Prerendered routes are plain HTML written by scripts/prerender.mjs; the SPA
// router has no route for them. They must full-page load, because the router's
// "/es/:slug" rule otherwise catches /es/glosario and /es/cargos-registrales
// client-side and renders the generic Spanish SEO page over the real content.
describe('isStaticNav', () => {
  test('prerendered pages full-page load in both languages', () => {
    for (const lang of ['en', 'es']) {
      const nav = siteNav(lang);
      expect(isStaticNav(nav.cargos), nav.cargos).toBe(true);
      expect(isStaticNav(nav.glossary), nav.glossary).toBe(true);
      expect(isStaticNav(nav.studies), nav.studies).toBe(true);
    }
  });

  test('real SPA routes are still client-routed', () => {
    expect(isStaticNav(siteNav('en').pricing)).toBe(false);
    expect(isStaticNav('/app')).toBe(false);
    expect(isStaticNav('/empresa/grifols-sa')).toBe(false);
  });

  test('the cargo page has a URL per language', () => {
    expect(siteNav('en').cargos).toBe('/registry-positions/');
    expect(siteNav('es').cargos).toBe('/es/cargos-registrales/');
  });
});
