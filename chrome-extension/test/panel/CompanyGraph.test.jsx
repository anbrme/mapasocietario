import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

let capturedProps = null;
vi.mock('react-force-graph-2d', () => ({
  default: (props) => {
    capturedProps = props;
    return null;
  },
}));

import CompanyGraph from '../../src/panel/components/CompanyGraph.jsx';

const activeCompany = {
  groupKey: 'H:M-1', name: 'ACME SA',
  officersActive: [{ name: 'JANE DOE', position: 'Consejero', appointedDate: '2020-01-01' }],
  officersResigned: [],
};

describe('CompanyGraph', () => {
  it('passes built nodes/links to ForceGraph2D', () => {
    render(<CompanyGraph company={activeCompany} locale="en" />);
    expect(capturedProps.graphData.nodes.find((n) => n.type === 'company').label).toBe('ACME SA');
    expect(capturedProps.graphData.links.length).toBe(1);
    expect(capturedProps.graphData.links[0].status).toBe('active');
  });

  it('officer node has status active', () => {
    render(<CompanyGraph company={activeCompany} locale="en" />);
    const officer = capturedProps.graphData.nodes.find((n) => n.type === 'officer');
    expect(officer.status).toBe('active');
  });

  it('wires nodeCanvasObject and linkCanvasObject as functions', () => {
    render(<CompanyGraph company={activeCompany} locale="en" />);
    expect(typeof capturedProps.nodeCanvasObject).toBe('function');
    expect(typeof capturedProps.linkCanvasObject).toBe('function');
  });

  it('does not pass nodeColor or linkColor props (superseded by canvas renderers)', () => {
    render(<CompanyGraph company={activeCompany} locale="en" />);
    expect(capturedProps.nodeColor).toBeUndefined();
    expect(capturedProps.linkColor).toBeUndefined();
  });

  it('does not pass linkDirectionalArrowLength (custom linkCanvasObject disables built-in arrows)', () => {
    render(<CompanyGraph company={activeCompany} locale="en" />);
    expect(capturedProps.linkDirectionalArrowLength).toBeUndefined();
  });

  it('nodeCanvasObject draws company node with navy fill and label', () => {
    render(<CompanyGraph company={activeCompany} locale="en" />);
    const ctx = makeFakeCtx();
    capturedProps.nodeCanvasObject({ type: 'company', label: 'ACME SA', x: 0, y: 0 }, ctx, 1);
    expect(ctx._fills).toContain('#1a5fb4');
    expect(ctx.fillText).toHaveBeenCalledWith(expect.stringContaining('ACME'), expect.any(Number), expect.any(Number));
  });

  it('nodeCanvasObject draws officer node with green fill and name', () => {
    render(<CompanyGraph company={activeCompany} locale="en" />);
    const ctx = makeFakeCtx();
    capturedProps.nodeCanvasObject({ type: 'officer', label: 'JANE DOE', x: 0, y: 0 }, ctx, 1);
    expect(ctx._fills).toContain('#2ca02c');
    expect(ctx.fillText).toHaveBeenCalledWith('JANE DOE', expect.any(Number), expect.any(Number));
  });

  it('nodeCanvasObject truncates long company names to ~28 chars with ellipsis', () => {
    render(<CompanyGraph company={activeCompany} locale="en" />);
    const ctx = makeFakeCtx();
    capturedProps.nodeCanvasObject(
      { type: 'company', label: 'EMPRESA MUY LARGA CON NOMBRE DEMASIADO LARGO SA', x: 0, y: 0 },
      ctx, 1,
    );
    const drawn = ctx.fillText.mock.calls.map(([txt]) => txt);
    expect(drawn.some((t) => t.endsWith('…') && t.length <= 29)).toBe(true);
  });

  it('linkCanvasObject draws the canonical role label (CON.IND. → Consejero)', () => {
    render(<CompanyGraph company={activeCompany} locale="en" />);
    const ctx = makeFakeCtx();
    const link = { source: { x: 0, y: 0 }, target: { x: 10, y: 0 }, role: 'CON.IND.' };
    capturedProps.linkCanvasObject(link, ctx, 1);
    const drawn = ctx.fillText.mock.calls.map(([txt]) => txt);
    expect(drawn).toContain('Consejero');
  });
});

// ─── helpers ────────────────────────────────────────────────────────────────

function makeFakeCtx() {
  const fills = [];
  const ctx = {
    _fills: fills,
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    get fillStyle() { return this._fillStyle; },
    set fillStyle(v) { this._fillStyle = v; fills.push(v); },
    strokeStyle: '',
    font: '',
    lineWidth: 1,
    textAlign: '',
    textBaseline: '',
  };
  return ctx;
}
