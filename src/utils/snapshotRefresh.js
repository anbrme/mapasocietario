// Bring an imported snapshot's company facts up to date with the live registry.
//
// A snapshot freezes each node as it was built, and a company reached by
// expanding an officer only ever stored the filings that named that officer —
// J&C PRIME BRANDS SL came out of one as "1 filing since 2017" against 32 live,
// with no NIF. These pure helpers apply a live profile + events to such a node
// and measure what the refresh changed. Structure is never touched here: no
// node is added or removed, and positions and identities are preserved.
import { isAuthorNode } from './authorLayer';
import { rebindLinksAfterNodeUpdate } from './graphLinkBinding';
import { buildOfficerEventMap, applyOfficerEventsToLinks } from './linkEventMerge';
import { getLinkEffectiveCategory } from './linkDirectionality';
import { isActiveCategory, isDissolvedLink } from './officerLinkStatus';

const COMPANY_TYPES = new Set(['company', 'spanish-company-group']);

const eventDate = evt => evt?.event_date || evt?.indexed_date || evt?.date || null;

const byDateDesc = (a, b) =>
  new Date(eventDate(b) || 0) - new Date(eventDate(a) || 0);

/** Registry company nodes worth refreshing: named, and not drawn by the author. */
export const selectRefreshTargets = nodes =>
  (nodes || []).filter(n =>
    n && COMPANY_TYPES.has(n.type) && (n.name || '').trim() && !isAuthorNode(n));

const previousNamesFrom = (node, company) => {
  const names = new Set(node.companySummary?.previousNames || node.previousNames || []);
  const currentName = company?.company_name || node.name;
  (Array.isArray(company?.name_changes) ? company.name_changes : []).forEach(nc => {
    if (nc?.old_name && nc.old_name !== currentName) names.add(nc.old_name);
  });
  return Array.from(names);
};

// BORME events rarely print a NIF; the checksum-validated enriched NIF on the
// company doc is the fallback, exactly as the live inspector panel resolves it.
const nifFrom = (sortedEvents, company) => {
  const printed = sortedEvents.find(evt => evt.cif || evt.nif || evt.parsed_details?.cif);
  return printed?.cif || printed?.nif || printed?.parsed_details?.cif || company?.enriched_nif || null;
};

/**
 * Apply a live profile and events to one company node.
 *
 * @param {object} node
 * @param {object} live
 * @param {object|null} live.company   v3 company doc, or null if it failed.
 * @param {object[]}    live.events    v3 events (any order).
 * @param {number}      [live.total]   Server-side event total (events may be capped).
 * @param {string}      [live.refreshedAt] ISO timestamp stamped on the node.
 * @returns {object} a new node, or the same node when there was nothing live.
 */
export function refreshCompanyNode(node, { company = null, events = [], total, refreshedAt } = {}) {
  const sorted = [...(events || [])].sort(byDateDesc);
  if (!company && sorted.length === 0) return node;

  const earliest = company?.first_seen || eventDate(sorted[sorted.length - 1]) || null;
  const latest = company?.last_seen || eventDate(sorted[0]) || null;
  const cif = nifFrom(sorted, company);
  const groupKey = company?.group_key || company?.id || node.groupKey || null;

  return {
    ...node,
    companySummary: {
      ...(node.companySummary || {}),
      totalEntries: Number.isFinite(total) ? total : sorted.length,
      dateRange: { earliest, latest },
      previousNames: previousNamesFrom(node, company),
    },
    ...(cif && { cif }),
    ...(groupKey && { groupKey }),
    ...(company && {
      isDissolved: !!company.is_dissolved,
      isInConcurso: !!company.is_in_concurso,
      isUnipersonal: !!company.is_unipersonal,
    }),
    ...(refreshedAt && { liveRefreshedAt: refreshedAt }),
  };
}

/**
 * Apply fetched live data to the whole graph: refresh each fetched company
 * node, rebind links that force-graph had bound to the replaced node objects,
 * then attach the companies' officer acts to the seats ALREADY in the graph.
 * Links of companies that were not fetched are left exactly as they were.
 *
 * @param {{nodes: object[], links: object[]}} graph
 * @param {Map<string, {company, events, total}>} liveById  node id → live data.
 * @param {string} [refreshedAt]
 * @returns {{nodes: object[], links: object[]}}
 */
export function applyLiveRefresh(graph, liveById, refreshedAt) {
  const nodes = graph.nodes.map(node => {
    const live = liveById.get(node.id);
    return live ? refreshCompanyNode(node, { ...live, refreshedAt }) : node;
  });
  const reboundLinks = rebindLinksAfterNodeUpdate(graph.links, graph.nodes, nodes);

  const refreshedNodes = nodes.filter(n => liveById.has(n.id));
  const eventMap = buildOfficerEventMap(
    refreshedNodes.map(n => ({ company: n.name, events: liveById.get(n.id).events }))
  );
  const links = applyOfficerEventsToLinks({ nodes, links: reboundLinks }, eventMap, {
    companyIds: new Set(refreshedNodes.map(n => String(n.id))),
  });
  return { nodes, links };
}

/** 'active' | 'ceased' — the same rule the graph colours a seat by. */
export const linkStatus = link => {
  if (isDissolvedLink(link)) return 'ceased';
  return isActiveCategory(getLinkEffectiveCategory(link)) ? 'active' : 'ceased';
};

/**
 * What a refresh changed. Links must be index-aligned (the refresh maps them
 * one-to-one), nodes are matched by id.
 */
export function summarizeRefresh({ before, after, refreshed = 0, failed = [] }) {
  const newlyCeased = after.links.filter((link, i) =>
    before.links[i] && linkStatus(before.links[i]) === 'active' && linkStatus(link) === 'ceased'
  ).length;

  const wasDissolved = new Map(before.nodes.map(n => [n.id, !!n.isDissolved]));
  const newlyDissolved = after.nodes.filter(n =>
    n.isDissolved && wasDissolved.get(n.id) === false
  ).length;

  return { refreshed, newlyCeased, newlyDissolved, failed };
}
