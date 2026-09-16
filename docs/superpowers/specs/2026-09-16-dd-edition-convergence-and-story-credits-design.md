# One AI reading credit per paid DD; the paid HTML edition converges on the situation report

**Date:** 2026-09-16 (rewritten the same day after review; the first draft's
"chapter levels" and DD-layer attachment are dropped)
**Repos:** `local-rag` workers `ai-investigation` (credits + narration) and
`stripe-handler` (order page data, storage), `mapasocietario` (modal, order
page, export), `ncdata-bormes-impl` (phase 2 only).
**Status:** design agreed in chat 2026-09-16; spec for review before any plan.
**Builds on:** report consolidation (2026-09-10), walkthrough v2–v4 and the
sitrep polish round (2026-09-12..14), AI Investigation phases 1–2 (2026-06).

## 1. What this is

A due diligence purchase mints **one AI reading credit**. The credit is spent
on **one situation report**: the author's own selection, notes and order, as
today. The model reads that report and writes an ordered account of it:
sequencing, joins between things the author noted and things they did not,
and inconsistencies in the registry data across the selection (an appointment
with no cessation, a same-day resignation and reappointment, one person on
three of the selected boards). The author can edit, delete or adopt every
paragraph. The file marks what was generated and what the author changed.

Two things this is **not**:

- Not a second report type. There is one situation report; narration is an
  action inside it. No "free" and "enhanced" editions.
- Not a way of loading DD evidence into the author's report. The DD stays a
  document about one company. Sanctions, media, subsidies, contracts and
  financials live in the DD (PDF and its interactive edition), never in the
  situation report. The model reads **only what the author sees in the
  modal**; nothing is pulled server-side at narration time.

Phase 2, kept from the first draft in reduced form: the paid "edición
interactiva" is rebuilt on the situation-report export engine from a JSON
handoff, and the Python renderer retires. It shares no data path with phase 1.

## 2. Decisions

1. **Unit of use = one report.** The credit attaches to a report id on first
   narration; that report may be regenerated under a per-credit spend cap.
   A new report needs a new credit. No expiry.
2. **The two-day AI panel is unchanged.** The credit is a second, independent
   thing the same code carries.
3. **The code is the credential.** Email alone is not: it is not a secret.
   Email + code + Turnstile, as `/redeem` does today; the code binds the email
   on first use.
4. **Availability is shown automatically; spending is deliberate.** The modal
   answers "do I have a credit?" on open, from the code stored in this browser.
   Narration runs only on the author's click.
5. **Prompt = the shown report.** Hidden blocks, hidden steps and unselected
   nodes are not in the input. Structured rows (dates, roles, statuses) go to
   the model as rows, and every number, date and proper name in the output is
   validated against them.
6. **Presets choose what to explain, never what to compute.** Shared people,
   shortest path, appointment chronology and control changes are computed by
   the app as they are today; a preset tells the model which of those facts to
   read. Default is one press with the presets the selection supports.
7. **Everything generated is a suggestion.** Editable in place, deletable,
   restorable, adoptable as the author's own note. Provenance stays visible
   after editing.

## 3. The credit (worker `ai-investigation`)

### 3.1 Schema

Migration `0002_story_credits.sql`:

```sql
ALTER TABLE entitlements ADD COLUMN story_credits INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS story_grants (
  code         TEXT NOT NULL,
  report_id    TEXT NOT NULL,
  granted_at   INTEGER NOT NULL,
  spend_micros INTEGER NOT NULL DEFAULT 0,
  runs         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (code, report_id)
);
```

Existing codes get one credit through the default; that is the intended
grandfathering. `npm run check:schema` and its two test mirrors are updated in
the same commit. The mint in `stripe-handler` is unchanged (the default does
the work).

### 3.2 `POST /credits`

Body `{ code }`. Returns `{ credits, grants: [{ report_id, runs,
spend_left }] }` for an active code; `404` otherwise. No Turnstile: it reveals
only counts for a code the caller already holds, and it is rate-limited by
the existing per-code minute window. This is what the modal calls on open.

### 3.3 `POST /narrate`

Body: `{ email, code, turnstileToken, reportId, lang, presets: [..],
report: { subject, opening, chapters: [...], connections: [...], timeline,
counts } }`. Chapters capped at `SELECTION_CAP` (12) plus connection steps.

Checks, in order: Turnstile; code canonical and `status = 'active'`
(`expires_at` is **not** checked); email equals `bound_email`, or binds it
when unbound; rate limit 5/min per code (reuse); grant rule:

- a grant exists for `(code, reportId)` → allowed while
  `spend_micros < STORY_SPEND_CAP_MICROS`;
- no grant and `story_credits > 0` → decrement + insert in one D1 batch;
- otherwise `402 { reason: 'no_credit' | 'spend_cap' }`.

One OpenRouter call (`usage: { include: true }`), model `STORY_MODEL` with a
default, `max_tokens` sized from the chapter count (the ACCIONA lesson: an
uncapped response truncates mid-JSON). Cost is written to the grant and to
`usage`. `STORY_SPEND_CAP_MICROS` starts at 300000 (EUR 0.30): roughly ten
regenerations of a 12-chapter report on a sonnet-class model. Measure on the
first live run and adjust.

Turnstile on every narration is deliberate: a bearer code with no expiry and
a spend cap is a small but real target.

## 4. The narration engine

### 4.1 Input

The client builds the payload from the report as displayed, through one pure
function `buildNarrationInput(doc, walkthrough, edits, graphData)` with its own
tests. It carries, per visible chapter: key, kind, title, the author's note
and flag, the shown evidence blocks as **rows** (board rows with name, role,
since, until, status; filings with date and type; findings with text, class,
date; ownership rows; seats), the step's moment; plus the visible connections
(hops as rows), the chronology stops, the opening, and `counts`. Hidden steps,
hidden blocks and nodes outside the selection are absent. The payload is
what the file would export, minus styling.

### 4.2 Presets

Each preset is a named instruction plus a deterministic **support test** run
client-side on the payload. Unsupported presets are not sent and are shown
disabled with the reason.

| key | Reading it produces | Supported when |
|---|---|---|
| `sequence` | the opening and one paragraph per chapter, in the author's order | always |
| `shared_people` | who sits in more than one selected company, with dates and whether the seats overlap in time | ≥1 person step or connector with ≥2 company seats |
| `path` | the chain between the first and last selected companies, hop by hop | a connection chapter of kind chain exists |
| `chronology` | the order of appointments, cessations and structural events across the selection, naming gaps (seat with no cessation, same-day cease and appoint) | ≥2 dated steps |
| `control` | sole-shareholder declarations and ownership rows read together: who controls what, and when that changed | ≥1 ownership row or declaration |

Five is the ceiling. `sequence` is always on and cannot be unticked; it is
the credit's core. Presets are stored in `edits.narration.presets` so a
regeneration reuses them.

### 4.3 Output

```json
{ "opening": "...",
  "chapters": [{ "key": "...", "text": "..." }],
  "readings": [{ "preset": "shared_people", "title": "...", "text": "...",
                 "anchors": ["step:<nodeId>", "conn:<key>"] }],
  "gaps": ["..."] }
```

Validation before returning: every date and number in a paragraph must
appear in that paragraph's input rows; every proper name must match a node
name, an evidence row or the author's note. A failing paragraph is dropped
and counted; the server never rewrites. The prompt states the framing: the
author's notes are the argument, the rows are the evidence, write nothing
that is not in the input, and name an inconsistency only when two rows show
it.

Readings are placed by their anchors: `path` after the connection chapter,
`shared_people` after the last person chapter it names, `chronology` under
the chronology section, `control` after the chapter it concerns. A reading
with no resolvable anchor goes to a "Lecturas" section before the annexes.

### 4.4 Storage on the client

```js
edits.narration = {
  reportId, generatedAt, model, presets, runs,
  opening: { text, state },                 // state: 'ai' | 'edited' | 'deleted' | 'adopted'
  chapters: { [stepKey]: { text, original, state } },
  readings: [{ preset, title, text, original, state, anchors }],
  gaps: [...], dropped: n
}
```

`reportId` is a UUID minted in `edits.reportId` the first time the modal
opens for a snapshot and persisted with it (autosave, export/import of a
session). `applyWalkthroughEdits` overlays `step.reading` from
`narration.chapters`. Author notes stay the author's field.

## 5. UX

### 5.1 Where the buyer learns they have a credit: the order page

Beside the code block, one line and one button:

> *Este informe incluye una lectura con IA de tu informe de situación:
> selecciona empresas y personas en el mapa, escribe tus notas y la IA las
> ordena y explica.* **Abrir el mapa de <empresa>**

The button opens `/app?c=<gk>|<name>&sitrep=1`. The code is already stored
locally by the existing redeem flow on that page; the app needs no session
id. The confirmation email mentions the credit in one sentence (MailerSend
template text, no new variable).

### 5.2 The modal status line

Directly under the modal title, always present, one of three states:

- **Credit known in this browser** (a stored code, `/credits` says ≥1 or a
  grant for this `reportId`): *"Lectura con IA: 1 disponible"* — or *"esta
  lectura puede regenerarse"* when a grant exists — and the **Redactar**
  button beside it.
- **No code known**: *"¿Tienes un código de un informe de due diligence?"*
  as a link. It opens the same email + code + Turnstile form the AI panel
  uses, prefilled with the stored email if any. Success stores the code the
  way `/redeem` does today and re-renders the line.
- **Code known, no credit and no grant**: *"Cada informe de due diligence
  incluye una lectura con IA."* with a link to the DD checkout for the
  primary subject (`onBuy` prop, the seam the AI gate already uses).

One line, no card, no badge. `/credits` failing or timing out shows the
second state; it never blocks the modal.

### 5.3 Redactar

Click → a small dialog, not a form: one sentence saying what will happen
("la IA leerá los N capítulos y M conexiones visibles y propondrá una
lectura; podrás editarla o descartarla"), the **Redactar** button, and an
**Ajustar** disclosure. Ajustar reveals the five presets as checkboxes, one
line each, unsupported ones disabled with the reason, `sequence` ticked and
locked. First narration on a report spends the credit; the dialog says so in
the same sentence when it will.

While running: the button shows progress; the modal stays usable. On
success the chapters gain their reading paragraphs and the status line reads
*"Lectura generada · N párrafos · X descartados por no coincidir con los
datos"* when `dropped > 0`. On `402 no_credit` the line becomes state 3; on
`spend_cap` it says regeneration for this report is exhausted.

### 5.4 Editing the reading

Each generated paragraph in the modal has an eyebrow **Lectura asistida**
and three actions: edit in place (textarea, saves on blur), delete, and
**Adoptar como nota** (moves the text into the author's note for that step
and removes the reading). An edited paragraph's eyebrow becomes **Lectura
asistida · editada**; **Restaurar** returns the original. Deleted paragraphs
leave no trace in the file. The author's own note is never touched by a
regeneration; only `state: 'ai'` paragraphs are replaced, edited and adopted
ones are kept.

### 5.5 In the file

Reading paragraphs render in a distinct style with the same eyebrow, and
edited ones keep "· editada". The cover carries one line when any reading is
present: generated from the author's notes and the report's data on
`generatedAt`, revised by the author; the author is responsible for the
account. That sentence is what the document is, not a caveat. The no-script
fallback, print, presenter and slider are unchanged; readings are static
paragraphs inside chapters.

### 5.6 What is deliberately absent

No locked rows on chapters, no second toolbar button, no badge on the report
button for credits, no automatic narration on open, no chat inside the
report (the AI panel is the chat).

## 6. Phase 2: the paid HTML edition converges

Unchanged in intent from the first draft, reduced in scope:

- `generate_company_artifacts` returns `json` (schema `dd-report-model/1`:
  company, headline, layers, readings, gaps, opening, external, subsidies,
  contracts, financials, registry) instead of `html`; `json.dumps(default=str)`
  with a round-trip test. `borme_dd_async` stores it as `kind=json`.
- `stripe-handler`: `SPEC.json`, `type=json` download, same 7-day expiry as
  the PDF (the no-expiry rule of the first draft went with the attachment
  idea).
- The order page's second button opens `/app?c=<gk>|<name>&order=<sessionId>&sitrep=1`.
  With `order=`, the app fetches the model, renders **that one company's**
  report with a `diligence` evidence block (six answers, findings, screening,
  public money, financial signals; full contract rows and the claims registry
  in the annexes), cover facts from the headline, the map from the loaded
  network. The model lives in that session's snapshot only; it is not matched
  into other reports.
- The situation report opened from a DD order is still the author's: they
  may add nodes and notes and spend a credit on it. The diligence block is
  hideable like any block, and hidden blocks do not reach the model (§2.5).
- Flag `DD_HTML_EDITION` keeps both editions stored until door 1 is verified
  live on a real order; then off; then the commit that deletes `dd_html*.py`
  and `tests_html_*.py`.

## 7. Copy and measurement

- Landing surfaces, DD page, pricing, checkout: the AI line becomes "2-day
  AI investigation and one AI reading of your situation report". No PEP
  screening claim anywhere (unchanged rule).
- GA4: `reading_status` (state on modal open), `reading_requested` (presets,
  chapters), `reading_done` (paragraphs, dropped, runs), `reading_failed`
  (reason), `reading_edited`, `reading_adopted`, `order_open_map`. Register
  `reason`, `state` and `presets` as custom dimensions the day the events
  ship.
- The number to watch: share of DD orders whose credit is spent within 7
  days, and the edited-or-adopted share of generated paragraphs (a high
  delete rate means the prompt is wrong, a high adopt rate means it is
  right).

## 8. Testing

- Worker: grant rule table (first use, reuse under cap, cap hit, no credit,
  revoked, unbound then bound email, wrong email), `/credits` shapes,
  validator drops (date not in rows, name not in nodes, number not in rows),
  `max_tokens` sizing, D1 batch atomicity with the existing mock.
- App: `buildNarrationInput` (hidden step and hidden block excluded, rows
  shaped, cap), preset support tests, `applyWalkthroughEdits` overlay with
  each `state`, `reportId` persistence across autosave restore and session
  import, status-line state machine, export rendering of readings and the
  cover line, no-script fallback unchanged.
- Live: one real narration on a 3-company selection in `wrangler pages dev`
  against the deployed worker before the order page line ships; a
  hand-labelled fixture of 20 payload/paragraph pairs for the validator (the
  triage lesson: a small labelled set finds what live runs cannot).

## 9. Rollout

- **Phase 1a — activation.** Dedicated OpenRouter key with a dashboard
  ceiling, `wrangler secret put OPENROUTER_API_KEY`, worker deploy. This has
  been pending since June and gates everything below.
- **Phase 1b — credits and reading.** Migration, `/credits`, `/narrate`,
  `buildNarrationInput`, presets, modal status line + redeem + Redactar
  dialog + editing, export rendering, order page line, copy, GA4.
- **Phase 2 — convergence.** JSON handoff, storage, door 1, flag flip,
  renderer retirement.

## 10. Risks and open points

- The validator will drop paragraphs on the first live runs. Tune the
  prompt and the row shapes, not the validator.
- `reportId` lives in the browser snapshot; a buyer who clears storage and
  rebuilds the same report spends a second credit. Session export/import
  carries it; that is the documented remedy.
- A buyer on a second device has to fetch the code from the order page
  linked in their email. Acceptable; no accounts remains the rule.
- Turnstile on each narration adds a widget to the modal; if it proves to
  repel, the fallback is Turnstile on redeem only plus a per-code daily
  narration cap.
- Phase 2's door 1 depends on the loader resolving `group_key|name`; an
  unresolvable subject opens an empty graph. The PDF stays the primary
  deliverable, so this degrades, it does not block.
