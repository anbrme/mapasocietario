/**
 * The live attestation for a company page, read from VERIFY_DB.
 *
 * Replaces the hand-authored `_confirmations.js` map. That map's single record
 * said `verification: 'registry-officer-match'` while the page said "La empresa
 * confirma" - an affirmation nothing recorded supported. This reads a real
 * attestation or renders nothing.
 *
 * The `_` prefix means Cloudflare Pages does not route this file.
 */
import { publicProjection } from '../../src/verify/projection.js';

/**
 * While the pilot runs, a badge renders only for subjects on this list. Without
 * the gate a pilot company's badge would be world-visible on its /empresa page
 * even though its attestation permalink is grant-gated - the leak that would
 * actually matter.
 *
 * Nurnberg Consulting is here because it is the operator's own company and was
 * already public under the old map.
 */
export const PILOT_VISIBLE_GROUP_KEYS = new Set(['H:M-566914']);

export function isBadgeVisible(env, groupKey) {
  if (!groupKey) return false;
  if ((env && env.VERIFY_VISIBILITY) === 'public') return true;
  return PILOT_VISIBLE_GROUP_KEYS.has(groupKey);
}

/**
 * Returns the public projection of the company's current attestation, or null.
 *
 * Only 'live' and 'outdated' render. A record under review or disputed is a
 * process or integrity state we are still resolving, and putting either on a
 * public company page would publish a suspicion before anyone had established
 * one. Those states remain visible on the attestation permalink, which is where
 * someone who holds a grant is entitled to the full picture.
 */
export async function liveAttestationFor(env, groupKey) {
  if (!env || !env.VERIFY_DB || !isBadgeVisible(env, groupKey)) return null;

  try {
    const subject = await env.VERIFY_DB.prepare(
      `SELECT subject_id FROM subject_identifiers
        WHERE kind='group_key' AND value=? AND valid_to IS NULL
        ORDER BY id DESC LIMIT 1`).bind(groupKey).first();
    if (!subject) return null;

    const attestation = await env.VERIFY_DB.prepare(
      `SELECT * FROM attestations
        WHERE subject_id=? AND status IN ('live','outdated')
        ORDER BY accepted_at DESC LIMIT 1`).bind(subject.subject_id).first();
    if (!attestation) return null;

    const { results: facts } = await env.VERIFY_DB.prepare(
      'SELECT * FROM attestation_facts WHERE attestation_id=? ORDER BY id')
      .bind(attestation.id).all();

    const { results: history } = await env.VERIFY_DB.prepare(
      `SELECT seq, action, created_at, public_summary FROM audit_events
        WHERE attestation_id=? AND public_summary IS NOT NULL ORDER BY seq`)
      .bind(attestation.id).all();

    return publicProjection(attestation, facts || [], history || []);
  } catch {
    // A company page must never fail because the attestation store is
    // unreachable. No badge is the correct degradation.
    return null;
  }
}
