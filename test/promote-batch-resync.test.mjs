import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resyncVerdict } from '../scripts/promote-batch-lib.mjs';

// `/empresa` resolves a company BY NAME, not by the stored group_key, so a
// group_key that 404s does not mean the page is dead. Two promoted rows prove
// it: compania-trasmediterranea-sa (H:M-45359) and map-beach-gestion-sl
// (H:IB-10174) 404 on group_key yet serve HTTP 200 `index, follow`. The resync
// demoted on that signal, which would pull a healthy indexed page out of the
// sitemap — caught by hand on 2026-09-07 and again on 2026-09-19.

test('a group_key 404 whose name still resolves is drift, never a demotion', () => {
  assert.equal(resyncVerdict('not_found', 'yes'), 'drift');
});

test('an inconclusive name check must not demote either', () => {
  // The name lookup itself failing is no evidence the company is gone; same
  // principle as never demoting on a throttle.
  assert.equal(resyncVerdict('not_found', 'unknown'), 'drift');
});

test('a group_key 404 whose name does NOT resolve is a real demotion', () => {
  assert.equal(resyncVerdict('not_found', 'no'), 'demote');
});

test('api_error always keeps the row untouched', () => {
  for (const verdict of ['yes', 'no', 'unknown']) {
    assert.equal(resyncVerdict('api_error', verdict), 'keep');
  }
});

test('a healthy row is kept', () => {
  assert.equal(resyncVerdict(null, 'yes'), 'keep');
  assert.equal(resyncVerdict(undefined, 'unknown'), 'keep');
});

test('other rejection reasons still demote', () => {
  // key_mismatch / no_name / gate_failed_live are positive evidence about the
  // entity, unlike a bare group_key miss.
  assert.equal(resyncVerdict('key_mismatch', 'yes'), 'demote');
  assert.equal(resyncVerdict('no_name', 'unknown'), 'demote');
});

test('a missing name verdict is treated as inconclusive, not as gone', () => {
  assert.equal(resyncVerdict('not_found', undefined), 'drift');
});
