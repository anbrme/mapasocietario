/**
 * Canonical serialisation and hashing for attestation assertions and audit
 * events. Determinism is the whole point: the same statement must produce the
 * same hash on any runtime, in any key order, or accept-by-hash breaks.
 * Pure — safe to import from both Pages Functions and the browser bundle.
 */

// Sorted-key JSON. Arrays keep their order (a list of facts is ordered data),
// objects do not (key order is an accident of construction).
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.keys(value)
    .sort()
    .filter((k) => value[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`);
  return `{${entries.join(',')}}`;
}

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const hashCanonical = (value) => sha256Hex(canonicalJson(value));
