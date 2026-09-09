import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The extension carries its own copy of the app's position classifier (a Chrome
// bundle can't import from ../src). The copy silently fell three fixes behind
// once already — committee chairs then classified as board "Presidente" and were
// drawn on the board-only graph. This guard fails the build the next time the
// app's file moves and the copy doesn't.
const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const BEGIN = '// ─── BEGIN verbatim copy of src/utils/positionCategories.js ───\n';
const END = '// ─── END verbatim copy ───';

describe('positionCategories copy', () => {
  it('holds the app classifier verbatim', () => {
    const copy = read('../../src/shared/positionCategories.js');
    const app = read('../../../src/utils/positionCategories.js');
    const start = copy.indexOf(BEGIN);
    const end = copy.indexOf(END);
    expect(start, 'copy is missing the BEGIN marker').toBeGreaterThan(-1);
    expect(end, 'copy is missing the END marker').toBeGreaterThan(start);
    expect(copy.slice(start + BEGIN.length, end).trim()).toBe(app.trim());
  });
});
