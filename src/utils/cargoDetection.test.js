import { describe, it, expect, vi } from 'vitest';
import { detectCargoPresence } from './cargoDetection';

const fakeService = (impl) => ({ pgExpandOfficer: vi.fn(impl) });

// Realistic fixture matching the verified /bormes/pg/expand-officer response shape.
const realisticResponse = {
  current_companies: [
    { category: 'director', company_name: 'M-CAPITAL SA', role: 'Presidente', role_group: 'board', since: '2011-08-25' },
    { category: 'director', company_name: 'OTRA EMPRESA SL', role: 'Consejero', role_group: 'board', since: '2015-01-10' },
  ],
  current_total: 2,
  officers: [
    { company_name: 'M-CAPITAL SA', date: '2011-08-25', event_type: 'Nombramientos', officer_name: 'CAJAMAR GESTION SGIIC SA', position: 'Nombramientos', specific_role: 'Presidente', status: 'active' },
    // Same company appears twice across events (renewal) — must be deduped when counting distinct companies.
    { company_name: 'M-CAPITAL SA', date: '2016-03-01', event_type: 'Reelecciones', officer_name: 'CAJAMAR GESTION SGIIC SA', position: 'Reelecciones', specific_role: 'Presidente', status: 'active' },
    { company_name: 'OTRA EMPRESA SL', date: '2015-01-10', event_type: 'Nombramientos', officer_name: 'CAJAMAR GESTION SGIIC SA', position: 'Nombramientos', specific_role: 'Consejero', status: 'active' },
    // A historical (non-active) appearance in a THIRD, distinct company — still counts toward all-time distinct count.
    { company_name: 'VIEJA EMPRESA SA', date: '2005-06-01', event_type: 'Ceses', officer_name: 'CAJAMAR GESTION SGIIC SA', position: 'Ceses', specific_role: 'Vocal', status: 'inactive' },
  ],
  total: 4,
  source: 'postgresql',
  success: true,
};

describe('detectCargoPresence', () => {
  it('reports hasCargo=true and counts DISTINCT companies across all-time officer events (dedup)', async () => {
    const service = fakeService(async () => realisticResponse);

    const result = await detectCargoPresence(service, 'CAJAMAR GESTION SGIIC SA');

    expect(service.pgExpandOfficer).toHaveBeenCalledWith('CAJAMAR GESTION SGIIC SA');
    expect(result.hasCargo).toBe(true);
    // Distinct company_name values across `officers`: M-CAPITAL SA, OTRA EMPRESA SL, VIEJA EMPRESA SA = 3
    // (NOT 4, which would be raw event count without dedup)
    expect(result.count).toBe(3);
    expect(result.officers).toEqual(realisticResponse.officers);
    expect(result.currentCompanies).toEqual(realisticResponse.current_companies);
  });

  it('reports hasCargo=true from current_total even if officers list is empty', async () => {
    const service = fakeService(async () => ({
      current_companies: [{ category: 'director', company_name: 'SOLO CURRENT SL', role: 'Administrador', role_group: 'board', since: '2020-01-01' }],
      current_total: 1,
      officers: [],
      total: 0,
      source: 'postgresql',
      success: true,
    }));

    const result = await detectCargoPresence(service, 'SOME NAME');

    expect(result.hasCargo).toBe(true);
    // No officers events to distinctly count; fall back to current_total.
    expect(result.count).toBe(1);
    expect(result.officers).toEqual([]);
    expect(result.currentCompanies).toHaveLength(1);
  });

  it('reports hasCargo=false with empty arrays when the reverse lookup has no presence at all', async () => {
    const service = fakeService(async () => ({
      current_companies: [],
      current_total: 0,
      officers: [],
      total: 0,
      source: 'postgresql',
      success: true,
    }));

    const result = await detectCargoPresence(service, 'GARCIA LOPEZ JUAN');

    expect(result).toEqual({ hasCargo: false, count: 0, officers: [], currentCompanies: [] });
  });

  it('handles a response with missing/undefined fields gracefully', async () => {
    const service = fakeService(async () => ({ success: true }));

    const result = await detectCargoPresence(service, 'SOME NAME');

    expect(result).toEqual({ hasCargo: false, count: 0, officers: [], currentCompanies: [] });
  });

  it('returns a graceful empty result when the service throws', async () => {
    const service = fakeService(async () => {
      throw new Error('network error');
    });

    const result = await detectCargoPresence(service, 'SOME NAME');

    expect(result).toEqual({ hasCargo: false, count: 0, officers: [], currentCompanies: [] });
  });

  it('returns a graceful empty result when no service/companyName is given', async () => {
    expect(await detectCargoPresence(null, 'X')).toEqual({ hasCargo: false, count: 0, officers: [], currentCompanies: [] });
    expect(
      await detectCargoPresence(fakeService(async () => ({ officers: [] })), '')
    ).toEqual({ hasCargo: false, count: 0, officers: [], currentCompanies: [] });
  });
});
