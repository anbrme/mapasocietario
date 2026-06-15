# Relationship Report → On-screen, Interactive

**Date:** 2026-06-15
**Status:** Approved design — ready for implementation plan
**Repo:** mapasocietario (frontend only; no backend changes)

## Problem

The relationship analysis added yesterday has three gaps:

1. It pulls in fully-owned subsidiaries automatically, and there is **no way to remove
   companies** from the list shown in the report dialog.
2. The report is **download-only** (a server-generated PDF). Since the report is free,
   most of its value should be visible on screen, not hidden behind a PDF printout.
3. Shared directors/entities across companies — the core insight — are **not surfaced
   in the graph**.

## Decisions (locked)

- **Report source:** FE-computed entirely from the visible graph. No backend call, no AI
  for the relationship report.
- **AI narrative:** dropped for the relationship report (it is free; charging for AI is
  not possible here and AI is overkill for this). AI stays on the **single-company DD
  report only** — that flow is untouched.
- **PDF export:** kept, via the **browser's print-to-PDF** of the on-screen modal (not the
  old server endpoint). No new PDF library.
- **Copy for Word:** rich-HTML clipboard copy so the report pastes formatted into
  Word/Google Docs.
- **Removing a company** from the report list **also unpins/hides** that company node from
  the graph (graph and report stay in sync).
- **Shared-officer highlight:** Option A — shared nodes keep their colour, gain a cyan halo
  ring, their edges turn hot (cyan), and everything else fades to ~28% alpha. Driven by a
  toolbar **toggle, off by default**, which fades the graph when on.

## Out of scope

- No AI / server call for the relationship report.
- No new PDF/print dependency (use `window.print` + a print stylesheet).
- Single-company DD report (AI + server PDF) is unchanged.

## Components

### 1. `RelationshipReportModal` (replaces download-only `RelationshipReportDialog`)

Renders the report on screen from the visible graph. Sections:

- **Header** — subject company names, "No autoritativo / Not authoritative" chip,
  generation date, ES/EN toggle (kept from the current dialog).
- **Summary line** — *N companies · M distinct officers · K shared connectors*.
- **Companies in scope** — deletable chips (see §2).
- **Shared connectors** — table: each person/entity at 2+ subject companies → the
  companies they link, role, status; sorted by reach (most companies first). Core value.
- **Ownership links** — `socio_unico` / `socio_perdido` edges as "A is sole shareholder
  of B".
- **Per-company roster** — collapsible: each company → its officers with role +
  active/ceased status.

**Exports:**

- `Save as PDF` — `window.print()` scoped by a print stylesheet so only the report prints.
- `Copy for Word` — writes rich HTML to the clipboard (`ClipboardItem` with `text/html`
  + `text/plain` fallback).
- No "download AI PDF" button.

Export buttons disable (with a hint) when fewer than 2 companies remain in scope.

Bilingual (ES/EN), matching existing patterns.

### 2. Removing companies from the report

Each company chip in "Companies in scope" gets a delete (×). Removing:

- drops the company id from `pinnedNodeIds`, and
- adds it to `hiddenNodeIds`.

`relationshipSubjectIds` (= pinned ids) recomputes automatically; the summary, tables, and
graph update live. Dropping below 2 companies disables exports.

### 3. Shared-officer highlight in the graph

Toolbar toggle **"Mostrar conexiones compartidas / Show shared connections"**, off by
default. When on (Option A):

- Officers/entities linked to 2+ subject companies keep their colour and gain a cyan halo
  ring; their edges turn hot (cyan, reuse `PATH_HIGHLIGHT_COLOR = '#4dd0e1'`).
- All other nodes/edges fade to ~28% alpha (reuse `PATH_DIM_ALPHA = 0.28`, the existing
  Pathfinder dimming).
- The shared set is computed once from `filteredGraphData` using the same logic as the
  report, so toggle and report always agree.

Rendering hooks into the existing `nodeCanvasObject` / link paint paths (the dimming and
hot-edge code already exist for Pathfinder; this adds a second trigger).

### 4. Frontend surfacing (toolbar)

- The existing "Relationship Report" button opens the on-screen modal.
- A "Show shared connections" toggle sits next to it.
- A small count badge on the report button (e.g. "3 empresas") shows it is live.
- All bilingual.

## Shared logic — single source of truth

Extend `src/utils/relationshipScope.js` so both the modal and the graph highlight consume
one computation. It already returns `companies`, `officersByCompany`, and a
`sharedPeople` count. Add:

- per-connector detail: `{ name, type ('individual'|'entity'), companies: [...], role,
  status }` for every officer at 2+ subject companies;
- ownership links: `[{ owner, owned, lost: bool }]` derived from `socio_unico` /
  `socio_perdido` nodes/edges;
- a stable set of "shared connector" node ids the graph highlight can test against.

Node/link field names (role, status, category, event dates) are verified against the live
graph data during implementation; the shape above is the target contract.

## Affected files

- `src/components/RelationshipReportDialog.jsx` → reworked into `RelationshipReportModal`
  (or replaced).
- `src/utils/relationshipScope.js` → extended with connector detail + ownership links +
  shared id set.
- `src/components/SpanishCompanyNetworkGraph.jsx` → toolbar toggle + badge, remove-company
  wiring (`pinnedNodeIds`/`hiddenNodeIds`), shared-highlight rendering, open the new modal.
- New: a print stylesheet (scoped `@media print`) and a `copyReportForWord` helper.

## Testing

- `relationshipScope` unit coverage: shared-connector detection (officer at exactly 1 vs
  2+ companies), ownership link extraction, removal recompute.
- Manual: remove a company → disappears from graph and report; toggle → graph dims and
  connectors glow; Save as PDF prints only the report; Copy for Word pastes formatted.
