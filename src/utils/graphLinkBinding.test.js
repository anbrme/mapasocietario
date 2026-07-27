import { describe, expect, it } from 'vitest';
import { rebindLinkEndpoints, rebindLinksAfterNodeUpdate } from './graphLinkBinding';

describe('graph link binding', () => {
  const simulatedGraph = () => {
    const companyNode = { id: 'company-a', x: 10, y: 10 };
    const officerNode = { id: 'officer-b', x: 40, y: 40 };
    return {
      nodes: [companyNode, officerNode],
      links: [{ id: 'a-b', source: companyNode, target: officerNode }],
    };
  };

  it('returns the same array when no endpoint is stale', () => {
    const links = [{ id: 'a-b', source: 'company-a', target: 'officer-b' }];
    expect(rebindLinkEndpoints(links, ['company-a'])).toBe(links);
    expect(rebindLinkEndpoints(links, [])).toBe(links);
  });

  it('rebinds only the endpoints of replaced nodes', () => {
    const { nodes, links } = simulatedGraph();
    const rebound = rebindLinkEndpoints(links, ['company-a']);

    expect(rebound).not.toBe(links);
    expect(rebound[0].source).toBe('company-a');
    expect(rebound[0].target).toBe(nodes[1]);
    expect(rebound[0].id).toBe('a-b');
  });

  it('leaves untouched links identical', () => {
    const { nodes } = simulatedGraph();
    const unrelated = { id: 'c-d', source: { id: 'company-c' }, target: { id: 'officer-d' } };
    const links = [{ id: 'a-b', source: nodes[0], target: nodes[1] }, unrelated];

    expect(rebindLinkEndpoints(links, ['company-a'])[1]).toBe(unrelated);
  });

  it('detects replaced nodes by identity after a map update', () => {
    const { nodes, links } = simulatedGraph();
    const nextNodes = nodes.map(node => (
      node.id === 'officer-b' ? { ...node, isDissolved: true } : node
    ));
    const rebound = rebindLinksAfterNodeUpdate(links, nodes, nextNodes);

    expect(rebound[0].source).toBe(nodes[0]);
    expect(rebound[0].target).toBe('officer-b');
  });

  it('is a no-op when a map update replaced nothing', () => {
    const { nodes, links } = simulatedGraph();
    expect(rebindLinksAfterNodeUpdate(links, nodes, nodes.map(node => node))).toBe(links);
  });
});
