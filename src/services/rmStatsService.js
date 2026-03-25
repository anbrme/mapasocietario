const BASE_URL = 'https://api.ncdata.eu';

async function fetchRmStats(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/bormes/rm/stats/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    // Handle multi-value params (prefixed with _)
    if (k === '_provinces' && Array.isArray(v)) {
      v.forEach((p) => url.searchParams.append('province', p));
    } else if (k === '_formSoc' && Array.isArray(v)) {
      v.forEach((t) => url.searchParams.append('form_soc', t));
    } else {
      url.searchParams.set(k, v);
    }
  });

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`RM Stats API error: ${resp.status}`);
  const data = await resp.json();
  if (!data.success) throw new Error(data.error || 'Unknown error');
  return data;
}

export const rmStatsService = {
  getOverview: (params) => fetchRmStats('overview', params),
  getMonthly: (params) => fetchRmStats('monthly', params),
  getTransfers: (params) => fetchRmStats('transfers', params),
  getDeposits: (params) => fetchRmStats('deposits', params),
  getFilterOptions: () => fetchRmStats('filter-options'),
};
