import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onRequestPost } from './request.js';

const body = (o = {}) => JSON.stringify({
  company_query: 'ACME SOLUCIONES SL',
  contact_name: 'Ana Gómez',
  contact_role: 'Administradora única',
  contact_email: 'ana@acme.es',
  turnstileToken: 'tok',
  ...o,
});

const post = (b) => new Request('https://mapasocietario.es/api/verify/request', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: b,
});

function fakeEnv() {
  const writes = [];
  return {
    writes,
    VERIFY_TURNSTILE_SECRET: 'secret',
    CLOUDFLARE_EMAIL_API_TOKEN: 'mail-token',
    VERIFY_DB: {
      prepare(sql) {
        return { bind: (...args) => ({ run: async () => { writes.push({ sql, args }); return {}; } }) };
      },
    },
  };
}

beforeEach(() => {
  globalThis.fetch = vi.fn(async (url) => {
    if (String(url).includes('siteverify')) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response('{}', { status: 200 }); // the mail send
  });
});
afterEach(() => { vi.restoreAllMocks(); });

describe('POST /api/verify/request', () => {
  it('records a valid request and acknowledges it', async () => {
    const env = fakeEnv();
    const res = await onRequestPost({ request: post(body()), env });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(env.writes).toHaveLength(1);
    expect(env.writes[0].sql).toContain('INSERT INTO verification_requests');
  });

  it('is not an oracle: the response is identical for a fictional company', async () => {
    const real = await onRequestPost({ request: post(body()), env: fakeEnv() });
    const made = await onRequestPost({
      request: post(body({ company_query: 'EMPRESA QUE NO EXISTE SL' })), env: fakeEnv() });
    expect(await real.text()).toBe(await made.text());
    expect(real.status).toBe(made.status);
  });

  it('writes nothing when Turnstile fails', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ success: false }), { status: 200 }));
    const env = fakeEnv();
    const res = await onRequestPost({ request: post(body()), env });
    expect(res.status).toBe(400);
    expect(env.writes).toHaveLength(0);
  });

  it('fails CLOSED when the Turnstile secret is missing', async () => {
    const env = fakeEnv();
    delete env.VERIFY_TURNSTILE_SECRET;
    const res = await onRequestPost({ request: post(body()), env });
    expect(res.status).toBe(400);
    expect(env.writes).toHaveLength(0);
  });

  it('pretends success for a filled honeypot, and writes nothing', async () => {
    const env = fakeEnv();
    const res = await onRequestPost({ request: post(body({ website: 'spam' })), env });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(env.writes).toHaveLength(0);
  });

  it('reports a consumer domain distinctly so the form can point at the field', async () => {
    const env = fakeEnv();
    const res = await onRequestPost({
      request: post(body({ contact_email: 'ana@gmail.com' })), env });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('contact_email_not_corporate');
    expect(data.field).toBe('contact_email');
    expect(env.writes).toHaveLength(0);
  });

  it('rejects a malformed body', async () => {
    const res = await onRequestPost({ request: post('not json'), env: fakeEnv() });
    expect(res.status).toBe(400);
  });

  it('still records the request when the notification mail fails', async () => {
    globalThis.fetch = vi.fn(async (url) => String(url).includes('siteverify')
      ? new Response(JSON.stringify({ success: true }), { status: 200 })
      : new Response('nope', { status: 500 }));
    const env = fakeEnv();
    const res = await onRequestPost({ request: post(body()), env });
    // The row is what matters; a failed notification must not lose the lead.
    expect(res.status).toBe(200);
    expect(env.writes).toHaveLength(1);
  });
});
