import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  configureOriginGroups,
  resilientFetch,
  activeOrigin,
  __resetOriginFailover,
} from './originFailover';

const PRIMARY = 'https://api.example.test';
const MIRROR = 'https://api-directo.example.test';

const ok = (status = 200) => ({ ok: status < 400, status, url: '' });

/**
 * A null-routed IP: the SYN is dropped, so the socket neither resolves nor
 * rejects until something aborts it. This is what a LaLiga block looks like
 * and the only failure mode the module is really built for.
 */
const blackhole = (_url, options) =>
  new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () =>
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    );
  });

beforeEach(() => {
  __resetOriginFailover();
  configureOriginGroups({ api: [PRIMARY, MIRROR] });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('resilientFetch origin failover', () => {
  it('reroutes to the mirror when the primary black-holes the connection', async () => {
    global.fetch = vi.fn((url, options) => (url.startsWith(PRIMARY) ? blackhole(url, options) : Promise.resolve(ok())));

    const pending = resilientFetch(`${PRIMARY}/bormes/working-search?q=ACME`);
    await vi.advanceTimersByTimeAsync(9000);
    const response = await pending;

    expect(response.status).toBe(200);
    expect(global.fetch.mock.calls[1][0]).toBe(`${MIRROR}/bormes/working-search?q=ACME`);
  });

  it('gives up on a black-holed origin in seconds, not the ~75s the OS would take', async () => {
    global.fetch = vi.fn(blackhole);

    const pending = resilientFetch(`${PRIMARY}/x`).catch(error => error);
    await vi.advanceTimersByTimeAsync(9000);
    // Both origins timed out; the second attempt must already have been made.
    expect(global.fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(9000);
    expect((await pending).blocked).toBe(true);
  });

  it('sticks to the mirror for later requests instead of re-paying the timeout', async () => {
    global.fetch = vi.fn((url, options) => (url.startsWith(PRIMARY) ? blackhole(url, options) : Promise.resolve(ok())));

    const first = resilientFetch(`${PRIMARY}/one`);
    await vi.advanceTimersByTimeAsync(9000);
    await first;
    expect(activeOrigin('api')).toBe(MIRROR);

    global.fetch.mockClear();
    await resilientFetch(`${PRIMARY}/two`);

    // The real request goes straight to the mirror. The primary is touched
    // only by the background liveness probe below, never by user traffic.
    const urls = global.fetch.mock.calls.map(call => call[0]);
    expect(urls).toContain(`${MIRROR}/two`);
    expect(urls).not.toContain(`${PRIMARY}/two`);
  });

  it('drifts back to the primary once the match window closes', async () => {
    global.fetch = vi.fn((url, options) => (url.startsWith(PRIMARY) ? blackhole(url, options) : Promise.resolve(ok())));

    const first = resilientFetch(`${PRIMARY}/one`);
    await vi.advanceTimersByTimeAsync(9000);
    await first;
    expect(activeOrigin('api')).toBe(MIRROR);

    // Block lifted: the primary answers again. The next request triggers the
    // background re-probe, which promotes Cloudflare back without the user
    // reloading anything.
    global.fetch = vi.fn().mockResolvedValue(ok());
    await resilientFetch(`${PRIMARY}/two`);
    await vi.advanceTimersByTimeAsync(0);

    expect(activeOrigin('api')).toBe(PRIMARY);
  });

  it('fails over promptly when kickoff lands mid-session, not after the full ceiling', async () => {
    // The realistic case: the user is already browsing, so the primary has
    // been proven long before LaLiga blocks it. A fixed generous budget for a
    // proven origin would strand this request for 45s.
    global.fetch = vi.fn().mockResolvedValue(ok());
    await resilientFetch(`${PRIMARY}/before-kickoff`);
    expect(activeOrigin('api')).toBe(PRIMARY);

    global.fetch = vi.fn((url, options) => (url.startsWith(PRIMARY) ? blackhole(url, options) : Promise.resolve(ok())));
    const pending = resilientFetch(`${PRIMARY}/after-kickoff`);

    await vi.advanceTimersByTimeAsync(9000);
    const response = await pending;

    expect(response.status).toBe(200);
    expect(activeOrigin('api')).toBe(MIRROR);
  });

  it('grants a slow-but-alive endpoint the room it needs before calling it blocked', async () => {
    // A cold BORME query that takes 15s must not be mistaken for a block just
    // because it exceeds the unproven budget.
    let resolveSlow;
    global.fetch = vi.fn(() => new Promise(resolve => { resolveSlow = resolve; }));

    const first = resilientFetch(`${PRIMARY}/cold-query`);
    await vi.advanceTimersByTimeAsync(7000);
    resolveSlow(ok());
    await first;

    // Having seen 7s, the origin earns ~14s before the next timeout fires —
    // so a 10s request still succeeds rather than tripping failover.
    global.fetch = vi.fn(() => new Promise(resolve => { resolveSlow = resolve; }));
    const second = resilientFetch(`${PRIMARY}/another-cold-query`);
    await vi.advanceTimersByTimeAsync(10000);
    resolveSlow(ok());

    expect((await second).status).toBe(200);
    expect(activeOrigin('api')).toBe(PRIMARY);
  });

  it('does not fail over on a 500 — the origin answered, so it is reachable', async () => {
    global.fetch = vi.fn().mockResolvedValue(ok(500));

    const response = await resilientFetch(`${PRIMARY}/boom`);

    expect(response.status).toBe(500);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(activeOrigin('api')).toBe(PRIMARY);
  });

  it('does fail over on Cloudflare 522, where the edge is up but the VPS is not reachable through it', async () => {
    global.fetch = vi.fn(url => Promise.resolve(url.startsWith(PRIMARY) ? ok(522) : ok(200)));

    const response = await resilientFetch(`${PRIMARY}/dd`);

    expect(response.status).toBe(200);
    expect(global.fetch.mock.calls[1][0]).toBe(`${MIRROR}/dd`);
  });

  it('honours a caller abort without firing a pointless mirror request', async () => {
    global.fetch = vi.fn(blackhole);
    const controller = new AbortController();

    const pending = resilientFetch(`${PRIMARY}/slow`, { signal: controller.signal }).catch(e => e);
    controller.abort();
    const error = await pending;

    expect(error.name).toBe('AbortError');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('passes through an origin that is not mirrored', async () => {
    global.fetch = vi.fn().mockResolvedValue(ok());

    await resilientFetch('https://static.example.org/a.json');

    expect(global.fetch.mock.calls[0][0]).toBe('https://static.example.org/a.json');
  });

  it('preserves path, query and hash when swapping origin', async () => {
    global.fetch = vi.fn((url, options) => (url.startsWith(PRIMARY) ? blackhole(url, options) : Promise.resolve(ok())));

    const pending = resilientFetch(`${PRIMARY}/a/b?x=1&y=2#frag`);
    await vi.advanceTimersByTimeAsync(9000);
    await pending;

    expect(global.fetch.mock.calls[1][0]).toBe(`${MIRROR}/a/b?x=1&y=2#frag`);
  });

  it('is a no-op when no mirror is configured, which is how it ships today', async () => {
    configureOriginGroups({ api: [PRIMARY] });
    global.fetch = vi.fn(blackhole);

    const pending = resilientFetch(`${PRIMARY}/x`).catch(e => e);
    await vi.advanceTimersByTimeAsync(9000);
    await pending;

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
