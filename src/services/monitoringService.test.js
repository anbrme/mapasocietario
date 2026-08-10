import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestMonitoring, isMonitorableNode } from './monitoringService';

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
