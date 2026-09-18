import { describe, it, expect } from 'vitest';
import { ringLayout, RING_BASE_RADIUS } from './replayLayout';

const cps = n => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, firstAct: `2010-01-${String(i + 1).padStart(2, '0')}` }));

describe('ringLayout', () => {
  it('is deterministic', () => {
    expect(ringLayout(cps(30))).toEqual(ringLayout(cps(30)));
  });

  it('puts the earliest arrival at 12 o\'clock and proceeds clockwise', () => {
    const { positions } = ringLayout(cps(4));
    const first = positions.get('c0');
    const second = positions.get('c1');
    expect(first.x).toBeCloseTo(0);
    expect(first.y).toBeCloseTo(-RING_BASE_RADIUS);
    // Clockwise on a y-down canvas: the next node is to the right.
    expect(second.x).toBeGreaterThan(0);
  });

  it('opens a new ring when one is full, never overlapping nodes', () => {
    const { positions, radius } = ringLayout(cps(300));
    expect(radius).toBeGreaterThan(RING_BASE_RADIUS);
    const pts = [...positions.values()];
    for (let i = 0; i < pts.length; i += 1) {
      for (let j = i + 1; j < pts.length; j += 1) {
        expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)).toBeGreaterThan(10);
      }
    }
  });

  it('handles an empty history', () => {
    expect(ringLayout([]).positions.size).toBe(0);
  });
});
