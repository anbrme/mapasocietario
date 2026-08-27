import { describe, it, expect } from 'vitest';
import { renderCompanyPage, jsVal } from './_lib.js';

const COMPANY = {
  company_name: 'ACME TEST SL',
  nif: 'B12345678',
  last_seen: '2026-08-01',
  total_publications: 3,
};
const SEED = { name: 'ACME TEST SL' };

const render = (lang) => renderCompanyPage(COMPANY, [], 'acme-test-sl', SEED, lang);

describe('the free-monitoring block on a company page', () => {
  it('offers monitoring in both languages, without claiming a purchase is needed', () => {
    const es = render('es');
    expect(es).toContain('Sigue esta empresa');
    expect(es).toContain('sin comprar nada');
    expect(es).toContain('id="mon-form"');

    const en = render('en');
    expect(en).toContain('Follow this company');
    expect(en).toContain('nothing to buy');
    expect(en).toContain('id="mon-form"');
  });

  it('posts to the alerts request endpoint with the company name', () => {
    const html = render('es');
    expect(html).toContain("/bormes/v3/alerts/request");
    expect(html).toContain('entity_name:NAME');
    expect(html).toContain('var NAME="ACME TEST SL"');
  });

  it('sits after the paid report CTA, so it cannot outrank it', () => {
    const html = render('es');
    expect(html.indexOf('profile_due_diligence')).toBeLessThan(html.indexOf('id="mon-form"'));
  });

  // The GA snippet on these very pages was dead for six days because a `\/`
  // inside a template literal collapsed to `/` and opened a line comment.
  // Any backslash in emitted inline JS is the same hazard, so this block is
  // written without one — assert that, rather than trusting review.
  it('emits inline script free of backslash escapes', () => {
    const html = render('es');
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    const monitorScript = scripts.find((s) => s.includes('mon-form'));
    expect(monitorScript).toBeDefined();
    expect(monitorScript).not.toContain('\\');
  });

  // The page must not reject an address the in-app dialog would accept, or the
  // same person gets different answers on two of our own surfaces. Mirrors
  // EMAIL_RE in src/services/monitoringService.js — deliberately loose, because
  // the confirmation email is the real validation.
  it('accepts exactly what the in-app monitoring dialog accepts', () => {
    const html = render('es');
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
      .map((m) => m[1]).find((s) => s.includes('mon-form'));
    const body = script.match(/function looksLikeEmail\(v\)\{[\s\S]*?\n  \}/)[0];
    // A named declaration inside eval() leaves no binding behind in strict
    // mode; turn it into an anonymous expression so eval returns the fn.
    // eslint-disable-next-line no-eval
    const check = eval(`(${body.replace('function looksLikeEmail', 'function')})`);

    const APP_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cases = [
      'a@b.co', 'ana.perez@empresa.es', 'a@b.c.', 'x+tag@sub.domain.es',
      'nope', 'a@b', 'a b@c.co', '@b.co', 'a@@b.co', '', 'a@.co',
    ];
    for (const c of cases) {
      expect([c, check(c)]).toEqual([c, APP_EMAIL_RE.test(c)]);
    }
  });

  it('does not let a hostile company name close the script tag', () => {
    const html = renderCompanyPage(
      { ...COMPANY, company_name: 'EVIL</script><script>alert(1)</script> SL' },
      [], 'evil-sl', { name: 'EVIL</script><script>alert(1)</script> SL' }, 'es',
    );
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('jsVal', () => {
  it('escapes < so an embedded value cannot terminate the script tag', () => {
    expect(jsVal('</script>')).toBe('"\\u003c/script>"');
  });

  it('renders null and undefined as an empty string, never as a literal null', () => {
    expect(jsVal(null)).toBe('""');
    expect(jsVal(undefined)).toBe('""');
  });
});
