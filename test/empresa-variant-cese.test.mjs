import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

// The /empresa page listed HAJJAJI ABDELKRIM among the seats open at the
// company's dissolution, two paragraphs above a 02 Jun 2026 filing that ceased
// him — printed as "HAJJAJI ABDEL KARIM". The page must read that cese as his.
const company = {
  company_name: 'SANTANDER BACK-OFFICES GLOBALES MAYORISTAS SA',
  company_type: 'SA',
  is_dissolved: true,
  last_seen: '2026-08-18',
  officers_active: [
    { name: 'HAJJAJI ABDELKRIM', position_normalized: 'PRESIDENTE', appointed_date: '2021-11-30', status: 'active' },
    { name: 'GARCIA LOPEZ GABRIEL JOSE', position_normalized: 'APODERADO', appointed_date: '2009-05-26', status: 'active' },
  ],
  officers_resigned: [
    { name: 'HAJJAJI ABDEL KARIM', position_normalized: 'PRESIDENTE', resigned_date: '2026-06-02', status: 'resigned' },
  ],
};
const events = [
  { event_date: '2026-06-02', event_types: [{ category: 'officers', type: 'Ceses/Dimisiones' }], officers: [
    { name: 'HAJJAJI ABDEL KARIM', position_normalized: 'PRESIDENTE', event_type: 'Ceses/Dimisiones' },
  ] },
];

const section = (html, heading) => {
  const start = html.indexOf(heading);
  assert.notEqual(start, -1, `${heading} missing`);
  return html.slice(start, html.indexOf('</table>', start));
};

test('the chairman is listed as former, under his appointment spelling, with the cese spelling shown', () => {
  const html = renderCompanyPage(company, events, 'x', null, 'es');
  const former = section(html, 'Cargos cesados o revocados');
  assert.match(former, /HAJJAJI ABDELKRIM/);
  assert.match(former, /cese inscrito como HAJJAJI ABDEL KARIM/);
  assert.match(former, /02\/06\/2026/);
  assert.doesNotMatch(section(html, 'Cargos vigentes al cierre de la sociedad'), /HAJJAJI/);
});

test('English wording', () => {
  const html = renderCompanyPage(company, events, 'x', null, 'en');
  assert.match(section(html, 'Former / revoked officers'), /cese recorded as HAJJAJI ABDEL KARIM/);
});
