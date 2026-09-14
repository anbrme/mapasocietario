// When did each node and each seat of the visible graph exist, according to
// the registry? Pure: derived from the graph's links (role-filtered events,
// categoryDate, date) and the v3 profiles the walkthrough loader already
// fetched. The exported file embeds the result and re-renders the map for
// any date with `stateAt`'s rule; the script inlines the same rule.
import { pairKey } from './pairKey';
import { getLinkEffectiveCategory } from '../linkDirectionality';
import { isActiveCategory } from '../officerLinkStatus';

const nid = id => (id == null ? '' : String(id));
const refId = ref => (ref && typeof ref === 'object' ? ref.id : ref);
const isCompany = n => !!n && (n.type === 'company' || n.type === 'spanish-company-group');
const day = v => {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

export const isIsoDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const roleKey = l => String(l?.relationship || l?.category || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const isOwnership = l => l?.type === 'ownership' || String(l?.category || '').toLowerCase().startsWith('socio');

/** Stable key for one drawn line: the link id when the graph gave it one. */
export const linkKey = l => {
  const id = nid(l?.id);
  if (id) return id;
  return `${pairKey(refId(l?.source), refId(l?.target))}|${roleKey(l)}`;
};

/** @returns {{from: string|null, to: string|null}} ISO days, null = unknown */
export const linkDates = l => {
  if (!l) return { from: null, to: null };
  if (isOwnership(l)) {
    const d = day(l.date) || null;
    return { from: d, to: l.lost ? d : null };
  }
  const events = Array.isArray(l.events) ? l.events : [];
  const appts = events.filter(e => isActiveCategory(e?.category)).map(e => day(e?.date)).filter(Boolean).sort();
  const ceses = events.filter(e => e?.category && !isActiveCategory(e.category)).map(e => day(e?.date)).filter(Boolean).sort();
  const ceased = !isActiveCategory(getLinkEffectiveCategory(l) || l.category);
  const from = appts[0] || (ceased ? '' : day(l.date)) || null;
  const to = ceased ? (day(l.categoryDate) || ceses[ceses.length - 1] || day(l.date) || null) : null;
  return { from, to };
};

const touches = (l, id) => nid(refId(l?.source)) === id || nid(refId(l?.target)) === id;

/** Company: profile first/last filing, else its links' earliest date. Persons: nothing. */
export const nodeDates = (node, links, profile) => {
  if (!isCompany(node)) return { from: null, to: null, dissolved: false };
  const id = nid(node.id);
  const dissolved = !!(profile?.is_dissolved || node.isDissolved);
  const own = (links || []).filter(l => touches(l, id)).map(linkDates);
  const earliest = own.map(d => d.from).filter(Boolean).sort()[0] || null;
  const last = day(profile?.last_seen) || null;
  return {
    from: day(profile?.first_seen) || earliest,
    to: dissolved && last ? last : null,
    dissolved,
  };
};

const latestOf = list => list.filter(Boolean).sort().slice(-1)[0] || null;

/** The chapter's default date: company → last filing; person → latest seat date. */
export const defaultMoment = step => {
  if (!step) return null;
  if (step.kind === 'person') {
    const seats = step.evidence?.seats || [];
    return latestOf(seats.flatMap(s => [day(s.since), day(s.until)]));
  }
  return day(step.evidence?.status?.lastFiling?.date) || null;
};

/**
 * @param {{ graphData: object, stepData: Map<string, {profile?: object}|null>, steps: Array<object>, readOn: string }} args
 * @returns {{ dates: string[], nodes: object, links: object, undated: number, readOn: string }}
 */
export const buildTimeline = ({ graphData, stepData, steps, readOn }) => {
  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];
  const data = stepData instanceof Map ? stepData : new Map();
  const read = day(readOn) || new Date().toISOString().slice(0, 10);

  const nodeTable = {};
  nodes.forEach(n => {
    nodeTable[nid(n.id)] = nodeDates(n, links, data.get(nid(n.id))?.profile || null);
  });

  const linkTable = {};
  let undated = 0;
  links.forEach(l => {
    const d = linkDates(l);
    if (!d.from && !d.to) undated += 1;
    linkTable[linkKey(l)] = { a: nid(refId(l.source)), b: nid(refId(l.target)), from: d.from, to: d.to };
  });

  // The slider stops on the STORY's dates: the seats of the step entities and
  // the companies one hop away (a seat's other end, an owned company), the
  // chapter moments and the read date. Every node is still re-rendered at
  // each stop; the other nodes' private dates just do not become stops.
  // Without steps, every date is a stop.
  const storyIds = new Set((steps || []).flatMap(s => (Array.isArray(s?.nodeIds) && s.nodeIds.length ? s.nodeIds : [s?.nodeId])).map(nid).filter(Boolean));
  const storyLinks = storyIds.size
    ? Object.values(linkTable).filter(d => storyIds.has(d.a) || storyIds.has(d.b))
    : Object.values(linkTable);
  const storyNodeIds = storyIds.size
    ? new Set([...storyIds, ...storyLinks.flatMap(d => [d.a, d.b])])
    : new Set(Object.keys(nodeTable));
  const moments = (steps || []).map(s => day(s?.moment)).filter(Boolean);
  const all = [
    ...[...storyNodeIds].map(id => nodeTable[id]).filter(Boolean).flatMap(d => [d.from, d.to]),
    ...storyLinks.flatMap(d => [d.from, d.to]),
    ...moments,
    read,
  ].filter(Boolean);
  const dates = [...new Set(all)].sort();

  return { dates, nodes: nodeTable, links: linkTable, undated, readOn: read };
};

const linkState = (d, date) => {
  if (d.from && date < d.from) return 'hidden';
  if (d.to && date >= d.to) return 'ceased';
  return 'live';
};
const companyState = (d, date) => {
  if (d.from && date < d.from) return 'hidden';
  if (d.to && date >= d.to) return 'ghost';
  return 'live';
};

/**
 * The map as of one day. Persons follow their seats; a ghost company's seats
 * read ceased, and a seat of a company that does not exist yet is hidden with
 * it — a drawn line to an invisible node is a line to nowhere.
 * @returns {{ nodes: Map<string, 'live'|'ghost'|'hidden'>, links: Map<string, 'live'|'ceased'|'hidden'> }}
 */
export const stateAt = (timeline, date) => {
  const nodesOut = new Map();
  const linksOut = new Map();
  const nodeTable = timeline?.nodes || {};
  const linkTable = timeline?.links || {};
  const isDatedCompany = d => d.from !== null || d.to !== null || d.dissolved;

  Object.entries(nodeTable).forEach(([id, d]) => {
    if (isDatedCompany(d)) nodesOut.set(id, companyState(d, date));
  });
  Object.entries(linkTable).forEach(([key, d]) => {
    let st = linkState(d, date);
    const a = nodesOut.get(d.a);
    const b = nodesOut.get(d.b);
    if (a === 'hidden' || b === 'hidden') st = 'hidden';
    else if (st !== 'hidden' && (a === 'ghost' || b === 'ghost')) st = 'ceased';
    linksOut.set(key, st);
  });
  Object.keys(nodeTable).forEach(id => {
    if (nodesOut.has(id)) return;
    const states = Object.entries(linkTable).filter(([, d]) => d.a === id || d.b === id).map(([k]) => linksOut.get(k));
    if (states.length === 0 || states.includes('live')) { nodesOut.set(id, 'live'); return; }
    nodesOut.set(id, states.includes('ceased') ? 'ghost' : 'hidden');
  });
  return { nodes: nodesOut, links: linksOut };
};
