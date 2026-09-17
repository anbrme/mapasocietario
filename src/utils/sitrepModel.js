// The situation report's document model, independent of medium: the rules the
// exported .html page and the Copy-for-Word paste both have to agree on —
// which dates make a chronology, which rows a chapter has already told, and
// the one-line evidence each chapter leads with.
//
// It lives apart from documentSections so the Word path can share these rules
// without pulling the map renderer and the document stylesheet into the main
// bundle: the .html export is loaded on demand, the clipboard is not.
//
// Pure: strings and plain objects in, plain objects out.

export const isDay = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

/**
 * A chapter's own moment, plus every dated note hung off it — one entry per
 * date, oldest first. A chapter's moment pins the map to a single day; an
 * argument about a position in a group runs across several, and each of those
 * is its own line of the story.
 * @param {object} doc the built investigation document
 * @returns {Array<{date: string, index: number, title: string, step: object|null, note: string}>}
 *   `step` is set for a chapter's own moment and null for a dated note.
 */
export const chronologyEntries = doc => {
  const entries = [];
  (doc?.steps || []).forEach((step, index) => {
    if (isDay(step.moment)) {
      entries.push({
        date: step.moment, index, title: step.title, step, note: '',
      });
    }
    (step.annotations || []).forEach(a => {
      if (isDay(a?.date) && String(a?.text || '').trim()) {
        entries.push({
          date: a.date, index, title: step.title, step: null, note: String(a.text).trim(),
        });
      }
    });
  });
  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index);
};

/** Two entries make a sequence; one is just a date. */
export const hasChronology = doc => chronologyEntries(doc).length >= 2;

// Rows a chapter already narrates must not repeat in the annexes. A company
// or a connector is covered only when it got its OWN chapter (its id is some
// step's PRIMARY nodeId) — being merely pictured inside another chapter's
// board/seats table (e.g. a company that is only a seat of a selected
// person) does not retire it here; it keeps its annex row, and any note on
// it. Ownership rows are covered only when either side is a COMPANY
// chapter's own title — a person chapter's title never retires one.
const EMPTY_AUTHOR_LAYER = {
  nodes: [], links: [], dismissed: [], renamed: [],
};

export const annexRows = doc => {
  const steps = doc?.steps || [];
  const stepIds = new Set(steps.map(s => s.nodeId || s.nodeIds?.[0]));
  const companyChapterTitles = new Set(steps.filter(s => s.kind === 'company').map(s => s.title));
  return {
    companies: (doc?.companies || []).filter(c => !stepIds.has(c.nodeId)),
    connectors: (doc?.connectors || []).filter(c => !stepIds.has(c.nodeId)),
    ownership: (doc?.ownership || []).filter(o => !companyChapterTitles.has(o.owner) && !companyChapterTitles.has(o.owned)),
    corrections: doc?.corrections || [],
    authorLayer: doc?.authorLayer || EMPTY_AUTHOR_LAYER,
  };
};

export const hasAnnexes = doc => {
  const rows = annexRows(doc);
  return !!(rows.companies.length || rows.connectors.length || rows.ownership.length || rows.corrections.length
    || rows.authorLayer.nodes.length || rows.authorLayer.links.length
    || rows.authorLayer.dismissed.length || rows.authorLayer.renamed.length);
};

/** The single sourced line a chapter leads with, under its title. */
export const stepEvidenceLine = (s, wt) => {
  const ev = s.evidence || {};
  if (s.kind === 'person') {
    return (ev.seats || []).slice(0, 2).map(seat => `${seat.role} · ${seat.company}`).join(' · ');
  }
  if (s.kind === 'connection') {
    return (ev.hops || []).slice(0, 2).map(h => `${h.who} · ${h.role} · ${h.at}`).join(' · ');
  }
  const finding = (ev.findings || [])[0];
  if (finding?.text) return finding.text;
  const lastFiling = ev.status?.lastFiling;
  if (lastFiling?.date) {
    return lastFiling.type ? `${wt.subheads.filings}: ${lastFiling.date} · ${lastFiling.type}` : `${wt.subheads.filings}: ${lastFiling.date}`;
  }
  return '';
};
