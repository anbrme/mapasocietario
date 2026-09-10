// The document model behind the situation report ("Informe de situación") and
// its exported HTML file. Pure: no DOM, no network, no mutation of inputs.
//
// The one rule worth remembering: NOTE COLLECTION IS INDEPENDENT OF THE
// RELATIONSHIP SCOPING RULE. extractVisibleScope drops officers who appear at
// only one subject company, but a user who wrote a note on such a node meant
// it, so notes are gathered by walking the graph and are only afterwards joined
// to the scope's companies and connectors. Anything left over lands in
// otherNotes rather than vanishing.
//
// Hidden nodes need no special handling: callers pass filteredGraphData, which
// already excludes them. That is the correct default — the document describes
// the graph you are looking at.

import { hasNodeNote } from './nodeNotes';

// Flags a person reaches for when something is wrong, most urgent first. Any
// other flag ('blue', 'green', 'none') is a note, not a finding.
const FLAGGED_ORDER = ['red', 'amber'];

const normalizeNodeId = id => (id == null ? '' : String(id));

const noteEntry = node => ({
  nodeId: normalizeNodeId(node.id),
  name: node.name || '',
  type: node.type || '',
  flag: node.userNote.flag || 'none',
  text: node.userNote.text.trim(),
});

export function buildInvestigationDoc({
  graphData,
  scope,
  networkNote = '',
  corrections = [],
  primarySubject = '',
  generatedAt = new Date().toISOString(),
}) {
  const notedNodes = (graphData?.nodes || []).filter(hasNodeNote);
  const notesById = new Map(notedNodes.map(n => [normalizeNodeId(n.id), n.userNote]));

  const noteFor = nodeId => {
    const note = notesById.get(normalizeNodeId(nodeId));
    return note ? { ...note, text: note.text.trim() } : null;
  };

  const companies = (scope?.companyNodes || []).map(c => ({
    nodeId: c.nodeId,
    name: c.name,
    note: noteFor(c.nodeId),
  }));

  const connectors = (scope?.connectors || []).map(c => ({
    ...c,
    note: noteFor(c.nodeId),
  }));

  // Everything already shown in place must not be repeated at the bottom.
  const placed = new Set([
    ...companies.filter(c => c.note).map(c => c.nodeId),
    ...connectors.filter(c => c.note).map(c => normalizeNodeId(c.nodeId)),
  ]);

  const otherNotes = notedNodes
    .filter(n => !placed.has(normalizeNodeId(n.id)))
    .map(noteEntry);

  const flagged = FLAGGED_ORDER.flatMap(flag => notedNodes
    .filter(n => n.userNote.flag === flag)
    .map(noteEntry));

  return {
    subject: primarySubject || '',
    generatedAt,
    networkNote: String(networkNote || '').trim(),
    flagged,
    companies,
    connectors,
    ownership: [...(scope?.ownership || [])],
    otherNotes,
    corrections: (corrections || []).map(c => ({
      action: c.action || '',
      nameA: c.name_a || '',
      nameB: c.name_b || '',
      resignedDate: c.resigned_date || '',
    })),
    counts: {
      ...(scope?.counts || { companies: 0, officers: 0, sharedPeople: 0 }),
      notes: notedNodes.length,
      flagged: flagged.length,
    },
  };
}
