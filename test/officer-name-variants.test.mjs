import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldVariantSeats, isSpellingVariant } from '../src/utils/officerNameVariants.js';

// SANTANDER BACK-OFFICES GLOBALES MAYORISTAS SA: the chairman was appointed as
// "HAJJAJI ABDELKRIM" (2016, re-elected 2021) and ceased on 2026-06-02 as
// "HAJJAJI ABDEL KARIM". The aggregation matches seats by exact name, so the
// doc kept him active AND recorded a cese for a spelling that was never
// appointed. Within one company, one seat, a cese under a near-identical
// spelling that never had an appointment of its own is that person's cese.
const doc = {
  last_seen: '2026-08-18',
  officers_active: [
    { name: 'HAJJAJI ABDELKRIM', position_normalized: 'CONSEJERO', appointed_date: '2021-11-30', status: 'active' },
    { name: 'HAJJAJI ABDELKRIM', position_normalized: 'PRESIDENTE', appointed_date: '2021-11-30', status: 'active' },
    { name: 'GARCIA LOPEZ GABRIEL JOSE', position_normalized: 'APODERADO', appointed_date: '2009-05-26', status: 'active' },
  ],
  officers_resigned: [
    { name: 'HAJJAJI ABDEL KARIM', position_normalized: 'CONSEJERO', resigned_date: '2026-06-02', status: 'resigned' },
    { name: 'HAJJAJI ABDEL KARIM', position_normalized: 'PRESIDENTE', resigned_date: '2026-06-02', status: 'resigned' },
    { name: 'FONSECA VIADER JAVIER', position_normalized: 'CONSEJERO', resigned_date: '2026-08-18', status: 'resigned' },
  ],
};

const events = [
  { event_date: '2026-06-02', officers: [
    { name: 'HAJJAJI ABDEL KARIM', position_normalized: 'CONSEJERO', event_type: 'Ceses/Dimisiones' },
    { name: 'HAJJAJI ABDEL KARIM', position_normalized: 'PRESIDENTE', event_type: 'Ceses/Dimisiones' },
  ] },
  { event_date: '2021-11-30', officers: [
    { name: 'HAJJAJI ABDELKRIM', position_normalized: 'CONSEJERO', event_type: 'Reelecciones' },
    { name: 'HAJJAJI ABDELKRIM', position_normalized: 'PRESIDENTE', event_type: 'Reelecciones' },
  ] },
];

test('a spelling variant is the same surname block with a one-letter transliteration difference', () => {
  assert.equal(isSpellingVariant('HAJJAJI ABDELKRIM', 'HAJJAJI ABDEL KARIM'), true);
  assert.equal(isSpellingVariant('HAJJAJI ABDELKRIM', 'HAJJAJI ABDELKRIM'), false, 'identical is not a variant');
  assert.equal(isSpellingVariant('GARCIA LOPEZ JUAN', 'GARCIA LOPEZ JUANA'), true);
  assert.equal(isSpellingVariant('GARCIA LOPEZ JUAN', 'LOPEZ GARCIA JUAN'), false, 'different leading surname');
  assert.equal(isSpellingVariant('PEREZ ANA', 'PEREZ ANNA'), false, 'too short to trust a one-letter edit');
  assert.equal(isSpellingVariant('FONSECA VIADER JAVIER', 'FONSECA VIADER JAVIERA MARIA'), false);
});

test('the cese printed under the variant closes the seat, keeping the appointment spelling', () => {
  const folded = foldVariantSeats(doc, events);
  const names = folded.officers_active.map((o) => o.name);
  assert.deepEqual(names, ['GARCIA LOPEZ GABRIEL JOSE']);
  const hajjaji = folded.officers_resigned.filter((o) => o.name === 'HAJJAJI ABDELKRIM');
  assert.equal(hajjaji.length, 2);
  assert.deepEqual(hajjaji.map((o) => o.position_normalized).sort(), ['CONSEJERO', 'PRESIDENTE']);
  assert.ok(hajjaji.every((o) => o.resigned_date === '2026-06-02' && o.status === 'resigned' && o.ceased_as === 'HAJJAJI ABDEL KARIM'));
});

test('the orphan cese rows are absorbed, not duplicated', () => {
  const folded = foldVariantSeats(doc, events);
  assert.equal(folded.officers_resigned.filter((o) => o.name === 'HAJJAJI ABDEL KARIM').length, 0);
  assert.equal(folded.officers_resigned.length, 3);
  assert.equal(folded.variantSeatsFolded, 2);
});

test('a spelling that was itself appointed is a different person: nothing folds', () => {
  const withAppointment = [
    ...events,
    { event_date: '2019-02-08', officers: [
      { name: 'HAJJAJI ABDEL KARIM', position_normalized: 'CONSEJERO', event_type: 'Nombramientos' },
    ] },
  ];
  const folded = foldVariantSeats(doc, withAppointment);
  assert.equal(folded.officers_active.filter((o) => o.name === 'HAJJAJI ABDELKRIM' && o.position_normalized === 'CONSEJERO').length, 1);
});

test('a cese dated before the appointment cannot close it', () => {
  const early = {
    ...doc,
    officers_resigned: [{ name: 'HAJJAJI ABDEL KARIM', position_normalized: 'CONSEJERO', resigned_date: '2015-01-01', status: 'resigned' }],
  };
  const folded = foldVariantSeats(early, []);
  assert.equal(folded.officers_active.length, 3);
});

test('a variant that could belong to two different active officers is left alone', () => {
  const ambiguous = {
    officers_active: [
      { name: 'GARCIA LOPEZ JUAN CARLOS', position_normalized: 'CONSEJERO', appointed_date: '2020-01-01', status: 'active' },
      { name: 'GARCIA LOPEZ JUAN CARLO', position_normalized: 'CONSEJERO', appointed_date: '2020-01-01', status: 'active' },
    ],
    officers_resigned: [
      { name: 'GARCIA LOPEZ JUAN CARLOZ', position_normalized: 'CONSEJERO', resigned_date: '2021-01-01', status: 'resigned' },
    ],
  };
  const folded = foldVariantSeats(ambiguous, []);
  assert.equal(folded.officers_active.length, 2);
});

test('the input doc is never mutated and an untouched doc comes back as-is', () => {
  const snapshot = JSON.stringify(doc);
  foldVariantSeats(doc, events);
  assert.equal(JSON.stringify(doc), snapshot);
  const plain = { officers_active: doc.officers_active.slice(2), officers_resigned: doc.officers_resigned.slice(2) };
  assert.equal(foldVariantSeats(plain, events), plain);
});
