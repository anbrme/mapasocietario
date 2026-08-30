/**
 * Search Console — the third source, alongside GA4 and the Cloudflare edge.
 *
 * It is the only one of the three that survives a broken tag: /empresa sent
 * zero GA4 data for six days in August 2026 (a `\/` in a template literal broke
 * the inline snippet) while GSC recorded the whole ramp regardless. When the
 * three disagree, this is the arbiter for anything search-related.
 *
 * TWO THINGS TO KNOW about the numbers here:
 *  - GSC lags two to three days, and the lag is not a clean edge: it BEGINS
 *    reporting a day long before it has finished writing it. `dataState: 'all'`
 *    returns those part-written days, which is why every daily email understated
 *    its own headline day (measured 2026-08-30: Aug 27 67 -> 80 clicks,
 *    Aug 28 56 -> 65, Aug 29 15 -> 24). The headline therefore comes from
 *    `dataState: 'final'` — settled and safe to compare — while the fresher
 *    part-written days are reported separately as provisional floors that can
 *    only grow. Never present a lagging or provisional figure as a collapse.
 *  - `position` is an impression-weighted average. Summing or averaging it
 *    across rows without weighting silently invents a number, so the weighting
 *    is done here, once.
 */

const API = 'https://searchconsole.googleapis.com/webmasters/v3';
export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

async function query(token, siteUrl, body) {
  const res = await fetch(`${API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ rowLimit: 25000, dataState: 'all', ...body }),
  });
  if (!res.ok) {
    throw new Error(`search console ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()).rows || [];
}

const EMPRESA_FILTER = [{
  dimension: 'page', operator: 'contains', expression: '/empresa/',
}];

/** Impression-weighted average position. Plain averaging would over-weight
 *  rows nobody saw. Returns null rather than 0 for an empty set — zero is a
 *  real position value and would read as "ranking first". */
export function weightedPosition(rows) {
  const impressions = rows.reduce((n, r) => n + (r.impressions || 0), 0);
  if (!impressions) return null;
  return rows.reduce((n, r) => n + (r.position || 0) * (r.impressions || 0), 0) / impressions;
}

export function totalsOf(rows) {
  const clicks = rows.reduce((n, r) => n + (r.clicks || 0), 0);
  const impressions = rows.reduce((n, r) => n + (r.impressions || 0), 0);
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: weightedPosition(rows),
  };
}

/** The most recent date that actually has data, given the 2-3 day lag. */
export function latestDateWithData(dailyRows) {
  const dated = dailyRows.filter((r) => (r.impressions || 0) > 0).map((r) => r.keys[0]);
  return dated.length ? dated.sort().at(-1) : null;
}

function slugOf(page) {
  const m = /\/empresa\/([^/?#]+)/.exec(page || '');
  return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

/**
 * The running title/description A/B test, read straight from GSC.
 *
 * `armOf` is injected rather than imported so this module stays pure and the
 * caller decides which experiment is being measured. It returns 'variant',
 * 'control', or anything else for a page outside the experiment. Comparing raw CTR
 * between the arms is only fair because both were drawn from the same
 * population — see functions/empresa/_seo_experiment.js. Position is reported
 * alongside deliberately: a CTR win that came with a position LOSS is not a
 * win, it is the exact-match ranking being traded away.
 */
export function splitByArm(pageRows, armOf) {
  const arms = { variant: [], control: [] };
  for (const row of pageRows) {
    const slug = slugOf(row.keys[0]);
    if (!slug) continue;
    const arm = armOf(slug);
    // A page that was never enrolled belongs to NEITHER arm. Bucketing it as
    // control would compare the 208 enrolled variant pages against ~1,500
    // pages of long tail with a different position and query mix, which is the
    // precise confound the split was designed to remove.
    if (arm !== 'variant' && arm !== 'control') continue;
    arms[arm].push(row);
  }
  return {
    variant: { pages: arms.variant.length, ...totalsOf(arms.variant) },
    control: { pages: arms.control.length, ...totalsOf(arms.control) },
  };
}

/**
 * Pages worth working on: ranking where a human can see them but not earning
 * the click. Sorted by impressions, because that is the size of the prize.
 */
export function strikingDistance(pageRows, { minImpressions = 20, maxCtr = 0.02 } = {}) {
  return pageRows
    .filter((r) => r.position >= 3 && r.position <= 12
      && r.impressions >= minImpressions && r.ctr <= maxCtr)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 12)
    .map((r) => ({
      page: r.keys[0].replace(/^https?:\/\/[^/]+/, ''),
      clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
    }));
}

/**
 * One day's search performance plus the trailing-window context a single day
 * cannot carry on its own.
 *
 * `day` / `priorDay` are the headline comparison — same weekday a week apart,
 * NOT consecutive days, because B2B search traffic has a weekday shape strong
 * enough to swamp any real change (a Monday-vs-Sunday delta says nothing).
 */
export async function fetchSearchConsole(token, siteUrl, { window, priorWindow, armOf }) {
  // Two views of the same days. `final` is what Google will stand behind;
  // `all` additionally carries the days it has started but not finished. The
  // difference between them is the backfill still in flight.
  const [settledDaily, daily] = await Promise.all([
    query(token, siteUrl, {
      startDate: priorWindow.start, endDate: window.end, dimensions: ['date'],
      dataState: 'final',
    }),
    query(token, siteUrl, {
      startDate: priorWindow.start, endDate: window.end, dimensions: ['date'],
    }),
  ]);
  const latest = latestDateWithData(settledDaily);
  if (!latest) {
    return { available: false, reason: 'no settled rows in the requested window', site: siteUrl };
  }
  // Same weekday, one week back — the only honest single-day comparison.
  const priorDate = new Date(`${latest}T00:00:00Z`);
  priorDate.setUTCDate(priorDate.getUTCDate() - 7);
  const prior = priorDate.toISOString().slice(0, 10);

  const byDate = new Map(settledDaily.map((r) => [r.keys[0], r]));
  const provisionalRows = daily
    .filter((r) => r.keys[0] > latest && r.keys[0] <= window.end)
    .sort((a, b) => a.keys[0].localeCompare(b.keys[0]));
  const dayRow = byDate.get(latest);
  const priorRow = byDate.get(prior);

  const [empresaDaily, queries, pages] = await Promise.all([
    query(token, siteUrl, {
      startDate: priorWindow.start, endDate: window.end,
      dimensions: ['date'], dimensionFilterGroups: [{ filters: EMPRESA_FILTER }],
      dataState: 'final',
    }),
    query(token, siteUrl, {
      startDate: window.start, endDate: window.end, dimensions: ['query'], rowLimit: 200,
    }),
    query(token, siteUrl, {
      startDate: window.start, endDate: window.end,
      dimensions: ['page'], dimensionFilterGroups: [{ filters: EMPRESA_FILTER }],
    }),
  ]);
  const empresaByDate = new Map(empresaDaily.map((r) => [r.keys[0], r]));

  return {
    available: true,
    site: siteUrl,
    // Stated explicitly so a reader never mistakes the lag for a traffic drop.
    dataThrough: latest,
    comparedWith: prior,
    lagDays: Math.round((Date.parse(`${window.end}T00:00:00Z`) - Date.parse(`${latest}T00:00:00Z`)) / 86400000),
    // Days Google has begun but not finished. Floors, not totals: they can only
    // grow, so a dip here is never evidence of a dip in traffic.
    provisional: {
      through: latestDateWithData(daily),
      days: provisionalRows.map((r) => ({
        date: r.keys[0], clicks: r.clicks, impressions: r.impressions,
      })),
      clicksSoFar: provisionalRows.reduce((n, r) => n + (r.clicks || 0), 0),
      impressionsSoFar: provisionalRows.reduce((n, r) => n + (r.impressions || 0), 0),
    },
    // Both sides of every window comparison come from the same data state.
    // Holding a settled prior week against a current week whose tail is still
    // filling in understates growth by exactly the unwritten remainder.
    windowDataState: 'final',
    day: totalsOf(dayRow ? [dayRow] : []),
    priorDay: totalsOf(priorRow ? [priorRow] : []),
    empresaDay: totalsOf(empresaByDate.has(latest) ? [empresaByDate.get(latest)] : []),
    empresaPriorDay: totalsOf(empresaByDate.has(prior) ? [empresaByDate.get(prior)] : []),
    window: totalsOf(settledDaily.filter((r) => r.keys[0] >= window.start && r.keys[0] <= window.end)),
    priorWindowTotals: totalsOf(settledDaily.filter((r) => r.keys[0] < window.start)),
    // The trend keeps the fresh tail — a chart that stops three days short is
    // its own kind of lie — but every row says whether it is settled.
    trend: daily
      .filter((r) => r.keys[0] >= window.start)
      .sort((a, b) => a.keys[0].localeCompare(b.keys[0]))
      .map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions,
                     ctr: r.ctr, position: r.position, provisional: r.keys[0] > latest })),
    topQueries: queries
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 15)
      .map((r) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions,
                     ctr: r.ctr, position: r.position })),
    strikingDistance: strikingDistance(pages),
    experiment: armOf ? splitByArm(pages, armOf) : null,
  };
}
