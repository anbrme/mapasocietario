import { describe, expect, it, vi } from 'vitest';
import { fetchJsonWithRetry } from '../../scripts/fetch-json-with-retry.mjs';

const okResponse = (data) => ({ ok: true, status: 200, json: async () => data });

describe('fetchJsonWithRetry', () => {
  it('retries a transient network failure and returns JSON', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('temporary timeout'))
      .mockResolvedValueOnce(okResponse({ company: { name: 'Example' } }));
    const sleepImpl = vi.fn().mockResolvedValue(undefined);

    await expect(fetchJsonWithRetry('https://example.test', {
      attempts: 3,
      timeoutMs: 100,
      baseDelayMs: 1,
      fetchImpl,
      sleepImpl,
    })).resolves.toEqual({ company: { name: 'Example' } });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledWith(1);
  });

  it('retries retryable HTTP responses', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(okResponse({ ok: true }));

    await expect(fetchJsonWithRetry('https://example.test', {
      attempts: 2,
      timeoutMs: 100,
      baseDelayMs: 1,
      fetchImpl,
      sleepImpl: vi.fn().mockResolvedValue(undefined),
    })).resolves.toEqual({ ok: true });
  });

  it('does not retry a definitive client error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const sleepImpl = vi.fn().mockResolvedValue(undefined);

    await expect(fetchJsonWithRetry('https://example.test', {
      attempts: 3,
      timeoutMs: 100,
      fetchImpl,
      sleepImpl,
    })).resolves.toBeNull();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl).not.toHaveBeenCalled();
  });

  it('still fails after all transient attempts are exhausted', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(fetchJsonWithRetry('https://example.test', {
      attempts: 3,
      timeoutMs: 100,
      baseDelayMs: 1,
      fetchImpl,
      sleepImpl: vi.fn().mockResolvedValue(undefined),
    })).rejects.toThrow('network down');

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
