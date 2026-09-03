import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

// The "ver el mapa" CTAs linked to /app/?search=<name> and nothing else.
// /app reads `gk` (App.jsx) and hands it to handleSearch as groupKeyOverride —
// the same argument an in-graph selection supplies. Without it the click re-ran
// a fuzzy NAME search on arrival, so a visitor leaving a company page could land
// on a sibling doc with a similar name and be counted as graph engagement.
//
// `source` is the other half: /app reads it into graph_view.entry_source, so
// arrivals from an indexed profile become separable from every other entry —
// which is the whole point of asking what a search lander does next.

const base = { company_name: 'ACME CONSULTING SL', company_type: 'SL', province: 'Madrid' };
const graphLinks = (html) =>
  [...html.matchAll(/href="(\/app\/\?[^"]*)"/g)].map((m) => m[1]);

test('every graph CTA binds to the legal entity and names its surface', () => {
  const html = renderCompanyPage({ ...base, _id: 'grp_abc123' }, [], 'acme-consulting-sl', null, 'es');
  const links = graphLinks(html);

  // Bottom CTA, relationship overview, overlay escape, and framed graph URL
  // remain links. The early mobile hero CTA is deliberately a button now: it
  // opens the same full-screen lazy overlay without losing the profile page.
  // The count is the guard: it is what makes a NEW graph link impossible to
  // add without coming through this binding check.
  assert.equal(links.length, 4, `expected 4 graph links, got ${JSON.stringify(links)}`);
  assert.match(html, /<button[^>]*class="hero-primary"[^>]*data-open-graph/);
  for (const href of links) {
    assert.match(href, /(\?|&amp;)gk=grp_abc123(&amp;|$)/, `missing gk: ${href}`);
    assert.match(href, /(\?|&amp;)source=company_profile(&amp;|$)/, `missing source: ${href}`);
    assert.match(href, /(\?|&amp;)search=ACME(\+|%20)CONSULTING(\+|%20)SL(&amp;|$)/, `missing search: ${href}`);
  }
});

test('the group key is escaped for HTML and its separators with it', () => {
  const html = renderCompanyPage({ ...base, _id: 'H:M-584035' }, [], 'acme-consulting-sl', null, 'es');
  const [href] = graphLinks(html);
  assert.match(href, /gk=H%3AM-584035/);
  // Raw & in an href is invalid HTML5; browsers decode &amp; back to &.
  assert.match(href, /&amp;/);
  assert.doesNotMatch(href, /&(?!amp;)/);
});

test('an explicit group_key outranks the document id', () => {
  const html = renderCompanyPage(
    { ...base, group_key: 'grp_canonical', _id: 'grp_doc' }, [], 'acme-consulting-sl', null, 'es');
  assert.match(graphLinks(html)[0], /gk=grp_canonical(&|&amp;|$)/);
});

test('a seed page falls back to the registry hoja, the identity that never changes', () => {
  const html = renderCompanyPage(
    base, [], 'acme-consulting-sl', { name: 'ACME', hoja: 'M-584035' }, 'es');
  assert.match(graphLinks(html)[0], /gk=H%3AM-584035/);
});

test('a document with no stable identity omits gk rather than guessing one', () => {
  const html = renderCompanyPage(base, [], 'acme-consulting-sl', null, 'es');
  const links = graphLinks(html);
  assert.equal(links.length, 4);
  for (const href of links) {
    assert.doesNotMatch(href, /(\?|&amp;)gk=/, `guessed a gk: ${href}`);
    assert.match(href, /source=company_profile/);
  }
});
