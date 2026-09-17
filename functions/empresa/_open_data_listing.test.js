import { describe, it, expect } from 'vitest';
import { renderCompanyPage } from './_lib.js';
import { OPEN_DATA_LISTING_URL } from '../../src/copy/openDataListing.js';

const COMPANY = {
  company_name: 'ACME TEST SL',
  nif: 'B12345678',
  last_seen: '2026-08-01',
  total_publications: 80,
};
const SEED = { name: 'ACME TEST SL' };

// The datos.gob.es listing is stated once per page, in the provenance footer,
// in the page's own language. It sits AFTER "not an official registry" so the
// two sentences read as a pair: where the data comes from, then who lists us.
describe('company page footer: datos.gob.es listing', () => {
  it('carries the Spanish sentence with the link on the portal name', () => {
    const html = renderCompanyPage(COMPANY, [], 'acme-test-sl', SEED, 'es');
    expect(html).toContain(
      `Mapa Societario no es un registro oficial. Figura en el catálogo de aplicaciones de <a href="${OPEN_DATA_LISTING_URL}" target="_blank" rel="noopener">datos.gob.es</a>, el portal de datos abiertos del Gobierno de España.`,
    );
  });

  it('carries the English sentence on the English variant', () => {
    const html = renderCompanyPage(COMPANY, [], 'acme-test-sl', SEED, 'en');
    expect(html).toContain(
      `Mapa Societario is not an official registry. Listed in the applications catalogue of <a href="${OPEN_DATA_LISTING_URL}" target="_blank" rel="noopener">datos.gob.es</a>, the Spanish Government's open data portal.`,
    );
  });

  it('states it exactly once per page', () => {
    const html = renderCompanyPage(COMPANY, [], 'acme-test-sl', SEED, 'es');
    expect(html.split(OPEN_DATA_LISTING_URL).length - 1).toBe(1);
  });
});
