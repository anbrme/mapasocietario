// The author's edits to a drafted walkthrough, as an OVERLAY keyed by step key.
// Not a materialised copy: the draft is recomputed from the graph, the overlay
// is applied on top, so a re-expanded graph gains steps without losing the
// author's order, and a step whose node is hidden reappears where it was.

import { isIsoDay } from './registryTimeline';

export const EMPTY_WALKTHROUGH_EDITS = Object.freeze({
  hidden: [], order: [], notes: {}, moments: {},
});

const strings = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);

export const normalizeWalkthroughEdits = raw => {
  if (!raw || typeof raw !== 'object') return EMPTY_WALKTHROUGH_EDITS;
  const notes = raw.notes && typeof raw.notes === 'object' && !Array.isArray(raw.notes)
    ? Object.fromEntries(Object.entries(raw.notes).filter(([, v]) => typeof v === 'string'))
    : {};
  const moments = raw.moments && typeof raw.moments === 'object' && !Array.isArray(raw.moments)
    ? Object.fromEntries(Object.entries(raw.moments).filter(([, v]) => isIsoDay(v)))
    : {};
  return {
    hidden: strings(raw.hidden), order: strings(raw.order), notes, moments,
  };
};

export const applyWalkthroughEdits = (steps, edits) => {
  const e = normalizeWalkthroughEdits(edits);
  const hidden = new Set(e.hidden);
  const visible = (steps || []).filter(s => !hidden.has(s.key));
  const byKey = new Map(visible.map(s => [s.key, s]));
  const ordered = e.order.filter(k => byKey.has(k)).map(k => byKey.get(k));
  const placed = new Set(ordered.map(s => s.key));
  const rest = visible.filter(s => !placed.has(s.key));
  return [...ordered, ...rest].map(s => {
    const withNote = Object.prototype.hasOwnProperty.call(e.notes, s.key)
      ? { ...s, authorNote: { text: e.notes[s.key], flag: null, origin: 'step' } }
      : s;
    return Object.prototype.hasOwnProperty.call(e.moments, s.key)
      ? { ...withNote, moment: e.moments[s.key] }
      : withNote;
  });
};

export const hideStep = (edits, key) => {
  const e = normalizeWalkthroughEdits(edits);
  return e.hidden.includes(key) ? e : { ...e, hidden: [...e.hidden, key] };
};

export const setStepNote = (edits, key, text) => {
  const e = normalizeWalkthroughEdits(edits);
  const clean = String(text || '').trim();
  const notes = { ...e.notes };
  if (clean) notes[key] = clean; else delete notes[key];
  return { ...e, notes };
};

export const setStepMoment = (edits, key, iso) => {
  const e = normalizeWalkthroughEdits(edits);
  const moments = { ...e.moments };
  if (isIsoDay(iso)) moments[key] = iso; else delete moments[key];
  return { ...e, moments };
};

export const moveStep = (edits, currentKeys, key, delta) => {
  const e = normalizeWalkthroughEdits(edits);
  const keys = [...(currentKeys || [])];
  const i = keys.indexOf(key);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= keys.length) return e;
  [keys[i], keys[j]] = [keys[j], keys[i]];
  return { ...e, order: keys };
};

export const editsCounts = edits => {
  const e = normalizeWalkthroughEdits(edits);
  return {
    hidden: e.hidden.length,
    notes: Object.keys(e.notes).length,
    moments: Object.keys(e.moments).length,
  };
};

/**
 * Swap two node ids within the FULL ordered selection array (not a filtered
 * view of it), by value rather than by position. A no-op — returning the
 * same array reference — when either id is not present, so a caller can
 * treat "unchanged" as "nothing to write back".
 * @param {Array<string>} selection
 * @param {string} idA
 * @param {string} idB
 * @returns {Array<string>}
 */
export const swapInSelection = (selection, idA, idB) => {
  const list = selection || [];
  const i = list.indexOf(idA);
  const j = list.indexOf(idB);
  if (i < 0 || j < 0) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

/**
 * The selection without one node — in selection mode this IS "remove the
 * step", since every step is one selected node. Same array back when the id
 * is not there, so callers can skip a no-op update.
 * @param {Array<string>} selection
 * @param {string} id
 * @returns {Array<string>}
 */
export const removeFromSelection = (selection, id) => {
  const list = selection || [];
  return list.includes(id) ? list.filter(x => x !== id) : list;
};
