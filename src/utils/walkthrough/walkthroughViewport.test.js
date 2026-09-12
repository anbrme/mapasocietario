import { describe, expect, it } from 'vitest';
import { stepViewport } from './walkthroughViewport';

const nodesById = new Map([
  ['a', { id: 'a', x: 100, y: 100 }],
  ['b', { id: 'b', x: 300, y: 500 }],
  ['nan', { id: 'nan' }],
]);
const frame = { width: 800, height: 600 };

describe('stepViewport', () => {
  it('centres a single node at the single-node zoom', () => {
    expect(stepViewport({ nodeIds: ['a'] }, nodesById, frame)).toEqual({ x: 100, y: 100, k: 2.2 });
  });

  it('fits several nodes inside the frame with padding', () => {
    const v = stepViewport({ nodeIds: ['a', 'b'] }, nodesById, { ...frame, padding: 100 });
    expect(v.x).toBe(200);
    expect(v.y).toBe(300);
    // span 200 x 400; usable 600 x 400 → k = min(600/200, 400/400) = 1
    expect(v.k).toBe(1);
  });

  it('clamps zoom to the bounds', () => {
    const tiny = new Map([['a', { x: 0, y: 0 }], ['b', { x: 1, y: 1 }]]);
    expect(stepViewport({ nodeIds: ['a', 'b'] }, tiny, frame).k).toBe(3);
    const huge = new Map([['a', { x: 0, y: 0 }], ['b', { x: 10000, y: 0 }]]);
    expect(stepViewport({ nodeIds: ['a', 'b'] }, huge, frame).k).toBe(0.6);
  });

  it('ignores nodes without coordinates and returns null when none remain', () => {
    expect(stepViewport({ nodeIds: ['nan'] }, nodesById, frame)).toBeNull();
    expect(stepViewport({ nodeIds: ['nan', 'a'] }, nodesById, frame)).toEqual({ x: 100, y: 100, k: 2.2 });
  });
});
