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
