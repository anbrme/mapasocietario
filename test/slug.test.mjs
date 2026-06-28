import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToSlug } from '../functions/empresa/_slug.js';

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
