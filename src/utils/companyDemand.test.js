import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCompanyDemandPayload, companyGroupKey, recordCompanyDemand } from './companyDemand';

describe('company demand signals', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('extracts only stable v3 company group keys', () => {
    expect(companyGroupKey({ groupKey: 'H:M-396846' })).toBe('H:M-396846');
    expect(companyGroupKey({ _id: 'N:ACME SL' })).toBe('N:ACME SL');
    expect(companyGroupKey({ id: 'company-acme' })).toBeNull();
  });

  it('builds a payload without including the user search query', () => {
    const storage = { getItem: vi.fn(() => 'session_123456'), setItem: vi.fn() };
    vi.stubGlobal('window', { sessionStorage: storage });

    expect(buildCompanyDemandPayload({
      eventType: 'search_rendered',
      language: 'en',
      company: {
        _id: 'H:M-396846',
        company_name: 'ACME & PARTNERS SL',
        province: 'Madrid',
        hojas: ['M-396846'],
      },
    })).toEqual({
      event_type: 'search_rendered',
      group_key: 'H:M-396846',
      company_name: 'ACME & PARTNERS SL',
      slug: 'acme-y-partners-sl',
      session_id: 'session_123456',
      language: 'en',
      province: 'Madrid',
      hoja: 'M-396846',
    });
  });

  it('does not send a signal when the company has no stable identity', () => {
    const fetch = vi.fn();
    vi.stubGlobal('window', { fetch, sessionStorage: { getItem: () => 'session_123456' } });

    recordCompanyDemand({ eventType: 'full_profile_click', company: { name: 'ACME SL' } });

    expect(fetch).not.toHaveBeenCalled();
  });
});
