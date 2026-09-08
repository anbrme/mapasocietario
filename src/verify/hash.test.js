import { describe, it, expect } from 'vitest';
import { canonicalJson, sha256Hex, hashCanonical } from './hash.js';

describe('canonicalJson', () => {
  it('is independent of key insertion order', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });
  it('sorts nested keys too', () => {
    expect(canonicalJson({ x: { z: 1, y: 2 } })).toBe('{"x":{"y":2,"z":1}}');
  });
  it('preserves array order, which is meaningful', () => {
    expect(canonicalJson([2, 1])).toBe('[2,1]');
  });
  it('omits undefined but keeps null, which is a declared value', () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe('sha256Hex', () => {
  it('matches the known digest of the empty string', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('hashCanonical', () => {
  it('gives one hash for two orderings of the same object', async () => {
    expect(await hashCanonical({ b: 1, a: 2 })).toBe(await hashCanonical({ a: 2, b: 1 }));
  });
});
