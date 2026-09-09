import { describe, it, expect } from 'vitest';
import { validateRequestPayload, buildRequestEmail, MAX, REQUEST_RETENTION_DAYS, requestRetentionCutoff }
  from './request.js';

const good = (o = {}) => ({
  company_query: 'ACME SOLUCIONES SL',
  nif: 'b12345678',
  contact_name: 'Ana Gómez',
  contact_role: 'Administradora única',
  contact_email: 'ana@acme.es',
  referrer_note: 'Nos lo pidió nuestro banco',
  note: 'Preferimos que nos escriban en español.',
  ...o,
});

describe('validateRequestPayload', () => {
  it('accepts a complete request and normalises it', () => {
    const r = validateRequestPayload(good({ contact_email: '  ANA@Acme.ES ', nif: ' b12345678 ' }));
    expect(r.ok).toBe(true);
    expect(r.payload.contact_email).toBe('ana@acme.es');
    expect(r.payload.nif).toBe('B12345678');
  });

  it('treats a filled honeypot as a honeypot, before anything else', () => {
    // Deliberately also missing every required field: the honeypot must win,
    // so a bot learns nothing from the response.
    const r = validateRequestPayload({ website: 'http://spam' });
    expect(r).toEqual({ ok: false, reason: 'honeypot' });
  });

  it('names the missing field so the form can point at it', () => {
    for (const field of ['company_query', 'contact_name', 'contact_role', 'contact_email']) {
      const r = validateRequestPayload(good({ [field]: '   ' }));
      expect(r.ok).toBe(false);
      expect(r.reason).toBe(`${field}_required`);
      expect(r.field).toBe(field);
    }
  });

  it('separates a malformed address from a consumer one', () => {
    expect(validateRequestPayload(good({ contact_email: 'nonsense' })).reason)
      .toBe('contact_email_invalid');
    expect(validateRequestPayload(good({ contact_email: 'ana@gmail.com' })).reason)
      .toBe('contact_email_not_corporate');
  });

  it('caps every field rather than rejecting a long one', () => {
    const r = validateRequestPayload(good({
      company_query: 'x'.repeat(500), note: 'y'.repeat(5000),
    }));
    expect(r.ok).toBe(true);
    expect(r.payload.company_query).toHaveLength(MAX.company_query);
    expect(r.payload.note).toHaveLength(MAX.note);
  });

  it('collapses newlines in single-line fields', () => {
    const r = validateRequestPayload(good({ contact_name: 'Ana\r\nGómez' }));
    expect(r.payload.contact_name).toBe('Ana Gómez');
  });

  it('keeps newlines in the note, which may legitimately have paragraphs', () => {
    const r = validateRequestPayload(good({ note: 'Primera linea.\n\nSegunda linea.' }));
    expect(r.payload.note).toBe('Primera linea.\n\nSegunda linea.');
  });

  it('nulls the optional fields when blank, rather than storing empty strings', () => {
    const r = validateRequestPayload(good({ nif: '', referrer_note: '  ', note: '' }));
    expect(r.payload.nif).toBeNull();
    expect(r.payload.referrer_note).toBeNull();
    expect(r.payload.note).toBeNull();
  });
});

describe('buildRequestEmail', () => {
  const built = () => buildRequestEmail(validateRequestPayload(good()).payload, {
    from: 'verificacion@ncdata.eu', to: 'mapasocietario@ncdata.eu',
    timestamp: '2026-09-10T08:00:00Z', id: 'req_abc',
  });

  it('carries the company, the person and who prompted them', () => {
    const text = built().text;
    expect(text).toContain('ACME SOLUCIONES SL');
    expect(text).toContain('ana@acme.es');
    expect(text).toContain('Nos lo pidió nuestro banco');
    expect(text).toContain('req_abc');
  });

  it('puts the company in the subject so the inbox is scannable', () => {
    expect(built().subject).toContain('ACME SOLUCIONES SL');
  });

  it('never lets a newline break out of a header field', () => {
    // Deliberately NOT routed through validateRequestPayload: that strips the
    // newline first, and this test would then pass with the sanitiser deleted -
    // re-testing the validator while pretending to guard the email builder.
    const raw = {
      company_query: 'ACME\r\nBcc: x@y.z', nif: null, contact_name: 'Ana',
      contact_role: 'Adm', contact_email: 'a@b.c', referrer_note: null, note: null,
    };
    const mail = buildRequestEmail(raw, { from: 'a@b.c', to: 'd@e.f',
                                          timestamp: 't', id: 'req_1' });
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.subject).toContain('ACME Bcc: x@y.z');
  });
});

describe('requestRetentionCutoff', () => {
  it('is ninety days before now, as an ISO string', () => {
    const now = Date.parse('2026-12-10T04:15:00Z');
    expect(REQUEST_RETENTION_DAYS).toBe(90);
    expect(requestRetentionCutoff(now)).toBe(new Date(now - 90 * 86_400_000).toISOString());
  });
});
