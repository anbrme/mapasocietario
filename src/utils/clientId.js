// Stable per-browser client id for the corrections overlay.
//
// Corrections (graph edits that feed a "Custom" DD) are scoped per user. Public
// visitors have no account, so we mint a random UUID once and persist it in
// localStorage. A logged-in user's id should take precedence when available
// (wire that in later); until then every caller goes through getClientId().

const STORAGE_KEY = 'mapa_client_id';

function randomUuid() {
  // crypto.randomUUID is available in all browsers we target; fall back just in case.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback (non-crypto) — only hit on very old engines.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get the current browser's client id, creating and persisting one on first use.
 * Returns a stable string for the life of the browser profile.
 */
export function getClientId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = randomUuid();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private mode / SSR) — return an ephemeral id so
    // the session still works; it just won't persist across reloads.
    return randomUuid();
  }
}
