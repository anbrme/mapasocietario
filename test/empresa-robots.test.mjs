import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

const company = { company_name: 'SURYA CONSULTING SL', company_type: 'SL', province: 'Alicante' };

test('renderCompanyPage indexes by default', () => {
  const html = renderCompanyPage(company, [], 'surya-consulting-sl', null, 'es');
  assert.match(html, /<meta name="robots" content="index, follow">/);
});

test('renderCompanyPage with noindex=true emits noindex and not index', () => {
  const html = renderCompanyPage(company, [], 'surya-consulting-sl', null, 'es', null, null, null, null, true);
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.doesNotMatch(html, /content="index, follow"/);
});
