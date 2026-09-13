# Walkthrough v2: a selection told in order, exported as a dossier

**Date:** 2026-09-13
**Repo:** `mapasocietario` only (frontend). No backend change.
**Status:** design approved in chat 2026-09-13, not yet implemented
**Supersedes parts of:** `2026-09-12-drafted-walkthrough-design.md` (the draft
engine's section spine and the export's chapter/annex split). Everything not
named here stays as v1 built it.

## What v1 got wrong

v1 shipped on 2026-09-13 and the first real use showed two things:

1. **The story anchors on the searched company.** The draft's spine is
   subject → what stands out → who connects → ownership → other companies →
   unseen → notes. On a wide or imported graph the first four cards all carry
   the subject's name with a different registry sentence each, so the
   walkthrough reads as a company profile spread over cards, not as a story of
   the network. The user's model is the right one: a walkthrough is **a
   selection of entities, in the order the author chose, each explained by
   the author.**
2. **The exported file is a map plus tables.** Chapters carry one sentence
   each; everything with substance sits in annex tables. A document that
   "supports a story" needs each chapter to carry the author's reading and
   the sourced values that back it.

Two presentation defects came with them: in the file the step card floats over
the map and a single-node step zooms so far that the label fills the frame;
in the app the preview is cramped inside a 70 %-height dialog.

## The decision

**A walkthrough is the author's selection.** Nodes are selected on the graph
with Cmd+click (Mac) or Ctrl+click (Windows, Linux), the same multi-select the
graph already has (`investigationSet`, a `Set` of node ids in insertion
order). Each selected node is one step in the player and one chapter in the
document, in selection order. The author's note on the node is the chapter's
lead paragraph. The sourced values under it are ours.

**No selection: the product drafts a fallback.** One card per visible
company, the subject first, each carrying identity plus its single top
finding; then the connectors; then the notes. No title repeats.

**The document becomes a dossier.** Cover, contents, summary, the map as a
figure with the click-through walkthrough, then one chapter per step with the
author's narrative and an evidence block, then only the annex tables that are
not already inside a chapter.

Decided in chat, not to be relitigated: the selection cap is **12** entities;
chapters show **only what the graph shows** (no fresh neighbour fetch), so
"what you see is what you export" stays true. The AI panel keeps its own
button (`Investigar selección`); it reads the same selection but is not part
of this feature.

## What the user sees

### Selecting

- Cmd/Ctrl+click toggles a node into the selection, as today. The `Recorrido`
  tooltip gains the hint: *"Selecciona nodos con ⌘+clic (Ctrl+clic en
  Windows/Linux) para elegir los pasos. Sin selección, se genera un
  borrador."* / *"Select nodes with ⌘+click (Ctrl+click on Windows/Linux) to
  choose the steps. With no selection, a draft is generated."* The modifier
  glyph follows the platform (`navigator.platform` / `userAgentData`).
- The `Recorrido` button carries a badge with the selection count when the
  selection is non-empty (same `Badge` the situation-report button uses for
  companies).
- Above 12 selected, the button stays enabled but the walkthrough takes the
  first 12 in selection order and the opening card says so.

### Player (live)

- **Opening card**, always step 0, never hidden: *"Recorrido por esta red ·
  {N} pasos"* with one line beneath: *"Tu selección, en el orden elegido"*
  when selection-driven, or *"Borrador generado: empresas, conexiones y tus
  notas"* when drafted. Focus: the whole set of step nodes, fitted.
- Then one card per step. Company card: identity line, top finding, the note
  field. Person card: "{name} · {k} cargos en {m} empresas visibles", the note
  field. Section eyebrows become **entity-type eyebrows**: `Empresa` /
  `Persona` / `Nota`, with the source chip as today.
- Everything else as v1 (camera follow, dimming, arrows, Escape, hide, notes
  writing through to the node note).

### Modal

- The Recorrido list is the selection in order, editable as today (move,
  hide, note). Moving a step re-orders the selection itself, so the graph
  selection and the list never disagree. Reset clears hidden steps and notes,
  not the selection.
- **Document blocks**, one row of four checkboxes above the list, global for
  the document: `Identidad`, `Órgano de administración`, `Últimos actos`,
  `Lo que destaca`. Default all on. Persisted with the author fields in
  `localStorage` (`sitrep_author` gains `blocks`).
- **Preview opens in a new tab** (Blob URL, `window.open`) instead of an
  iframe. The tab is the actual file, so it doubles as "open before
  downloading". `walkthrough_preview` tracks the click.

### Document

Top to bottom:

1. Cover (as v1).
2. Contents: summary, map, one line per chapter (`01 ACME IBERIA, SL`, `02
   GARCIA LOPEZ MARIA`, …), annexes.
3. §Resumen (as v1).
4. §Mapa: the figure, legend, caption. The walkthrough card sits **under**
   the map, not sticky over it. Single-node zoom is 1.3 (was 2). Focus mode
   dims as today.
5. **§Recorrido, one chapter per step:**
   - eyebrow: `01 · Empresa · Registro (BORME)` (or `Persona · Del mapa`);
   - title: the entity name;
   - **narrative**: the author's note as the lead paragraph, in the
     `Nota del autor` block style. Absent note → the chapter has no lead,
     never a placeholder;
   - **evidence block** (company): identity line; status and capital;
     declared activity; the governing body as a compact table (name, role,
     since, status) built from the visible graph links and the officer
     rows the inspector already loads; the last three filings (date, type);
     the top findings with dates; the "cannot be seen" lines. Each
     sub-block obeys the document toggles;
   - **evidence block** (person): a table of every seat across the visible
     companies (company, role, since, until, status) from the graph links;
   - ownership relations of a selected company appear inside its chapter as
     one line each (`es socio único de …` / `fue socio único de …`).
6. §Anexos: only tables not already covered by a chapter — companies on the
   map that are not steps, shared connections not selected, corrections.
   When every company is a chapter the connections annex is the only one
   left, and it is omitted when empty.
7. Footer (as v1).

The card in the file and the chapter in the document are two renderings of
the same step object; the card shows title, narrative and the first evidence
line, the chapter shows everything.

## Data model

```js
Step {
  key, nodeId, kind: 'company' | 'person',
  order,                        // selection position, 0-based
  title,
  narrative: { text, flag } | null,     // the node note
  identity: string | null,              // company: identity line
  status: { dissolved, concurso, lastFiling } | null,
  capital: string | null,
  activity: string | null,
  board: [{ name, role, since, status }],     // company
  seats: [{ company, role, since, until, status }],  // person
  filings: [{ date, type }],           // last three
  findings: [{ text, date, cls }],     // top 3 for a selected company
  unseen: [string],
  ownership: [{ owner, owned, lost }],
  nodeIds, linkKeys,                   // focus, as v1
}
```

Keys: `step:<nodeId>`. The v1 overlay (`walkthroughEdits`) keeps working
unchanged: `hidden`/`notes` by key; `order` is no longer needed because
selection order is the order, but a stored `order` is honoured for drafted
(no-selection) stories.

## Where the values come from

All already fetched by the app; nothing new on the wire.

| Value | Source | Already cached |
|---|---|---|
| identity, status, capital, activity, filings | `spanishCompaniesService.getCompanyV3(groupKey)` (`{company:{…}}`) — the inspector's preview call | yes, `requestCache` |
| findings, unseen | `getCompanyFindings({groupKey,lang})` | yes |
| board (company) / seats (person) | the visible graph's links: `relationship`, `category`, and the v3 officer rows (`appointed_date`, `resigned_date`, `position_normalized`) the inspector's `buildInspectorDatasets` already shapes | in graph state |
| ownership | `relationshipScope.ownership` | in graph state |

Loading: for each selected company (≤ 12) fire the two calls in parallel
under the v1 loader (cap 12, wait 4 s). Persons need no fetch. A failed fetch
degrades that chapter to the graph-only lines, never blocks the walkthrough.

## Draft engine changes

`draftWalkthrough` gains a `selection: string[]` input (ordered node ids).

- **Selection present:** steps = selection ∩ visible nodes, in order, capped
  at 12, each built by `companyStep` / `personStep` from the data above.
  Notes on unselected nodes do **not** become steps (the author chose the
  steps); they still reach the annexes as today.
- **No selection:** fallback spine = subject company (identity + top finding
  in ONE step), other visible companies (one step each, identity + top
  finding), connectors (one step each), then author notes on unfocused
  nodes. `stands_out` and `unseen` sections disappear as separate steps; the
  unseen lines live in the company step's evidence.
- The opening step is synthesised by the renderer/player from the step list,
  not stored, so it can never be hidden or reordered.

Pure, tested as v1: order follows selection; cap; visibility filter; a person
step's seats; a company step with failed fetch; fallback spine has no
repeated title; opening card counts.

## Files

| File | Change |
|---|---|
| `src/utils/walkthrough/draftWalkthrough.js` | selection mode + fallback spine; `companyStep` / `personStep` builders |
| `src/utils/walkthrough/walkthroughLoader.js` | load `getCompanyV3` alongside findings for selected companies |
| `src/utils/walkthrough/walkthroughCopy.js` | opening-card copy, entity eyebrows, selection hint, block labels |
| `src/hooks/useWalkthrough.js` | accept `selection`; `move` re-orders the selection when selection-driven |
| `src/components/SpanishCompanyNetworkGraph.jsx` | pass `investigationSet` (as ordered array) and a `setSelectionOrder`; tooltip hint + badge; preview → new tab |
| `src/components/WalkthroughPlayer.jsx` | opening card; entity eyebrows; first evidence line |
| `src/components/RelationshipReportModal.jsx` | block toggles; preview button (new tab) replaces the preview tab |
| `src/utils/sitrepAuthor.js` | `blocks` persisted |
| `src/utils/investigationExport/documentSections.js` | chapters with narrative + evidence blocks; annexes minus covered rows; card under the map |
| `src/utils/investigationExport/documentStyle.js` | chapter evidence table styles; card no longer sticky |
| `src/utils/investigationExport/walkthroughScript.js` | single-node zoom 1.3; card shows the first evidence line; note label |
| `src/utils/investigationDoc.js` | steps carry the richer shape; `blocks` |

## Copy

| Key | ES | EN |
|---|---|---|
| Opening title | Recorrido por esta red · {n} pasos | Walkthrough of this network · {n} steps |
| Opening, selection | Tu selección, en el orden elegido | Your selection, in the order you chose |
| Opening, draft | Borrador generado: empresas, conexiones y tus notas | Generated draft: companies, connections and your notes |
| Opening, capped | Se muestran los 12 primeros de {n} seleccionados | Showing the first 12 of {n} selected |
| Eyebrows | Empresa · Persona · Nota | Company · Person · Note |
| Hint | Selecciona nodos con ⌘+clic (Ctrl+clic en Windows/Linux) para elegir los pasos. Sin selección, se genera un borrador. | Select nodes with ⌘+click (Ctrl+click on Windows/Linux) to choose the steps. With no selection, a draft is generated. |
| Blocks | Identidad · Órgano de administración · Últimos actos · Lo que destaca | Identity · Governing body · Latest filings · What stands out |
| Chapter sub-heads | Órgano de administración · Últimos actos · Lo que destaca · Lo que el registro no muestra · Cargos en las empresas del mapa | Governing body · Latest filings · What stands out · What the registry cannot show · Seats across the companies on the map |
| Preview action | Abrir vista previa | Open preview |

Registry sentences stay the endpoint's own text; the values above are
rendered from fields, never paraphrased.

## Analytics

Existing names stay. `walkthrough_start` gains `{ mode: 'selection' |
'draft', steps }`. `walkthrough_preview` fires from the new-tab action.

## Testing

Engine and loader as pure tests (above). Document: chapter renders narrative
before evidence; block toggles omit sub-blocks; annexes exclude covered rows;
opening card count; card under the map (no `position:sticky` on
`#wt-panel`); single-node zoom constant. Live check: a 4-node selection
across two companies and one person on a wide graph; the no-selection
fallback on the same graph; a downloaded file opened in a new tab; a phone.

## Out of scope

Fresh neighbour fetches beyond the graph (decided); per-chapter block
toggles; a model-written narrative; a hosted share link; changes to the AI
investigation panel or its button.
