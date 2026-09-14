import { describe, it, expect } from 'vitest';
import { DEMAND_WAVES, assertWaves, waveBounds, demandSitemapFiles } from './_waves.js';

const WAVES = [
  { file: 'sitemap-demand.xml' },
  { file: 'sitemap-demand-2.xml', from: '2026-09-07' },
  { file: 'sitemap-demand-3.xml', from: '2026-10-01' },
];

describe('waveBounds', () => {
  it('bounds the first wave only from above', () => {
    expect(waveBounds(1, WAVES)).toEqual({ from: null, before: '2026-09-07' });
  });
  it('bounds a middle wave on both sides', () => {
    expect(waveBounds(2, WAVES)).toEqual({ from: '2026-09-07', before: '2026-10-01' });
  });
  it('bounds the last wave only from below', () => {
    expect(waveBounds(3, WAVES)).toEqual({ from: '2026-10-01', before: null });
  });
  it('returns null for a wave that does not exist', () => {
    expect(waveBounds(4, WAVES)).toBeNull();
    expect(waveBounds(0, WAVES)).toBeNull();
    expect(waveBounds('x', WAVES)).toBeNull();
  });
});

describe('assertWaves', () => {
  it('accepts the committed waves', () => {
    expect(() => assertWaves(DEMAND_WAVES)).not.toThrow();
  });
  it('rejects a later wave without a from date', () => {
    expect(() => assertWaves([{ file: 'a.xml' }, { file: 'b.xml' }])).toThrow(/from/);
  });
  it('rejects from dates that do not increase', () => {
    expect(() => assertWaves([
      { file: 'a.xml' }, { file: 'b.xml', from: '2026-09-07' }, { file: 'c.xml', from: '2026-09-07' },
    ])).toThrow(/increase/);
  });
  it('rejects a duplicate file name', () => {
    expect(() => assertWaves([{ file: 'a.xml' }, { file: 'a.xml', from: '2026-09-07' }])).toThrow(/file/);
  });
});

describe('demandSitemapFiles', () => {
  it('lists every wave file in order', () => {
    expect(demandSitemapFiles(WAVES)).toEqual(['sitemap-demand.xml', 'sitemap-demand-2.xml', 'sitemap-demand-3.xml']);
  });
  it('keeps the original demand file first in the committed list', () => {
    expect(demandSitemapFiles()[0]).toBe('sitemap-demand.xml');
    expect(demandSitemapFiles()).toContain('sitemap-demand-2.xml');
  });
});
