import { describe, it, expect } from 'vitest';
import { evidenceKeys, putEvidenceOnce } from './evidence.js';

function fakeBucket(initial = {}) {
  const store = { ...initial };
  return {
    store,
    async put(key, body, options) {
      // Mirrors R2: a failed precondition returns null rather than throwing.
      const ifNoneMatch = options?.onlyIf?.get?.('If-None-Match');
      if (ifNoneMatch === '*' && key in store) return null;
      store[key] = body;
      return { key };
    },
    async get(key) {
      if (!(key in store)) return null;
      return { text: async () => store[key] };
    },
  };
}

describe('evidenceKeys', () => {
  it('splits sealed from personal under separate prefixes', () => {
    expect(evidenceKeys('abc')).toEqual({
      sealed: 'evidence/sealed/abc.json',
      personal: 'evidence/personal/abc.json',
    });
  });
});

describe('putEvidenceOnce', () => {
  it('creates an object that is not there', async () => {
    const bucket = fakeBucket();
    expect(await putEvidenceOnce(bucket, 'k', '{"a":1}')).toBe('created');
    expect(bucket.store.k).toBe('{"a":1}');
  });
  it('verifies and continues when the same body is already there (a retry)', async () => {
    const bucket = fakeBucket({ k: '{"a":1}' });
    expect(await putEvidenceOnce(bucket, 'k', '{"a":1}')).toBe('verified');
  });
  it('THROWS when a different body already occupies a hash-derived key', async () => {
    const bucket = fakeBucket({ k: '{"a":2}' });
    await expect(putEvidenceOnce(bucket, 'k', '{"a":1}')).rejects.toThrow('evidence_digest_mismatch');
  });
});
