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
                      'function decide']) {
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
});
