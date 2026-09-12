import { describe, expect, it } from 'vitest';
import { loadSitrepAuthor, saveSitrepAuthor, SITREP_AUTHOR_KEY } from './sitrepAuthor';

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };

describe('sitrepAuthor', () => {
  it('round-trips trimmed fields', () => {
    const s = mem();
    saveSitrepAuthor({ name: '  Ana ', organisation: 'NC ' }, s);
    expect(loadSitrepAuthor(s)).toEqual({ name: 'Ana', organisation: 'NC' });
    expect(JSON.parse(s.getItem(SITREP_AUTHOR_KEY))).toEqual({ name: 'Ana', organisation: 'NC' });
  });
  it('returns blanks on missing, junk, or a throwing storage', () => {
    expect(loadSitrepAuthor(mem())).toEqual({ name: '', organisation: '' });
    const s = mem(); s.setItem(SITREP_AUTHOR_KEY, '{nope');
    expect(loadSitrepAuthor(s)).toEqual({ name: '', organisation: '' });
    expect(loadSitrepAuthor({ getItem() { throw new Error('blocked'); } })).toEqual({ name: '', organisation: '' });
  });
});
