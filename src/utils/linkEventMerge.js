// Attach borme_events_v3 officer acts to the officer→company links they belong
// to. A link's active/ceased status is derived from these events (see
// officerLinkStatus.js), so this is what turns a leaver's edge red.
//
// Extracted from SpanishCompanyNetworkGraph's enrichLinksWithEventDates so the
// imported-snapshot refresh attaches acts with exactly the same seat matching.
import { matchesRole } from './roleKey';

const CATEGORIES = ['nombramientos', 'ceses_dimisiones', 'reelecciones', 'revocaciones'];

const normalizeNodeId = id => (id == null ? '' : String(id));
const getNodeIdFromRef = ref => (ref && typeof ref === 'object' ? ref.id : ref);

const categoryForEventType = eventType => {
  const t = (eventType || '').toLowerCase();
  if (t.includes('cese') || t.includes('dimisi')) return 'ceses_dimisiones';
  if (t.includes('reelecc')) return 'reelecciones';
  if (t.includes('revocac')) return 'revocaciones';
  if (t.includes('nombr')) return 'nombramientos';
  return null;
};

/**
 * Index officer acts as (OFFICER|COMPANY|category) → Map<"date|position", {date, position}>.
 * Keyed by date+position so e.g. a revocation as "APO." and an appointment as
 * "ADM." on the same date remain distinct rows with their own Cargo.
 *
 * @param {Array<{company: string, events: object[]}>} results
 * @returns {Map<string, Map<string, {date: string, position: string}>>}
 */
export function buildOfficerEventMap(results) {
  const eventMap = new Map();
  (results || []).forEach(({ company, events }) => {
    const companyUpper = (company || '').toUpperCase();
    (events || []).forEach(evt => {
      const evtDate = evt.event_date || evt.indexed_date || evt.date;
      if (!evtDate) return;
      (evt.officers || []).forEach(o => {
        const officerUpper = (o.name || '').trim().toUpperCase();
        if (!officerUpper) return;
        const cat = categoryForEventType(o.event_type);
        if (!cat) return;
        const position = o.specific_role || o.position_normalized || o.role || o.position || '';
        const key = `${officerUpper}|${companyUpper}|${cat}`;
        if (!eventMap.has(key)) eventMap.set(key, new Map());
        const dedupKey = `${evtDate}|${position}`;
        if (!eventMap.get(key).has(dedupKey)) {
          eventMap.get(key).set(dedupKey, { date: evtDate, position });
        }
      });
    });
  });
  return eventMap;
}

// Which seat an act belongs to is only decidable against every seat the pair
// holds: a role that shares its category with a sibling can never be matched
// by category alone. See utils/roleKey.js.
const rolesByOfficerCompanyPair = links => {
  const rolesByPair = new Map();
  links.forEach(l => {
    if (l.type !== 'officer-company') return;
    const sid = normalizeNodeId(getNodeIdFromRef(l.source));
    const tid = normalizeNodeId(getNodeIdFromRef(l.target));
    if (!sid || !tid) return;
    const pairKey = sid < tid ? `${sid}|${tid}` : `${tid}|${sid}`;
    if (!rolesByPair.has(pairKey)) rolesByPair.set(pairKey, []);
    rolesByPair.get(pairKey).push(l.relationship || '');
  });
  return rolesByPair;
};

const officerAndCompany = (sourceNode, targetNode, link) => {
  if (sourceNode.type === 'officer') return [sourceNode, targetNode];
  if (targetNode.type === 'officer') return [targetNode, sourceNode];
  // A company unified with its own cargos: the source company IS the officer
  // of this link. Without this branch the link was skipped whole — no events,
  // no dissolution — and a seat held by an extinguished company stayed green.
  if (link.type === 'officer-company' && link.unified) return [sourceNode, targetNode];
  return [null, null];
};

/**
 * Return the graph's links with matching officer acts attached. Links with
 * nothing to change are returned by identity; the input is never mutated.
 *
 * @param {{nodes: object[], links: object[]}} graph
 * @param {Map} eventMap        From buildOfficerEventMap.
 * @param {object} [options]
 * @param {Set<string>} [options.companyIds] Only touch links of these companies.
 * @returns {object[]} links
 */
export function applyOfficerEventsToLinks(graph, eventMap, options = {}) {
  const { companyIds = null } = options;
  const nodesById = new Map(graph.nodes.map(n => [n.id, n]));
  const rolesByPair = rolesByOfficerCompanyPair(graph.links);

  return graph.links.map(link => {
    const sourceNode = typeof link.source === 'object' ? link.source : nodesById.get(link.source);
    const targetNode = typeof link.target === 'object' ? link.target : nodesById.get(link.target);
    if (!sourceNode || !targetNode) return link;

    const [officerNode, companyNode] = officerAndCompany(sourceNode, targetNode, link);
    if (!officerNode) return link;
    if (companyIds && !companyIds.has(normalizeNodeId(companyNode.id))) return link;

    const officerUpper = (officerNode.name || '').toUpperCase();
    const companyUpper = (companyNode.name || '').toUpperCase();

    // A dissolved company can have no current officers — dissolution implies
    // cessation even when individual ceses were never inscribed in BORME —
    // and a dissolved HOLDER (a company unified with its cargos) holds no seat.
    const companyDissolved = !!companyNode.isDissolved;
    const holderDissolved = officerNode.type !== 'officer' && !!officerNode.isDissolved;

    // Only attach acts for THIS link's role: one officer can hold several
    // roles at one company with independent status, and matchesRole requires
    // the exact role unless the seat is the only one of its category on this
    // pair (DAGA GELABERT TOMAS's three "Vocal / Comisión" seats at GRIFOLS).
    const linkRole = link.relationship || '';
    const pairRoles =
      rolesByPair.get(
        [normalizeNodeId(officerNode.id), normalizeNodeId(companyNode.id)].sort().join('|')
      ) || [linkRole];
    const events = [];
    CATEGORIES.forEach(cat => {
      const entries = eventMap.get(`${officerUpper}|${companyUpper}|${cat}`);
      if (!entries) return;
      entries.forEach(({ date, position }) => {
        if (!matchesRole(position, linkRole, pairRoles)) return;
        events.push({ category: cat, date, position });
      });
    });

    if (events.length === 0 && !companyDissolved && !holderDissolved) return link;
    return {
      ...link,
      ...(events.length > 0 && { events }),
      ...(companyDissolved && { companyDissolved: true }),
      ...(holderDissolved && { holderDissolved: true }),
    };
  });
}
