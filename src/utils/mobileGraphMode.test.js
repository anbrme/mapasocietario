import { describe, expect, it } from 'vitest';
import { mobileGraphMode } from './mobileGraphMode';

describe('mobileGraphMode', () => {
  it('keeps search visible on an empty mobile graph but blocks automatic panels', () => {
    expect(mobileGraphMode({
      embedded: true,
      compactViewport: true,
      forceCompactMode: false,
      initialCompanyName: '',
      nodeCount: 0,
    })).toEqual({ surface: true, active: false, allowAutomaticPanels: false });
  });

  it('activates compact mode when an in-graph search produces its first node', () => {
    expect(mobileGraphMode({
      embedded: true,
      compactViewport: true,
      forceCompactMode: false,
      initialCompanyName: '',
      nodeCount: 1,
    })).toEqual({ surface: true, active: true, allowAutomaticPanels: false });
  });

  it('activates immediately for a mobile deep link', () => {
    expect(mobileGraphMode({
      embedded: true,
      compactViewport: true,
      forceCompactMode: false,
      initialCompanyName: 'ACERINOX SA',
      nodeCount: 0,
    }).active).toBe(true);
  });

  it('keeps desktop automatic panels and supports forced native compact mode', () => {
    expect(mobileGraphMode({
      embedded: true,
      compactViewport: false,
      forceCompactMode: false,
      initialCompanyName: '',
      nodeCount: 1,
    }).allowAutomaticPanels).toBe(true);

    expect(mobileGraphMode({
      embedded: true,
      compactViewport: false,
      forceCompactMode: true,
      initialCompanyName: '',
      nodeCount: 1,
    })).toEqual({ surface: true, active: true, allowAutomaticPanels: false });
  });

  it('gives the compact surface a real escape hatch: an explicit full-mode request wins', () => {
    // The "open full application" button in compact mode used to point at the
    // same URL it was already showing, so on a phone it re-rendered the compact
    // graph. It now carries ?full=1, which must beat both the viewport test and
    // the native-app override.
    expect(mobileGraphMode({
      embedded: true,
      compactViewport: true,
      forceCompactMode: false,
      forceFullMode: true,
      initialCompanyName: 'ACERINOX SA',
      nodeCount: 12,
    })).toEqual({ surface: false, active: false, allowAutomaticPanels: true });

    expect(mobileGraphMode({
      embedded: true,
      compactViewport: true,
      forceCompactMode: true,
      forceFullMode: true,
      initialCompanyName: '',
      nodeCount: 1,
    }).surface).toBe(false);
  });
});
