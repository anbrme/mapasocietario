import { describe, it, expect } from 'vitest';
import { findingsView, findingsErrorView, findingsVisibleParams } from './findingsView';

const payload = {
  company: { name: 'INDITEX, SA', group_key: 'H:C-1', nif: 'A15075062', province: 'A Coruña',
             registry: 'C-1', previous_names: [], last_filing: { date: '2026-06-12', type: 'Nombramientos' } },
  findings: [
    { kind: 'governing_body_turnover', cls: 'concern', text: '3 governing-body changes published in the last 12 months',
      date: '2026-05-01', layer: 'authority', evidence: [{ kind: 'officer', ref: 'A' }],
      borme_ref: { date: '2026-05-01', entry: 'E-1', url: 'https://boe.es/n.pdf' } },
    { kind: 'no_insolvency_notice', cls: 'limitation', text: 'No dissolution … status.', date: null,
      layer: 'shape', evidence: [], borme_ref: null },
  ],
  more: 2,
  verification: ['The shareholder composition is not published by Spanish law.'],
  coverage: { since: '2009', indexed_through: '2026-06-12' },
  lang: 'en', tier: 'free',
};

describe('findingsView', () => {
  it('builds the identity header with NIF and province', () => {
    expect(findingsView(payload, 'en').header)
      .toEqual({ title: 'INDITEX, SA', nifLabel: 'NIF A15075062', nifMissing: false, province: 'A Coruña', formerly: null });
  });

  it('never leaves an empty NIF slot', () => {
    const v = findingsView({ ...payload, company: { ...payload.company, nif: null, province: null } }, 'en');
    expect(v.header.nifLabel).toBe('NIF not published in BORME');
    expect(v.header.nifMissing).toBe(true);
    expect(v.header.province).toBeNull();
  });

  it('names former names when the registry recorded any, omitting the line otherwise', () => {
    expect(findingsView(payload, 'en').header.formerly).toBeNull();
    const withFormer = { ...payload, company: { ...payload.company, previous_names: ['ZARA, SA', 'INDUSTRIAS TEXTILES, SA'] } };
    expect(findingsView(withFormer, 'en').header.formerly).toBe('formerly ZARA, SA, INDUSTRIAS TEXTILES, SA');
    expect(findingsView(withFormer, 'es').header.formerly).toBe('anteriormente ZARA, SA, INDUSTRIAS TEXTILES, SA');
  });

  it('strips a trailing registry-office annotation from the header title (the INDITEX case)', () => {
    const withSuffix = {
      ...payload,
      company: { ...payload.company, name: 'INDUSTRIA DE DISEÑO TEXTIL, S.A.(R.M. A CORUÑA)' },
    };
    expect(findingsView(withSuffix, 'en').header.title).toBe('INDUSTRIA DE DISEÑO TEXTIL, S.A.');
  });

  it('strips a trailing registry-office annotation from each former name', () => {
    const withSuffix = {
      ...payload,
      company: { ...payload.company, previous_names: ['ZARA, SA(R.M. A CORUÑA)', 'INDUSTRIAS TEXTILES, SA'] },
    };
    expect(findingsView(withSuffix, 'en').header.formerly).toBe('formerly ZARA, SA, INDUSTRIAS TEXTILES, SA');
  });

  it('states the latest filing, and omits the line when unknown', () => {
    expect(findingsView(payload, 'en').changed).toBe('Latest BORME filing: 2026-06-12 — Nombramientos');
    expect(findingsView({ ...payload, company: { ...payload.company, last_filing: null } }, 'en').changed).toBeNull();
  });

  it('maps findings to kind, tone, evidence target and BORME url in payload order', () => {
    const v = findingsView(payload, 'en');
    expect(v.findings.map(f => [f.kind, f.tone, f.date, f.evidence, f.bormeUrl])).toEqual([
      ['governing_body_turnover', 'concern', '2026-05-01', { kind: 'officer', ref: 'A' }, 'https://boe.es/n.pdf'],
      ['no_insolvency_notice', 'limitation', null, null, null],
    ]);
    expect(v.findings[0].key).toBe('governing_body_turnover:2026-05-01');
  });

  it('names what paid adds and how many more findings the report holds', () => {
    const v = findingsView(payload, 'en');
    expect(v.offer.title).toBe('Get the complete sourced assessment');
    expect(v.offer.more).toBe('and 2 more findings in the report');
    expect(v.moreCount).toBe(2);
    expect(findingsView({ ...payload, more: 0 }, 'en').offer.more).toBeNull();
    expect(findingsView({ ...payload, more: 1 }, 'es').offer.more).toBe('y 1 hallazgo más en el informe');
  });

  it('passes verification lines through', () => {
    expect(findingsView(payload, 'en').verification).toEqual(payload.verification);
  });

  it('speaks Spanish when asked', () => {
    const v = findingsView(payload, 'es');
    expect(v.changed).toBe('Última inscripción en el BORME: 2026-06-12 — Nombramientos');
    expect(v.labels.standsOut).toBe('Lo que destaca');
  });

  it('has an honest error line', () => {
    expect(findingsErrorView('en').text).toBe('Findings unavailable right now — the table below is unaffected.');
    expect(findingsErrorView('es').text).toBe('Los hallazgos no están disponibles ahora mismo — la tabla de abajo no se ve afectada.');
  });

  it('summarises the block for the findings_visible event', () => {
    expect(findingsVisibleParams(findingsView(payload, 'en'))).toEqual({ count: 2, concerns: 1, limitations: 1, more: 2 });
  });

  it('tolerates an empty payload', () => {
    const v = findingsView({}, 'en');
    expect(v.findings).toEqual([]);
    expect(v.header.nifMissing).toBe(true);
    expect(v.changed).toBeNull();
  });
});
