import { describe, it, expect } from 'vitest';
import {
  classifyAct,
  buildCompanyReplayModel,
  buildOfficerReplayModel,
  activityByMonth,
} from './replayModel';

const TODAY = '2026-09-18';

// A borme_events_v3 event, reduced to the fields the model reads.
const ev = (date, officers, flags = {}) => ({
  _id: `${date}-${officers.map(o => o[0]).join('-')}`,
  event_date: date,
  officers: officers.map(([name, position, event_type]) => ({ name, position, event_type })),
  ...flags,
});

const termsOf = (model, name) =>
  model.terms.filter(t => model.counterparts.find(c => c.id === t.counterpartId)?.name === name);

describe('classifyAct', () => {
  it('prefers the server classification', () => {
    expect(classifyAct({ movement: 'appointment', event_type: 'Revocaciones' })).toBe('appointment');
    expect(classifyAct({ movement: 'other', event_type: 'Nombramientos' })).toBeNull();
  });

  it('reads the registry vocabulary case-insensitively', () => {
    expect(classifyAct({ event_type: 'Nombramientos' })).toBe('appointment');
    expect(classifyAct({ event_type: 'REELECCIONES' })).toBe('appointment');
    expect(classifyAct({ event_type: 'Ceses/Dimisiones' })).toBe('cessation');
    expect(classifyAct({ event_type: 'Revocaciones' })).toBe('cessation');
  });

  it('refuses to guess an unmapped act — it must never close a seat', () => {
    expect(classifyAct({ event_type: 'Cancelaciones de oficio' })).toBeNull();
    expect(classifyAct({})).toBeNull();
  });
});

describe('buildCompanyReplayModel', () => {
  const subject = { id: 'H:M-1', name: 'ACME SA' };

  it('a reappointment after a cessation is two terms', () => {
    const model = buildCompanyReplayModel([
      ev('2012-01-10', [['PEREZ LUIS', 'CONSEJERO', 'Nombramientos']]),
      ev('2015-03-01', [['PEREZ LUIS', 'CONSEJERO', 'Ceses/Dimisiones']]),
      ev('2018-06-01', [['PEREZ LUIS', 'CONSEJERO', 'Nombramientos']]),
    ], subject, { today: TODAY });

    expect(termsOf(model, 'PEREZ LUIS').map(t => [t.from, t.to])).toEqual([
      ['2012-01-10', '2015-03-01'],
      ['2018-06-01', null],
    ]);
  });

  it('a renewal while the term is open stays one term', () => {
    const model = buildCompanyReplayModel([
      ev('2012-01-10', [['PEREZ LUIS', 'CONSEJERO', 'Nombramientos']]),
      ev('2017-01-10', [['PEREZ LUIS', 'CONSEJERO', 'Reelecciones']]),
    ], subject, { today: TODAY });

    expect(termsOf(model, 'PEREZ LUIS')).toHaveLength(1);
    expect(termsOf(model, 'PEREZ LUIS')[0].to).toBeNull();
  });

  it('a same-day cese and re-appointment ends with the seat held', () => {
    const model = buildCompanyReplayModel([
      ev('2012-01-10', [['PEREZ LUIS', 'CONSEJERO', 'Nombramientos']]),
      ev('2018-06-01', [
        ['PEREZ LUIS', 'CONSEJERO', 'Ceses/Dimisiones'],
        ['PEREZ LUIS', 'CONSEJERO', 'Nombramientos'],
      ]),
    ], subject, { today: TODAY });

    const terms = termsOf(model, 'PEREZ LUIS');
    expect(terms[terms.length - 1].to).toBeNull();
  });

  it('a cessation with no appointment in the record has an unknown start', () => {
    const model = buildCompanyReplayModel([
      ev('2014-05-05', [['GIL ANA', 'ADM. UNICO', 'Ceses/Dimisiones']]),
    ], subject, { today: TODAY });

    const [term] = termsOf(model, 'GIL ANA');
    expect(term.from).toBeNull();
    expect(term.to).toBe('2014-05-05');
    expect(term.endKind).toBe('published');
  });

  it('a cessation spelled differently from its appointment closes that seat', () => {
    const model = buildCompanyReplayModel([
      ev('2012-01-10', [['PEREZ LUIS', 'CONS. DELEG.', 'Nombramientos']]),
      ev('2015-03-01', [['PEREZ LUIS', 'CON.DELEGADO', 'Ceses/Dimisiones']]),
    ], subject, { today: TODAY });

    expect(termsOf(model, 'PEREZ LUIS').map(t => [t.from, t.to])).toEqual([['2012-01-10', '2015-03-01']]);
  });

  it('an unmapped act neither opens nor closes a seat', () => {
    const model = buildCompanyReplayModel([
      ev('2012-01-10', [['PEREZ LUIS', 'CONSEJERO', 'Nombramientos']]),
      ev('2013-01-10', [['PEREZ LUIS', 'CONSEJERO', 'Otros conceptos']]),
    ], subject, { today: TODAY });

    expect(termsOf(model, 'PEREZ LUIS')[0].to).toBeNull();
    expect(model.acts).toHaveLength(1);
  });

  it('a dissolution closes open seats as inferred, and leaves published cessations alone', () => {
    const model = buildCompanyReplayModel([
      ev('2012-01-10', [['PEREZ LUIS', 'CONSEJERO', 'Nombramientos'], ['GIL ANA', 'CONSEJERO', 'Nombramientos']]),
      ev('2014-01-10', [['GIL ANA', 'CONSEJERO', 'Ceses/Dimisiones']]),
      ev('2020-02-02', [['RUIZ EVA', 'LIQUIDADOR', 'Nombramientos']], { has_dissolution: true }),
    ], subject, { today: TODAY });

    expect(termsOf(model, 'PEREZ LUIS')[0]).toMatchObject({ to: '2020-02-02', endKind: 'inferred' });
    expect(termsOf(model, 'GIL ANA')[0]).toMatchObject({ to: '2014-01-10', endKind: 'published' });
    // The liquidator is appointed BY the dissolution act; it does not end it.
    expect(termsOf(model, 'RUIZ EVA')[0].to).toBeNull();
    expect(model.acts.filter(a => a.kind === 'closure').map(a => a.counterpartId))
      .toEqual([model.counterparts.find(c => c.name === 'PEREZ LUIS').id]);
  });

  it('extinction closes every open seat, liquidators included', () => {
    const model = buildCompanyReplayModel([
      ev('2020-02-02', [['RUIZ EVA', 'LIQUIDADOR', 'Nombramientos']], { has_dissolution: true }),
      ev('2021-02-02', [], { has_registry_closure: true }),
    ], subject, { today: TODAY });

    expect(termsOf(model, 'RUIZ EVA')[0]).toMatchObject({ to: '2021-02-02', endKind: 'inferred' });
  });

  it('two roles on one person are separate terms under one counterpart', () => {
    const model = buildCompanyReplayModel([
      ev('2012-01-10', [['PEREZ LUIS', 'CONSEJERO', 'Nombramientos'], ['PEREZ LUIS', 'APODERADO', 'Nombramientos']]),
      ev('2015-03-01', [['PEREZ LUIS', 'APODERADO', 'Revocaciones']]),
    ], subject, { today: TODAY });

    expect(model.counterparts).toHaveLength(1);
    expect(termsOf(model, 'PEREZ LUIS').map(t => [t.category, t.to])).toEqual(
      expect.arrayContaining([['Consejero', null], ['Apoderado', '2015-03-01']]),
    );
  });

  it('one person spelled with and without the legal form is one counterpart', () => {
    const model = buildCompanyReplayModel([
      ev('2012-01-10', [['GESTORA XYZ SOCIEDAD LIMITADA', 'ADM. UNICO', 'Nombramientos']]),
      ev('2015-03-01', [['GESTORA XYZ SL', 'ADM. UNICO', 'Ceses/Dimisiones']]),
    ], subject, { today: TODAY });

    expect(model.counterparts).toHaveLength(1);
  });

  it('orders counterparts by first act and acts by date', () => {
    const model = buildCompanyReplayModel([
      ev('2018-01-01', [['B', 'CONSEJERO', 'Nombramientos']]),
      ev('2012-01-01', [['A', 'CONSEJERO', 'Nombramientos']]),
    ], subject, { today: TODAY });

    expect(model.counterparts.map(c => [c.name, c.firstAct])).toEqual([['A', '2012-01-01'], ['B', '2018-01-01']]);
    expect(model.acts.map(a => a.date)).toEqual(['2012-01-01', '2018-01-01']);
  });

  it('flags a history that has no constitution act', () => {
    const withoutBirth = buildCompanyReplayModel([
      ev('2012-01-01', [['A', 'CONSEJERO', 'Nombramientos']]),
    ], subject, { today: TODAY });
    const withBirth = buildCompanyReplayModel([
      ev('2012-01-01', [['A', 'CONSEJERO', 'Nombramientos']], { has_constitution: true }),
    ], subject, { today: TODAY });

    expect(withoutBirth.completeness.recordsBegin).toBe('2012-01-01');
    expect(withBirth.completeness.recordsBegin).toBeNull();
  });

  it('runs the domain from before the first act to today for a live company', () => {
    const model = buildCompanyReplayModel([
      ev('2012-04-01', [['A', 'CONSEJERO', 'Nombramientos']]),
    ], subject, { today: TODAY });

    expect(model.domain).toEqual({ start: '2012-01-01', end: TODAY });
  });

  it('ends the domain shortly after the last act of a closed company', () => {
    const model = buildCompanyReplayModel([
      ev('2012-04-01', [['A', 'CONSEJERO', 'Nombramientos']]),
      ev('2016-04-01', [], { has_registry_closure: true }),
    ], subject, { today: TODAY });

    expect(model.domain.end).toBe('2016-10-01');
  });

  it('passes fetch completeness through', () => {
    const model = buildCompanyReplayModel([], subject, {
      today: TODAY,
      completeness: { loaded: 10, total: 12, truncatedBefore: '2011-01-01' },
    });

    expect(model.completeness).toMatchObject({ loaded: 10, total: 12, truncatedBefore: '2011-01-01' });
  });
});

describe('buildOfficerReplayModel', () => {
  const subject = { id: 'officer-perez-luis', name: 'PEREZ LUIS' };
  const mv = (date, company, position, movement, group_key = `N:${company}`) =>
    ({ event_date: date, company_name: company, group_key, position, movement, event_type: '' });

  it('makes each company a counterpart keyed by its registry identity', () => {
    const model = buildOfficerReplayModel([
      mv('2012-01-10', 'ACME SA', 'CONSEJERO', 'appointment', 'H:M-1'),
      mv('2015-01-10', 'ACME, S.A.', 'CONSEJERO', 'cessation', 'H:M-1'),
      mv('2016-01-10', 'BETA SL', 'ADM. UNICO', 'appointment', 'H:M-2'),
    ], subject, { today: TODAY });

    expect(model.counterparts.map(c => [c.id, c.kind])).toEqual([['H:M-1', 'company'], ['H:M-2', 'company']]);
    expect(model.terms.find(t => t.counterpartId === 'H:M-1')).toMatchObject({ from: '2012-01-10', to: '2015-01-10' });
  });

  it('never infers a closure it was not told about', () => {
    const model = buildOfficerReplayModel([
      mv('2012-01-10', 'ACME SA', 'CONSEJERO', 'appointment'),
    ], subject, { today: TODAY });

    expect(model.terms[0].to).toBeNull();
    expect(model.domain.end).toBe(TODAY);
  });
});

describe('activityByMonth', () => {
  it('counts appointments and cessations per month, hidden categories apart', () => {
    const model = buildCompanyReplayModel([
      ev('2012-01-10', [['A', 'CONSEJERO', 'Nombramientos'], ['B', 'APODERADO', 'Nombramientos']]),
      ev('2012-01-20', [['A', 'CONSEJERO', 'Ceses/Dimisiones']]),
      ev('2012-03-01', [['C', 'CONSEJERO', 'Nombramientos']]),
    ], { id: 'H:M-1', name: 'ACME SA' }, { today: '2012-06-01' });

    const bins = activityByMonth(model, { hiddenCategories: new Set(['Apoderado']) });
    const jan = bins.find(b => b.month === '2012-01');
    expect(jan).toEqual({ month: '2012-01', appointments: 1, cessations: 1, hidden: 1 });
    expect(bins.find(b => b.month === '2012-02')).toEqual({ month: '2012-02', appointments: 0, cessations: 0, hidden: 0 });
    expect(bins.map(b => b.month)).toEqual(['2011-10', '2011-11', '2011-12', '2012-01', '2012-02', '2012-03', '2012-04', '2012-05', '2012-06']);
  });
});
