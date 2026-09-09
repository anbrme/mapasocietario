import { describe, it, expect } from 'vitest';
import { eventVisibility, registryNow, checkFact, nextStatus, isExpired, buildRunRow,
         RUN_RETENTION_DAYS, runRetentionCutoff, summariseRuns } from './reconcile.js';

const ACCEPTED = '2026-09-08T12:00:00Z';
const COMPANY = {
  current_address: 'C/ ARZOBISPO COS 10, BAJO (MADRID)',
  is_in_concurso: false, enriched_nif: 'B86829538',
  officers_active: [{ name: 'NURNBERG ALESSANDRO', position_normalized: 'ADM. UNICO' }],
};
const fact = (o) => ({ check_source: 'borme', declared_status: 'current', ...o });

const ev = (o) => ({ has_officer_changes: false, has_address_change: false,
                     is_concurso: false, has_dissolution: false, ...o });

describe('eventVisibility', () => {
  it('is visible_before when we had already ingested it', () => {
    expect(eventVisibility(ev({ event_date: '2026-09-01', processed_at: '2026-09-02T00:00:00' }), ACCEPTED))
      .toBe('visible_before');
  });
  it('is act_before_ingest_after when the act predates acceptance but we got it later', () => {
    expect(eventVisibility(ev({ event_date: '2026-09-01', processed_at: '2026-09-20T00:00:00' }), ACCEPTED))
      .toBe('act_before_ingest_after');
  });
  it('is after when the act itself postdates acceptance', () => {
    expect(eventVisibility(ev({ event_date: '2026-09-20', processed_at: '2026-09-21T00:00:00' }), ACCEPTED))
      .toBe('after');
  });
});

describe('checkFact', () => {
  it('is consistent when the registry still agrees', () => {
    expect(checkFact(fact({ fact_key: 'address', declared_value: COMPANY.current_address }),
      COMPANY, [], ACCEPTED)).toBe('consistent');
  });

  it('ignores facts that are not ours to check', () => {
    expect(checkFact({ check_source: 'vies', fact_key: 'vat_intraeu' }, COMPANY, [], ACCEPTED)).toBeNull();
    expect(checkFact({ check_source: 'none', fact_key: 'operational' }, COMPANY, [], ACCEPTED)).toBeNull();
  });

  it('a later move makes the statement OUTDATED, never disputed', () => {
    const moved = { ...COMPANY, current_address: 'C/ NUEVA 5' };
    const events = [ev({ has_address_change: true, event_date: '2026-09-20',
                         processed_at: '2026-09-21T00:00:00' })];
    expect(checkFact(fact({ fact_key: 'address', declared_value: COMPANY.current_address }),
      moved, events, ACCEPTED)).toBe('superseded_by_later_event');
  });

  it('an event we had ALREADY INGESTED contradicts the statement at issue', () => {
    const moved = { ...COMPANY, current_address: 'C/ NUEVA 5' };
    const events = [ev({ has_address_change: true, event_date: '2026-09-01',
                         processed_at: '2026-09-02T00:00:00' })];
    expect(checkFact(fact({ fact_key: 'address', declared_value: COMPANY.current_address }),
      moved, events, ACCEPTED)).toBe('contradicted_at_issue');
  });

  it('an act predating acceptance that we ingested LATER is inconclusive, not an accusation', () => {
    const moved = { ...COMPANY, current_address: 'C/ NUEVA 5' };
    const events = [ev({ has_address_change: true, event_date: '2026-09-01',
                         processed_at: '2026-09-25T00:00:00' })];
    expect(checkFact(fact({ fact_key: 'address', declared_value: COMPANY.current_address }),
      moved, events, ACCEPTED)).toBe('inconclusive');
  });

  it('a difference with NO event to explain it is inconclusive', () => {
    const moved = { ...COMPANY, current_address: 'C/ NUEVA 5' };
    expect(checkFact(fact({ fact_key: 'address', declared_value: COMPANY.current_address }),
      moved, [], ACCEPTED)).toBe('inconclusive');
  });

  it('a correction stays pending until the registry catches up', () => {
    expect(checkFact(fact({ fact_key: 'address', declared_status: 'corrected',
      declared_value: 'C/ NUEVA 5' }), COMPANY, [], ACCEPTED)).toBe('pending_publication');
  });

  it('a correction the registry HAS published becomes consistent', () => {
    const caughtUp = { ...COMPANY, current_address: 'C/ NUEVA 5' };
    expect(checkFact(fact({ fact_key: 'address', declared_status: 'corrected',
      declared_value: 'C/ NUEVA 5' }), caughtUp, [], ACCEPTED)).toBe('consistent');
  });

  it('an event touching nothing we attested to is not evidence about it', () => {
    const moved = { ...COMPANY, current_address: 'C/ NUEVA 5' };
    const irrelevant = [ev({ has_officer_changes: true, event_date: '2026-09-01',
                             processed_at: '2026-09-02T00:00:00' })];
    // An officer event cannot make an address declaration a lie.
    expect(checkFact(fact({ fact_key: 'address', declared_value: COMPANY.current_address }),
      moved, irrelevant, ACCEPTED)).toBe('inconclusive');
  });

  it('concurso appearing later makes it outdated - a new fact, not a lie', () => {
    const concurso = { ...COMPANY, is_in_concurso: true };
    const events = [ev({ is_concurso: true, event_date: '2026-09-20',
                         processed_at: '2026-09-21T00:00:00' })];
    expect(checkFact(fact({ fact_key: 'insolvency', declared_status: 'none', declared_value: 'none' }),
      concurso, events, ACCEPTED)).toBe('superseded_by_later_event');
  });
});

describe('nextStatus', () => {
  it('stays live when everything agrees', () => {
    expect(nextStatus({ outcomes: { address: 'consistent', nif: 'consistent' } }).status).toBe('live');
  });
  it('an integrity problem outranks everything', () => {
    expect(nextStatus({ outcomes: { address: 'contradicted_at_issue',
      officers: 'superseded_by_later_event' } }).status).toBe('disputed');
  });
  it('a later event makes it outdated', () => {
    expect(nextStatus({ outcomes: { address: 'superseded_by_later_event' } }).status).toBe('outdated');
  });
  it('a pending correction alone does not change the status', () => {
    expect(nextStatus({ outcomes: { address: 'pending_publication' } }).status).toBe('live');
  });

  it('ONE inconclusive check changes nothing', () => {
    const r = nextStatus({ outcomes: { address: 'inconclusive' }, consecutiveInconclusive: 0 });
    expect(r.status).toBeNull();
    expect(r.consecutiveInconclusive).toBe(1);
  });
  it('escalates only on the third consecutive one', () => {
    expect(nextStatus({ outcomes: { address: 'inconclusive' }, consecutiveInconclusive: 1 }).status).toBeNull();
    expect(nextStatus({ outcomes: { address: 'inconclusive' }, consecutiveInconclusive: 2 }).status)
      .toBe('under_review');
  });
  it('an outage does not turn into an accusation, and does not act at once', () => {
    // The failure mode this prevents: one API outage moving every attestation
    // in the pilot on the same morning.
    expect(nextStatus({ sourceFailed: true, consecutiveInconclusive: 0 }).status).toBeNull();
    expect(nextStatus({ sourceFailed: true, consecutiveInconclusive: 2 }).status).toBe('under_review');
  });
  it('a good check resets the counter', () => {
    expect(nextStatus({ outcomes: { address: 'consistent' }, consecutiveInconclusive: 2 })
      .consecutiveInconclusive).toBe(0);
  });
});

describe('registryNow / isExpired', () => {
  it('shapes the registry the same way the declaration was shaped', () => {
    expect(registryNow(COMPANY).officers).toBe('NURNBERG ALESSANDRO (ADM. UNICO)');
    expect(registryNow(COMPANY).insolvency).toBe('none');
  });
  it('expiry is a clock', () => {
    expect(isExpired('2026-09-01T00:00:00Z', Date.parse('2026-09-08T00:00:00Z'))).toBe(true);
    expect(isExpired('2027-03-07T00:00:00Z', Date.parse('2026-09-08T00:00:00Z'))).toBe(false);
  });
});

describe('buildRunRow', () => {
  const attestation = { id: 'att_1', subject_id: 's1', status: 'live' };

  it('records the outcome map, the status before and the status after', () => {
    const row = buildRunRow({
      attestation,
      outcomes: { address: 'consistent', officers: 'consistent' },
      sourceFailed: false,
      appliedStatus: 'live',
      checkedAt: '2026-09-10T04:15:00Z',
    });
    expect(row).toEqual([
      'att_1', 's1', '2026-09-10T04:15:00Z', 0,
      '{"address":"consistent","officers":"consistent"}', 'live', 'live',
    ]);
  });

  it('records an empty outcome map when the upstream read failed', () => {
    const row = buildRunRow({
      attestation, outcomes: {}, sourceFailed: true,
      appliedStatus: 'live', checkedAt: '2026-09-10T04:15:00Z',
    });
    expect(row[3]).toBe(1);
    expect(row[4]).toBe('{}');
  });

  it('carries the status forward when the decision changes nothing', () => {
    const row = buildRunRow({
      attestation, outcomes: { address: 'consistent' }, sourceFailed: false,
      appliedStatus: 'live', checkedAt: '2026-09-10T04:15:00Z',
    });
    expect(row[5]).toBe('live');
    expect(row[6]).toBe('live');
  });

  it('records a transition when the decision changes the status', () => {
    const row = buildRunRow({
      attestation, outcomes: { address: 'superseded_by_later_event' },
      sourceFailed: false, appliedStatus: 'outdated',
      checkedAt: '2026-09-10T04:15:00Z',
    });
    expect(row[5]).toBe('live');
    expect(row[6]).toBe('outdated');
  });

  it('records no transition when a restore-to-live decision was suppressed', () => {
    // A disputed attestation whose facts are all vies/none: checkFact returns
    // null for those, outcomes is {}, and nextStatus falls through to 'live'
    // every run. The caller's mayRestore guard suppresses applying that
    // decision, and buildRunRow must reflect what was ACTUALLY applied
    // (nothing), not the decision that was discarded.
    const disputedAttestation = { id: 'att_2', subject_id: 's2', status: 'disputed' };
    const row = buildRunRow({
      attestation: disputedAttestation, outcomes: {}, sourceFailed: false,
      appliedStatus: 'disputed', checkedAt: '2026-09-10T04:15:00Z',
    });
    expect(row[5]).toBe('disputed');
    expect(row[6]).toBe('disputed');
  });
});

describe('runRetentionCutoff', () => {
  it('is two years before now, as an ISO string', () => {
    const now = Date.parse('2026-09-10T04:15:00Z');
    expect(RUN_RETENTION_DAYS).toBe(730);
    expect(runRetentionCutoff(now)).toBe(
      new Date(now - 730 * 86_400_000).toISOString());
  });
});

describe('summariseRuns', () => {
  // Rows arrive newest-first, as the endpoint orders them.
  const rows = [
    { checked_at: '2026-09-12T04:00:00Z', source_failed: 0,
      outcomes: '{"address":"consistent"}' },
    { checked_at: '2026-09-11T04:00:00Z', source_failed: 1, outcomes: '{}' },
    { checked_at: '2026-09-10T04:00:00Z', source_failed: 0,
      outcomes: '{"address":"consistent","officers":"superseded_by_later_event"}' },
  ];

  it('counts checks, failures and fully consistent days separately', () => {
    expect(summariseRuns(rows)).toEqual({
      total: 3, checked: 2, failed: 1, consistent: 1,
      first: '2026-09-10T04:00:00Z', last: '2026-09-12T04:00:00Z',
    });
  });

  it('never counts a failed read as consistent', () => {
    expect(summariseRuns([{ checked_at: 'x', source_failed: 1, outcomes: '{}' }]).consistent)
      .toBe(0);
  });

  it('does not count an empty outcome map as consistent', () => {
    expect(summariseRuns([{ checked_at: 'x', source_failed: 0, outcomes: '{}' }]).consistent)
      .toBe(0);
  });

  it('survives an unparseable outcomes column rather than throwing', () => {
    expect(summariseRuns([{ checked_at: 'x', source_failed: 0, outcomes: 'not json' }]).consistent)
      .toBe(0);
  });

  it('is all zeroes and nulls for no rows', () => {
    expect(summariseRuns([])).toEqual({
      total: 0, checked: 0, failed: 0, consistent: 0, first: null, last: null });
  });
});
