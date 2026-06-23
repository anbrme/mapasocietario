// Pure helpers for the AI Investigation gate. Network calls live in the
// component; these are the unit-tested building blocks.

export function isTokenValid(stored, nowSec) {
  if (!stored || !stored.token || typeof stored.expiresAt !== 'number') return false;
  return stored.expiresAt > nowSec;
}

export function buildRedeemBody(email, code, turnstileToken) {
  return {
    email: String(email || '').trim().toLowerCase(),
    code: String(code || ''),
    turnstileToken: turnstileToken || '',
  };
}

export function buildInvestigateHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export function buildCodeForSessionBody(sessionId) {
  return { sessionId: String(sessionId || '') };
}
