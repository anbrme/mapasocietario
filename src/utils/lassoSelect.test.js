import { describe, it, expect } from 'vitest';
import { rectFromPoints, nodesInRect, LASSO_MIN_DRAG_PX } from './lassoSelect';

// Shift-drag on empty canvas draws a rectangle; every visible node inside it
// joins the selection. Geometry only — the hook owns the pointer events.

describe('rectFromPoints', () => {
  it('normalises any two corners into left/top/width/height', () => {
    expect(rectFromPoints({ x: 30, y: 40 }, { x: 10, y: 20 }))
      .toEqual({ left: 10, top: 20, width: 20, height: 20 });
  });
});

describe('nodesInRect', () => {
  const nodes = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 10, y: 10 },
    { id: 'c', x: 50, y: 50 },
    { id: 'd', x: undefined, y: 5 },
  ];

  it('returns the ids of nodes whose centre lies inside the graph-space rectangle', () => {
    expect(nodesInRect(nodes, { x: -1, y: -1 }, { x: 20, y: 20 })).toEqual(['a', 'b']);
  });

  it('accepts corners in any order', () => {
    expect(nodesInRect(nodes, { x: 20, y: 20 }, { x: -1, y: -1 })).toEqual(['a', 'b']);
  });

  it('treats the edge as inside', () => {
    expect(nodesInRect(nodes, { x: 0, y: 0 }, { x: 10, y: 10 })).toEqual(['a', 'b']);
  });

  it('skips nodes the simulation has not positioned yet', () => {
    expect(nodesInRect(nodes, { x: -10, y: -10 }, { x: 100, y: 100 })).toEqual(['a', 'b', 'c']);
  });

  it('tolerates a null node list', () => {
    expect(nodesInRect(null, { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual([]);
  });
});

describe('LASSO_MIN_DRAG_PX', () => {
  it('is a small positive threshold so a shift-click is not a lasso', () => {
    expect(LASSO_MIN_DRAG_PX).toBeGreaterThan(0);
    expect(LASSO_MIN_DRAG_PX).toBeLessThan(20);
  });
});
