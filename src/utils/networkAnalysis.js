/**
 * Network Analysis Utilities for Mapa Societario
 *
 * Implements client-side corporate intelligence features:
 * 1. Connected Components / Cluster Detection
 * 2. Shortest Path Pathfinder (Breadth-First Search)
 */

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

  const startIdStr = String(startId);
  const endIdStr = String(endId);

  // Build adjacency list for fast graph traversal
  const adjacency = {};
  nodes.forEach(node => {
    adjacency[String(node.id)] = [];
  });

  links.forEach(link => {
    const sourceId = String(typeof link.source === 'object' ? link.source.id : link.source);
    const targetId = String(typeof link.target === 'object' ? link.target.id : link.target);

    // Ensure nodes exist in our active graph set before mapping connection
    if (adjacency[sourceId] && adjacency[targetId]) {
      adjacency[sourceId].push({ targetId, link });
      adjacency[targetId].push({ targetId: sourceId, link }); // Bidirectional traversal
    }
  });

  // Verify start and end exist in graph
  if (!adjacency[startIdStr] || !adjacency[endIdStr]) return null;

  // Queue stores [currentNodeId, pathTaken]
  const queue = [[startIdStr, [startIdStr]]];
  const visited = new Set([startIdStr]);

  while (queue.length > 0) {
    const [currId, path] = queue.shift();

    if (currId === endIdStr) {
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
    adjacency[String(node.id)] = [];
  });

  links.forEach(link => {
    const sourceId = String(typeof link.source === 'object' ? link.source.id : link.source);
    const targetId = String(typeof link.target === 'object' ? link.target.id : link.target);

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
    const nodeIdStr = String(node.id);
    if (visited.has(nodeIdStr)) return;

    // Start a new BFS/DFS component traversal
    const clusterId = `cluster-${clusterCounter++}`;
    const componentNodes = [];
    const queue = [nodeIdStr];
    visited.add(nodeIdStr);

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
