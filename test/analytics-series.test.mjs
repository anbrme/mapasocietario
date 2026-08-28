import assert from 'node:assert/strict';
import test from 'node:test';
import { seriesQuery, seriesFromReport } from '../workers/analytics/src/index.js';

// A weekly aggregate cannot separate a UI regression from a change in who
// visited. On 2026-08-24 the inspector gained a findings block and was
// reordered findings-first; in the same week organic arrivals rose 53% and
// direct fell 44%, and company_full_profile_click fell 41%. Only a DAILY
// series, split by how the visitor entered, tells those two apart.

test('the query asks for a daily series of the named events', () => {
  const q = seriesQuery({ events: ['graph_node_click', 'company_full_profile_click'],
                          startDate: '2026-08-10', endDate: '2026-08-27' });
  assert.deepEqual(q.dateRanges, [{ startDate: '2026-08-10', endDate: '2026-08-27' }]);
  assert.deepEqual(q.dimensions.map((d) => d.name), ['date', 'eventName']);
  assert.deepEqual(q.metrics.map((m) => m.name), ['eventCount', 'totalUsers']);
  const values = q.dimensionFilter.filter.inListFilter.values;
  assert.deepEqual(values, ['graph_node_click', 'company_full_profile_click']);
});

test('an entry-source split adds the dimension without losing the date', () => {
  const q = seriesQuery({ events: ['graph_view'], startDate: '2026-08-10',
                          endDate: '2026-08-27', breakdown: 'entry_source' });
  assert.deepEqual(q.dimensions.map((d) => d.name),
    ['date', 'eventName', 'customEvent:entry_source']);
});

test('rows become one row per day per event, dates normalised', () => {
  const report = {
    dimensionHeaders: [{ name: 'date' }, { name: 'eventName' }],
    metricHeaders: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    rows: [
      { dimensionValues: [{ value: '20260823' }, { value: 'graph_node_click' }],
        metricValues: [{ value: '40' }, { value: '9' }] },
      { dimensionValues: [{ value: '20260825' }, { value: 'graph_node_click' }],
        metricValues: [{ value: '31' }, { value: '7' }] },
    ],
  };
  const out = seriesFromReport(report);
  assert.deepEqual(out, [
    { date: '2026-08-23', event: 'graph_node_click', breakdown: null, eventCount: 40, users: 9 },
    { date: '2026-08-25', event: 'graph_node_click', breakdown: null, eventCount: 31, users: 7 },
  ]);
});

test('an empty report is an empty series, never a throw', () => {
  assert.deepEqual(seriesFromReport({}), []);
  assert.deepEqual(seriesFromReport(null), []);
});
