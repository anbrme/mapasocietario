import { describe, expect, it, vi } from 'vitest';
import { loadStepData } from './walkthroughLoader';

const nodesById = new Map([
  ['H:1', {
    id: 'H:1', name: 'ALFA SL', groupKey: 'H:1', type: 'company',
  }],
  ['N:beta', { id: 'N:beta', name: 'BETA', type: 'officer' }],
  ['H:3', {
    id: 'H:3', name: 'GAMMA SL', groupKey: 'H:3', type: 'spanish-company-group',
  }],
]);

const okFetch = payload => vi.fn(async () => payload);

describe('loadStepData', () => {
  it('fetches only company nodes and maps other node types to null', async () => {
    const fetchProfile = okFetch({ company: { name: 'ALFA SL' } });
    const fetchEvents = okFetch({ items: [] });
    const fetchFindings = okFetch({ findings: [] });
    const out = await loadStepData({
      ids: ['H:1', 'N:beta'], nodesById, fetchProfile, fetchEvents, fetchFindings, lang: 'es',
    });
    expect(out.get('N:beta')).toBeNull();
    expect(out.get('H:1')).toEqual({ profile: { name: 'ALFA SL' }, events: { items: [] }, findings: { findings: [] } });
  });

  it('calls each fetcher with groupKey, name, and the right extras', async () => {
    const fetchProfile = okFetch({ company: {} });
    const fetchEvents = okFetch({});
    const fetchFindings = okFetch({});
    await loadStepData({
      ids: ['H:1'], nodesById, fetchProfile, fetchEvents, fetchFindings, lang: 'en',
    });
    expect(fetchProfile).toHaveBeenCalledWith({ groupKey: 'H:1', name: 'ALFA SL' });
    expect(fetchEvents).toHaveBeenCalledWith({ groupKey: 'H:1', name: 'ALFA SL', size: 3 });
    expect(fetchFindings).toHaveBeenCalledWith({ groupKey: 'H:1', name: 'ALFA SL', lang: 'en' });
  });

  it('treats a node missing from nodesById the same as a non-company: null', async () => {
    const fetchProfile = okFetch({ company: {} });
    const fetchEvents = okFetch({});
    const fetchFindings = okFetch({});
    const out = await loadStepData({
      ids: ['missing'], nodesById, fetchProfile, fetchEvents, fetchFindings, lang: 'es',
    });
    expect(out.get('missing')).toBeNull();
    expect(fetchProfile).not.toHaveBeenCalled();
  });

  it('keeps findings and events when the profile fetch rejects', async () => {
    const fetchProfile = vi.fn(async () => { throw new Error('409'); });
    const fetchEvents = okFetch({ items: ['e1'] });
    const fetchFindings = okFetch({ findings: ['f1'] });
    const out = await loadStepData({
      ids: ['H:1'], nodesById, fetchProfile, fetchEvents, fetchFindings, lang: 'es',
    });
    expect(out.get('H:1')).toEqual({ profile: null, events: { items: ['e1'] }, findings: { findings: ['f1'] } });
  });

  it('still stores an entry (not null) when all three fetches fail for a company', async () => {
    const failing = vi.fn(async () => { throw new Error('boom'); });
    const out = await loadStepData({
      ids: ['H:1'], nodesById, fetchProfile: failing, fetchEvents: failing, fetchFindings: failing, lang: 'es',
    });
    expect(out.get('H:1')).toEqual({ profile: null, events: null, findings: null });
  });

  it('caps fetches to the first N ids after filtering out non-companies', async () => {
    const fetchProfile = okFetch({ company: {} });
    const fetchEvents = okFetch({});
    const fetchFindings = okFetch({});
    const out = await loadStepData({
      ids: ['N:beta', 'H:1', 'H:3'], nodesById, fetchProfile, fetchEvents, fetchFindings, lang: 'es', cap: 1,
    });
    expect(fetchProfile).toHaveBeenCalledTimes(1);
    expect(out.get('H:1')).not.toBeNull();
    expect(out.get('H:3')).toBeNull();
    expect(out.get('N:beta')).toBeNull();
  });

  it('resolves at the timeout with whatever has arrived, leaving the rest null', async () => {
    vi.useFakeTimers();
    const fetchProfile = vi.fn(({ groupKey }) => (groupKey === 'H:1'
      ? Promise.resolve({ company: { fast: true } })
      : new Promise(() => {}))); // never settles
    const fetchEvents = okFetch({});
    const fetchFindings = okFetch({});
    const p = loadStepData({
      ids: ['H:1', 'H:3'], nodesById, fetchProfile, fetchEvents, fetchFindings, lang: 'es', waitMs: 100,
    });
    await vi.advanceTimersByTimeAsync(101);
    const out = await p;
    expect(out.get('H:1')).toEqual({ profile: { fast: true }, events: {}, findings: {} });
    expect(out.get('H:3')).toBeNull();
    vi.useRealTimers();
  });

  it('does not propagate late rejections after the timeout resolves, and does not mutate the returned Map', async () => {
    vi.useFakeTimers();
    const unhandledRejections = [];
    const rejectionHandler = (reason) => { unhandledRejections.push(reason); };
    process.on('unhandledRejection', rejectionHandler);

    const fetchProfile = vi.fn(({ groupKey }) => {
      if (groupKey === 'H:1') return Promise.resolve({ company: { fast: true } });
      // Resolves late, after the timeout has already fired.
      return new Promise((_, rej) => setTimeout(() => rej(new Error('late')), 200));
    });
    const fetchEvents = okFetch({});
    const fetchFindings = okFetch({});
    const p = loadStepData({
      ids: ['H:1', 'H:3'], nodesById, fetchProfile, fetchEvents, fetchFindings, lang: 'es', waitMs: 100,
    });
    await vi.advanceTimersByTimeAsync(101);
    const out = await p;
    expect(out.get('H:1')).toEqual({ profile: { fast: true }, events: {}, findings: {} });
    expect(out.get('H:3')).toBeNull();

    // Advance time so the late rejection occurs, and drain microtasks.
    await vi.advanceTimersByTimeAsync(200);
    await Promise.resolve();

    expect(unhandledRejections).toHaveLength(0);
    // The Map already returned to the caller must not have been mutated.
    expect(out.get('H:3')).toBeNull();

    process.off('unhandledRejection', rejectionHandler);
    vi.useRealTimers();
  });

  it('calls clearTimeoutFn exactly once', async () => {
    const clearTimeoutFn = vi.fn();
    const fetchProfile = okFetch({ company: {} });
    const fetchEvents = okFetch({});
    const fetchFindings = okFetch({});
    await loadStepData({
      ids: ['H:1'], nodesById, fetchProfile, fetchEvents, fetchFindings, lang: 'es', clearTimeoutFn,
    });
    expect(clearTimeoutFn).toHaveBeenCalledTimes(1);
  });
});
