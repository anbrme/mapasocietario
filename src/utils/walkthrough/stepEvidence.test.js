import { describe, expect, it } from 'vitest';
import { boardRows, lastFilings, personSeats, companyEvidence } from './stepEvidence';

const profile = {
  is_dissolved: false, is_in_concurso: false, current_capital: 3006, activity: 'Consultoría',
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
  it('lists every seat of the person across visible companies, sorted by company — active seats date "since", ceased seats date "until"', () => {
    expect(personSeats(graph.nodes[0], graph, 'es')).toEqual([
      { company: 'ACME IBERIA, SL', companyId: 'H:1', role: 'Administradora única', since: '2021-03-01', until: '', status: 'active' },
      { company: 'NORTE, SL', companyId: 'H:2', role: 'Consejera', since: '', until: '2019-01-01', status: 'ceased' },
    ]);
  });

  it('skips an ownership link — a sole-shareholder relation is not a seat', () => {
    const graphWithOwnership = {
      nodes: graph.nodes,
      links: [
        { source: 'H:1', target: 'o1', category: 'nombramiento', relationship: 'Administradora única', date: '2021-03-01' },
        {
          source: 'o1', target: 'H:2', type: 'ownership', category: 'socio_unico', relationship: 'Socio único', date: '2019-01-01',
        },
      ],
    };
    expect(personSeats(graph.nodes[0], graphWithOwnership, 'es')).toEqual([
      { company: 'ACME IBERIA, SL', companyId: 'H:1', role: 'Administradora única', since: '2021-03-01', until: '', status: 'active' },
    ]);
  });

  it('reads a later cessation surfaced only through events, overriding the build-time category', () => {
    const graphWithEvents = {
      nodes: graph.nodes,
      links: [
        {
          source: 'H:1', target: 'o1', category: 'nombramiento', relationship: 'Administradora única', date: '2023-05-10',
          events: [{ category: 'nombramiento', date: '2021-03-01' }, { category: 'cese', date: '2023-05-10' }],
        },
      ],
    };
    expect(personSeats(graph.nodes[0], graphWithEvents, 'es')).toEqual([
      { company: 'ACME IBERIA, SL', companyId: 'H:1', role: 'Administradora única', since: '2021-03-01', until: '2023-05-10', status: 'ceased' },
    ]);
  });

  it('treats a seat at a dissolved company as ceased, regardless of the link category', () => {
    const graphWithDissolvedCompany = {
      nodes: [
        graph.nodes[0],
        { id: 'H:1', type: 'spanish-company-group', name: 'ACME IBERIA, SL', isDissolved: true },
      ],
      links: [
        { source: 'H:1', target: 'o1', category: 'nombramiento', relationship: 'Administradora única', date: '2021-03-01' },
      ],
    };
    expect(personSeats(graph.nodes[0], graphWithDissolvedCompany, 'es')).toEqual([
      // Ceased by the dissolution, not by an inscribed cessation: Hasta is unknown.
      { company: 'ACME IBERIA, SL', companyId: 'H:1', role: 'Administradora única', since: '2021-03-01', until: '', status: 'ceased' },
    ]);
  });
});

describe('personSeats — author links', () => {
  it('never lists an author link as a seat', () => {
    const person = { id: 'p', name: 'P', type: 'officer' };
    const company = { id: 'c', name: 'C', type: 'company' };
    const author = {
      id: 'author-link-1', source: 'p', target: 'c', type: 'author', category: 'author',
      relationship: 'Director', provenance: { by: 'author' },
    };
    const seats = personSeats(person, { nodes: [person, company], links: [author] }, 'en');
    expect(seats).toEqual([]);
  });
});

describe('companyEvidence', () => {
  it('assembles identity, status, capital, activity, board, filings, findings and unseen', () => {
    const ev = companyEvidence({ node: { id: 'H:1', name: 'ACME IBERIA, SL' }, profile, events, findings, lang: 'es' });
    expect(ev.identity).toContain('NIF B1');
    expect(ev.status).toEqual({ dissolved: false, concurso: false, lastFiling: { date: '2026-06-03', type: 'Nombramientos' } });
    expect(ev.capital).toMatch(/3\.?006,00\s?€/);
    expect(ev.activity).toBe('Consultoría');
    expect(ev.board).toHaveLength(2);
    expect(ev.filings).toHaveLength(3);
    expect(ev.findings.map(f => f.kind || f.text)).toEqual(['Capital reduced 2024-03-11.', '2 changes.']);
    expect(ev.unseen).toEqual(['No beneficial owners in the registry.', 'No insolvency notice.']);
    expect(ev.ownership).toEqual([]);
  });
  it('degrades to empty values with no payloads', () => {
    const ev = companyEvidence({ node: { id: 'H:9', name: 'X' }, profile: null, events: null, findings: null, lang: 'en' });
    expect(ev).toEqual({
      identity: '',
      status: { dissolved: false, concurso: false, lastFiling: null },
      capital: null,
      activity: null,
      board: [],
      filings: [],
      findings: [],
      unseen: [],
      ownership: [],
    });
  });
  it('populates ownership from scope rows naming the node as owner or owned', () => {
    const scope = {
      ownership: [
        { owner: 'ACME IBERIA, SL', owned: 'GAMA SL' },
        { owner: 'BETA SL', owned: 'ACME IBERIA, SL' },
        { owner: 'OTHER SL', owned: 'OTHER2 SL' },
      ],
    };
    const ev = companyEvidence({
      node: { id: 'H:1', name: 'ACME IBERIA, SL' }, profile, events, findings, scope, lang: 'es',
    });
    expect(ev.ownership).toEqual([
      { owner: 'ACME IBERIA, SL', owned: 'GAMA SL' },
      { owner: 'BETA SL', owned: 'ACME IBERIA, SL' },
    ]);
  });
  it('ownership is empty with no scope', () => {
    const ev = companyEvidence({ node: { id: 'H:1', name: 'ACME IBERIA, SL' }, profile, events, findings, lang: 'es' });
    expect(ev.ownership).toEqual([]);
  });

  it('withholds capital when the filing that set it contradicts it (hasIncoherentCapital)', () => {
    // Real MAIER NAVARRA SL shape: gazetted as reducing capital by EUR
    // 700.872,80 and being left with EUR 6.231.559.999,99 — a 0.011% move,
    // which no company files. See capitalCoherence.js for the full story.
    const incoherentProfile = { ...profile, current_capital: 6231559999.99 };
    const incoherentEvents = {
      events: [{
        event_date: '2020-01-01',
        event_types: [{ type: 'Reducción de capital' }],
        full_entry: 'Reducción de capital. Importe: 700.872,80 Euros. Resultante: 6.231.559.999,99 Euros.',
      }],
    };
    const ev = companyEvidence({
      node: { id: 'H:1', name: 'ACME IBERIA, SL' }, profile: incoherentProfile, events: incoherentEvents, findings, lang: 'es',
    });
    expect(ev.capital).toBeNull();
  });
});

describe('personSeats — a company that holds seats (unified node)', () => {
  const graph = {
    nodes: [
      { id: 'H:1', type: 'spanish-company-group', name: 'HOLDING SL', unified: true },
      { id: 'H:2', type: 'spanish-company-group', name: 'FILIAL SL' },
      { id: 'H:3', type: 'spanish-company-group', name: 'GESTORA SA', unified: true },
    ],
    links: [
      // HOLDING sits on FILIAL's board
      { source: 'H:1', target: 'H:2', type: 'officer-company', unified: true, category: 'nombramiento', relationship: 'Administrador único', date: '2020-01-01' },
      // GESTORA sits on HOLDING's board — the reverse direction, not a seat HOLDING holds
      { source: 'H:3', target: 'H:1', type: 'officer-company', unified: true, category: 'nombramiento', relationship: 'Consejero', date: '2021-01-01' },
      // ownership is never a seat
      { source: 'H:1', target: 'H:2', type: 'ownership', category: 'socio_unico', relationship: 'Socio único', date: '2019-01-01' },
    ],
  };

  it('returns only the seats the company itself holds, by link direction', () => {
    expect(personSeats(graph.nodes[0], graph, 'es')).toEqual([
      { company: 'FILIAL SL', companyId: 'H:2', role: 'Administrador único', since: '2020-01-01', until: '', status: 'active' },
    ]);
  });

  it('a plain company with no unified links holds no seats', () => {
    expect(personSeats(graph.nodes[1], graph, 'es')).toEqual([]);
  });
});


describe('both dates from the link events', () => {
  it('a ceased seat whose link carries appointment and cessation events fills Desde and Hasta', () => {
    const g = {
      nodes: [{ id: 'o1', type: 'officer', name: 'GARCIA LOPEZ MARIA' }, { id: 'H:1', type: 'spanish-company-group', name: 'ACME IBERIA, SL' }],
      links: [{
        source: 'H:1', target: 'o1', category: 'cese', relationship: 'Consejera', date: '2023-05-10', categoryDate: '2023-05-10',
        events: [{ category: 'nombramiento', date: '2021-03-01' }, { category: 'cese', date: '2023-05-10' }],
      }],
    };
    expect(personSeats(g.nodes[0], g, 'es')).toEqual([
      { company: 'ACME IBERIA, SL', companyId: 'H:1', role: 'Consejera', since: '2021-03-01', until: '2023-05-10', status: 'ceased' },
    ]);
  });
  it('board rows carry the resignation date as until', () => {
    const rows = boardRows(profile);
    expect(rows.find(r => r.name === 'RUIZ MARTIN LUIS')).toMatchObject({ since: '2018-01-01', until: '2020-06-30', status: 'ceased' });
    expect(rows.find(r => r.name === 'GARCIA LOPEZ MARIA')).toMatchObject({ until: '' });
  });
});


describe('boardRows — whole roster, categorised', () => {
  it('never cuts the roster and tags each row with its role category', () => {
    const many = { officers_active: Array.from({ length: 15 }, (_, i) => ({ name: `PERSONA ${i}`, position_normalized: i % 3 ? 'APODERADO' : 'CONSEJERO', appointed_date: '2020-01-01' })), officers_resigned: [] };
    const rows = boardRows(many);
    expect(rows).toHaveLength(15);
    expect(rows.filter(r => r.category === 'Apoderado')).toHaveLength(10);
    expect(rows.filter(r => r.category === 'Consejero')).toHaveLength(5);
  });
});
