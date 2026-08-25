// Pure view-model for the graph's empty state — the invitation shown on a blank
// canvas before the first search. No rendering deps, so it runs under the
// node-env unit test config; the MUI markup lives in GraphEmptyState.jsx.
//
// Why it exists: /app used to render a literally empty canvas on first load.
// The interaction hints (legend line, ?guide=1, the PDF guide) all describe a
// graph the first-time visitor has not drawn yet, so the one moment that
// matters — "what do I do with this?" — was unanswered.

import { SEED, hojaGroupKey } from '../../functions/empresa/_ibex35.js';

// Curated starting points, in display order. Chosen to show the product in one
// click: a dense board (BBVA), the most internationally recognisable name
// (Inditex), and a large subsidiary structure (Iberdrola).
export const GRAPH_EXAMPLE_SLUGS = ['bbva', 'inditex', 'iberdrola'];

/**
 * Resolve a curated slug to everything a chip needs to run a search.
 *
 * Reads the SAME verified seed the /empresa pages key on, so the example names
 * cannot drift from the registry: `v3Name` is the name the registry prints and
 * `hoja` is the stable entity key. Searching by name alone fuzzy-matches
 * sibling entities — the brand "INDITEX, SA" is a different company from the
 * registered "INDUSTRIA DE DISEÑO TEXTIL, S.A." — so the group key travels with
 * every chip and pins the search to the intended entity.
 *
 * Throws if a slug is missing, so a future seed edit fails loudly here instead
 * of silently shipping a chip that searches an empty string.
 *
 * @param {string} slug
 * @returns {{ slug: string, label: string, v3Name: string, groupKey: string }}
 */
function resolveExample(slug) {
  const seed = SEED[slug];
  if (!seed) {
    throw new Error(`graphEmptyStateView: unknown IBEX 35 seed slug "${slug}"`);
  }
  return {
    slug,
    label: seed.name,
    v3Name: seed.v3Name,
    groupKey: hojaGroupKey(seed.hoja),
  };
}

/**
 * @param {object} p
 * @param {object} p.copy - the graph's language dictionary
 * @param {string[]} [p.slugs] - override the curated set (tests)
 * @returns {{ title: string, body: string, examplesLabel: string,
 *             examples: {slug: string, label: string, v3Name: string, groupKey: string}[] }}
 */
export function graphEmptyStateView({ copy, slugs = GRAPH_EXAMPLE_SLUGS }) {
  return {
    title: copy.emptyTitle,
    body: copy.emptyBody,
    examplesLabel: copy.emptyExamplesLabel,
    examples: slugs.map(resolveExample),
  };
}

/**
 * The canvas is blank and nothing is on its way to fill it.
 *
 * A failed search also leaves zero nodes, but it leaves an error alert with it;
 * re-inviting the user to search on top of "No results found for X" reads as
 * the app having lost their query, so the error suppresses the invitation.
 *
 * @param {object} p
 * @param {number} p.nodeCount
 * @param {boolean} p.isSearching
 * @param {boolean} p.isLoading
 * @param {string|null} p.error
 * @returns {boolean}
 */
export function shouldShowGraphEmptyState({ nodeCount, isSearching, isLoading, error }) {
  return nodeCount === 0 && !isSearching && !isLoading && !error;
}
