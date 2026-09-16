# DD interactive edition converges on the situation report; one AI story credit per report

**Date:** 2026-09-16
**Repos:** `ncdata-bormes-impl` (generator, JSON handoff), `local-rag` workers
`stripe-handler` (storage) and `ai-investigation` (credits + narration),
`mapasocietario` (app, order page, export).
**Status:** design agreed in chat 2026-09-16; spec for review before any plan.
**Builds on:** report consolidation (2026-09-10), walkthrough v2–v4 and the
sitrep polish round (2026-09-12..14), AI Investigation phases 1–2 (2026-06),
DD story model (2026-08-23).

## 1. The problem

There are two document builders for two documents:

| | Free situation report | Paid "edición interactiva" |
|---|---|---|
| Built by | `src/utils/investigationExport` in the browser, from the visible graph | `dd_html.py` on the server, from the DD story object |
| Has | sticky map, chapters, registry-state slider, connection chapters, presenter mode, print, IBM Plex embedded | six questions, provenance chips, findings, timeline, screening, subsidies, contracts, system fonts, no map |
| Received the storytelling work | yes | no |

Rendered today (FTI order of 2026-09-16), the paid edition shows a one-sentence
claim above half a panel of empty space, repeats the same six sentences in the
rail below, hides the executive synthesis behind "Leer completa", has no picture
of the company, and ends in a flat contract list. The free file is the
better-looking one. That inversion is the defect.

A second, unrelated gap: the AI storytelling idea (deferred 2026-09-10) has no
delivery mechanism. The DD purchase mints a two-day AI code; a narrated story
needs longer than two days and a different unit of use.

## 2. Decisions

1. **One document engine.** The server stops rendering HTML. It hands over the
   story object it already builds, as JSON, stored beside the PDF. The app
   builds the paid edition with the same export engine the free report uses.
   `dd_html*.py` retires once the new door is live.
2. **The purchase stays per company; the entitlement travels.** A DD purchase
   buys evidence about one subject. Its chapter carries the paid layers
   wherever that company appears in a buyer's report. Other chapters stay at
   the free level. Every chapter is labelled with its level.
3. **Three chapter levels**: `graph` (node with no profile), `registry` (the
   free chapter), `diligence` (registry plus the purchased layers).
4. **Two doors into the same builder.** The order page opens the app on the
   subject with the order attached and the report modal open: the one-company
   case, no authoring needed, download one click away. The app's own report
   modal is the authoring door for a selection of several companies.
5. **One AI story credit per paid DD, no expiry.** A credit attaches to one
   situation report on first use; that report can be regenerated under a
   per-credit spend cap. A new report needs a new credit. The two-day AI panel
   window is unchanged.
6. **The narrative covers the whole selection**, bought or not. It works from
   author notes and registry data the app already holds. The author owns the
   story; we own the data. Every generated paragraph is marked as generated.
7. **The free boundary is stated in two places only**: one line in each
   registry-level chapter's gaps block in the file, one caption line in the
   modal footer. No locked rows.

Out of scope, recorded so they are not forgotten: a public-money block on free
chapters (separate decision), lobbies data (no clean Spanish source), the
Python renderer's deletion commit (follows live verification of door 1), and
any change to the PDF.

## 3. Server: the report model handoff (`ncdata-bormes-impl`)

`generate_company_artifacts` returns `{'pdf', 'json', 'resolved_name'}` instead
of `{'pdf', 'html', ...}`. The JSON is built from the same run's data, never a
second generation (the reason `dd_html.render` was called in-run holds).

```json
{
  "schema": "dd-report-model/1",
  "generated_at": "...",
  "lang": "es",
  "company": { "name", "identifier", "group_key", "province", "cnae", "last_seen",
               "is_dissolved", "is_in_concurso", "name_changes", "sole_shareholder_declarations" },
  "headline": { ... },
  "layers": [ { "key", "question", "answer", "weight", "cites", "source" } ],
  "readings": [ { "text", "materiality", "cites", "date" } ],
  "gaps": [ { "what_is_missing", "document_that_closes_it", "why_it_matters" } ],
  "opening": "...",
  "external": { "lists": [...], "media": {...}, "footprint": {...}, "status": "..." },
  "subsidies": { ... as data['_subsidies'] ... },
  "contracts": { ... as data['_contracts'] ... },
  "financials": { "text", "signals" } | null,
  "registry": { ... claims registry, Annex E ... }
}
```

- Serialisation: `json.dumps(model, default=str, ensure_ascii=False)`; a test
  round-trips a real fixture story and asserts the top-level keys and that no
  value is a Python object repr.
- `borme_dd_async.py` stores the JSON with `kind=json` through the existing
  `store-dd-report` call, alongside the PDF. During the transition it also
  keeps storing `html` (one flag, `DD_HTML_EDITION`, default on until door 1
  is verified live, then off, then the code goes).
- `dd_story.py`, `dd_readings`, external, subsidies and contracts modules are
  untouched. `dd_html*.py` and `tests_html_*.py` are deleted in the retirement
  commit, not before.

## 4. Storage (`stripe-handler`)

- `SPEC` in the store handler gains `json: { suffix: '.json', contentType:
  'application/json; charset=utf-8', maxBytes: 5 MiB }`. Key
  `dd_reports/<sessionId>.json`.
- `handleGetDDReport` accepts `type=json`. **No 7-day expiry for `json`**: the
  credit has no expiry and a late narration must still find the purchased
  company's layers. The PDF and HTML keep their expiry. The response carries
  the same CORS treatment the HTML path has (the app fetches it in-browser).
- Session id remains the download credential, as it is for the PDF today.

## 5. App: attaching an order to a report (`mapasocietario`)

### 5.1 Deep link

`/app?c=<group_key>|<name>&order=<sessionId>&sitrep=1`, parsed next to the
existing `parseReturnParams`. `order` is validated with the same session-id
regex the worker uses. On load the app:

1. seeds the company as the return path already does (`adoptSeededCompany`);
2. fetches `get-dd-report?sessionId=&type=json`; on 404/410/network the report
   opens without layers and shows nothing about it (the free report is
   complete on its own);
3. keeps the model in graph state `ddModels: Map<group_key, model>` and in the
   snapshot `context.ddModels` so a restored session keeps its layers;
4. with `sitrep=1`, opens the report modal once step data has loaded.

The order page's second button becomes *Abrir edición interactiva* / *Open
interactive edition* and links to that URL. The HTML download stays as a
fallback button only while the transition flag is on.

### 5.2 Chapter level and the diligence layer

- `draftWalkthrough` receives `ddModels`. A company step whose `group_key`
  matches gets `source: 'diligence'` and `evidence.diligence`:

```js
{
  answers: [{ key, question, answer, weight, source }],   // six, ordered by LAYER_KEYS
  findings: [{ text, materiality, date }],                 // readings
  gaps: [{ missing, closesWith, why }],
  screening: { lists: [{ name, version, result }], media: { status, events: [...] }, footprint },
  publicMoney: { subsidies: { count, amountShown, amountCovers } | null,
                 contracts: { awards, buyers, singleBidShare, rows: top 8 } | null },
  financials: { signals } | null,
  generatedAt, reference
}
```

  The mapping is a pure function `diligenceLayer(model, lang)` with its own
  tests. `walkthroughCopy.sources` gains `diligence` ("Due diligence" in both
  languages). Match key is `group_key`; a name fold via the existing
  normaliser is the fallback when the model has no group key.
- The free `companyEvidence` result is unchanged. Where both exist, the
  diligence answers take the chapter's headline slot and the registry board and
  filings follow, so a bought chapter reads as one account, not two.

### 5.3 Rendering

- `documentSections.evidenceBlockFor` gains `diligenceBlock(s, t, wt)`:
  six Q/A rows (answer text, weight as room, not as a badge), then findings
  with materiality, then screening rows, then public money as a short grid,
  then financial signals. Full contract rows and the claims registry go to the
  annexes, not the chapter.
- The cover facts strip and the summary read from the model when the report
  has exactly one company and it is at the diligence level, so door 1 opens
  on a complete first screen.
- The in-app modal's evidence accordion shows the same block through the
  shared renderers.
- Print, presenter, slider and the no-script fallback are unchanged; the
  diligence block is static content inside a chapter.

### 5.4 Free boundary lines

- `stepEvidence.companyEvidence` appends to `unseen`, for registry-level
  chapters only: *"Sin verificaciones externas ni análisis de IA para esta
  sociedad; el informe de due diligence las incluye."* / EN equivalent. Copy in
  `walkthroughCopy`.
- Modal footer caption gains one sentence with a link that opens the DD
  checkout for the primary subject (`onBuy` prop, same seam the AI gate uses).

## 6. Credits and narration (`ai-investigation` worker)

### 6.1 Schema

Migration `0002_story_credits.sql`:

```sql
ALTER TABLE entitlements ADD COLUMN story_credits INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS story_grants (
  code        TEXT NOT NULL,
  report_id   TEXT NOT NULL,
  granted_at  INTEGER NOT NULL,
  spend_micros INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (code, report_id)
);
```

The schema-drift guard (`npm run check:schema`) and its two test mirrors are
updated in the same commit. Existing rows get one credit by the default, which
is the intended grandfathering.

### 6.2 `POST /narrate`

Body: `{ email, code, turnstileToken, reportId, lang, subject, opening,
chapters: [{ key, kind, title, level, authorNote, evidence }], connections,
timeline }`. Chapters are capped at `SELECTION_CAP` (12) plus connections.

Checks, in order: Turnstile; code canonical and `status = 'active'` (the
window `expires_at` is **not** checked); email equals `bound_email`, or binds
it when unbound (same rule as `/redeem`); rate limit 5/min per code (reuse);
then the grant rule:

- grant exists for `(code, reportId)` → allowed while `spend_micros <
  STORY_SPEND_CAP_MICROS`;
- no grant and `story_credits > 0` → decrement and insert the grant in one
  D1 batch, then allowed;
- otherwise `402 { reason: 'no_credit' | 'spend_cap' }`.

The call: one OpenRouter request (`usage: { include: true }`), model
`STORY_MODEL` env with a default, prompt built by a pure `buildStoryPrompt`
that names the framing (the author's notes are the argument; registry facts
are the evidence; write nothing that is not in the input). Output JSON:

```json
{ "opening": "...", "chapters": [{ "key": "...", "text": "..." }],
  "joins": [{ "text": "...", "nodeIds": [] }], "gaps": ["..."] }
```

Validation before returning: every number and date in a paragraph must appear
in that chapter's input; every proper name must match a node name or an
evidence row. A paragraph that fails is dropped and counted in
`dropped_paragraphs`; the response is never rewritten server-side. Cost is
recorded on the grant and in `usage` (existing table).

`STORY_SPEND_CAP_MICROS` starts at 300000 (EUR 0.30). A 12-chapter narration
should land near a few cents on a sonnet-class model, so the cap allows
roughly ten regenerations of one report; measure on the first live run and
adjust.

### 6.3 Client

- `reportId`: a UUID minted in `walkthroughEdits.reportId` the first time the
  modal is opened for a snapshot, persisted with the snapshot. It survives
  restore and export/import of a session.
- `walkthroughEdits.narration = { reportId, generatedAt, model, opening,
  chapters: { [stepKey]: text }, joins, gaps, dropped }`. `applyWalkthroughEdits`
  overlays `step.aiText` from it. Author notes stay the author's; `aiText` is
  a separate field.
- Modal footer button *Redactar con IA* / *Write with AI*. States: no
  credentials known → popover with email, code, Turnstile and the sentence
  "Cada informe de due diligence incluye una redacción con IA"; code known
  (from `/code-for-session` when the app was opened with `order=`, or from
  the stored AI token's code) → prefilled; after a narration → *Volver a
  redactar* and *Quitar redacción*. Errors are shown as text in the popover
  (`no_credit` names the DD checkout; `spend_cap` says regeneration for this
  report is exhausted).
- Generated text is editable per chapter in the modal (edits are stored in
  `narration.chapters`), and deletable per chapter.

### 6.4 In the file

Each `aiText` paragraph renders in a distinct style with an eyebrow
*Redacción asistida* / *AI-assisted text*. The cover carries one line when any
narration is present: the text was generated from the author's notes and the
report's data at `generatedAt`; the author is responsible for the account.
This is the settled framing, stated as what the document is, not as a caveat.

## 7. Copy and measurement

- Six landing surfaces, DD page, pricing, checkout: the AI line becomes
  "2-day AI investigation and one AI-written situation report". No claim of
  PEP screening anywhere (unchanged rule).
- GA4: `narrate_requested`, `narrate_done` (chapters, dropped), `narrate_failed`
  (reason), `dd_layers_attached`, and the order-page `open_interactive_edition`
  click. Register `reason` and `level` as custom dimensions the day the
  events ship (registration is not retroactive).
- The number to watch after door 1: share of orders that open the interactive
  edition, against today's HTML download share (readable from CF logs on
  `type=html`).

## 8. Testing

- `ncdata-bormes-impl`: `tests_report_model.py` round-trips a real story
  fixture; the async test asserts `kind=json` is stored and that a JSON
  failure never blocks the PDF.
- `stripe-handler`: store and get for `type=json`, including the no-expiry
  rule and an unknown `kind` still refused.
- `ai-investigation`: grant rule table (first use, reuse under cap, cap hit,
  no credit, revoked code, unbound then bound email), validator drops, D1
  batch atomicity with the existing mock.
- `mapasocietario`: `diligenceLayer` mapping, chapter level assignment,
  edits overlay of `aiText`, `reportId` persistence, deep-link parsing,
  export rendering of the diligence block and the marked paragraphs, the
  free-boundary line present only on registry-level chapters. Live check with
  `wrangler pages dev` on a stored fixture JSON before the order page button
  moves.

## 9. Rollout, each phase shippable on its own

- **A. Plumbing.** JSON handoff + `kind=json` storage + `type=json` download.
  No UI change. Both editions stored.
- **B. Door 1.** Deep link, `ddModels`, chapter level, diligence block, free
  boundary lines, order page button. Live-verify on a real order, then flip
  `DD_HTML_EDITION` off, then the retirement commit deletes `dd_html*.py`.
- **C. Credits.** Migration, `/narrate`, modal button, edits overlay, marked
  paragraphs, copy and GA4. Gate is the same as AI Investigation phase 2:
  dedicated OpenRouter key with a dashboard ceiling, `wrangler secret put`,
  worker deploy. Phase C is the moment that activation finally happens.

## 10. Risks and open points

- The story object may carry values that only serialise via `default=str`
  (dates, Decimals); the round-trip test is there to catch a repr leaking
  into the UI.
- Door 1 depends on the app loading the subject by `group_key|name`; a DD
  ordered on a name the loader cannot resolve opens an empty graph. The order
  page keeps the PDF as the primary deliverable, so this degrades, it does
  not block.
- Session id as the JSON credential has the same exposure as the PDF link
  today; the no-expiry rule widens the window in time only. Acceptable,
  recorded.
- `reportId` lives in the browser snapshot; a buyer who clears storage and
  rebuilds the same report spends a second credit. Import/export of the
  session carries it, which is the documented remedy.
- The narration validator is deliberately strict; expect dropped paragraphs
  on the first live runs and tune the prompt, not the validator.
