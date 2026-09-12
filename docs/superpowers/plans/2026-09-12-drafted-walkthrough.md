# Drafted Walkthrough Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Recorrido" that the product drafts from the visible graph plus the free findings endpoint, that the author can hide/reorder/annotate, that plays live on the canvas and inside an exported situation report typeset as an authored document.

**Architecture:** Pure modules draft steps (`draftWalkthrough`), merge author edits (`applyWalkthroughEdits`) and compute viewports; a hook (`useWalkthrough`) owns loading and play state; the graph component wires a toolbar button, canvas dimming and a docked card; the export is rebuilt as a document (`documentSections` + `documentStyle`) whose walkthrough script pans, highlights links and supports touch. No backend change.

**Tech Stack:** React 19 on Vite 5.4, MUI, vitest (pure-logic only, no jsdom), react-force-graph-2d (`fg.centerAt`, `fg.zoom`), Python fonttools for the one-off font subset.

**Spec:** `docs/superpowers/specs/2026-09-12-drafted-walkthrough-design.md`

## Global Constraints

- Frontend-only. Nothing under `ncdata-bormes-impl` or the workers changes.
- Immutable data: every helper returns new objects; never mutate `graphData`, `scope`, `edits` or steps.
- Copy is bilingual ES/EN. ES strings: `Recorrido`, `Preparando…`, `Sujeto`, `Lo que destaca`, `Quién conecta`, `Propiedad`, `Otras empresas`, `Lo que el registro no muestra`, `Notas del autor`, `Registro (BORME)`, `Del mapa`, `Autor`, `Tu nota`, `Quitar del recorrido`, `Restablecer borrador`, `Vista previa`. EN: `Walkthrough`, `Preparing…`, `Subject`, `What stands out`, `Who connects`, `Ownership`, `Other companies`, `What the registry cannot show`, `Author's notes`, `Registry (BORME)`, `From the map`, `Author`, `Your note`, `Remove from walkthrough`, `Reset draft`, `Preview`.
- Caps: `STANDS_OUT_CAP = 4`, `CONNECTS_CAP = 8`, `FINDINGS_FETCH_CAP = 6`, `FINDINGS_WAIT_MS = 4000`.
- Section order is fixed: `subject, stands_out, connects, ownership, other_companies, unseen, author`.
- Step keys: `subject:<nodeId>`, `stands_out:<nodeId>:<kind>:<date|''>`, `connects:<nodeId>`, `ownership:<ownerId>|<ownedId>`, `other_companies:<nodeId>`, `unseen:<nodeId>`, `author:<nodeId>`.
- Link keys are sorted pair keys: `a < b ? `${a}|${b}` : `${b}|${a}``.
- The exported file must be self-contained: no URL other than `https://mapasocietario.es` links, fonts as `data:` URIs, no `</script>` sequence inside the walkthrough script string.
- The export carries NO Mapa Societario wordmark or brand band. Source and coverage lines only.
- Registry finding text is the endpoint's sentence verbatim; never templated client-side.
- Author/organisation live in `localStorage` key `sitrep_author`, never in the graph snapshot.
- Commits: `git -c commit.gpgsign=false commit …`, conventional prefix, end with the attribution lines the session provides.
- Tests: `npx vitest run <file>`; full suite `npm test` must stay green at every commit.

---

## File map

| File | Responsibility |
|---|---|
| `src/utils/walkthrough/walkthroughCopy.js` (new) | ES/EN labels and sentence templates for graph-sourced steps |
| `src/utils/walkthrough/draftWalkthrough.js` (new) | pure engine: graph + scope + findings → ordered steps |
| `src/utils/walkthrough/applyWalkthroughEdits.js` (new) | edits shape, normaliser, merge, hide/move/note reducers |
| `src/utils/walkthrough/walkthroughLoader.js` (new) | fetch findings for subjects with cap and timeout |
| `src/utils/walkthrough/walkthroughViewport.js` (new) | step → `{x, y, k}` for `centerAt` / `zoom` |
| `src/utils/walkthrough/index.js` (new) | barrel |
| `src/hooks/useWalkthrough.js` (new) | play state, loading, focus sets |
| `src/components/WalkthroughPlayer.jsx` (new) | the docked card |
| `src/utils/sitrepAuthor.js` (new) | author/organisation persistence |
| `src/assets/fonts/plexFonts.js` (generated, committed) + `OFL.txt` | base64 woff2 subsets |
| `scripts/build-font-module.mjs` (new) | regenerates `plexFonts.js` from the woff2 files |
| `src/utils/investigationExport/documentStyle.js` (new) | stylesheet incl. `@font-face`, dark, print |
| `src/utils/investigationExport/documentSections.js` (new) | one pure renderer per document section |
| `src/utils/investigationExport/buildExportHtml.js` | orchestration only |
| `src/utils/investigationExport/renderGraphSvg.js` | `data-x/y`, `data-a/b`, legend |
| `src/utils/investigationExport/walkthroughScript.js` | pan, link focus, pointer events, two voices, chapter click |
| `src/utils/investigationExport/exportCopy.js` | new labels |
| `src/utils/investigationDoc.js` | `steps`, `author`, `coverage` |
| `src/components/RelationshipReportModal.jsx` | Recorrido list, author fields, preview tab |
| `src/components/SpanishCompanyNetworkGraph.jsx` | wiring (~100 lines) |

---

### Task 1: Walkthrough copy

**Files:**
- Create: `src/utils/walkthrough/walkthroughCopy.js`
- Test: `src/utils/walkthrough/walkthroughCopy.test.js`

**Interfaces:**
- Produces: `walkthroughCopy(lang) → t`, `connectorSentence(t, {name, status, roles, companies}) → string`, `ownershipSentence(t, {owner, owned, lost}) → string`, `graphOnlyLine(t, officerCount) → string`, `identityLine(t, header) → string`, `t.sections[section]`, `t.sources[source]`, `t.button`, `t.preparing`, `t.noteField`, `t.hideStep`, `t.reset`, `t.preview`, `t.prev`, `t.next`, `t.exit`, `t.evidence`, `t.resetConfirm(hiddenCount, noteCount)`.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/walkthrough/walkthroughCopy.test.js
import { describe, expect, it } from 'vitest';
import {
  walkthroughCopy, connectorSentence, ownershipSentence, graphOnlyLine, identityLine,
} from './walkthroughCopy';

describe('walkthroughCopy', () => {
  it('falls back to Spanish for any unknown language', () => {
    expect(walkthroughCopy('fr').button).toBe('Recorrido');
    expect(walkthroughCopy('en').button).toBe('Walkthrough');
  });

  it('labels all seven sections and three sources in both languages', () => {
    for (const lang of ['es', 'en']) {
      const t = walkthroughCopy(lang);
      expect(Object.keys(t.sections)).toEqual([
        'subject', 'stands_out', 'connects', 'ownership', 'other_companies', 'unseen', 'author']);
      expect(Object.keys(t.sources)).toEqual(['registry', 'graph', 'author']);
    }
  });

  it('writes the connector sentence by status', () => {
    const t = walkthroughCopy('es');
    const base = { name: 'ANA GARCIA', roles: ['Administradora única', 'Consejera'], companies: ['ALFA SL', 'BETA SL'] };
    expect(connectorSentence(t, { ...base, status: 'active' }))
      .toBe('ANA GARCIA ocupa Administradora única, Consejera en ALFA SL y BETA SL');
    expect(connectorSentence(t, { ...base, status: 'ceased' })).toMatch(/^ANA GARCIA ocupó /);
    expect(connectorSentence(t, { ...base, status: 'mixed' })).toMatch(/^ANA GARCIA ocupa y ocupó /);
    expect(connectorSentence(walkthroughCopy('en'), { ...base, status: 'active' }))
      .toBe('ANA GARCIA holds Administradora única, Consejera at ALFA SL and BETA SL');
  });

  it('joins three companies with commas and a final conjunction', () => {
    const t = walkthroughCopy('en');
    expect(connectorSentence(t, { name: 'X', status: 'active', roles: ['Director'], companies: ['A', 'B', 'C'] }))
      .toBe('X holds Director at A, B and C');
  });

  it('writes ownership present and past', () => {
    expect(ownershipSentence(walkthroughCopy('es'), { owner: 'A', owned: 'B', lost: false })).toBe('A es socio único de B');
    expect(ownershipSentence(walkthroughCopy('es'), { owner: 'A', owned: 'B', lost: true })).toBe('A fue socio único de B');
    expect(ownershipSentence(walkthroughCopy('en'), { owner: 'A', owned: 'B', lost: false })).toBe('A is sole shareholder of B');
  });

  it('writes the graph-only line with the count', () => {
    expect(graphOnlyLine(walkthroughCopy('es'), 9)).toBe('9 cargos visibles en el mapa');
    expect(graphOnlyLine(walkthroughCopy('en'), 1)).toBe('1 officer visible on the map');
  });

  it('renders the identity line from a findings header, skipping blanks', () => {
    const t = walkthroughCopy('es');
    const line = identityLine(t, {
      nif: 'B12345678', province: 'Valencia', registry: 'V-98765',
      previous_names: ['ACME LEVANTE SL'], last_filing: { date: '2026-06-03', type: 'Nombramiento' },
    });
    expect(line).toBe('NIF B12345678 · Valencia · Hoja V-98765 · antes ACME LEVANTE SL · último acto BORME 2026-06-03, Nombramiento');
    expect(identityLine(t, { nif: null, province: null, registry: null, previous_names: [], last_filing: null })).toBe('');
  });

  it('builds the reset confirmation with counts', () => {
    expect(walkthroughCopy('en').resetConfirm(2, 1)).toBe('Discard 2 hidden steps and 1 note and rebuild the draft?');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/walkthrough/walkthroughCopy.test.js`
Expected: FAIL, cannot resolve `./walkthroughCopy`.

- [ ] **Step 3: Write the module**

```js
// src/utils/walkthrough/walkthroughCopy.js
// Strings for the drafted walkthrough. The registry sentences NEVER come from
// here — they are the findings endpoint's own text. This file covers only what
// the graph itself can say (structure) and the chrome around it.

const joinNames = (names, and) => {
  const list = (names || []).filter(Boolean);
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} ${and} ${list[list.length - 1]}`;
};

const ES = {
  button: 'Recorrido',
  preparing: 'Preparando…',
  tooltip: 'Recorre esta red paso a paso: registro, conexiones y tus notas',
  sections: {
    subject: 'Sujeto',
    stands_out: 'Lo que destaca',
    connects: 'Quién conecta',
    ownership: 'Propiedad',
    other_companies: 'Otras empresas',
    unseen: 'Lo que el registro no muestra',
    author: 'Notas del autor',
  },
  sources: { registry: 'Registro (BORME)', graph: 'Del mapa', author: 'Autor' },
  noteField: 'Tu nota',
  hideStep: 'Quitar del recorrido',
  reset: 'Restablecer borrador',
  preview: 'Vista previa',
  edit: 'Editar',
  prev: 'Anterior',
  next: 'Siguiente',
  exit: 'Salir',
  evidence: 'Ver evidencia',
  moveUp: 'Subir',
  moveDown: 'Bajar',
  authorField: 'Autor',
  organisationField: 'Organización',
  status: { active: 'ocupa', ceased: 'ocupó', mixed: 'ocupa y ocupó' },
  at: 'en',
  and: 'y',
  soleOf: 'es socio único de',
  lostOf: 'fue socio único de',
  officersVisible: n => `${n} cargo${n === 1 ? '' : 's'} visible${n === 1 ? '' : 's'} en el mapa`,
  identity: {
    nif: v => `NIF ${v}`, registry: v => `Hoja ${v}`, formerly: v => `antes ${v}`,
    lastFiling: (d, ty) => `último acto BORME ${d}${ty ? `, ${ty}` : ''}`,
  },
  resetConfirm: (h, n) => `¿Descartar ${h} paso${h === 1 ? '' : 's'} oculto${h === 1 ? '' : 's'} y ${n} nota${n === 1 ? '' : 's'} y regenerar el borrador?`,
};

const EN = {
  button: 'Walkthrough',
  preparing: 'Preparing…',
  tooltip: 'Step through this network: registry, connections and your notes',
  sections: {
    subject: 'Subject',
    stands_out: 'What stands out',
    connects: 'Who connects',
    ownership: 'Ownership',
    other_companies: 'Other companies',
    unseen: 'What the registry cannot show',
    author: "Author's notes",
  },
  sources: { registry: 'Registry (BORME)', graph: 'From the map', author: 'Author' },
  noteField: 'Your note',
  hideStep: 'Remove from walkthrough',
  reset: 'Reset draft',
  preview: 'Preview',
  edit: 'Edit',
  prev: 'Previous',
  next: 'Next',
  exit: 'Exit',
  evidence: 'See evidence',
  moveUp: 'Move up',
  moveDown: 'Move down',
  authorField: 'Author',
  organisationField: 'Organisation',
  status: { active: 'holds', ceased: 'held', mixed: 'holds and held' },
  at: 'at',
  and: 'and',
  soleOf: 'is sole shareholder of',
  lostOf: 'was sole shareholder of',
  officersVisible: n => `${n} officer${n === 1 ? '' : 's'} visible on the map`,
  identity: {
    nif: v => `NIF ${v}`, registry: v => `Sheet ${v}`, formerly: v => `formerly ${v}`,
    lastFiling: (d, ty) => `last BORME filing ${d}${ty ? `, ${ty}` : ''}`,
  },
  resetConfirm: (h, n) => `Discard ${h} hidden step${h === 1 ? '' : 's'} and ${n} note${n === 1 ? '' : 's'} and rebuild the draft?`,
};

export const walkthroughCopy = lang => (lang === 'en' ? EN : ES);

export const connectorSentence = (t, { name, status, roles, companies }) => {
  const verb = t.status[status] || t.status.active;
  const roleList = (roles || []).filter(Boolean).join(', ');
  return `${name} ${verb} ${roleList} ${t.at} ${joinNames(companies, t.and)}`;
};

export const ownershipSentence = (t, { owner, owned, lost }) => (
  `${owner} ${lost ? t.lostOf : t.soleOf} ${owned}`
);

export const graphOnlyLine = (t, officerCount) => t.officersVisible(officerCount);

export const identityLine = (t, header) => {
  const h = header || {};
  const parts = [
    h.nif ? t.identity.nif(h.nif) : '',
    h.province || '',
    h.registry ? t.identity.registry(h.registry) : '',
    (h.previous_names || []).length ? t.identity.formerly(h.previous_names.join(', ')) : '',
    h.last_filing?.date ? t.identity.lastFiling(h.last_filing.date, h.last_filing.type || '') : '',
  ].filter(Boolean);
  return parts.join(' · ');
};
```

Note on the EN identity test: the test above expects the ES line; EN uses `Sheet` and `formerly`. Keep the test as written (ES only) and add one EN assertion if you like.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/walkthrough/walkthroughCopy.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/walkthrough/walkthroughCopy.js src/utils/walkthrough/walkthroughCopy.test.js
git -c commit.gpgsign=false commit -m "feat(walkthrough): bilingual copy and sentence templates for graph-sourced steps"
```

---

### Task 2: Draft engine

**Files:**
- Create: `src/utils/walkthrough/draftWalkthrough.js`
- Test: `src/utils/walkthrough/draftWalkthrough.test.js`

**Interfaces:**
- Consumes: Task 1 exports; `nameKey` from `src/utils/pendingOfficerEvents.js`; `isSpellingVariant` from `src/utils/officerNameVariants.js`; `hasNodeNote` from `src/utils/nodeNotes.js`.
- Produces:
  - `SECTIONS`, `STANDS_OUT_CAP`, `CONNECTS_CAP`, `FINDINGS_FETCH_CAP`
  - `pairKey(a, b) → string`
  - `subjectCompanyIds(scope, primarySubjectId) → string[]` (subject first, then scope order)
  - `draftWalkthrough({ graphData, scope, findingsByKey, primarySubjectId, lang }) → Step[]`
  - Step shape: `{ key, section, nodeIds, linkKeys, title, text, source, date, evidence, flag, deepLink, authorNote }` where `authorNote` is `{ text, flag, origin: 'node' } | null`.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/walkthrough/draftWalkthrough.test.js
import { describe, expect, it } from 'vitest';
import {
  draftWalkthrough, subjectCompanyIds, pairKey, STANDS_OUT_CAP, CONNECTS_CAP,
} from './draftWalkthrough';

const AT = '2026-09-12T09:00:00.000Z';
const co = (id, name, extra = {}) => ({ id, type: 'spanish-company-group', name, groupKey: id, ...extra });
const off = (id, name, extra = {}) => ({ id, type: 'officer', name, ...extra });
const link = (a, b, extra = {}) => ({ source: a, target: b, ...extra });

const graph = {
  nodes: [
    co('H:1', 'ALFA SL'), co('H:2', 'BETA SL'),
    off('o1', 'GARCIA LOPEZ ANA'), off('o2', 'RUIZ MARTIN LUIS', { userNote: { text: 'Left days before the filing', flag: 'blue', updatedAt: AT } }),
  ],
  links: [
    link('H:1', 'o1', { category: 'nombramiento', relationship: 'Administradora única' }),
    link('H:2', 'o1', { category: 'cese', relationship: 'Consejera' }),
    link('H:1', 'o2', { category: 'cese', relationship: 'Apoderado' }),
    link('H:1', 'H:2', { type: 'ownership', category: 'socio_unico' }),
  ],
};

const scope = {
  companies: ['ALFA SL', 'BETA SL'],
  companyNodes: [{ name: 'ALFA SL', nodeId: 'H:1' }, { name: 'BETA SL', nodeId: 'H:2' }],
  connectors: [{ name: 'GARCIA LOPEZ ANA', nodeId: 'o1', type: 'individual', companies: ['ALFA SL', 'BETA SL'], roles: ['Administradora única', 'Consejera'], status: 'mixed' }],
  ownership: [{ owner: 'ALFA SL', owned: 'BETA SL', lost: false }],
  officersByCompany: { 'ALFA SL': ['GARCIA LOPEZ ANA', 'RUIZ MARTIN LUIS'], 'BETA SL': ['GARCIA LOPEZ ANA'] },
  counts: { companies: 2, officers: 2, sharedPeople: 1 },
};

const finding = (kind, cls, date, extra = {}) => ({
  kind, cls, date, layer: 'shape', text: `${kind} text`, evidence: [], borme_ref: null, ...extra,
});

const alfaFindings = {
  company: { name: 'ALFA SL', group_key: 'H:1', nif: 'B1', province: 'Valencia', registry: 'V-1', previous_names: [], last_filing: { date: '2026-06-03', type: 'Nombramiento' } },
  findings: [
    finding('capital_movement', 'concern', '2024-03-11'),
    finding('governing_body_turnover', 'context', '2026-06-03', { evidence: [{ kind: 'officer', ref: 'Ana García López' }] }),
    finding('no_insolvency_notice', 'limitation', null),
    finding('sole_shareholder_declared', 'context', '2019-01-01'),
    finding('previous_name', 'context', '2018-01-01'),
    finding('structural_event', 'concern', '2020-05-05'),
  ],
  verification: ['The registry does not show beneficial owners.'],
  coverage: { since: '2009-01-01', indexed_through: '2026-09-11' },
};

const draft = (over = {}) => draftWalkthrough({
  graphData: graph, scope, findingsByKey: new Map([['H:1', alfaFindings], ['H:2', null]]),
  primarySubjectId: 'H:1', lang: 'es', ...over,
});

describe('draftWalkthrough', () => {
  it('emits sections in the fixed order', () => {
    const sections = [...new Set(draft().map(s => s.section))];
    expect(sections).toEqual(['subject', 'stands_out', 'connects', 'ownership', 'other_companies', 'unseen', 'author']);
  });

  it('opens with the subject identity line from the findings header', () => {
    const [first] = draft();
    expect(first).toMatchObject({
      key: 'subject:H:1', section: 'subject', nodeIds: ['H:1'], source: 'registry',
      title: 'ALFA SL', deepLink: 'https://mapasocietario.es/app?gk=H%3A1&lang=es',
    });
    expect(first.text).toContain('NIF B1');
  });

  it('puts concerns before context, drops limitations, and caps at STANDS_OUT_CAP', () => {
    const standsOut = draft().filter(s => s.section === 'stands_out');
    expect(standsOut.length).toBe(STANDS_OUT_CAP);
    expect(standsOut.map(s => s.key)).toEqual([
      'stands_out:H:1:capital_movement:2024-03-11',
      'stands_out:H:1:structural_event:2020-05-05',
      'stands_out:H:1:governing_body_turnover:2026-06-03',
      'stands_out:H:1:sole_shareholder_declared:2019-01-01',
    ]);
    expect(standsOut.every(s => s.source === 'registry')).toBe(true);
    expect(standsOut[0].text).toBe('capital_movement text');
  });

  it('resolves officer evidence to a visible node by folded name and links it to the subject', () => {
    const turnover = draft().find(s => s.key.startsWith('stands_out:H:1:governing_body_turnover'));
    expect(turnover.nodeIds).toEqual(['H:1', 'o1']);
    expect(turnover.linkKeys).toEqual([pairKey('H:1', 'o1')]);
  });

  it('writes one connects step per connector with both companies and their links', () => {
    const connects = draft().filter(s => s.section === 'connects');
    expect(connects).toHaveLength(1);
    expect(connects[0]).toMatchObject({
      key: 'connects:o1', source: 'graph', title: 'GARCIA LOPEZ ANA',
      nodeIds: ['o1', 'H:1', 'H:2'],
    });
    expect(connects[0].linkKeys.sort()).toEqual([pairKey('H:1', 'o1'), pairKey('H:2', 'o1')].sort());
    expect(connects[0].text).toBe('GARCIA LOPEZ ANA ocupa y ocupó Administradora única, Consejera en ALFA SL y BETA SL');
  });

  it('caps connectors at CONNECTS_CAP, most companies first', () => {
    const many = Array.from({ length: CONNECTS_CAP + 3 }, (_, i) => ({
      name: `P${i}`, nodeId: `p${i}`, type: 'individual', companies: i === 0 ? ['ALFA SL', 'BETA SL', 'GAMMA SL'] : ['ALFA SL', 'BETA SL'],
      roles: ['Consejero'], status: 'active',
    }));
    const nodes = [...graph.nodes, ...many.map(c => off(c.nodeId, c.name))];
    const steps = draft({ graphData: { ...graph, nodes }, scope: { ...scope, connectors: many } });
    const connects = steps.filter(s => s.section === 'connects');
    expect(connects).toHaveLength(CONNECTS_CAP);
    expect(connects[0].key).toBe('connects:p0');
  });

  it('writes an ownership step focusing both nodes and their edge', () => {
    const own = draft().find(s => s.section === 'ownership');
    expect(own).toMatchObject({
      key: 'ownership:H:1|H:2', nodeIds: ['H:1', 'H:2'], linkKeys: [pairKey('H:1', 'H:2')],
      text: 'ALFA SL es socio único de BETA SL', source: 'graph',
    });
  });

  it('gives a company with no findings payload the graph-only line', () => {
    const other = draft().find(s => s.section === 'other_companies');
    expect(other).toMatchObject({ key: 'other_companies:H:2', title: 'BETA SL', source: 'graph', text: '1 cargo visible en el mapa' });
  });

  it('gives a company with a concern its top concern as the other_companies text', () => {
    const betaFindings = { ...alfaFindings, company: { ...alfaFindings.company, name: 'BETA SL', group_key: 'H:2' } };
    const other = draft({ findingsByKey: new Map([['H:1', alfaFindings], ['H:2', betaFindings]]) })
      .find(s => s.section === 'other_companies');
    expect(other).toMatchObject({ source: 'registry', text: 'capital_movement text', date: '2024-03-11' });
  });

  it('collects verification lines and limitation findings into one unseen step', () => {
    const unseen = draft().find(s => s.section === 'unseen');
    expect(unseen.key).toBe('unseen:H:1');
    expect(unseen.text).toContain('The registry does not show beneficial owners.');
    expect(unseen.text).toContain('no_insolvency_notice text');
  });

  it('turns a note on an unfocused node into an author step, and attaches focused notes', () => {
    const nodes = graph.nodes.map(n => (n.id === 'o1'
      ? { ...n, userNote: { text: 'Same person as the 2019 apoderada?', flag: 'amber', updatedAt: AT } } : n));
    const steps = draft({ graphData: { ...graph, nodes } });
    const author = steps.filter(s => s.section === 'author');
    expect(author).toEqual([expect.objectContaining({
      key: 'author:o2', title: 'RUIZ MARTIN LUIS', text: 'Left days before the filing', flag: 'blue', source: 'author', nodeIds: ['o2'],
    })]);
    const connects = steps.find(s => s.key === 'connects:o1');
    expect(connects.authorNote).toEqual({ text: 'Same person as the 2019 apoderada?', flag: 'amber', origin: 'node' });
  });

  it('orders author steps red, amber, then the rest, then by name', () => {
    const nodes = [
      ...graph.nodes.filter(n => n.id !== 'o2'),
      off('z', 'ZETA', { userNote: { text: 'z', flag: 'none', updatedAt: AT } }),
      off('r', 'ROJO', { userNote: { text: 'r', flag: 'red', updatedAt: AT } }),
      off('a', 'AMBAR', { userNote: { text: 'a', flag: 'amber', updatedAt: AT } }),
      off('b', 'BLUE', { userNote: { text: 'b', flag: 'blue', updatedAt: AT } }),
    ];
    const keys = draft({ graphData: { ...graph, nodes } }).filter(s => s.section === 'author').map(s => s.key);
    expect(keys).toEqual(['author:r', 'author:a', 'author:b', 'author:z']);
  });

  it('yields exactly one subject step for a lone company with no payload', () => {
    const lone = { nodes: [co('H:9', 'SOLA SL')], links: [] };
    const loneScope = { ...scope, companies: ['SOLA SL'], companyNodes: [{ name: 'SOLA SL', nodeId: 'H:9' }], connectors: [], ownership: [], officersByCompany: { 'SOLA SL': [] } };
    const steps = draft({ graphData: lone, scope: loneScope, findingsByKey: new Map(), primarySubjectId: null });
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ key: 'subject:H:9', source: 'graph', text: '0 cargos visibles en el mapa' });
  });

  it('falls back to the first pinned company when the primary subject is not on the map', () => {
    const [first] = draft({ primarySubjectId: 'H:404' });
    expect(first.key).toBe('subject:H:1');
  });

  it('does not mutate its inputs', () => {
    const before = JSON.stringify({ graph, scope, alfaFindings });
    draft();
    expect(JSON.stringify({ graph, scope, alfaFindings })).toBe(before);
  });
});

describe('subjectCompanyIds', () => {
  it('puts the primary subject first and keeps scope order for the rest', () => {
    expect(subjectCompanyIds(scope, 'H:2')).toEqual(['H:2', 'H:1']);
    expect(subjectCompanyIds(scope, null)).toEqual(['H:1', 'H:2']);
  });
});

describe('pairKey', () => {
  it('is order-independent', () => {
    expect(pairKey('b', 'a')).toBe('a|b');
    expect(pairKey('a', 'b')).toBe('a|b');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/walkthrough/draftWalkthrough.test.js`
Expected: FAIL, cannot resolve `./draftWalkthrough`.

- [ ] **Step 3: Write the engine**

```js
// src/utils/walkthrough/draftWalkthrough.js
// The drafted walkthrough: an ordered story of the visible graph, written from
// two sources only — the graph's own structure, and the findings endpoint's
// registry sentences (verbatim). No model call. Pure: no DOM, no network, no
// mutation of inputs.
//
// A note on keys: they are the persistence contract for author edits. They
// must depend only on node ids and finding identity, never on order or text.

import { nameKey } from '../pendingOfficerEvents';
import { isSpellingVariant } from '../officerNameVariants';
import { hasNodeNote } from '../nodeNotes';
import {
  walkthroughCopy, connectorSentence, ownershipSentence, graphOnlyLine, identityLine,
} from './walkthroughCopy';

export const SECTIONS = Object.freeze([
  'subject', 'stands_out', 'connects', 'ownership', 'other_companies', 'unseen', 'author',
]);
export const STANDS_OUT_CAP = 4;
export const CONNECTS_CAP = 8;
export const FINDINGS_FETCH_CAP = 6;

const SITE = 'https://mapasocietario.es';
const FLAG_RANK = { red: 0, amber: 1 };

const nid = id => (id == null ? '' : String(id));
const refId = ref => (ref && typeof ref === 'object' ? ref.id : ref);
const isCompany = n => !!n && (n.type === 'company' || n.type === 'spanish-company-group');

export const pairKey = (a, b) => (nid(a) < nid(b) ? `${nid(a)}|${nid(b)}` : `${nid(b)}|${nid(a)}`);

export const subjectCompanyIds = (scope, primarySubjectId) => {
  const ids = (scope?.companyNodes || []).map(c => nid(c.nodeId));
  const primary = nid(primarySubjectId);
  if (!primary || !ids.includes(primary)) return ids;
  return [primary, ...ids.filter(id => id !== primary)];
};

const deepLink = (node, lang) => {
  const params = new URLSearchParams();
  if (node?.groupKey) params.set('gk', node.groupKey);
  else if (node?.name) params.set('search', node.name);
  params.set('lang', lang);
  return `${SITE}/app?${params}`;
};

const step = fields => ({
  linkKeys: [], date: null, evidence: null, flag: null, authorNote: null, ...fields,
});

const officerNodeByName = (officers, ref) => {
  const wanted = nameKey(ref);
  if (!wanted) return null;
  return officers.find(o => nameKey(o.name) === wanted)
    || officers.find(o => isSpellingVariant(o.name, ref))
    || null;
};

const companyStep = ({ section, node, payload, t, lang, officerCount }) => {
  const header = payload?.company;
  const identity = header ? identityLine(t, header) : '';
  return step({
    key: `${section}:${nid(node.id)}`,
    section,
    nodeIds: [nid(node.id)],
    title: node.name || '',
    text: identity || graphOnlyLine(t, officerCount),
    source: identity ? 'registry' : 'graph',
    deepLink: deepLink(node, lang),
  });
};

const findingStep = ({ section, node, finding, officers, lang }) => {
  const extraNodes = (finding.evidence || [])
    .filter(e => e.kind === 'officer')
    .map(e => officerNodeByName(officers, e.ref))
    .filter(Boolean)
    .map(o => nid(o.id));
  const uniqueExtra = [...new Set(extraNodes)];
  return step({
    key: `${section}:${nid(node.id)}:${finding.kind}:${finding.date || ''}`,
    section,
    nodeIds: [nid(node.id), ...uniqueExtra],
    linkKeys: uniqueExtra.map(o => pairKey(node.id, o)),
    title: node.name || '',
    text: finding.text || '',
    source: 'registry',
    date: finding.date || null,
    evidence: (finding.evidence || [])[0] || null,
    deepLink: deepLink(node, lang),
  });
};

const byClsThenDate = (a, b) => {
  const rank = c => (c === 'concern' ? 0 : 1);
  if (rank(a.cls) !== rank(b.cls)) return rank(a.cls) - rank(b.cls);
  return String(b.date || '').localeCompare(String(a.date || ''));
};

export function draftWalkthrough({ graphData, scope, findingsByKey, primarySubjectId, lang = 'es' }) {
  const t = walkthroughCopy(lang);
  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];
  const byId = new Map(nodes.map(n => [nid(n.id), n]));
  const payloads = findingsByKey instanceof Map ? findingsByKey : new Map();

  const subjectIds = subjectCompanyIds(scope, primarySubjectId).filter(id => byId.has(id));
  if (subjectIds.length === 0) return [];
  const [subjectId, ...otherIds] = subjectIds;

  // Officers adjacent to a company, for evidence resolution and counts.
  const officersOf = new Map();
  links.forEach(l => {
    const a = byId.get(nid(refId(l.source)));
    const b = byId.get(nid(refId(l.target)));
    if (!a || !b) return;
    const [c, o] = isCompany(a) && b.type === 'officer' ? [a, b]
      : isCompany(b) && a.type === 'officer' ? [b, a] : [null, null];
    if (!c) return;
    const list = officersOf.get(nid(c.id)) || [];
    if (!list.includes(o)) officersOf.set(nid(c.id), [...list, o]);
  });
  const officersAt = id => officersOf.get(id) || [];

  const steps = [];
  const subject = byId.get(subjectId);
  const subjectPayload = payloads.get(subjectId) || null;

  steps.push(companyStep({ section: 'subject', node: subject, payload: subjectPayload, t, lang, officerCount: officersAt(subjectId).length }));

  const findings = subjectPayload?.findings || [];
  [...findings.filter(f => f.cls !== 'limitation')].sort(byClsThenDate).slice(0, STANDS_OUT_CAP)
    .forEach(f => steps.push(findingStep({ section: 'stands_out', node: subject, finding: f, officers: officersAt(subjectId), lang })));

  const companyIdByName = new Map((scope?.companyNodes || []).map(c => [c.name, nid(c.nodeId)]));
  [...(scope?.connectors || [])]
    .sort((x, y) => (y.companies?.length || 0) - (x.companies?.length || 0) || String(x.name).localeCompare(String(y.name)))
    .slice(0, CONNECTS_CAP)
    .forEach(c => {
      const person = byId.get(nid(c.nodeId));
      if (!person) return;
      const companyIds = (c.companies || []).map(n => companyIdByName.get(n)).filter(id => id && byId.has(id));
      steps.push(step({
        key: `connects:${nid(c.nodeId)}`,
        section: 'connects',
        nodeIds: [nid(c.nodeId), ...companyIds],
        linkKeys: companyIds.map(id => pairKey(c.nodeId, id)),
        title: c.name,
        text: connectorSentence(t, c),
        source: 'graph',
        deepLink: deepLink(person, lang),
      }));
    });

  (scope?.ownership || []).forEach(o => {
    const ownerId = companyIdByName.get(o.owner) || nid(nodes.find(n => n.name === o.owner)?.id);
    const ownedId = companyIdByName.get(o.owned) || nid(nodes.find(n => n.name === o.owned)?.id);
    if (!ownerId || !ownedId || !byId.has(ownerId) || !byId.has(ownedId)) return;
    steps.push(step({
      key: `ownership:${ownerId}|${ownedId}`,
      section: 'ownership',
      nodeIds: [ownerId, ownedId],
      linkKeys: [pairKey(ownerId, ownedId)],
      title: o.owner,
      text: ownershipSentence(t, o),
      source: 'graph',
      deepLink: deepLink(byId.get(ownerId), lang),
    }));
  });

  otherIds.forEach(id => {
    const node = byId.get(id);
    const payload = payloads.get(id) || null;
    const concern = (payload?.findings || []).filter(f => f.cls === 'concern').sort(byClsThenDate)[0];
    if (concern) {
      const s = findingStep({ section: 'other_companies', node, finding: concern, officers: officersAt(id), lang });
      steps.push({ ...s, key: `other_companies:${id}` });
    } else {
      steps.push(companyStep({ section: 'other_companies', node, payload, t, lang, officerCount: officersAt(id).length }));
    }
  });

  const unseenLines = [
    ...(subjectPayload?.verification || []),
    ...findings.filter(f => f.cls === 'limitation').map(f => f.text),
  ].filter(Boolean);
  if (unseenLines.length) {
    steps.push(step({
      key: `unseen:${subjectId}`,
      section: 'unseen',
      nodeIds: [subjectId],
      title: subject.name || '',
      text: unseenLines.join('\n'),
      source: 'registry',
      deepLink: deepLink(subject, lang),
    }));
  }

  // Notes: attach to the step whose primary node carries the note; the rest
  // become author steps.
  const noted = nodes.filter(hasNodeNote);
  const primaryOf = new Map();
  steps.forEach(s => { if (!primaryOf.has(s.nodeIds[0])) primaryOf.set(s.nodeIds[0], s.key); });
  const attached = new Map();
  const loose = [];
  noted.forEach(n => {
    const key = primaryOf.get(nid(n.id));
    if (key) attached.set(key, { text: n.userNote.text.trim(), flag: n.userNote.flag || 'none', origin: 'node' });
    else loose.push(n);
  });

  const withNotes = steps.map(s => (attached.has(s.key) ? { ...s, authorNote: attached.get(s.key) } : s));

  loose.sort((a, b) => {
    const ra = FLAG_RANK[a.userNote.flag] ?? 2;
    const rb = FLAG_RANK[b.userNote.flag] ?? 2;
    return ra - rb || String(a.name).localeCompare(String(b.name));
  }).forEach(n => withNotes.push(step({
    key: `author:${nid(n.id)}`,
    section: 'author',
    nodeIds: [nid(n.id)],
    title: n.name || '',
    text: n.userNote.text.trim(),
    source: 'author',
    flag: n.userNote.flag || 'none',
    deepLink: deepLink(n, lang),
  })));

  return withNotes;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/walkthrough/draftWalkthrough.test.js`
Expected: PASS. If the `stands_out` order test fails on the two `context` items, check `byClsThenDate`: within a class, newest first (`2026-06-03` before `2019-01-01`).

- [ ] **Step 5: Commit**

```bash
git add src/utils/walkthrough/draftWalkthrough.js src/utils/walkthrough/draftWalkthrough.test.js
git -c commit.gpgsign=false commit -m "feat(walkthrough): draft the story of the visible graph from structure and registry findings"
```

---

### Task 3: Author edits overlay

**Files:**
- Create: `src/utils/walkthrough/applyWalkthroughEdits.js`
- Create: `src/utils/walkthrough/index.js`
- Test: `src/utils/walkthrough/applyWalkthroughEdits.test.js`

**Interfaces:**
- Produces:
  - `EMPTY_WALKTHROUGH_EDITS` (frozen `{hidden: [], order: [], notes: {}}`)
  - `normalizeWalkthroughEdits(raw) → edits` (never throws)
  - `applyWalkthroughEdits(steps, edits) → Step[]` (`authorNote` becomes `{text, flag, origin:'step'}` when `edits.notes[key]` is set, else the draft's)
  - `hideStep(edits, key) → edits`, `setStepNote(edits, key, text) → edits` (empty text deletes), `moveStep(edits, currentKeys, key, delta) → edits`, `editsCounts(edits) → {hidden, notes}`

- [ ] **Step 1: Write the failing test**

```js
// src/utils/walkthrough/applyWalkthroughEdits.test.js
import { describe, expect, it } from 'vitest';
import {
  EMPTY_WALKTHROUGH_EDITS, normalizeWalkthroughEdits, applyWalkthroughEdits,
  hideStep, setStepNote, moveStep, editsCounts,
} from './applyWalkthroughEdits';

const s = (key, extra = {}) => ({ key, section: 'connects', nodeIds: ['n'], linkKeys: [], title: key, text: '', source: 'graph', date: null, evidence: null, flag: null, deepLink: '', authorNote: null, ...extra });
const draft = [s('a'), s('b', { authorNote: { text: 'from node', flag: 'amber', origin: 'node' } }), s('c'), s('d')];

describe('applyWalkthroughEdits', () => {
  it('returns the draft untouched for empty edits', () => {
    expect(applyWalkthroughEdits(draft, EMPTY_WALKTHROUGH_EDITS)).toEqual(draft);
  });

  it('drops hidden steps', () => {
    expect(applyWalkthroughEdits(draft, { ...EMPTY_WALKTHROUGH_EDITS, hidden: ['b'] }).map(x => x.key)).toEqual(['a', 'c', 'd']);
  });

  it('honours a partial order and keeps the rest in draft order', () => {
    expect(applyWalkthroughEdits(draft, { ...EMPTY_WALKTHROUGH_EDITS, order: ['c', 'a'] }).map(x => x.key)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('ignores order keys that no step carries', () => {
    expect(applyWalkthroughEdits(draft, { ...EMPTY_WALKTHROUGH_EDITS, order: ['zzz', 'd'] }).map(x => x.key)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('a step note overrides the node note; a missing key is ignored', () => {
    const out = applyWalkthroughEdits(draft, { ...EMPTY_WALKTHROUGH_EDITS, notes: { b: 'mine', nope: 'x' } });
    expect(out.find(x => x.key === 'b').authorNote).toEqual({ text: 'mine', flag: null, origin: 'step' });
    expect(out.find(x => x.key === 'a').authorNote).toBeNull();
  });

  it('does not mutate inputs', () => {
    const edits = { hidden: ['a'], order: ['d'], notes: { c: 'n' } };
    const before = JSON.stringify({ draft, edits });
    applyWalkthroughEdits(draft, edits);
    expect(JSON.stringify({ draft, edits })).toBe(before);
  });
});

describe('reducers', () => {
  it('hideStep adds once', () => {
    const e = hideStep(hideStep(EMPTY_WALKTHROUGH_EDITS, 'a'), 'a');
    expect(e.hidden).toEqual(['a']);
  });

  it('setStepNote trims and deletes on empty', () => {
    const e = setStepNote(EMPTY_WALKTHROUGH_EDITS, 'a', '  hi ');
    expect(e.notes).toEqual({ a: 'hi' });
    expect(setStepNote(e, 'a', '   ').notes).toEqual({});
  });

  it('moveStep swaps with its neighbour and records the full order', () => {
    const e = moveStep(EMPTY_WALKTHROUGH_EDITS, ['a', 'b', 'c'], 'c', -1);
    expect(e.order).toEqual(['a', 'c', 'b']);
    expect(moveStep(e, ['a', 'c', 'b'], 'a', -1).order).toEqual(['a', 'c', 'b']);
    expect(moveStep(e, ['a', 'c', 'b'], 'b', 1).order).toEqual(['a', 'c', 'b']);
  });

  it('editsCounts counts hidden and notes', () => {
    expect(editsCounts({ hidden: ['a', 'b'], order: [], notes: { c: 'x' } })).toEqual({ hidden: 2, notes: 1 });
  });
});

describe('normalizeWalkthroughEdits', () => {
  it('accepts junk and returns the empty shape', () => {
    expect(normalizeWalkthroughEdits(undefined)).toEqual(EMPTY_WALKTHROUGH_EDITS);
    expect(normalizeWalkthroughEdits({ hidden: 'x', order: 3, notes: [] })).toEqual(EMPTY_WALKTHROUGH_EDITS);
  });

  it('keeps only string keys and string notes', () => {
    expect(normalizeWalkthroughEdits({ hidden: ['a', 1], order: ['b', null], notes: { c: 'ok', d: 2 } }))
      .toEqual({ hidden: ['a'], order: ['b'], notes: { c: 'ok' } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/walkthrough/applyWalkthroughEdits.test.js`
Expected: FAIL, cannot resolve module.

- [ ] **Step 3: Write the module and the barrel**

```js
// src/utils/walkthrough/applyWalkthroughEdits.js
// The author's edits to a drafted walkthrough, as an OVERLAY keyed by step key.
// Not a materialised copy: the draft is recomputed from the graph, the overlay
// is applied on top, so a re-expanded graph gains steps without losing the
// author's order, and a step whose node is hidden reappears where it was.

export const EMPTY_WALKTHROUGH_EDITS = Object.freeze({ hidden: [], order: [], notes: {} });

const strings = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);

export const normalizeWalkthroughEdits = raw => {
  if (!raw || typeof raw !== 'object') return EMPTY_WALKTHROUGH_EDITS;
  const notes = raw.notes && typeof raw.notes === 'object' && !Array.isArray(raw.notes)
    ? Object.fromEntries(Object.entries(raw.notes).filter(([, v]) => typeof v === 'string'))
    : {};
  return { hidden: strings(raw.hidden), order: strings(raw.order), notes };
};

export const applyWalkthroughEdits = (steps, edits) => {
  const e = normalizeWalkthroughEdits(edits);
  const hidden = new Set(e.hidden);
  const visible = (steps || []).filter(s => !hidden.has(s.key));
  const byKey = new Map(visible.map(s => [s.key, s]));
  const ordered = e.order.filter(k => byKey.has(k)).map(k => byKey.get(k));
  const placed = new Set(ordered.map(s => s.key));
  const rest = visible.filter(s => !placed.has(s.key));
  return [...ordered, ...rest].map(s => (
    Object.prototype.hasOwnProperty.call(e.notes, s.key)
      ? { ...s, authorNote: { text: e.notes[s.key], flag: null, origin: 'step' } }
      : s
  ));
};

export const hideStep = (edits, key) => {
  const e = normalizeWalkthroughEdits(edits);
  return e.hidden.includes(key) ? e : { ...e, hidden: [...e.hidden, key] };
};

export const setStepNote = (edits, key, text) => {
  const e = normalizeWalkthroughEdits(edits);
  const clean = String(text || '').trim();
  const notes = { ...e.notes };
  if (clean) notes[key] = clean; else delete notes[key];
  return { ...e, notes };
};

export const moveStep = (edits, currentKeys, key, delta) => {
  const e = normalizeWalkthroughEdits(edits);
  const keys = [...(currentKeys || [])];
  const i = keys.indexOf(key);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= keys.length) return e;
  [keys[i], keys[j]] = [keys[j], keys[i]];
  return { ...e, order: keys };
};

export const editsCounts = edits => {
  const e = normalizeWalkthroughEdits(edits);
  return { hidden: e.hidden.length, notes: Object.keys(e.notes).length };
};
```

```js
// src/utils/walkthrough/index.js
export * from './walkthroughCopy';
export * from './draftWalkthrough';
export * from './applyWalkthroughEdits';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/walkthrough/`
Expected: PASS (all three files).

- [ ] **Step 5: Commit**

```bash
git add src/utils/walkthrough/
git -c commit.gpgsign=false commit -m "feat(walkthrough): author edits as an overlay — hide, reorder, annotate without losing the draft"
```

---

### Task 4: Loader and viewport helpers

**Files:**
- Create: `src/utils/walkthrough/walkthroughLoader.js`
- Create: `src/utils/walkthrough/walkthroughViewport.js`
- Modify: `src/utils/walkthrough/index.js` (export both)
- Test: `src/utils/walkthrough/walkthroughLoader.test.js`, `src/utils/walkthrough/walkthroughViewport.test.js`

**Interfaces:**
- Produces:
  - `FINDINGS_WAIT_MS = 4000`
  - `loadFindingsForSubjects({ subjectIds, nodesById, fetchFindings, lang, cap = FINDINGS_FETCH_CAP, waitMs = FINDINGS_WAIT_MS, now = Date.now, setTimeoutFn = setTimeout }) → Promise<Map<nodeId, payload|null>>` where `fetchFindings({groupKey, name, lang}) → Promise<payload>`.
  - `stepViewport(step, nodesById, { width, height, padding = 80, minZoom = 0.6, maxZoom = 3, singleZoom = 2.2 }) → { x, y, k } | null`

- [ ] **Step 1: Write the failing tests**

```js
// src/utils/walkthrough/walkthroughLoader.test.js
import { describe, expect, it, vi } from 'vitest';
import { loadFindingsForSubjects } from './walkthroughLoader';

const nodesById = new Map([
  ['H:1', { id: 'H:1', name: 'ALFA SL', groupKey: 'H:1' }],
  ['N:beta', { id: 'N:beta', name: 'BETA SL' }],
  ['H:3', { id: 'H:3', name: 'GAMMA SL', groupKey: 'H:3' }],
]);

describe('loadFindingsForSubjects', () => {
  it('fetches by group key when present, by name otherwise, and maps by node id', async () => {
    const fetchFindings = vi.fn(async ({ groupKey, name }) => ({ company: { name: groupKey || name } }));
    const out = await loadFindingsForSubjects({ subjectIds: ['H:1', 'N:beta'], nodesById, fetchFindings, lang: 'es' });
    expect(fetchFindings).toHaveBeenCalledWith({ groupKey: 'H:1', name: 'ALFA SL', lang: 'es' });
    expect(fetchFindings).toHaveBeenCalledWith({ groupKey: null, name: 'BETA SL', lang: 'es' });
    expect(out.get('H:1')).toEqual({ company: { name: 'H:1' } });
    expect(out.get('N:beta')).toEqual({ company: { name: 'BETA SL' } });
  });

  it('caps the number of fetches and leaves the rest null', async () => {
    const fetchFindings = vi.fn(async () => ({}));
    const out = await loadFindingsForSubjects({ subjectIds: ['H:1', 'N:beta', 'H:3'], nodesById, fetchFindings, lang: 'es', cap: 2 });
    expect(fetchFindings).toHaveBeenCalledTimes(2);
    expect(out.get('H:3')).toBeNull();
  });

  it('maps a rejected fetch to null and still resolves', async () => {
    const fetchFindings = vi.fn(async ({ groupKey }) => { if (groupKey === 'H:1') throw new Error('409'); return {}; });
    const out = await loadFindingsForSubjects({ subjectIds: ['H:1', 'H:3'], nodesById, fetchFindings, lang: 'en' });
    expect(out.get('H:1')).toBeNull();
    expect(out.get('H:3')).toEqual({});
  });

  it('resolves at the timeout with whatever has arrived', async () => {
    vi.useFakeTimers();
    const fetchFindings = vi.fn(({ groupKey }) => (groupKey === 'H:1'
      ? Promise.resolve({ fast: true })
      : new Promise(() => {}))); // never settles
    const p = loadFindingsForSubjects({ subjectIds: ['H:1', 'H:3'], nodesById, fetchFindings, lang: 'es', waitMs: 100 });
    await vi.advanceTimersByTimeAsync(101);
    const out = await p;
    expect(out.get('H:1')).toEqual({ fast: true });
    expect(out.get('H:3')).toBeNull();
    vi.useRealTimers();
  });
});
```

```js
// src/utils/walkthrough/walkthroughViewport.test.js
import { describe, expect, it } from 'vitest';
import { stepViewport } from './walkthroughViewport';

const nodesById = new Map([
  ['a', { id: 'a', x: 100, y: 100 }],
  ['b', { id: 'b', x: 300, y: 500 }],
  ['nan', { id: 'nan' }],
]);
const frame = { width: 800, height: 600 };

describe('stepViewport', () => {
  it('centres a single node at the single-node zoom', () => {
    expect(stepViewport({ nodeIds: ['a'] }, nodesById, frame)).toEqual({ x: 100, y: 100, k: 2.2 });
  });

  it('fits several nodes inside the frame with padding', () => {
    const v = stepViewport({ nodeIds: ['a', 'b'] }, nodesById, { ...frame, padding: 100 });
    expect(v.x).toBe(200);
    expect(v.y).toBe(300);
    // span 200 x 400; usable 600 x 400 → k = min(600/200, 400/400) = 1
    expect(v.k).toBe(1);
  });

  it('clamps zoom to the bounds', () => {
    const tiny = new Map([['a', { x: 0, y: 0 }], ['b', { x: 1, y: 1 }]]);
    expect(stepViewport({ nodeIds: ['a', 'b'] }, tiny, frame).k).toBe(3);
    const huge = new Map([['a', { x: 0, y: 0 }], ['b', { x: 10000, y: 0 }]]);
    expect(stepViewport({ nodeIds: ['a', 'b'] }, huge, frame).k).toBe(0.6);
  });

  it('ignores nodes without coordinates and returns null when none remain', () => {
    expect(stepViewport({ nodeIds: ['nan'] }, nodesById, frame)).toBeNull();
    expect(stepViewport({ nodeIds: ['nan', 'a'] }, nodesById, frame)).toEqual({ x: 100, y: 100, k: 2.2 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/walkthrough/walkthroughLoader.test.js src/utils/walkthrough/walkthroughViewport.test.js`
Expected: FAIL, modules missing.

- [ ] **Step 3: Write both modules**

```js
// src/utils/walkthrough/walkthroughLoader.js
// Fetch findings for the subject companies, capped and time-boxed, so the
// walkthrough can start with whatever arrived and never reorder mid-play.
import { FINDINGS_FETCH_CAP } from './draftWalkthrough';

export const FINDINGS_WAIT_MS = 4000;

export async function loadFindingsForSubjects({
  subjectIds, nodesById, fetchFindings, lang,
  cap = FINDINGS_FETCH_CAP, waitMs = FINDINGS_WAIT_MS, setTimeoutFn = setTimeout,
}) {
  const ids = (subjectIds || []).slice(0, cap);
  const results = new Map((subjectIds || []).map(id => [id, null]));

  const settle = ids.map(id => {
    const node = nodesById.get(id);
    if (!node) return Promise.resolve();
    return Promise.resolve()
      .then(() => fetchFindings({ groupKey: node.groupKey || null, name: node.name || '', lang }))
      .then(payload => { results.set(id, payload ?? null); })
      .catch(() => { results.set(id, null); });
  });

  const timeout = new Promise(resolve => { setTimeoutFn(resolve, waitMs); });
  await Promise.race([Promise.all(settle), timeout]);
  return new Map(results);
}
```

```js
// src/utils/walkthrough/walkthroughViewport.js
// Where the camera goes for a step: centre of the step's nodes, zoom that fits
// them with padding, clamped so a lone node is close and a wide spread is not
// microscopic. Returns null when no node has coordinates yet (simulation cold).
const finite = v => (Number.isFinite(v) ? v : null);

export function stepViewport(step, nodesById, {
  width, height, padding = 80, minZoom = 0.6, maxZoom = 3, singleZoom = 2.2,
} = {}) {
  const pts = (step?.nodeIds || [])
    .map(id => nodesById.get(id))
    .map(n => [finite(n?.x), finite(n?.y)])
    .filter(([x, y]) => x !== null && y !== null);
  if (pts.length === 0) return null;

  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const x = (minX + maxX) / 2;
  const y = (minY + maxY) / 2;
  if (pts.length === 1) return { x, y, k: singleZoom };

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const usableW = Math.max((width || 0) - 2 * padding, 1);
  const usableH = Math.max((height || 0) - 2 * padding, 1);
  const k = Math.min(usableW / spanX, usableH / spanY);
  return { x, y, k: Math.min(maxZoom, Math.max(minZoom, k)) };
}
```

Add to `src/utils/walkthrough/index.js`:

```js
export * from './walkthroughLoader';
export * from './walkthroughViewport';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/walkthrough/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/walkthrough/
git -c commit.gpgsign=false commit -m "feat(walkthrough): time-boxed findings loader and step viewport maths"
```

---

### Task 5: SVG data attributes and the walkthrough script fixes

**Files:**
- Modify: `src/utils/investigationExport/renderGraphSvg.js`
- Modify: `src/utils/investigationExport/walkthroughScript.js`
- Test: `src/utils/investigationExport/renderGraphSvg.test.js`, `src/utils/investigationExport/walkthroughScript.test.js`

**Interfaces:**
- Produces: each `g.n` carries `data-x`, `data-y`; each `line.l` carries `data-a`, `data-b`; the script reads `window.__SITREP__ = { steps: [{ key, nodeIds, linkKeys, ... }] }` (the new step shape, not the old `{nodeId, name, text, flag}`), and exposes `window.__sitrepShow(index)` for chapter clicks.

- [ ] **Step 1: Add failing tests**

Append to `renderGraphSvg.test.js`:

```js
  it('stamps coordinates on nodes and endpoint ids on links', () => {
    const svg = renderGraphSvg({
      nodes: [{ id: 'a', type: 'company', name: 'A', x: 10, y: 20 }, { id: 'b', type: 'officer', name: 'B', x: 30, y: 40 }],
      links: [{ source: 'a', target: 'b' }],
    });
    expect(svg).toContain('data-id="a" data-x="10" data-y="20"');
    expect(svg).toContain('data-id="b" data-x="30" data-y="40"');
    expect(svg).toContain('<line class="l" data-a="a" data-b="b"');
  });
```

Append to `walkthroughScript.test.js`:

```js
  it('pans to the step, highlights its links, and uses pointer events', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('data-x');
    expect(WALKTHROUGH_SCRIPT).toContain("addEventListener('pointerdown'");
    expect(WALKTHROUGH_SCRIPT).toContain('linkKeys');
    expect(WALKTHROUGH_SCRIPT).toContain('__sitrepShow');
    expect(WALKTHROUGH_SCRIPT).not.toContain("addEventListener('mousedown'");
  });

  it('renders the registry text and the author note as separate blocks', () => {
    expect(WALKTHROUGH_SCRIPT).toContain("'wt-note'");
    expect(WALKTHROUGH_SCRIPT).toContain("'wt-text'");
  });
```

Run: `npx vitest run src/utils/investigationExport/renderGraphSvg.test.js src/utils/investigationExport/walkthroughScript.test.js`
Expected: the new cases FAIL.

- [ ] **Step 2: Update the SVG renderer**

In `renderGraphSvg.js`, change the line builder and the node group opener:

```js
  const lines = (graphData?.links || []).map(l => {
    const a = byId.get(nodeId(endpointId(l.source)));
    const b = byId.get(nodeId(endpointId(l.target)));
    if (!a || !b) return '';
    return `<line class="l" data-a="${escapeHtml(nodeId(a.id))}" data-b="${escapeHtml(nodeId(b.id))}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
  }).join('');
```

and where each group opens (find the existing `<g class="n" data-id="…"` template), make it:

```js
    `<g class="n" data-id="${escapeHtml(id)}" data-x="${n.x}" data-y="${n.y}" data-kind="${isCompany(n) ? 'company' : 'officer'}"${flagAttr}>`
```

keeping whatever `flagAttr` / `data-flag` logic already exists. Run the renderer test until green.

- [ ] **Step 3: Rewrite the walkthrough script**

Replace the body of `WALKTHROUGH_SCRIPT` with:

```js
export const WALKTHROUGH_SCRIPT = `
(function () {
  var data = window.__SITREP__ || { steps: [] };
  var map = document.getElementById('map');
  var viewport = document.getElementById('viewport');
  if (!map) return;

  var panel = document.getElementById('wt-panel');
  var eyebrow = document.getElementById('wt-eyebrow');
  var title = document.getElementById('wt-title');
  var text = document.getElementById('wt-text');
  var note = document.getElementById('wt-note');
  var counter = document.getElementById('wt-counter');
  var idx = -1;

  var tx = 0, ty = 0, scale = 1;
  function apply() {
    if (viewport) viewport.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + scale + ')');
  }
  function vb() { return map.viewBox && map.viewBox.baseVal; }
  function screenToUserScale() {
    var v = vb(); var rect = map.getBoundingClientRect();
    if (!v || !v.width || !v.height || !rect.width || !rect.height) return 1;
    return Math.min(rect.width / v.width, rect.height / v.height);
  }
  function esc(id) { return window.CSS && CSS.escape ? CSS.escape(id) : id; }
  function nodeEl(id) { return map.querySelector('g.n[data-id="' + esc(id) + '"]'); }

  function clearFocus() {
    map.classList.remove('focused');
    Array.prototype.forEach.call(map.querySelectorAll('.on'), function (el) { el.classList.remove('on'); });
  }

  // Centre the step's nodes in the viewBox; fit when there are several.
  function panTo(ids) {
    var v = vb(); if (!v) return;
    var xs = [], ys = [];
    ids.forEach(function (id) {
      var el = nodeEl(id); if (!el) return;
      xs.push(parseFloat(el.getAttribute('data-x'))); ys.push(parseFloat(el.getAttribute('data-y')));
    });
    if (!xs.length) return;
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    var span = Math.max(maxX - minX, maxY - minY, 1);
    scale = xs.length === 1 ? 2 : Math.max(0.5, Math.min(2.5, (Math.min(v.width, v.height) * 0.6) / span));
    tx = v.x + v.width / 2 - cx * scale;
    ty = v.y + v.height / 2 - cy * scale;
    apply();
  }

  function show(i) {
    var step = data.steps[i];
    if (!step) return;
    idx = i;
    clearFocus();
    map.classList.add('focused');
    (step.nodeIds || []).forEach(function (id) { var el = nodeEl(id); if (el) el.classList.add('on'); });
    (step.linkKeys || []).forEach(function (k) {
      var parts = k.split('|');
      var sel = 'line.l[data-a="' + esc(parts[0]) + '"][data-b="' + esc(parts[1]) + '"],' +
                'line.l[data-a="' + esc(parts[1]) + '"][data-b="' + esc(parts[0]) + '"]';
      Array.prototype.forEach.call(map.querySelectorAll(sel), function (el) { el.classList.add('on'); });
    });
    panTo(step.nodeIds || []);
    if (eyebrow) eyebrow.textContent = (step.sectionLabel || '') + (step.sourceLabel ? ' · ' + step.sourceLabel : '') + (step.date ? ' · ' + step.date : '');
    if (title) title.textContent = step.title || '';
    if (text) { text.textContent = step.source === 'author' ? '' : (step.text || ''); text.hidden = !text.textContent; }
    if (note) {
      var n = step.source === 'author' ? { text: step.text, flag: step.flag } : step.authorNote;
      note.textContent = n && n.text ? n.text : '';
      note.hidden = !note.textContent;
      note.setAttribute('data-flag', (n && n.flag) || 'none');
    }
    if (counter) counter.textContent = (i + 1) + ' / ' + data.steps.length;
    if (panel) panel.hidden = false;
    var chapter = document.getElementById('ch-' + i);
    Array.prototype.forEach.call(document.querySelectorAll('.chapter.current'), function (el) { el.classList.remove('current'); });
    if (chapter) chapter.classList.add('current');
  }
  window.__sitrepShow = function (i) {
    show(i);
    var fig = document.getElementById('graph');
    if (fig && fig.scrollIntoView) fig.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  function exit() { idx = -1; clearFocus(); if (panel) panel.hidden = true; }
  function on(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); }
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
  map.addEventListener('click', function (e) {
    var g = e.target.closest ? e.target.closest('g.n') : null;
    if (!g) return;
    var id = g.getAttribute('data-id');
    for (var i = 0; i < data.steps.length; i++) {
      if ((data.steps[i].nodeIds || [])[0] === id) { show(i); return; }
    }
  });

  // Pan and pinch with pointer events — a forwarded file opens on a phone.
  var pointers = new Map(), lastDist = 0, dragging = false, lastX = 0, lastY = 0;
  map.addEventListener('pointerdown', function (e) {
    map.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, e);
    if (pointers.size === 1) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
  });
  map.addEventListener('pointermove', function (e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e);
    if (pointers.size === 2) {
      var pts = Array.from(pointers.values());
      var d = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      if (lastDist) { scale = Math.min(6, Math.max(0.2, scale * (d / lastDist))); apply(); }
      lastDist = d;
      return;
    }
    if (!dragging) return;
    var s = screenToUserScale();
    tx += (e.clientX - lastX) / s; ty += (e.clientY - lastY) / s;
    lastX = e.clientX; lastY = e.clientY;
    apply();
  });
  function up(e) { pointers.delete(e.pointerId); if (pointers.size < 2) lastDist = 0; if (pointers.size === 0) dragging = false; }
  map.addEventListener('pointerup', up);
  map.addEventListener('pointercancel', up);
  map.addEventListener('wheel', function (e) {
    e.preventDefault();
    scale = Math.min(6, Math.max(0.2, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    apply();
  }, { passive: false });
})();
`;
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/utils/investigationExport/`
Expected: `renderGraphSvg` and `walkthroughScript` PASS. `buildExportHtml.test.js` may now fail on ids the template no longer has (`wt-body`); Task 7 rebuilds that template and its tests, so a failure there is expected at this commit only if it references `wt-body`. If it does, skip that single assertion with `it.skip` and a comment `// rebuilt in Task 7`, and unskip in Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/utils/investigationExport/
git -c commit.gpgsign=false commit -m "feat(export): the walkthrough pans to its nodes, lights its links, and works by touch"
```

---

### Task 6: Embedded fonts and the document stylesheet

**Files:**
- Create: `scripts/build-font-module.mjs`
- Create: `src/assets/fonts/IBMPlexSans-Regular-latin.woff2`, `src/assets/fonts/IBMPlexSans-Bold-latin.woff2`, `src/assets/fonts/OFL.txt`, `src/assets/fonts/plexFonts.js` (generated)
- Create: `src/utils/investigationExport/documentStyle.js`
- Test: `src/utils/investigationExport/documentStyle.test.js`

**Interfaces:**
- Produces: `PLEX_SANS_REGULAR_WOFF2_B64`, `PLEX_SANS_BOLD_WOFF2_B64` (strings); `DOCUMENT_STYLE` (string), `FLAG_COLORS` (moved here from `buildExportHtml.js`), `flagVar(flag)`.

- [ ] **Step 1: Subset the fonts (one-off, committed output)**

```bash
python3 -m venv ~/.venvs/fonts && ~/.venvs/fonts/bin/pip install -q fonttools brotli
mkdir -p src/assets/fonts
UNI='U+0000-00FF,U+0100-017F,U+2013-2014,U+2018-201D,U+2026,U+20AC,U+2022'
for W in Regular Bold; do
  ~/.venvs/fonts/bin/pyftsubset ~/ncdata-bormes-impl/fonts/ibm-plex/IBMPlexSans-$W.ttf \
    --unicodes="$UNI" --flavor=woff2 --layout-features='kern,liga' \
    --output-file=src/assets/fonts/IBMPlexSans-$W-latin.woff2
done
cp ~/ncdata-bormes-impl/fonts/ibm-plex/LICENSE.txt src/assets/fonts/OFL.txt
ls -la src/assets/fonts
```

Expected: two woff2 files of roughly 25–45 KB each. (The spec said weights 400 and 600; only Regular and Bold are vendored, so the document uses 400 and 700. Record this in the spec's typography line.)

- [ ] **Step 2: Write the generator and run it**

```js
// scripts/build-font-module.mjs
// Regenerates src/assets/fonts/plexFonts.js from the woff2 subsets, so the
// exported situation report can embed IBM Plex Sans as data: URIs without
// depending on the bundler's asset inlining rules.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'fonts');
const b64 = f => readFileSync(join(dir, f)).toString('base64');

const out = `// GENERATED by scripts/build-font-module.mjs — do not edit.
// IBM Plex Sans, latin subset, SIL Open Font License 1.1 (see OFL.txt).
export const PLEX_SANS_REGULAR_WOFF2_B64 = '${b64('IBMPlexSans-Regular-latin.woff2')}';
export const PLEX_SANS_BOLD_WOFF2_B64 = '${b64('IBMPlexSans-Bold-latin.woff2')}';
`;
writeFileSync(join(dir, 'plexFonts.js'), out);
console.log('wrote plexFonts.js', out.length, 'bytes');
```

Run: `node scripts/build-font-module.mjs`
Expected: `wrote plexFonts.js` under 130000 bytes.

- [ ] **Step 3: Write the failing style test**

```js
// src/utils/investigationExport/documentStyle.test.js
import { describe, expect, it } from 'vitest';
import { DOCUMENT_STYLE, FLAG_COLORS, flagVar } from './documentStyle';

describe('DOCUMENT_STYLE', () => {
  it('embeds both Plex faces as data URIs', () => {
    const faces = DOCUMENT_STYLE.match(/@font-face/g) || [];
    expect(faces).toHaveLength(2);
    expect(DOCUMENT_STYLE).toContain('url(data:font/woff2;base64,');
    expect(DOCUMENT_STYLE).toMatch(/font-weight:\s*400/);
    expect(DOCUMENT_STYLE).toMatch(/font-weight:\s*700/);
  });

  it('carries print rules: A4 page, breaks before chapters and annexes, player hidden', () => {
    expect(DOCUMENT_STYLE).toContain('@page');
    expect(DOCUMENT_STYLE).toContain('@media print');
    expect(DOCUMENT_STYLE).toContain('#walkthrough{page-break-before:always');
    expect(DOCUMENT_STYLE).toContain('#annexes{page-break-before:always');
    expect(DOCUMENT_STYLE).toMatch(/@media print\{[^}]*#wt-panel/);
  });

  it('uses the guide teal as the single accent and no external url', () => {
    expect(DOCUMENT_STYLE).toContain('#0E8178');
    expect(DOCUMENT_STYLE).not.toMatch(/url\(https?:/);
  });

  it('flagVar maps known flags and falls back to none', () => {
    expect(flagVar('red')).toBe(`--f:${FLAG_COLORS.red}`);
    expect(flagVar('bogus')).toBe(`--f:${FLAG_COLORS.none}`);
  });
});
```

Run: `npx vitest run src/utils/investigationExport/documentStyle.test.js`
Expected: FAIL, module missing.

- [ ] **Step 4: Write the stylesheet**

```js
// src/utils/investigationExport/documentStyle.js
// The situation report's stylesheet: screen (light + dark) and print. One
// accent (the user guide's teal), IBM Plex Sans embedded so the file looks the
// same offline and forwarded. No external URL of any kind.
import { PLEX_SANS_REGULAR_WOFF2_B64, PLEX_SANS_BOLD_WOFF2_B64 } from '../../assets/fonts/plexFonts';

export const FLAG_COLORS = Object.freeze({
  red: '#ef4444', amber: '#f59e0b', blue: '#3b82f6', green: '#22c55e', none: '#94a3b8',
});

export const flagVar = flag => `--f:${
  Object.prototype.hasOwnProperty.call(FLAG_COLORS, flag) ? FLAG_COLORS[flag] : FLAG_COLORS.none
}`;

const face = (weight, b64) => `@font-face{font-family:"IBM Plex Sans";font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;

export const DOCUMENT_STYLE = `
${face(400, PLEX_SANS_REGULAR_WOFF2_B64)}
${face(700, PLEX_SANS_BOLD_WOFF2_B64)}
:root{color-scheme:light dark;
--bg:#FBFBFA;--fg:#0B1324;--muted:#58677D;--line:#CCD6E3;--card:#FFFFFF;--soft:#F3F6FA;
--accent:#0E8178;--accent-soft:#E5F6F3;--company:#0E8178;--officer:#64748B;--link:#CBD5E1}
@media (prefers-color-scheme: dark){:root{
--bg:#14161A;--fg:#E8E8E4;--muted:#9A9A94;--line:#2A2D33;--card:#1C1F24;--soft:#181B20;
--accent:#2DD4BF;--accent-soft:#12302C;--company:#2DD4BF;--officer:#94A3B8;--link:#3A3F47}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);
font:15px/1.6 "IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
.wrap{max-width:820px;margin:0 auto;padding:64px 24px 80px}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.eyebrow{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:700}
header.cover{padding-bottom:28px;border-bottom:1px solid var(--line);margin-bottom:32px}
header.cover h1{font-size:2rem;line-height:1.15;margin:8px 0 10px;font-weight:700;letter-spacing:-.01em}
.meta{color:var(--muted);font-size:.88rem}
.status{margin-top:18px;padding:10px 14px;border-left:2px solid var(--line);color:var(--muted);font-size:.86rem}
nav.contents{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 36px;font-size:.86rem}
nav.contents a{color:var(--muted)}nav.contents a b{color:var(--fg);font-weight:600;margin-right:6px}
section{margin:0 0 40px}
h2{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0 0 14px;font-weight:700}
h2 span.num{color:var(--accent);margin-right:8px}
.lead{font-size:1.12rem;line-height:1.55;margin:0}
figure{margin:0}
figure .frame{position:relative;background:var(--card);border:1px solid var(--line);border-radius:8px}
#map{display:block;width:100%;height:520px;cursor:grab;touch-action:none;border-radius:8px}
#map .l{stroke:var(--link);stroke-width:1;transition:opacity .2s}
#map g.n circle{fill:var(--officer)}
#map g.n[data-kind="company"] circle{fill:var(--company)}
#map g.n text{fill:var(--fg);font-size:9px;text-anchor:middle;pointer-events:none}
#map g.n[data-flag] circle{stroke:#ef4444;stroke-width:2.5}
#map g.n[data-flag="amber"] circle{stroke:#f59e0b}
#map.focused g.n{opacity:.16}#map.focused g.n.on{opacity:1}
#map.focused .l{opacity:.12}#map.focused .l.on{opacity:1;stroke:var(--accent);stroke-width:2}
.wt-controls{position:absolute;top:10px;right:10px;display:flex;gap:6px}
figcaption{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:10px;color:var(--muted);font-size:.82rem}
.legend{display:flex;gap:14px;flex-wrap:wrap}
.legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:-1px}
.legend i.co{background:var(--company)}.legend i.of{background:var(--officer)}
.legend i.own{width:18px;height:0;border-top:2px dashed var(--muted);border-radius:0;vertical-align:3px}
.legend i.flag{background:transparent;border:2px solid #ef4444}
#wt-panel{position:sticky;bottom:12px;margin-top:12px;background:var(--card);border:1px solid var(--line);
border-radius:8px;padding:14px 16px;box-shadow:0 6px 24px rgba(0,0,0,.08)}
#wt-title{display:block;font-weight:700;margin:2px 0 4px}
#wt-text{margin:0 0 6px;white-space:pre-line}
#wt-note,.chapter .note{margin:8px 0 0;padding:8px 12px;border-left:3px solid var(--f,#94a3b8);background:var(--soft);
border-radius:0 6px 6px 0;font-size:.92rem;white-space:pre-line}
#wt-note[data-flag="red"]{--f:#ef4444}#wt-note[data-flag="amber"]{--f:#f59e0b}
#wt-note[data-flag="blue"]{--f:#3b82f6}#wt-note[data-flag="green"]{--f:#22c55e}
.wt-nav{display:flex;align-items:center;gap:8px;margin-top:10px}
button{font:inherit;font-size:.86rem;padding:5px 12px;border:1px solid var(--line);border-radius:6px;
background:var(--card);color:var(--fg);cursor:pointer}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.chapters{counter-reset:ch}
.chapter{display:grid;grid-template-columns:44px 1fr;gap:0 16px;padding:16px 0;border-top:1px solid var(--line);page-break-inside:avoid}
.chapter:last-child{border-bottom:1px solid var(--line)}
.chapter.current{background:var(--accent-soft);margin:0 -12px;padding-left:12px;padding-right:12px;border-radius:6px}
.chapter .num{font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums;cursor:pointer}
.chapter .num:hover{text-decoration:underline}
.chapter .head{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
.chapter .head .src{display:inline-block;padding:0 6px;border:1px solid var(--line);border-radius:10px;margin-right:6px;letter-spacing:.04em}
.chapter h3{margin:0 0 4px;font-size:1.02rem}
.chapter p{margin:0;white-space:pre-line}
.chapter .ev{color:var(--muted);font-size:.82rem;margin-top:4px}
.chapter .note .who{display:block;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
.annex{margin-bottom:28px}
table{border-collapse:collapse;width:100%;font-size:.88rem}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700}
td.date{font-variant-numeric:tabular-nums;white-space:nowrap}
.scroll{overflow-x:auto}
ul.plain{list-style:none;padding:0;margin:0}ul.plain li{padding:6px 0;border-bottom:1px solid var(--line)}
footer{margin-top:48px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:.78rem;line-height:1.7}
@page{size:A4;margin:18mm}
@media print{
body{background:#fff;color:#0B1324;font-size:11pt}
.wrap{max-width:none;padding:0}
#wt-panel,.wt-controls,.hide-print{display:none!important}
#map{height:150mm}
#walkthrough{page-break-before:always}
#annexes{page-break-before:always}
.chapter,tr{page-break-inside:avoid}
a{color:inherit}
}
@media (max-width:600px){.wrap{padding:32px 16px 56px}header.cover h1{font-size:1.5rem}#map{height:360px}.chapter{grid-template-columns:32px 1fr}}
`;
```

- [ ] **Step 5: Run the test, then commit**

Run: `npx vitest run src/utils/investigationExport/documentStyle.test.js`
Expected: PASS.

```bash
git add scripts/build-font-module.mjs src/assets/fonts src/utils/investigationExport/documentStyle.js src/utils/investigationExport/documentStyle.test.js
git -c commit.gpgsign=false commit -m "feat(export): document stylesheet with embedded IBM Plex Sans and print rules"
```

---

### Task 7: The document — sections, orchestration, doc model, author persistence

**Files:**
- Create: `src/utils/investigationExport/documentSections.js`
- Create: `src/utils/sitrepAuthor.js`
- Modify: `src/utils/investigationExport/buildExportHtml.js` (rewrite)
- Modify: `src/utils/investigationExport/exportCopy.js`
- Modify: `src/utils/investigationDoc.js`
- Test: `src/utils/investigationExport/documentSections.test.js`, `src/utils/investigationExport/buildExportHtml.test.js`, `src/utils/investigationDoc.test.js`, `src/utils/sitrepAuthor.test.js`, `src/utils/investigationExport/exportCopy.test.js`

**Interfaces:**
- Consumes: Task 5 script (`__SITREP__.steps` with `sectionLabel`, `sourceLabel`), Task 6 style, Task 1 copy for section/source labels.
- Produces:
  - `buildInvestigationDoc({ …existing, steps = [], author = null, coverage = null })` → doc with `steps`, `author: {name, organisation} | null`, `coverage: {since, indexedThrough} | null`.
  - `buildExportHtml(doc, graphData, { lang }) → string` (same signature).
  - `documentSections.js`: `renderCover(doc, t, lang)`, `renderContents(doc, t)`, `renderSummary(doc, t)`, `renderMapFigure(doc, graphData, t)`, `renderChapters(doc, t, wt)`, `renderAnnexes(doc, t)`, `renderFooter(doc, t)` — each `→ string`, empty string when the section has nothing.
  - `sitrepAuthor.js`: `loadSitrepAuthor(storage = localStorage) → {name, organisation}`, `saveSitrepAuthor(author, storage = localStorage)`, `SITREP_AUTHOR_KEY = 'sitrep_author'`.
  - `exportCopy` gains: `contents`, `map`, `mapCaption(n, m, k)`, `walkthroughSection`, `annexes`, `authorNote`, `elaboratedBy`, `coverage(since, through)`, `legendCompany`, `legendPerson`, `legendOwnership`, `legendFlag`, `steps(n)`, `evidenceLabel`.

- [ ] **Step 1: Write the failing tests**

```js
// src/utils/sitrepAuthor.test.js
import { describe, expect, it } from 'vitest';
import { loadSitrepAuthor, saveSitrepAuthor, SITREP_AUTHOR_KEY } from './sitrepAuthor';

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };

describe('sitrepAuthor', () => {
  it('round-trips trimmed fields', () => {
    const s = mem();
    saveSitrepAuthor({ name: '  Ana ', organisation: 'NC ' }, s);
    expect(loadSitrepAuthor(s)).toEqual({ name: 'Ana', organisation: 'NC' });
    expect(JSON.parse(s.getItem(SITREP_AUTHOR_KEY))).toEqual({ name: 'Ana', organisation: 'NC' });
  });
  it('returns blanks on missing, junk, or a throwing storage', () => {
    expect(loadSitrepAuthor(mem())).toEqual({ name: '', organisation: '' });
    const s = mem(); s.setItem(SITREP_AUTHOR_KEY, '{nope');
    expect(loadSitrepAuthor(s)).toEqual({ name: '', organisation: '' });
    expect(loadSitrepAuthor({ getItem() { throw new Error('blocked'); } })).toEqual({ name: '', organisation: '' });
  });
});
```

```js
// src/utils/investigationExport/documentSections.test.js
import { describe, expect, it } from 'vitest';
import { exportCopy } from './exportCopy';
import { walkthroughCopy } from '../walkthrough/walkthroughCopy';
import {
  renderCover, renderContents, renderSummary, renderMapFigure, renderChapters, renderAnnexes, renderFooter,
} from './documentSections';

const t = exportCopy('es');
const wt = walkthroughCopy('es');
const step = (key, extra = {}) => ({ key, section: 'connects', nodeIds: ['o1'], linkKeys: [], title: 'ANA', text: 'ANA ocupa X en A y B', source: 'graph', date: null, evidence: null, flag: null, deepLink: '', authorNote: null, ...extra });
const doc = {
  subject: 'ALFA SL', generatedAt: '2026-09-12T09:00:00.000Z', networkNote: 'Lo que vi',
  author: { name: 'Ana', organisation: 'NC' }, coverage: { since: '2009-01-01', indexedThrough: '2026-09-11' },
  steps: [step('a'), step('b', { source: 'registry', date: '2024-03-11', text: 'Reducción de capital.', authorNote: { text: '<b>ojo</b>', flag: 'amber', origin: 'node' } })],
  flagged: [], companies: [{ nodeId: 'c1', name: 'ALFA SL', note: null }], connectors: [], ownership: [], otherNotes: [],
  corrections: [], counts: { companies: 1, officers: 3, sharedPeople: 0, notes: 1, flagged: 0 },
};

describe('documentSections', () => {
  it('cover shows the author line only when a field is set', () => {
    expect(renderCover(doc, t, 'es')).toContain('Elaborado por Ana · NC');
    expect(renderCover({ ...doc, author: { name: '', organisation: 'NC' } }, t, 'es')).toContain('Elaborado por NC');
    expect(renderCover({ ...doc, author: null }, t, 'es')).not.toContain('Elaborado por');
    expect(renderCover(doc, t, 'es')).not.toMatch(/logo|wordmark/i);
  });

  it('contents anchors every rendered section and skips empty ones', () => {
    const html = renderContents(doc, t);
    expect(html).toContain('href="#summary"');
    expect(html).toContain('href="#walkthrough"');
    expect(html).toContain('href="#annexes"');
    expect(renderContents({ ...doc, networkNote: '' }, t)).not.toContain('href="#summary"');
  });

  it('summary is omitted when empty', () => {
    expect(renderSummary({ ...doc, networkNote: '' }, t)).toBe('');
    expect(renderSummary(doc, t)).toContain('<p class="lead">Lo que vi</p>');
  });

  it('map figure carries legend, caption counts and the walkthrough controls', () => {
    const html = renderMapFigure(doc, { nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 1, y: 2 }], links: [] }, t);
    expect(html).toContain('id="map"');
    expect(html).toContain('class="legend"');
    expect(html).toContain('1 empresas · 3 personas · 0 conexiones compartidas');
    expect(html).toContain('id="wt-start"');
  });

  it('chapters number steps, label section and source, escape the note, and mark two voices', () => {
    const html = renderChapters(doc, t, wt);
    expect(html).toContain('id="ch-0"');
    expect(html).toContain('onclick="__sitrepShow(1)"');
    expect(html).toContain('Quién conecta');
    expect(html).toContain('Registro (BORME)');
    expect(html).toContain('&lt;b&gt;ojo&lt;/b&gt;');
    expect(html).toContain('class="who">Nota del autor');
    expect(html).toContain('2024-03-11');
  });

  it('annexes render only sections with rows', () => {
    const html = renderAnnexes(doc, t);
    expect(html).toContain('id="annexes"');
    expect(html).toContain('ALFA SL');
    expect(html).not.toContain('id="corrections"');
  });

  it('footer carries source, coverage and the site link only', () => {
    const html = renderFooter(doc, t);
    expect(html).toContain('2009');
    expect(html).toContain('2026-09-11');
    expect(html.match(/https?:\/\//g)).toEqual(['https://mapasocietario.es']);
  });
});
```

Rewrite `buildExportHtml.test.js` so it asserts the document (keep any existing escaping test that still applies):

```js
// src/utils/investigationExport/buildExportHtml.test.js
import { describe, expect, it } from 'vitest';
import { buildExportHtml, exportFileName } from './buildExportHtml';

const graphData = { nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 10, y: 10 }], links: [] };
const doc = {
  subject: 'ALFA SL', generatedAt: '2026-09-12T09:00:00.000Z', networkNote: '', author: null, coverage: null,
  steps: [{ key: 'subject:c1', section: 'subject', nodeIds: ['c1'], linkKeys: [], title: 'ALFA SL', text: 'NIF B1', source: 'registry', date: null, evidence: null, flag: null, deepLink: 'https://mapasocietario.es/app?gk=c1&lang=es', authorNote: { text: 'x</script><script>alert(1)', flag: 'red', origin: 'step' } }],
  flagged: [], companies: [{ nodeId: 'c1', name: 'ALFA SL', note: null }], connectors: [], ownership: [], otherNotes: [], corrections: [],
  counts: { companies: 1, officers: 0, sharedPeople: 0, notes: 1, flagged: 0 },
};

describe('buildExportHtml', () => {
  it('is a self-contained document with embedded fonts, steps and labels', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('data:font/woff2;base64,');
    expect(html).toContain('window.__SITREP__=');
    expect(html).toContain('"sectionLabel":"Sujeto"');
    expect(html).toContain('"sourceLabel":"Registro (BORME)"');
    expect(html).not.toContain('</script><script>alert');
    expect(html.match(/https?:\/\/[^"' )]+/g).every(u => u.startsWith('https://mapasocietario.es'))).toBe(true);
    expect(html).not.toMatch(/wordmark|<img/);
  });

  it('stays under 400 KB with a 200-node graph', () => {
    const nodes = Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, type: i % 5 ? 'officer' : 'company', name: `NODE ${i}`, x: i, y: i * 2 }));
    const links = nodes.slice(1).map((n, i) => ({ source: nodes[i].id, target: n.id }));
    expect(buildExportHtml(doc, { nodes, links }, { lang: 'en' }).length).toBeLessThan(400 * 1024);
  });

  it('names the file by language, subject and date', () => {
    expect(exportFileName(doc, 'es')).toBe('Informe_de_situacion_ALFA_SL_20260912');
  });
});
```

(If the existing `exportFileName` test asserts a `.html` suffix keep that expectation; adjust the string accordingly.)

Add to `investigationDoc.test.js`:

```js
  it('carries steps, author and coverage through untouched, defaulting to empty', () => {
    const base = build();
    expect(base.steps).toEqual([]);
    expect(base.author).toBeNull();
    expect(base.coverage).toBeNull();
    const steps = [{ key: 'k' }];
    const doc = build({ steps, author: { name: 'A', organisation: '' }, coverage: { since: '2009-01-01', indexedThrough: '2026-09-11' } });
    expect(doc.steps).toEqual(steps);
    expect(doc.steps).not.toBe(steps);
    expect(doc.author).toEqual({ name: 'A', organisation: '' });
  });
```

Add to `exportCopy.test.js` an assertion that both languages contain the new keys: `contents, map, walkthroughSection, annexes, authorNote, elaboratedBy, legendCompany, legendPerson, legendOwnership, legendFlag, evidenceLabel` and that `mapCaption(1,3,0)` / `coverage('2009-01-01','2026-09-11')` / `steps(7)` are functions returning strings.

Run: `npx vitest run src/utils/investigationExport/ src/utils/investigationDoc.test.js src/utils/sitrepAuthor.test.js`
Expected: the new tests FAIL.

- [ ] **Step 2: `sitrepAuthor.js`**

```js
// src/utils/sitrepAuthor.js
// The author line of the situation report. Describes the person, not the
// investigation, so it lives in localStorage and never in the graph snapshot.
export const SITREP_AUTHOR_KEY = 'sitrep_author';
const BLANK = Object.freeze({ name: '', organisation: '' });
const clean = v => String(v || '').trim().slice(0, 120);

export const loadSitrepAuthor = (storage = globalThis.localStorage) => {
  try {
    const raw = storage?.getItem(SITREP_AUTHOR_KEY);
    if (!raw) return { ...BLANK };
    const p = JSON.parse(raw);
    return { name: clean(p?.name), organisation: clean(p?.organisation) };
  } catch { return { ...BLANK }; }
};

export const saveSitrepAuthor = (author, storage = globalThis.localStorage) => {
  const value = { name: clean(author?.name), organisation: clean(author?.organisation) };
  try { storage?.setItem(SITREP_AUTHOR_KEY, JSON.stringify(value)); } catch { /* storage blocked: the line just stays session-only */ }
  return value;
};
```

- [ ] **Step 3: `exportCopy.js` additions**

Add to `ES`:

```js
  contents: 'Contenido',
  map: 'Mapa',
  mapCaption: (n, m, k) => `${n} empresas · ${m} personas · ${k} conexiones compartidas · disposición del autor`,
  walkthroughSection: 'Recorrido',
  annexes: 'Anexos',
  authorNote: 'Nota del autor',
  elaboratedBy: 'Elaborado por',
  coverage: (since, through) => `BORME indexado desde ${since.slice(0, 4)}${through ? ` hasta ${through}` : ''}`,
  legendCompany: 'Empresa', legendPerson: 'Persona', legendOwnership: 'Socio único', legendFlag: 'Señalado',
  steps: n => `${n} paso${n === 1 ? '' : 's'}`,
  evidenceLabel: 'Evidencia',
```

and the EN equivalents (`Contents`, `Map`, `${n} companies · ${m} people · ${k} shared connections · author's layout`, `Walkthrough`, `Annexes`, `Author's note`, `Prepared by`, `BORME indexed since ${year}${through ? ` through ${through}` : ''}`, `Company`, `Person`, `Sole shareholder`, `Flagged`, `${n} step(s)`, `Evidence`). `EXPORT_COPY_KEYS` is derived from `ES` so it updates itself.

- [ ] **Step 4: `investigationDoc.js`**

Extend the signature and the return:

```js
export function buildInvestigationDoc({
  graphData, scope, networkNote = '', corrections = [], primarySubject = '',
  generatedAt = new Date().toISOString(), steps = [], author = null, coverage = null,
}) {
  // …existing body unchanged…
  return {
    // …existing fields…
    steps: (steps || []).map(s => ({ ...s })),
    author: author && (author.name || author.organisation)
      ? { name: String(author.name || ''), organisation: String(author.organisation || '') } : null,
    coverage: coverage && (coverage.since || coverage.indexedThrough)
      ? { since: String(coverage.since || ''), indexedThrough: String(coverage.indexedThrough || '') } : null,
  };
}
```

- [ ] **Step 5: `documentSections.js`**

```js
// src/utils/investigationExport/documentSections.js
// One pure renderer per section of the situation report. Each returns an HTML
// string, or '' when the section has nothing to say — the orchestrator and the
// contents strip both rely on '' meaning "omit".
import { escapeHtml as esc } from '../escapeHtml';
import { correctionVerb } from './exportCopy';
import { renderGraphSvg } from './renderGraphSvg';
import { flagVar } from './documentStyle';

const SITE = 'https://mapasocietario.es';

const fmtDate = (iso, lang) => new Date(iso).toLocaleDateString(
  lang === 'en' ? 'en-GB' : 'es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

const authorLine = (doc, t) => {
  const parts = [doc.author?.name, doc.author?.organisation].map(v => String(v || '').trim()).filter(Boolean);
  return parts.length ? ` · ${esc(t.elaboratedBy)} ${esc(parts.join(' · '))}` : '';
};

export const renderCover = (doc, t, lang) => `
<header class="cover">
  <div class="eyebrow">${esc(t.title)}</div>
  <h1>${esc(doc.subject || t.title)}</h1>
  <div class="meta">${esc(t.generated)} ${esc(fmtDate(doc.generatedAt, lang))}${authorLine(doc, t)}</div>
  <div class="status">${esc(t.nonAuthoritative)}<br>${esc(t.sourceLine)}</div>
</header>`;

const sectionList = (doc, t) => [
  doc.networkNote ? { id: 'summary', label: t.summaryNote } : null,
  { id: 'graph', label: t.map },
  (doc.steps || []).length ? { id: 'walkthrough', label: `${t.walkthroughSection} · ${t.steps(doc.steps.length)}` } : null,
  { id: 'annexes', label: t.annexes },
].filter(Boolean);

export const renderContents = (doc, t) => `
<nav class="contents" aria-label="${esc(t.contents)}">${sectionList(doc, t)
  .map((s, i) => `<a href="#${s.id}"><b>${i + 1}</b>${esc(s.label)}</a>`).join('')}</nav>`;

export const renderSummary = (doc, t) => (doc.networkNote
  ? `<section id="summary"><h2><span class="num">1</span>${esc(t.summaryNote)}</h2><p class="lead">${esc(doc.networkNote)}</p></section>`
  : '');

export const renderMapFigure = (doc, graphData, t) => {
  const flaggedIds = new Set((doc.steps || []).filter(s => s.source === 'author' && (s.flag === 'red' || s.flag === 'amber')).map(s => s.nodeIds[0]));
  const c = doc.counts || {};
  const num = doc.networkNote ? 2 : 1;
  return `
<section id="graph"><h2><span class="num">${num}</span>${esc(t.map)}</h2>
<figure>
  <div class="frame">
    ${renderGraphSvg(graphData, { flaggedIds })}
    <div class="wt-controls hide-print"><button id="wt-start" class="primary">${esc(t.walkthrough)}</button></div>
  </div>
  <figcaption>
    <span>${esc(t.mapCaption(c.companies || 0, c.officers || 0, c.sharedPeople || 0))}</span>
    <span class="legend"><span><i class="co"></i>${esc(t.legendCompany)}</span><span><i class="of"></i>${esc(t.legendPerson)}</span><span><i class="own"></i>${esc(t.legendOwnership)}</span><span><i class="flag"></i>${esc(t.legendFlag)}</span></span>
  </figcaption>
  <div id="wt-panel" hidden>
    <div id="wt-eyebrow" class="eyebrow"></div>
    <strong id="wt-title"></strong>
    <p id="wt-text"></p>
    <div id="wt-note" hidden></div>
    <div class="wt-nav"><button id="wt-prev">${esc(t.prev)}</button><button id="wt-next">${esc(t.next)}</button><span id="wt-counter" class="meta"></span><span style="flex:1"></span><button id="wt-exit">${esc(t.exit)}</button></div>
  </div>
</figure></section>`;
};

const noteBlock = (note, t, flag) => (note?.text
  ? `<div class="note" style="${flagVar(flag || note.flag || 'none')}"><span class="who">${esc(t.authorNote)}</span>${esc(note.text)}</div>`
  : '');

export const renderChapters = (doc, t, wt) => {
  const steps = doc.steps || [];
  if (!steps.length) return '';
  const num = (doc.networkNote ? 2 : 1) + 1;
  const rows = steps.map((s, i) => {
    const isAuthor = s.source === 'author';
    const head = `<span class="src">${esc(wt.sources[s.source] || s.source)}</span>${esc(wt.sections[s.section] || s.section)}${s.date ? ` · ${esc(s.date)}` : ''}`;
    const body = isAuthor ? '' : `<p>${esc(s.text)}</p>`;
    const ev = s.evidence ? `<div class="ev">${esc(t.evidenceLabel)}: ${esc(s.evidence.kind)} · ${esc(s.evidence.ref)}</div>` : '';
    const note = isAuthor ? noteBlock({ text: s.text }, t, s.flag) : noteBlock(s.authorNote, t);
    return `<div class="chapter" id="ch-${i}"><div class="num" onclick="__sitrepShow(${i})">${String(i + 1).padStart(2, '0')}</div><div><div class="head">${head}</div><h3>${esc(s.title)}</h3>${body}${ev}${note}</div></div>`;
  }).join('');
  return `<section id="walkthrough"><h2><span class="num">${num}</span>${esc(t.walkthroughSection)}</h2><div class="chapters">${rows}</div></section>`;
};

const annex = (id, title, inner) => (inner ? `<div class="annex" id="${id}"><h2>${esc(title)}</h2>${inner}</div>` : '');

export const renderAnnexes = (doc, t) => {
  const companies = (doc.companies || []).map(c => `<li><strong>${esc(c.name)}</strong>${c.note?.text ? noteBlock(c.note, t) : ''}</li>`).join('');
  const connectors = (doc.connectors || []).map(c => `<tr>
    <td>${esc(c.name)} <em>(${c.type === 'entity' ? esc(t.entity) : esc(t.individual)})</em>${c.note?.text ? noteBlock(c.note, t) : ''}</td>
    <td>${(c.companies || []).map(esc).join(', ')}</td><td>${(c.roles || []).map(esc).join(' / ')}</td><td>${esc(t[c.status] || c.status)}</td></tr>`).join('');
  const ownership = (doc.ownership || []).map(o => `<li>${esc(o.owner)} ${esc(o.lost ? t.lostOf : t.soleOf)} ${esc(o.owned)}</li>`).join('');
  const corrections = (doc.corrections || []).map(c => `<li>${esc(c.nameA)} — ${esc(correctionVerb(t, c.action))}${c.nameB ? ` ${esc(c.nameB)}` : ''}${c.resignedDate ? ` <span class="date">(${esc(c.resignedDate)})</span>` : ''}</li>`).join('');
  const num = (doc.networkNote ? 2 : 1) + ((doc.steps || []).length ? 2 : 1);
  return `<section id="annexes"><h2><span class="num">${num}</span>${esc(t.annexes)}</h2>
${annex('companies', t.companies, companies ? `<ul class="plain">${companies}</ul>` : '')}
${annex('connections', t.connections, connectors
    ? `<div class="scroll"><table><thead><tr><th>${esc(t.person)}</th><th>${esc(t.inCompanies)}</th><th>${esc(t.role)}</th><th>${esc(t.status)}</th></tr></thead><tbody>${connectors}</tbody></table></div>`
    : `<p class="meta">${esc(t.none)}</p>`)}
${annex('ownership', t.ownership, ownership ? `<ul class="plain">${ownership}</ul>` : '')}
${annex('corrections', t.corrections, corrections ? `<ul class="plain">${corrections}</ul>` : '')}
</section>`;
};

export const renderFooter = (doc, t) => `
<footer>${esc(t.sourceLine)}${doc.coverage?.since ? `<br>${esc(t.coverage(doc.coverage.since, doc.coverage.indexedThrough))}` : ''}
<br>${esc(t.generated)} ${esc(doc.generatedAt)} · <a href="${SITE}">${esc(t.backLink)}</a></footer>`;
```

- [ ] **Step 6: Rewrite `buildExportHtml.js`**

```js
// src/utils/investigationExport/buildExportHtml.js
// Assembles the situation report into ONE self-contained .html file: inline
// CSS (fonts embedded), inline data, inline script. Opens offline, survives
// being forwarded, prints from the browser. Identity: an authored document,
// sourced by us — never styled as a Mapa Societario deliverable.
import { escapeHtml as esc } from '../escapeHtml';
import { exportCopy } from './exportCopy';
import { walkthroughCopy } from '../walkthrough/walkthroughCopy';
import { DOCUMENT_STYLE } from './documentStyle';
import { WALKTHROUGH_SCRIPT } from './walkthroughScript';
import {
  renderCover, renderContents, renderSummary, renderMapFigure, renderChapters, renderAnnexes, renderFooter,
} from './documentSections';

export function buildExportHtml(doc, graphData, { lang = 'es' } = {}) {
  const t = exportCopy(lang);
  const wt = walkthroughCopy(lang);
  const steps = (doc.steps || []).map(s => ({
    key: s.key, section: s.section, nodeIds: s.nodeIds, linkKeys: s.linkKeys || [],
    title: s.title, text: s.text, source: s.source, date: s.date, flag: s.flag,
    authorNote: s.authorNote ? { text: s.authorNote.text, flag: s.authorNote.flag } : null,
    sectionLabel: wt.sections[s.section] || s.section,
    sourceLabel: wt.sources[s.source] || s.source,
  }));
  // JSON is embedded as text, so "</script>" inside a note would close the tag.
  const stepJson = JSON.stringify({ steps }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'es'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(t.title)}${doc.subject ? ` — ${esc(doc.subject)}` : ''}</title>
<style>${DOCUMENT_STYLE}</style>
</head>
<body>
<div class="wrap">
${renderCover(doc, t, lang)}
${renderContents(doc, t)}
${renderSummary(doc, t)}
${renderMapFigure(doc, graphData, t)}
${renderChapters(doc, t, wt)}
${renderAnnexes(doc, t)}
${renderFooter(doc, t)}
</div>
<script>window.__SITREP__=${stepJson};</script>
<script>${WALKTHROUGH_SCRIPT}</script>
</body>
</html>`;
}

export function exportFileName(doc, lang = 'es') {
  // unchanged from the current implementation
}
```

Keep the existing `exportFileName` body verbatim. Delete `FLAG_COLORS`, `STYLE`, `flagVar`, `noteBlock`, `section`, `correctionLine` from this file (they moved to `documentStyle.js` / `documentSections.js`). Update `index.js` in the folder if it re-exports any of them.

- [ ] **Step 7: Run all export tests, then the full suite**

Run: `npx vitest run src/utils/investigationExport/ src/utils/investigationDoc.test.js src/utils/sitrepAuthor.test.js`
Expected: PASS. Then `npm test` — PASS. If `relationshipReportHtml.js` (Copy for Word) imported `correctionVerb` from `exportCopy` it is unaffected; if it imported anything from `buildExportHtml`, point it at the new module.

- [ ] **Step 8: Commit**

```bash
git add src/utils/investigationExport/ src/utils/investigationDoc.js src/utils/investigationDoc.test.js src/utils/sitrepAuthor.js src/utils/sitrepAuthor.test.js
git -c commit.gpgsign=false commit -m "feat(export): the situation report is an authored document — cover, contents, map figure, chapters, annexes"
```

---

### Task 8: `useWalkthrough` hook

**Files:**
- Create: `src/hooks/useWalkthrough.js`
- Create: `src/hooks/walkthroughState.js` (pure reducer, tested)
- Test: `src/hooks/walkthroughState.test.js`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces: `useWalkthrough({ graphData, scope, primarySubjectId, lang, fetchFindings, edits, setEdits, onTrack })` returning
  `{ status: 'idle'|'preparing'|'playing', steps, draft, index, current, findingsByKey, prepare(), start(), next(), prev(), goTo(i), exit(), hide(key), setNote(key, text), move(key, delta), reset(), tourNodeIds: Set, tourLinkKeys: Set, coverage }`.
- Pure reducer in `walkthroughState.js`: `initialWalkthroughState`, `walkthroughReducer(state, action)` with actions `{type:'prepare'}`, `{type:'ready', findingsByKey}`, `{type:'start'}`, `{type:'goto', index, total}`, `{type:'exit'}`; and `focusSets(step) → {tourNodeIds, tourLinkKeys}`.

- [ ] **Step 1: Write the failing reducer test**

```js
// src/hooks/walkthroughState.test.js
import { describe, expect, it } from 'vitest';
import { initialWalkthroughState, walkthroughReducer, focusSets } from './walkthroughState';

describe('walkthroughReducer', () => {
  it('moves idle → preparing → playing and clamps navigation', () => {
    let s = walkthroughReducer(initialWalkthroughState, { type: 'prepare' });
    expect(s.status).toBe('preparing');
    s = walkthroughReducer(s, { type: 'ready', findingsByKey: new Map([['a', null]]) });
    expect(s.status).toBe('idle');
    expect(s.findingsByKey.get('a')).toBeNull();
    s = walkthroughReducer(s, { type: 'start' });
    expect(s).toMatchObject({ status: 'playing', index: 0 });
    s = walkthroughReducer(s, { type: 'goto', index: 5, total: 3 });
    expect(s.index).toBe(2);
    s = walkthroughReducer(s, { type: 'goto', index: -4, total: 3 });
    expect(s.index).toBe(0);
    s = walkthroughReducer(s, { type: 'exit' });
    expect(s).toMatchObject({ status: 'idle', index: -1 });
  });

  it('focusSets exposes node ids and link keys as Sets', () => {
    const f = focusSets({ nodeIds: ['a', 'b'], linkKeys: ['a|b'] });
    expect(f.tourNodeIds.has('b')).toBe(true);
    expect(f.tourLinkKeys.has('a|b')).toBe(true);
    expect(focusSets(null).tourNodeIds.size).toBe(0);
  });
});
```

Run: `npx vitest run src/hooks/walkthroughState.test.js` → FAIL.

- [ ] **Step 2: Write the reducer and the hook**

```js
// src/hooks/walkthroughState.js
export const initialWalkthroughState = Object.freeze({
  status: 'idle', index: -1, findingsByKey: new Map(),
});

export function walkthroughReducer(state, action) {
  switch (action.type) {
    case 'prepare': return { ...state, status: 'preparing' };
    case 'ready': return { ...state, status: 'idle', findingsByKey: action.findingsByKey || new Map() };
    case 'start': return { ...state, status: 'playing', index: 0 };
    case 'goto': {
      const max = Math.max(0, (action.total || 0) - 1);
      return { ...state, index: Math.min(max, Math.max(0, action.index)) };
    }
    case 'exit': return { ...state, status: 'idle', index: -1 };
    default: return state;
  }
}

export const focusSets = step => ({
  tourNodeIds: new Set(step?.nodeIds || []),
  tourLinkKeys: new Set(step?.linkKeys || []),
});
```

```js
// src/hooks/useWalkthrough.js
// Owns the drafted walkthrough: loading findings, the merged step list, play
// position and the focus sets the canvas reads. The graph component only wires
// props in and reads state out.
import { useCallback, useMemo, useReducer } from 'react';
import {
  draftWalkthrough, subjectCompanyIds, applyWalkthroughEdits, hideStep, setStepNote, moveStep,
  EMPTY_WALKTHROUGH_EDITS, loadFindingsForSubjects,
} from '../utils/walkthrough';
import { initialWalkthroughState, walkthroughReducer, focusSets } from './walkthroughState';

const nid = id => (id == null ? '' : String(id));

export function useWalkthrough({ graphData, scope, primarySubjectId, lang, fetchFindings, edits, setEdits, onTrack }) {
  const [state, dispatch] = useReducer(walkthroughReducer, initialWalkthroughState);

  const nodesById = useMemo(
    () => new Map((graphData?.nodes || []).map(n => [nid(n.id), n])), [graphData]);

  const draft = useMemo(() => draftWalkthrough({
    graphData, scope, findingsByKey: state.findingsByKey, primarySubjectId, lang,
  }), [graphData, scope, state.findingsByKey, primarySubjectId, lang]);

  const steps = useMemo(() => applyWalkthroughEdits(draft, edits), [draft, edits]);
  const current = state.status === 'playing' ? steps[state.index] || null : null;
  const focus = useMemo(() => focusSets(current), [current]);

  const subjectIds = useMemo(() => subjectCompanyIds(scope, primarySubjectId), [scope, primarySubjectId]);
  const coverage = useMemo(() => {
    const p = state.findingsByKey.get(subjectIds[0]);
    return p?.coverage ? { since: p.coverage.since, indexedThrough: p.coverage.indexed_through } : null;
  }, [state.findingsByKey, subjectIds]);

  const prepare = useCallback(async () => {
    dispatch({ type: 'prepare' });
    const findingsByKey = await loadFindingsForSubjects({ subjectIds, nodesById, fetchFindings, lang });
    dispatch({ type: 'ready', findingsByKey });
    return findingsByKey;
  }, [subjectIds, nodesById, fetchFindings, lang]);

  const start = useCallback(async () => {
    await prepare();
    dispatch({ type: 'start' });
    onTrack?.('walkthrough_start');
  }, [prepare, onTrack]);

  const goTo = useCallback(i => {
    dispatch({ type: 'goto', index: i, total: steps.length });
    const s = steps[Math.min(steps.length - 1, Math.max(0, i))];
    onTrack?.('walkthrough_step', { section: s?.section || '' });
    if (i >= steps.length - 1) onTrack?.('walkthrough_complete');
  }, [steps, onTrack]);
  const next = useCallback(() => goTo(state.index + 1), [goTo, state.index]);
  const prev = useCallback(() => goTo(state.index - 1), [goTo, state.index]);
  const exit = useCallback(() => dispatch({ type: 'exit' }), []);

  const hide = useCallback(key => { setEdits(e => hideStep(e, key)); onTrack?.('walkthrough_step_hidden'); }, [setEdits, onTrack]);
  const setNote = useCallback((key, text) => { setEdits(e => setStepNote(e, key, text)); onTrack?.('walkthrough_note_saved'); }, [setEdits, onTrack]);
  const move = useCallback((key, delta) => setEdits(e => moveStep(e, steps.map(s => s.key), key, delta)), [setEdits, steps]);
  const reset = useCallback(() => { setEdits(() => ({ ...EMPTY_WALKTHROUGH_EDITS, hidden: [], order: [], notes: {} })); onTrack?.('walkthrough_reset'); }, [setEdits, onTrack]);

  return {
    status: state.status, steps, draft, index: state.index, current, findingsByKey: state.findingsByKey,
    prepare, start, next, prev, goTo, exit, hide, setNote, move, reset, coverage, ...focus,
  };
}
```

- [ ] **Step 3: Run the reducer test, then `npm run build`**

Run: `npx vitest run src/hooks/walkthroughState.test.js` → PASS. Run `npm run build` → completes (the hook is not imported yet, so this only checks syntax via the bundler's module graph if imported; if not, run `node --check` is not applicable to JSX — rely on Task 10's build).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWalkthrough.js src/hooks/walkthroughState.js src/hooks/walkthroughState.test.js
git -c commit.gpgsign=false commit -m "feat(walkthrough): hook owning loading, play position and canvas focus sets"
```

---

### Task 9: `WalkthroughPlayer` card

**Files:**
- Create: `src/components/WalkthroughPlayer.jsx`

**Interfaces:**
- Props: `{ open, step, index, total, lang, compact, onPrev, onNext, onExit, onHide, onNote, onEvidence }`. `onNote(stepKey, text)` is called on blur with the field's value; `onEvidence(step)` only when `step.evidence` or `step.section === 'connects'`.

- [ ] **Step 1: Write the component**

```jsx
// src/components/WalkthroughPlayer.jsx
// The docked card of the live walkthrough. Reads one step, writes one note.
// Reordering lives in the situation-report modal, not here.
import React, { useEffect, useState } from 'react';
import { Box, Button, Chip, IconButton, Paper, TextField, Tooltip, Typography } from '@mui/material';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CloseIcon from '@mui/icons-material/Close';
import { walkthroughCopy } from '../utils/walkthrough/walkthroughCopy';
import { NODE_NOTE_FLAGS, NODE_NOTE_MAX_LENGTH } from '../utils/nodeNotes';

export default function WalkthroughPlayer({
  open, step, index, total, lang = 'es', compact = false,
  onPrev, onNext, onExit, onHide, onNote, onEvidence,
}) {
  const t = walkthroughCopy(lang);
  const [note, setNote] = useState('');
  useEffect(() => {
    const initial = step?.source === 'author' ? step.text : (step?.authorNote?.text || '');
    setNote(initial);
  }, [step?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight') onNext?.();
      if (e.key === 'ArrowLeft') onPrev?.();
      if (e.key === 'Escape') onExit?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onNext, onPrev, onExit]);

  if (!open || !step) return null;
  const isAuthor = step.source === 'author';
  const flagColor = NODE_NOTE_FLAGS[isAuthor ? step.flag : step.authorNote?.flag] || null;
  const canEvidence = !!onEvidence && (!!step.evidence || step.section === 'connects' || step.section === 'subject');

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'absolute', left: compact ? 0 : 16, right: compact ? 0 : 16, bottom: compact ? 0 : 16,
        zIndex: 20, p: 2, borderRadius: compact ? '12px 12px 0 0' : 2,
        borderLeft: flagColor ? `4px solid ${flagColor}` : undefined, maxHeight: '45%', overflow: 'auto',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700, lineHeight: 1.6 }}>
          {t.sections[step.section]}
        </Typography>
        <Chip size="small" variant="outlined" label={t.sources[step.source]} sx={{ height: 20, fontSize: '0.7rem' }} />
        {step.date && <Typography variant="caption" color="text.secondary">{step.date}</Typography>}
        <Box sx={{ flex: 1 }} />
        <Tooltip title={t.hideStep}><IconButton size="small" onClick={() => onHide?.(step.key)}><VisibilityOffIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title={t.exit}><IconButton size="small" onClick={onExit}><CloseIcon fontSize="small" /></IconButton></Tooltip>
      </Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{step.title}</Typography>
      {!isAuthor && (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mb: 1 }}>{step.text}</Typography>
      )}
      {canEvidence && (
        <Button size="small" onClick={() => onEvidence(step)} sx={{ textTransform: 'none', px: 0, mb: 1 }}>{t.evidence} →</Button>
      )}
      <TextField
        fullWidth size="small" multiline minRows={1} maxRows={4}
        label={t.noteField} value={note}
        onChange={e => setNote(e.target.value.slice(0, NODE_NOTE_MAX_LENGTH))}
        onBlur={() => onNote?.(step.key, note)}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
        <Button size="small" variant="outlined" onClick={onPrev} disabled={index <= 0} sx={{ textTransform: 'none' }}>{t.prev}</Button>
        <Button size="small" variant="contained" onClick={onNext} disabled={index >= total - 1} sx={{ textTransform: 'none' }}>{t.next}</Button>
        <Typography variant="caption" color="text.secondary">{index + 1} / {total}</Typography>
      </Box>
    </Paper>
  );
}
```

- [ ] **Step 2: Commit** (verified by the build in Task 10)

```bash
git add src/components/WalkthroughPlayer.jsx
git -c commit.gpgsign=false commit -m "feat(walkthrough): the docked player card"
```

---

### Task 10: Graph component wiring

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` — imports (top), `SEARCH_COPY` (~:292 EN, ~:662 ES), state near `networkNote` (~:1711), hook after `relationshipDetailedScope` (~:7192), node canvas alpha (~:7449), link canvas alpha (~:7829), snapshot context (~:8404), restore (~:8547), toolbar (~:9269), player render next to the modal (~:11928), `relDoc` (~:7230), `trackGraphToolbarAction` (~:1643).

**Interfaces:**
- Consumes: Tasks 8, 9, 7 (`buildInvestigationDoc` new params), `openDataPreview(node)`, `openOfficerTimeline(node)`, `fgRef`, `PATH_DIM_ALPHA`, `PATH_HIGHLIGHT_COLOR`, `isCompactViewport`, `spanishCompaniesService.getCompanyFindings`.
- Produces: `walkthroughEdits` in snapshot `context`; `walkthrough` object passed to the modal in Task 11 (`steps`, `hide`, `move`, `setNote`, `reset`, `coverage`, `goTo`, `start`).

- [ ] **Step 1: Imports and copy**

At the top:

```js
import { useWalkthrough } from '../hooks/useWalkthrough';
import WalkthroughPlayer from './WalkthroughPlayer';
import { EMPTY_WALKTHROUGH_EDITS, normalizeWalkthroughEdits, walkthroughCopy, stepViewport } from '../utils/walkthrough';
import { loadSitrepAuthor, saveSitrepAuthor } from '../utils/sitrepAuthor';
```

No new keys in `SEARCH_COPY`: the button uses `walkthroughCopy(uiLanguage).button / .tooltip / .preparing`.

- [ ] **Step 2: Tracking with params**

Change `trackGraphToolbarAction` to accept extras:

```js
  const trackGraphToolbarAction = useCallback(
    (action, extra = {}) => {
      trackEvent('graph_toolbar_action', { ...graphInteractionParams(), toolbar_action: action, ...extra });
    },
    [graphInteractionParams]
  );
```

- [ ] **Step 3: State**

Next to `const [networkNote, setNetworkNote] = useState('');`:

```js
  const [walkthroughEdits, setWalkthroughEdits] = useState(EMPTY_WALKTHROUGH_EDITS);
  const [sitrepAuthor, setSitrepAuthor] = useState(() => loadSitrepAuthor());
  const updateSitrepAuthor = useCallback(next => setSitrepAuthor(saveSitrepAuthor(next)), []);
```

- [ ] **Step 4: Hook, after `relationshipDetailedScope`**

```js
  const primarySubjectNodeId = React.useMemo(() => {
    if (!primarySubject) return null;
    const n = (filteredGraphData.nodes || []).find(
      x => (x.type === 'spanish-company-group' || x.type === 'company') && x.name?.toUpperCase() === primarySubject.toUpperCase());
    return n ? normalizeNodeId(n.id) : null;
  }, [filteredGraphData.nodes, primarySubject]);

  const fetchFindings = useCallback(
    ({ groupKey, name, lang }) => spanishCompaniesService.getCompanyFindings({ groupKey, name, lang }), []);

  const walkthrough = useWalkthrough({
    graphData: filteredGraphData, scope: relationshipDetailedScope, primarySubjectId: primarySubjectNodeId,
    lang: uiLanguage, fetchFindings, edits: walkthroughEdits, setEdits: setWalkthroughEdits,
    onTrack: trackGraphToolbarAction,
  });
  const tourActive = walkthrough.status === 'playing';
  const { tourNodeIds, tourLinkKeys } = walkthrough;

  // Camera follows the current step.
  useEffect(() => {
    if (!tourActive || !walkthrough.current || !fgRef.current) return;
    const nodesById = new Map((filteredGraphData.nodes || []).map(n => [normalizeNodeId(n.id), n]));
    const el = graphContainerRef.current;               // the existing container ref; use whatever ref wraps <ForceGraph2D>
    const v = stepViewport(walkthrough.current, nodesById, {
      width: el?.clientWidth || 800, height: el?.clientHeight || 600,
    });
    if (!v) return;
    fgRef.current.centerAt(v.x, v.y, 500);
    fgRef.current.zoom(v.k, 500);
  }, [tourActive, walkthrough.current, filteredGraphData.nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const walkthroughEvidence = useCallback(step => {
    const node = (filteredGraphData.nodes || []).find(n => normalizeNodeId(n.id) === step.nodeIds[0]);
    if (!node) return;
    if (node.type === 'officer') openOfficerTimeline(node); else openDataPreview(node);
  }, [filteredGraphData.nodes, openOfficerTimeline, openDataPreview]);
```

If there is no container ref, add `const graphContainerRef = useRef(null)` and put `ref={graphContainerRef}` on the `Box` that wraps `<ForceGraph2D …>` (it must be `position: relative` so the player can dock inside it — check and set `sx={{ position: 'relative' }}` if missing).

Because `openOfficerTimeline` and `openDataPreview` are declared far below the scope memo, declare `walkthroughEvidence` right after `openDataPreview` (~:6120) instead if the linter flags a temporal dead zone.

- [ ] **Step 5: Canvas dimming**

Node callback: replace the pathfinder alpha block with

```js
      if (tourActive) {
        ctx.globalAlpha = tourNodeIds.has(normalizeNodeId(node.id)) ? 1.0 : PATH_DIM_ALPHA;
      } else if (pathfinderActive && shortestPathNodes.size > 0) {
        ctx.globalAlpha = inPath ? 1.0 : PATH_DIM_ALPHA;
      } else if (sharedHighlightIds) {
        ctx.globalAlpha = isSharedConnector ? 1.0 : PATH_DIM_ALPHA;
      } else {
        ctx.globalAlpha = 1.0;
      }
```

and add `tourActive, tourNodeIds` to that callback's dependency array.

Link callback: compute once near the top of the callback

```js
      const sId = normalizeNodeId(getNodeIdFromRef(link.source));
      const tId = normalizeNodeId(getNodeIdFromRef(link.target));
      const tourKey = sId < tId ? `${sId}|${tId}` : `${tId}|${sId}`;
      const inTour = tourActive && tourLinkKeys.has(tourKey);
```

(`getNodeIdFromRef` already exists in the file; if the callback already derives `sourceId`/`targetId`, reuse them.) Then:

```js
      if (tourActive) {
        ctx.globalAlpha = inTour ? 0.95 : PATH_DIM_ALPHA;
        if (inTour) linkColor = PATH_HIGHLIGHT_COLOR;
      } else if (pathfinderActive && shortestPathNodes.size > 0) {
```

and add `tourActive, tourLinkKeys` to its dependency array.

- [ ] **Step 6: Snapshot**

In `buildCurrentGraphSnapshot`: `context: { primarySubject, networkNote, walkthroughEdits }` and add `walkthroughEdits` to its deps. In the restore path next to `setNetworkNote(...)`:

```js
    setWalkthroughEdits(normalizeWalkthroughEdits(snapshot.context?.walkthroughEdits));
```

Also reset edits wherever `setNetworkNote('')` is called on clear-graph.

- [ ] **Step 7: Toolbar button**

Immediately after the situation-report `</Tooltip>` block (`visibleCompanyCount >= 1`):

```jsx
        {visibleCompanyCount >= 1 && (
          <Tooltip title={walkthroughCopy(uiLanguage).tooltip}>
            <span>
              <Button
                variant={tourActive ? 'contained' : 'outlined'} color="primary" size="small"
                startIcon={walkthrough.status === 'preparing' ? <CircularProgress size={14} color="inherit" /> : <RouteIcon />}
                disabled={walkthrough.status === 'preparing'}
                sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
                onClick={() => (tourActive ? walkthrough.exit() : walkthrough.start())}>
                {walkthrough.status === 'preparing' ? walkthroughCopy(uiLanguage).preparing : walkthroughCopy(uiLanguage).button}
              </Button>
            </span>
          </Tooltip>
        )}
```

Import `RouteIcon from '@mui/icons-material/Route'` and `CircularProgress` from MUI if not already imported.

- [ ] **Step 8: Player render and modal props**

Inside the graph container `Box` (so `position:absolute` docks to the canvas), after `<ForceGraph2D …/>`:

```jsx
          <WalkthroughPlayer
            open={tourActive}
            step={walkthrough.current}
            index={walkthrough.index}
            total={walkthrough.steps.length}
            lang={uiLanguage}
            compact={isCompactViewport}
            onPrev={walkthrough.prev}
            onNext={walkthrough.next}
            onExit={walkthrough.exit}
            onHide={key => { walkthrough.hide(key); if (walkthrough.index >= walkthrough.steps.length - 1) walkthrough.prev(); }}
            onNote={(key, text) => {
              const step = walkthrough.current;
              if (step?.source === 'author') { handleSaveNodeNoteFor(step.nodeIds[0], text, step.flag); return; }
              walkthrough.setNote(key, text);
            }}
            onEvidence={walkthroughEvidence}
          />
```

For `handleSaveNodeNoteFor`, add next to the existing note-save handler (~:5730):

```js
  const handleSaveNodeNoteFor = useCallback((nodeId, text, flag) => {
    const now = new Date().toISOString();
    setGraphData(prev => (text.trim() ? setNodeNote(prev, nodeId, { text, flag }, now) : removeNodeNote(prev, nodeId)));
    trackGraphToolbarAction(text.trim() ? 'node_note_saved' : 'node_note_removed');
  }, [trackGraphToolbarAction]);
```

(`setNodeNote` / `removeNodeNote` are already imported for the context-menu path; reuse them.)

`relDoc`:

```js
    return buildInvestigationDoc({
      graphData: filteredGraphData, scope: relationshipDetailedScope, networkNote,
      corrections: relCorrections, primarySubject: subjectCompanyName || '',
      generatedAt: relGeneratedAt || new Date().toISOString(),
      steps: walkthrough.steps, author: sitrepAuthor, coverage: walkthrough.coverage,
    });
```

with `walkthrough.steps, sitrepAuthor, walkthrough.coverage` added to the memo deps. Also make `openRelationshipReport` call `walkthrough.prepare()` before opening (so the modal's list has findings): `await walkthrough.prepare(); setRelGeneratedAt(...); setRelReportOpen(true);`.

Pass to the modal:

```jsx
          walkthrough={walkthrough}
          author={sitrepAuthor}
          onAuthorChange={updateSitrepAuthor}
```

- [ ] **Step 9: Build and lint**

Run: `npm run build` → completes with no errors. Run `npx eslint src/components/SpanishCompanyNetworkGraph.jsx src/hooks src/components/WalkthroughPlayer.jsx` if the repo has eslint configured (check `package.json` scripts; skip if absent). Run `npm test` → PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/SpanishCompanyNetworkGraph.jsx
git -c commit.gpgsign=false commit -m "feat(graph): Recorrido button, camera follow, canvas focus and the docked player"
```

---

### Task 11: Situation report modal — Recorrido list, author fields, preview tab

**Files:**
- Modify: `src/components/RelationshipReportModal.jsx`

**Interfaces:**
- Consumes: `walkthrough` (`steps`, `hide`, `move`, `setNote`, `reset`, `goTo`, `start`), `author`, `onAuthorChange`, Task 1 copy, `editsCounts` from Task 3.

- [ ] **Step 1: Props and tabs**

Add props `walkthrough = null, author = { name: '', organisation: '' }, onAuthorChange = () => {}`. Add `const [tab, setTab] = useState('edit')` reset to `'edit'` on open. Import `Tabs, Tab, IconButton` from MUI, `ArrowUpwardIcon`, `ArrowDownwardIcon`, `VisibilityOffIcon`, and `walkthroughCopy` plus `editsCounts`.

Replace the `DialogContent` opening so it becomes:

```jsx
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3 }}>
        <Tab value="edit" label={wt.edit} sx={{ textTransform: 'none' }} />
        <Tab value="preview" label={wt.preview} sx={{ textTransform: 'none' }} onClick={() => onPreview?.()} />
      </Tabs>
      <DialogContent dividers sx={tab === 'preview' ? { p: 0, height: '70vh' } : undefined}>
        {tab === 'preview' ? (
          <iframe
            title={t.title}
            srcDoc={buildExportHtml(doc, graphData, { lang: es ? 'es' : 'en' })}
            style={{ width: '100%', height: '100%', border: 0, background: '#fff' }}
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <>
            {/* existing summary TextField stays first */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField size="small" label={wt.authorField} value={author.name}
                onChange={e => onAuthorChange({ ...author, name: e.target.value })} sx={{ flex: 1 }} />
              <TextField size="small" label={wt.organisationField} value={author.organisation}
                onChange={e => onAuthorChange({ ...author, organisation: e.target.value })} sx={{ flex: 1 }} />
            </Box>
            {/* counts line stays */}
            {steps.length > 0 && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>{wt.sections && t.walkthroughSection}</Typography>
                  <Button size="small" onClick={() => {
                    const c = editsCounts(edits);
                    if (window.confirm(wt.resetConfirm(c.hidden, c.notes))) walkthrough.reset();
                  }} sx={{ textTransform: 'none' }}>{wt.reset}</Button>
                </Box>
                {steps.map((s, i) => (
                  <Box key={s.key} sx={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 1, py: 0.75, borderTop: '1px solid', borderColor: 'divider', alignItems: 'start' }}>
                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, pt: 0.5 }}>{String(i + 1).padStart(2, '0')}</Typography>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {wt.sections[s.section]} · {wt.sources[s.source]}{s.date ? ` · ${s.date}` : ''}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.title}</Typography>
                      {s.source !== 'author' && <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{s.text}</Typography>}
                      <TextField
                        size="small" fullWidth multiline maxRows={3} variant="standard" label={wt.noteField}
                        defaultValue={s.source === 'author' ? s.text : (s.authorNote?.text || '')}
                        disabled={s.source === 'author'}
                        onBlur={e => walkthrough.setNote(s.key, e.target.value)}
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex' }}>
                      <IconButton size="small" disabled={i === 0} onClick={() => walkthrough.move(s.key, -1)} title={wt.moveUp}><ArrowUpwardIcon fontSize="inherit" /></IconButton>
                      <IconButton size="small" disabled={i === steps.length - 1} onClick={() => walkthrough.move(s.key, 1)} title={wt.moveDown}><ArrowDownwardIcon fontSize="inherit" /></IconButton>
                      <IconButton size="small" onClick={() => walkthrough.hide(s.key)} title={wt.hideStep}><VisibilityOffIcon fontSize="inherit" /></IconButton>
                    </Box>
                  </Box>
                ))}
              </>
            )}
            {/* existing companies / connections / ownership / other notes / corrections blocks stay; DELETE the old "Señalado" block */}
          </>
        )}
      </DialogContent>
```

Where `wt = walkthroughCopy(es ? 'es' : 'en')`, `steps = walkthrough?.steps || []`, `edits` is read from a new prop `edits` (pass `walkthroughEdits` from the graph as `edits={walkthroughEdits}`), and `onPreview` is a new prop the graph passes as `() => trackGraphToolbarAction('walkthrough_preview')`. The author-source step's note field is disabled here: that note is the node note and is edited in the player or the context menu (one owner per fact).

Note on `window.confirm`: browser dialogs are fine in the app, but never trigger one from automated browser checks. The reset is only reachable by a click.

- [ ] **Step 2: Build, test, commit**

Run: `npm run build` → no errors. `npm test` → PASS.

```bash
git add src/components/RelationshipReportModal.jsx src/components/SpanishCompanyNetworkGraph.jsx
git -c commit.gpgsign=false commit -m "feat(sitrep): the Recorrido list, author line and an exact preview of the document"
```

---

### Task 12: Live verification

**Files:** none (verification only; fix-ups get their own small commits)

- [ ] **Step 1: Run the dev server**

`npm run dev` (or the project's usual local run; see the `run` skill / memory `env_local_pages_dev` if the API needs the proxy). Open `/app`.

- [ ] **Step 2: Wide graph**

Search `INDITEX` (the listed entity pins first), expand one director to a second company. Press `Recorrido`. Check: spinner ≤ ~4 s; camera moves to the subject; card shows Sujeto with NIF; arrow keys step; the connects step lights both companies and the two edges; typing a note and blurring persists (open the modal: the note is on that step); hide a step and confirm it is gone from the modal list and the count; move a step with the arrows and confirm the player order changes on the next start; Restablecer borrador asks and clears.

- [ ] **Step 3: Small SL**

Search a small company with one or two officers and no second company. Recorrido yields subject + stands-out/unseen only, no empty sections, no errors in the console (`read_console_messages` pattern `walkthrough|findings`).

- [ ] **Step 4: Export**

Fill author and organisation, open Vista previa, then Download. Open the file from disk: fonts render as Plex (compare against system sans), contents anchors work, chapter number click pans the map and scrolls, the author note shows under the registry text with the bar, print preview (Cmd-P) shows A4 with breaks before Recorrido and Anexos and no player. Open the same file on a phone (AirDrop/WhatsApp): drag pans, pinch zooms, Recorrido plays.

- [ ] **Step 5: Regressions**

Pathfinder and shared-connections highlights still work when the tour is not active. Import an old snapshot (one saved before this change) — no error, no edits. Save and re-import a new snapshot — edits survive.

- [ ] **Step 6: Record**

Update the spec's Status line to `implemented 2026-09-xx` and note the two deviations (weights 400/700; player verified live rather than by component test). Commit:

```bash
git add docs/superpowers/specs/2026-09-12-drafted-walkthrough-design.md
git -c commit.gpgsign=false commit -m "docs(spec): drafted walkthrough implemented; record the two deviations"
```

Then the usual finishing flow (branch, PR, deploy is via GitHub Action on push to main — never local wrangler, per `project_local_branch_testing`).
