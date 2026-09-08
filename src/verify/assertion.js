/**
 * An assertion is the exact statement a representative is shown. It is built
 * BEFORE acceptance, so it must not contain the acceptance time or an expiry
 * derived from it — including either would change the hash at the moment of
 * acceptance and break accept-by-hash. It carries `valid_for_days` as a RULE.
 *
 * The acceptance receipt is the separate record of the act: the assertion hash,
 * the real acceptance time, the expiry computed by applying the rule, and the
 * method. The receipt is what the audit chain records (spec section 5.9).
 */
export const VALID_FOR_DAYS = 180;

export function buildAssertion({
  identity, seat, representationBasis, facts,
  registrySnapshotDigest, consents, nonce, draftedAt,
}) {
  return {
    version: 1,
    nonce,
    drafted_at: draftedAt,
    valid_for_days: VALID_FOR_DAYS,
    identity,
    seat,
    representation_basis: representationBasis,
    registry_snapshot_digest: registrySnapshotDigest,
    consents,
    facts: facts.map((f) => ({
      fact_key: f.fact_key,
      declared_status: f.declared_status,
      declared_value: f.declared_value ?? null,
    })),
  };
}

export function addDays(iso, days) {
  const t = new Date(iso);
  t.setUTCDate(t.getUTCDate() + days);
  return `${t.toISOString().slice(0, 19)}Z`;
}

export function buildAcceptanceReceipt(assertionHash, acceptedAtIso, method) {
  return {
    assertion_hash: assertionHash,
    accepted_at: acceptedAtIso,
    expires_at: addDays(acceptedAtIso, VALID_FOR_DAYS),
    method,
  };
}
