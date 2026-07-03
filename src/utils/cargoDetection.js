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
