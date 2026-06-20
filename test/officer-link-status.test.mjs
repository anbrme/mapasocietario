import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isActiveCategory,
  effectiveCategoryFromEvents,
} from '../src/utils/officerLinkStatus.js';

test('isActiveCategory: appointments and re-elections are active, ceses/revocations are not', () => {
  assert.equal(isActiveCategory('nombramientos'), true);
  assert.equal(isActiveCategory('reelecciones'), true);
  assert.equal(isActiveCategory('ceses_dimisiones'), false);
  assert.equal(isActiveCategory('revocaciones'), false);
  assert.equal(isActiveCategory(''), false);
});

test('effectiveCategoryFromEvents: empty/absent events fall back to build-time category', () => {
  assert.equal(effectiveCategoryFromEvents([], 'nombramientos'), 'nombramientos');
  assert.equal(effectiveCategoryFromEvents(undefined, 'ceses_dimisiones'), 'ceses_dimisiones');
});

test('effectiveCategoryFromEvents: later event wins (apoderado revoked after appointment → ceased)', () => {
  // AGENCIA EUROPA PRESS SA, APODERADO seat: appointed 2025-07-08, revoked
  // 2026-02-17. The revocation is later, so the seat is ceased.
  const events = [
    { category: 'nombramientos', date: '2025-07-08', position: 'APO.MANC.' },
    { category: 'revocaciones', date: '2026-02-17', position: 'APODERADO' },
  ];
  assert.equal(effectiveCategoryFromEvents(events, 'ceses_dimisiones'), 'revocaciones');
});

test('effectiveCategoryFromEvents: same-day board renewal keeps the seat active', () => {
  // Regression: AGENCIA EUROPA PRESS SA, CONSEJERO seat. On 2025-07-08 the board
  // was renewed — the registry recorded BOTH a cese and a re-appointment of the
  // same CONSEJERO on the same date. The officer ends up active, so on a same-date
  // tie the appointment must outrank the cessation (else the seat flips to ceased
  // and the company vanishes under an active-only filter).
  const events = [
    { category: 'ceses_dimisiones', date: '2025-07-08', position: 'CONSEJERO' },
    { category: 'nombramientos', date: '2025-07-08', position: 'CONSEJERO' },
    { category: 'ceses_dimisiones', date: '2025-03-07', position: 'CONSEJERO' },
  ];
  assert.equal(effectiveCategoryFromEvents(events, 'nombramientos'), 'nombramientos');
  assert.equal(isActiveCategory(effectiveCategoryFromEvents(events, 'nombramientos')), true);
});

test('effectiveCategoryFromEvents: tie order is independent of input order', () => {
  const a = [
    { category: 'nombramientos', date: '2025-07-08' },
    { category: 'ceses_dimisiones', date: '2025-07-08' },
  ];
  const b = [
    { category: 'ceses_dimisiones', date: '2025-07-08' },
    { category: 'nombramientos', date: '2025-07-08' },
  ];
  assert.equal(effectiveCategoryFromEvents(a, 'x'), 'nombramientos');
  assert.equal(effectiveCategoryFromEvents(b, 'x'), 'nombramientos');
});
