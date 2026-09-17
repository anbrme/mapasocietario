# The author layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the author add links and entities to the graph, dismiss registry links, and have every such element carry its provenance through the canvas, the snapshot and the situation report.

**Architecture:** One pure module, `src/utils/authorLayer.js`, owns the provenance shape, constructors, validators, predicates and the collector the document reads. The graph component gains two small dialogs, a pick mode, menu items and painter branches that only ever call that module. The export learns an `authorLayer` slice of the document model and renders it in the HTML page, the SVG map and the Copy-for-Word path. Nothing is posted to any API.

**Tech Stack:** React 19, Vite 5.4, MUI, vitest (pure-logic tests only, no jsdom; run `npx vitest run <file>`). Two languages in every copy table (`en`, `es`).

**Spec:** `docs/superpowers/specs/2026-09-17-author-layer-design.md`

## Global Constraints

- Absence of `provenance` means BORME. Never write `provenance` onto a registry element except `{ renamedFrom }` on rename.
- Author link: `type: 'author'`, `category: 'author'`, id prefix `author-link-`. Author node: id prefix `author-node-`, `type` = `'officer'` (subtype `'individual'`) or `'company'`.
- Copy: in-app "Added by you" / "Añadido por ti"; document "Added by the author" / "Añadido por el autor". The words "analyst" and "custom" never appear in copy.
- Palette hue: `#a78bfa` (dark) / `#6d28d9` (light) under `graph.link.author` and `graph.node.author`.
- Author elements never call the registry, never go to the corrections API, never enter analytics payloads by name.
- Commit with `git -c commit.gpgsign=false commit`. Branch: `feat/author-layer`. Commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Immutable updates only (spread, map, filter). No mutation of `graphData` nodes or links in place. Files under 800 lines for new code; the graph component is already large and is modified, not restructured, except the menu regrouping in Task 6.
- Existing tests must stay green: `npm test`.

## Copy tables (used by several tasks)

Graph component `SEARCH_COPY` (`src/components/SpanishCompanyNetworkGraph.jsx`, `en` block starts line ~298, `es` block starts line ~681). Add to BOTH:

| key | en | es |
|---|---|---|
| `linkToNode` | `Link to another node…` | `Enlazar con otro nodo…` |
| `linkSelected` | `Link selected` | `Enlazar selección` |
| `linkPickHint` | name => `` `Click the node to link to ${name}. Esc cancels.` `` | name => `` `Haz clic en el nodo que quieres enlazar con ${name}. Esc cancela.` `` |
| `addEntity` | `Add entity…` | `Añadir entidad…` |
| `editEntity` | `Edit entity…` | `Modificar entidad…` |
| `editLink` | `Edit link…` | `Modificar enlace…` |
| `dismissLink` | `Dismiss relationship…` | `Descartar relación…` |
| `restoreLink` | `Restore` | `Restaurar` |
| `showFilings` | `Show filings` | `Ver asientos` |
| `fitView` | `Fit to view` | `Ajustar vista` |
| `manageHidden` | `Manage hidden…` | `Gestionar ocultos…` |
| `hiddenLinks` | `Hidden relationships` | `Relaciones ocultas` |
| `legendAuthor` | `Added by you` | `Añadido por ti` |
| `authorCard` | `Added by you` | `Añadido por ti` |
| `authorLinkAdded` | `Relationship added` | `Relación añadida` |
| `authorNodeAdded` | `Entity added` | `Entidad añadida` |
| `linkDismissed` | `Relationship dismissed` | `Relación descartada` |
| `registryName` | name => `` `Registry name: ${name}` `` | name => `` `Nombre registral: ${name}` `` |
| `fieldLabel` | `Label` | `Etiqueta` |
| `fieldDirection` | `Direction` | `Dirección` |
| `directionNone` | `None` | `Ninguna` |
| `fieldSourceText` | `Source` | `Fuente` |
| `fieldSourceUrl` | `Source URL` | `URL de la fuente` |
| `fieldDate` | `Date` | `Fecha` |
| `fieldNote` | `Note` | `Nota` |
| `fieldName` | `Name` | `Nombre` |
| `fieldKind` | `Kind` | `Tipo` |
| `kindPerson` | `Person` | `Persona` |
| `kindCompany` | `Company` | `Empresa` |
| `fieldCountry` | `Country (ISO code)` | `País (código ISO)` |
| `fieldIdentifier` | `Identifier` | `Identificador` |
| `fieldReason` | `Reason` | `Motivo` |
| `labelChips` | `['Director','Shareholder','Beneficial owner','Family','Same address','Business partner']` | `['Administrador','Socio','Titular real','Familia','Mismo domicilio','Socio de negocio']` |
| `labelRequired` | `A label is required.` | `La etiqueta es obligatoria.` |
| `nameRequired` | `A name is required.` | `El nombre es obligatorio.` |
| `urlInvalid` | `The URL must start with http:// or https://.` | `La URL debe empezar por http:// o https://.` |
| `save` | `Save` | `Guardar` |

Export copy `src/utils/investigationExport/exportCopy.js` (es block from line ~15, en block from line ~90). Add to BOTH:

| key | en | es |
|---|---|---|
| `authorLayer` | `Added by the author` | `Añadido por el autor` |
| `authorNotice` | `This report contains elements added by the author, drawn dotted on the map and listed in the annex "Added by the author".` | `Este informe contiene elementos añadidos por el autor, dibujados con línea de puntos en el mapa y listados en el anexo "Añadido por el autor".` |
| `authorRelationships` | `Relationships` | `Relaciones` |
| `authorEntities` | `Entities` | `Entidades` |
| `legendAuthor` | `Added by the author` | `Añadido por el autor` |
| `actionDismissed` | `relationship dismissed` | `relación descartada` |
| `actionRenamed` | `renamed from` | `renombrado desde` |
| `asserted` | `asserted` | `afirmado` |
| `hopAuthorNote` | n => n === 1 ? `one link in this path was added by the author` : `` `${n} links in this path were added by the author` `` | n => n === 1 ? `un enlace de esta ruta fue añadido por el autor` : `` `${n} enlaces de esta ruta fueron añadidos por el autor` `` |
| `source` | `Source` | `Fuente` |

---

### Task 1: The pure module `authorLayer.js`

**Files:**
- Create: `src/utils/authorLayer.js`
- Test: `src/utils/authorLayer.test.js`

**Interfaces:**
- Produces (all named exports):
  - `AUTHOR_LINK_TYPE = 'author'`, `AUTHOR_LINK_PREFIX = 'author-link-'`, `AUTHOR_NODE_PREFIX = 'author-node-'`
  - `AUTHOR_LABEL_MAX = 80`, `AUTHOR_NAME_MAX = 120`, `AUTHOR_NOTE_MAX = 500`, `AUTHOR_SOURCE_MAX = 300`
  - `isAuthorLink(link)`, `isAuthorNode(node)`, `isAuthorElement(el)`, `isRegistryElement(el)`, `isDismissedLink(link)`, `isRenamedNode(node)`
  - `validateAuthorLinkDraft(draft) -> { ok: boolean, errors: { label?: 'required', url?: 'invalid' } }`
  - `validateAuthorNodeDraft(draft) -> { ok, errors: { name?: 'required', url?: 'invalid' } }`
  - `makeAuthorLink({ sourceId, targetId, label, directed, citationText, citationUrl, asserted, note, author, now, id })`
  - `makeAuthorNode({ kind: 'person'|'company', name, country, identifier, citationText, citationUrl, note, author, now, id, x, y })`
  - `dismissLink(graphData, linkId, reason, now)`, `restoreLink(graphData, linkId)`
  - `markRenamed(node, registryName)` — returns a new node; no-op on author nodes or if already marked
  - `removeAuthorNode(graphData, nodeId)` — drops the node and every author link touching it
  - `visibleWithoutDismissed(links)` — filters out dismissed links
  - `collectAuthorLayer(graphData) -> { nodes, links, dismissed, renamed }` (shapes in the spec §The document)

- [ ] **Step 1: Write the failing tests**

```js
// src/utils/authorLayer.test.js
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/utils/authorLayer.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```js
// src/utils/authorLayer.js
// The author layer: elements the author adds to the map (links, entities),
// registry links the author dismisses, and registry nodes the author renamed.
//
// Rule: absence of `provenance` means BORME. An author element carries
// `provenance.by === 'author'`; a renamed registry node carries only
// `provenance.renamedFrom`. Nothing here talks to any API. Pure: plain
// objects in, new plain objects out.

export const AUTHOR_LINK_TYPE = 'author';
export const AUTHOR_LINK_PREFIX = 'author-link-';
export const AUTHOR_NODE_PREFIX = 'author-node-';
export const AUTHOR_LABEL_MAX = 80;
export const AUTHOR_NAME_MAX = 120;
export const AUTHOR_NOTE_MAX = 500;
export const AUTHOR_SOURCE_MAX = 300;

const nid = id => (id == null ? '' : String(id));
const refId = ref => (ref && typeof ref === 'object' ? ref.id : ref);
const clean = (value, max) => String(value || '').trim().slice(0, max);
const randomId = prefix => `${prefix}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export const isAuthorLink = link => !!link && link.type === AUTHOR_LINK_TYPE && link.provenance?.by === 'author';
export const isAuthorNode = node => !!node && node.provenance?.by === 'author';
export const isAuthorElement = el => isAuthorLink(el) || isAuthorNode(el);
export const isRegistryElement = el => !!el && !isAuthorElement(el);
export const isDismissedLink = link => !!link?.dismissed;
export const isRenamedNode = node => !isAuthorNode(node) && typeof node?.provenance?.renamedFrom === 'string';

const isHttpUrl = value => /^https?:\/\/\S+$/i.test(String(value || '').trim());

const citationOf = (text, url) => {
  const t = clean(text, AUTHOR_SOURCE_MAX);
  const u = clean(url, AUTHOR_SOURCE_MAX);
  return t || u ? { text: t, url: u } : null;
};

const provenanceOf = ({ citationText, citationUrl, asserted, note, author, now }) => ({
  by: 'author',
  citation: citationOf(citationText, citationUrl),
  asserted: /^\d{4}-\d{2}-\d{2}$/.test(String(asserted || '')) ? asserted : null,
  note: clean(note, AUTHOR_NOTE_MAX),
  at: now || new Date().toISOString(),
  author: clean(author, 120),
});

export const validateAuthorLinkDraft = draft => {
  const errors = {};
  if (!clean(draft?.label, AUTHOR_LABEL_MAX)) errors.label = 'required';
  if (clean(draft?.citationUrl, AUTHOR_SOURCE_MAX) && !isHttpUrl(draft.citationUrl)) errors.url = 'invalid';
  return { ok: Object.keys(errors).length === 0, errors };
};

export const validateAuthorNodeDraft = draft => {
  const errors = {};
  if (!clean(draft?.name, AUTHOR_NAME_MAX)) errors.name = 'required';
  if (clean(draft?.citationUrl, AUTHOR_SOURCE_MAX) && !isHttpUrl(draft.citationUrl)) errors.url = 'invalid';
  return { ok: Object.keys(errors).length === 0, errors };
};

export const makeAuthorLink = ({ sourceId, targetId, label, directed = false, id, ...rest }) => {
  const provenance = provenanceOf(rest);
  return {
    id: id || randomId(AUTHOR_LINK_PREFIX),
    source: nid(sourceId),
    target: nid(targetId),
    type: AUTHOR_LINK_TYPE,
    category: 'author',
    relationship: clean(label, AUTHOR_LABEL_MAX),
    directed: !!directed,
    date: provenance.asserted,
    provenance,
  };
};

export const makeAuthorNode = ({ kind, name, country, identifier, id, x = 0, y = 0, ...rest }) => ({
  id: id || randomId(AUTHOR_NODE_PREFIX),
  name: clean(name, AUTHOR_NAME_MAX),
  type: kind === 'company' ? 'company' : 'officer',
  ...(kind === 'company' ? {} : { subtype: 'individual' }),
  country: clean(country, 2).toUpperCase(),
  identifier: clean(identifier, AUTHOR_SOURCE_MAX),
  companies: [],
  positions: [],
  provenance: provenanceOf(rest),
  x, y, fx: x, fy: y,
});

const mapLink = (graphData, linkId, fn) => ({
  ...graphData,
  links: (graphData?.links || []).map(l => (nid(l.id) === nid(linkId) ? fn(l) : l)),
});

export const dismissLink = (graphData, linkId, reason, now) => mapLink(graphData, linkId, l => ({
  ...l, dismissed: { by: 'author', reason: clean(reason, AUTHOR_NOTE_MAX), at: now || new Date().toISOString() },
}));

export const restoreLink = (graphData, linkId) => mapLink(graphData, linkId, ({ dismissed, ...l }) => l);

export const markRenamed = (node, registryName) => {
  if (!node || isAuthorNode(node) || isRenamedNode(node)) return node;
  return { ...node, provenance: { renamedFrom: String(registryName || '') } };
};

export const removeAuthorNode = (graphData, nodeId) => {
  const target = nid(nodeId);
  const node = (graphData?.nodes || []).find(n => nid(n.id) === target);
  if (!isAuthorNode(node)) return graphData;
  return {
    ...graphData,
    nodes: graphData.nodes.filter(n => nid(n.id) !== target),
    links: (graphData.links || []).filter(l => !(isAuthorLink(l) && (nid(refId(l.source)) === target || nid(refId(l.target)) === target))),
  };
};

export const visibleWithoutDismissed = links => (links || []).filter(l => !isDismissedLink(l));

export const collectAuthorLayer = graphData => {
  const nodes = graphData?.nodes || [];
  const byId = new Map(nodes.map(n => [nid(n.id), n]));
  const nameOf = ref => byId.get(nid(refId(ref)))?.name || nid(refId(ref));
  const links = graphData?.links || [];
  return {
    nodes: nodes.filter(isAuthorNode).map(n => ({
      nodeId: nid(n.id), name: n.name, kind: n.type === 'officer' ? 'person' : 'company',
      country: n.country || '', identifier: n.identifier || '',
      citation: n.provenance.citation, note: n.provenance.note || '', at: n.provenance.at, author: n.provenance.author || '',
    })),
    links: links.filter(isAuthorLink).map(l => ({
      from: nameOf(l.source), fromId: nid(refId(l.source)), to: nameOf(l.target), toId: nid(refId(l.target)),
      label: l.relationship, directed: !!l.directed,
      citation: l.provenance.citation, asserted: l.provenance.asserted, note: l.provenance.note || '',
      at: l.provenance.at, author: l.provenance.author || '',
    })),
    dismissed: links.filter(isDismissedLink).map(l => ({
      from: nameOf(l.source), to: nameOf(l.target), relationship: l.relationship || l.category || '',
      reason: l.dismissed.reason || '', at: l.dismissed.at,
    })),
    renamed: nodes.filter(isRenamedNode).map(n => ({ nodeId: nid(n.id), name: n.name, registryName: n.provenance.renamedFrom })),
  };
};
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/utils/authorLayer.test.js`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/utils/authorLayer.js src/utils/authorLayer.test.js
git -c commit.gpgsign=false commit -m "feat(author-layer): pure module for author links, entities, dismissals and renames

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Keep author links out of registry logic (dedupe, filters, seats, hops)

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` — `dedupeGraphLinks` (~line 1466); the visible-graph `useMemo` that starts "Start by excluding manually hidden nodes" (~line 7275).
- Modify: `src/utils/walkthrough/stepEvidence.js` — `personSeats` (~line 66).
- Modify: `src/utils/walkthrough/connections.js` — hop row builder (~lines 70–100) and the chapter summary (~line 177).
- Modify: `src/utils/walkthrough/walkthroughCopy.js` — add `hopAuthorNote` (both languages, same text as the export copy table) and `hopColumns.origin` = `'Origin'` / `'Origen'`.
- Test: `src/utils/walkthrough/stepEvidence.test.js`, `src/utils/walkthrough/connections.test.js` (extend existing files; check their existing helpers first).

**Interfaces:**
- Consumes: `isAuthorLink`, `isDismissedLink`, `visibleWithoutDismissed` from Task 1.
- Produces: hop rows gain `origin: 'author' | 'registry'`; author hops have `role` = label, `status: 'asserted'`. Connection step `evidence` gains `authorHops: number`.

- [ ] **Step 1: Failing tests**

In `stepEvidence.test.js` add:

```js
it('never lists an author link as a seat', () => {
  const person = { id: 'p', name: 'P', type: 'officer' };
  const company = { id: 'c', name: 'C', type: 'company' };
  const author = { id: 'author-link-1', source: 'p', target: 'c', type: 'author', category: 'author', relationship: 'Director', provenance: { by: 'author' } };
  const seats = personSeats(person, { nodes: [person, company], links: [author] }, 'en');
  expect(seats).toEqual([]);
});
```

In `connections.test.js` add (adapt to the file's existing step-building helper; the assertion is what matters):

```js
it('marks a hop that crosses an author link as asserted', () => {
  const a = { id: 'a', name: 'A', type: 'officer' };
  const c = { id: 'c', name: 'C', type: 'company' };
  const b = { id: 'b', name: 'B', type: 'officer' };
  const links = [
    { id: 'author-link-1', source: 'a', target: 'c', type: 'author', category: 'author', relationship: 'Family', provenance: { by: 'author' } },
    { id: 'r', source: 'b', target: 'c', type: 'officer-company', category: 'nombramientos', relationship: 'Administrador' },
  ];
  const graphData = { nodes: [a, c, b], links };
  const step = connectionStep(graphData, ['a', 'b'], 'en'); // use the file's existing builder name
  const rows = step.evidence.hops;
  expect(rows.find(r => r.role === 'Family')).toMatchObject({ origin: 'author', status: 'asserted' });
  expect(rows.find(r => r.role === 'Administrador').origin).toBe('registry');
  expect(step.evidence.authorHops).toBe(1);
});
```

- [ ] **Step 2: Run, verify failure** — `npx vitest run src/utils/walkthrough`

- [ ] **Step 3: Implement**

`stepEvidence.js`, inside `personSeats` right after the ownership guard:

```js
    if (l.type === 'author') return [];
```

`connections.js`, in the per-link loop, before the registry row is pushed:

```js
      if (l.type === 'author') {
        rows.push({
          who: who?.name || '', whoId: nid(who?.id), at: at?.name || '', atId: nid(at?.id),
          role: l.relationship || '', status: 'asserted', since: day(l.date) || '', until: '', origin: 'author',
        });
        return;
      }
```

and add `origin: 'registry'` to the existing registry row and to the empty-hop row. Where `evidence: { hops, ends, via }` is built, add `authorHops: hops.filter(h => h.origin === 'author').length`.

Graph component `dedupeGraphLinks`: first line of the `forEach` body:

```js
    if (link.type === 'author') { dedupedMap.set(`author|${link.id}`, link); return; }
```

Visible-graph memo, right after `let activeLinks = ...` is first assigned (find the assignment at the top of the memo):

```js
    activeLinks = visibleWithoutDismissed(activeLinks);
```

Import `visibleWithoutDismissed` from `'../utils/authorLayer'`.

- [ ] **Step 4: Run** — `npx vitest run src/utils/walkthrough` → PASS; `npm test` → green.

- [ ] **Step 5: Commit** — `feat(author-layer): author links bypass dedupe, seats and registry hop rows; dismissed links leave the visible graph`

---

### Task 3: Palette, painter, legend

**Files:**
- Modify: `src/theme/palette.js` — both `graph.node` and `graph.link` blocks (dark ~line 50–66, light ~line 110–126).
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` — `linkCanvasObject` colour decision (~line 8348), node painter ring block (~line 8006), `nodeColors` memo (~line 2196), legend bar (~line 11517), `SEARCH_COPY` (`legendAuthor`).

- [ ] **Step 1: Palette** — add `author: '#a78bfa'` to dark `node` and `link`, `author: '#6d28d9'` to light `node` and `link`.

- [ ] **Step 2: Painter, links.** In the colour decision insert as the FIRST branch after the `let linkColor;` declaration and before the pathfinder branch:

```js
      const isAuthor = link.type === 'author';
      if (isAuthor) linkColor = graphPalette.link.author;
      if (pathfinderActive && isLinkInPath) {
```

and change the following `if` to `else if`. Where the stroke is set (`ctx.setLineDash` / `ctx.strokeStyle` for the line body), wrap:

```js
      if (isAuthor) { ctx.save(); ctx.setLineDash([1.5, 3.5]); ctx.lineCap = 'round'; }
      // …existing stroke call…
      if (isAuthor) ctx.restore();
```

Arrowhead: the manual arrow is drawn for directional links (`isDirectionalLink` gate in `linkDirectionality.js`). Add author links to that gate: `if (link?.type === 'author') return !!link.directed;` as the first line of the exported directional predicate.

- [ ] **Step 3: Painter, nodes.** Add `author: graphPalette.node.author` to `nodeColors`. After the origin ring `else if` chain, add a branch that runs in addition (not instead) of the others:

```js
      if (node.provenance?.by === 'author') {
        ctx.save();
        ctx.setLineDash([1.5, 3]);
        ctx.strokeStyle = nodeColors.author;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius + 3.5, 0, 2 * Math.PI, false);
        ctx.stroke();
        ctx.restore();
      }
```

- [ ] **Step 4: Legend.** Compute `const hasAuthorElements = useMemo(() => filteredGraphData.nodes.some(n => n.provenance?.by === 'author') || filteredGraphData.links.some(l => l.type === 'author'), [filteredGraphData]);` and append after the cessations row:

```jsx
        {!isCompactEmbed && hasAuthorElements && <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Box sx={{ width: 14, height: 0, borderTop: `2px dotted ${graphPalette.link.author}` }} />
          <Typography sx={{ fontSize: 'inherit', lineHeight: 1 }}>{text.legendAuthor}</Typography>
        </Box>}
```

- [ ] **Step 5: Verify** — `npm run build` succeeds; `npm test` green. Commit: `feat(author-layer): violet dotted stroke and ring, legend row`

---

### Task 4: Add a link — pick mode, dialog, menu item, selection toolbar

**Files:**
- Create: `src/components/AuthorLinkDialog.jsx` (~150 lines).
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` — state, node click intercept (`handleNodeClick`), context menu, selection toolbar (~line 10738), snackbar.
- Copy: keys from the table.

**Interfaces:**
- `AuthorLinkDialog({ open, sourceNode, targetNode, initial, text, onCancel, onSave })` — `onSave(draft)` with `draft = { label, directed: 'none'|'forward'|'backward', citationText, citationUrl, asserted, note }`. `initial` is an existing author link's fields when editing.

- [ ] **Step 1: Dialog.** MUI `Dialog` with: label `TextField` (required, `AUTHOR_LABEL_MAX`), chips from `text.labelChips` that set the label, direction `ToggleButtonGroup` (`none` / `${A} → ${B}` / `${B} → ${A}`), source text, source URL, date (`type="date"`), note (multiline, `AUTHOR_NOTE_MAX`). Validate with `validateAuthorLinkDraft`; show `text.labelRequired` / `text.urlInvalid` as helper text; Save disabled until valid. Author name for provenance comes from the graph component, not the dialog.

- [ ] **Step 2: Pick mode.** State: `const [linkPick, setLinkPick] = useState(null); // { sourceId } | null`. Context menu item "Link to another node…" sets `linkPick = { sourceId: contextNode.id }` and shows a persistent snackbar with `text.linkPickHint(contextNode.name)` and a Cancel action. In `handleNodeClick`, first thing:

```js
      if (linkPick) {
        if (isSameNodeId(node.id, linkPick.sourceId)) { setLinkPick(null); return; }
        setLinkDialog({ sourceId: linkPick.sourceId, targetId: node.id, initial: null });
        setLinkPick(null);
        return;
      }
```

Background click and Escape (`keydown` listener while `linkPick` is set) clear `linkPick`. Cursor: set `cursor: crosshair` on the graph container `sx` when `linkPick`.

- [ ] **Step 3: Save.** On `onSave(draft)`:

```js
    const link = makeAuthorLink({
      sourceId: draft.directed === 'backward' ? targetId : sourceId,
      targetId: draft.directed === 'backward' ? sourceId : targetId,
      label: draft.label, directed: draft.directed !== 'none',
      citationText: draft.citationText, citationUrl: draft.citationUrl,
      asserted: draft.asserted, note: draft.note, author: sitrepAuthor.name,
    });
    setGraphData(prev => ({ ...prev, links: [...prev.links, link] }));
    setCorrectionsSnackbar({ id: null, message: text.authorLinkAdded, undoGraph: () => setGraphData(p => ({ ...p, links: p.links.filter(l => l.id !== link.id) })) });
    trackEvent('graph_author_link_add', { directed: draft.directed !== 'none', has_citation: !!(draft.citationText || draft.citationUrl) });
```

Editing (`initial` set): replace the link by id with a new `makeAuthorLink({ ..., id: initial.id, now: initial.provenance.at })`.

- [ ] **Step 4: Selection toolbar.** Next to "Hide selected", when `investigationSet.size === 2`: button `text.linkSelected` → `setLinkDialog({ sourceId, targetId, initial: null })` from the two ids.

- [ ] **Step 5: Verify** — build; hand-check: right-click → Link to another node… → click B → dialog → save → dotted violet link with label; Undo removes it. Commit: `feat(author-layer): add a relationship between two nodes`

---

### Task 5: Add an entity — dialog, toolbar, canvas menu, author-node guards, inspector card

**Files:**
- Create: `src/components/AuthorNodeDialog.jsx` (~140 lines).
- Create: `src/components/AuthorElementCard.jsx` (~80 lines) — the "Added by you" card for the inspector.
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` — toolbar button, background right-click menu, guards, inspector.
- Modify: `src/components/CompanyInspectorPanel.jsx` / `src/components/OfficerInspectorBody.jsx` — render `AuthorElementCard` instead of fetching when `isAuthorNode(node)`.

**Interfaces:**
- `AuthorNodeDialog({ open, initial, text, onCancel, onSave })` — `onSave({ kind, name, country, identifier, citationText, citationUrl, note })`.
- `AuthorElementCard({ node, text, onEdit })`.

- [ ] **Step 1: Dialog** — kind toggle (Person / Company), name (required), country (2 chars, uppercase), identifier, source text, source URL, note. Validate with `validateAuthorNodeDraft`.

- [ ] **Step 2: Entry points.** Toolbar `IconButton` (add icon) with tooltip `text.addEntity` → `setNodeDialog({ at: null, initial: null })`. Background right-click: `onBackgroundRightClick={(event) => setCanvasMenu({ x: event.clientX, y: event.clientY, graphPoint: fgRef.current.screen2GraphCoords(event.clientX, event.clientY) })}` with a `Menu` of `addEntity`, `manageHidden` (opens the existing hidden-nodes menu), `fitView` (`fgRef.current.zoomToFit(400, 40)`).

- [ ] **Step 3: Save** — `makeAuthorNode({ ...draft, author: sitrepAuthor.name, x, y })` where `x, y` are the canvas menu's graph point or the viewport centre (`fgRef.current.screen2GraphCoords(width / 2, height / 2)`). Append to `graphData.nodes`, pin, open the inspector on it, snackbar `authorNodeAdded` with undo `removeAuthorNode`.

- [ ] **Step 4: Guards.** Everywhere an author node must not reach the registry: in `handleNodeDoubleClick` (expand) and in the menu items `expand`, `collapse`, `unify_cargos`, `officer_timeline`, `mark_resigned`, `mark_active`, `buy_due_diligence`, `show_apoderados`, `market_data`, `data_preview`, `company_profile`, gate with `!isAuthorNode(contextNode)`. Add `editEntity` (opens `AuthorNodeDialog` with `initial`) for author nodes in place of `editNode`. `deleteNode` for an author node calls `removeAuthorNode` and skips `recordCorrection`. Merge: if either node `isAuthorNode`, skip `recordCorrection` (both branches at ~line 7003).

- [ ] **Step 5: Inspector.** In both inspector bodies: `if (isAuthorNode(node)) return <AuthorElementCard node={node} text={text} onEdit={...} />;` before any fetch effect runs (put the check in the parent that decides which body to render, so no effect fires).

- [ ] **Step 6: Verify** — build; hand-check: Add entity → appears pinned at the point, dotted ring, inspector card; double-click does nothing but open the card; delete removes its links. Commit: `feat(author-layer): add an entity to the map; author nodes never call the registry`

---

### Task 6: Regroup the context menus

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` — node `Menu` (~lines 11790–12020), new link `Menu`, canvas `Menu` from Task 5.
- Copy: rename labels to verbs: `timeline` → `Open timeline` / `Abrir cronología`; `marketData` → `Show market data` / `Ver datos de mercado`; `showApoderados` already a verb; `buyDueDiligence` keep.

- [ ] **Step 1: Node menu order.** Reorder rows into five groups with `<Divider />` between groups and none elsewhere:
  1. `data_preview`, `company_profile`, `officer_timeline`, `show_apoderados`, `market_data`, `buy_due_diligence`
  2. `expand`/`collapse`, `unify_cargos`/`undo_unify_cargos`
  3. `link_to_node`, note add/edit/remove, `edit_node`/`edit_entity`, `merge`/`unmerge`, `mark_resigned`/`mark_active` — each row's `ListItemIcon` is a 10px circle with `border: 2px dotted ${graphPalette.link.author}`
  4. `hide_node`, `hide_node_relations`
  5. `delete_node`

  Render a divider only if the group before it rendered at least one row (compute the groups as arrays of `{ show, element }` and join with dividers where both sides are non-empty). For an author node groups 1 and 2 are empty.

- [ ] **Step 2: Link menu.** `onLinkRightClick={(link, event) => { event.preventDefault(); setLinkMenu({ link, x: event.clientX, y: event.clientY }); }}`. Rows: `showFilings` (registry link with an officer endpoint → `openDataPreviewRef.current(officerNode)`), then `dismissLink` (registry) or `editLink` (author), then `delete` (author only). If right-click on links does not fire under the custom painter, add `linkPointerAreaPaint` that strokes the same line with `lineWidth = 8` in the given color; verify before shipping.

- [ ] **Step 3: Verify** — hand-check both menus on a registry node, an author node, a registry link and an author link. Commit: `refactor(graph): group context menus by what the action does; verbs throughout`

---

### Task 6b: The "Edit map" gate

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` — state `isEditMode` (default `false`), toolbar toggle, banner, gating of the author group, snapshot open hook.
- Copy (both languages): `editMap` = `Edit map` / `Editar mapa`; `editBanner` = `Editing: what you add or change appears in your situation report, never in the registry.` / `Edición: lo que añadas o cambies aparece en tu informe de situación, nunca en el registro.`; `editExplainerTitle` = `Your map, your report` / `Tu mapa, tu informe`; `editExplainerBody` = `In edit mode you can add entities and relationships, dismiss registry relationships, merge, rename, annotate and mark seats. Everything you do is drawn dotted, listed under "Added by the author" in the situation report, and never sent anywhere.` / `En modo edición puedes añadir entidades y relaciones, descartar relaciones del registro, fusionar, renombrar, anotar y marcar cargos. Todo lo que hagas se dibuja con puntos, se lista bajo "Añadido por el autor" en el informe de situación y nunca se envía a ningún sitio.`; `gotIt` = `Got it` / `Entendido`.

- [ ] **Step 1: State and toggle.** `const [isEditMode, setIsEditMode] = useState(false);` A `ToggleButton` (edit icon) with tooltip `text.editMap` in the graph toolbar next to "Add entity…". When `isEditMode` is false the "Add entity…" button and the "Link selected" toolbar button are not rendered.
- [ ] **Step 2: Banner.** When on, a one-line `Alert severity="info"` above the legend bar with `text.editBanner` and a close action that turns the mode off.
- [ ] **Step 3: One-time explainer.** On the first activation per browser (`localStorage` key `author_layer_explainer_seen`, wrapped in try/catch) open a small `Dialog` with `editExplainerTitle` / `editExplainerBody` and a `gotIt` button.
- [ ] **Step 4: Gate the author group.** In the node menu, group 3 (link to node, notes, edit node/entity, merge/unmerge, mark resigned/active) renders only when `isEditMode`. Link menu: `dismissLink`, `editLink` and `delete` only when `isEditMode`; `showFilings` always. Canvas menu: `addEntity` only when `isEditMode`. Hide / collapse / expand / delete node stay ungated. Author nodes remain drawn and inspectable when the mode is off; their card shows no Edit button then.
- [ ] **Step 5: Snapshot.** In the snapshot-open path, after `setGraphData`, `if (collectAuthorLayer(snapshot.graph).nodes.length || …links.length || …dismissed.length || …renamed.length) setIsEditMode(true);`.
- [ ] **Step 6: Verify** — build; hand-check: default menu has no author group; toggle on → banner, explainer once, group appears; toggle off → author elements still drawn, card read-only. Commit: `feat(author-layer): an Edit map gate reveals the author's tools and states the contract`

---

### Task 7: Document model — `authorLayer` in the investigation doc

**Files:**
- Modify: `src/utils/investigationDoc.js` — `buildInvestigationDoc` output.
- Modify: `src/utils/sitrepModel.js` — `annexRows`, `hasAnnexes`.
- Test: `src/utils/investigationDoc.test.js`, `src/utils/sitrepModel.test.js` (create if absent).

**Interfaces:**
- Produces: `doc.authorLayer = collectAuthorLayer(graphData)`; `doc.counts.authorElements = nodes.length + links.length + dismissed.length + renamed.length`; `annexRows(doc).authorLayer` (same object); `hasAnnexes` true when any of its arrays is non-empty.

- [ ] **Step 1: Failing tests**

```js
it('carries the author layer and counts it', () => {
  const p = { id: 'author-node-p', name: 'P', type: 'officer', subtype: 'individual', provenance: { by: 'author', citation: null, asserted: null, note: '', at: 'T', author: '' } };
  const c = { id: 'company-c', name: 'C', type: 'company' };
  const l = { id: 'author-link-1', source: 'author-node-p', target: 'company-c', type: 'author', category: 'author', relationship: 'Director', directed: false, provenance: { by: 'author', citation: null, asserted: null, note: '', at: 'T', author: '' } };
  const doc = buildInvestigationDoc({ graphData: { nodes: [p, c], links: [l] }, scope: emptyScope() }); // use the file's existing scope fixture
  expect(doc.authorLayer.links).toHaveLength(1);
  expect(doc.authorLayer.nodes[0].name).toBe('P');
  expect(doc.counts.authorElements).toBe(2);
  expect(hasAnnexes(doc)).toBe(true);
});
```

- [ ] **Step 2: Run, fail.** `npx vitest run src/utils/investigationDoc.test.js`

- [ ] **Step 3: Implement.** In `buildInvestigationDoc`: `const authorLayer = collectAuthorLayer(graphData);` and add `authorLayer` and `counts.authorElements` to the returned object. In `sitrepModel.js` `annexRows` add `authorLayer: doc?.authorLayer || { nodes: [], links: [], dismissed: [], renamed: [] }` and extend `hasAnnexes` with `rows.authorLayer.nodes.length || rows.authorLayer.links.length || rows.authorLayer.dismissed.length || rows.authorLayer.renamed.length`.

- [ ] **Step 4: Pass, commit** — `feat(author-layer): the document carries the author layer`

---

### Task 8: HTML export — notice, annex, corrections rows, chapter block, hop marking

**Files:**
- Modify: `src/utils/investigationExport/documentSections.js` — byline block (~line 139 area, where `meta` is rendered), annex `panels` (~line 338), chapter body builder (~line 208–220), hop table (~line 274), `correctionVerb` rows (~line 336).
- Modify: `src/utils/investigationExport/exportCopy.js` — keys from the table; extend `correctionVerb` mapping with `dismissed: 'actionDismissed'`, `renamed: 'actionRenamed'`.
- Modify: `src/utils/investigationExport/documentStyle.js` — `.hop-author td{font-style:italic}` and `.hop-author .swatch{display:inline-block;width:12px;border-top:2px dotted var(--author);margin-right:4px;vertical-align:middle}`; add `--author:#6d28d9` to the light theme variables and `--author:#a78bfa` to dark.
- Test: `src/utils/investigationExport/documentSections.test.js`.

- [ ] **Step 1: Failing tests** — one per surface:

```js
it('prints the author notice under the byline when the layer is non-empty', () => {
  const html = renderDocument(docWithAuthorLayer(), 'en'); // use the file's existing render entry + fixture builder
  expect(html).toContain('elements added by the author');
});
it('renders the Added by the author annex with relationship and entity rows', () => {
  const html = renderDocument(docWithAuthorLayer(), 'en');
  expect(html).toContain('id="authorLayer"');
  expect(html).toContain('Director');
  expect(html).toContain('P');
});
it('lists dismissals and renames in the corrections annex', () => {
  const html = renderDocument(docWithDismissalAndRename(), 'en');
  expect(html).toContain('relationship dismissed');
  expect(html).toContain('renamed from');
});
it('marks an asserted hop row', () => {
  const html = renderDocument(docWithAuthorHop(), 'en');
  expect(html).toContain('class="hop-author"');
  expect(html).toContain('one link in this path was added by the author');
});
```

- [ ] **Step 2: Implement.**
  - Notice: after the byline, `doc.counts?.authorElements > 0 ? `<p class="notice">${esc(t.authorNotice)}</p>` : ''`.
  - Annex panel `{ id: 'authorLayer', title: t.authorLayer, body }` where body = `<h4>${t.authorRelationships}</h4><table>` with columns from/→/to/label/source/date/note (source as `<a href>` when `citation.url`), then `<h4>${t.authorEntities}</h4><ul class="plain">` rows `name · kind · country · identifier · source · note`. Empty string when both lists are empty (the panel then hides like the others).
  - Corrections rows: append `rows.authorLayer.dismissed.map(d => `<li>${esc(d.from)} — ${esc(d.to)}: ${esc(t.actionDismissed)}${d.reason ? ` (${esc(d.reason)})` : ''}</li>`)` and `rows.authorLayer.renamed.map(r => `<li>${esc(r.name)} — ${esc(t.actionRenamed)} ${esc(r.registryName)}</li>`)`.
  - Chapter block: after the findings block, `authorLinksFor(doc, step.nodeId)` (author links whose `fromId`/`toId` equals the node id) → `<h4>${t.authorLayer}</h4><ul class="plain">` rows `from → to · label · source`.
  - Hop table: `evidenceTable` row class `hop-author` when `h.origin === 'author'`, `status` cell text `t.asserted`, role cell prefixed with `<span class="swatch"></span>`. After the table, when `s.evidence.authorHops > 0`: `<p class="note">${esc(t.hopAuthorNote(s.evidence.authorHops))}</p>`.

- [ ] **Step 3: Pass, commit** — `feat(author-layer): the exported page shows author work as its own annex, chapter block and asserted hops`

---

### Task 9: SVG map and Copy for Word

**Files:**
- Modify: `src/utils/investigationExport/renderGraphSvg.js` (~line 58 `kindAttr`, ~line 70 node group attrs).
- Modify: `src/utils/investigationExport/documentStyle.js` — `#map .l[data-kind="author"]{stroke:var(--author);stroke-dasharray:1.5 3.5;stroke-linecap:round}` and `#map g.n[data-origin="author"] circle.ring{fill:none;stroke:var(--author);stroke-dasharray:1.5 3;stroke-width:1.2}`.
- Modify: `src/utils/investigationExport/documentSections.js` map legend (~line 174): append `<span><i class="author"></i>${esc(t.legendAuthor)}</span>` when `doc.counts?.authorElements > 0`; style `.legend i.author{border-top:2px dotted var(--author);width:14px;height:0}`.
- Modify: `src/utils/relationshipReportHtml.js` — annex block `block(t.authorLayer, …)` mirroring Task 8 lists; corrections rows; hop rows append ` (${t.asserted})`.
- Test: `renderGraphSvg.test.js`, `relationshipReportHtml.test.js`.

- [ ] **Step 1: Failing tests**

```js
it('stamps author links and nodes', () => {
  const svg = renderGraphSvg({ graphData: graphWithAuthor(), ... }); // reuse the file's fixture pattern
  expect(svg).toContain('data-kind="author"');
  expect(svg).toContain('data-origin="author"');
});
it('word paste lists the author annex and marks asserted hops', () => {
  const html = buildRelationshipReportHtml(docWithAuthorHop(), 'en');
  expect(html).toContain('Added by the author');
  expect(html).toContain('(asserted)');
});
```

- [ ] **Step 2: Implement.** `kindAttr`: `l.type === 'author' ? ' data-kind="author"' : (existing ownership branch)`. Node group: add `${n.provenance?.by === 'author' ? ' data-origin="author"' : ''}` and, inside the group, when author, an extra `<circle class="ring" r="${radius + 3}"/>` after the fill circle.

- [ ] **Step 3: Pass, commit** — `feat(author-layer): dotted author stroke and ring in the exported map; Word paste mirrors the annex`

---

### Task 10: Dismiss a registry link; manage hidden links; rename provenance

**Files:**
- Modify: `src/components/CompanyInspectorPanel.jsx` / `OfficerInspectorBody.jsx` — relationship rows gain a small "Dismiss…" action (registry links) or "Edit…" (author links) via a callback prop `onLinkAction(link, action)`.
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` — `dismissLink`/`restoreLink` handlers, a reason prompt dialog (reuse the mark-resigned dialog pattern: title `text.dismissLink`, one `TextField` `text.fieldReason`), the hidden-nodes menu becomes two lists (nodes, links) with `restoreLink` per row; `saveNodeEdit` calls `markRenamed(node, oldName)` when the name changes on a registry node; inspector shows `text.registryName(node.provenance.renamedFrom)` when `isRenamedNode(node)`.

- [ ] **Step 1: Dismiss.** Handler:

```js
  const dismissLinkWithReason = useCallback((link, reason) => {
    setGraphData(prev => dismissLink(prev, link.id, reason));
    setCorrectionsSnackbar({ id: null, message: text.linkDismissed, undoGraph: () => setGraphData(p => restoreLink(p, link.id)) });
    trackEvent('graph_link_dismiss', { has_reason: !!reason });
  }, [text]);
```

Wire from the inspector row action and from the link menu (Task 6).

- [ ] **Step 2: Manage hidden.** `hiddenLinksList = graphData.links.filter(isDismissedLink)`; render under `text.hiddenLinks` with "from — to · relationship" and a `text.restoreLink` button. Button label `hiddenButton(count)` counts nodes + links.

- [ ] **Step 3: Rename provenance.** In `saveNodeEdit`, the mapped node for `contextNode.id` becomes `markRenamed({ ...node, name: nextName, ... }, oldName)` when `oldName !== nextName`.

- [ ] **Step 4: Verify** — hand-check dismiss → link disappears, listed under hidden, restore brings it back; export lists the dismissal; rename a registry node → export prints "renamed from". Commit: `feat(author-layer): dismiss and restore registry relationships; renames carry the registry name`

---

### Task 11: Checkout warning, analytics leakage check, hand-check

**Files:**
- Modify: `src/components/DDCheckoutDialog.jsx` (~line 444 effect) — count becomes API corrections + `collectAuthorLayer(graphData)` totals; the dialog needs `graphData` (or the precomputed count) passed from the graph component. Prefer passing `authorElementCount` as a prop.
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` — `graphInteractionParams`: when `isAuthorNode(node)`, return `{ node_kind: node.type, origin: 'author' }` and no name/group key.

- [ ] **Step 1: Checkout** — `setCorrectionsCount(apiCount + authorElementCount)`.
- [ ] **Step 2: Analytics** — read `graphInteractionParams`; if it emits `node_name` or `group_key`, branch for author nodes as above. Add `origin: 'author'` to `runContextAction` params when the context node is an author node.
- [ ] **Step 3: Hand-check list** (desktop + touch): the Dutch case end to end — add entity (company, NL), link three existing persons to it with label Director, add a fourth person, link it, dismiss one registry link, rename nothing, export the situation report (HTML and Copy for Word), open the HTML: notice under byline, dotted map elements, legend row, annex, asserted hop if a connection chapter crosses an author link. Save a snapshot, reload it, confirm everything survives.
- [ ] **Step 4: Commit** — `feat(author-layer): checkout warning counts author work; analytics never carry author names`

---

## Self-review

- Spec coverage: rule (T1), data model (T1), operations add link (T4), add entity (T5), edit/delete (T4–T5), dismiss (T10), guards (T5), menus (T6), rendering canvas/legend (T3), SVG (T9), document model (T7), document surfaces 1–5 (T8), Word (T9), checkout (T11), persistence (no task needed: snapshot passes fields through; T11 hand-check covers round-trip), reach/analytics (T5, T11), renamedFrom (T1, T10), timeline undated (no code: author elements have no registry dates and fall into the existing undated count; T11 hand-check confirms visibility at every date).
- Type consistency: `makeAuthorLink` / `makeAuthorNode` / `collectAuthorLayer` / `dismissLink` / `restoreLink` / `markRenamed` / `removeAuthorNode` / `visibleWithoutDismissed` / `isAuthorNode` / `isAuthorLink` / `isDismissedLink` / `isRenamedNode` used with the same names throughout. Hop `origin` values `'author' | 'registry'`; `evidence.authorHops` number; `doc.authorLayer`, `doc.counts.authorElements`; annex id `authorLayer`.
