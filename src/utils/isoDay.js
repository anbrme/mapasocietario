// An ISO day is a day, not an instant. A bare 'YYYY-MM-DD' parses as UTC
// midnight, which renders as the PREVIOUS day west of Greenwich — so every
// registry day in this app is read at noon before it is shown.

const read = iso => new Date(`${String(iso).slice(0, 10)}T12:00:00`);
const locale = lang => (lang === 'en' ? 'en-GB' : 'es-ES');

/** Prose: '11 de marzo de 2024' / '11 March 2024'. '' for a missing day. */
export const isoDayLong = (iso, lang = 'es') => (iso
  ? read(iso).toLocaleDateString(locale(lang), { year: 'numeric', month: 'long', day: 'numeric' })
  : '');

/** Compact, for a list or a field: '11/03/2024'. '' for a missing day. */
export const isoDayShort = (iso, lang = 'es') => (iso
  ? read(iso).toLocaleDateString(locale(lang), { year: 'numeric', month: '2-digit', day: '2-digit' })
  : '');
