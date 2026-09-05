/**
 * The manage-page half of monitoringService.
 *
 * These three calls are the only ones a reader can reach without a login, so
 * what matters is what they send and what they refuse to promise. The request
 * form in particular must never let its result reveal whether an address is
 * subscribed — the backend answers identically either way, and the client has
 * to stay just as uninformative.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MonitoringRequestError,
  activateMonitoring,
  fetchMonitoring,
  isMonitorableNode,
  requestManageLink,
  requestMonitoring,
  stopMonitoring,
  fetchWatchlistView,
  watchlistSeeds,
} from './monitoringService';

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

let calls;

beforeEach(() => {
  calls = [];
  global.fetch = vi.fn((url, init) => {
    calls.push({ url, init });
    return Promise.resolve(ok({ success: true }));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const lastBody = () => JSON.parse(calls[calls.length - 1].init.body);

describe('requestManageLink', () => {
  test('normalizes the address before sending it', async () => {
    await requestManageLink('  MiXeD@Example.COM ');
    expect(lastBody()).toEqual({ email: 'mixed@example.com' });
  });

  test('rejects a malformed address without a round trip', async () => {
    await expect(requestManageLink('not-an-address')).rejects.toThrow(
      MonitoringRequestError
    );
    expect(calls).toHaveLength(0);
  });

  test('resolves identically whether or not the address is known', async () => {
    // The backend returns the same 202 for a subscriber and a stranger. If the
    // client ever distinguished them, the form would become an oracle for
    // "does this person use the service?".
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, status: 202, json: async () => ({ success: true }) })
    );
    const subscriber = await requestManageLink('subscriber@example.com');
    const stranger = await requestManageLink('stranger@example.com');
    expect(subscriber).toEqual(stranger);
  });

  test('distinguishes a rate limit from a breakage', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 429, json: async () => ({}) })
    );
    await expect(requestManageLink('a@example.com')).rejects.toMatchObject({
      message: 'rate_limited',
      status: 429,
    });
  });

  test('surfaces a network failure rather than pretending mail was sent', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('offline')));
    await expect(requestManageLink('a@example.com')).rejects.toMatchObject({
      message: 'network_error',
    });
  });
});

describe('fetchMonitoring', () => {
  test('passes the token in the query string, encoded', async () => {
    global.fetch = vi.fn((url) => {
      calls.push({ url });
      return Promise.resolve(ok({ alerts: [] }));
    });
    await fetchMonitoring('tok/with+chars');
    expect(calls[0].url).toContain('t=tok%2Fwith%2Bchars');
  });

  test('returns the alert list', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(ok({ alerts: [{ id: 1, entity_name: 'ACME SL' }] }))
    );
    const alerts = await fetchMonitoring('tok');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].entity_name).toBe('ACME SL');
  });

  test('yields an empty list when the payload has no alerts array', async () => {
    // A malformed body must not crash the page into its error state, which
    // would tell the reader their link expired when it did not.
    global.fetch = vi.fn(() => Promise.resolve(ok({ success: true })));
    expect(await fetchMonitoring('tok')).toEqual([]);
  });

  test('refuses to call without a token', async () => {
    await expect(fetchMonitoring('')).rejects.toMatchObject({
      message: 'missing_token',
    });
  });

  test('an expired token is an error, not an empty list', async () => {
    // Silently rendering "you monitor nothing" for a stale link would be a
    // lie the reader has no way to detect.
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 401, json: async () => ({}) })
    );
    await expect(fetchMonitoring('stale')).rejects.toMatchObject({
      message: 'view_failed',
      status: 401,
    });
  });
});

describe('stopMonitoring', () => {
  test('sends the alert id in the body and the token in the query', async () => {
    await stopMonitoring('tok', 42);
    expect(calls[0].url).toContain('t=tok');
    expect(calls[0].url).toContain('/alerts/view/unsubscribe');
    expect(lastBody()).toEqual({ alert_id: 42 });
  });

  test('refuses a non-integer alert id', async () => {
    await expect(stopMonitoring('tok', '42')).rejects.toMatchObject({
      message: 'invalid_alert_id',
    });
    expect(calls).toHaveLength(0);
  });

  test('refuses a missing token', async () => {
    await expect(stopMonitoring('', 42)).rejects.toMatchObject({
      message: 'missing_token',
    });
  });

  test('reports a failed stop instead of resolving', async () => {
    // The row stays active on the server, so resolving here would leave the
    // page showing "stopped" for monitoring that is still running.
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
    );
    await expect(stopMonitoring('tok', 42)).rejects.toMatchObject({
      message: 'stop_failed',
      status: 404,
    });
  });
});

describe('isMonitorableNode', () => {
  // BORME is the event source, so only Spanish company nodes can be watched.
  // Officers are people, not entities with filings, and foreign shareholders
  // appear in the graph without a Spanish registry sheet to follow.
  test('accepts a Spanish company node', () => {
    expect(isMonitorableNode({ type: 'company' })).toBe(true);
    expect(isMonitorableNode({ type: 'spanish-company-group' })).toBe(true);
  });

  test('rejects officer nodes', () => {
    expect(isMonitorableNode({ type: 'officer' })).toBe(false);
  });

  test('rejects a missing node', () => {
    expect(isMonitorableNode(null)).toBe(false);
    expect(isMonitorableNode(undefined)).toBe(false);
  });
});

describe('requestMonitoring', () => {
  beforeEach(() => { global.fetch = vi.fn(); });
  afterEach(() => { vi.restoreAllMocks(); });

  test('rejects a malformed email before touching the network', async () => {
    await expect(requestMonitoring({ email: 'nope', entityName: 'ACERINOX SA' }))
      .rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('rejects an empty company name before touching the network', async () => {
    await expect(requestMonitoring({ email: 'a@b.com', entityName: '  ' }))
      .rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('posts the email, company and jurisdiction', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 202, json: async () => ({ success: true }) });
    await requestMonitoring({ email: 'A@B.com ', entityName: 'ACERINOX SA', jurisdiction: 'ES' });

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/bormes\/v3\/alerts\/request$/);
    expect(opts.method).toBe('POST');
    const sent = JSON.parse(opts.body);
    expect(sent).toEqual({ email: 'a@b.com', entity_name: 'ACERINOX SA', jurisdiction: 'ES' });
  });

  test('surfaces the rate-limit refusal distinctly so the UI can explain it', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: 'Too many' }) });
    await expect(requestMonitoring({ email: 'a@b.com', entityName: 'ACERINOX SA' }))
      .rejects.toMatchObject({ status: 429 });
  });

  test('a network failure rejects rather than resolving silently', async () => {
    global.fetch.mockRejectedValue(new Error('offline'));
    await expect(requestMonitoring({ email: 'a@b.com', entityName: 'ACERINOX SA' }))
      .rejects.toThrow();
  });
});

describe('requestMonitoring group_key', () => {
  // The link key. A watchlist can only be drawn as a graph if each alert says
  // WHICH company it means, and entity_name cannot say that — it fuzzy-matches
  // siblings and splits on a comma.

  test('sends the group key when the node carries one', async () => {
    await requestMonitoring({
      email: 'a@example.com',
      entityName: 'TELEFONICA SA',
      groupKey: 'H:M-1234',
    });
    expect(lastBody().group_key).toBe('H:M-1234');
  });

  test('omits the field entirely when the node has no key', async () => {
    // Absent and null mean the same thing to the backend, but a payload that
    // never claims a key is honest about a node that never had one.
    await requestMonitoring({ email: 'a@example.com', entityName: 'ACME SL' });
    expect('group_key' in lastBody()).toBe(false);
  });

  test('omits a blank key rather than sending an empty string', async () => {
    // The column rejects a blank outright: it reads as resolved and links
    // nowhere.
    await requestMonitoring({
      email: 'a@example.com',
      entityName: 'ACME SL',
      groupKey: '   ',
    });
    expect('group_key' in lastBody()).toBe(false);
  });

  test('a missing key never blocks the subscription', async () => {
    // Monitoring works on the name. The key is an enhancement and must never
    // become a precondition.
    await expect(
      requestMonitoring({ email: 'a@example.com', entityName: 'ACME SL' })
    ).resolves.toBeTruthy();
  });
});

describe('fetchWatchlistView', () => {
  // The graph entry needs both halves: the sets (to name and pick one) and the
  // rows (to seed it). fetchMonitoring returns only the rows, so it cannot
  // answer "which set am I looking at".

  test('returns the sets alongside the rows', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        ok({
          alerts: [{ id: 1, entity_name: 'ACME SL', group_key: 'H:M-1', watchlist_id: 5 }],
          watchlists: [{ id: 5, label: 'Proveedores' }],
        })
      )
    );
    const view = await fetchWatchlistView('tok');
    expect(view.watchlists[0].label).toBe('Proveedores');
    expect(view.alerts[0].group_key).toBe('H:M-1');
  });

  test('an older backend without watchlists still yields usable rows', async () => {
    // Absent is not an error: the field only exists after the set API ships,
    // and a client that threw here would break every existing manage link.
    global.fetch = vi.fn(() => Promise.resolve(ok({ alerts: [{ id: 1 }] })));
    const view = await fetchWatchlistView('tok');
    expect(view.watchlists).toEqual([]);
    expect(view.alerts).toHaveLength(1);
  });

  test('refuses an empty token without a round trip', async () => {
    await expect(fetchWatchlistView('  ')).rejects.toBeInstanceOf(MonitoringRequestError);
    expect(calls).toHaveLength(0);
  });
});

describe('watchlistSeeds', () => {
  test('keeps only active rows that can actually be drawn', async () => {
    // An unconfirmed row is not a subscription yet, and a row with no
    // group_key cannot be opened as a specific company — seeding it would
    // fuzzy-match a sibling, which is the bug group_key exists to prevent.
    const seeds = watchlistSeeds({
      alerts: [
        { entity_name: 'A SL', group_key: 'H:M-1', active: true, watchlist_id: 5 },
        { entity_name: 'B SL', group_key: null, active: true, watchlist_id: 5 },
        { entity_name: 'C SL', group_key: 'H:M-3', active: false, watchlist_id: 5 },
        { entity_name: 'D SL', group_key: 'H:M-4', active: true, watchlist_id: 9 },
      ],
    }, 5);
    expect(seeds.map(s => s.name)).toEqual(['A SL']);
  });

  test('with no set named, takes every drawable row', async () => {
    const seeds = watchlistSeeds({
      alerts: [
        { entity_name: 'A SL', group_key: 'H:M-1', active: true, watchlist_id: 5 },
        { entity_name: 'D SL', group_key: 'H:M-4', active: true, watchlist_id: 9 },
      ],
    }, null);
    expect(seeds).toHaveLength(2);
  });
});

describe('activateMonitoring', () => {
  beforeEach(() => { global.fetch = vi.fn(); });
  afterEach(() => { vi.restoreAllMocks(); });

  test('refuses an empty token without calling the API', async () => {
    await expect(activateMonitoring('')).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('sends the token as the t query parameter, url-encoded', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
    await activateMonitoring('tok/en+1');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/bormes/v3/alerts/activate?t=tok%2Fen%2B1');
    expect(opts.method).toBe('POST');
  });

  test('a spent or expired link rejects with its status', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 410, json: async () => ({}) });
    await expect(activateMonitoring('abc')).rejects.toMatchObject({ status: 410 });
  });
});
