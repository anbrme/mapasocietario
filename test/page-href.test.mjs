import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fullCompanyPageHref } from '../functions/empresa/_page_href.js';

test('curated company resolves to its /empresa path (es + en)', () => {
  assert.equal(fullCompanyPageHref('NURNBERG CONSULTING SL', 'es'), '/empresa/nurnberg-consulting-sl');
  assert.equal(fullCompanyPageHref('NURNBERG CONSULTING SL', 'en'), '/en/company/nurnberg-consulting-sl');
});

test('IBEX seed company resolves to its short seed slug via reverse lookup', () => {
  assert.equal(fullCompanyPageHref('ACCIONA SA', 'es'), '/empresa/acciona');
});

test('non-curated company now resolves to its name-slug path (universal)', () => {
  assert.equal(fullCompanyPageHref('Surya Consulting SL', 'es'), '/empresa/surya-consulting-sl');
  assert.equal(fullCompanyPageHref('Surya Consulting SL', 'en'), '/en/company/surya-consulting-sl');
});

test('empty/nullish name → null', () => {
  assert.equal(fullCompanyPageHref('', 'es'), null);
  assert.equal(fullCompanyPageHref(null, 'es'), null);
});
