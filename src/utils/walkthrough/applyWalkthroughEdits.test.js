import { describe, expect, it } from 'vitest';
import {
  EMPTY_WALKTHROUGH_EDITS, normalizeWalkthroughEdits, applyWalkthroughEdits,
  hideStep, setStepNote, moveStep, editsCounts, swapInSelection, setStepMoment, removeFromSelection,
  addConnection, removeConnection,
} from './applyWalkthroughEdits';

const s = (key, extra = {}) => ({ key, section: 'connects', nodeIds: ['n'], linkKeys: [], title: key, text: '', source: 'graph', date: null, evidence: null, flag: null, deepLink: '', authorNote: null, ...extra });
const draft = [s('a'), s('b', { authorNote: { text: 'from node', flag: 'amber', origin: 'node' } }), s('c'), s('d')];

describe('applyWalkthroughEdits', () => {
  it('returns the draft untouched for empty edits', () => {
    expect(applyWalkthroughEdits(draft, EMPTY_WALKTHROUGH_EDITS)).toEqual(draft);
  });

  it('drops hidden steps', () => {
    expect(applyWalkthroughEdits(draft, { ...EMPTY_WALKTHROUGH_EDITS, hidden: ['b'] }).map(x => x.key)).toEqual(['a', 'c', 'd']);
  });

  it('honours a partial order and keeps the rest in draft order', () => {
    expect(applyWalkthroughEdits(draft, { ...EMPTY_WALKTHROUGH_EDITS, order: ['c', 'a'] }).map(x => x.key)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('ignores order keys that no step carries', () => {
    expect(applyWalkthroughEdits(draft, { ...EMPTY_WALKTHROUGH_EDITS, order: ['zzz', 'd'] }).map(x => x.key)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('a step note overrides the node note; a missing key is ignored', () => {
    const out = applyWalkthroughEdits(draft, { ...EMPTY_WALKTHROUGH_EDITS, notes: { b: 'mine', nope: 'x' } });
    expect(out.find(x => x.key === 'b').authorNote).toEqual({ text: 'mine', flag: null, origin: 'step' });
    expect(out.find(x => x.key === 'a').authorNote).toBeNull();
  });

  it('does not mutate inputs', () => {
    const edits = { hidden: ['a'], order: ['d'], notes: { c: 'n' } };
    const before = JSON.stringify({ draft, edits });
    applyWalkthroughEdits(draft, edits);
    expect(JSON.stringify({ draft, edits })).toBe(before);
  });
});

describe('reducers', () => {
  it('hideStep adds once', () => {
    const e = hideStep(hideStep(EMPTY_WALKTHROUGH_EDITS, 'a'), 'a');
    expect(e.hidden).toEqual(['a']);
  });

  it('setStepNote trims and deletes on empty', () => {
    const e = setStepNote(EMPTY_WALKTHROUGH_EDITS, 'a', '  hi ');
    expect(e.notes).toEqual({ a: 'hi' });
    expect(setStepNote(e, 'a', '   ').notes).toEqual({});
  });

  it('moveStep swaps with its neighbour and records the full order', () => {
    const e = moveStep(EMPTY_WALKTHROUGH_EDITS, ['a', 'b', 'c'], 'c', -1);
    expect(e.order).toEqual(['a', 'c', 'b']);
    expect(moveStep(e, ['a', 'c', 'b'], 'a', -1).order).toEqual(['a', 'c', 'b']);
    expect(moveStep(e, ['a', 'c', 'b'], 'b', 1).order).toEqual(['a', 'c', 'b']);
  });

  it('editsCounts counts hidden, notes and re-dated moments', () => {
    expect(editsCounts({ hidden: ['a', 'b'], order: [], notes: { c: 'x' } }))
      .toEqual({ hidden: 2, notes: 1, moments: 0, connections: 0 });
    expect(editsCounts({ hidden: [], order: [], notes: {}, moments: { a: '2024-03-11', b: 'not a day' } }))
      .toEqual({ hidden: 0, notes: 0, moments: 1, connections: 0 });
  });
});

describe('swapInSelection', () => {
  it('swaps two ids by value, wherever they sit in the array', () => {
    expect(swapInSelection(['a', 'b', 'c', 'd'], 'a', 'd')).toEqual(['d', 'b', 'c', 'a']);
  });

  it('returns the array unchanged when either id is missing', () => {
    const selection = ['a', 'b', 'c'];
    expect(swapInSelection(selection, 'a', 'nope')).toBe(selection);
    expect(swapInSelection(selection, 'nope', 'b')).toBe(selection);
  });
});

describe('normalizeWalkthroughEdits', () => {
  it('accepts junk and returns the empty shape', () => {
    expect(normalizeWalkthroughEdits(undefined)).toEqual(EMPTY_WALKTHROUGH_EDITS);
    expect(normalizeWalkthroughEdits({ hidden: 'x', order: 3, notes: [] })).toEqual(EMPTY_WALKTHROUGH_EDITS);
  });

  it('keeps only string keys and string notes', () => {
    expect(normalizeWalkthroughEdits({ hidden: ['a', 1], order: ['b', null], notes: { c: 'ok', d: 2 } }))
      .toEqual({
        hidden: ['a'], order: ['b'], notes: { c: 'ok' }, moments: {}, connections: [],
      });
  });
});

describe('moments', () => {
  it('EMPTY carries an empty moments map', () => {
    expect(EMPTY_WALKTHROUGH_EDITS.moments).toEqual({});
  });
  it('normalises moments to ISO days only', () => {
    expect(normalizeWalkthroughEdits({ moments: { a: '2024-03-11', b: 'nope', c: 3 } }).moments).toEqual({ a: '2024-03-11' });
    expect(normalizeWalkthroughEdits({ moments: [] }).moments).toEqual({});
  });
  it('an overlay moment wins over the draft moment; a step without one is left untouched', () => {
    const d = [s('a', { moment: '2020-01-01' }), s('b')];
    const out = applyWalkthroughEdits(d, { ...EMPTY_WALKTHROUGH_EDITS, moments: { a: '2024-03-11' } });
    expect(out[0].moment).toBe('2024-03-11');
    expect(out[1]).toEqual(d[1]);
  });
  it('setStepMoment stores a valid day and clears on empty or invalid', () => {
    const e1 = setStepMoment(EMPTY_WALKTHROUGH_EDITS, 'a', '2024-03-11');
    expect(e1.moments).toEqual({ a: '2024-03-11' });
    expect(setStepMoment(e1, 'a', '').moments).toEqual({});
    expect(setStepMoment(e1, 'a', '2024-3-1').moments).toEqual({});
    expect(EMPTY_WALKTHROUGH_EDITS.moments).toEqual({});
  });
});

describe('removeFromSelection', () => {
  it('drops the id and keeps the order of the rest', () => {
    expect(removeFromSelection(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
  it('returns the same array when the id is absent or the selection is empty', () => {
    const selection = ['a', 'b'];
    expect(removeFromSelection(selection, 'nope')).toBe(selection);
    expect(removeFromSelection(undefined, 'a')).toEqual([]);
  });
});


describe('connections in the overlay', () => {
  it('EMPTY carries an empty connections list and normalize keeps only string keys', () => {
    expect(EMPTY_WALKTHROUGH_EDITS.connections).toEqual([]);
    expect(normalizeWalkthroughEdits({ connections: ['conn:a', 3, null] }).connections).toEqual(['conn:a']);
  });
  it('addConnection adds once, removeConnection drops, editsCounts counts them', () => {
    let e = addConnection(EMPTY_WALKTHROUGH_EDITS, 'conn:x');
    e = addConnection(e, 'conn:x');
    expect(e.connections).toEqual(['conn:x']);
    expect(editsCounts(e).connections).toBe(1);
    expect(removeConnection(e, 'conn:x').connections).toEqual([]);
    expect(removeConnection(e, 'conn:nope')).toEqual(e);
  });
});
