import { describe, expect, it } from 'vitest';
import { parseReturnParams, RETURN_COMPANY_CAP } from './returnParams';

describe('parseReturnParams', () => {
  it('reads repeated c=<groupKey>|<name> pairs in order', () => {
    const r = parseReturnParams('?c=gk-a%7CALFA+SL&c=gk-b%7CBETA+SL&since=2026-09-13&source=sitrep');
    expect(r.companies).toEqual([{ groupKey: 'gk-a', name: 'ALFA SL' }, { groupKey: 'gk-b', name: 'BETA SL' }]);
    expect(r.since).toBe('2026-09-13');
    expect(r.watch).toBe(false);
  });
  it('drops malformed pairs, junk since, and caps the list', () => {
    const many = Array.from({ length: RETURN_COMPANY_CAP + 3 }, (_, i) => `c=k${i}%7CN${i}`).join('&');
    const r = parseReturnParams(`?${many}&c=nokey&c=%7Cnoname&since=13/09/2026&watch=1`);
    expect(r.companies).toHaveLength(RETURN_COMPANY_CAP);
    expect(r.since).toBeNull();
    expect(r.watch).toBe(true);
  });
  it('is empty for an unrelated query', () => {
    expect(parseReturnParams('?gk=x')).toEqual({ companies: [], since: null, watch: false });
    expect(parseReturnParams('')).toEqual({ companies: [], since: null, watch: false });
  });
});
