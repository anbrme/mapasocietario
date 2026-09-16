// The author's edits to a drafted walkthrough, as an OVERLAY keyed by step key.
// Not a materialised copy: the draft is recomputed from the graph, the overlay
// is applied on top, so a re-expanded graph gains steps without losing the
// author's order, and a step whose node is hidden reappears where it was.

import { isIsoDay } from './registryTimeline';

export const EMPTY_WALKTHROUGH_EDITS = Object.freeze({
  hidden: [], order: [], notes: {}, moments: {}, connections: [], annotations: {},
});

// A chapter's `moment` is ONE date — the day the map is pinned to. An argument
// about a director rarely fits on one day, so the author can also hang dated
// notes off a chapter: each carries its own date and its own text, and each
// lands in the report's chronology on that day.
export const ANNOTATIONS_PER_STEP_CAP = 12;
export const ANNOTATION_TEXT_MAX_LENGTH = 600;

const strings = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);

const normalizeAnnotation = raw => {
  const id = typeof raw?.id === 'string' ? raw.id.trim() : '';
  if (!id) return null;
  return {
    id,
    // Empty is kept on purpose: a note the author is still typing has no date
    // yet, and dropping the row out from under them is not an edit they made.
    date: isIsoDay(raw?.date) ? raw.date : '',
    text: typeof raw?.text === 'string' ? raw.text.slice(0, ANNOTATION_TEXT_MAX_LENGTH) : '',
  };
};

const normalizeAnnotations = raw => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  Object.entries(raw).forEach(([key, list]) => {
    if (!Array.isArray(list)) return;
    const seen = new Set();
    const clean = list.map(normalizeAnnotation).filter(a => {
      if (!a || seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    }).slice(0, ANNOTATIONS_PER_STEP_CAP);
    if (clean.length) out[key] = clean;
  });
  return out;
};

export const normalizeWalkthroughEdits = raw => {
  if (!raw || typeof raw !== 'object') return EMPTY_WALKTHROUGH_EDITS;
  const notes = raw.notes && typeof raw.notes === 'object' && !Array.isArray(raw.notes)
    ? Object.fromEntries(Object.entries(raw.notes).filter(([, v]) => typeof v === 'string'))
    : {};
  const moments = raw.moments && typeof raw.moments === 'object' && !Array.isArray(raw.moments)
    ? Object.fromEntries(Object.entries(raw.moments).filter(([, v]) => isIsoDay(v)))
    : {};
  return {
    hidden: strings(raw.hidden),
    order: strings(raw.order),
    notes,
    moments,
    connections: strings(raw.connections),
    annotations: normalizeAnnotations(raw.annotations),
  };
};

// Oldest first: a chapter's dated notes are read as a sequence. An undated one
// is still being written, so it waits at the end rather than jumping the queue.
export const sortAnnotations = list => [...(list || [])].sort((a, b) => {
  if (!a.date) return b.date ? 1 : 0;
  if (!b.date) return -1;
  return a.date.localeCompare(b.date);
});

/** The dated notes worth publishing: the ones that actually say something. */
export const publishableAnnotations = step => sortAnnotations(step?.annotations)
  .filter(a => a.date && a.text.trim());

export const applyWalkthroughEdits = (steps, edits) => {
  const e = normalizeWalkthroughEdits(edits);
  const hidden = new Set(e.hidden);
  const visible = (steps || []).filter(s => !hidden.has(s.key));
  const byKey = new Map(visible.map(s => [s.key, s]));
  const ordered = e.order.filter(k => byKey.has(k)).map(k => byKey.get(k));
  const placed = new Set(ordered.map(s => s.key));
  const rest = visible.filter(s => !placed.has(s.key));
  return placeConnections([...ordered, ...rest], placed).map(s => {
    const withNote = Object.prototype.hasOwnProperty.call(e.notes, s.key)
      ? { ...s, authorNote: { text: e.notes[s.key], flag: null, origin: 'step' } }
      : s;
    // `momentSource` is what lets the report say WHY a chapter carries the date
    // it does: the draft's own pick, or the author's.
    const withMoment = Object.prototype.hasOwnProperty.call(e.moments, s.key)
      ? { ...withNote, moment: e.moments[s.key], momentSource: 'author' }
      : withNote;
    // Attached only when the author wrote some: a step nobody annotated comes
    // back exactly as the draft built it.
    return e.annotations[s.key]
      ? { ...withMoment, annotations: sortAnnotations(e.annotations[s.key]) }
      : withMoment;
  });
};

// A connection step the saved order does not know yet (accepted after the
// author last reordered) belongs right after the last of its ends, not at the
// tail where unordered steps otherwise go. Steps the order names stay put.
const placeConnections = (list, placed) => {
  let out = [...list];
  out.filter(s => s.kind === 'connection' && !placed.has(s.key)).forEach(conn => {
    const ends = conn.evidence?.ends || [];
    const without = out.filter(s => s !== conn);
    const lastEnd = Math.max(-1, ...ends.map(e => without.findIndex(s => s.nodeId === e)));
    if (lastEnd < 0) return;
    without.splice(lastEnd + 1, 0, conn);
    out = without;
  });
  return out;
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

let annotationSeq = 0;
/** A note's identity, so editing one row never rewrites another. */
export const newAnnotationId = () => {
  annotationSeq += 1;
  return `n${Date.now().toString(36)}-${annotationSeq.toString(36)}`;
};

/**
 * Add a dated note, or replace one by id. A chapter holds at most
 * ANNOTATIONS_PER_STEP_CAP of them; past that the edits come back unchanged.
 * @param {object} edits @param {string} key step key
 * @param {{id: string, date?: string, text?: string}} annotation
 */
export const setStepAnnotation = (edits, key, annotation) => {
  const e = normalizeWalkthroughEdits(edits);
  const clean = normalizeAnnotation(annotation);
  if (!key || !clean) return e;
  const list = e.annotations[key] || [];
  const at = list.findIndex(a => a.id === clean.id);
  if (at < 0 && list.length >= ANNOTATIONS_PER_STEP_CAP) return e;
  const next = at < 0 ? [...list, clean] : list.map(a => (a.id === clean.id ? clean : a));
  return { ...e, annotations: { ...e.annotations, [key]: next } };
};

export const removeStepAnnotation = (edits, key, id) => {
  const e = normalizeWalkthroughEdits(edits);
  const list = e.annotations[key];
  if (!list) return e;
  const next = list.filter(a => a.id !== id);
  if (next.length === list.length) return e;
  const annotations = { ...e.annotations };
  if (next.length) annotations[key] = next; else delete annotations[key];
  return { ...e, annotations };
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
    connections: e.connections.length,
    annotations: Object.values(e.annotations).reduce((n, list) => n + list.length, 0),
  };
};

// Accepted connection suggestions, by key. The step itself is rebuilt from
// the graph on every draft; only the author's acceptance is stored.
export const addConnection = (edits, key) => {
  const e = normalizeWalkthroughEdits(edits);
  return e.connections.includes(key) ? e : { ...e, connections: [...e.connections, key] };
};

export const removeConnection = (edits, key) => {
  const e = normalizeWalkthroughEdits(edits);
  return e.connections.includes(key) ? { ...e, connections: e.connections.filter(k => k !== key) } : e;
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
