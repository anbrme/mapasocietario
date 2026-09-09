/**
 * The ONLY shape a reader ever sees. Built by allow-list: a deny-list would
 * leak every column added after it was written.
 *
 * `reviewer` is REDACTED to the operating entity. Section 8 of the pilot design
 * published the individual deliberately — the reviewer takes accountability for
 * the decision — but that reasoning assumed a sole operator and does not survive
 * an employee doing the review. The individual is still recorded in
 * attestations.reviewer and in audit_events.detail, so the accountability is
 * kept; only the exposure is dropped. The asymmetry is deliberate: do not
 * "tidy" it by redacting the internal record too.
 *
 * Every public reader is downstream of this function — the grant permalink, the
 * /empresa badge, the in-app card and /api/verify/badge — so this constant is
 * the single point of change.
 *
 * The redaction set is claimant email, identification_note, email_domain_basis,
 * audit detail, evidence keys and hashes, grant tokens, and the reviewer's name.
 */

// The registered legal name: no umlaut, no periods. Mapa Societario is a brand
// and cannot be accountable for a review; an entity with a NIF can.
export const PUBLIC_REVIEWER = 'Nurnberg Consulting SL';

const HISTORY_FIELDS = ['seq', 'action', 'created_at'];

export function publicProjection(attestation, facts, auditRows) {
  return {
    id: attestation.id,
    status: attestation.status,
    method: attestation.method,
    representation_basis: attestation.representation_basis,
    representative: {
      name: attestation.seat_officer_name,
      position: attestation.seat_position,
    },
    accepted_at: attestation.accepted_at,
    expires_at: attestation.expires_at,
    approved_at: attestation.approved_at,
    // The last SUCCESSFUL check. A daily job cannot support "as of right now".
    last_verified_at: attestation.last_verified_at,
    reviewer: PUBLIC_REVIEWER,
    status_reason: attestation.status_reason,
    facts: (facts || []).map((f) => ({
      fact_key: f.fact_key,
      declared_status: f.declared_status,
      declared_value: f.declared_value,
      registry_value_at_issue: f.registry_value_at_issue,
      // Needed to distinguish "we owe a check" from "there is nothing to check".
      check_source: f.check_source,
      last_check_outcome: f.last_check_outcome,
      last_checked_at: f.last_checked_at,
    })),
    history: (auditRows || [])
      .filter((r) => r.public_summary)
      .map((r) => ({
        ...Object.fromEntries(HISTORY_FIELDS.map((k) => [k, r[k]])),
        summary: r.public_summary,
      })),
  };
}
