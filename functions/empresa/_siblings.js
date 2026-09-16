/**
 * "Other companies in <province>" — the sibling links at the foot of a company
 * page.
 *
 * Why this block exists. Measured 2026-09-16 with the URL Inspection sample
 * (scripts/gsc-inspect-sample.mjs): of 25 URLs from batch 2, ZERO had ever been
 * crawled, thirteen were not even known to Google — eleven days after the batch
 * was promoted and submitted. The link graph explains it. Nothing on the site
 * linked to /directorio, so the hubs that list these pages were themselves
 * orphans reachable only from a sitemap, and each company page was a dead end
 * that linked to no other company. A sitemap tells Google a URL EXISTS;
 * internal links tell it the URL MATTERS, and Google crawls by the second.
 *
 * So the block is not a navigation nicety. It is the edge that turns 4,000
 * isolated pages into a graph a crawler can walk, and it is also what a reader
 * on a company page plausibly wants next.
 *
 * Pure (no D1, no network): _demand.js fetches the neighbours, this arranges and
 * renders them. The `_` prefix means Cloudflare Pages does not route this file.
 */

import { nameToSlug } from './_slug.js';

// Below this the block is noise rather than a mesh — a heading and one link.
export const MIN_SIBLINGS = 2;

/**
 * Interleave the two neighbour lists into one alphabetical run of at most
 * `limit`, taking from the far side when one side runs short (a company whose
 * name sorts first in its province has no "before" neighbours, and would
 * otherwise get half a block).
 *
 * `before` arrives DESC (nearest first) and is reversed back into reading order.
 */
export function balanceNeighbours({ before = [], after = [], limit = 10 } = {}) {
  const half = Math.floor(limit / 2);
  const takeBefore = Math.min(before.length, Math.max(half, limit - after.length));
  const chosenBefore = before.slice(0, takeBefore);
  const chosenAfter = after.slice(0, limit - chosenBefore.length);

  const seen = new Set();
  return [...chosenBefore.reverse(), ...chosenAfter]
    .filter((row) => {
      const slug = row?.slug;
      if (!slug || seen.has(slug)) return false;
      seen.add(slug);
      return true;
    })
    .slice(0, limit);
}

/**
 * @param {object} args
 * @param {{before: Array, after: Array}} args.neighbours  from listPromotedSiblings
 * @param {string} args.province      display name, as the company record spells it
 * @param {function} args.companyPath (lang, slug) => path, so ES and EN pages
 *                                    link to their own language variant
 * @param {function} args.esc         the caller's HTML escaper
 * @returns {string} HTML, or '' when there is nothing worth rendering
 */
export function renderSiblingsBlock({
  neighbours, province, lang = 'es', t, companyPath, esc, limit = 10,
}) {
  if (!province || !t) return '';
  const siblings = balanceNeighbours({ ...(neighbours || {}), limit });
  if (siblings.length < MIN_SIBLINGS) return '';

  const items = siblings
    .map((row) => `<li><a href="${esc(companyPath(lang, row.slug))}">${esc(row.canonical_name)}</a></li>`)
    .join('');

  return `<h2>${esc(t.siblingsTitle(province))}</h2>
  <ul class="siblings">${items}</ul>
  <p class="more"><a href="/directorio/${esc(nameToSlug(province))}">${esc(t.siblingsAll(province))}</a></p>`;
}
