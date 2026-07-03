import { describe, it, expect, vi } from 'vitest';
import { detectCargoPresence } from './cargoDetection';

const fakeService = (impl) => ({ pgExpandOfficer: vi.fn(impl) });

describe('detectCargoPresence', () => {
  it('reports hasCargo=true with the count/companies from a populated reverse lookup', async () => {
    const companies = [
      { name: 'ALPHA SL', role: 'Administrador' },
      { name: 'BETA SA', role: 'Consejero' },
    ];
    const service = fakeService(async () => ({ success: true, companies }));

    const result = await detectCargoPresence(service, 'CAJAMAR GESTION SGIIC SA');

    expect(service.pgExpandOfficer).toHaveBeenCalledWith('CAJAMAR GESTION SGIIC SA');
    expect(result).toEqual({ hasCargo: true, count: 2, companies });
  });

  it('reports hasCargo=false when the reverse lookup returns no companies', async () => {
    const service = fakeService(async () => ({ success: true, companies: [] }));

    const result = await detectCargoPresence(service, 'GARCIA LOPEZ JUAN');

    expect(result).toEqual({ hasCargo: false, count: 0, companies: [] });
  });

  it('handles a response with a missing/undefined companies field gracefully', async () => {
    const service = fakeService(async () => ({ success: true }));

    const result = await detectCargoPresence(service, 'SOME NAME');

    expect(result).toEqual({ hasCargo: false, count: 0, companies: [] });
  });

  it('returns a graceful empty result when the service throws', async () => {
    const service = fakeService(async () => {
      throw new Error('network error');
    });

    const result = await detectCargoPresence(service, 'SOME NAME');

    expect(result).toEqual({ hasCargo: false, count: 0, companies: [] });
  });

  it('returns a graceful empty result when no service/companyName is given', async () => {
    expect(await detectCargoPresence(null, 'X')).toEqual({ hasCargo: false, count: 0, companies: [] });
    expect(await detectCargoPresence(fakeService(async () => ({ companies: [] })), '')).toEqual({
      hasCargo: false,
      count: 0,
      companies: [],
    });
  });
});
