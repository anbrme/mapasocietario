import { describe, test, expect } from 'vitest';
import { pruneChipFilterOrphans } from './graphFilterPrune';

// A company is in the graph because someone in it holds a post there. An
// ownership edge is a DECORATION on such a company — it says who owns a company
// you are already looking at. It is never itself a reason for the company to be
// on screen.
//
// The chip filters (vigentes / cesados, position categories) apply only to
// officer-company links, so an ownership edge survives every filter. The orphan
// prune that follows counted those survivors as "still linked", so a company
// whose only officer edge had just been filtered away stayed on the canvas and
// dragged its sole shareholder with it — two nodes hanging off the graph with
// nothing connecting them to the person the user was looking at.

const officer = (source, target, extra = {}) =>
  ({ source, target, type: 'officer-company', ...extra });
const owns = (source, target, extra = {}) =>
  ({ source, target, type: 'ownership', ...extra });
const node = id => ({ id });

describe('pruneChipFilterOrphans', () => {
  test('drops a company left with no officer edge, and its sole shareholder with it', () => {
    // Arrange — the director's seat at FORMER SL was ceased and filtered out.
    const nodes = [node('DIRECTOR'), node('CURRENT SL'), node('FORMER SL'), node('SOCIO SL')];
    const links = [officer('DIRECTOR', 'CURRENT SL'), owns('FORMER SL', 'SOCIO SL')];

    // Act
    const pruned = pruneChipFilterOrphans(nodes, links);

    // Assert
    expect(pruned.nodes.map(n => n.id)).toEqual(['DIRECTOR', 'CURRENT SL']);
    expect(pruned.links).toEqual([links[0]]);
  });

  test('keeps the ownership edge of a company that still has an officer edge', () => {
    const nodes = [node('DIRECTOR'), node('CURRENT SL'), node('SOCIO SL')];
    const links = [officer('DIRECTOR', 'CURRENT SL'), owns('CURRENT SL', 'SOCIO SL')];

    const pruned = pruneChipFilterOrphans(nodes, links);

    expect(pruned.nodes.map(n => n.id)).toEqual(['DIRECTOR', 'CURRENT SL', 'SOCIO SL']);
    expect(pruned.links).toHaveLength(2);
  });

  test('reads an ownership edge pointed the other way round', () => {
    // graphUnify re-points ownership edges in either direction, so the company
    // is not reliably the source.
    const nodes = [node('DIRECTOR'), node('CURRENT SL'), node('SOCIO SL')];
    const links = [officer('DIRECTOR', 'CURRENT SL'), owns('SOCIO SL', 'CURRENT SL')];

    const pruned = pruneChipFilterOrphans(nodes, links);

    expect(pruned.nodes.map(n => n.id)).toContain('SOCIO SL');
    expect(pruned.links).toHaveLength(2);
  });

  test('follows an ownership chain out from a company that survived', () => {
    const nodes = [node('DIRECTOR'), node('CURRENT SL'), node('SOCIO SL'), node('MATRIZ SL')];
    const links = [officer('DIRECTOR', 'CURRENT SL'), owns('CURRENT SL', 'SOCIO SL'),
                   owns('SOCIO SL', 'MATRIZ SL')];

    const pruned = pruneChipFilterOrphans(nodes, links);

    expect(pruned.nodes.map(n => n.id)).toEqual(
      ['DIRECTOR', 'CURRENT SL', 'SOCIO SL', 'MATRIZ SL']);
    expect(pruned.links).toHaveLength(3);
  });

  test('does not let an ownership chain resurrect a company with no officer edge', () => {
    const nodes = [node('DIRECTOR'), node('CURRENT SL'), node('FORMER SL'), node('SOCIO SL')];
    const links = [officer('DIRECTOR', 'CURRENT SL'),
                   owns('FORMER SL', 'SOCIO SL'), owns('SOCIO SL', 'FORMER SL')];

    const pruned = pruneChipFilterOrphans(nodes, links);

    expect(pruned.nodes.map(n => n.id)).toEqual(['DIRECTOR', 'CURRENT SL']);
  });

  test('resolves endpoints d3 has replaced with node objects', () => {
    // react-force-graph mutates link.source/target into the node objects.
    const current = node('CURRENT SL');
    const socio = node('SOCIO SL');
    const nodes = [node('DIRECTOR'), current, socio];
    const links = [officer({ id: 'DIRECTOR' }, current), owns(current, socio)];

    const pruned = pruneChipFilterOrphans(nodes, links);

    expect(pruned.nodes.map(n => n.id)).toEqual(['DIRECTOR', 'CURRENT SL', 'SOCIO SL']);
  });

  test('treats a link with no type as an officer link', () => {
    // Officer links are the graph's default and some are built without a type.
    const nodes = [node('DIRECTOR'), node('CURRENT SL')];
    const links = [{ source: 'DIRECTOR', target: 'CURRENT SL' }];

    expect(pruneChipFilterOrphans(nodes, links).nodes).toHaveLength(2);
  });

  test('empties the graph when the filter leaves no officer edge at all', () => {
    // Nothing is anchored, so a floating ownership pair is not a result — it is
    // the residue of a filter that matched nothing.
    const nodes = [node('FORMER SL'), node('SOCIO SL')];
    const links = [owns('FORMER SL', 'SOCIO SL')];

    const pruned = pruneChipFilterOrphans(nodes, links);

    expect(pruned.nodes).toEqual([]);
    expect(pruned.links).toEqual([]);
  });

  test('keeps a non-ownership decoration too, on the same rule', () => {
    // Merge / name-change edges are not officer links either.
    const nodes = [node('DIRECTOR'), node('CURRENT SL'), node('OLD NAME SL')];
    const links = [officer('DIRECTOR', 'CURRENT SL'),
                   { source: 'CURRENT SL', target: 'OLD NAME SL', type: 'merge' }];

    expect(pruneChipFilterOrphans(nodes, links).nodes).toHaveLength(3);
  });

  test('does not mutate the arrays it is given', () => {
    const nodes = [node('DIRECTOR'), node('FORMER SL'), node('SOCIO SL')];
    const links = [officer('DIRECTOR', 'DIRECTOR'), owns('FORMER SL', 'SOCIO SL')];
    const nodesCopy = [...nodes];
    const linksCopy = [...links];

    pruneChipFilterOrphans(nodes, links);

    expect(nodes).toEqual(nodesCopy);
    expect(links).toEqual(linksCopy);
  });
});
