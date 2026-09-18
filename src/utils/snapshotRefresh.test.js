import { describe, it, expect } from 'vitest';
import {
  selectRefreshTargets,
  refreshCompanyNode,
  summarizeRefresh,
  linkStatus,
  applyLiveRefresh,
} from './snapshotRefresh';

// J&C PRIME BRANDS SL as an imported snapshot stored it: reached by expanding
// an officer, so the node carries only the one filing that named him.
const staleJC = {
  id: 'c1',
  name: 'J&C PRIME BRANDS SL',
  type: 'spanish-company-group',
  companySummary: {
    entries: [{ date: '2017-12-26', text: 'SERRA CARTERA SL. Nombramientos…' }],
    totalEntries: 1,
    dateRange: { earliest: '2017-12-26', latest: '2017-12-26' },
  },
  x: 10,
  y: 20,
};

const liveCompany = {
  company_name: 'J&C PRIME BRANDS SL',
  group_key: 'H:B-83267',
  first_seen: '2010-08-31',
  last_seen: '2026-06-23',
  enriched_nif: 'B64123456',
  is_dissolved: false,
  is_in_concurso: false,
  is_unipersonal: true,
  name_changes: [{ old_name: 'SERRA CARTERA SL', new_name: 'J&C PRIME BRANDS SL' }],
};

const liveEvents = [
  { event_date: '2026-06-23', cif: null },
  { event_date: '2019-02-26' },
  { event_date: '2010-08-31' },
];

describe('selectRefreshTargets', () => {
  it('keeps registry companies and drops officers and author nodes', () => {
    const nodes = [
      staleJC,
      { id: 'c2', name: 'OTHER SA', type: 'company' },
      { id: 'o1', name: 'JUVE SANTACANA JOAN', type: 'officer' },
      { id: 'a1', name: 'My note', type: 'company', provenance: { by: 'author' } },
      { id: 'c3', name: '', type: 'company' },
    ];

    expect(selectRefreshTargets(nodes).map(n => n.id)).toEqual(['c1', 'c2']);
  });
});

describe('refreshCompanyNode', () => {
  it('replaces the partial summary with the live record', () => {
    // Act
    const node = refreshCompanyNode(staleJC, {
      company: liveCompany,
      events: liveEvents,
      total: 32,
      refreshedAt: '2026-09-18T10:32:00Z',
    });

    // Assert
    expect(node.companySummary.totalEntries).toBe(32);
    expect(node.companySummary.dateRange).toEqual({ earliest: '2010-08-31', latest: '2026-06-23' });
    expect(node.companySummary.previousNames).toEqual(['SERRA CARTERA SL']);
    expect(node.cif).toBe('B64123456');
    expect(node.groupKey).toBe('H:B-83267');
    expect(node.isUnipersonal).toBe(true);
    expect(node.liveRefreshedAt).toBe('2026-09-18T10:32:00Z');
  });

  it('keeps the stored entries, position and identity, and never mutates the input', () => {
    const before = structuredClone(staleJC);

    const node = refreshCompanyNode(staleJC, { company: liveCompany, events: liveEvents, total: 32 });

    expect(node).not.toBe(staleJC);
    expect(staleJC).toEqual(before);
    expect(node.companySummary.entries).toBe(staleJC.companySummary.entries);
    expect([node.id, node.name, node.x, node.y]).toEqual(['c1', 'J&C PRIME BRANDS SL', 10, 20]);
  });

  it('falls back to event dates and event count when the profile is missing', () => {
    const node = refreshCompanyNode(staleJC, { company: null, events: liveEvents });

    expect(node.companySummary.totalEntries).toBe(3);
    expect(node.companySummary.dateRange).toEqual({ earliest: '2010-08-31', latest: '2026-06-23' });
    expect(node.cif).toBeUndefined();
  });

  it('prefers a NIF printed on an event over the enriched one', () => {
    const node = refreshCompanyNode(staleJC, {
      company: liveCompany,
      events: [{ event_date: '2026-06-23', cif: 'B99999999' }],
    });

    expect(node.cif).toBe('B99999999');
  });

  it('leaves the node alone when there is no live data at all', () => {
    expect(refreshCompanyNode(staleJC, { company: null, events: [] })).toBe(staleJC);
  });

  it('marks a company dissolved since the snapshot', () => {
    const node = refreshCompanyNode(staleJC, {
      company: { ...liveCompany, is_dissolved: true },
      events: liveEvents,
    });

    expect(node.isDissolved).toBe(true);
  });
});

describe('linkStatus', () => {
  it('reads the latest event, and dissolution overrides it', () => {
    const appointed = { category: 'nombramientos' };
    const ceased = { ...appointed, events: [{ category: 'ceses_dimisiones', date: '2024-01-01' }] };

    expect(linkStatus(appointed)).toBe('active');
    expect(linkStatus(ceased)).toBe('ceased');
    expect(linkStatus({ ...appointed, companyDissolved: true })).toBe('ceased');
  });

  it('respects a hand-amended category', () => {
    const amended = {
      category: 'nombramientos',
      userAmended: true,
      events: [{ category: 'ceses_dimisiones', date: '2024-01-01' }],
    };

    expect(linkStatus(amended)).toBe('active');
  });
});

describe('applyLiveRefresh', () => {
  const officer = { id: 'o1', name: 'JUVE SANTACANA JOAN', type: 'officer' };
  const other = { id: 'c2', name: 'OTHER SL', type: 'spanish-company-group' };
  const seat = {
    source: officer, // force-graph has bound this endpoint to the node object
    target: staleJC,
    type: 'officer-company',
    relationship: 'CONSEJERO',
    category: 'nombramientos',
  };
  const graph = {
    nodes: [staleJC, officer, other],
    links: [
      seat,
      { ...seat, target: other },
      { ...seat, relationship: 'PRESIDENTE', userAmended: true },
    ],
  };
  const ceseEvents = [{
    event_date: '2024-09-06',
    officers: [
      { name: 'JUVE SANTACANA JOAN', event_type: 'Ceses/Dimisiones', position: 'CONSEJERO' },
      { name: 'JUVE SANTACANA JOAN', event_type: 'Ceses/Dimisiones', position: 'PRESIDENTE' },
    ],
  }];

  it('refreshes the fetched companies and turns a since-ceased seat red', () => {
    // Act
    const next = applyLiveRefresh(graph, new Map([
      ['c1', { company: liveCompany, events: ceseEvents, total: 32 }],
    ]));

    // Assert
    const jc = next.nodes.find(n => n.id === 'c1');
    expect(jc.companySummary.totalEntries).toBe(32);
    expect(linkStatus(next.links[0])).toBe('ceased');
  });

  it('leaves unfetched companies, hand-amended seats and the input alone', () => {
    const before = graph.links.map(l => ({ ...l }));

    const next = applyLiveRefresh(graph, new Map([
      ['c1', { company: liveCompany, events: ceseEvents, total: 32 }],
    ]));

    expect(next.nodes.find(n => n.id === 'c2')).toBe(other);
    expect(linkStatus(next.links[1])).toBe('active');
    expect(linkStatus(next.links[2])).toBe('active');
    expect(graph.links.map(l => ({ ...l }))).toEqual(before);
  });

  it('rebinds endpoints bound to a replaced node back to its id', () => {
    const next = applyLiveRefresh(graph, new Map([
      ['c1', { company: liveCompany, events: [], total: 32 }],
    ]));

    expect(next.links[0].target).toBe('c1');
  });
});

describe('summarizeRefresh', () => {
  it('counts refreshed companies, new cessations, dissolutions and failures', () => {
    const seat = { source: 'o1', target: 'c1', category: 'nombramientos' };
    const summary = summarizeRefresh({
      before: { nodes: [staleJC], links: [seat, { ...seat, relationship: 'APO' }] },
      after: {
        nodes: [{ ...staleJC, isDissolved: true }],
        links: [{ ...seat, companyDissolved: true }, { ...seat, relationship: 'APO' }],
      },
      refreshed: 1,
      failed: [{ id: 'c9', name: 'BROKEN SL' }],
    });

    expect(summary).toEqual({
      refreshed: 1,
      newlyCeased: 1,
      newlyDissolved: 1,
      failed: [{ id: 'c9', name: 'BROKEN SL' }],
    });
  });
});
