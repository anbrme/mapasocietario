# Manual Confirmation Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the small code + docs needed to run a manual, no-UI confirmation protocol for ~10 pilot companies: a public "how it was verified" line, audit-trail provenance fields with a build-gate guard, and the outreach/checklist/evidence-log artifacts.

**Architecture:** All confirmation logic already lives in `functions/empresa/_confirmation.js` (a self-contained, unit-tested module shared by the SEO HTML renderer in `_lib.js` and the in-app React card). We extend the shared **view model** with one method-aware line (`verifiedVia`), surface it in both renderers, add a pure **provenance guard** that the existing prebuild gate (`scripts/check-confirmations.mjs`) calls, and commit the process docs. No DB, email, admin UI, tokens, or claim form.

**Tech Stack:** Plain ES modules (Cloudflare Pages Functions), Node.js built-in test runner (`node:test`), React + MUI for the in-app card.

## Global Constraints

- `functions/empresa/_confirmation.js` MUST stay self-contained — it has its own `esc`/i18n and MUST NOT import from `_lib.js` (cycle). Copied verbatim from the spec/file header.
- View-model strings are UNESCAPED; the HTML renderer escapes at its sink (`esc(...)`), React escapes itself. Do not pre-escape in the view model.
- Public copy is bilingual ES/EN; every new user-facing string goes in `CONFIRMATION_I18N` for both `es` and `en`.
- The confirmation panel renders ABOVE registry data and NEVER overwrites BORME fields.
- The private evidence log MUST NOT be committed; it may contain personal data (sender emails).
- Verification method shown publicly (approved decision): `email-from-tied-address` → "Verificado por confirmación desde el email de la empresa".

---

### Task 1: Method-aware `verifiedVia` line in the shared view model

**Files:**
- Modify: `functions/empresa/_confirmation.js` (add `methods` to `CONFIRMATION_I18N`; add `verifiedVia` to `confirmationViewModel` return — lines 56–78 and 83–108)
- Test: `test/confirmation.test.mjs`

**Interfaces:**
- Consumes: existing `confirmationViewModel(rec, lang, nowMs)`, `CONFIRMATION_I18N`.
- Produces: `confirmationViewModel(...)` return object gains `verifiedVia: string | null` — the human-readable verification method for `rec.verification`, or `null` if `rec.verification` is absent or unrecognised. Tasks 2 and 3 read this field.

- [ ] **Step 1: Write the failing tests**

Add to `test/confirmation.test.mjs` (after the existing viewModel tests, around line 137):

```javascript
test('viewModel: verifiedVia maps email-tied method to ES copy', () => {
  const vm = confirmationViewModel(
    { confirmedAt: '2026-06-28', representative: 'X', verification: 'email-from-tied-address', affirms: [] },
    'es',
    atMs('2026-06-28', 1),
  );
  assert.equal(vm.verifiedVia, 'Verificado por confirmación desde el email de la empresa');
});

test('viewModel: verifiedVia maps registry method and translates to EN', () => {
  const vm = confirmationViewModel(
    { confirmedAt: '2026-06-28', representative: 'X', verification: 'registry-officer-match', affirms: [] },
    'en',
    atMs('2026-06-28', 1),
  );
  assert.equal(vm.verifiedVia, 'Authority verified against the public registry');
});

test('viewModel: verifiedVia is null for missing or unknown method', () => {
  const base = { confirmedAt: '2026-06-28', representative: 'X', affirms: [] };
  assert.equal(confirmationViewModel(base, 'es', atMs('2026-06-28', 1)).verifiedVia, null);
  assert.equal(
    confirmationViewModel({ ...base, verification: 'something-else' }, 'es', atMs('2026-06-28', 1)).verifiedVia,
    null,
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/confirmation.test.mjs`
Expected: FAIL — the three new tests error/assert because `vm.verifiedVia` is `undefined`.

- [ ] **Step 3: Add the `methods` copy to both locales**

In `functions/empresa/_confirmation.js`, inside `CONFIRMATION_I18N.es` (after the `disclaimer` key, around line 66) add:

```javascript
    methods: {
      'email-from-tied-address': 'Verificado por confirmación desde el email de la empresa',
      'registry-officer-match': 'Autoridad verificada contra el registro público',
    },
```

And inside `CONFIRMATION_I18N.en` (after its `disclaimer` key, around line 76) add:

```javascript
    methods: {
      'email-from-tied-address': 'Verified by confirmation from the company’s email',
      'registry-officer-match': 'Authority verified against the public registry',
    },
```

- [ ] **Step 4: Add `verifiedVia` to the view model**

In `confirmationViewModel`, in the returned object (around lines 100–107), add the `verifiedVia` field:

```javascript
  return {
    title: t.title,
    level: st.level,
    statusLine,
    verifiedVia: rec.verification ? (t.methods[rec.verification] || null) : null,
    asOf: facts.length ? t.asOf(fmtDate(rec.confirmedAt, lang)) : null,
    facts,
    disclaimer: t.disclaimer,
  };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test test/confirmation.test.mjs`
Expected: PASS — all tests, including the three new ones.

- [ ] **Step 6: Commit**

```bash
git add functions/empresa/_confirmation.js test/confirmation.test.mjs
git -c commit.gpgsign=false commit -m "feat(confirmation): method-aware verifiedVia line in view model"
```

---

### Task 2: Surface `verifiedVia` in the SEO HTML panel

**Files:**
- Modify: `functions/empresa/_confirmation.js` — `renderConfirmationBlock` (lines 111–128)
- Test: `test/confirmation.test.mjs`

**Interfaces:**
- Consumes: `vm.verifiedVia` from Task 1.
- Produces: HTML panel now contains a `<p class="cc-method">…</p>` line when `verifiedVia` is set. (CSS class `cc-method` is optional styling; an unstyled paragraph is acceptable — do not invent new CSS in this task.)

- [ ] **Step 1: Write the failing tests**

Add to `test/confirmation.test.mjs` (near the other `renderConfirmationBlock` tests, around line 86):

```javascript
test('panel shows the verification method line when present (ES)', () => {
  const rec = {
    confirmedAt: '2026-06-28',
    representative: 'Alessandro Nürnberg',
    verification: 'email-from-tied-address',
    affirms: [],
  };
  const html = renderConfirmationBlock(rec, 'es', at('2026-06-28', 1));
  assert.match(html, /cc-method/);
  assert.match(html, /Verificado por confirmación desde el email de la empresa/);
});

test('panel omits the method line when verification is absent', () => {
  const rec = { confirmedAt: '2026-06-28', representative: 'X', affirms: [] };
  const html = renderConfirmationBlock(rec, 'es', at('2026-06-28', 1));
  assert.doesNotMatch(html, /cc-method/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/confirmation.test.mjs`
Expected: FAIL — `cc-method` is not yet emitted.

- [ ] **Step 3: Emit the method line**

In `renderConfirmationBlock`, insert the method line immediately after the status line `<p class="cc-line">` (around line 124):

```javascript
  return `<section class="cc cc-${vm.level}" aria-label="${esc(vm.title)}">
    <div class="cc-head"><span class="cc-dot"></span><strong>${esc(vm.title)}</strong></div>
    <p class="cc-line">${esc(vm.statusLine)}</p>
    ${vm.verifiedVia ? `<p class="cc-method">${esc(vm.verifiedVia)}</p>` : ''}
    ${vm.asOf ? `<p class="cc-asof">${esc(vm.asOf)}</p><ul class="cc-facts">${facts}</ul>` : ''}
    <p class="cc-prov">${esc(vm.disclaimer)}</p>
  </section>`;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/confirmation.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run the render integration test to confirm no regression**

Run: `node --test test/confirmation-render.test.mjs`
Expected: PASS (unchanged — this task only adds an optional line).

- [ ] **Step 6: Commit**

```bash
git add functions/empresa/_confirmation.js test/confirmation.test.mjs
git -c commit.gpgsign=false commit -m "feat(confirmation): render verification-method line in SEO panel"
```

---

### Task 3: Surface `verifiedVia` in the in-app React card

**Files:**
- Modify: `src/components/CurrencyConfirmationCard.jsx` (after the `statusLine` Typography, around line 46)

**Interfaces:**
- Consumes: `vm.verifiedVia` from Task 1.
- Produces: the card renders the method line under the status line when present. (No unit test: this component has no existing test harness and contains no logic — all logic is in the shared, already-tested view model. Verification is visual, covered by the manual checkpoint after this task.)

- [ ] **Step 1: Add the method line to the card**

In `src/components/CurrencyConfirmationCard.jsx`, immediately after the status-line `Typography` block (the one rendering `{vm.statusLine}`, around line 46) add:

```jsx
      {vm.verifiedVia && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {vm.verifiedVia}
        </Typography>
      )}
```

- [ ] **Step 2: Build to confirm the component compiles**

Run: `npm run build`
Expected: build succeeds with no JSX/syntax errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CurrencyConfirmationCard.jsx
git -c commit.gpgsign=false commit -m "feat(confirmation): show verification-method line in in-app card"
```

---

### Task 4: Provenance fields + build-gate audit-trail guard

**Files:**
- Modify: `functions/empresa/_confirmation.js` (add exported `confirmationProvenanceError`)
- Modify: `functions/empresa/_confirmations.js` (document the new fields in the header comment — lines 1–8)
- Modify: `scripts/check-confirmations.mjs` (call the guard after the officer check)
- Test: `test/confirmation.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `confirmationProvenanceError(rec): string | null` — returns a human-readable reason when a record claims `verification: 'email-from-tied-address'` but lacks the audit trail (`reviewer` and `evidenceRef`); returns `null` otherwise (including for records that do not use the email-tied method). The build gate fails when it returns non-null.

- [ ] **Step 1: Write the failing tests**

Add to `test/confirmation.test.mjs` (at the end of the file):

```javascript
import { confirmationProvenanceError } from '../functions/empresa/_confirmation.js';

test('provenance: email-tied record needs reviewer and evidenceRef', () => {
  const ok = {
    verification: 'email-from-tied-address',
    reviewer: 'AN',
    evidenceRef: 'CONF-2026-0001',
  };
  assert.equal(confirmationProvenanceError(ok), null);

  assert.match(
    confirmationProvenanceError({ verification: 'email-from-tied-address', evidenceRef: 'CONF-2026-0001' }),
    /reviewer/,
  );
  assert.match(
    confirmationProvenanceError({ verification: 'email-from-tied-address', reviewer: 'AN' }),
    /evidenceRef/,
  );
});

test('provenance: non-email-tied methods need no audit trail', () => {
  assert.equal(confirmationProvenanceError({ verification: 'registry-officer-match' }), null);
  assert.equal(confirmationProvenanceError({}), null);
  assert.equal(confirmationProvenanceError(null), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/confirmation.test.mjs`
Expected: FAIL — `confirmationProvenanceError` is not exported (import error / undefined).

- [ ] **Step 3: Implement the guard**

Append to `functions/empresa/_confirmation.js`:

```javascript
// Audit-trail guard for the build gate. A record verified by an emailed
// confirmation MUST carry a reviewer and an evidenceRef pointing at the
// (off-repo) evidence log. Returns a reason string when that trail is missing,
// else null. Other verification methods carry no audit-trail requirement.
export function confirmationProvenanceError(rec) {
  if (!rec || rec.verification !== 'email-from-tied-address') return null;
  if (!rec.reviewer) return 'missing reviewer';
  if (!rec.evidenceRef) return 'missing evidenceRef';
  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/confirmation.test.mjs`
Expected: PASS.

- [ ] **Step 5: Wire the guard into the build gate**

In `scripts/check-confirmations.mjs`, update the import on line 11 and add the check right after the successful officer match (the `console.log("✓ ...")` around line 46).

Change line 11 from:

```javascript
import { nameIsOfficer } from '../functions/empresa/_confirmation.js';
```
to:
```javascript
import { nameIsOfficer, confirmationProvenanceError } from '../functions/empresa/_confirmation.js';
```

Then, immediately before the existing `console.log(\`✓ ${slug} → ...\`)` success line, insert:

```javascript
    const provErr = confirmationProvenanceError(rec);
    if (provErr) {
      console.error(`✗ ${slug}: ${provErr} (email-tied confirmations require reviewer + evidenceRef)`);
      failures++;
      continue;
    }
```

- [ ] **Step 6: Document the new fields**

In `functions/empresa/_confirmations.js`, update the header comment (lines 1–8) to mention the optional provenance fields. Replace the sentence ending "...a current officer in BORME)." with:

```javascript
 * resolves AND the representative is a current officer in BORME). Records whose
 * `verification` is 'email-from-tied-address' MUST also carry `reviewer` and
 * `evidenceRef` (the id of the off-repo evidence-log row). The `_`
```

(Keep the final "prefix means Cloudflare Pages does not route this file." line intact.)

- [ ] **Step 7: Run the build gate to confirm the existing entry still passes**

Run: `node scripts/check-confirmations.mjs`
Expected: PASS — `✓ nurnberg-consulting-sl → Alessandro Nürnberg verified ...` then `All 1 confirmation(s) valid.` (The Nürnberg record uses `registry-officer-match`, so the guard does not require an audit trail for it.)

> Note: this step makes a live network call to `api.ncdata.eu`. If offline, skip and note it; the unit tests in Step 4 cover the guard logic.

- [ ] **Step 8: Commit**

```bash
git add functions/empresa/_confirmation.js functions/empresa/_confirmations.js scripts/check-confirmations.mjs test/confirmation.test.mjs
git -c commit.gpgsign=false commit -m "feat(confirmation): require audit trail for email-tied confirmations"
```

---

### Task 5: Evidence-log guard + process docs (outreach, checklist, template)

**Files:**
- Modify: `.gitignore`
- Create: `confirmation-evidence.template.csv` (committed header-only template)
- Create: `docs/confirmation-protocol/outreach-template.md`
- Create: `docs/confirmation-protocol/reviewer-checklist.md`

**Interfaces:** none (docs + config only).

- [ ] **Step 1: Ignore the live evidence log**

Append to `.gitignore` (after the `*.local` block):

```
# Private confirmation evidence log — contains personal data, never commit
confirmation-evidence.local.*
```

- [ ] **Step 2: Commit a header-only evidence-log template**

Create `confirmation-evidence.template.csv`:

```csv
evidenceRef,company_slug,sender_email,date_received,affirmed_summary,email_link_or_copy
CONF-2026-0001,example-sl,contacto@example.es,2026-07-01,"Administrador único + domicilio + no concurso + activa; consintió ser preguntada","<inbox link or pasted email>"
```

> The working copy is `confirmation-evidence.local.csv` (gitignored). Copy the template to start it; never commit the `.local.csv`.

- [ ] **Step 3: Write the outreach template**

Create `docs/confirmation-protocol/outreach-template.md`:

```markdown
# Confirmation outreach — email template (pilot)

Send from a Nürnberg/Mapa Societario address. Fill the bracketed fields per
company from its current `/empresa/:slug` page BEFORE sending.

## Spanish (default)

**Asunto:** Confirmación de los datos públicos de [EMPRESA] en Mapa Societario

Estimado/a [NOMBRE DEL ADMINISTRADOR]:

En Mapa Societario publicamos una ficha de [EMPRESA] basada en el registro
público (BORME): https://mapasocietario.es/empresa/[SLUG]

Nos gustaría añadir una confirmación de vigencia: una nota fechada que indica
que los datos siguen siendo correctos hoy. Para ello, le pedimos que **responda
a este correo desde una dirección de la empresa** confirmando lo siguiente:

- Administrador/es vigente/s: [CARGO Y NOMBRE]
- Domicilio social: [DOMICILIO]
- Situación concursal: sin constancia
- La sociedad está activa y operativa

Y, si está de acuerdo, incluya esta frase:

> "Confirmo que lo anterior está vigente y aceptamos que se nos vuelva a
> preguntar en el futuro."

No publicamos su correo ni datos personales: solo una nota de que la empresa
ha confirmado la vigencia, con la fecha. Gracias.

## English (on request)

**Subject:** Confirming [COMPANY]'s public data on Mapa Societario

Dear [DIRECTOR NAME],

Mapa Societario publishes a profile of [COMPANY] based on the public registry
(BORME): https://mapasocietario.es/empresa/[SLUG]

We'd like to add a currency confirmation — a dated note that the data is still
correct today. Please **reply from a company email address** confirming:

- Current director(s): [ROLE AND NAME]
- Registered office: [ADDRESS]
- Insolvency status: none on record
- The company is active and operating

And, if you agree, include:

> "I confirm the above is current and we accept being asked again in future."

We don't publish your email or personal data — only a dated note that the
company confirmed currency. Thank you.
```

- [ ] **Step 4: Write the reviewer checklist**

Create `docs/confirmation-protocol/reviewer-checklist.md`:

```markdown
# Reviewer checklist — accepting a confirmation (pilot)

Run all four checks on each reply. Ship only if ALL pass.

1. **Tied address** — the reply came from the company's own domain, or an
   address you can tie to the named registered officer (e.g. the contact
   published on the company site / sourced officially). A generic free-mail
   address with no tie is NOT acceptable on its own — request a tied-address
   reply or decline.
2. **Authority** — the named person is a CURRENT officer in BORME. (The build
   gate re-checks this mechanically; eyeball it here too.)
3. **Content** — they affirmed the SPECIFIC facts you listed, not just "ok."
4. **Consent** — the "willing to be asked again" line is present.

## On acceptance
1. Add a row to `confirmation-evidence.local.csv` (copy from the `.template.csv`):
   pick the next `evidenceRef` (`CONF-YYYY-NNNN`), record sender email, date,
   a one-line summary of what they affirmed, and a link/copy of the email.
2. Add the entry to `functions/empresa/_confirmations.js`:
   ```js
   'company-slug': {
     confirmedAt: 'YYYY-MM-DD',            // date of their email
     representative: 'Full Name',
     role: 'Administrador único',
     verification: 'email-from-tied-address',
     reviewer: 'AN',
     evidenceRef: 'CONF-YYYY-NNNN',
     affirms: [
       { label: 'Administrador único: Full Name', status: 'current' },
       { label: 'Domicilio social: …', status: 'current' },
       { label: 'Situación concursal', status: 'none' },
       { label: 'Sociedad activa y operativa', status: 'current' },
     ],
   },
   ```
3. Run `node scripts/check-confirmations.mjs` — must pass (officer match +
   audit-trail guard).
4. Build & deploy. The badge decays on its own (fresh ≤90d → aging ≤365d →
   stale); re-ask using this same checklist when convenient.
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore confirmation-evidence.template.csv docs/confirmation-protocol/
git -c commit.gpgsign=false commit -m "docs(confirmation): outreach template, reviewer checklist, evidence-log guard"
```

---

## Self-Review

**Spec coverage:**
- §2 trust model / authority anchor → existing build gate (unchanged) + Task 4 guard.
- §3 proof bar → reviewer-checklist.md step 1 (Task 5).
- §4.1 outreach + consent line → outreach-template.md (Task 5).
- §4.2 four-step check → reviewer-checklist.md (Task 5).
- §4.3 record + provenance fields → Tasks 1/4 (fields documented in header, guarded by gate).
- §4.4 private evidence log → `.gitignore` + template (Task 5).
- §4.5 ship via existing prebuild → unchanged; Task 4 strengthens it.
- §4.6 decay → already implemented (`confirmationStatus`); no code needed.
- §5.1 record shape (reviewer/evidenceRef/method value) → Tasks 1/4.
- §5.2 public "how verified" line → Tasks 1/2/3.
- §5.3 gitignore → Task 5.
- §5.4 templates/checklist → Task 5.
- §6 out-of-scope items → none implemented (correct).

**Placeholder scan:** No TBD/TODO; every code step shows full code. The bracketed `[EMPRESA]`/`[SLUG]` tokens in the outreach doc are intentional mail-merge fields, not plan placeholders.

**Type consistency:** `verifiedVia` (string|null) defined in Task 1, consumed in Tasks 2/3. `confirmationProvenanceError(rec)` (string|null) defined and exported in Task 4, imported in `check-confirmations.mjs` in the same task. `evidenceRef` format `CONF-YYYY-NNNN` consistent across Task 4 tests, Task 5 template, and checklist.
