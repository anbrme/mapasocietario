/**
 * Daily reconciliation: does a published attestation still hold, and if not, is
 * that a change in the world or a problem with the statement?
 *
 * The spec's rule turns on "event date vs publication date". The events API
 * exposes `event_date` (the BORME entry's own date) and `processed_at` (when we
 * ingested it) - there is no separate publication timestamp. `processed_at` is
 * the better discriminator regardless, because it answers the question that
 * actually matters: COULD OUR SNAPSHOT HAVE SHOWN THIS when they accepted?
 *
 *   ingested before acceptance   it was in the data we showed them, so a
 *                                declaration against it contradicted visible
 *                                evidence            -> contradicted_at_issue
 *   dated before, ingested after invisible to us and probably to them; a
 *                                possible misstatement we cannot prove
 *                                                    -> inconclusive
 *   dated after acceptance       the world moved     -> superseded_by_later_event
 *
 * Our ingestion can lag BORME by days, so this errs toward `inconclusive` -
 * i.e. toward review rather than accusation. That is the correct direction: the
 * cost of a wrong "under review" is an email; the cost of a wrong "disputed" is
 * a public accusation against a company that did nothing.
 */

export const EVENT_VISIBILITY = ['visible_before', 'act_before_ingest_after', 'after'];

export function eventVisibility(event, acceptedAt) {
  const accepted = Date.parse(acceptedAt);
  const ingested = Date.parse(event.processed_at);
  const dated = Date.parse(`${event.event_date}T00:00:00Z`);
  if (Number.isFinite(ingested) && ingested <= accepted) return 'visible_before';
  if (Number.isFinite(dated) && dated <= accepted) return 'act_before_ingest_after';
  return 'after';
}

// Which facts a given event could possibly bear on. An event that touches
// nothing we attested to is not evidence about this statement.
const EVENT_TOUCHES = {
  officers: (e) => e.has_officer_changes === true,
  representation: (e) => e.has_officer_changes === true,
  address: (e) => e.has_address_change === true,
  insolvency: (e) => e.is_concurso === true,
  nif: () => false,
  vat_intraeu: () => false,
  operational: (e) => e.has_dissolution === true,
};

const norm = (v) => (v === null || v === undefined ? '' : String(v).trim().toUpperCase());

/**
 * What the registry says NOW for each fact, in the same shape the declaration
 * used, so the two are comparable.
 */
export function registryNow(company) {
  const officers = (company.officers_active || [])
    .map((o) => `${o.name || o.name_normalized} (${o.position_normalized || ''})`.trim())
    .join('; ');
  return {
    representation: officers || null,
    officers: officers || null,
    address: company.current_address || null,
    insolvency: company.is_in_concurso ? 'concurso' : 'none',
    nif: company.nif || company.enriched_nif || null,
    vat_intraeu: null,
    operational: null,
  };
}

/**
 * One fact's outcome. `events` are those the reconciler fetched for this
 * subject; only ones that could bear on this fact are considered.
 */
export function checkFact(fact, company, events, acceptedAt) {
  if (fact.check_source !== 'borme') return null;   // vies and none are not ours to judge here

  const now = registryNow(company)[fact.fact_key];
  const declared = fact.declared_value;

  if (norm(now) === norm(declared)) {
    // A correction that the registry has caught up with is no longer a claim.
    return 'consistent';
  }
  if (fact.declared_status === 'corrected') {
    // Deliberately differs from the registry; it is a claim awaiting publication.
    return 'pending_publication';
  }

  const touching = (events || []).filter((e) => (EVENT_TOUCHES[fact.fact_key] || (() => false))(e));
  if (!touching.length) {
    // The value moved and no event explains it. Could be a re-statement upstream,
    // a normalisation change, or an event we have not linked - never an accusation.
    return 'inconclusive';
  }

  const visibilities = touching.map((e) => eventVisibility(e, acceptedAt));
  if (visibilities.includes('visible_before')) return 'contradicted_at_issue';
  if (visibilities.every((v) => v === 'after')) return 'superseded_by_later_event';
  return 'inconclusive';
}

export const INCONCLUSIVE_ESCALATION_DAYS = 3;

/**
 * The attestation's status from its facts' outcomes.
 *
 * Availability is not integrity: an unreachable source or an unexplained
 * difference must never read as an accusation, and must not act on its first
 * occurrence either - one API outage would otherwise move every attestation in
 * the pilot at once.
 */
export function nextStatus({ outcomes, consecutiveInconclusive = 0, sourceFailed = false }) {
  if (sourceFailed) {
    const n = consecutiveInconclusive + 1;
    return n >= INCONCLUSIVE_ESCALATION_DAYS
      ? { status: 'under_review', reason: 'The registry could not be reached for three consecutive checks.', consecutiveInconclusive: n }
      : { status: null, reason: null, consecutiveInconclusive: n };
  }

  const values = Object.values(outcomes || {}).filter(Boolean);
  if (values.includes('contradicted_at_issue')) {
    return { status: 'disputed', reason: 'A registry record published before acceptance appears to contradict this statement.', consecutiveInconclusive: 0 };
  }
  if (values.includes('superseded_by_later_event')) {
    return { status: 'outdated', reason: 'A later registry event has moved past this statement.', consecutiveInconclusive: 0 };
  }
  if (values.includes('inconclusive')) {
    const n = consecutiveInconclusive + 1;
    return n >= INCONCLUSIVE_ESCALATION_DAYS
      ? { status: 'under_review', reason: 'A check could not be completed on three consecutive days.', consecutiveInconclusive: n }
      : { status: null, reason: null, consecutiveInconclusive: n };
  }
  return { status: 'live', reason: null, consecutiveInconclusive: 0 };
}

// Expiry is a clock, not a check, so it is decided separately and wins.
export const isExpired = (expiresAt, nowMs = Date.now()) => Date.parse(expiresAt) <= nowMs;

/**
 * The bind values for one reconciliation_runs row, in column order.
 *
 * Lives here rather than in the Worker because the Worker moves data and this
 * decides what the record says — including the one distinction that matters:
 * a failed upstream read records source_failed=1 with an EMPTY outcome map, so
 * "we could not check" can never be read as "we checked and all was well".
 */
export function buildRunRow({ attestation, outcomes, sourceFailed, appliedStatus, checkedAt }) {
  return [
    attestation.id,
    attestation.subject_id,
    checkedAt,
    sourceFailed ? 1 : 0,
    JSON.stringify(sourceFailed ? {} : (outcomes || {})),
    attestation.status,
    appliedStatus,
  ];
}

// Two years. Long enough to show a counterparty a multi-year run of checks,
// short enough that the table cannot grow without bound.
export const RUN_RETENTION_DAYS = 730;

export const runRetentionCutoff = (nowMs = Date.now()) =>
  new Date(nowMs - RUN_RETENTION_DAYS * 86_400_000).toISOString();

/**
 * A one-line summary of a run of checks, for the operator.
 *
 * "Consistent" means every fact came back consistent on a day the upstream read
 * SUCCEEDED. A failed read and an empty outcome map both count as neither
 * consistent nor contradicted: the whole point of storing source_failed is that
 * "we could not check" must never read as "we checked and all was well".
 *
 * Rows arrive newest-first, as the admin endpoint orders them.
 */
export function summariseRuns(rows) {
  const runs = rows || [];
  let checked = 0;
  let consistent = 0;
  for (const r of runs) {
    if (r.source_failed) continue;
    checked++;
    let outcomes;
    try { outcomes = JSON.parse(r.outcomes || '{}'); } catch { continue; }
    const values = Object.values(outcomes || {});
    if (values.length > 0 && values.every((v) => v === 'consistent')) consistent++;
  }
  return {
    total: runs.length,
    checked,
    failed: runs.length - checked,
    consistent,
    first: runs.length ? runs[runs.length - 1].checked_at : null,
    last: runs.length ? runs[0].checked_at : null,
  };
}
