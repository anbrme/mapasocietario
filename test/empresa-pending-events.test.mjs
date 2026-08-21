import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

// SOTO DE TORRES, SL, 2026-08-21. BORME published one joint administrator
// resigning and another being appointed the same morning. The event log carried
// both acts hours before the aggregated doc absorbed them. The page read the doc
// for "Administradores y cargos vigentes" and the events for the history, so it
// named the man who had just resigned, omitted his replacement, and printed both
// acts correctly a few centimetres below.
const company = {
  company_name: 'SOTO DE TORRES, SL',
  company_type: 'SL',
  province: 'Álava',
  last_seen: '2025-11-27',
  officers_active: [
    { name: 'AMADO GALLART JOSEP', position_normalized: 'ADM. MANCOM.', appointed_date: '2011-05-20', status: 'active' },
    { name: 'CARRETER DE GRANDA JULIO', position_normalized: 'ADM. MANCOM.', appointed_date: '2021-12-10', status: 'active' },
  ],
  officers_resigned: [],
};

const replacementFiling = {
  event_date: '2026-08-21',
  officers: [
    { name: 'AMADO GALLART JOSEP', position_normalized: 'ADM. MANCOM.', event_type: 'Ceses/Dimisiones' },
    { name: 'FABRICE BRUNO DUCCESCHI', position_normalized: 'ADM. MANCOM.', event_type: 'Nombramientos' },
  ],
};

const currentOfficersBlock = (html) => {
  const start = html.indexOf('Administradores y cargos vigentes');
  assert.notEqual(start, -1, 'current-officers table missing');
  const end = html.indexOf('</table>', start);
  return html.slice(start, end === -1 ? start + 4000 : end);
};

test('an officer appointed after the last aggregation is listed as current', () => {
  const html = renderCompanyPage(company, [replacementFiling], 'soto-de-torres-sl', null, 'es');
  assert.match(currentOfficersBlock(html), /FABRICE BRUNO DUCCESCHI/);
});

test('the officer who resigned that day is no longer listed as current', () => {
  const html = renderCompanyPage(company, [replacementFiling], 'soto-de-torres-sl', null, 'es');
  assert.doesNotMatch(currentOfficersBlock(html), /AMADO GALLART JOSEP/);
});

test('the structured data Google reads names the same people as the page', () => {
  const html = renderCompanyPage(company, [replacementFiling], 'soto-de-torres-sl', null, 'es');
  const ld = html.slice(html.indexOf('application/ld+json'), html.indexOf('</script>', html.indexOf('application/ld+json')));
  assert.match(ld, /FABRICE BRUNO DUCCESCHI/);
  assert.doesNotMatch(ld, /AMADO GALLART JOSEP/);
});

test('officers the aggregation is authoritative about are untouched', () => {
  const html = renderCompanyPage(company, [replacementFiling], 'soto-de-torres-sl', null, 'es');
  assert.match(currentOfficersBlock(html), /CARRETER DE GRANDA JULIO/);
});

test('a doc level with the event log renders exactly as before', () => {
  const current = { ...company, last_seen: '2026-08-21' };
  const html = renderCompanyPage(current, [replacementFiling], 'soto-de-torres-sl', null, 'es');
  const block = currentOfficersBlock(html);
  assert.match(block, /AMADO GALLART JOSEP/);
  assert.doesNotMatch(block, /FABRICE BRUNO DUCCESCHI/);
});

test('an event naming nobody the doc lists never invents a departure', () => {
  const emptyDoc = { ...company, officers_active: [], officers_resigned: [] };
  const html = renderCompanyPage(emptyDoc, [replacementFiling], 'soto-de-torres-sl', null, 'es');
  // Fabrice was appointed, so he is seated; Amado was never held, so he is not
  // fabricated into a resignation row.
  assert.match(html, /FABRICE BRUNO DUCCESCHI/);
});
