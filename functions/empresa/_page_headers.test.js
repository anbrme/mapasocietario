import { describe, it, expect } from 'vitest';
import { companyPageHeaders, notFoundPageHeaders } from './_page_headers.js';

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

describe('notFoundPageHeaders', () => {
  it('caches a fallback miss briefly, as before', () => {
    expect(notFoundPageHeaders({ isFallback: true })['cache-control'])
      .toBe('public, s-maxage=600');
  });

  it('never caches a miss on a curated slug: that is probably a backend blip', () => {
    expect(notFoundPageHeaders({ isFallback: false })['cache-control']).toBe('no-store');
  });

  it('never caches a private miss, whatever isFallback says', () => {
    for (const isFallback of [true, false]) {
      const h = notFoundPageHeaders({ isFallback, privateResponse: true });
      expect(h['cache-control']).toBe('private, no-store');
      expect(h['x-robots-tag']).toBe('noindex, nofollow, noarchive');
      expect(h['referrer-policy']).toBe('no-referrer');
    }
  });
});
