import { describe, it, expect } from 'vitest';
import { demandWaveResponse } from './_demandWave.js';

const WAVES = [
  { file: 'sitemap-demand.xml' },
  { file: 'sitemap-demand-2.xml', from: '2026-09-07' },
];

function fakeDb(rows) {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...binds) {
          calls.push({ sql, binds });
          return { all: async () => ({ results: rows }) };
        },
      };
    },
  };
  return { db, calls };
}

describe('demandWaveResponse', () => {
  it('404s without the D1 binding', async () => {
    const res = await demandWaveResponse({}, 1, WAVES);
    expect(res.status).toBe(404);
  });

  it('404s for a wave that is not declared', async () => {
    const { db } = fakeDb([{ slug: 'acme-sl', promoted_at: '2026-09-07 10:20:00' }]);
    const res = await demandWaveResponse({ SEO_DB: db }, 3, WAVES);
    expect(res.status).toBe(404);
  });

  it('serves wave 1 as everything promoted before wave 2 began', async () => {
    const { db, calls } = fakeDb([{ slug: 'maier-navarra-sl', promoted_at: '2026-08-17 13:33:00' }]);
    const res = await demandWaveResponse({ SEO_DB: db }, 1, WAVES);
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toMatch(/promoted_at < \?/);
    expect(calls[0].sql).not.toMatch(/promoted_at >= \?/);
    expect(calls[0].binds).toContain('2026-09-07');
    const xml = await res.text();
    expect(xml).toContain('<loc>https://mapasocietario.es/empresa/maier-navarra-sl</loc>');
    expect(xml).toContain('<lastmod>2026-08-17</lastmod>');
  });

  it('serves the last wave as everything promoted since it began', async () => {
    const { db, calls } = fakeDb([{ slug: 'henkel-iberica-sa', promoted_at: '2026-09-07 10:20:00' }]);
    const res = await demandWaveResponse({ SEO_DB: db }, 2, WAVES);
    expect(res.status).toBe(200);
    expect(calls[0].sql).toMatch(/promoted_at >= \?/);
    expect(calls[0].sql).not.toMatch(/promoted_at < \?/);
    expect(calls[0].binds).toContain('2026-09-07');
    expect(await res.text()).toContain('/en/company/henkel-iberica-sa</loc>');
  });

  it('404s an empty wave instead of serving an empty urlset', async () => {
    const { db } = fakeDb([]);
    const res = await demandWaveResponse({ SEO_DB: db }, 2, WAVES);
    expect(res.status).toBe(404);
  });
});
