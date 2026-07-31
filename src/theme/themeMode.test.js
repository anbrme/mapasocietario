import { describe, expect, it } from 'vitest';
import {
  APP_ROUTE,
  DEFAULT_MODE,
  STORAGE_KEY,
  isAppRoute,
  normalizeMode,
  readStoredMode,
  resolveThemeMode,
  writeStoredMode,
} from './themeMode';

// Minimal stand-in for window.localStorage. The real thing is unavailable in
// vitest's node environment, which is exactly why themeMode takes storage as a
// parameter instead of reaching for a global.
const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: key => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    snapshot: () => ({ ...data }),
  };
};

const throwingStorage = () => ({
  getItem: () => { throw new Error('SecurityError: storage disabled'); },
  setItem: () => { throw new Error('SecurityError: storage disabled'); },
});

describe('isAppRoute', () => {
  it('matches the app route exactly', () => {
    expect(isAppRoute(APP_ROUTE)).toBe(true);
  });

  it('matches the app route with a trailing slash', () => {
    expect(isAppRoute('/app/')).toBe(true);
  });

  it('rejects the landing page and marketing routes', () => {
    expect(isAppRoute('/')).toBe(false);
    expect(isAppRoute('/pricing')).toBe(false);
    expect(isAppRoute('/due-diligence')).toBe(false);
  });

  it('rejects a route that merely starts with the same characters', () => {
    expect(isAppRoute('/application-form')).toBe(false);
  });

  it('treats a missing pathname as not the app route', () => {
    expect(isAppRoute(undefined)).toBe(false);
    expect(isAppRoute(null)).toBe(false);
  });
});

describe('normalizeMode', () => {
  it('passes through the two valid modes', () => {
    expect(normalizeMode('light')).toBe('light');
    expect(normalizeMode('dark')).toBe('dark');
  });

  it('falls back to dark for unrecognised, corrupt or missing values', () => {
    expect(normalizeMode('LIGHT')).toBe(DEFAULT_MODE);
    expect(normalizeMode('sepia')).toBe(DEFAULT_MODE);
    expect(normalizeMode('')).toBe(DEFAULT_MODE);
    expect(normalizeMode(null)).toBe(DEFAULT_MODE);
    expect(normalizeMode(undefined)).toBe(DEFAULT_MODE);
    expect(normalizeMode({ mode: 'light' })).toBe(DEFAULT_MODE);
  });
});

describe('resolveThemeMode', () => {
  it('honours a stored light mode on the app route', () => {
    expect(resolveThemeMode({ stored: 'light', pathname: '/app' })).toBe('light');
  });

  it('forces dark off the app route even when light is stored', () => {
    expect(resolveThemeMode({ stored: 'light', pathname: '/' })).toBe('dark');
    expect(resolveThemeMode({ stored: 'light', pathname: '/pricing' })).toBe('dark');
    expect(resolveThemeMode({ stored: 'light', pathname: '/admin' })).toBe('dark');
  });

  it('defaults to dark on the app route when nothing is stored', () => {
    expect(resolveThemeMode({ stored: null, pathname: '/app' })).toBe('dark');
  });

  it('defaults to dark when a corrupt value is stored', () => {
    expect(resolveThemeMode({ stored: 'sepia', pathname: '/app' })).toBe('dark');
  });
});

describe('readStoredMode', () => {
  it('reads a previously persisted mode', () => {
    expect(readStoredMode(fakeStorage({ [STORAGE_KEY]: 'light' }))).toBe('light');
  });

  it('returns dark when the key is absent', () => {
    expect(readStoredMode(fakeStorage())).toBe(DEFAULT_MODE);
  });

  it('returns dark when storage throws', () => {
    expect(readStoredMode(throwingStorage())).toBe(DEFAULT_MODE);
  });

  it('returns dark when storage is missing entirely', () => {
    expect(readStoredMode(null)).toBe(DEFAULT_MODE);
    expect(readStoredMode(undefined)).toBe(DEFAULT_MODE);
  });
});

describe('writeStoredMode', () => {
  it('persists a valid mode under the storage key', () => {
    const storage = fakeStorage();
    writeStoredMode(storage, 'light');
    expect(storage.snapshot()).toEqual({ [STORAGE_KEY]: 'light' });
  });

  it('normalizes before writing so no invalid value can be persisted', () => {
    const storage = fakeStorage();
    writeStoredMode(storage, 'sepia');
    expect(storage.snapshot()).toEqual({ [STORAGE_KEY]: DEFAULT_MODE });
  });

  it('does not throw when storage is unavailable', () => {
    expect(() => writeStoredMode(throwingStorage(), 'light')).not.toThrow();
    expect(() => writeStoredMode(null, 'light')).not.toThrow();
  });
});
