const BASE_URL = 'https://api.ncdata.eu';

async function fetchStats(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/bormes/stats/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    // Handle multi-value params (prefixed with _)
    if (k === '_provinces' && Array.isArray(v)) {
      v.forEach((p) => url.searchParams.append('province', p));
    } else if (k === '_companyTypes' && Array.isArray(v)) {
      v.forEach((t) => url.searchParams.append('company_type', t));
    } else if (k === '_eventCategories' && Array.isArray(v)) {
      v.forEach((c) => url.searchParams.append('event_category', c));
    } else {
      url.searchParams.set(k, v);
    }
  });

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`Stats API error: ${resp.status}`);
  const data = await resp.json();
  if (!data.success) throw new Error(data.error || 'Unknown error');
  return data;
}

export const statsService = {
  getOverview: (params) => fetchStats('overview', params),
  getFormations: (params) => fetchStats('formations', params),
  getDissolutions: (params) => fetchStats('dissolutions', params),
  getConcursos: (params) => fetchStats('concursos', params),
  getOfficerChanges: (params) => fetchStats('officer-changes', params),
  getCapital: (params) => fetchStats('capital', params),
  getLifecycle: (params) => fetchStats('lifecycle', params),
  getEventTypes: (params) => fetchStats('event-types', params),
  getCompanySizes: (params) => fetchStats('company-sizes', params),
  getTopOfficers: (params) => fetchStats('top-officers', params),
  getYoY: (params) => fetchStats('yoy', params),
  getProvinces: (params) => fetchStats('provinces', params),
  getOwnershipTransitions: (params) => fetchStats('ownership-transitions', params),
  getFilterOptions: () => fetchStats('filter-options'),
  getOfficerTransitions: (params) => fetchStats('officer-transitions', params),
  getOwnershipSankey: (params) => fetchStats('ownership-sankey', params),
  getLifecycleSankey: (params) => fetchStats('lifecycle-sankey', params),
};
