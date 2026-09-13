// The author line of the situation report. Describes the person, not the
// investigation, so it lives in localStorage and never in the graph snapshot.
export const SITREP_AUTHOR_KEY = 'sitrep_author';
export const DEFAULT_BLOCKS = Object.freeze({
  identity: true, board: true, filings: true, findings: true,
});
const BLANK = Object.freeze({ name: '', organisation: '', blocks: DEFAULT_BLOCKS });
const clean = v => String(v || '').trim().slice(0, 120);

const cleanBlocks = raw => {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return Object.keys(DEFAULT_BLOCKS).reduce((acc, key) => ({
    ...acc,
    [key]: typeof source[key] === 'boolean' ? source[key] : DEFAULT_BLOCKS[key],
  }), {});
};

export const loadSitrepAuthor = (storage = globalThis.localStorage) => {
  try {
    const raw = storage?.getItem(SITREP_AUTHOR_KEY);
    if (!raw) return { ...BLANK };
    const p = JSON.parse(raw);
    return { name: clean(p?.name), organisation: clean(p?.organisation), blocks: cleanBlocks(p?.blocks) };
  } catch { return { ...BLANK }; }
};

export const saveSitrepAuthor = (author, storage = globalThis.localStorage) => {
  const value = {
    name: clean(author?.name), organisation: clean(author?.organisation), blocks: cleanBlocks(author?.blocks),
  };
  try { storage?.setItem(SITREP_AUTHOR_KEY, JSON.stringify(value)); } catch { /* storage blocked: the line just stays session-only */ }
  return value;
};
