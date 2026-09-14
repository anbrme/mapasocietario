import { describe, it, expect } from 'vitest';
import { listPromotedCompanies } from './_demand.js';

function captureDb() {
  const calls = [];
  const db = {
    prepare(sql) {
      return { bind(...binds) { calls.push({ sql, binds }); return { all: async () => ({ results: [] }) }; } };
    },
  };
  return { db, calls };
}

describe('listPromotedCompanies', () => {
  it('lists every promoted row when no bounds are given', async () => {
    const { db, calls } = captureDb();
    await listPromotedCompanies(db, { limit: 10, offset: 5 });
    expect(calls[0].sql).not.toMatch(/promoted_at [<>]/);
    expect(calls[0].binds).toEqual(['promoted', 10, 5]);
  });

  it('applies from and before as half-open bounds on promoted_at', async () => {
    const { db, calls } = captureDb();
    await listPromotedCompanies(db, { limit: 10, offset: 0, from: '2026-09-07', before: '2026-10-01' });
    expect(calls[0].sql).toMatch(/promoted_at >= \?/);
    expect(calls[0].sql).toMatch(/promoted_at < \?/);
    expect(calls[0].binds).toEqual(['promoted', '2026-09-07', '2026-10-01', 10, 0]);
  });

  it('returns an empty list without a db', async () => {
    expect(await listPromotedCompanies(null, { limit: 1, offset: 0 })).toEqual([]);
  });
});
