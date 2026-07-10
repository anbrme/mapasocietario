import { describe, it, expect, beforeEach, vi } from 'vitest';
import { spanishCompaniesService } from './spanishCompaniesService';

// The public data preview lets anonymous users flag a wrong enriched NIF. This
// covers the service method that posts to the Turnstile-gated public route.
describe('spanishCompaniesService.reportEnrichment', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ success: true, id: 42 }) }));
  });

  it('posts to the public enrichment-report route with the Turnstile token', async () => {
    const result = await spanishCompaniesService.reportEnrichment({
      companyName: 'MERCADONA SA',
      field: 'nif',
      currentValue: 'A46103834',
      suggestedValue: 'A46103835',
      note: 'wrong digit',
      turnstileToken: 'tok-123',
    });

    expect(result).toEqual({ success: true, id: 42 });
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/bormes\/enrichment\/report-public$/);
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body).toEqual({
      company_name: 'MERCADONA SA',
      field: 'nif',
      turnstile_token: 'tok-123',
      current_value: 'A46103834',
      suggested_value: 'A46103835',
      note: 'wrong digit',
    });
  });

  it('omits optional fields when not provided', async () => {
    await spanishCompaniesService.reportEnrichment({
      companyName: 'ACME SL',
      field: 'nif',
      turnstileToken: 'tok-xyz',
    });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual({ company_name: 'ACME SL', field: 'nif', turnstile_token: 'tok-xyz' });
    expect(body).not.toHaveProperty('current_value');
    expect(body).not.toHaveProperty('note');
  });

  it('throws with the backend error message on failure', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: 'verification failed' }) }));
    await expect(
      spanishCompaniesService.reportEnrichment({ companyName: 'ACME SL', field: 'nif', turnstileToken: '' })
    ).rejects.toThrow('verification failed');
  });
});
