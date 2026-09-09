import { describe, it, expect } from 'vitest';
import { renderConfirmationBlock } from './_confirmation.js';
import { PUBLIC_REVIEWER } from '../../src/verify/projection.js';

// This is a PROJECTION, not a raw attestation row: liveAttestationFor returns
// publicProjection(...), so the badge only ever sees projected values. The
// guard exists because the badge is a public surface and the projection is the
// only thing protecting it.
const projected = () => ({
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
