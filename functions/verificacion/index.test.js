import { describe, it, expect } from 'vitest';
import { onRequestGet } from './index.js';
import { COPY } from '../../src/copy/verificacion.js';

const render = async (url, headers = {}) => {
  const res = await onRequestGet({ request: new Request(url, { headers }) });
  return { res, html: await res.text() };
};

const ES = 'https://mapasocietario.es/verificacion';
const EN = 'https://mapasocietario.es/verificacion?lang=en';

describe('GET /verificacion', () => {
  it('is the one indexable member of the family', async () => {
    const { res, html } = await render(ES);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag')).toBeNull();
    expect(html).not.toMatch(/noindex/i);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300, s-maxage=3600');
  });

  // A typo in any of these is a silent 400 the user cannot explain, so they are
  // pinned against the names validateRequestPayload actually reads.
  it('posts exactly the field names the endpoint reads', async () => {
    const { html } = await render(ES);
    for (const name of ['company_query', 'nif', 'contact_name', 'contact_role',
                        'contact_email', 'referrer_note', 'note', 'website']) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain('turnstileToken:');
    expect(html).toContain("fetch('/api/verify/request'");
  });

  it('hides the honeypot and never labels it', async () => {
    const { html } = await render(ES);
    expect(html).toMatch(/class="hp"[^>]*aria-hidden="true"/);
    expect(html).toMatch(/name="website"[^>]*tabindex="-1"[^>]*autocomplete="off"/);
    expect(html).not.toContain('for="f-website"');
  });

  it('says what it is not before it says what it is', async () => {
    for (const [url, lang] of [[ES, 'es'], [EN, 'en']]) {
      const { html } = await render(url);
      expect(html.indexOf(COPY[lang].notWhat.heading))
        .toBeLessThan(html.indexOf(COPY[lang].what.heading));
      expect(html.indexOf(COPY[lang].notWhat.summary)).toBeGreaterThan(-1);
    }
  });

  it('excludes mancomunados and states the domain rule above the form', async () => {
    for (const url of [ES, EN]) {
      const { html } = await render(url);
      const form = html.indexOf('<form');
      expect(html.indexOf('mancomunados')).toBeGreaterThan(-1);
      expect(html.indexOf('mancomunados')).toBeLessThan(form);
      expect(html.indexOf('mapasocietario@ncdata.eu')).toBeLessThan(form);
    }
  });

  // Spec section 8: this answer is how we learn which institutions are driving
  // companies here. At the visual weight of an optional NIF it gets skipped, so
  // the container is part of the requirement, not styling.
  it('gives the referrer question a visible container of its own', async () => {
    for (const [url, lang] of [[ES, 'es'], [EN, 'en']]) {
      const { html } = await render(url);
      const open = html.indexOf('<div class="field ask" data-field="referrer_note">');
      expect(open).toBeGreaterThan(-1);
      const next = html.indexOf('<div class="field', open + 1);
      const block = html.slice(open, next === -1 ? undefined : next);
      expect(block).toContain(COPY[lang].form.fields.referrer_note.label);
      // It is the ONLY field drawn that way - prominence shared is prominence lost.
      expect(html.match(/class="field ask"/g)).toHaveLength(1);
    }
  });

  it('carries the one persuasive line exactly once', async () => {
    for (const [url, lang] of [[ES, 'es'], [EN, 'en']]) {
      const { html } = await render(url);
      const hits = html.split(COPY[lang].once).length - 1;
      expect(hits).toBe(1);
    }
  });

  it('negotiates language by query first, then Accept-Language', async () => {
    expect((await render(EN)).html).toContain('<html lang="en"');
    expect((await render(ES)).html).toContain('<html lang="es"');
    expect((await render(ES, { 'accept-language': 'en-GB,en;q=0.9' })).html)
      .toContain('<html lang="en"');
    expect((await render(`${ES}?lang=es`, { 'accept-language': 'en-GB' })).html)
      .toContain('<html lang="es"');
  });

  it('can render every error the endpoint can return', async () => {
    const returned = ['company_query_required', 'contact_name_required',
      'contact_role_required', 'contact_email_required', 'contact_email_invalid',
      'contact_email_not_corporate', 'turnstile_failed', 'store_failed', 'invalid_json'];
    for (const lang of ['es', 'en']) {
      for (const error of returned) expect(COPY[lang].errors[error]).toBeTruthy();
      // The two the client raises on its own behalf.
      expect(COPY[lang].errors.network).toBeTruthy();
      expect(COPY[lang].errors.unknown).toBeTruthy();
    }
  });

  it('loads Turnstile with the public sitekey', async () => {
    const { html } = await render(ES);
    expect(html).toContain('challenges.cloudflare.com/turnstile/v0/api.js');
    expect(html).toContain('class="cf-turnstile" data-sitekey="0x4AAAAAADp3WnZGNiZai_32"');
  });
});
