import { describe, it, expect } from 'vitest';
import { renderCompanyPage } from './_lib.js';
import { PUBLIC_REVIEWER } from '../../src/verify/projection.js';

const COMPANY = {
  company_name: 'ACME TEST SL',
  nif: 'B12345678',
  last_seen: '2026-08-01',
  total_publications: 80,
};
const SEED = { name: 'ACME TEST SL' };

// A PROJECTION, the same shape liveAttestationFor hands the page.
const projected = (over = {}) => ({
  id: 'att_x',
  status: 'live',
  method: 'email-confirmed',
  representation_basis: 'sole_admin',
  representative: { name: 'NURNBERG ALESSANDRO', position: 'ADM. UNICO' },
  accepted_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  expires_at: new Date(Date.now() + 85 * 86_400_000).toISOString(),
  approved_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
  last_verified_at: new Date(Date.now() - 86_400_000).toISOString(),
  reviewer: PUBLIC_REVIEWER,
  status_reason: null,
  facts: [],
  history: [],
  ...over,
});

const render = (attestation = null, lang = 'es') =>
  renderCompanyPage(COMPANY, [], 'acme-test-sl', SEED, lang, null, null, null, null, false, attestation);

/**
 * The "¿Es esta su empresa?" panel is an ACQUISITION offer: it asks the company
 * to come and confirm its registry data. On a page that already carries a live
 * confirmation it asks for something the reader has already given, directly
 * above the block that says so.
 *
 * The gate is the attestation's STATUS, not the age of the badge. A superseded,
 * expired, disputed or under-review confirmation leaves the panel in place,
 * because during the pilot the front door is the only route back to a current
 * statement and hiding it would strand a company on a badge it cannot refresh.
 */
describe('the "is this your company?" offer', () => {
  it('is offered on a company with no confirmation', () => {
    expect(render()).toContain('¿Es esta su empresa?');
  });

  it('disappears once a live confirmation is on the page', () => {
    const html = render(projected());
    expect(html).toContain('Confirmación de vigencia');
    expect(html).not.toContain('¿Es esta su empresa?');
    expect(html).not.toContain('verify_cta_click');
  });

  it('disappears in English too', () => {
    const html = render(projected(), 'en');
    expect(html).toContain('Currency confirmation');
    expect(html).not.toContain('Is this your company?');
  });

  it('comes back when the confirmation has been superseded', () => {
    const html = render(projected({ status: 'outdated', status_reason: 'nuevo cargo inscrito' }));
    expect(html).toContain('Confirmación superada');
    expect(html).toContain('¿Es esta su empresa?');
  });

  it('comes back when the confirmation has expired', () => {
    expect(render(projected({ status: 'expired' }))).toContain('¿Es esta su empresa?');
  });

  // The footer carried a SECOND copy of the same invitation, so gating only the
  // panel left "¿Es esta su empresa? Verifique sus datos." sitting below a block
  // that says the data has already been confirmed. The provenance sentence is
  // not part of the offer and must survive either way.
  it('drops the footer invitation too, but keeps the provenance sentence', () => {
    const html = render(projected());
    expect(html).toContain('Mapa Societario no es un registro oficial');
    expect(html).not.toContain('Verifique sus datos');
  });

  it('keeps the footer invitation when there is nothing to confirm from', () => {
    const html = render();
    expect(html).toContain('Mapa Societario no es un registro oficial');
    expect(html).toContain('Verifique sus datos');
  });

  it('renders the confirmation block exactly once', () => {
    const html = render(projected());
    expect(html.match(/class="cc cc-/g)).toHaveLength(1);
  });
});
