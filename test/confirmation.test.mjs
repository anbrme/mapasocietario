import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmationStatus, nameIsOfficer, renderConfirmationBlock, confirmationViewModel } from '../functions/empresa/_confirmation.js';

const DAY = 86_400_000;
const at = (iso, days) => Date.parse(iso + 'T00:00:00Z') + days * DAY;

test('same-day confirmation is fresh, age 0', () => {
  const s = confirmationStatus('2026-06-28', at('2026-06-28', 0));
  assert.deepEqual(s, { ageDays: 0, level: 'fresh' });
});

test('90 days is still fresh, 91 days flips to aging', () => {
  assert.equal(confirmationStatus('2026-06-28', at('2026-06-28', 90)).level, 'fresh');
  assert.equal(confirmationStatus('2026-06-28', at('2026-06-28', 91)).level, 'aging');
});

test('365 days is aging, 366 days flips to stale', () => {
  assert.equal(confirmationStatus('2026-06-28', at('2026-06-28', 365)).level, 'aging');
  assert.equal(confirmationStatus('2026-06-28', at('2026-06-28', 366)).level, 'stale');
});

test('future or unparseable dates: never negative age; null on garbage', () => {
  assert.equal(confirmationStatus('2026-06-28', at('2026-06-28', -5)).ageDays, 0);
  assert.equal(confirmationStatus('not-a-date', Date.now()), null);
});

test('representative matches officer across order and accents', () => {
  assert.equal(nameIsOfficer('Alessandro Nürnberg', ['NURNBERG ALESSANDRO']), true);
});

test('representative is a subset of a longer officer name', () => {
  assert.equal(nameIsOfficer('Alessandro Nürnberg', ['NURNBERG ALESSANDRO GIOVANNI']), true);
});

test('non-officer and empty inputs do not match', () => {
  assert.equal(nameIsOfficer('María López', ['NURNBERG ALESSANDRO']), false);
  assert.equal(nameIsOfficer('', ['NURNBERG ALESSANDRO']), false);
  assert.equal(nameIsOfficer('Alessandro Nürnberg', []), false);
});

const REC = {
  confirmedAt: '2026-06-28',
  representative: 'Alessandro Nürnberg',
  role: 'Administrador único',
  affirms: [
    { label: 'Administrador único: Alessandro Nürnberg', status: 'current' },
    { label: 'Situación concursal', status: 'none' },
  ],
};

test('missing or invalid record renders nothing', () => {
  assert.equal(renderConfirmationBlock(null, 'es'), '');
  assert.equal(renderConfirmationBlock({ confirmedAt: 'x' }, 'es'), '');
  assert.equal(renderConfirmationBlock({ confirmedAt: 'x', representative: 'Bob' }, 'es'), '');
});

test('fresh ES panel names the representative and carries the disclaimer', () => {
  const html = renderConfirmationBlock(REC, 'es', at('2026-06-28', 3));
  assert.match(html, /cc cc-fresh/);
  assert.match(html, /Confirmación de vigencia/);
  assert.match(html, /Alessandro Nürnberg/);
  assert.match(html, /hace 3 días/);
  assert.match(html, /verifica la autoridad del representante/);
  assert.match(html, /cc-none/); // the "sin constancia" chip
});

test('stale panel uses the aged line, not the fresh "confirmed by" line', () => {
  const html = renderConfirmationBlock(REC, 'es', at('2026-06-28', 400));
  assert.match(html, /cc cc-stale/);
  assert.match(html, /Última confirmación hace 400 días/);
  assert.doesNotMatch(html, /Confirmado actual por/);
});

test('EN panel renders English chrome', () => {
  const html = renderConfirmationBlock(REC, 'en', at('2026-06-28', 1));
  assert.match(html, /Currency confirmation/);
  assert.match(html, /1 day ago/);
});

test('aging panel (100 days) uses cc-aging and the aged line', () => {
  const html = renderConfirmationBlock(REC, 'es', at('2026-06-28', 100));
  assert.match(html, /cc cc-aging/);
  assert.match(html, /Última confirmación hace 100 días/);
  assert.doesNotMatch(html, /Confirmado actual por/);
});

const VM_REC = {
  confirmedAt: '2026-06-28',
  representative: 'Alessandro Nürnberg',
  role: 'Administrador único',
  affirms: [
    { label: 'Administrador único: Alessandro Nürnberg', status: 'current' },
    { label: 'Situación concursal', status: 'none' },
  ],
};
const atMs = (iso, days) => Date.parse(iso + 'T00:00:00Z') + days * 86_400_000;

test('viewModel: missing/invalid record returns null', () => {
  assert.equal(confirmationViewModel(null, 'es'), null);
  assert.equal(confirmationViewModel({ confirmedAt: 'x', representative: 'Bob' }, 'es'), null);
});

test('viewModel: fresh ES has level, named status line, mapped facts, disclaimer', () => {
  const vm = confirmationViewModel(VM_REC, 'es', atMs('2026-06-28', 3));
  assert.equal(vm.level, 'fresh');
  assert.match(vm.statusLine, /Confirmado actual por Alessandro Nürnberg/);
  assert.match(vm.statusLine, /hace 3 días/);
  assert.equal(vm.title, 'Confirmación de vigencia');
  assert.equal(vm.facts.length, 2);
  assert.deepEqual(
    vm.facts.map((f) => f.status),
    ['current', 'none'],
  );
  assert.equal(vm.facts[1].chipLabel, 'sin constancia');
  assert.match(vm.asOf, /a fecha 28\/06\/2026/);
  assert.match(vm.disclaimer, /verifica la autoridad del representante/);
});

test('viewModel: stale uses the aged line and has no asOf when no facts', () => {
  const vm = confirmationViewModel(
    { confirmedAt: '2026-06-28', representative: 'X', affirms: [] },
    'es',
    atMs('2026-06-28', 400),
  );
  assert.equal(vm.level, 'stale');
  assert.match(vm.statusLine, /Última confirmación hace 400 días/);
  assert.equal(vm.asOf, null);
  assert.equal(vm.facts.length, 0);
});

test('viewModel: EN copy', () => {
  const vm = confirmationViewModel(VM_REC, 'en', atMs('2026-06-28', 1));
  assert.equal(vm.title, 'Currency confirmation');
  assert.match(vm.statusLine, /1 day ago/);
  assert.equal(vm.facts[0].chipLabel, 'current');
});

test('viewModel: verifiedVia maps email-tied method to ES copy', () => {
  const vm = confirmationViewModel(
    { confirmedAt: '2026-06-28', representative: 'X', verification: 'email-from-tied-address', affirms: [] },
    'es',
    atMs('2026-06-28', 1),
  );
  assert.equal(vm.verifiedVia, 'Verificado por confirmación desde el email de la empresa');
});

test('viewModel: verifiedVia maps registry method and translates to EN', () => {
  const vm = confirmationViewModel(
    { confirmedAt: '2026-06-28', representative: 'X', verification: 'registry-officer-match', affirms: [] },
    'en',
    atMs('2026-06-28', 1),
  );
  assert.equal(vm.verifiedVia, 'Authority verified against the public registry');
});

test('viewModel: verifiedVia is null for missing or unknown method', () => {
  const base = { confirmedAt: '2026-06-28', representative: 'X', affirms: [] };
  assert.equal(confirmationViewModel(base, 'es', atMs('2026-06-28', 1)).verifiedVia, null);
  assert.equal(
    confirmationViewModel({ ...base, verification: 'something-else' }, 'es', atMs('2026-06-28', 1)).verifiedVia,
    null,
  );
});
