import { describe, it, expect, vi } from 'vitest';
import { pageThrough, fetchCompanyHistory, fetchOfficerHistory } from './replayHistory';

const events = n => Array.from({ length: n }, (_, i) => ({
  _id: `e${i}`,
  // Newest first, as the endpoint sorts: one event a day, backwards from 2026.
  event_date: new Date(Date.UTC(2026, 0, 1) - i * 86400000).toISOString().slice(0, 10),
}));

const companyApi = all => vi.fn(async url => {
  const u = new URL(url);
  const from = Number(u.searchParams.get('from'));
  const size = Number(u.searchParams.get('size'));
  return { events: all.slice(from, from + size), total: all.length };
});

describe('pageThrough', () => {
  it('stops at the window even when the total is larger', async () => {
    const fetchPage = vi.fn(async (from, size) => ({ items: Array(size).fill(0).map((_, i) => from + i), total: 50000, pages: true }));
    const out = await pageThrough({ fetchPage, pageSize: 500, window: 1500 });
    expect(out.items).toHaveLength(1500);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('aborts between pages', async () => {
    const controller = new AbortController();
    const fetchPage = vi.fn(async (from, size) => {
      controller.abort();
      return { items: Array(size).fill(from), total: 5000, pages: true };
    });
    await expect(pageThrough({ fetchPage, pageSize: 500, signal: controller.signal })).rejects.toThrow(/abort/i);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

describe('fetchCompanyHistory', () => {
  it('pages until it holds every event, by group key, with full officer lists', async () => {
    const all = events(1200);
    const getJson = companyApi(all);
    const progress = [];
    const out = await fetchCompanyHistory({ groupKey: 'H:M-1', name: 'ACME' }, {
      getJson, baseUrl: 'https://api.test', onProgress: p => progress.push(p),
    });

    expect(out.events).toHaveLength(1200);
    expect(out.completeness).toEqual({ loaded: 1200, total: 1200, truncatedBefore: null });
    const first = new URL(getJson.mock.calls[0][0]);
    expect(first.searchParams.get('group_key')).toBe('H:M-1');
    expect(first.searchParams.get('full_officers')).toBe('1');
    expect(getJson).toHaveBeenCalledTimes(3);
    expect(progress[progress.length - 1]).toEqual({ loaded: 1200, total: 1200 });
  });

  it('reports the date before which acts are missing when it hits the window', async () => {
    const all = events(1200);
    const out = await fetchCompanyHistory({ groupKey: 'H:M-1' }, {
      getJson: companyApi(all), baseUrl: 'https://api.test', window: 1000,
    });

    expect(out.completeness.loaded).toBe(1000);
    expect(out.completeness.truncatedBefore).toBe(all[999].event_date);
  });

  it('drops an event served twice across a page boundary', async () => {
    const all = events(3);
    const getJson = vi.fn()
      .mockResolvedValueOnce({ events: all.slice(0, 2), total: 3 })
      .mockResolvedValueOnce({ events: all.slice(1, 3), total: 3 });
    const out = await fetchCompanyHistory({ groupKey: 'H:M-1' }, { getJson, baseUrl: 'https://api.test', pageSize: 2 });
    expect(out.events.map(e => e._id)).toEqual(['e0', 'e1', 'e2']);
  });
});

describe('fetchOfficerHistory', () => {
  const mv = i => ({ event_date: `2015-01-${String(i + 1).padStart(2, '0')}`, company_name: `C${i}`, position: 'ADM', event_type: 'Nombramientos' });

  it('pages when the server echoes `from`, counting acts not movements', async () => {
    const getJson = vi.fn(async url => {
      const from = Number(new URL(url).searchParams.get('from'));
      return from === 0
        ? { movements: [mv(0), mv(1)], events_total: 3, events_returned: 2, from: 0 }
        : { movements: [mv(2)], events_total: 3, events_returned: 1, from: 2 };
    });
    const out = await fetchOfficerHistory('PEREZ LUIS', { getJson, baseUrl: 'https://api.test', pageSize: 2 });
    expect(out.movements).toHaveLength(3);
    expect(out.completeness).toEqual({ loaded: 3, total: 3, truncatedBefore: null });
  });

  it('treats a server that ignores `from` as one page and says the rest is missing', async () => {
    const getJson = vi.fn(async () => ({ movements: [mv(1), mv(0)], events_total: 900, events_returned: 2 }));
    const out = await fetchOfficerHistory('PEREZ LUIS', { getJson, baseUrl: 'https://api.test', pageSize: 2 });
    expect(getJson).toHaveBeenCalledTimes(1);
    expect(out.completeness).toEqual({ loaded: 2, total: 900, truncatedBefore: '2015-01-01' });
  });
});
