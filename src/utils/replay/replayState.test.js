import { describe, it, expect } from 'vitest';
import { buildCompanyReplayModel } from './replayModel';
import { replayStateAt, actsBetween } from './replayState';

const ev = (date, officers, flags = {}) => ({
  _id: date,
  event_date: date,
  officers: officers.map(([name, position, event_type]) => ({ name, position, event_type })),
  ...flags,
});

const model = buildCompanyReplayModel([
  ev('2012-01-10', [['PEREZ LUIS', 'CONSEJERO', 'Nombramientos'], ['PEREZ LUIS', 'APODERADO', 'Nombramientos']]),
  ev('2013-05-05', [['GIL ANA', 'ADM. UNICO', 'Ceses/Dimisiones']]),
  ev('2015-03-01', [['PEREZ LUIS', 'APODERADO', 'Revocaciones']]),
  ev('2016-01-01', [['APO SOLO', 'APODERADO', 'Nombramientos']]),
  ev('2020-02-02', [], { has_dissolution: true }),
], { id: 'H:M-1', name: 'ACME SA' }, { today: '2026-09-18' });

const idOf = name => model.counterparts.find(c => c.name === name).id;

describe('replayStateAt', () => {
  it('hides a counterpart before its first act', () => {
    expect(replayStateAt(model, '2011-12-31').get(idOf('PEREZ LUIS')).status).toBe('hidden');
  });

  it('keeps a link live while any of its roles is open', () => {
    const s = replayStateAt(model, '2015-06-01').get(idOf('PEREZ LUIS'));
    expect(s.status).toBe('live');
    expect(s.liveRoles).toEqual(['CONSEJERO']);
  });

  it('draws an unknown-start seat from the domain start, flagged', () => {
    const s = replayStateAt(model, model.domain.start).get(idOf('GIL ANA'));
    expect(s).toMatchObject({ status: 'live', unknownStart: true });
  });

  it('a seat ends ON its cessation day', () => {
    expect(replayStateAt(model, '2013-05-05').get(idOf('GIL ANA')).status).toBe('ceased');
  });

  it('marks an ending that was inferred, not published', () => {
    const s = replayStateAt(model, '2021-01-01').get(idOf('PEREZ LUIS'));
    expect(s).toMatchObject({ status: 'ceased', inferred: true });
  });

  it('drops counterparts whose every seat is in a hidden category', () => {
    const hidden = new Set(['Apoderado']);
    const s = replayStateAt(model, '2017-01-01', { hiddenCategories: hidden });
    expect(s.has(idOf('APO SOLO'))).toBe(false);
    expect(s.get(idOf('PEREZ LUIS')).liveRoles).toEqual(['CONSEJERO']);
  });
});

describe('actsBetween', () => {
  it('returns each act once as the clock moves forward', () => {
    const a = actsBetween(model, '2011-01-01', '2013-05-05');
    const b = actsBetween(model, '2013-05-05', '2016-01-01');
    expect(a.map(x => x.date)).toEqual(['2012-01-10', '2012-01-10', '2013-05-05']);
    expect(b.map(x => x.date)).toEqual(['2015-03-01', '2016-01-01']);
  });

  it('returns nothing when the clock stands still or runs backwards', () => {
    expect(actsBetween(model, '2016-01-01', '2016-01-01')).toEqual([]);
    expect(actsBetween(model, '2016-01-01', '2012-01-01')).toEqual([]);
  });
});
