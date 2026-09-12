# Drafted walkthrough: the story of a network, written before the user types

**Date:** 2026-09-12
**Repo:** `mapasocietario` only (frontend). No backend change.
**Status:** design approved 2026-09-12 (document design added same day), not yet implemented
**Builds on:** `2026-09-10-report-consolidation-design.md` (situation report),
`2026-08-24-company-findings-panel-design.md` (findings endpoint)

## The problem

The situation report can play a walkthrough of the graph, but only over nodes
the user has flagged red or amber. GA4 for the 90 days to 11 Sep 2026:

| Signal | Users |
|---|---|
| Activated the graph | 221 |
| Opened the relationship / situation report | 20 |
| Saved a node note | 0 |
| Downloaded a situation report (since the 10 Sep rename) | 2 |

Nobody writes notes, so the walkthrough has never played for a real user and
the exported file is a table dump with a map on top. Notes live behind a
right-click menu that nothing on screen points to. Improving the export cannot
fix this; the raw material is missing.

Meanwhile the backend already computes, per company, an ordered set of
findings with dates and evidence (`dd_findings.build_findings`, served free by
`GET /bormes/v3/company-findings`), and the graph already knows who connects
which companies (`relationshipScope.extractVisibleScope`). Nothing joins the
two into a sequence.

## The decision

The walkthrough is **drafted by the product and edited by the author**. On any
graph with at least one company, a "Recorrido" button plays an ordered story:
which entity this is, what stands out in the registry, who connects the
companies on screen, who owns whom, what the registry cannot show, and the
author's own notes. The same steps play in the exported situation report.

The author can reorder, hide and annotate steps. The product never writes a
sentence it cannot cite: every drafted step is either a registry finding the
endpoint already emits, or a structural fact read straight off the visible
graph. No model call.

The division of responsibility from the report-consolidation spec holds:
registry text is ours, notes are the author's, and the two are visibly
different things in every surface.

## Approaches considered

- **A. Client-side draft, no backend change — chosen.** The visible graph
  supplies the network steps; the findings endpoint supplies the per-company
  registry steps, already localised and evidence-linked. One repo, one deploy.
- **B. New backend walkthrough endpoint.** The server would own all wording,
  but it cannot see merges, hidden nodes or notes, and it needs a route, a
  proxy allowlist entry and two deploys. Revisit only if the story later needs
  the paid `dd_readings`.
- **C. Model-drafted steps.** Rejected for v1. It generates assertions into a
  file that leaves our control, and the deterministic draft must exist first
  regardless (the DD story model's own rule: the report must work with the
  model disabled).

## What the user sees

### Toolbar

A `Recorrido` / `Walkthrough` button beside `Informe de situación`, shown when
`visibleCompanyCount >= 1`. Tooltip: "Recorre esta red paso a paso: registro,
conexiones y tus notas" / "Step through this network: registry, connections
and your notes".

### Player (live, on the canvas)

Pressing the button prepares the draft (see Loading) and plays step 1:

- The canvas pans and zooms to the step's nodes (`fg.centerAt` + `fg.zoom`,
  the same calls `fitGraphToView` uses).
- Every node and link not in the step dims to `PATH_DIM_ALPHA`, through the
  same code path the pathfinder and shared-connections highlights already use
  in the node and link canvas callbacks. Highlighted links are drawn at full
  alpha in `PATH_HIGHLIGHT_COLOR`.
- A card docks at the bottom of the canvas (a bottom sheet on the mobile
  layout) with: section label, title, text, a source chip (`Registro (BORME)`
  / `Del mapa` / `Autor`), the date when there is one, and a "Ver evidencia"
  link when the step has an evidence ref.
- Below the text, one inline field: `Tu nota` / `Your note`. Typing here saves
  an author note on the step (see Edits). For a step whose source is `author`
  the field edits the underlying node note itself.
- Controls: `Anterior`, `Siguiente`, `n / N`, an eye icon that hides the step
  from the story, `Salir`. Arrow keys step, Escape exits.

Reordering does not happen in the player. The player is for reading and
annotating; ordering lives in the modal list.

"Ver evidencia" opens the existing inspector for the step's company node, or
the officer timeline dialog for an officer node. The company-findings block
was unmounted from the inspector on 2026-08-28 (`975ac80`), so there is no
findings row to jump to; the node surfaces are the evidence.

### Situation report modal

The `Señalado` block at the top of `RelationshipReportModal` is replaced by
the `Recorrido` list: one row per step in play order, with up/down buttons,
the hide toggle, the source chip and the author note (editable inline). A
`Restablecer borrador` / `Reset draft` link clears all edits after a confirm.

A second tab, `Vista previa` / `Preview`, renders `buildExportHtml(...)` into
an `<iframe srcdoc>` so the author sees the file exactly as a recipient will,
before downloading. Nothing new is rendered; the export string is the preview.

The rest of the modal (summary field, companies, connections, ownership,
corrections, Copy for Word, Download) is unchanged.

### Exported file

The walkthrough in the exported HTML plays the same merged steps. Four fixes
to `walkthroughScript.js`, all of which the drafted story needs to be usable:

1. **Pan to the step.** A step sets the viewport transform so the step's
   nodes are centred and, when a step spans several nodes, fit. Node
   coordinates are read from `data-x` / `data-y` attributes the SVG renderer
   adds to each `g.n`.
2. **Links are part of the story.** `renderGraphSvg` stamps `data-a` and
   `data-b` (endpoint ids) on each `line.l`; focus mode dims links whose
   endpoints are not both in the step and draws the step's links at full
   opacity in the company colour.
3. **Touch.** Mouse listeners become pointer listeners; pinch zoom is handled
   via two-pointer distance. A file forwarded on WhatsApp opens on a phone.
4. **Two voices in one card.** The registry text and the author note render
   as visibly different blocks: the note carries the flag colour bar and an
   `Autor` label; the registry text carries the source chip and date.

The `Recorrido` button in the file is shown whenever there is at least one
step, which after this change is always.

### The file as a document (added 2026-09-12)

The current export is a map with tables under it. It becomes a **document
with an author**, in the genre its name already claims. Identity decision,
user's: *authored document, sourced by us*. Mapa Societario appears only in
the source and coverage lines. No wordmark, no brand band: the file must not
be mistakable for the paid due diligence report, and it carries the author's
unverified notes, which must not sit under our name.

**Structure, top to bottom:**

1. **Cover block.** Eyebrow `INFORME DE SITUACIÓN`; the subject name as the
   title; a meta line with date and, when given, `Elaborado por {author} ·
   {organisation}`; then the status line ("Documento no autoritativo —
   redactado por su autor, no por el registro") as a quiet rule-bordered
   note, not a warning box.
2. **Contents strip.** Numbered section list with counts (7 pasos, 3
   empresas, 2 conexiones). Anchors.
3. **§1 Resumen.** The network note as a lead paragraph in larger type.
   Omitted when empty.
4. **§2 Mapa.** The SVG as a figure with a legend row (company, person,
   ownership edge, flagged ring) and a caption: "{N} empresas · {M} personas
   · {K} conexiones compartidas · disposición del autor". The walkthrough
   controls sit inside the figure frame, top right, small, hidden on print.
5. **§3 Recorrido.** The steps as numbered chapters: `01`, an eyebrow with
   the section label and source chip, the title, the registry or map text,
   a date and evidence line, and beneath it the author note as an indented
   block with a left bar in the flag colour and the eyebrow `Nota del
   autor`. Clicking a chapter number plays that step in the map and scrolls
   the map into view. The chapters are the print form of the walkthrough and
   the player is its screen form; one array of steps feeds both.
6. **Annexes.** §4 Empresas analizadas, §5 Conexiones compartidas, §6
   Propiedad, §7 Correcciones del autor: the existing tables, typeset as
   annexes with small-caps headers, thin rules, no zebra, dates aligned.
7. **Footer.** Source line, coverage line ("BORME indexado desde 2009 hasta
   {indexed_through}" from the findings payload when present), generation
   timestamp, link back to mapasocietario.es.

**Typography and colour.** IBM Plex Sans 400 and 600, embedded as two
latin-subset woff2 data URIs (`?inline` imports under
`src/assets/fonts/`, OFL notice vendored beside them; roughly 80 KB in the
file). System sans fallback. One accent only, the teal the user guide uses
(`#0E8178`), with the guide's ink, muted and rule greys, so the artefact
family reads as one. Flag colours unchanged. Base 15px, line height 1.6,
one column at 820px max. Dark mode kept via `prefers-color-scheme`; print is
always light.

**Print.** `@page` A4 with 18mm margins; page breaks before §3 and before
the annexes; chapters and table rows avoid breaking inside; the map is fixed
at 150mm tall; player controls hidden. Printing from the browser is the way
to a PDF, and it must produce one a person would attach to an email.

**Author line.** Two optional fields in the modal under the summary: `Autor`
and `Organización`. Remembered in `localStorage` (`sitrep_author`), not in
the graph snapshot: they describe the person, not the investigation. Blank
fields drop the line; nothing is invented.

**Modal.** The edit tab stays MUI. The preview tab is the document itself in
an `<iframe srcdoc>`, so "what will it look like" is never a separate
rendering.

## Step model

```js
{
  key:      'subject:H:M-445656'          // stable across redrafts, see Keys
  section:  'subject' | 'stands_out' | 'connects' | 'ownership'
          | 'other_companies' | 'unseen' | 'author',
  nodeIds:  ['H:M-445656', 'officer:...'], // what the canvas focuses; ≥ 1
  linkKeys: ['a|b', ...],                  // links to draw at full alpha; may be empty
  title:    'INDITEX, SA',
  text:     'Share capital reduced on 11 Mar 2024.',
  source:   'registry' | 'graph' | 'author',
  date:     '2024-03-11' | null,
  evidence: { kind: 'event'|'officer'|'capital'|'ownership', ref: '...' } | null,
  flag:     'red'|'amber'|'blue'|'green'|'none' | null,   // author steps only
  deepLink: 'https://mapasocietario.es/app?gk=H:M-445656&lang=es',
}
```

`linkKeys` use the same `a|b` normalised-endpoint key the graph already uses
for parallel-link metadata, so the canvas callbacks can test membership with
one `Set.has`.

## Draft engine

`src/utils/walkthrough/draftWalkthrough.js`, pure. No DOM, no network, no
mutation of inputs.

```
draftWalkthrough({
  graphData,            // filteredGraphData: hidden nodes already excluded
  scope,                // extractVisibleScope(...) with subjectIds = pinned, as today
  findingsByKey,        // Map<companyNodeId, payload | null>; null = fetch failed
  primarySubjectId,     // the sticky subject's node id (may be null)
  lang,
}) → Step[]
```

Sections, in this order, always:

1. **`subject`** — one step. Title = company name; text = the findings
   header rendered as one line: NIF, province, registry (`hojas[-1]`), former
   names, last filing date and type. With no findings payload the text is the
   graph's own name and the number of visible officers. Focus: subject node.
   When `primarySubjectId` is null the first pinned company is the subject.
2. **`stands_out`** — the subject's findings, `cls === 'concern'` first, then
   `context`, `limitation` excluded (it moves to `unseen`), cap
   `STANDS_OUT_CAP = 4`. Text and date come from the payload verbatim. Focus:
   the subject plus any visible officer node whose name matches an
   `evidence.kind === 'officer'` ref: accent-stripped, upper-cased equality
   first, then `isSpellingVariant` from `officerNameVariants.js`. No match is
   fine; the step then focuses the subject alone. Link keys: subject↔those
   officers.
3. **`connects`** — one step per scope connector, sorted by company count
   desc then name, cap `CONNECTS_CAP = 8`. Text template (ES/EN):
   "{name} {holds|held|holds and held} {roles} at {companies}". Status word
   from `connector.status` (`active` / `ceased` / `mixed`). Focus: the person
   plus the subject companies they connect; link keys for each pair.
4. **`ownership`** — one step per scope ownership link. Text: "{owner} is /
   was sole shareholder of {owned}". Focus: both nodes, the ownership link.
5. **`other_companies`** — one step per remaining subject company, in scope
   order. Text = its top `concern` finding if any, else its identity line,
   else the graph-only line. Focus: that company. Findings are fetched for at
   most `FINDINGS_FETCH_CAP = 6` subject companies (the subject first, then
   scope order); companies beyond the cap get the graph-only line.
6. **`unseen`** — one step: the subject's `verification` lines joined as a
   short list, plus its `limitation`-class findings. Focus: subject. Omitted
   only when there are none.
7. **`author`** — every node note not already attached to a step (see
   below), red first, then amber, then the rest, then by name. Title = node
   name, text = the note, `flag` = the note's flag. Focus: the node.

**Note attachment.** A node note whose node is among a drafted step's
`nodeIds[0]` (its primary node) attaches to that step as `authorNote` rather
than becoming its own step. A note on a connector attaches to the connector's
step; a note on the subject attaches to the `subject` step. Only notes on
nodes no step focuses become `author` steps.

**Empty case.** One company, no connectors, no findings payload: the draft is
the `subject` step alone (`unseen` needs verification lines, which only a
payload supplies), and the player shows one card. The walkthrough always has
≥ 1 step.

**Degradation.** A null findings entry (fetch failed, 404, 409 ambiguous
namesake) yields graph-only text for that company and no `stands_out` /
`unseen` steps for it. The engine never throws on a partial input.

**Keys.** `section:primaryNodeId` for single-per-node sections;
`stands_out:nodeId:kind:date` for findings; `connects:nodeId`;
`ownership:ownerId|ownedId`; `author:nodeId`. Keys are what edits attach to,
so they must not depend on ordering or text.

## Author edits

```js
walkthroughEdits = {
  hidden: ['stands_out:H:M-1:capital_movement:2024-03-11'],
  order:  ['connects:officer:abc', 'subject:H:M-1'],   // partial, explicit positions
  notes:  { 'connects:officer:abc': 'Same person as the 2019 apoderado?' },
}
```

`applyWalkthroughEdits(draft, edits) → Step[]`, pure:

1. Drop steps whose key is in `hidden`.
2. Order: steps whose key appears in `order`, in that order, first; then the
   remaining steps in draft order. A key in `order` with no matching step is
   ignored, not removed, so a step that reappears (its node re-expanded)
   comes back where the author put it.
3. Attach `notes[key]` as `authorNote` on the step; a note for a missing key
   is kept in the edits and ignored.

A step whose nodes are no longer visible is simply absent from the draft. Its
edits survive untouched, so hiding and re-showing a node restores its place.

Edits live in graph component state next to `networkNote`, ride the
autosave, and are written into the snapshot `context` as
`walkthroughEdits`. `graphSnapshot.js` needs no version bump: `context` is an
open object and older snapshots read back with no edits.

`Restablecer borrador` sets edits to `{hidden: [], order: [], notes: {}}` after
a confirm dialog naming the count of hidden steps and notes it will discard.

For `author`-source steps, the inline note field edits the node note itself
(`setNodeNote`), not `edits.notes`, so there is one owner per fact.

## Loading

When the player or the modal opens:

1. Compute the scope and the subject list synchronously.
2. Fire `getCompanyFindings` for up to `FINDINGS_FETCH_CAP` subjects in
   parallel. The service already caches per `groupKey|lang`; a company whose
   findings were shown earlier costs nothing.
3. Wait until all settle or `FINDINGS_WAIT_MS = 4000`, whichever first. The
   toolbar button shows a spinner and `Preparando…` meanwhile.
4. Draft once from whatever arrived. Companies still pending are treated as
   null (graph-only). The step order never changes while the player is open.
5. A later open re-drafts; late arrivals then appear.

Companies identified only by name (no `groupKey`) are fetched by name, as the
service allows; a 409 is a null entry.

## Where the code goes

| File | Role |
|---|---|
| `src/utils/walkthrough/draftWalkthrough.js` (new) | the engine, pure |
| `src/utils/walkthrough/applyWalkthroughEdits.js` (new) | the merge, pure |
| `src/utils/walkthrough/walkthroughCopy.js` (new) | ES/EN templates for graph-sourced text, section labels, source chips; the export imports the same file |
| `src/hooks/useWalkthrough.js` (new) | edits state, loading, current index, focus sets (`tourNodeIds`, `tourLinkKeys`) |
| `src/components/WalkthroughPlayer.jsx` (new) | the docked card and controls |
| `src/components/SpanishCompanyNetworkGraph.jsx` | toolbar button; pass `fgRef`, scope, findings loader and edits into the hook; read `tourNodeIds` / `tourLinkKeys` in the node and link canvas callbacks alongside the pathfinder sets; snapshot context. Budget: ~100 lines. If it wants more, the wiring moves into the hook. |
| `src/components/RelationshipReportModal.jsx` | `Recorrido` list replaces `Señalado`; preview tab |
| `src/utils/investigationDoc.js` | `steps` (merged) replaces `flagged` as the walkthrough input; `flagged` stays for the flagged-cards section |
| `src/utils/investigationExport/renderGraphSvg.js` | `data-x`, `data-y` on nodes; `data-a`, `data-b` on links |
| `src/utils/investigationExport/walkthroughScript.js` | pan, link focus, pointer events, two-voice card |
| `src/utils/investigationExport/buildExportHtml.js` | assembles the document; shrinks to orchestration |
| `src/utils/investigationExport/documentStyle.js` (new) | the stylesheet string, screen + dark + print, and the `@font-face` rules |
| `src/utils/investigationExport/documentSections.js` (new) | cover, contents, summary, map figure, chapters, annexes, footer: one pure function each returning an HTML string |
| `src/assets/fonts/IBMPlexSans-{Regular,SemiBold}-latin.woff2` + `OFL.txt` (new) | embedded via `?inline` |
| `src/utils/investigationExport/exportCopy.js` | section, source, cover, legend, caption and annex labels |
| `src/utils/sitrepAuthor.js` (new) | load/save the author and organisation fields |

The graph component is 12,042 lines. This work adds no new state machine to
it; the hook owns the walkthrough and the component only wires props.

## Copy

| Key | ES | EN |
|---|---|---|
| Button | Recorrido | Walkthrough |
| Preparing | Preparando… | Preparing… |
| Section: subject | Sujeto | Subject |
| Section: stands_out | Lo que destaca | What stands out |
| Section: connects | Quién conecta | Who connects |
| Section: ownership | Propiedad | Ownership |
| Section: other_companies | Otras empresas | Other companies |
| Section: unseen | Lo que el registro no muestra | What the registry cannot show |
| Section: author | Notas del autor | Author's notes |
| Source: registry | Registro (BORME) | Registry (BORME) |
| Source: graph | Del mapa | From the map |
| Source: author | Autor | Author |
| Note field | Tu nota | Your note |
| Hide step | Quitar del recorrido | Remove from walkthrough |
| Reset | Restablecer borrador | Reset draft |
| Preview tab | Vista previa | Preview |
| Connector text | {name} {ocupa\|ocupó\|ocupa y ocupó} {roles} en {companies} | {name} {holds\|held\|holds and held} {roles} at {companies} |
| Graph-only company line | {n} cargos visibles en el mapa | {n} officers visible on the map |

Registry finding text is never templated client-side; it is the endpoint's
sentence, in the endpoint's language. The modal's ES/EN toggle therefore
re-fetches findings in the other language (cached separately by the service).

## Analytics

All through the existing `trackGraphToolbarAction` so they land in the same
GA4 series as `situation_report`:

`walkthrough_start`, `walkthrough_step` (with `section`),
`walkthrough_complete` (last step reached), `walkthrough_note_saved`,
`walkthrough_step_hidden`, `walkthrough_reset`, `walkthrough_preview`.

Success is read as direction over 2–3 weeks, never significance, at this
volume: walkthrough starts as a share of `graph_activation` users, note
saves against a baseline of zero, and `situation_report_download`.

## Testing

- **Engine** (`draftWalkthrough.test.js`): section order; caps; subject with
  no payload; payload null for one of three companies; concern-before-context;
  officer evidence resolved to node ids by folded name; note attachment to
  subject, connector and unfocused node; empty single-company graph yields one
  step; ownership `lost` wording; keys stable under reordering of input arrays.
- **Merge** (`applyWalkthroughEdits.test.js`): hidden dropped; partial order
  respected with remainder in draft order; stale keys in `order` ignored and
  preserved; note attached; input objects not mutated.
- **Export**: `renderGraphSvg` emits `data-x/y` and `data-a/b`;
  `buildExportHtml` embeds steps and escapes author notes; the script string
  still contains no `</script>`; a card renders both voices.
- **Document**: the file contains two `@font-face` rules with `data:` URIs
  and no external URL other than mapasocietario.es; the author line is
  present with both fields, present with one, absent with none; every
  contents entry anchors to an existing section id; empty sections are
  omitted, not rendered empty; the stylesheet contains `@page` and hides the
  player under `@media print`; the file stays under 400 KB with a 200-node
  graph.
- **Player**: one component test with a mocked `fgRef` asserting `centerAt`
  and `zoom` are called with the step's node coordinates, arrow keys advance,
  Escape exits, the note field writes through the edits setter.
- **Live check before believing green** (lesson from the story model:
  fixtures cannot see shape drift): play the walkthrough on one IBEX company
  with a wide graph and on one small SL with a single officer; download both
  files; open one on a phone.

## Out of scope

- A model-written opening paragraph (deferred, paid; see the AI storytelling
  memory). The step list is its future input.
- A hosted share link for the story. Separate spec.
- A time scrubber over the graph. Separate spec.
- Any backend change, including cross-company findings (`officer_elsewhere`)
  and the paid `dd_readings`.
- The `/empresa` surface.
- Reordering inside the player.
- Structural-edit provenance (merges, deletions) in the story.

## Open items

- The findings endpoint's in-process cache is per gunicorn worker (warm ~1s,
  cold ~1.7s). Six parallel fetches on a first open may hit the 4s wait; if
  the spinner is felt, the shared-cache follow-up from the findings spec
  becomes the fix, not a longer wait.
- Whether the toolbar can take one more button on narrow desktop widths
  without wrapping. If not, `Recorrido` becomes the primary action inside the
  situation-report button's menu rather than a sibling.
