/**
 * The ONLY shape a reader ever sees. Built by allow-list: a deny-list would
 * leak every column added after it was written.
 *
 * `reviewer` is published deliberately — the reviewer is the operator taking
 * public accountability for the decision, which is the point (spec section 8).
 * The redaction set is claimant email, identification_note, email_domain_basis,
 * audit detail, evidence keys and hashes, and grant tokens.
 */
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
    reviewer: attestation.reviewer,
    status_reason: attestation.status_reason,
    facts: (facts || []).map((f) => ({
      fact_key: f.fact_key,
      declared_status: f.declared_status,
      declared_value: f.declared_value,
      registry_value_at_issue: f.registry_value_at_issue,
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
