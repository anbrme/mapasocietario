// The author layer: elements the author adds to the map (links, entities),
// registry links the author dismisses, and registry nodes the author renamed.
//
// Rule: absence of `provenance` means BORME. An author element carries
// `provenance.by === 'author'`; a renamed registry node carries only
// `provenance.renamedFrom`. Nothing here talks to any API. Pure: plain
// objects in, new plain objects out.

export const AUTHOR_LINK_TYPE = 'author';
export const AUTHOR_LINK_PREFIX = 'author-link-';
export const AUTHOR_NODE_PREFIX = 'author-node-';
export const AUTHOR_LABEL_MAX = 80;
export const AUTHOR_NAME_MAX = 120;
export const AUTHOR_NOTE_MAX = 500;
export const AUTHOR_SOURCE_MAX = 300;

const nid = id => (id == null ? '' : String(id));
const refId = ref => (ref && typeof ref === 'object' ? ref.id : ref);
const clean = (value, max) => String(value || '').trim().slice(0, max);
const randomId = prefix => `${prefix}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export const isAuthorLink = link => !!link && link.type === AUTHOR_LINK_TYPE && link.provenance?.by === 'author';
export const isAuthorNode = node => !!node && node.provenance?.by === 'author';
export const isAuthorElement = el => isAuthorLink(el) || isAuthorNode(el);
export const isRegistryElement = el => !!el && !isAuthorElement(el);
export const isDismissedLink = link => !!link?.dismissed;
export const isRenamedNode = node => !isAuthorNode(node) && typeof node?.provenance?.renamedFrom === 'string';

const isHttpUrl = value => /^https?:\/\/\S+$/i.test(String(value || '').trim());

const citationOf = (text, url) => {
  const t = clean(text, AUTHOR_SOURCE_MAX);
  const u = clean(url, AUTHOR_SOURCE_MAX);
  return t || u ? { text: t, url: u } : null;
};

const provenanceOf = ({ citationText, citationUrl, asserted, note, author, now }) => ({
  by: 'author',
  citation: citationOf(citationText, citationUrl),
  asserted: /^\d{4}-\d{2}-\d{2}$/.test(String(asserted || '')) ? asserted : null,
  note: clean(note, AUTHOR_NOTE_MAX),
  at: now || new Date().toISOString(),
  author: clean(author, 120),
});

export const validateAuthorLinkDraft = draft => {
  const errors = {};
  if (!clean(draft?.label, AUTHOR_LABEL_MAX)) errors.label = 'required';
  if (clean(draft?.citationUrl, AUTHOR_SOURCE_MAX) && !isHttpUrl(draft.citationUrl)) errors.url = 'invalid';
  return { ok: Object.keys(errors).length === 0, errors };
};

export const validateAuthorNodeDraft = draft => {
  const errors = {};
  if (!clean(draft?.name, AUTHOR_NAME_MAX)) errors.name = 'required';
  if (clean(draft?.citationUrl, AUTHOR_SOURCE_MAX) && !isHttpUrl(draft.citationUrl)) errors.url = 'invalid';
  return { ok: Object.keys(errors).length === 0, errors };
};

export const makeAuthorLink = ({ sourceId, targetId, label, directed = false, id, ...rest }) => {
  const provenance = provenanceOf(rest);
  return {
    id: id || randomId(AUTHOR_LINK_PREFIX),
    source: nid(sourceId),
    target: nid(targetId),
    type: AUTHOR_LINK_TYPE,
    category: 'author',
    relationship: clean(label, AUTHOR_LABEL_MAX),
    directed: !!directed,
    date: provenance.asserted,
    provenance,
  };
};

export const makeAuthorNode = ({ kind, name, country, identifier, id, x = 0, y = 0, ...rest }) => ({
  id: id || randomId(AUTHOR_NODE_PREFIX),
  name: clean(name, AUTHOR_NAME_MAX),
  type: kind === 'company' ? 'company' : 'officer',
  ...(kind === 'company' ? {} : { subtype: 'individual' }),
  country: clean(country, 2).toUpperCase(),
  identifier: clean(identifier, AUTHOR_SOURCE_MAX),
  companies: [],
  positions: [],
  provenance: provenanceOf(rest),
  x, y, fx: x, fy: y,
});

const mapLink = (graphData, linkId, fn) => ({
  ...graphData,
  links: (graphData?.links || []).map(l => (nid(l.id) === nid(linkId) ? fn(l) : l)),
});

export const dismissLink = (graphData, linkId, reason, now) => mapLink(graphData, linkId, l => ({
  ...l, dismissed: { by: 'author', reason: clean(reason, AUTHOR_NOTE_MAX), at: now || new Date().toISOString() },
}));

export const restoreLink = (graphData, linkId) => mapLink(graphData, linkId, ({ dismissed, ...l }) => l);

export const markRenamed = (node, registryName) => {
  if (!node || isAuthorNode(node) || isRenamedNode(node)) return node;
  return { ...node, provenance: { renamedFrom: String(registryName || '') } };
};

export const removeAuthorNode = (graphData, nodeId) => {
  const target = nid(nodeId);
  const node = (graphData?.nodes || []).find(n => nid(n.id) === target);
  if (!isAuthorNode(node)) return graphData;
  return {
    ...graphData,
    nodes: graphData.nodes.filter(n => nid(n.id) !== target),
    links: (graphData.links || []).filter(l => !(isAuthorLink(l) && (nid(refId(l.source)) === target || nid(refId(l.target)) === target))),
  };
};

export const visibleWithoutDismissed = links => (links || []).filter(l => !isDismissedLink(l));

export const collectAuthorLayer = graphData => {
  const nodes = graphData?.nodes || [];
  const byId = new Map(nodes.map(n => [nid(n.id), n]));
  const nameOf = ref => byId.get(nid(refId(ref)))?.name || nid(refId(ref));
  const links = graphData?.links || [];
  return {
    nodes: nodes.filter(isAuthorNode).map(n => ({
      nodeId: nid(n.id), name: n.name, kind: n.type === 'officer' ? 'person' : 'company',
      country: n.country || '', identifier: n.identifier || '',
      citation: n.provenance.citation, note: n.provenance.note || '', at: n.provenance.at, author: n.provenance.author || '',
    })),
    links: links.filter(isAuthorLink).map(l => ({
      from: nameOf(l.source), fromId: nid(refId(l.source)), to: nameOf(l.target), toId: nid(refId(l.target)),
      label: l.relationship, directed: !!l.directed,
      citation: l.provenance.citation, asserted: l.provenance.asserted, note: l.provenance.note || '',
      at: l.provenance.at, author: l.provenance.author || '',
    })),
    dismissed: links.filter(isDismissedLink).map(l => ({
      from: nameOf(l.source), to: nameOf(l.target), relationship: l.relationship || l.category || '',
      reason: l.dismissed.reason || '', at: l.dismissed.at,
    })),
    renamed: nodes.filter(isRenamedNode).map(n => ({ nodeId: nid(n.id), name: n.name, registryName: n.provenance.renamedFrom })),
  };
};
