import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, normProvince, latestFullYearFromRows } from '../scripts/barometro-lib.mjs';

test('parseCsv parses headers and coerces numbers', () => {
  const rows = parseCsv('province,year,month,form,count,capital_subscribed\nMadrid,2025,1,SL,10,5000\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].province, 'Madrid');
  assert.equal(rows[0].year, 2025);
  assert.equal(rows[0].count, 10);
  assert.equal(rows[0].capital_subscribed, 5000);
});

test('normProvince merges both bilingual orderings to one Castilian name', () => {
  assert.equal(normProvince('Alacant / Alicante'), 'Alicante');
  assert.equal(normProvince('Alicante / Alacant'), 'Alicante');
  assert.equal(normProvince('València / Valencia'), 'Valencia');
  assert.equal(normProvince('Araba / Álava'), 'Álava');
  assert.equal(normProvince('Bizkaia'), 'Vizcaya');
  assert.equal(normProvince('Madrid'), 'Madrid');
});

test('latestFullYearFromRows returns the latest year with 12 distinct months', () => {
  const rows = [];
  for (const y of [2024, 2025]) for (let m = 1; m <= 12; m++) rows.push({ year: y, month: m });
  for (let m = 1; m <= 6; m++) rows.push({ year: 2026, month: m });
  assert.equal(latestFullYearFromRows(rows), 2025);
});
