import { describe, it, expect } from 'vitest';
import {
  grantState, normalizeGrantKind, grantPath,
  GRANT_KINDS, DEFAULT_TTL_DAYS, PREVIEW_TTL_DAYS,
} from './grant.js';

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
  // Added with the preview-grant work: the original set covered "after
  // expiry" but not the boundary, and grantState uses <=.
  it('is expired at the exact expiry instant', () => {
    expect(grantState({ expires_at: '2026-09-08T12:00:00Z', revoked_at: null }, NOW)).toBe('expired');
  });
});

describe('normalizeGrantKind', () => {
  it('defaults to counterparty when absent', () => {
    for (const absent of [undefined, null, '']) {
      expect(normalizeGrantKind(absent)).toBe('counterparty');
    }
  });
  it('accepts every declared kind', () => {
    for (const k of GRANT_KINDS) expect(normalizeGrantKind(k)).toBe(k);
  });
  it('rejects anything else with null, so the endpoint can 400', () => {
    for (const bad of ['admin', 'PREVIEW', 0, {}, 'counterparty ']) {
      expect(normalizeGrantKind(bad)).toBeNull();
    }
  });
});

describe('grantPath', () => {
  it('sends a preview to its own route', () =>
    expect(grantPath('preview', 'tok')).toBe('/verificacion/p/tok'));
  it('sends a counterparty grant to the attestation route', () =>
    expect(grantPath('counterparty', 'tok')).toBe('/verificacion/g/tok'));
});

describe('ttl defaults', () => {
  it('is 90 days for a counterparty and 14 for a preview', () => {
    expect(DEFAULT_TTL_DAYS).toBe(90);
    expect(PREVIEW_TTL_DAYS).toBe(14);
  });
});
