import { describe, it, expect } from 'vitest';
import {
  grantState, normalizeGrantKind, grantPath,
  GRANT_KINDS, DEFAULT_TTL_DAYS, PREVIEW_TTL_DAYS,
} from './grant.js';

describe('grantState', () => {
  const now = Date.parse('2026-09-10T00:00:00Z');
  it('is missing for no row', () => expect(grantState(null, now)).toBe('missing'));
  it('is revoked when revoked_at is set', () =>
    expect(grantState({ revoked_at: '2026-09-09T00:00:00Z' }, now)).toBe('revoked'));
  it('is expired at or past the expiry', () =>
    expect(grantState({ expires_at: '2026-09-10T00:00:00Z' }, now)).toBe('expired'));
  it('is valid otherwise', () =>
    expect(grantState({ expires_at: '2026-09-11T00:00:00Z' }, now)).toBe('valid'));
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
