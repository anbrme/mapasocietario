import { describe, expect, it } from 'vitest';
import { contrastRatio, parseColor } from './contrast';
import { DARK_TOKENS, LIGHT_TOKENS, TOKENS_BY_MODE } from './palette';

// Walks a nested token object into flat dotted paths, e.g. "graph.node.company".
const flatten = (value, prefix = '') =>
  Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return entry && typeof entry === 'object' ? flatten(entry, path) : [[path, entry]];
  });

const pathsOf = tokens => flatten(tokens).map(([path]) => path).sort();

// Groups whose values are drawn directly on the canvas and must therefore clear
// the 3:1 non-text contrast floor. Excluded: surface (the canvas itself, plus
// halos and label colours), badge *Text, chip.outline and marker.* — all of
// which render on top of a coloured shape, not on the canvas.
const CONTRAST_GROUPS = ['node', 'link', 'ring', 'noteFlag'];
const CONTRAST_KEYS_IN_MIXED_GROUPS = {
  badge: ['unified', 'cargo'],
  chip: ['active', 'former'],
};

const MIN_CONTRAST = 3;

describe('palette parity', () => {
  it('exposes exactly the two modes', () => {
    expect(Object.keys(TOKENS_BY_MODE).sort()).toEqual(['dark', 'light']);
    expect(TOKENS_BY_MODE.dark).toBe(DARK_TOKENS);
    expect(TOKENS_BY_MODE.light).toBe(LIGHT_TOKENS);
  });

  it('defines the same token paths in both modes', () => {
    expect(pathsOf(LIGHT_TOKENS)).toEqual(pathsOf(DARK_TOKENS));
  });

  it('defines every token the graph canvas reads', () => {
    const paths = pathsOf(DARK_TOKENS);
    for (const required of [
      'graph.surface.canvas',
      'graph.surface.nodeFill',
      'graph.surface.label',
      'graph.surface.labelSubtle',
      'graph.surface.labelHalo',
      'graph.surface.badgeHalo',
      'graph.surface.arrowOutline',
      'graph.node.company',
      'graph.node.officerIndividual',
      'graph.node.officerCompany',
      'graph.node.expanded',
      'graph.node.selected',
      'graph.node.searchOrigin',
      'graph.link.appointment',
      'graph.link.cessation',
      'graph.link.ownership',
      'graph.link.ownershipPrevious',
      'graph.link.ownershipLost',
      'graph.link.unknown',
      'graph.link.dissolved',
      'graph.link.pathHighlight',
      'graph.badge.unified',
      'graph.badge.unifiedText',
      'graph.badge.cargo',
      'graph.badge.cargoText',
      'graph.chip.active',
      'graph.chip.former',
      'graph.chip.outline',
      'graph.ring.investigation',
      'graph.ring.merged',
      'graph.marker.noteOutline',
      'graph.marker.noteGlyph',
      'graph.noteFlag.none',
      'graph.noteFlag.amber',
      'graph.noteFlag.red',
      'graph.noteFlag.blue',
      'graph.noteFlag.green',
    ]) {
      expect(paths).toContain(required);
    }
  });
});

describe.each([['dark', DARK_TOKENS], ['light', LIGHT_TOKENS]])('%s tokens', (mode, tokens) => {
  it('uses only parseable colour values', () => {
    for (const [path, value] of flatten(tokens)) {
      expect(parseColor(value), `${mode}.${path} = ${value}`).not.toBeNull();
    }
  });

  it('renders a dissolved link exactly like a cessation link', () => {
    expect(tokens.graph.link.dissolved).toBe(tokens.graph.link.cessation);
  });

  it('clears the 3:1 non-text contrast floor against its own canvas', () => {
    const canvas = tokens.graph.surface.canvas;

    for (const group of CONTRAST_GROUPS) {
      for (const [key, value] of Object.entries(tokens.graph[group])) {
        const ratio = contrastRatio(value, canvas);
        expect(ratio, `${mode}.graph.${group}.${key} (${value}) vs canvas ${canvas}`)
          .toBeGreaterThanOrEqual(MIN_CONTRAST);
      }
    }

    for (const [group, keys] of Object.entries(CONTRAST_KEYS_IN_MIXED_GROUPS)) {
      for (const key of keys) {
        const value = tokens.graph[group][key];
        const ratio = contrastRatio(value, canvas);
        expect(ratio, `${mode}.graph.${group}.${key} (${value}) vs canvas ${canvas}`)
          .toBeGreaterThanOrEqual(MIN_CONTRAST);
      }
    }
  });

  it('keeps the expanded node distinguishable from an appointment link', () => {
    expect(tokens.graph.node.expanded).not.toBe(tokens.graph.link.appointment);
  });

  it('keeps node labels legible against the node fill', () => {
    expect(contrastRatio(tokens.graph.surface.label, tokens.graph.surface.nodeFill))
      .toBeGreaterThanOrEqual(4.5);
  });
});
