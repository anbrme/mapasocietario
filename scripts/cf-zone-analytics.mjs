#!/usr/bin/env node
/**
 * Cloudflare zone analytics for mapasocietario.es, set against the GA4 weekly
 * report for the same window.
 *
 * The weekly report carries its own caveat — "GA4 is not the raw traffic
 * source; compare with Cloudflare raw traffic before diagnosing bots" — and
 * until now nobody could act on it. GA4 only ever sees requests that executed
 * JavaScript and were not filtered; Cloudflare sees every request that reached
 * the edge. The gap between them is the measurement this prints.
 *
 * Usage:
 *   set -a && . ./.env.analytics.local && set +a
 *   node scripts/cf-zone-analytics.mjs [--days 7] [--json]
 *
 * Needs CLOUDFLARE_ANALYTICS_TOKEN (Account Analytics: Read + Zone Analytics:
 * Read). Reads ANALYTICS_REPORT_TOKEN too, to pull the GA4 side for comparison.
 */

import {
  browserMapToRows,
  buildCountryComparison,
  countryMapToRows,
  fetchEdgeTraffic,
  ga4CountryToRows,
} from '../workers/analytics/src/cloudflare-edge.js';

const ZONE_NAME = process.env.CF_ZONE_NAME || 'mapasocietario.es';
const WORKER_URL =
  process.env.ANALYTICS_WORKER_URL ||
  'https://mapasocietario-analytics.anurnberg.workers.dev';

/* -------------------------------------------------------------- runtime */

async function fetchGa4Report() {
  const token = process.env.ANALYTICS_REPORT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${WORKER_URL}/latest?token=${token}&format=json`);
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

const fmt = (n) => Number(n || 0).toLocaleString('en-US');

async function main() {
  const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN;
  if (!token) {
    console.error(
      'CLOUDFLARE_ANALYTICS_TOKEN is not set.\n' +
        'Create a token with Account Analytics: Read and Zone Analytics: Read,\n' +
        'add it to .env.analytics.local, then:\n' +
        '  set -a && . ./.env.analytics.local && set +a && node scripts/cf-zone-analytics.mjs',
    );
    process.exit(1);
  }

  const ga4 = await fetchGa4Report();
  const daysArg = process.argv.indexOf('--days');
  const days = daysArg > -1 ? Number(process.argv[daysArg + 1]) || 7 : 7;

  // Default to the exact window the GA4 report covers, so the two are
  // comparable without anyone having to align dates by hand.
  const until = ga4?.period?.current?.end || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const since =
    ga4?.period?.current?.start ||
    new Date(Date.parse(until) - (days - 1) * 86400000).toISOString().slice(0, 10);

  const edge = await fetchEdgeTraffic({ token, zoneName: ZONE_NAME, since, until });
  if (!edge.available) {
    console.error(`failed: ${edge.error || edge.reason}`);
    process.exit(1);
  }
  const { totals, countries: cfRows } = edge;

  const comparison = buildCountryComparison(cfRows, ga4CountryToRows(ga4?.countries));

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ zone: ZONE_NAME, since, until, totals, comparison }, null, 2));
    return;
  }

  console.log(`\nCloudflare zone traffic — ${ZONE_NAME} — ${since} to ${until}`);
  console.log(`  requests ${fmt(totals.requests)} · page views ${fmt(totals.pageViews)} · threats ${fmt(totals.threats)} · uniques ${fmt(totals.uniques)}`);
  if (ga4) {
    console.log(`  GA4 for the same window: ${fmt(ga4.totals?.current?.sessions)} sessions, ${fmt(ga4.totals?.current?.totalUsers)} users, ${fmt(ga4.totals?.current?.screenPageViews)} page views`);
    console.log('\n  GA4 counts only requests that ran JavaScript and were not filtered.');
    console.log('  Cloudflare counts everything that reached the edge. A country with many');
    console.log('  requests and no GA4 sessions is automation, not an audience. Compare each');
    console.log('  ratio against the one for your real audience, not against zero.\n');
  }

  // countryMap reports REQUESTS (every hit: HTML, assets, API), not page
  // views. The zone-level pageViews total above counts HTML documents only.
  console.log('  Country    CF requests    CF threats    GA4 sessions    Requests/session');
  for (const row of comparison.slice(0, 15)) {
    const ratio = row.requestsPerSession === null ? 'no GA4 data' : row.requestsPerSession.toFixed(1);
    console.log(
      `  ${String(row.country).padEnd(9)} ${fmt(row.requests).padStart(13)} ${fmt(row.threats).padStart(13)} ${fmt(row.sessions).padStart(15)} ${ratio.padStart(19)}`,
    );
  }
  const browsers = edge.browsers;
  if (browsers.totalPageViews) {
    const share = (n) => `${((n / browsers.totalPageViews) * 100).toFixed(1)}%`;
    console.log('\n  Page views by user agent');
    for (const row of browsers.rows.slice(0, 8)) {
      console.log(`  ${row.browser.padEnd(22)} ${fmt(row.pageViews).padStart(10)}  ${share(row.pageViews).padStart(7)}`);
    }
    if (browsers.unidentified > 0) {
      console.log(`  ${'(unmapped)'.padEnd(22)} ${fmt(browsers.unidentified).padStart(10)}  ${share(browsers.unidentified).padStart(7)}`);
    }
    console.log('\n  "Unknown" is Cloudflare\'s bucket for agents that claim no browser —');
    console.log('  scrapers, API clients and headless tools. Named-bot rows are read from the');
    console.log('  user-agent string, which is trivially spoofed, so treat GoogleBot as a');
    console.log('  claim rather than a verified identity.');
  }

  console.log('');
}

// Only run when invoked directly; the pure helpers above are unit tested.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`failed: ${error.message}`);
    process.exit(1);
  });
}
