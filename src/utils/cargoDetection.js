/**
 * Reverse-lookup detection: does this entity (identified by name) also show
 * up as a CARGO (officer/administrator seat) on OTHER companies?
 *
 * Backed by the existing `pgExpandOfficer` reverse lookup (entity-as-officer
 * -> its cargo companies). `service` is injected so this stays pure/testable
 * (unit tests use a fake service) — never import the live singleton here.
 *
 * Real API response shape (`/bormes/pg/expand-officer`):
 *   {
 *     current_companies: [{ category, company_name, role, role_group, since }, ...],
 *     current_total: number,
 *     officers: [{ company_name, date, event_type, officer_name, position, specific_role, status }, ...],
 *     total: number,
 *     source: 'postgresql',
 *     success: boolean,
 *   }
 * `current_companies` = current cargo companies. `officers` = all-time appearance
 * events (active + historical), one per event (a company can appear more than once).
 */

const EMPTY_RESULT = { hasCargo: false, count: 0, officers: [], currentCompanies: [] };

/**
 * @param {{ pgExpandOfficer: (name: string) => Promise<any> }} service
 * @param {string} companyName - exact name to check as a reverse-officer.
 * @returns {Promise<{ hasCargo: boolean, count: number, officers: Array, currentCompanies: Array }>}
 */
export async function detectCargoPresence(service, companyName) {
  if (!service || typeof service.pgExpandOfficer !== 'function' || !companyName) {
    return { ...EMPTY_RESULT };
  }

  // Prefer the v3 entity index: it's what "Unificar cargos" renders, so the
  // badge count must match it (PG counts publication-spelling rows — 71 vs
  // the ~95 entities unify draws for BANCO SANTANDER, SA). The endpoint's
  // `total` is the PAGE length, not the full hit count, so fetch the full
  // page (endpoint cap 500) and count distinct companies from the rows the
  // service's exact-match filter kept. PG stays the fallback.
  if (typeof service.expandOfficerV3 === 'function') {
    try {
      const v3 = await service.expandOfficerV3(companyName, { size: 500 });
      if (v3 && v3.success) {
        const rows = Array.isArray(v3.officers) ? v3.officers : [];
        const count = new Set(rows.map((o) => o && o.company_name).filter(Boolean)).size;
        if (count > 0) {
          return { hasCargo: true, count, officers: [], currentCompanies: [] };
        }
        return { ...EMPTY_RESULT };
      }
    } catch {
      // fall through to the PG reverse lookup
    }
  }

  try {
    const result = await service.pgExpandOfficer(companyName);
    const officers = (result && Array.isArray(result.officers)) ? result.officers : [];
    const currentCompanies = (result && Array.isArray(result.current_companies)) ? result.current_companies : [];
    const currentTotal = (result && typeof result.current_total === 'number') ? result.current_total : currentCompanies.length;

    // "N empresas (cargo)" means distinct companies held/held-a-cargo-in, all-time.
    const count = officers.length > 0
      ? new Set(officers.map((o) => o && o.company_name).filter(Boolean)).size
      : currentTotal;

    const hasCargo = currentTotal > 0 || officers.length > 0;

    return {
      hasCargo,
      count,
      officers,
      currentCompanies,
    };
  } catch (error) {
    return { ...EMPTY_RESULT };
  }
}

export default detectCargoPresence;
