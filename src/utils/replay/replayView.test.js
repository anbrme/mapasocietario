import { describe, it, expect } from 'vitest';
import { IDENTITY_VIEW, MIN_ZOOM, MAX_ZOOM, zoomAt, panBy } from './replayView';

describe('zoomAt', () => {
  it('keeps the point under the cursor fixed', () => {
    const centre = { x: 400, y: 300 };
    const cursor = { x: 550, y: 220 };
    const before = IDENTITY_VIEW;
    const after = zoomAt(before, 2, cursor, centre);
    // A stage point p is drawn at centre + view.pan + p * k (fit scale cancels).
    const worldUnder = v => ({ x: (cursor.x - centre.x - v.x) / v.k, y: (cursor.y - centre.y - v.y) / v.k });
    expect(worldUnder(after).x).toBeCloseTo(worldUnder(before).x);
    expect(worldUnder(after).y).toBeCloseTo(worldUnder(before).y);
    expect(after.k).toBe(2);
  });

  it('clamps the zoom and leaves the view untouched at a limit', () => {
    const atMax = { k: MAX_ZOOM, x: 10, y: 10 };
    expect(zoomAt(atMax, 2, { x: 0, y: 0 }, { x: 0, y: 0 })).toEqual(atMax);
    expect(zoomAt(IDENTITY_VIEW, 0.001, { x: 0, y: 0 }, { x: 0, y: 0 }).k).toBe(MIN_ZOOM);
  });
});

describe('panBy', () => {
  it('moves the view by screen pixels, whatever the zoom', () => {
    expect(panBy({ k: 3, x: 5, y: -5 }, 10, 20)).toEqual({ k: 3, x: 15, y: 15 });
  });
});
