/**
 * A small in-memory read cache for API responses, with in-flight de-duplication.
 *
 * Exploring the graph re-fetched everything, every time. Clicking a node ran a
 * group_key resolve plus a profile plus an events request; clicking back to a
 * node already visited ran all three again. The only guard was "is this exact
 * node already on screen".
 *
 * Scope is deliberately narrow:
 *   - memory only, so it dies with the tab. BORME publishes daily; a cache that
 *     outlived the session could show yesterday's registry as today's.
 *   - reads only. Nothing that writes goes through here.
 *   - failures are never stored, so one 500 can't pin an error for the session.
 *   - every caller gets its own copy: graph code mutates the objects it is
 *     handed (sorting events, tagging officers), and a shared reference would
 *     let one caller corrupt what the next one reads.
 */

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes — one exploration session
const DEFAULT_MAX_ENTRIES = 200;

// Distinguishes "could not copy this" from a value that is legitimately
// undefined, which a loader is allowed to resolve to.
const UNCLONEABLE = Symbol('uncloneable');

/**
 * Copy a value so the cache and its callers never share a reference.
 *
 * @param {*} value
 * @returns {*} the copy, or UNCLONEABLE when the value cannot be copied
 *   (a Response, a DOM node, anything holding a function).
 */
const copy = value => {
  if (value === null || typeof value !== 'object') return value;
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  } catch {
    return UNCLONEABLE;
  }
};

/** A copy when one can be made, otherwise the value itself. */
const copyForCaller = value => {
  const duplicate = copy(value);
  return duplicate === UNCLONEABLE ? value : duplicate;
};

/**
 * @param {Object} [options]
 * @param {number} [options.ttlMs]      - how long an entry stays fresh.
 * @param {number} [options.maxEntries] - LRU ceiling.
 * @param {() => number} [options.now]  - clock, injectable for tests.
 * @returns {{fetch: (key: string, loader: () => Promise<*>, opts?: {fresh?: boolean}) => Promise<*>, clear: () => void, size: () => number}}
 */
export const createRequestCache = ({
  ttlMs = DEFAULT_TTL_MS,
  maxEntries = DEFAULT_MAX_ENTRIES,
  now = () => Date.now(),
} = {}) => {
  // Map keeps insertion order, which is what makes the LRU a delete + re-set.
  const entries = new Map();
  const inFlight = new Map();

  const touch = (key, entry) => {
    entries.delete(key);
    entries.set(key, entry);
  };

  const evictIfFull = () => {
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      entries.delete(oldest);
    }
  };

  const fetch = (key, loader, { fresh = false } = {}) => {
    if (!fresh) {
      const entry = entries.get(key);
      if (entry) {
        if (now() - entry.storedAt < ttlMs) {
          touch(key, entry);
          return Promise.resolve(copyForCaller(entry.value));
        }
        entries.delete(key);
      }

      // A request for this key is already on the wire — wait on it instead of
      // opening a second one.
      const pending = inFlight.get(key);
      if (pending) return pending.then(copyForCaller);
    }

    const request = Promise.resolve()
      .then(loader)
      .then(value => {
        const stored = copy(value);
        // Serve an uncloneable value, but never store what we cannot hand out
        // safely a second time.
        if (stored !== UNCLONEABLE) {
          entries.delete(key);
          entries.set(key, { value: stored, storedAt: now() });
          evictIfFull();
        }
        return value;
      })
      .finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      });

    inFlight.set(key, request);
    return request;
  };

  return {
    fetch,
    clear: () => {
      entries.clear();
      inFlight.clear();
    },
    size: () => entries.size,
  };
};

export default createRequestCache;
