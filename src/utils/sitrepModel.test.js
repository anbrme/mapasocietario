import { describe, expect, it } from 'vitest';
import { annexRows, hasAnnexes } from './sitrepModel';

// These cover only the author-layer addition to annexRows/hasAnnexes; the
// rest of the document model's annex behaviour (companies, connectors,
// ownership, corrections) already has coverage through
// investigationExport/documentSections.test.js, which imports these same
// functions.

const emptyAuthorLayer = {
  nodes: [], links: [], dismissed: [], renamed: [],
};

const baseDoc = {
  steps: [], companies: [], connectors: [], ownership: [], corrections: [],
};

describe('annexRows authorLayer', () => {
  it('passes the document authorLayer through unchanged', () => {
    const authorLayer = {
      nodes: [{ nodeId: 'n1', name: 'P' }],
      links: [{ from: 'P', to: 'C', label: 'Director' }],
      dismissed: [],
      renamed: [],
    };
    const doc = { ...baseDoc, authorLayer };

    expect(annexRows(doc).authorLayer).toBe(authorLayer);
  });

  it('defaults authorLayer to empty arrays when the document has none', () => {
    expect(annexRows(baseDoc).authorLayer).toEqual(emptyAuthorLayer);
  });
});

describe('hasAnnexes with only an author layer', () => {
  it('is true when only author nodes are present', () => {
    const doc = { ...baseDoc, authorLayer: { ...emptyAuthorLayer, nodes: [{ nodeId: 'n1', name: 'P' }] } };
    expect(hasAnnexes(doc)).toBe(true);
  });

  it('is true when only author links are present', () => {
    const doc = { ...baseDoc, authorLayer: { ...emptyAuthorLayer, links: [{ from: 'A', to: 'B' }] } };
    expect(hasAnnexes(doc)).toBe(true);
  });

  it('is true when only dismissed links are present', () => {
    const doc = { ...baseDoc, authorLayer: { ...emptyAuthorLayer, dismissed: [{ from: 'A', to: 'B' }] } };
    expect(hasAnnexes(doc)).toBe(true);
  });

  it('is true when only renamed nodes are present', () => {
    const doc = { ...baseDoc, authorLayer: { ...emptyAuthorLayer, renamed: [{ nodeId: 'n1', name: 'X' }] } };
    expect(hasAnnexes(doc)).toBe(true);
  });

  it('is false when everything, including the author layer, is empty', () => {
    expect(hasAnnexes({ ...baseDoc, authorLayer: emptyAuthorLayer })).toBe(false);
  });

  it('is false when the author layer is entirely absent, same as before this feature', () => {
    expect(hasAnnexes(baseDoc)).toBe(false);
  });
});
