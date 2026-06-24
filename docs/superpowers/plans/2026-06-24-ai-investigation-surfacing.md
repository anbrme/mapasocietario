# Surfacing AI Investigation (Acquisition) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Surface the (live) AI Investigation as advertised, included value of the paid DD — to drive purchases — at the graph (highest intent), the DD/pricing pages, and the checkout dialog, with honest copy and a mobile-safe checkout.

**Architecture:** Frontend-only, additive. Reuse the existing `AIInvestigationGate` (give it an `onBuy` path so a non-buyer's unlock view becomes a "Get the DD" CTA) and the graph's existing `DDCheckoutDialog` wiring. Add factual feature copy to the DD page, pricing page, and checkout summary. No backend change.

**Tech Stack:** React 18, Vite, MUI v5; Capacitor Android (constrained viewport). Components are NOT unit-tested in this repo — verify with `npx vite build`.

## Global Constraints

- Frontend only (`mapasocietario`). No backend / entitlement / engine change. Existing buyer redeem flow unchanged.
- **Framing (binding):** factual capability only — **no fabricated social proof, urgency, or superlatives**. Consistent name "AI Investigation" / "Investigación por IA", always tied to "included with a Due Diligence report" + "2 days". Bilingual (en/es) via each file's existing `COPY`/`SEARCH_COPY`/`DD_COPY`.
- **Mobile/Android (binding):** `DDCheckoutDialog` is already `fullScreen` at `sm` with the email field first in the content. The surface-C line goes in the order summary **near the price, below the email field, never above it**, as a single compact row — so it cannot push the email field down or behind the soft keyboard. Verify at ≤`sm` with the keyboard open: email reachable, content scrollable, nothing clipped.
- Verify every task with `npx vite build` (zero errors). Do NOT run `npm run build`.

---

### Task 1: Graph acquisition CTA (surface A)

**Files:**
- Modify: `src/components/AIInvestigationGate.jsx` (props `onBuy`/`focusCompany`; CTA region in the unlock view; `COPY` strings)
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` (pass `onBuy` + `focusCompany` to the mounted gate)

**Interfaces:**
- Produces: `AIInvestigationGate` accepts `onBuy?: (companyName: string) => void` and `focusCompany?: string`. When in the unlock view (`!session`), it renders a non-buyer CTA that calls `onBuy(focusCompany)`. No-ops if `onBuy` is absent (other mounts, e.g. the order page, simply don't pass it → CTA hidden).

- [ ] **Step 1: Add the props + COPY to `AIInvestigationGate.jsx`**

Extend the signature (line 36) to add `onBuy = null, focusCompany = ''`:

```jsx
export default function AIInvestigationGate({ open, onClose, language = 'es', prefillEmail = '', prefillCode = '', context = null, onBuy = null, focusCompany = '' }) {
```

In the `COPY` object, add to **both** `en` and `es`:

```jsx
// en:
    buyTitle: 'Don’t have a Due Diligence report yet?',
    buyBody: 'AI Investigation is included with every Due Diligence report: ask questions about this network and get cited answers that separate registry facts from press. 2 days of access per report.',
    buyCta: company => company ? `Get the Due Diligence report for ${company}` : 'Get a Due Diligence report',
// es:
    buyTitle: '¿Aún no tienes un informe de Due Diligence?',
    buyBody: 'La Investigación por IA se incluye con cada informe de Due Diligence: pregunta sobre esta red y obtén respuestas citadas que separan los hechos registrales de la prensa. 2 días de acceso por informe.',
    buyCta: company => company ? `Obtener el informe de Due Diligence de ${company}` : 'Obtener un informe de Due Diligence',
```

- [ ] **Step 2: Render the CTA region in the unlock view**

In the unlock branch (`{!session ? ( ... )` around line 131–139), after the unlock `Button` (the `t.unlock` button) and before the branch closes, add the CTA — shown only when `onBuy` is provided:

```jsx
            {onBuy && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>{t.buyTitle}</Typography>
                <Typography variant="body2" color="text.secondary">{t.buyBody}</Typography>
                <Button variant="contained" color="warning" onClick={() => { onClose?.(); onBuy(focusCompany); }}>
                  {t.buyCta(focusCompany)}
                </Button>
              </Box>
            )}
```

(`Box`, `Typography`, `Button` are already imported in this file.)

- [ ] **Step 3: Wire the graph to pass `onBuy` + `focusCompany`**

In `src/components/SpanishCompanyNetworkGraph.jsx`, find the mounted `<AIInvestigationGate ... />` (the one opened by `aiPanelOpen`) and add the two props. The graph already has `setDdCheckoutCompany`/`setDdCheckoutOpen` (used by the DD button ~6047) and `primarySubject` (the focused company):

```jsx
        <AIInvestigationGate
          open={aiPanelOpen}
          onClose={() => { setAiPanelOpen(false); setEntitlementTick((t) => t + 1); }}
          language={uiLanguage}
          context={aiPanelContext}
          focusCompany={primarySubject || ''}
          onBuy={(name) => {
            const company = (name || primarySubject || '').trim();
            if (!company) return;
            setDdCheckoutCompany(company);
            setDdCheckoutOpen(true);
          }}
        />
```

(Keep any existing props on that mount; only add `focusCompany` + `onBuy`. If the mount already passes `open`/`onClose`/`language`/`context`, leave those as-is and just add the two new lines.)

- [ ] **Step 4: Verify the build**

Run: `cd /Users/alessandronurnberg/mapasocietario && npx vite build`
Expected: completes, zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/AIInvestigationGate.jsx src/components/SpanishCompanyNetworkGraph.jsx
git commit -m "feat: AI Investigation graph CTA — non-buyers can buy the DD for the focused company"
```

---

### Task 2: DD page + pricing feature block (surface B)

**Files:**
- Modify: `src/components/SpanishCompanyDueDiligencePage.jsx` (chip + feature card/paragraph)
- Modify: `src/components/PricingPage.jsx` (DD-tier feature line)

**Interfaces:** none (display copy only).

- [ ] **Step 1: Add the chip on the DD page**

In `src/components/SpanishCompanyDueDiligencePage.jsx`, the chip array (~line 86) is `['BORME registry data', 'Officer history', 'BOE sanctions checks', 'PDF report', 'No subscription']`. Add `'2-day AI investigation'`:

```jsx
            {['BORME registry data', 'Officer history', 'BOE sanctions checks', 'PDF report', '2-day AI investigation', 'No subscription'].map((chip) => (
```

- [ ] **Step 2: Add the feature card + paragraph**

The page has a features array of `{ icon, title, text }` (the `PDF report` entry is ~line 48). Add an entry (reuse an existing imported icon, e.g. `DescriptionIcon`, or import `PsychologyIcon` from `@mui/icons-material/Psychology` if you want a distinct icon):

```jsx
  { icon: <PsychologyIcon />, title: '2-day AI investigation', text: 'Every report includes 2 days of AI investigation: ask questions about the company’s network and get answers that cite live web sources and separate registry facts from press reports.' },
```

If you import `PsychologyIcon`, add `import PsychologyIcon from '@mui/icons-material/Psychology';` with the other icon imports. This page is English-only content (it’s the EN DD landing); keep the copy English here.

- [ ] **Step 3: Add the pricing feature line**

In `src/components/PricingPage.jsx`, find the Due Diligence tier's feature list (an array of strings or list items the tier renders). Add the factual line, matching the file's bilingual pattern (if `PricingPage` has a `COPY`/`es`/`en` structure, add to both; if it's English-only, add the English line). Use:
- en: `'Includes 2 days of AI investigation (ask about a company’s network, cited answers)'`
- es (only if the file is bilingual): `'Incluye 2 días de investigación por IA (preguntas sobre la red de una empresa, respuestas citadas)'`

Inspect the tier structure first (`grep -nE "Due Diligence|features|tier|€|22" src/components/PricingPage.jsx`) and insert into the DD tier's existing feature collection — do not restructure the component.

- [ ] **Step 4: Verify the build**

Run: `cd /Users/alessandronurnberg/mapasocietario && npx vite build`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/SpanishCompanyDueDiligencePage.jsx src/components/PricingPage.jsx
git commit -m "feat: advertise included 2-day AI investigation on DD + pricing pages"
```

---

### Task 3: Checkout reassurance line + mobile readability (surface C)

**Files:**
- Modify: `src/components/DDCheckoutDialog.jsx` (one summary row near the price + `DD_COPY` strings)

**Interfaces:** none.

- [ ] **Step 1: Add the COPY string**

In `DDCheckoutDialog.jsx`, the `DD_COPY` object has `en` and `es` (e.g. `emailLabel`, `basePrice`, `total`). Add to both:

```jsx
// en:
    aiIncluded: 'Includes 2 days of AI investigation on this company’s network',
// es:
    aiIncluded: 'Incluye 2 días de investigación por IA sobre la red de esta empresa',
```

- [ ] **Step 2: Render the line in the order summary, near the price (BELOW the email field)**

Locate the price/summary area (the rows using `copy.basePrice`/`copy.total`/`DD_PRICE` — these are lower in `DialogContent`, after the email `TextField`). Add a single compact row adjacent to the total, e.g.:

```jsx
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
          {copy.aiIncluded}
        </Typography>
```

Place it next to the price/total block — NOT above the email field, and NOT inside `DialogActions`. It must be one line (no banner). Confirm there is no change above the email `TextField` (line ~556) so the email stays first in the content.

- [ ] **Step 3: Verify the build**

Run: `cd /Users/alessandronurnberg/mapasocietario && npx vite build`
Expected: zero errors.

- [ ] **Step 4: Mobile/Android readability check (manual — required by spec)**

Run `npm run dev`, open the checkout dialog, and use a narrow viewport (DevTools device toolbar at ≤`sm`, ~360–400px wide — the Capacitor Android case): the dialog is `fullScreen`; **focus the email field and bring up the keyboard** — confirm the email field stays visible/usable, the content scrolls, the new `aiIncluded` line sits by the price (below email) and is not clipped, and nothing overlaps the pay button. If the email field is obscured when focused, ensure `DialogContent` scrolls (MUI default) and that no added element sits above it. Report the viewport width tested.

- [ ] **Step 5: Commit**

```bash
git add src/components/DDCheckoutDialog.jsx
git commit -m "feat: checkout reassurance line for included AI investigation (mobile-safe, below email)"
```

---

## Self-Review

**Spec coverage:** A (graph CTA) → Task 1 ✓; B (DD page + pricing) → Task 2 ✓; C (checkout line) → Task 3 ✓; mobile/Android constraint → Task 3 Step 4 (manual check) + the placement rule in Steps 1–2 + Global Constraints ✓; framing (no fake social proof/urgency, bilingual, factual) → copy in Tasks 1–3 + Global Constraints ✓; homepage held → not in plan ✓; no backend change → nothing touches the worker/engine ✓; buyer redeem flow unchanged → Task 1 only ADDS the CTA to the unlock view, leaves the email/code form intact ✓.

**Placeholder scan:** No TBD/TODO. Component tasks verify via `npx vite build` (repo convention — no component unit tests) plus the explicit manual mobile check in Task 3. Task 2 Step 3 has a `grep` + "inspect the tier structure" instruction because `PricingPage`'s exact feature-list shape isn't pinned here — concrete lookup, not hand-waving; the line to add is given verbatim.

**Type consistency:** `onBuy: (companyName) => void` and `focusCompany: string` consistent between the gate (Task 1 def) and the graph mount (Task 1 use); `t.buyCta(focusCompany)` matches the `buyCta: company => ...` COPY function; `copy.aiIncluded` consistent between the DD_COPY addition and the render (Task 3).
