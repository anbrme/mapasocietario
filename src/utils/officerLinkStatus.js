// Status logic for an officer→company link, shared by the graph component and
// its tests. A link represents ONE role an officer holds at one company; its
// active/ceased status is derived from the borme_events_v3 events attached to
// that role (see enrichLinksWithEventDates), falling back to the build-time
// category when no events are present.

// Active iff the category is an appointment or re-election (not a cese/revocation).
export const isActiveCategory = cat => {
  const c = (cat || '').toLowerCase();
  return c.includes('nombramiento') || c.includes('reeleccion') || c.includes('reelección');
};

const ts = date => {
  if (!date) return 0;
  const t = new Date(date).getTime();
  return Number.isFinite(t) ? t : 0;
};

// Category of the most recent event for a single role. Events MUST already be
// filtered to one role (different roles at the same company have independent
// status). On a same-date tie an appointment outranks a cessation: board
// renewals record a cese AND a re-appointment of the same seat on one day, and
// the officer ends up active — so the seat must not flip to ceased.
export const effectiveCategoryFromEvents = (events, fallbackCategory) => {
  if (!Array.isArray(events) || events.length === 0) return fallbackCategory;
  const latest = events
    .slice()
    .sort(
      (a, b) =>
        ts(b.date) - ts(a.date) ||
        (isActiveCategory(b.category) ? 1 : 0) - (isActiveCategory(a.category) ? 1 : 0)
    )[0];
  return latest?.category || fallbackCategory;
};
