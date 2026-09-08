/**
 * Assembles the draft a representative is shown, from a registry read plus any
 * declarations already made.
 *
 * `nonce` and `draftedAt` are passed IN rather than generated here, and that is
 * load-bearing: submit rebuilds the assertion from a FRESH registry read and
 * compares the hash to decide whether the registry moved under the
 * representative. If those two values were regenerated, every rebuild would
 * differ and the drift check would fire every time, telling us nothing.
 */
import { hashCanonical } from './hash.js';
import { factsFromRegistry, applyEdits } from './facts.js';
import { buildAssertion } from './assertion.js';

export function identitySnapshot({ subjectId, groupKey, company }) {
  return {
    subject_id: subjectId,
    group_key: groupKey,
    nif: company.nif || company.enriched_nif || null,
    hoja: (company.hojas || [])[0] || null,
    canonical_name: company.company_name,
  };
}

export async function assembleDraft({
  subjectId, groupKey, company, seat, representationBasis,
  declaredFacts, consents, nonce, draftedAt,
}) {
  // Registry values always come from the CURRENT read; declarations are layered
  // on top. registry_value_at_issue is never overwritten by a declaration — it
  // is the evidence the declaration is compared against.
  const facts = applyEdits(factsFromRegistry(company), declaredFacts || []);
  const registrySnapshotDigest = await hashCanonical(company);
  const assertion = buildAssertion({
    identity: identitySnapshot({ subjectId, groupKey, company }),
    seat,
    representationBasis,
    facts,
    registrySnapshotDigest,
    consents,
    nonce,
    draftedAt,
  });
  return { assertion, hash: await hashCanonical(assertion), facts, registrySnapshotDigest };
}
