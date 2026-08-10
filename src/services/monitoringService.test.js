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
  requestManageLink,
  fetchMonitoring,
  stopMonitoring,
  MonitoringRequestError,
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
