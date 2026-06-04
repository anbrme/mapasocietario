/** Pure-function checks for renderCompanyPage GLEIF block + section order. */
import { renderCompanyPage } from '../functions/empresa/_lib.js';
import assert from 'node:assert';

const company = {
  company_name: 'ACS ACTIVIDADES DE CONSTRUCCION Y SERVICIOS SA',
  company_type: 'SA', province: 'Madrid', current_capital: 1000,
  // Non-empty so the "Estructura de socios" heading renders (used for the order check).
  sole_shareholders: ['EXAMPLE HOLDING, S.L.'], sole_shareholder_individuals: [],
  officers_active: [], officers_resigned: [], capital_history: [], identifiers: [], name_changes: [],
};
const seed = { name: 'ACS', isin: 'ES0167050915', lei: '95980020140005558665', ticker: 'BME:ACS', sector: 'Construcción' };
const gleif = {
  directParent: null, ultimateParent: null,
  directChildren: [{ lei: 'X'.repeat(20), legalName: 'NEXPLORE, S.A.', country: 'ES', entityStatus: 'ACTIVE' }],
  ultimateChildren: [{ lei: 'Y'.repeat(20), legalName: 'FLATIRON DRAGADOS USA, INC.', country: 'US', entityStatus: 'ACTIVE' }],
};
const boe = { mentions: [{ category: 'contrato', date: '2024-01-01', title: 'Contrato X', url: 'https://boe.es/x' }] };

const html = renderCompanyPage(company, [], 'acs', seed, 'es', null, null, boe, gleif);

assert(html.includes('Grupo societario (GLEIF)'), 'GLEIF heading missing');
assert(html.includes('NEXPLORE, S.A.'), 'direct child missing');
assert(html.includes('id="gleif-graph"'), 'graph container missing');
assert(html.includes('id="gleif-graph-data"'), 'graph data json missing');
assert(html.includes('/vendor/gleif-graph.js'), 'graph script missing');
assert(html.includes('cabecera de grupo'), 'no-parent label missing');

// Section order (asserted only on strings we fully control: shareholders heading,
// GLEIF heading, BOE heading). Officers sit between GLEIF and BOE in the template,
// so shareholders < GLEIF < BOE confirms the reorder without coupling to officersRows.
const iShareholders = html.indexOf('Estructura de socios');
const iGleif = html.indexOf('Grupo societario');
const iBoe = html.indexOf('Menciones del grupo en el BOE');
assert(iShareholders > -1 && iGleif > -1 && iBoe > -1, 'expected sections present');
assert(iShareholders < iGleif, 'shareholders must come before GLEIF');
assert(iGleif < iBoe, 'GLEIF must come before BOE (BOE moved below directors)');

// No-GLEIF company renders no section and does not throw.
const html2 = renderCompanyPage(company, [], 'acs', { name: 'ACS', isin: 'ES0167050915' }, 'es', null, null, null, null);
assert(!html2.includes('Grupo societario (GLEIF)'), 'GLEIF section should be absent without data');

console.log('check-gleif-render: OK');
