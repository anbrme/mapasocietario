const BASE_URL = 'https://api.ncdata.eu';

async function fetchStats(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/bormes/stats/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
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
  getCompanySizes: () => fetchStats('company-sizes'),
  getTopOfficers: (params) => fetchStats('top-officers', params),
  getYoY: () => fetchStats('yoy'),
  getProvinces: (params) => fetchStats('provinces', params),
  getOwnershipTransitions: (params) => fetchStats('ownership-transitions', params),
};
