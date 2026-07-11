# Sole shareholder name in the /empresa preview Resumen card

**Date:** 2026-07-11
**Component:** `src/components/SpanishCompanyNetworkGraph.jsx`
**Scope:** Feature A only (frontend-only). Feature B ("Ver en BORME" links) deferred.

## Problem

The company preview dialog's "Resumen" card shows a `Unipersonal` status chip but never
names *who* the sole shareholder (socio único) is. The only place the name appears is a
title-bar chip (lines ~8510-8532) that is gated on `previousSoleShareholders?.length > 0`
— so a company with a single, never-changed sole shareholder shows nothing at all.

This surfaced with "Monkimun IMC" — a BORME source typo for "Monkimun INC" (a US company).
Because "IMC" is a name token, not a legal form, the classifier correctly reads it as a
persona física. Hiding the name hides the registry oddity; showing it honestly
("MONKIMUN IMC — persona física") makes the data legible and lets the user reconcile it
against the financial-statements view. We surface the registry as-is; we do not fix
BORME's data.

## Data change (required)

The enriched object built in the preview fetch (lines ~4920-4923) merges corporate and
individual sole shareholders into one flat `soleShareholders` array, discarding the
person-vs-company distinction needed to label honestly.

Add two fields alongside the existing merged array (do NOT change the merged array — the
title-bar chip at ~8510-8532 depends on it):

```js
soleShareholdersCorporate: company?.sole_shareholders || [],
soleShareholdersIndividual: company?.sole_shareholder_individuals || [],
```

Both are arrays of bare strings. `sole_shareholders` = corporate owners;
`sole_shareholder_individuals` = physical persons. These represent the *current* sole
shareholder(s); superseded owners live in `previous_sole_shareholders` /
`previous_sole_shareholder_individuals` (already captured as `previousSoleShareholders`).

## UI change

Add one row to the Resumen grid (near the Capital / BORME-range rows, ~line 8707),
rendered only when `e.isUnipersonal` AND at least one current sole shareholder exists
(`soleShareholdersCorporate.length + soleShareholdersIndividual.length > 0`):

- **Label:** `text.soleShareholder` — "Socio único" (ES) / "Sole shareholder" (EN),
  added to the bilingual labels object (~lines 613-641).
- **Value:** each current name followed by an honest qualifier:
  - individual → `text.naturalPersonTag` = "(persona física)" / "(natural person)"
  - corporate → `text.companyTag` = "(sociedad)" / "(company)"
  - Order: corporate first, then individuals (matches the merged-array order).
- **History:** if `previousSoleShareholders?.length > 0`, append a caption line reusing the
  existing name-change history style (`warning.main`, italic, `variant="caption"`, as at
  lines 8604-8624): `text.previous`: joined previous names.

Span the row full width (`gridColumn: '1 / -1'`) when it can be long, matching the address
/ activity rows.

## Non-goals / invariants

- No backend change. `/bormes/v3/search?group_key=` and `/bormes/v3/company/<name>` already
  return `sole_shareholders` / `sole_shareholder_individuals`.
- No behavior change to the existing title-bar sole-shareholder chip or any other card.
- Immutable: new enriched fields are added, nothing mutated.

## Verification

No unit-test seam exists for the preview dialog in this 9k-line component. Verify by
driving the live app against a unipersonal company (corporate owner and individual owner
cases, plus a changed-owner case) and confirming the row renders with correct label,
qualifier, and history line. Confirm a non-unipersonal company shows no new row.
