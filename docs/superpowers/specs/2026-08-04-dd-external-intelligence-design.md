# DD External Intelligence — Design

**Date:** 2026-08-04
**Status:** Approved, not implemented
**Primary repo:** `ncdata-bormes-impl` (Python DD generator)
**Touches:** `mapasocietario` only if the app surfaces the new section (out of scope here)

## Problem

The paid Spanish company Due Diligence report is built entirely from BORME registry
data plus a BOE sanctions screen. Buyers are foreign professionals checking a Spanish
counterparty; the registry answers "what is on file" but not "does this company exist
in the world, and is anything bad publicly known about it". Competitors charge for
exactly that layer.

The report currently has one narrow external hook, `_fetch_web_context_via_llm`, which
looks for group/parent/listed status and is gated to `confidence:high`, so it rarely
returns anything.

## Goals

Add a non-registry intelligence layer to the company DD that is **grounded, auditable
and reproducible**, without changing the price and without weakening the verdict.

Non-goals: screening individuals; changing the risk engine; adding this to the officer
profile or relationship reports.

## Decisions

| Decision | Value | Rationale |
|---|---|---|
| Packaging | Always included, no price change | Margin is already high (~€0.50 AI cost on a €22.50 report). The lever is selling more reports, not charging more. |
| Cost ceiling | €1.50 per report | Stated by product owner. Design lands well under it. |
| Subjects screened | Company + its former names + corporate parent / corporate sole shareholder / corporate participadas | Entity names are near-unique; corporate scope widens real coverage without identity risk. |
| Officers | **Not screened**, and the report says so | BORME carries no person identifier. Common Spanish name patterns make name-only matching unreliable, and screening named individuals against media raises privacy concerns the report will not incur. |
| Retrieval | Deterministic in Python; LLM never retrieves | Every printed claim must trace to a URL actually fetched. Reports must be reproducible. |
| Verification | Second, independent refutation pass on every adverse hit | The highest-risk output in the feature is a confident adverse finding about the wrong company. |
| Verdict impact | None. Separate section + one labelled summary line | Keeps the headline verdict registry-derived and therefore defensible. |
| Report scope | Company DD only | Consistent with the officer-exclusion decision; it is the report being bought. |

## Deliverables in the report

Four things, all under existing section 6, "Verificaciones externas":

1. **Official list screening** — BOE (existing), EU consolidated sanctions list, OFAC SDN.
2. **Media coverage** — all retrieved coverage, adverse subset separated and verified.
3. **Digital footprint** — public presence and its consistency with the registry record.
4. **Corporate group context** — parent / ultimate owner / listed status, rebuilt on
   fetched sources instead of a confidence gate.

## Architecture

`borme_dd_report.py` is 11,703 lines. Nothing new goes into it. Seven new flat
`dd_ext_*.py` modules plus one orchestrator, matching the repo's existing `dd_*.py`
convention. No cross-imports between them; the orchestrator wires them.

| Module | Responsibility | I/O |
|---|---|---|
| `dd_ext_subjects.py` | Derive the screening subject list from assembled company data: current name, former names (via existing `resolve_alias_set`), corporate sole shareholder, group parent, corporate participadas. Officers excluded by construction. | Pure |
| `dd_ext_search.py` | Query construction + Brave News/Web retrieval via the existing `BRAVE_TOKEN` env var. Normalises to `{title, url, source, published, snippet, query, fetched_at}`. | HTTP |
| `dd_ext_watchlists.py` | EU consolidated list + OFAC SDN: daily-cached download, normalised name matching. Deterministic, no LLM. | HTTP + cache |
| `dd_ext_triage.py` | Batched classification of retrieved items (relevant to this entity / adverse / category / source credibility). Ported from local-rag `src/services/adverseMediaAnalysisService.js`. Prompt builder and parser pure; LLM caller injected. | Pure + injected caller |
| `dd_ext_refute.py` | Independent second pass over adverse-flagged items, prompted to refute (wrong entity, namesake, stale, content-farm source). Uncertainty defaults to refuted. | Pure + injected caller |
| `dd_ext_footprint.py` | Digital-footprint assessment from web results: live site, stated activity, apparent scale, consistency with registry activity/CNAE. | Pure + injected caller |
| `dd_ext_render.py` | Takes the assembled result and the PDF builder; emits subsections 6.1–6.4. Keeps rendering out of the 11.7k-line file. | No network; writes only to the passed builder |
| `dd_external.py` | Orchestrator and single entry point: subjects → parallel retrieval → triage → refute → assemble. | Composition |

### Integration points

- **Execution:** `borme_dd_report.py:~10199`, the existing `ThreadPoolExecutor` block.
  Add `futures['external_intel'] = executor.submit(dd_external.screen, ...)` alongside
  `boe` and `network`. Result stashed on `data['_external_intel']`, mirroring how
  `_final_web_context` is stashed today.
- **Evidence:** `borme_dd_report.py:~6464`, where `_reg_entries` is assembled and passed
  to `dd_claims.build_registry`. External findings append entries with the new kinds.
- **Synthesis facts:** `borme_dd_report.py:6475`, alongside
  `dd_sector_context.external_context_note`. Rebuilt group context continues to feed
  the facts block so the executive prose can use it.

### Claims taxonomy

`dd_claims.py` gains three evidence kinds and three claim types:

```
FACT_KINDS += {
  'W': 'Cribado de listas oficiales (comprobación separada)',
  'M': 'Cobertura mediática (fuente externa)',
  'H': 'Huella digital (fuente externa)',
}

CLAIM_TYPES += {
  'cribado_listas':      {'kinds': {'W'}},
  'cobertura_mediatica': {'kinds': {'M'}},
  'huella_digital':      {'kinds': {'H'}},
}
```

Each new claim type accepts **only** its own kind. This reuses the existing
`cribado_boe: {'kinds': {'B'}}` separation, so the synthesis LLM structurally cannot
ground an ownership, governance or capital claim on a news article, and cannot ground a
media claim on registry data. Claims violating this are dropped by the existing
`validate_claims`, not rewritten.

Every external item that reaches the page gets an evidence id and a row in Annex E
carrying its URL.

## Report output

Section 6 keeps its number; nothing downstream renumbers.

**Section 6 preamble.** States that these are non-registry checks, and that officers are
deliberately not screened, with both reasons (name-matching unreliability, privacy).
Annex D carries the long-form methodology and limitations.

**6.1 Cribado de listas oficiales.** One table, one row per list (BOE, EU consolidated,
OFAC SDN), each with status, date checked, names checked, matches. The existing BOE
callout collapses into this table rather than being duplicated. A match renders the
existing non-adjudication language verbatim: a list match is not an adjudicated finding
and requires manual review.

**6.2 Cobertura mediática.** All retrieved coverage, with the adverse subset separated.
Each item carries source, date, URL, category, and its refutation verdict. When nothing
is found, the section states plainly that no media footprint was found for the entity or
its former names, lists the queries that were run, and notes that this is the expected
result for most Spanish SMEs. An honest negative, not a gap.

**6.3 Huella digital.** Website found or not, what the company publicly presents itself
as doing, and whether that is consistent with the registry activity/CNAE. "Registry-active
with no traceable public presence" is stated as a finding.

**6.4 Contexto de grupo.** Parent, ultimate owner and listed status, with the fetched
sources behind each assertion.

**Verdict page.** One line under the existing assessment, explicitly labelled as a
separate check — e.g. *"Cribado externo: sin coincidencias en listas · sin cobertura
adversa"* or *"Cribado externo: 2 elementos requieren revisión (§6)"*. It never alters
the verdict.

## Failure handling

Each of the four checks reports its own status independently: `ran`, `not_run`, or
`failed`. This reuses the "not run" callout precedent already present in the BOE branch.

- Brave unavailable → 6.2 and 6.3 degrade to "could not be completed"; 6.1 and 6.4 unaffected.
- A watchlist download failing → that row alone shows `failed`; other lists still report.
- LLM error → the affected pass degrades; retrieved items are still listed, unclassified,
  rather than being silently dropped.

External intelligence is wrapped so that no failure inside it can prevent a paid report
from generating — the same guarantee `_persist_enrichment` already provides. Total
wall-clock budget of 90s inside the existing parallel executor, so it overlaps the
ES/PG work rather than extending generation time. The DD already generates
asynchronously via the queue consumer, so this does not reintroduce the 504 problem.

## Cost

Roughly 8–12 Brave queries per report; watchlists free and daily-cached; one triage pass
over retrieved items; refutation only over the adverse subset. The dominant cost is the
LLM passes, not retrieval.

The per-query Brave price depends on the current plan and **must be confirmed against the
live account before implementation** rather than assumed from the €0.04 internal metering
rate used in local-rag's `brave-news.js`, which is a billing rate rather than a cost.
Under any Brave plan the retrieval cost is a small fraction of the LLM cost. Expected
typical report well under €0.30, a heavily-covered company under €1.00, against the €1.50
ceiling. Per-report actual cost is logged so the estimate can be checked against reality
and the design revisited if it does not hold.

## Testing

Every module except `dd_ext_search` and `dd_ext_watchlists` is pure or takes an injected
LLM caller, following the `_caller` injection pattern already used by
`llm_registry_long_tail_flags`. New `test_dd_ext_*.py` files matching the repo convention.

Tests that must exist:

- **Wrong-entity refutation:** a fixture article about a same-named company in a different
  sector must be dropped by `dd_ext_refute`, not printed.
- **Zero-results rendering:** an empty retrieval must produce the "no media footprint"
  rendering with the query list, not an empty or omitted section.
- **Claims separation:** a `cobertura_mediatica` claim grounded on registry evidence must
  be dropped by `validate_claims`, and a registry claim grounded on `M` evidence likewise.
- **Officer exclusion:** `dd_ext_subjects` must never emit a natural-person name, given
  company data containing officers.
- **Degradation:** each check failing independently must still produce a complete report.

Live retrieval gets a thin contract test run manually against Brave and against the two
watchlist endpoints, not in CI.

## Out of scope

- Surfacing external intelligence in the mapasocietario web app (PDF only for now).
- Officer profile and relationship reports.
- Any change to `risk_engine.py` or the verdict computation.
- AEO / chatbot discoverability, which is a separate spec.
