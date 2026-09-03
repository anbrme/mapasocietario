import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

// Click-to-load public-subsidies expander (SNPSAP by NIF). Pull-not-push: the
// section exists only when the company has a NIF and fetches nothing until the
// button is clicked (inline script, progressive enhancement).
const base = { company_name: 'TEST CO SL', company_type: 'SL', province: 'Madrid' };
const render = (extra, lang = 'es') =>
  renderCompanyPage({ ...base, ...extra }, [], 'test-co-sl', null, lang);

test('subsidies expander renders when the company has a BORME NIF', () => {
  const html = render({ nif: 'A46103834' });
  assert.match(html, /id="subs-section"/);
  assert.match(html, /data-nif="A46103834"/);
  assert.match(html, /Ver subvenciones públicas/);
  assert.match(html, /subsidies-by-nif/); // inline script targets the endpoint
});

test('subsidies expander falls back to enriched_nif', () => {
  const html = render({ enriched_nif: 'B26056309' });
  assert.match(html, /data-nif="B26056309"/);
});

test('no NIF → no subsidies section at all', () => {
  const html = render({});
  assert.doesNotMatch(html, /id="subs-section"/);
  assert.doesNotMatch(html, /subsidies-by-nif/);
});

test('English page uses English labels', () => {
  const html = render({ nif: 'A46103834' }, 'en');
  assert.match(html, /View public subsidies/);
});

test('section body is empty at SSR time (nothing eager-loaded)', () => {
  const html = render({ nif: 'A46103834' });
  assert.match(html, /<div id="subs-body"[^>]*><\/div>/);
});

test('data-nif attribute is HTML-escaped', () => {
  const html = render({ nif: 'A46"><img src=x>' });
  assert.match(html, /data-nif="A46&quot;&gt;&lt;img src=x&gt;"/);
  assert.doesNotMatch(html, /data-nif="A46">/);
});

test('an uncorroborated NIF hides the section instead of erroring', () => {
  // The backend gained a corroboration gate: when the beneficiary SNPSAP names
  // for a NIF is not this company, it answers {success:true, panel:false} and
  // deliberately sends no counts. Two things must hold.
  //
  // 1. The handler must branch on panel===false BEFORE render(), which reads
  //    j.concessions -- undefined on a decline, so it throws into catch(fail)
  //    and shows "could not load" for a query that worked perfectly.
  // 2. It must HIDE rather than show the empty state. "We could not vouch for
  //    this binding" and "this company received no subsidies" are different
  //    statements, and only hiding declines to make the second one.
  const html = render({ nif: 'A46103834' });
  // Scope to the subsidies handler: other panels emit their own render(j).
  const handler = html.slice(html.indexOf('subsidies-by-nif'));
  const guard = handler.indexOf('j.panel===false');
  assert.ok(guard > -1, 'the subsidies handler must branch on panel===false');
  assert.ok(guard < handler.indexOf('render(j)'),
    'the panel===false guard must precede render(j)');
  assert.match(handler.slice(guard, guard + 120), /subs-section'\)\.hidden=true/);
});

// The subsidies section only. Scoped from the section id up to the fetch call,
// because `subsidies-by-nif` is the LAST thing in the block -- slicing from it
// cuts off the rendering code, and other panels emit their own render(j).
const subsSection = (html) =>
  html.slice(html.indexOf('id="subs-section"'), html.indexOf('subsidies-by-nif'));

test('the programme link points at the convocatoria, never at the bases reguladoras', () => {
  // The bug: every award linked at SNPSAP's urlBR, the scheme's enabling
  // regulation. It is identical for every beneficiary of the scheme and names
  // none of them, so a reader following it from a Mercadona row landed on
  // Real Decreto 147/2019 and found no Mercadona. The convocatoria page does
  // list the beneficiaries.
  const handler = subsSection(render({ nif: 'A46103834' }));
  assert.match(handler, /c\.convocatoria_url/);
  assert.doesNotMatch(handler, /a\.href=c\.source_url/,
    'the row title must not be linked at the bases reguladoras');
  // Last hop before the DOM decides where a reader goes (same rule as _awards.js).
  assert.match(handler, /infosubvenciones\\?\.es/,
    'the outbound href must be origin-checked at render time');
});

test('the bases reguladoras stay reachable, but labelled as the regulation', () => {
  const html = render({ nif: 'A46103834' });
  const handler = subsSection(html);
  assert.match(handler, /c\.rules_url/, 'the regulation link must not simply be dropped');
  assert.match(html, /Bases reguladoras/);
  const en = render({ nif: 'A46103834' }, 'en');
  assert.match(en, /Scheme rules/);
});

test('the total says how many awards it actually sums when the page cap bit', () => {
  // The panel summed the 20 rows it fetched and printed the figure beneath the
  // register's full count -- Mercadona read "€32,804,904 · 23 awards in total".
  // The backend now walks the pages and reports amount_covers; a partial sum
  // must never be presented as the whole.
  const html = render({ nif: 'A46103834' });
  const handler = subsSection(html);
  assert.match(handler, /j\.amount_covers/);
  assert.match(html, /Total de las \{0\} concesiones sumadas/);
  const en = render({ nif: 'A46103834' }, 'en');
  assert.match(en, /Total of the \{0\} awards summed/);
  assert.doesNotMatch(en, /Total of the awards shown/,
    'the sum now covers every award fetched, not merely the rows on screen');
});
