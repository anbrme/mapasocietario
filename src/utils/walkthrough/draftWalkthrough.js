// The v2 walkthrough: an ordered story of the visible graph, built from
// exactly what the author asked for. Two modes:
//   - selection mode: the author's own multi-select, in the order they made
//     it — every step is theirs.
//   - draft mode (empty selection): a generated fallback — subject
//     company(ies) first, then other visible companies, then the graph's
//     connectors, then any node carrying a note that wasn't already covered.
// Pure: no DOM, no network, no mutation of inputs. Evidence comes only from
// `stepEvidence` (the app's own fetched data) and the graph's own structure.
//
// A note on keys: `step:<nodeId>` is the persistence contract for author
// edits (hidden/order/notes). It depends only on the node id, never on order
// or text, so a step keeps its identity across re-renders and re-selection.

import { hasNodeNote } from '../nodeNotes';
import { companyEvidence, personSeats } from './stepEvidence';
import { walkthroughCopy, graphOnlyLine } from './walkthroughCopy';

export const SELECTION_CAP = 12;
const CONNECTOR_CAP = 8;

const SITE = 'https://mapasocietario.es';

const nid = id => (id == null ? '' : String(id));
const refId = ref => (ref && typeof ref === 'object' ? ref.id : ref);
const isCompany = n => !!n && (n.type === 'company' || n.type === 'spanish-company-group');

/** Order-independent key for a graph edge between two node ids. */
export const pairKey = (a, b) => (nid(a) < nid(b) ? `${nid(a)}|${nid(b)}` : `${nid(b)}|${nid(a)}`);

/** The scope's pinned companies, primary subject first when it's among them. */
export const subjectCompanyIds = (scope, primarySubjectId) => {
  const ids = (scope?.companyNodes || []).map(c => nid(c.nodeId));
  const primary = nid(primarySubjectId);
  if (!primary || !ids.includes(primary)) return ids;
  return [primary, ...ids.filter(id => id !== primary)];
};

const deepLink = (node, lang) => {
  const params = new URLSearchParams();
  if (node?.groupKey) params.set('gk', node.groupKey);
  else if (node?.name) params.set('search', node.name);
  params.set('lang', lang);
  return `${SITE}/app?${params}`;
};

const narrativeOf = node => (hasNodeNote(node)
  ? { text: node.userNote.text.trim(), flag: node.userNote.flag || 'none' } : null);

// v1 compatibility fields (section/source/text/date/evidenceRef/flag/authorNote)
// are kept because applyWalkthroughEdits, the player, the hook's setNote and
// the export still read them directly.
const base = (node, kind, order, lang) => {
  const narrative = narrativeOf(node);
  return {
    key: `step:${nid(node.id)}`,
    nodeId: nid(node.id),
    kind,
    order,
    title: node.name || '',
    narrative,
    authorNote: narrative ? { ...narrative, origin: 'node' } : null,
    flag: narrative?.flag || null,
    section: kind,
    date: null,
    evidenceRef: null,
    deepLink: deepLink(node, lang),
  };
};

const officersOfCompany = (companyId, graphData, byId) => (graphData?.links || []).flatMap(l => {
  const a = nid(refId(l.source));
  const b = nid(refId(l.target));
  const other = a === companyId ? b : b === companyId ? a : null;
  const n = other ? byId.get(other) : null;
  return n && n.type === 'officer' ? [other] : [];
});

const companyStep = ({
  node, order, data, graphData, byId, lang, t,
}) => {
  const evidence = companyEvidence({
    node, profile: data?.profile, events: data?.events, findings: data?.findings, lang,
  });
  const officerIds = [...new Set(officersOfCompany(nid(node.id), graphData, byId))];
  const summary = evidence.identity || graphOnlyLine(t, officerIds.length);
  return {
    ...base(node, 'company', order, lang),
    evidence,
    summary,
    text: summary,
    source: evidence.identity ? 'registry' : 'graph',
    nodeIds: [nid(node.id), ...officerIds],
    linkKeys: officerIds.map(o => pairKey(node.id, o)),
  };
};

const personStep = ({
  node, order, graphData, lang, t,
}) => {
  const seats = personSeats(node, graphData, lang);
  const companyIds = [...new Set(seats.map(s => s.companyId))];
  const summary = t.seatsLine(seats.length, companyIds.length);
  return {
    ...base(node, 'person', order, lang),
    evidence: { seats },
    summary,
    text: summary,
    source: 'graph',
    nodeIds: [nid(node.id), ...companyIds],
    linkKeys: companyIds.map(c => pairKey(node.id, c)),
  };
};

/**
 * Build the ordered walkthrough for the current graph.
 * @param {{ graphData: object, scope: object, stepData: Map<string, { profile: object, events: object, findings: object } | null>,
 *   selection?: Array<string>, primarySubjectId?: string, lang?: string }} args
 * @returns {Array<object>} ordered steps, `selection` mode when `selection` is non-empty, drafted otherwise
 */
export function draftWalkthrough({
  graphData, scope, stepData, selection = [], primarySubjectId, lang = 'es',
}) {
  const t = walkthroughCopy(lang);
  const nodes = graphData?.nodes || [];
  const byId = new Map(nodes.map(n => [nid(n.id), n]));
  const data = stepData instanceof Map ? stepData : new Map();

  const build = (node, order) => (isCompany(node)
    ? companyStep({
      node, order, data: data.get(nid(node.id)) || null, graphData, byId, lang, t,
    })
    : personStep({
      node, order, graphData, lang, t,
    }));

  const chosen = (selection || []).map(nid).filter(id => byId.has(id)).slice(0, SELECTION_CAP);
  if (chosen.length) return chosen.map((id, i) => build(byId.get(id), i));

  // Draft: subject companies, other companies, connectors, loose notes —
  // each node appears at most once, wherever it is first pushed.
  const seen = new Set();
  const out = [];
  const push = node => {
    const id = nid(node?.id);
    if (!node || seen.has(id)) return;
    seen.add(id);
    out.push(build(node, out.length));
  };

  subjectCompanyIds(scope, primarySubjectId).forEach(id => push(byId.get(id)));
  [...(scope?.connectors || [])]
    .sort((x, y) => (y.companies?.length || 0) - (x.companies?.length || 0)
      || String(x.name).localeCompare(String(y.name)))
    .slice(0, CONNECTOR_CAP)
    .forEach(c => push(byId.get(nid(c.nodeId))));
  nodes.filter(hasNodeNote).sort((a, b) => String(a.name).localeCompare(String(b.name))).forEach(push);

  return out;
}

/** Title and subtitle for the walkthrough's opening card. */
export const openingCard = ({
  steps, mode, selectedCount = 0, lang = 'es',
}) => {
  const t = walkthroughCopy(lang);
  const capped = mode === 'selection' && selectedCount > SELECTION_CAP;
  return {
    title: t.opening(steps.length),
    line: capped ? t.openingCapped(selectedCount) : (mode === 'selection' ? t.openingSelection : t.openingDraft),
  };
};
