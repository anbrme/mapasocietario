import { describe, expect, it } from 'vitest';
import {
  EMPTY_WALKTHROUGH_EDITS, normalizeWalkthroughEdits, applyWalkthroughEdits,
  hideStep, setStepNote, moveStep, editsCounts, swapInSelection, setStepMoment, removeFromSelection,
  addConnection, removeConnection,
  setStepAnnotation, removeStepAnnotation, newAnnotationId, publishableAnnotations,
  ANNOTATIONS_PER_STEP_CAP, ANNOTATION_TEXT_MAX_LENGTH,
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
      .toEqual({ hidden: 2, notes: 1, moments: 0, connections: 0, annotations: 0 });
    expect(editsCounts({ hidden: [], order: [], notes: {}, moments: { a: '2024-03-11', b: 'not a day' } }))
      .toEqual({ hidden: 0, notes: 0, moments: 1, connections: 0, annotations: 0 });
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
        hidden: ['a'], order: ['b'], notes: { c: 'ok' }, moments: {}, connections: [], annotations: {},
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


describe('connection placement under a stale order', () => {
  const node = (key, nodeId) => ({ key, nodeId, kind: 'company' });
  const conn = (key, ends) => ({ key, nodeId: null, kind: 'connection', evidence: { ends } });
  it('a connection the saved order does not name lands right after the last of its ends', () => {
    const draft = [node('a', 'A'), node('b', 'B'), node('c', 'C'), node('d', 'D'), node('e', 'E'), conn('conn:x2', ['B', 'D'])];
    const edits = { ...EMPTY_WALKTHROUGH_EDITS, order: ['a', 'b', 'c', 'd', 'e'] };
    expect(applyWalkthroughEdits(draft, edits).map(x => x.key)).toEqual(['a', 'b', 'c', 'd', 'conn:x2', 'e']);
  });
  it('a connection the saved order names stays where the author put it', () => {
    const draft = [node('a', 'A'), node('b', 'B'), conn('conn:x', ['A', 'B'])];
    const edits = { ...EMPTY_WALKTHROUGH_EDITS, order: ['conn:x', 'a', 'b'] };
    expect(applyWalkthroughEdits(draft, edits).map(x => x.key)).toEqual(['conn:x', 'a', 'b']);
  });
});


// A chapter's single `moment` cannot carry an argument that runs across several
// registry dates, so the author can hang a dated note on each of them.
describe('dated notes', () => {
  const note = (id, date, text) => ({ id, date, text });

  it('EMPTY carries an empty annotations map', () => {
    expect(EMPTY_WALKTHROUGH_EDITS.annotations).toEqual({});
  });

  it('adds a note, then replaces it by id', () => {
    const added = setStepAnnotation(EMPTY_WALKTHROUGH_EDITS, 'a', note('n1', '2019-06-30', 'left the board'));
    expect(added.annotations.a).toEqual([note('n1', '2019-06-30', 'left the board')]);

    const edited = setStepAnnotation(added, 'a', note('n1', '2019-07-01', 'left the board, per the filing'));
    expect(edited.annotations.a).toEqual([note('n1', '2019-07-01', 'left the board, per the filing')]);
  });

  it('keeps a note the author has not dated or written yet', () => {
    const blank = setStepAnnotation(EMPTY_WALKTHROUGH_EDITS, 'a', { id: 'n1' });
    expect(blank.annotations.a).toEqual([note('n1', '', '')]);
  });

  it('refuses an id-less note and drops a note-less key', () => {
    expect(setStepAnnotation(EMPTY_WALKTHROUGH_EDITS, 'a', { date: '2019-06-30' }).annotations).toEqual({});
    expect(setStepAnnotation(EMPTY_WALKTHROUGH_EDITS, '', note('n1', '', 'x')).annotations).toEqual({});
  });

  it('clamps an over-long note and refuses a day that is not one', () => {
    const out = setStepAnnotation(EMPTY_WALKTHROUGH_EDITS, 'a', note('n1', '30/06/2019', 'x'.repeat(900)));
    expect(out.annotations.a[0].date).toBe('');
    expect(out.annotations.a[0].text).toHaveLength(ANNOTATION_TEXT_MAX_LENGTH);
  });

  it('caps the notes one chapter can hold', () => {
    let edits = EMPTY_WALKTHROUGH_EDITS;
    for (let i = 0; i < ANNOTATIONS_PER_STEP_CAP + 5; i += 1) {
      edits = setStepAnnotation(edits, 'a', note(`n${i}`, '2019-06-30', `note ${i}`));
    }
    expect(edits.annotations.a).toHaveLength(ANNOTATIONS_PER_STEP_CAP);
  });

  it('removes a note, and the key with the last of them', () => {
    const two = setStepAnnotation(
      setStepAnnotation(EMPTY_WALKTHROUGH_EDITS, 'a', note('n1', '2019-06-30', 'one')),
      'a', note('n2', '2020-01-01', 'two'),
    );
    expect(removeStepAnnotation(two, 'a', 'n1').annotations.a).toEqual([note('n2', '2020-01-01', 'two')]);
    const emptied = removeStepAnnotation(removeStepAnnotation(two, 'a', 'n1'), 'a', 'n2');
    expect(emptied.annotations).toEqual({});
    expect(removeStepAnnotation(two, 'a', 'nope').annotations).toEqual(two.annotations);
    expect(removeStepAnnotation(two, 'zzz', 'n1').annotations).toEqual(two.annotations);
  });

  it('hangs the notes on their step, oldest first, undated last', () => {
    const edits = {
      ...EMPTY_WALKTHROUGH_EDITS,
      annotations: { a: [note('n1', '2020-01-01', 'later'), note('n2', '', 'still writing'), note('n3', '2011-04-02', 'first')] },
    };
    const out = applyWalkthroughEdits(draft, edits);
    expect(out.find(x => x.key === 'a').annotations.map(n => n.id)).toEqual(['n3', 'n1', 'n2']);
    // A step nobody annotated is the draft's own object, untouched.
    expect(out.find(x => x.key === 'b').annotations).toBeUndefined();
  });

  it('publishes only the notes that carry both a date and something to say', () => {
    const step = { annotations: [note('n1', '2020-01-01', 'said'), note('n2', '', 'undated'), note('n3', '2019-01-01', '   ')] };
    expect(publishableAnnotations(step).map(n => n.id)).toEqual(['n1']);
    expect(publishableAnnotations({})).toEqual([]);
  });

  it('counts dated notes among the author’s edits', () => {
    const edits = { ...EMPTY_WALKTHROUGH_EDITS, annotations: { a: [note('n1', '', 'x'), note('n2', '', 'y')], b: [note('n3', '', 'z')] } };
    expect(editsCounts(edits).annotations).toBe(3);
  });

  it('mints ids that do not collide', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newAnnotationId()));
    expect(ids.size).toBe(50);
  });

  it('survives a stored shape it did not write', () => {
    expect(normalizeWalkthroughEdits({ annotations: [] }).annotations).toEqual({});
    expect(normalizeWalkthroughEdits({ annotations: { a: 'nope' } }).annotations).toEqual({});
    expect(normalizeWalkthroughEdits({ annotations: { a: [null, 3, { id: 'n1', text: 'ok' }, { id: 'n1', text: 'dupe' }] } }).annotations)
      .toEqual({ a: [{ id: 'n1', date: '', text: 'ok' }] });
  });
});
