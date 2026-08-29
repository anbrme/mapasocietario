import { describe, it, expect } from 'vitest';
import { deputyTenure } from './deputyTenure';

const row = (o) => ({ LEGISLATURA: 'X', ...o });

describe('deputyTenure', () => {
  it('a deputy who served out their last term is FORMER, not sitting', () => {
    // The ACEBES case: legislatures VI-IX, none with a FECHABAJA because he
    // simply did not stand again. Published as "— present" in 2026.
    const rows = [
      row({ LEGISLATURA: 'VI', FECHAINICIOLEGISLATURA: '27/03/1996', FECHAFINLEGISLATURA: '18/01/2000' }),
      row({ LEGISLATURA: 'IX', FECHAINICIOLEGISLATURA: '01/04/2008', FECHAFINLEGISLATURA: '13/12/2011' }),
    ];
    const t = deputyTenure(rows);
    expect(t.isFormer).toBe(true);
    expect(t.earliest).toBe('27/03/1996');
    expect(t.latest).toBe('13/12/2011');
    expect(t.sittingLegislature).toBeNull();
  });

  it('a seat in the CURRENT legislature makes someone sitting', () => {
    const t = deputyTenure([
      row({ LEGISLATURA: 'XIV', LEGISLATURAACTUAL: 'S', FECHAINICIOLEGISLATURA: '03/12/2019' }),
    ]);
    expect(t.isFormer).toBe(false);
    expect(t.sittingLegislature).toBe('XIV');
  });

  it('leaving the current legislature early makes someone former again', () => {
    const t = deputyTenure([
      row({ LEGISLATURA: 'XIV', LEGISLATURAACTUAL: 'S',
            FECHAINICIOLEGISLATURA: '03/12/2019', FECHABAJA: '01/06/2021' }),
    ]);
    expect(t.isFormer).toBe(true);
    expect(t.latest).toBe('01/06/2021');
  });

  it('an early exit ends the period when no legislature end is recorded', () => {
    const t = deputyTenure([
      row({ LEGISLATURA: 'VIII', FECHAINICIOLEGISLATURA: '02/04/2004', FECHABAJA: '15/09/2005' }),
    ]);
    expect(t.isFormer).toBe(true);
    expect(t.latest).toBe('15/09/2005');
  });

  it('takes the earliest start and the latest end across all legislatures', () => {
    const t = deputyTenure([
      row({ FECHAINICIOLEGISLATURA: '01/04/2008', FECHAFINLEGISLATURA: '13/12/2011' }),
      row({ FECHAINICIOLEGISLATURA: '27/03/1996', FECHAFINLEGISLATURA: '18/01/2000' }),
      row({ FECHAINICIOLEGISLATURA: '12/04/2000', FECHAFINLEGISLATURA: '20/01/2004' }),
    ]);
    expect(t.earliest).toBe('27/03/1996');
    expect(t.latest).toBe('13/12/2011');
  });

  it('an active-file row means a current seat even without the flag', () => {
    // The matcher falls back to the active-only file when ?source=all is
    // unavailable. Those rows are sitting deputies by definition but carry no
    // LEGISLATURAACTUAL — only FORMACIONELECTORAL, which the historical file
    // never has. Requiring the flag alone would call every sitting deputy former.
    const t = deputyTenure([
      row({ LEGISLATURA: 'XV', FORMACIONELECTORAL: 'PP', FECHAINICIOLEGISLATURA: '17/08/2023' }),
    ]);
    expect(t.isFormer).toBe(false);
  });

  it('an active-file row with an early exit is still former', () => {
    const t = deputyTenure([
      row({ FORMACIONELECTORAL: 'PP', FECHAINICIOLEGISLATURA: '17/08/2023', FECHABAJA: '02/02/2025' }),
    ]);
    expect(t.isFormer).toBe(true);
    expect(t.latest).toBe('02/02/2025');
  });

  it('never claims a current seat from missing data', () => {
    for (const rows of [[], null, undefined, [{}], [row({})]]) {
      expect(deputyTenure(rows).isFormer).toBe(true);
    }
  });
});
