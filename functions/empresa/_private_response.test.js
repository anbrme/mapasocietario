import { describe, it, expect } from 'vitest';
import { renderCompanyPage } from './_lib.js';

const COMPANY = {
  company_name: 'ACME TEST SL',
  nif: 'B12345678',
  last_seen: '2026-08-01',
  total_publications: 3,
};
const SEED = { name: 'ACME TEST SL' };

// renderCompanyPage(rawCompany, events, slug, seed, lang, cnmv, chartSvg, boe,
//   gleif, noindex, attestation, privateResponse)
const render = (privateResponse) =>
  renderCompanyPage(COMPANY, [], 'acme-test-sl', SEED, 'es', null, null, null, null, false, null, privateResponse);

/**
 * A badge-preview URL (/verificacion/p/<token>) carries a secret grant token
 * in its PATH, and gtag attaches document.location.href to any event that
 * does not override page_location. So embedding the GA snippet on a preview
 * page would leak the token to Google Analytics. The fix (_lib.js, the
 * ${privateResponse ? '' : GA_SNIPPET} line) is a one-line conditional with
 * no other test exercising renderCompanyPage itself for it — the route-level
 * test in functions/verificacion/p/[token].test.js mocks handleCompany
 * entirely and would still pass if this conditional were reverted.
 *
 * The pair below is the actual regression guard: the first assertion proves
 * the GA snippet is really reachable through this code path (so the second
 * assertion cannot be passing vacuously), and the second proves it is
 * withheld once privateResponse is true.
 */
describe('renderCompanyPage GA snippet gating', () => {
  it('includes the GA snippet for a normal (public) render', () => {
    const html = render(false);
    expect(html).toContain('googletagmanager');
  });

  it('omits the GA snippet entirely when privateResponse is true', () => {
    const html = render(true);
    expect(html).not.toContain('googletagmanager');
  });
});
