import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The site is served by Cloudflare Pages with NO SPA catch-all: unmatched paths
 * get 404.html and a real 404 status. That is deliberate (see public/_redirects),
 * and it makes public/_redirects load-bearing — a client-only route with no
 * rewrite there is a 404 in production and works fine in `vite dev`, which is
 * the worst possible failure mode. These tests are the tripwire.
 */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(projectRoot, rel), 'utf8');

const routes = [...read('src/main.jsx').matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
const prerendered = new Set(
  [...read('scripts/prerender.mjs').matchAll(/^\s{4}path: '([^']+)'/gm)].map((m) => m[1]),
);
const rewrites = read('public/_redirects')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split(/\s+/));

/**
 * /es/:slug is the one parameterised route with no rewrite: SpanishSeoPage
 * serves a fixed map of four page keys and every one of them is prerendered,
 * so an unknown /es/<slug> SHOULD 404 rather than render an empty shell. The
 * test below verifies that claim instead of taking it on trust.
 */
const PARAMETERISED_ROUTES_SERVED_BY_PRERENDER = new Set(['/es/:slug']);

// Extensionless on purpose: Pages 308s "/app-shell.html" to "/app-shell", and a
// rewrite pointing at the redirected form answers with the 308, not the page.
const SPA_SHELL = '/app-shell';

const hasRewrite = (routePath) => {
  const concrete = routePath.replace(/:[^/]+/g, 'x');
  return rewrites.some(([source, destination, code]) => {
    if (destination !== SPA_SHELL || code !== '200') return false;
    return source.endsWith('/*')
      ? concrete.startsWith(source.slice(0, -1))
      : source === concrete;
  });
};

test('every client-only route is prerendered or rewritten in _redirects', () => {
  const orphans = routes.filter(
    (routePath) =>
      !prerendered.has(routePath) &&
      !hasRewrite(routePath) &&
      !PARAMETERISED_ROUTES_SERVED_BY_PRERENDER.has(routePath),
  );
  assert.deepEqual(
    orphans,
    [],
    `these routes would 404 in production — add them to public/_redirects or prerender them: ${orphans.join(', ')}`,
  );
});

test('every /es/:slug page SpanishSeoPage can render is prerendered', () => {
  const slugs = [...read('src/components/SpanishSeoPage.jsx').matchAll(/^ {2}'([a-z0-9-]+)': \{/gm)].map(
    (m) => m[1],
  );
  assert.ok(slugs.length > 0, 'found no page keys in SpanishSeoPage — the parser needs updating');
  for (const slug of slugs) {
    assert.ok(
      prerendered.has(`/es/${slug}`),
      `/es/${slug} renders client-side but is not prerendered, so it 404s on a cold load`,
    );
  }
});

test('_redirects has no SPA catch-all, and 404.html exists to take its place', () => {
  assert.ok(
    !rewrites.some(([source]) => source === '/*'),
    'a /* catch-all makes every scanner probe answer 200 with the app shell',
  );
  // Pages picks custom-404 serving over SPA serving by the presence of this file.
  assert.match(read('public/404.html'), /<title>.*not found.*<\/title>/i);
});

test('prerender writes the shell the rewrites point at', () => {
  const prerender = read('scripts/prerender.mjs');
  assert.match(prerender, /writeFileSync\(path\.join\(distDir, 'app-shell\.html'\)/);
  assert.ok(
    rewrites.every(([, destination]) => destination === SPA_SHELL),
    `_redirects points somewhere other than ${SPA_SHELL}, which prerender.mjs is what produces`,
  );
});

test('every robots.txt group repeats the crawl-trap disallows', () => {
  const groups = read('public/robots.txt')
    .split(/\n(?=User-agent:)/)
    .filter((block) => block.includes('User-agent:'));
  assert.ok(groups.length > 1, 'expected per-crawler groups in robots.txt');
  for (const group of groups) {
    const agent = group.match(/User-agent:\s*(\S+)/)[1];
    // robots.txt groups do not inherit: a crawler obeys only the most specific
    // group matching its name, so each one needs its own copy.
    for (const trap of ['/app/?*search=', '/app/?*gk=', '/due-diligence/?*company=']) {
      assert.ok(
        group.includes(`Disallow: ${trap}`),
        `group "${agent}" is missing "Disallow: ${trap}" and is therefore exempt from the crawl trap`,
      );
    }
  }
});
