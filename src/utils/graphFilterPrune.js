// Orphan pruning for the chip filters (vigentes / cesados, position categories).
//
// The chips filter officer-company links only — an ownership or merge edge has
// no position and no active/ceased status, so it survives every chip. That made
// the naive prune ("keep any node still touched by a link") spare a company
// whose only officer edge had just been filtered away: the ownership edge held
// it on the canvas, and its sole shareholder came along with it. Filtering a
// director to their current posts left the companies they had left sitting in
// the graph, attached to nothing the user was looking at.
//
// The rule this encodes: an officer-company link is a REASON for a node to be on
// screen; every other link is a DECORATION on a node that is already there for
// a reason. Decorations are followed outward from anchored nodes, so an
// ownership chain hanging off a visible company is kept whole, but no chain can
// pull back in a company that holds no visible post.

const normalizeNodeId = id => (id == null ? '' : String(id));
const getNodeIdFromRef = ref => (ref && typeof ref === 'object' ? ref.id : ref);

const endpointsOf = link => [
  normalizeNodeId(getNodeIdFromRef(link.source)),
  normalizeNodeId(getNodeIdFromRef(link.target)),
];

// Officer links are the graph's default; some are built without an explicit type.
const isOfficerLink = link => !link.type || link.type === 'officer-company';

/**
 * Drop the nodes and decoration links left stranded by the chip filters.
 *
 * @param {Array} nodes  nodes surviving the earlier filters
 * @param {Array} links  links surviving the chip filters
 * @returns {{nodes: Array, links: Array}} new arrays; the inputs are untouched
 */
export const pruneChipFilterOrphans = (nodes, links) => {
  const anchored = new Set();
  links.forEach(link => {
    if (!isOfficerLink(link)) return;
    endpointsOf(link).forEach(id => anchored.add(id));
  });

  // Follow decorations outward from the anchored nodes until nothing new is
  // reached, so an ownership chain on a visible company is kept end to end.
  const decorations = links.filter(link => !isOfficerLink(link));
  const keptDecorations = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    decorations.forEach(link => {
      if (keptDecorations.has(link)) return;
      const [sourceId, targetId] = endpointsOf(link);
      if (!anchored.has(sourceId) && !anchored.has(targetId)) return;
      keptDecorations.add(link);
      anchored.add(sourceId);
      anchored.add(targetId);
      grew = true;
    });
  }

  const keptLinks = links.filter(link => isOfficerLink(link) || keptDecorations.has(link));
  const linkedIds = new Set();
  keptLinks.forEach(link => endpointsOf(link).forEach(id => linkedIds.add(id)));

  return {
    nodes: nodes.filter(n => linkedIds.has(normalizeNodeId(n.id))),
    links: keptLinks,
  };
};
