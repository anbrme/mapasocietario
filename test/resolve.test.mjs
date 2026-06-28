import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSlug } from '../functions/empresa/_resolve.js';

test('seed slug resolves as seed with its v3Name', () => {
  const r = resolveSlug('acciona');
  assert.equal(r.kind, 'seed');
  assert.equal(r.entry.v3Name, 'ACCIONA SA');
});

test('curated slug resolves as curated', () => {
  const r = resolveSlug('aldesa-agrupacion-empresarial-sa');
  assert.equal(r.kind, 'curated');
  assert.equal(r.entry.v3Name, 'ALDESA AGRUPACION EMPRESARIAL SA');
});

test('unknown slug resolves as notfound with null entry', () => {
  const r = resolveSlug('this-company-does-not-exist-xyz');
  assert.equal(r.kind, 'notfound');
  assert.equal(r.entry, null);
});

test('resolution is case-insensitive', () => {
  assert.equal(resolveSlug('ACCIONA').kind, 'seed');
});

test('nurnberg consulting resolves as curated with its v3Name', () => {
  const r = resolveSlug('nurnberg-consulting-sl');
  assert.equal(r.kind, 'curated');
  assert.equal(r.entry.v3Name, 'NURNBERG CONSULTING SL');
});
