import { describe, expect, it } from 'vitest';
import { boardRows, lastFilings, personSeats, companyEvidence } from './stepEvidence';

const profile = {
  is_dissolved: false, is_in_concurso: false, share_capital: '3.006,00 €', activity: 'Consultoría',
  officers_active: [
    { name: 'GARCIA LOPEZ MARIA', position_normalized: 'Administradora única', appointed_date: '2021-03-01', status: 'active' },
  ],
  officers_resigned: [
    { name: 'RUIZ MARTIN LUIS', position_normalized: 'Apoderado', appointed_date: '2018-01-01', resigned_date: '2020-06-30', status: 'resigned' },
    { name: 'OLD AUDITOR SL', position_normalized: 'Auditor', appointed_date: '2015-01-01', status: 'superseded' },
  ],
};
const events = { events: [
  { event_date: '2026-06-03', event_types: [{ type: 'Datos registrales' }, { type: 'Nombramientos' }] },
  { event_date: '2024-03-11', event_types: [{ type: 'Reducción de capital' }] },
  { event_date: '2022-01-05', event_types: [{ type: 'Ceses/Dimisiones' }] },
  { event_date: '2020-01-05', event_types: [{ type: 'Otros conceptos' }] },
] };
const findings = {
  company: { name: 'ACME IBERIA, SL', nif: 'B1', province: 'Valencia', registry: 'V-1', previous_names: [], last_filing: { date: '2026-06-03', type: 'Nombramientos' } },
  findings: [
    { kind: 'no_insolvency_notice', cls: 'limitation', text: 'No insolvency notice.', date: null },
    { kind: 'capital_movement', cls: 'concern', text: 'Capital reduced 2024-03-11.', date: '2024-03-11' },
    { kind: 'governing_body_turnover', cls: 'context', text: '2 changes.', date: '2026-06-03' },
  ],
  verification: ['No beneficial owners in the registry.'],
};

describe('boardRows', () => {
  it('lists active seats first, skips superseded, caps', () => {
    const rows = boardRows(profile, 'es');
    expect(rows.map(r => [r.name, r.status])).toEqual([['GARCIA LOPEZ MARIA', 'active'], ['RUIZ MARTIN LUIS', 'ceased']]);
    expect(rows[0]).toMatchObject({ role: 'Administradora única', since: '2021-03-01' });
    expect(boardRows(null, 'es')).toEqual([]);
  });
});

describe('lastFilings', () => {
  it('takes the newest three, skipping "Datos registrales" as the label', () => {
    expect(lastFilings(events, 'es')).toEqual([
      { date: '2026-06-03', type: 'Nombramientos' }, { date: '2024-03-11', type: 'Reducción de capital' }, { date: '2022-01-05', type: 'Ceses/Dimisiones' },
    ]);
    expect(lastFilings({ results: events.events }, 'es', 1)).toHaveLength(1);
    expect(lastFilings(undefined, 'es')).toEqual([]);
  });
});

describe('personSeats', () => {
  const graph = {
    nodes: [
      { id: 'o1', type: 'officer', name: 'GARCIA LOPEZ MARIA' },
      { id: 'H:1', type: 'spanish-company-group', name: 'ACME IBERIA, SL' },
      { id: 'H:2', type: 'spanish-company-group', name: 'NORTE, SL' },
      { id: 'o2', type: 'officer', name: 'OTHER' },
    ],
    links: [
      { source: 'H:1', target: 'o1', category: 'nombramiento', relationship: 'Administradora única', date: '2021-03-01' },
      { source: { id: 'o1' }, target: { id: 'H:2' }, category: 'cese', relationship: 'Consejera', date: '2019-01-01' },
      { source: 'H:1', target: 'o2', category: 'nombramiento', relationship: 'Apoderado' },
    ],
  };
  it('lists every seat of the person across visible companies, sorted by company', () => {
    expect(personSeats(graph.nodes[0], graph, 'es')).toEqual([
      { company: 'ACME IBERIA, SL', companyId: 'H:1', role: 'Administradora única', since: '2021-03-01', until: '', status: 'active' },
      { company: 'NORTE, SL', companyId: 'H:2', role: 'Consejera', since: '2019-01-01', until: '', status: 'ceased' },
    ]);
  });
});

describe('companyEvidence', () => {
  it('assembles identity, status, capital, activity, board, filings, findings and unseen', () => {
    const ev = companyEvidence({ node: { id: 'H:1', name: 'ACME IBERIA, SL' }, profile, events, findings, lang: 'es' });
    expect(ev.identity).toContain('NIF B1');
    expect(ev.status).toEqual({ dissolved: false, concurso: false, lastFiling: { date: '2026-06-03', type: 'Nombramientos' } });
    expect(ev.capital).toBe('3.006,00 €');
    expect(ev.activity).toBe('Consultoría');
    expect(ev.board).toHaveLength(2);
    expect(ev.filings).toHaveLength(3);
    expect(ev.findings.map(f => f.kind || f.text)).toEqual(['Capital reduced 2024-03-11.', '2 changes.']);
    expect(ev.unseen).toEqual(['No beneficial owners in the registry.', 'No insolvency notice.']);
  });
  it('degrades to empty values with no payloads', () => {
    const ev = companyEvidence({ node: { id: 'H:9', name: 'X' }, profile: null, events: null, findings: null, lang: 'en' });
    expect(ev).toEqual({ identity: '', status: { dissolved: false, concurso: false, lastFiling: null }, capital: null, activity: null, board: [], filings: [], findings: [], unseen: [], ownership: [] });
  });
});
