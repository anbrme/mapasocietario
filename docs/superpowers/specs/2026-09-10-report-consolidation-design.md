# Report consolidation: one paid document, one free artefact

**Date:** 2026-09-10
**Repos:** `mapasocietario` (frontend), `ncdata-bormes-impl` (DD generator)
**Status:** design approved, not yet implemented

## The decision

There were never three reports. There is one Python generator with three modes
(`_VALID_DD_MODES`, `borme_dd_report.py:2091`) plus a separate, unrelated
client-side report in the graph. The offer collapses to two artefacts split by
provenance:

1. **Due diligence report** — faithful, paid, authoritative, citable. Server
   rendered. Never contains user edits; that is what makes it worth money.
2. **Informe de situación / Situation report** — free, client-side, a
   self-contained interactive HTML file carrying the user's map, corrections and
   notes. Non-authoritative by genre, not by disclaimer.

The line the product draws: **you pay for evidence, not for your own notes.**

## Why "situation report"

An *informe de situación* is a genre in which the author is the authority — a
dated, provisional assessment of where things stand. That is exactly this
artefact's status, so the label carries the non-authoritative meaning without a
warning chip doing the work. It also survives the empty case: a map with no
notes is still a situation report, it just says less.

`Interactivo` is deliberately **not** part of the name. Naming the medium ages
badly, and the graph toolbar button runs `whiteSpace: 'nowrap'` in a crowded
row — four words do not fit. It appears as a descriptor beside the control
("se abre en tu navegador"), never as part of the label.

Rejected: *Investigation report* — `investigationSet`
(`SpanishCompanyNetworkGraph.jsx:1676`) and the "Investigar selección" button
already own that word in the UI, and they open the **paid** AI Investigation
panel. A free control named "Investigation" inches away from a paid one named
"Investigar" is worse than the collision it was meant to avoid.

## Finding: the server-side relationship mode is orphaned

Verified across every repo on this machine. Nothing sends `mode: "relationship"`:

- `mapasocietario`: `DDCheckoutDialog.jsx:307` initialises `mode` to `faithful`;
  the only toggle (`:936`) offers `faithful | amended`. No occurrence of
  `'relationship'` as a mode anywhere in `src/`.
- The graph's "Informe de Relaciones" (`:9170`) is fully client-side:
  `extractVisibleScope` → `RelationshipReportModal` → `buildReportHtml`
  (clipboard) or `window.print()`. No network call.
- `spanish-companies-mcp-server`: has its own `find_company_relationships`
  (`spanish-companies-client.ts:320`) — a shared-officer ES query. Different
  thing, no PDF, never calls `/bormes/dd-report/*`.
- `local-rag`, `borme-mcp`, `borme-public-api`, `ncdata_landingpage`: no
  `dd-report` caller.
- Backend: `generate_relationship_report` is imported by exactly one caller —
  the route in `borme_dd_report.py:12370`.

`amended` loses its only caller too once the client-side artefact carries
corrections, so the generator collapses to a single mode.

**Unrelated hazard noticed:** `ncdata_infra/bormes/borme_dd_report.py` is a stale
vendored copy (8.6k lines vs the live 12.4k). Out of scope, but it will bite
someone.

## Which relationship implementation survives

The client one. They are not two versions of one thing:

| | Server (`borme_relationship_report.py`, 199 lines) | Client (`relationshipScope.js` + `relationshipReportHtml.js` + modal, 398 lines) |
|---|---|---|
| Input | subject `group_key`s, refetched from ES | the **visible graph** — post-merge, post-hide, post-delete, post-expand |
| Corrections | re-applies the PG overlay per subject | already baked in; the graph *is* the corrected view |
| Officer scoping | executive-or-connector rule | visible-node rule |
| Node notes | cannot see them | `userNote` sits on the node objects it already walks |

The server can never see the user's work. Corrections are the only part of that
work that is server-side, and only because the paid faithful pipeline needs
them. Merges, deletions, canvas membership and notes exist solely in browser
state; moving ownership to the server means shipping whole graph state to Python.

## What the user's work actually is

| Work | Where it lives | Reaches a document today |
|---|---|---|
| Node notes | `graphData.nodes[].userNote = {text, flag}`, flags `none\|amber\|red\|blue\|green`, 2000 char cap (`nodeNotes.js`) | No |
| Corrections | Postgres, keyed `client_id`+`group_key`; graph holds only `correctionsCount` | No |
| Structural edits | merges (destructive, no marker), deletions, `hiddenNodeIds`, `pinnedNodeIds` | No |
| Network note | **does not exist** | — |

## Backend changes (`ncdata-bormes-impl`)

Deletions only. No new capability.

- Delete `borme_relationship_report.py`.
- Delete `generate_relationship_report` and the `mode == "relationship"` branch
  of the `/bormes/dd-report/company` route (`borme_dd_report.py:12362`).
- `_VALID_DD_MODES` collapses to `faithful`; `_resolve_mode` becomes redundant
  and goes with it.
- Delete `_render_amended_provenance` (`:9134`) and the amended pipeline.
- The corrections API (`/bormes/corrections`, `:12614`) and `borme_corrections.py`
  **stay** — the graph still reads and writes corrections, and they now surface
  in the situation report instead of in a PDF someone paid for.

Rationale for full deletion over dormancy: the generator should be incapable of
producing a non-authoritative document, so it can never be mistaken for one.
Dead modes in a 12.4k-line file are a reasoning tax, and this codebase already
demonstrates the cost of stale copies.

## Frontend changes (`mapasocietario`)

### Document model — `src/utils/investigationDoc.js` (new, pure)

Signature: `(filteredGraphData, scope, networkNote, corrections) → doc model`.

**Note collection is independent of relationship scoping.** `extractVisibleScope`
returns only names and its rule drops officers appearing at a single company —
but a user who wrote a note on such a node meant it. Notes are gathered by
walking `filteredGraphData.nodes` for `hasNodeNote`, then joined to scope
entries by node id. Hidden nodes are excluded for free (`filteredGraphData`
already excludes them), which is the correct default: the document shows the
graph you are looking at.

Model sections:

1. `networkNote` — the opening paragraph
2. `flagged` — `red` and `amber` notes, subject + flag + text. **Omitted
   entirely when empty**; not a header waiting to be filled.
3. `companies` — existing scope list, each carrying its note
4. `connectors` — existing shared-connections table, each carrying its note
5. `ownership` — existing
6. `otherNotes` — notes on nodes in neither of the above, so nothing typed
   silently vanishes
7. `corrections` — "what I changed", itemised

Corrections are cheap to itemise: writes are gated on `primarySubject`
(`SpanishCompanyNetworkGraph.jsx:5339`), so in practice only that company has
any, and `subjectGroupKeyCache` already holds its resolved key. One
`listCorrections` call.

**Out of scope: structural edits.** Merges leave no marker on the surviving node
(`mergeUndo.js` snapshots for undo, not provenance); deletions and hides are
absences. Representing them means adding provenance state to every mutation —
a separate feature. The document reports what it shows; it does not claim to be
a diff against the registry.

### The network note

One string. Held in component state, written into the snapshot's existing
`context` slot beside `primarySubject` (`:8263`), so it survives export/import
with **no snapshot version bump**. Rendered as the document's opening paragraph.

Entry point: an editable field at the head of the situation-report modal. There
is no node to right-click for a note about the whole map, and writing the
summary while looking at what it summarises is the right moment. No new toolbar
button, no new dialog.

### Interactive export — `src/utils/investigationExport/` (new)

A single self-contained `.html` file: inline `<style>`, inline node/link JSON,
vanilla JS. No CDN, no library, no network. Opens offline, survives email,
prints from the browser.

**The layout is already solved.** `graphSnapshot.js` strips `index`, `vx`, `vy`
but deliberately keeps `x`/`y` — d3-force has settled the positions and they are
already treated as real state. The export needs no physics engine and no layout
algorithm: it draws nodes at coordinates it already has, as SVG.

Modules: model → SVG renderer → walkthrough script → template assembly. The
first three are pure string-building and unit-testable; the walkthrough JS is
the only untested-by-default surface and must stay small enough to read.

**Walkthrough.** Derived from `flagged`, ordered red before amber. Next/previous
steps centre and highlight the step's node, dim the rest, and show its note.
Absent when nothing is flagged — the file is then a static annotated map.

**Theme.** Colours inline, not inherited. Readable in light and dark. Flag names
are the persistence contract (`nodeNotes.js:14`) so the export maps names to its
own palette, never reading `src/theme/palette.js` values at export time.

**Identity.** Attributed but clearly non-authoritative: NC Data /
mapasocietario.es mark, generation date, a line stating the data is
registry-derived and the notes are the author's, and a link back to the company
page. Enough provenance for a forwarded file to be credible and traceable;
never styled as a Mapa Societario deliverable, which would re-create the
comparison with the paid report that the naming decision exists to avoid.

### Surface

**Toolbar** (`SpanishCompanyNetworkGraph.jsx:9125–9200`):

- Both buttons are currently `variant="contained"` primary with the same glow
  shadow and compete for the same eye. Paid DD stays contained; the situation
  report becomes outlined.
- The `visibleCompanyCount >= 2` gate is dropped. That gate is correct for a
  report *about relationships between subjects* and wrong for a document
  carrying your notes — it currently leaves someone who annotated one company's
  board with nowhere for that work to go, which is the hole this closes. New
  gate: `visibleCompanyCount >= 1` — i.e. at least one *pinned* company still
  visible, keeping the existing subject definition (`relationshipSubjectIds`
  = `pinnedNodeIds`, `:7100`) unchanged.

**Delete the vestigial resolve.** `openRelationshipReport` (`:7123`) awaits a
`resolveGroupKey` per company and **refuses to open** if fewer than two resolve.
That exists only to build `subjects` for the dead server call. A user must not be
blocked from their own notes by a lookup for a caller that no longer exists.

**Modal.** `RelationshipReportModal` becomes the situation-report preview:
network-note field at the head, then the document model, language toggle
retained, one primary action — **Download**.

- `window.print()` goes: the exported HTML prints better from the browser, and
  printing a modal was always a workaround.
- Copy-for-Word **stays**. `relationshipReportHtml.js` (56 lines) already
  exists, renders cleanly from the new model, and is the path for someone
  pasting into their own memo.

**Checkout** (`DDCheckoutDialog.jsx:908–965`): the `Company-based | Custom (n)`
toggle is deleted along with `mode`, `account_id` and `group_key` from both
payloads (`:568`, `:709`). The surrounding box **stays** and becomes a
statement, shown when `correctionsCount > 0`:

> This report reproduces the registry as filed. Your N corrections aren't in it —
> they're in your situation report.

…with a control that opens the situation report. Deleting the box outright would
let a user with corrections pay without learning their corrections are not in
what they bought. This is the only place in the product where the paid/free line
is stated to someone with money on the screen.

**Accepted risk:** this can cost sales. A user who wanted corrections in a PDF
learns they cannot have that, and some fraction will close the dialog. The trade
is deliberate — a buyer surprised by a report that contradicts their own
corrections is a refund and a trust problem, not a sale.

## Copy

| Surface | ES | EN |
|---|---|---|
| Toolbar button | Informe de situación | Situation report |
| Descriptor | se abre en tu navegador | opens in your browser |
| Modal title | Informe de situación | Situation report |
| Primary action | Descargar | Download |
| Filename | `Informe_de_situacion_<COMPANY>_<YYYYMMDD>.html` | `Situation_report_<COMPANY>_<YYYYMMDD>.html` |

## Testing

- `investigationDoc.js` — unit: note collection independent of scoping; notes on
  non-connector officers reach `otherNotes`; hidden-node notes excluded;
  `flagged` omitted when empty; corrections itemised.
- SVG renderer + template — unit: string output, both themes, escaping of
  user-supplied note text (notes are user input rendered into HTML — XSS
  boundary, must use the existing `esc` discipline from
  `relationshipReportHtml.js`).
- Walkthrough JS — kept small; covered by one integration check that the
  exported file opens and steps.
- Regression: `relationshipScope.js` behaviour unchanged (`graphUnify.test.js`,
  existing scope tests still pass).
- Backend: assert the route rejects/ignores a `mode` other than faithful; delete
  the relationship-mode tests along with the module.

## Deployment order

The two repos can ship independently, but in this order:

1. **Frontend first.** Once the client stops sending `mode`, the backend's
   `amended` and `relationship` branches are provably unreachable.
2. **Backend second.** Deleting the branches while an old cached client still
   sends `mode: "amended"` is safe — `_resolve_mode` already falls back to
   `faithful` for unknown values, and after collapse an unknown `mode` key is
   simply ignored.

## Explicitly out of scope

- Structural-edit provenance (merge/delete/hide history in the document)
- Server-side rendering of the situation report
- Any change to the corrections API or `borme_corrections.py` logic
- The stale `ncdata_infra/bormes/borme_dd_report.py` copy
- Note-affordance discoverability beyond the network-note field (node notes stay
  on the right-click context menu)

## Open items

- Node-note discoverability: notes are only reachable via node right-click. If
  the situation report makes notes load-bearing, the entry point may need work —
  measure first (`node_note_saved` is already tracked, `:5683`).
- Analytics: `relationship_report` toolbar event should be renamed, which breaks
  the existing GA series. Decide whether to rename or keep the key and relabel.
