/**
 * The /empresa attestation panel. It now renders a REAL attestation read from
 * VERIFY_DB rather than the hand-authored map it replaces, so these tests cover
 * the wording constraints rather than the old record shape.
 *
 * nameIsOfficer moved to src/verify/seat.js as matchSeat, which binds to an
 * officer ROW and rejects the subset match this file used to assert.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  confirmationStatus, renderConfirmationBlock, confirmationViewModel,
} from '../functions/empresa/_confirmation.js';

const NOW = Date.parse('2026-09-09T00:00:00Z');
const att = (o = {}) => ({
  id: 'att_x', status: 'live',
  representative: { name: 'NURNBERG ALESSANDRO', position: 'ADM. UNICO' },
  accepted_at: '2026-09-08T21:37:16Z',
  reviewer: 'Alessandro Nürnberg', reviewed_at: '2026-09-08T21:38:00Z',
  last_verified_at: '2026-09-08T21:37:16Z',
  facts: [], history: [], ...o,
});

test('same-day acceptance is fresh, age 0', () => {
  const s = confirmationStatus('2026-09-09T00:00:00Z', NOW);
  assert.equal(s.ageDays, 0);
  assert.equal(s.level, 'fresh');
});

test('90 days is fresh, 91 flips to aging, 181 to stale', () => {
  const at = (d) => confirmationStatus(new Date(NOW - d * 86400000).toISOString(), NOW).level;
  assert.equal(at(90), 'fresh');
  assert.equal(at(91), 'aging');
  assert.equal(at(180), 'aging');
  assert.equal(at(181), 'stale');
});

test('future or unparseable timestamps: never negative, null on garbage', () => {
  assert.equal(confirmationStatus('2027-01-01T00:00:00Z', NOW).ageDays, 0);
  assert.equal(confirmationStatus('not a date', NOW), null);
});

test('nothing renders without an attestation', () => {
  for (const bad of [null, undefined, {}, { accepted_at: '2026-09-08T00:00:00Z' }]) {
    assert.equal(renderConfirmationBlock(bad, 'es', { nowMs: NOW }), '');
    assert.equal(confirmationViewModel(bad, 'es', { nowMs: NOW }), null);
  }
});

test('the panel names the representative, the reviewer and the disclaimer', () => {
  const html = renderConfirmationBlock(att(), 'es', { nowMs: NOW });
  assert.match(html, /NURNBERG ALESSANDRO/);
  assert.match(html, /ADM\. UNICO/);
  assert.match(html, /Autoridad revisada por Alessandro Nürnberg/);
  assert.match(html, /No verifica su identidad ni certifica que la declaración sea cierta/);
});

test('the panel never claims identity, truth, or a live check', () => {
  // The map this replaces said "La empresa confirma" on the strength of a name
  // matching an officer row. These are the phrasings that overstate.
  for (const lang of ['es', 'en']) {
    for (const status of ['live', 'outdated']) {
      const html = renderConfirmationBlock(att({ status }), lang, { nowMs: NOW }).toLowerCase();
      for (const phrase of ['identidad verificada', 'identity verified', 'la empresa confirma',
                            'era exacta', 'was accurate', 'as of right now', 'inmutable',
                            'immutable']) {
        assert.ok(!html.includes(phrase), `${lang}/${status} must not say "${phrase}"`);
      }
    }
  }
});

test('an outdated attestation is titled and styled as superseded, not as a failure', () => {
  const vm = confirmationViewModel(att({ status: 'outdated',
    status_reason: 'Se registró un cambio de domicilio el 20 de septiembre.' }), 'es', { nowMs: NOW });
  assert.equal(vm.level, 'stale');
  assert.match(vm.title, /superada/i);
  const detail = vm.detail.join(' ');
  assert.match(detail, /ya no debe considerarse vigente/);
  assert.doesNotMatch(detail, /exacta|falsa|incorrecta/i);
});

test('the status line names the last SUCCESSFUL check, never "right now"', () => {
  assert.match(confirmationViewModel(att(), 'es', { nowMs: NOW }).detail.join(' '),
    /Última comprobación con éxito: 2026-09-08/);
  assert.match(confirmationViewModel(att({ last_verified_at: null }), 'es', { nowMs: NOW }).detail.join(' '),
    /no se ha comprobado desde su publicación/i);
});

test('EN renders English chrome', () => {
  const html = renderConfirmationBlock(att(), 'en', { nowMs: NOW });
  assert.match(html, /Currency confirmation/);
  assert.match(html, /Authority reviewed by/);
  assert.match(html, /does not certify that the statement is true/);
});

test('values are escaped rather than trusted', () => {
  const html = renderConfirmationBlock(
    att({ reviewer: '<script>alert(1)</script>' }), 'es', { nowMs: NOW });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;/);
});

test('the third argument is an options object, and says so when it is not', () => {
  // Guards the exact mistake that turned this suite red: the signature changed
  // from a bare nowMs to { nowMs, registryLastSeen }, and a number would have
  // destructured to defaults rather than failing.
  assert.throws(() => confirmationViewModel(att(), 'es', NOW), TypeError);
});

test('the claim leads with the company as its subject, and the gap is optional', () => {
  const vm = confirmationViewModel(att(), 'es', { nowMs: NOW });
  assert.match(vm.claim, /^La empresa confirmó el 2026-09-08/);
  assert.equal(vm.gap, null);

  const withGap = confirmationViewModel(att(), 'es', { nowMs: NOW, registryLastSeen: '2014-03-27' });
  assert.match(withGap.gap, /Última publicación en el BORME: 2014-03-27 — 12 años/);
});
