/**
 * Cloudflare zone analytics for mapasocietario.es.
 *
 * GA4 only counts requests that executed JavaScript and survived its
 * filtering; Cloudflare counts everything that reached the edge. The gap
 * between them is the measurement the report's own caveat has always
 * demanded — "GA4 is not the raw traffic source" — and could never supply.
 *
 * Shared by the Worker (so the Friday email carries it) and by
 * scripts/cf-zone-analytics.mjs (so it can be run on demand). One
 * implementation, two consumers: duplicating it is how the two drift.
 */

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

async function resolveZoneId(token, zoneName) {
  const zones = await cfFetch(`/zones?name=${encodeURIComponent(zoneName)}`, token);
  if (!zones?.length) {
    throw new Error(
      `zone ${zoneName} not visible to this token — it needs Zone:Read plus Zone Analytics:Read on that zone`,
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


export async function fetchEdgeTraffic({ token, zoneName, since, until }) {
  if (!token) {
    return {
      available: false,
      reason: 'not_configured',
      hint: 'Set the CLOUDFLARE_ANALYTICS_TOKEN secret (Account Analytics: Read, Zone Analytics: Read, Zone: Read) to include edge traffic in the report.',
    };
  }
  try {
    const zoneId = await resolveZoneId(token, zoneName);
    const groups = await fetchZoneTraffic(token, zoneId, since, until);
    const totals = groups.reduce(
      (acc, g) => ({
        requests: acc.requests + (g.sum?.requests || 0),
        pageViews: acc.pageViews + (g.sum?.pageViews || 0),
        threats: acc.threats + (g.sum?.threats || 0),
        uniques: acc.uniques + (g.uniq?.uniques || 0),
      }),
      { requests: 0, pageViews: 0, threats: 0, uniques: 0 },
    );
    return {
      available: true,
      zone: zoneName,
      since,
      until,
      totals,
      countries: countryMapToRows(groups),
      browsers: browserMapToRows(groups),
    };
  } catch (error) {
    return { available: false, error: String(error?.message || error).slice(0, 400) };
  }
}
