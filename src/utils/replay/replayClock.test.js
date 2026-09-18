import { describe, it, expect } from 'vitest';
import {
  YEAR_MS,
  dayNumber,
  isoFromDay,
  advanceDays,
  nextActDay,
  prevActDay,
  addMonths,
} from './replayClock';

describe('day numbers', () => {
  it('round-trip an ISO day', () => {
    expect(isoFromDay(dayNumber('2021-03-14'))).toBe('2021-03-14');
    expect(isoFromDay(dayNumber('2024-02-29'))).toBe('2024-02-29');
  });

  it('read a fractional day as the day it is in', () => {
    expect(isoFromDay(dayNumber('2021-03-14') + 0.9)).toBe('2021-03-14');
  });
});

describe('advanceDays — time is linear', () => {
  it('ten quiet years take ten times as long as the busy year after them', () => {
    const tenYears = dayNumber('2020-01-01') - dayNumber('2010-01-01');
    const oneYear = dayNumber('2022-01-01') - dayNumber('2021-01-01');
    expect(advanceDays(10 * YEAR_MS, 1)).toBeCloseTo(tenYears, -1);
    expect(advanceDays(YEAR_MS, 1)).toBeCloseTo(oneYear, 0);
  });

  it('one year is five seconds at 1x and scales with speed', () => {
    expect(YEAR_MS).toBe(5000);
    expect(advanceDays(5000, 2)).toBeCloseTo(2 * advanceDays(5000, 1));
  });
});

describe('next / previous act', () => {
  const acts = [{ date: '2012-01-10' }, { date: '2012-01-10' }, { date: '2015-03-01' }];

  it('finds the next act strictly after the clock', () => {
    expect(isoFromDay(nextActDay(acts, dayNumber('2012-01-10')))).toBe('2015-03-01');
    expect(isoFromDay(nextActDay(acts, dayNumber('2011-01-01')))).toBe('2012-01-10');
  });

  it('finds the previous act strictly before the clock', () => {
    expect(isoFromDay(prevActDay(acts, dayNumber('2015-03-01')))).toBe('2012-01-10');
  });

  it('returns null past the ends', () => {
    expect(nextActDay(acts, dayNumber('2015-03-01'))).toBeNull();
    expect(prevActDay(acts, dayNumber('2012-01-10'))).toBeNull();
    expect(nextActDay([], 0)).toBeNull();
  });
});

describe('addMonths', () => {
  it('moves by calendar months and clamps the day', () => {
    expect(addMonths('2012-04-01', -3)).toBe('2012-01-01');
    expect(addMonths('2016-04-01', 6)).toBe('2016-10-01');
    expect(addMonths('2016-08-31', 6)).toBe('2017-02-28');
  });
});
