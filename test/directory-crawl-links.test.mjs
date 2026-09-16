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
  for (const [routePath, label] of [['/', 'Company directory by province'], ['/es', 'Directorio de empresas por provincia']]) {
    const block = routeBlock(prerender, routePath);
    assert.match(block, /staticContent:/, `${routePath} must carry a static block`);
    assert.ok(block.includes(`<a href="/directorio">${label}</a>`), `${routePath} static block must link /directorio`);
  }
});

test('the hydrated homepage links it too, so readers get the same door', () => {
  const landing = read('src/components/LandingPage.jsx');
  assert.match(landing, /href="\/directorio"/);
  // A plain anchor: /directorio is server-rendered, so client routing 404s.
  assert.match(landing, /component="a"\s+href="\/directorio"/);
  const copy = read('src/components/landingCopy.jsx');
  assert.match(copy, /directory: 'Company directory by province'/);
  assert.match(copy, /directory: 'Directorio de empresas por provincia'/);
});

test('every company page links the directory from its footer', () => {
  // ~4,000 inbound links, which is what takes the hub out of orphan status.
  const lib = read('functions/empresa/_lib.js');
  assert.match(lib, /footerDirectory: '<a href="\/directorio">Directorio de empresas por provincia<\/a>'/);
  assert.match(lib, /footerDirectory: '<a href="\/directorio">Company directory by province<\/a>'/);
  assert.match(lib, /\$\{t\.footerDirectory\}/, 'the footer must actually render it');
});
