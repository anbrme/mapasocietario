// mapasocietario/src/utils/relationshipScope.js
// Turn the VISIBLE graph (filteredGraphData) into the Relationship Report scope:
// which companies are subjects and, per company, which officer names are visible.
// Pure — no network. group_key resolution happens at submit time (async), not here.

const refId = ref => (ref && typeof ref === 'object' ? ref.id : ref);
const isCompany = n => !!n && (n.type === 'company' || n.type === 'spanish-company-group');
const isOfficer = n => !!n && n.type === 'officer';

/**
 * @param graphData {nodes, links} — the visible graph
 * @param normalizeId optional id normalizer (the graph component passes its
 *   normalizeNodeId so link refs match node ids exactly). Defaults to identity.
 */
export function extractVisibleScope(graphData, normalizeId = (x) => x) {
  const nodes = (graphData && graphData.nodes) || [];
  const links = (graphData && graphData.links) || [];

  const byId = new Map();
  nodes.forEach(n => byId.set(normalizeId(n.id), n));

  const companies = nodes.filter(isCompany);
  const officersByCompany = {};
  companies.forEach(c => { officersByCompany[c.name] = new Set(); });

  links.forEach(l => {
    const a = byId.get(normalizeId(refId(l.source)));
    const b = byId.get(normalizeId(refId(l.target)));
    if (!a || !b) return;
    let company = null, officer = null;
    if (isCompany(a) && isOfficer(b)) { company = a; officer = b; }
    else if (isCompany(b) && isOfficer(a)) { company = b; officer = a; }
    else return;
    if (!officersByCompany[company.name]) officersByCompany[company.name] = new Set();
    officersByCompany[company.name].add(officer.name);
  });

  // people appearing at >= 2 companies ≈ the relationships the report will surface
  const companiesPerOfficer = {};
  Object.values(officersByCompany).forEach(set => {
    set.forEach(name => { companiesPerOfficer[name] = (companiesPerOfficer[name] || 0) + 1; });
  });
  const sharedPeople = Object.values(companiesPerOfficer).filter(n => n >= 2).length;

  return {
    companies: companies.map(c => c.name),
    officersByCompany: Object.fromEntries(
      Object.entries(officersByCompany).map(([c, set]) => [c, [...set]])),
    counts: {
      companies: companies.length,
      officers: Object.keys(companiesPerOfficer).length,
      sharedPeople,
    },
  };
}
