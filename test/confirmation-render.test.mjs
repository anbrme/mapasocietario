/**
 * Placement of the attestation panel on the company page.
 *
 * The panel is no longer keyed on the slug: it is passed in, having been read
 * from VERIFY_DB by handleCompany. So these tests supply one directly, which
 * also means they test placement rather than data plumbing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

const company = {
  company_name: 'NURNBERG CONSULTING SL',
  company_type: 'SL',
  province: 'Madrid',
  current_capital: 3000,
  last_seen: '2014-03-27',
};

const attestation = {
  id: 'att_x', status: 'live',
  representative: { name: 'NURNBERG ALESSANDRO', position: 'ADM. UNICO' },
  accepted_at: '2026-09-08T21:37:16Z',
  reviewer: 'Alessandro Nürnberg', reviewed_at: '2026-09-08T21:38:00Z',
  last_verified_at: '2026-09-08T21:37:16Z',
  facts: [], history: [],
};

const render = (att) =>
  renderCompanyPage(company, [], 'nurnberg-consulting-sl', null, 'es',
    null, null, null, null, false, att);

test('the panel renders above the registry data, so borrowed authority frames it', () => {
  const html = render(attestation);
  assert.match(html, /Confirmación de vigencia/);
  assert.match(html, /NURNBERG ALESSANDRO/);
  assert.ok(
    html.indexOf('Confirmación de vigencia') < html.indexOf('id="registry-data"'),
    'panel must render before the registry-data heading',
  );
});

test('a company with no attestation renders exactly as before', () => {
  const html = render(null);
  assert.doesNotMatch(html, /Confirmación de vigencia/);
  assert.doesNotMatch(html, /Confirmación superada/);
  // The default argument must behave the same as an explicit null, or every
  // other page would change the day this shipped.
  assert.equal(
    renderCompanyPage(company, [], 'aldesa-energias-renovables-sl', null, 'es'),
    renderCompanyPage(company, [], 'aldesa-energias-renovables-sl', null, 'es',
      null, null, null, null, false, null),
  );
});

test('an outdated attestation still renders, marked as superseded', () => {
  const html = render({ ...attestation, status: 'outdated',
    status_reason: 'Se registró un cambio de domicilio.' });
  assert.match(html, /Confirmación superada/);
  assert.match(html, /ya no debe considerarse vigente/);
});
