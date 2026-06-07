import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestFullYear, pctChange, intEs, pctEs } from '../scripts/barometro-lib.mjs';
import { buildProvinceRows, buildTypeRows, yearlyTotals, toCsv } from '../scripts/barometro-lib.mjs';

test('latestFullYear returns the most recent year with 12 months', () => {
  const series = [];
  for (let m = 1; m <= 12; m++) series.push({ date: `2024-${String(m).padStart(2, '0')}-01`, count: 1 });
  for (let m = 1; m <= 12; m++) series.push({ date: `2025-${String(m).padStart(2, '0')}-01`, count: 1 });
  for (let m = 1; m <= 6; m++) series.push({ date: `2026-${String(m).padStart(2, '0')}-01`, count: 1 });
  assert.equal(latestFullYear(series), 2025);
});

test('pctChange handles normal and zero-prev', () => {
  assert.equal(Math.round(pctChange(110, 100)), 10);
  assert.equal(pctChange(5, 0), null);
});

test('intEs formats with es-ES thousands separators', () => {
  assert.equal(intEs(38459), '38.459');
});

test('pctEs shows sign and one decimal, em-dash for null', () => {
  assert.equal(pctEs(12.34), '+12,3 %');
  assert.equal(pctEs(-1), '-1,0 %');
  assert.equal(pctEs(null), '—');
});

test('buildProvinceRows joins prev year and sorts desc by current', () => {
  const cur = [{ province: 'Madrid', formations: 100 }, { province: 'Soria', formations: 10 }];
  const prev = [{ province: 'Madrid', formations: 80 }];
  const rows = buildProvinceRows(cur, prev);
  assert.equal(rows[0].province, 'Madrid');
  assert.equal(rows[0].cur, 100);
  assert.equal(rows[0].prev, 80);
  assert.equal(Math.round(rows[0].pct), 25);
  assert.equal(rows[1].province, 'Soria');
  assert.equal(rows[1].prev, 0);
  assert.equal(rows[1].pct, null);
});

test('buildTypeRows adds Otras remainder and share, sorted desc', () => {
  const rows = buildTypeRows([{ type: 'SL', count: 96 }, { type: 'SA', count: 2 }], 100);
  assert.equal(rows[0].type, 'SL');
  assert.equal(Math.round(rows[0].share), 96);
  assert.equal(rows.at(-1).type, 'Otras');
  assert.equal(rows.at(-1).count, 2);
});

test('yearlyTotals sums monthly counts per year up to maxYear', () => {
  const s = [
    { date: '2024-01-01', count: 5 }, { date: '2024-02-01', count: 5 },
    { date: '2025-01-01', count: 3 }, { date: '2026-01-01', count: 9 },
  ];
  assert.deepEqual(yearlyTotals(s, 2025), [{ year: 2024, count: 10 }, { year: 2025, count: 3 }]);
});

test('toCsv escapes, includes header with years', () => {
  const csv = toCsv([{ province: 'A,B', cur: 10, prev: 8, pct: 25 }], 2025);
  assert.match(csv, /provincia,formaciones_2025,formaciones_2024,variacion_pct/);
  assert.match(csv, /"A,B",10,8,25\.0/);
});
