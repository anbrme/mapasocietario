#!/usr/bin/env node
/**
 * Inspect a stable sample of company URLs with the Search Console URL
 * Inspection API and say WHICH of three diagnoses the data supports.
 *
 * The question this exists to answer: a promotion batch lands ~2,000 companies
 * (4,000 URLs, ES + EN) in a demand sitemap, and weeks later Search Console
 * still reports them as submitted-but-not-indexed. "Not indexed" is not one
 * condition, it is three, and they do not share a remedy:
 *
 *   Unknown / Discovered  -> Google has not come yet. A crawl-budget and
 *                            discovery problem; a fresh sitemap FILE is the
 *                            lever (see functions/sitemaps/_waves.js), and it
 *                            works on a two-to-three-week clock.
 *   Crawled, not indexed  -> Google came and declined. No amount of sitemap
 *                            work moves this; only pages worth indexing do.
 *   Duplicate / Alternate -> Google folded the URL into another. If that other
 *                            URL is ours, we compete with ourselves (ES vs EN);
 *                            if it is someone else's domain, our content is
 *                            being treated as the copy — the only pattern here
 *                            a third party can actually cause.
 *
 * The daily analytics report reaches Search Console through the Search
 * Analytics API (workers/analytics/src/search-console.js), which reports
 * clicks and impressions for pages ALREADY indexed. It is structurally unable
 * to answer this question; URL Inspection is the endpoint that can.
 *
 * Usage:
 *   set -a && . ./.env.analytics.local && set +a
 *   node scripts/gsc-inspect-sample.mjs                      # 25 ES URLs of wave 2
 *   node scripts/gsc-inspect-sample.mjs --lang en
 *   node scripts/gsc-inspect-sample.mjs --sitemap https://mapasocietario.es/sitemap-demand.xml
 *   node scripts/gsc-inspect-sample.mjs --since 2026-09-15   # crawls after the new sitemap
 *   node scripts/gsc-inspect-sample.mjs --json
 *
 * Credentials:
 *   GSC_SA_KEY_FILE  service account for Search Console (default ~/gsc-sa.json)
 *   GSC_SITE_URL     the property, exactly as registered (default
 *                    https://mapasocietario.es/; a Domain property is
 *                    sc-domain:mapasocietario.es)
 *
 * The service account must be a user on the property — being authenticated is
 * not enough, and a 403 here means exactly that.
 *
 * Quota: 2,000 inspections/day and 600/minute per property, so a 25-URL sample
 * costs ~1% of a day. Re-runs are cheap; the sample is deliberately the same
 * one every time (see sampleUrls) so two runs are comparable.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getAccessToken } from '../workers/analytics/src/index.js';
import { GSC_SCOPE } from '../workers/analytics/src/search-console.js';
import {
  compare,
  filterLocs,
  inspectionRow,
  sampleUrls,
  sitemapLocs,
  summarize,
  toMarkdown,
} from './gsc-inspect-lib.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INSPECT_API = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
const DEFAULT_SITEMAP = 'https://mapasocietario.es/sitemap-demand-2.xml';
const OUT_DIR = join(REPO_ROOT, 'gsc-inspect-out');

/**
 * Mirrors loadLocalEnv in scripts/run-analytics-report.mjs: the Cloudflare and
 * Search Console settings already live in that one gitignored file, so this
 * script populates from it too rather than asking for a second export ritual.
 * A value already in the environment wins.
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

/* ----------------------------------------------------------------- cli */

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  return inline ? inline.slice(name.length + 3) : fallback;
};

if (args.includes('--help') || args.includes('-h')) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
  process.exit(0);
}

const options = {
  sitemap: flag('sitemap', DEFAULT_SITEMAP),
  size: Number(flag('size', '25')),
  language: flag('lang', 'es'),
  seed: flag('seed', 'batch2'),
  site: flag('site', process.env.GSC_SITE_URL || 'https://mapasocietario.es/'),
  since: flag('since', null),
  concurrency: Math.max(1, Number(flag('concurrency', '4'))),
  json: args.includes('--json'),
  save: !args.includes('--no-save'),
};

if (!Number.isInteger(options.size) || options.size < 1) {
  console.error('--size must be a positive integer');
  process.exit(1);
}
if (!['es', 'en', 'both'].includes(options.language)) {
  console.error('--lang must be es, en or both');
  process.exit(1);
}

/* ----------------------------------------------------------------- io */

async function readSitemap(source) {
  if (!/^https?:\/\//.test(source)) return readFileSync(source, 'utf8');
  const res = await fetch(source, { headers: { accept: 'application/xml' } });
  if (!res.ok) throw new Error(`sitemap ${source} -> HTTP ${res.status}`);
  return res.text();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One inspection, with the retries that matter. A 429 is the quota window, not
 * a verdict, so it waits and tries again; a 403 is a permission answer that
 * will be identical next time, so it fails fast and says what to fix.
 */
async function inspect(token, url, { attempts = 3 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const res = await fetch(INSPECT_API, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        inspectionUrl: url,
        siteUrl: options.site,
        // Pin the locale: coverageState comes back as a human string, and the
        // classifier matches English substrings. An unpinned locale would
        // silently turn every row into "unclassified" on a different machine.
        languageCode: 'en-US',
      }),
    });
    if (res.ok) return res.json();

    const body = (await res.text()).slice(0, 300);
    if (res.status === 403) {
      throw new Error(
        `403 from URL Inspection for ${options.site}.\n`
        + 'The service account is authenticated but not a user on this property '
        + '(Search Console > Settings > Users and permissions), or the property '
        + 'string is wrong — a Domain property is "sc-domain:mapasocietario.es", '
        + `not a URL. Response: ${body}`,
      );
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === attempts) return { error: `HTTP ${res.status}: ${body}` };
    // A hot quota window outlasts a sub-second backoff.
    await sleep(res.status === 429 ? 10_000 * attempt : 1_000 * attempt);
  }
  return { error: 'exhausted retries' };
}

/** Bounded-concurrency map that preserves input order. */
async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
}

/** The most recent earlier snapshot for this sitemap, or null. */
function previousSnapshot(sitemap) {
  if (!existsSync(OUT_DIR)) return null;
  const prefix = `${sitemap.split('/').pop().replace(/\.xml$/, '')}-`;
  const files = readdirSync(OUT_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .sort();
  for (const name of files.reverse()) {
    try {
      return JSON.parse(readFileSync(join(OUT_DIR, name), 'utf8'));
    } catch {
      // A truncated snapshot from an interrupted run is not a reason to fail;
      // fall through to the one before it.
    }
  }
  return null;
}

/* --------------------------------------------------------------- main */

let serviceAccount;
try {
  const path = process.env.GSC_SA_KEY_FILE || `${homedir()}/gsc-sa.json`;
  serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
} catch (e) {
  console.error(
    `Search Console key unreadable (set GSC_SA_KEY_FILE, default ~/gsc-sa.json): ${e.message}`,
  );
  process.exit(1);
}

const xml = await readSitemap(options.sitemap);
const all = filterLocs(sitemapLocs(xml), options.language);
if (!all.length) {
  console.error(`No ${options.language} URLs in ${options.sitemap}.`);
  process.exit(1);
}
const urls = sampleUrls(all, { size: options.size, seed: options.seed });

console.error(
  `Inspecting ${urls.length} of ${all.length} ${options.language.toUpperCase()} URLs `
  + `from ${options.sitemap} against ${options.site} …`,
);

const token = await getAccessToken(serviceAccount, GSC_SCOPE);
let done = 0;
const rows = (await mapPool(urls, options.concurrency, async (url) => {
  const payload = await inspect(token, url);
  done += 1;
  if (done % 5 === 0 || done === urls.length) console.error(`  ${done}/${urls.length}`);
  return inspectionRow(url, payload);
}));

const snapshot = {
  meta: {
    ranAt: new Date().toISOString(),
    sitemap: options.sitemap,
    site: options.site,
    language: options.language,
    seed: options.seed,
    size: options.size,
    population: all.length,
    since: options.since,
  },
  summary: summarize(rows, { since: options.since }),
  rows,
};

const comparison = compare(snapshot, previousSnapshot(options.sitemap));

if (options.save) {
  mkdirSync(OUT_DIR, { recursive: true });
  const stem = options.sitemap.split('/').pop().replace(/\.xml$/, '');
  const file = join(OUT_DIR, `${stem}-${snapshot.meta.ranAt.slice(0, 10)}-${options.language}.json`);
  writeFileSync(file, JSON.stringify(snapshot, null, 2));
  console.error(`snapshot: ${file}`);
}

if (options.json) console.log(JSON.stringify({ ...snapshot, comparison }, null, 2));
else console.log(toMarkdown({ ...snapshot, comparison }));
