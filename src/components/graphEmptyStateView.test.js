import { describe, it, expect } from 'vitest';
import {
  GRAPH_EXAMPLE_SLUGS,
  graphEmptyStateView,
  shouldShowGraphEmptyState,
} from './graphEmptyStateView';

// The subset of the graph's copy dictionary the empty state reads. Real English
// strings, so a regression that blanks the invitation is caught by content.
const copy = {
  emptyTitle: 'Search a company or a person to begin',
  emptyBody:
    'Type a name in the search box above to draw its network of officers, subsidiaries and related companies.',
  emptyExamplesLabel: 'Or start with one of these:',
};

describe('graphEmptyStateView', () => {
  it('passes the supplied copy through untouched', () => {
    const v = graphEmptyStateView({ copy });
    expect(v.title).toBe(copy.emptyTitle);
    expect(v.body).toBe(copy.emptyBody);
    expect(v.examplesLabel).toBe(copy.emptyExamplesLabel);
  });

  it('resolves every curated slug against the IBEX 35 seed', () => {
    const v = graphEmptyStateView({ copy });
    expect(v.examples).toHaveLength(GRAPH_EXAMPLE_SLUGS.length);
    v.examples.forEach(example => {
      expect(example.label).toBeTruthy();
      expect(example.v3Name).toBeTruthy();
    });
  });

  it('keeps the curated order', () => {
    const v = graphEmptyStateView({ copy });
    expect(v.examples.map(e => e.slug)).toEqual(['bbva', 'inditex', 'iberdrola']);
    expect(v.examples.map(e => e.label)).toEqual(['BBVA', 'Inditex', 'Iberdrola']);
  });

  it('carries a stable registry group key for each example', () => {
    const v = graphEmptyStateView({ copy });
    expect(v.examples.map(e => e.groupKey)).toEqual(['H:BI-17', 'H:C-3342', 'H:BI-167']);
    v.examples.forEach(example => {
      expect(example.groupKey).toMatch(/^H:[A-Z]+-\d+$/);
    });
  });

  // The whole reason the chips are seed-backed: searching the BRAND resolves to
  // a different entity than the registered one. The chip must carry the name the
  // registry actually prints, paired with the hoja-derived key.
  it('uses the registered name for Inditex, never the brand', () => {
    const inditex = graphEmptyStateView({ copy }).examples.find(e => e.slug === 'inditex');
    expect(inditex.v3Name).toBe('INDUSTRIA DE DISEÑO TEXTIL, S.A.');
    expect(inditex.v3Name).not.toBe('INDITEX, SA');
  });

  it('throws if a curated slug no longer exists in the seed', () => {
    expect(() => graphEmptyStateView({ copy, slugs: ['bbva', 'not-a-real-slug'] })).toThrow(
      /not-a-real-slug/
    );
  });
});

describe('shouldShowGraphEmptyState', () => {
  const idle = { nodeCount: 0, isSearching: false, isLoading: false, error: null };

  it('shows on a blank idle canvas', () => {
    expect(shouldShowGraphEmptyState(idle)).toBe(true);
  });

  it('hides as soon as the graph has nodes', () => {
    expect(shouldShowGraphEmptyState({ ...idle, nodeCount: 1 })).toBe(false);
  });

  it('hides while a search is in flight', () => {
    expect(shouldShowGraphEmptyState({ ...idle, isSearching: true })).toBe(false);
    expect(shouldShowGraphEmptyState({ ...idle, isLoading: true })).toBe(false);
  });

  // A failed search leaves zero nodes AND an error alert. Re-inviting the user
  // to search on top of "No results found for X" reads as the app losing state.
  it('hides while an error is displayed', () => {
    expect(shouldShowGraphEmptyState({ ...idle, error: 'No results found for "X".' })).toBe(false);
  });
});
