// Pure theme-mode logic. Deliberately free of React and of any global browser
// reference so it can be unit-tested under vitest's node environment, which is
// the only kind of test this repo runs (see vitest.config.js).

export const APP_ROUTE = '/app';
export const STORAGE_KEY = 'ms_theme_mode';
export const THEME_MODES = Object.freeze(['light', 'dark']);
export const DEFAULT_MODE = 'dark';

// /app may be light via its toggle; the landing follows the operating system;
// every other marketing page pins dark. DueDiligencePage / OrderStatusPage /
// AdminPage layer translucent white panels over the global dark — they become
// unreadable on a light background.
export function isAppRoute(pathname) {
  if (typeof pathname !== 'string') return false;
  return pathname === APP_ROUTE || pathname === `${APP_ROUTE}/`;
}

export const LANDING_ROUTES = Object.freeze(['/', '/es', '/es/']);

export function isLandingRoute(pathname) {
  return typeof pathname === 'string' && LANDING_ROUTES.includes(pathname);
}

export function normalizeMode(value) {
  return THEME_MODES.includes(value) ? value : DEFAULT_MODE;
}

// `systemPrefersLight` is the prefers-color-scheme media query, passed in so
// this stays testable without a window. The stored value is the /app toggle
// and never reaches the landing: it was asked to follow the system instead.
export function resolveThemeMode({ stored, pathname, systemPrefersLight = false }) {
  if (isAppRoute(pathname)) return normalizeMode(stored);
  if (isLandingRoute(pathname)) return systemPrefersLight ? 'light' : DEFAULT_MODE;
  return DEFAULT_MODE;
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
