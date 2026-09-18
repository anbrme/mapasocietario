import { describe, it, expect } from 'vitest';
import { buildOfficerEventMap, applyOfficerEventsToLinks } from './linkEventMerge';

const COMPANY = { id: 'c1', name: 'J&C PRIME BRANDS SL', type: 'spanish-company-group' };
const OFFICER = { id: 'o1', name: 'JUVE SANTACANA JOAN', type: 'officer' };

const officerLink = (overrides = {}) => ({
  source: 'o1',
  target: 'c1',
  type: 'officer-company',
  relationship: 'CONSEJERO',
  category: 'nombramientos',
  ...overrides,
});

const eventsFor = (...officers) => [{
  event_date: '2024-09-06',
  officers,
}];

describe('buildOfficerEventMap', () => {
  it('keys events by officer, company and category', () => {
    // Arrange
    const results = [{
      company: 'J&C PRIME BRANDS SL',
      events: eventsFor({ name: 'Juve Santacana Joan', event_type: 'Ceses/Dimisiones', position: 'CONSEJERO' }),
    }];

    // Act
    const map = buildOfficerEventMap(results);

    // Assert
    const entries = map.get('JUVE SANTACANA JOAN|J&C PRIME BRANDS SL|ceses_dimisiones');
    expect([...entries.values()]).toEqual([{ date: '2024-09-06', position: 'CONSEJERO' }]);
  });

  it('skips events without a date or a recognised act', () => {
    const results = [{
      company: 'X SL',
      events: [
        { officers: [{ name: 'A', event_type: 'Nombramientos' }] },
        { event_date: '2020-01-01', officers: [{ name: 'B', event_type: 'Otros conceptos' }] },
      ],
    }];

    expect(buildOfficerEventMap(results).size).toBe(0);
  });
});

describe('applyOfficerEventsToLinks', () => {
  it('attaches a later cessation to the matching seat', () => {
    // Arrange
    const graph = { nodes: [COMPANY, OFFICER], links: [officerLink()] };
    const map = buildOfficerEventMap([{
      company: COMPANY.name,
      events: eventsFor({ name: OFFICER.name, event_type: 'Ceses/Dimisiones', position: 'CONSEJERO' }),
    }]);

    // Act
    const [link] = applyOfficerEventsToLinks(graph, map);

    // Assert
    expect(link.events).toEqual([
      { category: 'ceses_dimisiones', date: '2024-09-06', position: 'CONSEJERO' },
    ]);
  });

  it('does not bleed an act of another role onto the seat', () => {
    const graph = { nodes: [COMPANY, OFFICER], links: [officerLink()] };
    const map = buildOfficerEventMap([{
      company: COMPANY.name,
      events: eventsFor({ name: OFFICER.name, event_type: 'Revocaciones', position: 'APODERADO' }),
    }]);

    const [link] = applyOfficerEventsToLinks(graph, map);

    expect(link.events).toBeUndefined();
  });

  it('stamps every seat of a dissolved company as dissolved', () => {
    const graph = {
      nodes: [{ ...COMPANY, isDissolved: true }, OFFICER],
      links: [officerLink()],
    };

    const [link] = applyOfficerEventsToLinks(graph, new Map());

    expect(link.companyDissolved).toBe(true);
  });

  it('returns untouched links by identity and never mutates the input', () => {
    const original = officerLink();
    const graph = { nodes: [COMPANY, OFFICER], links: [original] };
    const map = buildOfficerEventMap([{
      company: COMPANY.name,
      events: eventsFor({ name: 'SOMEONE ELSE', event_type: 'Nombramientos', position: 'CONSEJERO' }),
    }]);

    const [link] = applyOfficerEventsToLinks(graph, map);

    expect(link).toBe(original);
    expect(original.events).toBeUndefined();
  });

  it('can be limited to the links of chosen companies', () => {
    const other = { id: 'c2', name: 'OTHER SL', type: 'spanish-company-group' };
    const graph = {
      nodes: [{ ...COMPANY, isDissolved: true }, { ...other, isDissolved: true }, OFFICER],
      links: [officerLink(), officerLink({ target: 'c2' })],
    };

    const [inScope, outOfScope] = applyOfficerEventsToLinks(graph, new Map(), {
      companyIds: new Set(['c1']),
    });

    expect(inScope.companyDissolved).toBe(true);
    expect(outOfScope.companyDissolved).toBeUndefined();
  });
});
