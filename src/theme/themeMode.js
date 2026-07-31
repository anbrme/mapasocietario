// Pure theme-mode logic. Deliberately free of React and of any global browser
// reference so it can be unit-tested under vitest's node environment, which is
// the only kind of test this repo runs (see vitest.config.js).

export const APP_ROUTE = '/app';
export const STORAGE_KEY = 'ms_theme_mode';
export const THEME_MODES = Object.freeze(['light', 'dark']);
export const DEFAULT_MODE = 'dark';

// Only /app may be light. Marketing pages pin their own dark background, and
// DueDiligencePage / OrderStatusPage / AdminPage layer translucent white panels
// over the global dark — they become unreadable on a light background.
export function isAppRoute(pathname) {
  if (typeof pathname !== 'string') return false;
  return pathname === APP_ROUTE || pathname === `${APP_ROUTE}/`;
}

export function normalizeMode(value) {
  return THEME_MODES.includes(value) ? value : DEFAULT_MODE;
}

export function resolveThemeMode({ stored, pathname }) {
  if (!isAppRoute(pathname)) return DEFAULT_MODE;
  return normalizeMode(stored);
}

export function readStoredMode(storage) {
  try {
    return normalizeMode(storage?.getItem(STORAGE_KEY));
  } catch {
    // Safari private mode throws on storage access. Dark is the safe default.
    return DEFAULT_MODE;
  }
}

export function writeStoredMode(storage, mode) {
  try {
    storage?.setItem(STORAGE_KEY, normalizeMode(mode));
  } catch {
    // Persistence is a nicety; failing to store must never break the toggle.
  }
}
