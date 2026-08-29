import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

// A sole-shareholder declaration is a DATED filing, not a standing fact. The
// page rendered the bare name in the present tense, so a 2019 declaration read
// as current ownership in 2026 with nothing for the reader to judge it by —
// while the date sat unused in the payload the whole time.

const base = { company_name: 'TEST CO SL', company_type: 'SL', province: 'Madrid', is_unipersonal: true };
const render = (extra, lang = 'es') =>
  renderCompanyPage({ ...base, ...extra }, [], 'test-co-sl', null, lang);

test('a sole shareholder is dated to the declaration that recorded it', () => {
  const html = render({
    sole_shareholders: ['MIKELDI INVERSIONES SL'],
    sole_shareholder_declarations: [
      { date: '2019-06-24', is_individual: false, name: 'MIKELDI INVERSIONES SL' },
    ],
  });
  assert.match(html, /MIKELDI INVERSIONES SL/);
  assert.match(html, /24\/06\/2019/, 'the declaration date must be shown');
});

test('an owner renamed since being declared shows both names', () => {
  const html = render({
    sole_shareholders: ['GRUPO NUEVO SL'],
    sole_shareholders_resolved: [{
      declared_date: '2018-03-12',
      declared_name: 'ANTIGUA DENOMINACION SL',
      current_name: 'GRUPO NUEVO SL',
    }],
  });
  assert.match(html, /GRUPO NUEVO SL/);
  assert.match(html, /ANTIGUA DENOMINACION SL/, 'the declared name must stay traceable');
  assert.match(html, /12\/03\/2018/);
});

test('former sole shareholders are shown, not silently dropped', () => {
  const html = render({
    sole_shareholders: ['NUEVO SOCIO SL'],
    previous_sole_shareholders: ['SOCIO ANTERIOR SL'],
  });
  assert.match(html, /SOCIO ANTERIOR SL/, 'the page hid former owners the graph already showed');
});

test('individuals are dated too, not only companies', () => {
  const html = render({
    sole_shareholder_individuals: ['ANA GARCIA LOPEZ'],
    sole_shareholder_declarations: [
      { date: '2021-09-01', is_individual: true, name: 'ANA GARCIA LOPEZ' },
    ],
  });
  assert.match(html, /ANA GARCIA LOPEZ/);
  assert.match(html, /01\/09\/2021/);
});

test('the section says what BORME publishes, and what it does not', () => {
  const html = render({ sole_shareholders: ['X SL'] });
  assert.match(html, /accionariado completo/,
    'a reader must not mistake sole ownership for a share register');
});

test('an undated declaration renders the name without inventing a date', () => {
  const html = render({ sole_shareholders: ['SIN FECHA SL'] });
  assert.match(html, /SIN FECHA SL/);
  assert.doesNotMatch(html, /declarado el\s*<\/span>/);
});

test('a company that STOPPED being unipersonal still shows who owned it', () => {
  // The section keyed on a CURRENT owner existing, so the one case where a
  // former owner is the whole story — unipersonalidad lost — hid it entirely.
  const html = render({
    is_unipersonal: false,
    sole_shareholders: [],
    previous_sole_shareholders: ['SOCIO SALIENTE SL'],
  });
  assert.match(html, /SOCIO SALIENTE SL/);
});

test('a company with no owners renders no shareholder section at all', () => {
  const html = renderCompanyPage({ ...base, is_unipersonal: false }, [], 'test-co-sl', null, 'es');
  assert.doesNotMatch(html, /Estructura de socios/);
});
