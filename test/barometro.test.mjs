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

import { barChartSvg, trendChartSvg } from '../scripts/barometro-lib.mjs';

test('barChartSvg renders one <rect> per item and is valid svg', () => {
  const svg = barChartSvg([{ label: 'Madrid', value: 100 }, { label: 'Soria', value: 10 }]);
  assert.match(svg, /^<svg /);
  assert.match(svg, /<\/svg>$/);
  assert.equal((svg.match(/<rect /g) || []).length, 2);
  assert.match(svg, /Madrid/);
});

test('trendChartSvg renders a polyline with one point per year', () => {
  const svg = trendChartSvg([{ year: 2023, count: 5 }, { year: 2024, count: 8 }, { year: 2025, count: 6 }]);
  assert.match(svg, /<polyline /);
  const pts = svg.match(/points="([^"]+)"/)[1].trim().split(/\s+/);
  assert.equal(pts.length, 3);
});

import { renderArticleHtml, injectHead } from '../scripts/barometro-lib.mjs';

const DATA = {
  year: 2025, prevYear: 2024,
  nationalCur: 155399, nationalPrev: 150000, nationalPct: 3.6,
  provinceRows: [
    { province: 'Barcelona', cur: 38459, prev: 30229, pct: 27.2 },
    { province: 'Madrid', cur: 30287, prev: 29900, pct: 1.3 },
  ],
  typeRows: [{ type: 'SL', count: 150337, share: 96.7 }, { type: 'Otras', count: 5062, share: 3.3 }],
  barSvg: '<svg id="bar"></svg>', trendSvg: '<svg id="trend"></svg>',
};

test('renderArticleHtml includes a row per province and the charts', () => {
  const html = renderArticleHtml(DATA);
  assert.match(html, /Barcelona/);
  assert.match(html, /Madrid/);
  assert.match(html, /38\.459/);
  assert.match(html, /id="bar"/);
  assert.match(html, /id="trend"/);
  assert.match(html, /barometro-empresarial\.csv/);
  assert.match(html, /href="\/app"/);
});

test('injectHead sets title, description and canonical', () => {
  const tpl = '<title>x</title><meta name="description" content="y"><link rel="canonical" id="canonical-link" href="z" />';
  const out = injectHead(tpl, { title: 'T', description: 'D', canonical: 'https://mapasocietario.es/es/barometro-empresarial/' });
  assert.match(out, /<title>T<\/title>/);
  assert.match(out, /content="D"/);
  assert.match(out, /href="https:\/\/mapasocietario\.es\/es\/barometro-empresarial\/"/);
});

test('injectHead escapes HTML-special characters in title, description and canonical', () => {
  const tpl = '<title>x</title><meta name="description" content="y"><link rel="canonical" href="z" />';
  const out = injectHead(tpl, { title: '<b>"t"</b>', description: '<i>d</i>', canonical: 'https://e.com/"><script>' });
  assert.match(out, /&lt;b&gt;/);
  assert.doesNotMatch(out, /<b>/);
  assert.doesNotMatch(out, /<script>/);
});
