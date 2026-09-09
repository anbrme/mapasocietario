import { describe, it, expect } from 'vitest';
import { onRequestGet } from './index.js';
import { COPY } from '../../src/copy/verificacion.js';

const render = async (url, headers = {}) => {
  const res = await onRequestGet({ request: new Request(url, { headers }) });
  return { res, html: await res.text() };
};

const ES = 'https://mapasocietario.es/verificacion';
const EN = 'https://mapasocietario.es/verificacion?lang=en';

// The contract with POST /api/verify/request, built in a separate task. These
// are the names validateRequestPayload reads; anything else is a 400 the user
// cannot explain. One home, so the markup check and the body check agree.
const POSTED_FIELDS = ['company_query', 'nif', 'contact_name', 'contact_role',
                       'contact_email', 'referrer_note', 'note', 'website'];
const BODY_KEYS = [...POSTED_FIELDS, 'turnstileToken'];

/**
 * The page ships ~6kB of client JavaScript assembled inside a server-side
 * template literal, which means an escaping mistake yields HTML that looks
 * perfect and JavaScript that never runs: the form silently does nothing, no
 * visitor reports a console error, and the suite stays green. The operator
 * console carries the same guard for the same reason - see
 * functions/admin/verificacion.test.js, whose header records a real instance.
 *
 * Both languages are checked because the two renders interpolate different
 * copy into the same script, so a character that breaks only one is possible.
 */
const clientScript = (html) => html.slice(
  html.lastIndexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));

/**
 * Runs the script's top level against a DOM built from the ids the page
 * ACTUALLY rendered - an unknown id returns null, exactly as a browser would,
 * so a renamed field surfaces here as a throw instead of as a dead form.
 *
 * It also hands back a `submit()` that fires the captured handler and the
 * `fetch` calls it made, which is the only way to see the JSON the form
 * actually posts. A string match on the markup cannot: the input can be named
 * company_query while the script reads the wrong id or writes the wrong key,
 * and every markup assertion still passes.
 */
const TURNSTILE_SENTINEL = 'sentinel-turnstile-token';

function runClientScript(js, html) {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const bound = [];
  const handlers = new Map();
  const made = new Map();
  const byId = (id) => {
    if (!ids.has(id)) return null;
    if (!made.has(id)) {
      made.set(id, {
        id, value: '', textContent: '', hidden: false, disabled: false,
        classList: { toggle() {}, remove() {} },
        addEventListener(type, fn) { bound.push(`${id}:${type}`); handlers.set(`${id}:${type}`, fn); },
        focus() {}, scrollIntoView() {}, querySelectorAll: () => [],
      });
    }
    return made.get(id);
  };
  const fetchCalls = [];
  const fakeFetch = async (path, opts = {}) => {
    fetchCalls.push({ path, method: opts.method,
                      body: opts.body ? JSON.parse(opts.body) : null });
    return { json: async () => ({ ok: true }) };
  };
  const fakeWindow = { turnstile: { getResponse: () => TURNSTILE_SENTINEL, reset() {} } };
  // eslint-disable-next-line no-new-func
  new Function('document', 'window', 'fetch', js)(
    { getElementById: byId, querySelector: () => null }, fakeWindow, fakeFetch);

  return {
    bound, fetchCalls, byId,
    async submit() {
      handlers.get('req:submit')({ preventDefault() {} });
      // Let the fetch promise chain settle before anyone reads fetchCalls.
      await new Promise((resolve) => { setTimeout(resolve, 0); });
    },
  };
}

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
    for (const name of POSTED_FIELDS) expect(html).toContain(`name="${name}"`);
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

  it('emits JavaScript that actually parses, in both languages', async () => {
    for (const url of [ES, EN]) {
      const js = clientScript((await render(url)).html);
      expect(js.length).toBeGreaterThan(1000);
      // The Function constructor parses without executing.
      expect(() => new Function(js)).not.toThrow();
    }
  });

  it('wires itself to elements the page actually renders', async () => {
    for (const url of [ES, EN]) {
      const { html } = await render(url);
      const { bound } = runClientScript(clientScript(html), html);
      expect(bound).toContain('req:submit');
      expect(bound).toContain('f-contact_email:input');
      expect(bound).toContain('f-contact_email:blur');
    }
  });

  /**
   * THE test for this page. Every other field-name assertion here reads the
   * markup; this one reads the JSON that leaves the browser, which is the only
   * artefact the endpoint sees. Sentinels are distinct and deliberately
   * unrealistic: a shared or plausible value would hide a swap between two
   * fields of the same type, which is the mistake most likely to survive review.
   */
  it('posts the endpoint contract, each value under its own key', async () => {
    const { html } = await render(ES);
    const app = runClientScript(clientScript(html), html);

    const sentinels = Object.fromEntries(
      POSTED_FIELDS.map((name) => [name, `sentinel-${name}`]));
    for (const [name, value] of Object.entries(sentinels)) {
      app.byId(`f-${name}`).value = value;
    }

    await app.submit();

    expect(app.fetchCalls).toHaveLength(1);
    const [call] = app.fetchCalls;
    expect(call.path).toBe('/api/verify/request');
    expect(call.method).toBe('POST');

    // Exactly the contract: nothing missing, nothing extra, nothing renamed.
    expect(Object.keys(call.body).sort()).toEqual([...BODY_KEYS].sort());

    // And each value under ITS OWN key, so a swap fails rather than passing.
    for (const [name, value] of Object.entries(sentinels)) {
      expect(call.body[name]).toBe(value);
    }
    expect(call.body.turnstileToken).toBe(TURNSTILE_SENTINEL);
  });

  it('loads Turnstile with the public sitekey', async () => {
    const { html } = await render(ES);
    expect(html).toContain('challenges.cloudflare.com/turnstile/v0/api.js');
    expect(html).toContain('class="cf-turnstile" data-sitekey="0x4AAAAAADp3WnZGNiZai_32"');
  });
});
