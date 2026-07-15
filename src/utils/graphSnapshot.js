export const GRAPH_SNAPSHOT_FORMAT = 'mapasocietario.graph-snapshot';
export const GRAPH_SNAPSHOT_VERSION = 1;
export const MAX_GRAPH_SNAPSHOT_BYTES = 100 * 1024 * 1024;

const RUNTIME_NODE_KEYS = new Set(['index', 'vx', 'vy']);
const RUNTIME_LINK_KEYS = new Set(['index']);

const endpointId = endpoint => (
  endpoint && typeof endpoint === 'object' ? endpoint.id : endpoint
);

const jsonClone = value => JSON.parse(JSON.stringify(value));

const sanitizeRecord = (record, runtimeKeys) => {
  const clean = {};
  Object.entries(record || {}).forEach(([key, value]) => {
    if (runtimeKeys.has(key) || key.startsWith('__') || typeof value === 'function' || value === undefined) {
      return;
    }
    clean[key] = value;
  });
  return jsonClone(clean);
};

const sanitizeNode = node => sanitizeRecord(node, RUNTIME_NODE_KEYS);

const sanitizeLink = link => {
  const { source, target, ...linkData } = link || {};
  const clean = sanitizeRecord(linkData, RUNTIME_LINK_KEYS);
  clean.source = endpointId(source);
  clean.target = endpointId(target);
  return clean;
};

const assertObject = (value, message) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
};

export const createGraphSnapshot = ({ graphData, view = {}, context = {}, enrichments = {} }) => {
  const nodes = (graphData?.nodes || []).map(sanitizeNode);
  const links = (graphData?.links || []).map(sanitizeLink);

  return {
    format: GRAPH_SNAPSHOT_FORMAT,
    version: GRAPH_SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    graph: { nodes, links },
    view: jsonClone(view),
    context: jsonClone(context),
    enrichments: jsonClone(enrichments),
  };
};

export const parseGraphSnapshot = source => {
  const snapshot = typeof source === 'string' ? JSON.parse(source) : source;
  assertObject(snapshot, 'The selected file is not a graph snapshot.');

  if (snapshot.format !== GRAPH_SNAPSHOT_FORMAT) {
    throw new Error('The selected file is not a Mapasocietario graph snapshot.');
  }
  if (snapshot.version !== GRAPH_SNAPSHOT_VERSION) {
    throw new Error(`Unsupported graph snapshot version: ${snapshot.version}.`);
  }
  assertObject(snapshot.graph, 'The graph snapshot has no graph data.');
  if (!Array.isArray(snapshot.graph.nodes) || !Array.isArray(snapshot.graph.links)) {
    throw new Error('The graph snapshot must contain node and link arrays.');
  }

  const nodeIds = new Set();
  const nodes = snapshot.graph.nodes.map(node => {
    assertObject(node, 'The graph snapshot contains an invalid node.');
    if (node.id === undefined || node.id === null || node.id === '') {
      throw new Error('Every imported node must have an ID.');
    }
    const key = String(node.id);
    if (nodeIds.has(key)) throw new Error(`Duplicate node ID in graph snapshot: ${key}.`);
    nodeIds.add(key);
    return sanitizeNode(node);
  });

  const linkIds = new Set();
  const links = snapshot.graph.links.map((link, index) => {
    assertObject(link, 'The graph snapshot contains an invalid link.');
    const clean = sanitizeLink(link);
    const sourceKey = String(clean.source ?? '');
    const targetKey = String(clean.target ?? '');
    if (!sourceKey || !targetKey || !nodeIds.has(sourceKey) || !nodeIds.has(targetKey)) {
      throw new Error(`Link ${link.id || index + 1} points to a missing node.`);
    }
    if (clean.id !== undefined && clean.id !== null) {
      const linkKey = String(clean.id);
      if (linkIds.has(linkKey)) throw new Error(`Duplicate link ID in graph snapshot: ${linkKey}.`);
      linkIds.add(linkKey);
    }
    return clean;
  });

  return {
    ...snapshot,
    graph: { nodes, links },
    view: snapshot.view && typeof snapshot.view === 'object' ? snapshot.view : {},
    context: snapshot.context && typeof snapshot.context === 'object' ? snapshot.context : {},
    enrichments: snapshot.enrichments && typeof snapshot.enrichments === 'object'
      ? snapshot.enrichments
      : {},
  };
};
