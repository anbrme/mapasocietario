// A subject's COMPLETE registry history for the replay.
//
// Both event endpoints sort newest first, so any cap drops the OLDEST acts —
// the very ones a replay opens with. These fetchers page back to the start and
// report honestly when they cannot: `truncatedBefore` is the oldest day held
// when acts older than it exist but were not loaded.
//
// Pages are fetched one after another, never in parallel: the API's rate
// limiter bans bursts, and a replay can wait a second for its data.
import { API_URL } from '../config';

export const PAGE_SIZE = 500; // the endpoints' per-page cap
export const RESULT_WINDOW = 10000; // Elasticsearch's from+size ceiling

const abortError = () => {
  const err = new Error('Replay history fetch aborted');
  err.name = 'AbortError';
  return err;
};

const defaultGetJson = async (url, signal) => {
  const response = await fetch(url, { method: 'GET', signal });
  if (!response.ok) throw new Error(`Replay history request failed (${response.status})`);
  return response.json();
};

/**
 * Generic sequential pager. `fetchPage(from, size)` resolves to
 * `{ items, total, counted?, pages }`: `counted` is how many source rows the
 * page consumed (defaults to items.length), `pages` false when the server does
 * not honour offsets — then one page is all there is.
 */
export const pageThrough = async ({ fetchPage, pageSize = PAGE_SIZE, window = RESULT_WINDOW, signal, onProgress }) => {
  const items = [];
  let consumed = 0;
  let total = null;

  while (consumed < window) {
    if (signal?.aborted) throw abortError();
    const size = Math.min(pageSize, window - consumed);
    const page = await fetchPage(consumed, size);
    if (signal?.aborted) throw abortError();

    const counted = page.counted ?? page.items.length;
    items.push(...page.items);
    consumed += counted;
    total = page.total ?? consumed;
    onProgress?.({ loaded: Math.min(consumed, total), total });

    if (!page.pages || counted === 0 || counted < size || consumed >= total) break;
  }
  return { items, consumed, total: total ?? 0 };
};

const oldestDate = (list, dateOf) =>
  list.map(dateOf).filter(Boolean).sort()[0] || null;

const dedupe = (list, keyOf) => {
  const seen = new Set();
  return list.filter(item => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const completenessOf = (consumed, total, list, dateOf) => ({
  loaded: consumed,
  total,
  truncatedBefore: consumed < total ? oldestDate(list, dateOf) : null,
});

/**
 * Every borme_events_v3 event of one company. By group_key — the name path can
 * leak another company's events — and with full_officers=1, without which a
 * filing naming more than 400 people is trimmed and its acts lost silently.
 */
export const fetchCompanyHistory = async (
  { groupKey, name },
  { getJson = defaultGetJson, baseUrl = API_URL, pageSize, window, signal, onProgress } = {},
) => {
  const fetchPage = async (from, size) => {
    const params = new URLSearchParams({
      ...(groupKey ? { group_key: groupKey } : { company: name || '' }),
      size: String(size),
      from: String(from),
      full_officers: '1',
    });
    const data = await getJson(`${baseUrl}/bormes/v3/events?${params}`, signal);
    return { items: data?.events || [], total: data?.total ?? 0, pages: true };
  };

  const { items, consumed, total } = await pageThrough({ fetchPage, pageSize, window, signal, onProgress });
  const events = dedupe(items, e => e._id || `${e.event_date}|${e.identifier || ''}`);
  const dateOf = e => (e.event_date || '').slice(0, 10);
  return { events, completeness: completenessOf(consumed, total, events, dateOf) };
};

/**
 * Every registry movement of one officer. Counts pages in ACTS (events_returned
 * / events_total), not movements: the server filters rows to this exact person
 * after the page is cut, so movements.length says nothing about how far the
 * offset got. A server that does not echo `from` predates paging — asking it
 * for page two would return page one again.
 */
export const fetchOfficerHistory = async (
  officerName,
  { getJson = defaultGetJson, baseUrl = API_URL, pageSize, window, signal, onProgress } = {},
) => {
  const fetchPage = async (from, size) => {
    const params = new URLSearchParams({ name: officerName, size: String(size), from: String(from) });
    const data = await getJson(`${baseUrl}/bormes/v3/officer-events?${params}`, signal);
    return {
      items: data?.movements || [],
      total: data?.events_total ?? 0,
      counted: data?.events_returned ?? (data?.movements || []).length,
      pages: data?.from !== undefined,
    };
  };

  const { items, consumed, total } = await pageThrough({ fetchPage, pageSize, window, signal, onProgress });
  const movements = dedupe(items, m =>
    [m.event_date, m.group_key || m.company_name, m.position, m.event_type || m.movement].join('|'));
  const dateOf = m => (m.event_date || '').slice(0, 10);
  return { movements, completeness: completenessOf(consumed, total, movements, dateOf) };
};
