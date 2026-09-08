import { describe, it, expect } from 'vitest';
import { buildTimeline, renderTimelineSvg } from './timeline.js';

const NOW = Date.parse('2026-09-09T00:00:00Z');
const events = [
  { event_date: '2013-10-16', event_types: [{ category: 'lifecycle', type: 'Constitución' }] },
  { event_date: '2014-03-27', has_address_change: true, event_types: [] },
];
const history = [
  { created_at: '2026-09-08T21:37:16Z', summary: 'Aceptada por el representante' },
];

describe('buildTimeline', () => {
  it('puts both sources on one ordered axis', () => {
    const m = buildTimeline({ events, history, acceptedAt: '2026-09-08T21:37:16Z', nowMs: NOW });
    expect(m.points.map((p) => p.lane)).toEqual(['registry', 'registry', 'attestation']);
    expect(m.points[0].x).toBe(0);
    expect(m.points.every((p) => p.x >= 0 && p.x <= 1)).toBe(true);
  });

  it('always extends to today, so a stale gap is visible', () => {
    // Without this a years-old attestation would sit flush against the right
    // edge and read as current.
    const m = buildTimeline({ events, history: [], acceptedAt: null, nowMs: NOW });
    expect(m.max).toBe(NOW);
    expect(m.points[m.points.length - 1].x).toBeLessThan(1);
  });

  it('names an event from its types, and falls back to its flags', () => {
    const m = buildTimeline({ events, history: [], nowMs: NOW });
    expect(m.points[0].label).toBe('Constitución');
    expect(m.points[1].label).toBe('Cambio de domicilio');
  });

  it('drops undated rows rather than placing them at the epoch', () => {
    const m = buildTimeline({ events: [...events, { event_date: null }], history, nowMs: NOW });
    expect(m.points).toHaveLength(3);
  });

  it('is empty, not broken, with no data at all', () => {
    expect(buildTimeline({ events: [], history: [], nowMs: NOW }).points).toEqual([]);
  });
});

describe('renderTimelineSvg', () => {
  it('draws both lanes and one mark per point', () => {
    const svg = renderTimelineSvg(buildTimeline({ events, history, nowMs: NOW }), 'es');
    expect(svg).toContain('Registro (BORME)');
    expect(svg).toContain('Declaraciones');
    expect((svg.match(/<circle /g) || []).length).toBe(2);
    expect((svg.match(/<rect /g) || []).length).toBe(1);
  });

  it('uses currentColor so it works in light and dark without a second palette', () => {
    const svg = renderTimelineSvg(buildTimeline({ events, history, nowMs: NOW }));
    expect(svg).toContain('currentColor');
    expect(svg).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it('marks the acceptance moment across both lanes', () => {
    const svg = renderTimelineSvg(
      buildTimeline({ events, history, acceptedAt: '2026-09-08T21:37:16Z', nowMs: NOW }));
    expect(svg).toContain('stroke-dasharray');
  });

  it('escapes labels rather than trusting them', () => {
    const svg = renderTimelineSvg(buildTimeline({
      events: [{ event_date: '2020-01-01', event_types: [{ type: '<script>x</script>' }] }],
      history: [], nowMs: NOW }));
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('says so plainly when there is nothing to draw', () => {
    expect(renderTimelineSvg(buildTimeline({ events: [], history: [], nowMs: NOW }), 'en'))
      .toContain('No timeline data');
  });
});
