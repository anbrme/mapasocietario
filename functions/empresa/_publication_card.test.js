import { describe, it, expect } from 'vitest';
import { publicationCard, eventsBlock } from './_lib.js';

const T_ES = {
  registryAct: 'Acto registral',
  historyViewSource: 'Ver en el BORME (PDF)',
  historyEntryNumber: (n) => `BORME-A · nº ${n}`,
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
  historyViewSource: 'View in BORME (PDF)',
  historyEntryNumber: (n) => `BORME-A · No. ${n}`,
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
    expect(html).toContain(`<summary>${snippet}…</summary>`);
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

  it('renders the BORME entry number when present', () => {
    const event = {
      event_date: '2026-08-24',
      event_types: ['Constitución'],
      full_entry: 'Texto breve.',
      borme_entry_number: 15,
    };

    const es = publicationCard(event, T_ES, 'es');
    expect(es).toContain('BORME-A · nº 15');

    const en = publicationCard(event, T_EN, 'en');
    expect(en).toContain('BORME-A · No. 15');
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
