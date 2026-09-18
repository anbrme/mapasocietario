// The replay stage at one registry day. Recomputed from the terms on every
// frame: a subject has at most a few thousand terms, which costs nothing at
// 60 fps, and a from-scratch answer can never drift from a scrubbed one.

/**
 * @param {object} model - from replayModel
 * @param {string} iso   - the day being shown, 'YYYY-MM-DD'
 * @param {{ hiddenCategories?: Set<string> }} [options]
 * @returns {Map<string, { status: 'live'|'ceased'|'hidden', unknownStart: boolean,
 *   inferred: boolean, liveRoles: string[] }>} one entry per counterpart with a visible term
 */
export const replayStateAt = (model, iso, { hiddenCategories = new Set() } = {}) => {
  const byCounterpart = new Map();
  model.terms.forEach(term => {
    if (hiddenCategories.has(term.category)) return;
    if (!byCounterpart.has(term.counterpartId)) byCounterpart.set(term.counterpartId, []);
    byCounterpart.get(term.counterpartId).push(term);
  });

  const out = new Map();
  byCounterpart.forEach((terms, id) => {
    const started = terms.filter(t => t.from === null || t.from <= iso);
    const live = started.filter(t => t.to === null || t.to > iso);

    if (live.length) {
      out.set(id, {
        status: 'live',
        unknownStart: live.every(t => t.from === null),
        inferred: false,
        liveRoles: live.map(t => t.role),
      });
      return;
    }
    if (started.length) {
      const lastEnded = started.reduce((a, b) => (b.to > a.to ? b : a));
      out.set(id, { status: 'ceased', unknownStart: false, inferred: lastEnded.endKind === 'inferred', liveRoles: [] });
      return;
    }
    out.set(id, { status: 'hidden', unknownStart: false, inferred: false, liveRoles: [] });
  });
  return out;
};

/** Acts the clock crossed moving forward from `fromIso` (exclusive) to `toIso` (inclusive). */
export const actsBetween = (model, fromIso, toIso) =>
  (toIso <= fromIso ? [] : model.acts.filter(a => a.date > fromIso && a.date <= toIso));
