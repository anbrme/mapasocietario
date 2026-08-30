/**
 * GA4 reads the page dimension from `page_location`, never from `page_path` —
 * the latter is a Universal Analytics field that gtag silently drops. Every
 * page_view we send is hand-rolled (send_page_view is false everywhere), and
 * the snippet is duplicated across four surfaces, so a regression here is a
 * copy-paste away and invisible in the GA4 UI: paths keep arriving, they are
 * just the browser's raw URL instead of the canonical one we meant to send.
 */
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Every file that sends a page_view, with how many it is expected to send.
const PAGE_VIEW_SURFACES = [
  { file: 'src/hooks/usePageTracking.js', count: 1 },
  { file: 'public/ga4-pageview.js', count: 1 },
  // One shared GA_SNIPPET serves both server-rendered pages; the company page
  // and the province hub each interpolate it (asserted separately below).
  { file: 'functions/empresa/_lib.js', count: 1 },
];

// The parameter object of a gtag page_view call, however it is spelled.
function pageViewCalls(source) {
  const calls = [];
  const marker = /page_view['"]\s*,\s*\{/g;
  let match;
  while ((match = marker.exec(source)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth += 1;
      if (source[i] === '}') depth -= 1;
      i += 1;
    }
    calls.push(source.slice(start, i - 1));
  }
  return calls;
}

for (const { file, count } of PAGE_VIEW_SURFACES) {
  test(`${file} sends page_location on every page_view`, () => {
    const calls = pageViewCalls(readFileSync(join(ROOT, file), 'utf8'));
    assert.equal(calls.length, count, `expected ${count} page_view call(s) in ${file}`);
    for (const params of calls) {
      assert.match(params, /page_location\s*:/, `page_view in ${file} is missing page_location`);
      assert.doesNotMatch(params, /page_path\s*:/, `page_view in ${file} still sends the UA-only page_path`);
    }
  });
}

test('both server-rendered pages use the shared GA snippet', () => {
  const source = readFileSync(join(ROOT, 'functions/empresa/_lib.js'), 'utf8');
  const uses = source.match(/\$\{GA_SNIPPET\}/g) || [];
  assert.equal(uses.length, 2, 'company page and province hub must share one snippet');
});

// The guard above only watches the four page_view surfaces, and `view_item`
// carried page_path past it for months. GA4 attaches page_location to EVERY
// event by itself, so a hand-sent page_path is redundant wherever it appears —
// and being unregistered, it was never readable in the first place. Widen the
// net to any event, not just page_view.
test('no GA4 event anywhere sends the UA-only page_path', () => {
  const offenders = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(js|jsx|mjs)$/.test(entry.name)) continue;
      readFileSync(full, 'utf8').split('\n').forEach((line) => {
        if (/^\s*page_path\s*:/.test(line)) {
          offenders.push(`${full.slice(ROOT.length + 1)}: ${line.trim()}`);
        }
      });
    }
  };

  for (const root of ['src', 'functions', 'public']) walk(join(ROOT, root));

  assert.deepEqual(offenders, [], `page_path is a Universal Analytics field gtag drops:\n${offenders.join('\n')}`);
});
