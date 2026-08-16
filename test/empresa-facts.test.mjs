import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

// Parity pass: the /empresa page should surface the same backend fields the
// in-app preview panel shows — objeto social (activity), NIF, and the enriched
// capital/address fallback with the "external estimate" caveat.
const base = { company_name: 'TEST CO SL', company_type: 'SL', province: 'Madrid' };
const render = (extra) => renderCompanyPage({ ...base, ...extra }, [], 'test-co-sl', null, 'es');

test('objeto social (activity) is shown when present', () => {
  const html = render({ activity: 'La prestación de servicios de consultoría' });
  assert.match(html, /Objeto social/);
  assert.match(html, /La prestación de servicios de consultoría/);
});

test('no activity → no objeto social row', () => {
  assert.doesNotMatch(render({}), /Objeto social/);
});

test('NIF shown from nif or enriched_nif when present', () => {
  assert.match(render({ nif: 'B12345678' }), /B12345678/);
  assert.match(render({ enriched_nif: 'B87654321' }), /B87654321/);
});

test('enriched capital shown with external-estimate caveat when BORME capital is absent', () => {
  const html = render({ enriched_capital: 60000 });
  assert.match(html, /60\.000/);
  assert.match(html, /estimación de fuente externa/);
});

test('BORME capital shows WITHOUT the external caveat', () => {
  const html = render({ current_capital: 3000 });
  // es-ES does not group 4-digit numbers, so 3000 → "3000 €" (5-digit values group: "60.000 €")
  assert.match(html, /3\.?000/);
  assert.doesNotMatch(html, /estimación de fuente externa/);
});

test('enriched address shown with caveat when BORME address is absent', () => {
  const html = render({ enriched_address: 'CALLE FALSA 123' });
  assert.match(html, /CALLE FALSA 123/);
  assert.match(html, /estimación de fuente externa/);
});

test('BORME address shows WITHOUT the external caveat', () => {
  const html = render({ current_address: 'C/ REAL 1 (MADRID)' });
  assert.match(html, /C\/ REAL 1/);
  assert.doesNotMatch(html, /estimación de fuente externa/);
});

test('relationship summary and map action are visible before registry details', () => {
  const html = render({
    officers_active: [{ name: 'ANA ADMIN', position_normalized: 'PRESIDENTE' }],
    officers_resigned: [{ name: 'LUIS FORMER', position_normalized: 'CONSEJERO' }],
    sole_shareholders: ['OWNER HOLDING SL'],
    total_publications: 12,
  });

  assert.match(html, /Relaciones societarias de un vistazo/);
  assert.match(html, /Explorar relaciones en el mapa/);
  assert.match(html, /\/app\/\?search=TEST%20CO%20SL/);
  assert.ok(
    html.indexOf('Relaciones societarias de un vistazo') < html.indexOf('Datos registrales'),
  );
});

test('non-board officer roles remain available in a collapsed details table', () => {
  const html = render({
    officers_active: [
      { name: 'ANA ADMIN', position_normalized: 'PRESIDENTE' },
      { name: 'PABLO POWER', position_normalized: 'APODERADO', appointed_date: '2024-01-02' },
    ],
  });

  assert.match(html, /Ver otros cargos registrados \(1\)/);
  assert.match(html, /PABLO POWER/);
  assert.doesNotMatch(html, /no incluidos/);
});

test('standalone company pages report their own GA4 page view', () => {
  const html = render({});

  assert.match(html, /googletagmanager\.com\/gtag\/js\?id=G-HHWT6ZTKZD/);
  assert.match(html, /gtag\('event','page_view'/);
});

test('publication history is grouped by year, batched, and charted by change type', () => {
  const currentYearEvents = Array.from({ length: 13 }, (_, index) => ({
    event_date: `2025-01-${String(index + 1).padStart(2, '0')}`,
    event_types: [{ type: index % 2 === 0 ? 'Nombramientos' : 'Ceses/Dimisiones' }],
    full_entry: `Publicación actual ${index + 1}`,
  }));
  const priorYearEvents = [
    {
      event_date: '2024-06-01',
      event_types: [{ type: 'Ampliación de capital' }],
      full_entry: 'Capital anterior',
    },
    {
      event_date: '2024-02-01',
      event_types: [{ type: 'Cambio de domicilio social' }],
      full_entry: 'Domicilio anterior',
    },
  ];
  const html = renderCompanyPage(
    { ...base, total_publications: 30 },
    [...priorYearEvents, ...currentYearEvents],
    'test-co-sl',
    null,
    'es',
  );

  assert.match(html, /Cambios por año y tipo/);
  assert.match(html, /history-appointments/);
  assert.match(html, /history-departures/);
  assert.match(html, /history-capital/);
  assert.match(html, /history-company/);
  assert.match(html, /<details class="history-year" open>[\s\S]*2025 · 13 publicaciones/);
  assert.match(html, /<details class="history-year">[\s\S]*2024 · 2 publicaciones/);
  assert.match(html, /Ver publicaciones 11–13/);
  assert.match(html, /15 publicaciones más recientes de 30/);
});
