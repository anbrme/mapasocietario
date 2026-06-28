import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

// Parity pass: the /empresa page should surface the same backend fields the
// in-app preview panel shows — objeto social (activity), NIF, and the enriched
// capital/address fallback with the "external estimate" caveat.
const base = { company_name: 'TEST CO SL', company_type: 'SL', province: 'Madrid' };
const render = (extra) => renderCompanyPage({ ...base, ...extra }, [], 'test-co-sl', null, 'es');

test('objeto social (activity) is shown when present', () => {
  const html = render({ activity: 'La prestación de servicios de consultoría' });
  assert.match(html, /Objeto social/);
  assert.match(html, /La prestación de servicios de consultoría/);
});

test('no activity → no objeto social row', () => {
  assert.doesNotMatch(render({}), /Objeto social/);
});

test('NIF shown from nif or enriched_nif when present', () => {
  assert.match(render({ nif: 'B12345678' }), /B12345678/);
  assert.match(render({ enriched_nif: 'B87654321' }), /B87654321/);
});

test('enriched capital shown with external-estimate caveat when BORME capital is absent', () => {
  const html = render({ enriched_capital: 60000 });
  assert.match(html, /60\.000/);
  assert.match(html, /estimación de fuente externa/);
});

test('BORME capital shows WITHOUT the external caveat', () => {
  const html = render({ current_capital: 3000 });
  // es-ES does not group 4-digit numbers, so 3000 → "3000 €" (5-digit values group: "60.000 €")
  assert.match(html, /3\.?000/);
  assert.doesNotMatch(html, /estimación de fuente externa/);
});

test('enriched address shown with caveat when BORME address is absent', () => {
  const html = render({ enriched_address: 'CALLE FALSA 123' });
  assert.match(html, /CALLE FALSA 123/);
  assert.match(html, /estimación de fuente externa/);
});

test('BORME address shows WITHOUT the external caveat', () => {
  const html = render({ current_address: 'C/ REAL 1 (MADRID)' });
  assert.match(html, /C\/ REAL 1/);
  assert.doesNotMatch(html, /estimación de fuente externa/);
});
