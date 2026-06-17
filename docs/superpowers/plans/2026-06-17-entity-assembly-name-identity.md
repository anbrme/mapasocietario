# Entity Assembly by Name Identity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Repo:** this plan targets the **bormes backend** (`ncdata-bormes`, on server `/home/alex/bormes`), not mapasocietario. Move/commit it there when execution starts.

**Goal:** Reunite a single legal entity that BORME split across multiple hojas (province transfers) and names (renames) into one company profile, using only registry-published signals — the **uniqueness of Spanish company names**, "Cambio de denominación social" acts, and extinction events — not inferred heuristics.

**Architecture:** Extend the existing `hoja_chaining` chain-map (already the cross-hoja merge mechanism wired into `companies_enricher._full_build`). Three changes: (1) canonicalize legal-form suffixes so name matching is registry-accurate; (2) replace the `domicile OR shared-officers` link gate with **name-uniqueness + temporal compatibility** rules (the 3-year gap is the reuse guard); (3) add **name-change links** (denominación-change acts) and re-couple the **alias** layer so an entity is findable under every historical name. Hoja stays the stable within-era sub-key.

**Tech Stack:** Python 3.12, Elasticsearch (`borme_events_v3_live`, `borme_companies_v3_live`, `borme_company_aliases`), pure-function modules under `borme_v3_enricher/`. Tests are plain-assert `test_*.py` run via `venv/bin/python -m borme_v3_enricher.test_*` (no pytest installed).

---

## Background: why this is needed (the NAMISA case)

One legal entity, three rows in our index today:

```
NAMISA INTERNATIONAL MINERIOS SL   Madrid  M-396846   2009 → 2015-05   ┐ transfer (same name)
NAMISA INTERNATIONAL MINERIOS SL   Bizkaia BI-66686   2015-08 → 2017   ┤ rename (same hoja)
CSN MINING HOLDING SL              Bizkaia BI-66686   2017 → 2025      ┘ (active)
```

- Madrid `M-396846` dead-ends at 2015 because the Madrid→Bizkaia **transfer** never chained.
- Root cause: `hoja_chaining` buckets candidates by **exact** `company_name_normalized`; Madrid normalizes to `…MINERIOS SL`, Bizkaia to `…MINERIOS SOCIEDAD LIMITADA`. Different string → never compared.
- Even if compared, the link decision **requires** `domicile_evidence OR shared_officers ≥ 2` — inferred criteria, not registry facts.
- The whole **CSN group** moved Madrid→Bizkaia in Aug-2015 identically: CSN STEEL `M-510631`→`BI-66640`, CSN AMERICAS `M-509634`→`BI-66668`, CSN MINERALS `M-510204`→`BI-66682`, CSN METALS `M-507411`→`BI-66687`. This is a class bug.

**Key principle (registry-faithful):** Spanish company names are unique at any point in time (Registro Mercantil Central guarantees it). A name is *released* only by a rename or extinction, after which it may be reused. Therefore:
- **Same canonical name + temporally compatible eras + no extinction-release in between ⇒ same entity** (a transfer). Deterministic — no officer inference.
- **"Cambio de denominación social" act ⇒ old-name → new-name continuity** (a rename). Deterministic — the registry says so.
- Officers/domicile are kept only as a *recorded confidence signal*, never as a gate.

---

## Safety rules (dedup vs. reuse) — the decision contract

`decide_entity_links(groups)` links two same-canonical-name hoja-groups **A** (earlier) and **B** (later) iff ALL hold:

- **R1 Temporal compatibility:** `overlap_days ≤ OVERLAP_TOLERANCE_DAYS` (180) and `gap_days ≤ MAX_GAP_DAYS` (1095 / 3y). Brief transition overlap OK; >3y silence ⇒ presumed reuse, do not link.
- **R2 No big overlap:** if A and B are both active for `> OVERLAP_TOLERANCE_DAYS`, under name-uniqueness they cannot be the same entity ⇒ **do not link**; emit a `link_review` record (parse error or genuine collision — investigate, never silently merge).
- **R3 Reuse guard = the 3-year gap (R1), nothing more.** Per registry practice a name is not freed quickly after extinction (release lags by months/years), so a same-name reappearance *within* `MAX_GAP_DAYS` implies continuity (transfer), not reuse. We therefore do **not** add an extinction check — it would add machinery for a case the gap already covers. (Officers/domicile remain available as optional confidence under R6, never as a gate.)
- **R4 Rename override:** a *validated* name-change act (Task 5) linking A.name→B.name links them regardless of R1/R3 within reason — a rename is an explicit continuity. Still subject to R2.
- **R5 Merge cap:** if a single entity would absorb `> MAX_ENTITY_HOJAS` (8) hoja-groups, **do not auto-merge the excess**; emit `link_review`. Guards against a pathological reused common name forming a mega-chain.
- **R6 Confidence, not gate:** record `link_basis` (`"name+transfer"`, `"denominacion_change"`) and `link_confidence` (`+0.x` if shared officers ≥2 or domicile-change within `BOUNDARY_WINDOW_DAYS`). Surfaced for transparency; never required to link.

Multi-hop chains (A→B→C) resolve to the final survivor; the **survivor = the latest-active group** (max `last_seen`).

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `borme_v3_enricher/normalize.py` | Pure normalization | Add legal-form suffix canonicalization to `normalize_company_name`; bump `NORMALIZATION_VERSION`. |
| `borme_v3_enricher/config.py` | Constants | `NORMALIZATION_VERSION` "1.0.0"→"1.1.0". |
| `borme_v3_enricher/hoja_chaining.py` | Cross-hoja link decision + candidate scan | Rewrite `decide_hoja_chains`→ name-uniqueness rules (R1–R6); feed extinction dates into group stats. Rename to `decide_entity_links` (keep alias). |
| `borme_v3_enricher/name_change_links.py` (NEW) | Registry rename links | Build `{old_name → new_name}` from validated denominación-change acts; resolve names→hoja survivors; emit cross-name links + alias rows. |
| `borme_v3_enricher/companies_enricher.py` | Entity assembly | Fix `name_changes` self-noop (derive from name timeline); merge `name_change_links` into the chain-map applied in `_full_build`; populate aliases from the merged links. |
| `populate_company_aliases.py` (existing) | `borme_company_aliases` index | Re-run from corrected name-change links so search resolves any historical name → current entity. |
| `borme_v3_enricher/test_entity_assembly.py` (NEW) | Tests | All unit tests below. |

---

## Task 1: Canonicalize legal-form suffix in `normalize_company_name`

**Files:**
- Modify: `borme_v3_enricher/normalize.py` (`normalize_company_name`, ~line 53; add a shared `_LEGAL_FORM_CANON` map near top)
- Test: `borme_v3_enricher/test_entity_assembly.py`

- [ ] **Step 1: Write the failing test**

```python
from borme_v3_enricher.normalize import normalize_company_name

def test_legal_suffix_canonicalized_to_short_form():
    # Same entity, two registries spelled the suffix differently — must collapse.
    a = normalize_company_name("NAMISA INTERNATIONAL MINERIOS SL")
    b = normalize_company_name("NAMISA INTERNATIONAL MINERIOS SOCIEDAD LIMITADA")
    assert a == b == "NAMISA INTERNATIONAL MINERIOS SL"
    assert normalize_company_name("ACME SOCIEDAD ANONIMA") == "ACME SA"
    assert normalize_company_name("FOO SOCIEDAD DE RESPONSABILIDAD LIMITADA") == "FOO SL"
    assert normalize_company_name("BAR SOCIEDAD LIMITADA PROFESIONAL") == "BAR SLP"

def test_legal_suffix_canon_does_not_collapse_distinct_forms():
    # SL and SA are different legal forms → must stay distinct (no over-merge).
    assert normalize_company_name("ACME SL") != normalize_company_name("ACME SA")

def test_legal_suffix_canon_only_at_end_not_midname():
    # "LIMITADA" inside a name (not the legal suffix) must be untouched.
    assert normalize_company_name("EDICIONES LIMITADA EDITION SL") == "EDICIONES LIMITADA EDITION SL"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m borme_v3_enricher.test_entity_assembly`
Expected: FAIL on `test_legal_suffix_canonicalized_to_short_form` (`…SOCIEDAD LIMITADA` ≠ `…SL` today).

- [ ] **Step 3: Implement** — add to `normalize.py` and call it last in `normalize_company_name`:

```python
# Canonical legal-form suffixes (longest first; anchored at end-of-string).
_LEGAL_FORM_CANON = [
    (re.compile(r'\bSOCIEDAD LIMITADA NUEVA EMPRESA$'), 'SLNE'),
    (re.compile(r'\bSOCIEDAD LIMITADA UNIPERSONAL$'), 'SLU'),
    (re.compile(r'\bSOCIEDAD ANONIMA UNIPERSONAL$'), 'SAU'),
    (re.compile(r'\bSOCIEDAD LIMITADA LABORAL$'), 'SLL'),
    (re.compile(r'\bSOCIEDAD ANONIMA LABORAL$'), 'SAL'),
    (re.compile(r'\bSOCIEDAD LIMITADA PROFESIONAL$'), 'SLP'),
    (re.compile(r'\bSOCIEDAD DE RESPONSABILIDAD LIMITADA$'), 'SL'),
    (re.compile(r'\bSOCIEDAD LIMITADA$'), 'SL'),
    (re.compile(r'\bSOCIEDAD AN[OÓ]NIMA$'), 'SA'),
    (re.compile(r'\bSOCIEDAD COOPERATIVA$'), 'SCOOP'),
]

def _canon_legal_form(name: str) -> str:
    for pat, short in _LEGAL_FORM_CANON:
        new = pat.sub(short, name)
        if new != name:
            return new.strip()
    return name
```

In `normalize_company_name`, add as the final step before `return name`:
```python
    name = _canon_legal_form(name)
    return name
```

- [ ] **Step 4: Run tests to verify pass.** Run: `venv/bin/python -m borme_v3_enricher.test_entity_assembly` → all PASS. Also run existing `venv/bin/python -m borme_v3_enricher.test_hoja_regroup` → still 14 PASS.

- [ ] **Step 5: Bump version.** Edit `config.py`: `NORMALIZATION_VERSION = "1.1.0"`.

- [ ] **Step 6: Commit.**
```bash
git add borme_v3_enricher/normalize.py borme_v3_enricher/test_entity_assembly.py borme_v3_enricher/config.py
git commit -m "feat(normalize): canonicalize legal-form suffix for cross-registry name identity"
```

---

## Task 2: ~~Extinction dates~~ — DEFERRED (not needed)

Removed per design decision: the 3-year gap (R1) is the reuse guard; an extinction
check adds machinery for a case the gap already covers. No work here. Task numbers
below are kept stable for cross-references.

---

## Task 3: Rewrite the link decision to name-uniqueness rules (R1, R2, R5, R6)

**Files:**
- Modify: `borme_v3_enricher/hoja_chaining.py` (`decide_hoja_chains` ~line 58 → `decide_entity_links`; keep `decide_hoja_chains = decide_entity_links` alias for callers)
- Test: `borme_v3_enricher/test_entity_assembly.py`

- [ ] **Step 1: Write the failing tests**

```python
from borme_v3_enricher.hoja_chaining import decide_entity_links

def _g(k, first, last, prov, officers=(), addr=()):
    return {"group_key":k,"first_seen":first,"last_seen":last,"provinces":set([prov]),
            "officer_names":set(officers),"address_change_dates":list(addr)}

def test_transfer_links_on_name_alone_no_officer_overlap():
    # NAMISA Madrid→Bizkaia: same name, sequential, NO shared officers, NO domicile evt.
    a = _g("H:M-396846","2009-07-24","2015-05-22","Madrid")
    b = _g("H:BI-66686","2015-08-12","2025-12-10","Vizcaya")
    assert decide_entity_links([a,b]) == {"H:M-396846":"H:BI-66686"}

def test_reuse_not_linked_on_long_gap():
    # >3y silence, no transfer evidence → presumed reuse (R1).
    a = _g("H:M-1","2000-01-01","2005-01-01","Madrid")
    b = _g("H:B-2","2010-01-01","2020-01-01","Barcelona")
    assert decide_entity_links([a,b]) == {}

def test_big_overlap_not_linked():
    # Both active same years → cannot be one entity under uniqueness (R2).
    a = _g("H:M-1","2010-01-01","2020-01-01","Madrid")
    b = _g("H:B-2","2011-01-01","2021-01-01","Barcelona")
    assert decide_entity_links([a,b]) == {}
```

- [ ] **Step 2: Run → FAIL** (`test_transfer_links_on_name_alone_no_officer_overlap` fails: current code needs officers/domicile).

- [ ] **Step 3: Implement** — replace the decision body (keep the candidate-scan/collector functions unchanged):

```python
MAX_ENTITY_HOJAS = 8

def decide_entity_links(groups: list) -> dict:
    usable = [g for g in groups if _d(g.get('first_seen')) and _d(g.get('last_seen'))]
    if len(usable) < 2:
        return {}
    if len(usable) > MAX_ENTITY_HOJAS:
        logger.warning("entity-link review: name spans %d hojas (> cap) — skipped: %s",
                       len(usable), [g['group_key'] for g in usable])
        return {}
    ordered = sorted(usable, key=lambda g: _d(g['first_seen']))
    links = {}
    for a, b in zip(ordered, ordered[1:]):
        a_last, b_first = _d(a['last_seen']), _d(b['first_seen'])
        overlap_days = (a_last - b_first).days
        if overlap_days > OVERLAP_TOLERANCE_DAYS:      # R2
            continue
        if -overlap_days > MAX_GAP_DAYS:               # R1: >3y silence ⇒ presumed reuse
            continue
        links[a['group_key']] = b['group_key']         # name-unique transfer link
    # resolve multi-hop to final survivor
    chains = {}
    for absorbed in links:
        survivor = links[absorbed]; seen = {absorbed}
        while survivor in links and survivor not in seen:
            seen.add(survivor); survivor = links[survivor]
        chains[absorbed] = survivor
    return chains

decide_hoja_chains = decide_entity_links  # back-compat for existing callers
```

- [ ] **Step 4: Run tests → all PASS** (4 new + Task 1/2). Run existing `test_hoja_regroup` → still PASS.

- [ ] **Step 5: Commit.**
```bash
git add borme_v3_enricher/hoja_chaining.py borme_v3_enricher/test_entity_assembly.py
git commit -m "feat(chaining): link entities by name-uniqueness + extinction guard, drop officer gate"
```

---

## Task 4: Fix `name_changes` self-noop — derive old_name from the name timeline

**Files:**
- Modify: `borme_v3_enricher/companies_enricher.py` (`_aggregate_events`, the `name_changes.append` block ~line 851)
- Test: `borme_v3_enricher/test_entity_assembly.py`

- [ ] **Step 1: Write the failing test** (extract the name-timeline logic into a pure helper so it is testable):

```python
from borme_v3_enricher.companies_enricher import derive_name_changes

def test_name_changes_uses_prior_name_not_self():
    # time-ordered (name_normalized, name_changed, new_name, date) per event
    evts = [
        {"company_name_normalized":"NAMISA INTERNATIONAL MINERIOS SL","name_changed":False,"new_company_name":None,"event_date":"2015-08-12"},
        {"company_name_normalized":"NAMISA INTERNATIONAL MINERIOS SL","name_changed":True,
         "new_company_name":"CSN MINING HOLDING SL","event_date":"2017-10-04"},
        {"company_name_normalized":"CSN MINING HOLDING SL","name_changed":False,"new_company_name":None,"event_date":"2018-08-28"},
    ]
    assert derive_name_changes(evts) == [
        {"old_name":"NAMISA INTERNATIONAL MINERIOS SL","new_name":"CSN MINING HOLDING SL","date":"2017-10-04"}
    ]
```

- [ ] **Step 2: Run → FAIL** (`derive_name_changes` not defined).

- [ ] **Step 3: Implement** the pure helper and call it from `_aggregate_events` (replacing the inline self-noop block):

```python
def derive_name_changes(events):
    """Real old→new transitions from the time-ordered name sequence.
    old_name = the company's name on the event BEFORE the change (never the current name)."""
    out = []
    prev_name = None
    for e in events:  # events arrive sorted by event_date asc
        if e.get("name_changed") and e.get("new_company_name"):
            old = prev_name or e.get("company_name_normalized")
            new = e["new_company_name"]
            if old and new and old != new:
                out.append({"old_name": old, "new_name": new, "date": e.get("event_date")})
        prev_name = e.get("company_name_normalized") or prev_name
    return out
```
In `_aggregate_events`, delete the inline `if evt.get("name_changed")...` append and after the loop set `name_changes = derive_name_changes(events)`.

- [ ] **Step 4: Run tests → PASS.**

- [ ] **Step 5: Commit.**
```bash
git add borme_v3_enricher/companies_enricher.py borme_v3_enricher/test_entity_assembly.py
git commit -m "fix(companies): derive real name_changes from name timeline (kill self-noop)"
```

---

## Task 5: Build cross-name (rename) links from denominación-change acts

**Files:**
- Create: `borme_v3_enricher/name_change_links.py`
- Modify: `borme_v3_enricher/companies_enricher.py` (`_full_build`: merge name-change links into `chain_map`)
- Test: `borme_v3_enricher/test_entity_assembly.py`

- [ ] **Step 1: Write the failing test** (pure resolver):

```python
from borme_v3_enricher.name_change_links import resolve_name_change_links

def test_rename_links_old_name_group_to_new_name_group():
    # validated act NAMISA→CSN; name→survivor-hoja map provided.
    acts = [{"old_name":"NAMISA INTERNATIONAL MINERIOS SL","new_name":"CSN MINING HOLDING SL"}]
    name_to_survivor = {
        "NAMISA INTERNATIONAL MINERIOS SL": "H:BI-66686",
        "CSN MINING HOLDING SL": "H:BI-66686",
    }
    # already same hoja → no cross-hoja link needed
    assert resolve_name_change_links(acts, name_to_survivor) == {}

def test_rename_links_across_hojas():
    acts = [{"old_name":"OLDCO SL","new_name":"NEWCO SL"}]
    name_to_survivor = {"OLDCO SL":"H:M-1","NEWCO SL":"H:B-2"}
    assert resolve_name_change_links(acts, name_to_survivor) == {"H:M-1":"H:B-2"}
```

- [ ] **Step 2: Run → FAIL** (module/function missing).

- [ ] **Step 3: Implement** `name_change_links.py`:

```python
"""Cross-name entity links from registry 'Cambio de denominación social' acts.
Deterministic: BORME explicitly states old→new; names are unique so each resolves
to one hoja survivor. Output merges into the hoja chain map."""

def resolve_name_change_links(acts, name_to_survivor):
    """acts: [{old_name,new_name}] (validated, old!=new).
    name_to_survivor: {normalized_name -> survivor group_key}.
    Returns {absorbed_survivor -> final_survivor} for cross-hoja renames."""
    links = {}
    for a in acts:
        s_old = name_to_survivor.get(a["old_name"])
        s_new = name_to_survivor.get(a["new_name"])
        if s_old and s_new and s_old != s_new:
            links[s_old] = s_new
        # same survivor (rename within one hoja) → already merged, skip
    # resolve multi-hop
    out = {}
    for k in links:
        v = links[k]; seen = {k}
        while v in links and v not in seen:
            seen.add(v); v = links[v]
        out[k] = v
    return out
```

In `_full_build`, after `chain_map = build_hoja_chain_map()`, build the act list + name→survivor map and merge:
```python
from .name_change_links import collect_validated_name_change_acts, resolve_name_change_links
acts = collect_validated_name_change_acts()          # scans events: name_changed + validated new name
name_to_survivor = _build_name_to_survivor(chain_map)  # canonical name -> survivor hoja
rename_links = resolve_name_change_links(acts, name_to_survivor)
for absorbed, survivor in rename_links.items():
    chain_map.setdefault(absorbed, survivor)
```
(`collect_validated_name_change_acts` and `_build_name_to_survivor` are thin ES helpers — implement with the existing `_fetch_events_for_*` patterns; gate new names through `validate_new_company_name`.)

- [ ] **Step 4: Run tests → PASS.**

- [ ] **Step 5: Commit.**
```bash
git add borme_v3_enricher/name_change_links.py borme_v3_enricher/companies_enricher.py borme_v3_enricher/test_entity_assembly.py
git commit -m "feat(entity): chain hojas across denominación-change acts (rename links)"
```

---

## Task 6: Re-populate aliases — and make them resolve searches

Aliases are a **search** concern: a user searching the *old* name (NAMISA INTERNATIONAL
MINERIOS SL) or the *new* name (CSN MINING HOLDING SL) must both land on the one
surviving entity. Two halves: (a) correct rows; (b) search resolves them.

**Files:**
- Modify: `populate_company_aliases.py` (source rows from corrected `name_changes` + entity links)
- Verify: the search/autocomplete API resolves an alias hit → the entity's current doc

- [ ] **Step 1:** Confirm `borme_company_aliases` schema (`old_name`,`new_name`, and which field carries the surviving entity id) and that `companies_enricher` (lines ~636–646) already queries it for the merge.
- [ ] **Step 2:** Re-run `populate_company_aliases.py` after the rebuild so every historical name maps to the surviving entity (point each alias row at the survivor group_key, not the absorbed one).
- [ ] **Step 3:** Verify the **search path** resolves an alias → entity: query the working-search/autocomplete API for "NAMISA INTERNATIONAL MINERIOS" and confirm it returns/links the CSN MINING HOLDING entity (the merged doc), and likewise the reverse. If the API doesn't consult aliases, file a follow-up to wire it (search-side, no rebuild).
- [ ] **Step 4: Commit** any script changes.
```bash
git add populate_company_aliases.py
git commit -m "chore(aliases): rebuild alias index from corrected name-change links"
```

---

## Task 7: Data validation on the NAMISA + CSN cohort (gate before cutover)

Run after a **dry/staging** rebuild (build into a throwaway index or `--company-only` against a clone), before swapping live.

- [ ] **NAMISA reunified:** `H:M-396846` is absorbed (deleted) into `H:BI-66686`; the surviving doc spans `first_seen ≤ 2009-07-24` … `last_seen ≥ 2025-12-10`; `name_changes` shows `NAMISA INTERNATIONAL MINERIOS SL → CSN MINING HOLDING SL` (no self-noop); aliases resolve both names to it.
- [ ] **CSN group reunified:** each Madrid hoja absorbed into its Bizkaia survivor (STEEL `M-510631`→`BI-66640`, AMERICAS `M-509634`→`BI-66668`, MINERALS `M-510204`→`BI-66682`, METALS `M-507411`→`BI-66687`).
- [ ] **Reuse NOT merged (negative control):** pick a known same-name pair with a `>3y` gap or an extinction on the earlier group; confirm they remain two docs.
- [ ] **No mega-merges:** count `link_review` warnings; confirm zero entities silently exceeded `MAX_ENTITY_HOJAS`.
- [ ] **Aggregate sanity:** total company count drops by ~the number of transfer/rename merges (report the delta and a sample of 20 merges); H:/N: split unchanged in shape.
- [ ] **Regression:** NAMISA INVESTMENTS SL and NAMISA PROMOCIONES DE LEVANTE SL remain separate single docs (different unique names → not merged).

---

## Rollout

This changes `company_name_normalized` (Task 1), so events must be re-normalized:

1. Land Tasks 1–6 (PR off `server-current`); run all unit tests green.
2. **Re-key events:** extend `backfill_hoja.py` (or a sibling) to also recompute `company_name_normalized` from the stored raw `company_name`, plus `group_key` — applies the new suffix canonicalization without a full PDF reparse (~1–2h).
3. **Rebuild companies:** `python -m borme_v3_enricher --company-only` (full `_full_build` with the extended chain-map) into staging; run **Task 7** validation.
4. **Prune + cutover** as in the hoja-allowlist run: `prune_orphan_companies.py --apply`, hard-refresh local-rag.
5. Re-run `populate_company_aliases.py`.

Old indexes retained for rollback (reverse alias swap), per the established blue/green discipline.

---

## Self-review notes

- **Spec coverage:** suffix canon (T1), T2 deferred (no extinction), name-uniqueness link (T3/R1,R2,R5,R6), self-noop fix (T4), rename links (T5), aliases+search (T6), validation incl. negative control (T7), rollout. Covered.
- **Open items to confirm at execution:** `borme_company_aliases` field names + which field holds the surviving entity id (T6); whether the search API already consults aliases (T6 step 3); whether `_build_one_company_by_name` (incremental path, lines 590–660) should also adopt the same merge — likely yes, mirror it in a follow-up.
- **Type consistency:** `decide_entity_links` (alias `decide_hoja_chains`), `derive_name_changes`, `resolve_name_change_links`, group dict key `extinction_dates` used consistently across T2/T3.
