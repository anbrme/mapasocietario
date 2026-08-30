#!/usr/bin/env node
/**
 * Run the daily analytics report locally and print it, without deploying and
 * without the worker's REPORT_TOKEN.
 *
 * The cron version of this report reaches its numbers through three APIs and a
 * D1 write, which makes "did my change to the renderer work" an expensive
 * question: push, wait for CI, wait for 07:30 UTC, read the email. This runs the
 * same `gather()` and the same renderers against the same live APIs, so a
 * formatting or reconciliation change can be seen in seconds.
 *
 * It earned its place the first time it ran: the note under the intent funnel
 * still told the reader that a stage exceeding the one above it was an entry
 * path rather than a defect, directly contradicting a warning three sections
 * down. Reading the diff had not caught it.
 *
 *   node scripts/run-analytics-report.mjs                    # markdown
 *   node scripts/run-analytics-report.mjs --json             # raw payload
 *   node scripts/run-analytics-report.mjs --html=/tmp/r.html # the email itself
 *
 * Credentials, all optional except the GA4 key:
 *   GA_SA_KEY_FILE   service account for the GA4 Data API   (default ~/ga-sa.json)
 *   GSC_SA_KEY_FILE  service account for Search Console     (default ~/gsc-sa.json)
 *   CLOUDFLARE_ANALYTICS_TOKEN  Cloudflare GraphQL analytics token
 *
 * A missing Search Console key or Cloudflare token degrades that one section
 * and says why, exactly as the deployed worker does — the point is to see what
 * the email would look like, including when a source is unavailable.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GA_SCOPE,
  gather,
  getAccessToken,
  periods,
  toMarkdown,
} from '../workers/analytics/src/index.js';
import { renderReportHtml } from '../workers/analytics/src/report-html.js';
import { fetchSearchConsole, GSC_SCOPE } from '../workers/analytics/src/search-console.js';
import { seoArm } from '../functions/empresa/_seo_experiment.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Load .env.analytics.local if it is there — the same gitignored file the
 * Cloudflare tokens already live in, so the edge section populates without
 * anyone having to remember to export anything.
 *
 * A value already in the environment WINS: an explicit `FOO=bar node ...` must
 * override the file, not be silently overridden by it.
 */
function loadLocalEnv() {
  const path = join(REPO_ROOT, '.env.analytics.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || line.trimStart().startsWith('#')) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
}
loadLocalEnv();

const PROPERTY_ID = process.env.GA_PROPERTY_ID || '530829482';
const SITE_URL = process.env.GSC_SITE_URL || 'https://mapasocietario.es/';
const ZONE = process.env.CF_ZONE_NAME || 'mapasocietario.es';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const htmlArg = args.find((a) => a.startsWith('--html='));

function readKey(envVar, fallback, label) {
  const path = process.env[envVar] || `${homedir()}/${fallback}`;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`${label} key unreadable at ${path} (set ${envVar}): ${e.message}`);
  }
}

/**
 * A 403 naming a disabled API is the single most common way this fails, and the
 * message Google returns buries the fix in a wall of JSON. Surface it.
 */
function explain(e) {
  const text = String(e.message || e);
  const service = text.match(/"service":\s*"([^"]+)"/)?.[1];
  if (text.includes('has not been used in project') && service) {
    const project = text.match(/consumer":\s*"projects\/(\d+)"/)?.[1] || 'the project';
    return `${service} is not enabled on project ${project}.\n`
      + `Enable it, then re-run:\n`
      + `  https://console.cloud.google.com/apis/library/${service}?project=${project}`;
  }
  if (text.includes('caller does not have permission')) {
    return `${text}\n\nThe service account is authenticated but not authorised on the `
      + `target. For GA4 that is Admin > Property access management; for Search `
      + `Console it is that product's own Users and permissions screen.`;
  }
  return text;
}

const now = Date.now();
const p = periods(now);

let ga;
try {
  ga = readKey('GA_SA_KEY_FILE', 'ga-sa.json', 'GA4');
} catch (e) {
  // A stack trace here tells the reader nothing they can act on; the path and
  // the environment variable that overrides it tell them everything.
  console.error(e.message);
  process.exit(1);
}

let report;
try {
  report = await gather(
    { CLOUDFLARE_ANALYTICS_TOKEN: process.env.CLOUDFLARE_ANALYTICS_TOKEN, CF_ZONE_NAME: ZONE },
    await getAccessToken(ga, GA_SCOPE),
    PROPERTY_ID,
    now,
  );
} catch (e) {
  console.error(`GA4 pull failed.\n\n${explain(e)}`);
  process.exit(1);
}

// Search Console is deliberately non-fatal, matching gatherSearchConsole in the
// worker: GA4 and the edge numbers are worth reading on their own.
try {
  const gsc = readKey('GSC_SA_KEY_FILE', 'gsc-sa.json', 'Search Console');
  report.searchConsole = await fetchSearchConsole(
    await getAccessToken(gsc, GSC_SCOPE),
    SITE_URL,
    { window: p.current, priorWindow: p.prior, armOf: seoArm },
  );
} catch (e) {
  report.searchConsole = { available: false, reason: explain(e).slice(0, 300), site: SITE_URL };
}

if (htmlArg) {
  const path = htmlArg.slice('--html='.length);
  writeFileSync(path, renderReportHtml(report));
  console.error(`wrote ${path}`);
}
if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else if (!htmlArg) {
  console.log(toMarkdown(report));
}

if (!report.edge?.available) {
  console.error(
    `\nnote: the Cloudflare edge section is empty${report.edge?.reason ? ` (${report.edge.reason})` : ''}. `
    + 'Put CLOUDFLARE_ANALYTICS_TOKEN in .env.analytics.local, which this script '
    + 'reads automatically, or export it.',
  );
}
