import { describe, it, expect } from 'vitest';
import {
  candidateFromDoc,
  isEligibleCandidate,
  rankAndDedupe,
  promotionSql,
  promotionSqlChunks,
} from './promote-batch-lib.mjs';

const richDoc = {
  company_name: 'JAMONES CENTELLES SL',
  province: 'Barcelona',
  hojas: ['B-305925'],
  enriched_nif: 'B63866784',
  current_capital: 2178600,
  officers_active: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
  total_publications: 14,
  last_seen: '2026-05-18',
  is_dissolved: false,
};

describe('candidateFromDoc', () => {
  it('normalizes a live v3 company doc', () => {
    const c = candidateFromDoc(richDoc, 'H:B-305925');
    expect(c).toMatchObject({
      group_key: 'H:B-305925',
      slug: 'jamones-centelles-sl',
      province: 'Barcelona',
      hoja: 'B-305925',
      nif: 'B63866784',
      capital: 2178600,
      active_officers: 3,
      publications: 14,
      is_dissolved: false,
    });
  });

  it('prefers the registry nif over the enriched one and returns null without a name', () => {
    const c = candidateFromDoc({ ...richDoc, nif: 'B00000000' }, 'H:B-1');
    expect(c.nif).toBe('B00000000');
    expect(candidateFromDoc({ province: 'Madrid' }, 'H:M-1')).toBeNull();
  });
});

describe('isEligibleCandidate', () => {
  const base = candidateFromDoc(richDoc, 'H:B-305925');

  it('accepts a substantial, active company', () => {
    expect(isEligibleCandidate(base)).toBe(true);
  });

  it.each([
    ['dissolved', { is_dissolved: true }],
    ['no NIF', { nif: null }],
    ['no active officers', { active_officers: 0 }],
    ['no capital', { capital: null }],
    ['zero capital', { capital: 0 }],
    ['one publication only', { publications: 1 }],
    ['stale activity', { last_seen: '2019-06-01' }],
    ['missing last_seen', { last_seen: null }],
  ])('rejects: %s', (_label, patch) => {
    expect(isEligibleCandidate({ ...base, ...patch })).toBe(false);
  });
});

describe('rankAndDedupe', () => {
  const make = (key, slug, capital, patch = {}) => ({
    ...candidateFromDoc(richDoc, key),
    slug,
    capital,
    ...patch,
  });

  it('ranks by capital, drops ineligible rows and respects size', () => {
    const picked = rankAndDedupe(
      [
        make('H:1', 'a', 100),
        make('H:2', 'b', 900),
        make('H:3', 'c', 500),
        make('H:4', 'd', 9999, { is_dissolved: true }),
      ],
      { size: 2 },
    );
    expect(picked.map((c) => c.group_key)).toEqual(['H:2', 'H:3']);
  });

  it('gives a contested slug to the highest-capital company and skips excluded slugs', () => {
    const picked = rankAndDedupe(
      [make('H:1', 'same', 100), make('H:2', 'same', 900), make('H:3', 'taken', 500)],
      { size: 10, excludeSlugs: new Set(['taken']) },
    );
    expect(picked).toHaveLength(1);
    expect(picked[0].group_key).toBe('H:2');
  });
});

describe('promotionSql', () => {
  const row = {
    group_key: 'H:B-305925',
    slug: 'jamones-centelles-sl',
    name: "JAMONES O'CENTELLES SL",
    province: 'Barcelona',
    hoja: 'B-305925',
    nif: 'B63866784',
  };

  it('escapes quotes and guards against a foreign promoted slug', () => {
    const sql = promotionSql(row);
    expect(sql).toContain("'JAMONES O''CENTELLES SL'");
    expect(sql).toContain("WHERE slug = 'jamones-centelles-sl' AND status = 'promoted' AND group_key <> 'H:B-305925'");
    expect(sql).toContain('ON CONFLICT(group_key) DO UPDATE');
    expect(sql).toContain("'promoted'");
  });

  it('renders missing optional fields as NULL', () => {
    const sql = promotionSql({ ...row, province: null, hoja: null, nif: null });
    expect(sql).toMatch(/SELECT 'H:B-305925', 'jamones-centelles-sl', 'JAMONES O''CENTELLES SL', NULL, NULL, NULL, 'promoted'/);
  });

  it('preserves demand counters on conflict (no counter columns touched)', () => {
    const sql = promotionSql(row);
    expect(sql).not.toContain('search_render_count');
    expect(sql).not.toContain('full_profile_click_count');
  });
});

describe('promotionSqlChunks', () => {
  it('splits rows into chunkSize-statement files', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      group_key: `H:${i}`,
      slug: `s-${i}`,
      name: `S ${i}`,
    }));
    const chunks = promotionSqlChunks(rows, { chunkSize: 2 });
    expect(chunks).toHaveLength(3);
    expect(chunks[0].match(/INSERT INTO company_index_candidates/g)).toHaveLength(2);
    expect(chunks[2].match(/INSERT INTO company_index_candidates/g)).toHaveLength(1);
  });
});
