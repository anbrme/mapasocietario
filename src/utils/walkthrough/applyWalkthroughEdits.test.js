import { describe, expect, it } from 'vitest';
import {
  EMPTY_WALKTHROUGH_EDITS, normalizeWalkthroughEdits, applyWalkthroughEdits,
  hideStep, setStepNote, moveStep, editsCounts,
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

  it('editsCounts counts hidden and notes', () => {
    expect(editsCounts({ hidden: ['a', 'b'], order: [], notes: { c: 'x' } })).toEqual({ hidden: 2, notes: 1 });
  });
});

describe('normalizeWalkthroughEdits', () => {
  it('accepts junk and returns the empty shape', () => {
    expect(normalizeWalkthroughEdits(undefined)).toEqual(EMPTY_WALKTHROUGH_EDITS);
    expect(normalizeWalkthroughEdits({ hidden: 'x', order: 3, notes: [] })).toEqual(EMPTY_WALKTHROUGH_EDITS);
  });

  it('keeps only string keys and string notes', () => {
    expect(normalizeWalkthroughEdits({ hidden: ['a', 1], order: ['b', null], notes: { c: 'ok', d: 2 } }))
      .toEqual({ hidden: ['a'], order: ['b'], notes: { c: 'ok' } });
  });
});
