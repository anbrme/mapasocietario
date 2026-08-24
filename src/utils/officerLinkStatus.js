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

// A dissolved company can hold nothing. `companyDissolved` is stamped when the
// TARGET company is dissolved (its officers' seats ended with it);
// `holderDissolved` when the SOURCE — a company unified with its own cargos,
// or a sole shareholder — is. Once force-graph has bound the source node
// object, the node's own isDissolved flag answers as well, so a link drawn
// before any stamping pass ran still reads correctly. An officer node never
// carries the flag.
export const isDissolvedLink = link => {
  if (!link) return false;
  if (link.companyDissolved || link.holderDissolved) return true;
  const holder = link.source;
  return !!(holder && typeof holder === 'object' && holder.type !== 'officer' && holder.isDissolved);
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
export const effectiveCategoryFromEvents = (events, fallbackCategory, fallbackDate) => {
  if (!Array.isArray(events) || events.length === 0) return fallbackCategory;
  const latest = events
    .slice()
    .sort(
      (a, b) =>
        ts(b.date) - ts(a.date) ||
        (isActiveCategory(b.category) ? 1 : 0) - (isActiveCategory(a.category) ? 1 : 0)
    )[0];

  // A seat the ENRICHER closed can have no matching event, by definition:
  // supersession means BORME never inscribed a cese, and a revocation published
  // only as prose in "Otros conceptos" never becomes an event either. GRUPO
  // AUDITSAFE SLP was revoked at FTI CONSULTING SPAIN SL on 2021-01-14, but the
  // events index holds only its 2020 appointment — which was then treated as
  // the latest word and drew the seat as a live auditor.
  //
  // So an event may only override a closed seat by being NEWER than the
  // closure. A genuine re-appointment still reopens it; an older appointment
  // the closure already accounts for does not.
  // Narrow on purpose: only an APPOINTMENT can resurrect. A cessation event is
  // still allowed through, so a "revocaciones" event keeps its more precise
  // label over a generic "ceses_dimisiones" — both leave the seat closed.
  if (
    fallbackDate &&
    !isActiveCategory(fallbackCategory) &&
    isActiveCategory(latest?.category) &&
    ts(latest?.date) <= ts(fallbackDate)
  ) {
    return fallbackCategory;
  }
  return latest?.category || fallbackCategory;
};
