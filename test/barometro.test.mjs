import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestFullYear, pctChange, intEs, pctEs } from '../scripts/barometro-lib.mjs';

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
