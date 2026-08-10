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
    response = await fetch(`${API_URL}${REQUEST_PATH}`, {
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
