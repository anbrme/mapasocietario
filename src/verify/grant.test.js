import { describe, it, expect } from 'vitest';
import { grantState } from './grant.js';

const NOW = Date.parse('2026-09-08T12:00:00Z');

describe('grantState', () => {
  it('is valid with no expiry set', () => {
    expect(grantState({ expires_at: null, revoked_at: null }, NOW)).toBe('valid');
  });
  it('is valid before expiry', () => {
    expect(grantState({ expires_at: '2026-10-01T00:00:00Z', revoked_at: null }, NOW)).toBe('valid');
  });
  it('is expired after expiry', () => {
    expect(grantState({ expires_at: '2026-09-01T00:00:00Z', revoked_at: null }, NOW)).toBe('expired');
  });
  it('is revoked even when unexpired', () => {
    expect(grantState({ expires_at: null, revoked_at: '2026-09-07T00:00:00Z' }, NOW)).toBe('revoked');
  });
  it('is missing for a null row', () => {
    expect(grantState(null, NOW)).toBe('missing');
  });
});
