/**
 * mapasocietario-analytics
 *
 * Daily analytics pull for mapasocietario.es, from three sources that measure
 * three different things and routinely disagree:
 *   GA4              - what the browser reported. Silent when a tag breaks.
 *   Cloudflare edge  - what the server saw. Includes bots, so it over-counts.
 *   Search Console   - what Google showed. Lags 2-3 days, survives a dead tag.
 * Reported side by side on purpose: in August 2026 a broken inline tag made
 * /empresa look dead in GA4 for six days while GSC recorded a 28x rise.
 *
 * Why this exists as a Worker rather than inside a scheduled Claude session:
 * neither the Cowork cloud sandbox nor the device sandbox has outbound network
 * access to googleapis.com. Cloudflare does. So the data pull lives here, the
 * result is persisted to D1, where a Claude task can read it back over HTTP
 * and write the analysis.
 *
 * Endpoints (all require ?token=<REPORT_TOKEN>):
 *   GET /discover          -> GA4 accounts + properties this service account can see
 *   GET /run               -> pull now, persist, return JSON
 *   GET /today             -> partial current-day behavior + interaction dimensions
 *   GET /series            -> daily per-event series (?events=a,b&days=28&breakdown=entry_source)
 *   GET /latest            -> most recent stored report (?format=md|json, default md)
 *   GET /health            -> config sanity check, no Google call
 *
 * Cron: pulls and persists on schedule (see wrangler.toml).
 */

import { renderReportHtml } from './report-html.js';
import { sendReportEmail } from './deliver.js';
import {
  buildCountryComparison,
  fetchEdgeTraffic,
  ga4CountryToRows,
} from './cloudflare-edge.js';
import { GSC_SCOPE, fetchSearchConsole } from './search-console.js';
// Imported from the Pages side on purpose: the experiment's arm assignment must
// have exactly one definition, or the report would measure a different split
// from the one the pages actually render.
import { seoArm } from '../../../functions/empresa/_seo_experiment.js';

const GA_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const DATA_API = 'https://analyticsdata.googleapis.com/v1beta';
const FUNNEL_DATA_API = 'https://analyticsdata.googleapis.com/v1alpha';
const ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta';

/* ------------------------------------------------------------------ auth */

function b64url(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlStr(s) {
  return b64url(new TextEncoder().encode(s));
}

function pemToPkcs8(pem) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa, scope = GA_SCOPE) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope,
    aud: sa.token_uri,
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${b64urlStr(JSON.stringify(header))}.${b64urlStr(JSON.stringify(claim))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) {
    throw new Error(`token exchange failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()).access_token;
}

function loadServiceAccount(env, keyName = 'GA_SA_KEY') {
  if (!env[keyName]) throw new Error(`${keyName} secret is not set`);
  let sa;
  try {
    sa = JSON.parse(env[keyName]);
  } catch {
    throw new Error(`${keyName} is not valid JSON — paste the whole key file`);
  }
  if (!sa.private_key || !sa.client_email) {
    throw new Error(`${keyName} is missing private_key or client_email`);
  }
  return sa;
}

/**
 * Search Console data, or an explanation of why there is none.
 *
 * Two service accounts are tolerated because the two products grant access in
 * different places: GA4 in the property's admin, Search Console in its own
 * Users and permissions screen. GSC_SA_KEY wins when set; otherwise the GA key
 * is tried, which works only if that same account was also added in Search
 * Console. Either way a failure here degrades the section, never the report:
 * GA4 and the edge numbers are worth mailing on their own.
 */
async function gatherSearchConsole(env, periodsForRun) {
  const site = env.GSC_SITE_URL;
  if (!site) {
    return { available: false, reason: 'GSC_SITE_URL is not set (URL-prefix property, e.g. https://mapasocietario.es/)' };
  }
  try {
    const sa = loadServiceAccount(env, env.GSC_SA_KEY ? 'GSC_SA_KEY' : 'GA_SA_KEY');
    const token = await getAccessToken(sa, GSC_SCOPE);
    return await fetchSearchConsole(token, site, {
      window: periodsForRun.current,
      priorWindow: periodsForRun.prior,
      armOf: seoArm,
    });
  } catch (e) {
    console.error('search console pull failed:', e.message || e);
    return { available: false, reason: String(e.message || e).slice(0, 200), site };
  }
}

/* ------------------------------------------------------------- ga4 calls */

async function runReport(token, propertyId, body) {
  const res = await fetch(`${DATA_API}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`runReport ${res.status}: ${text}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return res.json();
}

/**
 * GA4's ordered funnel endpoint is currently v1alpha. Keep it isolated from the
 * stable core-report path so an alpha API change can degrade one report section
 * without preventing the rollup from being stored.
 */
async function runFunnelReport(token, propertyId, body) {
  const res = await fetch(
    `${FUNNEL_DATA_API}/properties/${propertyId}:runFunnelReport`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const responseBody = await res.text();
    throw new Error(`runFunnelReport ${res.status}: ${responseBody}`);
  }
  return res.json();
}

/**
 * GA4 renamed `conversions` to `keyEvents`. Older properties still expect the
 * old name. Try the modern one, fall back once on a 400 that names the metric.
 */
async function runReportCompat(token, propertyId, body) {
  try {
    return await runReport(token, propertyId, body);
  } catch (e) {
    const usesKeyEvents = JSON.stringify(body).includes('keyEvents');
    if (e.status === 400 && usesKeyEvents) {
      const swapped = JSON.parse(
        JSON.stringify(body).replace(/"keyEvents"/g, '"conversions"'),
      );
      return runReport(token, propertyId, swapped);
    }
    throw e;
  }
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function rowsToObjects(report, dimNames, metNames) {
  return (report.rows || []).map((row) => {
    const out = {};
    dimNames.forEach((d, i) => {
      out[d] = row.dimensionValues?.[i]?.value ?? '';
    });
    metNames.forEach((m, i) => {
      out[m] = num(row.metricValues?.[i]?.value);
    });
    return out;
  });
}

/**
 * GA4 only populates `totals` when the request asks for metricAggregations.
 * A dimensionless request instead returns the aggregate as a single row, so
 * fall back to rows[0] — otherwise every total silently reads as zero.
 */
function totalsFrom(report, metNames) {
  const out = {};
  const vals =
    report.totals?.[0]?.metricValues || report.rows?.[0]?.metricValues || [];
  metNames.forEach((m, i) => {
    out[m] = num(vals[i]?.value);
  });
  return out;
}

/* ------------------------------------------------------------ date logic */

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Two comparable 7-day windows, both ending on a complete day.
 * current = the 7 days ending yesterday; prior = the 7 days before that.
 * GA4 data for "today" is always partial, so today is never included.
 */
/**
 * The windows a run reports on.
 *
 * `day` is the headline now that this mails daily, and `priorDay` is the SAME
 * WEEKDAY a week earlier — not the day before. B2B search and app traffic have
 * a weekday shape strong enough to swamp any real movement, so a Monday
 * compared against a Sunday reads as a collapse every single week. Comparing
 * like weekday to like weekday is the only single-day delta worth mailing.
 *
 * `current` / `prior` stay seven-day windows. A single day is too noisy at this
 * traffic to carry a report on its own, so every section below the headline is
 * trailing-week context that a one-day spike cannot distort.
 */
function periods(nowMs) {
  const day = 86400000;
  const end = new Date(nowMs - day);
  const start = new Date(end.getTime() - 6 * day);
  const priorEnd = new Date(start.getTime() - day);
  const priorStart = new Date(priorEnd.getTime() - 6 * day);
  const priorSameWeekday = new Date(end.getTime() - 7 * day);
  return {
    day: { start: isoDate(end), end: isoDate(end) },
    priorDay: { start: isoDate(priorSameWeekday), end: isoDate(priorSameWeekday) },
    current: { start: isoDate(start), end: isoDate(end) },
    prior: { start: isoDate(priorStart), end: isoDate(priorEnd) },
  };
}

/* --------------------------------------------------------------- gather */

/**
 * An explicit intent funnel, in order.
 *
 * GA4's `keyEvents` metric is not usable as a conversion count on this property:
 * a large number of `graph_*` interaction events are flagged as key events, so
 * key events routinely exceed sessions (e.g. 177 key events across 32 sessions
 * on /app). That measures engagement depth, not conversion. These named stages
 * are counted directly instead, by distinct users, so each stage is a real
 * narrowing of the previous one.
 */
const FUNNEL_STAGES = [
  { event: 'session_start', label: 'Arrived' },
  { event: 'graph_activation', label: 'Reached the graph' },
  { event: 'graph_search_typing_started', label: 'Started a search' },
  { event: 'graph_search_selection', label: 'Picked a result' },
  { event: 'graph_node_click', label: 'Explored a node' },
  { event: 'company_full_profile_click', label: 'Opened a full profile' },
  { event: 'company_profile_cta_click', label: 'Clicked a profile CTA' },
  { event: 'view_item', label: 'Viewed a paid item' },
];

const CHECKOUT_EVENTS = [
  { event: 'view_item', label: 'Viewed a paid item' },
  { event: 'begin_checkout', label: 'Submitted checkout' },
  { event: 'checkout_failed', label: 'Checkout failed before redirect' },
  { event: 'checkout_redirect', label: 'Redirected to payment/order' },
  { event: 'purchase', label: 'Purchase confirmed' },
];

const ORDERED_CHECKOUT_STAGES = CHECKOUT_EVENTS.filter(
  (stage) => stage.event !== 'checkout_failed',
);

/**
 * GA4's funnel response repeats the whole metric header block (activeUsers,
 * funnelStepCompletionRate, funnelStepAbandonments, funnelStepAbandonmentRate,
 * and then the same four again) while each row carries only ONE copy of the
 * values. Mapping the headers positionally therefore ran off the end of the row
 * on the second pass and overwrote every real metric with 0 — which is why the
 * live funnel published an all-zero conversion path while the same users were
 * plainly visible in the independent event counts. Keep the first occurrence of
 * each metric name only.
 */
function funnelRows(report) {
  const table = report?.funnelTable || {};
  const dimensions = (table.dimensionHeaders || []).map((h) => h.name);
  const metrics = [];
  for (const header of table.metricHeaders || []) {
    if (!metrics.includes(header.name)) metrics.push(header.name);
  }
  return rowsToObjects(table, dimensions, metrics);
}

/**
 * True when GA4 actually returned funnel rows. An empty funnelTable parses into
 * a perfect zero at every stage, which reads as "nobody converted" rather than
 * "the query returned nothing". A report people make decisions from must never
 * confuse the two.
 */
function funnelHasRows(report) {
  return (report?.funnelTable?.rows || []).length > 0;
}

function cleanFunnelStepName(value) {
  return String(value || '').replace(/^\d+\.\s*/, '');
}

function orderedFunnelFrom(currentReport, priorReport) {
  const index = (report) =>
    Object.fromEntries(
      funnelRows(report).map((row) => [
        cleanFunnelStepName(row.funnelStepName),
        row,
      ]),
    );
  const current = index(currentReport);
  const prior = index(priorReport);
  const firstUsers = current[ORDERED_CHECKOUT_STAGES[0].label]?.activeUsers || 0;

  return ORDERED_CHECKOUT_STAGES.map((stage) => {
    const currentRow = current[stage.label] || {};
    const priorRow = prior[stage.label] || {};
    const users = currentRow.activeUsers || 0;
    return {
      ...stage,
      users,
      priorUsers: priorRow.activeUsers || 0,
      pctOfFirst: firstUsers > 0 ? users / firstUsers : 0,
      // GA4 prefixes these with funnelStep. The unprefixed names read as
      // undefined, so every abandonment silently rendered as zero.
      completionRate: currentRow.funnelStepCompletionRate || 0,
      abandonments: currentRow.funnelStepAbandonments || 0,
      abandonmentRate: currentRow.funnelStepAbandonmentRate || 0,
    };
  });
}

async function gatherOrderedCheckout(token, propertyId, period) {
  const request = (datePeriod) =>
    runFunnelReport(token, propertyId, {
      dateRanges: [{ startDate: datePeriod.start, endDate: datePeriod.end }],
      funnel: {
        isOpenFunnel: false,
        steps: ORDERED_CHECKOUT_STAGES.map((stage) => ({
          name: stage.label,
          filterExpression: {
            funnelEventFilter: { eventName: stage.event },
          },
        })),
      },
    });

  try {
    const [current, prior] = await Promise.all([
      request(period.current),
      request(period.prior),
    ]);
    if (!funnelHasRows(current)) {
      return {
        available: false,
        apiStability: 'v1alpha',
        error:
          'funnel response contained no rows; an all-zero path is indistinguishable from zero conversion, so it is withheld rather than published',
        responseKeys: Object.keys(current || {}),
        stages: [],
      };
    }
    return {
      available: true,
      apiStability: 'v1alpha',
      sampled: Boolean(
        current.funnelTable?.metadata?.samplingMetadatas?.length ||
          prior.funnelTable?.metadata?.samplingMetadatas?.length,
      ),
      stages: orderedFunnelFrom(current, prior),
    };
  } catch (error) {
    return {
      available: false,
      apiStability: 'v1alpha',
      error: String(error.message || error).slice(0, 500),
      stages: [],
    };
  }
}

/**
 * Promise.all over a named map. The object literal creates every request
 * eagerly, so they still run concurrently — but each result stays bound to the
 * name of the query that produced it.
 */
async function namedAll(requests) {
  const names = Object.keys(requests);
  const values = await Promise.all(names.map((name) => requests[name]));
  return Object.fromEntries(names.map((name, i) => [name, values[i]]));
}

const CORE_METRICS = [
  'sessions',
  'totalUsers',
  'newUsers',
  'screenPageViews',
  'engagementRate',
  'averageSessionDuration',
  'keyEvents',
];

async function gather(env, token, propertyId, nowMs) {
  const p = periods(nowMs);
  const range = (r) => [{ startDate: r.start, endDate: r.end }];
  const met = (names) => names.map((name) => ({ name }));
  const dim = (names) => names.map((name) => ({ name }));

  // Bind the compat helper to this token without threading it everywhere.
  const call = (body) => runReportCompat(token, propertyId, body);
  const coreTotals = async (r) =>
    totalsFrom(
      await call({ dateRanges: range(r), metrics: met(CORE_METRICS) }),
      CORE_METRICS,
    );

  // Standard GA4 properties allow at most 10 concurrent Core requests. Keep
  // each wave below that ceiling; the ordered funnel has its own quota class.
  //
  // Each request is NAMED rather than positional. The previous version built
  // two arrays and destructured them by position, and entries five and six of
  // the second wave were transposed: the failure-reason probe was read as the
  // prior-week checkout totals and vice versa. That erased a real purchase from
  // the prior week, relabelled every checkout row "new", and invented seven
  // checkout failures that never happened. Naming the results makes that class
  // of defect impossible to reintroduce.
  const primaryResults = await namedAll({
    curTotals: coreTotals(p.current),
    priTotals: coreTotals(p.prior),
    dayTotals: coreTotals(p.day),
    priorDayTotals: coreTotals(p.priorDay),
    dailyRep: call({
      dateRanges: range(p.current),
      dimensions: dim(['date']),
      metrics: met(['sessions', 'totalUsers', 'keyEvents']),
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    }),
    chanCur: call({
      dateRanges: range(p.current),
      dimensions: dim(['sessionDefaultChannelGroup']),
      metrics: met(['sessions', 'totalUsers', 'engagementRate', 'keyEvents']),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 100,
    }),
    chanPri: call({
      dateRanges: range(p.prior),
      dimensions: dim(['sessionDefaultChannelGroup']),
      metrics: met(['sessions']),
      limit: 25,
    }),
    srcRep: call({
      dateRanges: range(p.current),
      dimensions: dim(['sessionSourceMedium']),
      metrics: met(['sessions', 'engagementRate']),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 15,
    }),
    pageRep: call({
      dateRanges: range(p.current),
      dimensions: dim(['pagePath']),
      metrics: met(['screenPageViews', 'totalUsers', 'userEngagementDuration']),
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 25,
    }),
    landRep: call({
      dateRanges: range(p.current),
      dimensions: dim(['landingPage']),
      metrics: met(['sessions', 'bounceRate', 'keyEvents']),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 250,
    }),
    countryRep: call({
      dateRanges: range(p.current),
      dimensions: dim(['country']),
      metrics: met(['sessions', 'totalUsers']),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 12,
    }),
    eventRep: call({
      dateRanges: range(p.current),
      dimensions: dim(['eventName']),
      metrics: met(['eventCount', 'totalUsers']),
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 25,
    }),
  });

  const secondaryResults = await namedAll({
    deviceRep: call({
      dateRanges: range(p.current),
      dimensions: dim(['deviceCategory']),
      metrics: met(['sessions', 'engagementRate']),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 5,
    }),
    // Funnel stages, current and prior, restricted to the named events.
    funnelCur: call({
      dateRanges: range(p.current),
      dimensions: dim(['eventName']),
      metrics: met(['eventCount', 'totalUsers']),
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: FUNNEL_STAGES.map((s) => s.event) },
        },
      },
      limit: 50,
    }),
    funnelPri: call({
      dateRanges: range(p.prior),
      dimensions: dim(['eventName']),
      metrics: met(['totalUsers']),
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: FUNNEL_STAGES.map((s) => s.event) },
        },
      },
      limit: 50,
    }),
    checkoutCur: call({
      dateRanges: range(p.current),
      dimensions: dim(['eventName']),
      metrics: met(['eventCount', 'totalUsers']),
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: CHECKOUT_EVENTS.map((s) => s.event) },
        },
      },
      limit: 20,
    }),
    checkoutFailureRep: call({
      dateRanges: range(p.current),
      dimensions: dim(['eventName', 'customEvent:reason']),
      metrics: met(['eventCount', 'totalUsers']),
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'checkout_failed' },
        },
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 25,
    }).catch((error) => ({
      optionalError: String(error.message || error).slice(0, 500),
    })),
    checkoutPri: call({
      dateRanges: range(p.prior),
      dimensions: dim(['eventName']),
      metrics: met(['eventCount', 'totalUsers']),
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: CHECKOUT_EVENTS.map((s) => s.event) },
        },
      },
      limit: 20,
    }),
    unassignedRep: call({
      dateRanges: range(p.current),
      dimensions: dim([
        'sessionDefaultChannelGroup',
        'sessionSourceMedium',
        'landingPage',
      ]),
      metrics: met(['sessions', 'totalUsers', 'engagementRate', 'keyEvents']),
      dimensionFilter: {
        filter: {
          fieldName: 'sessionDefaultChannelGroup',
          stringFilter: { matchType: 'EXACT', value: 'Unassigned' },
        },
      },
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 100,
    }).catch((error) => ({
      optionalError: String(error.message || error).slice(0, 500),
    })),
    orderedCheckout: gatherOrderedCheckout(token, propertyId, p),
  });

  const {
    curTotals,
    priTotals,
    dayTotals,
    priorDayTotals,
    dailyRep,
    chanCur,
    chanPri,
    srcRep,
    pageRep,
    landRep,
    countryRep,
    eventRep,
    deviceRep,
    funnelCur,
    funnelPri,
    checkoutCur,
    checkoutPri,
    checkoutFailureRep,
    unassignedRep,
    orderedCheckout,
  } = { ...primaryResults, ...secondaryResults };

  const priorByChannel = Object.fromEntries(
    rowsToObjects(chanPri, ['sessionDefaultChannelGroup'], ['sessions']).map(
      (r) => [r.sessionDefaultChannelGroup, r.sessions],
    ),
  );

  const channels = rowsToObjects(
    chanCur,
    ['sessionDefaultChannelGroup'],
    ['sessions', 'totalUsers', 'engagementRate', 'keyEvents'],
  ).map((r) => ({
    channel: r.sessionDefaultChannelGroup,
    sessions: r.sessions,
    users: r.totalUsers,
    engagementRate: r.engagementRate,
    keyEvents: r.keyEvents,
    priorSessions: priorByChannel[r.sessionDefaultChannelGroup] ?? 0,
  }));

  const pages = rowsToObjects(
    pageRep,
    ['pagePath'],
    ['screenPageViews', 'totalUsers', 'userEngagementDuration'],
  ).map((r) => ({
    path: r.pagePath,
    views: r.screenPageViews,
    users: r.totalUsers,
    avgEngagementSeconds:
      r.totalUsers > 0 ? r.userEngagementDuration / r.totalUsers : 0,
  }));

  const curByEvent = Object.fromEntries(
    rowsToObjects(funnelCur, ['eventName'], ['eventCount', 'totalUsers']).map((r) => [
      r.eventName,
      r,
    ]),
  );
  const priByEvent = Object.fromEntries(
    rowsToObjects(funnelPri, ['eventName'], ['totalUsers']).map((r) => [
      r.eventName,
      r.totalUsers,
    ]),
  );

  // Stage 1's user count is the funnel's denominator; each stage also reports
  // step-over-step retention against the stage immediately above it.
  const topUsers = curByEvent[FUNNEL_STAGES[0].event]?.totalUsers || 0;
  let previousUsers = null;
  const funnel = FUNNEL_STAGES.map((s) => {
    const users = curByEvent[s.event]?.totalUsers || 0;
    const row = {
      event: s.event,
      label: s.label,
      users,
      eventCount: curByEvent[s.event]?.eventCount || 0,
      priorUsers: priByEvent[s.event] || 0,
      pctOfTop: topUsers > 0 ? users / topUsers : 0,
      pctOfPreviousStage: previousUsers ? users / previousUsers : null,
    };
    previousUsers = users;
    return row;
  });

  const checkoutCurrent = Object.fromEntries(
    rowsToObjects(checkoutCur, ['eventName'], ['eventCount', 'totalUsers']).map(
      (row) => [row.eventName, row],
    ),
  );
  const checkoutPrior = Object.fromEntries(
    rowsToObjects(checkoutPri, ['eventName'], ['eventCount', 'totalUsers']).map(
      (row) => [row.eventName, row],
    ),
  );
  const checkoutOutcomes = CHECKOUT_EVENTS.map((stage) => {
    const current = checkoutCurrent[stage.event] || {};
    const prior = checkoutPrior[stage.event] || {};
    const eventCount = current.eventCount || 0;
    const users = current.totalUsers || 0;
    return {
      ...stage,
      eventCount,
      users,
      attemptsPerUser: users > 0 ? eventCount / users : 0,
      priorEventCount: prior.eventCount || 0,
      priorUsers: prior.totalUsers || 0,
    };
  });
  const checkoutFailureReasons = checkoutFailureRep.optionalError
    ? {
        available: false,
        error: checkoutFailureRep.optionalError,
        hint:
          'Register event parameter "reason" as an event-scoped GA4 custom dimension; registration is not retroactive.',
        rows: [],
      }
    : {
        available: true,
        rows: rowsToObjects(
          checkoutFailureRep,
          ['eventName', 'customEvent:reason'],
          ['eventCount', 'totalUsers'],
        ).map((row) => ({
          reason: row['customEvent:reason'] || '(not set)',
          eventCount: row.eventCount,
          users: row.totalUsers,
        })),
      };

  const landingPages = rowsToObjects(
    landRep,
    ['landingPage'],
    ['sessions', 'bounceRate', 'keyEvents'],
  );
  const sessionSums = {
    core: curTotals.sessions,
    daily: rowsToObjects(dailyRep, ['date'], ['sessions']).reduce(
      (sum, row) => sum + row.sessions,
      0,
    ),
    channels: channels.reduce((sum, row) => sum + row.sessions, 0),
    landingPages: landingPages.reduce((sum, row) => sum + row.sessions, 0),
  };
  const reconciled = Object.values(sessionSums).every(
    (value) => value === sessionSums.core,
  );
  const unassignedBreakdown = unassignedRep.optionalError
    ? {
        available: false,
        error: unassignedRep.optionalError,
        rows: [],
      }
    : {
        available: true,
        rows: rowsToObjects(
          unassignedRep,
          ['sessionDefaultChannelGroup', 'sessionSourceMedium', 'landingPage'],
          ['sessions', 'totalUsers', 'engagementRate', 'keyEvents'],
        ),
      };

  const report = {
    generatedAt: new Date(nowMs).toISOString(),
    propertyId,
    period: p,
    funnel,
    checkoutOutcomes,
    checkoutFailureReasons,
    orderedCheckout,
    measurementQuality: {
      sessionSums,
      reconciled,
      unassignedBreakdown,
      trafficScope:
        'GA4-filtered traffic; compare with Cloudflare raw traffic before diagnosing bots.',
    },
    totals: { current: curTotals, prior: priTotals, day: dayTotals, priorDay: priorDayTotals },
    daily: rowsToObjects(dailyRep, ['date'], ['sessions', 'totalUsers', 'keyEvents']),
    channels,
    sources: rowsToObjects(
      srcRep,
      ['sessionSourceMedium'],
      ['sessions', 'engagementRate'],
    ),
    pages,
    landingPages,
    countries: rowsToObjects(countryRep, ['country'], ['sessions', 'totalUsers']),
    events: rowsToObjects(eventRep, ['eventName'], ['eventCount', 'totalUsers']),
    devices: rowsToObjects(deviceRep, ['deviceCategory'], ['sessions', 'engagementRate']),
  };

  // The destination split, now that the dimension exists. Best-effort: an
  // unregistered dimension is a 400, and that must degrade one section rather
  // than the whole pull.
  const destinationRep = await call({
    dateRanges: range(p.current),
    dimensions: dim(['customEvent:destination']),
    metrics: met(['eventCount', 'totalUsers']),
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { matchType: 'EXACT', value: 'checkout_redirect' },
      },
    },
    limit: 20,
  }).catch((error) => ({ optionalError: String(error.message || error).slice(0, 300) }));

  report.checkoutDestinations = destinationRep.optionalError
    ? { available: false, error: destinationRep.optionalError, rows: [] }
    : {
        available: true,
        rows: rowsToObjects(destinationRep, ['customEvent:destination'], [
          'eventCount',
          'totalUsers',
        ]).map((row) => ({
          destination: row['customEvent:destination'] || '(not set)',
          eventCount: row.eventCount,
          users: row.totalUsers,
        })),
      };

  // Cloudflare edge traffic for the same window. GA4 sees only what ran
  // JavaScript; the edge sees everything. Best-effort — a missing token or a
  // Cloudflare outage degrades this one section, never the GA4 pull.
  const edge = await fetchEdgeTraffic({
    token: env?.CLOUDFLARE_ANALYTICS_TOKEN,
    zoneName: env?.CF_ZONE_NAME || 'mapasocietario.es',
    since: p.current.start,
    until: p.current.end,
  });
  if (edge.available) {
    edge.comparison = buildCountryComparison(
      edge.countries,
      ga4CountryToRows(report.countries),
    );
  }
  report.edge = edge;

  // Computed last: it reads the assembled sections against each other.
  return { ...report, warnings: reportWarnings(report) };
}

/* ------------------------------------------------------ cross-validation */

/**
 * Compare measures that come from DIFFERENT queries but must describe the same
 * fact. Every defect found in this report so far was of exactly this shape: a
 * section that was internally consistent, plausible, and wrong. A contradiction
 * that reaches the reader as a warning costs a paragraph; one that does not
 * costs a decision.
 */
function reportWarnings(r) {
  const warnings = [];

  const outcome = (event) =>
    (r.checkoutOutcomes || []).find((o) => o.event === event) || {};

  const ordered = r.orderedCheckout;
  if (ordered && ordered.available) {
    const firstStage = ordered.stages?.[0];
    const independentUsers = outcome(firstStage?.event).users || 0;
    if (firstStage && firstStage.users === 0 && independentUsers > 0) {
      warnings.push(
        `The ordered funnel reports 0 users at "${firstStage.label}" while the independent event count reports ${independentUsers}. The funnel query is wrong, not the behaviour — do not read the funnel as zero conversion.`,
      );
    }
  } else if (ordered && ordered.error) {
    warnings.push(`Ordered checkout funnel withheld: ${ordered.error}`);
  }

  const failedCount = outcome('checkout_failed').eventCount || 0;
  const reasons = r.checkoutFailureReasons;
  if (reasons?.available) {
    const reasonTotal = reasons.rows.reduce(
      (sum, row) => sum + (row.eventCount || 0),
      0,
    );
    if (reasonTotal !== failedCount) {
      warnings.push(
        `checkout_failed is counted ${failedCount} time(s) in the outcomes table but the failure-reason breakdown totals ${reasonTotal}. The two come from different queries; one of them is misattributed.`,
      );
    }
    if (reasons.rows.length && reasons.rows.every((row) => row.reason === '(not set)')) {
      warnings.push(
        'Every checkout failure reason reads "(not set)": register the "reason" event parameter as an event-scoped GA4 custom dimension. Registration is not retroactive.',
      );
    }
  }

  // checkout_redirect is three outcomes wearing one name: free_order (a waived
  // report, fulfilled server-side, which by design never emits `purchase`),
  // stripe_new_tab and stripe_same_tab. Reading redirects-without-purchases as
  // abandoned revenue is unsound until `destination` is registered as an
  // event-scoped custom dimension — this report made exactly that mistake.
  const redirects = outcome('checkout_redirect').eventCount || 0;
  const purchases = outcome('purchase').eventCount || 0;
  const destinationRows = (r.checkoutDestinations?.rows || []).filter(
    (row) => row.destination && row.destination !== '(not set)',
  );
  const paidRedirects = destinationRows
    .filter((row) => String(row.destination).startsWith('stripe_'))
    .reduce((sum, row) => sum + (row.eventCount || 0), 0);

  // How many redirects the dimension actually classified. `destination` was
  // registered mid-flight and GA4 registration is not retroactive, so one
  // window can hold both tagged and "(not set)" redirects. destinationRows
  // drops the untagged ones, which is right for reading the SPLIT and wrong for
  // reading the TOTAL: the 21-27 Aug report turned 1 free_order and 11
  // "(not set)" into "all of them were free_order" — a claim about 12 events
  // built from 1. An untagged redirect is unknown. It is never free.
  const attributed = destinationRows.reduce((sum, row) => sum + (row.eventCount || 0), 0);
  const unattributed = Math.max(0, redirects - attributed);

  if (redirects > 0 && purchases === 0) {
    if (!attributed) {
      warnings.push(
        `${redirects} checkout redirect(s) and no purchases. This is NOT evidence of lost revenue: checkout_redirect also fires for free_order, a waived report fulfilled without Stripe that never emits a purchase event. The "destination" dimension is registered but not retroactive, so this window cannot be split — future windows can.`,
      );
    } else if (paidRedirects > 0) {
      warnings.push(
        `${paidRedirects} paid checkout redirect(s) reached Stripe and NONE completed. Unlike a free_order run, this is a real conversion failure — check Stripe for abandoned sessions and whether buyers returned to /order/:sessionId, where the purchase event fires.`
        + (unattributed
          ? ` A further ${unattributed} redirect(s) carry no destination and cannot be classified either way.`
          : ''),
      );
    } else if (unattributed) {
      warnings.push(
        `${redirects} checkout redirect(s) and no purchases. Of these, ${attributed} carried a destination and none reached Stripe — but ${unattributed} carry no destination at all, and "destination" is not retroactive, so those cannot be called free or paid. Unresolved, not zero lost revenue.`,
      );
    } else {
      warnings.push(
        `${redirects} checkout redirect(s) and no purchases, but all of them were free_order — no paid checkout was started. Zero purchases is the expected outcome here, not lost revenue.`,
      );
    }
  }

  // Every terminal path in the checkout dialog fires either a redirect or a
  // failure, so submissions that produce neither did not finish anywhere the
  // instrumentation can see.
  const submissions = outcome('begin_checkout').eventCount || 0;
  const resolved = redirects + (outcome('checkout_failed').eventCount || 0);
  if (submissions > resolved) {
    warnings.push(
      `${submissions - resolved} checkout submission(s) ended in neither a redirect nor a failure. Every terminal path is instrumented, so these attempts died somewhere unmeasured — check the Android fulfilment returns and whether "platform" is registered.`,
    );
  }

  // GA4 is a sample of edge traffic, not a census. Quantify it rather than
  // leaving the reader to assume the two describe the same population.
  const edgeViews = r.edge?.totals?.pageViews || 0;
  const ga4Views = r.totals?.current?.screenPageViews || 0;
  if (edgeViews > 0 && ga4Views > 0 && edgeViews / ga4Views >= 5) {
    warnings.push(
      `Cloudflare served ${edgeViews.toLocaleString('en-US')} page views against GA4's ${ga4Views.toLocaleString('en-US')} (${Math.round(edgeViews / ga4Views)}x). GA4 counts only requests that ran JavaScript and were not filtered, so treat every figure in this report as a sample of human browser traffic, not a census of the site.`,
    );
  }

  const sums = r.measurementQuality?.sessionSums;
  if (sums && !r.measurementQuality.reconciled) {
    const off = Object.entries(sums)
      .filter(([, value]) => value !== sums.core)
      .map(([scope, value]) => `${scope} ${value}`)
      .join(', ');
    warnings.push(
      `Session totals differ by cut (core ${sums.core}; ${off}). Session-scoped dimensions split a session across values, so treat dimensioned session shares as directional and quote the core total for anything absolute.`,
    );
  }

  return warnings;
}

/* ------------------------------------------------- interaction probing */

/**
 * Node-interaction questions that raw event counts cannot answer, because the
 * distinguishing information lives in an event PARAMETER rather than the event
 * name. GA4 only exposes a parameter to the reporting API once it is registered
 * as an event-scoped custom dimension (Admin > Custom definitions), and
 * registration is NOT retroactive — so an unregistered probe here is a
 * permanent hole in history, not a transient error.
 */
const INTERACTION_PROBES = [
  {
    param: 'expand_origin',
    event: 'graph_node_expand',
    question:
      'Did the expand come from a double-click or from the context menu? Without this, graph_node_expand conflates both.',
  },
  {
    param: 'expand_result',
    event: 'graph_node_expand',
    question:
      'Was the node already expanded? Re-expanding fires the event again, so raw counts overstate discovery.',
  },
  {
    param: 'interaction_source',
    event: 'graph_context_menu_open',
    question:
      'Right-click, touch long-press, or pointer? A "touch" source is a double-tap, not a right-click.',
  },
  {
    param: 'click_action',
    event: 'graph_node_click',
    question: 'What did the single click actually do (select, select_and_inspect, ...)?',
  },
];

const INTERACTION_EVENTS = [
  'graph_node_expand',
  'graph_context_menu_open',
  'graph_node_click',
];

/**
 * A deliberately partial, aggregate view of the property-local current day.
 * This is for fast product feedback, not period comparisons or durable storage.
 * GA4 can revise intraday numbers, so every response carries that caveat.
 */
async function gatherToday(token, propertyId, nowMs = Date.now()) {
  const dateRanges = [{ startDate: 'today', endDate: 'today' }];
  const met = (names) => names.map((name) => ({ name }));
  const dim = (names) => names.map((name) => ({ name }));
  const call = (body) => runReportCompat(token, propertyId, body);

  const results = await namedAll({
    totals: call({ dateRanges, metrics: met(CORE_METRICS) }),
    channels: call({
      dateRanges,
      dimensions: dim(['sessionDefaultChannelGroup']),
      metrics: met(['sessions', 'totalUsers', 'engagementRate']),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 25,
    }),
    sources: call({
      dateRanges,
      dimensions: dim(['sessionSourceMedium']),
      metrics: met(['sessions', 'totalUsers', 'engagementRate']),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 25,
    }),
    pages: call({
      dateRanges,
      dimensions: dim(['pagePath']),
      metrics: met(['screenPageViews', 'totalUsers', 'userEngagementDuration']),
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 50,
    }),
    landingPages: call({
      dateRanges,
      dimensions: dim(['landingPage']),
      metrics: met(['sessions', 'totalUsers', 'bounceRate']),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 50,
    }),
    countries: call({
      dateRanges,
      dimensions: dim(['country']),
      metrics: met(['sessions', 'totalUsers']),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 25,
    }),
    devices: call({
      dateRanges,
      dimensions: dim(['deviceCategory']),
      metrics: met(['sessions', 'totalUsers', 'engagementRate']),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    }),
    events: call({
      dateRanges,
      dimensions: dim(['eventName']),
      metrics: met(['eventCount', 'totalUsers']),
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 100,
    }),
    funnel: call({
      dateRanges,
      dimensions: dim(['eventName']),
      metrics: met(['eventCount', 'totalUsers']),
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: [...new Set([...FUNNEL_STAGES, ...CHECKOUT_EVENTS].map((s) => s.event))],
          },
        },
      },
      limit: 50,
    }),
  });

  // Keep this as a second wave: a standard property permits ten concurrent
  // Core requests and the aggregate wave above already uses nine.
  const interactionProbes = await Promise.all(
    INTERACTION_PROBES.map(async (probe) => {
      const key = `customEvent:${probe.param}`;
      try {
        const rep = await runReport(token, propertyId, {
          dateRanges,
          dimensions: dim(['eventName', key]),
          metrics: met(['eventCount', 'totalUsers']),
          dimensionFilter: {
            filter: {
              fieldName: 'eventName',
              stringFilter: { matchType: 'EXACT', value: probe.event },
            },
          },
          limit: 25,
        });
        const breakdown = rowsToObjects(rep, ['eventName', key], [
          'eventCount',
          'totalUsers',
        ])
          .map((row) => ({
            value: row[key] || '(not set)',
            eventCount: row.eventCount,
            users: row.totalUsers,
          }))
          .sort((a, b) => b.eventCount - a.eventCount);
        const onlyNotSet =
          breakdown.length > 0 && breakdown.every((row) => row.value === '(not set)');
        return {
          ...probe,
          registered: true,
          populated: breakdown.length > 0 && !onlyNotSet,
          breakdown,
          note: onlyNotSet
            ? 'Dimension is registered but every row is "(not set)" — registration likely postdates these events, or the parameter is not being sent.'
            : undefined,
        };
      } catch (error) {
        return {
          ...probe,
          registered: false,
          error: String(error.message || error).slice(0, 400),
        };
      }
    }),
  );

  // Diagnose blank landing pages without exposing a generic GA4 query proxy.
  // Landing page is session-scoped, while eventName/pagePath are event-scoped;
  // user counts in these cuts can overlap and are evidence about composition,
  // not additive cohort totals.
  const diagnosticResults = await namedAll({
    landingContext: call({
      dateRanges,
      dimensions: dim([
        'landingPage',
        'sessionSourceMedium',
        'platformDeviceCategory',
        'country',
      ]),
      metrics: met(['sessions', 'totalUsers', 'engagementRate', 'bounceRate']),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 250,
    }).catch((error) => ({ optionalError: String(error.message || error).slice(0, 400) })),
    landingHosts: call({
      dateRanges,
      dimensions: dim(['landingPage', 'hostName', 'streamName']),
      metrics: met(['sessions', 'totalUsers']),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 100,
    }).catch((error) => ({ optionalError: String(error.message || error).slice(0, 400) })),
    landingEvents: call({
      dateRanges,
      dimensions: dim(['landingPage', 'eventName']),
      metrics: met(['eventCount', 'totalUsers']),
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 500,
    }).catch((error) => ({ optionalError: String(error.message || error).slice(0, 400) })),
    journeyByPage: call({
      dateRanges,
      dimensions: dim(['eventName', 'pagePath']),
      metrics: met(['eventCount', 'totalUsers']),
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: [
              'graph_view',
              'graph_activation',
              'graph_search_typing_started',
              'graph_search_selection',
              'graph_node_click',
              'findings_visible',
              'company_full_profile_click',
              'company_profile_cta_click',
              'view_item',
              'free_report_selected',
              'file_download',
              'begin_checkout',
              'checkout_failed',
              'checkout_redirect',
              'purchase',
            ],
          },
        },
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 250,
    }).catch((error) => ({ optionalError: String(error.message || error).slice(0, 400) })),
  });

  const optionalRows = (report, dimensions, metrics) =>
    report.optionalError
      ? { available: false, error: report.optionalError, rows: [] }
      : { available: true, rows: rowsToObjects(report, dimensions, metrics) };
  const blankLanding = (row) => row.landingPage === '' || row.landingPage === '(not set)';
  const landingContext = optionalRows(
    diagnosticResults.landingContext,
    ['landingPage', 'sessionSourceMedium', 'platformDeviceCategory', 'country'],
    ['sessions', 'totalUsers', 'engagementRate', 'bounceRate'],
  );
  const landingHosts = optionalRows(
    diagnosticResults.landingHosts,
    ['landingPage', 'hostName', 'streamName'],
    ['sessions', 'totalUsers'],
  );
  const landingEvents = optionalRows(
    diagnosticResults.landingEvents,
    ['landingPage', 'eventName'],
    ['eventCount', 'totalUsers'],
  );
  const journeyByPage = optionalRows(
    diagnosticResults.journeyByPage,
    ['eventName', 'pagePath'],
    ['eventCount', 'totalUsers'],
  );

  const rawFunnel = rowsToObjects(results.funnel, ['eventName'], [
    'eventCount',
    'totalUsers',
  ]);
  const funnelIndex = Object.fromEntries(rawFunnel.map((row) => [row.eventName, row]));

  return {
    ok: true,
    generatedAt: new Date(nowMs).toISOString(),
    propertyId,
    window: { startDate: 'today', endDate: 'today', partial: true },
    caveat:
      'GA4 current-day data is partial and can be revised. Counts are aggregate; they do not identify individual users or reconstruct exact per-user paths.',
    totals: totalsFrom(results.totals, CORE_METRICS),
    channels: rowsToObjects(
      results.channels,
      ['sessionDefaultChannelGroup'],
      ['sessions', 'totalUsers', 'engagementRate'],
    ),
    sources: rowsToObjects(
      results.sources,
      ['sessionSourceMedium'],
      ['sessions', 'totalUsers', 'engagementRate'],
    ),
    pages: rowsToObjects(
      results.pages,
      ['pagePath'],
      ['screenPageViews', 'totalUsers', 'userEngagementDuration'],
    ),
    landingPages: rowsToObjects(
      results.landingPages,
      ['landingPage'],
      ['sessions', 'totalUsers', 'bounceRate'],
    ),
    countries: rowsToObjects(results.countries, ['country'], ['sessions', 'totalUsers']),
    devices: rowsToObjects(
      results.devices,
      ['deviceCategory'],
      ['sessions', 'totalUsers', 'engagementRate'],
    ),
    events: rowsToObjects(results.events, ['eventName'], ['eventCount', 'totalUsers']),
    funnel: [...FUNNEL_STAGES, ...CHECKOUT_EVENTS]
      .filter((stage, index, stages) => stages.findIndex((s) => s.event === stage.event) === index)
      .map((stage) => ({
        ...stage,
        eventCount: funnelIndex[stage.event]?.eventCount || 0,
        users: funnelIndex[stage.event]?.totalUsers || 0,
      })),
    interactionProbes,
    diagnostics: {
      blankLanding: {
        context: landingContext.available
          ? { available: true, rows: landingContext.rows.filter(blankLanding) }
          : landingContext,
        hosts: landingHosts.available
          ? { available: true, rows: landingHosts.rows.filter(blankLanding) }
          : landingHosts,
        events: landingEvents.available
          ? { available: true, rows: landingEvents.rows.filter(blankLanding) }
          : landingEvents,
      },
      journeyByPage,
    },
  };
}

/**
 * A DAILY series for named events, optionally split by an event parameter.
 *
 * The weekly report aggregates, and an aggregate cannot separate a UI
 * regression from a change in who visited. In the 21-27 Aug window the
 * inspector gained a findings block and a findings-first reorder on 24 Aug
 * (mapasocietario 52fac01, c7203c7) while organic arrivals rose 53% and direct
 * fell 44% — and company_full_profile_click fell 41% against graph_node_click
 * rising 58%. Only a daily series split by entry_source shows whether the drop
 * STEPS on the 24th (the UI) or DRIFTS with the traffic mix (the audience).
 *
 * `breakdown` is an event PARAMETER name (e.g. entry_source) and must already
 * be registered as a GA4 custom dimension; unregistered parameters return
 * "(not set)" and cannot be backfilled.
 */
export function seriesQuery({ events, startDate, endDate, breakdown = null }) {
  const dimensions = [{ name: 'date' }, { name: 'eventName' }];
  if (breakdown) dimensions.push({ name: `customEvent:${breakdown}` });
  return {
    dateRanges: [{ startDate, endDate }],
    dimensions,
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    dimensionFilter: {
      filter: { fieldName: 'eventName', inListFilter: { values: events } },
    },
    limit: 100000,
  };
}

/** GA4 returns dates as YYYYMMDD; everything downstream reads ISO. */
export function seriesFromReport(report) {
  const rows = (report && report.rows) || [];
  return rows.map((row) => {
    const dims = (row.dimensionValues || []).map((d) => d.value);
    const mets = (row.metricValues || []).map((m) => Number(m.value) || 0);
    const [date, event, breakdown] = dims;
    return {
      date: String(date || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
      event: event || '',
      breakdown: breakdown === undefined ? null : breakdown,
      eventCount: mets[0] || 0,
      users: mets[1] || 0,
    };
  });
}

async function handleSeries(env, url) {
  const sa = loadServiceAccount(env);
  if (!env.GA_PROPERTY_ID) throw new Error('GA_PROPERTY_ID is not set');
  const events = (url.searchParams.get('events') || '')
    .split(',').map((e) => e.trim()).filter(Boolean);
  if (!events.length) throw new Error('pass ?events=a,b (comma-separated GA4 event names)');
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '28', 10) || 28, 1), 365);
  const token = await getAccessToken(sa);
  const report = await runReport(token, env.GA_PROPERTY_ID, seriesQuery({
    events,
    startDate: `${days}daysAgo`,
    endDate: 'yesterday',
    breakdown: url.searchParams.get('breakdown') || null,
  }));
  return { events, days, series: seriesFromReport(report) };
}

async function handleInteractions(env, url) {
  const sa = loadServiceAccount(env);
  if (!env.GA_PROPERTY_ID) throw new Error('GA_PROPERTY_ID is not set');
  const token = await getAccessToken(sa);
  const propertyId = env.GA_PROPERTY_ID;

  const days = Math.min(
    Math.max(parseInt(url.searchParams.get('days') || '28', 10) || 28, 1),
    365,
  );
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'yesterday' }];

  const probes = await Promise.all(
    INTERACTION_PROBES.map(async (p) => {
      const key = `customEvent:${p.param}`;
      const base = { param: p.param, event: p.event, question: p.question };
      try {
        const rep = await runReport(token, propertyId, {
          dateRanges,
          dimensions: [{ name: 'eventName' }, { name: key }],
          metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
          dimensionFilter: {
            filter: {
              fieldName: 'eventName',
              stringFilter: { matchType: 'EXACT', value: p.event },
            },
          },
          limit: 25,
        });
        const breakdown = rowsToObjects(rep, ['eventName', key], [
          'eventCount',
          'totalUsers',
        ])
          .map((r) => ({
            value: r[key] || '(not set)',
            eventCount: r.eventCount,
            users: r.totalUsers,
          }))
          .sort((a, b) => b.eventCount - a.eventCount);

        // A registered-but-never-populated dimension returns only "(not set)".
        const onlyNotSet =
          breakdown.length > 0 &&
          breakdown.every((b) => b.value === '(not set)');

        return {
          ...base,
          registered: true,
          populated: !onlyNotSet,
          breakdown,
          note: onlyNotSet
            ? 'Dimension is registered but every row is "(not set)" — registration likely postdates this window, or the parameter is not being sent.'
            : undefined,
        };
      } catch (e) {
        return {
          ...base,
          registered: false,
          error: String(e.message || e).slice(0, 400),
          hint: `Register "${p.param}" as an EVENT-scoped custom dimension in GA4: Admin > Custom definitions > Create custom dimension, event parameter "${p.param}". Not retroactive — data before registration is unrecoverable.`,
        };
      }
    }),
  );

  // Device split matters for interpretation: on touch there is no
  // double-tap-to-expand, so mobile users cannot double-click at all. A low
  // double-click share is only meaningful against the desktop population.
  let byDevice = null;
  let deviceError = null;
  try {
    const rep = await runReport(token, propertyId, {
      dateRanges,
      dimensions: [{ name: 'eventName' }, { name: 'deviceCategory' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: INTERACTION_EVENTS },
        },
      },
      limit: 50,
    });
    byDevice = rowsToObjects(rep, ['eventName', 'deviceCategory'], [
      'eventCount',
      'totalUsers',
    ]).map((r) => ({
      event: r.eventName,
      device: r.deviceCategory,
      eventCount: r.eventCount,
      users: r.totalUsers,
    }));
  } catch (e) {
    deviceError = String(e.message || e).slice(0, 300);
  }

  const unregistered = probes.filter((p) => !p.registered).map((p) => p.param);

  return {
    ok: true,
    propertyId,
    window: { days, startDate: `${days}daysAgo`, endDate: 'yesterday' },
    probes,
    byDevice,
    deviceError,
    unregistered,
    summary: unregistered.length
      ? `${unregistered.length} of ${probes.length} dimensions are not registered (${unregistered.join(', ')}). Those questions cannot be answered for any period before you register them.`
      : 'All four dimensions are registered and queryable.',
    readingNotes: [
      'Count users, not events: re-expanding an already-expanded node fires graph_node_expand again (expand_result: already_expanded).',
      'On touch devices the second tap opens the context menu, so mobile users cannot double-click to expand. Judge double-click discovery against desktop users only.',
      'An interaction_source of "touch" is a double-tap, not a right-click.',
    ],
  };
}

async function handleDiagnose(env) {
  const sa = loadServiceAccount(env);
  if (!env.GA_PROPERTY_ID) throw new Error('GA_PROPERTY_ID is not set');
  const token = await getAccessToken(sa);
  const propertyId = env.GA_PROPERTY_ID;
  const p = periods(Date.now());
  const out = { period: p, propertyId };

  const capture = async (key, fn) => {
    try {
      out[key] = await fn();
    } catch (error) {
      out[`${key}Error`] = String(error.message || error).slice(0, 800);
    }
  };

  await capture('funnelRaw', () =>
    runFunnelReport(token, propertyId, {
      dateRanges: [{ startDate: p.current.start, endDate: p.current.end }],
      funnel: {
        isOpenFunnel: false,
        steps: ORDERED_CHECKOUT_STAGES.map((stage) => ({
          name: stage.label,
          filterExpression: { funnelEventFilter: { eventName: stage.event } },
        })),
      },
    }),
  );

  await capture('checkoutFailureRaw', () =>
    runReport(token, propertyId, {
      dateRanges: [{ startDate: p.current.start, endDate: p.current.end }],
      dimensions: [{ name: 'eventName' }, { name: 'customEvent:reason' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'checkout_failed' },
        },
      },
      limit: 25,
    }),
  );

  // Which checkout parameters are actually queryable. GA4 only exposes an
  // event parameter once it is registered as a custom dimension, and
  // registration is not retroactive — so an unregistered parameter is a
  // permanent hole in history, not a transient error. Probing them by name is
  // the only way to know what questions this property can still answer.
  const CHECKOUT_PARAMS = ['destination', 'reason', 'platform', 'free_report', 'company'];
  out.parameterAvailability = {};
  for (const param of CHECKOUT_PARAMS) {
    try {
      const rep = await runReport(token, propertyId, {
        dateRanges: [{ startDate: p.current.start, endDate: p.current.end }],
        dimensions: [{ name: 'eventName' }, { name: `customEvent:${param}` }],
        metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: { values: CHECKOUT_EVENTS.map((stage) => stage.event) },
          },
        },
        limit: 25,
      });
      out.parameterAvailability[param] = {
        registered: true,
        rows: (rep.rows || []).map((row) => ({
          event: row.dimensionValues[0].value,
          value: row.dimensionValues[1].value,
          eventCount: Number(row.metricValues[0].value),
          users: Number(row.metricValues[1].value),
        })),
      };
    } catch (error) {
      out.parameterAvailability[param] = {
        registered: false,
        error: String(error.message || error).slice(0, 160),
      };
    }
  }

  // checkout_redirect carries a `destination` parameter with three values:
  // free_order (no Stripe, no purchase event by design), stripe_new_tab and
  // stripe_same_tab. Without this split, "13 redirects, 0 purchases" cannot
  // distinguish a lost sale from a free report working exactly as intended.
  await capture('redirectByDestination', () =>
    runReport(token, propertyId, {
      dateRanges: [{ startDate: p.current.start, endDate: p.current.end }],
      dimensions: [{ name: 'eventName' }, { name: 'customEvent:destination' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'checkout_redirect' },
        },
      },
      limit: 25,
    }),
  );

  // Daily shape of the whole checkout path. Thirteen redirects spread over a
  // week reads very differently from thirteen inside one afternoon.
  await capture('checkoutByDay', () =>
    runReport(token, propertyId, {
      dateRanges: [{ startDate: p.current.start, endDate: p.current.end }],
      dimensions: [{ name: 'date' }, { name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: CHECKOUT_EVENTS.map((stage) => stage.event) },
        },
      },
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 100,
    }),
  );

  await capture('priorCheckoutRaw', () =>
    runReport(token, propertyId, {
      dateRanges: [{ startDate: p.prior.start, endDate: p.prior.end }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: CHECKOUT_EVENTS.map((stage) => stage.event) },
        },
      },
      limit: 20,
    }),
  );

  return out;
}

/* -------------------------------------------------------------- storage */

async function ensureTable(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS analytics_weekly (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         generated_at TEXT NOT NULL,
         period_start TEXT NOT NULL,
         period_end   TEXT NOT NULL,
         payload      TEXT NOT NULL
       )`,
    )
    .run();
  await db
    .prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_weekly_period
         ON analytics_weekly(period_start, period_end)`,
    )
    .run();
}

async function persist(db, report) {
  await ensureTable(db);
  await db
    .prepare(
      `INSERT INTO analytics_weekly (generated_at, period_start, period_end, payload)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(period_start, period_end)
       DO UPDATE SET generated_at = excluded.generated_at, payload = excluded.payload`,
    )
    .bind(
      report.generatedAt,
      report.period.current.start,
      report.period.current.end,
      JSON.stringify(report),
    )
    .run();
}

async function loadLatest(db) {
  await ensureTable(db);
  const row = await db
    .prepare(
      `SELECT payload FROM analytics_weekly
        ORDER BY period_end DESC, id DESC LIMIT 1`,
    )
    .first();
  return row ? JSON.parse(row.payload) : null;
}

/* ------------------------------------------------------------- markdown */

const fmt = (n, digits = 0) =>
  Number(n).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

function delta(cur, prior) {
  if (!prior) return cur ? 'new' : '0%';
  const pct = ((cur - prior) / prior) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function mdTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n');
}

/** GA4 returns the `date` dimension as YYYYMMDD; render it readably. */
function gaDate(raw) {
  const s = String(raw);
  if (!/^\d{8}$/.test(s)) return s;
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const weekday = new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  });
  return `${iso} (${weekday})`;
}

function duration(seconds) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

/**
 * Rendered server-side so the consuming Claude task receives exact numbers as
 * text rather than re-deriving them from raw JSON.
 */
function toMarkdown(r) {
  const c = r.totals.current;
  const p = r.totals.prior;
  const L = [];

  L.push(`# Daily analytics — mapasocietario.es`);
  L.push('');
  L.push(`Property: ${r.propertyId}`);
  L.push(`Current window: ${r.period.current.start} to ${r.period.current.end}`);
  L.push(`Prior window: ${r.period.prior.start} to ${r.period.prior.end}`);
  L.push(`Generated: ${r.generatedAt}`);
  L.push('');

  // Warnings lead. A contradiction discovered after the reader has already
  // formed a view has arrived too late to be useful.
  if (r.warnings?.length) {
    L.push('## Read this first');
    L.push('');
    r.warnings.forEach((w) => L.push(`- **${w}**`));
    L.push('');
  }

  L.push('## Totals vs prior week');
  L.push('');
  L.push(
    mdTable(
      ['Metric', 'This week', 'Prior week', 'Change'],
      [
        ['Sessions', fmt(c.sessions), fmt(p.sessions), delta(c.sessions, p.sessions)],
        ['Total users', fmt(c.totalUsers), fmt(p.totalUsers), delta(c.totalUsers, p.totalUsers)],
        ['New users', fmt(c.newUsers), fmt(p.newUsers), delta(c.newUsers, p.newUsers)],
        ['Page views', fmt(c.screenPageViews), fmt(p.screenPageViews), delta(c.screenPageViews, p.screenPageViews)],
        ['Engagement rate', `${(c.engagementRate * 100).toFixed(1)}%`, `${(p.engagementRate * 100).toFixed(1)}%`, delta(c.engagementRate, p.engagementRate)],
        ['Avg session', duration(c.averageSessionDuration), duration(p.averageSessionDuration), delta(c.averageSessionDuration, p.averageSessionDuration)],
        ['Key events', fmt(c.keyEvents), fmt(p.keyEvents), delta(c.keyEvents, p.keyEvents)],
      ],
    ),
  );
  L.push('');

  const quality = r.measurementQuality;
  if (quality) {
    L.push('## Measurement quality');
    L.push('');
    L.push(
      mdTable(
        ['Session scope', 'Sessions', 'Matches core total'],
        Object.entries(quality.sessionSums).map(([scope, sessions]) => [
          scope,
          fmt(sessions),
          sessions === quality.sessionSums.core ? 'yes' : 'NO',
        ]),
      ),
    );
    L.push('');
    L.push(
      quality.reconciled
        ? '_All complete session-scoped cuts reconcile to the core total._'
        : '_Warning: the session-scoped cuts do not reconcile. Resolve the query/scope mismatch before changing attribution or UTMs._',
    );
    L.push('');
    L.push(`_${quality.trafficScope}_`);
    L.push('');

    const unassigned = quality.unassignedBreakdown;
    L.push('### Unassigned traffic detail');
    L.push('');
    if (unassigned?.available && unassigned.rows.length) {
      L.push(
        mdTable(
          ['Source / medium', 'Landing page', 'Sessions', 'Users', 'Engagement', 'Key events'],
          unassigned.rows.map((row) => [
            row.sessionSourceMedium,
            row.landingPage,
            fmt(row.sessions),
            fmt(row.totalUsers),
            `${(row.engagementRate * 100).toFixed(1)}%`,
            fmt(row.keyEvents),
          ]),
        ),
      );
    } else if (unassigned?.available) {
      L.push('No Unassigned sessions in this window.');
    } else {
      L.push(`Unavailable: ${unassigned?.error || 'query failed'}`);
    }
    L.push('');
  }

  L.push('## Daily trend (current window)');
  L.push('');
  L.push(
    mdTable(
      ['Date', 'Sessions', 'Users', 'Key events'],
      r.daily.map((d) => [
        gaDate(d.date),
        fmt(d.sessions),
        fmt(d.totalUsers),
        fmt(d.keyEvents),
      ]),
    ),
  );
  L.push('');

  L.push('## Acquisition channels');
  L.push('');
  L.push(
    mdTable(
      ['Channel', 'Sessions', 'Prior', 'Change', 'Users', 'Engagement', 'Key events'],
      r.channels.map((ch) => [
        ch.channel,
        fmt(ch.sessions),
        fmt(ch.priorSessions),
        delta(ch.sessions, ch.priorSessions),
        fmt(ch.users),
        `${(ch.engagementRate * 100).toFixed(1)}%`,
        fmt(ch.keyEvents),
      ]),
    ),
  );
  L.push('');

  L.push('## Top source / medium');
  L.push('');
  L.push(
    mdTable(
      ['Source / medium', 'Sessions', 'Engagement'],
      r.sources.map((s) => [
        s.sessionSourceMedium,
        fmt(s.sessions),
        `${(s.engagementRate * 100).toFixed(1)}%`,
      ]),
    ),
  );
  L.push('');

  L.push('## Top pages');
  L.push('');
  L.push(
    mdTable(
      ['Path', 'Views', 'Users', 'Avg engagement'],
      r.pages.map((pg) => [
        pg.path,
        fmt(pg.views),
        fmt(pg.users),
        duration(pg.avgEngagementSeconds),
      ]),
    ),
  );
  L.push('');

  L.push('## Landing pages');
  L.push('');
  L.push(
    mdTable(
      ['Landing page', 'Sessions', 'Bounce rate', 'Key events', 'Evidence'],
      r.landingPages.slice(0, 15).map((lp) => [
        lp.landingPage,
        fmt(lp.sessions),
        `${(lp.bounceRate * 100).toFixed(1)}%`,
        fmt(lp.keyEvents),
        lp.sessions < 20 ? 'directional (<20 sessions)' : 'usable sample',
      ]),
    ),
  );
  L.push('');

  L.push('## Checkout outcomes (independent event counts)');
  L.push('');
  L.push(
    mdTable(
      ['Outcome', 'Events', 'Users', 'Events / user', 'Prior events', 'Change'],
      (r.checkoutOutcomes || []).map((outcome) => [
        outcome.label,
        fmt(outcome.eventCount),
        fmt(outcome.users),
        fmt(outcome.attemptsPerUser, 1),
        fmt(outcome.priorEventCount),
        delta(outcome.eventCount, outcome.priorEventCount),
      ]),
    ),
  );
  L.push('');
  L.push(
    '_`begin_checkout` fires before the company pre-check and payment redirect, so repeated events are attempts—not proof of payment-gateway failures. Inspect `checkout_failed` first; inspect Stripe only for attempts that reached `checkout_redirect`._',
  );
  L.push('');

  L.push('### Checkout failure reasons');
  L.push('');
  if (r.checkoutFailureReasons?.available) {
    if (r.checkoutFailureReasons.rows.length) {
      L.push(
        mdTable(
          ['Reason', 'Failures', 'Users'],
          r.checkoutFailureReasons.rows.map((row) => [
            row.reason,
            fmt(row.eventCount),
            fmt(row.users),
          ]),
        ),
      );
    } else {
      L.push('No `checkout_failed` events in this window.');
    }
  } else {
    L.push(`Unavailable: ${r.checkoutFailureReasons?.error || 'query failed'}`);
    L.push('');
    L.push(`_${r.checkoutFailureReasons?.hint || ''}_`);
  }
  L.push('');

  L.push('## Ordered checkout funnel');
  L.push('');
  if (r.orderedCheckout?.available) {
    L.push(
      mdTable(
        ['Sequential stage', 'Users', 'Prior wk', 'Change', '% of first stage'],
        r.orderedCheckout.stages.map((stage) => [
          stage.label,
          fmt(stage.users),
          fmt(stage.priorUsers),
          delta(stage.users, stage.priorUsers),
          `${(stage.pctOfFirst * 100).toFixed(1)}%`,
        ]),
      ),
    );
    L.push('');
    L.push(
      `_Closed, ordered GA4 user funnel (v1alpha). Users must complete the stages in the listed order. Sampled: ${r.orderedCheckout.sampled ? 'yes' : 'no'}._`,
    );
  } else {
    L.push(
      `Unavailable without blocking the report: ${r.orderedCheckout?.error || 'GA4 funnel query failed'}`,
    );
  }
  L.push('');

  L.push('## Intent funnel (distinct users)');
  L.push('');
  L.push(
    mdTable(
      ['Stage', 'Users', 'Prior wk', 'Change', '% of arrivals', '% of prev stage'],
      (r.funnel || []).map((f) => [
        f.label,
        fmt(f.users),
        fmt(f.priorUsers),
        delta(f.users, f.priorUsers),
        `${(f.pctOfTop * 100).toFixed(1)}%`,
        f.pctOfPreviousStage === null
          ? '—'
          : `${(f.pctOfPreviousStage * 100).toFixed(1)}%`,
      ]),
    ),
  );
  L.push('');
  L.push(
    '_Note: GA4 `keyEvents` on this property counts many graph interaction ' +
      'events, so it exceeds session count and does not represent conversions. ' +
      'Use this funnel for conversion questions; treat the key-event column ' +
      'elsewhere in this report as an engagement-depth signal only._',
  );
  L.push('');
  L.push(
    '_Stages are independent distinct-user counts for each event, not a strict ' +
      'sequential funnel: a user can reach a later stage without firing an ' +
      'earlier one (arriving straight on a company page, for instance). A ' +
      '"% of prev stage" above 100% means that stage has its own entry path, ' +
      'not that the data is wrong._',
  );
  L.push('');

  L.push('## Events');
  L.push('');
  L.push(
    mdTable(
      ['Event', 'Count', 'Users'],
      r.events.map((e) => [e.eventName, fmt(e.eventCount), fmt(e.totalUsers)]),
    ),
  );
  L.push('');

  // Search Console. Present in the markdown as well as the HTML because a
  // Claude task reads THIS, and a report where the two views disagree about
  // what the data said is worse than one that omits a section outright.
  const sc = r.searchConsole;
  if (sc && sc.available) {
    const pos = (v) => (v == null ? '—' : v.toFixed(1));
    const pc = (v) => `${((v || 0) * 100).toFixed(2)}%`;
    L.push('## Search Console');
    L.push('');
    L.push(
      `Google data through **${sc.dataThrough}**${sc.lagDays ? ` (${sc.lagDays} day(s) behind the rest of this report — normal, GSC lags 2-3 days)` : ''}, compared with ${sc.comparedWith}, the same weekday a week earlier.`,
    );
    L.push('');
    L.push(
      mdTable(
        ['Surface', 'Clicks', 'Impressions', 'CTR', 'Position'],
        [
          ['Whole site', sc.day.clicks, sc.day.impressions, pc(sc.day.ctr), pos(sc.day.position)],
          ['Whole site, a week earlier', sc.priorDay.clicks, sc.priorDay.impressions, pc(sc.priorDay.ctr), pos(sc.priorDay.position)],
          ['/empresa', sc.empresaDay.clicks, sc.empresaDay.impressions, pc(sc.empresaDay.ctr), pos(sc.empresaDay.position)],
          ['/empresa, a week earlier', sc.empresaPriorDay.clicks, sc.empresaPriorDay.impressions, pc(sc.empresaPriorDay.ctr), pos(sc.empresaPriorDay.position)],
        ],
      ),
    );
    L.push('');
    if (sc.topQueries?.length) {
      L.push('## Top search queries');
      L.push('');
      L.push(mdTable(['Query', 'Clicks', 'Impressions', 'CTR', 'Position'],
        sc.topQueries.map((q) => [q.query, q.clicks, q.impressions, pc(q.ctr), pos(q.position)])));
      L.push('');
    }
    if (sc.strikingDistance?.length) {
      L.push('## Ranking but not clicked');
      L.push('');
      L.push(mdTable(['Page', 'Clicks', 'Impressions', 'CTR', 'Position'],
        sc.strikingDistance.map((p) => [p.page, p.clicks, p.impressions, pc(p.ctr), pos(p.position)])));
      L.push('');
    }
    const ex = sc.experiment;
    if (ex && (ex.variant.impressions || ex.control.impressions)) {
      L.push('## Title A/B test');
      L.push('');
      L.push(mdTable(['Arm', 'Pages', 'Clicks', 'Impressions', 'CTR', 'Position'], [
        ['Variant (counts-first)', ex.variant.pages, ex.variant.clicks, ex.variant.impressions, pc(ex.variant.ctr), pos(ex.variant.position)],
        ['Control (CIF-first)', ex.control.pages, ex.control.clicks, ex.control.impressions, pc(ex.control.ctr), pos(ex.control.position)],
      ]));
      L.push('');
      L.push('A CTR win that came with a WORSE position is a loss, not a win: it means the CIF leaving the title head cost the exact-match ranking.');
      L.push('');
    }
  } else if (sc) {
    L.push('## Search Console');
    L.push('');
    L.push(`Not available this run — ${sc.reason || 'unknown reason'}. GA4 and edge figures are unaffected.`);
    L.push('');
  }

  L.push('## Geography');
  L.push('');
  L.push(
    mdTable(
      ['Country', 'Sessions', 'Users'],
      r.countries.map((x) => [x.country, fmt(x.sessions), fmt(x.totalUsers)]),
    ),
  );
  L.push('');

  L.push('## Devices');
  L.push('');
  L.push(
    mdTable(
      ['Device', 'Sessions', 'Engagement'],
      r.devices.map((d) => [
        d.deviceCategory,
        fmt(d.sessions),
        `${(d.engagementRate * 100).toFixed(1)}%`,
      ]),
    ),
  );
  L.push('');

  return L.join('\n');
}

/* ---------------------------------------------------------------- http */

function authorized(request, env) {
  if (!env.REPORT_TOKEN) return false;
  const supplied = new URL(request.url).searchParams.get('token') || '';
  // Length-independent comparison; tokens are not secrets we can time-safe
  // compare cheaply in Workers, but this avoids trivial early-exit leaks.
  if (supplied.length !== env.REPORT_TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < supplied.length; i++) {
    diff |= supplied.charCodeAt(i) ^ env.REPORT_TOKEN.charCodeAt(i);
  }
  return diff === 0;
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const text = (body, status = 200) =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });

/** Styled HTML response for the browser view of a stored report. */
const htmlResponse = (body, status = 200) =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // A report is a snapshot; never let an intermediary serve a stale one.
      'cache-control': 'no-store',
    },
  });

async function handleDiscover(env) {
  const sa = loadServiceAccount(env);
  const token = await getAccessToken(sa);
  const res = await fetch(`${ADMIN_API}/accountSummaries`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok) return json({ ok: false, status: res.status, body }, 502);

  const summaries = (body.accountSummaries || []).flatMap((a) =>
    (a.propertySummaries || []).map((ps) => ({
      account: a.displayName,
      property: ps.displayName,
      // "properties/123456789" -> the numeric id the Data API wants
      propertyId: (ps.property || '').split('/')[1] || null,
    })),
  );

  return json({
    ok: true,
    serviceAccount: sa.client_email,
    found: summaries.length,
    properties: summaries,
    hint:
      summaries.length === 0
        ? 'No properties visible. Add this service account email as a Viewer on the GA4 property (Admin > Property access management).'
        : 'Set GA_PROPERTY_ID in wrangler.toml to the propertyId you want.',
  });
}

async function doRun(env, nowMs) {
  const sa = loadServiceAccount(env);
  if (!env.GA_PROPERTY_ID) {
    throw new Error('GA_PROPERTY_ID is not set — call /discover first');
  }
  const token = await getAccessToken(sa);
  const report = await gather(env, token, env.GA_PROPERTY_ID, nowMs);
  // Pulled after GA4 rather than beside it: a Search Console outage must not
  // cost the report its GA4 and edge sections, which stand on their own.
  report.searchConsole = await gatherSearchConsole(env, periods(nowMs));
  if (env.ANALYTICS_DB) await persist(env.ANALYTICS_DB, report);
  return report;
}

// Named exports exist for offline unit tests; the Worker runtime only uses the
// default export below.
export {
  cleanFunnelStepName,
  delta,
  duration,
  funnelHasRows,
  gather,
  gatherToday,
  orderedFunnelFrom,
  periods,
  reportWarnings,
  toMarkdown,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/health') {
      if (!authorized(request, env)) return text('unauthorized', 401);
      let saOk = false;
      let saEmail = null;
      try {
        const sa = loadServiceAccount(env);
        saOk = true;
        saEmail = sa.client_email;
      } catch {
        /* reported below */
      }
      return json({
        ok: saOk && Boolean(env.GA_PROPERTY_ID),
        serviceAccountLoaded: saOk,
        serviceAccountEmail: saEmail,
        propertyIdSet: Boolean(env.GA_PROPERTY_ID),
        propertyId: env.GA_PROPERTY_ID || null,
        d1Bound: Boolean(env.ANALYTICS_DB),
      });
    }

    if (!authorized(request, env)) return text('unauthorized', 401);

    try {
      if (path === '/discover') return await handleDiscover(env);

      if (path === '/interactions') return json(await handleInteractions(env, url));
      if (path === '/series') return json(await handleSeries(env, url));

      if (path === '/today') {
        const sa = loadServiceAccount(env);
        if (!env.GA_PROPERTY_ID) throw new Error('GA_PROPERTY_ID is not set');
        const token = await getAccessToken(sa);
        return json(await gatherToday(token, env.GA_PROPERTY_ID));
      }

      // Raw GA4 payloads for the two fragile queries: the v1alpha funnel and
      // the custom-dimension failure probe. Both have already drifted once —
      // the funnel by repeating its metric headers, the probe by depending on a
      // dimension registration that may not exist. When a section looks wrong,
      // read the response Google actually sent before changing the parser.
      if (path === '/diagnose') return json(await handleDiagnose(env));


      if (path === '/run') {
        const report = await doRun(env, Date.now());
        return url.searchParams.get('format') === 'json'
          ? json(report)
          : text(toMarkdown(report));
      }

      // The styled report the cron renders and mails. Reads the stored payload
      // rather than re-pulling, so the link in an email always resolves to the
      // exact numbers that email was built from.
      if (path === '/report') {
        if (!env.ANALYTICS_DB) return text('D1 not bound', 500);
        const stored = await loadLatest(env.ANALYTICS_DB);
        if (!stored) return text('no report stored yet — call /run first', 404);
        return htmlResponse(renderReportHtml(stored));
      }

      // Sends the stored report by email now, and reports exactly what the
      // Email API said. Use it to confirm delivery the moment the token
      // is set, rather than waiting a week to find out from a silent cron.
      if (path === '/send-test') {
        if (!env.ANALYTICS_DB) return text('D1 not bound', 500);
        const stored = await loadLatest(env.ANALYTICS_DB);
        if (!stored) return text('no report stored yet — call /run first', 404);
        const delivery = await sendReportEmail(env, stored);
        return json(delivery, delivery.sent ? 200 : 502);
      }

      if (path === '/latest') {
        if (!env.ANALYTICS_DB) return text('D1 not bound', 500);
        const report = await loadLatest(env.ANALYTICS_DB);
        if (!report) return text('no report stored yet — call /run first', 404);
        return url.searchParams.get('format') === 'json'
          ? json(report)
          : text(toMarkdown(report));
      }

      return text('not found', 404);
    } catch (e) {
      return json({ ok: false, error: String(e.message || e) }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        let report;
        try {
          report = await doRun(env, event.scheduledTime);
        } catch (e) {
          console.error('scheduled GA4 pull failed:', e.message || e);
          throw e;
        }

        // Delivery is separate from the pull on purpose: the report is already
        // persisted and served at /report by this point, so a mail problem is
        // logged rather than allowed to look like a failed pull.
        const delivery = await sendReportEmail(env, report);
        if (delivery.sent) {
          console.log(`daily report emailed to ${delivery.to}`);
        } else if (delivery.reason === 'not_configured') {
          console.warn(`daily report not emailed: ${delivery.hint}`);
        } else {
          console.error(
            `daily report email failed (${delivery.status || 'no status'}): ${delivery.error}`,
          );
        }

        if (report.warnings?.length) {
          console.warn(
            `daily report carries ${report.warnings.length} measurement warning(s): ${report.warnings.join(' | ')}`,
          );
        }
      })(),
    );
  },
};
