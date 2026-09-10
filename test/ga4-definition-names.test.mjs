import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { safeDesc, safeName } from '../scripts/ga4-definition-names.mjs';

// GA4 rejects the WHOLE createCustomDimension request when either field is out
// of bounds, so a single over-long description fails an entire tier. These are
// the two limits that have actually bitten: the displayName charset and the
// 150-character description cap.

test('safeName keeps a name that is already valid', () => {
  assert.equal(safeName('Furthest checkout stage'), 'Furthest checkout stage');
});

test('safeName replaces characters GA4 rejects, hyphen included', () => {
  assert.equal(safeName('Free-report flag'), 'Free report flag');
  assert.equal(safeName('CTA (empresa): clicked'), 'CTA empresa clicked');
});

test('safeName keeps underscores and digits', () => {
  assert.equal(safeName('toolbar_action v2'), 'toolbar_action v2');
});

test('safeName collapses the whitespace its own substitution creates', () => {
  assert.equal(safeName('a -- b'), 'a b');
  assert.equal(safeName('  padded  '), 'padded');
});

test('safeDesc passes a description within the cap through untouched', () => {
  const short = 'Which toolbar control was used.';
  assert.equal(safeDesc(short), short);
});

test('safeDesc truncates an over-long description to at most 150 characters', () => {
  const long = 'Whether the checkout was a waived free report or a paid one. '
    + 'Without it a checkout_redirect with no purchase cannot be told from lost '
    + 'revenue — the exact ambiguity that made three consecutive reports unreadable.';
  assert.ok(long.length > 150, 'fixture must exceed the cap');

  const out = safeDesc(long);

  assert.ok(out.length <= 150, `expected <= 150, got ${out.length}`);
  assert.ok(long.startsWith(out.replace(/…$/, '').trimEnd()), 'must be a prefix of the original');
});

test('safeDesc marks a truncated description and does not cut mid-word', () => {
  const out = safeDesc('word '.repeat(60));
  assert.ok(out.endsWith('…'), 'truncation should be visible in the GA4 UI');
  assert.ok(!/\bwor…$/.test(out), 'should not sever a word');
});

test('safeDesc tolerates a missing description', () => {
  assert.equal(safeDesc(undefined), '');
  assert.equal(safeDesc(''), '');
});
