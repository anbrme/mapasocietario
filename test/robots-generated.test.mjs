import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.resolve(__dirname, '..', rel), 'utf8');

// public/robots.txt is GENERATED. scripts/generate-seo-files.mjs builds the
// whole file as one template literal and writeFileSync's it on every build, so
// anything hand-added to the output file survives exactly until the next
// `npm run build` and then disappears with no error and no diff anyone reads.
//
// That already happened: the comment explaining why /verificacion is
// deliberately NOT disallowed was edited into public/robots.txt and was absent
// from the generator, so every build silently deleted it (caught 2026-09-18).
// The comment is load-bearing — it is the only record of why a Disallow that
// looks obviously correct would in fact de-index the verification front door.
//
// So the invariant is stronger than "this one comment exists": every comment
// line in the generated file must come FROM the generator.

test('every comment in robots.txt comes from the generator, not a hand-edit', () => {
  const generator = read('scripts/generate-seo-files.mjs');
  const robots = read('public/robots.txt');

  const comments = robots
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('#'));

  assert.ok(comments.length > 0, 'robots.txt should carry its rationale comments');

  for (const comment of comments) {
    assert.ok(
      generator.includes(comment),
      `robots.txt line ${JSON.stringify(comment)} is not in scripts/generate-seo-files.mjs, ` +
        'so the next build will delete it. Move it into the generator.',
    );
  }
});

test('the /verificacion rationale is in the generator', () => {
  // Named explicitly as well as covered by the sweep above: this is the one
  // whose loss would cause a real de-indexing, so it gets its own failure.
  const generator = read('scripts/generate-seo-files.mjs');
  assert.match(generator, /\/verificacion is deliberately NOT disallowed/);
  assert.match(
    generator,
    /Disallow: \/verificacion, no \//,
    'the trailing-slash trap is the actionable half of the warning',
  );
});
