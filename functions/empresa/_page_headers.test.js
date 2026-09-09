import { describe, it, expect } from 'vitest';
import { companyPageHeaders } from './_page_headers.js';

describe('companyPageHeaders', () => {
  it('lets an indexable page sit in the shared cache for an hour', () => {
    const h = companyPageHeaders({});
    expect(h['cache-control']).toBe(
      'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    expect(h['x-robots-tag']).toBeUndefined();
  });

  it('shortens the shared cache for a noindex page', () => {
    expect(companyPageHeaders({ noindex: true })['cache-control'])
      .toBe('public, max-age=0, s-maxage=600');
  });

  it('never lets a private response reach a shared cache', () => {
    const h = companyPageHeaders({ privateResponse: true });
    expect(h['cache-control']).toBe('private, no-store');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['x-robots-tag']).toBe('noindex, nofollow, noarchive');
  });

  it('keeps a private response private even when noindex is false', () => {
    expect(companyPageHeaders({ noindex: false, privateResponse: true })['cache-control'])
      .toBe('private, no-store');
  });

  it('always sets the content type', () => {
    for (const opts of [{}, { noindex: true }, { privateResponse: true }]) {
      expect(companyPageHeaders(opts)['content-type']).toBe('text/html; charset=utf-8');
    }
  });
});
