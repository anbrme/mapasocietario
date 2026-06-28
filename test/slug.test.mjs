import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToSlug, pickSlugMatch } from '../functions/empresa/_slug.js';

test('uppercase company name maps to the curated slug', () => {
  assert.equal(nameToSlug('NURNBERG CONSULTING SL'), 'nurnberg-consulting-sl');
});

test('accents and ñ are folded', () => {
  assert.equal(nameToSlug('Construcciones Peña S.A.'), 'construcciones-pena-s-a');
});

test('ampersand becomes y; runs of separators collapse', () => {
  assert.equal(nameToSlug('A & B   SL'), 'a-y-b-sl');
});

test('empty/nullish input is the empty string', () => {
  assert.equal(nameToSlug(''), '');
  assert.equal(nameToSlug(null), '');
});

// pickSlugMatch: the round-trip guard applied to fuzzy search hits — returns the
// company_name whose slug EXACTLY equals the requested slug, else null. This is
// what rescues lossy-slug companies (& → "y", ñ → "n") whose exact name lookup
// missed: search tokenizes past the substitution, this picks the exact match.
test('pickSlugMatch returns the hit whose slug round-trips to the requested slug', () => {
  const hits = [
    { company_name: 'MITCHELL SA' },
    { company_name: 'CONSULTORIA MUÑOZ MITCHELL SL' }, // ñ → n
    { company_name: 'NIELSEN & MITCHELL SL' },          // & → y
  ];
  assert.equal(pickSlugMatch('consultoria-munoz-mitchell-sl', hits), 'CONSULTORIA MUÑOZ MITCHELL SL');
  assert.equal(pickSlugMatch('nielsen-y-mitchell-sl', hits), 'NIELSEN & MITCHELL SL');
});

test('pickSlugMatch returns null when no hit round-trips', () => {
  assert.equal(pickSlugMatch('something-else-sl', [{ company_name: 'MITCHELL SA' }]), null);
  assert.equal(pickSlugMatch('x-sl', []), null);
  assert.equal(pickSlugMatch('x-sl', null), null);
});

test('pickSlugMatch falls back to company_name_normalized', () => {
  assert.equal(pickSlugMatch('foo-sl', [{ company_name_normalized: 'FOO SL' }]), 'FOO SL');
});
