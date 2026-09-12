import { describe, expect, it } from 'vitest';
import { initialWalkthroughState, walkthroughReducer, focusSets } from './walkthroughState';

describe('walkthroughReducer', () => {
  it('moves idle → preparing → playing and clamps navigation', () => {
    let s = walkthroughReducer(initialWalkthroughState, { type: 'prepare' });
    expect(s.status).toBe('preparing');
    s = walkthroughReducer(s, { type: 'ready', findingsByKey: new Map([['a', null]]) });
    expect(s.status).toBe('idle');
    expect(s.findingsByKey.get('a')).toBeNull();
    s = walkthroughReducer(s, { type: 'start' });
    expect(s).toMatchObject({ status: 'playing', index: 0 });
    s = walkthroughReducer(s, { type: 'goto', index: 5, total: 3 });
    expect(s.index).toBe(2);
    s = walkthroughReducer(s, { type: 'goto', index: -4, total: 3 });
    expect(s.index).toBe(0);
    s = walkthroughReducer(s, { type: 'exit' });
    expect(s).toMatchObject({ status: 'idle', index: -1 });
  });

  it('focusSets exposes node ids and link keys as Sets', () => {
    const f = focusSets({ nodeIds: ['a', 'b'], linkKeys: ['a|b'] });
    expect(f.tourNodeIds.has('b')).toBe(true);
    expect(f.tourLinkKeys.has('a|b')).toBe(true);
    expect(focusSets(null).tourNodeIds.size).toBe(0);
  });
});
