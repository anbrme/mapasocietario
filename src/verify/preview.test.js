import { describe, it, expect } from 'vitest';
import {
  previewBanner, insertPreviewBanner, previewGrantAllows, PREVIEWABLE_STATUSES,
} from './preview.js';

describe('previewBanner', () => {
  it('says plainly that the badge is not public yet, in Spanish', () => {
    expect(previewBanner('es')).toContain('todavía no es pública');
  });
  it('says the same in English', () => {
    expect(previewBanner('en')).toContain('not public yet');
  });
  it('falls back to Spanish for an unknown language', () => {
    expect(previewBanner('fr')).toBe(previewBanner('es'));
  });
});

describe('previewGrantAllows', () => {
  const now = Date.parse('2026-09-10T00:00:00Z');
  const grant = (o = {}) => ({ kind: 'preview', expires_at: '2026-09-20T00:00:00Z',
                               revoked_at: null, ...o });
  const att = (status = 'live') => ({ status });

  it('allows a valid preview grant on a live attestation', () => {
    expect(previewGrantAllows(grant(), att('live'), now)).toBe(true);
  });
  it('allows an outdated attestation: the company should see the downgrade too', () => {
    expect(previewGrantAllows(grant(), att('outdated'), now)).toBe(true);
  });
  it('refuses a missing grant', () => {
    expect(previewGrantAllows(null, att(), now)).toBe(false);
  });
  it('refuses a revoked grant', () => {
    expect(previewGrantAllows(grant({ revoked_at: '2026-09-09T00:00:00Z' }), att(), now)).toBe(false);
  });
  it('refuses an expired grant', () => {
    expect(previewGrantAllows(grant({ expires_at: '2026-09-09T00:00:00Z' }), att(), now)).toBe(false);
  });
  it('refuses a counterparty grant: each token has exactly one meaning', () => {
    expect(previewGrantAllows(grant({ kind: 'counterparty' }), att(), now)).toBe(false);
  });
  it('refuses a missing attestation', () => {
    expect(previewGrantAllows(grant(), null, now)).toBe(false);
  });
  it('refuses a status that renders no badge, so nobody previews what they cannot get', () => {
    for (const status of ['pending_review', 'rejected', 'under_review',
                          'disputed', 'expired', 'revoked', 'superseded']) {
      expect(previewGrantAllows(grant(), att(status), now)).toBe(false);
    }
  });
});

describe('insertPreviewBanner', () => {
  it('puts the banner immediately after the opening body tag', () => {
    const out = insertPreviewBanner('<html><body><h1>ACME</h1></body></html>', 'es');
    expect(out.indexOf('vp-banner')).toBeLessThan(out.indexOf('<h1>ACME</h1>'));
  });

  it('handles a body tag carrying attributes', () => {
    const out = insertPreviewBanner('<body class="x"><h1>A</h1></body>', 'es');
    expect(out).toContain('vp-banner');
    expect(out.indexOf('vp-banner')).toBeLessThan(out.indexOf('<h1>A</h1>'));
  });

  it('prepends rather than dropping the banner when there is no body tag', () => {
    const out = insertPreviewBanner('<h1>A</h1>', 'es');
    expect(out.startsWith('<')).toBe(true);
    expect(out).toContain('vp-banner');
    expect(out).toContain('<h1>A</h1>');
  });
});
