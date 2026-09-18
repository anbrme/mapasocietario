// Registry time for the replay. The clock runs on day numbers (days since the
// Unix epoch, UTC) so arithmetic never meets a timezone or a DST jump: a BORME
// date is a calendar day, not an instant.
//
// Time is LINEAR on purpose. Giving each act equal screen time would erase the
// one thing the replay exists to show — a burst after a quiet decade.

/** One historical year of playback at 1x, in milliseconds. */
export const YEAR_MS = 5000;
const DAYS_PER_YEAR = 365.2425;
const MS_PER_DAY = 86400000;

/** 'YYYY-MM-DD' → integer day number. */
export const dayNumber = iso => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
};

/** Day number (fractional allowed) → the 'YYYY-MM-DD' it falls in. */
export const isoFromDay = day => new Date(Math.floor(day) * MS_PER_DAY).toISOString().slice(0, 10);

/** Historical days covered by `ms` of real time at `speed`. */
export const advanceDays = (ms, speed) => (ms * speed * DAYS_PER_YEAR) / YEAR_MS;

/** Calendar-month shift with the day clamped to the target month's length. */
export const addMonths = (iso, months) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
};

/** Day number of the first act strictly after `day`, or null. `acts` is date-ascending. */
export const nextActDay = (acts, day) => {
  const floor = Math.floor(day);
  const act = acts.find(a => dayNumber(a.date) > floor);
  return act ? dayNumber(act.date) : null;
};

/** Day number of the last act strictly before `day`, or null. */
export const prevActDay = (acts, day) => {
  const floor = Math.floor(day);
  for (let i = acts.length - 1; i >= 0; i -= 1) {
    const n = dayNumber(acts[i].date);
    if (n < floor) return n;
  }
  return null;
};
