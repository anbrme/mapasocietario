import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

// The BORME history block leads with an "annual activity matrix": one row per
// year, one column per change type that actually occurred, explicit counts and
// an em dash for empty cells. It replaced a stacked colour bar that forced the
// reader to decode segment widths.
const company = { company_name: 'TEST CO SL', company_type: 'SL', province: 'Madrid' };

const events = [
  { event_date: '2023-05-02', event_types: ['Nombramientos'], full_entry: 'Nombramientos. Adm. Unico: PEREZ' },
  { event_date: '2023-06-11', event_types: ['Nombramientos', 'Ceses/Dimisiones'], full_entry: 'Ceses' },
  { event_date: '2023-09-01', event_types: ['Socio unico'], full_entry: 'Socio unico' },
  { event_date: '2020-03-04', event_types: ['Otros conceptos'], full_entry: 'Otros' },
];

const matrixOf = (html) => {
  const match = html.match(/<table class="history-matrix">[\s\S]*?<\/table>/);
  assert.ok(match, 'history matrix table should be rendered');
  return match[0];
};

const render = (lang = 'es') => renderCompanyPage(company, events, 'test-co-sl', null, lang);

test('history matrix renders a row per year with explicit counts', () => {
  const matrix = matrixOf(render());
  assert.match(matrix, /<th scope="row">2023<\/th>/);
  assert.match(matrix, /<th scope="row">2020<\/th>/);
  // 2023: 2 appointments, 1 departure, 1 ownership, 0 other → total 4
  const row2023 = matrix.match(/<tr><th scope="row">2023<\/th>[\s\S]*?<\/tr>/)[0];
  assert.match(row2023, /history-total[^>]*>4</);
  assert.match(row2023, /data-label="Nombramientos">2</); // appointments count, labelled for the mobile card layout
});

test('empty cells use an em dash instead of a zero', () => {
  const row2020 = matrixOf(render()).match(/<tr><th scope="row">2020<\/th>[\s\S]*?<\/tr>/)[0];
  assert.match(row2020, /history-zero[^>]*>—</);
});

test('only change types present in the data get a column', () => {
  const matrix = matrixOf(render());
  assert.match(matrix, /Nombramientos/);
  assert.doesNotMatch(matrix, /Capital/); // no capital events in the fixture
});

test('a totals row closes the matrix', () => {
  const matrix = matrixOf(render());
  assert.match(matrix, /<tfoot>[\s\S]*Total[\s\S]*<\/tfoot>/);
  assert.match(matrix, /<tfoot>[\s\S]*history-total[^>]*>5</); // 5 changes across both years
});

test('the stacked colour bar markup is gone', () => {
  const html = render();
  assert.doesNotMatch(html, /history-track|history-segment|history-chart-row/);
});

test('English locale uses English column headers', () => {
  const matrix = matrixOf(render('en'));
  assert.match(matrix, /Appointments/);
  assert.match(matrix, /Departures/);
});
