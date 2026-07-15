import { describe, expect, it } from 'vitest';
import {
  getNodeNoteMarkerGeometry,
  hasNodeNote,
  NODE_NOTE_MAX_LENGTH,
  mergeNodeNotes,
  nodeMatchesFilterTerms,
  normalizeNodeNote,
  removeNodeNote,
  setNodeNote,
} from './nodeNotes';

describe('node notes', () => {
  const graph = {
    nodes: [{ id: 'company-a', name: 'A' }, { id: 'officer-b', name: 'B' }],
    links: [{ id: 'a-b', source: 'company-a', target: 'officer-b' }],
  };

  it('adds a trimmed private note without changing links or other nodes', () => {
    const updated = setNodeNote(
      graph,
      'company-a',
      { text: '  Verify the shareholder chain.  ', flag: 'amber' },
      '2026-07-15T12:00:00.000Z'
    );

    expect(updated.nodes[0].userNote).toEqual({
      text: 'Verify the shareholder chain.',
      flag: 'amber',
      updatedAt: '2026-07-15T12:00:00.000Z',
    });
    expect(updated.nodes[1]).toBe(graph.nodes[1]);
    expect(updated.links).toBe(graph.links);
    expect(hasNodeNote(updated.nodes[0])).toBe(true);
  });

  it('removes only the selected node note', () => {
    const withNote = setNodeNote(graph, 'company-a', { text: 'Check this', flag: 'red' });
    const updated = removeNodeNote(withNote, 'company-a');

    expect(updated.nodes[0]).not.toHaveProperty('userNote');
    expect(updated.nodes[1]).toBe(graph.nodes[1]);
  });

  it('rejects empty notes and normalizes unknown flag colours', () => {
    expect(normalizeNodeNote({ text: '   ', flag: 'red' })).toBeNull();
    expect(normalizeNodeNote({ text: 'Keep', flag: 'purple' })?.flag).toBe('none');
  });

  it('limits note length', () => {
    const note = normalizeNodeNote({ text: 'x'.repeat(NODE_NOTE_MAX_LENGTH + 50) });
    expect(note.text).toHaveLength(NODE_NOTE_MAX_LENGTH);
  });

  it('positions the note marker consistently for companies and officers', () => {
    const companyMarker = getNodeNoteMarkerGeometry({ type: 'company', x: 20, y: 30 }, 10);
    expect(companyMarker.x).toBeCloseTo(7.2);
    expect(companyMarker.y).toBeCloseTo(17.2);
    expect(companyMarker.radius).toBe(5);

    const officerMarker = getNodeNoteMarkerGeometry({ type: 'officer', x: 20, y: 30 }, 10);
    expect(officerMarker.x).toBeCloseTo(12.8);
    expect(officerMarker.y).toBeCloseTo(22.8);
    expect(officerMarker.radius).toBe(5);
  });

  it('matches filter terms against either the node name or its private note', () => {
    const annotatedNode = {
      name: 'LU CURTIS PEY LIN',
      userNote: { text: 'Relevant manager for the ownership review', flag: 'red' },
    };

    expect(nodeMatchesFilterTerms(annotatedNode, ['curtis'])).toBe(true);
    expect(nodeMatchesFilterTerms(annotatedNode, ['relevant manager'])).toBe(true);
    expect(nodeMatchesFilterTerms(annotatedNode, ['shareholder'])).toBe(false);
  });

  it('preserves both notes when annotated nodes are merged', () => {
    expect(mergeNodeNotes(
      { text: 'Target note', flag: 'none', updatedAt: '2026-07-14T12:00:00.000Z' },
      { text: 'Source note', flag: 'red', updatedAt: '2026-07-15T12:00:00.000Z' },
      '2026-07-15T13:00:00.000Z'
    )).toEqual({
      text: 'Target note\n\n—\n\nSource note',
      flag: 'red',
      updatedAt: '2026-07-15T13:00:00.000Z',
    });
  });
});
