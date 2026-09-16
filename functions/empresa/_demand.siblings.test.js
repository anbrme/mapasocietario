import { describe, it, expect, vi } from 'vitest';
import { listPromotedSiblings } from './_demand.js';
import { SIBLINGS_LIMIT } from './_siblings.js';

/**
 * Stub D1: `.all()` answers the province-count query, `.batch()` captures the
 * two sibling statements and answers them in order.
 */
function stubDb({ provinces = [], before = [], after = [], fail = null } = {}) {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...binds) {
          const statement = { sql, binds };
          return {
            ...statement,
            all: async () => {
              if (fail === 'counts') throw new Error(fail);
              calls.push(statement);
              return { results: provinces.map((province) => ({ province, total: 1 })) };
            },
          };
        },
      };
    },
    batch: async (statements) => {
      if (fail === 'batch') throw new Error(fail);
      calls.push(...statements);
      return [{ results: before }, { results: after }];
    },
  };
  return { db, calls };
}

const ARGS = { province: 'Almería', slug: 'b-sl', name: 'B SL' };

describe('listPromotedSiblings', () => {
  it('matches every stored spelling of the province, folded the way the hubs fold them', async () => {
    const { db, calls } = stubDb({ provinces: ['Almería', 'ALMERÍA', 'ALMERIA', 'Madrid'] });
    await listPromotedSiblings(db, ARGS);
    const [, beforeStmt, afterStmt] = calls;
    expect(beforeStmt.sql).toMatch(/province IN \(\?, \?, \?\)/);
    expect(beforeStmt.sql).not.toMatch(/UPPER\(/);
    expect(beforeStmt.binds).toEqual(['promoted', 'Almería', 'ALMERÍA', 'ALMERIA', 'b-sl', 'B SL', SIBLINGS_LIMIT]);
    expect(afterStmt.binds).toEqual(beforeStmt.binds);
  });

  it('pairs < with DESC and > with ASC, excluding the page itself, in one batch', async () => {
    const { db, calls } = stubDb({ provinces: ['Almería'], before: [{ slug: 'a-sl' }], after: [{ slug: 'c-sl' }] });
    const out = await listPromotedSiblings(db, ARGS);
    const [, beforeStmt, afterStmt] = calls;
    expect(beforeStmt.sql).toMatch(/canonical_name < \?[\s\S]*ORDER BY canonical_name DESC/);
    expect(afterStmt.sql).toMatch(/canonical_name > \?[\s\S]*ORDER BY canonical_name ASC/);
    expect(beforeStmt.sql).toMatch(/slug <> \?/);
    expect(out).toEqual({ before: [{ slug: 'a-sl' }], after: [{ slug: 'c-sl' }] });
  });

  it('answers empty without a db, a province, a name, or any promoted row in that province', async () => {
    const none = { before: [], after: [] };
    expect(await listPromotedSiblings(null, ARGS)).toEqual(none);
    expect(await listPromotedSiblings(stubDb().db, { ...ARGS, province: '' })).toEqual(none);
    expect(await listPromotedSiblings(stubDb().db, { ...ARGS, name: '' })).toEqual(none);
    const { db, calls } = stubDb({ provinces: ['Madrid'] });
    expect(await listPromotedSiblings(db, ARGS)).toEqual(none);
    expect(calls).toHaveLength(1); // no sibling batch when the province has no promoted rows
  });

  it('logs and degrades to empty when D1 fails, instead of throwing or going silent', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      for (const fail of ['counts', 'batch']) {
        const { db } = stubDb({ provinces: ['Almería'], fail });
        await expect(listPromotedSiblings(db, ARGS)).resolves.toEqual({ before: [], after: [] });
      }
      expect(error).toHaveBeenCalledTimes(2);
      expect(error.mock.calls[0][0]).toMatch(/\[company-index\] siblings lookup failed/);
    } finally {
      error.mockRestore();
    }
  });
});
