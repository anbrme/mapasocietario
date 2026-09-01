#!/usr/bin/env node
/**
 * How many of our company pages could carry an EU public-contract panel?
 *
 *   node scripts/ted-coverage.mjs [--companies FILE] [--from YYYYMMDD] [--out FILE]
 *
 * Pulls every Spanish contract-award notice published since --from (default
 * 2024-01-01, when eForms first made the winner's NIF a structured field) and
 * intersects the winners against our promoted companies. Two numbers come out:
 *
 *   DIRECT  companies whose own NIF won at least one award. Exact.
 *   GROUP   companies where a differently-named but brand-sharing winner
 *           exists. A stand-in for real corporate-graph resolution, and
 *           deliberately generous, so read it as an upper bound.
 *
 * Talks to the TED API only, never to our own backend, so it is safe to run at
 * any time. It is deliberately NOT wired into the build: it takes minutes and
 * depends on a third party. Run it by hand when the coverage question returns.
 *
 * Two hard-won details, both contradicting the API documentation:
 *
 *   - paginationMode ITERATION never terminates on this query. Its token
 *     cycles, and a full pull reached 417,600 notices against a true total of
 *     69,100. Month-sliced PAGE_NUMBER instead, which ends on arithmetic.
 *   - winner-identifier is the key. organisation-identifier-tenderer also
 *     matches non-winning roles and inflates the count by up to 64%.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const API = 'https://api.ted.europa.eu/v3/notices/search';
const PAGE_SIZE = 250;

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const FROM = arg('--from', '20240101');
const COMPANIES = arg('--companies', 'batch-promotion-out/verified.json');
// batch-promotion-out/ is gitignored, so results never land in the repo.
const OUT = arg('--out', 'batch-promotion-out/ted-coverage.json');

// Spanish NIF shapes: legal entities (letter + 7 digits + control) and
// natural persons (8 digits + letter). Buyer-side prefixes are excluded
// below — a P/Q/S code in a winner field is a contracting authority that
// leaked across, not a contractor.
const NIF_SHAPE = /^([A-HJ-NP-SUVW]\d{7}[0-9A-J]|\d{8}[A-Z])$/;
const BUYER_PREFIX = /^[PQS]/;

export const isWinnerNif = (raw) => {
  const v = String(raw ?? '').trim().toUpperCase();
  return NIF_SHAPE.test(v) && !BUYER_PREFIX.test(v);
};

/** Split concatenated UTE identifiers ("A15139314-B20890687") into members. */
export const expandIds = (raw) =>
  String(raw ?? '')
    .trim()
    .toUpperCase()
    .split('-')
    .map((s) => s.trim())
    .filter(isWinnerNif);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// TED throttles bursts: ~20 rapid pages earns a 429 from its nginx front end.
// Pace requests and back off on rejection rather than hammering — a full pull
// is only ~280 pages, so a courteous pace still finishes in minutes.
const PACE_MS = 900;
const MAX_RETRIES = 6;

/**
 * ITERATION mode does not terminate on this query — its token cycles, and the
 * iterator yielded 417,600 notices against a true total of 69,100 before being
 * killed. So slice the range by month and use PAGE_NUMBER instead: a Spanish
 * month is ~2,100 award notices, comfortably inside PAGE_NUMBER's 15,000 cap,
 * and each slice reports its own total so the loop ends on arithmetic rather
 * than on the server choosing to stop.
 */
async function fetchPage({ from, to, page }) {
  const body = {
    query:
      `notice-type="can-standard" AND buyer-country="ESP" ` +
      `AND publication-date>=${from} AND publication-date<=${to}`,
    fields: [
      'publication-number',
      'winner-identifier',
      'organisation-identifier-buyer',
      'total-value',
      'received-submissions-type-code',
      'received-submissions-type-val',
    ],
    limit: PAGE_SIZE,
    page,
    paginationMode: 'PAGE_NUMBER',
    onlyLatestVersions: true,
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === MAX_RETRIES) {
      throw new Error(`TED ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const wait = Math.min(60000, 2000 * 2 ** attempt);
    process.stderr.write(`  ${res.status}, backing off ${wait / 1000}s\n`);
    await sleep(wait);
  }
  throw new Error('unreachable');
}

/**
 * Bid counts arrive as two parallel flat arrays — codes like ['t-sme',
 * 'tenders', ...] against values ['1','2', ...]. Only the 'tenders' entries
 * are total bids per lot; a lot with exactly one is the competition-failure
 * signal worth carrying into the report.
 */
export function lotBidCounts(notice) {
  const codes = notice['received-submissions-type-code'] || [];
  const vals = notice['received-submissions-type-val'] || [];
  const out = [];
  for (let i = 0; i < Math.min(codes.length, vals.length); i += 1) {
    if (codes[i] === 'tenders') {
      const n = Number.parseInt(vals[i], 10);
      if (Number.isFinite(n)) out.push(n);
    }
  }
  return out;
}

/** Inclusive YYYYMM month slices from FROM to today. */
export function monthSlices() {
  const out = [];
  const start = new Date(
    Number(FROM.slice(0, 4)),
    Number(FROM.slice(4, 6)) - 1,
    1,
  );
  const now = new Date();
  for (let d = start; d <= now; d.setMonth(d.getMonth() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const last = new Date(y, d.getMonth() + 1, 0).getDate();
    out.push({ from: `${y}${m}01`, to: `${y}${m}${last}` });
  }
  return out;
}

async function pullAwards() {
  const byNif = new Map();
  const seen = new Set();
  let pages = 0;
  let notices = 0;
  let duplicates = 0;
  let total = 0;

  for (const slice of monthSlices()) {
    let page = 1;
    let sliceTotal = null;

    do {
      const res = await fetchPage({ ...slice, page });
      if (sliceTotal === null) {
        sliceTotal = res.totalNoticeCount ?? 0;
        total += sliceTotal;
      }
      const batch = res.notices || [];
      if (!batch.length) break;

      for (const n of batch) {
        const pub = n['publication-number'];
        // The API can return the same notice more than once; count each
        // award exactly once or every per-company figure inflates.
        if (pub && seen.has(pub)) {
          duplicates += 1;
          continue;
        }
        if (pub) seen.add(pub);
        notices += 1;

        const winners = (n['winner-identifier'] || []).flatMap(expandIds);
        if (!winners.length) continue;

        const value = Number(n['total-value']) || 0;
        const buyers = n['organisation-identifier-buyer'] || [];
        const bids = lotBidCounts(n);
        // A notice's value is not attributable per-winner from the search API
        // (multi-lot notices flatten), so split evenly and call it an estimate.
        const share = value / winners.length;

        for (const nif of new Set(winners)) {
          const rec = byNif.get(nif) || {
            awards: 0,
            valueEstimate: 0,
            buyers: new Set(),
            lots: 0,
            singleBidLots: 0,
          };
          rec.awards += 1;
          rec.valueEstimate += share;
          for (const b of buyers) rec.buyers.add(String(b));
          rec.lots += bids.length;
          rec.singleBidLots += bids.filter((b) => b === 1).length;
          byNif.set(nif, rec);
        }
      }

      pages += 1;
      if (page * PAGE_SIZE >= sliceTotal) break;
      page += 1;
      await sleep(PACE_MS);
    } while (page <= 80); // hard ceiling: a month never needs 20,000 notices

    process.stderr.write(
      `  ${slice.from.slice(0, 6)}  ${notices} kept, ${duplicates} dup\n`,
    );
  }

  return { byNif, notices, total, pages, duplicates };
}

/**
 * Leading brand token, used only for the group proxy. Drops the legal form
 * and the filler words that would otherwise collide unrelated companies.
 */
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'grupo']);
export function brandToken(name) {
  const t = String(name || '')
    .toUpperCase()
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()));
  return t[0] && t[0].length >= 5 ? t[0] : null;
}

async function main() {
  process.stderr.write(`Pulling Spanish awards from ${FROM}...\n`);
  const { byNif, notices, total, pages, duplicates } = await pullAwards();
  process.stderr.write(
    `Done: ${notices} unique notices (${duplicates} dups dropped) over ${pages} pages, ${byNif.size} distinct winner NIFs.\n\n`,
  );

  const companies = JSON.parse(readFileSync(COMPANIES, 'utf8'));
  const hits = [];
  const misses = [];
  for (const c of companies) {
    const rec = c.nif ? byNif.get(String(c.nif).toUpperCase()) : null;
    if (rec) hits.push({ ...c, ...rec, buyers: rec.buyers.size });
    else misses.push(c);
  }

  // Group proxy: a miss whose brand token matches a winning company's brand
  // token. Measured within the promoted set, so a company counts when a
  // different promoted company sharing its brand token did win.
  const winnerBrands = new Set();
  for (const c of hits) {
    const b = brandToken(c.name);
    if (b) winnerBrands.add(b);
  }
  const groupProxy = misses.filter((c) => {
    const b = brandToken(c.name);
    return b && winnerBrands.has(b);
  });

  const pct = (n) => `${((100 * n) / companies.length).toFixed(1)}%`;
  const eur = (n) =>
    n >= 1e6 ? `€${(n / 1e6).toFixed(1)}M` : `€${Math.round(n / 1000)}k`;

  const totalValue = hits.reduce((s, h) => s + h.valueEstimate, 0);
  const withBids = hits.filter((h) => h.lots > 0);
  const singleBidHeavy = withBids.filter((h) => h.singleBidLots / h.lots >= 0.5);

  console.log('TED PUBLIC-CONTRACT COVERAGE');
  console.log('='.repeat(64));
  console.log(`TED award notices scanned      ${notices} (of ${total})`);
  console.log(`Distinct Spanish winner NIFs   ${byNif.size}`);
  console.log(`Promoted companies tested      ${companies.length}`);
  console.log();
  console.log(`DIRECT hit (own NIF won)       ${hits.length}  ${pct(hits.length)}`);
  console.log(
    `GROUP proxy (brand match)      +${groupProxy.length}  ${pct(groupProxy.length)}  [upper bound]`,
  );
  console.log(
    `Combined ceiling               ${hits.length + groupProxy.length}  ${pct(hits.length + groupProxy.length)}`,
  );
  console.log();
  // Framework notices report the agreement's ceiling, which then reappears on
  // each call-off, so this total runs far above the money actually awarded —
  // a first run put 214 companies at €68bn, roughly half the national
  // above-threshold market. Report counts, never this, until per-lot values
  // are read from the notice XML and frameworks reconciled against call-offs.
  console.log(`Awarded value across hits      ${eur(totalValue)}  [NOT RELIABLE]`);
  console.log(`Hits with >=2 distinct buyers  ${hits.filter((h) => h.buyers >= 2).length}`);
  console.log(`Hits with bid-count data       ${withBids.length}`);
  console.log(`  of those, >=50% single-bid   ${singleBidHeavy.length}`);
  console.log();
  console.log('Top 12 by award count:');
  for (const h of hits.sort((a, b) => b.awards - a.awards).slice(0, 12)) {
    const sb = h.lots ? `${Math.round((100 * h.singleBidLots) / h.lots)}%` : '—';
    console.log(
      `  ${String(h.awards).padStart(4)}  ${eur(h.valueEstimate).padStart(8)}  ` +
        `buyers=${String(h.buyers).padStart(3)}  1-bid=${sb.padStart(4)}  ${h.name}`,
    );
  }

  writeFileSync(
    OUT,
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        noticesScanned: notices,
        distinctWinners: byNif.size,
        companiesTested: companies.length,
        directHits: hits.length,
        groupProxyHits: groupProxy.length,
        hits: hits.map(({ buyers, ...h }) => ({ ...h, distinctBuyers: buyers })),
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote ${OUT}`);
}

// Import-safe: the pull only runs when this file is the entry point, so the
// unit test can import the pure helpers without hitting the network.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`ted-coverage failed: ${err.message}`);
    process.exit(1);
  });
}
