# Manual Confirmation Protocol (pilot) — Design

**Date:** 2026-06-29
**Status:** Design approved; pilot is the build target
**Related:** [[project_company_context_layer]] (the broader context layer), the Phase 1 spec `2026-06-28-company-currency-confirmation-design.md` (this is the Phase 2 "supply test" run *without* building self-service tooling), [[user_analyst_not_salesman]] (accuracy over sales), [[project_acquisition_strategy]]

---

## 1. Problem

Phase 1 shipped a decaying "confirmed current" badge on `/empresa/:slug`, but the only way to verify a company is to hand-edit `functions/empresa/_confirmations.js` and redeploy. There is no claim form, no email handling, no admin screen, no database — none of Phase 2 exists.

So when we contact ~10 companies and some say "yes, the information is correct," there is currently:

1. **No interface** for them to verify through, and
2. **No defined way to *confirm* their confirmation** — an email saying "it's correct" is, on its own, an unverified assertion. Anyone with an inbox can send it.

This spec defines a **manual protocol** (no new UI) to run the pilot honestly and defensibly, deferring all Phase 2 tooling until demand is proven.

## 2. Trust model

A badge is justified only when **both** halves hold:

| Factor | What it proves | Source | Already enforced? |
|--------|----------------|--------|-------------------|
| **Authority** | The named person *is a current officer* of the company | BORME (live v3 index) | Yes — `scripts/check-confirmations.mjs` prebuild gate already fails the build if the `representative` is not a current officer |
| **Affirmation** | That officer *confirms the facts are current today* and is *willing to be asked again* | A reply from the company's own email | New — this protocol |

The registry supplies authority we cannot fake; the email supplies currency + consent the registry structurally cannot contain. The badge is the juxtaposition of the two.

**Residual risk:** impersonation (someone posing as the registered officer). The pilot's proof bar — a reply from a *tied email address* — mitigates but does not eliminate this. It is accepted for a hand-picked pilot of ~10 and revisited before any scale-up.

## 3. The proof bar

**A confirmation is acceptable only if the reply comes from a tied email address:** the company's own domain (e.g. `juan@empresa.es`), or an address that can be reasonably tied to the named registered officer (e.g. the official contact published on the company's site or sourced from an authoritative channel).

A reply from a generic free-mail address with no tie to the company or officer is **not** acceptable on its own; reviewer requests a tied-address reply or declines.

## 4. The protocol

### 4.1 Outreach
Each company receives a short email template that:
- States the **exact facts** we will display (current administrador/officers, domicilio social, "no concurso", company active) so they confirm *specific* facts, not a vague "looks fine."
- Asks them to **reply from their company email**.
- Asks them to confirm one consent line: *"Confirmo que lo anterior está vigente y aceptamos que se nos vuelva a preguntar en el futuro."* (affirmation + the standing "willing to be asked" signal).

The outreach template is stored in-repo (text only, no personal data): `docs/superpowers/specs/confirmation-outreach-template.md` (ES, with EN variant).

### 4.2 The reviewer check (run by hand on each reply)
Four steps; all must pass:
1. **Tied address** — reply is from the company domain or an address tied to the named officer (§3).
2. **Authority** — the named person is a current officer in BORME (eyeballed; also enforced mechanically by the prebuild gate at ship time).
3. **Content** — they affirmed the specific facts listed, not merely "ok."
4. **Consent** — the willing-to-be-asked line is present.

If any step fails, the reviewer replies requesting the missing piece, or declines. Nothing is shipped until all four pass.

### 4.3 Record the confirmation
Add an entry to `functions/empresa/_confirmations.js`, reusing the existing shape plus three provenance fields:

```js
'company-slug': {
  confirmedAt: '2026-07-01',                 // date of the company's email
  representative: 'Juan Pérez',
  role: 'Administrador único',
  verification: 'email-from-tied-address',   // method (was 'registry-officer-match')
  reviewer: 'AN',                            // NEW — who reviewed
  evidenceRef: 'CONF-2026-0003',             // NEW — points to the private log row
  affirms: [
    { label: 'Administrador único: Juan Pérez', status: 'current' },
    { label: 'Domicilio social: …', status: 'current' },
    { label: 'Situación concursal', status: 'none' },
    { label: 'Sociedad activa y operativa', status: 'current' },
  ],
}
```

`confirmedAt` drives the existing decay logic (fresh ≤90d → aging ≤365d → stale). No new state is introduced.

### 4.4 Private evidence log (off-repo)
A file that is **never committed** (gitignored local file and/or a private Drive sheet). One row per confirmation:

`evidenceRef · company slug · sender email · date received · summary of what they affirmed · copy or link to the email`

This is the audit trail. The public page shows *how* it was verified (method + reviewer + date) but never the raw email, sender address, or any personal data. A `.gitignore` entry guards the local file (e.g. `confirmation-evidence.local.*`).

### 4.5 Ship
Run the existing build gate (`npm run prebuild`), which re-checks the representative is still a current officer, then deploy. No new deploy step.

### 4.6 Decay & re-confirmation
The badge decays on its own via `confirmedAt`. For the pilot there is **no re-confirmation automation**: the badge ages honestly and the reviewer re-asks when convenient (e.g. before it crosses into "aging" at 90 days). Re-confirmation reuses the same protocol and updates `confirmedAt` + a new `evidenceRef`.

## 5. Code changes (minimal)

Everything else is process. The only code touched:

1. **Record shape** — accept `reviewer` and `evidenceRef` fields and the `verification: 'email-from-tied-address'` value in `_confirmations.js`. Update unit tests in `test/confirmation.test.mjs` / `test/confirmation-render.test.mjs` accordingly.
2. **Public "how verified" line** — surface a short line on the `/empresa` panel and the in-app card, e.g. *"Verificado por confirmación desde el email de la empresa"* (ES) / *"Verified by confirmation from the company's email"* (EN), driven by the `verification` value. Add to `CONFIRMATION_I18N` in `functions/empresa/_confirmation.js`. **Decision: shown publicly** (reinforces transparency; the badge visibly rests on a real confirmation, not a self-assertion).
3. **`.gitignore`** — add the private evidence-log pattern.
4. **Templates/docs** — the outreach template file (§4.1) and a one-page reviewer checklist (the four steps in §4.2) committed to `docs/`.

No database, no email service, no admin UI, no tokens, no claim form. Those remain deferred to a real Phase 2 build, gated on this pilot showing companies will voluntarily confirm.

## 6. Out of scope (explicitly)
- Self-service claim/onboarding flow
- Transactional email / notifications
- Admin review dashboard
- Identity-document collection or storage
- Viewer "request a confirmation" button (Phase 3)
- Monetization

## 7. Success criteria
- The four-step check is repeatable and produces a defensible record for every shipped badge.
- At least a handful of the ~10 invited companies voluntarily confirm from a tied address.
- No regression for non-confirmed companies (they continue to render with no panel).
- Every public badge has a corresponding private evidence-log row and an `evidenceRef`.
