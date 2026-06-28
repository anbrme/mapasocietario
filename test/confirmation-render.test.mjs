import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

const company = {
  company_name: 'NURNBERG CONSULTING SL',
  company_type: 'SL',
  province: 'Madrid',
  current_capital: 3000,
  last_seen: '2014-03-27',
};

test('company with a confirmation shows the panel above the registry data', () => {
  const html = renderCompanyPage(company, [], 'nurnberg-consulting-sl', null, 'es');
  assert.match(html, /Confirmación de vigencia/);
  assert.match(html, /Alessandro Nürnberg/);
  assert.ok(
    html.indexOf('Confirmación de vigencia') < html.indexOf('Datos registrales'),
    'panel must render before the registry-data heading',
  );
});

test('company without a confirmation is unchanged (no panel)', () => {
  const html = renderCompanyPage(company, [], 'aldesa-energias-renovables-sl', null, 'es');
  assert.doesNotMatch(html, /Confirmación de vigencia/);
});
