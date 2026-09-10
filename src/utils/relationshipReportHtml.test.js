import { describe, expect, it } from 'vitest';
import { buildReportHtml } from './relationshipReportHtml';

const doc = {
  subject: 'ALFA SL',
  generatedAt: '2026-09-10T09:00:00.000Z',
  networkNote: 'Checking a suspected common controller.',
  flagged: [{ nodeId: 'c1', name: 'ALFA SL', type: 'company', flag: 'red', text: 'Same address as BETA' }],
  companies: [{ nodeId: 'c1', name: 'ALFA SL', note: { text: 'Same address as BETA', flag: 'red' } }],
  connectors: [{ name: 'GARCIA LOPEZ ANA', nodeId: 'o1', type: 'individual', companies: ['ALFA SL', 'BETA SL'], roles: ['Administrador'], status: 'active', note: null }],
  ownership: [{ owner: 'ALFA SL', owned: 'BETA SL', lost: false }],
  otherNotes: [{ nodeId: 'o2', name: 'RUIZ MARTIN LUIS', type: 'officer', flag: 'blue', text: 'Resigned days before the filing' }],
  corrections: [],
  counts: { companies: 2, officers: 2, sharedPeople: 1, notes: 2, flagged: 1 },
};

describe('buildReportHtml', () => {
  it('carries the network note, flagged findings and other notes', () => {
    const html = buildReportHtml(doc, { es: true });

    expect(html).toContain('Checking a suspected common controller.');
    expect(html).toContain('Same address as BETA');
    expect(html).toContain('Resigned days before the filing');
  });

  it('uses the settled name in both languages', () => {
    expect(buildReportHtml(doc, { es: true })).toContain('Informe de situación');
    expect(buildReportHtml(doc, { es: false })).toContain('Situation report');
  });

  it('escapes hostile note text', () => {
    const hostile = { ...doc, networkNote: '<script>alert(1)</script>' };
    const html = buildReportHtml(hostile, { es: true });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes hostile correction data', () => {
    const hostile = {
      ...doc,
      corrections: [{ nameA: '<img src=x onerror="alert(1)">', action: 'hide' }],
    };
    const html = buildReportHtml(hostile, { es: true });

    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img src=x onerror');
  });

  it('omits the flagged block when nothing is flagged', () => {
    const html = buildReportHtml({ ...doc, flagged: [] }, { es: true });

    expect(html).not.toContain('Señalado');
  });

  it('still renders a document with no notes at all', () => {
    const bare = { ...doc, networkNote: '', flagged: [], otherNotes: [], companies: [{ nodeId: 'c1', name: 'ALFA SL', note: null }] };

    expect(buildReportHtml(bare, { es: true })).toContain('ALFA SL');
  });

  it('renders corrections with verbs mapped from actions', () => {
    const withCorrections = {
      ...doc,
      corrections: [
        { nameA: 'GARCIA LOPEZ ANA', action: 'hide' },
        { nameA: 'OLD NAME', action: 'merge', nameB: 'NEW NAME' },
        { nameA: 'OFFICER X', action: 'mark_resigned', resignedDate: '2026-01-15' },
        { nameA: 'OFFICER Y', action: 'mark_active' },
      ],
    };
    const html = buildReportHtml(withCorrections, { es: true });

    expect(html).toContain('GARCIA LOPEZ ANA');
    expect(html).toContain('OLD NAME');
    expect(html).toContain('NEW NAME');
    expect(html).toContain('OFFICER X');
    expect(html).toContain('2026-01-15');
  });

  it('omits the corrections block when nothing is corrected', () => {
    const html = buildReportHtml({ ...doc, corrections: [] }, { es: true });

    expect(html).not.toContain('Correcciones');
  });
});
