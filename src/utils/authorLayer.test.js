import { describe, it, expect } from 'vitest';
import {
  AUTHOR_LINK_TYPE, AUTHOR_LINK_PREFIX, AUTHOR_NODE_PREFIX,
  isAuthorLink, isAuthorNode, isAuthorElement, isRegistryElement, isDismissedLink, isRenamedNode,
  validateAuthorLinkDraft, validateAuthorNodeDraft,
  makeAuthorLink, makeAuthorNode, dismissLink, restoreLink, markRenamed, removeAuthorNode,
  visibleWithoutDismissed, collectAuthorLayer,
} from './authorLayer';

const NOW = '2026-09-17T10:00:00.000Z';

describe('predicates', () => {
  it('treats an element without provenance as registry', () => {
    const link = { id: 'l1', source: 'a', target: 'b', type: 'officer-company' };
    expect(isRegistryElement(link)).toBe(true);
    expect(isAuthorLink(link)).toBe(false);
    expect(isAuthorElement(link)).toBe(false);
  });
  it('recognises author links by type and provenance', () => {
    const link = makeAuthorLink({ sourceId: 'a', targetId: 'b', label: 'Director', now: NOW });
    expect(isAuthorLink(link)).toBe(true);
    expect(isAuthorElement(link)).toBe(true);
    expect(isRegistryElement(link)).toBe(false);
    expect(link.type).toBe(AUTHOR_LINK_TYPE);
    expect(link.category).toBe('author');
    expect(link.id.startsWith(AUTHOR_LINK_PREFIX)).toBe(true);
  });
  it('recognises author nodes and keeps kind by type', () => {
    const person = makeAuthorNode({ kind: 'person', name: 'J. de Vries', now: NOW });
    const company = makeAuthorNode({ kind: 'company', name: 'Holding BV', now: NOW });
    expect(isAuthorNode(person)).toBe(true);
    expect(person.type).toBe('officer');
    expect(person.subtype).toBe('individual');
    expect(company.type).toBe('company');
    expect(company.id.startsWith(AUTHOR_NODE_PREFIX)).toBe(true);
  });
  it('a renamed registry node is not an author node', () => {
    const node = markRenamed({ id: 'company-x', name: 'New', type: 'company' }, 'Old SL');
    expect(isRenamedNode(node)).toBe(true);
    expect(isAuthorNode(node)).toBe(false);
    expect(node.provenance).toEqual({ renamedFrom: 'Old SL' });
  });
  it('markRenamed is a no-op on author nodes and keeps the first registry name', () => {
    const author = makeAuthorNode({ kind: 'person', name: 'A', now: NOW });
    expect(markRenamed(author, 'B')).toBe(author);
    const once = markRenamed({ id: 'n', name: 'B', type: 'company' }, 'A');
    const twice = markRenamed({ ...once, name: 'C' }, 'B');
    expect(twice.provenance.renamedFrom).toBe('A');
  });
});

describe('validators', () => {
  it('requires a label and a well-formed url for links', () => {
    expect(validateAuthorLinkDraft({ label: ' ' })).toEqual({ ok: false, errors: { label: 'required' } });
    expect(validateAuthorLinkDraft({ label: 'Director', citationUrl: 'ftp://x' })).toEqual({ ok: false, errors: { url: 'invalid' } });
    expect(validateAuthorLinkDraft({ label: 'Director', citationUrl: 'https://kvk.nl/x' })).toEqual({ ok: true, errors: {} });
    expect(validateAuthorLinkDraft({ label: 'Director', citationUrl: '' })).toEqual({ ok: true, errors: {} });
  });
  it('requires a name for nodes', () => {
    expect(validateAuthorNodeDraft({ name: '' })).toEqual({ ok: false, errors: { name: 'required' } });
    expect(validateAuthorNodeDraft({ name: 'X', citationUrl: 'nope' })).toEqual({ ok: false, errors: { url: 'invalid' } });
    expect(validateAuthorNodeDraft({ name: 'X' })).toEqual({ ok: true, errors: {} });
  });
});

describe('constructors', () => {
  it('builds a link with trimmed, capped fields and mirrored date', () => {
    const link = makeAuthorLink({
      sourceId: 'a', targetId: 'b', label: '  Director  ', directed: true,
      citationText: 'KVK extract', citationUrl: 'https://kvk.nl/1', asserted: '2026-09-10',
      note: 'n', author: 'Ana', now: NOW, id: 'author-link-fixed',
    });
    expect(link).toEqual({
      id: 'author-link-fixed', source: 'a', target: 'b', type: 'author', category: 'author',
      relationship: 'Director', directed: true, date: '2026-09-10',
      provenance: {
        by: 'author', citation: { text: 'KVK extract', url: 'https://kvk.nl/1' },
        asserted: '2026-09-10', note: 'n', at: NOW, author: 'Ana',
      },
    });
  });
  it('stores a null citation when neither text nor url is given', () => {
    const link = makeAuthorLink({ sourceId: 'a', targetId: 'b', label: 'x', now: NOW });
    expect(link.provenance.citation).toBeNull();
    expect(link.directed).toBe(false);
    expect(link.date).toBeNull();
  });
  it('caps the label length', () => {
    const link = makeAuthorLink({ sourceId: 'a', targetId: 'b', label: 'x'.repeat(200), now: NOW });
    expect(link.relationship).toHaveLength(80);
  });
  it('builds a pinned node at the given position', () => {
    const node = makeAuthorNode({ kind: 'company', name: ' Holding BV ', country: 'nl', identifier: 'KVK 1', now: NOW, id: 'author-node-fixed', x: 10, y: 20 });
    expect(node).toEqual({
      id: 'author-node-fixed', name: 'Holding BV', type: 'company', country: 'NL', identifier: 'KVK 1',
      companies: [], positions: [],
      provenance: { by: 'author', citation: null, asserted: null, note: '', at: NOW, author: '' },
      x: 10, y: 20, fx: 10, fy: 20,
    });
  });
});

describe('dismissal', () => {
  const graph = { nodes: [], links: [{ id: 'l1', source: 'a', target: 'b' }, { id: 'l2', source: 'b', target: 'c' }] };
  it('marks a link dismissed without mutating the input', () => {
    const next = dismissLink(graph, 'l1', 'superseded', NOW);
    expect(next).not.toBe(graph);
    expect(graph.links[0].dismissed).toBeUndefined();
    expect(next.links[0].dismissed).toEqual({ by: 'author', reason: 'superseded', at: NOW });
    expect(isDismissedLink(next.links[0])).toBe(true);
    expect(visibleWithoutDismissed(next.links).map(l => l.id)).toEqual(['l2']);
  });
  it('restores a dismissed link', () => {
    const restored = restoreLink(dismissLink(graph, 'l1', '', NOW), 'l1');
    expect(restored.links[0].dismissed).toBeUndefined();
  });
});

describe('removeAuthorNode', () => {
  it('drops the node and every author link touching it, nothing else', () => {
    const n = makeAuthorNode({ kind: 'person', name: 'P', now: NOW, id: 'author-node-p' });
    const al = makeAuthorLink({ sourceId: 'author-node-p', targetId: 'c', label: 'x', now: NOW, id: 'author-link-1' });
    const graph = { nodes: [n, { id: 'c', name: 'C', type: 'company' }], links: [al, { id: 'r', source: 'c', target: 'd' }] };
    const next = removeAuthorNode(graph, 'author-node-p');
    expect(next.nodes.map(x => x.id)).toEqual(['c']);
    expect(next.links.map(x => x.id)).toEqual(['r']);
  });
  it('refuses to remove a registry node', () => {
    const graph = { nodes: [{ id: 'c', name: 'C', type: 'company' }], links: [] };
    expect(removeAuthorNode(graph, 'c')).toBe(graph);
  });
});

describe('collectAuthorLayer', () => {
  it('gathers nodes, links, dismissals and renames with resolved names', () => {
    const p = makeAuthorNode({ kind: 'person', name: 'P', country: 'NL', identifier: 'KVK 9', citationText: 'extract', now: NOW, id: 'author-node-p', author: 'Ana' });
    const c = markRenamed({ id: 'company-c', name: 'C Renamed', type: 'company' }, 'C SL');
    const al = makeAuthorLink({ sourceId: 'author-node-p', targetId: 'company-c', label: 'Director', directed: true, asserted: '2026-01-02', now: NOW, id: 'author-link-1' });
    const rl = { id: 'r1', source: { id: 'company-c' }, target: { id: 'x' }, relationship: 'Apoderado', dismissed: { by: 'author', reason: 'dup', at: NOW } };
    const graph = { nodes: [p, c, { id: 'x', name: 'X', type: 'officer' }], links: [al, rl] };
    expect(collectAuthorLayer(graph)).toEqual({
      nodes: [{ nodeId: 'author-node-p', name: 'P', kind: 'person', country: 'NL', identifier: 'KVK 9', citation: { text: 'extract', url: '' }, note: '', at: NOW, author: 'Ana' }],
      links: [{ from: 'P', fromId: 'author-node-p', to: 'C Renamed', toId: 'company-c', label: 'Director', directed: true, citation: null, asserted: '2026-01-02', note: '', at: NOW, author: '' }],
      dismissed: [{ from: 'C Renamed', to: 'X', relationship: 'Apoderado', reason: 'dup', at: NOW }],
      renamed: [{ nodeId: 'company-c', name: 'C Renamed', registryName: 'C SL' }],
    });
  });
  it('returns empty arrays for a registry-only graph', () => {
    expect(collectAuthorLayer({ nodes: [{ id: 'a' }], links: [{ id: 'l', source: 'a', target: 'a' }] }))
      .toEqual({ nodes: [], links: [], dismissed: [], renamed: [] });
  });
});
