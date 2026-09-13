import { describe, expect, it } from 'vitest';
import { DEFAULT_BLOCKS, loadSitrepAuthor, saveSitrepAuthor, SITREP_AUTHOR_KEY } from './sitrepAuthor';

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };

describe('sitrepAuthor', () => {
  it('round-trips trimmed fields', () => {
    const s = mem();
    saveSitrepAuthor({ name: '  Ana ', organisation: 'NC ' }, s);
    expect(loadSitrepAuthor(s)).toEqual({ name: 'Ana', organisation: 'NC', blocks: DEFAULT_BLOCKS });
    expect(JSON.parse(s.getItem(SITREP_AUTHOR_KEY))).toEqual({ name: 'Ana', organisation: 'NC', blocks: DEFAULT_BLOCKS });
  });
  it('returns blanks on missing, junk, or a throwing storage', () => {
    expect(loadSitrepAuthor(mem())).toEqual({ name: '', organisation: '', blocks: DEFAULT_BLOCKS });
    const s = mem(); s.setItem(SITREP_AUTHOR_KEY, '{nope');
    expect(loadSitrepAuthor(s)).toEqual({ name: '', organisation: '', blocks: DEFAULT_BLOCKS });
    expect(loadSitrepAuthor({ getItem() { throw new Error('blocked'); } })).toEqual({ name: '', organisation: '', blocks: DEFAULT_BLOCKS });
  });
  it('round-trips partial blocks over the defaults', () => {
    const s = mem();
    saveSitrepAuthor({ name: 'Ana', organisation: 'NC', blocks: { board: false } }, s);
    expect(loadSitrepAuthor(s)).toEqual({
      name: 'Ana', organisation: 'NC', blocks: { identity: true, board: false, filings: true, findings: true },
    });
  });
  it('falls back to defaults when blocks is missing', () => {
    const s = mem();
    saveSitrepAuthor({ name: 'Ana', organisation: 'NC' }, s);
    expect(loadSitrepAuthor(s).blocks).toEqual(DEFAULT_BLOCKS);
  });
  it('ignores junk block values and unknown keys', () => {
    const s = mem();
    s.setItem(SITREP_AUTHOR_KEY, JSON.stringify({
      name: 'Ana', organisation: 'NC', blocks: { board: 'nope', filings: false, extra: true },
    }));
    expect(loadSitrepAuthor(s)).toEqual({
      name: 'Ana', organisation: 'NC', blocks: { identity: true, board: true, filings: false, findings: true },
    });
  });
});
