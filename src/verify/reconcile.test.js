import { describe, it, expect } from 'vitest';
import { eventVisibility, registryNow, checkFact, nextStatus, isExpired } from './reconcile.js';

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
