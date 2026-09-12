import { describe, expect, it } from 'vitest';
import { renderGraphSvg, graphBounds } from './renderGraphSvg';

const graphData = {
  nodes: [
    { id: 'c1', type: 'company', name: 'ALFA SL', x: 0, y: 0, userNote: { text: 'n', flag: 'red' } },
    { id: 'o1', type: 'officer', name: 'GARCIA LOPEZ ANA', x: 100, y: 40 },
  ],
  links: [{ source: 'c1', target: 'o1' }],
};

describe('graphBounds', () => {
  it('fits the extremes of the settled layout', () => {
    expect(graphBounds(graphData.nodes)).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 40 });
  });

  it('returns a usable box for an empty graph rather than NaN', () => {
    expect(graphBounds([])).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 1 });
  });

  it('ignores nodes whose coordinates were never settled', () => {
    expect(graphBounds([{ id: 'a', x: 5, y: 5 }, { id: 'b' }]))
      .toEqual({ minX: 5, minY: 5, maxX: 5, maxY: 5 });
  });
});

describe('renderGraphSvg', () => {
  it('emits one positioned group per node, tagged with its id', () => {
    const svg = renderGraphSvg(graphData, {});

    expect(svg).toContain('data-id="c1"');
    expect(svg).toContain('data-id="o1"');
    expect(svg.match(/class="n"/g)).toHaveLength(2);
  });

  it('resolves object link endpoints that d3-force has mutated', () => {
    const mutated = {
      nodes: graphData.nodes,
      links: [{ source: graphData.nodes[0], target: graphData.nodes[1] }],
    };

    expect(renderGraphSvg(mutated, {})).toContain('<line');
  });

  it('drops links whose endpoints are not both present', () => {
    const dangling = { nodes: graphData.nodes, links: [{ source: 'c1', target: 'ghost' }] };

    expect(renderGraphSvg(dangling, {})).not.toContain('<line');
  });

  it('marks flagged nodes so the walkthrough can find them', () => {
    const svg = renderGraphSvg(graphData, { flaggedIds: ['c1'] });

    expect(svg).toContain('data-flag="red"');
  });

  it('escapes a node name that would otherwise close the element', () => {
    const hostile = { nodes: [{ id: 'x', name: '</text><script>alert(1)</script>', x: 1, y: 1 }], links: [] };
    const svg = renderGraphSvg(hostile, {});

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;/text&gt;');
  });

  it('fits the viewBox to the layout with a margin', () => {
    expect(renderGraphSvg(graphData, {})).toMatch(/viewBox="-40 -40 180 120"/);
  });

  it('stamps coordinates on nodes and endpoint ids on links', () => {
    const svg = renderGraphSvg({
      nodes: [{ id: 'a', type: 'company', name: 'A', x: 10, y: 20 }, { id: 'b', type: 'officer', name: 'B', x: 30, y: 40 }],
      links: [{ source: 'a', target: 'b' }],
    });
    expect(svg).toContain('data-id="a" data-x="10" data-y="20"');
    expect(svg).toContain('data-id="b" data-x="30" data-y="40"');
    expect(svg).toContain('<line class="l" data-a="a" data-b="b"');
  });
});
