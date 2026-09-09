import { describe, it, expect } from 'vitest';
import { onRequestGet } from './verificacion.js';

/**
 * The console is a client-side script embedded in a server-side template
 * literal, which means an escaping mistake produces HTML that looks fine and
 * JavaScript that is syntactically broken - invisible until someone clicks.
 * One real instance: a nested quote in an inline onclick collapsed a level of
 * escaping and rendered `revoke('' + esc(id) + '')`.
 */
const render = async () => (await onRequestGet()).text();
const script = (html) => html.match(/<script>([\s\S]*)<\/script>/)[1];

/**
 * Runs the console's client script with a minimal fake DOM instead of a real
 * browser, so behaviour (not just syntax) can be asserted on. Every element
 * is created lazily on first lookup; fetch calls are recorded instead of
 * making a network request.
 */
function runClientScript(js) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      elements.set(id, { value: '', innerHTML: '', textContent: '', className: '',
                          hidden: false, addEventListener() {}, onclick: null });
    }
    return elements.get(id);
  };
  const fetchCalls = [];
  const fakeFetch = async (path, opts = {}) => {
    fetchCalls.push({ path, body: opts.body ? JSON.parse(opts.body) : null });
    return {
      ok: true,
      json: async () => ({ ok: true, url: 'https://example.test/x', url_en: 'https://example.test/x?lang=en',
                            expires_at: '2099-01-01T00:00:00Z' }),
    };
  };
  const fakeDocument = { getElementById: element };
  const fakeSessionStorage = { getItem: () => '', setItem() {}, removeItem() {} };
  const fakeWindow = {};
  // eslint-disable-next-line no-new-func
  const load = new Function('document', 'sessionStorage', 'window', 'fetch',
    `${js}\nreturn { issue, renderList, renderRequests, searchFromRequest };`);
  const exported = load(fakeDocument, fakeSessionStorage, fakeWindow, fakeFetch);
  return { ...exported, element, fetchCalls };
}

describe('the operator console', () => {
  it('emits JavaScript that actually parses', async () => {
    const js = script(await render());
    // The Function constructor parses without executing.
    expect(() => new Function(js)).not.toThrow();
  });

  it('has no collapsed-escape artefacts in generated handlers', async () => {
    const js = script(await render());
    expect(js).not.toMatch(/\(''\s*\+/);
    expect(js).not.toMatch(/\+\s*''\)/);
  });

  it('carries the whole operator loop, so nothing needs curl', async () => {
    const js = script(await render());
    for (const fn of ['function search', 'function choose', 'function renderQueue',
                      'function renderList', 'function issue', 'function revoke',
                      'function decide', 'function checks']) {
      expect(js).toContain(fn);
    }
  });

  it('holds the token in sessionStorage and never in a cookie or the URL', async () => {
    const js = script(await render());
    expect(js).toContain('sessionStorage');
    expect(js).not.toMatch(/document\.cookie/);
    // A token in a query string leaks through history, logs and referrers.
    expect(js).not.toMatch(/[?&]token=/);
  });

  it('is never indexed and never cached', async () => {
    const res = await onRequestGet();
    expect(res.headers.get('x-robots-tag')).toContain('noindex');
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('says plainly that issuing a link sends no email', async () => {
    const html = await render();
    expect(html).toMatch(/No se envía ningún correo|no se envía ningún correo/);
  });

  it('renders a preview button that calls issue with the preview argument', async () => {
    const html = await render();
    expect(html).toContain(`onclick="issue('\${esc(a.id)}','preview')"`);
    expect(html).toContain('Vista previa (14 días)');
  });

  it('renders a Comprobaciones button that calls checks for that attestation', async () => {
    const html = await render();
    expect(html).toContain(`onclick="checks('\${esc(a.id)}')"`);
    expect(html).toContain('Comprobaciones');
  });

  it('issue() sends kind only when given one, so a normal grant posts no kind field', async () => {
    const { issue, fetchCalls } = runClientScript(script(await render()));
    await issue('att-1');
    await issue('att-2', 'preview');
    const grantCalls = fetchCalls.filter((c) => c.path === '/api/verify/admin/grant');
    expect(grantCalls).toHaveLength(2);
    expect(grantCalls[0].body).not.toHaveProperty('kind');
    expect(grantCalls[1].body.kind).toBe('preview');
  });

  it('renders a Tipo column labelling preview and counterparty grants', async () => {
    const { renderList, element } = runClientScript(script(await render()));
    renderList([{
      id: 'a1', display_name: 'ACME SL', status: 'live', seat_officer_name: '',
      seat_position: '', accepted_at: '2026-01-01T00:00:00Z', expires_at: '2027-01-01T00:00:00Z',
      last_verified_at: '2026-01-01T00:00:00Z', status_reason: '',
      grants: [
        { token_hash: 'h1', label: 'x', kind: 'preview', created_at: '2026-01-01T00:00:00Z',
          access_count: 0, last_access_at: null, revoked_at: null },
        { token_hash: 'h2', label: 'y', kind: 'counterparty', created_at: '2026-01-01T00:00:00Z',
          access_count: 0, last_access_at: null, revoked_at: null },
      ],
    }]);
    const html = element('list').innerHTML;
    expect(html).toContain('<th>Tipo</th>');
    expect(html).toContain('vista previa');
    expect(html).toContain('contraparte');
  });

  it('renders the Solicitudes queue as the first section, above the audit chain', async () => {
    const html = await render();
    expect(html).toContain('Solicitudes recibidas');
    expect(html.indexOf('Solicitudes recibidas')).toBeLessThan(html.indexOf('Cadena de auditoría'));
  });

  it('still emits parseable JavaScript with the Solicitudes section wired in', async () => {
    // The header on this file explains why this matters: an escaping mistake
    // in the new section would produce HTML that looks fine and a script that
    // is syntactically broken. Re-asserted here so a Solicitudes regression
    // fails right next to the code that could cause it.
    const js = script(await render());
    expect(() => new Function(js)).not.toThrow();
    expect(js).not.toMatch(/\(''\s*\+/);
    expect(js).not.toMatch(/\+\s*''\)/);
  });

  it('renders a request row with a Buscar button that never carries authority', async () => {
    const { renderRequests, element } = runClientScript(script(await render()));
    renderRequests([{
      id: 'req_1', company_query: 'WAYPORT ADVISORS', nif: null,
      contact_name: 'Ana', contact_role: 'Administradora', contact_email: 'ana@example.com',
      referrer_note: null, operator_note: null, status: 'new',
      created_at: '2026-09-01T00:00:00Z',
    }]);
    const html = element('requests').innerHTML;
    expect(html).toContain('WAYPORT ADVISORS');
    expect(html).toContain('data-req-search="WAYPORT ADVISORS"');
    // No inline onclick with an interpolated id: the file's own delegated-
    // listener convention, kept for the same reason it exists elsewhere.
    expect(html).not.toMatch(/onclick=/);
  });

  it('the Buscar action fills #q with the request\'s company text and triggers the search', async () => {
    const { searchFromRequest, element, fetchCalls } = runClientScript(script(await render()));
    await searchFromRequest('WAYPORT ADVISORS');
    expect(element('q').value).toBe('WAYPORT ADVISORS');
    const lookupCalls = fetchCalls.filter((c) => c.path.startsWith('/api/verify/admin/lookup'));
    expect(lookupCalls).toHaveLength(1);
    expect(lookupCalls[0].path).toContain(encodeURIComponent('WAYPORT ADVISORS'));
  });
});
