import { describe, expect, it } from 'vitest';
import {
  bandOf,
  classifyState,
  compare,
  diagnose,
  filterLocs,
  inspectionRow,
  sampleUrls,
  sitemapLocs,
  summarize,
} from './gsc-inspect-lib.mjs';

const ES = (slug) => `https://mapasocietario.es/empresa/${slug}`;
const EN = (slug) => `https://mapasocietario.es/en/company/${slug}`;

const indexStatus = (fields) => ({ inspectionResult: { indexStatusResult: fields } });

describe('sitemapLocs', () => {
  it('reads every loc and decodes entities', () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>${ES('a-y-b-sl')}</loc><lastmod>2026-09-07</lastmod></url>
      <url><loc>https://mapasocietario.es/empresa/x?a=1&amp;b=2</loc></url>
    </urlset>`;
    expect(sitemapLocs(xml)).toEqual([
      ES('a-y-b-sl'),
      'https://mapasocietario.es/empresa/x?a=1&b=2',
    ]);
  });

  it('returns nothing for junk instead of throwing', () => {
    expect(sitemapLocs('')).toEqual([]);
    expect(sitemapLocs(null)).toEqual([]);
  });
});

describe('filterLocs', () => {
  const locs = [ES('uno'), EN('uno'), ES('dos'), EN('dos')];

  it('scopes to one language, because ES and EN are near-identical pages', () => {
    expect(filterLocs(locs, 'es')).toEqual([ES('uno'), ES('dos')]);
    expect(filterLocs(locs, 'en')).toEqual([EN('uno'), EN('dos')]);
    expect(filterLocs(locs, 'both')).toHaveLength(4);
  });
});

describe('sampleUrls', () => {
  const population = Array.from({ length: 200 }, (_, i) => ES(`empresa-${i}-sl`));

  it('returns the same sample for the same seed — two runs must be comparable', () => {
    expect(sampleUrls(population, { size: 10, seed: 'batch2' }))
      .toEqual(sampleUrls(population, { size: 10, seed: 'batch2' }));
  });

  it('returns a different sample for a different seed', () => {
    expect(sampleUrls(population, { size: 10, seed: 'batch2' }))
      .not.toEqual(sampleUrls(population, { size: 10, seed: 'otra' }));
  });

  it('is barely perturbed when the sitemap grows underneath it', () => {
    const before = sampleUrls(population, { size: 20, seed: 'batch2' });
    const grown = [...population, ...Array.from({ length: 20 }, (_, i) => ES(`nueva-${i}-sl`))];
    const after = sampleUrls(grown, { size: 20, seed: 'batch2' });
    const kept = after.filter((url) => before.includes(url)).length;
    expect(kept).toBeGreaterThanOrEqual(16);
  });

  it('does not depend on the order the sitemap listed them', () => {
    const reversed = [...population].reverse();
    expect(sampleUrls(reversed, { size: 10, seed: 'batch2' }))
      .toEqual(sampleUrls(population, { size: 10, seed: 'batch2' }));
  });

  it('never asks for more than exists', () => {
    expect(sampleUrls(population.slice(0, 3), { size: 10 })).toHaveLength(3);
  });
});

describe('classifyState', () => {
  it('does not read "not indexed" states as indexed', () => {
    // Every one of these contains the word "indexed"; the order of the rules is
    // what keeps them out of the indexed bucket.
    expect(classifyState('Discovered - currently not indexed')).toBe('discovered_not_indexed');
    expect(classifyState('Crawled - currently not indexed')).toBe('crawled_not_indexed');
    expect(classifyState('Submitted and indexed')).toBe('indexed');
    expect(classifyState('Indexed, not submitted in sitemap')).toBe('indexed');
  });

  it('separates the three diagnoses and the technical faults', () => {
    expect(classifyState('URL is unknown to Google')).toBe('unknown_to_google');
    expect(classifyState('Duplicate, Google chose different canonical than user')).toBe('duplicate');
    expect(classifyState('Alternate page with proper canonical tag')).toBe('alternate_canonical');
    expect(classifyState("Excluded by 'noindex' tag")).toBe('noindex');
    expect(classifyState('Blocked by robots.txt')).toBe('blocked_by_robots');
    expect(classifyState('Not found (404)')).toBe('not_found');
    expect(classifyState('Page with redirect')).toBe('redirect');
  });

  it('flags an unrecognized state instead of folding it into a neighbour', () => {
    expect(classifyState('Something Google invented last Tuesday')).toBe('unclassified');
    expect(classifyState('')).toBe('no_result');
    expect(classifyState(undefined)).toBe('no_result');
  });
});

describe('inspectionRow', () => {
  it('flags a canonical on another domain — the only third-party signal here', () => {
    const row = inspectionRow(ES('acme-sl'), indexStatus({
      coverageState: 'Duplicate, Google chose different canonical than user',
      googleCanonical: 'https://competidor.example/ficha/acme-sl',
    }));
    expect(row.foreignCanonical).toBe(true);
    expect(row.ownCrossCanonical).toBe(false);
  });

  it('separates our own ES/EN duplication from that', () => {
    const row = inspectionRow(EN('acme-sl'), indexStatus({
      coverageState: 'Alternate page with proper canonical tag',
      googleCanonical: ES('acme-sl'),
    }));
    expect(row.foreignCanonical).toBe(false);
    expect(row.ownCrossCanonical).toBe(true);
  });

  it('treats a self-canonical as neither', () => {
    const row = inspectionRow(ES('acme-sl'), indexStatus({
      coverageState: 'Submitted and indexed',
      googleCanonical: ES('acme-sl'),
    }));
    expect(row.foreignCanonical).toBe(false);
    expect(row.ownCrossCanonical).toBe(false);
    expect(row.state).toBe('indexed');
  });

  it('keeps a failed URL as a row instead of losing the whole run', () => {
    const row = inspectionRow(ES('acme-sl'), { error: 'HTTP 500: upstream' });
    expect(row.state).toBe('no_result');
    expect(row.error).toContain('500');
  });
});

describe('summarize', () => {
  const rows = [
    inspectionRow(ES('a'), indexStatus({ coverageState: 'Submitted and indexed', lastCrawlTime: '2026-09-16T04:00:00Z' })),
    inspectionRow(ES('b'), indexStatus({ coverageState: 'Discovered - currently not indexed' })),
    inspectionRow(ES('c'), indexStatus({ coverageState: 'Crawled - currently not indexed', lastCrawlTime: '2026-09-02T04:00:00Z' })),
    inspectionRow(ES('d'), indexStatus({ coverageState: 'Blocked by robots.txt' })),
  ];

  it('counts states, crawls and the cutoff separately', () => {
    const summary = summarize(rows, { since: '2026-09-15' });
    expect(summary.total).toBe(4);
    expect(summary.byState).toEqual({
      indexed: 1, discovered_not_indexed: 1, crawled_not_indexed: 1, blocked_by_robots: 1,
    });
    expect(summary.neverCrawled).toBe(2);
    expect(summary.crawledSince).toBe(1);
    expect(summary.lastCrawlSeen).toBe('2026-09-16T04:00:00Z');
    expect(summary.technicalFaults).toHaveLength(1);
  });
});

describe('diagnose', () => {
  const rowsOf = (state, count) => Array.from({ length: count }, (_, i) =>
    inspectionRow(ES(`c-${state}-${i}`), indexStatus({ coverageState: state })));

  it('calls a discovery problem a discovery problem', () => {
    const notes = diagnose(summarize(rowsOf('Discovered - currently not indexed', 10)));
    expect(notes.map((n) => n.text).join(' ')).toMatch(/DISCOVERY\/crawl-budget/);
  });

  it('says sitemaps will not help once Google has crawled and declined', () => {
    const notes = diagnose(summarize(rowsOf('Crawled - currently not indexed', 10)));
    expect(notes.map((n) => n.text).join(' ')).toMatch(/will not move the number/);
  });

  it('raises a technical fault above every other reading', () => {
    const rows = [...rowsOf('Discovered - currently not indexed', 9), ...rowsOf("Excluded by 'noindex' tag", 1)];
    expect(diagnose(summarize(rows))[0].level).toBe('alert');
  });

  it('surfaces a foreign canonical as an alert, and hedges it', () => {
    const rows = [inspectionRow(ES('a'), indexStatus({
      coverageState: 'Duplicate without user-selected canonical',
      googleCanonical: 'https://competidor.example/a',
    }))];
    const alert = diagnose(summarize(rows)).find((n) => n.level === 'alert');
    expect(alert.text).toMatch(/third party/);
    expect(alert.text).toMatch(/aggregator overlap/);
  });

  it('handles an empty sample without inventing a verdict', () => {
    expect(diagnose(summarize([]))[0].level).toBe('warn');
  });
});

describe('compare', () => {
  const snapshot = (meta, rows) => ({ meta, summary: summarize(rows), rows });
  const META = { seed: 'batch2', size: 2, language: 'es', sitemap: 'a.xml', ranAt: '2026-09-16T00:00:00Z' };

  it('refuses to diff two different samples', () => {
    const current = snapshot(META, []);
    const previous = snapshot({ ...META, seed: 'otra', ranAt: '2026-09-10T00:00:00Z' }, []);
    expect(compare(current, previous)).toMatchObject({ comparable: false, differsBy: ['seed'] });
  });

  it('reports movement between two runs of the same sample', () => {
    const previous = snapshot({ ...META, ranAt: '2026-09-10T00:00:00Z' }, [
      inspectionRow(ES('a'), indexStatus({ coverageState: 'Discovered - currently not indexed' })),
      inspectionRow(ES('b'), indexStatus({ coverageState: 'Discovered - currently not indexed' })),
    ]);
    const current = snapshot(META, [
      inspectionRow(ES('a'), indexStatus({ coverageState: 'Submitted and indexed' })),
      inspectionRow(ES('b'), indexStatus({ coverageState: 'Discovered - currently not indexed' })),
    ]);
    const result = compare(current, previous);
    expect(result.comparable).toBe(true);
    expect(result.shared).toBe(2);
    expect(result.drift).toBe(0);
    expect(result.deltas).toEqual({ indexed: 1, not_crawled: -1 });
    expect(result.newlyIndexed).toEqual([ES('a')]);
    expect(result.lostIndexing).toEqual([]);
  });

  it('diffs only the URLs both runs share, and says how many drifted out', () => {
    // The sample is hash-stable but not frozen: an organic promotion landing in
    // the sitemap can displace a URL. Counting it as movement would invent one.
    const previous = snapshot({ ...META, ranAt: '2026-09-10T00:00:00Z' }, [
      inspectionRow(ES('a'), indexStatus({ coverageState: 'Discovered - currently not indexed' })),
      inspectionRow(ES('vieja'), indexStatus({ coverageState: 'Submitted and indexed' })),
    ]);
    const current = snapshot(META, [
      inspectionRow(ES('a'), indexStatus({ coverageState: 'Submitted and indexed' })),
      inspectionRow(ES('nueva'), indexStatus({ coverageState: 'Discovered - currently not indexed' })),
    ]);
    const result = compare(current, previous);
    expect(result.shared).toBe(1);
    expect(result.drift).toBe(1);
    expect(result.deltas).toEqual({ indexed: 1, not_crawled: -1 });
    expect(result.lostIndexing).toEqual([]);
  });

  it('refuses a diff when the two runs share no URL at all', () => {
    const previous = snapshot({ ...META, ranAt: '2026-09-10T00:00:00Z' }, [
      inspectionRow(ES('vieja'), indexStatus({ coverageState: 'Submitted and indexed' })),
    ]);
    const current = snapshot(META, [
      inspectionRow(ES('nueva'), indexStatus({ coverageState: 'Submitted and indexed' })),
    ]);
    expect(compare(current, previous)).toMatchObject({ comparable: false, differsBy: ['sample'] });
  });

  it('does not report an unknown/discovered flip as movement', () => {
    // Measured 2026-09-16: the same 25 URLs, inspected twice two minutes apart,
    // came back with six reclassified in both directions. Nothing had changed.
    const previous = snapshot({ ...META, ranAt: '2026-09-16T14:09:00Z' }, [
      inspectionRow(ES('a'), indexStatus({ coverageState: 'Discovered - currently not indexed' })),
      inspectionRow(ES('b'), indexStatus({ coverageState: 'URL is unknown to Google' })),
    ]);
    const current = snapshot({ ...META, ranAt: '2026-09-16T14:11:00Z' }, [
      inspectionRow(ES('a'), indexStatus({ coverageState: 'URL is unknown to Google' })),
      inspectionRow(ES('b'), indexStatus({ coverageState: 'Discovered - currently not indexed' })),
    ]);
    const result = compare(current, previous);
    expect(result.deltas).toEqual({});
    expect(result.churn).toBe(2);
  });

  it('reports a first crawl, which is the signal that matters', () => {
    const previous = snapshot({ ...META, ranAt: '2026-09-16T14:09:00Z' }, [
      inspectionRow(ES('a'), indexStatus({ coverageState: 'Discovered - currently not indexed' })),
    ]);
    const current = snapshot({ ...META, ranAt: '2026-09-19T09:00:00Z' }, [
      inspectionRow(ES('a'), indexStatus({
        coverageState: 'Crawled - currently not indexed',
        lastCrawlTime: '2026-09-18T22:14:00Z',
      })),
    ]);
    const result = compare(current, previous);
    expect(result.newlyCrawled).toEqual([ES('a')]);
    expect(result.deltas).toEqual({ crawled_declined: 1, not_crawled: -1 });
    expect(result.churn).toBe(0);
  });

  it('is a no-op without a previous run', () => {
    expect(compare(snapshot(META, []), null)).toBeNull();
  });
});

describe('bandOf', () => {
  it('folds the two unstable pre-crawl states into one band', () => {
    expect(bandOf('unknown_to_google')).toBe('not_crawled');
    expect(bandOf('discovered_not_indexed')).toBe('not_crawled');
  });

  it('keeps the states that mean something different apart', () => {
    expect(bandOf('crawled_not_indexed')).toBe('crawled_declined');
    expect(bandOf('duplicate')).toBe('folded');
    expect(bandOf('alternate_canonical')).toBe('folded');
    expect(bandOf('indexed')).toBe('indexed');
    expect(bandOf('blocked_by_robots')).toBe('fault');
    expect(bandOf('something-new')).toBe('unclassified');
  });
});
