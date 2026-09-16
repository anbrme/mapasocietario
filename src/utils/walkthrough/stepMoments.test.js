import { describe, it, expect } from 'vitest';
import { momentOptions, momentReason, MOMENT_OPTION_CAP } from './stepMoments';

const personStep = (seats, moment = null, momentSource = 'draft') => ({
  kind: 'person', moment, momentSource, evidence: { seats },
});

const companyStep = (evidence, moment = null, momentSource = 'draft') => ({
  kind: 'company', moment, momentSource, evidence,
});

describe('momentOptions', () => {
  it('names the act behind every one of a person’s seat dates', () => {
    const step = personStep([
      { company: 'ACME SL', role: 'Administrador único', since: '2011-04-02', until: '2019-06-30' },
      { company: 'BETA SA', role: 'Consejero', since: '2015-01-15', until: '' },
    ]);
    expect(momentOptions(step, 'es')).toEqual([
      { date: '2019-06-30', label: 'Cese · Administrador único en ACME SL' },
      { date: '2015-01-15', label: 'Nombramiento · Consejero en BETA SA' },
      { date: '2011-04-02', label: 'Nombramiento · Administrador único en ACME SL' },
    ]);
  });

  it('offers a company its filings, findings and board dates, most recent first', () => {
    const step = companyStep({
      status: { lastFiling: { date: '2023-09-01', type: 'Nombramientos' } },
      filings: [{ date: '2023-09-01', type: 'Nombramientos' }, { date: '2021-02-11', type: 'Ceses' }],
      findings: [{ date: '2022-05-05', text: 'Capital ampliado' }],
      board: [{ name: 'JUAN PÉREZ', role: 'Consejero', since: '2018-03-03', until: '' }],
    });
    expect(momentOptions(step, 'es')).toEqual([
      { date: '2023-09-01', label: 'Último acto BORME · Nombramientos' },
      { date: '2022-05-05', label: 'Lo que destaca · Capital ampliado' },
      { date: '2021-02-11', label: 'Acto BORME · Ceses' },
      { date: '2018-03-03', label: 'Nombramiento · Consejero: JUAN PÉREZ' },
    ]);
  });

  it('keeps one entry per day, labelled by the most explanatory source', () => {
    const step = companyStep({
      status: { lastFiling: { date: '2023-09-01', type: 'Nombramientos' } },
      filings: [{ date: '2023-09-01', type: 'Nombramientos' }],
      board: [{ name: 'JUAN PÉREZ', role: 'Consejero', since: '2023-09-01', until: '' }],
    });
    const options = momentOptions(step, 'es');
    expect(options).toHaveLength(1);
    expect(options[0].label).toBe('Último acto BORME · Nombramientos');
  });

  it('walks a connection chapter’s hops', () => {
    const step = {
      kind: 'connection',
      evidence: { hops: [{ who: 'ANA', at: 'ACME SL', role: 'Apoderada', since: '2017-07-07', until: '' }] },
    };
    expect(momentOptions(step, 'en')).toEqual([
      { date: '2017-07-07', label: 'Appointed · Apoderada at ACME SL' },
    ]);
  });

  it('ignores blank and malformed dates, and caps a very long history', () => {
    const noisy = personStep([
      { company: 'ACME SL', role: 'Consejero', since: '', until: null },
      { company: 'ACME SL', role: 'Consejero', since: 'hace tiempo', until: '2019-06-30T09:00:00Z' },
    ]);
    expect(momentOptions(noisy, 'es')).toEqual([
      { date: '2019-06-30', label: 'Cese · Consejero en ACME SL' },
    ]);

    const long = personStep(Array.from({ length: 60 }, (_, i) => ({
      company: 'ACME SL', role: 'Consejero', since: `20${String(i).padStart(2, '0')}-01-01`, until: '',
    })));
    expect(momentOptions(long, 'es')).toHaveLength(MOMENT_OPTION_CAP);
  });

  it('survives a step with no evidence at all', () => {
    expect(momentOptions(null, 'es')).toEqual([]);
    expect(momentOptions({ kind: 'person' }, 'es')).toEqual([]);
  });
});

describe('momentReason', () => {
  const seats = [{ company: 'ACME SL', role: 'Administrador único', since: '2011-04-02', until: '2019-06-30' }];

  it('says what a preselected date refers to', () => {
    const reason = momentReason(personStep(seats, '2019-06-30', 'draft'), 'es');
    expect(reason).toContain('Preseleccionada');
    expect(reason).toContain('Cese · Administrador único en ACME SL');
  });

  it('marks a date the author picked from the registry as theirs', () => {
    const reason = momentReason(personStep(seats, '2011-04-02', 'author'), 'es');
    expect(reason).toContain('Elegida por ti');
    expect(reason).toContain('Nombramiento · Administrador único en ACME SL');
  });

  it('is honest about a date no filing in this chapter accounts for', () => {
    expect(momentReason(personStep(seats, '2020-02-02', 'author'), 'en'))
      .toBe('Your own date; it matches no registry filing in this chapter.');
  });

  it('explains what an undated chapter loses', () => {
    expect(momentReason(personStep(seats, null), 'en')).toBe('No date: the chapter stays out of the chronology.');
  });
});
