// mapasocietario/test/relationship-report-html.test.mjs
import assert from 'node:assert';
import test from 'node:test';
import { buildReportHtml } from '../src/utils/relationshipReportHtml.js';

const scope = {
  companies: ['ALPHA SA', 'BETA SA'],
  officersByCompany: { 'ALPHA SA': ['JUANA DIR', 'PACO APO'], 'BETA SA': ['JUANA DIR'] },
  connectors: [{ name: 'JUANA DIR', type: 'individual', companies: ['ALPHA SA', 'BETA SA'], roles: ['Administradora'], status: 'active' }],
  ownership: [{ owner: 'ALPHA SA', owned: 'BETA SA', lost: false }],
  counts: { companies: 2, officers: 2, sharedPeople: 1 },
};

test('html includes a table heading and the connector name', () => {
  const html = buildReportHtml(scope, { es: true });
  assert.match(html, /<table/);
  assert.match(html, /JUANA DIR/);
  assert.match(html, /ALPHA SA/);
});

test('escapes HTML-special characters in names', () => {
  const s = { ...scope, companies: ['A & B <SA>'], connectors: [], ownership: [], officersByCompany: {} };
  const html = buildReportHtml(s, { es: true });
  assert.match(html, /A &amp; B &lt;SA&gt;/);
  assert.doesNotMatch(html, /<SA>/);
});

test('english labels when es is false', () => {
  const html = buildReportHtml(scope, { es: false });
  assert.match(html, /Shared/i);
});
