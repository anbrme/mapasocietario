/**
 * Pure logic for the Search Console URL Inspection sample
 * (scripts/gsc-inspect-sample.mjs).
 *
 * Why this is a separate module: the classification below is the part that
 * decides which of three very different diagnoses you act on — "Google has not
 * come yet" (wait), "Google came and declined" (the pages need to be worth
 * indexing), "Google chose someone else's URL" (a duplication problem, possibly
 * not ours). Getting that mapping wrong sends weeks of work in the wrong
 * direction, so it is side-effect free and unit-tested rather than buried in a
 * script that needs a Google round trip to run at all.
 */

export const SITE_HOST = 'mapasocietario.es';

/* ------------------------------------------------------------- sitemap */

function decodeXml(value) {
  // &amp; LAST: decoding it first would turn "&amp;lt;" into "<".
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Every <loc> in a urlset, in document order. */
export function sitemapLocs(xml) {
  const out = [];
  const pattern = /<loc>\s*([^<]+?)\s*<\/loc>/g;
  let match;
  while ((match = pattern.exec(String(xml || '')))) out.push(decodeXml(match[1]));
  return out;
}

/**
 * ES and EN company URLs are separate entries in the same sitemap, and they are
 * near-identical pages (only the UI chrome is translated — see
 * functions/empresa/_lib.js). Mixing them in one sample makes every count
 * ambiguous: a "duplicate" verdict on an EN URL means something quite different
 * from the same verdict on an ES one. So the sample is language-scoped.
 */
export function filterLocs(locs, language = 'es') {
  if (language === 'both') return [...locs];
  const needle = language === 'en' ? '/en/company/' : '/empresa/';
  return locs.filter((loc) => loc.includes(needle));
}

/* -------------------------------------------------------------- sample */

/** FNV-1a over `${seed}:${url}`. Small, dependency-free, well spread. */
function hashScore(seed, url) {
  let hash = 0x811c9dc5;
  const text = `${seed}:${url}`;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * A STABLE sample, not a random one.
 *
 * The whole point of this tool is comparing the same pages on two different
 * days ("0 of 60 indexed a week ago — and now?"). A fresh random draw each run
 * compares two different populations and invents a trend out of sampling noise.
 * Ranking by hash(seed, url) instead means a URL's position depends only on the
 * URL, so re-running tomorrow inspects the same pages — and organic promotions
 * landing in the sitemap meanwhile displace at most a few of them, rather than
 * reshuffling the set.
 */
export function sampleUrls(urls, { size = 25, seed = 'batch2' } = {}) {
  return [...urls]
    .map((url) => ({ url, score: hashScore(seed, url) }))
    // Ties broken by URL so the order is total, never dependent on sort stability.
    .sort((a, b) => a.score - b.score || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0))
    .slice(0, Math.max(0, size))
    .map((entry) => entry.url);
}

/* ------------------------------------------------------ classification */

/**
 * GSC coverage states, grouped by the ACTION each one implies.
 *
 * Matched as case-insensitive substrings, in this order, because the literal
 * strings are Google's and change wording without notice ("Discovered -
 * currently not indexed" has been printed with three different dashes). Order
 * matters: every "… not indexed" state contains the word "indexed", so the
 * plain `indexed` test has to come last.
 */
const STATE_RULES = [
  { key: 'unknown_to_google', test: (s) => s.includes('unknown to google') },
  { key: 'discovered_not_indexed', test: (s) => s.includes('discovered') },
  { key: 'crawled_not_indexed', test: (s) => s.includes('crawled') && s.includes('not indexed') },
  { key: 'duplicate', test: (s) => s.includes('duplicate') },
  { key: 'alternate_canonical', test: (s) => s.includes('alternate page') },
  { key: 'noindex', test: (s) => s.includes('noindex') },
  { key: 'blocked_by_robots', test: (s) => s.includes('robots.txt') },
  { key: 'not_found', test: (s) => s.includes('not found') || s.includes('404') },
  { key: 'redirect', test: (s) => s.includes('redirect') },
  { key: 'server_error', test: (s) => s.includes('server error') || s.includes('5xx') },
  { key: 'indexed', test: (s) => s.includes('indexed') },
];

/** States that mean the page is broken for Google rather than merely unloved. */
export const TECHNICAL_FAULT_STATES = new Set([
  'noindex', 'blocked_by_robots', 'not_found', 'redirect', 'server_error',
]);

/**
 * States grouped into the bands that actually hold still between two calls.
 *
 * Measured 2026-09-16: the same 25 URLs inspected twice, two minutes apart,
 * came back with SIX of them reclassified — and in both directions ("Discovered"
 * to "Unknown to Google" and back). Nothing about those pages changed in two
 * minutes; the API simply does not distinguish the two pre-crawl states
 * reliably, presumably answering from whichever shard serves the call.
 *
 * Reporting that churn as movement is worse than useless: it manufactures a
 * trend out of noise, which is exactly what this tool exists to prevent. So
 * every comparison and diagnosis below runs on BANDS, which change only when
 * something real happens (Google fetched the page; Google indexed it; Google
 * folded it into another URL). The granular state stays in the detail table,
 * where it is data rather than a claim about change.
 */
export const BAND_OF_STATE = {
  indexed: 'indexed',
  unknown_to_google: 'not_crawled',
  discovered_not_indexed: 'not_crawled',
  crawled_not_indexed: 'crawled_declined',
  duplicate: 'folded',
  alternate_canonical: 'folded',
  noindex: 'fault',
  blocked_by_robots: 'fault',
  not_found: 'fault',
  redirect: 'fault',
  server_error: 'fault',
  unclassified: 'unclassified',
  no_result: 'unclassified',
};

export const BAND_LABELS = {
  indexed: 'Indexed',
  not_crawled: 'Not crawled yet (unknown or discovered)',
  crawled_declined: 'Crawled and declined',
  folded: 'Folded into another URL',
  fault: 'Technically excluded',
  unclassified: 'Unclassified',
};

export const bandOf = (state) => BAND_OF_STATE[state] || 'unclassified';

export const STATE_LABELS = {
  indexed: 'Indexed',
  unknown_to_google: 'Unknown to Google (never discovered)',
  discovered_not_indexed: 'Discovered, not indexed',
  crawled_not_indexed: 'Crawled, not indexed',
  duplicate: 'Duplicate (Google picked another canonical)',
  alternate_canonical: 'Alternate of a canonical page',
  noindex: 'Excluded by noindex',
  blocked_by_robots: 'Blocked by robots.txt',
  not_found: '404 / not found',
  redirect: 'Redirect',
  server_error: 'Server error',
  unclassified: 'Unclassified state',
  no_result: 'No inspection result',
};

/**
 * Map a coverageState to a state key. An unrecognized string returns
 * 'unclassified' and is carried through verbatim rather than being folded into
 * a neighbouring bucket — a silently miscounted state is worse than an
 * obviously unknown one.
 */
export function classifyState(coverageState) {
  const text = String(coverageState || '').toLowerCase();
  if (!text) return 'no_result';
  return STATE_RULES.find((rule) => rule.test(text))?.key || 'unclassified';
}

function hostOf(url) {
  try {
    return new URL(String(url)).host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Flatten one inspectionResult into the handful of fields that carry a
 * decision. `error` is set instead when the API refused this URL, so one
 * failure does not discard the other 24 answers.
 */
export function inspectionRow(url, payload) {
  if (payload?.error) {
    return { url, state: 'no_result', error: String(payload.error), coverageState: null };
  }
  const index = payload?.inspectionResult?.indexStatusResult || {};
  const googleCanonical = index.googleCanonical || null;
  const canonicalHost = hostOf(googleCanonical);
  return {
    url,
    state: classifyState(index.coverageState),
    coverageState: index.coverageState || null,
    verdict: index.verdict || null,
    robotsTxtState: index.robotsTxtState || null,
    indexingState: index.indexingState || null,
    pageFetchState: index.pageFetchState || null,
    lastCrawlTime: index.lastCrawlTime || null,
    googleCanonical,
    userCanonical: index.userCanonical || null,
    // Google picked a canonical on a domain that is not ours: the ONLY signal in
    // this whole report that implicates a third party (a scraped copy outranking
    // the original). Everything else is ours to fix.
    foreignCanonical: Boolean(canonicalHost && canonicalHost !== SITE_HOST),
    // Google picked one of OUR other URLs — typically the ES page swallowing its
    // EN twin. That is our own duplication, not an attack.
    ownCrossCanonical: Boolean(
      googleCanonical && canonicalHost === SITE_HOST && googleCanonical !== url,
    ),
    inSitemap: Array.isArray(payload?.inspectionResult?.indexStatusResult?.sitemap)
      ? payload.inspectionResult.indexStatusResult.sitemap.length > 0
      : false,
  };
}

/* ----------------------------------------------------------- summarize */

/**
 * @param {Array} rows            inspectionRow() output
 * @param {string} [since]        ISO date; crawls at or after it are counted
 *                                separately, so "did the new sitemap change
 *                                anything" is answerable in one number.
 */
export function summarize(rows, { since = null } = {}) {
  const byState = {};
  const byBand = {};
  for (const row of rows) {
    byState[row.state] = (byState[row.state] || 0) + 1;
    const band = bandOf(row.state);
    byBand[band] = (byBand[band] || 0) + 1;
  }

  const crawled = rows.filter((row) => row.lastCrawlTime);
  const crawledSince = since
    ? crawled.filter((row) => String(row.lastCrawlTime).slice(0, 10) >= since)
    : [];

  return {
    total: rows.length,
    byState,
    byBand,
    indexed: byState.indexed || 0,
    neverCrawled: rows.length - crawled.length,
    crawled: crawled.length,
    crawledSince: crawledSince.length,
    since,
    lastCrawlSeen: crawled
      .map((row) => row.lastCrawlTime)
      .sort()
      .slice(-1)[0] || null,
    foreignCanonicals: rows.filter((row) => row.foreignCanonical)
      .map((row) => ({ url: row.url, googleCanonical: row.googleCanonical })),
    ownCrossCanonicals: rows.filter((row) => row.ownCrossCanonical)
      .map((row) => ({ url: row.url, googleCanonical: row.googleCanonical })),
    technicalFaults: rows.filter((row) => TECHNICAL_FAULT_STATES.has(row.state))
      .map((row) => ({ url: row.url, state: row.state, coverageState: row.coverageState })),
    unclassified: rows.filter((row) => row.state === 'unclassified')
      .map((row) => ({ url: row.url, coverageState: row.coverageState })),
    errors: rows.filter((row) => row.error).map((row) => ({ url: row.url, error: row.error })),
  };
}

/**
 * Turn the counts into the readings that actually differ in what you would do
 * next. Deliberately conservative: a diagnosis is only stated when it holds for
 * a plurality of the sample, and "no clear signal" is a valid answer.
 */
export function diagnose(summary) {
  const out = [];
  const total = summary.total || 0;
  if (!total) return [{ level: 'warn', text: 'Empty sample — nothing to diagnose.' }];
  const share = (n) => n / total;
  const pct = (n) => `${Math.round(share(n) * 100)}%`;

  if (summary.technicalFaults.length) {
    out.push({
      level: 'alert',
      text: `${summary.technicalFaults.length} page(s) are technically excluded (noindex / robots / 404 / redirect / 5xx). `
        + 'That is a bug on our side and outranks every other reading here — fix it first.',
    });
  }

  if (summary.foreignCanonicals.length) {
    out.push({
      level: 'alert',
      text: `${summary.foreignCanonicals.length} page(s) have a Google-chosen canonical on ANOTHER domain `
        + `(${summary.foreignCanonicals.slice(0, 3).map((row) => hostOf(row.googleCanonical)).join(', ')}). `
        + 'This is the one pattern a third party can cause: a copy of our content treated as the original. '
        + 'Worth a manual look before drawing any conclusion — a handful can also be ordinary aggregator overlap.',
    });
  }

  if (summary.ownCrossCanonicals.length >= Math.max(2, total * 0.2)) {
    out.push({
      level: 'warn',
      text: `${summary.ownCrossCanonicals.length} page(s) were folded into another URL of ours. `
        + 'Our own ES/EN duplication, not a competitor: the two language variants carry the same registry data.',
    });
  }

  const indexedShare = share(summary.indexed);
  const unseen = summary.byBand?.not_crawled || 0;
  const declined = summary.byBand?.crawled_declined || 0;
  const duplicated = summary.byBand?.folded || 0;

  if (indexedShare >= 0.5) {
    out.push({ level: 'info', text: `${pct(summary.indexed)} of the sample is indexed — this batch is landing.` });
  } else if (unseen >= declined && unseen >= duplicated && unseen > 0) {
    out.push({
      level: 'info',
      text: `${pct(unseen)} not yet crawled or merely discovered. This is a DISCOVERY/crawl-budget state, `
        + 'not a judgement on the pages: a new sitemap file is the lever that has produced a burst before, '
        + 'and its effect takes two to three weeks, not days.',
    });
  } else if (declined >= duplicated && declined > 0) {
    out.push({
      level: 'warn',
      text: `${pct(declined)} crawled and declined. Google has SEEN these pages and chose not to index them, `
        + 'so more sitemaps, resubmissions and internal links will not move the number — only pages worth '
        + 'indexing will (unique analysis, not a restatement of the registry).',
    });
  } else if (duplicated > 0) {
    out.push({
      level: 'warn',
      text: `${pct(duplicated)} treated as duplicates of another URL. Check the googleCanonical column: `
        + 'ours means we are competing with ourselves; someone else\'s is the scraping case above.',
    });
  } else {
    out.push({ level: 'info', text: 'No single state dominates the sample; read the table before acting.' });
  }

  if (summary.since) {
    out.push({
      level: 'info',
      text: summary.crawledSince > 0
        ? `${summary.crawledSince} of ${total} were crawled on or after ${summary.since}.`
        : `None of the sample has been crawled since ${summary.since}.`,
    });
  }

  return out;
}

/* ------------------------------------------------------------- compare */

/**
 * Two snapshots of the SAME sample, so the deltas are real movement rather than
 * a different draw.
 *
 * "Same" is established from the ROWS, not from the metadata: the sample is
 * hash-stable but not frozen, so organic promotions arriving in the sitemap
 * between two runs can displace a URL or two, and the seed/size/language fields
 * would still match while the populations quietly differed. Every delta below
 * is therefore computed over the URLs PRESENT IN BOTH runs, and `drift` reports
 * how many were dropped. A run whose settings differ is refused outright — that
 * is a different question, not a noisier answer to the same one.
 */
export function compare(current, previous) {
  if (!previous) return null;
  const differsBy = ['seed', 'size', 'language', 'sitemap']
    .filter((key) => previous.meta?.[key] !== current.meta?.[key]);
  if (differsBy.length) {
    return { comparable: false, differsBy, previousAt: previous.meta?.ranAt || null };
  }

  const before = new Map((previous.rows || []).map((row) => [row.url, row]));
  const shared = (current.rows || []).filter((row) => before.has(row.url));
  if (!shared.length) {
    return {
      comparable: false,
      differsBy: ['sample'],
      previousAt: previous.meta?.ranAt || null,
    };
  }

  // Movement is counted between BANDS. A URL that merely flipped between
  // "unknown" and "discovered" has not moved — see BAND_OF_STATE for the
  // measurement that forced this.
  const deltas = {};
  let churn = 0;
  for (const row of shared) {
    const previousRow = before.get(row.url);
    if (previousRow.state === row.state) continue;
    const from = bandOf(previousRow.state);
    const to = bandOf(row.state);
    if (from === to) { churn += 1; continue; }
    deltas[to] = (deltas[to] || 0) + 1;
    deltas[from] = (deltas[from] || 0) - 1;
  }
  for (const [key, value] of Object.entries(deltas)) if (value === 0) delete deltas[key];

  return {
    comparable: true,
    previousAt: previous.meta?.ranAt || null,
    shared: shared.length,
    drift: (current.rows || []).length - shared.length,
    deltas,
    // URLs reclassified WITHIN a band: reported so the number is visible, never
    // as movement.
    churn,
    // The first thing that will move on a batch stuck in discovery, and the one
    // to watch before indexing: Google actually fetched the page.
    newlyCrawled: shared
      .filter((row) => row.lastCrawlTime && !before.get(row.url).lastCrawlTime)
      .map((row) => row.url),
    newlyIndexed: shared
      .filter((row) => row.state === 'indexed' && before.get(row.url).state !== 'indexed')
      .map((row) => row.url),
    lostIndexing: shared
      .filter((row) => row.state !== 'indexed' && before.get(row.url).state === 'indexed')
      .map((row) => row.url),
  };
}

/* -------------------------------------------------------------- render */

const LEVEL_MARK = { alert: '!!', warn: '!', info: '·' };

export function toMarkdown({ meta, summary, rows, comparison = null }) {
  const lines = [];
  lines.push(`# URL Inspection sample — ${meta.sitemap}`);
  lines.push('');
  lines.push(`${summary.total} URL(s), language \`${meta.language}\`, seed \`${meta.seed}\`, run ${meta.ranAt}.`);
  lines.push('');

  const pct = (count) => (summary.total ? `${Math.round((count / summary.total) * 100)}%` : '—');

  lines.push('| Band | Pages | Share |');
  lines.push('| --- | ---: | ---: |');
  Object.entries(summary.byBand || {})
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, count]) => lines.push(`| ${BAND_LABELS[key] || key} | ${count} | ${pct(count)} |`));
  lines.push('');
  lines.push('<details><summary>Raw coverage states</summary>');
  lines.push('');
  lines.push('| State | Pages |');
  lines.push('| --- | ---: |');
  Object.entries(summary.byState)
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, count]) => lines.push(`| ${STATE_LABELS[key] || key} | ${count} |`));
  lines.push('');
  lines.push('Unknown and Discovered are not stable between two calls to the API — '
    + 'the split between them is noise, their sum is not.');
  lines.push('</details>');
  lines.push('');
  lines.push(`Crawled at least once: ${summary.crawled}/${summary.total}`
    + (summary.since ? ` · since ${summary.since}: ${summary.crawledSince}` : '')
    + (summary.lastCrawlSeen ? ` · most recent crawl ${summary.lastCrawlSeen}` : ''));
  lines.push('');

  lines.push('## Reading');
  diagnose(summary).forEach((note) => lines.push(`- ${LEVEL_MARK[note.level] || '·'} ${note.text}`));
  lines.push('');

  if (summary.foreignCanonicals.length) {
    lines.push('## Canonicals on another domain');
    summary.foreignCanonicals.forEach((row) => lines.push(`- ${row.url} → ${row.googleCanonical}`));
    lines.push('');
  }
  if (summary.technicalFaults.length) {
    lines.push('## Technically excluded');
    summary.technicalFaults.forEach((row) => lines.push(`- ${row.url} — ${row.coverageState || row.state}`));
    lines.push('');
  }
  if (summary.unclassified.length) {
    lines.push('## Unrecognized coverage states (report these, the classifier needs a rule)');
    summary.unclassified.forEach((row) => lines.push(`- ${row.url} — "${row.coverageState}"`));
    lines.push('');
  }
  if (summary.errors.length) {
    lines.push('## Inspection errors');
    summary.errors.forEach((row) => lines.push(`- ${row.url} — ${row.error}`));
    lines.push('');
  }

  if (comparison && comparison.comparable === false) {
    lines.push(`## Previous run (${comparison.previousAt})`);
    lines.push(`Not comparable: differs by ${comparison.differsBy.join(', ')}.`);
    lines.push('');
  } else if (comparison) {
    lines.push(`## Change since ${comparison.previousAt}`);
    lines.push(`Over the ${comparison.shared} URL(s) both runs share`
      + (comparison.drift ? ` (${comparison.drift} drifted out of the sample).` : '.'));
    const deltas = Object.entries(comparison.deltas);
    if (!deltas.length) lines.push('- Nothing moved between bands.');
    deltas.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).forEach(([key, delta]) => {
      lines.push(`- ${BAND_LABELS[key] || key}: ${delta > 0 ? '+' : ''}${delta}`);
    });
    if (comparison.churn) {
      lines.push(`- (${comparison.churn} URL(s) were reclassified within the same band — `
        + 'API noise, not movement.)');
    }
    if (comparison.newlyCrawled.length) {
      lines.push(`- **Newly crawled: ${comparison.newlyCrawled.length}** — the first real sign of life.`);
      comparison.newlyCrawled.slice(0, 10).forEach((url) => lines.push(`  - ${url}`));
    }
    if (comparison.newlyIndexed.length) {
      lines.push(`- Newly indexed: ${comparison.newlyIndexed.length}`);
      comparison.newlyIndexed.slice(0, 10).forEach((url) => lines.push(`  - ${url}`));
    }
    if (comparison.lostIndexing.length) {
      lines.push(`- No longer indexed: ${comparison.lostIndexing.length}`);
      comparison.lostIndexing.slice(0, 10).forEach((url) => lines.push(`  - ${url}`));
    }
    lines.push('');
  }

  const worst = rows.filter((row) => row.state !== 'indexed').slice(0, 15);
  if (worst.length) {
    lines.push('## Sample detail (not indexed)');
    lines.push('| URL | State | Last crawl | Google canonical |');
    lines.push('| --- | --- | --- | --- |');
    worst.forEach((row) => {
      const path = row.url.replace(`https://${SITE_HOST}`, '');
      const crawl = row.lastCrawlTime ? String(row.lastCrawlTime).slice(0, 10) : '—';
      const canonical = row.googleCanonical
        ? row.googleCanonical.replace(`https://${SITE_HOST}`, '')
        : '—';
      lines.push(`| ${path} | ${STATE_LABELS[row.state] || row.state} | ${crawl} | ${canonical} |`);
    });
    lines.push('');
  }

  return lines.join('\n');
}
