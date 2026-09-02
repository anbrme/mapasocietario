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
