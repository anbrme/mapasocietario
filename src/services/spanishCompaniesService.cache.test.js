import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpanishCompaniesService } from './spanishCompaniesService';

const jsonResponse = body => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

let service;

beforeEach(() => {
  service = new SpanishCompaniesService();
  global.fetch = vi
    .fn()
    .mockResolvedValue(jsonResponse({ success: true, events: [], officers: [] }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('spanishCompaniesService read cache', () => {
  it('asks the backend once for a company the user clicks back to', async () => {
    await service.getCompanyEventsV3('ACME SL', { groupKey: 'H:M-1', size: 100 });
    await service.getCompanyEventsV3('ACME SL', { groupKey: 'H:M-1', size: 100 });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('separates entries by the arguments that change the answer', async () => {
    await service.getCompanyEventsV3('ACME SL', { groupKey: 'H:M-1', size: 100 });
    await service.getCompanyEventsV3('ACME SL', { groupKey: 'H:M-1', size: 50 });
    await service.getCompanyEventsV3('ACME SL', { groupKey: 'H:M-2', size: 100 });

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('collapses the parallel variant queries a merged officer node fires', async () => {
    await Promise.all([
      service.expandOfficerV3('GARCIA LOPEZ MARIA'),
      service.expandOfficerV3('GARCIA LOPEZ MARIA'),
      service.expandOfficerV3('GARCIA LOPEZ MARIA'),
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("still reaches the backend for the user's own search, so it stays counted", async () => {
    // analyticsSource is what tells the backend a human searched this. Serving
    // it from memory would silently stop counting searches and firing alerts.
    global.fetch.mockResolvedValue(jsonResponse({ company: { name: 'ACME SL' } }));

    await service.getCompanyProfileV3('ACME SL', { analyticsSource: 'company' });
    await service.getCompanyProfileV3('ACME SL', { analyticsSource: 'company' });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('refreshes the entry when a search goes through, so later reads are current', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ company: { name: 'ACME SL' } }));

    await service.getCompanyProfileV3('ACME SL', { analyticsSource: 'company' });
    await service.getCompanyProfileV3('ACME SL');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the full-officer view separate from the capped one', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ company: { name: 'ACME SL' } }));

    await service.getCompanyProfileV3('ACME SL');
    await service.getCompanyProfileV3('ACME SL', { fullOfficers: true });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not pin a failure for the session', async () => {
    // A 4xx is not retried, so it surfaces as a rejection. The next call must
    // reach the backend rather than replaying the error for ten minutes.
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'not found' })
      .mockResolvedValue(jsonResponse({ success: true, events: [] }));

    await expect(service.getCompanyEventsV3('ACME SL')).rejects.toThrow();
    await expect(service.getCompanyEventsV3('ACME SL')).resolves.toBeTruthy();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('goes back to the backend after clearCache', async () => {
    await service.getCompanyEventsV3('ACME SL');
    service.clearCache();
    await service.getCompanyEventsV3('ACME SL');

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('drops everything when the service is re-pointed at another backend', async () => {
    await service.getCompanyEventsV3('ACME SL');
    service.configure({ baseUrl: 'http://localhost:5005' });
    await service.getCompanyEventsV3('ACME SL');

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('hands each caller its own copy of the payload', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse({ success: true, events: [{ event_date: '2025-01-23' }] })
    );

    const first = await service.getCompanyEventsV3('ACME SL');
    first.events[0].event_date = 'MUTATED';
    const second = await service.getCompanyEventsV3('ACME SL');

    expect(second.events[0].event_date).toBe('2025-01-23');
  });

  it('serves a repeated autocomplete prefix from memory', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse({ success: true, suggestions: [{ company_name: 'ACME SL', id: 'H:M-1' }] })
    );

    await service.autocompleteCompanies('ACME');
    const second = await service.autocompleteCompanies('acme');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(second.suggestions[0].name).toBe('ACME SL');
  });

  it('returns the empty shape on an autocomplete failure without caching it', async () => {
    global.fetch
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(jsonResponse({ success: true, suggestions: [] }));

    await expect(service.autocompleteCompanies('ACME')).resolves.toEqual({ suggestions: [] });
    await service.autocompleteCompanies('ACME');

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('getCompanyFindings', () => {
  it('requests the free findings by group_key and caches per language', async () => {
    const svc = new SpanishCompaniesService();
    const calls = [];
    svc.fetchWithRetry = async (url) => { calls.push(url); return { ok: true, json: async () => ({ tier: 'free', findings: [] }) }; };
    await svc.getCompanyFindings({ groupKey: 'H:M-1', lang: 'en' });
    await svc.getCompanyFindings({ groupKey: 'H:M-1', lang: 'en' });
    await svc.getCompanyFindings({ groupKey: 'H:M-1', lang: 'es' });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('/bormes/v3/company-findings?group_key=H%3AM-1&lang=en');
  });

  it('falls back to the name when there is no group key', async () => {
    const svc = new SpanishCompaniesService();
    let url = '';
    svc.fetchWithRetry = async (u) => { url = u; return { ok: true, json: async () => ({ tier: 'free', findings: [] }) }; };
    await svc.getCompanyFindings({ name: 'X SL', lang: 'es' });
    expect(url).toContain('/bormes/v3/company-findings?name=X+SL&lang=es');
  });

  it('throws with the status on a non-2xx so the panel can report it', async () => {
    const svc = new SpanishCompaniesService();
    svc.fetchWithRetry = async () => ({ ok: false, status: 502, json: async () => ({ error: 'assembly_failed' }) });
    await expect(svc.getCompanyFindings({ groupKey: 'H:M-1', lang: 'en' })).rejects.toMatchObject({ status: 502 });
  });
});
