import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

// BORME states both halves of a capital move in one sentence — the amount and
// the capital left standing — so the published figure is checkable against the
// gazette's own arithmetic. MAIER NAVARRA SL was gazetted as reducing capital
// by EUR 700.872,80 and being left with EUR 6.231.559.999,99: a reduction of
// 0.011% of the result, which no company files. That figure reached the meta
// description, so Google showed a EUR 6.2bn claim about an ordinary Navarrese
// SL over our byline.

const base = { company_name: 'TEST CO SL', company_type: 'SL', province: 'Navarra' };
const capitalEvent = (entry) => ({
  event_date: '2009-02-03', has_capital_change: true, full_entry: entry,
  event_types: [{ category: 'capital', type: 'Reducción de capital' }],
});
const metaDescription = (html) =>
  (/<meta name="description" content="([^"]*)"/.exec(html) || [, ''])[1];

test('a capital its own filing contradicts is withheld from the snippet', () => {
  const html = renderCompanyPage(
    { ...base, current_capital: 6231559999.99 },
    [capitalEvent('Reducción de capital. Importe reducción: 700.872,80 Euros. '
      + 'Resultante Suscrito: 6.231.559.999,99 Euros.')],
    'test-co-sl', null, 'es');
  const desc = metaDescription(html);
  assert.ok(desc, 'expected a meta description');
  assert.doesNotMatch(desc, /6\.231\.560\.000|6\.231\.559/,
    `the incoherent capital reached the snippet: ${desc}`);
});

test('a nominal-value redenomination is real data and stays published', () => {
  // TESTA RESIDENCIAL SOCIMI SA genuinely moved EUR 0,57 against EUR 132m to
  // make the share nominal divide cleanly. Suppressing on magnitude alone
  // would delete good figures like this one.
  const html = renderCompanyPage(
    { ...base, current_capital: 132270202 },
    [capitalEvent('Reducción de capital. Importe reducción: 0,57 Euros. '
      + 'Resultante Suscrito: 132.270.202,00 Euros.')],
    'test-co-sl', null, 'es');
  assert.match(metaDescription(html), /132\.270\.202/);
});

test('a substantial reduction that moves a real share stays published', () => {
  // 15.458,04 against 7.729.020,00 is 0.2% — small, but an ordinary filing.
  const html = renderCompanyPage(
    { ...base, current_capital: 7729020 },
    [capitalEvent('Reducción de capital. Importe reducción: 15.458,04 Euros. '
      + 'Resultante Suscrito: 7.729.020,00 Euros.')],
    'test-co-sl', null, 'es');
  assert.match(metaDescription(html), /7\.729\.020/);
});

test('only the filing that set the current capital can condemn it', () => {
  // An older incoherent entry says nothing about a capital a later filing replaced.
  const html = renderCompanyPage(
    { ...base, current_capital: 60000 },
    [capitalEvent('Reducción de capital. Importe reducción: 700.872,80 Euros. '
      + 'Resultante Suscrito: 6.231.559.999,99 Euros.')],
    'test-co-sl', null, 'es');
  assert.match(metaDescription(html), /60\.000/);
});

test('a capital with no checkable filing behind it is unaffected', () => {
  const html = renderCompanyPage(
    { ...base, current_capital: 3000000 }, [], 'test-co-sl', null, 'es');
  assert.match(metaDescription(html), /3\.000\.000/);
});
