import { API_URL } from '../config';
import { resilientFetch } from './originFailover';

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

export async function requestMonitoring({ email, entityName, jurisdiction = 'ES' }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (entityName || '').trim();

  if (!EMAIL_RE.test(cleanEmail)) {
    throw new MonitoringRequestError('invalid_email', 0);
  }
  if (!cleanName) {
    throw new MonitoringRequestError('missing_company', 0);
  }

  let response;
  try {
    response = await resilientFetch(`${API_URL}${REQUEST_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        entity_name: cleanName,
        jurisdiction,
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
    response = await resilientFetch(
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
    response = await resilientFetch(`${API_URL}${path}?t=${encodeURIComponent(clean)}`, {
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
    response = await resilientFetch(`${API_URL}${SEND_VIEW_LINK_PATH}`, {
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
    response = await resilientFetch(`${API_URL}${VIEW_PATH}?t=${encodeURIComponent(clean)}`);
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
    response = await resilientFetch(
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
