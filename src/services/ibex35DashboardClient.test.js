import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getIbexCompanyData, __resetIbex35Cache } from './ibex35DashboardClient';

const SAMPLE_RESPONSE = {
  success: true,
  data: [
    { nif: 'A78374725', ticker: 'REP.MC', name: 'Repsol', current_price_eur: 11.5 },
    { nif: 'A-39000013', ticker: 'SAN.MC', name: 'Santander', current_price_eur: 12.4 },
  ],
};

describe('getIbexCompanyData', () => {
  beforeEach(() => {
    __resetIbex35Cache();
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    }));
  });

  it('calls the public companies endpoint with the public API key', async () => {
    await getIbexCompanyData('A78374725');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://ibex35-api.ncdata.eu/api/companies',
      expect.objectContaining({
        headers: { Authorization: 'Bearer ibex35-public-access-2024' },
      })
    );
  });

  it('finds a company by NIF ignoring dash/case differences on the input side', async () => {
    const row = await getIbexCompanyData('a-78374725');
    expect(row.name).toBe('Repsol');
  });

  it('finds a company by NIF ignoring dash differences on the data side', async () => {
    const row = await getIbexCompanyData('A39000013');
    expect(row.name).toBe('Santander');
  });

  it('returns null when no company matches the NIF', async () => {
    const row = await getIbexCompanyData('X00000000');
    expect(row).toBeNull();
  });

  it('returns null for empty/null/undefined input without calling fetch', async () => {
    expect(await getIbexCompanyData('')).toBeNull();
    expect(await getIbexCompanyData(null)).toBeNull();
    expect(await getIbexCompanyData(undefined)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('caches the companies list across calls in the same window (fetches once)', async () => {
    await getIbexCompanyData('A78374725');
    await getIbexCompanyData('A-39000013');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null and does not throw when the request fails', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 }));
    const row = await getIbexCompanyData('A78374725');
    expect(row).toBeNull();
  });

  it('returns null and does not throw when fetch itself rejects', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network down');
    });
    const row = await getIbexCompanyData('A78374725');
    expect(row).toBeNull();
  });
});
