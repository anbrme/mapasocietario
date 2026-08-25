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

const ZONE_NAME = process.env.CF_ZONE_NAME || 'mapasocietario.es';
const WORKER_URL =
  process.env.ANALYTICS_WORKER_URL ||
  'https://mapasocietario-analytics.anurnberg.workers.dev';

/**
 * GA4 reports country display names; Cloudflare reports ISO-3166 alpha-2.
 * Only the countries this property actually sees are mapped — an unmapped one
 * is kept with a null code rather than dropped, because a country appearing on
 * one side and not the other is exactly what this script exists to surface.
 */
const COUNTRY_CODES = {
  Spain: 'ES', China: 'CN', 'United States': 'US', 'United Kingdom': 'GB',
  Australia: 'AU', Greece: 'GR', Portugal: 'PT', Singapore: 'SG',
  Bulgaria: 'BG', Germany: 'DE', 'South Africa': 'ZA', Sweden: 'SE',
  France: 'FR', Italy: 'IT', Netherlands: 'NL', Belgium: 'BE',
  Ireland: 'IE', Switzerland: 'CH', Austria: 'AT', Poland: 'PL',
  Romania: 'RO', Slovenia: 'SI', Serbia: 'RS', Hungary: 'HU',
  India: 'IN', Vietnam: 'VN', Japan: 'JP', Kenya: 'KE', Morocco: 'MA',
  Canada: 'CA', Mexico: 'MX', Brazil: 'BR', Argentina: 'AR', Chile: 'CL',
  Colombia: 'CO', Peru: 'PE', Ecuador: 'EC', 'Hong Kong': 'HK',
  'South Korea': 'KR', Israel: 'IL', Turkey: 'TR', Ukraine: 'UA',
  'Russia': 'RU', Denmark: 'DK', Norway: 'NO', Finland: 'FI',
  'Czechia': 'CZ', Luxembourg: 'LU', Andorra: 'AD', Malta: 'MT',
};

export function countryMapToRows(groups) {
  const totals = new Map();
  for (const group of groups || []) {
    for (const entry of group?.sum?.countryMap || []) {
      const code = entry.clientCountryName;
      const row = totals.get(code) || { country: code, requests: 0, threats: 0 };
      row.requests += Number(entry.requests) || 0;
      row.threats += Number(entry.threats) || 0;
      totals.set(code, row);
    }
  }
  return [...totals.values()].sort((a, b) => b.requests - a.requests);
}

/**
 * Page views by user-agent family, plus the residual Cloudflare could not
 * attribute to a known browser. That residual is the actual finding: crawlers,
 * scrapers and API clients do not announce themselves as Chrome, so reporting
 * only the named rows would quietly hide most of the traffic.
 */
export function browserMapToRows(groups) {
  const totals = new Map();
  let totalPageViews = 0;
  for (const group of groups || []) {
    totalPageViews += Number(group?.sum?.pageViews) || 0;
    for (const entry of group?.sum?.browserMap || []) {
      const family = entry.uaBrowserFamily || '(unnamed)';
      totals.set(family, (totals.get(family) || 0) + (Number(entry.pageViews) || 0));
    }
  }
  const rows = [...totals.entries()]
    .map(([browser, pageViews]) => ({ browser, pageViews }))
    .sort((a, b) => b.pageViews - a.pageViews);
  const identified = rows.reduce((sum, row) => sum + row.pageViews, 0);
  return {
    rows,
    identified,
    totalPageViews,
    // Clamped: a map that overcounts must not produce a negative residual.
    unidentified: Math.max(0, totalPageViews - identified),
  };
}

export function ga4CountryToRows(countries) {
  return (countries || []).map((row) => ({
    name: row.country,
    code: COUNTRY_CODES[row.country] || null,
    sessions: Number(row.sessions) || 0,
    users: Number(row.totalUsers ?? row.users) || 0,
  }));
}

export function buildCountryComparison(cfRows, ga4Rows) {
  const byCode = new Map();
  for (const row of cfRows) {
    byCode.set(row.country, {
      country: row.country,
      requests: row.requests,
      threats: row.threats,
      sessions: 0,
      users: 0,
      ga4Missing: true,
    });
  }
  for (const row of ga4Rows) {
    const key = row.code || row.name;
    const existing = byCode.get(key) || {
      country: key,
      requests: 0,
      threats: 0,
      sessions: 0,
      users: 0,
      ga4Missing: false,
    };
    existing.sessions += row.sessions;
    existing.users += row.users;
    existing.ga4Missing = false;
    existing.ga4Name = row.name;
    byCode.set(key, existing);
  }
  return [...byCode.values()]
    .map((row) => ({
      ...row,
      // Null, not Infinity: "GA4 recorded nothing here" is a different
      // statement from "the ratio is very large", and printing ∞ invites
      // treating an absence as a measurement.
      requestsPerSession: row.sessions > 0 ? row.requests / row.sessions : null,
    }))
    .sort((a, b) => b.requests - a.requests);
}

/* -------------------------------------------------------------- runtime */

async function cfFetch(path, token) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok || body.success === false) {
    throw new Error(
      `Cloudflare API ${res.status}: ${JSON.stringify(body.errors || body).slice(0, 400)}`,
    );
  }
  return body.result;
}

async function resolveZoneId(token) {
  const zones = await cfFetch(`/zones?name=${encodeURIComponent(ZONE_NAME)}`, token);
  if (!zones?.length) {
    throw new Error(
      `zone ${ZONE_NAME} not visible to this token — it needs Zone:Read plus Zone Analytics:Read on that zone`,
    );
  }
  return zones[0].id;
}

async function fetchZoneTraffic(token, zoneId, since, until) {
  const query = `
    query ZoneTraffic($zoneTag: String!, $since: String!, $until: String!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: 30
            filter: { date_geq: $since, date_leq: $until }
            orderBy: [date_ASC]
          ) {
            dimensions { date }
            sum {
              requests
              pageViews
              threats
              countryMap { clientCountryName requests threats }
              browserMap { uaBrowserFamily pageViews }
            }
            uniq { uniques }
          }
        }
      }
    }`;

  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: { zoneTag: zoneId, since, until } }),
  });
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(`GraphQL: ${JSON.stringify(body.errors).slice(0, 400)}`);
  }
  return body.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
}

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

  const zoneId = await resolveZoneId(token);
  const groups = await fetchZoneTraffic(token, zoneId, since, until);

  const cfRows = countryMapToRows(groups);
  const totals = groups.reduce(
    (acc, g) => ({
      requests: acc.requests + (g.sum?.requests || 0),
      pageViews: acc.pageViews + (g.sum?.pageViews || 0),
      threats: acc.threats + (g.sum?.threats || 0),
      uniques: acc.uniques + (g.uniq?.uniques || 0),
    }),
    { requests: 0, pageViews: 0, threats: 0, uniques: 0 },
  );
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
  const browsers = browserMapToRows(groups);
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
