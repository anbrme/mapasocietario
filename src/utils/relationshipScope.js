// mapasocietario/src/utils/relationshipScope.js
// Turn the VISIBLE graph (filteredGraphData) into the Relationship Report scope:
// which companies are subjects and, per company, which officer names are visible.
// Pure — no network. group_key resolution happens at submit time (async), not here.

const refId = ref => (ref && typeof ref === 'object' ? ref.id : ref);
const isCompany = n => !!n && (n.type === 'company' || n.type === 'spanish-company-group');
const isOfficer = n => !!n && n.type === 'officer';

export function isActiveOfficerCategory(category) {
  const c = (category || '').toLowerCase();
  return c.includes('nombramiento') || c.includes('reeleccion') || c.includes('reelección');
}
const isOwnership = l => !!l && l.type === 'ownership';

/**
 * @param graphData {nodes, links} — the visible graph
 * @param normalizeId optional id normalizer (the graph component passes its
 *   normalizeNodeId so link refs match node ids exactly). Defaults to identity.
 * @param subjectIds optional Set of NORMALIZED node ids that count as subjects.
 *   When provided, only company nodes whose id is in this set become subjects —
 *   used to limit the report to the companies the user explicitly added
 *   (searched/expanded = pinned), excluding auto-pulled socio-único subsidiaries.
 *   When omitted, every visible company node is a subject.
 */
export function extractVisibleScope(graphData, normalizeId = (x) => x, subjectIds = null) {
  const nodes = (graphData && graphData.nodes) || [];
  const links = (graphData && graphData.links) || [];

  const byId = new Map();
  nodes.forEach(n => byId.set(normalizeId(n.id), n));

  const isSubject = n => isCompany(n) && (!subjectIds || subjectIds.has(normalizeId(n.id)));
  const companies = nodes.filter(isSubject);
  const subjectNames = new Set(companies.map(c => c.name));
  const officersByCompany = {};
  companies.forEach(c => { officersByCompany[c.name] = new Set(); });

  links.forEach(l => {
    const a = byId.get(normalizeId(refId(l.source)));
    const b = byId.get(normalizeId(refId(l.target)));
    if (!a || !b) return;
    let company = null, officer = null;
    if (isSubject(a) && isOfficer(b)) { company = a; officer = b; }
    else if (isSubject(b) && isOfficer(a)) { company = b; officer = a; }
    else return;
    if (!subjectNames.has(company.name)) return;
    officersByCompany[company.name].add(officer.name);
  });

  // people appearing at >= 2 companies ≈ the relationships the report will surface
  const companiesPerOfficer = {};
  Object.values(officersByCompany).forEach(set => {
    set.forEach(name => { companiesPerOfficer[name] = (companiesPerOfficer[name] || 0) + 1; });
  });
  const sharedPeople = Object.values(companiesPerOfficer).filter(n => n >= 2).length;

  // Per-connector detail (officers at >= 2 subject companies) + ownership links.
  const connectorAcc = {}; // name -> { node, companies:Set, roles:Set, anyActive, anyCeased }
  const ownership = [];
  links.forEach(l => {
    const a = byId.get(normalizeId(refId(l.source)));
    const b = byId.get(normalizeId(refId(l.target)));
    if (!a || !b) return;
    if (isOwnership(l)) {
      if (isSubject(a) || isSubject(b)) {
        ownership.push({
          owner: a.name, owned: b.name,
          lost: (l.category || '').toLowerCase() === 'socio_perdido',
        });
      }
      return;
    }
    let company = null, officer = null;
    if (isSubject(a) && isOfficer(b)) { company = a; officer = b; }
    else if (isSubject(b) && isOfficer(a)) { company = b; officer = a; }
    else return;
    if (!subjectNames.has(company.name)) return;
    const acc = connectorAcc[officer.name] || (connectorAcc[officer.name] = {
      node: officer, companies: new Set(), roles: new Set(), anyActive: false, anyCeased: false,
    });
    acc.companies.add(company.name);
    const role = (l.relationship || l.category || '').trim();
    if (role) acc.roles.add(role);
    if (isActiveOfficerCategory(l.category)) acc.anyActive = true; else acc.anyCeased = true;
  });

  const connectors = Object.entries(connectorAcc)
    .filter(([, acc]) => acc.companies.size >= 2)
    .map(([name, acc]) => ({
      name,
      nodeId: normalizeId(acc.node.id),
      type: acc.node.subtype === 'company' ? 'entity' : 'individual',
      companies: [...acc.companies],
      roles: [...acc.roles],
      status: acc.anyActive && acc.anyCeased ? 'mixed' : (acc.anyActive ? 'active' : 'ceased'),
    }))
    .sort((x, y) => y.companies.length - x.companies.length);

  const sharedNodeIds = new Set(connectors.map(c => c.nodeId));

  return {
    companies: companies.map(c => c.name),
    officersByCompany: Object.fromEntries(
      Object.entries(officersByCompany).map(([c, set]) => [c, [...set]])),
    connectors,
    ownership,
    sharedNodeIds,
    counts: {
      companies: companies.length,
      officers: Object.keys(companiesPerOfficer).length,
      sharedPeople,
    },
  };
}
