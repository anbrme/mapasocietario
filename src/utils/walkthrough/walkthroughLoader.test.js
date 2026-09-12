import { describe, expect, it, vi } from 'vitest';
import { loadFindingsForSubjects } from './walkthroughLoader';

const nodesById = new Map([
  ['H:1', { id: 'H:1', name: 'ALFA SL', groupKey: 'H:1' }],
  ['N:beta', { id: 'N:beta', name: 'BETA SL' }],
  ['H:3', { id: 'H:3', name: 'GAMMA SL', groupKey: 'H:3' }],
]);

describe('loadFindingsForSubjects', () => {
  it('fetches by group key when present, by name otherwise, and maps by node id', async () => {
    const fetchFindings = vi.fn(async ({ groupKey, name }) => ({ company: { name: groupKey || name } }));
    const out = await loadFindingsForSubjects({ subjectIds: ['H:1', 'N:beta'], nodesById, fetchFindings, lang: 'es' });
    expect(fetchFindings).toHaveBeenCalledWith({ groupKey: 'H:1', name: 'ALFA SL', lang: 'es' });
    expect(fetchFindings).toHaveBeenCalledWith({ groupKey: null, name: 'BETA SL', lang: 'es' });
    expect(out.get('H:1')).toEqual({ company: { name: 'H:1' } });
    expect(out.get('N:beta')).toEqual({ company: { name: 'BETA SL' } });
  });

  it('caps the number of fetches and leaves the rest null', async () => {
    const fetchFindings = vi.fn(async () => ({}));
    const clearTimeoutFn = vi.fn();
    const out = await loadFindingsForSubjects({ subjectIds: ['H:1', 'N:beta', 'H:3'], nodesById, fetchFindings, lang: 'es', cap: 2, clearTimeoutFn });
    expect(fetchFindings).toHaveBeenCalledTimes(2);
    expect(out.get('H:3')).toBeNull();
    expect(clearTimeoutFn).toHaveBeenCalledTimes(1);
  });

  it('maps a rejected fetch to null and still resolves', async () => {
    const fetchFindings = vi.fn(async ({ groupKey }) => { if (groupKey === 'H:1') throw new Error('409'); return {}; });
    const out = await loadFindingsForSubjects({ subjectIds: ['H:1', 'H:3'], nodesById, fetchFindings, lang: 'en' });
    expect(out.get('H:1')).toBeNull();
    expect(out.get('H:3')).toEqual({});
  });

  it('resolves at the timeout with whatever has arrived', async () => {
    vi.useFakeTimers();
    const fetchFindings = vi.fn(({ groupKey }) => (groupKey === 'H:1'
      ? Promise.resolve({ fast: true })
      : new Promise(() => {}))); // never settles
    const p = loadFindingsForSubjects({ subjectIds: ['H:1', 'H:3'], nodesById, fetchFindings, lang: 'es', waitMs: 100 });
    await vi.advanceTimersByTimeAsync(101);
    const out = await p;
    expect(out.get('H:1')).toEqual({ fast: true });
    expect(out.get('H:3')).toBeNull();
    vi.useRealTimers();
  });

  it('does not propagate late rejections after timeout resolves', async () => {
    vi.useFakeTimers();
    const unhandledRejections = [];
    const rejectionHandler = (reason) => { unhandledRejections.push(reason); };
    process.on('unhandledRejection', rejectionHandler);

    const fetchFindings = vi.fn(({ groupKey }) => {
      if (groupKey === 'H:1') return Promise.resolve({ fast: true });
      // Resolves immediately but rejects after 200ms
      return new Promise((_, rej) => setTimeout(() => rej(new Error('late')), 200));
    });
    const p = loadFindingsForSubjects({ subjectIds: ['H:1', 'H:3'], nodesById, fetchFindings, lang: 'es', waitMs: 100 });
    await vi.advanceTimersByTimeAsync(101);
    const out = await p;
    expect(out.get('H:1')).toEqual({ fast: true });
    expect(out.get('H:3')).toBeNull();

    // Advance time so the late rejection occurs
    await vi.advanceTimersByTimeAsync(200);
    // Let microtask queue drain
    await Promise.resolve();

    // Verify no unhandled rejection was raised
    expect(unhandledRejections).toHaveLength(0);
    // Verify the returned Map is not mutated
    expect(out.get('H:3')).toBeNull();

    process.off('unhandledRejection', rejectionHandler);
    vi.useRealTimers();
  });
});
