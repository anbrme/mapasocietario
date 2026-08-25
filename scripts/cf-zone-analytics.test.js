import { describe, expect, it } from 'vitest';
import {
  browserMapToRows,
  buildCountryComparison,
  countryMapToRows,
  ga4CountryToRows,
} from '../workers/analytics/src/cloudflare-edge.js';

// Cloudflare's httpRequests1dGroups shape, trimmed to what we read.
const cfGroups = [
  {
    sum: {
      countryMap: [
        { clientCountryName: 'ES', requests: 41000, threats: 12 },
        { clientCountryName: 'SG', requests: 9000, threats: 0 },
        { clientCountryName: 'CN', requests: 300, threats: 2 },
      ],
    },
    uniq: { uniques: 900 },
  },
  {
    sum: {
      countryMap: [
        { clientCountryName: 'ES', requests: 9000, threats: 3 },
        { clientCountryName: 'US', requests: 1500, threats: 0 },
      ],
    },
    uniq: { uniques: 400 },
  },
];

describe('countryMapToRows', () => {
  it('sums each country across the daily groups', () => {
    const rows = countryMapToRows(cfGroups);

    expect(rows.find((r) => r.country === 'ES')).toMatchObject({ requests: 50000, threats: 15 });
    expect(rows.find((r) => r.country === 'US')).toMatchObject({ requests: 1500, threats: 0 });
  });

  it('orders by requests so the largest source leads', () => {
    expect(countryMapToRows(cfGroups)[0].country).toBe('ES');
  });

  it('survives a window Cloudflare returned nothing for', () => {
    expect(countryMapToRows([])).toEqual([]);
    expect(countryMapToRows(null)).toEqual([]);
  });
});

describe('ga4CountryToRows', () => {
  it('maps GA4 country names onto the ISO codes Cloudflare reports', () => {
    const rows = ga4CountryToRows([
      { country: 'Spain', sessions: 115, totalUsers: 54 },
      { country: 'China', sessions: 28, totalUsers: 28 },
      { country: 'Elbonia', sessions: 3, totalUsers: 3 },
    ]);

    expect(rows.find((r) => r.code === 'ES')).toMatchObject({ sessions: 115, users: 54 });
    expect(rows.find((r) => r.code === 'CN')).toMatchObject({ sessions: 28 });
    // An unmapped country must be kept and flagged, never silently dropped.
    expect(rows.find((r) => r.name === 'Elbonia')).toMatchObject({ code: null });
  });
});

describe('buildCountryComparison', () => {
  it('pairs Cloudflare requests against GA4 sessions per country', () => {
    const comparison = buildCountryComparison(
      countryMapToRows(cfGroups),
      ga4CountryToRows([
        { country: 'Spain', sessions: 115, totalUsers: 54 },
        { country: 'China', sessions: 28, totalUsers: 28 },
      ]),
    );

    const es = comparison.find((r) => r.country === 'ES');
    expect(es.requests).toBe(50000);
    expect(es.sessions).toBe(115);
    expect(es.requestsPerSession).toBeCloseTo(50000 / 115, 5);
  });

  it('keeps countries Cloudflare saw but GA4 never recorded — that gap is the finding', () => {
    const comparison = buildCountryComparison(
      countryMapToRows(cfGroups),
      ga4CountryToRows([{ country: 'Spain', sessions: 115, totalUsers: 54 }]),
    );

    const sg = comparison.find((r) => r.country === 'SG');
    expect(sg.requests).toBe(9000);
    expect(sg.sessions).toBe(0);
    // No GA4 sessions at all means the ratio is undefined, not Infinity.
    expect(sg.requestsPerSession).toBeNull();
    expect(sg.ga4Missing).toBe(true);
  });

  it('keeps countries GA4 recorded but Cloudflare did not — the opposite gap', () => {
    const comparison = buildCountryComparison(
      [{ country: 'ES', requests: 100, threats: 0 }],
      ga4CountryToRows([{ country: 'Japan', sessions: 1, totalUsers: 1 }]),
    );

    expect(comparison.find((r) => r.country === 'JP')).toMatchObject({ requests: 0, sessions: 1 });
  });
});

// Cloudflare's browserMap shape. It only reports families it recognises, so
// the rows never sum to the zone's pageViews total — and that residual is the
// point: it is the traffic that did not identify itself as a known browser.
const cfBrowserGroups = [
  { sum: { pageViews: 30000, browserMap: [
    { uaBrowserFamily: 'Chrome', pageViews: 900 },
    { uaBrowserFamily: 'Safari', pageViews: 300 },
  ] } },
  { sum: { pageViews: 22518, browserMap: [
    { uaBrowserFamily: 'Chrome', pageViews: 600 },
    { uaBrowserFamily: 'Firefox', pageViews: 100 },
  ] } },
];

describe('browserMapToRows', () => {
  it('sums each browser family across days, largest first', () => {
    const { rows } = browserMapToRows(cfBrowserGroups);

    expect(rows[0]).toMatchObject({ browser: 'Chrome', pageViews: 1500 });
    expect(rows.find((r) => r.browser === 'Firefox').pageViews).toBe(100);
  });

  it('reports the unidentified residual rather than letting it vanish', () => {
    const { identified, totalPageViews, unidentified } = browserMapToRows(cfBrowserGroups);

    expect(totalPageViews).toBe(52518);
    expect(identified).toBe(1900);
    // 52,518 page views, 1,900 from a named browser: the rest never said what
    // it was. Reporting only the named rows would hide 96% of the traffic.
    expect(unidentified).toBe(50618);
  });

  it('handles a zone with no browser data at all', () => {
    expect(browserMapToRows([])).toMatchObject({ rows: [], identified: 0, unidentified: 0 });
    expect(browserMapToRows(null)).toMatchObject({ rows: [] });
  });

  it('never reports a negative residual if the map overcounts', () => {
    const odd = [{ sum: { pageViews: 10, browserMap: [{ uaBrowserFamily: 'Chrome', pageViews: 50 }] } }];
    expect(browserMapToRows(odd).unidentified).toBe(0);
  });
});
