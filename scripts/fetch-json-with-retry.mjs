const positiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const DEFAULT_ATTEMPTS = positiveInteger(process.env.VALIDATION_FETCH_ATTEMPTS, 3);
const DEFAULT_TIMEOUT_MS = positiveInteger(process.env.VALIDATION_FETCH_TIMEOUT_MS, 15_000);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const retryableStatus = (status) => status === 408 || status === 429 || status >= 500;

/**
 * Fetch JSON for build-time live-data validation.
 *
 * A definitive 4xx response returns null immediately so a missing/invalid
 * curated entry still fails its validator. Network errors, timeouts, rate
 * limits and server errors retry because they say nothing about data validity.
 */
export async function fetchJsonWithRetry(url, {
  attempts = DEFAULT_ATTEMPTS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  baseDelayMs = 500,
  label = url,
  fetchImpl = fetch,
  sleepImpl = wait,
} = {}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (response.ok) return await response.json();
      if (!retryableStatus(response.status)) return null;
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;

      const delayMs = baseDelayMs * (2 ** (attempt - 1));
      console.warn(
        `  ↻ ${label}: transient fetch failure (${error.message}); retrying ${attempt + 1}/${attempts} in ${delayMs}ms`,
      );
      await sleepImpl(delayMs);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error(`Failed to fetch ${label}`);
}
