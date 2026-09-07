import { describe, expect, it } from 'vitest';
import { LANDING_TOKENS, landingTokens } from './landingTokens';
import { DARK_TOKENS, LIGHT_TOKENS } from './palette';
import { contrastRatio } from './contrast';

const WHITE_ALPHA = /rgba\(\s*255\s*,\s*255\s*,\s*255/;
const TEXT_FLOOR = 4.5;

describe('landingTokens — one surface set per mode', () => {
  it('returns the dark set for dark, light for light, and dark for anything else', () => {
    expect(landingTokens('dark')).toBe(LANDING_TOKENS.dark);
    expect(landingTokens('light')).toBe(LANDING_TOKENS.light);
    expect(landingTokens('sepia')).toBe(LANDING_TOKENS.dark);
    expect(landingTokens(undefined)).toBe(LANDING_TOKENS.dark);
  });

  it('defines the same keys in both modes so no surface can fall through to the other', () => {
    expect(Object.keys(LANDING_TOKENS.light).sort()).toEqual(Object.keys(LANDING_TOKENS.dark).sort());
  });

  it('is frozen', () => {
    expect(Object.isFrozen(LANDING_TOKENS.dark)).toBe(true);
    expect(Object.isFrozen(LANDING_TOKENS.light)).toBe(true);
  });
});

describe('landingTokens — dark stays exactly the landing that shipped', () => {
  const dark = LANDING_TOKENS.dark;

  it('keeps the page and demo surfaces on the palette values the page hardcoded', () => {
    expect(dark.page).toBe(DARK_TOKENS.background.default);
    expect(dark.demoSurface).toBe(DARK_TOKENS.graph.surface.canvas);
  });

  it('keeps the search field and glass panels on their white-alpha washes', () => {
    expect(dark.fieldBg).toBe('rgba(255,255,255,0.12)');
    expect(dark.fieldBorder).toBe('rgba(255,255,255,0.72)');
    expect(dark.panelBg).toBe('rgba(255,255,255,0.025)');
    expect(dark.hairline).toBe('rgba(255,255,255,0.06)');
  });

  it('keeps muted copy on the dark disabled-text value the page used', () => {
    expect(dark.muted).toBe('rgba(255,255,255,0.5)');
  });
});

describe('landingTokens — light is readable, not a tinted dark', () => {
  const light = LANDING_TOKENS.light;

  it('sits on the light palette background', () => {
    expect(light.page).toBe(LIGHT_TOKENS.background.default);
  });

  it('uses no white-alpha wash anywhere, which would vanish on a light page', () => {
    for (const [key, value] of Object.entries(light)) {
      expect(value, key).not.toMatch(WHITE_ALPHA);
    }
  });

  it('keeps muted copy above the WCAG text floor on the page background', () => {
    expect(contrastRatio(light.muted, light.page)).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it('keeps muted copy readable on the demo surface and panels too', () => {
    expect(contrastRatio(light.muted, light.demoSurface)).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it('gives the hero network labels enough contrast on its light surface', () => {
    expect(contrastRatio(light.heroLabel, light.demoSurface)).toBeGreaterThanOrEqual(TEXT_FLOOR);
    expect(contrastRatio(light.heroLabelSubtle, light.demoSurface)).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });
});
