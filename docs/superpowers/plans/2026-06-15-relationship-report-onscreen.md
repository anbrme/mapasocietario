# On-Screen Relationship Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the download-only relationship report into an on-screen, interactive modal (with Save-as-PDF and Copy-for-Word), let users remove companies from it (which also hides them from the graph), and highlight shared directors/entities in the graph behind a toggle.

**Architecture:** Everything is frontend-only and computed from the visible graph — no backend, no AI for this report (AI stays on the single-company DD report, untouched). `src/utils/relationshipScope.js` becomes the single source of truth: it already returns companies / officers-per-company / shared count; we extend it with per-connector detail, ownership links, and a set of "shared connector" node ids that both the modal and the graph highlight consume. A new `RelationshipReportModal` renders the report and replaces the old `RelationshipReportDialog`. Save-as-PDF is the browser print of the modal via a print stylesheet; Copy-for-Word mirrors the existing `ClipboardItem` rich-HTML pattern.

**Tech Stack:** React 18, MUI 5, react-force-graph-2d (canvas), Vite. Unit tests use the Node built-in test runner (`node --test test/<file>.mjs`); pure utils are tested, UI/canvas is verified manually (no testing-library in this repo).

---

## File Structure

- `src/utils/relationshipScope.js` — **modify.** Add `connectors`, `ownership`, `sharedNodeIds` to the return value and export `isActiveOfficerCategory`. Single source of truth for both modal and highlight.
- `test/relationship-scope.test.mjs` — **modify.** Add tests for the new fields.
- `src/utils/relationshipReportHtml.js` — **create.** Pure `buildReportHtml(scope, { es })` → HTML string for Copy-for-Word.
- `test/relationship-report-html.test.mjs` — **create.** Tests for `buildReportHtml`.
- `src/components/RelationshipReportModal.jsx` — **create.** On-screen report (replaces `RelationshipReportDialog`).
- `src/components/RelationshipReportDialog.jsx` — **delete** after the modal replaces both usages.
- `src/index.css` — **modify.** Print stylesheet so only the report prints.
- `src/components/SpanishCompanyNetworkGraph.jsx` — **modify.** Live detailed scope memo, remove-company handler, count badge, shared-connections toggle + state, node/link highlight rendering, swap both dialog usages for the modal.

Status/role facts used throughout:
- Officer node entity vs person: `node.subtype === 'company'` ⇒ entity, else individual.
- Link role text: `link.relationship` (falls back to `link.category`).
- Link active vs ceased: category contains `nombramiento` / `reeleccion` / `reelección` ⇒ active.
- Ownership link: `link.type === 'ownership'`, `source` = owner, `target` = owned, `category` is `socio_unico` (active) or `socio_perdido` (lost).

---

## Task 1: Extend `relationshipScope.js` with connectors, ownership, and shared ids

**Files:**
- Modify: `src/utils/relationshipScope.js`
- Test: `test/relationship-scope.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `test/relationship-scope.test.mjs`:

```javascript
test('connectors lists officers at >=2 subject companies with detail', () => {
  const s = extractVisibleScope(graph);
  assert.strictEqual(s.connectors.length, 1);
  const c = s.connectors[0];
  assert.strictEqual(c.name, 'JUANA DIR');
  assert.strictEqual(c.type, 'individual');
  assert.deepStrictEqual(c.companies.sort(), ['ALPHA SA', 'BETA SA']);
  assert.strictEqual(c.nodeId, 'o:juana');
});

test('connectors marks entity officers by subtype', () => {
  const g = {
    nodes: [
      { id: 'c:a', type: 'company', name: 'A SA' },
      { id: 'c:b', type: 'company', name: 'B SA' },
      { id: 'o:holding', type: 'officer', subtype: 'company', name: 'HOLDING SL' },
    ],
    links: [
      { source: 'o:holding', target: 'c:a', type: 'officer-company', category: 'nombramientos' },
      { source: 'o:holding', target: 'c:b', type: 'officer-company', category: 'ceses_dimisiones' },
    ],
  };
  const s = extractVisibleScope(g);
  assert.strictEqual(s.connectors[0].type, 'entity');
  assert.strictEqual(s.connectors[0].status, 'mixed'); // active at A, ceased at B
});

test('sharedNodeIds is the set of connector node ids (normalized)', () => {
  const s = extractVisibleScope(graph);
  assert.deepStrictEqual([...s.sharedNodeIds], ['o:juana']);
});

test('ownership extracts owner -> owned with lost flag', () => {
  const g = {
    nodes: [
      { id: 'c:parent', type: 'company', name: 'PARENT SA' },
      { id: 'c:sub', type: 'company', name: 'SUB SL' },
    ],
    links: [
      { source: 'c:parent', target: 'c:sub', type: 'ownership', category: 'socio_unico' },
    ],
  };
  const s = extractVisibleScope(g);
  assert.deepStrictEqual(s.ownership, [{ owner: 'PARENT SA', owned: 'SUB SL', lost: false }]);
});

test('isActiveOfficerCategory recognises appointments', () => {
  assert.strictEqual(isActiveOfficerCategory('nombramientos'), true);
  assert.strictEqual(isActiveOfficerCategory('ceses_dimisiones'), false);
});
```

Add `isActiveOfficerCategory` to the import at the top of the test file:

```javascript
import { extractVisibleScope, isActiveOfficerCategory } from '../src/utils/relationshipScope.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/relationship-scope.test.mjs`
Expected: FAIL — `isActiveOfficerCategory is not a function` and `s.connectors` / `s.ownership` / `s.sharedNodeIds` undefined.

- [ ] **Step 3: Implement the extension**

In `src/utils/relationshipScope.js`, add this exported helper near the top (after the `isOfficer` const):

```javascript
export function isActiveOfficerCategory(category) {
  const c = (category || '').toLowerCase();
  return c.includes('nombramiento') || c.includes('reeleccion') || c.includes('reelección');
}
const isOwnership = l => !!l && l.type === 'ownership';
```

Then, inside `extractVisibleScope`, replace the final `return { ... }` block with the version below. It reuses the already-computed `byId`, `companies`, `subjectNames`, `officersByCompany`, and `companiesPerOfficer`, and adds a second link pass for per-connector role/status and ownership:

```javascript
  // Per-connector detail (officers at >= 2 subject companies) + ownership links.
  const connectorAcc = {}; // name -> { node, companies:Set, roles:Set, anyActive, anyCeased }
  const ownership = [];
  links.forEach(l => {
    const a = byId.get(normalizeId(refId(l.source)));
    const b = byId.get(normalizeId(refId(l.target)));
    if (!a || !b) return;
    if (isOwnership(l)) {
      if (isSubject(a) || isSubject(b)) {
        ownership.push({
          owner: a.name, owned: b.name,
          lost: (l.category || '').toLowerCase() === 'socio_perdido',
        });
      }
      return;
    }
    let company = null, officer = null;
    if (isSubject(a) && isOfficer(b)) { company = a; officer = b; }
    else if (isSubject(b) && isOfficer(a)) { company = b; officer = a; }
    else return;
    if (!subjectNames.has(company.name)) return;
    const acc = connectorAcc[officer.name] || (connectorAcc[officer.name] = {
      node: officer, companies: new Set(), roles: new Set(), anyActive: false, anyCeased: false,
    });
    acc.companies.add(company.name);
    const role = (l.relationship || l.category || '').trim();
    if (role) acc.roles.add(role);
    if (isActiveOfficerCategory(l.category)) acc.anyActive = true; else acc.anyCeased = true;
  });

  const connectors = Object.entries(connectorAcc)
    .filter(([, acc]) => acc.companies.size >= 2)
    .map(([name, acc]) => ({
      name,
      nodeId: normalizeId(acc.node.id),
      type: acc.node.subtype === 'company' ? 'entity' : 'individual',
      companies: [...acc.companies],
      roles: [...acc.roles],
      status: acc.anyActive && acc.anyCeased ? 'mixed' : (acc.anyActive ? 'active' : 'ceased'),
    }))
    .sort((x, y) => y.companies.length - x.companies.length);

  const sharedNodeIds = new Set(connectors.map(c => c.nodeId));

  return {
    companies: companies.map(c => c.name),
    officersByCompany: Object.fromEntries(
      Object.entries(officersByCompany).map(([c, set]) => [c, [...set]])),
    connectors,
    ownership,
    sharedNodeIds,
    counts: {
      companies: companies.length,
      officers: Object.keys(companiesPerOfficer).length,
      sharedPeople,
    },
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/relationship-scope.test.mjs`
Expected: PASS (all previous + 5 new tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/relationshipScope.js test/relationship-scope.test.mjs
git commit -m "feat(relationship): scope util emits connectors, ownership, shared ids"
```

---

## Task 2: `buildReportHtml` util for Copy-for-Word

**Files:**
- Create: `src/utils/relationshipReportHtml.js`
- Test: `test/relationship-report-html.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `test/relationship-report-html.test.mjs`:

```javascript
// mapasocietario/test/relationship-report-html.test.mjs
import assert from 'node:assert';
import test from 'node:test';
import { buildReportHtml } from '../src/utils/relationshipReportHtml.js';

const scope = {
  companies: ['ALPHA SA', 'BETA SA'],
  officersByCompany: { 'ALPHA SA': ['JUANA DIR', 'PACO APO'], 'BETA SA': ['JUANA DIR'] },
  connectors: [{ name: 'JUANA DIR', type: 'individual', companies: ['ALPHA SA', 'BETA SA'], roles: ['Administradora'], status: 'active' }],
  ownership: [{ owner: 'ALPHA SA', owned: 'BETA SA', lost: false }],
  counts: { companies: 2, officers: 2, sharedPeople: 1 },
};

test('html includes a table heading and the connector name', () => {
  const html = buildReportHtml(scope, { es: true });
  assert.match(html, /<table/);
  assert.match(html, /JUANA DIR/);
  assert.match(html, /ALPHA SA/);
});

test('escapes HTML-special characters in names', () => {
  const s = { ...scope, companies: ['A & B <SA>'], connectors: [], ownership: [], officersByCompany: {} };
  const html = buildReportHtml(s, { es: true });
  assert.match(html, /A &amp; B &lt;SA&gt;/);
  assert.doesNotMatch(html, /<SA>/);
});

test('english labels when es is false', () => {
  const html = buildReportHtml(scope, { es: false });
  assert.match(html, /Shared/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/relationship-report-html.test.mjs`
Expected: FAIL — cannot find module `relationshipReportHtml.js`.

- [ ] **Step 3: Implement the util**

Create `src/utils/relationshipReportHtml.js`:

```javascript
// mapasocietario/src/utils/relationshipReportHtml.js
// Pure HTML builder for the Relationship Report — used by Copy-for-Word so the
// report pastes formatted into Word/Docs. No DOM, no React.

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export function buildReportHtml(scope, { es = true } = {}) {
  const t = es ? {
    title: 'Informe de Relaciones', notauth: 'No autoritativo',
    summary: 'empresas · administradores · conectores compartidos',
    companies: 'Empresas analizadas', shared: 'Conexiones compartidas',
    person: 'Persona / entidad', inCompanies: 'Empresas', role: 'Cargo', status: 'Estado',
    ownership: 'Vínculos de propiedad', soleOf: 'es socio único de', lostOf: 'fue socio único de',
    none: 'Ninguna detectada',
    active: 'Vigente', ceased: 'Cesado', mixed: 'Mixto', entity: 'Entidad', individual: 'Persona',
  } : {
    title: 'Relationship Report', notauth: 'Not authoritative',
    summary: 'companies · officers · shared connectors',
    companies: 'Companies analysed', shared: 'Shared connections',
    person: 'Person / entity', inCompanies: 'Companies', role: 'Role', status: 'Status',
    ownership: 'Ownership links', soleOf: 'is sole shareholder of', lostOf: 'was sole shareholder of',
    none: 'None detected',
    active: 'Active', ceased: 'Ceased', mixed: 'Mixed', entity: 'Entity', individual: 'Person',
  };
  const c = scope?.counts || { companies: 0, officers: 0, sharedPeople: 0 };
  const statusLabel = (s) => t[s] || s;

  const connectorRows = (scope?.connectors || []).map(con => `
    <tr>
      <td>${esc(con.name)} <i>(${con.type === 'entity' ? t.entity : t.individual})</i></td>
      <td>${con.companies.map(esc).join(', ')}</td>
      <td>${con.roles.map(esc).join(' / ')}</td>
      <td>${esc(statusLabel(con.status))}</td>
    </tr>`).join('');

  const ownershipRows = (scope?.ownership || []).map(o =>
    `<li>${esc(o.owner)} ${o.lost ? t.lostOf : t.soleOf} ${esc(o.owned)}</li>`).join('');

  return `<div>
  <h2>${t.title}</h2>
  <p><i>${t.notauth}</i></p>
  <p><b>${c.companies}</b> / <b>${c.officers}</b> / <b>${c.sharedPeople}</b> ${t.summary}</p>
  <h3>${t.companies}</h3>
  <p>${(scope?.companies || []).map(esc).join(' · ') || t.none}</p>
  <h3>${t.shared}</h3>
  ${connectorRows
    ? `<table border="1" cellpadding="4" cellspacing="0">
      <thead><tr><th>${t.person}</th><th>${t.inCompanies}</th><th>${t.role}</th><th>${t.status}</th></tr></thead>
      <tbody>${connectorRows}</tbody></table>`
    : `<p>${t.none}</p>`}
  <h3>${t.ownership}</h3>
  ${ownershipRows ? `<ul>${ownershipRows}</ul>` : `<p>${t.none}</p>`}
</div>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/relationship-report-html.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/relationshipReportHtml.js test/relationship-report-html.test.mjs
git commit -m "feat(relationship): buildReportHtml for Copy-for-Word"
```

---

## Task 3: Print stylesheet

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add the print rules**

Append to `src/index.css` (the modal will set `id="relationship-report-print"` on its scrollable content in Task 4):

```css
/* Relationship report: print only the report body when Save-as-PDF is used. */
@media print {
  body * { visibility: hidden !important; }
  #relationship-report-print, #relationship-report-print * { visibility: visible !important; }
  #relationship-report-print {
    position: absolute; left: 0; top: 0; width: 100%;
    max-height: none !important; overflow: visible !important;
    color: #000; background: #fff;
  }
  .rel-report-no-print { display: none !important; }
}
```

- [ ] **Step 2: Verify build is not broken**

Run: `npm run build`
Expected: build completes without CSS errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(relationship): print stylesheet scoped to the report body"
```

---

## Task 4: `RelationshipReportModal` component

**Files:**
- Create: `src/components/RelationshipReportModal.jsx`

This renders the report from `scope` (the extended shape from Task 1) and replaces `RelationshipReportDialog`. Props: `open`, `onClose`, `scope`, `subjects`, `lang`, `onRemoveCompany`.

- [ ] **Step 1: Create the component**

Create `src/components/RelationshipReportModal.jsx`:

```jsx
// mapasocietario/src/components/RelationshipReportModal.jsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box, Button,
  Chip, ToggleButton, ToggleButtonGroup, Table, TableHead, TableBody, TableRow,
  TableCell, Accordion, AccordionSummary, AccordionDetails, Alert, Snackbar,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TranslateIcon from '@mui/icons-material/Translate';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { buildReportHtml } from '../utils/relationshipReportHtml';

export default function RelationshipReportModal({ open, onClose, scope, subjects, lang = 'es', onRemoveCompany }) {
  const [reportLang, setReportLang] = useState(lang === 'en' ? 'en' : 'es');
  const [copied, setCopied] = useState(false);
  const es = reportLang !== 'en';

  const companies = scope?.companies || [];
  const connectors = scope?.connectors || [];
  const ownership = scope?.ownership || [];
  const counts = scope?.counts || { companies: 0, officers: 0, sharedPeople: 0 };
  const officersByCompany = scope?.officersByCompany || {};
  const tooFew = companies.length < 2;

  const statusLabel = (s) => es
    ? ({ active: 'Vigente', ceased: 'Cesado', mixed: 'Mixto' }[s] || s)
    : ({ active: 'Active', ceased: 'Ceased', mixed: 'Mixed' }[s] || s);

  const copyForWord = async () => {
    const html = buildReportHtml(scope, { es });
    try {
      const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })]);
      setCopied(true);
    } catch {
      // Fallback for browsers without ClipboardItem.
      await navigator.clipboard.writeText(html);
      setCopied(true);
    }
  };

  const saveAsPdf = () => window.print();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle className="rel-report-no-print">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <AccountTreeIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
            {es ? 'Informe de Relaciones' : 'Relationship Report'}
          </Typography>
          <Chip label={es ? 'No autoritativo' : 'Not authoritative'} size="small" color="warning" variant="outlined" />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TranslateIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
            <ToggleButtonGroup
              value={reportLang} exclusive size="small"
              onChange={(_, v) => v && setReportLang(v)}
              sx={{ '& .MuiToggleButton-root': { py: 0.2, px: 1.2, fontSize: '0.72rem', textTransform: 'none' } }}>
              <ToggleButton value="es">ES</ToggleButton>
              <ToggleButton value="en">EN</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent id="relationship-report-print" dividers>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>{counts.companies}</strong>{' '}{es ? 'empresas' : 'companies'} ·{' '}
          <strong>{counts.officers}</strong>{' '}{es ? 'administradores' : 'officers'} ·{' '}
          <strong>{counts.sharedPeople}</strong>{' '}{es ? 'conexiones compartidas' : 'shared connections'}
        </Typography>

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 700 }}>
          {es ? 'Empresas analizadas' : 'Companies analysed'}
        </Typography>
        <Box sx={{ mb: 1 }}>
          {companies.map(c => (
            <Chip key={c} label={c} size="small" sx={{ mr: 0.5, mb: 0.5 }}
              onDelete={onRemoveCompany ? () => onRemoveCompany(c) : undefined} />
          ))}
        </Box>
        {tooFew && (
          <Alert severity="info" className="rel-report-no-print" sx={{ mb: 1, fontSize: '0.8rem' }}>
            {es ? 'Añade al menos 2 empresas para el informe.' : 'Add at least 2 companies for the report.'}
          </Alert>
        )}

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 700 }}>
          {es ? 'Conexiones compartidas' : 'Shared connections'}
        </Typography>
        {connectors.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {es ? 'Ninguna detectada.' : 'None detected.'}
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{es ? 'Persona / entidad' : 'Person / entity'}</TableCell>
                <TableCell>{es ? 'Empresas' : 'Companies'}</TableCell>
                <TableCell>{es ? 'Cargo' : 'Role'}</TableCell>
                <TableCell>{es ? 'Estado' : 'Status'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {connectors.map(con => (
                <TableRow key={con.nodeId || con.name}>
                  <TableCell>
                    {con.name}{' '}
                    <Typography component="span" variant="caption" color="text.secondary">
                      ({con.type === 'entity' ? (es ? 'Entidad' : 'Entity') : (es ? 'Persona' : 'Person')})
                    </Typography>
                  </TableCell>
                  <TableCell>{con.companies.join(', ')}</TableCell>
                  <TableCell>{con.roles.join(' / ')}</TableCell>
                  <TableCell>{statusLabel(con.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 700 }}>
          {es ? 'Vínculos de propiedad' : 'Ownership links'}
        </Typography>
        {ownership.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {es ? 'Ninguno detectado.' : 'None detected.'}
          </Typography>
        ) : (
          <Box component="ul" sx={{ pl: 3, my: 0.5 }}>
            {ownership.map((o, i) => (
              <li key={i}>
                <Typography variant="body2">
                  <strong>{o.owner}</strong>{' '}
                  {o.lost ? (es ? 'fue socio único de' : 'was sole shareholder of') : (es ? 'es socio único de' : 'is sole shareholder of')}{' '}
                  <strong>{o.owned}</strong>
                </Typography>
              </li>
            ))}
          </Box>
        )}

        <Accordion sx={{ mt: 2 }} disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {es ? 'Administradores por empresa' : 'Officers per company'}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {companies.map(c => (
              <Box key={c} sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{c}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {(officersByCompany[c] || []).join(', ') || (es ? '—' : '—')}
                </Typography>
              </Box>
            ))}
          </AccordionDetails>
        </Accordion>
      </DialogContent>

      <DialogActions className="rel-report-no-print" sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{es ? 'Cerrar' : 'Close'}</Button>
        <Button startIcon={<ContentCopyIcon />} onClick={copyForWord} disabled={tooFew}>
          {es ? 'Copiar para Word' : 'Copy for Word'}
        </Button>
        <Button variant="contained" startIcon={<PictureAsPdfIcon />} onClick={saveAsPdf} disabled={tooFew}>
          {es ? 'Guardar como PDF' : 'Save as PDF'}
        </Button>
      </DialogActions>

      <Snackbar
        open={copied} autoHideDuration={2500} onClose={() => setCopied(false)}
        message={es ? 'Copiado — pégalo en Word' : 'Copied — paste into Word'}
      />
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds (component is imported in Task 5; a standalone build still type-checks JSX/imports via Vite once imported — if not yet imported, this step just confirms no syntax error by temporarily importing; skip if Task 5 follows immediately).

- [ ] **Step 3: Commit**

```bash
git add src/components/RelationshipReportModal.jsx
git commit -m "feat(relationship): on-screen RelationshipReportModal (print + copy-for-Word + deletable companies)"
```

---

## Task 5: Wire the modal into the graph (replace dialog, remove-company, count badge)

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx`

- [ ] **Step 1: Swap the import**

Change line 72 from:

```jsx
import RelationshipReportDialog from './RelationshipReportDialog';
```

to:

```jsx
import RelationshipReportModal from './RelationshipReportModal';
```

- [ ] **Step 2: Build the live detailed scope memo**

The modal and the highlight (Task 7) both need the full detailed scope continuously. Add this right after the `visibleCompanyCount` memo (currently ends at line 4229):

```jsx
  // Live, detailed relationship scope from the visible graph — single source of
  // truth for both the report modal and the shared-connections highlight.
  const relationshipDetailedScope = React.useMemo(
    () => extractVisibleScope(filteredGraphData, normalizeNodeId, relationshipSubjectIds),
    [filteredGraphData, relationshipSubjectIds]);
```

- [ ] **Step 3: Use the detailed scope when opening the report**

In `openRelationshipReport` (line 4234), replace the first line:

```jsx
    const scope = extractVisibleScope(filteredGraphData, normalizeNodeId, relationshipSubjectIds);
```

with:

```jsx
    const scope = relationshipDetailedScope;
```

and add `relationshipDetailedScope` to its dependency array (line 4255): change `[filteredGraphData, relationshipSubjectIds]` to `[relationshipDetailedScope, relationshipSubjectIds]`.

- [ ] **Step 4: Add the remove-company handler**

Add after `openRelationshipReport` (after line 4255). It maps a company NAME (what the modal chip carries) to its node id among the subjects, unpins it, and hides it:

```jsx
  // Remove a company from the report: unpin it and hide it from the graph, so
  // the report scope (= pinned subjects) and the graph stay in sync.
  const removeCompanyFromReport = useCallback((companyName) => {
    const node = filteredGraphData.nodes.find(
      n => (n.type === 'company' || n.type === 'spanish-company-group') && n.name === companyName);
    if (!node) return;
    const id = normalizeNodeId(node.id);
    setPinnedNodeIds(prev => {
      const next = new Set(prev); next.delete(id); return next;
    });
    setHiddenNodeIds(prev => new Set([...prev, id]));
    // Keep the open report in sync immediately.
    setRelScope(extractVisibleScope(filteredGraphData, normalizeNodeId,
      new Set([...relationshipSubjectIds].filter(x => x !== id))));
  }, [filteredGraphData, relationshipSubjectIds]);
```

- [ ] **Step 5: Add a count badge to the report button**

Replace the report button block (lines 5244-5257) with a version that shows the live company count. Note `visibleCompanyCount` already exists:

```jsx
        {visibleCompanyCount >= 2 && (
          <Tooltip title="Informe de relaciones sobre las empresas visibles (gratis)">
            <span>
              <Badge badgeContent={visibleCompanyCount} color="primary"
                sx={{ '& .MuiBadge-badge': { right: 2, top: 2 } }}>
                <Button
                  variant="outlined" color="primary" size="small"
                  startIcon={relResolving ? <CircularProgress size={14} /> : <AccountTreeIcon />}
                  disabled={relResolving}
                  sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
                  onClick={openRelationshipReport}>
                  Informe de relaciones
                </Button>
              </Badge>
            </span>
          </Tooltip>
        )}
```

Ensure `Badge` is imported from `@mui/material` (add it to the existing MUI import block if missing).

- [ ] **Step 6: Replace both dialog render sites**

At both render sites (around line 7503 and line 7569), replace:

```jsx
        <RelationshipReportDialog
          open={relReportOpen}
          onClose={() => setRelReportOpen(false)}
          scope={relScope}
          subjects={relSubjects}
          lang="es"
        />
```

with:

```jsx
        <RelationshipReportModal
          open={relReportOpen}
          onClose={() => setRelReportOpen(false)}
          scope={relScope}
          subjects={relSubjects}
          lang="es"
          onRemoveCompany={removeCompanyFromReport}
        />
```

- [ ] **Step 7: Build and verify**

Run: `npm run build`
Expected: build succeeds with no missing-import or undefined-symbol errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/SpanishCompanyNetworkGraph.jsx
git commit -m "feat(relationship): open on-screen modal, remove-company syncs graph, count badge"
```

---

## Task 6: Shared-connections toggle (state + toolbar button)

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx`

- [ ] **Step 1: Add toggle state**

Next to the other `rel*` state (after line 647), add:

```jsx
  const [showSharedConnections, setShowSharedConnections] = useState(false);
```

- [ ] **Step 2: Add the toolbar toggle**

Immediately after the report button `Tooltip`/`Badge` block from Task 5 Step 5 (still inside the same `{visibleCompanyCount >= 2 && ...}` is NOT required — place it as its own block right after), add:

```jsx
        {visibleCompanyCount >= 2 && (
          <Tooltip title={showSharedConnections
            ? 'Ocultar conexiones compartidas'
            : 'Resaltar administradores/entidades en varias empresas y atenuar el resto'}>
            <Button
              variant={showSharedConnections ? 'contained' : 'outlined'}
              color="info" size="small"
              startIcon={<HubIcon />}
              sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
              onClick={() => setShowSharedConnections(v => !v)}>
              {showSharedConnections ? 'Conexiones compartidas ✓' : 'Conexiones compartidas'}
            </Button>
          </Tooltip>
        )}
```

Add `import HubIcon from '@mui/icons-material/Hub';` near the other icon imports (top of file, alongside `AccountTreeIcon`).

- [ ] **Step 3: Build and verify the toggle toggles**

Run: `npm run build`
Expected: build succeeds. (Visual effect is wired in Task 7.)

- [ ] **Step 4: Commit**

```bash
git add src/components/SpanishCompanyNetworkGraph.jsx
git commit -m "feat(relationship): show-shared-connections toggle (toolbar + state)"
```

---

## Task 7: Render the shared-connections highlight (Option A: halo + hot edges + dim rest)

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx`

The highlight reuses the existing Pathfinder dimming constant `PATH_DIM_ALPHA` and the cyan `PATH_HIGHLIGHT_COLOR`. The set of connector node ids comes from `relationshipDetailedScope.sharedNodeIds`.

- [ ] **Step 1: Expose the shared-id set for the painters**

Add after the `relationshipDetailedScope` memo (from Task 5 Step 2):

```jsx
  const sharedHighlightIds = showSharedConnections
    ? relationshipDetailedScope.sharedNodeIds
    : null;
```

- [ ] **Step 2: Dim + halo in `nodeCanvasObject`**

In `nodeCanvasObject`, extend the alpha control block (currently lines 4392-4398). Replace:

```jsx
      // Pathfinder alpha control
      const inPath = shortestPathNodes.has(normalizeNodeId(node.id));
      if (pathfinderActive && shortestPathNodes.size > 0) {
        ctx.globalAlpha = inPath ? 1.0 : PATH_DIM_ALPHA;
      } else {
        ctx.globalAlpha = 1.0;
      }
```

with:

```jsx
      // Pathfinder alpha control
      const inPath = shortestPathNodes.has(normalizeNodeId(node.id));
      const isSharedConnector = !!sharedHighlightIds && sharedHighlightIds.has(normalizeNodeId(node.id));
      if (pathfinderActive && shortestPathNodes.size > 0) {
        ctx.globalAlpha = inPath ? 1.0 : PATH_DIM_ALPHA;
      } else if (sharedHighlightIds) {
        ctx.globalAlpha = isSharedConnector ? 1.0 : PATH_DIM_ALPHA;
      } else {
        ctx.globalAlpha = 1.0;
      }
```

Then add a halo for shared connectors. In the ring-drawing block (currently lines 4426-4438), add an `else if` branch after the `pathfinderActive && inPath` branch:

```jsx
      } else if (isSharedConnector) {
        ctx.strokeStyle = PATH_HIGHLIGHT_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius + 4, 0, 2 * Math.PI, false);
        ctx.stroke();
      }
```

Add `sharedHighlightIds` to the `nodeCanvasObject` dependency array (line 4527).

- [ ] **Step 3: Hot/dim edges in `linkCanvasObject`**

In `linkCanvasObject`, after `const isLinkInPath = ...` (line 4550), add a check for whether the link touches a shared connector:

```jsx
      const touchesShared = !!sharedHighlightIds && (
        sharedHighlightIds.has(normalizeNodeId(typeof start === 'object' ? start.id : start)) ||
        sharedHighlightIds.has(normalizeNodeId(typeof end === 'object' ? end.id : end)));
```

Then, in the link-color chain (starts line 4553), add the shared cases. Change the opening of the chain from:

```jsx
      if (pathfinderActive && isLinkInPath) {
        linkColor = PATH_HIGHLIGHT_COLOR;
      } else if (link.type === 'ownership') {
```

to:

```jsx
      if (pathfinderActive && isLinkInPath) {
        linkColor = PATH_HIGHLIGHT_COLOR;
      } else if (sharedHighlightIds && touchesShared) {
        linkColor = PATH_HIGHLIGHT_COLOR;
      } else if (link.type === 'ownership') {
```

Then dim non-shared links. Find where the link is stroked in `linkCanvasObject` (search for `ctx.globalAlpha` / `ctx.stroke()` for the edge line) and set alpha before drawing the line. Add, just before the link's main `ctx.beginPath()`/stroke:

```jsx
      const prevLinkAlpha = ctx.globalAlpha;
      if (sharedHighlightIds) ctx.globalAlpha = touchesShared ? 1.0 : PATH_DIM_ALPHA;
```

and restore after the stroke with:

```jsx
      ctx.globalAlpha = prevLinkAlpha;
```

(Place the restore after the edge line is drawn but it is fine to restore before label drawing so labels also dim consistently — set it at the end of the link line section.)

Add `sharedHighlightIds` to the `linkCanvasObject` dependency array (line 4692).

- [ ] **Step 4: Build and manually verify the highlight**

Run: `npm run build` (expected: success).

Then `npm run dev`, open `/app`, search two companies that share a director, click **"Conexiones compartidas"**:
- Expected: the shared director/entity nodes get a cyan halo and stay full-opacity; their edges go cyan; all other nodes/edges fade to ~28%. Toggling off restores the normal graph.

- [ ] **Step 5: Commit**

```bash
git add src/components/SpanishCompanyNetworkGraph.jsx
git commit -m "feat(relationship): graph highlight for shared connectors (halo + hot edges + dim rest)"
```

---

## Task 8: Remove the old dialog and final verification

**Files:**
- Delete: `src/components/RelationshipReportDialog.jsx`

- [ ] **Step 1: Confirm no remaining references**

Run: `grep -rn "RelationshipReportDialog" src`
Expected: no matches.

- [ ] **Step 2: Delete the old component**

```bash
git rm src/components/RelationshipReportDialog.jsx
```

- [ ] **Step 3: Full build + all tests**

Run: `npm run build && node --test test/relationship-scope.test.mjs test/relationship-report-html.test.mjs`
Expected: build succeeds; all unit tests pass.

- [ ] **Step 4: Manual end-to-end check**

`npm run dev`, open `/app`:
- Search 2+ related companies → **Informe de relaciones** badge shows the count.
- Open the report → summary, deletable company chips, shared-connections table, ownership list, per-company accordion all render.
- Delete a company chip → it disappears from the report AND from the graph; counts update; below 2 companies disables export buttons.
- **Copy for Word** → paste into a document shows a formatted table.
- **Save as PDF** → print preview shows only the report body (toolbar/buttons hidden), not the whole app.
- **Conexiones compartidas** toggle → graph dims and connectors glow.
- Single-company DD report flow → unchanged (still offers AI + PDF).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(relationship): remove download-only RelationshipReportDialog"
```

---

## Self-Review Notes

- **Spec coverage:** on-screen modal (Task 4), remove company + hide from graph (Task 5 Step 4), shared highlight Option A + toggle off by default (Tasks 6-7), Save-as-PDF print (Tasks 3-4), Copy-for-Word (Tasks 2,4), no AI/server call for relationship report (old dialog deleted, Task 8), single-source-of-truth util (Task 1), single-company DD untouched (no DD files modified). All covered.
- **No new dependency:** print via `window.print` + CSS; copy via `ClipboardItem` (already used in the repo).
- **Type consistency:** modal consumes `scope.connectors[].{name,nodeId,type,companies,roles,status}`, `scope.ownership[].{owner,owned,lost}`, `scope.sharedNodeIds` (Set) — exactly the shape Task 1 emits. `removeCompanyFromReport` keys off company `name` (what chips carry) and resolves to node id internally.
- **Known follow-up (not in scope):** AI narrative can return later as a backend that streams structured content; line numbers in this plan are from the current `main` and may drift — match on the surrounding code, not the absolute line.
