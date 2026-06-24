# AI Investigation Canvas Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a redeemed user curate a small set of graph entities (companies + officers) on the canvas and run a focused, persistent, graph-grounded AI investigation on exactly that selection.

**Architecture:** All real logic lives in pure helpers in `src/utils/aiInvestigationClient.js` (token persistence, launch-state, context-builder, payload, chip label) — these are `node:test`-covered. `AIInvestigationGate.jsx` becomes context-aware (persisted token → skip unlock; accept a graph-context prop; send the new payload). `SpanishCompanyNetworkGraph.jsx` adds an `investigationSet` and three ways to fill it (shift/⌘-click, context menu, linked-persons table), a selection ring, and a launcher + status chip that mount the gate. No backend change.

**Tech Stack:** React 18, Vite, MUI v5, `react-force-graph-2d`; `node:test` for pure-util tests.

## Global Constraints

- Frontend only — **no worker/backend change**. The `ai-investigation` worker already meters by code and `/investigate` is company-agnostic.
- Tests use `node:test` (`*.test.mjs`, run `node --test <file>`) on **pure util modules only**. React components are NOT unit-tested in this repo — verify them with `npx vite build` (do NOT run `npm run build`; its pre/postbuild data scripts are unrelated and may fail).
- `localStorage` key: exactly `ai_investigation_token`; value JSON `{ "token": "<jwt>", "expiresAt": <epoch-seconds> }`.
- Investigation cap: **10** entities (companies + officers combined). Over cap → launch **disabled with guidance**, never silently trimmed. Empty selection → fall back to the focused company (`primarySubject`).
- `/investigate` request body shape: `{ question, focus, entities, edges }` where `focus` and each `entities[i]` are `{ id, name, type: 'company'|'officer' }` and each `edges[i]` is `{ source, target, type }`. Worker ignores `focus`/`entities`/`edges` in Phase 1 (returns stub) — send them anyway.
- API base: `AI_INVESTIGATION_API` from `src/config.js`.
- Reuse the existing `AIInvestigationGate` component and the existing pure helpers (`isTokenValid`, `buildRedeemBody`, `buildInvestigateHeaders`, `buildCodeForSessionBody`) — extend, don't duplicate.
- i18n: graph strings live in the `SEARCH_COPY = { en, es }` object; gate strings in its own `COPY = { en, es }`. The graph currently hardcodes `language="es"` on the order page, but `SpanishCompanyNetworkGraph` has a real `uiLanguage` — use it.

---

### Task 1: Pure helpers in `aiInvestigationClient.js`

**Files:**
- Modify: `src/utils/aiInvestigationClient.js`
- Test: `test/ai-investigation-client.test.mjs`

**Interfaces:**
- Consumes: existing `isTokenValid(stored, nowSec)` (already in the file).
- Produces (all pure / side-effect-free except the three localStorage fns):
  - `TOKEN_KEY: string` (`'ai_investigation_token'`)
  - `saveToken(stored: {token, expiresAt}): void`, `loadToken(): {token, expiresAt}|null`, `clearToken(): void`
  - `INVESTIGATION_CAP: number` (`10`)
  - `investigationLaunchState(count: number, cap?: number): { canLaunch: boolean, mode: 'focus'|'selection'|'over_cap' }`
  - `entitlementSecondsLeft(stored, nowSec): number` (0 if invalid/expired)
  - `entitlementChipLabel(stored, nowSec, lang): string`
  - `buildInvestigationContext(selectedIds: string[], nodes: object[], links: object[], primarySubject: object|null): { focus, entities, edges }`
  - `buildInvestigatePayload({ question, focus, entities, edges }): object`

- [ ] **Step 1: Write the failing tests**

Append to `test/ai-investigation-client.test.mjs` (and add the new names to the existing import line from `../src/utils/aiInvestigationClient.js`):

```javascript
test('investigationLaunchState: empty selection launches in focus mode', () => {
  assert.deepEqual(investigationLaunchState(0), { canLaunch: true, mode: 'focus' });
});
test('investigationLaunchState: within cap launches in selection mode', () => {
  assert.deepEqual(investigationLaunchState(1), { canLaunch: true, mode: 'selection' });
  assert.deepEqual(investigationLaunchState(10), { canLaunch: true, mode: 'selection' });
});
test('investigationLaunchState: over cap is blocked', () => {
  assert.deepEqual(investigationLaunchState(11), { canLaunch: false, mode: 'over_cap' });
});

test('entitlementSecondsLeft: positive when valid, 0 when expired/missing', () => {
  assert.equal(entitlementSecondsLeft({ token: 'x', expiresAt: 2000 }, 1000), 1000);
  assert.equal(entitlementSecondsLeft({ token: 'x', expiresAt: 1000 }, 1000), 0);
  assert.equal(entitlementSecondsLeft(null, 1000), 0);
});
test('entitlementChipLabel: authorized shows remaining, else CTA', () => {
  // 1 day + a bit left → "IA · 1 día restante" (es) / "AI · 1 day left" (en)
  const oneDay = { token: 'x', expiresAt: 1000 + 90000 };
  assert.equal(entitlementChipLabel(oneDay, 1000, 'es'), 'IA · 1 día restante');
  assert.equal(entitlementChipLabel(oneDay, 1000, 'en'), 'AI · 1 day left');
  assert.equal(entitlementChipLabel(null, 1000, 'es'), 'Investigación por IA');
  assert.equal(entitlementChipLabel(null, 1000, 'en'), 'AI Investigation');
});

test('buildInvestigationContext: maps selected nodes + edges among them', () => {
  const nodes = [
    { id: 'company-a', name: 'A SL', type: 'spanish-company' },
    { id: 'officer-b', name: 'B PEREZ', type: 'officer' },
    { id: 'company-c', name: 'C SA', type: 'spanish-company' },
  ];
  const links = [
    { source: 'company-a', target: 'officer-b', type: 'director' },
    { source: 'officer-b', target: 'company-c', type: 'director' }, // c not selected → excluded
  ];
  const primary = nodes[0];
  const ctx = buildInvestigationContext(['company-a', 'officer-b'], nodes, links, primary);
  assert.deepEqual(ctx.entities, [
    { id: 'company-a', name: 'A SL', type: 'company' },
    { id: 'officer-b', name: 'B PEREZ', type: 'officer' },
  ]);
  assert.deepEqual(ctx.focus, { id: 'company-a', name: 'A SL', type: 'company' });
  assert.deepEqual(ctx.edges, [{ source: 'company-a', target: 'officer-b', type: 'director' }]);
});
test('buildInvestigationContext: empty selection falls back to primarySubject', () => {
  const primary = { id: 'company-a', name: 'A SL', type: 'spanish-company' };
  const ctx = buildInvestigationContext([], [primary], [], primary);
  assert.deepEqual(ctx.entities, [{ id: 'company-a', name: 'A SL', type: 'company' }]);
  assert.deepEqual(ctx.focus, { id: 'company-a', name: 'A SL', type: 'company' });
  assert.deepEqual(ctx.edges, []);
});
test('buildInvestigationContext: handles links whose source/target are node objects', () => {
  const a = { id: 'company-a', name: 'A SL', type: 'spanish-company' };
  const b = { id: 'officer-b', name: 'B', type: 'officer' };
  const ctx = buildInvestigationContext(['company-a', 'officer-b'], [a, b],
    [{ source: a, target: b, type: 'apoderado' }], a);
  assert.deepEqual(ctx.edges, [{ source: 'company-a', target: 'officer-b', type: 'apoderado' }]);
});

test('buildInvestigatePayload: assembles the request body', () => {
  const payload = buildInvestigatePayload({
    question: 'q', focus: { id: 'company-a', name: 'A', type: 'company' },
    entities: [{ id: 'company-a', name: 'A', type: 'company' }], edges: [],
  });
  assert.deepEqual(payload, {
    question: 'q', focus: { id: 'company-a', name: 'A', type: 'company' },
    entities: [{ id: 'company-a', name: 'A', type: 'company' }], edges: [],
  });
});
```

- [ ] **Step 2: Run → RED**

Run: `cd /Users/alessandronurnberg/mapasocietario && node --test test/ai-investigation-client.test.mjs`
Expected: FAIL — the new exports are not defined.

- [ ] **Step 3: Implement the helpers**

Append to `src/utils/aiInvestigationClient.js` (keep the existing exports):

```javascript
export const TOKEN_KEY = 'ai_investigation_token';
export const INVESTIGATION_CAP = 10;

export function saveToken(stored) {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify(stored)); } catch { /* ignore */ }
}
export function loadToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number') return null;
    return parsed;
  } catch { return null; }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

export function investigationLaunchState(count, cap = INVESTIGATION_CAP) {
  if (count === 0) return { canLaunch: true, mode: 'focus' };
  if (count > cap) return { canLaunch: false, mode: 'over_cap' };
  return { canLaunch: true, mode: 'selection' };
}

export function entitlementSecondsLeft(stored, nowSec) {
  if (!isTokenValid(stored, nowSec)) return 0;
  return stored.expiresAt - nowSec;
}

export function entitlementChipLabel(stored, nowSec, lang) {
  const en = lang === 'en';
  const left = entitlementSecondsLeft(stored, nowSec);
  if (left <= 0) return en ? 'AI Investigation' : 'Investigación por IA';
  const days = Math.floor(left / 86400);
  if (days >= 1) {
    return en ? `AI · ${days} day${days > 1 ? 's' : ''} left` : `IA · ${days} día${days > 1 ? 's' : ''} restante${days > 1 ? 's' : ''}`;
  }
  const hours = Math.max(1, Math.floor(left / 3600));
  return en ? `AI · ${hours}h left` : `IA · ${hours}h restante`;
}

// Normalize a link endpoint that may be an id string or a node object.
function _endpointId(end) {
  return typeof end === 'object' && end !== null ? end.id : end;
}
function _toEntity(node) {
  return { id: node.id, name: node.name || node.label || '', type: node.type === 'officer' ? 'officer' : 'company' };
}

export function buildInvestigationContext(selectedIds, nodes, links, primarySubject) {
  const byId = new Map((nodes || []).map((n) => [n.id, n]));
  let entityNodes = (selectedIds || []).map((id) => byId.get(id)).filter(Boolean);
  if (entityNodes.length === 0 && primarySubject) entityNodes = [primarySubject];
  const entities = entityNodes.map(_toEntity);
  const idSet = new Set(entities.map((e) => e.id));
  const focusNode = (primarySubject && idSet.has(primarySubject.id)) ? primarySubject : entityNodes[0] || primarySubject || null;
  const focus = focusNode ? _toEntity(focusNode) : null;
  const edges = (links || [])
    .map((l) => ({ source: _endpointId(l.source), target: _endpointId(l.target), type: l.type || l.category || '' }))
    .filter((e) => idSet.has(e.source) && idSet.has(e.target));
  return { focus, entities, edges };
}

export function buildInvestigatePayload({ question, focus, entities, edges }) {
  return { question, focus, entities, edges };
}
```

- [ ] **Step 4: Run → GREEN**

Run: `node --test test/ai-investigation-client.test.mjs`
Expected: PASS (all existing + new tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/aiInvestigationClient.js test/ai-investigation-client.test.mjs
git commit -m "feat: AI Investigation client helpers — token persistence, launch-state, context builder"
```

---

### Task 2: Make `AIInvestigationGate` context-aware + persistent

**Files:**
- Modify: `src/components/AIInvestigationGate.jsx`
- Modify: `src/components/OrderStatusPage.jsx`

**Interfaces:**
- Consumes (from Task 1): `loadToken`, `saveToken`, `isTokenValid`, `buildInvestigationContext` (caller-side), `buildInvestigatePayload`, `buildInvestigateHeaders`.
- Produces: `AIInvestigationGate` accepts a new prop `context` (`{ focus, entities, edges } | null`); on open it loads a persisted token and, if valid, starts in the ask phase; on successful redeem it persists the token; `/investigate` sends `buildInvestigatePayload({ question, ...context })`.

- [ ] **Step 1: Persist + load the token in the gate**

In `src/components/AIInvestigationGate.jsx`, extend the imports from the client util to include `loadToken, saveToken`, and add `context = null` to the destructured props. Initialize the session from a stored token so a valid token skips the unlock step:

```jsx
import {
  buildRedeemBody, buildInvestigateHeaders, isTokenValid,
  buildInvestigatePayload, loadToken, saveToken,
} from '../utils/aiInvestigationClient';
```

Replace the `session` state init and add a load-on-open effect:

```jsx
  const [session, setSession] = useState(() => {
    const t = loadToken();
    return isTokenValid(t, Math.floor(Date.now() / 1000)) ? t : null;
  });

  // When the dialog (re)opens, refresh session from storage so a token
  // redeemed elsewhere (e.g. the order page) authorizes this instance.
  useEffect(() => {
    if (!open) return;
    const t = loadToken();
    if (isTokenValid(t, Math.floor(Date.now() / 1000))) setSession(t);
  }, [open]);
```

- [ ] **Step 2: Persist on redeem success**

In the `redeem` callback, where it currently does `setSession({ token: data.token, expiresAt: data.expires_at });`, replace with:

```jsx
      const stored = { token: data.token, expiresAt: data.expires_at };
      saveToken(stored);
      setSession(stored);
```

- [ ] **Step 3: Send the curated context on ask**

In the `ask` callback, change the fetch body to include the context. Replace the existing `body: JSON.stringify({ question })` with:

```jsx
        body: JSON.stringify(buildInvestigatePayload({
          question,
          focus: context?.focus ?? null,
          entities: context?.entities ?? [],
          edges: context?.edges ?? [],
        })),
```

- [ ] **Step 4: Verify the gate compiles**

Run: `cd /Users/alessandronurnberg/mapasocietario && npx vite build`
Expected: build completes with no errors.

- [ ] **Step 5: Order page passes no graph context (focus-only)**

In `src/components/OrderStatusPage.jsx`, the existing `<AIInvestigationGate ... />` needs no `context` (it has no graph) — it stays focus-less, so the ask sends `entities: []` / `focus: null`. No change needed beyond confirming it still renders. The persisted-token change means redeeming here now also unlocks the canvas. Confirm the gate usage still passes `prefillEmail`/`prefillCode`/`language` as before.

Run: `npx vite build`
Expected: build clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/AIInvestigationGate.jsx src/components/OrderStatusPage.jsx
git commit -m "feat: persist AI Investigation token + send graph context from the gate"
```

---

### Task 3: Canvas selection set, entry points, ring, launcher + chip

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx`

**Interfaces:**
- Consumes (Task 1): `investigationLaunchState`, `entitlementChipLabel`, `buildInvestigationContext`, `loadToken`, `INVESTIGATION_CAP`. (Task 2): the `context`-aware `AIInvestigationGate`.
- Produces: an `investigationSet` (`Set<string>` of normalized node ids) + a `toggleInvestigationNode(id)` callback; a mounted `AIInvestigationGate` opened from a launcher; a selection ring in `nodeCanvasObject`; a context-menu item; a toolbar status chip.

> The implementer should place each block at the named anchor. The graph file is large; use the anchors (function names + line numbers) to locate them, and match surrounding style.

- [ ] **Step 1: Add imports + state**

Add to the imports from the client util (top of file): `import AIInvestigationGate from './AIInvestigationGate';` and `import { investigationLaunchState, entitlementChipLabel, buildInvestigationContext, loadToken, INVESTIGATION_CAP } from '../utils/aiInvestigationClient';`.

Near the other `useState` declarations (around line 1125, by `activeNodeId`), add:

```jsx
  const [investigationSet, setInvestigationSet] = useState(() => new Set());
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPanelContext, setAiPanelContext] = useState(null);
  // Re-render the chip as the entitlement ticks; loadToken() is read at render.
  const [entitlementTick, setEntitlementTick] = useState(0);
```

Add the toggle callback (near other node callbacks, after `handleNodeClick`):

```jsx
  const toggleInvestigationNode = useCallback((rawId) => {
    const id = normalizeNodeId(rawId);
    setInvestigationSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
```

- [ ] **Step 2: Shift/⌘-click toggles selection (don't break plain click)**

In `handleNodeClick` (≈ line 3922), immediately after `const nodeId = normalizeNodeId(node.id);`, add an early branch so a modified click toggles selection and does nothing else:

```jsx
      if (event && (event.shiftKey || event.metaKey || event.ctrlKey)) {
        event.preventDefault?.();
        toggleInvestigationNode(nodeId);
        return;
      }
```

Add `toggleInvestigationNode` to the `useCallback` dependency array for `handleNodeClick`.

- [ ] **Step 3: Draw the selection ring**

In `nodeCanvasObject` (≈ line 5103), after the node circle/shape is drawn (end of the node-drawing block, before label rendering or at the end), add a ring for selected nodes:

```jsx
      if (investigationSet.has(normalizeNodeId(node.id))) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius + 2.5, 0, 2 * Math.PI);
        ctx.strokeStyle = '#7c4dff'; // distinct from status colors
        ctx.lineWidth = 2 / globalScale;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.restore();
      }
```

Add `investigationSet` to the `nodeCanvasObject` `useCallback` dependency array.

- [ ] **Step 4: Context-menu item "Añadir a investigación"**

In the node context `Menu` (the MenuItem block ≈ line 7191), add an item that toggles the right-clicked node (`contextNode`) and closes the menu:

```jsx
          <MenuItem onClick={() => { if (contextNode) toggleInvestigationNode(contextNode.id); closeNodeContextMenu(); }}>
            <ListItemIcon><PsychologyIcon fontSize="small" /></ListItemIcon>
            <ListItemText>
              {investigationSet.has(normalizeNodeId(contextNode?.id))
                ? text.investigationRemove
                : text.investigationAdd}
            </ListItemText>
          </MenuItem>
```

Ensure `PsychologyIcon` is imported (`import PsychologyIcon from '@mui/icons-material/Psychology';`) and `ListItemIcon`/`ListItemText` are already imported (they are — used by sibling items).

- [ ] **Step 5: i18n strings**

In `SEARCH_COPY` (line 167), add to **both** `en` and `es`:

```jsx
// en:
    investigationAdd: 'Add to AI investigation',
    investigationRemove: 'Remove from AI investigation',
    investigateSelection: 'Investigate selection',
    investigationOverCap: `Reduce the selection to ${INVESTIGATION_CAP} entities`,
// es:
    investigationAdd: 'Añadir a investigación por IA',
    investigationRemove: 'Quitar de la investigación por IA',
    investigateSelection: 'Investigar selección',
    investigationOverCap: `Reduce la selección a ${INVESTIGATION_CAP} entidades`,
```

- [ ] **Step 6: Launcher + status chip + mounted gate**

Add a floating control near the ForceGraph2D (mirror the existing floating-`Paper` pattern used by the data table, e.g. `position: 'absolute', top: 12, left: 12, zIndex: 20`). Insert this JSX inside the graph container, alongside the other floating overlays:

```jsx
        {(() => {
          const count = investigationSet.size;
          const launch = investigationLaunchState(count);
          const stored = loadToken();
          const nowSec = Math.floor(Date.now() / 1000);
          const label = count > 0
            ? `${text.investigateSelection} (${count})`
            : entitlementChipLabel(stored, nowSec, uiLanguage);
          return (
            <Paper sx={{ position: 'absolute', top: 12, left: 12, zIndex: 20, p: 0.5, display: 'flex', gap: 1, alignItems: 'center', bgcolor: 'rgba(18,24,40,0.9)' }}>
              <Button
                size="small"
                variant={count > 0 ? 'contained' : 'outlined'}
                startIcon={<PsychologyIcon />}
                disabled={!launch.canLaunch}
                onClick={() => {
                  const primary = graphData.nodes.find((n) => isSameNodeId(n.id, activeNodeId))
                    || graphData.nodes.find((n) => primarySubject && isSameNodeId(n.id, primarySubject.id))
                    || primarySubject || null;
                  setAiPanelContext(
                    buildInvestigationContext(Array.from(investigationSet), graphData.nodes, graphData.links, primary)
                  );
                  setAiPanelOpen(true);
                }}
              >
                {launch.mode === 'over_cap' ? text.investigationOverCap : label}
              </Button>
            </Paper>
          );
        })()}
```

Mount the gate once (near the other dialogs at the end of the component's return):

```jsx
        <AIInvestigationGate
          open={aiPanelOpen}
          onClose={() => { setAiPanelOpen(false); setEntitlementTick((t) => t + 1); }}
          language={uiLanguage}
          context={aiPanelContext}
        />
```

> `primarySubject` shape: it is a node-like object (has `id`, `name`, `type`). If in this component `primarySubject` is stored as an id string rather than a node object, resolve it to the node via `graphData.nodes.find(...)` before passing — `buildInvestigationContext` expects a node object (or null) as its 4th arg. Check the existing `primarySubject` declaration and adapt.

- [ ] **Step 7: Verify the graph compiles**

Run: `cd /Users/alessandronurnberg/mapasocietario && npx vite build`
Expected: build completes with no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/SpanishCompanyNetworkGraph.jsx
git commit -m "feat: AI Investigation on the canvas — selection set, ring, launcher, context-menu, chip"
```

---

### Task 4: Linked-persons table "add to investigation" toggle

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx`

**Interfaces:**
- Consumes (Task 3): `investigationSet`, `toggleInvestigationNode`, `normalizeNodeId`, `text.investigationAdd`/`investigationRemove`.

- [ ] **Step 1: Locate the linked-persons table rows**

Run: `grep -n "TableRow\|TableCell\|tableDragRef\|linked\|officersTable\|personsTable" src/components/SpanishCompanyNetworkGraph.jsx | head -30`
Identify the row-rendering map for the linked-persons/officers table (the floating data-table `Paper`). Note the variable that holds each row's node/id.

- [ ] **Step 2: Add a per-row toggle control**

In each table row, add a leading toggle cell (a `Checkbox` or a small `IconButton`) bound to the row's node id. Use the row node's id (the same id space as the graph nodes). Example (adapt the row variable name to what Step 1 found — call it `rowNode`):

```jsx
                  <Checkbox
                    size="small"
                    checked={investigationSet.has(normalizeNodeId(rowNode.id))}
                    onChange={() => toggleInvestigationNode(rowNode.id)}
                    title={investigationSet.has(normalizeNodeId(rowNode.id)) ? text.investigationRemove : text.investigationAdd}
                  />
```

Ensure `Checkbox` is imported from `@mui/material` (add if missing).

- [ ] **Step 3: Verify compile**

Run: `cd /Users/alessandronurnberg/mapasocietario && npx vite build`
Expected: build clean.

- [ ] **Step 4: Manual smoke (gated — present to user)**

With `npm run dev`, on a graph: shift/⌘-click two nodes → both get the ring and the launcher reads "Investigar selección (2)"; tick a third in the table → (3); right-click a node → "Añadir a investigación" toggles it; select >10 → button shows "Reduce la selección a 10 entidades" and is disabled; click launch with a valid token → ask box opens; clear localStorage → launch shows the unlock step first. Confirm plain (unmodified) click still navigates/expands.

- [ ] **Step 5: Commit**

```bash
git add src/components/SpanishCompanyNetworkGraph.jsx
git commit -m "feat: add-to-investigation toggle in the linked-persons table"
```

---

## Self-Review

**Spec coverage:**
- Selection set (3 entry methods) → Task 3 (shift/⌘-click, context menu), Task 4 (table). ✓
- Selection ring → Task 3 Step 3. ✓
- "Investigar selección (N)" launcher, enable 1–10, fallback at 0, block >10 → Task 3 Step 6 + `investigationLaunchState` (Task 1). ✓
- Cap 10, block-with-guidance → Task 1 `investigationLaunchState` + Task 3 over-cap label. ✓
- Token persistence in localStorage, redeem-once → Task 1 (save/load/clear) + Task 2 (gate uses them). ✓
- Context-aware gate (skip unlock when authorized) → Task 2 Step 1. ✓
- Toolbar status chip with remaining time → Task 1 `entitlementChipLabel` + Task 3 Step 6. ✓
- `/investigate` payload `{question, focus, entities, edges}` → Task 1 `buildInvestigationContext`/`buildInvestigatePayload` + Task 2 Step 3. ✓
- Order-page surface stays, shares token → Task 2 Step 5. ✓
- No backend change → nothing in any task touches the worker. ✓
- Non-goal (network-reduction mode) → not implemented. ✓

**Placeholder scan:** No TBD/TODO. Component tasks (no unit tests per repo convention) verify via `npx vite build` + a manual smoke (Task 4 Step 4), which is explicit and concrete, not a placeholder. The two adapt-to-local-variable notes (primarySubject shape in T3 S6; row variable in T4 S2) are genuine integration unknowns in an 8k-line file, each with a concrete grep/lookup instruction — not vague hand-waving.

**Type consistency:** `investigationSet` is `Set<normalized id>` everywhere; `toggleInvestigationNode(rawId)` normalizes internally; `buildInvestigationContext(selectedIds, nodes, links, primarySubject)` consistent between Task 1 def and Task 3 call; gate `context` prop `{focus, entities, edges}` consistent between Task 1 builder, Task 2 consumer, Task 3 producer; `entitlementChipLabel(stored, nowSec, lang)` consistent T1/T3; `loadToken()`/`saveToken()` consistent T1/T2/T3.
