# Walkthrough v4: one entry point, the walkthrough as a mode of the situation report

**Date:** 2026-09-14
**Repo:** `mapasocietario` only (frontend). No backend change.
**Status:** approved in chat 2026-09-14; implementing on feat/walkthrough-v4-report-mode.
**Builds on:** v2 (selection dossier) and v3 (scroll story + registry timeline).

## What v3 left standing

The same step object was rendered three times: the docked card on the live
graph, the step list inside the situation-report modal, and the story pane of
the exported file. Two of those were authoring surfaces (both carried a note
field), so a note could be written in three places (node right-click, docked
card, modal). Two toolbar buttons carried badges that counted different things
(pinned companies vs selected nodes), and the preview opened "the recorrido"
inside "the informe" in another tab. The docked card could take 45 % of the
canvas height while the camera centred the step in the full canvas, so a
single node landed at the card's top edge or behind it; with the inspector
open, three panels competed for the graph.

A second defect: a **unified node** (a company that also holds seats
elsewhere, drawn as a square with a circle inside, `node.unified`) was
classified by node type alone, so its step showed only the company side and
dropped the seats it holds.

## The decision

**The walkthrough is a mode of the situation report, not a peer feature.**

- **One toolbar button**, *Informe de situación*. Its badge shows the
  Cmd/Ctrl+click selection count when there is one, the pinned-company count
  otherwise. Its tooltip carries the selection hint that lived on the
  Recorrido tooltip. The Recorrido button goes.
- **The modal is the only authoring surface** (notes, moments, order, hide),
  together with the node's own private note on the graph. The Recorrido
  section header gains *Ver en el mapa* / *Play on the map*, which closes
  the modal and starts the tour.
- **The docked card becomes a one-row controller** at the bottom of the
  canvas: step counter, kind chip, title, moment chip, *Ver evidencia*,
  Anterior / Siguiente, *Editar en el informe*, close. No note field, no
  evidence paragraph, no hide button, no opening-card body. Arrow keys and
  Escape unchanged. *Editar en el informe* exits the tour and reopens the
  modal. On a phone the row wraps to two lines, full width.
- **The camera fits what is visible.** The step camera reads the canvas
  dimensions (which already exclude the docked inspector and the data dock)
  and passes the controller's height as a bottom inset, so the step's nodes
  centre in the uncovered band. `stepViewport` gains `insets.bottom`.
- **Unified nodes carry both sides.** A company step for a node with
  `unified` also carries `evidence.seats` (the seats it holds elsewhere:
  `officer-company` links flagged `unified` where the node is the SOURCE —
  direction matters, a company sitting on ITS board is the reverse link) and
  focuses those companies too. `kind` stays `company` (the document rules
  key on it); the step gains `unified: true` and its eyebrow reads
  *Empresa y cargo* / *Company and officer*. The chapter renders the seats
  table under the company evidence.

## Analytics

Event names unchanged (`walkthrough_start/step/complete`, `walkthrough_*`
edits) so the GA4 walkthrough tier stays valid. The play button from the modal
tracks as toolbar action `walkthrough_play`; the controller's edit link as
`walkthrough_edit`.

## Files

| File | Change |
|---|---|
| `src/components/SpanishCompanyNetworkGraph.jsx` | Recorrido button removed; report badge/tooltip; camera effect uses canvasDimensions + inset; controller props; modal `onPlay` |
| `src/components/RelationshipReportModal.jsx` | *Ver en el mapa* in the Recorrido header |
| `src/components/WalkthroughPlayer.jsx` | rewritten as the one-row controller |
| `src/utils/walkthrough/walkthroughViewport.js` | `insets.bottom` |
| `src/utils/walkthrough/stepEvidence.js` | `personSeats` is directional for company holders |
| `src/utils/walkthrough/draftWalkthrough.js` | unified company step carries seats + focus |
| `src/utils/walkthrough/walkthroughCopy.js` | `playOnMap`, `editInReport`, `kinds.unified`, `stepKindLabel` |
| `src/utils/investigationExport/documentSections.js`, `buildExportHtml.js` | seats table in a company chapter; unified eyebrow |

## Trade-off accepted

Starting the tour from the modal re-runs `prepare()` (the step data the modal
already loaded is fetched again), a pause of up to a second or two. A cache in
the hook is deferred until it shows up as a real annoyance.

## Out of scope

Presenter mode, time rendering on the live canvas, a board table that lists a
corporate officer sitting on the unified node's own board (pre-existing gap in
`officersOfCompany`, covered by the profile's board rows).
