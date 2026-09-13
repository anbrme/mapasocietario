import { describe, expect, it } from 'vitest';
import { parseReturnParams, RETURN_COMPANY_CAP } from './returnParams';

// Keys here carry the real entity-key shape the directory issues ("c:12345"),
// because parseReturnParams now rejects anything else at the boundary.
describe('parseReturnParams', () => {
  it('reads repeated c=<groupKey>|<name> pairs in order', () => {
    const r = parseReturnParams('?c=c%3Aalfa%7CALFA+SL&c=c%3Abeta%7CBETA+SL&since=2026-09-13&source=sitrep');
    expect(r.companies).toEqual([{ groupKey: 'c:alfa', name: 'ALFA SL' }, { groupKey: 'c:beta', name: 'BETA SL' }]);
    expect(r.since).toBe('2026-09-13');
    expect(r.watch).toBe(false);
  });
  it('drops malformed pairs, junk since, and caps the list', () => {
    const many = Array.from({ length: RETURN_COMPANY_CAP + 3 }, (_, i) => `c=c%3Ak${i}%7CN${i}`).join('&');
    const r = parseReturnParams(`?${many}&c=nokey&c=%7Cnoname&since=13/09/2026&watch=1`);
    expect(r.companies).toHaveLength(RETURN_COMPANY_CAP);
    expect(r.since).toBeNull();
    expect(r.watch).toBe(true);
  });
  it('drops a group_key that is not a real entity key, keeping the valid one', () => {
    const r = parseReturnParams('?c=%3Cscript%3E%7CEVIL+SL&c=..%2Fadmin%7CTRAVERSAL+SL&c=c%3Aalfa%7CALFA+SL');
    expect(r.companies).toEqual([{ groupKey: 'c:alfa', name: 'ALFA SL' }]);
  });
  it('counts only valid entries against the cap', () => {
    const pairs = [];
    for (let i = 0; i < RETURN_COMPANY_CAP + 3; i += 1) {
      pairs.push(`c=junk%2F${i}%7CJ${i}`);
      pairs.push(`c=c%3Ak${i}%7CN${i}`);
    }
    const r = parseReturnParams(`?${pairs.join('&')}`);
    expect(r.companies).toHaveLength(RETURN_COMPANY_CAP);
    // The rejected keys must not have eaten slots: the last kept company is
    // the CAP-th VALID one, not the CAP/2-th.
    expect(r.companies[RETURN_COMPANY_CAP - 1]).toEqual({
      groupKey: `c:k${RETURN_COMPANY_CAP - 1}`,
      name: `N${RETURN_COMPANY_CAP - 1}`,
    });
  });
  it('is empty for an unrelated query', () => {
    expect(parseReturnParams('?gk=x')).toEqual({ companies: [], since: null, watch: false });
    expect(parseReturnParams('')).toEqual({ companies: [], since: null, watch: false });
  });
});
