import { describe, expect, it } from 'vitest';
import { initialWalkthroughState, walkthroughReducer, focusSets, stepTransition } from './walkthroughState';

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

  it('start with firstKey sets currentKey', () => {
    const s = walkthroughReducer(initialWalkthroughState, { type: 'start', firstKey: 'k0' });
    expect(s).toMatchObject({ status: 'playing', index: 0, currentKey: 'k0' });
  });

  it('sync re-anchors by key after a removal before the current step', () => {
    let s = { ...initialWalkthroughState, status: 'playing', index: 2, currentKey: 'c' };
    s = walkthroughReducer(s, { type: 'sync', keys: ['a', 'c', 'd'] });
    expect(s).toMatchObject({ index: 1, currentKey: 'c' });
  });

  it('sync clamps when the current key is gone', () => {
    let s = { ...initialWalkthroughState, status: 'playing', index: 2, currentKey: 'gone' };
    s = walkthroughReducer(s, { type: 'sync', keys: ['a', 'b'] });
    expect(s).toMatchObject({ index: 1, currentKey: 'b' });
  });

  it('sync exits when keys are empty', () => {
    let s = { ...initialWalkthroughState, status: 'playing', index: 0, currentKey: 'a' };
    s = walkthroughReducer(s, { type: 'sync', keys: [] });
    expect(s).toMatchObject({ status: 'idle', index: -1, currentKey: null });
  });

  it('sync is a no-op when idle', () => {
    const s = walkthroughReducer(initialWalkthroughState, { type: 'sync', keys: ['a'] });
    expect(s).toBe(initialWalkthroughState);
  });
});

describe('stepTransition', () => {
  it('reports no move when already clamped at the end', () => {
    const t = stepTransition(2, 5, 3);
    expect(t).toMatchObject({ next: 2, moved: false, completed: false });
  });

  it('marks completed only on the transition into the last index', () => {
    const t = stepTransition(1, 2, 3);
    expect(t).toMatchObject({ next: 2, moved: true, completed: true });
    const already = stepTransition(2, 2, 3);
    expect(already).toMatchObject({ next: 2, moved: false, completed: false });
  });

  it('total 0 gives next 0 and moved false from index 0', () => {
    const t = stepTransition(0, 3, 0);
    expect(t).toMatchObject({ next: 0, moved: false });
  });
});
