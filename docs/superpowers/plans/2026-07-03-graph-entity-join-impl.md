# Plan: Graph company⇄cargo unify (mapasocietario)

> Spec: (ncdata-bormes-impl) docs/superpowers/specs/2026-07-03-graph-entity-join-ux.md — design-complete, owner-approved. Repo: /Users/alessandronurnberg/mapasocietario. Branch: feat/graph-entity-join. Frontend (React + ForceGraph2D canvas). **No pre-existing test framework** — Task G1 adds minimal vitest for the PURE logic only; canvas rendering/UX is verified by running the app + screenshots (owner judges "gentle yet visible").

## Context (verified in code)
- Graph component: `src/components/SpanishCompanyNetworkGraph.jsx` (8894 lines). Node types: 'company', 'officer', 'officer-company', 'spanish-company-group'. Officer subtype `isCompany ? 'company' : 'individual'` (~2970, 3168). `expandNode` (~3625). Person/company officer labels at :212-213/:447-448.
- Service: `src/services/spanishCompaniesService.js` — `pgExpandOfficer(name)` (/bormes/pg/expand-officer) = the reverse lookup (entity-as-officer → its cargo companies); `pgExpandCompany`, `autocompleteCompanies`, `autocompleteOfficers`.
- Owner decisions: UNIFY into one node + a badge marking it unified; direct edges only; gentle/non-obtrusive but unmissable affordance; mapasocietario first (leave local-rag alone).

## Task G1: vitest + reverse-lookup detection + icon-classification fix (PURE, tested)
Files: add vitest config + `package.json` test script; `src/services/spanishCompaniesService.js` (or a small util); the officer person/company classifier; tests.
1. Add minimal vitest (`vitest` dev dep, `"test": "vitest run"`, jsdom not needed for pure logic). Confirm `npm test` runs.
2. **Detection helper** `detectCargoPresence(service, companyName)` → `{ hasCargo: bool, count: int, companies: [...] }` by calling `pgExpandOfficer(companyName)` (exact name; the backend already resolves uniqueness/aliases). Pure except the injected service — unit-test with a fake service.
3. **Icon-classification fix**: find the predicate that sets officer `subtype`/`isCompany` (and the autocomplete result type/icon). A name carrying a Spanish/foreign legal form (SL/SA/SGIIC/SCOOP/AIE/…) is a COMPANY, not a person. Fix so "CAJAMAR GESTION SGIIC SA" classifies as company (company glyph), not person. Extract the legal-form test into a pure `isLegalEntityName(name)` util and unit-test it (SGIIC SA → true; a plain person name → false).
Tests: detection returns hasCargo/count from a fake pgExpandOfficer; isLegalEntityName covers SL/SA/SGIIC/SCOOP/AIE/foreign + negative person cases.

## Task G2: unify data-transform (PURE, tested)
Files: a pure util `src/utils/graphUnify.js` (or colocated); tests.
`unifyCargoIntoGraph(graph, subjectNodeId, cargoCompanies)` → new `{nodes, links}`:
- Merge the subject company node and its cargo counterpart into ONE node; mark it `unified: true` (drives the badge) and keep the display name.
- Add one node per cargo target company (dedup against existing nodes by id/group_key) and one link subject→target, role-labelled, with styling flags the renderer already understands: active → solid/green, ceased-or-former-name → dashed/red (reuse the existing previous-name/dashed convention fields).
- Direct edges only (do NOT recursively expand targets' own boards).
- Idempotent: applying twice doesn't duplicate nodes/links.
Tests: merges to one node with `unified:true`; adds N target nodes + N links with correct active/ceased styling flags; dedups; idempotent.

## Task G3: UX — affordance, confirm, unify render, badge (canvas/React; visual-verified)
Files: `src/components/SpanishCompanyNetworkGraph.jsx`.
- On loading/rendering a company node, run G1 detection; if hasCargo, show a **gentle but unmissable affordance** — a small persistent badge/indicator on the node (e.g. "+N cargos") rather than a transient toast. Non-blocking.
- On activating it, a light confirm ("Esta entidad también figura como cargo en N sociedades — ¿unificar?" / EN), then apply G2's `unifyCargoIntoGraph` to the graph state and re-render.
- Render the **unified node with a distinct badge** (owner: a marker showing the node was unified, inspectable/ideally undoable). Cargo edges drawn with the existing role-label + green-active/dashed-red-ceased styling.
- Bilingual strings (ES/EN) added to the component's i18n block.
- Do NOT break existing expand/manage/interaction behavior.
No unit tests (canvas). Verified in G4.

## Task G4: Run + screenshot verification (owner checkpoint)
Controller: `npm run dev`, load CAJAMAR CAJA RURAL in the graph; screenshot (a) the affordance on load, (b) after unify — the single node with its ~50 cargo edges (5 active solid, 45 dashed) + unified badge; and CAJAMAR GESTION SGIIC SA showing a COMPANY icon (G1 fix). Present to owner; iterate on "gentle yet visible" + unify look. Sign-off before merge. NEVER push (deploy is owner's).
