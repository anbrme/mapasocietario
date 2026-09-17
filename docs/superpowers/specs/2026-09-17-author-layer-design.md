# The author layer: links and entities the analyst adds, and registry links the analyst dismisses

**Date:** 2026-09-17
**Repo:** `mapasocietario` only (frontend). No backend change. Nothing new goes to the corrections API.
**Status:** design, agreed in chat 2026-09-17; awaiting review of this document.
**Builds on:** corrections overlay (hide / merge / mark resigned), node notes, graph snapshot, situation report (walkthrough v4, sitrep polish 2026-09-14).

## The problem

The graph is already an analyst's workspace. It lets the analyst hide, delete,
merge and rename nodes, mark officers resigned or active, and write flagged
notes, and the situation report records those as "Corrections applied by the
author". Two things the analyst cannot do:

- draw a relationship BORME does not hold, or put an entity on the map that
  BORME does not name;
- take a BORME relationship off the map while keeping the record that it was
  taken off.

The case that surfaced it: a group whose sole shareholder is a Dutch company.
BORME names the Dutch company, so it is on the map. Three of its directors are
on the map for other reasons, but nothing joins them to it. A fourth director
is not on the map at all. Today the analyst can only write that in a note.

The paid report reproduces the registry as filed and stays that way. The
situation report is the analyst's document, and it must be able to carry the
analyst's work, provided every element says where it came from.

## The rule

**Every element on the map carries its provenance, and that provenance
survives every transform.** Absence of provenance means BORME. An element the
author adds says so on itself, in the graph, in the snapshot file, in the
exported map, in every table that lists it and in every chapter that walks
across it. The rule replaces the earlier instinct of "no analyst nodes": what
protects trust is attribution, not prohibition.

Consequences the rest of this document spells out:

- Author elements never reach search, the company pages, the MCP connector,
  analytics payloads by name, or the paid report. They live in graph state and
  the snapshot file and appear in the situation report.
- Removing a BORME link is a **dismissal**, recorded and reversible, not a
  deletion. Removing an author element is a plain deletion.
- An author link is never presented as a seat or a filing. It has its own
  section, its own stroke, its own legend row, and its own column value in a
  connection chapter.

## Vocabulary

One word per surface, following the copy that already exists:

| surface | EN | ES |
|---|---|---|
| in-app (second person, as the selection toolbar already speaks) | Added by you | Añadido por ti |
| document (third person, as the corrections annex already speaks) | Added by the author | Añadido por el autor |
| the person | author | autor |

The word "analyst" appears nowhere in copy. "Custom" appears nowhere.

## Data model

### The `provenance` field

A new optional field on nodes and links, named `provenance`. Absent means
BORME, so none of the existing elements change and no snapshot migrates.

```js
// An element the author added
provenance: {
  by: 'author',
  citation: { text: 'KVK extract 12345678, 2026-09-10', url: 'https://…' } | null,
  asserted: '2026-09-10' | null,   // ISO day the relationship is claimed for; optional
  note: '',                          // free text, max 500
  at: '2026-09-17T10:21:00.000Z',    // when it was added
  author: 'Name from the sitrep author line' | '',
}
```

It is a source, not a boolean. The shape a future registry connector will use
is reserved now and not implemented:

```js
provenance: { registry: 'KVK', ref: '12345678' }
```

A helper module owns the predicates so no caller reads the field directly:
`isAuthorLink`, `isAuthorNode`, `isAuthorElement`, `isRegistryElement`.

### Author link

```js
{
  id: 'author-link-<random>',
  source, target,
  type: 'author',
  relationship: 'Director',      // the label the author typed, max 80, required
  category: 'author',
  directed: true | false,        // arrowhead from source to target when true
  date: '2026-09-10' | null,     // mirrors provenance.asserted so linkDates keeps working
  provenance: { by: 'author', … },
}
```

Why `type: 'author'` and `category: 'author'`: every gate in the painter, the
filters, the seat tables and the hop builder decides on `type` or on the
effective category, and a value neither branch recognises is how the link
stays out of "seats", out of the ceased filter and out of appointment/cessation
colouring without touching those branches. `getLinkEffectiveCategory` returns
`category` unchanged for a link with no events, so it already yields `'author'`.

Suggested labels are offered as chips and seed the field only: Director,
Shareholder, Beneficial owner, Family, Same address, Business partner (ES:
Administrador, Socio, Titular real, Familia, Mismo domicilio, Socio de
negocio). No vocabulary is enforced.

### Author node

```js
{
  id: 'author-node-<random>',
  name: 'J. de Vries',              // required, max 120
  type: 'officer' | 'company',      // person → officer/individual, company → company
  subtype: 'individual' | undefined,
  country: 'NL' | '',               // ISO-3166 alpha-2, optional
  identifier: 'KVK 12345678' | '',  // free text, optional
  provenance: { by: 'author', … },
  x, y, fx, fy,                     // placed where the author asked, pinned like other new nodes
}
```

Kind decides `type` so that everything downstream that asks `isCompany` or
`type === 'officer'` (inspector body, seat tables, merge group type, colours)
treats the node as what it is. Provenance decides the ring. **Kind by fill,
provenance by ring.**

Its own id namespace (`author-node-`) means a later expansion that brings a
BORME officer with the same name creates a second node rather than silently
fusing with it. Joining them is the author's decision, through the existing
merge gesture.

### Dismissed registry link

A dismissal is stored on the link, so it rides along with rebinding, merges and
the snapshot:

```js
dismissed: { by: 'author', reason: 'Superseded; see KVK extract', at: '…' }
```

The visible-graph filter drops dismissed links the way it drops hidden nodes.
The link stays in `graphData` and is restorable. A dismissal never calls the
corrections API: the API vocabulary is officer edits by name, and a link has
no name.

### Renamed registry node (adjacent gap, closed here)

"Edit node" already lets the author rename a registry node, and the report then
prints the new name as if it were filed. Renaming a registry node now records
`provenance: { renamedFrom: '<registry name>' }` on the node (registry nodes
otherwise have no `provenance`, so the presence of `renamedFrom` alone marks
it). Author nodes renamed later just update `name`.

## Operations

### Add a link between two nodes on the map

Entry points:

1. Right-click node A → **Link to another node…** The graph enters pick mode:
   a snackbar reads "Click the node to link to *A*. Esc cancels", the cursor is
   a crosshair, and the next node click is the target. Clicking A itself, empty
   canvas, or Esc cancels. Pick mode reuses the pathfinder's start/end picking
   pattern, which already intercepts node clicks ahead of the inspector.
2. Selection toolbar, when exactly two nodes are selected (lasso or
   modifier-click) → **Link selected**.

Then one dialog: label (required, chips seed it), direction (A → B, B → A,
none; default none), source text, source URL (optional, must parse as http(s)),
date (optional), note (optional). Save adds the link and shows the existing
corrections snackbar with Undo (graph undo only, no API id).

Not a Shift gesture: Shift + hold on a node is the connection-focus gesture
and Shift + drag on canvas is the lasso.

### Add an entity

Entry points: the graph toolbar gains **Add entity…** next to Hide / Investigate;
right-click on empty canvas offers the same if the canvas already has a
background context menu, otherwise the toolbar alone. The dialog asks kind
(Person / Company), name, country, identifier, source, note. The node lands at
the right-click point or the viewport centre, pinned, and the inspector opens
on it so the author can immediately **Link to another node…** from there.

### Edit or delete an author element

Right-click an author node → **Edit entity…** / **Delete** (the existing
delete dialog; author nodes need no correction record). Author links are
edited or deleted from the inspector's relationship row of either endpoint, and
from the link's own context menu if link hit-testing proves workable (see
Risks). Deleting an author node deletes its author links; registry links never
touch an author node, so nothing else is affected.

### Dismiss a registry link

Entry point in v1: the inspector's relationship row for a registry link gains
**Dismiss…**, which asks for a one-line reason (optional) and dismisses. The
existing "Manage hidden nodes" menu becomes "Manage hidden" with two lists,
nodes and links, each row restorable. Undo in the snackbar.

Link right-click on the canvas is the natural gesture and is attempted in the
same phase; the inspector route is the guaranteed one.

### What author elements cannot do

Menu items and gestures that call the registry are hidden for author nodes:
expand (double-click and menu), load subsidiaries, data preview, timeline,
buy report, market data, mark resigned / active. Double-click on an author
node opens the inspector instead. The inspector shows an "Added by you" card:
kind, country, identifier, citation, note, author, date, with Edit.

Merge: an author node may be merged into a registry node or vice versa through
the existing gesture. When either side is an author element no correction is
posted; the surviving node keeps the registry identity if there is one, and
author links rebind to it.

## Context menus

The node menu is today one flat list of up to nineteen rows with a single
divider before Delete, mixing reads, registry fetches, edits and view changes.
The author layer adds rows to it and introduces two menus that do not exist
(link, canvas). All three follow one order, grouped by what the action does to
the investigation, separated by dividers, without subheaders:

1. **Read.** Company card / profile, officer timeline, apoderados, market data,
   buy report. Nothing changes.
2. **Fetch from the registry.** Expand / collapse, unify cargos / undo. The
   graph grows, provenance stays BORME.
3. **Author's work.** Link to another node…, add / edit note, edit node or
   entity…, merge / unmerge, mark resigned / active. Every row here ends in the
   situation report and every row carries the dotted violet glyph as its icon,
   so the family reads as one.
4. **View.** Hide node, hide node and relations.
5. **Delete.** Alone, last, as now.

On an author node groups 1 and 2 are absent and the menu is five or six rows.

Link menu (new): show filings (registry link, opens the data preview) · dismiss…
(registry) or edit link… (author) · delete (author only).

Canvas menu (new, right-click on empty canvas): add entity… · manage hidden… ·
fit to view.

Labels become verbs throughout ("Open timeline", "Show market data"), matching
"Hide node" and "Delete node". The touch long-press menu is the same component
and inherits the structure.

## Rendering

### Palette

`graph.link.author` and `graph.node.author`, one hue not yet spoken for.
Violet: `#a78bfa` on dark, `#6d28d9` on light. Amber is ownership, green
appointments, red cessations, slate unknown, teal origin; the note flags use
blue, green, red, amber.

### Canvas

- Author link: dotted, `setLineDash([1.5, 3.5])` with round caps, in the
  author colour, drawn by a new first branch in the colour decision so path
  highlight and tour dimming still apply on top. Label drawn like any other
  edge label. Arrowhead only when `directed`.
- Dismissed link: not drawn (filtered out).
- Author node: fill by kind, plus a dotted ring in the author colour at the
  radius the origin ring uses, without the glow. A node that is both origin
  and author cannot exist.
- Renamed registry node: no visual change on canvas; the inspector shows
  "Registry name: …".

Colour alone is not the signal. The dotted stroke and ring carry it in print,
in greyscale and for colour-blind readers.

### Legend

One row, dotted violet swatch, **Added by you**, shown only when the visible
graph contains at least one author element. The compact embed keeps its
two-item cap.

### Exported map (SVG)

`renderGraphSvg` stamps `data-kind="author"` on author lines and
`data-origin="author"` on author node groups. `documentStyle` adds
`stroke-dasharray:1.5 3.5; stroke-linecap:round; stroke:var(--author)` for
the lines and a dotted ring circle for the nodes. The map legend gains the
same row, again only when the document carries author elements.

Timeline: author elements with no `date` are undated and stay visible at
every date; with a date they appear from that date. They never cease. The
"undated" counter already exists and counts them.

## The document

### Model (`buildInvestigationDoc`)

A new `authorLayer` gathered by walking `graphData`:

```js
authorLayer: {
  nodes: [{ nodeId, name, kind, country, identifier, citation, note, at, author }],
  links: [{ from, fromId, to, toId, label, directed, citation, asserted, note, at, author }],
  dismissed: [{ from, to, relationship, reason, at }],
  renamed: [{ nodeId, name, registryName }],
}
```

The corrections list from the API stays as it is. `annexRows` and `hasAnnexes`
learn the new panel. Author elements never enter `chronologyEntries`, even
when dated: the chronology is the registry's.

### Where author work shows

1. **Under the byline**, when the layer is non-empty, one line: "This report
   contains elements added by the author, drawn dotted on the map and listed in
   the annex Added by the author." No count.
2. **Annex: Added by the author.** Two lists. Relationships: from, direction
   glyph, to, label, source (linked when a URL was given), date, note.
   Entities: name, kind, country, identifier, source, note. Each row names the
   author from the byline when set.
3. **Annex: Corrections applied by the author** gains two row kinds:
   "*A* — *B*: relationship dismissed (*reason*)" and "*name*: renamed from
   *registry name*".
4. **Chapters.** `personSeats` excludes `type === 'author'`, so an author link
   never appears in a seats table or in a chapter's evidence line. A person or
   company chapter whose node touches author links gets a short block titled
   "Added by the author" listing them, after the registry blocks.
5. **Connection chapter.** The hop builder marks a hop row that crosses an
   author link: `role` is the author's label, `status` is `asserted`, and a new
   `origin: 'author'` field drives an italic row with the dotted swatch in the
   hop table. The chapter summary line, when any hop is author-asserted, ends
   with "one link in this path was added by the author" (or "N links").
6. **Copy for Word** mirrors 1 to 5 in plain markup: the annex, the corrections
   rows, and "(added by the author)" after any asserted hop.

### Checkout warning

The paid-report dialog already warns a buyer with corrections that they are
not in what they are buying. The count it shows becomes corrections plus author
elements plus dismissals, and the copy stays as it is.

## Persistence and reach

- Author elements, dismissals and renames live on the elements in `graphData`
  and therefore in the snapshot file. The snapshot sanitiser passes unknown
  fields through; the format version stays 1 because the change is additive.
- Nothing is posted anywhere. `recordCorrection` is never called for author
  elements or dismissals.
- Analytics events (`graph_author_link_add`, `graph_author_node_add`,
  `graph_link_dismiss`, `graph_author_element_delete`) carry kind, directed,
  and whether a citation was given. Never a name, label or note. The existing
  interaction params helper must be checked for name leakage on author nodes
  before the events ship.
- Author names are never sent to autocomplete, expansion or any endpoint,
  which the disabled actions above guarantee.

## Out of scope

- Editing the label or category of a registry link (mark resigned / active
  remain the only amendments).
- Any styling choice beyond the one author stroke and ring.
- Saved investigations, accounts, sharing. The snapshot file is the workspace.
- Foreign registry connectors. The `provenance.registry` shape is reserved.
- Author elements in the paid report, in search, on company pages, in the MCP
  connector.
- Author elements in the chronology.

## Risks

- **Link hit-testing.** The canvas uses a custom link painter, which disables
  the library's default pointer areas. Link click already works for
  officer-company links, so `linkPointerAreaPaint` is in place or the default
  suffices; right-click on links is unverified. The inspector route exists so
  the phase does not depend on it.
- **Identity collision.** An author node and a registry node with the same name
  can coexist by design. A future nicety is a hint in the inspector when a
  registry node with a matching folded name is on the map. Not in v1.
- **Filters that prune orphans.** Turning off shareholders drops nodes that
  became orphaned; an author node whose only links are author links is not
  affected because author links survive that filter. Keep it that way.
- **Copy load.** Two languages, roughly twenty new keys in the graph copy, ten
  in the export copy, six in the walkthrough copy.

## Phases

1. **Model and canvas.** Helper module with constructors, validators,
   predicates and the author-layer collector; palette; painter branches; legend
   row; dedupe bypass for `type === 'author'`; visible-graph filter for
   dismissals; add-link pick mode and dialog; add-entity dialog; disabled
   actions for author nodes; inspector card. Tests (pure logic, vitest, no
   jsdom): constructors and validators, predicates, dedupe bypass, filter keeps
   author links and drops dismissed ones, connections hop origin, seat
   exclusion, snapshot round-trip.
2. **Document.** `authorLayer` in the doc model; annex panel; corrections rows;
   chapter block; hop marking; byline notice; SVG attributes, stylesheet and
   map legend; Copy for Word. Tests on the section renderers and the Word path.
3. **Dismissal and rename provenance.** Inspector Dismiss, Manage hidden with
   links, restore, export rows; renamedFrom on Edit node; link right-click if it
   proves workable.
4. **Edges.** Checkout warning count, analytics events with the leakage check,
   hand-check on desktop and touch against the Dutch case.

Each phase ships on its own and leaves the product coherent without the next.
