# Sole Shareholder Name in Preview Resumen Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the current sole shareholder's name — honestly tagged as natural person or company — in the /empresa preview dialog's Resumen card.

**Architecture:** Frontend-only edit to one React component. Preserve the person-vs-company split (currently discarded by a merge) by adding two enriched fields, then render one new Resumen grid row gated on `isUnipersonal`. Bilingual labels via the existing `text` object.

**Tech Stack:** React 19, MUI, Vite. Component: `src/components/SpanishCompanyNetworkGraph.jsx`.

## Global Constraints

- No backend change. `sole_shareholders` / `sole_shareholder_individuals` already arrive on the v3 payload as arrays of bare strings.
- Immutable: add fields, never mutate `company` or existing enriched fields.
- Do NOT alter the existing title-bar sole-shareholder chip (lines ~8510-8532) — it consumes the merged `soleShareholders` array, which must stay.
- Bilingual: every user-facing string added to the `text`/labels object (ES + EN, ~lines 613-641).
- No unit-test seam exists for the preview dialog; verification is by driving the live app.

---

### Task 1: Surface the current sole shareholder name in the Resumen card

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` (labels ~613-641; enriched object ~4920-4923; Resumen grid ~8707)

**Interfaces:**
- Consumes: `company.sole_shareholders` (corporate, string[]), `company.sole_shareholder_individuals` (individuals, string[]), `e.isUnipersonal` (bool), `e.previousSoleShareholders` (string[], already built).
- Produces: enriched fields `soleShareholdersCorporate: string[]`, `soleShareholdersIndividual: string[]`; `text` keys `soleShareholder`, `naturalPersonTag`, `companyTag`.

- [ ] **Step 1: Add bilingual labels**

Locate the labels object (~lines 613-641, both `es` and `en` branches — match the existing structure). Add three keys to each language:

Spanish:
```js
soleShareholder: 'Socio único',
naturalPersonTag: '(persona física)',
companyTag: '(sociedad)',
```

English:
```js
soleShareholder: 'Sole shareholder',
naturalPersonTag: '(natural person)',
companyTag: '(company)',
```

(Match the exact key placement/quote style already used in that object.)

- [ ] **Step 2: Preserve the person/company split in the enriched object**

At the enriched object (~lines 4920-4927), immediately after the existing `soleShareholders` / `previousSoleShareholders` fields, add:

```js
              // Split kept separately so the preview can label owner type honestly
              // (the merged soleShareholders array above loses this distinction).
              soleShareholdersCorporate: company?.sole_shareholders || [],
              soleShareholdersIndividual: company?.sole_shareholder_individuals || [],
```

Leave the existing merged `soleShareholders` array untouched.

- [ ] **Step 3: Render the new Resumen row**

In the Resumen grid, insert a new `<Box>` right after the "Publicaciones encontradas" block (the `e?.eventCount > 0` block ending ~line 8721) and before the `hojaHistory` block. Use:

```jsx
                      {e?.isUnipersonal &&
                        ((e?.soleShareholdersCorporate?.length || 0) +
                          (e?.soleShareholdersIndividual?.length || 0) > 0) && (
                        <Box sx={{ gridColumn: '1 / -1' }}>
                          <Typography variant="caption" color="text.secondary">{text.soleShareholder}</Typography>
                          <Typography variant="body2">
                            {[
                              ...e.soleShareholdersCorporate.map((n) => `${n} ${text.companyTag}`),
                              ...e.soleShareholdersIndividual.map((n) => `${n} ${text.naturalPersonTag}`),
                            ].join(', ')}
                          </Typography>
                          {e?.previousSoleShareholders?.length > 0 && (
                            <Typography variant="caption" sx={{ color: 'warning.main', fontStyle: 'italic' }}>
                              {text.previous}: {e.previousSoleShareholders.join(', ')}
                            </Typography>
                          )}
                        </Box>
                      )}
```

- [ ] **Step 4: Build to catch syntax/JSX errors**

Run: `npm run build`
Expected: build succeeds with no new errors. (A green `vite build` does not prove the app works — Step 5 is the real check.)

- [ ] **Step 5: Verify in the live app**

Use the `verify` skill / browser against a CORS-allowlisted origin (localhost search fails on CORS — verify on the live/allowlisted origin). Check:
- A unipersonal company with a **corporate** owner → row shows `NAME (sociedad)`.
- A unipersonal company with an **individual** owner (e.g. Monkimun → `MONKIMUN IMC (persona física)`) → row shows the person tag.
- A company whose owner **changed** → row shows current owner + `Anterior/Previous:` history caption.
- A **non-unipersonal** company → no new row appears.
- The existing title-bar chip still renders unchanged for changed-owner companies.

- [ ] **Step 6: Commit**

```bash
git -c commit.gpgsign=false commit -am "feat: show sole shareholder name in /empresa preview Resumen card"
```

## Self-Review

- **Spec coverage:** Data change (Step 2) ✓; label added (Step 1) ✓; UI row with qualifiers + history (Step 3) ✓; gating on isUnipersonal + non-empty ✓; no backend / no chip change (constraints) ✓; verification (Step 5) ✓.
- **Placeholders:** none — all code shown.
- **Type consistency:** `soleShareholdersCorporate` / `soleShareholdersIndividual` / `soleShareholder` / `naturalPersonTag` / `companyTag` used identically in Steps 1-3.
