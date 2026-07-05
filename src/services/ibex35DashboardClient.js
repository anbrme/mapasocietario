const API_BASE = 'https://ibex35-api.ncdata.eu';
const PUBLIC_API_KEY = 'ibex35-public-access-2024';
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = { rows: null, fetchedAt: 0 };

function normalizeNif(nif) {
  return String(nif || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

async function fetchCompanies() {
  const now = Date.now();
  if (cache.rows && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rows;
  }
  const res = await fetch(`${API_BASE}/api/companies`, {
    headers: { Authorization: `Bearer ${PUBLIC_API_KEY}` },
  });
  if (!res.ok) throw new Error(`ibex35-api responded with status ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json.data) ? json.data : [];
  cache = { rows, fetchedAt: now };
  return rows;
}

// Looks up one company's live price/market/shareholder data by NIF. Returns
// null (never throws) on no-match, network failure, or empty input — this is
// a bonus enrichment, not core app data, so callers should treat null as
// "don't show the card" rather than an error to surface to the user.
export async function getIbexCompanyData(nif) {
  if (!nif) return null;
  const target = normalizeNif(nif);
  try {
    const rows = await fetchCompanies();
    return rows.find(row => normalizeNif(row.nif) === target) || null;
  } catch (err) {
    console.warn('[Ibex35MarketSidebar] failed to fetch IBEX 35 market data:', err.message);
    return null;
  }
}

export function __resetIbex35Cache() {
  cache = { rows: null, fetchedAt: 0 };
}
