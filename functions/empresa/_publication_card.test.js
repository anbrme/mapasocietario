import { describe, it, expect } from 'vitest';
import { publicationCard, eventsBlock, isBoeUrl } from './_lib.js';

const T_ES = {
  registryAct: 'Acto registral',
  historyFullText: 'Texto completo',
  historyHideFull: 'Ocultar',
  historyViewSource: 'Ver en el BORME (PDF)',
  historyEntryNumber: (letter, n) => (letter ? `BORME-${letter} nº ${n}` : `nº ${n}`),
  historyUnknownYear: 'Sin fecha',
  historyYear: (year, count) => `${year} · ${count} publicaciones`,
  historyBatch: (from, to) => `Ver publicaciones ${from}–${to}`,
  historyIntro: () => '',
  historyChartTitle: '',
  historyChartNote: '',
  historyMatrixHeaders: {},
  historyChangeTypes: {},
  recentHistory: 'Historial de publicaciones (BORME)',
};

const T_EN = {
  registryAct: 'Registry act',
  historyFullText: 'Full text',
  historyHideFull: 'Hide',
  historyViewSource: 'View in BORME (PDF)',
  historyEntryNumber: (letter, n) => (letter ? `BORME-${letter} No. ${n}` : `No. ${n}`),
  historyUnknownYear: 'Undated',
  historyYear: (year, count) => `${year} · ${count} publications`,
  historyBatch: (from, to) => `View publications ${from}–${to}`,
  historyIntro: () => '',
  historyChartTitle: '',
  historyChartNote: '',
  historyMatrixHeaders: {},
  historyChangeTypes: {},
  recentHistory: 'Publication history (BORME)',
};

const LONG_ENTRY =
  'Nombramiento de administrador. '.repeat(10) + 'Texto adicional con datos <sensibles> & "comillas" al final.';

describe('publicationCard', () => {
  it('wraps a long entry in <details>, keeping the ~180 char snippet as the summary', () => {
    const event = {
      event_date: '2026-08-24',
      event_types: ['Nombramientos'],
      full_entry: LONG_ENTRY,
    };
    const html = publicationCard(event, T_ES, 'es');

    expect(html).toContain('<details class="entry-detail">');
    expect(LONG_ENTRY.length).toBeGreaterThan(180);
    const snippet = LONG_ENTRY.slice(0, 180);
    expect(html).toContain(`<span class="entry-preview">${snippet}…</span>`);
    // The toggle carries both labels as data so CSS swaps them on open — the
    // preview is hidden then, so the text is never shown twice.
    expect(html).toContain('<span class="entry-toggle" data-closed="Texto completo" data-open="Ocultar"></span>');
  });

  it('bolds the act labels in the full text, as the BORME does', () => {
    const fullEntry =
      'Ceses/Dimisiones. Consejero: HAJJAJI ABDEL KARIM. Presidente: HAJJAJI ABDEL KARIM. ' +
      'Nombramientos. Consejero: RUIZ SENA XAVIER ANTONI. Presidente: RUIZ SENA XAVIER ANTONI. ' +
      'Datos registrales. S 8 , H M 182503, I/A 113 (26.05.26).';
    const event = {
      event_date: '2026-06-02',
      event_types: [
        { category: 'officers', type: 'Ceses/Dimisiones' },
        { category: 'officers', type: 'Nombramientos' },
        { category: 'administrative', type: 'Datos registrales' },
      ],
      full_entry: fullEntry,
    };
    const html = publicationCard(event, T_ES, 'es');

    expect(html).toContain('<p class="entry-full"><b>Ceses/Dimisiones.</b> Consejero: HAJJAJI ABDEL KARIM.');
    expect(html).toContain(' <b>Nombramientos.</b> Consejero: RUIZ SENA');
    expect(html).toContain(' <b>Datos registrales.</b> S 8 , H M 182503, I/A 113 (26.05.26).</p>');
    // Only act labels are bold — never a name or a registry reference.
    expect((html.match(/<b>/g) || []).length).toBe(3);
  });

  it('escapes the full text and preserves whitespace via the entry-full class', () => {
    const event = {
      event_date: '2026-08-24',
      event_types: ['Nombramientos'],
      full_entry: LONG_ENTRY,
    };
    const html = publicationCard(event, T_ES, 'es');

    expect(html).toContain('class="entry-full"');
    expect(html).toContain('&lt;sensibles&gt;');
    expect(html).not.toContain('<sensibles>');
    // The unescaped source text is never emitted verbatim.
    expect(html).not.toContain(LONG_ENTRY);
  });

  it('renders a short entry as plain text with no <details>', () => {
    const event = {
      event_date: '2026-08-24',
      event_types: ['Constitución'],
      full_entry: 'Constitución de la sociedad.',
    };
    const html = publicationCard(event, T_ES, 'es');

    expect(html).not.toContain('<details');
    expect(html).toContain('<p>Constitución de la sociedad.</p>');
  });

  it('links to the official PDF when pdf_url is present, per language', () => {
    const event = {
      event_date: '2026-08-24',
      event_types: ['Constitución'],
      full_entry: 'Texto breve.',
      pdf_url: 'https://www.boe.es/borme/dias/2026/08/24/pdfs/BORME-A-2026-162-15.pdf',
    };

    const es = publicationCard(event, T_ES, 'es');
    expect(es).toContain(
      '<a href="https://www.boe.es/borme/dias/2026/08/24/pdfs/BORME-A-2026-162-15.pdf" target="_blank" rel="noopener">Ver en el BORME (PDF)</a>',
    );

    const en = publicationCard(event, T_EN, 'en');
    expect(en).toContain(
      '<a href="https://www.boe.es/borme/dias/2026/08/24/pdfs/BORME-A-2026-162-15.pdf" target="_blank" rel="noopener">View in BORME (PDF)</a>',
    );
  });

  it('never renders a dead anchor when pdf_url is missing', () => {
    const event = {
      event_date: '2026-08-24',
      event_types: ['Constitución'],
      full_entry: 'Texto breve.',
    };
    const html = publicationCard(event, T_ES, 'es');

    expect(html).not.toContain('<a');
  });

  it('renders just the number label when the entry number is known but no PDF url is', () => {
    const event = {
      event_date: '2026-08-24',
      event_types: ['Constitución'],
      full_entry: 'Texto breve.',
      borme_entry_number: 15,
    };

    const es = publicationCard(event, T_ES, 'es');
    expect(es).toContain('nº 15');
    expect(es).not.toContain('BORME-');

    const en = publicationCard(event, T_EN, 'en');
    expect(en).toContain('No. 15');
    expect(en).not.toContain('BORME-');
  });

  it('derives the BORME section letter from the pdf_url and combines it with the entry number', () => {
    const sectionA = {
      event_date: '2026-08-24',
      event_types: ['Constitución'],
      full_entry: 'Texto breve.',
      pdf_url: 'https://www.boe.es/borme/dias/2026/08/24/pdfs/BORME-A-2026-162-15.pdf',
      borme_entry_number: 15,
    };
    expect(publicationCard(sectionA, T_ES, 'es')).toContain('BORME-A nº 15');

    const sectionB = {
      event_date: '2026-08-24',
      event_types: ['Constitución'],
      full_entry: 'Texto breve.',
      pdf_url: 'https://www.boe.es/borme/dias/2026/08/24/pdfs/BORME-B-2026-162-15.pdf',
      borme_entry_number: 15,
    };
    expect(publicationCard(sectionB, T_ES, 'es')).toContain('BORME-B nº 15');

    const noUrl = {
      event_date: '2026-08-24',
      event_types: ['Constitución'],
      full_entry: 'Texto breve.',
      borme_entry_number: 15,
    };
    const html = publicationCard(noUrl, T_ES, 'es');
    expect(html).toContain('nº 15');
    expect(html).not.toContain('BORME-');
  });

  it('omits the source line entirely when neither pdf_url nor entry number is known', () => {
    const event = {
      event_date: '2026-08-24',
      event_types: ['Constitución'],
      full_entry: 'Texto breve.',
    };
    const html = publicationCard(event, T_ES, 'es');

    expect(html).not.toContain('entry-source');
  });

  it('never renders an anchor for a non-boe.es pdf_url, even a javascript: scheme', () => {
    const jsScheme = {
      event_date: '2026-08-24',
      event_types: ['Constitución'],
      full_entry: 'Texto breve.',
      pdf_url: 'javascript:alert(1)',
    };
    expect(publicationCard(jsScheme, T_ES, 'es')).not.toContain('<a');

    const evilHost = {
      event_date: '2026-08-24',
      event_types: ['Constitución'],
      full_entry: 'Texto breve.',
      pdf_url: 'https://evil.example/x.pdf',
    };
    expect(publicationCard(evilHost, T_ES, 'es')).not.toContain('<a');
  });

  it('renders an anchor for a genuine boe.es pdf_url', () => {
    const event = {
      event_date: '2026-08-24',
      event_types: ['Constitución'],
      full_entry: 'Texto breve.',
      pdf_url: 'https://www.boe.es/borme/dias/2026/08/24/pdfs/BORME-A-2026-162-15.pdf',
    };
    expect(publicationCard(event, T_ES, 'es')).toContain('<a href="https://www.boe.es/');
  });
});

describe('isBoeUrl', () => {
  it('accepts an absolute https URL under boe.es', () => {
    expect(isBoeUrl('https://www.boe.es/borme/dias/2026/08/24/pdfs/BORME-A-2026-162-15.pdf')).toBe(true);
  });

  it('rejects a javascript: scheme', () => {
    expect(isBoeUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects a different host, even one that resembles boe.es', () => {
    expect(isBoeUrl('https://evil.example/x.pdf')).toBe(false);
    expect(isBoeUrl('https://www.boe.es.evil.example/x.pdf')).toBe(false);
  });

  it('rejects null, undefined, and non-string values', () => {
    expect(isBoeUrl(null)).toBe(false);
    expect(isBoeUrl(undefined)).toBe(false);
    expect(isBoeUrl(42)).toBe(false);
  });
});

describe('eventsBlock', () => {
  it('still renders exactly one card per event', () => {
    const events = [
      { event_date: '2026-08-24', event_types: ['Constitución'], full_entry: 'Uno.' },
      { event_date: '2026-08-20', event_types: ['Nombramientos'], full_entry: 'Dos.' },
      { event_date: '2025-01-05', event_types: ['Ceses'], full_entry: 'Tres.' },
    ];
    const html = eventsBlock(events, T_ES, 'es');

    expect(html.match(/<li>/g)?.length).toBe(3);
  });
});
