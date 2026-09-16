import { describe, expect, it } from 'vitest';
import { LANDING_HERO_COPY, LANDING_TOP_LINKS, LANDING_SEARCH_ACTION } from './landingHero';
import { LANDING_COPY } from '../components/landingCopy';

const LANGS = ['en', 'es'];
const REQUIRED_HERO_KEYS = ['eyebrow', 'h1', 'subtitle', 'intro', 'searchPlaceholder', 'searchHint', 'searchButton', 'navLabel', 'demoAlt'];

describe('LANDING_HERO_COPY', () => {
  it.each(LANGS)('provides every hero string for %s', (lang) => {
    for (const key of REQUIRED_HERO_KEYS) {
      expect(LANDING_HERO_COPY[lang][key], `${lang}.${key}`).toEqual(expect.any(String));
      expect(LANDING_HERO_COPY[lang][key].trim().length, `${lang}.${key}`).toBeGreaterThan(0);
    }
  });

  it.each(LANGS)('is the same text React renders in the %s hero', (lang) => {
    // The static hero is painted from this module before the bundle runs and
    // React draws over it. If the two ever diverge the visitor sees the
    // headline change under them, so pin the React copy to this source.
    const hero = LANDING_COPY[lang].hero;
    expect(hero.eyebrow).toBe(LANDING_HERO_COPY[lang].eyebrow);
    expect(hero.h1).toBe(LANDING_HERO_COPY[lang].h1);
    expect(hero.subtitle).toBe(LANDING_HERO_COPY[lang].subtitle);
    expect(hero.intro).toBe(LANDING_HERO_COPY[lang].intro);
  });

  it.each(LANGS)('is the same header link set React renders for %s', (lang) => {
    expect(LANDING_COPY[lang].topLinks).toEqual(LANDING_TOP_LINKS[lang]);
  });

  it('has exactly one right-aligned language switcher per language', () => {
    for (const lang of LANGS) {
      expect(LANDING_TOP_LINKS[lang].filter((link) => link.alignRight)).toHaveLength(1);
    }
  });

  it('submits the pre-hydration search to the workspace route with a trailing slash', () => {
    // Cloudflare Pages 308s the unslashed form; a redirect on the one action a
    // visitor can take before JavaScript arrives would waste their first tap.
    expect(LANDING_SEARCH_ACTION).toBe('/app/');
  });
});
