import { describe, it, expect } from 'vitest';
import { runPool } from './concurrencyPool';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('runPool', () => {
  it('never runs more workers at once than the cap', async () => {
    // Arrange
    let inFlight = 0;
    let peak = 0;
    const worker = async n => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight -= 1;
      return n * 2;
    };

    // Act
    const { results } = await runPool([1, 2, 3, 4, 5, 6, 7], worker, { concurrency: 3 });

    // Assert
    expect(peak).toBe(3);
    expect(results.map(r => r.value)).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });

  it('records a failure without stopping the others', async () => {
    const worker = async n => {
      if (n === 2) throw new Error('429');
      return n;
    };

    const { results } = await runPool([1, 2, 3], worker, { concurrency: 2 });

    expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(results[1].reason.message).toBe('429');
  });

  it('reports progress after each item', async () => {
    const seen = [];

    await runPool(['a', 'b'], async x => x, {
      concurrency: 1,
      onProgress: (done, total, item) => seen.push([done, total, item]),
    });

    expect(seen).toEqual([[1, 2, 'a'], [2, 2, 'b']]);
  });

  it('stops starting new items once aborted and says so', async () => {
    const controller = new AbortController();
    const started = [];
    const worker = async n => {
      started.push(n);
      if (n === 2) controller.abort();
      await tick();
      return n;
    };

    const { results, aborted } = await runPool([1, 2, 3, 4], worker, {
      concurrency: 1,
      signal: controller.signal,
    });

    expect(aborted).toBe(true);
    expect(started).toEqual([1, 2]);
    expect(results.filter(Boolean)).toHaveLength(2);
  });

  it('handles an empty list', async () => {
    expect(await runPool([], async x => x)).toEqual({ results: [], aborted: false });
  });
});
