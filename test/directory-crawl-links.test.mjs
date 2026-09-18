import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.resolve(__dirname, '..', rel), 'utf8');

// Why these are pinned by a test.
//
// A URL Inspection sample on 2026-09-16 (scripts/gsc-inspect-sample.mjs) found
// that of 25 promoted company pages from batch 2, ZERO had ever been crawled
// and thirteen were unknown to Google — eleven days after promotion. The link
// graph was the reason: NOTHING on the site linked to /directorio, so the hubs
// listing every promoted page were reachable only from a sitemap, and a sitemap
// asserts that a URL exists, not that it matters.
//
// The homepage link is the fragile half. The landing page is a React SPA whose
// crawlable content is a hand-written block in scripts/prerender.mjs; React
// replaces it on hydration. A link added to LandingPage.jsx alone is invisible
// to Googlebot — which is exactly what happened on the first attempt at this
// change, and what this test exists to stop happening again.
//
// Updated 2026-09-18. The fix above was Spanish-only: every hub link on the
// site pointed at /directorio, which lists /empresa/* URLs exclusively, so an
// English page handed the crawler straight out of the English mesh. A fresh
// sample that day measured the cost — ES 32% indexed against EN 16%, with
// crawl→index conversion at 100%/80%, i.e. pure discovery starvation. So each
// assertion below is now per language: a page must link ITS OWN hub, and the
// EN half of every pair is what these tests are really guarding.

/**
 * The source text of ONE route object in scripts/prerender.mjs, by its path.
 * Scoped on purpose: a /directorio link in any other route must not satisfy
 * the homepage assertion.
 */
function routeBlock(prerender, routePath) {
  // Route objects open with "\n  {\n"; `path` is not necessarily their first key.
  const blocks = prerender.split(/\n  \{\n/);
  const block = blocks.find((b) => b.includes(`\n    path: '${routePath}',\n`) || b.startsWith(`    path: '${routePath}',`));
  assert.ok(block, `route ${routePath} must exist in scripts/prerender.mjs`);
  return block;
}

test('the crawler-visible homepage links the province directory, in both languages', () => {
  const prerender = read('scripts/prerender.mjs');
  for (const [routePath, hub, label] of [
    ['/', '/en/directory', 'Company directory by province'],
    ['/es', '/directorio', 'Directorio de empresas por provincia'],
  ]) {
    const block = routeBlock(prerender, routePath);
    assert.match(block, /staticContent:/, `${routePath} must carry a static block`);
    assert.ok(block.includes(`<a href="${hub}">${label}</a>`), `${routePath} static block must link ${hub}`);
  }
});

test('the hydrated homepage links it too, so readers get the same door', () => {
  const landing = read('src/components/LandingPage.jsx');
  // A plain anchor: the hubs are server-rendered, so client routing 404s. And
  // the href is per language, or an EN reader lands on the Spanish hub.
  assert.match(
    landing,
    /component="a"\s+href=\{lang === 'es' \? '\/directorio' : '\/en\/directory'\}/,
    'the hydrated quick link must resolve the hub per language',
  );
  const copy = read('src/components/landingCopy.jsx');
  assert.match(copy, /directory: 'Company directory by province'/);
  assert.match(copy, /directory: 'Directorio de empresas por provincia'/);
});

test('every company page links the directory from its footer', () => {
  // ~4,000 inbound links, which is what takes the hub out of orphan status.
  const lib = read('functions/empresa/_lib.js');
  assert.match(lib, /footerDirectory: '<a href="\/directorio">Directorio de empresas por provincia<\/a>'/);
  assert.match(lib, /footerDirectory: '<a href="\/en\/directory">Company directory by province<\/a>'/);
  assert.match(lib, /\$\{t\.footerDirectory\}/, 'the footer must actually render it');
});

test('the English hub exists as a route, not just as a link target', () => {
  // Every EN link added above is a 404 without these two files; Cloudflare
  // Pages routes them by path, so their names ARE the contract.
  for (const rel of ['functions/en/directory/index.js', 'functions/en/directory/[province].js']) {
    assert.doesNotThrow(() => read(rel), `${rel} must exist`);
  }
  const paths = read('functions/directorio/_paths.js');
  assert.match(paths, /'\/en\/directory'/);
  // _paths.js must stay import-free: functions/empresa/_siblings.js imports it,
  // and _siblings.js is imported by empresa/_lib.js, which directorio/_lib.js
  // imports for HUB_STYLE. Any import here closes that loop into a cycle.
  assert.doesNotMatch(paths, /^import /m, '_paths.js must have no imports (see its header)');
});
