import { describe, it, expect } from 'vitest';
import { buildTrademarksBlock } from './_trademarks.js';

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const t = {
  marksTitle: 'Marcas',
  marksSub: 'sub',
  marksBtn: 'Ver marcas',
  marksLoading: 'Cargando…',
  marksEmpty: 'Sin marcas',
  marksError: 'Error',
  marksRetry: 'Reintentar',
  marksThMark: 'Marca',
  marksThStatus: 'Estado',
  marksThClasses: 'Clases',
  marksThDate: 'Fecha',
  marksSource: 'Fuente:',
  marksSearchLink: 'TMview',
  marksCoverage: 'cobertura',
  marksPartial: 'parcial',
  marksBadgeEu: 'UE',
  marksBadgeEs: 'ES',
  marksDisclaimer: 'no afiliado',
};

describe('buildTrademarksBlock', () => {
  it('returns empty string when company has no name', () => {
    expect(buildTrademarksBlock({ company: {}, t, lang: 'es', apiBase: 'https://api.x', esc })).toBe('');
  });

  it('renders a section shell with button, body data attrs and i18n json', () => {
    const html = buildTrademarksBlock({
      company: { name: 'FIESTAS GUIRCA SL', nif: 'B12345678' },
      t,
      lang: 'es',
      apiBase: 'https://api.ncdata.eu',
      esc,
    });
    expect(html).toContain('id="marks-section"');
    expect(html).toContain('id="marks-btn"');
    expect(html).toContain('id="marks-body"');
    expect(html).toContain('data-name="FIESTAS GUIRCA SL"');
    expect(html).toContain('data-nif="B12345678"');
    expect(html).toContain('data-lang="es"');
    expect(html).toContain('data-api="https://api.ncdata.eu"');
    expect(html).toContain('id="marks-i18n"');
    expect(html).toContain('/bormes/trademarks-by-company?name=');
    expect(html).toContain(t.marksDisclaimer);
  });

  it('escapes the company name in the data attribute', () => {
    const html = buildTrademarksBlock({
      company: { name: 'A & B "quote" <x>' },
      t,
      lang: 'en',
      apiBase: 'https://api.x',
      esc,
    });
    expect(html).toContain('data-name="A &amp; B &quot;quote&quot; &lt;x&gt;"');
    expect(html).not.toContain('data-name="A & B "quote" <x>"');
  });

  it('renders even when no nif is present (data-nif empty)', () => {
    const html = buildTrademarksBlock({ company: { name: 'ACME' }, t, lang: 'es', apiBase: 'https://api.x', esc });
    expect(html).toContain('data-nif=""');
  });

  it('does not use innerHTML in the client IIFE', () => {
    const html = buildTrademarksBlock({ company: { name: 'ACME' }, t, lang: 'es', apiBase: 'https://api.x', esc });
    expect(html).not.toContain('innerHTML');
  });
});
