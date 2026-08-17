#!/usr/bin/env node
/**
 * Quality-gated batch promotion of company pages into the demand index (D1).
 *
 * Stages (run in order; each writes its output under --out so a failed stage
 * can be re-run without repeating the previous ones):
 *
 *   node scripts/promote-batch.mjs fetch   [--size 2000] [--es http://localhost:9201]
 *   node scripts/promote-batch.mjs verify  [--size 2000]
 *   node scripts/promote-batch.mjs sql
 *   node scripts/promote-batch.mjs apply   --yes
 *
 * fetch  — pulls eligible candidates from Elasticsearch (via SSH tunnel),
 *          over-fetching 3× the target so verification losses don't shrink
 *          the batch.
 * verify — re-validates EVERY candidate against the live api.ncdata.eu
 *          profile (the deployed server is the source of truth): the company
 *          must exist under its group_key, its canonical name must round-trip
 *          to the candidate slug, and the eligibility gate must hold on the
 *          live data. Already-promoted slugs in D1 are excluded up front.
 * sql    — emits chunked, per-row-guarded INSERT files (see promotionSql).
 * apply  — runs each SQL file through `wrangler d1 execute` against prod D1.
 *
 * Note: rows written here bypass MAX_PROMOTIONS_PER_DAY by design (that cap is
 * an anti-abuse guard on the public endpoint). On the day a batch is applied,
 * countPromotionsToday exceeds the cap, so organic demand promotion pauses
 * until the next day — accepted trade-off.
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  candidateFromDoc,
  reservedIdentities,
  isEligibleCandidate,
  rankAndDedupe,
  promotionSqlChunks,
  MIN_PUBLICATIONS,
  RECENT_ACTIVITY_CUTOFF,
} from './promote-batch-lib.mjs';
import { nameToSlug } from '../functions/empresa/_slug.js';

const execFileAsync = promisify(execFile);

const API_BASE = 'https://api.ncdata.eu';
const D1_NAME = 'mapasocietario-seo';
const VERIFY_CONCURRENCY = 6;
const OVERFETCH_FACTOR = 3;

const args = process.argv.slice(3);
function argValue(flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const OUT_DIR = argValue('--out', 'batch-promotion-out');
const TARGET_SIZE = Number(argValue('--size', 2000));
const ES_URL = argValue('--es', process.env.ES_URL || 'http://localhost:9201');
// ES behind the tunnel requires basic auth: pass ES_AUTH="user:password" via
// env (e.g. command-substituted from the server's /etc/default/borme-search)
// so the credential never lands in argv or shell history.
const ES_AUTH_HEADER = process.env.ES_AUTH
  ? { Authorization: `Basic ${Buffer.from(process.env.ES_AUTH).toString('base64')}` }
  : {};

async function fetchJson(url, options = {}) {
  const withAuth = url.startsWith(ES_URL)
    ? { ...options, headers: { ...(options.headers || {}), ...ES_AUTH_HEADER } }
    : options;
  const response = await fetch(url, withAuth);
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return response.json();
}

/** Pick the companies index: prefer the *_folded alias, verify by doc shape. */
async function detectCompaniesIndex() {
  const aliases = await fetchJson(`${ES_URL}/_cat/aliases?format=json`);
  const names = [...new Set(aliases.map((a) => a.alias))];
  const ordered = [
    ...names.filter((n) => n.includes('folded')),
    ...names.filter((n) => !n.includes('folded') && /compan/.test(n)),
  ];
  for (const name of ordered) {
    try {
      const sample = await fetchJson(`${ES_URL}/${encodeURIComponent(name)}/_search?size=1`);
      const hit = sample?.hits?.hits?.[0];
      if (hit && /^[A-Za-z]:/.test(hit._id) && hit._source?.company_name) return name;
    } catch {
      // not this one
    }
  }
  throw new Error(`No companies index found among aliases: ${ordered.join(', ') || '(none)'}`);
}

async function stageFetch() {
  const index = await detectCompaniesIndex();
  console.log(`Using ES index/alias: ${index}`);
  const fetchSize = Math.min(TARGET_SIZE * OVERFETCH_FACTOR, 9_000);
  const query = {
    size: fetchSize,
    sort: [{ current_capital: 'desc' }],
    _source: [
      'company_name', 'company_name_normalized', 'province', 'hojas', 'nif', 'enriched_nif',
      'current_capital', 'total_publications', 'last_seen', 'is_dissolved',
    ],
    query: {
      bool: {
        filter: [
          { range: { current_capital: { gt: 0 } } },
          { range: { total_publications: { gte: MIN_PUBLICATIONS } } },
          { range: { last_seen: { gte: RECENT_ACTIVITY_CUTOFF } } },
          { nested: { path: 'officers_active', query: { match_all: {} } } },
          {
            bool: {
              should: [{ exists: { field: 'nif' } }, { exists: { field: 'enriched_nif' } }],
              minimum_should_match: 1,
            },
          },
        ],
        must_not: [{ term: { is_dissolved: true } }],
      },
    },
  };
  const result = await fetchJson(`${ES_URL}/${encodeURIComponent(index)}/_search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(query),
  });
  const hits = result?.hits?.hits || [];
  // officer count is not in _source (nested field kept out to limit payload);
  // stamp a placeholder that passes the local gate — verify re-checks it live.
  const candidates = hits
    .map((hit) => candidateFromDoc({ ...hit._source, officers_active_count: 1 }, hit._id))
    .filter(Boolean);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'candidates.json'), JSON.stringify(candidates, null, 1));
  console.log(`Fetched ${candidates.length} candidates (asked for ${fetchSize}) → ${OUT_DIR}/candidates.json`);
}

async function promotedSlugsFromD1() {
  const { stdout } = await execFileAsync('npx', [
    'wrangler', 'd1', 'execute', D1_NAME, '--remote', '--json',
    '--command', "SELECT slug FROM company_index_candidates WHERE status = 'promoted'",
  ], { maxBuffer: 64 * 1024 * 1024 });
  const parsed = JSON.parse(stdout);
  return new Set((parsed?.[0]?.results || []).map((row) => row.slug));
}

/** Live verification — mirrors the demand endpoint's validateCompanyProfile. */
async function verifyCandidate(candidate) {
  const profile = await fetchJson(
    `${API_BASE}/bormes/v3/company?group_key=${encodeURIComponent(candidate.group_key)}`,
  ).catch(() => null);
  const company = profile?.company;
  if (!company) return { ok: false, reason: 'not_found' };

  const returnedKey = company._id || company.id || company.group_key || '';
  if (returnedKey && returnedKey !== candidate.group_key) return { ok: false, reason: 'key_mismatch' };

  const canonicalName = company.company_name || company.company_name_normalized || '';
  if (!canonicalName || nameToSlug(canonicalName) !== candidate.slug) {
    return { ok: false, reason: 'slug_mismatch' };
  }

  const live = candidateFromDoc(company, candidate.group_key);
  if (!isEligibleCandidate(live)) return { ok: false, reason: 'gate_failed_live' };

  return {
    ok: true,
    row: {
      group_key: candidate.group_key,
      slug: candidate.slug,
      name: canonicalName,
      province: live.province,
      hoja: live.hoja,
      nif: live.nif,
      capital: live.capital,
    },
  };
}

async function stageVerify() {
  const rawCandidates = JSON.parse(await readFile(join(OUT_DIR, 'candidates.json'), 'utf8'));
  const reserved = reservedIdentities();
  const candidates = rawCandidates.filter((c) => !reserved.groupKeys.has(c.group_key));
  const promoted = await promotedSlugsFromD1();
  const excludeSlugs = new Set([...promoted, ...reserved.slugs]);
  console.log(`Excluding ${promoted.size} already-promoted slugs and ${rawCandidates.length - candidates.length} seed companies`);
  // Rank locally first so verification spends API calls on the best rows only.
  const shortlist = rankAndDedupe(candidates, {
    size: Math.ceil(TARGET_SIZE * 1.5),
    excludeSlugs,
  });

  const verified = [];
  const rejected = {};
  let cursor = 0;
  async function worker() {
    while (cursor < shortlist.length && verified.length < TARGET_SIZE) {
      const candidate = shortlist[cursor++];
      const result = await verifyCandidate(candidate);
      if (result.ok) {
        verified.push(result.row);
      } else {
        rejected[result.reason] = (rejected[result.reason] || 0) + 1;
      }
      if ((verified.length + Object.values(rejected).reduce((a, b) => a + b, 0)) % 100 === 0) {
        console.log(`… ${verified.length} verified, rejections so far: ${JSON.stringify(rejected)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: VERIFY_CONCURRENCY }, worker));

  const rows = verified.slice(0, TARGET_SIZE);
  await writeFile(join(OUT_DIR, 'verified.json'), JSON.stringify(rows, null, 1));
  console.log(`Verified ${rows.length}/${shortlist.length} candidates → ${OUT_DIR}/verified.json`);
  console.log(`Rejections: ${JSON.stringify(rejected)}`);
}

async function stageSql() {
  const rows = JSON.parse(await readFile(join(OUT_DIR, 'verified.json'), 'utf8'));
  const chunks = promotionSqlChunks(rows);
  for (const [index, chunk] of chunks.entries()) {
    const file = join(OUT_DIR, `promote-${String(index + 1).padStart(3, '0')}.sql`);
    await writeFile(file, `${chunk}\n`);
    console.log(`Wrote ${file}`);
  }
  console.log(`\n${rows.length} companies across ${chunks.length} SQL files. Apply with:`);
  console.log(`  node scripts/promote-batch.mjs apply --yes`);
}

async function stageApply() {
  if (!args.includes('--yes')) {
    console.error('apply writes to PRODUCTION D1 — re-run with --yes to confirm.');
    process.exit(1);
  }
  const files = (await readdir(OUT_DIR)).filter((f) => /^promote-\d+\.sql$/.test(f)).sort();
  if (!files.length) throw new Error(`No promote-*.sql files in ${OUT_DIR} — run the sql stage first.`);
  for (const file of files) {
    console.log(`Applying ${file}…`);
    const { stdout } = await execFileAsync('npx', [
      'wrangler', 'd1', 'execute', D1_NAME, '--remote', '--file', join(OUT_DIR, file), '--yes',
    ], { maxBuffer: 64 * 1024 * 1024 });
    const lastLine = stdout.trim().split('\n').pop();
    console.log(`  ${lastLine}`);
  }
  console.log('Batch applied. Promoted total is now:');
  const { stdout } = await execFileAsync('npx', [
    'wrangler', 'd1', 'execute', D1_NAME, '--remote', '--json',
    '--command', "SELECT COUNT(*) AS n FROM company_index_candidates WHERE status = 'promoted'",
  ], { maxBuffer: 8 * 1024 * 1024 });
  console.log(`  ${JSON.parse(stdout)?.[0]?.results?.[0]?.n}`);
}

const stages = { fetch: stageFetch, verify: stageVerify, sql: stageSql, apply: stageApply };
const stage = stages[process.argv[2]];
if (!stage) {
  console.error(`Usage: node scripts/promote-batch.mjs <fetch|verify|sql|apply> [--size N] [--es URL] [--out DIR] [--yes]`);
  process.exit(1);
}
stage().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
