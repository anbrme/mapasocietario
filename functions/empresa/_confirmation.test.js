import { describe, it, expect } from 'vitest';
import { renderConfirmationBlock, confirmationViewModel } from './_confirmation.js';
import { PUBLIC_REVIEWER } from '../../src/verify/projection.js';
import { statusLine } from '../../src/verify/render.js';

// This is a PROJECTION, not a raw attestation row: liveAttestationFor returns
// publicProjection(...), so the badge only ever sees projected values. The
// guard exists because the badge is a public surface and the projection is the
// only thing protecting it.
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

describe('the /empresa badge', () => {
  it('attributes the review to the operating entity', () => {
    const html = renderConfirmationBlock(projected(), 'es');
    expect(html).toContain('Nurnberg Consulting SL');
  });

  it('keeps the short form: the operator clause is redundant on our own site', () => {
    const html = renderConfirmationBlock(projected(), 'es');
    expect(html).not.toContain('operador de Mapa Societario');
  });

  it('renders in English too', () => {
    const html = renderConfirmationBlock(projected(), 'en');
    expect(html).toContain('Authority reviewed by Nurnberg Consulting SL');
  });
});

/**
 * The badge led with our hedge instead of with the fact: a category-name
 * heading, then "Esta declaración se aceptó el X y era coherente con la
 * evidencia registral comprobada en ese momento", then two more caveats at
 * near-equal weight. A reader had to parse four hedged paragraphs to learn the
 * one thing that happened — the company said its registry data was still
 * current, on a date.
 *
 * The claim now leads and the caveats are demoted to `detail`. Nothing is
 * dropped: statusLine is still carried VERBATIM from src/verify/render.js, so
 * the badge and the attestation permalink cannot drift on the load-bearing
 * wording.
 */
describe('the badge leads with the claim', () => {
  it('says in one plain sentence who confirmed what, and when', () => {
    const vm = confirmationViewModel(projected(), 'es');
    expect(vm.claim).toMatch(/^La empresa confirmó el \d{4}-\d{2}-\d{2} que estos datos registrales seguían vigentes\.$/);
  });

  it('never claims WE verified anything in the leading sentence', () => {
    for (const lang of ['es', 'en']) {
      for (const status of ['live', 'outdated', 'expired', 'under_review', 'disputed']) {
        const vm = confirmationViewModel(projected({ status }), lang);
        expect(vm.claim).not.toMatch(/verificad|verified|comprobamos|we checked/i);
        expect(vm.claim).toMatch(/empresa|company/i);
      }
    }
  });

  it('demotes the hedges but keeps statusLine verbatim, so the permalink cannot drift', () => {
    const vm = confirmationViewModel(projected(), 'es');
    expect(vm.detail.join(' ')).toContain(statusLine(projected(), 'es'));
    expect(vm.detail.join(' ')).toContain('Nurnberg Consulting SL');
  });

  it('renders the claim above the small print', () => {
    const html = renderConfirmationBlock(projected(), 'es');
    expect(html.indexOf('cc-claim')).toBeLessThan(html.indexOf('cc-detail'));
  });
});

/**
 * The most informative thing on the pilot company's own page is the DISTANCE
 * between the last registry filing and the confirmation — BORME last spoke in
 * 2014, the company confirmed in 2026. Neither the raw registry data nor the
 * attestation says that on its own.
 */
describe('the registry gap line', () => {
  const withGap = (over = {}) =>
    confirmationViewModel(projected(over), 'es', { registryLastSeen: '2014-03-27' });

  it('names the last BORME publication and how long before the confirmation', () => {
    expect(withGap().gap).toBe('Última publicación en el BORME: 2014-03-27 — 12 años antes de la confirmación.');
  });

  it('reads naturally in English', () => {
    const vm = confirmationViewModel(projected(), 'en', { registryLastSeen: '2014-03-27' });
    expect(vm.gap).toBe('Last BORME publication: 2014-03-27 — 12 years before the confirmation.');
  });

  it('says nothing when the registry is recent: a gap of months is not a story', () => {
    const recent = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
    expect(confirmationViewModel(projected(), 'es', { registryLastSeen: recent }).gap).toBeNull();
  });

  it('says nothing when we were given no registry date', () => {
    expect(confirmationViewModel(projected(), 'es').gap).toBeNull();
  });

  it('never renders a NEGATIVE gap when the registry moved after the confirmation', () => {
    const later = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10);
    expect(confirmationViewModel(projected(), 'es', { registryLastSeen: later }).gap).toBeNull();
  });
});
