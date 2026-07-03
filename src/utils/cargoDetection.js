/**
 * Reverse-lookup detection: does this entity (identified by name) also show
 * up as a CARGO (officer/administrator seat) on OTHER companies?
 *
 * Backed by the existing `pgExpandOfficer` reverse lookup (entity-as-officer
 * -> its cargo companies). `service` is injected so this stays pure/testable
 * (unit tests use a fake service) — never import the live singleton here.
 */

const EMPTY_RESULT = { hasCargo: false, count: 0, companies: [] };

/**
 * @param {{ pgExpandOfficer: (name: string) => Promise<any> }} service
 * @param {string} companyName - exact name to check as a reverse-officer.
 * @returns {Promise<{ hasCargo: boolean, count: number, companies: Array }>}
 */
export async function detectCargoPresence(service, companyName) {
  if (!service || typeof service.pgExpandOfficer !== 'function' || !companyName) {
    return { ...EMPTY_RESULT };
  }

  try {
    const result = await service.pgExpandOfficer(companyName);
    const companies = (result && result.companies) || [];
    return {
      hasCargo: companies.length > 0,
      count: companies.length,
      companies,
    };
  } catch (error) {
    return { ...EMPTY_RESULT };
  }
}

export default detectCargoPresence;
