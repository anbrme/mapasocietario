/**
 * Run an async worker over a list with at most `concurrency` calls in flight.
 *
 * Bounded on purpose: the API rate-limits per IP and bans bursts, so a
 * graph-wide refresh must never fan out in full.
 *
 * Failures are recorded per item (Promise.allSettled shape) and never stop the
 * rest. Aborting `signal` stops new items from starting; items already in
 * flight finish and keep their results, and unstarted slots stay undefined.
 *
 * @param {Array} items
 * @param {(item, index) => Promise} worker
 * @param {object} [options]
 * @param {number} [options.concurrency=3]
 * @param {AbortSignal} [options.signal]
 * @param {(done: number, total: number, item) => void} [options.onProgress]
 * @returns {Promise<{results: Array<{status, value?, reason?}|undefined>, aborted: boolean}>}
 */
export async function runPool(items, worker, options = {}) {
  const { concurrency = 3, signal = null, onProgress = null } = options;
  const list = Array.from(items || []);
  const results = new Array(list.length);
  let next = 0;
  let done = 0;

  const lane = async () => {
    while (next < list.length && !signal?.aborted) {
      const index = next;
      next += 1;
      try {
        results[index] = { status: 'fulfilled', value: await worker(list[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
      done += 1;
      onProgress?.(done, list.length, list[index]);
    }
  };

  const lanes = Math.max(1, Math.min(concurrency, list.length));
  await Promise.all(Array.from({ length: lanes }, lane));
  return { results, aborted: !!signal?.aborted };
}
