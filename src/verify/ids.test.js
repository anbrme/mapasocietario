import { describe, it, expect } from 'vitest';
import { newId, newToken, tokenHash } from './ids.js';

describe('newId', () => {
  it('prefixes and is long enough not to be guessed', () => {
    const id = newId('att');
    expect(id.startsWith('att_')).toBe(true);
    expect(id.length).toBeGreaterThanOrEqual(26);
  });
  it('does not repeat across many draws', () => {
    const seen = new Set(Array.from({ length: 5000 }, () => newId('att')));
    expect(seen.size).toBe(5000);
  });
});

describe('newToken / tokenHash', () => {
  it('stores a hash, never the token', async () => {
    const t = newToken();
    const h = await tokenHash(t);
    expect(h).toHaveLength(64);
    expect(h).not.toContain(t);
  });
  it('is stable for the same token', async () => {
    const t = newToken();
    expect(await tokenHash(t)).toBe(await tokenHash(t));
  });
});
