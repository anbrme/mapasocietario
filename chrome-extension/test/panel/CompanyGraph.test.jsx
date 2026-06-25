import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

let captured = null;
vi.mock('react-force-graph-2d', () => ({
  default: (props) => { captured = props.graphData; return null; },
}));

import CompanyGraph from '../../src/panel/components/CompanyGraph.jsx';

describe('CompanyGraph', () => {
  it('passes built nodes/links to ForceGraph2D', () => {
    const company = {
      groupKey: 'H:M-1', name: 'ACME SA',
      officersActive: [{ name: 'JANE DOE', position: 'Consejero' }],
      officersResigned: [],
    };
    render(<CompanyGraph company={company} />);
    expect(captured.nodes.find((n) => n.type === 'company').label).toBe('ACME SA');
    expect(captured.links.length).toBe(1);
    expect(captured.links[0].status).toBe('active');
  });
});
