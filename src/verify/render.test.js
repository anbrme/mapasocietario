import { describe, it, expect } from 'vitest';
import { statusLine, renderAttestationHtml, FORBIDDEN_PHRASES } from './render.js';
import { PUBLIC_REVIEWER } from './projection.js';
import { previewBanner } from './preview.js';

const base = {
  id: 'att_x', status: 'live', method: 'email-confirmed', representation_basis: 'sole_admin',
  representative: { name: 'NURNBERG ALESSANDRO', position: 'ADM. UNICO' },
  accepted_at: '2026-09-08T11:30:00Z', expires_at: '2027-03-07T11:30:00Z',
  approved_at: '2026-09-09T09:00:00Z', last_verified_at: '2026-10-07T03:00:00Z',
  reviewer: PUBLIC_REVIEWER, status_reason: null,
  facts: [{ fact_key: 'address', declared_status: 'current', declared_value: 'C/ COS 10',
            registry_value_at_issue: 'C/ COS 10', last_check_outcome: 'consistent',
            last_checked_at: '2026-10-07T03:00:00Z' }],
  history: [{ seq: 1, action: 'accepted', created_at: '2026-09-08T11:30:00Z',
              summary: 'Accepted by the representative' }],
};

describe('statusLine', () => {
  it('never claims the statement was accurate', () => {
    const line = statusLine({ ...base, status: 'outdated',
      status_reason: 'A change of address was recorded on 20 September.' }, 'en');
    expect(line).toContain('was accepted on');
    expect(line).toContain('consistent with the registry evidence checked');
    expect(line).not.toMatch(/accurate/i);
  });

  /**
   * `status_reason` is free text: the reconciler writes it, and a reviewer can
   * too. It arrived untrimmed and without a full stop, so the outdated line
   * rendered as "...checked at that time. nuevo cargo inscrito The statement
   * should no longer..." — and a null reason left a double space mid-sentence.
   * The line is assembled from sentences now, so neither can happen.
   */
  it('reads as sentences whatever shape the reason arrives in', () => {
    for (const lang of ['en', 'es']) {
      for (const reason of ['nuevo cargo inscrito', '  nuevo cargo inscrito  ', 'Ya inscrito.', '', null]) {
        const line = statusLine({ ...base, status: 'outdated', status_reason: reason }, lang);
        expect(line).not.toMatch(/ {2}/);
        expect(line).not.toMatch(/[a-záéíóúñ] [A-ZÁÉÍÓÚÑ]/);
      }
    }
  });

  it('keeps the reason in the line, ended as a sentence', () => {
    expect(statusLine({ ...base, status: 'outdated', status_reason: 'nuevo cargo inscrito' }, 'es'))
      .toContain('nuevo cargo inscrito.');
    expect(statusLine({ ...base, status: 'outdated', status_reason: 'Ya inscrito.' }, 'es'))
      .not.toContain('inscrito..');
  });

  it('says under_review implies nothing about the company', () => {
    expect(statusLine({ ...base, status: 'under_review' }, 'en'))
      .toMatch(/implies nothing about the company/i);
  });

  it('always names the last SUCCESSFUL check, never "right now"', () => {
    for (const status of ['live', 'outdated', 'under_review', 'disputed', 'expired']) {
      const line = statusLine({ ...base, status }, 'en');
      expect(line).toMatch(/last successfully checked/i);
      expect(line).not.toMatch(/as of right now/i);
    }
  });

  it('says so plainly when nothing has been checked yet', () => {
    expect(statusLine({ ...base, last_verified_at: null }, 'en'))
      .toMatch(/not been checked since/i);
  });
});

describe('renderAttestationHtml', () => {
  it('contains none of the forbidden phrasings, in either language', () => {
    for (const lang of ['en', 'es']) {
      for (const status of ['live', 'outdated', 'under_review', 'disputed', 'expired']) {
        const html = renderAttestationHtml({ ...base, status }, 'ACME SL', lang).toLowerCase();
        for (const phrase of FORBIDDEN_PHRASES) expect(html).not.toContain(phrase);
      }
    }
  });

  // The preview banner is reader-facing chrome too (src/verify/preview.js) and
  // is held to the same honesty bar, even though it is injected outside
  // renderAttestationHtml itself.
  it('the preview banner also contains none of the forbidden phrasings', () => {
    for (const lang of ['en', 'es']) {
      const html = previewBanner(lang).toLowerCase();
      for (const phrase of FORBIDDEN_PHRASES) expect(html).not.toContain(phrase);
    }
  });

  it('escapes values rather than trusting them', () => {
    const html = renderAttestationHtml(
      { ...base, reviewer: '<script>alert(1)</script>' }, 'ACME SL', 'en');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('names the operating entity as reviewer, not an individual', () => {
    const html = renderAttestationHtml(base, 'ACME SL', 'en');
    expect(html).toContain('reviewed by Nurnberg Consulting SL, operator of Mapa Societario');
    expect(html).not.toContain('Alessandro');
  });

  it('names the operating entity in Spanish too', () => {
    const html = renderAttestationHtml(base, 'ACME SL', 'es');
    expect(html).toContain('revisada por Nurnberg Consulting SL, operador de Mapa Societario');
  });

  it('renders the four-column fact table including the registry-today column', () => {
    const html = renderAttestationHtml(base, 'ACME SL', 'en');
    expect(html).toContain('Registry at acceptance');
    expect(html).toContain('Check');
  });
});


// --- Regression: found in the rendered page ---------------------------------

import { checkLabel } from './render.js';

describe('the check column (found in the rendered page)', () => {
  it('says "nothing to check" for a fact with no check source', () => {
    // 'not checked' implied we owed a check on a declaration that is
    // unverifiable by design.
    expect(checkLabel({ check_source: 'none', last_check_outcome: null }, 'es'))
      .toBe('no procede comprobación');
    expect(checkLabel({ check_source: 'none', last_check_outcome: null }, 'en'))
      .toBe('nothing to check');
  });

  it('says "not yet re-checked" only where a check is actually owed', () => {
    expect(checkLabel({ check_source: 'borme', last_check_outcome: null }, 'en'))
      .toBe('not yet re-checked');
  });

  it('renders each outcome in words rather than as an enum', () => {
    for (const o of ['consistent', 'superseded_by_later_event', 'contradicted_at_issue',
                     'pending_publication', 'inconclusive']) {
      const label = checkLabel({ check_source: 'borme', last_check_outcome: o }, 'es');
      expect(label).not.toBe(o);
      expect(label.length).toBeGreaterThan(5);
    }
  });

  it('translates the stored English audit summary on a Spanish page', () => {
    // public_summary is inside the hashed audit payload, so it cannot be
    // rewritten - it must be translated at render.
    const html = renderAttestationHtml(base, 'ACME SL', 'es');
    expect(html).toContain('Aceptada por el representante');
    expect(html).not.toContain('Accepted by the representative');
  });

  it('leaves the English page in English', () => {
    expect(renderAttestationHtml(base, 'ACME SL', 'en'))
      .toContain('Accepted by the representative');
  });
});
