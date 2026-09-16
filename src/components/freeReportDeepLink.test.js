import { describe, it, expect } from 'vitest';
import { parseFreeReportParam, initialFreeReportState } from './freeReportDeepLink';

describe('parseFreeReportParam', () => {
  it('accepts the two spellings the company page and copy links use', () => {
    expect(parseFreeReportParam('1')).toBe(true);
    expect(parseFreeReportParam('true')).toBe(true);
  });

  it('rejects everything else, including a missing parameter', () => {
    expect(parseFreeReportParam('0')).toBe(false);
    expect(parseFreeReportParam('')).toBe(false);
    expect(parseFreeReportParam(null)).toBe(false);
    expect(parseFreeReportParam(undefined)).toBe(false);
    expect(parseFreeReportParam('yes')).toBe(false);
  });
});

describe('initialFreeReportState', () => {
  it('pre-ticks the free option when requested, the programme is on and the flow is web', () => {
    expect(initialFreeReportState({ requested: true, programActive: true, isAndroidApp: false })).toBe(true);
  });

  it('never pre-ticks when the visitor did not ask for it', () => {
    expect(initialFreeReportState({ requested: false, programActive: true, isAndroidApp: false })).toBe(false);
  });

  it('never pre-ticks when the programme is off or the flow is the Android app', () => {
    expect(initialFreeReportState({ requested: true, programActive: false, isAndroidApp: false })).toBe(false);
    expect(initialFreeReportState({ requested: true, programActive: true, isAndroidApp: true })).toBe(false);
  });
});
