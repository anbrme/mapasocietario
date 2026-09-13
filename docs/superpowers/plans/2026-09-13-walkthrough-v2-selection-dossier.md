# Walkthrough v2 (Selection Dossier) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The walkthrough becomes the author's Cmd/Ctrl+click selection told in order; each step carries the author's note as narrative plus a sourced evidence block; the exported file becomes a dossier with one chapter per step; no selection falls back to a drafted story with no repeated title.

**Architecture:** v1's pure engine → overlay → hook → player/modal → export pipeline stays. Two new pure modules: `stepEvidence.js` (company/person evidence from data the app already fetches) and a rewritten `draftWalkthrough.js` (selection mode + fallback spine). The loader fetches profile + events + findings per selected company (cap 12). The document renderer gains evidence blocks and drops covered annex rows. The preview opens in a new tab.

**Tech Stack:** React 19 / Vite 5.4 / MUI / vitest (no jsdom). Services: `spanishCompaniesService.getCompanyProfileV3(name, {groupKey})` → `{ company }`, `getCompanyEventsV3(name, {groupKey, size})`, `getCompanyFindings({groupKey, name, lang})`.

**Spec:** `docs/superpowers/specs/2026-09-13-walkthrough-v2-selection-dossier-design.md` (binding). v1 spec `2026-09-12-drafted-walkthrough-design.md` for everything not changed.

## Global Constraints

- Frontend-only. Immutable data everywhere (new objects, never mutate graphData/scope/edits/steps/selection).
- Selection = `investigationSet` (a `Set` of normalised node ids, insertion order = selection order). Cap `SELECTION_CAP = 12`. Chapters show only what the graph shows: no fetch beyond `getCompanyProfileV3`, `getCompanyEventsV3(size 3)`, `getCompanyFindings` for SELECTED companies; persons need no fetch.
- Step keys: `step:<nodeId>` in both modes. `walkthroughEdits` overlay unchanged (`hidden`, `order`, `notes`).
- The opening card is synthesised at render (player + export), never a step, never hidden/reordered.
- Copy (ES / EN), verbatim: opening title `Recorrido por esta red · {n} pasos` / `Walkthrough of this network · {n} steps`; selection line `Tu selección, en el orden elegido` / `Your selection, in the order you chose`; draft line `Borrador generado: empresas, conexiones y tus notas` / `Generated draft: companies, connections and your notes`; capped line `Se muestran los 12 primeros de {n} seleccionados` / `Showing the first 12 of {n} selected`; eyebrows `Empresa · Persona · Nota` / `Company · Person · Note`; hint `Selecciona nodos con {mod}+clic (Ctrl+clic en Windows/Linux) para elegir los pasos. Sin selección, se genera un borrador.` / `Select nodes with {mod}+click (Ctrl+click on Windows/Linux) to choose the steps. With no selection, a draft is generated.` where `{mod}` is `⌘` on Mac and `Ctrl` elsewhere; blocks `Identidad · Órgano de administración · Últimos actos · Lo que destaca` / `Identity · Governing body · Latest filings · What stands out`; chapter sub-heads `Órgano de administración`, `Últimos actos`, `Lo que destaca`, `Lo que el registro no muestra`, `Cargos en las empresas del mapa` / `Governing body`, `Latest filings`, `What stands out`, `What the registry cannot show`, `Seats across the companies on the map`; preview action `Abrir vista previa` / `Open preview`.
- Registry sentences (findings text) verbatim; values rendered from fields, never paraphrased. All user/external text through `escapeHtml` exactly once in the export.
- Exported file self-contained; the walkthrough script must never contain `</script>`; card sits UNDER the map (no `position:sticky` on `#wt-panel`); single-node zoom `1.3`.
- Analytics: existing names; `walkthrough_start` gains `{ mode: 'selection'|'draft', steps }`; `walkthrough_preview` on the new-tab action.
- `npm run build` rewrites tracked files (index.html, public/llms.txt, public/robots.txt, public/sitemap*.xml, src/copy/registryScaleData.js): always `git checkout --` them before committing; never commit `dist/`.
- Commit with `git -c commit.gpgsign=false commit -m "<msg>"` ending with the two trailer lines the session provides. `npm test` green at every commit.

---

## File map

| File | Responsibility |
|---|---|
| `src/utils/walkthrough/walkthroughCopy.js` | + opening, eyebrows, hint(mod), blocks, subheads, preview action, seat/filing labels |
| `src/utils/walkthrough/stepEvidence.js` (new) | pure: `companyEvidence`, `personSeats`, `boardRows`, `lastFilings` |
| `src/utils/walkthrough/draftWalkthrough.js` | rewritten: `draftWalkthrough({…, selection})`, `SELECTION_CAP`, `openingCard` |
| `src/utils/walkthrough/walkthroughLoader.js` | `loadStepData` (profile + events + findings per selected company) |
| `src/utils/walkthrough/applyWalkthroughEdits.js` | unchanged |
| `src/hooks/useWalkthrough.js` | `selection`, `setSelection`, `mode`, `opening`; `move` re-orders selection in selection mode |
| `src/components/WalkthroughPlayer.jsx` | opening card; entity eyebrow; first evidence line |
| `src/components/RelationshipReportModal.jsx` | block toggles; preview button (new tab) replaces the tab |
| `src/utils/sitrepAuthor.js` | `blocks` persisted |
| `src/utils/investigationDoc.js` | `blocks`, `mode` |
| `src/utils/investigationExport/documentSections.js` | chapters with evidence; annexes minus covered; card under map; contents per chapter |
| `src/utils/investigationExport/documentStyle.js` | evidence table + card styles; panel not sticky |
| `src/utils/investigationExport/walkthroughScript.js` | zoom 1.3; opening card; evidence line; note label |
| `src/utils/investigationExport/buildExportHtml.js` | embeds the v2 step shape + opening |
| `src/utils/investigationExport/exportCopy.js` | contents per chapter label, seat/filing headers |
| `src/components/SpanishCompanyNetworkGraph.jsx` | ordered selection → hook; `setSelectionOrder`; hint + badge; preview new tab; analytics mode |

---

### Task 1: Copy

**Files:**
- Modify: `src/utils/walkthrough/walkthroughCopy.js`, `src/utils/walkthrough/walkthroughCopy.test.js`
- Modify: `src/utils/investigationExport/exportCopy.js`, `src/utils/investigationExport/exportCopy.test.js`

**Interfaces:**
- Produces on `walkthroughCopy(lang)`: `opening(n) → string`, `openingSelection`, `openingDraft`, `openingCapped(n)`, `kinds: { company, person, note }`, `hint(mod) → string`, `blocks: { identity, board, filings, findings }`, `subheads: { board, filings, findings, unseen, seats }`, `openPreview`, `seatColumns: { company, role, since, until, status }`, `boardColumns: { name, role, since, status }`, `filingColumns: { date, type }`, `statusWords: { active, ceased, dissolved, concurso }`, `capitalLabel`, `activityLabel`, `noNarrative` (empty string — chapters never show a placeholder; export must treat '' as omit).
- `platformModifier(nav) → '⌘' | 'Ctrl'` exported from the same file (pure: reads `nav?.userAgentData?.platform || nav?.platform || ''`, returns `⌘` when it matches `/mac|iphone|ipad/i`).

- [ ] **Step 1: Failing tests** (append to `walkthroughCopy.test.js`)

```js
import { platformModifier } from './walkthroughCopy';

describe('v2 copy', () => {
  it('names the opening card in both languages', () => {
    expect(walkthroughCopy('es').opening(8)).toBe('Recorrido por esta red · 8 pasos');
    expect(walkthroughCopy('en').opening(1)).toBe('Walkthrough of this network · 1 step');
    expect(walkthroughCopy('es').openingCapped(15)).toBe('Se muestran los 12 primeros de 15 seleccionados');
  });
  it('renders the selection hint with the platform modifier', () => {
    expect(walkthroughCopy('es').hint('⌘')).toBe('Selecciona nodos con ⌘+clic (Ctrl+clic en Windows/Linux) para elegir los pasos. Sin selección, se genera un borrador.');
    expect(walkthroughCopy('en').hint('Ctrl')).toBe('Select nodes with Ctrl+click (Ctrl+click on Windows/Linux) to choose the steps. With no selection, a draft is generated.');
  });
  it('detects the platform modifier', () => {
    expect(platformModifier({ platform: 'MacIntel' })).toBe('⌘');
    expect(platformModifier({ userAgentData: { platform: 'macOS' } })).toBe('⌘');
    expect(platformModifier({ platform: 'Win32' })).toBe('Ctrl');
    expect(platformModifier(undefined)).toBe('Ctrl');
  });
  it('carries kinds, blocks and subheads', () => {
    const t = walkthroughCopy('es');
    expect(t.kinds).toEqual({ company: 'Empresa', person: 'Persona', note: 'Nota' });
    expect(Object.keys(t.blocks)).toEqual(['identity', 'board', 'filings', 'findings']);
    expect(t.subheads.seats).toBe('Cargos en las empresas del mapa');
    expect(walkthroughCopy('en').openPreview).toBe('Open preview');
  });
});
```

Append to `exportCopy.test.js`: both languages have `chapterLabel(n, name)` returning `01 ACME` style (`chapterLabel(1, 'ACME')` → `'01 ACME'`).

- [ ] **Step 2: Run** `npx vitest run src/utils/walkthrough/walkthroughCopy.test.js src/utils/investigationExport/exportCopy.test.js` → new cases FAIL.

- [ ] **Step 3: Implement.** Add to `ES`:

```js
  opening: n => `Recorrido por esta red · ${n} paso${n === 1 ? '' : 's'}`,
  openingSelection: 'Tu selección, en el orden elegido',
  openingDraft: 'Borrador generado: empresas, conexiones y tus notas',
  openingCapped: n => `Se muestran los 12 primeros de ${n} seleccionados`,
  kinds: { company: 'Empresa', person: 'Persona', note: 'Nota' },
  hint: mod => `Selecciona nodos con ${mod}+clic (Ctrl+clic en Windows/Linux) para elegir los pasos. Sin selección, se genera un borrador.`,
  blocks: { identity: 'Identidad', board: 'Órgano de administración', filings: 'Últimos actos', findings: 'Lo que destaca' },
  subheads: { board: 'Órgano de administración', filings: 'Últimos actos', findings: 'Lo que destaca', unseen: 'Lo que el registro no muestra', seats: 'Cargos en las empresas del mapa' },
  openPreview: 'Abrir vista previa',
  seatColumns: { company: 'Empresa', role: 'Cargo', since: 'Desde', until: 'Hasta', status: 'Estado' },
  boardColumns: { name: 'Nombre', role: 'Cargo', since: 'Desde', status: 'Estado' },
  filingColumns: { date: 'Fecha', type: 'Acto' },
  statusWords: { active: 'Vigente', ceased: 'Cesado', dissolved: 'Disuelta', concurso: 'En concurso' },
  capitalLabel: 'Capital social',
  activityLabel: 'Actividad declarada',
```

and the EN equivalents (`Walkthrough of this network · ${n} step${n === 1 ? '' : 's'}`, `Your selection, in the order you chose`, `Generated draft: companies, connections and your notes`, `Showing the first 12 of ${n} selected`, `{ company: 'Company', person: 'Person', note: 'Note' }`, `Select nodes with ${mod}+click (Ctrl+click on Windows/Linux) to choose the steps. With no selection, a draft is generated.`, blocks `Identity / Governing body / Latest filings / What stands out`, subheads `Governing body / Latest filings / What stands out / What the registry cannot show / Seats across the companies on the map`, `Open preview`, columns `Company/Role/Since/Until/Status`, `Name/Role/Since/Status`, `Date/Filing`, status `Active/Ceased/Dissolved/In insolvency`, `Share capital`, `Declared activity`). Add:

```js
export const platformModifier = nav => {
  const p = String(nav?.userAgentData?.platform || nav?.platform || '');
  return /mac|iphone|ipad/i.test(p) ? '⌘' : 'Ctrl';
};
```

In `exportCopy.js` add to both: `chapterLabel: (n, name) => `${String(n).padStart(2, '0')} ${name}``.

- [ ] **Step 4: Run** the two test files → PASS. `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(walkthrough): v2 copy — opening card, entity kinds, selection hint, document blocks`.

---

### Task 2: Step evidence builders (pure)

**Files:**
- Create: `src/utils/walkthrough/stepEvidence.js`, `src/utils/walkthrough/stepEvidence.test.js`
- Modify: `src/utils/walkthrough/index.js` (export)

**Interfaces:**
- `boardRows(companyDoc, lang) → [{ name, role, since, status:'active'|'ceased' }]` — from `companyDoc.officers_active` (status active, `since = appointed_date`) then `officers_resigned` whose `status` is not `'superseded'` (status ceased, `since = appointed_date || ''`), sorted active first then by `since` desc, cap `BOARD_CAP = 12`.
- `lastFilings(eventsPayload, lang, n = 3) → [{ date, type }]` — events from `payload.events || payload.results || []`, `date = event_date || date` (10 chars), `type` = first informative `event_types[].type` (skip a type whose folded text is `datos registrales`), newest first, first `n`.
- `personSeats(node, graphData, lang) → [{ company, companyId, role, since, until, status }]` — from graph links between the person node and visible company nodes: `role = link.relationship || link.category || ''`, `status` from `link.category` via `isActiveOfficerCategory` (import from `../relationshipScope`), `since = link.date || link.appointed_date || ''`, `until = link.resigned_date || ''`. Sorted by company name.
- `companyEvidence({ node, profile, events, findings, lang }) → { identity, status, capital, activity, board, filings, findings, unseen, ownership: [] }` where `identity` = `identityLine(t, findings?.company)` or `''`; `status = { dissolved: !!profile?.is_dissolved, concurso: !!profile?.is_in_concurso, lastFiling: findings?.company?.last_filing || null }`; `capital = profile?.share_capital ?? profile?.capital ?? null` (string or null; never computed); `activity = profile?.activity || profile?.enriched_activity || null`; `board = boardRows(profile)`; `filings = lastFilings(events)`; `findings = (findings?.findings || []).filter(f => f.cls !== 'limitation').sort(concern first, date desc).slice(0, 3).map(({text, date, cls}) => ({text, date, cls}))`; `unseen = [...(findings?.verification || []), ...limitation texts]`.
- All pure, null-tolerant (any missing input → empty arrays / nulls), never throw.

- [ ] **Step 1: Failing tests**

```js
// src/utils/walkthrough/stepEvidence.test.js
import { describe, expect, it } from 'vitest';
import { boardRows, lastFilings, personSeats, companyEvidence } from './stepEvidence';

const profile = {
  is_dissolved: false, is_in_concurso: false, share_capital: '3.006,00 €', activity: 'Consultoría',
  officers_active: [
    { name: 'GARCIA LOPEZ MARIA', position_normalized: 'Administradora única', appointed_date: '2021-03-01', status: 'active' },
  ],
  officers_resigned: [
    { name: 'RUIZ MARTIN LUIS', position_normalized: 'Apoderado', appointed_date: '2018-01-01', resigned_date: '2020-06-30', status: 'resigned' },
    { name: 'OLD AUDITOR SL', position_normalized: 'Auditor', appointed_date: '2015-01-01', status: 'superseded' },
  ],
};
const events = { events: [
  { event_date: '2026-06-03', event_types: [{ type: 'Datos registrales' }, { type: 'Nombramientos' }] },
  { event_date: '2024-03-11', event_types: [{ type: 'Reducción de capital' }] },
  { event_date: '2022-01-05', event_types: [{ type: 'Ceses/Dimisiones' }] },
  { event_date: '2020-01-05', event_types: [{ type: 'Otros conceptos' }] },
] };
const findings = {
  company: { name: 'ACME IBERIA, SL', nif: 'B1', province: 'Valencia', registry: 'V-1', previous_names: [], last_filing: { date: '2026-06-03', type: 'Nombramientos' } },
  findings: [
    { kind: 'no_insolvency_notice', cls: 'limitation', text: 'No insolvency notice.', date: null },
    { kind: 'capital_movement', cls: 'concern', text: 'Capital reduced 2024-03-11.', date: '2024-03-11' },
    { kind: 'governing_body_turnover', cls: 'context', text: '2 changes.', date: '2026-06-03' },
  ],
  verification: ['No beneficial owners in the registry.'],
};

describe('boardRows', () => {
  it('lists active seats first, skips superseded, caps', () => {
    const rows = boardRows(profile, 'es');
    expect(rows.map(r => [r.name, r.status])).toEqual([['GARCIA LOPEZ MARIA', 'active'], ['RUIZ MARTIN LUIS', 'ceased']]);
    expect(rows[0]).toMatchObject({ role: 'Administradora única', since: '2021-03-01' });
    expect(boardRows(null, 'es')).toEqual([]);
  });
});

describe('lastFilings', () => {
  it('takes the newest three, skipping "Datos registrales" as the label', () => {
    expect(lastFilings(events, 'es')).toEqual([
      { date: '2026-06-03', type: 'Nombramientos' }, { date: '2024-03-11', type: 'Reducción de capital' }, { date: '2022-01-05', type: 'Ceses/Dimisiones' },
    ]);
    expect(lastFilings({ results: events.events }, 'es', 1)).toHaveLength(1);
    expect(lastFilings(undefined, 'es')).toEqual([]);
  });
});

describe('personSeats', () => {
  const graph = {
    nodes: [
      { id: 'o1', type: 'officer', name: 'GARCIA LOPEZ MARIA' },
      { id: 'H:1', type: 'spanish-company-group', name: 'ACME IBERIA, SL' },
      { id: 'H:2', type: 'spanish-company-group', name: 'NORTE, SL' },
      { id: 'o2', type: 'officer', name: 'OTHER' },
    ],
    links: [
      { source: 'H:1', target: 'o1', category: 'nombramiento', relationship: 'Administradora única', date: '2021-03-01' },
      { source: { id: 'o1' }, target: { id: 'H:2' }, category: 'cese', relationship: 'Consejera', date: '2019-01-01' },
      { source: 'H:1', target: 'o2', category: 'nombramiento', relationship: 'Apoderado' },
    ],
  };
  it('lists every seat of the person across visible companies, sorted by company', () => {
    expect(personSeats(graph.nodes[0], graph, 'es')).toEqual([
      { company: 'ACME IBERIA, SL', companyId: 'H:1', role: 'Administradora única', since: '2021-03-01', until: '', status: 'active' },
      { company: 'NORTE, SL', companyId: 'H:2', role: 'Consejera', since: '2019-01-01', until: '', status: 'ceased' },
    ]);
  });
});

describe('companyEvidence', () => {
  it('assembles identity, status, capital, activity, board, filings, findings and unseen', () => {
    const ev = companyEvidence({ node: { id: 'H:1', name: 'ACME IBERIA, SL' }, profile, events, findings, lang: 'es' });
    expect(ev.identity).toContain('NIF B1');
    expect(ev.status).toEqual({ dissolved: false, concurso: false, lastFiling: { date: '2026-06-03', type: 'Nombramientos' } });
    expect(ev.capital).toBe('3.006,00 €');
    expect(ev.activity).toBe('Consultoría');
    expect(ev.board).toHaveLength(2);
    expect(ev.filings).toHaveLength(3);
    expect(ev.findings.map(f => f.kind || f.text)).toEqual(['Capital reduced 2024-03-11.', '2 changes.']);
    expect(ev.unseen).toEqual(['No beneficial owners in the registry.', 'No insolvency notice.']);
  });
  it('degrades to empty values with no payloads', () => {
    const ev = companyEvidence({ node: { id: 'H:9', name: 'X' }, profile: null, events: null, findings: null, lang: 'en' });
    expect(ev).toEqual({ identity: '', status: { dissolved: false, concurso: false, lastFiling: null }, capital: null, activity: null, board: [], filings: [], findings: [], unseen: [], ownership: [] });
  });
});
```

- [ ] **Step 2: Run** → FAIL (module missing).
- [ ] **Step 3: Implement** `stepEvidence.js`:

```js
// Sourced evidence for a walkthrough step, built only from data the app already
// fetches for the inspector: the v3 company profile, the last events, the
// findings payload, and the visible graph's links. Pure and null-tolerant.
import { isActiveOfficerCategory } from '../relationshipScope';
import { walkthroughCopy, identityLine } from './walkthroughCopy';

export const BOARD_CAP = 12;
const nid = id => (id == null ? '' : String(id));
const refId = ref => (ref && typeof ref === 'object' ? ref.id : ref);
const isCompany = n => !!n && (n.type === 'company' || n.type === 'spanish-company-group');
const day = v => String(v || '').slice(0, 10);
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const REGISTRY_DATA = 'datos registrales';

export const boardRows = (profile) => {
  const active = (profile?.officers_active || []).map(o => ({
    name: o.name || o.name_normalized || '', role: o.position_normalized || o.position || '', since: day(o.appointed_date), status: 'active',
  }));
  const ceased = (profile?.officers_resigned || [])
    .filter(o => String(o.status || '').toLowerCase() !== 'superseded')
    .map(o => ({ name: o.name || o.name_normalized || '', role: o.position_normalized || o.position || '', since: day(o.appointed_date), status: 'ceased' }));
  const byDate = (a, b) => b.since.localeCompare(a.since);
  return [...active.sort(byDate), ...ceased.sort(byDate)].filter(r => r.name).slice(0, BOARD_CAP);
};

export const lastFilings = (payload, lang, n = 3) => {
  const events = payload?.events || payload?.results || [];
  return events
    .map(e => {
      const types = (e.event_types || []).map(t => (typeof t === 'string' ? t : t?.type)).filter(Boolean);
      const informative = types.find(t => fold(t) !== REGISTRY_DATA) || types[0] || '';
      return { date: day(e.event_date || e.date), type: informative };
    })
    .filter(e => e.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);
};

export const personSeats = (node, graphData, lang) => {
  const id = nid(node?.id);
  const byId = new Map((graphData?.nodes || []).map(n => [nid(n.id), n]));
  return (graphData?.links || []).flatMap(l => {
    const a = nid(refId(l.source)); const b = nid(refId(l.target));
    const other = a === id ? b : b === id ? a : null;
    const company = other ? byId.get(other) : null;
    if (!company || !isCompany(company)) return [];
    return [{
      company: company.name || '', companyId: other,
      role: l.relationship || l.category || '',
      since: day(l.date || l.appointed_date), until: day(l.resigned_date),
      status: isActiveOfficerCategory(l.category) ? 'active' : 'ceased',
    }];
  }).sort((x, y) => x.company.localeCompare(y.company));
};

const concernFirst = (a, b) => {
  const r = c => (c === 'concern' ? 0 : 1);
  return r(a.cls) - r(b.cls) || String(b.date || '').localeCompare(String(a.date || ''));
};

export const companyEvidence = ({ node, profile, events, findings, lang = 'es' }) => {
  const t = walkthroughCopy(lang);
  const header = findings?.company || null;
  const all = findings?.findings || [];
  return {
    identity: header ? identityLine(t, header) : '',
    status: { dissolved: !!profile?.is_dissolved, concurso: !!profile?.is_in_concurso, lastFiling: header?.last_filing || null },
    capital: profile?.share_capital ?? profile?.capital ?? null,
    activity: profile?.activity || profile?.enriched_activity || null,
    board: boardRows(profile),
    filings: lastFilings(events, lang),
    findings: [...all.filter(f => f.cls !== 'limitation')].sort(concernFirst).slice(0, 3)
      .map(f => ({ text: f.text || '', date: f.date || null, cls: f.cls || 'context' })),
    unseen: [...(findings?.verification || []), ...all.filter(f => f.cls === 'limitation').map(f => f.text)].filter(Boolean),
    ownership: [],
  };
};
```

Add `export * from './stepEvidence';` to `index.js`. (The `findings` test asserts `f.kind || f.text`; the mapped objects have no `kind`, so `text` is compared — keep the mapping as written.)

- [ ] **Step 4: Run** → PASS. `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(walkthrough): sourced evidence builders for company and person steps`.

---

### Task 3: Draft engine v2

**Files:**
- Modify: `src/utils/walkthrough/draftWalkthrough.js` (rewrite), `src/utils/walkthrough/draftWalkthrough.test.js` (rewrite)

**Interfaces:**
- Produces: `SELECTION_CAP = 12`, `pairKey` (unchanged), `subjectCompanyIds` (unchanged), `draftWalkthrough({ graphData, scope, stepData, selection, primarySubjectId, lang }) → Step[]`, `openingCard({ steps, mode, selectedCount, lang }) → { title, line }`.
- `stepData`: `Map<nodeId, { profile, events, findings } | null>` (from Task 4's loader; v1's `findingsByKey` shape is gone).
- Step shape:

```js
{ key: 'step:<nodeId>', nodeId, kind: 'company'|'person', order, title,
  narrative: { text, flag } | null,          // the node note
  evidence: companyEvidence(...) | { seats } , // by kind
  summary: string,                            // one line for the player/card: identity line or "k cargos en m empresas"
  nodeIds, linkKeys,                          // focus
  // v1 compatibility fields still read by the overlay/player/export:
  section: 'company'|'person', source: 'registry'|'graph', text: summary, date: null, evidence1: null, flag, authorNote }
```
  Keep `authorNote` = `narrative ? { ...narrative, origin: 'node' } : null` so `applyWalkthroughEdits`, the player and the hook's `setNote` keep working unchanged. `text` = `summary`. `flag` = narrative flag or null. `source` = 'registry' when the company has an identity line, else 'graph'; persons 'graph'.
- Selection mode: `selection` (ordered ids) ∩ visible, first 12, each `companyStep`/`personStep`. Notes on unselected nodes are NOT steps.
- Draft mode (empty selection): subject company, then other visible companies (scope order), then connectors (as person steps, sorted by company count desc, cap 8), then loose notes as person/company steps of kind by node type. No repeated title.
- Focus: company step focuses the company + its visible officers' links? No: company focuses [companyId] plus the ids of its board members present on the map (`nodeIds = [id, ...visibleOfficerIds]`, `linkKeys` for each); person focuses the person + the companies in `seats` with their link keys.

- [ ] **Step 1: Rewrite the test file** with fixtures: graph of 2 companies + 3 officers (one connector), `stepData` Map with a profile/events/findings for `H:1` and null for `H:2`; tests:
  1. selection order is honoured and capped at 12 (build a 14-node selection);
  2. selection ignores ids not on the map;
  3. company step carries `kind:'company'`, `summary` = identity line when findings present, `evidence.board`, and focus links to visible board members;
  4. person step carries `kind:'person'`, `summary` `'2 cargos en 2 empresas'` (ES) and `evidence.seats`;
  5. a note on a selected node becomes `narrative` and `authorNote.origin === 'node'`; a note on an unselected node does not create a step;
  6. draft mode: subject first, no repeated title, connectors after companies, loose notes last;
  7. keys are `step:<id>`; no mutation;
  8. `openingCard` → `{ title: 'Recorrido por esta red · 3 pasos', line: 'Tu selección, en el orden elegido' }` in selection mode, the draft line in draft mode, and the capped line when `selectedCount > 12`.

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (full rewrite; keep `pairKey`, `subjectCompanyIds`, `deepLink`, `isCompany`, `nid`, `refId`; drop `officerNodeByName` and the findingStep/unseen sections; import `companyEvidence`, `personSeats` from `./stepEvidence`; `hasNodeNote` from nodeNotes; copy from `./walkthroughCopy`):

```js
export const SELECTION_CAP = 12;

const narrativeOf = node => (hasNodeNote(node)
  ? { text: node.userNote.text.trim(), flag: node.userNote.flag || 'none' } : null);

const base = (node, kind, order, lang) => {
  const narrative = narrativeOf(node);
  return {
    key: `step:${nid(node.id)}`, nodeId: nid(node.id), kind, order, title: node.name || '',
    narrative, authorNote: narrative ? { ...narrative, origin: 'node' } : null,
    flag: narrative?.flag || null, section: kind, date: null, evidence1: null,
    deepLink: deepLink(node, lang),
  };
};

const officersOfCompany = (companyId, graphData, byId) => (graphData?.links || []).flatMap(l => {
  const a = nid(refId(l.source)); const b = nid(refId(l.target));
  const other = a === companyId ? b : b === companyId ? a : null;
  const n = other ? byId.get(other) : null;
  return n && n.type === 'officer' ? [other] : [];
});

const companyStep = ({ node, order, data, graphData, byId, lang, t }) => {
  const evidence = companyEvidence({ node, profile: data?.profile, events: data?.events, findings: data?.findings, lang });
  const officerIds = [...new Set(officersOfCompany(nid(node.id), graphData, byId))];
  const summary = evidence.identity || graphOnlyLine(t, officerIds.length);
  return {
    ...base(node, 'company', order, lang), evidence, summary, text: summary,
    source: evidence.identity ? 'registry' : 'graph',
    nodeIds: [nid(node.id), ...officerIds], linkKeys: officerIds.map(o => pairKey(node.id, o)),
  };
};

const personStep = ({ node, order, graphData, lang, t }) => {
  const seats = personSeats(node, graphData, lang);
  const companies = [...new Set(seats.map(s => s.companyId))];
  const summary = t.seatsLine(seats.length, companies.length);
  return {
    ...base(node, 'person', order, lang), evidence: { seats }, summary, text: summary, source: 'graph',
    nodeIds: [nid(node.id), ...companies], linkKeys: companies.map(c => pairKey(node.id, c)),
  };
};
```

`t.seatsLine(k, m)` is a new copy key: ES `${k} cargo${k===1?'':'s'} en ${m} empresa${m===1?'':'s'}`, EN `${k} seat${k===1?'':'s'} across ${m} compan${m===1?'y':'ies'}` — add it to Task 1's copy (and a one-line test) as part of this task.

```js
export function draftWalkthrough({ graphData, scope, stepData, selection = [], primarySubjectId, lang = 'es' }) {
  const t = walkthroughCopy(lang);
  const nodes = graphData?.nodes || [];
  const byId = new Map(nodes.map(n => [nid(n.id), n]));
  const data = stepData instanceof Map ? stepData : new Map();
  const build = (node, order) => (isCompany(node)
    ? companyStep({ node, order, data: data.get(nid(node.id)) || null, graphData, byId, lang, t })
    : personStep({ node, order, graphData, lang, t }));

  const chosen = (selection || []).map(nid).filter(id => byId.has(id)).slice(0, SELECTION_CAP);
  if (chosen.length) return chosen.map((id, i) => build(byId.get(id), i));

  // Draft: subject, other companies, connectors, loose notes. Never the same node twice.
  const seen = new Set();
  const out = [];
  const push = node => { const id = nid(node?.id); if (!node || seen.has(id)) return; seen.add(id); out.push(build(node, out.length)); };
  subjectCompanyIds(scope, primarySubjectId).forEach(id => push(byId.get(id)));
  [...(scope?.connectors || [])]
    .sort((x, y) => (y.companies?.length || 0) - (x.companies?.length || 0) || String(x.name).localeCompare(String(y.name)))
    .slice(0, 8).forEach(c => push(byId.get(nid(c.nodeId))));
  nodes.filter(hasNodeNote).sort((a, b) => String(a.name).localeCompare(String(b.name))).forEach(push);
  return out;
}

export const openingCard = ({ steps, mode, selectedCount = 0, lang = 'es' }) => {
  const t = walkthroughCopy(lang);
  const capped = mode === 'selection' && selectedCount > SELECTION_CAP;
  return { title: t.opening(steps.length), line: capped ? t.openingCapped(selectedCount) : (mode === 'selection' ? t.openingSelection : t.openingDraft) };
};
```

Remove the now-unused imports (`nameKey`, `isSpellingVariant`, `officerNameRotations`, `connectorSentence`, `ownershipSentence`, `identityLine` if unused here) and constants (`SECTIONS`, caps). Check `src/utils/walkthrough/index.js` still exports `pairKey`, `subjectCompanyIds`, `SELECTION_CAP`, `draftWalkthrough`, `openingCard`; grep the repo for `STANDS_OUT_CAP|CONNECTS_CAP|FINDINGS_FETCH_CAP|SECTIONS` and fix importers (the loader imports `FINDINGS_FETCH_CAP` — Task 4 replaces it; for this commit define `export const FINDINGS_FETCH_CAP = SELECTION_CAP;` so the loader keeps compiling).

- [ ] **Step 4: Run** the engine tests → PASS; `npm test` → any v1 test in `applyWalkthroughEdits.test.js`/`walkthroughState.test.js` that only uses synthetic steps still passes; `documentSections.test.js`/`buildExportHtml.test.js` may still pass (they build their own step fixtures) — if they reference `section: 'subject'` they still render. Green required.
- [ ] **Step 5: Commit** `feat(walkthrough): the walkthrough is the author's selection in order; drafted fallback without repeated titles`.

---

### Task 4: Loader v2

**Files:**
- Modify: `src/utils/walkthrough/walkthroughLoader.js`, `src/utils/walkthrough/walkthroughLoader.test.js`

**Interfaces:**
- `loadStepData({ ids, nodesById, fetchProfile, fetchEvents, fetchFindings, lang, cap = SELECTION_CAP, waitMs = FINDINGS_WAIT_MS, setTimeoutFn, clearTimeoutFn }) → Promise<Map<id, { profile, events, findings } | null>>`. Only company nodes are fetched (`node.type === 'company' || 'spanish-company-group'`); person ids map to `null`. The three fetches per company run in parallel; each individually failing/timeout → that field `null` (an entry is `null` only when the node is missing or not a company). `fetchProfile({ groupKey, name })` returns `{ company }` → store `company`; `fetchEvents({ groupKey, name, size: 3 })` → stored raw; `fetchFindings({ groupKey, name, lang })` → stored raw. Timer handling as v1 (`finally clearTimeoutFn`).
- Keep `loadFindingsForSubjects` exported (unchanged) for one commit? No — delete it and its tests; nothing else imports it after Task 5. (Verify with grep before deleting.)

- [ ] **Step 1: Tests** (rewrite the file): fetches only companies, parallel three calls, name-vs-groupKey args, a rejected profile leaves `profile: null` but keeps findings, timeout resolves with partial data and no unhandled rejection (reuse v1's late-rejection test shape), `clearTimeoutFn` called once, cap respected.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (mirror v1's structure; `results` pre-filled with `null`; for each company id: `Promise.all([p, e, f].map(x => x.catch(() => null)))` then `results.set(id, { profile: p?.company ?? p ?? null, events: e, findings: f })`; race with the timeout; return a copy).
- [ ] **Step 4: Run** → PASS; `npm test` → PASS. **Step 5: Commit** `feat(walkthrough): load profile, latest filings and findings per selected company`.

---

### Task 5: Hook v2

**Files:**
- Modify: `src/hooks/useWalkthrough.js`, `src/hooks/walkthroughState.js`, `src/hooks/walkthroughState.test.js`

**Interfaces:**
- `useWalkthrough({ graphData, scope, primarySubjectId, lang, selection, setSelection, fetchProfile, fetchEvents, fetchFindings, edits, setEdits, onTrack, saveNodeNote })` — `selection` is an ordered `string[]`; `setSelection(next: string[])` writes back (graph converts to its `Set`).
- Returns as v1 plus `mode: 'selection'|'draft'`, `opening: { title, line }`, `selectedCount`.
- `move(key, delta)`: in selection mode, swap the two node ids in `selection` and call `setSelection`; in draft mode, `moveStep` on the overlay as v1.
- `prepare()`: ids to load = selection-mode ? selected company ids (first 12) : `subjectCompanyIds(scope, primarySubjectId)` (first 12); dispatch `ready` with `stepData` (reducer field renamed from `findingsByKey` → `stepData`; update `walkthroughState.js` and its test).
- `start()`: track `walkthrough_start` with `{ mode, steps: fresh.length }`.
- `coverage`: from the subject's `stepData.get(id)?.findings?.coverage`.

- [ ] **Step 1: Reducer test update** (`findingsByKey` → `stepData` in `ready`); run → FAIL. **Step 2: Implement** reducer rename + hook per the interface (draft memo deps `[graphData, scope, state.stepData, selection, primarySubjectId, lang]`; `mode = selection.length ? 'selection' : 'draft'`; `opening = useMemo(() => openingCard({ steps, mode, selectedCount: selection.length, lang }))`).
- [ ] **Step 3:** `npx vitest run src/hooks` → PASS; esbuild syntax check on the hook (as v1 Task 8); `npm test` → PASS. **Step 4: Commit** `feat(walkthrough): hook drives from the ordered selection; move re-orders the selection`.

---

### Task 6: Player, author blocks, modal

**Files:**
- Modify: `src/components/WalkthroughPlayer.jsx`, `src/utils/sitrepAuthor.js` (+ test), `src/components/RelationshipReportModal.jsx`

**Player:**
- New props `opening` (`{title, line}`), `mode`. Index 0 is the opening card: when `index === 0` render `opening.title` as the title, `opening.line` as text, no note field, no hide; `total` shown as `steps.length + 1`. The hook's indexes are unchanged; the graph passes `index={walkthrough.index + 1}` and maps prev/next accordingly? **No** — keep it simple: the player receives `step={walkthrough.current}`, and additionally `showOpening={walkthrough.index === 0}` which renders the opening block ABOVE the first step's card content (title + line, then a divider, then the step). Counter stays `index+1 / total`.
- Eyebrow: `t.kinds[step.kind]` (fallback to `t.sections[step.section]` for old snapshots) + source chip.
- Body: `step.summary` (or `step.text`), then, if the step has evidence, ONE line: company → `evidence.findings[0]?.text || evidence.status.lastFiling ? `${t.subheads.filings}: ${date} ${type}` : ''`; person → `evidence.seats.map(s => `${s.role} · ${s.company}`).slice(0,2).join(' · ')`.
- Note field label: when `step.narrative` exists, label `t.kinds.note` + ` · ` + `t.noteField`; unchanged otherwise.

**sitrepAuthor:** persist `blocks: { identity, board, filings, findings }` (booleans, default all true; `loadSitrepAuthor` returns them; unknown keys dropped). Test: round-trip, defaults when missing.

**Modal:**
- Remove `Tabs`/`Tab`, the preview `iframe`, `previewHtml` state/effect. Add a `Button` in `DialogActions` before Download: `wt.openPreview` → `openPreview()`:
```js
  const openPreview = async () => {
    const { buildExportHtml } = await import('../utils/investigationExport');
    const html = buildExportHtml(doc, graphData, { lang: es ? 'es' : 'en' });
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const w = window.open(url, '_blank', 'noopener');
    if (!w) { setPreviewBlocked(true); }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    onPreview?.();
  };
```
  with a `Snackbar` message when the popup was blocked (ES `El navegador bloqueó la pestaña; permite ventanas emergentes para la vista previa.` / EN `The browser blocked the tab; allow pop-ups to open the preview.`) — add these two strings to `walkthroughCopy` as `previewBlocked`.
- Block toggles: a row of four `FormControlLabel`+`Checkbox` under the author fields, labels from `wt.blocks`, values from `author.blocks`, `onAuthorChange({ ...author, blocks: { ...author.blocks, [k]: checked } })`.
- The Recorrido list rows: eyebrow uses `wt.kinds[s.kind] || wt.sections[s.section]`; number column shows `String(i + 1).padStart(2,'0')`; up/down call `walkthrough.move` as before.
- `doc` passed to the export must include `blocks` (Task 7 wires it via `buildInvestigationDoc`).

- [ ] **Steps:** write the sitrepAuthor test first (RED → GREEN); implement the three files; `npx vite build` (discard drift); `npm test`. Commit `feat(walkthrough): opening card, document blocks, preview in a new tab`.

---

### Task 7: Document v2

**Files:**
- Modify: `src/utils/investigationDoc.js` (+test): `blocks` (default all true), `mode`, `opening` carried through.
- Modify: `src/utils/investigationExport/exportCopy.js`: `chapterLabel` (Task 1), plus `narrativeLabel` (`Nota del autor` exists as `authorNote`; reuse).
- Modify: `src/utils/investigationExport/documentSections.js` (+test), `documentStyle.js` (+test), `walkthroughScript.js` (+test), `buildExportHtml.js` (+test).

**Sections:**
- `renderContents`: summary, map, then ONE entry per chapter `t.chapterLabel(i+1, s.title)` anchored `#ch-<i>`, then annexes.
- `renderMapFigure`: the `#wt-panel` moves OUT of `<figure>` to directly after it (still inside the section), the stylesheet drops `position:sticky` from `#wt-panel` (add `margin-top:12px`). Legend/caption unchanged. Add an opening block inside the panel: `<div id="wt-opening" hidden><strong id="wt-open-title"></strong><p id="wt-open-line"></p></div>` shown only at step 0 by the script (data carries `opening`).
- `renderChapters(doc, t, wt)`: per step: `head` = `<span class="src">${source}</span>${wt.kinds[s.kind] || wt.sections[s.section]}`; `h3` title; **narrative first** (`noteBlock(s.narrative || s.authorNote, t)`), then the evidence block by kind, obeying `doc.blocks`:
  - company: `identity` line (block `identity`) + status words (dissolved/concurso) + capital/activity lines when present; `board` table (`board`, columns name/role/since/status); `filings` table (`filings`); `findings` list with dates (`findings`); `unseen` list (always, under its subhead); `ownership` lines (always).
  - person: `seats` table (columns company/role/since/until/status).
  - sub-heads from `wt.subheads`; status words from `wt.statusWords`.
- `renderAnnexes`: exclude companies whose nodeId is a step; exclude connectors whose nodeId is a step; ownership lines already inside a company chapter are excluded (compare owner/owned names against chapter titles); corrections unchanged; the whole section omitted when every annex is empty (`return ''` and the contents strip skips it — update `sectionList`).
- Numbering: recompute `num` from the same `sectionList`; add a test that `h2 span.num` values match the contents order for the four summary×steps cases and the "no annexes" case.

**Script:** `singleZoom` 1.3: change `scale = xs.length === 1 ? 2` → `1.3`; show the opening block at `i === 0` (set `wt-open-title`/`wt-open-line` from `data.opening`, `hidden = i !== 0`); render `step.summary || step.text` in `#wt-text` and the first evidence line in a new `#wt-ev` (company: `evidenceLine` precomputed by `buildExportHtml`; person: same); `#wt-note` gets a `<span class="who">` eyebrow with `data.noteLabel` (`Nota del autor`) before the text — build it with `createElement`/`textContent`, never innerHTML.

**buildExportHtml:** embed `{ steps: [...], opening: doc.opening || null, noteLabel: t.authorNote }` where each embedded step carries `kind`, `kindLabel`, `sourceLabel`, `summary`, `evidenceLine` (computed here from `s.evidence`), `narrative`, `nodeIds`, `linkKeys`, `title`, `flag`. Keep `authorNote` for old callers.

**Style:** `.chapter table` compact (`font-size:.82rem`), `.chapter h4` for sub-heads (`font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:14px 0 4px`), `.kv` line for capital/activity (`color:var(--muted)`), `#wt-panel{margin-top:12px;…}` without sticky, `#wt-opening{border-bottom:1px solid var(--line);margin-bottom:8px;padding-bottom:8px}`, `#wt-ev{color:var(--muted);font-size:.86rem;margin:0 0 6px}`.

- [ ] **Steps:** tests first for: contents per chapter; narrative before evidence in a company chapter; block toggles omit sub-blocks; person chapter renders the seats table; annexes exclude covered rows and the section is omitted when empty; no `position:sticky` for `#wt-panel` in the style; script contains `1.3` and `wt-opening` and no `</script>`; build embeds `opening` and `evidenceLine`; escaping test with a hostile narrative and a hostile board name. RED → implement → GREEN → `npm test`. Commit `feat(export): the situation report is a dossier — one chapter per step, narrative first, sourced evidence under it`.

---

### Task 8: Graph wiring

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx`

- [ ] Selection: `const walkthroughSelection = useMemo(() => Array.from(investigationSet), [investigationSet]);` and `const setWalkthroughSelection = useCallback(next => setInvestigationSet(new Set(next.map(normalizeNodeId))), []);` — declare BEFORE the `useWalkthrough` call; pass `selection`, `setSelection`, `fetchProfile: ({groupKey, name}) => spanishCompaniesService.getCompanyProfileV3(name, { groupKey })`, `fetchEvents: ({groupKey, name, size}) => spanishCompaniesService.getCompanyEventsV3(name, { groupKey, size })`, `fetchFindings` (existing).
- [ ] Toolbar: tooltip = `walkthroughCopy(uiLanguage).hint(platformModifier(navigator))` on a second line under the existing tooltip text (join with `' — '`); wrap the button in a `Badge badgeContent={walkthroughSelection.length || 0}` shown only when > 0 (same pattern as the situation-report badge).
- [ ] Player: pass `opening={walkthrough.opening}` and `showOpening={walkthrough.index === 0}`.
- [ ] Modal: pass nothing new except `onPreview` already exists (fires `walkthrough_preview`); `relDoc` adds `blocks: sitrepAuthor.blocks`, `mode: walkthrough.mode`, `opening: walkthrough.opening`.
- [ ] `npx vite build` (discard drift); `npm test`; commit `feat(graph): walkthrough reads the Cmd/Ctrl+click selection; hint and badge on the button`.

---

### Task 9: Live verification

- [ ] Dev server on :5173. INDITEX wide graph: Cmd+click three nodes (two companies, one person) in a chosen order → Recorrido: opening card says 3 pasos, selection line; steps follow the order; company card shows the identity line and one evidence line; person card shows seats. Move a step in the modal → the graph selection order changes (badge count constant). Hide a step; add a note in the player; open preview in a new tab: contents list the chapters by name, chapter 1 shows the narrative then the board table; annexes omit the selected companies. No selection → the drafted fallback: no repeated title. A 0-officer SL alone: one company step. Console clean.
- [ ] Downloaded file: card under the map, single-node zoom moderate, opening block at step 0, note label present, page scrolls over the map.
- [ ] Update the v2 spec status line; commit `docs(spec): walkthrough v2 implemented; record the live check`.
