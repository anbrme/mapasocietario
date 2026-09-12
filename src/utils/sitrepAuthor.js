// The author line of the situation report. Describes the person, not the
// investigation, so it lives in localStorage and never in the graph snapshot.
export const SITREP_AUTHOR_KEY = 'sitrep_author';
const BLANK = Object.freeze({ name: '', organisation: '' });
const clean = v => String(v || '').trim().slice(0, 120);

export const loadSitrepAuthor = (storage = globalThis.localStorage) => {
  try {
    const raw = storage?.getItem(SITREP_AUTHOR_KEY);
    if (!raw) return { ...BLANK };
    const p = JSON.parse(raw);
    return { name: clean(p?.name), organisation: clean(p?.organisation) };
  } catch { return { ...BLANK }; }
};

export const saveSitrepAuthor = (author, storage = globalThis.localStorage) => {
  const value = { name: clean(author?.name), organisation: clean(author?.organisation) };
  try { storage?.setItem(SITREP_AUTHOR_KEY, JSON.stringify(value)); } catch { /* storage blocked: the line just stays session-only */ }
  return value;
};
