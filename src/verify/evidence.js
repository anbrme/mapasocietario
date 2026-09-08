/**
 * Evidence lives in two R2 prefixes with very different risk (spec section 9.1):
 *
 *   evidence/sealed/   assertion, registry snapshot, timestamps, the attester's
 *                      name and position. Bucket-locked. No contact details.
 *   evidence/personal/ email, identification_note. NEVER locked — a lock would
 *                      obstruct an erasure request for as long as it is active.
 *
 * Both keys derive from the draft hash so a retry addresses the same objects.
 * That prevents duplicate NAMES; retry safety comes from the conditional put
 * plus digest verification below.
 */
export const evidenceKeys = (draftHash) => ({
  sealed: `evidence/sealed/${draftHash}.json`,
  personal: `evidence/personal/${draftHash}.json`,
});

export function buildSealedEvidence({ assertion, registrySnapshot, seat, identity, acceptedAt }) {
  return JSON.stringify({ assertion, registry_snapshot: registrySnapshot, seat, identity,
                          accepted_at: acceptedAt });
}

export function buildPersonalEvidence({ email, identificationNote, emailDomainBasis, acceptedAt }) {
  return JSON.stringify({ email, identification_note: identificationNote,
                          email_domain_basis: emailDomainBasis, accepted_at: acceptedAt });
}

/**
 * Create-if-absent. If something is already there, read it back and compare:
 * an identical body means a previous attempt got this far and we continue; a
 * DIFFERENT body under a hash-derived key means something is badly wrong, so it
 * aborts loudly rather than overwriting evidence.
 */
export async function putEvidenceOnce(bucket, key, body) {
  const created = await bucket.put(key, body, { onlyIf: { etagDoesNotMatch: '*' } });
  if (created) return 'created';
  const existing = await bucket.get(key);
  if (!existing) throw new Error('evidence_put_raced');
  if ((await existing.text()) !== body) throw new Error('evidence_digest_mismatch');
  return 'verified';
}
