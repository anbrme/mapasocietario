/**
 * Network Analysis Utilities for Mapa Societario
 *
 * Implements client-side corporate intelligence features:
 * 1. Spanish Address Normalization and Matching
 * 2. Shared Registered Address (Co-location) Detection
 * 3. Connected Components / Cluster Detection
 * 4. Shortest Path Pathfinder (Breadth-First Search)
 */

/**
 * Normalizes a Spanish address string for building-level matching.
 * Attempts to remove common variations, abbreviations, punctuation,
 * and individual floor/apartment/door details.
 *
 * @param {string} address - The raw address string
 * @returns {string} Normalized canonical address string
 */
export function normalizeAddress(address) {
  if (!address || typeof address !== 'string') return '';

  let normalized = address
    .normalize('NFD') // Separate characters from accents
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toLowerCase()
    .trim();

  // Strip punctuation and common characters
  normalized = normalized.replace(/[,.;:()'"\-\/]/g, ' ');

  // Standardize common Spanish address terms and abbreviations
  const replacements = [
    { regex: /\b(calle|c\/|cl|c)\b/g, replacement: 'c' },
    { regex: /\b(avenida|avda|av|avd)\b/g, replacement: 'av' },
    { regex: /\b(paseo|pº|ps|pso)\b/g, replacement: 'ps' },
    { regex: /\b(plaza|plza|pz|pl)\b/g, replacement: 'pl' },
    { regex: /\b(carretera|ctra|crtra)\b/g, replacement: 'ctra' },
    { regex: /\b(poligono industrial|pol\.? ind\.?|poligono|pol)\b/g, replacement: 'poligono' },
    { regex: /\b(camino|cam)\b/g, replacement: 'camino' },
    { regex: /\b(ronda|rda)\b/g, replacement: 'ronda' },
    { regex: /\b(numero|num|nº|n)\b/g, replacement: '' },
    { regex: /\b(madrid)\b/g, replacement: 'madrid' },
    { regex: /\b(barcelona)\b/g, replacement: 'barcelona' }
  ];

  replacements.forEach(({ regex, replacement }) => {
    normalized = normalized.replace(regex, replacement);
  });

  // Strip floor, door, stair, and building subunit details to get down to building level
  // E.g., removes "3º", "2ª", "4º a", "piso 3", "bajo b", "puerta 4", "escalera izq"
  const subunitRegexes = [
    /\b\d+\s*[ºªªoºa]\b/g, // numbers with º or ª symbols (e.g. 3º, 2ª)
    /\b(piso|planta|bajo|puerta|atico|entresuelo|local|oficina|of|ofic|nave|escalera|esc|esc\.?|portal|izq|der|dcha|izda|dcho|duplicado|dup)\b.*/g,
    /\b\d+\s*[a-z]\b(?!\d)/g // numbers followed by single letter (e.g. 4a, 4b, but not zip codes like 28001)
  ];

  subunitRegexes.forEach(regex => {
    normalized = normalized.replace(regex, ' ');
  });

  // Clean up whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Sort words alphabetically to handle word order variations (e.g. "calle serrano 45" vs "serrano 45 calle")
  // Keep numbers in place but sort street tokens
  const tokens = normalized.split(' ').filter(token => token.length > 0);
  tokens.sort();

  return tokens.join(' ');
}

/**
 * Group company nodes by their registered address to detect co-locations.
 *
 * @param {Array} nodes - Currently loaded graph nodes
 * @returns {Object} Grouped address networks and a list of flagged co-locations
 */
export function detectCoLocations(nodes) {
  const grouped = {};

  nodes.forEach(node => {
    // Only check company nodes that have address metadata in parsed_details
    if (node.type !== 'company' && node.type !== 'spanish-company' && node.type !== 'spanish-company-group') return;

    const rawAddress = node.parsed_details?.domicilio || node.address || '';
    if (!rawAddress || rawAddress.length < 5) return;

    const canonicalAddress = normalizeAddress(rawAddress);
    if (!canonicalAddress) return;

    if (!grouped[canonicalAddress]) {
      grouped[canonicalAddress] = {
        canonical: canonicalAddress,
        representativeAddress: rawAddress, // Keep the first original address string as display
        nodes: []
      };
    }
    grouped[canonicalAddress].nodes.push(node);
  });

  // Filter out addresses that only host a single company
  const colocatedAddresses = Object.values(grouped)
    .filter(group => group.nodes.length >= 2)
    .map(group => ({
      address: group.representativeAddress,
      canonical: group.canonical,
      companies: group.nodes.map(n => ({ id: n.id, name: n.name || n.company_name })),
      count: group.nodes.length
    }))
    .sort((a, b) => b.count - a.count);

  return {
    grouped,
    colocatedAddresses
  };
}

/**
 * Traverses the loaded graph to find the shortest connection path between two nodes.
 * Uses Breadth-First Search (BFS) for optimal path detection in unweighted graphs.
 *
 * @param {Array} nodes - Loaded graph nodes
 * @param {Array} links - Loaded graph links
 * @param {string} startId - Origin node ID
 * @param {string} endId - Destination node ID
 * @returns {Array|null} Array of Node IDs forming the shortest path, or null if no connection
 */
export function findShortestPath(nodes, links, startId, endId) {
  if (!startId || !endId || startId === endId) return null;

  // Build adjacency list for fast graph traversal
  const adjacency = {};
  nodes.forEach(node => {
    adjacency[node.id] = [];
  });

  links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    // Ensure nodes exist in our active graph set before mapping connection
    if (adjacency[sourceId] && adjacency[targetId]) {
      adjacency[sourceId].push({ targetId, link });
      adjacency[targetId].push({ targetId: sourceId, link }); // Bidirectional traversal
    }
  });

  // Verify start and end exist in graph
  if (!adjacency[startId] || !adjacency[endId]) return null;

  // Queue stores [currentNodeId, pathTaken]
  const queue = [[startId, [startId]]];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const [currId, path] = queue.shift();

    if (currId === endId) {
      return path;
    }

    const neighbors = adjacency[currId] || [];
    for (const neighbor of neighbors) {
      const neighborId = neighbor.targetId;
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push([neighborId, [...path, neighborId]]);
      }
    }
  }

  return null; // Path not found
}

/**
 * Groups graph nodes into separate disconnected networks (connected components).
 *
 * @param {Array} nodes - Loaded graph nodes
 * @param {Array} links - Loaded graph links
 * @returns {Object} Map of nodeId -> clusterId and sorted list of components
 */
export function detectConnectedComponents(nodes, links) {
  const adjacency = {};
  nodes.forEach(node => {
    adjacency[node.id] = [];
  });

  links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    if (adjacency[sourceId] && adjacency[targetId]) {
      adjacency[sourceId].push(targetId);
      adjacency[targetId].push(sourceId);
    }
  });

  const visited = new Set();
  const nodeClusters = new Map();
  const clusters = [];
  let clusterCounter = 0;

  nodes.forEach(node => {
    if (visited.has(node.id)) return;

    // Start a new BFS/DFS component traversal
    const clusterId = `cluster-${clusterCounter++}`;
    const componentNodes = [];
    const queue = [node.id];
    visited.add(node.id);

    while (queue.length > 0) {
      const currId = queue.shift();
      componentNodes.push(currId);
      nodeClusters.set(currId, clusterId);

      const neighbors = adjacency[currId] || [];
      neighbors.forEach(neighborId => {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      });
    }

    clusters.push({
      id: clusterId,
      nodes: componentNodes,
      size: componentNodes.length
    });
  });

  // Sort clusters by size descending
  clusters.sort((a, b) => b.size - a.size);

  return {
    nodeClusters, // Map of nodeId -> clusterId
    clusters      // Array of components sorted by size
  };
}
