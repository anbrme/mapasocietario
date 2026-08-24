import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

// SANTANDER BACK-OFFICES GLOBALES MAYORISTAS SA, extinguished by merger on
// 2026-08-18. BORME inscribed ceses for the board that day but — as always on an
// extinción — none for the 46 apoderados, the auditor, or a chairman whose cese
// had been printed under a variant spelling. The aggregated doc therefore still
// holds 49 `officers_active`, and the page printed them under "Current directors
// & officers" for a company it had just badged "Dissolved". The graph already
// applies the rule the registry implies: a dissolved company has no current
// officers (SpanishCompanyNetworkGraph getOfficerLinkStatus). The page must
// say the same thing.
const dissolvedCompany = {
  company_name: 'SANTANDER BACK-OFFICES GLOBALES MAYORISTAS SA',
  company_type: 'SA',
  province: 'Madrid',
  is_dissolved: true,
  last_seen: '2026-08-18',
  officers_active: [
    { name: 'HAJJAJI ABDELKRIM', position_normalized: 'PRESIDENTE', appointed_date: '2021-11-30', status: 'active' },
    { name: 'GARCIA LOPEZ GABRIEL JOSE', position_normalized: 'APODERADO', appointed_date: '2009-05-26', status: 'active' },
  ],
  officers_resigned: [
    { name: 'FONSECA VIADER JAVIER', position_normalized: 'CONSEJERO', resigned_date: '2026-08-18', status: 'resigned' },
  ],
};

const extinctionFiling = {
  event_date: '2026-08-18',
  has_dissolution: true,
  event_types: [
    { category: 'officers', type: 'Ceses/Dimisiones' },
    { category: 'lifecycle', type: 'Disolución' },
    { category: 'lifecycle', type: 'Extinción' },
  ],
  officers: [
    { name: 'FONSECA VIADER JAVIER', position_normalized: 'CONSEJERO', event_type: 'Ceses/Dimisiones' },
  ],
};

const render = (company, events, lang = 'es') =>
  renderCompanyPage(company, events, 'santander-back-offices-globales-mayoristas-sa', null, lang);

const overviewValue = (html, label) => {
  const re = new RegExp(`<span class="overview-value">(\\d+)</span><span class="overview-label">${label}</span>`);
  const m = html.match(re);
  assert.ok(m, `overview stat "${label}" missing`);
  return Number(m[1]);
};

test('a dissolved company has no "current officers" heading', () => {
  const html = render(dissolvedCompany, [extinctionFiling]);
  assert.doesNotMatch(html, /Administradores y cargos vigentes/);
});

test('the seats still open at extinction are listed as positions at dissolution', () => {
  const html = render(dissolvedCompany, [extinctionFiling]);
  assert.match(html, /Cargos vigentes al cierre de la sociedad/);
  assert.match(html, /HAJJAJI ABDELKRIM/);
  assert.match(html, /GARCIA LOPEZ GABRIEL JOSE/);
});

test('the dissolution note carries the extinction date from the filing', () => {
  const html = render(dissolvedCompany, [extinctionFiling]);
  assert.match(html, /disuelta[^<]*18\/08\/2026/i);
});

test('without a dated dissolution filing the note still explains the seats ended with the company', () => {
  const html = render(dissolvedCompany, []);
  assert.match(html, /Cargos vigentes al cierre de la sociedad/);
  assert.match(html, /no fueron cesados individualmente/);
  assert.doesNotMatch(html, /Administradores y cargos vigentes/);
});

test('the overview counts zero current officers and folds the open seats into former', () => {
  const html = render(dissolvedCompany, [extinctionFiling]);
  assert.equal(overviewValue(html, 'Cargos vigentes'), 0);
  assert.equal(overviewValue(html, 'Cargos cesados'), 3);
});

test('the registry facts show the dissolution date', () => {
  const html = render(dissolvedCompany, [extinctionFiling]);
  assert.match(html, /<th>Disolución<\/th><td>18\/08\/2026<\/td>/);
});

test('structured data drops employees and asserts dissolutionDate', () => {
  const html = render(dissolvedCompany, [extinctionFiling]);
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(ld, 'JSON-LD missing');
  const org = JSON.parse(ld[1]);
  const node = Array.isArray(org['@graph']) ? org['@graph'].find((n) => n['@type'] === 'Organization') || org['@graph'][0] : org;
  assert.equal(node.employee, undefined);
  assert.equal(node.dissolutionDate, '2026-08-18');
});

test('English page uses the English dissolution heading and note', () => {
  const html = render(dissolvedCompany, [extinctionFiling], 'en');
  assert.doesNotMatch(html, /Current directors &amp; officers|Current directors & officers/);
  assert.match(html, /Positions open at dissolution/);
  assert.match(html, /dissolved[^<]*18 Aug 2026/i);
});

test('a live company is unaffected', () => {
  const html = render({ ...dissolvedCompany, is_dissolved: false }, []);
  assert.match(html, /Administradores y cargos vigentes/);
  assert.doesNotMatch(html, /Cargos vigentes al cierre de la sociedad/);
  assert.equal(overviewValue(html, 'Cargos vigentes'), 2);
  assert.equal(overviewValue(html, 'Cargos cesados'), 1);
});
