import { nameToSlug } from '../../functions/empresa/_slug.js';
import { isStableCompanyGroupKey } from '../../functions/empresa/_demand.js';

const ENDPOINT = '/api/company-demand';
const SESSION_KEY = 'mapasocietario_demand_session';

export function companyGroupKey(company) {
  const values = [company?.groupKey, company?.group_key, company?._id, company?.id];
  const match = values.find(isStableCompanyGroupKey);
  return match?.trim() || null;
}

/**
 * Stable per-browser id. NOT sessionStorage: that is scoped per TAB, so opening
 * the same search in a second tab would mint a second identity and let one
 * person satisfy the two-distinct-sessions promotion rule on their own.
 */
function demandSessionId() {
  if (typeof window === 'undefined') return null;
  try {
    const store = window.localStorage || window.sessionStorage;
    let value = store?.getItem(SESSION_KEY);
    if (!value) {
      value = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      store?.setItem(SESSION_KEY, value);
    }
    return value;
  } catch {
    return null;
  }
}

export function buildCompanyDemandPayload({ eventType, company, language = 'es' }) {
  const groupKey = companyGroupKey(company);
  const companyName = String(company?.company_name || company?.name || '').trim();
  const slug = nameToSlug(companyName);
  const sessionId = demandSessionId();
  if (!groupKey || !companyName || !slug || !sessionId) return null;

  return {
    event_type: eventType,
    group_key: groupKey,
    company_name: companyName,
    slug,
    session_id: sessionId,
    language: language === 'en' ? 'en' : 'es',
    province: company?.province || null,
    hoja: Array.isArray(company?.hojas) ? company.hojas[0] || null : company?.hoja || null,
  };
}

export function recordCompanyDemand({ eventType, company, language = 'es' }) {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const payload = buildCompanyDemandPayload({ eventType, company, language });
  if (!payload) return;

  window.fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => {});
}
