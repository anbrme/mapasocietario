/**
 * Thin shared adapters for the verification endpoints. All decision logic lives
 * in src/verify/ where vitest can reach it (vitest scans src/**\/*.test.js and
 * functions/**\/*.test.js); this file only moves data.
 */
import { buildAuditEvent, GENESIS_HASH } from '../../../src/verify/chain.js';

const API_BASE = 'https://api.ncdata.eu';

// Every verification response is private and must never be indexed, cached by
// a shared cache, or leak its token through a referrer.
export const privateHeaders = (contentType = 'application/json; charset=utf-8') => ({
  'content-type': contentType,
  'cache-control': 'private, no-store',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow, noarchive',
});

export const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: privateHeaders() });

// Length is compared first and leaks only the length, which is not secret.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function requireAdmin(request, env) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return Boolean(env.VERIFY_ADMIN_TOKEN) && safeEqual(token, env.VERIFY_ADMIN_TOKEN);
}

/**
 * Every upstream call carries X-Internal-Key. The API rate limiter keys on the
 * nginx loopback address, so an unkeyed caller consumes the SITE-WIDE per-worker
 * bucket and can take the public site down with it.
 */
export async function fetchCompanyByGroupKey(groupKey, env) {
  const response = await fetch(
    `${API_BASE}/bormes/v3/company?group_key=${encodeURIComponent(groupKey)}`,
    { headers: env.INTERNAL_API_KEY ? { 'X-Internal-Key': env.INTERNAL_API_KEY } : {} },
  );
  if (!response.ok) throw new Error(`registry_fetch_failed_${response.status}`);
  const data = await response.json();
  if (!data || !data.company) throw new Error('registry_no_company');
  return data.company;
}

/**
 * Returns a PREPARED statement so the caller can put the audit write inside
 * their own batch — an audit event that commits separately from the thing it
 * describes is worse than none. The unique index on prev_hash makes a
 * concurrent append fail rather than fork the chain; the caller retries.
 */
export async function auditStatement(env, event) {
  const head = await env.VERIFY_DB
    .prepare('SELECT hash FROM audit_events ORDER BY seq DESC LIMIT 1')
    .first();
  const row = await buildAuditEvent(head ? head.hash : GENESIS_HASH, {
    created_at: new Date().toISOString(), ...event,
  });
  return env.VERIFY_DB
    .prepare(`INSERT INTO audit_events
      (attestation_id, subject_id, action, actor, detail, public_summary, created_at, prev_hash, hash)
      VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(row.attestation_id ?? null, row.subject_id ?? null, row.action, row.actor,
          row.detail ?? null, row.public_summary ?? null, row.created_at,
          row.prev_hash, row.hash);
}

// The invitation behind a raw token, or null. Expiry is checked here so every
// caller fails the same way; `used_at` is NOT checked, because single use is
// enforced by attestations.invitation_id UNIQUE, not by this lookup.
export async function invitationForToken(env, tokenHashValue) {
  const row = await env.VERIFY_DB.prepare(
    `SELECT i.*, c.declared_name, c.email, c.claimed_role, c.representation_basis,
            c.identification_note, c.email_domain_basis
       FROM invitations i JOIN claimants c ON c.id = i.claimant_id
      WHERE i.token_hash = ?`).bind(tokenHashValue).first();
  if (!row) return null;
  if (Date.parse(row.expires_at) <= Date.now()) return null;
  return row;
}

// The current group_key for a subject. Reads the mapping table rather than
// assuming the value is fixed — that is the point of having the table.
export async function currentGroupKey(env, subjectId) {
  const row = await env.VERIFY_DB.prepare(
    `SELECT value FROM subject_identifiers
      WHERE subject_id = ? AND kind = 'group_key' AND valid_to IS NULL
      ORDER BY id DESC LIMIT 1`).bind(subjectId).first();
  return row ? row.value : null;
}
