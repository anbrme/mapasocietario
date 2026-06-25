import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

let capturedData = null;
let capturedNodeColor = null;
vi.mock('react-force-graph-2d', () => ({
  default: (props) => {
    capturedData = props.graphData;
    capturedNodeColor = props.nodeColor;
    return null;
  },
}));

import CompanyGraph from '../../src/panel/components/CompanyGraph.jsx';

describe('CompanyGraph', () => {
  it('passes built nodes/links to ForceGraph2D', () => {
    const company = {
      groupKey: 'H:M-1', name: 'ACME SA',
      officersActive: [{ name: 'JANE DOE', position: 'Consejero', appointedDate: '2020-01-01' }],
      officersResigned: [],
    };
    render(<CompanyGraph company={company} locale="en" />);
    expect(capturedData.nodes.find((n) => n.type === 'company').label).toBe('ACME SA');
    expect(capturedData.links.length).toBe(1);
    expect(capturedData.links[0].status).toBe('active');
  });

  it('officer node has status active', () => {
    const company = {
      groupKey: 'H:M-1', name: 'ACME SA',
      officersActive: [{ name: 'JANE DOE', position: 'Consejero', appointedDate: '2020-01-01' }],
      officersResigned: [],
    };
    render(<CompanyGraph company={company} locale="en" />);
    const officer = capturedData.nodes.find((n) => n.type === 'officer');
    expect(officer.status).toBe('active');
  });

  it('nodeColor returns navy for company node', () => {
    const company = {
      groupKey: 'H:M-1', name: 'ACME SA',
      officersActive: [{ name: 'JANE DOE', position: 'Consejero', appointedDate: '2020-01-01' }],
      officersResigned: [],
    };
    render(<CompanyGraph company={company} locale="en" />);
    const companyNode = capturedData.nodes.find((n) => n.type === 'company');
    expect(capturedNodeColor(companyNode)).toBe('#1a5fb4');
  });

  it('nodeColor returns green for active officer node', () => {
    const company = {
      groupKey: 'H:M-1', name: 'ACME SA',
      officersActive: [{ name: 'JANE DOE', position: 'Consejero', appointedDate: '2020-01-01' }],
      officersResigned: [],
    };
    render(<CompanyGraph company={company} locale="en" />);
    const activeOfficer = capturedData.nodes.find((n) => n.type === 'officer' && n.status === 'active');
    expect(capturedNodeColor(activeOfficer)).toBe('#2ca02c');
  });

  it('nodeColor returns grey for ceased officer node', () => {
    const company = {
      groupKey: 'H:M-1', name: 'ACME SA',
      officersActive: [],
      officersResigned: [{ name: 'OLD BOSS', position: 'Administrador', resignedDate: '2019-01-01' }],
    };
    render(<CompanyGraph company={company} locale="en" />);
    const ceasedOfficer = capturedData.nodes.find((n) => n.type === 'officer' && n.status === 'ceased');
    expect(capturedNodeColor(ceasedOfficer)).toBe('#bbbbbb');
  });
});
