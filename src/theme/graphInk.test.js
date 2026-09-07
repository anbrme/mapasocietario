import { describe, expect, it } from 'vitest';
import { GRAPH_INK, graphInk } from './graphInk';

describe('graphInk — per-mode drawing weights for the force graph', () => {
  it('returns dark for dark, light for light, and dark for anything else', () => {
    expect(graphInk('dark')).toBe(GRAPH_INK.dark);
    expect(graphInk('light')).toBe(GRAPH_INK.light);
    expect(graphInk('sepia')).toBe(GRAPH_INK.dark);
    expect(graphInk(undefined)).toBe(GRAPH_INK.dark);
  });

  it('keeps dark on the weights the canvas has always used', () => {
    // These were literals in the draw code; the dark graph must not change.
    expect(GRAPH_INK.dark).toEqual({ nodeTintAlpha: 0.45, deadEndTintAlpha: 0.10, linkAlpha: 0.78 });
  });

  it('tints light nodes far less, so the darkened outline colours do not flood the disc', () => {
    // Light node colours were darkened to clear 3:1 as outlines; at the dark
    // tint alpha they paint a solid saturated disc over the white fill.
    expect(GRAPH_INK.light.nodeTintAlpha).toBeLessThanOrEqual(0.2);
    expect(GRAPH_INK.light.nodeTintAlpha).toBeGreaterThan(GRAPH_INK.light.deadEndTintAlpha);
  });

  it('draws light links lighter than dark ones, so red cessations stop shouting on white', () => {
    expect(GRAPH_INK.light.linkAlpha).toBeLessThan(GRAPH_INK.dark.linkAlpha);
    expect(GRAPH_INK.light.linkAlpha).toBeGreaterThanOrEqual(0.5);
  });

  it('keeps every weight a usable alpha and freezes the sets', () => {
    for (const set of Object.values(GRAPH_INK)) {
      expect(Object.isFrozen(set)).toBe(true);
      for (const value of Object.values(set)) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});
