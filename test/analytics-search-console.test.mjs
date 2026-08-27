import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  latestDateWithData,
  splitByArm,
  strikingDistance,
  totalsOf,
  weightedPosition,
} from '../workers/analytics/src/search-console.js';

const row = (page, clicks, impressions, position, ctr) => ({
  keys: [page], clicks, impressions, position,
  ctr: ctr ?? (impressions ? clicks / impressions : 0),
});

test('weightedPosition weights by impressions, not by row', () => {
  // A row seen 1000 times at position 3 must dominate one seen twice at 50.
  const rows = [row('a', 0, 1000, 3), row('b', 0, 2, 50)];
  assert.ok(weightedPosition(rows) < 3.2, 'a two-impression outlier must not move the average');
});

test('weightedPosition returns null, never 0, for an empty set', () => {
  // 0 is a real position value; returning it would read as "ranking first".
  assert.equal(weightedPosition([]), null);
  assert.equal(weightedPosition([row('a', 0, 0, 0)]), null);
});

test('totalsOf derives CTR from the summed rows, not by averaging CTRs', () => {
  const t = totalsOf([row('a', 1, 100, 5), row('b', 9, 100, 5)]);
  assert.equal(t.clicks, 10);
  assert.equal(t.impressions, 200);
  assert.equal(t.ctr, 0.05);
});

test('latestDateWithData skips the trailing empty days GSC always has', () => {
  const daily = [
    { keys: ['2026-08-24'], impressions: 100 },
    { keys: ['2026-08-25'], impressions: 120 },
    { keys: ['2026-08-26'], impressions: 0 },
    { keys: ['2026-08-27'], impressions: 0 },
  ];
  assert.equal(latestDateWithData(daily), '2026-08-25');
});

test('latestDateWithData returns null when the window is entirely empty', () => {
  assert.equal(latestDateWithData([{ keys: ['2026-08-26'], impressions: 0 }]), null);
  assert.equal(latestDateWithData([]), null);
});

test('splitByArm routes each page by the injected assignment', () => {
  const armOf = (slug) => (slug === 'sacyr' ? 'variant' : 'control');
  const out = splitByArm(
    [row('https://mapasocietario.es/empresa/sacyr', 5, 100, 8),
     row('https://mapasocietario.es/empresa/acciona', 1, 100, 8)],
    armOf,
  );
  assert.equal(out.variant.pages, 1);
  assert.equal(out.control.pages, 1);
  assert.equal(out.variant.ctr, 0.05);
  assert.equal(out.control.ctr, 0.01);
});

test('splitByArm ignores anything that is not a company page', () => {
  const out = splitByArm([row('https://mapasocietario.es/directorio/madrid', 9, 99, 4)],
                         () => 'variant');
  assert.equal(out.variant.pages, 0);
  assert.equal(out.control.pages, 0);
});

// The whole point of the md5 split is that both arms come from one population.
// Sweeping every unenrolled page into "control" would undo that silently and
// the report would show a comparison that means nothing.
test('splitByArm excludes pages that were never enrolled', () => {
  const armOf = (slug) => (slug === 'sacyr' ? 'variant' : slug === 'acciona' ? 'control' : null);
  const out = splitByArm([
    row('https://mapasocietario.es/empresa/sacyr', 5, 100, 8),
    row('https://mapasocietario.es/empresa/acciona', 2, 100, 8),
    row('https://mapasocietario.es/empresa/some-tiny-sl', 0, 900, 40),
    row('https://mapasocietario.es/empresa/another-sl', 0, 900, 40),
  ], armOf);
  assert.equal(out.variant.pages, 1);
  assert.equal(out.control.pages, 1);
  assert.equal(out.control.impressions, 100, 'long-tail impressions must not leak into control');
});

test('splitByArm decodes and lowercases the slug before assigning', () => {
  const seen = [];
  splitByArm([row('https://mapasocietario.es/empresa/Bodegas-Espa%C3%B1a-SL', 0, 1, 9)],
             (slug) => { seen.push(slug); return null; });
  assert.deepEqual(seen, ['bodegas-españa-sl']);
});

test('strikingDistance finds visible pages that are not being clicked', () => {
  const out = strikingDistance([
    row('https://mapasocietario.es/empresa/ikusi', 0, 125, 4.9),   // the case that started this
    row('https://mapasocietario.es/empresa/tiny', 0, 3, 5),         // too few impressions
    row('https://mapasocietario.es/empresa/page20', 0, 400, 20),    // nobody sees page 2
    row('https://mapasocietario.es/empresa/working', 40, 100, 5),   // already converting
  ]);
  assert.deepEqual(out.map((r) => r.page), ['/empresa/ikusi']);
});

test('strikingDistance reports the biggest prize first', () => {
  const out = strikingDistance([
    row('https://mapasocietario.es/empresa/small', 0, 30, 6),
    row('https://mapasocietario.es/empresa/big', 0, 300, 6),
  ]);
  assert.deepEqual(out.map((r) => r.page), ['/empresa/big', '/empresa/small']);
});
