import { API_URL } from '../config';

// Self-serve monitoring requests. Unlike the post-purchase opt-in on the order
// page, nothing here proves the address belongs to the requester — the backend
// mails a confirmation link and the click is what activates the alert. So this
// module deliberately promises nothing about the outcome: a resolved call means
// "the request was accepted", never "you are now monitoring".

const REQUEST_PATH = '/bormes/v3/alerts/request';

// Matches the backend's deliberately loose check (alerts_api._validate_email).
// Catching obvious typos here saves a round trip; the real validation, and the
// only one that matters, happens at send time.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// BORME is the event source, so only Spanish company nodes have filings to
// follow. Officers are people, and foreign shareholders appear in the graph
// without a Spanish registry sheet behind them.
const MONITORABLE_TYPES = new Set(['company', 'spanish-company-group']);

export function isMonitorableNode(node) {
  return !!node && MONITORABLE_TYPES.has(node.type);
}

export class MonitoringRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'MonitoringRequestError';
    this.status = status;
  }
}

export async function requestMonitoring({
  email,
  entityName,
  jurisdiction = 'ES',
  groupKey = null,
}) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (entityName || '').trim();
  // The entity-assembly key, when the node carries one. Optional on purpose:
  // monitoring matches on the name, and plenty of nodes never resolve a key —
  // so a missing one must never block a subscription. It exists so the alert
  // can later be OPENED as a node, which a name cannot do.
  const cleanGroupKey = typeof groupKey === 'string' ? groupKey.trim() : '';

  if (!EMAIL_RE.test(cleanEmail)) {
    throw new MonitoringRequestError('invalid_email', 0);
  }
  if (!cleanName) {
    throw new MonitoringRequestError('missing_company', 0);
  }

  let response;
  try {
    response = await fetch(`${API_URL}${REQUEST_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        entity_name: cleanName,
        jurisdiction,
        // Omitted rather than sent as null: absent and null mean the same
        // thing to the backend, but a payload that never claims a key is
        // honest about a node that never had one.
        ...(cleanGroupKey ? { group_key: cleanGroupKey } : {}),
      }),
    });
  } catch (e) {
    // Never swallow this: a silent failure would leave the user believing a
    // confirmation email is coming when nothing was ever sent.
    throw new MonitoringRequestError('network_error', 0);
  }

  if (!response.ok) {
    throw new MonitoringRequestError('request_failed', response.status);
  }
  return response.json().catch(() => ({ success: true }));
}

const ACTIVATE_PATH = '/bormes/v3/alerts/activate';

// Redeems the single-use token from the confirmation email. This is the step
// that actually creates the subscription — everything before it is a request.
export async function activateMonitoring(token) {
  const clean = (token || '').trim();
  if (!clean) {
    throw new MonitoringRequestError('missing_token', 0);
  }

  let response;
  try {
    response = await fetch(
      `${API_URL}${ACTIVATE_PATH}?t=${encodeURIComponent(clean)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    throw new MonitoringRequestError('network_error', 0);
  }

  if (!response.ok) {
    // 401/404/410 all mean the same thing to the reader — the link is spent or
    // stale — so the page distinguishes them only from a genuine outage.
    throw new MonitoringRequestError('activation_failed', response.status);
  }
  return response.json().catch(() => ({ success: true }));
}

const UNSUBSCRIBE_PATH = '/bormes/v3/alerts/unsubscribe';
const UNSUBSCRIBE_ALL_PATH = '/bormes/v3/alerts/unsubscribe-all';
const RESUBSCRIBE_PATH = '/bormes/v3/alerts/resubscribe';

async function magicLinkPost(path, token) {
  const clean = (token || '').trim();
  if (!clean) throw new MonitoringRequestError('missing_token', 0);

  let response;
  try {
    response = await fetch(`${API_URL}${path}?t=${encodeURIComponent(clean)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    throw new MonitoringRequestError('network_error', 0);
  }
  if (!response.ok) {
    throw new MonitoringRequestError('magic_link_failed', response.status);
  }
  return response.json().catch(() => ({ success: true }));
}

// Unsubscribe tokens are multi-use with a 1-year TTL (RFC 8058), so an old
// digest still works months later and clicking twice is harmless.
export const unsubscribeWithToken = (token) => magicLinkPost(UNSUBSCRIBE_PATH, token);
export const unsubscribeAllWithToken = (token) => magicLinkPost(UNSUBSCRIBE_ALL_PATH, token);
export const resubscribeWithToken = (token) => magicLinkPost(RESUBSCRIBE_PATH, token);

// --- the manage page -------------------------------------------------------

const SEND_VIEW_LINK_PATH = '/bormes/v3/alerts/send-view-link';
const VIEW_PATH = '/bormes/v3/alerts/view';
const VIEW_UNSUBSCRIBE_PATH = '/bormes/v3/alerts/view/unsubscribe';

// Asks for a link to the manage page. Like requestMonitoring, a resolved call
// means "accepted" and nothing more: the backend answers identically whether
// the address monitors ten companies or has never been seen, so a stranger
// cannot use this form to discover who uses the service. The UI must not claim
// an email is on its way to THIS address — only that it is if the address has
// anything to manage.
export async function requestManageLink(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) {
    throw new MonitoringRequestError('invalid_email', 0);
  }

  let response;
  try {
    response = await fetch(`${API_URL}${SEND_VIEW_LINK_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    });
  } catch {
    throw new MonitoringRequestError('network_error', 0);
  }

  if (!response.ok) {
    // 429 is the global brake and means "try later", which is a different
    // sentence from "something broke". The page distinguishes them.
    throw new MonitoringRequestError(
      response.status === 429 ? 'rate_limited' : 'request_failed',
      response.status
    );
  }
  return response.json().catch(() => ({ success: true }));
}

// Everything the token's address monitors, with recent events per company.
// Scoped by identity rather than by how the alert was paid for, so a DD buyer
// and a self-serve subscriber see the same page.
export async function fetchMonitoring(token) {
  const clean = (token || '').trim();
  if (!clean) throw new MonitoringRequestError('missing_token', 0);

  let response;
  try {
    response = await fetch(`${API_URL}${VIEW_PATH}?t=${encodeURIComponent(clean)}`);
  } catch {
    throw new MonitoringRequestError('network_error', 0);
  }
  if (!response.ok) {
    throw new MonitoringRequestError('view_failed', response.status);
  }
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data.alerts) ? data.alerts : [];
}

// Switches one company off. Deactivates, never deletes — the backend keeps the
// row and its history so the user can be resubscribed.
export async function stopMonitoring(token, alertId) {
  const clean = (token || '').trim();
  if (!clean) throw new MonitoringRequestError('missing_token', 0);
  if (!Number.isInteger(alertId)) {
    throw new MonitoringRequestError('invalid_alert_id', 0);
  }

  let response;
  try {
    response = await fetch(
      `${API_URL}${VIEW_UNSUBSCRIBE_PATH}?t=${encodeURIComponent(clean)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId }),
      }
    );
  } catch {
    throw new MonitoringRequestError('network_error', 0);
  }
  if (!response.ok) {
    throw new MonitoringRequestError('stop_failed', response.status);
  }
  return response.json().catch(() => ({ success: true }));
}

// --- watchlists ------------------------------------------------------------

/**
 * The full manage-page payload: the sets AND the rows.
 *
 * fetchMonitoring returns only the rows, which is all the list view needs.
 * A graph needs both — the sets to name and choose one, the rows to seed it.
 */
export async function fetchWatchlistView(token) {
  const clean = (token || '').trim();
  if (!clean) throw new MonitoringRequestError('missing_token', 0);

  let response;
  try {
    response = await fetch(`${API_URL}${VIEW_PATH}?t=${encodeURIComponent(clean)}`);
  } catch {
    throw new MonitoringRequestError('network_error', 0);
  }
  if (!response.ok) {
    throw new MonitoringRequestError('view_failed', response.status);
  }
  const data = await response.json().catch(() => ({}));
  return {
    alerts: Array.isArray(data.alerts) ? data.alerts : [],
    // Absent is not an error. The field only exists once the set API is
    // deployed, and every manage link minted before that returns without it.
    watchlists: Array.isArray(data.watchlists) ? data.watchlists : [],
  };
}

/**
 * The rows of one set that can actually be drawn, as { name, groupKey }.
 *
 * Two exclusions, both deliberate:
 *  - inactive rows, because an unconfirmed request is not a subscription yet
 *    and drawing it would show someone a set they never agreed to;
 *  - rows with no group_key, because a name alone fuzzy-matches siblings and
 *    splits on a comma — seeding one would draw a DIFFERENT company and say
 *    nothing about it. Silently drawing the wrong entity is worse than
 *    drawing one fewer.
 *
 * Pass watchlistId null to take every drawable row the token can see.
 */
export function watchlistSeeds(view, watchlistId = null) {
  const alerts = Array.isArray(view?.alerts) ? view.alerts : [];
  const lastViewedAt = lastViewedFor(view, watchlistId);
  return alerts
    .filter(a => a && a.active && a.group_key)
    .filter(a => watchlistId == null || a.watchlist_id === watchlistId)
    .map(a => ({
      name: a.entity_name,
      groupKey: a.group_key,
      changeCount: countSince(a.events, lastViewedAt),
    }));
}

/**
 * When this set was last opened, as epoch ms, or null if never.
 *
 * The backend stamps last_viewed_at on read but reports the PREVIOUS visit,
 * so a change that arrived between two visits is still counted on the second.
 */
function lastViewedFor(view, watchlistId) {
  const lists = Array.isArray(view?.watchlists) ? view.watchlists : [];
  const match = watchlistId == null ? lists[0] : lists.find(w => w?.id === watchlistId);
  const parsed = Date.parse(match?.last_viewed_at ?? '');
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * How many filings arrived since a moment.
 *
 * Two deliberate leniencies, both erring toward showing a change rather than
 * hiding one. A set never opened (null) counts everything, because treating
 * "no visit yet" as "nothing is new" would hide exactly the changes that
 * accumulated while the reader waited. And an unparseable timestamp counts as
 * new: silently dropping a filing because its date was malformed would tell
 * someone nothing happened when something did, which is the one failure this
 * cannot have.
 */
function countSince(events, sinceMs) {
  if (!Array.isArray(events)) return 0;
  if (sinceMs == null) return events.length;
  return events.filter(e => {
    const at = Date.parse(e?.detected_at ?? '');
    return Number.isNaN(at) || at > sinceMs;
  }).length;
}

// Mirrors MAX_WATCHLIST_COMPANIES in the backend. Duplicated deliberately: the
// client must be able to refuse an oversized set BEFORE sending it, because a
// server that silently kept the first 25 of 40 would leave the reader believing
// they watch fifteen companies nobody is watching.
export const MAX_WATCHLIST_COMPANIES = 25;

/**
 * Ask to watch a set of companies. Like requestMonitoring, a resolved call
 * means "the request was accepted" and never "you are now watching": the
 * confirmation click is what activates it — one click for the whole set.
 *
 * @param {{name: string, groupKey?: string|null}[]} companies
 */
export async function requestWatchlist({ email, label, companies, jurisdiction = 'ES' }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) {
    throw new MonitoringRequestError('invalid_email', 0);
  }
  const cleanLabel = (label || '').trim();
  if (!cleanLabel) {
    throw new MonitoringRequestError('missing_label', 0);
  }

  // One company twice is one subscription, and sending it twice would create
  // two rows that both fire on the same filing.
  const seen = new Set();
  const payload = [];
  for (const entry of Array.isArray(companies) ? companies : []) {
    const name = (entry?.name || '').trim();
    if (!name) continue;
    const groupKey = typeof entry?.groupKey === 'string' ? entry.groupKey.trim() : '';
    const dedupeKey = groupKey || name.toUpperCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    payload.push({ entity_name: name, ...(groupKey ? { group_key: groupKey } : {}) });
  }

  if (payload.length === 0) {
    throw new MonitoringRequestError('empty_watchlist', 0);
  }
  if (payload.length > MAX_WATCHLIST_COMPANIES) {
    throw new MonitoringRequestError('watchlist_too_large', 0);
  }

  let response;
  try {
    response = await fetch(`${API_URL}/bormes/v3/alerts/watchlist/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        label: cleanLabel,
        jurisdiction,
        companies: payload,
      }),
    });
  } catch {
    // Never swallowed: a silent failure leaves someone waiting for an email
    // that was never sent.
    throw new MonitoringRequestError('network_error', 0);
  }
  if (!response.ok) {
    throw new MonitoringRequestError('request_failed', response.status);
  }
  return response.json().catch(() => ({ success: true }));
}
