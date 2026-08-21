import { describe, it, expect, vi } from 'vitest';
import { createRequestCache } from './requestCache';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('createRequestCache', () => {
  it('calls the loader once and serves the second read from memory', async () => {
    const loader = vi.fn().mockResolvedValue({ name: 'ACME SL' });
    const cache = createRequestCache();

    await cache.fetch('company:ACME', loader);
    const second = await cache.fetch('company:ACME', loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(second).toEqual({ name: 'ACME SL' });
  });

  it('keeps different keys independent', async () => {
    const cache = createRequestCache();

    const a = await cache.fetch('a', () => Promise.resolve(1));
    const b = await cache.fetch('b', () => Promise.resolve(2));

    expect([a, b]).toEqual([1, 2]);
  });

  it('collapses concurrent requests for the same key into one', async () => {
    // Clicking a node fires the profile and the events request together, and a
    // merged officer node queries every name variant in parallel.
    const control = deferred();
    const loader = vi.fn().mockReturnValue(control.promise);
    const cache = createRequestCache();

    const first = cache.fetch('officer:X', loader);
    const second = cache.fetch('officer:X', loader);
    control.resolve({ total: 3 });

    expect(await first).toEqual({ total: 3 });
    expect(await second).toEqual({ total: 3 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads once the entry is older than the TTL', async () => {
    let clock = 1000;
    const loader = vi.fn().mockResolvedValue('v');
    const cache = createRequestCache({ ttlMs: 500, now: () => clock });

    await cache.fetch('k', loader);
    clock = 1400;
    await cache.fetch('k', loader);
    expect(loader).toHaveBeenCalledTimes(1);

    clock = 1600;
    await cache.fetch('k', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('never caches a failure', async () => {
    // A 500 or a dropped connection must not pin an error for the whole session.
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue('ok');
    const cache = createRequestCache();

    await expect(cache.fetch('k', loader)).rejects.toThrow('boom');
    await expect(cache.fetch('k', loader)).resolves.toBe('ok');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('caches an empty answer, because "nothing found" is an answer', async () => {
    const loader = vi.fn().mockResolvedValue({ companies: [] });
    const cache = createRequestCache();

    await cache.fetch('k', loader);
    await cache.fetch('k', loader);

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('hands every caller its own copy, so one caller cannot poison the next', async () => {
    const cache = createRequestCache();
    const loader = () => Promise.resolve({ officers: [{ name: 'A' }] });

    const first = await cache.fetch('k', loader);
    first.officers.push({ name: 'INJECTED' });
    first.officers[0].name = 'MUTATED';
    const second = await cache.fetch('k', loader);

    expect(second.officers).toEqual([{ name: 'A' }]);
  });

  it('drops the least recently used entry when full', async () => {
    const cache = createRequestCache({ maxEntries: 2 });
    const loader = vi.fn(key => Promise.resolve(key));

    await cache.fetch('a', () => loader('a'));
    await cache.fetch('b', () => loader('b'));
    await cache.fetch('a', () => loader('a')); // 'a' is now the most recent
    await cache.fetch('c', () => loader('c')); // evicts 'b'

    await cache.fetch('a', () => loader('a'));
    expect(loader).toHaveBeenCalledTimes(3);

    await cache.fetch('b', () => loader('b'));
    expect(loader).toHaveBeenCalledTimes(4);
  });

  it('forgets everything on clear', async () => {
    const loader = vi.fn().mockResolvedValue(1);
    const cache = createRequestCache();

    await cache.fetch('k', loader);
    cache.clear();
    await cache.fetch('k', loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('bypasses the entry but refreshes it when asked for fresh data', async () => {
    const loader = vi.fn().mockResolvedValueOnce('old').mockResolvedValue('new');
    const cache = createRequestCache();

    await cache.fetch('k', loader);
    expect(await cache.fetch('k', loader, { fresh: true })).toBe('new');
    expect(await cache.fetch('k', loader)).toBe('new');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('gives a concurrent waiter the value, even when it cannot be copied', async () => {
    // The waiter used to receive the copy attempt rather than the value, which
    // for an uncloneable payload meant undefined.
    const control = deferred();
    const value = { fn: () => 'nope' };
    const cache = createRequestCache();

    const first = cache.fetch('k', () => control.promise);
    const second = cache.fetch('k', () => control.promise);
    control.resolve(value);

    expect(await first).toBe(value);
    expect(await second).toBe(value);
  });

  it('caches a loader that resolves to undefined', async () => {
    const loader = vi.fn().mockResolvedValue(undefined);
    const cache = createRequestCache();

    await cache.fetch('k', loader);
    await cache.fetch('k', loader);

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('stays out of the way of values it cannot copy', async () => {
    // A Response, a DOM node, a function: not cloneable. Better to serve it
    // uncached than to throw inside a data path.
    const value = { fn: () => 'nope' };
    const loader = vi.fn().mockResolvedValue(value);
    const cache = createRequestCache();

    expect(await cache.fetch('k', loader)).toBe(value);
    expect(await cache.fetch('k', loader)).toBe(value);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
