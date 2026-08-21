import { describe, it, expect } from 'vitest';
import { reconcileOfficersWithEvents } from './pendingOfficerEvents';

// SOTO DE TORRES, SL on 2026-08-21: BORME published the replacement of one
// joint administrator by another. The event log carried both acts hours before
// the aggregated doc absorbed them, and last_seen still read the company's
// previous filing — so every surface reading the doc named the man who had just
// resigned and never named his replacement.
const sotoDoc = {
  company_name: 'SOTO DE TORRES, SL',
  last_seen: '2025-11-27',
  officers_active: [
    { name: 'AMADO GALLART JOSEP', position_normalized: 'ADM. MANCOM.', appointed_date: '2011-05-20', status: 'active' },
    { name: 'CARRETER DE GRANDA JULIO', position_normalized: 'ADM. MANCOM.', appointed_date: '2021-12-10', status: 'active' },
  ],
  officers_resigned: [
    { name: 'DE JAVIER ESTEBAN LUIS', position_normalized: 'ADM. MANCOM.', resigned_date: '2011-05-20', status: 'resigned' },
  ],
};

const sotoEvents = [
  {
    event_date: '2026-08-21',
    officers: [
      { name: 'AMADO GALLART JOSEP', position_normalized: 'ADM. MANCOM.', event_type: 'Ceses/Dimisiones' },
      { name: 'FABRICE BRUNO DUCCESCHI', position_normalized: 'ADM. MANCOM.', event_type: 'Nombramientos' },
    ],
  },
  {
    event_date: '2025-11-27',
    officers: [
      { name: 'AUDRIA AUDITORIA Y CONSULTORIA SLP', position_normalized: 'AUDITOR', event_type: 'Reelecciones' },
    ],
  },
];

const namesOf = list => list.map(o => o.name);

describe('reconcileOfficersWithEvents', () => {
  it('adds an officer appointed after the doc was last aggregated', () => {
    const { officers_active } = reconcileOfficersWithEvents(sotoDoc, sotoEvents);

    expect(namesOf(officers_active)).toContain('FABRICE BRUNO DUCCESCHI');
  });

  it('gives the new seat the date and role the registry published', () => {
    const { officers_active } = reconcileOfficersWithEvents(sotoDoc, sotoEvents);
    const fabrice = officers_active.find(o => o.name === 'FABRICE BRUNO DUCCESCHI');

    expect(fabrice.position_normalized).toBe('ADM. MANCOM.');
    expect(fabrice.appointed_date).toBe('2026-08-21');
    expect(fabrice.status).toBe('active');
  });

  it('closes the seat of the officer who resigned in the same filing', () => {
    const { officers_active, officers_resigned } = reconcileOfficersWithEvents(sotoDoc, sotoEvents);

    expect(namesOf(officers_active)).not.toContain('AMADO GALLART JOSEP');
    const amado = officers_resigned.find(o => o.name === 'AMADO GALLART JOSEP');
    expect(amado.resigned_date).toBe('2026-08-21');
    expect(amado.status).toBe('resigned');
  });

  it('leaves the untouched officers exactly as the registry aggregated them', () => {
    const { officers_active, officers_resigned } = reconcileOfficersWithEvents(sotoDoc, sotoEvents);

    expect(officers_active.find(o => o.name === 'CARRETER DE GRANDA JULIO')).toEqual(
      sotoDoc.officers_active[1]
    );
    expect(namesOf(officers_resigned)).toContain('DE JAVIER ESTEBAN LUIS');
  });

  it('marks what it added so a surface can tell doc from event', () => {
    const { officers_active, pendingActsApplied } = reconcileOfficersWithEvents(sotoDoc, sotoEvents);
    const fabrice = officers_active.find(o => o.name === 'FABRICE BRUNO DUCCESCHI');

    expect(fabrice.from_pending_event).toBe(true);
    // Two acts in one filing: the departure and the arrival.
    expect(pendingActsApplied).toBe(2);
  });

  it('ignores events the doc has already absorbed', () => {
    // The 2025-11-27 auditor re-election is at the doc's own boundary: applying
    // it again would re-add an officer the aggregation may have deliberately
    // dropped (superseded, capped).
    const { officers_active } = reconcileOfficersWithEvents(sotoDoc, sotoEvents);

    expect(namesOf(officers_active)).not.toContain('AUDRIA AUDITORIA Y CONSULTORIA SLP');
  });

  it('does not touch the doc when it is level with the event log', () => {
    const current = { ...sotoDoc, last_seen: '2026-08-21' };
    const result = reconcileOfficersWithEvents(current, sotoEvents);

    expect(result.officers_active).toEqual(current.officers_active);
    expect(result.pendingActsApplied).toBe(0);
  });

  it('never invents a cessation for a seat the doc does not hold', () => {
    // The one thing worse than a stale board is a fabricated departure.
    const doc = { ...sotoDoc, officers_active: [], officers_resigned: [] };
    const { officers_resigned } = reconcileOfficersWithEvents(doc, sotoEvents);

    expect(namesOf(officers_resigned)).not.toContain('AMADO GALLART JOSEP');
  });

  it('matches a seat by role family, not by exact wording', () => {
    // The doc says "ADM. MANCOM."; the event may say "Adm. Mancom." or
    // "ADMINISTRADOR MANCOMUNADO".
    const doc = {
      last_seen: '2020-01-01',
      officers_active: [
        { name: 'AMADO GALLART JOSEP', position_normalized: 'ADM. MANCOM.', status: 'active' },
      ],
      officers_resigned: [],
    };
    const events = [
      {
        event_date: '2026-08-21',
        officers: [
          { name: 'Amado Gallart Josep', position: 'Administrador Mancomunado', event_type: 'Ceses/Dimisiones' },
        ],
      },
    ];

    const { officers_active } = reconcileOfficersWithEvents(doc, events);
    expect(officers_active).toHaveLength(0);
  });

  it('keeps a seat open when a later filing re-appoints the same person', () => {
    const doc = { last_seen: '2020-01-01', officers_active: [], officers_resigned: [] };
    const events = [
      {
        event_date: '2026-01-10',
        officers: [{ name: 'X', position_normalized: 'ADM. UNICO', event_type: 'Nombramientos' }],
      },
      {
        event_date: '2026-03-04',
        officers: [{ name: 'X', position_normalized: 'ADM. UNICO', event_type: 'Ceses/Dimisiones' }],
      },
      {
        event_date: '2026-06-30',
        officers: [{ name: 'X', position_normalized: 'ADM. UNICO', event_type: 'Nombramientos' }],
      },
    ];

    const { officers_active, officers_resigned } = reconcileOfficersWithEvents(doc, events);

    expect(namesOf(officers_active)).toEqual(['X']);
    expect(officers_active[0].appointed_date).toBe('2026-06-30');
    expect(namesOf(officers_resigned)).not.toContain('X');
  });

  it('treats a revocation as a closure', () => {
    const doc = {
      last_seen: '2020-01-01',
      officers_active: [{ name: 'Y', position_normalized: 'APODERADO', status: 'active' }],
      officers_resigned: [],
    };
    const events = [
      {
        event_date: '2026-05-05',
        officers: [{ name: 'Y', position_normalized: 'APODERADO', event_type: 'Revocaciones' }],
      },
    ];

    const { officers_active, officers_resigned } = reconcileOfficersWithEvents(doc, events);

    expect(officers_active).toHaveLength(0);
    expect(officers_resigned[0].resigned_date).toBe('2026-05-05');
  });

  it('applies a re-election to a seat the doc already holds without duplicating it', () => {
    const doc = {
      last_seen: '2020-01-01',
      officers_active: [
        { name: 'AUDRIA AUDITORIA Y CONSULTORIA SLP', position_normalized: 'AUDITOR', appointed_date: '2019-02-01', status: 'active' },
      ],
      officers_resigned: [],
    };
    const events = [
      {
        event_date: '2026-02-20',
        officers: [
          { name: 'AUDRIA AUDITORIA Y CONSULTORIA SLP', position_normalized: 'AUDITOR', event_type: 'Reelecciones' },
        ],
      },
    ];

    const { officers_active } = reconcileOfficersWithEvents(doc, events);

    expect(officers_active).toHaveLength(1);
    expect(officers_active[0].appointed_date).toBe('2026-02-20');
  });

  it('survives missing pieces without throwing', () => {
    expect(reconcileOfficersWithEvents(null, null).officers_active).toEqual([]);
    expect(reconcileOfficersWithEvents({}, []).officers_active).toEqual([]);
    // No last_seen means no honest boundary — change nothing rather than guess.
    const doc = { officers_active: [{ name: 'Z', position_normalized: 'ADM. UNICO' }], officers_resigned: [] };
    expect(reconcileOfficersWithEvents(doc, sotoEvents).officers_active).toEqual(doc.officers_active);
  });

  it('returns a new object and never mutates the doc it was given', () => {
    const doc = JSON.parse(JSON.stringify(sotoDoc));
    const result = reconcileOfficersWithEvents(doc, sotoEvents);

    expect(doc).toEqual(sotoDoc);
    expect(result).not.toBe(doc);
    expect(result.officers_active).not.toBe(doc.officers_active);
  });
});
