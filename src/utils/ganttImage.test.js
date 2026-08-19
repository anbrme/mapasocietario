import { describe, it, expect } from 'vitest';
import { layoutGanttImage, GANTT_IMAGE } from './ganttImage';
import { buildOfficerChart } from './officerTimeline';

const TODAY = new Date(2026, 7, 19);

const RECORDS = [
  { company_name: 'NURNBERG CONSULTING SL', specific_role: 'ADM. UNICO', date: '2013-10-16', event_type: 'Nombramientos' },
  { company_name: 'NURNBERG CONSULTING & PARTNERS SL', specific_role: 'ADM. SOLID.', date: '2010-02-19', event_type: 'Nombramientos' },
  { company_name: 'NURNBERG CONSULTING & PARTNERS SL', specific_role: 'ADM. SOLID.', date: '2010-10-25', event_type: 'Ceses/Dimisiones' },
  { company_name: 'NURNBERG CONSULTING & PARTNERS SL', specific_role: 'LIQUIDADOR', date: '2010-10-25', event_type: 'Nombramientos' },
];

const chartOf = (records = RECORDS) => buildOfficerChart(records, { today: TODAY });

describe('layoutGanttImage', () => {
  it('returns null when there is nothing to draw', () => {
    expect(layoutGanttImage(chartOf([]), { title: 'X' })).toBeNull();
  });

  it('grows the canvas with the number of rows, not the number of acts', () => {
    const oneRow = layoutGanttImage(chartOf([RECORDS[0]]), { title: 'X' });
    const threeRows = layoutGanttImage(chartOf(), { title: 'X' });
    expect(threeRows.rows).toHaveLength(3);
    expect(threeRows.height).toBe(oneRow.height + 2 * GANTT_IMAGE.rowHeight);
  });

  it('keeps every bar inside the plot area', () => {
    const layout = layoutGanttImage(chartOf(), { title: 'X' });
    const bars = layout.rows.flatMap(row => row.bars);
    expect(bars.length).toBeGreaterThan(0);
    bars.forEach(bar => {
      expect(bar.x).toBeGreaterThanOrEqual(layout.plotX);
      expect(bar.x + bar.width).toBeLessThanOrEqual(layout.plotX + layout.plotWidth + 0.01);
      expect(bar.width).toBeGreaterThan(0);
    });
  });

  it('runs an open-ended term up to the today marker', () => {
    // The live ADM. UNICO seat has no cessation; its bar must reach "today"
    // rather than stopping at its appointment date.
    const layout = layoutGanttImage(chartOf(), { title: 'X' });
    const activeBar = layout.rows
      .flatMap(row => row.bars)
      .find(bar => bar.isActive);
    expect(activeBar.x + activeBar.width).toBeCloseTo(layout.todayX, 1);
  });

  it('draws a cessation with no known start as a marker, not a full-width bar', () => {
    const layout = layoutGanttImage(
      chartOf([{ company_name: 'ACME SL', specific_role: 'APODERADO', date: '2011-05-04', event_type: 'Ceses/Dimisiones' }]),
      { title: 'X' },
    );
    const bar = layout.rows[0].bars[0];
    expect(bar.unknownStart).toBe(true);
    expect(bar.width).toBeLessThan(layout.plotWidth / 4);
  });

  it('places a year gridline for each labelled year', () => {
    const layout = layoutGanttImage(chartOf(), { title: 'X' });
    expect(layout.gridlines.length).toBeGreaterThan(1);
    layout.gridlines.forEach(line => {
      expect(line.x).toBeGreaterThanOrEqual(layout.plotX - 0.01);
      expect(line.x).toBeLessThanOrEqual(layout.plotX + layout.plotWidth + 0.01);
      expect(String(line.label)).toMatch(/^\d{4}$/);
    });
  });

  it('carries one legend entry per distinct role', () => {
    const layout = layoutGanttImage(chartOf(), { title: 'X' });
    expect(layout.legend.map(entry => entry.label)).toEqual(
      expect.arrayContaining(['ADM. UNICO', 'ADM. SOLID.', 'LIQUIDADOR']),
    );
  });

  it('thins year labels when the range is too dense to read', () => {
    // 60 years of history at a few px per year would overlap into mush; the
    // layout drops labels rather than drawing them on top of each other.
    const dense = layoutGanttImage(
      chartOf([
        { company_name: 'ACME SL', specific_role: 'ADM. UNICO', date: '1966-01-01', event_type: 'Nombramientos' },
      ]),
      { title: 'X' },
    );
    const gaps = dense.gridlines.slice(1).map((line, i) => line.x - dense.gridlines[i].x);
    gaps.forEach(gap => expect(gap).toBeGreaterThanOrEqual(GANTT_IMAGE.minYearLabelGap));
  });

  it('records the source line so an exported chart stays attributable', () => {
    const layout = layoutGanttImage(chartOf(), { title: 'X', source: 'mapasocietario.es' });
    expect(layout.source).toBe('mapasocietario.es');
  });
});
