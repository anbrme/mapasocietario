// The graph, as SVG, for the exported situation-report file.
//
// This needs no physics engine and no layout algorithm: d3-force has already
// settled every node's x/y in the live canvas, and graphSnapshot.js keeps those
// two properties for exactly this reason (it strips index/vx/vy, which are
// simulation scratch). So the renderer draws at coordinates it already has.
//
// Output is a static, self-contained <svg>. Interactivity is added separately
// by walkthroughScript.js, which finds nodes via their data-id attribute.

import { escapeHtml } from '../escapeHtml';

const MARGIN = 40;
const COMPANY_RADIUS = 11;
const OFFICER_RADIUS = 7;
const LABEL_OFFSET = 6;
const LABEL_MAX_CHARS = 28;

const endpointId = e => (e && typeof e === 'object' ? e.id : e);
const nodeId = id => (id == null ? '' : String(id));
const isCompany = n => n?.type === 'company' || n?.type === 'spanish-company-group';
const finite = v => (Number.isFinite(v) ? v : null);

export const graphBounds = (nodes) => {
  const points = (nodes || [])
    .map(n => [finite(n?.x), finite(n?.y)])
    .filter(([x, y]) => x !== null && y !== null);

  if (points.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };

  return {
    minX: Math.min(...points.map(p => p[0])),
    minY: Math.min(...points.map(p => p[1])),
    maxX: Math.max(...points.map(p => p[0])),
    maxY: Math.max(...points.map(p => p[1])),
  };
};

const truncate = (name) => {
  const s = String(name || '');
  return s.length > LABEL_MAX_CHARS ? `${s.slice(0, LABEL_MAX_CHARS - 1)}…` : s;
};

export function renderGraphSvg(graphData, { flaggedIds } = {}) {
  const nodes = (graphData?.nodes || []).filter(n => finite(n?.x) !== null && finite(n?.y) !== null);
  const byId = new Map(nodes.map(n => [nodeId(n.id), n]));
  const flagged = flaggedIds instanceof Set ? flaggedIds : new Set(flaggedIds || []);

  const lines = (graphData?.links || []).map(l => {
    const a = byId.get(nodeId(endpointId(l.source)));
    const b = byId.get(nodeId(endpointId(l.target)));
    // A link can outlive one of its endpoints (hidden or deleted node); drawing
    // it would throw on the missing coordinates.
    if (!a || !b) return '';
    const kindAttr = l.type === 'ownership' ? ' data-kind="ownership"' : '';
    return `<line class="l"${kindAttr} data-a="${escapeHtml(nodeId(a.id))}" data-b="${escapeHtml(nodeId(b.id))}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
  }).join('');

  const groups = nodes.map(n => {
    const id = nodeId(n.id);
    const r = isCompany(n) ? COMPANY_RADIUS : OFFICER_RADIUS;
    const flag = flagged.has(id) ? (n.userNote?.flag || 'none') : '';
    const flagAttr = flag ? ` data-flag="${escapeHtml(flag)}"` : '';
    const kind = isCompany(n) ? 'company' : 'officer';
    return (
      `<g class="n" data-id="${escapeHtml(id)}" data-x="${n.x}" data-y="${n.y}" data-kind="${kind}"${flagAttr}>`
      + `<circle cx="${n.x}" cy="${n.y}" r="${r}"/>`
      + `<text x="${n.x}" y="${n.y - r - LABEL_OFFSET}">${escapeHtml(truncate(n.name))}</text>`
      + '</g>'
    );
  }).join('');

  const { minX, minY, maxX, maxY } = graphBounds(nodes);
  const viewBox = [
    minX - MARGIN,
    minY - MARGIN,
    (maxX - minX) + MARGIN * 2,
    (maxY - minY) + MARGIN * 2,
  ].join(' ');

  return `<svg id="map" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="img">`
    + `<g id="viewport"><g class="links">${lines}</g><g class="nodes">${groups}</g></g></svg>`;
}
