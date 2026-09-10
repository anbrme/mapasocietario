# Report Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the DD generator to a single paid mode (`faithful`) and turn the free client-side report into a self-contained interactive HTML "Informe de situación" carrying the user's map, corrections and notes.

**Architecture:** All user work (node notes, canvas membership, merges) lives only in browser state, so the free artefact is built entirely client-side. A new pure document model (`investigationDoc.js`) joins the existing relationship scope to node notes and corrections; a new pure renderer (`investigationExport/`) emits one self-contained `.html` file — inline CSS, inline JSON, vanilla JS, no CDN. d3-force has already settled node `x`/`y`, so the export draws SVG at known coordinates and needs no physics engine or library. The backend loses two of three modes and becomes incapable of producing a non-authoritative document.

**Tech Stack:** React 19 + Vite 5 + MUI (frontend), Vitest (node environment, pure-logic tests only — no jsdom), Python 3 + Flask (DD generator), pytest.

**Spec:** `docs/superpowers/specs/2026-09-10-report-consolidation-design.md`

## Global Constraints

- **Two repos.** Frontend = `~/mapasocietario`. Backend = `~/ncdata-bormes-impl`. Tasks are prefixed `F` / `B`; never mix repos in one commit.
- **Deploy order is frontend first, backend second.** Once the client stops sending `mode`, the server branches are provably unreachable. Reverse order is still safe (unknown `mode` falls back to faithful) but pointless.
- **Naming, exact:** ES `Informe de situación`, EN `Situation report`. The word `interactivo` / `interactive` is **never** part of the name — only a descriptor beside the control (`se abre en tu navegador` / `opens in your browser`).
- **`Investigation report` is a banned label.** `investigationSet` and the "Investigar selección" button already own that word and open the **paid** AI panel.
- **Commit with `git -c commit.gpgsign=false commit`** — this machine's signing config breaks non-interactive commits.
- **Every commit message ends with:**
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0161fb7V6eBH5mtgxLFT4Bz5
  ```
- **Vitest is node-environment and pure-logic only** (`vitest.config.js`). Do not write component tests or import React in a `.test.js`. Canvas/UX behaviour is verified by running the app.
- **Note text is user input rendered into HTML.** Every interpolation of a note, name, or correction into an HTML string goes through `escapeHtml` (Task F1). This is the XSS boundary of the whole feature.
- **Flag names are the persistence contract** (`src/utils/nodeNotes.js:14`): a stored note holds `'amber'`, never a hex value. The export maps flag *names* to its own inline palette and never reads `src/theme/palette.js`.

---

## File Structure

**Frontend — created:**
| File | Responsibility |
|---|---|
| `src/utils/escapeHtml.js` | The single HTML-escape helper. One export, no deps. |
| `src/utils/investigationDoc.js` | Pure document model: joins scope + node notes + corrections into the shape every renderer consumes. |
| `src/utils/investigationExport/renderGraphSvg.js` | Pure: graph → SVG string at settled `x`/`y` coordinates. |
| `src/utils/investigationExport/walkthroughScript.js` | The vanilla-JS walkthrough, as a string constant. |
| `src/utils/investigationExport/buildExportHtml.js` | Assembles the self-contained `.html` file. |
| `src/utils/investigationExport/exportCopy.js` | ES/EN strings for the exported file (it has no access to the app's `text` object). |

**Frontend — modified:**
| File | Change |
|---|---|
| `src/utils/relationshipScope.js` | Additive only: emit `companyNodes` alongside `companies`. |
| `src/utils/relationshipReportHtml.js` | Render from the doc model instead of raw scope; use shared `escapeHtml`. |
| `src/components/RelationshipReportModal.jsx` | Becomes the situation-report preview: network-note field, Download action, no print. |
| `src/components/SpanishCompanyNetworkGraph.jsx` | Network-note state, snapshot `context`, toolbar hierarchy + gate, delete the vestigial group_key resolve, copy keys. |
| `src/components/DDCheckoutDialog.jsx` | Delete the mode toggle and `mode`/`account_id`/`group_key` payload fields; the box becomes a statement. |

**Backend — deleted:** `borme_relationship_report.py`.
**Backend — modified:** `borme_dd_report.py`, `borme_corrections.py`, `test_dd_registry_notes.py`, `test_dd_v2_render.py`.

---

## Task F1: The shared escape helper

Extracted first because every later renderer depends on it, and it is the feature's XSS boundary.

**Files:**
- Create: `src/utils/escapeHtml.js`
- Create: `src/utils/escapeHtml.test.js`
- Modify: `src/utils/relationshipReportHtml.js:5-7` (delete the local `esc`, import the shared one)

**Interfaces:**
- Consumes: nothing.
- Produces: `escapeHtml(value: unknown) => string` — null/undefined become `''`; escapes `&`, `<`, `>`, `"`, `'`.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/escapeHtml.test.js
import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escapeHtml';

describe('escapeHtml', () => {
  it('escapes every character that could break out of an attribute or element', () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)'>&`))
      .toBe('&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;');
  });

  it('returns an empty string for null and undefined rather than "null"', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('escapes the ampersand first so existing entities are not double-decoded', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('stringifies non-string input', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/mapasocietario && npx vitest run src/utils/escapeHtml.test.js`
Expected: FAIL — "Failed to resolve import ./escapeHtml"

- [ ] **Step 3: Write minimal implementation**

```js
// src/utils/escapeHtml.js
// The single HTML-escape helper for every string this app interpolates into
// markup it generates (the situation report, its exported file, copy-for-Word).
// Node notes are user input, so this is the XSS boundary of that whole path.
// The ampersand MUST be replaced first, or the entities written by the later
// replacements get their own ampersands escaped a second time.

export const escapeHtml = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/mapasocietario && npx vitest run src/utils/escapeHtml.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Point the existing report builder at it**

In `src/utils/relationshipReportHtml.js`, delete the local `const esc = ...` block (lines 5-7) and add at the top of the imports:

```js
import { escapeHtml as esc } from './escapeHtml';
```

Leave every `esc(...)` call site alone — the alias keeps this step a pure move.

- [ ] **Step 6: Run the whole suite to prove nothing regressed**

Run: `cd ~/mapasocietario && npx vitest run`
Expected: PASS, same test count as before plus 4.

- [ ] **Step 7: Commit**

```bash
cd ~/mapasocietario
git add src/utils/escapeHtml.js src/utils/escapeHtml.test.js src/utils/relationshipReportHtml.js
git -c commit.gpgsign=false commit -m "refactor: extract the shared HTML escape helper

Note text is user input rendered into generated markup, so escaping needs one
implementation with its own tests rather than a copy per renderer.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0161fb7V6eBH5mtgxLFT4Bz5"
```

---

## Task F2: Scope emits company node ids

`extractVisibleScope` returns company **names** only, but notes are keyed by node id. Matching companies to their notes by name would break on any two nodes sharing a name. This is additive: `companies` keeps its exact current shape so the existing modal and HTML builder are untouched.

**Files:**
- Modify: `src/utils/relationshipScope.js:100-115` (the return block)
- Create: `src/utils/relationshipScope.test.js`

**Interfaces:**
- Consumes: `extractVisibleScope(graphData, normalizeId, subjectIds)` (unchanged signature).
- Produces: the returned object gains `companyNodes: Array<{ name: string, nodeId: string }>`, in the same order as `companies`. `connectors[].nodeId` already exists and is unchanged.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/relationshipScope.test.js
import { describe, expect, it } from 'vitest';
import { extractVisibleScope } from './relationshipScope';

const graph = {
  nodes: [
    { id: 'c1', type: 'company', name: 'ALFA SL' },
    { id: 'c2', type: 'company', name: 'BETA SL' },
    { id: 'o1', type: 'officer', name: 'GARCIA LOPEZ ANA' },
  ],
  links: [
    { source: 'c1', target: 'o1', category: 'nombramiento', relationship: 'Administrador' },
    { source: 'c2', target: 'o1', category: 'nombramiento', relationship: 'Administrador' },
  ],
};
const subjects = new Set(['c1', 'c2']);

describe('extractVisibleScope', () => {
  it('emits a node id alongside each company name, in the same order', () => {
    const scope = extractVisibleScope(graph, x => x, subjects);

    expect(scope.companies).toEqual(['ALFA SL', 'BETA SL']);
    expect(scope.companyNodes).toEqual([
      { name: 'ALFA SL', nodeId: 'c1' },
      { name: 'BETA SL', nodeId: 'c2' },
    ]);
  });

  it('keeps distinct node ids for two companies that share a name', () => {
    const dupes = {
      nodes: [
        { id: 'c1', type: 'company', name: 'ALFA SL' },
        { id: 'c2', type: 'company', name: 'ALFA SL' },
      ],
      links: [],
    };
    const scope = extractVisibleScope(dupes, x => x, new Set(['c1', 'c2']));

    expect(scope.companyNodes.map(c => c.nodeId)).toEqual(['c1', 'c2']);
  });

  it('still surfaces connectors with their node id', () => {
    const scope = extractVisibleScope(graph, x => x, subjects);

    expect(scope.connectors).toHaveLength(1);
    expect(scope.connectors[0].nodeId).toBe('o1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/mapasocietario && npx vitest run src/utils/relationshipScope.test.js`
Expected: FAIL — `scope.companyNodes` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `src/utils/relationshipScope.js`, inside the returned object literal, add `companyNodes` directly beneath `companies`:

```js
  return {
    companies: companies.map(c => c.name),
    // Notes are keyed by node id, and two visible companies can share a name,
    // so callers that need to join notes to companies must not match on name.
    companyNodes: companies.map(c => ({ name: c.name, nodeId: normalizeId(c.id) })),
    officersByCompany: Object.fromEntries(
      Object.entries(officersByCompany).map(([c, set]) => [c, [...set]])),
    connectors,
    ownership,
    sharedNodeIds,
    counts: {
      companies: companies.length,
      officers: Object.keys(companiesPerOfficer).length,
      sharedPeople,
    },
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/mapasocietario && npx vitest run src/utils/relationshipScope.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the whole suite — this file has existing consumers**

Run: `cd ~/mapasocietario && npx vitest run`
Expected: PASS. `graphUnify.test.js` and the graph snapshot tests must be unchanged; the addition is purely additive.

- [ ] **Step 6: Commit**

```bash
cd ~/mapasocietario
git add src/utils/relationshipScope.js src/utils/relationshipScope.test.js
git -c commit.gpgsign=false commit -m "feat(graph): emit company node ids from the visible scope

Notes are keyed by node id and two visible companies can share a name, so the
document model cannot join them by name. Additive: companies keeps its shape.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0161fb7V6eBH5mtgxLFT4Bz5"
```

---

## Task F3: The document model

The heart of the feature. **Note collection walks the graph independently of the relationship scoping rule** — `extractVisibleScope` drops officers appearing at only one company, but a user who wrote a note on such a node meant it, so it must still reach the document.

**Files:**
- Create: `src/utils/investigationDoc.js`
- Create: `src/utils/investigationDoc.test.js`

**Interfaces:**
- Consumes: `extractVisibleScope(...)` output including `companyNodes` (Task F2); `hasNodeNote(node)` from `src/utils/nodeNotes.js`.
- Produces:
  ```
  buildInvestigationDoc({ graphData, scope, networkNote, corrections, primarySubject, generatedAt })
    => {
      subject: string,                 // '' when unknown
      generatedAt: string,             // ISO 8601
      networkNote: string,             // '' when unwritten
      flagged:   Array<NoteEntry>,     // flag 'red' then 'amber', red first
      companies: Array<{ nodeId, name, note: Note|null }>,
      connectors: Array<Connector & { note: Note|null }>,
      ownership: Array<{ owner, owned, lost }>,
      otherNotes: Array<NoteEntry>,
      corrections: Array<{ action, nameA, nameB, resignedDate }>,
      counts: { companies, officers, sharedPeople, notes, flagged },
    }
  // Note      = { text: string, flag: string, updatedAt?: string }
  // NoteEntry = { nodeId, name, type, flag, text }
  ```

- [ ] **Step 1: Write the failing test**

```js
// src/utils/investigationDoc.test.js
import { describe, expect, it } from 'vitest';
import { buildInvestigationDoc } from './investigationDoc';

const AT = '2026-09-10T09:00:00.000Z';

// c1/c2 are subject companies; o1 bridges them (a connector); o2 sits at c1
// only, so the relationship rule drops it — but it carries a note, so the
// document must still surface it.
const graphData = {
  nodes: [
    { id: 'c1', type: 'company', name: 'ALFA SL', userNote: { text: 'Same address as BETA', flag: 'red', updatedAt: AT } },
    { id: 'c2', type: 'company', name: 'BETA SL' },
    { id: 'o1', type: 'officer', name: 'GARCIA LOPEZ ANA', userNote: { text: 'Signs for both', flag: 'amber', updatedAt: AT } },
    { id: 'o2', type: 'officer', name: 'RUIZ MARTIN LUIS', userNote: { text: 'Resigned days before the filing', flag: 'blue', updatedAt: AT } },
  ],
  links: [],
};

const scope = {
  companies: ['ALFA SL', 'BETA SL'],
  companyNodes: [{ name: 'ALFA SL', nodeId: 'c1' }, { name: 'BETA SL', nodeId: 'c2' }],
  connectors: [{ name: 'GARCIA LOPEZ ANA', nodeId: 'o1', type: 'individual', companies: ['ALFA SL', 'BETA SL'], roles: ['Administrador'], status: 'active' }],
  ownership: [{ owner: 'ALFA SL', owned: 'BETA SL', lost: false }],
  counts: { companies: 2, officers: 2, sharedPeople: 1 },
};

const build = (over = {}) => buildInvestigationDoc({
  graphData, scope, networkNote: '', corrections: [],
  primarySubject: 'ALFA SL', generatedAt: AT, ...over,
});

describe('buildInvestigationDoc', () => {
  it('surfaces a noted node the relationship rule dropped, under otherNotes', () => {
    const doc = build();

    expect(doc.otherNotes).toEqual([{
      nodeId: 'o2', name: 'RUIZ MARTIN LUIS', type: 'officer',
      flag: 'blue', text: 'Resigned days before the filing',
    }]);
  });

  it('lists red before amber in flagged and excludes other flags', () => {
    const doc = build();

    expect(doc.flagged.map(f => [f.flag, f.nodeId]))
      .toEqual([['red', 'c1'], ['amber', 'o1']]);
  });

  it('omits flagged entirely when nothing is flagged red or amber', () => {
    const unflagged = {
      ...graphData,
      nodes: graphData.nodes.map(n => (
        n.userNote ? { ...n, userNote: { ...n.userNote, flag: 'green' } } : n
      )),
    };
    const doc = build({ graphData: unflagged });

    expect(doc.flagged).toEqual([]);
    expect(doc.counts.flagged).toBe(0);
  });

  it('attaches each note to its company and connector by node id', () => {
    const doc = build();

    expect(doc.companies[0].note.text).toBe('Same address as BETA');
    expect(doc.companies[1].note).toBeNull();
    expect(doc.connectors[0].note.text).toBe('Signs for both');
  });

  it('never double-reports a note that already appears on a company or connector', () => {
    const doc = build();
    const otherIds = doc.otherNotes.map(n => n.nodeId);

    expect(otherIds).not.toContain('c1');
    expect(otherIds).not.toContain('o1');
  });

  it('ignores notes whose text is blank', () => {
    const blank = {
      ...graphData,
      nodes: [...graphData.nodes, { id: 'o3', type: 'officer', name: 'EMPTY', userNote: { text: '   ', flag: 'red' } }],
    };
    const doc = build({ graphData: blank });

    expect(doc.otherNotes.map(n => n.nodeId)).not.toContain('o3');
    expect(doc.flagged.map(f => f.nodeId)).not.toContain('o3');
  });

  it('carries the network note, subject, corrections and counts through', () => {
    const doc = build({
      networkNote: '  Checking a suspected common controller.  ',
      corrections: [{ action: 'merge', name_a: 'GARCIA LOPEZ, ANA', name_b: 'GARCIA LOPEZ ANA' }],
    });

    expect(doc.networkNote).toBe('Checking a suspected common controller.');
    expect(doc.subject).toBe('ALFA SL');
    expect(doc.generatedAt).toBe(AT);
    expect(doc.corrections).toEqual([
      { action: 'merge', nameA: 'GARCIA LOPEZ, ANA', nameB: 'GARCIA LOPEZ ANA', resignedDate: '' },
    ]);
    expect(doc.counts).toEqual({ companies: 2, officers: 2, sharedPeople: 1, notes: 3, flagged: 2 });
  });

  it('does not mutate its inputs', () => {
    const frozen = JSON.parse(JSON.stringify(graphData));
    build();

    expect(graphData).toEqual(frozen);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/mapasocietario && npx vitest run src/utils/investigationDoc.test.js`
Expected: FAIL — "Failed to resolve import ./investigationDoc"

- [ ] **Step 3: Write minimal implementation**

```js
// src/utils/investigationDoc.js
// The document model behind the situation report ("Informe de situación") and
// its exported HTML file. Pure: no DOM, no network, no mutation of inputs.
//
// The one rule worth remembering: NOTE COLLECTION IS INDEPENDENT OF THE
// RELATIONSHIP SCOPING RULE. extractVisibleScope drops officers who appear at
// only one subject company, but a user who wrote a note on such a node meant
// it, so notes are gathered by walking the graph and are only afterwards joined
// to the scope's companies and connectors. Anything left over lands in
// otherNotes rather than vanishing.
//
// Hidden nodes need no special handling: callers pass filteredGraphData, which
// already excludes them. That is the correct default — the document describes
// the graph you are looking at.

import { hasNodeNote } from './nodeNotes';

// Flags a person reaches for when something is wrong, most urgent first. Any
// other flag ('blue', 'green', 'none') is a note, not a finding.
const FLAGGED_ORDER = ['red', 'amber'];

const normalizeNodeId = id => (id == null ? '' : String(id));

const noteEntry = node => ({
  nodeId: normalizeNodeId(node.id),
  name: node.name || '',
  type: node.type || '',
  flag: node.userNote.flag || 'none',
  text: node.userNote.text.trim(),
});

export function buildInvestigationDoc({
  graphData,
  scope,
  networkNote = '',
  corrections = [],
  primarySubject = '',
  generatedAt = new Date().toISOString(),
}) {
  const notedNodes = (graphData?.nodes || []).filter(hasNodeNote);
  const notesById = new Map(notedNodes.map(n => [normalizeNodeId(n.id), n.userNote]));

  const noteFor = nodeId => {
    const note = notesById.get(normalizeNodeId(nodeId));
    return note ? { ...note, text: note.text.trim() } : null;
  };

  const companies = (scope?.companyNodes || []).map(c => ({
    nodeId: c.nodeId,
    name: c.name,
    note: noteFor(c.nodeId),
  }));

  const connectors = (scope?.connectors || []).map(c => ({
    ...c,
    note: noteFor(c.nodeId),
  }));

  // Everything already shown in place must not be repeated at the bottom.
  const placed = new Set([
    ...companies.filter(c => c.note).map(c => c.nodeId),
    ...connectors.filter(c => c.note).map(c => normalizeNodeId(c.nodeId)),
  ]);

  const otherNotes = notedNodes
    .filter(n => !placed.has(normalizeNodeId(n.id)))
    .map(noteEntry);

  const flagged = FLAGGED_ORDER.flatMap(flag => notedNodes
    .filter(n => n.userNote.flag === flag)
    .map(noteEntry));

  return {
    subject: primarySubject || '',
    generatedAt,
    networkNote: String(networkNote || '').trim(),
    flagged,
    companies,
    connectors,
    ownership: [...(scope?.ownership || [])],
    otherNotes,
    corrections: (corrections || []).map(c => ({
      action: c.action || '',
      nameA: c.name_a || '',
      nameB: c.name_b || '',
      resignedDate: c.resigned_date || '',
    })),
    counts: {
      ...(scope?.counts || { companies: 0, officers: 0, sharedPeople: 0 }),
      notes: notedNodes.length,
      flagged: flagged.length,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/mapasocietario && npx vitest run src/utils/investigationDoc.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/mapasocietario
git add src/utils/investigationDoc.js src/utils/investigationDoc.test.js
git -c commit.gpgsign=false commit -m "feat(graph): build the situation report document model

Joins the visible relationship scope to node notes and the corrections overlay.
Notes are collected by walking the graph, not derived from the scoping rule, so
a note on a single-company officer still reaches the document instead of being
silently dropped.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0161fb7V6eBH5mtgxLFT4Bz5"
```

---

## Task F4: Export copy strings

The exported file has no access to the app's `text` object — it must carry its own strings. Split out first so the two renderers that need it (F5, F6) both consume one source.

**Files:**
- Create: `src/utils/investigationExport/exportCopy.js`
- Create: `src/utils/investigationExport/exportCopy.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `exportCopy(lang: 'es'|'en') => { title, subject, generated, nonAuthoritative, sourceLine, summaryNote, flagged, companies, connections, ownership, otherNotes, corrections, none, person, inCompanies, role, status, active, ceased, mixed, entity, individual, walkthrough, step, of, next, prev, exit, soleOf, lostOf, actionHide, actionMerge, actionResigned, actionActive, backLink }` — every value a string.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/investigationExport/exportCopy.test.js
import { describe, expect, it } from 'vitest';
import { exportCopy, EXPORT_COPY_KEYS } from './exportCopy';

describe('exportCopy', () => {
  it('names the artefact "Informe de situación" in Spanish', () => {
    expect(exportCopy('es').title).toBe('Informe de situación');
  });

  it('names it "Situation report" in English', () => {
    expect(exportCopy('en').title).toBe('Situation report');
  });

  it('never puts the medium in the title', () => {
    expect(exportCopy('es').title.toLowerCase()).not.toContain('interactiv');
    expect(exportCopy('en').title.toLowerCase()).not.toContain('interactiv');
  });

  it('defines every key in both languages', () => {
    EXPORT_COPY_KEYS.forEach(key => {
      expect(typeof exportCopy('es')[key], `es.${key}`).toBe('string');
      expect(exportCopy('es')[key].length, `es.${key}`).toBeGreaterThan(0);
      expect(typeof exportCopy('en')[key], `en.${key}`).toBe('string');
      expect(exportCopy('en')[key].length, `en.${key}`).toBeGreaterThan(0);
    });
  });

  it('falls back to Spanish for an unknown language', () => {
    expect(exportCopy('fr').title).toBe('Informe de situación');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/mapasocietario && npx vitest run src/utils/investigationExport/exportCopy.test.js`
Expected: FAIL — "Failed to resolve import ./exportCopy"

- [ ] **Step 3: Write minimal implementation**

```js
// src/utils/investigationExport/exportCopy.js
// Strings for the exported situation-report file. It is a standalone document
// with no access to the app's `text` object, so its copy lives here.
//
// NAMING IS FIXED: "Informe de situación" / "Situation report". The medium is
// never part of the name — see the spec. An informe de situación is a genre in
// which the author is the authority, which is precisely this artefact's status;
// that is what makes it non-authoritative without a disclaimer doing the work.

const ES = {
  title: 'Informe de situación',
  subject: 'Asunto',
  generated: 'Generado el',
  nonAuthoritative: 'Documento no autoritativo — redactado por su autor, no por el registro.',
  sourceLine: 'Datos derivados del BORME (Registro Mercantil). Las notas son del autor de este informe.',
  summaryNote: 'Resumen',
  flagged: 'Señalado',
  companies: 'Empresas analizadas',
  connections: 'Conexiones compartidas',
  ownership: 'Vínculos de propiedad',
  otherNotes: 'Otras notas',
  corrections: 'Correcciones aplicadas por el autor',
  none: 'Ninguna detectada',
  person: 'Persona / entidad',
  inCompanies: 'Empresas',
  role: 'Cargo',
  status: 'Estado',
  active: 'Vigente',
  ceased: 'Cesado',
  mixed: 'Mixto',
  entity: 'Entidad',
  individual: 'Persona',
  walkthrough: 'Recorrido',
  next: 'Siguiente',
  prev: 'Anterior',
  exit: 'Salir del recorrido',
  soleOf: 'es socio único de',
  lostOf: 'fue socio único de',
  actionHide: 'ocultado',
  actionMerge: 'unificado con',
  actionResigned: 'marcado como cesado',
  actionActive: 'marcado como vigente',
  backLink: 'Ver en Mapa Societario',
};

const EN = {
  title: 'Situation report',
  subject: 'Subject',
  generated: 'Generated',
  nonAuthoritative: 'Non-authoritative document — written by its author, not by the registry.',
  sourceLine: 'Data derived from BORME (Registro Mercantil). The notes are the author’s own.',
  summaryNote: 'Summary',
  flagged: 'Flagged',
  companies: 'Companies analysed',
  connections: 'Shared connections',
  ownership: 'Ownership links',
  otherNotes: 'Other notes',
  corrections: 'Corrections applied by the author',
  none: 'None detected',
  person: 'Person / entity',
  inCompanies: 'Companies',
  role: 'Role',
  status: 'Status',
  active: 'Active',
  ceased: 'Ceased',
  mixed: 'Mixed',
  entity: 'Entity',
  individual: 'Person',
  walkthrough: 'Walkthrough',
  next: 'Next',
  prev: 'Previous',
  exit: 'Exit walkthrough',
  soleOf: 'is sole shareholder of',
  lostOf: 'was sole shareholder of',
  actionHide: 'hidden',
  actionMerge: 'merged into',
  actionResigned: 'marked as ceased',
  actionActive: 'marked as active',
  backLink: 'View on Mapa Societario',
};

export const EXPORT_COPY_KEYS = Object.freeze(Object.keys(ES));

export const exportCopy = (lang) => (lang === 'en' ? EN : ES);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/mapasocietario && npx vitest run src/utils/investigationExport/exportCopy.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/mapasocietario
git add src/utils/investigationExport/exportCopy.js src/utils/investigationExport/exportCopy.test.js
git -c commit.gpgsign=false commit -m "feat(export): copy for the standalone situation report file

The exported file has no access to the app's text object, so it carries its own
strings. The key-parity test is what stops one language silently going missing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0161fb7V6eBH5mtgxLFT4Bz5"
```

---

## Task F5: The SVG graph renderer

**Files:**
- Create: `src/utils/investigationExport/renderGraphSvg.js`
- Create: `src/utils/investigationExport/renderGraphSvg.test.js`

**Interfaces:**
- Consumes: `escapeHtml` (Task F1).
- Produces:
  - `renderGraphSvg(graphData, { flaggedIds?: Set<string>|Array<string> }) => string` — a complete `<svg>` element with a fitted `viewBox`. Each node is `<g class="n" data-id="...">`; flagged nodes also get `data-flag`.
  - `graphBounds(nodes) => { minX, minY, maxX, maxY }` — exported for its own test.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/investigationExport/renderGraphSvg.test.js
import { describe, expect, it } from 'vitest';
import { renderGraphSvg, graphBounds } from './renderGraphSvg';

const graphData = {
  nodes: [
    { id: 'c1', type: 'company', name: 'ALFA SL', x: 0, y: 0, userNote: { text: 'n', flag: 'red' } },
    { id: 'o1', type: 'officer', name: 'GARCIA LOPEZ ANA', x: 100, y: 40 },
  ],
  links: [{ source: 'c1', target: 'o1' }],
};

describe('graphBounds', () => {
  it('fits the extremes of the settled layout', () => {
    expect(graphBounds(graphData.nodes)).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 40 });
  });

  it('returns a usable box for an empty graph rather than NaN', () => {
    expect(graphBounds([])).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 1 });
  });

  it('ignores nodes whose coordinates were never settled', () => {
    expect(graphBounds([{ id: 'a', x: 5, y: 5 }, { id: 'b' }]))
      .toEqual({ minX: 5, minY: 5, maxX: 5, maxY: 5 });
  });
});

describe('renderGraphSvg', () => {
  it('emits one positioned group per node, tagged with its id', () => {
    const svg = renderGraphSvg(graphData, {});

    expect(svg).toContain('data-id="c1"');
    expect(svg).toContain('data-id="o1"');
    expect(svg.match(/class="n"/g)).toHaveLength(2);
  });

  it('resolves object link endpoints that d3-force has mutated', () => {
    const mutated = {
      nodes: graphData.nodes,
      links: [{ source: graphData.nodes[0], target: graphData.nodes[1] }],
    };

    expect(renderGraphSvg(mutated, {})).toContain('<line');
  });

  it('drops links whose endpoints are not both present', () => {
    const dangling = { nodes: graphData.nodes, links: [{ source: 'c1', target: 'ghost' }] };

    expect(renderGraphSvg(dangling, {})).not.toContain('<line');
  });

  it('marks flagged nodes so the walkthrough can find them', () => {
    const svg = renderGraphSvg(graphData, { flaggedIds: ['c1'] });

    expect(svg).toContain('data-flag="red"');
  });

  it('escapes a node name that would otherwise close the element', () => {
    const hostile = { nodes: [{ id: 'x', name: '</text><script>alert(1)</script>', x: 1, y: 1 }], links: [] };
    const svg = renderGraphSvg(hostile, {});

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;/text&gt;');
  });

  it('fits the viewBox to the layout with a margin', () => {
    expect(renderGraphSvg(graphData, {})).toMatch(/viewBox="-40 -40 180 120"/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/mapasocietario && npx vitest run src/utils/investigationExport/renderGraphSvg.test.js`
Expected: FAIL — "Failed to resolve import ./renderGraphSvg"

- [ ] **Step 3: Write minimal implementation**

```js
// src/utils/investigationExport/renderGraphSvg.js
// The graph, as SVG, for the exported situation-report file.
//
// This needs no physics engine and no layout algorithm: d3-force has already
// settled every node's x/y in the live canvas, and graphSnapshot.js keeps those
// two properties for exactly this reason (it strips index/vx/vy, which are
// simulation scratch). So the renderer draws at coordinates it already has.
//
// Output is a static, self-contained <svg>. Interactivity is added separately
// by walkthroughScript.js, which finds nodes via their data-id attribute.

import { escapeHtml } from '../escapeHtml';

const MARGIN = 40;
const COMPANY_RADIUS = 11;
const OFFICER_RADIUS = 7;
const LABEL_OFFSET = 6;
const LABEL_MAX_CHARS = 28;

const endpointId = e => (e && typeof e === 'object' ? e.id : e);
const nodeId = id => (id == null ? '' : String(id));
const isCompany = n => n?.type === 'company' || n?.type === 'spanish-company-group';
const finite = v => (Number.isFinite(v) ? v : null);

export const graphBounds = (nodes) => {
  const points = (nodes || [])
    .map(n => [finite(n?.x), finite(n?.y)])
    .filter(([x, y]) => x !== null && y !== null);

  if (points.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };

  return {
    minX: Math.min(...points.map(p => p[0])),
    minY: Math.min(...points.map(p => p[1])),
    maxX: Math.max(...points.map(p => p[0])),
    maxY: Math.max(...points.map(p => p[1])),
  };
};

const truncate = (name) => {
  const s = String(name || '');
  return s.length > LABEL_MAX_CHARS ? `${s.slice(0, LABEL_MAX_CHARS - 1)}…` : s;
};

export function renderGraphSvg(graphData, { flaggedIds } = {}) {
  const nodes = (graphData?.nodes || []).filter(n => finite(n?.x) !== null && finite(n?.y) !== null);
  const byId = new Map(nodes.map(n => [nodeId(n.id), n]));
  const flagged = flaggedIds instanceof Set ? flaggedIds : new Set(flaggedIds || []);

  const lines = (graphData?.links || []).map(l => {
    const a = byId.get(nodeId(endpointId(l.source)));
    const b = byId.get(nodeId(endpointId(l.target)));
    // A link can outlive one of its endpoints (hidden or deleted node); drawing
    // it would throw on the missing coordinates.
    if (!a || !b) return '';
    return `<line class="l" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
  }).join('');

  const groups = nodes.map(n => {
    const id = nodeId(n.id);
    const r = isCompany(n) ? COMPANY_RADIUS : OFFICER_RADIUS;
    const flag = flagged.has(id) ? (n.userNote?.flag || 'none') : '';
    const flagAttr = flag ? ` data-flag="${escapeHtml(flag)}"` : '';
    const kind = isCompany(n) ? 'company' : 'officer';
    return (
      `<g class="n" data-id="${escapeHtml(id)}" data-kind="${kind}"${flagAttr}>`
      + `<circle cx="${n.x}" cy="${n.y}" r="${r}"/>`
      + `<text x="${n.x}" y="${n.y - r - LABEL_OFFSET}">${escapeHtml(truncate(n.name))}</text>`
      + '</g>'
    );
  }).join('');

  const { minX, minY, maxX, maxY } = graphBounds(nodes);
  const viewBox = [
    minX - MARGIN,
    minY - MARGIN,
    (maxX - minX) + MARGIN * 2,
    (maxY - minY) + MARGIN * 2,
  ].join(' ');

  return `<svg id="map" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="img">`
    + `<g id="viewport"><g class="links">${lines}</g><g class="nodes">${groups}</g></g></svg>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/mapasocietario && npx vitest run src/utils/investigationExport/renderGraphSvg.test.js`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/mapasocietario
git add src/utils/investigationExport/renderGraphSvg.js src/utils/investigationExport/renderGraphSvg.test.js
git -c commit.gpgsign=false commit -m "feat(export): render the settled graph layout as standalone SVG

d3-force has already settled x/y and graphSnapshot deliberately preserves them,
so the export needs no physics engine and no library -- it draws at coordinates
it already has.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0161fb7V6eBH5mtgxLFT4Bz5"
```

---

## Task F6: The walkthrough script

Vanilla JS, shipped as a string. Kept deliberately small — it is the only part of the export that is not covered by a pure unit test, so it has to be readable in one sitting.

**Files:**
- Create: `src/utils/investigationExport/walkthroughScript.js`
- Create: `src/utils/investigationExport/walkthroughScript.test.js`

**Interfaces:**
- Consumes: nothing at build time. At runtime inside the exported file it reads a global `__SITREP__ = { steps: [{ nodeId, name, flag, text }] }` and the DOM produced by `renderGraphSvg` (`#map`, `#viewport`, `g.n[data-id]`).
- Produces: `WALKTHROUGH_SCRIPT: string` — the body of a `<script>` tag, containing no `</script>` sequence.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/investigationExport/walkthroughScript.test.js
import { describe, expect, it } from 'vitest';
import { WALKTHROUGH_SCRIPT } from './walkthroughScript';

describe('WALKTHROUGH_SCRIPT', () => {
  it('never contains a closing script tag that would truncate the file', () => {
    expect(WALKTHROUGH_SCRIPT).not.toMatch(/<\/script/i);
  });

  it('reads its steps from the global the template writes', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('__SITREP__');
  });

  it('binds the controls the template renders', () => {
    ['wt-next', 'wt-prev', 'wt-exit', 'wt-start'].forEach(id => {
      expect(WALKTHROUGH_SCRIPT, id).toContain(id);
    });
  });

  it('is parseable JavaScript', () => {
    expect(() => new Function(WALKTHROUGH_SCRIPT)).not.toThrow();
  });

  it('guards on a missing map so a step-less file still opens', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('if (!map)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/mapasocietario && npx vitest run src/utils/investigationExport/walkthroughScript.test.js`
Expected: FAIL — "Failed to resolve import ./walkthroughScript"

- [ ] **Step 3: Write minimal implementation**

```js
// src/utils/investigationExport/walkthroughScript.js
// The interactive layer of the exported situation report, as a string injected
// into a <script> tag. Vanilla JS, no dependencies, no network.
//
// It must never contain the sequence "</script>" or it truncates the file it
// lives in — walkthroughScript.test.js pins that.
//
// Scope is deliberately small: pan/zoom the SVG, show a note on click, and step
// through the flagged notes. Anything more belongs in the app, not in a file
// that leaves our control the moment it is downloaded.

export const WALKTHROUGH_SCRIPT = `
(function () {
  var data = window.__SITREP__ || { steps: [] };
  var map = document.getElementById('map');
  var viewport = document.getElementById('viewport');
  if (!map) return;

  var panel = document.getElementById('wt-panel');
  var body = document.getElementById('wt-body');
  var counter = document.getElementById('wt-counter');
  var idx = -1;

  function nodeEl(id) {
    return map.querySelector('g.n[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
  }

  function clearFocus() {
    map.classList.remove('focused');
    Array.prototype.forEach.call(map.querySelectorAll('g.n.on'), function (el) {
      el.classList.remove('on');
    });
  }

  function show(i) {
    var step = data.steps[i];
    if (!step) return;
    idx = i;
    clearFocus();
    var el = nodeEl(step.nodeId);
    if (el) {
      map.classList.add('focused');
      el.classList.add('on');
    }
    if (body) {
      body.innerHTML = '';
      var h = document.createElement('strong');
      h.textContent = step.name;
      var p = document.createElement('p');
      p.textContent = step.text;
      body.appendChild(h);
      body.appendChild(p);
      body.setAttribute('data-flag', step.flag || 'none');
    }
    if (counter) counter.textContent = (i + 1) + ' / ' + data.steps.length;
    if (panel) panel.hidden = false;
  }

  function exit() {
    idx = -1;
    clearFocus();
    if (panel) panel.hidden = true;
  }

  function on(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  on('wt-start', function () { show(0); });
  on('wt-next', function () { show(Math.min(idx + 1, data.steps.length - 1)); });
  on('wt-prev', function () { show(Math.max(idx - 1, 0)); });
  on('wt-exit', exit);

  document.addEventListener('keydown', function (e) {
    if (idx < 0) return;
    if (e.key === 'ArrowRight') show(Math.min(idx + 1, data.steps.length - 1));
    if (e.key === 'ArrowLeft') show(Math.max(idx - 1, 0));
    if (e.key === 'Escape') exit();
  });

  // Clicking any node shows its note, whether or not it is a walkthrough step.
  map.addEventListener('click', function (e) {
    var g = e.target.closest ? e.target.closest('g.n') : null;
    if (!g) return;
    var id = g.getAttribute('data-id');
    for (var i = 0; i < data.steps.length; i++) {
      if (data.steps[i].nodeId === id) { show(i); return; }
    }
  });

  // Pan and zoom by rewriting one transform — no library, no re-layout.
  var tx = 0, ty = 0, scale = 1, dragging = false, lastX = 0, lastY = 0;
  function apply() {
    if (viewport) viewport.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + scale + ')');
  }
  map.addEventListener('mousedown', function (e) { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mouseup', function () { dragging = false; });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    tx += e.clientX - lastX; ty += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    apply();
  });
  map.addEventListener('wheel', function (e) {
    e.preventDefault();
    scale = Math.min(6, Math.max(0.2, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    apply();
  }, { passive: false });
})();
`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/mapasocietario && npx vitest run src/utils/investigationExport/walkthroughScript.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/mapasocietario
git add src/utils/investigationExport/walkthroughScript.js src/utils/investigationExport/walkthroughScript.test.js
git -c commit.gpgsign=false commit -m "feat(export): walkthrough and pan/zoom for the exported report

Vanilla JS with no dependencies. Deliberately small: this is the only part of
the export not covered by a pure unit test, so it has to stay readable.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0161fb7V6eBH5mtgxLFT4Bz5"
```

---

## Task F7: Assemble the exported file

**Files:**
- Create: `src/utils/investigationExport/buildExportHtml.js`
- Create: `src/utils/investigationExport/buildExportHtml.test.js`
- Create: `src/utils/investigationExport/index.js`

**Interfaces:**
- Consumes: `buildInvestigationDoc` output (F3), `exportCopy` (F4), `renderGraphSvg` (F5), `WALKTHROUGH_SCRIPT` (F6), `escapeHtml` (F1).
- Produces:
  - `buildExportHtml(doc, graphData, { lang }) => string` — a complete `<!doctype html>` document.
  - `exportFileName(doc, lang) => string` — e.g. `Informe_de_situacion_ALFA_SL_20260910.html`.
  - `index.js` re-exports both.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/investigationExport/buildExportHtml.test.js
import { describe, expect, it } from 'vitest';
import { buildExportHtml, exportFileName } from './buildExportHtml';

const doc = {
  subject: 'ALFA SL',
  generatedAt: '2026-09-10T09:00:00.000Z',
  networkNote: 'Checking a suspected common controller.',
  flagged: [{ nodeId: 'c1', name: 'ALFA SL', type: 'company', flag: 'red', text: 'Same address as BETA' }],
  companies: [{ nodeId: 'c1', name: 'ALFA SL', note: { text: 'Same address as BETA', flag: 'red' } }],
  connectors: [{ name: 'GARCIA LOPEZ ANA', nodeId: 'o1', type: 'individual', companies: ['ALFA SL', 'BETA SL'], roles: ['Administrador'], status: 'active', note: null }],
  ownership: [{ owner: 'ALFA SL', owned: 'BETA SL', lost: false }],
  otherNotes: [],
  corrections: [{ action: 'merge', nameA: 'GARCIA LOPEZ, ANA', nameB: 'GARCIA LOPEZ ANA', resignedDate: '' }],
  counts: { companies: 2, officers: 2, sharedPeople: 1, notes: 1, flagged: 1 },
};

const graphData = {
  nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 0, y: 0 }],
  links: [],
};

describe('buildExportHtml', () => {
  it('is a complete self-contained document', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('</html>');
  });

  it('loads nothing from the network', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });

    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+stylesheet/i);
    expect(html).not.toMatch(/https?:\/\/(?!mapasocietario\.es)/);
  });

  it('carries attribution and a non-authoritative statement', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });

    expect(html).toContain('no autoritativo');
    expect(html).toContain('mapasocietario.es');
  });

  it('never calls itself an investigation report', () => {
    const es = buildExportHtml(doc, graphData, { lang: 'es' });
    const en = buildExportHtml(doc, graphData, { lang: 'en' });

    expect(es.toLowerCase()).not.toContain('informe de investigación');
    expect(en.toLowerCase()).not.toContain('investigation report');
  });

  it('escapes a hostile note instead of executing it', () => {
    const hostile = {
      ...doc,
      networkNote: '<script>alert(1)</script>',
      flagged: [{ ...doc.flagged[0], text: '<img src=x onerror=alert(1)>' }],
    };
    const html = buildExportHtml(hostile, graphData, { lang: 'es' });

    // Escaping neutralises the angle brackets; the inner text necessarily
    // survives as literal characters. Assert on the tags, not on the payload.
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x');
  });

  it('writes the flagged notes into the walkthrough global', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });

    expect(html).toContain('__SITREP__');
    expect(html).toContain('Same address as BETA');
  });

  it('omits the walkthrough controls when nothing is flagged', () => {
    const html = buildExportHtml({ ...doc, flagged: [], counts: { ...doc.counts, flagged: 0 } }, graphData, { lang: 'es' });

    expect(html).not.toContain('wt-start');
  });

  it('omits the summary section when no network note was written', () => {
    const html = buildExportHtml({ ...doc, networkNote: '' }, graphData, { lang: 'es' });

    expect(html).not.toContain('id="summary"');
  });

  it('defines colours for both themes', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });

    expect(html).toContain('prefers-color-scheme: dark');
  });
});

describe('exportFileName', () => {
  it('names the file after the subject and the generation date', () => {
    expect(exportFileName(doc, 'es')).toBe('Informe_de_situacion_ALFA_SL_20260910.html');
    expect(exportFileName(doc, 'en')).toBe('Situation_report_ALFA_SL_20260910.html');
  });

  it('strips characters a filesystem would reject', () => {
    expect(exportFileName({ ...doc, subject: 'A/B: "C" SL' }, 'en'))
      .toBe('Situation_report_A_B_C_SL_20260910.html');
  });

  it('still produces a name when there is no subject', () => {
    expect(exportFileName({ ...doc, subject: '' }, 'en')).toBe('Situation_report_20260910.html');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/mapasocietario && npx vitest run src/utils/investigationExport/buildExportHtml.test.js`
Expected: FAIL — "Failed to resolve import ./buildExportHtml"

- [ ] **Step 3: Write minimal implementation**

```js
// src/utils/investigationExport/buildExportHtml.js
// Assembles the situation report into ONE self-contained .html file: inline
// CSS, inline data, inline script. Nothing is fetched, so it opens offline,
// survives being emailed, and prints from the browser.
//
// Identity is deliberate (see the spec): attributed but clearly
// non-authoritative. Enough provenance that a forwarded file is credible and
// traceable back to us; never styled as a Mapa Societario deliverable, which
// would put it back in competition with the paid report.

import { escapeHtml as esc } from '../escapeHtml';
import { exportCopy } from './exportCopy';
import { renderGraphSvg } from './renderGraphSvg';
import { WALKTHROUGH_SCRIPT } from './walkthroughScript';

const SITE = 'https://mapasocietario.es';

// Flag NAMES are the persistence contract, so the export maps names to its own
// palette rather than reading the app theme (which the file cannot see anyway).
const FLAG_COLORS = {
  red: '#ef4444',
  amber: '#f59e0b',
  blue: '#3b82f6',
  green: '#22c55e',
  none: '#94a3b8',
};

const STYLE = `
:root{color-scheme:light dark;
--bg:#fbfbfa;--fg:#1c1c1a;--muted:#6b6b66;--line:#e2e2de;--card:#ffffff;
--company:#0f766e;--officer:#64748b;--link:#cbd5e1}
@media (prefers-color-scheme:dark){:root{
--bg:#14161a;--fg:#e8e8e4;--muted:#9a9a94;--line:#2a2d33;--card:#1c1f24;
--company:#2dd4bf;--officer:#94a3b8;--link:#3a3f47}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
font:14px/1.55 "IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.wrap{max-width:1000px;margin:0 auto;padding:32px 20px 64px}
header{border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:24px}
h1{font-size:1.5rem;margin:0 0 4px}
.meta{color:var(--muted);font-size:.8rem}
.warn{margin-top:10px;padding:8px 12px;border-left:3px solid var(--company);
background:var(--card);font-size:.82rem}
h2{font-size:1rem;margin:28px 0 8px;text-transform:uppercase;
letter-spacing:.07em;color:var(--muted)}
table{border-collapse:collapse;width:100%;font-size:.85rem}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:600}
.scroll{overflow-x:auto}
.note{font-size:.82rem;color:var(--muted);border-left:3px solid var(--f,#94a3b8);
padding-left:8px;margin:4px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:6px;
padding:10px 12px;margin-bottom:8px;border-left:3px solid var(--f,#94a3b8)}
.card strong{display:block;margin-bottom:2px}
#map{width:100%;height:520px;background:var(--card);
border:1px solid var(--line);border-radius:6px;cursor:grab;touch-action:none}
#map .l{stroke:var(--link);stroke-width:1}
#map g.n circle{fill:var(--officer)}
#map g.n[data-kind="company"] circle{fill:var(--company)}
#map g.n text{fill:var(--fg);font-size:9px;text-anchor:middle;pointer-events:none}
#map g.n[data-flag] circle{stroke:#ef4444;stroke-width:2.5}
#map g.n[data-flag="amber"] circle{stroke:#f59e0b}
#map.focused g.n{opacity:.18}
#map.focused g.n.on{opacity:1}
#wt-panel{position:sticky;bottom:0;background:var(--card);
border:1px solid var(--line);border-radius:6px;padding:12px;margin-top:8px}
#wt-body[data-flag="red"]{border-left:3px solid #ef4444;padding-left:8px}
#wt-body[data-flag="amber"]{border-left:3px solid #f59e0b;padding-left:8px}
button{font:inherit;padding:4px 12px;border:1px solid var(--line);
border-radius:4px;background:transparent;color:var(--fg);cursor:pointer}
footer{margin-top:40px;padding-top:14px;border-top:1px solid var(--line);
color:var(--muted);font-size:.75rem}
a{color:var(--company)}
@media print{#wt-panel,#wt-start{display:none}#map{height:400px}}
`;

const flagVar = flag => `--f:${FLAG_COLORS[flag] || FLAG_COLORS.none}`;

const noteBlock = note => (note
  ? `<div class="note" style="${flagVar(note.flag)}">${esc(note.text)}</div>`
  : '');

const section = (id, title, inner) => (inner
  ? `<section id="${id}"><h2>${esc(title)}</h2>${inner}</section>`
  : '');

const correctionLine = (c, t) => {
  const verb = {
    hide: t.actionHide, merge: t.actionMerge,
    mark_resigned: t.actionResigned, mark_active: t.actionActive,
  }[c.action] || esc(c.action);
  const tail = c.nameB ? ` ${esc(c.nameB)}` : '';
  const when = c.resignedDate ? ` (${esc(c.resignedDate)})` : '';
  return `<li>${esc(c.nameA)} — ${esc(verb)}${tail}${when}</li>`;
};

export function buildExportHtml(doc, graphData, { lang = 'es' } = {}) {
  const t = exportCopy(lang);
  const flaggedIds = new Set((doc.flagged || []).map(f => f.nodeId));
  const date = new Date(doc.generatedAt).toLocaleDateString(
    lang === 'en' ? 'en-GB' : 'es-ES',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );
  const hasWalkthrough = (doc.flagged || []).length > 0;

  const flaggedCards = (doc.flagged || []).map(f =>
    `<div class="card" style="${flagVar(f.flag)}">`
    + `<strong>${esc(f.name)}</strong>${esc(f.text)}</div>`).join('');

  const companyRows = (doc.companies || []).map(c =>
    `<li><strong>${esc(c.name)}</strong>${noteBlock(c.note)}</li>`).join('');

  const connectorRows = (doc.connectors || []).map(c => `<tr>
      <td>${esc(c.name)} <em>(${c.type === 'entity' ? esc(t.entity) : esc(t.individual)})</em>${noteBlock(c.note)}</td>
      <td>${(c.companies || []).map(esc).join(', ')}</td>
      <td>${(c.roles || []).map(esc).join(' / ')}</td>
      <td>${esc(t[c.status] || c.status)}</td>
    </tr>`).join('');

  const ownershipRows = (doc.ownership || []).map(o =>
    `<li>${esc(o.owner)} ${esc(o.lost ? t.lostOf : t.soleOf)} ${esc(o.owned)}</li>`).join('');

  const otherRows = (doc.otherNotes || []).map(n =>
    `<div class="card" style="${flagVar(n.flag)}">`
    + `<strong>${esc(n.name)}</strong>${esc(n.text)}</div>`).join('');

  const correctionRows = (doc.corrections || []).map(c => correctionLine(c, t)).join('');

  // JSON is embedded as text, so </script> inside a note would close the tag.
  const stepJson = JSON.stringify({ steps: doc.flagged || [] })
    .replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'es'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(t.title)}${doc.subject ? ` — ${esc(doc.subject)}` : ''}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>${esc(t.title)}</h1>
  <div class="meta">${doc.subject ? `${esc(t.subject)}: <strong>${esc(doc.subject)}</strong> · ` : ''}${esc(t.generated)} ${esc(date)}</div>
  <div class="warn">${esc(t.nonAuthoritative)}<br>${esc(t.sourceLine)}</div>
</header>

${doc.networkNote ? `<section id="summary"><h2>${esc(t.summaryNote)}</h2><p>${esc(doc.networkNote)}</p></section>` : ''}

<section id="graph">
  ${renderGraphSvg(graphData, { flaggedIds })}
  ${hasWalkthrough ? `<p><button id="wt-start">${esc(t.walkthrough)}</button></p>
  <div id="wt-panel" hidden>
    <div id="wt-body"></div>
    <p><button id="wt-prev">${esc(t.prev)}</button>
       <button id="wt-next">${esc(t.next)}</button>
       <span id="wt-counter" class="meta"></span>
       <button id="wt-exit">${esc(t.exit)}</button></p>
  </div>` : ''}
</section>

${section('flagged', t.flagged, flaggedCards)}
${section('companies', t.companies, companyRows ? `<ul>${companyRows}</ul>` : '')}
${section('connections', t.connections, connectorRows
    ? `<div class="scroll"><table><thead><tr>
         <th>${esc(t.person)}</th><th>${esc(t.inCompanies)}</th>
         <th>${esc(t.role)}</th><th>${esc(t.status)}</th>
       </tr></thead><tbody>${connectorRows}</tbody></table></div>`
    : `<p class="meta">${esc(t.none)}</p>`)}
${section('ownership', t.ownership, ownershipRows ? `<ul>${ownershipRows}</ul>` : '')}
${section('other', t.otherNotes, otherRows)}
${section('corrections', t.corrections, correctionRows ? `<ul>${correctionRows}</ul>` : '')}

<footer>
  NC Data · <a href="${SITE}">mapasocietario.es</a> — ${esc(t.sourceLine)}
  ${doc.subject ? `<br><a href="${SITE}">${esc(t.backLink)}</a>` : ''}
</footer>
</div>
<script>window.__SITREP__=${stepJson};</script>
<script>${WALKTHROUGH_SCRIPT}</script>
</body>
</html>`;
}

export function exportFileName(doc, lang = 'es') {
  const base = lang === 'en' ? 'Situation_report' : 'Informe_de_situacion';
  const d = new Date(doc.generatedAt);
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('');
  const subject = String(doc.subject || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return [base, subject, stamp].filter(Boolean).join('_') + '.html';
}
```

```js
// src/utils/investigationExport/index.js
export { buildExportHtml, exportFileName } from './buildExportHtml';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/mapasocietario && npx vitest run src/utils/investigationExport/buildExportHtml.test.js`
Expected: PASS (12 tests)

- [ ] **Step 5: Eyeball a real file — the tests cannot tell you it looks right**

```bash
cd ~/mapasocietario
node --input-type=module -e "
import { buildExportHtml } from './src/utils/investigationExport/buildExportHtml.js';
import { buildInvestigationDoc } from './src/utils/investigationDoc.js';
const graphData = { nodes: [
  { id:'c1', type:'company', name:'ALFA SL', x:0, y:0, userNote:{text:'Same address as BETA',flag:'red'} },
  { id:'c2', type:'company', name:'BETA SL', x:220, y:60 },
  { id:'o1', type:'officer', name:'GARCIA LOPEZ ANA', x:110, y:150, userNote:{text:'Signs for both',flag:'amber'} },
], links: [{source:'c1',target:'o1'},{source:'c2',target:'o1'}] };
const scope = {
  companies:['ALFA SL','BETA SL'],
  companyNodes:[{name:'ALFA SL',nodeId:'c1'},{name:'BETA SL',nodeId:'c2'}],
  connectors:[{name:'GARCIA LOPEZ ANA',nodeId:'o1',type:'individual',companies:['ALFA SL','BETA SL'],roles:['Administrador'],status:'active'}],
  ownership:[], counts:{companies:2,officers:1,sharedPeople:1},
};
const doc = buildInvestigationDoc({ graphData, scope, networkNote:'Checking a suspected common controller.', corrections:[], primarySubject:'ALFA SL' });
process.stdout.write(buildExportHtml(doc, graphData, { lang:'es' }));
" > /tmp/sitrep-preview.html && open /tmp/sitrep-preview.html
```

Check by hand, and do not proceed until all four hold:
- the graph renders and pans/zooms;
- "Recorrido" steps through ALFA SL then GARCIA LOPEZ ANA, dimming the rest;
- it is legible in both light and dark (toggle your OS appearance);
- DevTools Network shows **zero** requests.

- [ ] **Step 6: Commit**

```bash
cd ~/mapasocietario
git add src/utils/investigationExport/
git -c commit.gpgsign=false commit -m "feat(export): assemble the self-contained situation report file

One .html file with inline CSS, data and script -- opens offline, survives
email, prints from the browser. Attributed but clearly non-authoritative: it
must never read as a Mapa Societario deliverable.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0161fb7V6eBH5mtgxLFT4Bz5"
```

---

## Task F8: Copy-for-Word renders from the document model

`relationshipReportHtml.js` currently takes raw `scope`. Point it at the doc model so notes and corrections reach the Word paste too, and one model feeds both renderers.

**Files:**
- Modify: `src/utils/relationshipReportHtml.js` (whole file)
- Create: `src/utils/relationshipReportHtml.test.js`

**Interfaces:**
- Consumes: `buildInvestigationDoc` output (F3), `exportCopy` (F4), `escapeHtml` (F1).
- Produces: `buildReportHtml(doc, { es = true }) => string` — **signature changed**: first argument is now the doc model, not the scope. The only caller is `RelationshipReportModal.jsx` (updated in Task F9).

- [ ] **Step 1: Write the failing test**

```js
// src/utils/relationshipReportHtml.test.js
import { describe, expect, it } from 'vitest';
import { buildReportHtml } from './relationshipReportHtml';

const doc = {
  subject: 'ALFA SL',
  generatedAt: '2026-09-10T09:00:00.000Z',
  networkNote: 'Checking a suspected common controller.',
  flagged: [{ nodeId: 'c1', name: 'ALFA SL', type: 'company', flag: 'red', text: 'Same address as BETA' }],
  companies: [{ nodeId: 'c1', name: 'ALFA SL', note: { text: 'Same address as BETA', flag: 'red' } }],
  connectors: [{ name: 'GARCIA LOPEZ ANA', nodeId: 'o1', type: 'individual', companies: ['ALFA SL', 'BETA SL'], roles: ['Administrador'], status: 'active', note: null }],
  ownership: [{ owner: 'ALFA SL', owned: 'BETA SL', lost: false }],
  otherNotes: [{ nodeId: 'o2', name: 'RUIZ MARTIN LUIS', type: 'officer', flag: 'blue', text: 'Resigned days before the filing' }],
  corrections: [],
  counts: { companies: 2, officers: 2, sharedPeople: 1, notes: 2, flagged: 1 },
};

describe('buildReportHtml', () => {
  it('carries the network note, flagged findings and other notes', () => {
    const html = buildReportHtml(doc, { es: true });

    expect(html).toContain('Checking a suspected common controller.');
    expect(html).toContain('Same address as BETA');
    expect(html).toContain('Resigned days before the filing');
  });

  it('uses the settled name in both languages', () => {
    expect(buildReportHtml(doc, { es: true })).toContain('Informe de situación');
    expect(buildReportHtml(doc, { es: false })).toContain('Situation report');
  });

  it('escapes hostile note text', () => {
    const hostile = { ...doc, networkNote: '<script>alert(1)</script>' };

    expect(buildReportHtml(hostile, { es: true })).not.toContain('<script>alert(1)</script>');
  });

  it('omits the flagged block when nothing is flagged', () => {
    const html = buildReportHtml({ ...doc, flagged: [] }, { es: true });

    expect(html).not.toContain('Señalado');
  });

  it('still renders a document with no notes at all', () => {
    const bare = { ...doc, networkNote: '', flagged: [], otherNotes: [], companies: [{ nodeId: 'c1', name: 'ALFA SL', note: null }] };

    expect(buildReportHtml(bare, { es: true })).toContain('ALFA SL');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/mapasocietario && npx vitest run src/utils/relationshipReportHtml.test.js`
Expected: FAIL — the current implementation reads `scope.counts` / `scope.connectors` and emits the old title.

- [ ] **Step 3: Rewrite the file**

```js
// mapasocietario/src/utils/relationshipReportHtml.js
// Pure HTML builder for Copy-for-Word, so the situation report pastes formatted
// into Word or Docs. No DOM, no React.
//
// It renders the SAME document model as the exported .html file
// (investigationDoc.js) — the two differ only in medium. Word cannot take an
// interactive canvas, so this one is the tables and the notes without the map.

import { escapeHtml as esc } from './escapeHtml';
import { exportCopy } from './investigationExport/exportCopy';

export function buildReportHtml(doc, { es = true } = {}) {
  const t = exportCopy(es ? 'es' : 'en');
  const c = doc?.counts || { companies: 0, officers: 0, sharedPeople: 0 };

  const noteLine = note => (note
    ? `<div><i>${esc(note.text)}</i></div>`
    : '');

  const flaggedRows = (doc?.flagged || []).map(f =>
    `<li><b>${esc(f.name)}</b> — ${esc(f.text)}</li>`).join('');

  const companyRows = (doc?.companies || []).map(x =>
    `<li><b>${esc(x.name)}</b>${noteLine(x.note)}</li>`).join('');

  const connectorRows = (doc?.connectors || []).map(con => `
    <tr>
      <td>${esc(con.name)} <i>(${con.type === 'entity' ? esc(t.entity) : esc(t.individual)})</i>${noteLine(con.note)}</td>
      <td>${(con.companies || []).map(esc).join(', ')}</td>
      <td>${(con.roles || []).map(esc).join(' / ')}</td>
      <td>${esc(t[con.status] || con.status)}</td>
    </tr>`).join('');

  const ownershipRows = (doc?.ownership || []).map(o =>
    `<li>${esc(o.owner)} ${esc(o.lost ? t.lostOf : t.soleOf)} ${esc(o.owned)}</li>`).join('');

  const otherRows = (doc?.otherNotes || []).map(n =>
    `<li><b>${esc(n.name)}</b> — ${esc(n.text)}</li>`).join('');

  const block = (title, inner) => (inner ? `<h3>${esc(title)}</h3>${inner}` : '');

  return `<div>
  <h2>${esc(t.title)}${doc?.subject ? ` — ${esc(doc.subject)}` : ''}</h2>
  <p><i>${esc(t.nonAuthoritative)}</i></p>
  ${doc?.networkNote ? `<p>${esc(doc.networkNote)}</p>` : ''}
  <p><b>${c.companies}</b> ${esc(t.companies)} · <b>${c.sharedPeople}</b> ${esc(t.connections)}</p>
  ${block(t.flagged, flaggedRows ? `<ul>${flaggedRows}</ul>` : '')}
  ${block(t.companies, companyRows ? `<ul>${companyRows}</ul>` : '')}
  <h3>${esc(t.connections)}</h3>
  ${connectorRows
    ? `<table border="1" cellpadding="4" cellspacing="0">
      <thead><tr><th>${esc(t.person)}</th><th>${esc(t.inCompanies)}</th><th>${esc(t.role)}</th><th>${esc(t.status)}</th></tr></thead>
      <tbody>${connectorRows}</tbody></table>`
    : `<p>${esc(t.none)}</p>`}
  ${block(t.ownership, ownershipRows ? `<ul>${ownershipRows}</ul>` : '')}
  ${block(t.otherNotes, otherRows ? `<ul>${otherRows}</ul>` : '')}
  <p><small>${esc(t.sourceLine)} — mapasocietario.es</small></p>
</div>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/mapasocietario && npx vitest run src/utils/relationshipReportHtml.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/mapasocietario
git add src/utils/relationshipReportHtml.js src/utils/relationshipReportHtml.test.js
git -c commit.gpgsign=false commit -m "feat(graph): render copy-for-Word from the situation report model

One model now feeds both the exported file and the Word paste, so notes and
flagged findings reach a memo as well as the browser. Renames the artefact to
'Informe de situación' / 'Situation report'.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0161fb7V6eBH5mtgxLFT4Bz5"
```

---

## Task F9: The modal becomes the situation-report preview

**Files:**
- Modify: `src/components/RelationshipReportModal.jsx` (whole component)

**Interfaces:**
- Consumes: `buildReportHtml(doc, {es})` (F8), `buildExportHtml` / `exportFileName` (F7).
- Produces: new props — `RelationshipReportModal({ open, onClose, doc, graphData, networkNote, onNetworkNoteChange, lang, onRemoveCompany, onDownload })`. `scope` and `subjects` props are **removed**; the parent (Task F10) passes `doc` and `graphData` instead.

There is no component test harness in this repo (`vitest.config.js` is node-only, by deliberate choice), so this task is verified by running the app.

- [ ] **Step 1: Replace the header, chip and actions**

In `RelationshipReportModal.jsx`:

1. Change the signature to the props listed above.
2. Replace `scope?.companies` etc. with `doc?.companies`, `doc?.connectors`, `doc?.ownership`, `doc?.counts`.
3. Title: `es ? 'Informe de situación' : 'Situation report'`.
4. Delete the `Chip` reading `No autoritativo` / `Not authoritative` — the genre now carries that meaning, and a warning chip beside it re-introduces the "lesser report" reading the naming decision was made to avoid.
5. Delete `saveAsPdf` and the `window.print()` button, and delete the `rel-report-print-*` class usages in this file.

- [ ] **Step 2: Add the network-note field at the head of the content**

There is no node to right-click for a note about the whole map, so this is its only entry point.

```jsx
<TextField
  fullWidth
  multiline
  minRows={2}
  size="small"
  value={networkNote}
  onChange={(e) => onNetworkNoteChange(e.target.value.slice(0, 2000))}
  placeholder={es
    ? '¿Qué estás mirando y qué has concluido?'
    : 'What are you looking at, and what did you conclude?'}
  label={es ? 'Resumen' : 'Summary'}
  sx={{ mb: 2 }}
/>
```

- [ ] **Step 3: Add the Download action**

```jsx
const download = () => {
  const html = buildExportHtml(doc, graphData, { lang: es ? 'es' : 'en' });
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(doc, es ? 'es' : 'en');
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  onDownload?.();
};
```

Render it as the dialog's primary action (`variant="contained"`), with copy-for-Word secondary (`variant="outlined"`), and add the descriptor beside it:

```jsx
<Typography variant="caption" sx={{ color: 'text.secondary' }}>
  {es ? 'se abre en tu navegador' : 'opens in your browser'}
</Typography>
```

- [ ] **Step 4: Show the flagged block and notes in the preview**

Above the companies list, when `doc.flagged.length > 0`, render each entry as a bordered row whose left border is `NODE_NOTE_FLAGS[f.flag]` (import from `../utils/nodeNotes`). Below each company chip and each connector row, render `note.text` in `variant="caption"` when present. Add an `Otras notas` / `Other notes` block for `doc.otherNotes`.

- [ ] **Step 5: Verify in the running app**

```bash
cd ~/mapasocietario && npm run dev
```

Search a company, expand it, pin a second company, right-click two nodes and add notes (one red, one amber), open the situation report. Confirm: the flagged block appears in order red-then-amber; the summary field accepts text; Download produces a file that opens with the map and the walkthrough; copy-for-Word pastes into a document with the notes present.

- [ ] **Step 6: Commit**

```bash
cd ~/mapasocietario
git add src/components/RelationshipReportModal.jsx
git -c commit.gpgsign=false commit -m "feat(graph): turn the report modal into the situation report preview

Adds the network-note field (the only place a note about the whole map can be
written, since there is no node to right-click) and makes Download the primary
action. Drops window.print(): the exported file prints better than a modal.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0161fb7V6eBH5mtgxLFT4Bz5"
```

---

## Task F10: Wire the graph — state, snapshot, toolbar, copy

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` — lines `285-286`, `443`, `628-630`, `657-658`, `995-997`, `7100-7144`, `8263-8290`, `8416`, `9160-9180`, `11818`, `11900`

- [ ] **Step 1: Add the network-note state and thread it through the snapshot**

Beside the other graph state (near `:1676`):

```jsx
  // A note about the whole map. Unlike node notes it has no node to hang on, so
  // it lives here and rides the snapshot's existing `context` slot — which means
  // it survives export/import with NO snapshot version bump.
  const [networkNote, setNetworkNote] = useState('');
```

In `buildCurrentGraphSnapshot` (`:8285`), change `context`:

```jsx
    context: { primarySubject, networkNote },
```

In the snapshot restore path (beside `:8416`):

```jsx
    setNetworkNote(typeof snapshot.context?.networkNote === 'string' ? snapshot.context.networkNote : '');
```

- [ ] **Step 2: Replace `openRelationshipReport` and delete the vestigial resolve**

The current implementation awaits a `resolveGroupKey` per company and **refuses to open** when fewer than two resolve. That existed only to build `subjects` for the server-side relationship mode, which Task B1 deletes. A user must not be blocked from their own notes by a lookup for a caller that no longer exists.

```jsx
  // Build the situation report from the visible graph. Declared AFTER
  // filteredGraphData: its dependency array reads filteredGraphData at render
  // time, so defining it earlier triggers a temporal-dead-zone ReferenceError.
  const openRelationshipReport = useCallback(async () => {
    if (relationshipDetailedScope.companies.length < 1) return;
    // Corrections are only ever written against primarySubject, so one lookup
    // covers every correction this graph can carry.
    let corrections = [];
    try {
      const gk = subjectCompanyName ? await resolveSubjectGroupKey(subjectCompanyName) : null;
      if (gk) corrections = await listCorrections(gk);
    } catch {
      // A corrections lookup must never block the user's own notes. The report
      // opens without the "what I changed" section.
      corrections = [];
    }
    setRelDoc(buildInvestigationDoc({
      graphData: filteredGraphData,
      scope: relationshipDetailedScope,
      networkNote,
      corrections,
      primarySubject: subjectCompanyName || '',
    }));
    setRelReportOpen(true);
  }, [
    relationshipDetailedScope, filteredGraphData, networkNote,
    subjectCompanyName, resolveSubjectGroupKey,
  ]);
```

Add `const [relDoc, setRelDoc] = useState(null);` beside the other modal state, and delete `relScope`, `relSubjects` and `relResolving`. `relResolving` is read by the toolbar button at `:9164-9166` (`disabled={relResolving}` and the `CircularProgress` in `startIcon`) — remove both there in Step 4 or the build breaks. Also delete the two error copy keys `relationshipResolveError` (`:628`, `:995`) and `relationshipPrepareError` (`:630`, `:997`) — nothing references them once the resolve is gone.

Add the imports:

```jsx
import { buildInvestigationDoc } from '../utils/investigationDoc';
```

- [ ] **Step 3: Rename the copy keys**

Replace at `:285-286` (EN) and `:657-658` (ES):

```jsx
    situationReportTooltip: 'Situation report for the visible companies — your map, corrections and notes (free)',
    situationReport: 'Situation report',
```
```jsx
    situationReportTooltip: 'Informe de situación sobre las empresas visibles — tu mapa, tus correcciones y tus notas (gratis)',
    situationReport: 'Informe de situación',
```

Delete the old `relationshipReport` / `relationshipReportTooltip` keys and update the two usages at `:9160` and `:9173`.

- [ ] **Step 4: Change the toolbar gate and hierarchy**

At `:9159`, change the gate from `visibleCompanyCount >= 2` to `visibleCompanyCount >= 1`. The old gate is right for a report *about relationships between subjects* and wrong for a document carrying your notes — it currently strands anyone who annotated a single company's board.

Change the button from `variant="contained"` to `variant="outlined"` and drop its `boxShadow` override. Paid DD stays contained; two contained primary buttons in one row compete for the same eye.

Leave the *separate* `showSharedConnections` toggle at `:9177` on `>= 2` — that highlight is genuinely meaningless with one company.

- [ ] **Step 5: Update both modal call sites**

At `:11818` and `:11900`:

```jsx
<RelationshipReportModal
  open={relReportOpen}
  onClose={() => setRelReportOpen(false)}
  doc={relDoc}
  graphData={filteredGraphData}
  networkNote={networkNote}
  onNetworkNoteChange={setNetworkNote}
  lang={uiLanguage}
  onRemoveCompany={...}
  onDownload={() => trackGraphToolbarAction('situation_report_download')}
/>
```

- [ ] **Step 6: Rename the toolbar analytics event**

At `:9170`, change `trackGraphToolbarAction('relationship_report')` to `trackGraphToolbarAction('situation_report')`.

This **breaks the existing `relationship_report` GA series** — it will flatline and a new one starts. That is the intended trade: the old key would silently mean two different things across the cutover date, which is worse than a discontinuity you can see. Note the cutover date wherever you track GA definitions.

- [ ] **Step 7: Verify in the running app**

```bash
cd ~/mapasocietario && npm run dev
```

- Search **one** company, add a note, confirm the situation-report button is now enabled (it was hidden before) and the report opens with no network round-trip (check the Network tab: only the corrections lookup).
- Write a summary, export the graph snapshot, clear the graph, re-import it — the summary must come back.
- Confirm the DD button is still the visually dominant one.

- [ ] **Step 8: Run the suite and commit**

```bash
cd ~/mapasocietario
npx vitest run
git add src/components/SpanishCompanyNetworkGraph.jsx
git -c commit.gpgsign=false commit -m "feat(graph): wire the situation report into the canvas

Adds the network note (carried in the snapshot's existing context slot, so no
version bump), drops the >=2 company gate that stranded anyone annotating a
single board, and deletes the group_key resolve that existed only for the
server-side relationship mode -- it could block a user from their own notes.

Renames the toolbar event to situation_report; the relationship_report GA series
ends here deliberately rather than silently changing meaning.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0161fb7V6eBH5mtgxLFT4Bz5"
```

---

## Task F11: Checkout stops offering a choice and starts stating the line

**Files:**
- Modify: `src/components/DDCheckoutDialog.jsx:305-307, 442, 560-575, 700-715, 908-965`

**Interfaces:**
- Consumes: nothing new.
- Produces: neither checkout payload contains `mode`, `account_id` or `group_key`.

- [ ] **Step 1: Strip `mode` from both payloads**

Delete `const [mode, setMode] = useState('faithful');` (`:307`) and its comment (`:305-306`).

**Four further references die with it — miss any and the build breaks (verified by grep against the current source):**

1. The corrections-lookup effect (`:444-470`) calls `setMode(...)` in **five** places. Delete each call, keep the rest of the effect — `correctionsCount` is still needed for the statement in Step 2.
2. `const [groupKey, setGroupKey] = useState(null);` (`:309`) becomes write-only once the payload blocks go. Delete the state and the `setGroupKey(...)` calls; keep the local `const gk = await resolveGroupKey(companyName)` inside the effect, since `listCorrections(gk)` still needs it.
3. `getClientId` is used **only** in the two deleted payload blocks (`:570`, `:711`), so delete its import at `:37`.
4. The effect's leading comment (`:442-444`) describes offering "Custom" mode. Replace it with: `// On open, count the user's corrections for this company — they drive the statement below, not a choice of report.`

In the Google Play payload (`:566-572`) delete:
```js
          mode,
          ...(mode === 'amended' ? {
            account_id: getClientId(),
            ...(groupKey ? { group_key: groupKey } : {}),
          } : {}),
```

In the Stripe payload (`:707-713`) delete the same block **and** its two-line comment above it.

If `getClientId` is now unused in this file, remove the import; if `groupKey` is still needed for `correctionsCount`, keep it.

- [ ] **Step 2: Replace the toggle with the statement**

Replace the whole `{correctionsCount > 0 && (...)}` block at `:908-965` with:

```jsx
        {/* A buyer with corrections must not pay without learning their
            corrections are not in what they bought. This is the one place in
            the product where the paid/free line is stated to someone with money
            on the screen: you pay for evidence, not for your own notes. */}
        {correctionsCount > 0 && (
          <Box
            sx={{
              p: 1.5, mb: 2, borderRadius: 1.5,
              bgcolor: (theme) => alpha(theme.palette.info.main, 0.06),
              border: '1px solid',
              borderColor: (theme) => alpha(theme.palette.info.main, 0.2),
            }}
          >
            <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
              {copy.correctionsNotIncluded(correctionsCount)}
            </Typography>
          </Box>
        )}
```

- [ ] **Step 3: Add the copy in both languages**

In this file's copy object, delete `reportType`, `companyBased`, `custom`, `amendedMode` and `faithfulMode`, and add:

```js
  // ES
  correctionsNotIncluded: (n) => `Este informe reproduce el registro tal como se publicó. Tus ${n} correcciones no están incluidas — están en tu informe de situación, que puedes descargar gratis desde el mapa.`,
```
```js
  // EN
  correctionsNotIncluded: (n) => `This report reproduces the registry as filed. Your ${n} corrections aren't in it — they're in your situation report, free to download from the map.`,
```

The dialog cannot open the graph modal (it does not own that state) and adding a cross-component channel for one sentence is not worth it, so the copy points at the map rather than rendering a button.

- [ ] **Step 4: Verify in the running app**

```bash
cd ~/mapasocietario && npm run dev
```

Make a correction on a company, then open its DD checkout. Confirm: no mode toggle, the statement shows the right count, and the network request to `create-dd-checkout` carries **no** `mode`, `account_id` or `group_key`.

- [ ] **Step 5: Run the suite and commit**

```bash
cd ~/mapasocietario
npx vitest run
git add src/components/DDCheckoutDialog.jsx
git -c commit.gpgsign=false commit -m "feat(checkout): stop selling a corrected report, state the line instead

The mode toggle is gone: the paid report is always registry-faithful. The box
stays and becomes a statement, because deleting it would let a buyer with
corrections pay without learning their corrections are not in what they bought.

This can cost sales, deliberately -- a buyer surprised by a report that
contradicts their own corrections is a refund, not a sale.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0161fb7V6eBH5mtgxLFT4Bz5"
```

---

## Task F12: Frontend release gate

- [ ] **Step 1: Full suite**

```bash
cd ~/mapasocietario && npm test
```
Expected: PASS.

- [ ] **Step 2: Prove no caller of the dead modes survives**

```bash
cd ~/mapasocietario
grep -rn "'relationship'\|\"relationship\"" src --include="*.js" --include="*.jsx" | grep -v "\.test\." | grep -vi "relationshipScope\|relationshipReportHtml\|RelationshipReportModal\|relationshipDetailedScope\|relationshipSubjectIds"
grep -rn "mode: *'amended'\|mode: *\"amended\"\|account_id" src --include="*.js" --include="*.jsx" | grep -v "\.test\."
```
Expected: no output from either. (The surviving `relationship*` identifiers are internal names for the scope computation, which is staying.)

- [ ] **Step 3: Build**

```bash
cd ~/mapasocietario && npm run build
```
Expected: succeeds. Per this repo's history, a blank page after deploy usually means a bundling failure that only shows at runtime — so also run `npx vite preview` and load `/app` before merging.

- [ ] **Step 4: Merge and deploy the frontend, and only then start Task B1.**

---

## Task B1: The generator becomes single-mode

**Files:**
- Delete: `~/ncdata-bormes-impl/borme_relationship_report.py`
- Modify: `~/ncdata-bormes-impl/borme_dd_report.py:2091-2099` (`_VALID_DD_MODES`, `_resolve_mode`), `:12164-12210` (`generate_relationship_report`), `:12362-12380` (route branch), `:12405` (filename prefix)
- Create: `~/ncdata-bormes-impl/tests_dd_single_mode.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `generate_company_report` always behaves as `faithful`; the `options` dict may still contain `mode` from an old cached client and it is ignored.

**Test naming note:** CI in this repo only runs root-level `tests_*.py` (note the `s`). A file named `test_dd_single_mode.py` would never run.

- [ ] **Step 1: Write the failing test**

```python
# tests_dd_single_mode.py
"""The DD generator produces exactly one kind of document: the registry-faithful
report. It must be incapable of emitting a non-authoritative one, so it can
never be mistaken for one."""
import borme_dd_report as dd


def test_relationship_generator_is_gone():
    assert not hasattr(dd, "generate_relationship_report")


def test_amended_provenance_renderer_is_gone():
    assert not hasattr(dd, "_render_amended_provenance")


def test_mode_resolution_is_gone():
    assert not hasattr(dd, "_resolve_mode")
    assert not hasattr(dd, "_VALID_DD_MODES")


def test_relationship_module_is_gone():
    import importlib
    try:
        importlib.import_module("borme_relationship_report")
    except ImportError:
        return
    raise AssertionError("borme_relationship_report should have been deleted")


def test_filename_prefix_never_says_custom():
    import inspect
    src = inspect.getsource(dd)
    assert "DD_Report_Custom_" not in src
    assert "DD_Report_Relationship_" not in src
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/ncdata-bormes-impl && python3 -m pytest tests_dd_single_mode.py -v
```
Expected: FAIL on all five.

- [ ] **Step 3: Delete the relationship path**

```bash
cd ~/ncdata-bormes-impl && git rm borme_relationship_report.py
```

In `borme_dd_report.py`:

1. Delete `_VALID_DD_MODES` and `_resolve_mode` (`:2091-2099`).
2. Delete `generate_relationship_report` entirely (`:12164` through the end of that function).
3. In the `/bormes/dd-report/company` route, delete the whole `if _resolve_mode(options) == "relationship":` block (`:12362-12376`).
4. `:12405` — replace the conditional prefix with the single one:
   ```python
   _prefix = "DD_Report_"
   ```
5. `:10923` — replace `mode = _resolve_mode(options)` with:
   ```python
   # The generator has ONE mode. `options` may still carry a `mode` key from an
   # older cached client; it is deliberately ignored rather than validated, so a
   # stale client degrades to the correct report instead of erroring.
   mode = "faithful"
   ```
6. `:12385` — the log line `f"(mode: {_resolve_mode(options)})"` becomes plain text without the mode.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/ncdata-bormes-impl && python3 -m pytest tests_dd_single_mode.py -v
```
Expected: 3 of 5 PASS. `test_amended_provenance_renderer_is_gone` and part of `test_mode_resolution_is_gone` still fail — Task B2 finishes those. That is the intended split: this task removes the *reachable* paths, B2 removes what is now dead.

Comment out the two amended assertions with `# Task B2` and re-run to green before committing.

- [ ] **Step 5: Confirm the existing DD suite still passes**

```bash
cd ~/ncdata-bormes-impl && python3 -m pytest tests_dd_*.py test_dd_v2_render.py -v
```
Expected: PASS except `test_dd_v2_render.py::...amended_provenance...`, which Task B2 deletes.

- [ ] **Step 6: Commit**

```bash
cd ~/ncdata-bormes-impl
git add -A borme_dd_report.py borme_relationship_report.py tests_dd_single_mode.py
git -c commit.gpgsign=false commit -m "refactor(dd): collapse the generator to a single registry-faithful mode

Deletes the relationship mode and its module. Nothing sent mode=relationship --
verified across every consumer (app, MCP servers, local-rag, public API); it was
reachable only by a hand-crafted POST.

An old cached client's mode key is ignored rather than rejected, so it degrades
to the correct report instead of erroring.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0161fb7V6eBH5mtgxLFT4Bz5"
```

---

## Task B2: Remove the now-dead amended machinery

With `mode` pinned to `faithful`, every `if mode == "faithful"` branch is unconditional and every `if mode == "amended"` branch is unreachable.

**Files:**
- Modify: `borme_dd_report.py:2904-2922` (`_resolve_active_officers`), `:3541-3600` (`amended_officer_lists`, `_load_corrections_from_pg`), `:9134-9160` (`_render_amended_provenance`), `:9940`, `:10957`, `:10974-10979`, `:10984-10985`, `:11491`, `:27-28` (imports)
- Modify: `borme_corrections.py` (drop `apply_corrections`, `load_corrections`)
- Modify: `test_dd_registry_notes.py` (delete the `amended_officer_lists` tests), `test_dd_v2_render.py` (delete the provenance test), `test_ownership_classification.py:58-59` (delete the two monkeypatches)
- Modify: `tests_dd_single_mode.py` (re-enable the two assertions from B1)

**Interfaces:**
- Consumes: Task B1's single-mode generator.
- Produces: `_resolve_active_officers(company, literal_active, literal_resigned)` — **`mode` and the two `amended_*` parameters are removed from the signature.**

- [ ] **Step 1: Re-enable the two deferred assertions**

Uncomment the `# Task B2` lines in `tests_dd_single_mode.py` and add:

```python
def test_amended_officer_lists_is_gone():
    assert not hasattr(dd, "amended_officer_lists")


def test_correction_apply_helpers_are_gone_from_the_generator():
    """The corrections REST API and its storage stay -- the graph still reads and
    writes corrections. What goes is the server-side APPLICATION of them to a
    PDF, which no longer has a caller."""
    import borme_corrections
    assert not hasattr(borme_corrections, "apply_corrections")
    assert not hasattr(borme_corrections, "load_corrections")
    assert hasattr(borme_corrections, "list_corrections")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/ncdata-bormes-impl && python3 -m pytest tests_dd_single_mode.py -v
```
Expected: FAIL on the amended assertions.

- [ ] **Step 3: Unconditionalise the faithful branches**

In `borme_dd_report.py`:

1. `:9940` — `if mode == "faithful":` → delete the `if` and dedent its body.
2. `:10957` — same.
3. `:10974-10979` — delete the `amended_active, amended_resigned = None, None`, `amended_corrections = []` and the whole `if mode == "amended":` block.
4. `:10984-10985` — the call becomes:
   ```python
   _resolved_active, _resolved_resigned = _resolve_active_officers(
       company, literal_active, literal_resigned)
   ```
5. `:11491` — delete the `_render_amended_provenance(...)` call.
6. `:9672` — `mode = data.get('mode', 'faithful')` becomes `mode = 'faithful'`, or delete `mode` from that scope if nothing else in the function reads it (`grep -n "mode" ` that function first).

- [ ] **Step 4: Delete the dead functions**

1. `_render_amended_provenance` (`:9134-9160`) — the whole function, including its `do not remove` docstring. That instruction guarded the amended report's non-authoritative marking; with amended gone there is nothing left to mark, and the generator can no longer produce such a document at all.
2. `amended_officer_lists` (`:3551`) and `_load_corrections_from_pg` (`:3541`) — both.
3. `:27-28` — remove `apply_corrections, load_corrections` from the `borme_corrections` import (keep whatever the `/bormes/corrections` route uses).
4. `_resolve_active_officers` (`:2904`) — new signature and body:

```python
def _resolve_active_officers(company, literal_active, literal_resigned=None):
    """The authoritative CURRENT officer view, shared by the AI narratives and the
    §5 render so every governance surface classifies the organ from ONE list.

    Prefers the event-replayed literal reconstruction (which correctly applies a
    same-day cese→nombramiento transition — e.g. a person who ceased as Consejero
    and was appointed Administrador Mancomunado on the same date shows ONLY the
    current Mancomunado seat). The raw folded `company['officers_active']` can
    leave the prior seat phantom-active, so it is the last-resort source only.
    Returns (active, resigned)."""
    if literal_active is not None:
        resolved = _reconcile_missing_admins(company, literal_active, literal_resigned)
    else:
        resolved = (company.get('officers_active', []) or [],
                    company.get('officers_resigned', []) or [])
    return _supersede_singular_offices(*resolved)
```

5. In `borme_corrections.py`, delete `apply_corrections` and `load_corrections`. Keep the storage and listing helpers the route calls.

- [ ] **Step 5: Delete the tests for deleted code**

- `test_dd_registry_notes.py` — delete every test calling `dd.amended_officer_lists` (lines around `:240-300`).
- `test_dd_v2_render.py` — delete the `_render_amended_provenance` test (`:470-500`).
- `test_ownership_classification.py:58-59` — delete the two monkeypatch lines; the functions they stub no longer exist.

- [ ] **Step 6: Run the tests**

```bash
cd ~/ncdata-bormes-impl && python3 -m pytest tests_dd_single_mode.py -v
```
Expected: PASS (7 tests)

```bash
cd ~/ncdata-bormes-impl && python3 -m pytest tests_*.py -v
```
Expected: PASS. Per this repo's known state, ~36 pre-existing failures in the BOE spec and `defusedxml` suites are unrelated to this work — compare against a `git stash` baseline rather than assuming any failure is yours.

- [ ] **Step 7: Prove nothing references the deleted names**

```bash
cd ~/ncdata-bormes-impl
grep -rn "amended_officer_lists\|_render_amended_provenance\|_resolve_mode\|_VALID_DD_MODES\|generate_relationship_report\|borme_relationship_report" --include="*.py" . | grep -v node_modules
```
Expected: no output.

- [ ] **Step 8: Generate one real report end-to-end**

The unit tests cannot tell you the PDF still renders. Generate a report for a company with a known board and confirm §5 (Gobierno) still lists officers and the Registry Quality Notes subsection still appears — those were behind the `mode == "faithful"` guards you just dedented.

- [ ] **Step 9: Commit**

```bash
cd ~/ncdata-bormes-impl
git add -A
git -c commit.gpgsign=false commit -m "refactor(dd): remove the dead amended pipeline

With mode pinned to faithful, every faithful branch is unconditional and the
amended ones are unreachable. Removes amended_officer_lists, the provenance
renderer, and the two borme_corrections helpers that had no caller left.

The corrections REST API and its storage stay: the graph still reads and writes
corrections, and they now surface in the free situation report instead of in a
PDF someone paid for.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0161fb7V6eBH5mtgxLFT4Bz5"
```

---

## Task B3: Backend release gate

- [ ] **Step 1: Confirm the route ignores a stale mode**

Start the API locally and POST a report request with `options: {"mode": "amended", "account_id": "x"}`. It must return the ordinary faithful PDF with no error and no `Custom` in the filename — this is the cached-client case.

- [ ] **Step 2: Deploy**

Per this repo's deploy model, push **`main`** (not `server-current`); CI fast-forwards `server-current` and deploys over ssh.

- [ ] **Step 3: Post-deploy check**

Order one real DD end-to-end through the live checkout and confirm the PDF arrives and renders §5 correctly.

---

## Self-Review Notes

**Spec coverage.** Every spec section maps to a task: backend deletions → B1/B2; document model → F3; note collection independent of scoping → F3 Step 1 test 1; network note in `context` with no version bump → F10 Step 1; interactive export → F5/F6/F7; export identity → F7; toolbar hierarchy and gate → F10 Step 4; vestigial resolve → F10 Step 2; modal → F9; checkout statement → F11; copy table → F4 + F10 Step 3 + F11 Step 3; deploy order → F12 Step 4 and B3.

**Deliberately not covered**, matching the spec's out-of-scope list: structural-edit provenance, server-side rendering of the situation report, the stale `ncdata_infra` copy, and node-note discoverability beyond the network-note field.

**The two spec "open items"** are resolved here rather than left open: the GA rename is taken (F10 Step 6, with the discontinuity stated), and note discoverability is left alone pending data from the existing `node_note_saved` event.
