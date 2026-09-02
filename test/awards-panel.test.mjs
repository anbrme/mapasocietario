import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

// Public-contracts panel (GET /bormes/<nif>/company-awards) wired into the
// /empresa page. Unlike the subsidies and trademarks expanders this one has no
// button: it loads on view and the section ships hidden, because the backend's
// panel:false answer decides whether the section may appear at all.
const base = { company_name: 'TEST CO SL', company_type: 'SL', province: 'Madrid' };
const render = (extra, lang = 'es') =>
  renderCompanyPage({ ...base, ...extra }, [], 'test-co-sl', null, lang);

const awardsSection = (html) => {
  const start = html.indexOf('id="awards-section"');
  assert.notEqual(start, -1, 'no awards section in the page');
  return html.slice(start, html.indexOf('</section>', start));
};

test('awards panel renders when the company has a NIF', () => {
  const html = render({ nif: 'A46103834' });
  assert.match(html, /id="awards-section"/);
  assert.match(html, /data-nif="A46103834"/);
  assert.match(html, /'\/bormes\/'\+encodeURIComponent\(/);
  assert.match(html, /\+'\/company-awards'/);
});

test('awards panel falls back to enriched_nif', () => {
  const html = render({ enriched_nif: 'B26056309' });
  assert.match(awardsSection(html), /data-nif="B26056309"/);
});

test('no NIF → no awards section at all', () => {
  const html = render({});
  assert.doesNotMatch(html, /id="awards-section"/);
  assert.doesNotMatch(html, /company-awards/);
});

test('the section ships hidden so nothing shows until the backend corroborates it', () => {
  const html = render({ nif: 'A46103834' });
  assert.match(html, /<section class="awards" id="awards-section" hidden>/);
});

test('section body is empty at SSR time (the counts come from the fetch)', () => {
  const html = render({ nif: 'A46103834' });
  assert.match(html, /<div id="awards-body"[^>]*><\/div>/);
});

test('the panel is labelled as this entity, not the group', () => {
  const section = awardsSection(render({ nif: 'A46103834' }));
  assert.match(section, /Recuento de la entidad con este NIF/);
  assert.match(section, /no se suman aquí/);

  const en = awardsSection(render({ nif: 'A46103834' }, 'en'));
  assert.match(en, /Counts for the entity holding this tax ID/);
  assert.match(en, /are not added here/);
});

test('English page uses English labels', () => {
  const section = awardsSection(render({ nif: 'A46103834' }, 'en'));
  assert.match(section, /Public procurement/);
  assert.match(section, /Contracts awarded/);
  assert.match(section, /Public buyers/);
});

test('the awards section never carries a monetary figure', () => {
  // The endpoint has no money field and must never grow one here: framework
  // ceilings reappear on their call-offs, so any euro total derived from these
  // records overstates by a wide margin. \b on EUR/amount because
  // encodeURIComponent contains the letters "eUR".
  for (const lang of ['es', 'en']) {
    const section = awardsSection(render({ nif: 'A46103834' }, lang));
    assert.doesNotMatch(section, /€|\bEUR\b|currency|NumberFormat|\bamount\b|importe/i);
  }
});

test('the single-bid share is framed as concentration, not wrongdoing', () => {
  assert.match(awardsSection(render({ nif: 'A46103834' })), /no implica irregularidad alguna/);
  assert.match(awardsSection(render({ nif: 'A46103834' }, 'en')), /does not imply any irregularity/);
});

test('data-nif attribute is HTML-escaped', () => {
  const section = awardsSection(render({ nif: 'A46"><img src=x>' }));
  assert.match(section, /data-nif="A46&quot;&gt;&lt;img src=x&gt;"/);
  assert.doesNotMatch(section, /data-nif="A46">/);
});
