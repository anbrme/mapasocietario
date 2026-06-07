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

test('parseCsv handles a quoted province field containing a comma', () => {
  const rows = parseCsv('province,year,month,form,count\n"Coruña, A",2025,1,SL,10\n');
  assert.equal(rows[0].province, 'Coruña, A');
  assert.equal(rows[0].year, 2025);
  assert.equal(rows[0].count, 10);
});

test('normProvince keeps official names (Girona/Lleida/Ourense), not anachronistic Castilian', () => {
  assert.equal(normProvince('Girona'), 'Girona');
  assert.equal(normProvince('Lleida'), 'Lleida');
  assert.equal(normProvince('Ourense'), 'Ourense');
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

import { sumByProvince, sumByForm, sumYears, sumCapital, buildNetRows } from '../scripts/barometro-lib.mjs';

const CONST = [
  { province: 'Madrid', year: 2025, month: 1, form: 'SL', count: 100, capital_subscribed: 9 },
  { province: 'Alacant / Alicante', year: 2025, month: 1, form: 'SL', count: 30, capital_subscribed: 1 },
  { province: 'Alicante / Alacant', year: 2025, month: 2, form: 'SA', count: 20, capital_subscribed: 1 },
  { province: 'Madrid', year: 2024, month: 1, form: 'SL', count: 80, capital_subscribed: 5 },
];
const EXTIN = [
  { province: 'Madrid', year: 2025, month: 1, form: 'SL', count: 40 },
  { province: 'Alacant / Alicante', year: 2025, month: 1, form: 'SL', count: 10 },
  { province: 'Madrid', year: 2024, month: 1, form: 'SL', count: 30 },
];

test('sumByProvince merges normalized provinces', () => {
  const m = sumByProvince(CONST, 2025);
  assert.equal(m.Madrid, 100);
  assert.equal(m.Alicante, 50);
});

test('sumByForm and sumCapital for a year', () => {
  assert.equal(sumByForm(CONST, 2025).SL, 130);
  assert.equal(sumCapital(CONST, 2025), 11);
});

test('sumYears returns ascending yearly totals', () => {
  assert.deepEqual(sumYears(CONST), [{ year: 2024, count: 80 }, { year: 2025, count: 150 }]);
});

test('buildNetRows computes net, prior-year net, YoY, sorted desc by net', () => {
  const rows = buildNetRows(sumByProvince(CONST, 2025), sumByProvince(EXTIN, 2025),
                            sumByProvince(CONST, 2024), sumByProvince(EXTIN, 2024));
  assert.equal(rows[0].province, 'Madrid');
  assert.equal(rows[0].const_, 100);
  assert.equal(rows[0].extin, 40);
  assert.equal(rows[0].net, 60);
  assert.equal(rows[0].netPrev, 50);
  assert.equal(Math.round(rows[0].pct), 20);
  assert.equal(rows[1].province, 'Alicante');
  assert.equal(rows[1].net, 40);
});

import { trendDualSvg, renderNetArticle, netCsv } from '../scripts/barometro-lib.mjs';

test('trendDualSvg renders two polylines', () => {
  const svg = trendDualSvg([{ year: 2024, count: 5 }, { year: 2025, count: 8 }],
                           [{ year: 2024, count: 2 }, { year: 2025, count: 3 }]);
  assert.equal((svg.match(/<polyline /g) || []).length, 2);
  assert.match(svg, /^<svg /);
});

test('netCsv has header + one row per province', () => {
  const csv = netCsv([{ province: 'Madrid', const_: 100, extin: 40, net: 60 }], 2025);
  assert.match(csv, /provincia,constituciones_2025,extinciones_2025,neto_2025/);
  assert.match(csv, /Madrid,100,40,60/);
});

test('renderNetArticle includes net hero, province net table, charts, source', () => {
  const d = {
    year: 2025, prevYear: 2024, nationalConst: 128871, nationalExtin: 34259,
    nationalNet: 94612, nationalNetPrev: 90000, netPct: 5.1, capital: 1234567,
    netRows: [{ province: 'Madrid', const_: 28899, extin: 8341, net: 20558, netPrev: 20000, pct: 2.8 }],
    typeRows: [{ type: 'SL', count: 127138, share: 98.7 }],
    barSvg: '<svg id="bar"></svg>', trendSvg: '<svg id="trend"></svg>',
  };
  const html = renderNetArticle(d);
  assert.match(html, /94\.612/);
  assert.match(html, /Madrid/);
  assert.match(html, /20\.558/);
  assert.match(html, /Registradores/);
  assert.match(html, /id="bar"/);
  assert.match(html, /barometro-empresarial\.csv/);
  assert.match(html, /href="\/app"/);
});
