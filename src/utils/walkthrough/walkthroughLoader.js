// Fetch profile, latest filings and findings for the selected companies,
// capped and time-boxed, so the walkthrough can start with whatever arrived
// and never reorder mid-play.
import { SELECTION_CAP } from './draftWalkthrough';

export const FINDINGS_WAIT_MS = 4000;
// Per additional company beyond the first, on top of the base wait — a
// larger selection has more to fetch, so give it proportionally more time
// before the walkthrough starts with whatever has arrived.
const WAIT_MS_PER_COMPANY = 400;
const MAX_WAIT_MS = 10000;

const EVENTS_PAGE_SIZE = 3;

const isCompanyNode = node => !!node
  && (node.type === 'company' || node.type === 'spanish-company-group');

async function fetchCompanyStepData({
  node, fetchProfile, fetchEvents, fetchFindings, lang,
}) {
  const groupKey = node.groupKey || null;
  const name = node.name || '';
  const [profile, events, findings] = await Promise.all([
    Promise.resolve().then(() => fetchProfile({ groupKey, name })).catch(() => null),
    Promise.resolve().then(() => fetchEvents({ groupKey, name, size: EVENTS_PAGE_SIZE })).catch(() => null),
    Promise.resolve().then(() => fetchFindings({ groupKey, name, lang })).catch(() => null),
  ]);
  return { profile: profile?.company ?? profile ?? null, events, findings };
}

/**
 * Load per-company step data (profile, latest filings, findings) for the
 * selected node ids, time-boxed so a slow subject never blocks the rest.
 * @param {{ ids: Array<string>, nodesById: Map<string, object>,
 *   fetchProfile: Function, fetchEvents: Function, fetchFindings: Function, lang: string,
 *   cap?: number, waitMs?: number, setTimeoutFn?: Function, clearTimeoutFn?: Function }} args
 *   `waitMs`, when omitted, scales with the number of companies being fetched
 *   (see `adaptiveWaitMs`) instead of a single fixed budget for every selection size.
 * @returns {Promise<Map<string, { profile: object|null, events: object|null, findings: object|null } | null>>}
 */
export const adaptiveWaitMs = companyCount => Math.min(
  MAX_WAIT_MS, FINDINGS_WAIT_MS + WAIT_MS_PER_COMPANY * companyCount,
);

export async function loadStepData({
  ids, nodesById, fetchProfile, fetchEvents, fetchFindings, lang,
  cap = SELECTION_CAP, waitMs, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout,
}) {
  const allIds = ids || [];
  const results = new Map(allIds.map(id => [id, null]));
  const companyIds = allIds.filter(id => isCompanyNode(nodesById.get(id))).slice(0, cap);
  const effectiveWaitMs = waitMs == null ? adaptiveWaitMs(companyIds.length) : waitMs;

  const settle = companyIds.map(id => fetchCompanyStepData({
    node: nodesById.get(id), fetchProfile, fetchEvents, fetchFindings, lang,
  }).then(data => { results.set(id, data); }));

  let timeoutId;
  const timeout = new Promise(resolve => { timeoutId = setTimeoutFn(resolve, effectiveWaitMs); });
  try {
    await Promise.race([Promise.all(settle), timeout]);
  } finally {
    clearTimeoutFn(timeoutId);
  }
  return new Map(results);
}

/**
 * The union of per-company coverage blocks: earliest `since`, latest
 * `indexed_through`. Null when nothing carries coverage.
 * @param {Array<{since?: string, indexed_through?: string} | null | undefined>} blocks
 * @returns {{ since: string, indexedThrough: string } | null}
 */
export const mergeCoverage = blocks => {
  const list = (blocks || []).filter(Boolean);
  if (!list.length) return null;
  const sinces = list.map(c => c.since).filter(Boolean).sort();
  const throughs = list.map(c => c.indexed_through).filter(Boolean).sort();
  return { since: sinces[0] || '', indexedThrough: throughs[throughs.length - 1] || '' };
};
