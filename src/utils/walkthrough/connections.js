// The connection chapter's engine: which selected entities reach each other
// only through nodes the author did NOT select, and the path that joins them.
// Pure graph work on the visible graph — no fetch, no network. Undirected
// breadth-first search; ownership links count (an owner is a connection too).
import { pairKey } from './pairKey';
import { walkthroughCopy } from './walkthroughCopy';
import { isActiveOfficerCategory } from '../relationshipScope';
import { getLinkEffectiveCategory } from '../linkDirectionality';

const nid = id => (id == null ? '' : String(id));
const refId = ref => (ref && typeof ref === 'object' ? ref.id : ref);
const day = v => String(v || '').slice(0, 10);

/** Adjacency of the visible graph, ids only. */
const adjacency = graphData => {
  const adj = new Map();
  (graphData?.nodes || []).forEach(n => adj.set(nid(n.id), new Set()));
  (graphData?.links || []).forEach(l => {
    const a = nid(refId(l.source)); const b = nid(refId(l.target));
    if (!adj.has(a) || !adj.has(b) || a === b) return;
    adj.get(a).add(b); adj.get(b).add(a);
  });
  return adj;
};

/**
 * Shortest path between two node ids over the visible graph, as the list of
 * ids from `a` to `b` inclusive; null when unreachable or either is unknown.
 * @param {object} graphData
 * @param {string} a
 * @param {string} b
 * @returns {Array<string> | null}
 */
export const shortestPath = (graphData, a, b) => {
  const adj = adjacency(graphData);
  const from = nid(a); const to = nid(b);
  if (!adj.has(from) || !adj.has(to)) return null;
  if (from === to) return [from];
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of adj.get(cur)) {
      if (prev.has(next)) continue;
      prev.set(next, cur);
      if (next === to) {
        const path = [to];
        let p = cur;
        while (p !== null) { path.push(p); p = prev.get(p); }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
};

const linksBetween = (graphData, a, b) => (graphData?.links || []).filter(l => {
  const s = nid(refId(l.source)); const t = nid(refId(l.target));
  return (s === a && t === b) || (s === b && t === a);
});

// One row per hop: who sits where, in what role, with what status and date.
// For an officer→company hop the officer is "who" and the company is "at";
// for a company→company hop (ownership, or a unified seat) the source is who.
const hopRows = (graphData, byId, path) => {
  const rows = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i]; const b = path[i + 1];
    const links = linksBetween(graphData, a, b);
    const na = byId.get(a); const nb = byId.get(b);
    const aIsOfficer = na?.type === 'officer';
    const bIsOfficer = nb?.type === 'officer';
    const who = aIsOfficer || (!bIsOfficer && links.some(l => nid(refId(l.source)) === a)) ? na : nb;
    const at = who === na ? nb : na;
    if (!links.length) {
      rows.push({ who: who?.name || '', whoId: nid(who?.id), at: at?.name || '', atId: nid(at?.id), role: '', status: '', date: '' });
      continue;
    }
    links.forEach(l => {
      const ownership = l.type === 'ownership';
      const cat = getLinkEffectiveCategory(l) || l.category;
      const active = ownership ? !l.lost : isActiveOfficerCategory(cat) && !at?.isDissolved && !at?.is_dissolved;
      rows.push({
        who: who?.name || '', whoId: nid(who?.id), at: at?.name || '', atId: nid(at?.id),
        role: l.relationship || l.category || '', status: active ? 'active' : 'ceased', date: day(l.categoryDate || l.date),
      });
    });
  }
  return rows;
};

// One intermediary can fan out to several ends (one suggestion, several
// ends). A longer chain joins exactly two ends, one at each side, so its key
// carries them: the same chain between other ends is another connection.
export const connectionKey = (via, ends = []) => (via.length === 1
  ? `conn:${via[0]}`
  : `conn:${ends[0] || ''}>${via.join('+')}>${ends[1] || ''}`);

// The hop paths a suggestion is made of: a fan (each end into the one
// intermediary) or the single chain from the first end to the second.
const hopPaths = ({ via, ends }) => (via.length === 1
  ? ends.map(e => [e, via[0]])
  : [[ends[0], ...via, ends[1]]]);

/**
 * The connections worth offering: every pair of selected nodes whose shortest
 * path runs through one or more UNselected nodes, grouped by that path so a
 * fan of pairs through one intermediary is one suggestion with several ends.
 * @param {{ graphData: object, selection: Array<string> }} args
 * @returns {Array<{ key: string, via: Array<string>, ends: Array<string>, hops: number }>}
 */
export const suggestConnections = ({ graphData, selection = [] }) => {
  const ids = [...new Set((selection || []).map(nid))];
  const selected = new Set(ids);
  const byKey = new Map();
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const path = shortestPath(graphData, ids[i], ids[j]);
      if (!path || path.length < 3) continue;
      const via = path.slice(1, -1);
      if (via.some(v => selected.has(v))) continue;
      const pair = [ids[i], ids[j]];
      const key = connectionKey(via, pair);
      const entry = byKey.get(key) || { key, via, ends: [], hops: path.length - 1 };
      pair.forEach(e => { if (!entry.ends.includes(e)) entry.ends.push(e); });
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()];
};

const joinNames = (names, t) => (names.length <= 1
  ? names.join('')
  : `${names.slice(0, -1).join(', ')} ${t.and} ${names[names.length - 1]}`);

/**
 * The step a suggestion becomes once accepted. No nodeId: the step is the
 * path, not an entity. `nodeIds` = ends then intermediaries; `linkKeys` = one
 * per hop, so the map lights exactly the path.
 * @param {{ suggestion: object, graphData: object, order: number, lang?: string }} args
 * @returns {object}
 */
export const connectionStep = ({ suggestion, graphData, order, lang = 'es' }) => {
  const t = walkthroughCopy(lang);
  const byId = new Map((graphData?.nodes || []).map(n => [nid(n.id), n]));
  const name = id => byId.get(id)?.name || id;
  const { via, ends } = suggestion;
  const seen = new Set();
  const hops = [];
  const linkKeys = [];
  hopPaths(suggestion).forEach(path => {
    hopRows(graphData, byId, path).forEach(r => {
      const k = `${r.whoId}|${r.atId}|${r.role}`;
      if (seen.has(k)) return;
      seen.add(k);
      hops.push(r);
    });
    for (let i = 0; i < path.length - 1; i += 1) {
      const k = pairKey(path[i], path[i + 1]);
      if (!linkKeys.includes(k)) linkKeys.push(k);
    }
  });
  const viaNames = via.map(name);
  const endNames = ends.map(name);
  const summary = t.connectionLine(joinNames(endNames, t), joinNames(viaNames, t), suggestion.hops);
  const dates = hops.map(h => h.date).filter(Boolean).sort();
  return {
    key: suggestion.key,
    nodeId: null,
    kind: 'connection',
    order,
    title: viaNames.join(' → '),
    narrative: null,
    authorNote: null,
    flag: null,
    section: 'connects',
    date: null,
    evidenceRef: null,
    deepLink: null,
    source: 'graph',
    summary,
    text: summary,
    evidence: { hops, ends, via },
    nodeIds: [...ends, ...via],
    linkKeys,
    moment: dates.length ? dates[dates.length - 1] : null,
  };
};
