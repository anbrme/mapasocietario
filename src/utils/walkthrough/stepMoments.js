// Every date a chapter could honestly be pinned to, each carrying the reason
// it exists.
//
// Why: the situation report pins each chapter to a "Momento", and it arrives
// preselected — the company's last BORME filing, or a person's most recent seat
// date. Silently. A director with twenty appointments produced one date out of
// forty with nothing on screen saying which one it was or why, and an analyst
// cannot write a note against a date they cannot explain. These options are the
// registry's own dates for THIS chapter, labelled, so the preselection can be
// read, kept, or swapped for the date the note is actually about.
//
// Pure: built from the evidence the step already carries, in the report's
// language (the modal, not the draft, decides that).

import { walkthroughCopy } from './walkthroughCopy';

const day = value => {
  const iso = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '';
};

/** Enough dates to cover a long board or a busy career; the field still takes a free date. */
export const MOMENT_OPTION_CAP = 40;

// A finding is a sentence; a dropdown row is a label. Enough of it to
// recognise, not enough to stretch the field off the dialog.
const LABEL_TEXT_CAP = 64;
const shorten = text => {
  const clean = String(text || '').trim().replace(/\s+/g, ' ');
  return clean.length > LABEL_TEXT_CAP ? `${clean.slice(0, LABEL_TEXT_CAP - 1)}…` : clean;
};

const seatOptions = (seats, t) => (seats || []).flatMap(seat => [
  { date: day(seat.since), label: t.momentKinds.appointed(seat.role, seat.company) },
  { date: day(seat.until), label: t.momentKinds.ceased(seat.role, seat.company) },
]);

const boardOptions = (rows, t) => (rows || []).flatMap(row => [
  { date: day(row.since), label: t.momentKinds.boardAppointed(row.role, row.name) },
  { date: day(row.until), label: t.momentKinds.boardCeased(row.role, row.name) },
]);

const hopOptions = (hops, t) => (hops || []).flatMap(hop => [
  { date: day(hop.since), label: t.momentKinds.appointed(hop.role, hop.at) },
  { date: day(hop.until), label: t.momentKinds.ceased(hop.role, hop.at) },
]);

// Source order matters: two sources can name the same day, and the first one
// listed is the label the analyst sees. Most explanatory first.
const rawOptions = (step, t) => {
  const evidence = step?.evidence || {};
  if (step?.kind === 'person') return seatOptions(evidence.seats, t);
  if (step?.kind === 'connection') return hopOptions(evidence.hops, t);

  const lastFiling = evidence.status?.lastFiling || null;
  return [
    { date: day(lastFiling?.date), label: t.momentKinds.lastFiling(lastFiling?.type || '') },
    ...(evidence.filings || []).map(f => ({ date: day(f.date), label: t.momentKinds.filing(f.type || '') })),
    ...(evidence.findings || []).map(f => ({ date: day(f.date), label: t.momentKinds.finding(shorten(f.text)) })),
    // A unified node is a company that also sits on other boards: its own
    // seats are as much a part of its story as its filings.
    ...seatOptions(evidence.seats, t),
    ...boardOptions(evidence.board, t),
  ];
};

/**
 * The registry dates this chapter could be pinned to, most recent first, one
 * entry per day.
 * @param {object} step a drafted walkthrough step
 * @param {string} lang 'es' | 'en'
 * @returns {Array<{date: string, label: string}>}
 */
export const momentOptions = (step, lang = 'es') => {
  const t = walkthroughCopy(lang);
  const dated = rawOptions(step, t).filter(option => option.date);
  // Stable sort, so the source order above decides which label a shared day keeps.
  const byDateDesc = [...dated].sort((a, b) => b.date.localeCompare(a.date));
  const seen = new Set();
  const unique = [];
  byDateDesc.forEach(option => {
    if (seen.has(option.date)) return;
    seen.add(option.date);
    unique.push(option);
  });
  return unique.slice(0, MOMENT_OPTION_CAP);
};

/**
 * What a chapter's current date refers to, in one line.
 * @param {object} step the step as the author sees it (`momentSource` tells
 *   whether the date is the draft's own pick or the author's)
 * @param {string} lang 'es' | 'en'
 * @returns {string} a sentence for the field's helper text
 */
export const momentReason = (step, lang = 'es') => {
  const t = walkthroughCopy(lang);
  const date = day(step?.moment);
  if (!date) return t.momentUnset;
  const known = momentOptions(step, lang).find(option => option.date === date);
  if (!known) return t.momentWhyAuthorOnly;
  return step?.momentSource === 'author'
    ? t.momentWhyAuthor(known.label)
    : t.momentWhyDraft(known.label);
};
