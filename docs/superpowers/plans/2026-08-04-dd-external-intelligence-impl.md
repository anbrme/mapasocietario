# DD External Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a grounded, auditable non-registry intelligence layer (official watchlists, media coverage, digital footprint, corporate group) to the paid Spanish company Due Diligence report.

**Architecture:** Retrieval happens deterministically in Python (Brave Search + watchlist file downloads); the LLM never retrieves, it only classifies retrieved items, and every adverse classification is then challenged by an independent refutation pass. Results render as subsections of the existing section 6 and feed the existing `dd_claims` evidence registry under three new evidence kinds, so media can structurally never ground a registry claim. Nothing external can move the headline verdict, and no failure inside this layer can prevent a paid report from generating.

**Tech Stack:** Python 3.14, `requests`, `reportlab` (via the existing PDF builder), OpenRouter (`anthropic/claude-sonnet-5`), Brave Search API, pytest.

**Working directory for ALL tasks:** `/Users/alessandronurnberg/ncdata-bormes-impl`
(The spec and this plan live in the `mapasocietario` repo; every code change lands in `ncdata-bormes-impl`.)

**Spec:** `mapasocietario/docs/superpowers/specs/2026-08-04-dd-external-intelligence-design.md`

## Global Constraints

- **Never raise into report generation.** Every public function in every new module returns a degraded-but-valid result on error. A paid report must generate even if Brave, OpenRouter and both watchlist hosts are all down simultaneously.
- **The LLM never retrieves.** Every item printed in the report must carry a URL that Python fetched. No `openrouter:web_search` tool calls in any new module.
- **Officers are never screened.** No natural-person name may enter the subject list, the search queries, or the watchlist screen.
- **External findings never alter the verdict.** No writes to `risk_engine.py`, no changes to verdict computation.
- **Immutability.** Never mutate input dicts or lists; build and return new objects.
- **Bilingual.** Every user-facing string has an `es` and an `en` form. `lang` is `'es'` or `'en'`; `'es'` is the default and the fallback for any other value.
- **File size.** No new module exceeds 400 lines. Nothing is added to `borme_dd_report.py` except the wiring in Task 11.
- **Dependencies.** `requests`, already a dependency, plus **`defusedxml`** — the only permitted addition. Remote XML (the EU sanctions list) must never be parsed with stdlib `xml.etree.ElementTree`, which is vulnerable to billion-laughs and quadratic-blowup entity expansion. Add `defusedxml` to `requirements.txt` in Task 4 and add it to the `_OPTIONAL` mock list in `conftest.py` so unit tests still import on a machine without it.
- **Test runner:** `venv/bin/python -m pytest <file> -v` from the repo root. Test files live at the repo root as `test_dd_ext_*.py`, matching the existing `test_dd_*.py` convention.
- **Commits:** `git -c commit.gpgsign=false commit` (1Password signing fails non-interactively). Conventional-commit prefixes: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`.
- **Branch:** create `feat/dd-external-intelligence` off `main` before Task 1. Do not push until the whole plan is green.
- **`_caller` injection pattern:** any module that needs an LLM takes a `_caller` keyword argument — a callable `fn(prompt) -> parsed_or_text`. Production callers are built in `dd_external.py`; tests always inject a stub. This mirrors `llm_registry_long_tail_flags` at `borme_dd_report.py:2677`.

---

### Task 0: Branch

- [ ] **Step 1: Create the working branch**

```bash
cd /Users/alessandronurnberg/ncdata-bormes-impl
git checkout main
git pull
git checkout -b feat/dd-external-intelligence
```

- [ ] **Step 2: Confirm the test runner works on an existing test**

Run: `venv/bin/python -m pytest test_dd_lens.py -q`
Expected: all tests pass. If the runner is broken, stop and fix that before continuing.

---

### Task 1: Entity name normalisation (`dd_ext_names.py`)

Shared name handling used by both subject de-duplication and watchlist matching. Matching is **exact on the normalised form only** — no fuzzy matching, no token subsets. This is deliberate: a fuzzy watchlist match is a false accusation, and the whole feature is sold on not making those.

**Files:**
- Create: `dd_ext_names.py`
- Test: `test_dd_ext_names.py`

**Interfaces:**
- Consumes: nothing (leaf module, pure, stdlib only).
- Produces:
  - `normalize_entity_name(name: str) -> str`
  - `names_match(a: str, b: str) -> bool`
  - `LEGAL_FORM_TOKENS: frozenset[str]`

- [ ] **Step 1: Write the failing test**

Create `test_dd_ext_names.py`:

```python
"""Tests for dd_ext_names — entity-name normalisation for external screening.

Matching is exact-on-normalised-form by design: fuzzy matching against a
sanctions list produces false accusations, which is the one failure mode this
feature cannot have.
"""
import dd_ext_names as n


def test_normalize_strips_accents_case_and_punctuation():
    assert n.normalize_entity_name('Añejo Distribución, S.L.') == 'ANEJO DISTRIBUCION'
    assert n.normalize_entity_name('  ACME   SOLUCIONES  S.L.  ') == 'ACME SOLUCIONES'


def test_normalize_strips_trailing_legal_form_only():
    assert n.normalize_entity_name('ACME SL') == 'ACME'
    assert n.normalize_entity_name('ACME SOCIEDAD LIMITADA') == 'ACME'
    assert n.normalize_entity_name('HOLDING ACME B.V.') == 'HOLDING ACME'
    # A legal-form token in the MIDDLE is part of the name, not a suffix.
    assert n.normalize_entity_name('SA NOSTRA CAIXA SA') == 'SA NOSTRA CAIXA'


def test_normalize_handles_unipersonal_suffix():
    assert n.normalize_entity_name('ACME SLU') == 'ACME'
    assert n.normalize_entity_name('ACME S.L.U.') == 'ACME'


def test_normalize_degrades_on_bad_input():
    assert n.normalize_entity_name(None) == ''
    assert n.normalize_entity_name('') == ''
    assert n.normalize_entity_name(123) == ''


def test_names_match_is_exact_on_normalised_form():
    assert n.names_match('ACME Soluciones, S.L.', 'acme soluciones sl') is True
    assert n.names_match('ACME SL', 'ACME LOGISTICA SL') is False
    # substring must NOT match — this is the false-positive guard
    assert n.names_match('ACME', 'ACME SOLUCIONES') is False


def test_names_match_empty_never_matches():
    assert n.names_match('', '') is False
    assert n.names_match(None, 'ACME SL') is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest test_dd_ext_names.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'dd_ext_names'`

- [ ] **Step 3: Write minimal implementation**

Create `dd_ext_names.py`:

```python
"""Entity-name normalisation for external (non-registry) screening.

Shared by dd_ext_subjects (de-duplicating the subject list) and
dd_ext_watchlists (matching against official sanctions lists).

Matching policy: EXACT equality on the normalised form. No fuzzy matching, no
token-subset matching, no substring matching. A fuzzy sanctions-list hit is a
false accusation in a paid report; a missed hit is a documented limitation.
We take the miss.

Pure module — stdlib only, no I/O.
"""
import re
import unicodedata

# Legal-form tokens stripped ONLY when they trail the name. A token like "SA"
# mid-name ("SA NOSTRA CAIXA SA") belongs to the name itself.
LEGAL_FORM_TOKENS = frozenset({
    'SL', 'SLU', 'SA', 'SAU', 'SLL', 'SAL', 'SCP', 'SC', 'SLNE', 'SICAV',
    'SOCIEDAD LIMITADA', 'SOCIEDAD ANONIMA', 'SOCIEDAD LIMITADA UNIPERSONAL',
    'SOCIEDAD ANONIMA UNIPERSONAL',
    'BV', 'NV', 'GMBH', 'AG', 'LTD', 'LIMITED', 'LLC', 'INC', 'PLC', 'SARL',
    'SAS', 'SPA', 'SRL', 'OY', 'AB', 'AS', 'PTY', 'KFT', 'ZRT', 'DOO',
})

_PUNCT_RE = re.compile(r'[^\w\s]', re.UNICODE)
_WS_RE = re.compile(r'\s+')
# Longest multi-word forms first so "SOCIEDAD LIMITADA UNIPERSONAL" wins over
# "SOCIEDAD LIMITADA".
_SORTED_FORMS = tuple(sorted(LEGAL_FORM_TOKENS, key=lambda t: -len(t)))


def _strip_accents(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text)
                   if unicodedata.category(c) != 'Mn')


def normalize_entity_name(name):
    """Upper-case, accent-stripped, punctuation-free, trailing-legal-form-free.

    Returns '' for any non-string or empty input — callers treat '' as
    'unusable', and '' never matches anything (see names_match).
    """
    if not isinstance(name, str):
        return ''
    text = _strip_accents(name)
    text = _PUNCT_RE.sub(' ', text)
    text = _WS_RE.sub(' ', text).strip().upper()
    if not text:
        return ''
    # Strip ONE trailing legal form (repeat-stripping would eat real names).
    for form in _SORTED_FORMS:
        suffix = ' ' + form
        if text.endswith(suffix):
            candidate = text[: -len(suffix)].strip()
            if candidate:  # never strip the whole name away
                return candidate
            break
    return text


def names_match(a, b):
    """Exact equality on the normalised form. Empty never matches."""
    na = normalize_entity_name(a)
    nb = normalize_entity_name(b)
    if not na or not nb:
        return False
    return na == nb
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest test_dd_ext_names.py -v`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add dd_ext_names.py test_dd_ext_names.py
git -c commit.gpgsign=false commit -m "feat: add entity-name normalisation for external screening

Exact-match-only policy: a fuzzy sanctions-list hit is a false accusation in
a paid report, so we accept documented misses instead."
```

---

### Task 2: Subject derivation (`dd_ext_subjects.py`)

Decides *what gets screened*. This is the module that structurally enforces the "never screen a natural person" decision.

**Files:**
- Create: `dd_ext_subjects.py`
- Test: `test_dd_ext_subjects.py`

**Interfaces:**
- Consumes: `dd_ext_names.normalize_entity_name`
- Produces:
  - `build_subjects(data, alias_names=None, is_legal_entity=None) -> list[dict]`
    where each dict is `{'name': str, 'role': str}` and role ∈
    `{'subject', 'former_name', 'sole_shareholder', 'parent', 'participada'}`
  - `MAX_SUBJECTS: int` (8), `MAX_FORMER_NAMES: int` (2), `MAX_PARTICIPADAS: int` (3)

`is_legal_entity` is an injected predicate. Production passes `borme_dd_report._is_legal_entity`; tests pass a stub. This keeps the single source of truth for entity classification in one place (DRY) while leaving this module pure.

- [ ] **Step 1: Write the failing test**

Create `test_dd_ext_subjects.py`:

```python
"""Tests for dd_ext_subjects — deciding WHAT gets externally screened.

The load-bearing test here is test_never_emits_a_natural_person: the product
decision is that officers and individual shareholders are never screened, for
false-positive and privacy reasons, and that decision is enforced structurally
rather than by prompt.
"""
import dd_ext_subjects as s


def _is_legal_entity(name):
    """Stub matching borme_dd_report._is_legal_entity closely enough for tests."""
    upper = (name or '').upper()
    return any(tok in upper for tok in (' SL', ' SA', ' BV', ' GMBH', ' LTD'))


def _data(**over):
    base = {
        'company': {
            'company_name': 'ACME SOLUCIONES SL',
            'sole_shareholders': ['HOLDING ACME BV'],
            'sole_shareholder_individuals': ['JUAN PEREZ GARCIA'],
            'activity': 'Consultoria informatica',
        },
        'companies_owned': [
            {'name': 'ACME LOGISTICA SL'},
            {'name': 'ACME SERVICIOS SL'},
        ],
        'ownership_chain': [
            {'name': 'HOLDING ACME BV', 'in_index': False, 'is_foreign_likely': True},
        ],
    }
    base.update(over)
    return base


def test_subject_is_first_and_uses_registry_name():
    out = s.build_subjects(_data(), is_legal_entity=_is_legal_entity)
    assert out[0] == {'name': 'ACME SOLUCIONES SL', 'role': 'subject'}


def test_former_names_included_and_subject_not_duplicated():
    out = s.build_subjects(
        _data(),
        alias_names={'ACME SOLUCIONES SL', 'ANTIGUA ACME SL'},
        is_legal_entity=_is_legal_entity,
    )
    names = [x['name'] for x in out]
    assert 'ANTIGUA ACME SL' in names
    assert names.count('ACME SOLUCIONES SL') == 1
    assert next(x for x in out if x['name'] == 'ANTIGUA ACME SL')['role'] == 'former_name'


def test_corporate_sole_shareholder_and_participadas_included():
    out = s.build_subjects(_data(), is_legal_entity=_is_legal_entity)
    by_name = {x['name']: x['role'] for x in out}
    assert by_name['HOLDING ACME BV'] == 'sole_shareholder'
    assert by_name['ACME LOGISTICA SL'] == 'participada'


def test_never_emits_a_natural_person():
    out = s.build_subjects(
        _data(
            company={
                'company_name': 'ACME SOLUCIONES SL',
                'sole_shareholders': ['JUAN PEREZ GARCIA'],  # misclassified upstream
                'sole_shareholder_individuals': ['MARIA LOPEZ RUIZ'],
            },
        ),
        is_legal_entity=_is_legal_entity,
    )
    names = [x['name'] for x in out]
    assert 'JUAN PEREZ GARCIA' not in names
    assert 'MARIA LOPEZ RUIZ' not in names


def test_parent_duplicating_sole_shareholder_is_deduped():
    out = s.build_subjects(_data(), is_legal_entity=_is_legal_entity)
    assert [x['name'] for x in out].count('HOLDING ACME BV') == 1


def test_caps_are_enforced():
    out = s.build_subjects(
        _data(companies_owned=[{'name': f'ACME {i} SL'} for i in range(10)]),
        alias_names={f'VIEJA {i} SL' for i in range(6)} | {'ACME SOLUCIONES SL'},
        is_legal_entity=_is_legal_entity,
    )
    assert len(out) <= s.MAX_SUBJECTS
    assert sum(1 for x in out if x['role'] == 'participada') <= s.MAX_PARTICIPADAS
    assert sum(1 for x in out if x['role'] == 'former_name') <= s.MAX_FORMER_NAMES


def test_degrades_on_empty_or_broken_data():
    assert s.build_subjects(None, is_legal_entity=_is_legal_entity) == []
    assert s.build_subjects({}, is_legal_entity=_is_legal_entity) == []
    assert s.build_subjects({'company': None}, is_legal_entity=_is_legal_entity) == []


def test_missing_predicate_defaults_to_screening_nothing_but_the_subject():
    # Without a classifier we cannot prove a name is corporate, so we only
    # screen the registry subject itself (which is a company by construction).
    out = s.build_subjects(_data())
    assert out == [{'name': 'ACME SOLUCIONES SL', 'role': 'subject'}]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest test_dd_ext_subjects.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'dd_ext_subjects'`

- [ ] **Step 3: Write minimal implementation**

Create `dd_ext_subjects.py`:

```python
"""Decide WHICH entities get externally screened for a company DD.

Screened: the registry subject, its former denominaciones, its corporate sole
shareholder, its corporate parent, and a bounded number of corporate
participadas.

NEVER screened: natural persons. Officers, individual sole shareholders and
individual UBO-chain entries are excluded by construction, not by prompt. Two
reasons, both stated in the report: BORME carries no person identifier so
common Spanish name patterns make name-only matching unreliable, and screening
named individuals against media raises privacy concerns the report will not
incur.

Caps are disclosed in the report's methodology annex rather than applied
silently.

Pure module — no I/O, no LLM.
"""
from dd_ext_names import normalize_entity_name

MAX_SUBJECTS = 8
MAX_FORMER_NAMES = 2
MAX_PARTICIPADAS = 3

ROLE_ORDER = ('subject', 'former_name', 'sole_shareholder', 'parent', 'participada')


def _add(acc, seen, name, role, is_legal_entity, require_corporate=True):
    """Append {name, role} if usable, corporate and not already present."""
    if not isinstance(name, str):
        return False
    name = name.strip()
    if not name:
        return False
    key = normalize_entity_name(name)
    if not key or key in seen:
        return False
    if require_corporate:
        try:
            if not is_legal_entity(name):
                return False
        except Exception:
            return False
    seen.add(key)
    acc.append({'name': name, 'role': role})
    return True


def build_subjects(data, alias_names=None, is_legal_entity=None):
    """Return the ordered, de-duplicated, capped screening subject list.

    Returns [] rather than raising on any malformed input: this feeds a paid
    report that must generate regardless.
    """
    try:
        company = (data or {}).get('company') or {}
        subject_name = (company.get('company_name') or '').strip()
        if not subject_name:
            return []

        # Without an injected classifier we cannot prove any secondary name is
        # corporate, so we screen only the registry subject.
        if is_legal_entity is None:
            return [{'name': subject_name, 'role': 'subject'}]

        acc, seen = [], set()
        # The registry subject is a company by construction — no predicate check.
        _add(acc, seen, subject_name, 'subject', is_legal_entity,
             require_corporate=False)

        added = 0
        for alias in sorted(alias_names or []):
            if added >= MAX_FORMER_NAMES:
                break
            if _add(acc, seen, alias, 'former_name', is_legal_entity):
                added += 1

        for sh in (company.get('sole_shareholders') or []):
            _add(acc, seen, sh, 'sole_shareholder', is_legal_entity)

        for link in ((data or {}).get('ownership_chain') or []):
            if not isinstance(link, dict) or link.get('is_individual'):
                continue
            _add(acc, seen, link.get('name'), 'parent', is_legal_entity)

        added = 0
        for owned in ((data or {}).get('companies_owned') or []):
            if added >= MAX_PARTICIPADAS:
                break
            if not isinstance(owned, dict):
                continue
            if _add(acc, seen, owned.get('name'), 'participada', is_legal_entity):
                added += 1

        # Cap total, preserving role priority order.
        acc.sort(key=lambda x: ROLE_ORDER.index(x['role']))
        return acc[:MAX_SUBJECTS]
    except Exception:
        return []
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest test_dd_ext_subjects.py -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add dd_ext_subjects.py test_dd_ext_subjects.py
git -c commit.gpgsign=false commit -m "feat: derive external-screening subjects, excluding natural persons

Officers and individual shareholders are excluded structurally rather than by
prompt: BORME has no person identifier, so name-only matching is unreliable,
and screening named individuals raises privacy concerns."
```

---

### Task 3: Brave retrieval (`dd_ext_search.py`)

Deterministic retrieval. The query set is fixed and logged so a report is reproducible.

**Files:**
- Create: `dd_ext_search.py`
- Test: `test_dd_ext_search.py`

**Interfaces:**
- Consumes: `dd_ext_subjects.build_subjects` output shape (`[{'name','role'}]`)
- Produces:
  - `build_queries(subjects) -> list[dict]` — each `{'q','subject','role','kind'}`, kind ∈ `{'news','web'}`
  - `fetch(queries, token, fetched_at, _get=None) -> dict` —
    `{'status': 'ran'|'not_run'|'failed', 'items': list[dict], 'queries': list[str]}`
  - item shape: `{'title','url','source','published','snippet','subject','role','query','kind','fetched_at'}`
  - `MAX_QUERIES: int` (12)

- [ ] **Step 1: Write the failing test**

Create `test_dd_ext_search.py`:

```python
"""Tests for dd_ext_search — deterministic Brave retrieval.

The LLM never retrieves. Everything the report prints must come from an item
produced here, carrying a URL that Python actually fetched.
"""
import dd_ext_search as ds

SUBJECTS = [
    {'name': 'ACME SOLUCIONES SL', 'role': 'subject'},
    {'name': 'HOLDING ACME BV', 'role': 'sole_shareholder'},
]


class _Resp:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status
        self.text = 'stub'

    def json(self):
        return self._payload


def test_build_queries_covers_news_and_web_for_the_subject():
    qs = ds.build_queries(SUBJECTS)
    kinds = {(q['subject'], q['kind']) for q in qs}
    assert ('ACME SOLUCIONES SL', 'news') in kinds
    assert ('ACME SOLUCIONES SL', 'web') in kinds


def test_build_queries_uses_the_verbatim_entity_name():
    qs = ds.build_queries(SUBJECTS)
    # No adverse-keyword injection: appending "fraude" to a query biases
    # retrieval toward confirming an accusation.
    assert all('fraude' not in q['q'].lower() for q in qs)
    assert any(q['q'] == '"ACME SOLUCIONES SL"' for q in qs)


def test_build_queries_is_capped_and_deterministic():
    many = [{'name': f'EMPRESA {i} SL', 'role': 'participada'} for i in range(20)]
    qs = ds.build_queries(many)
    assert len(qs) <= ds.MAX_QUERIES
    assert qs == ds.build_queries(many)


def test_build_queries_secondary_subjects_get_news_only():
    qs = ds.build_queries(SUBJECTS)
    holding = [q for q in qs if q['subject'] == 'HOLDING ACME BV']
    assert holding and all(q['kind'] == 'news' for q in holding)


def test_fetch_normalises_brave_news_payload():
    payload = {'results': [{
        'title': 'ACME investigada',
        'url': 'https://diario.example/acme',
        'description': 'Resumen',
        'meta_url': {'hostname': 'diario.example'},
        'page_age': '2026-05-01T00:00:00Z',
        'extra_snippets': ['detalle uno'],
    }]}
    out = ds.fetch(
        [{'q': '"ACME SOLUCIONES SL"', 'subject': 'ACME SOLUCIONES SL',
          'role': 'subject', 'kind': 'news'}],
        token='t', fetched_at='2026-08-04T00:00:00Z',
        _get=lambda *a, **k: _Resp(payload),
    )
    assert out['status'] == 'ran'
    item = out['items'][0]
    assert item['title'] == 'ACME investigada'
    assert item['url'] == 'https://diario.example/acme'
    assert item['source'] == 'diario.example'
    assert item['published'] == '2026-05-01T00:00:00Z'
    assert 'detalle uno' in item['snippet']
    assert item['subject'] == 'ACME SOLUCIONES SL'
    assert item['fetched_at'] == '2026-08-04T00:00:00Z'


def test_fetch_without_token_is_not_run_not_failed():
    out = ds.fetch([{'q': 'x', 'subject': 'X', 'role': 'subject', 'kind': 'news'}],
                   token=None, fetched_at='2026-08-04T00:00:00Z')
    assert out['status'] == 'not_run'
    assert out['items'] == []


def test_fetch_survives_transport_errors():
    def _boom(*a, **k):
        raise RuntimeError('network down')

    out = ds.fetch([{'q': 'x', 'subject': 'X', 'role': 'subject', 'kind': 'news'}],
                   token='t', fetched_at='2026-08-04T00:00:00Z', _get=_boom)
    assert out['status'] == 'failed'
    assert out['items'] == []


def test_fetch_partial_failure_keeps_successful_queries():
    calls = {'n': 0}

    def _flaky(*a, **k):
        calls['n'] += 1
        if calls['n'] == 1:
            raise RuntimeError('boom')
        return _Resp({'results': [{'title': 'ok', 'url': 'https://e.example/1'}]})

    out = ds.fetch(
        [{'q': 'a', 'subject': 'A', 'role': 'subject', 'kind': 'news'},
         {'q': 'b', 'subject': 'B', 'role': 'subject', 'kind': 'news'}],
        token='t', fetched_at='2026-08-04T00:00:00Z', _get=_flaky,
    )
    assert out['status'] == 'ran'
    assert len(out['items']) == 1


def test_fetch_drops_items_without_a_url():
    payload = {'results': [{'title': 'sin enlace'}, {'title': 'ok', 'url': 'https://e.example/1'}]}
    out = ds.fetch([{'q': 'a', 'subject': 'A', 'role': 'subject', 'kind': 'news'}],
                   token='t', fetched_at='2026-08-04T00:00:00Z',
                   _get=lambda *a, **k: _Resp(payload))
    assert [i['url'] for i in out['items']] == ['https://e.example/1']


def test_fetch_deduplicates_by_url():
    payload = {'results': [
        {'title': 'a', 'url': 'https://e.example/1'},
        {'title': 'a dup', 'url': 'https://e.example/1'},
    ]}
    out = ds.fetch([{'q': 'a', 'subject': 'A', 'role': 'subject', 'kind': 'news'}],
                   token='t', fetched_at='2026-08-04T00:00:00Z',
                   _get=lambda *a, **k: _Resp(payload))
    assert len(out['items']) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest test_dd_ext_search.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'dd_ext_search'`

- [ ] **Step 3: Write minimal implementation**

Create `dd_ext_search.py`:

```python
"""Deterministic Brave retrieval for external DD screening.

The LLM never retrieves. This module owns every fetch, so every item the
report prints carries a URL Python actually requested and a query string that
is logged into the report. Same subject list ⇒ same query set ⇒ reproducible.

Query policy: the VERBATIM quoted entity name, with no adverse-keyword
injection. Appending "fraude"/"concurso"/"estafa" to a query biases retrieval
toward confirming an accusation and manufactures hits for clean companies.
Adversity is decided by the triage pass over unbiased results, not by the
query. Mirrors local-rag's buildEntityNewsQuery, which made the same call.

Brave defaults follow local-rag's brave-news.js: safesearch=off (Brave's
default 'strict' suppresses exactly the scandal/criminal coverage screening
needs) and spellcheck=false (Brave SEARCHES the corrected query, silently
rewriting an obscure company name into a different entity).
"""
import logging

import requests

logger = logging.getLogger(__name__)

NEWS_ENDPOINT = 'https://api.search.brave.com/res/v1/news/search'
WEB_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search'

MAX_QUERIES = 12
RESULTS_PER_QUERY = 10
TIMEOUT_SECONDS = 15
SNIPPET_MAX = 600

# Roles that get a web query in addition to a news query. Secondary entities
# get news only — a web sweep of every participada burns queries for little
# marginal signal.
_WEB_QUERY_ROLES = ('subject',)


def build_queries(subjects):
    """Fixed, ordered, capped query set. Deterministic for a given subject list."""
    queries = []
    for subj in (subjects or []):
        if not isinstance(subj, dict):
            continue
        name = (subj.get('name') or '').strip()
        if not name:
            continue
        role = subj.get('role') or 'subject'
        quoted = f'"{name}"'
        queries.append({'q': quoted, 'subject': name, 'role': role, 'kind': 'news'})
        if role in _WEB_QUERY_ROLES:
            queries.append({'q': quoted, 'subject': name, 'role': role, 'kind': 'web'})
    if len(queries) > MAX_QUERIES:
        logger.info(
            "external search: %d queries capped to %d", len(queries), MAX_QUERIES)
    return queries[:MAX_QUERIES]


def _params(query):
    params = {
        'q': query['q'],
        'count': RESULTS_PER_QUERY,
        'country': 'es',
        'search_lang': 'es',
        'safesearch': 'off',
        'spellcheck': 'false',
    }
    if query['kind'] == 'news':
        params['extra_snippets'] = '1'
    return params


def _normalize(raw, query, fetched_at):
    """Brave result → our item shape. Returns None if there is no usable URL."""
    if not isinstance(raw, dict):
        return None
    url = (raw.get('url') or '').strip()
    if not url:
        return None
    snippet_parts = [raw.get('description') or '']
    extra = raw.get('extra_snippets')
    if isinstance(extra, list):
        snippet_parts.extend(str(s) for s in extra)
    snippet = ' '.join(p for p in snippet_parts if p).strip()[:SNIPPET_MAX]
    meta = raw.get('meta_url') if isinstance(raw.get('meta_url'), dict) else {}
    return {
        'title': (raw.get('title') or '').strip(),
        'url': url,
        'source': (meta.get('hostname') or raw.get('source') or '').strip(),
        'published': (raw.get('page_age') or raw.get('age') or '').strip(),
        'snippet': snippet,
        'subject': query['subject'],
        'role': query['role'],
        'query': query['q'],
        'kind': query['kind'],
        'fetched_at': fetched_at,
    }


def fetch(queries, token, fetched_at, _get=None):
    """Run the query set. Never raises.

    status: 'not_run' when there is no token or nothing to ask,
            'failed' when every query errored,
            'ran' when at least one query returned.
    """
    queries = list(queries or [])
    query_strings = [q['q'] for q in queries]
    if not token or not queries:
        return {'status': 'not_run', 'items': [], 'queries': query_strings}

    get = _get or requests.get
    headers = {'Accept': 'application/json', 'X-Subscription-Token': token}
    items, seen_urls, ok, errors = [], set(), 0, 0

    for query in queries:
        endpoint = NEWS_ENDPOINT if query['kind'] == 'news' else WEB_ENDPOINT
        try:
            response = get(endpoint, headers=headers, params=_params(query),
                           timeout=TIMEOUT_SECONDS)
            if getattr(response, 'status_code', 500) != 200:
                logger.warning("Brave %s HTTP %s for %s", query['kind'],
                               getattr(response, 'status_code', '?'), query['q'])
                errors += 1
                continue
            payload = response.json() or {}
            # News returns {'results': [...]}; web returns {'web': {'results': [...]}}.
            raw_results = payload.get('results')
            if raw_results is None:
                raw_results = ((payload.get('web') or {}).get('results')) or []
            ok += 1
            for raw in raw_results:
                item = _normalize(raw, query, fetched_at)
                if not item or item['url'] in seen_urls:
                    continue
                seen_urls.add(item['url'])
                items.append(item)
        except Exception as exc:
            logger.warning("Brave query failed (%s): %s", query['q'], exc)
            errors += 1

    if ok == 0 and errors:
        return {'status': 'failed', 'items': [], 'queries': query_strings}
    return {'status': 'ran', 'items': items, 'queries': query_strings}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest test_dd_ext_search.py -v`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add dd_ext_search.py test_dd_ext_search.py
git -c commit.gpgsign=false commit -m "feat: add deterministic Brave retrieval for external DD screening

Verbatim quoted entity names with no adverse-keyword injection: biasing the
query toward 'fraude' manufactures hits for clean companies. Adversity is
decided by triage over unbiased results."
```

---

### Task 4: Official watchlist screening (`dd_ext_watchlists.py`)

**The EU source is verified (2026-08-04); OFAC still needs confirming in Step 1.**

The EU consolidated list is indexed by a public RSS feed at
`https://webgate.ec.europa.eu/fsd/fsf/public/rss`, which carries the download
URLs **including** their access token (`token-2017`, static and public). The
XML v1.1 endpoint was fetched live and returns:

```
HTTP 200 · application/xml · 25,778,005 bytes
<export generationDate="2026-07-31T18:40:51.758+02:00" globalFileId="184862">
6,239 sanctionEntity   →  subjectType: person 4,470 | enterprise 1,769
62,136 nameAlias
```

Three structural facts that shape the parser:

1. **`subjectType code="enterprise"` vs `"person"`.** We screen companies only,
   so the parser keeps **enterprises only**. This is a precision win and it
   means the local sanctions cache never contains a natural person's name —
   consistent with the officer-exclusion decision rather than in tension with it.
2. **`programme` lives on the nested `<regulation>` element**, not on
   `sanctionEntity`. Reading it off the entity yields empty strings.
3. **`<export generationDate>` is the list's own publication date.** The report
   cites that, not our fetch date — it is the honest answer to "how current is
   this screen?".

**Caching.** Cache the *parsed, enterprise-filtered* result as a small JSON
(~1,769 names) keyed by `generationDate`, not the 25 MB raw XML. The first
report after a list update pays the download and parse; every other report
loads a tiny file. If the Commission is unreachable, fall back to the most
recent cached JSON and surface its `generationDate` so the reader sees the
screen's real age — degrading to "stale but disclosed" rather than "failed".
No systemd timer: the on-demand cache already gives the resilience a weekly
timer would, without a second thing that can silently stop.

**Files:**
- Create: `dd_ext_watchlists.py`
- Test: `test_dd_ext_watchlists.py`

**Interfaces:**
- Consumes: `dd_ext_names.names_match`
- Produces:
  - `screen(subject_names, cache_dir, today, _load=None) -> dict` —
    `{'status': 'ran'|'not_run'|'failed', 'lists': [ {...} ]}`
  - per-list shape: `{'list_id','label_es','label_en','status','names_checked','matches','generation_date','checked_at'}` where status ∈ `{'ran','stale','failed','unavailable','not_run'}`
  - match shape: `{'subject','listed_name','list_id','programme','reference'}`
  - `load_list(list_id, cache_dir, _get=None) -> dict` —
    `{'status','entries','generation_date'}` with entry shape
    `{'name','programme','reference'}`
  - `LISTS: dict` keyed by `list_id`

- [ ] **Step 1: Confirm the OFAC endpoint (EU is already verified above)**

```bash
curl -sSL -o /tmp/sdn.csv -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV'
head -c 400 /tmp/sdn.csv; echo
```

Record the confirmed URL, status, content type and first data row in the module
docstring. Note which CSV column holds the name, which holds the programme and
which holds the reference — the plan's `_parse_csv` assumes columns 1, 3 and 0
respectively and **must be corrected to whatever the live export actually
uses**. OFAC's SDN CSV also marks individuals vs entities in a type column;
filter to entities only, mirroring the EU `subjectType` filter.

**Decision rule.** If OFAC returns 200 with parseable data, implement its
parser. If it requires registration or returns non-200, do **not** invent a
workaround: leave its `url` empty in `LISTS`, which `load_list` reports as
`'unavailable'`, and the report honestly shows that list as not run. Shipping
EU + BOE with OFAC marked unavailable is correct; shipping a fabricated URL is
not.

- [ ] **Step 2: Write the failing test**

The matching and screening logic is fully testable without network — the loader is injected. Create `test_dd_ext_watchlists.py`:

```python
"""Tests for dd_ext_watchlists — deterministic official-list screening.

No LLM is involved. Matching is exact-on-normalised-form (dd_ext_names), so a
match is a fact about two strings, not a judgement.
"""
import dd_ext_watchlists as w


def _loader(entries_by_list, failing=()):
    def _load(list_id, cache_dir, _get=None):
        if list_id in failing:
            return {'status': 'failed', 'entries': [], 'generation_date': ''}
        return {'status': 'ran',
                'entries': entries_by_list.get(list_id, []),
                'generation_date': '2026-07-31T18:40:51+02:00'}
    return _load


EU_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<export xmlns="http://eu.europa.ec/fpi/fsd/export"
        generationDate="2026-07-31T18:40:51.758+02:00">
  <sanctionEntity euReferenceNumber="EU.3502.46" logicalId="201">
    <regulation regulationType="amendment" programme="TERR" logicalId="207667"/>
    <subjectType code="enterprise" classificationCode="E"/>
    <nameAlias wholeName="ACME SOLUCIONES SL" strong="true"/>
    <nameAlias wholeName="ACME SOL" strong="false"/>
  </sanctionEntity>
  <sanctionEntity euReferenceNumber="EU.1.1" logicalId="9">
    <regulation regulationType="regulation" programme="IRQ" logicalId="1"/>
    <subjectType code="person" classificationCode="P"/>
    <nameAlias wholeName="JUAN PEREZ GARCIA" strong="true"/>
  </sanctionEntity>
</export>"""


def test_eu_parser_keeps_enterprises_and_drops_persons():
    entries = w._parse_eu_xml(EU_XML)
    names = {e['name'] for e in entries}
    assert 'ACME SOLUCIONES SL' in names
    assert 'ACME SOL' in names          # aliases of an enterprise are kept
    assert 'JUAN PEREZ GARCIA' not in names   # persons are never cached


def test_eu_parser_reads_programme_from_the_regulation_element():
    entries = w._parse_eu_xml(EU_XML)
    acme = next(e for e in entries if e['name'] == 'ACME SOLUCIONES SL')
    assert acme['programme'] == 'TERR'
    assert acme['reference'] == 'EU.3502.46'


def test_eu_generation_date_is_extracted():
    assert w._eu_generation_date(EU_XML) == '2026-07-31T18:40:51.758+02:00'


def test_exact_match_is_reported_with_provenance():
    load = _loader({'ofac_sdn': [
        {'name': 'ACME SOLUCIONES, S.L.', 'programme': 'UKRAINE-EO13662',
         'reference': '12345'},
    ]})
    out = w.screen(['ACME SOLUCIONES SL'], cache_dir='/tmp',
                   today='2026-08-04', _load=load)
    ofac = next(l for l in out['lists'] if l['list_id'] == 'ofac_sdn')
    assert ofac['status'] == 'ran'
    assert ofac['names_checked'] == 1
    assert ofac['matches'] == [{
        'subject': 'ACME SOLUCIONES SL',
        'listed_name': 'ACME SOLUCIONES, S.L.',
        'list_id': 'ofac_sdn',
        'programme': 'UKRAINE-EO13662',
        'reference': '12345',
    }]


def test_near_miss_does_not_match():
    load = _loader({'ofac_sdn': [{'name': 'ACME LOGISTICA SL',
                                  'programme': 'X', 'reference': '1'}]})
    out = w.screen(['ACME SOLUCIONES SL'], cache_dir='/tmp',
                   today='2026-08-04', _load=load)
    assert all(l['matches'] == [] for l in out['lists'])


def test_substring_does_not_match():
    load = _loader({'ofac_sdn': [{'name': 'ACME', 'programme': 'X', 'reference': '1'}]})
    out = w.screen(['ACME SOLUCIONES SL'], cache_dir='/tmp',
                   today='2026-08-04', _load=load)
    assert all(l['matches'] == [] for l in out['lists'])


def test_one_list_failing_does_not_sink_the_others():
    load = _loader({'ofac_sdn': [{'name': 'ACME SOLUCIONES SL',
                                  'programme': 'X', 'reference': '1'}]},
                   failing=('eu_consolidated',))
    out = w.screen(['ACME SOLUCIONES SL'], cache_dir='/tmp',
                   today='2026-08-04', _load=load)
    statuses = {l['list_id']: l['status'] for l in out['lists']}
    assert statuses['ofac_sdn'] == 'ran'
    assert statuses['eu_consolidated'] == 'failed'
    assert out['status'] == 'ran'


def test_all_lists_failing_makes_the_check_failed():
    load = _loader({}, failing=tuple(w.LISTS))
    out = w.screen(['ACME SOLUCIONES SL'], cache_dir='/tmp',
                   today='2026-08-04', _load=load)
    assert out['status'] == 'failed'


def test_no_subjects_is_not_run():
    out = w.screen([], cache_dir='/tmp', today='2026-08-04', _load=_loader({}))
    assert out['status'] == 'not_run'


def test_screen_never_raises_on_a_broken_loader():
    def _boom(*a, **k):
        raise RuntimeError('disk on fire')

    out = w.screen(['ACME SL'], cache_dir='/tmp', today='2026-08-04', _load=_boom)
    assert out['status'] == 'failed'
    assert all(l['status'] == 'failed' for l in out['lists'])
```

- [ ] **Step 3: Run test to verify it fails**

Run: `venv/bin/python -m pytest test_dd_ext_watchlists.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'dd_ext_watchlists'`

- [ ] **Step 4: Write minimal implementation**

Create `dd_ext_watchlists.py`. Fill the `LISTS` URLs and adjust the parser bodies to what Step 1 actually confirmed; leave `url` empty for any list whose source could not be retrieved.

```python
"""Deterministic screening against official sanctions / watch lists.

No LLM. A match here is a fact about two strings — exact equality on the
normalised entity name (dd_ext_names) — not a judgement. Near-misses and
substrings deliberately do NOT match: in a paid report a fuzzy sanctions hit
is a false accusation.

List files are cached on disk for one day (keyed by date), because a list that
changes weekly does not need re-downloading per report. Media, by contrast, is
never cached: the report states a check date and that date must be honest.

SOURCE VERIFICATION (see plan Task 4 Step 1) — record what was confirmed:
  ofac_sdn:        <URL> — <HTTP status> — <content type>
  eu_consolidated: <URL> — <HTTP status> — <content type>
A source with an empty url is reported as 'unavailable' so the report shows it
as not run rather than silently omitting it.
"""
import csv
import io
import json
import logging
import os

import requests

from dd_ext_names import names_match

USABLE_STATUSES = ('ran', 'stale')

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 30

LISTS = {
    'ofac_sdn': {
        'label_es': 'OFAC SDN (EE. UU.)',
        'label_en': 'OFAC SDN (US)',
        'url': '',      # <- fill from Step 1 (leave empty ⇒ 'unavailable')
        'format': 'csv',
    },
    'eu_consolidated': {
        'label_es': 'Lista consolidada de sanciones (UE)',
        'label_en': 'EU consolidated sanctions list',
        # Token is public and static (base64 'token-2017'); indexed by the
        # public RSS feed at https://webgate.ec.europa.eu/fsd/fsf/public/rss
        'url': ('https://webgate.ec.europa.eu/fsd/fsf/public/files/'
                'xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw'),
        'format': 'eu_xml',
    },
}

# Cached parsed output, NOT the 25 MB raw feed.
_CACHE_VERSION = 1


def _cache_path(cache_dir, list_id):
    return os.path.join(cache_dir, f'watchlist-{list_id}-v{_CACHE_VERSION}.json')


def _read_cache(path):
    """Return the cached {'generation_date','entries'} payload, or None."""
    try:
        with open(path, 'r', encoding='utf-8') as handle:
            payload = json.load(handle)
        if isinstance(payload, dict) and isinstance(payload.get('entries'), list):
            return payload
    except Exception:
        pass
    return None


def _write_cache(path, payload):
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as handle:
            json.dump(payload, handle)
    except Exception as exc:
        logger.info("watchlist cache write skipped (%s): %s", path, exc)


def _parse_csv(blob):
    """OFAC SDN CSV → entries. Column indices per the confirmed export."""
    entries = []
    text = blob.decode('utf-8', errors='replace')
    for row in csv.reader(io.StringIO(text)):
        if len(row) < 4:
            continue
        name = (row[1] or '').strip()
        if not name or name == '-0-':
            continue
        entries.append({
            'name': name,
            'programme': (row[3] or '').strip(),
            'reference': (row[0] or '').strip(),
        })
    return entries


def _local(tag):
    """Local tag name, ignoring the XML namespace, so a schema-version bump
    cannot silently empty the list."""
    return tag.rsplit('}', 1)[-1]


def _eu_root(blob):
    """Parse with defusedxml, NOT stdlib ElementTree: this is a ~25 MB feed
    fetched over the network, and stdlib expat expands internal entities, so a
    malformed or compromised feed could exhaust memory (billion laughs /
    quadratic blowup) inside the report generator."""
    from defusedxml import ElementTree as ET
    return ET.fromstring(blob)


def _eu_generation_date(blob):
    """The list's OWN publication date. The report cites this, not our fetch
    date — it is the honest answer to 'how current is this screen?'."""
    try:
        return (_eu_root(blob).get('generationDate') or '').strip()
    except Exception:
        return ''


def _parse_eu_xml(blob):
    """EU consolidated list XML → entries, ENTERPRISES ONLY.

    Persons are dropped: we screen companies, so a person's name has no use
    here, and not caching one keeps this consistent with the officer-exclusion
    decision. Of ~6,239 sanctioned entities, ~1,769 are enterprises.

    `programme` lives on the nested <regulation> element, NOT on
    <sanctionEntity> — reading it off the entity yields empty strings.
    """
    entries = []
    for entity in _eu_root(blob).iter():
        if _local(entity.tag) != 'sanctionEntity':
            continue
        children = list(entity)
        is_enterprise = any(
            _local(c.tag) == 'subjectType' and c.get('code') == 'enterprise'
            for c in children)
        if not is_enterprise:
            continue
        programme = ''
        for child in children:
            if _local(child.tag) == 'regulation' and child.get('programme'):
                programme = child.get('programme').strip()
                break
        reference = (entity.get('euReferenceNumber')
                     or entity.get('logicalId') or '').strip()
        for child in children:
            if _local(child.tag) != 'nameAlias':
                continue
            name = (child.get('wholeName') or '').strip()
            if name:
                entries.append({'name': name, 'programme': programme,
                                'reference': reference})
    return entries


_PARSERS = {'csv': _parse_csv, 'eu_xml': _parse_eu_xml}
_GENERATION_DATE = {'eu_xml': _eu_generation_date}


def load_list(list_id, cache_dir, _get=None):
    """Fetch, parse and cache one list. Never raises.

    Caches the PARSED, filtered entries (small) rather than the raw feed
    (~25 MB for the EU list). On a fetch or parse failure, falls back to the
    last good cache and reports 'stale' — a screen against a slightly older
    list, with its date disclosed, beats no screen at all.
    """
    spec = LISTS.get(list_id) or {}
    if not spec.get('url'):
        return {'status': 'unavailable', 'entries': [], 'generation_date': ''}

    path = _cache_path(cache_dir, list_id)
    cached = _read_cache(path)
    try:
        get = _get or requests.get
        response = get(spec['url'], timeout=TIMEOUT_SECONDS)
        if getattr(response, 'status_code', 500) != 200:
            raise RuntimeError(f'HTTP {getattr(response, "status_code", "?")}')
        blob = response.content
        generation_date = _GENERATION_DATE.get(spec['format'], lambda _b: '')(blob)
        # Unchanged feed ⇒ reuse the parsed cache instead of re-parsing 25 MB.
        if cached and cached.get('generation_date') and \
                cached['generation_date'] == generation_date:
            return {'status': 'ran', 'entries': cached['entries'],
                    'generation_date': generation_date}
        entries = _PARSERS[spec['format']](blob)
        if not entries:
            raise RuntimeError('parsed to zero entries')
        _write_cache(path, {'generation_date': generation_date,
                            'entries': entries})
        return {'status': 'ran', 'entries': entries,
                'generation_date': generation_date}
    except Exception as exc:
        logger.warning("watchlist %s load failed: %s", list_id, exc)
        if cached:
            logger.info("watchlist %s falling back to cache dated %s",
                        list_id, cached.get('generation_date'))
            return {'status': 'stale', 'entries': cached['entries'],
                    'generation_date': cached.get('generation_date', '')}
        return {'status': 'failed', 'entries': [], 'generation_date': ''}


def screen(subject_names, cache_dir, today, _load=None):
    """Screen every subject name against every configured list. Never raises."""
    names = [n for n in (subject_names or []) if isinstance(n, str) and n.strip()]
    load = _load or load_list
    results = []
    for list_id, spec in LISTS.items():
        if not names:
            results.append({
                'list_id': list_id, 'label_es': spec['label_es'],
                'label_en': spec['label_en'], 'status': 'not_run',
                'names_checked': 0, 'matches': [], 'generation_date': '',
                'checked_at': today,
            })
            continue
        try:
            loaded = load(list_id, cache_dir) or {}
        except Exception as exc:
            logger.warning("watchlist loader raised for %s: %s", list_id, exc)
            loaded = {'status': 'failed', 'entries': [], 'generation_date': ''}
        matches = []
        if loaded.get('status') in USABLE_STATUSES:
            for subject in names:
                for entry in loaded.get('entries') or []:
                    if names_match(subject, entry.get('name')):
                        matches.append({
                            'subject': subject,
                            'listed_name': entry.get('name'),
                            'list_id': list_id,
                            'programme': entry.get('programme') or '',
                            'reference': entry.get('reference') or '',
                        })
        results.append({
            'list_id': list_id,
            'label_es': spec['label_es'],
            'label_en': spec['label_en'],
            'status': loaded.get('status', 'failed'),
            'names_checked': (len(names)
                              if loaded.get('status') in USABLE_STATUSES else 0),
            'matches': matches,
            'generation_date': loaded.get('generation_date', ''),
            'checked_at': today,
        })

    if not names:
        status = 'not_run'
    elif any(r['status'] in USABLE_STATUSES for r in results):
        status = 'ran'
    else:
        status = 'failed'
    return {'status': status, 'lists': results}
```

- [ ] **Step 5: Add the defusedxml dependency**

```bash
echo 'defusedxml' >> requirements.txt
venv/bin/python -m pip install defusedxml
```

Then add `'defusedxml'` and `'defusedxml.ElementTree'` to the `_OPTIONAL` list in `conftest.py`, so unit tests still import on a machine without the full runtime — matching how `elasticsearch` and `reportlab` are handled there.

- [ ] **Step 6: Run test to verify it passes**

Run: `venv/bin/python -m pytest test_dd_ext_watchlists.py -v`
Expected: PASS (10 tests)

- [ ] **Step 7: Contract-check the real loaders manually (not in CI)**

```bash
venv/bin/python - <<'PY'
import dd_ext_watchlists as w
for lid in w.LISTS:
    out = w.load_list(lid, '/tmp/wl-cache')
    print(lid, out['status'], len(out['entries']), out['generation_date'])
    if out['entries']:
        print('  sample:', out['entries'][0])
PY
```

Expected: `eu_consolidated` reports `ran` with roughly 1,769 enterprise entities
(several thousand alias rows) and a `generation_date` near `2026-07-31`;
`ofac_sdn` reports `ran` if Step 1 confirmed its source, else `unavailable`.
Run it twice — the second run must reuse the parsed cache rather than
re-parsing. Record the counts in the commit message.

- [ ] **Step 8: Commit**

```bash
git add dd_ext_watchlists.py test_dd_ext_watchlists.py requirements.txt conftest.py
git -c commit.gpgsign=false commit -m "feat: add deterministic official-watchlist screening

Exact-match-only against OFAC SDN and the EU consolidated list, cached daily.
A list whose source cannot be retrieved is reported as unavailable rather than
silently omitted."
```

---

### Task 5: Media triage (`dd_ext_triage.py`)

Port of local-rag's `src/services/adverseMediaAnalysisService.js` to Python. Classifies retrieved items; never retrieves.

**Files:**
- Create: `dd_ext_triage.py`
- Test: `test_dd_ext_triage.py`

**Interfaces:**
- Consumes: item shape from `dd_ext_search.fetch`
- Produces:
  - `triage(items, _caller=None) -> list[dict]` — input items plus
    `{'is_relevant','is_adverse','category','credibility','reasoning'}`
  - `build_batches(items, budget=BATCH_TOKEN_BUDGET) -> list[list]`
  - `build_prompt(batch, start_index) -> str`
  - `parse_response(payload, batch, start_index) -> list[dict]`
  - `CATEGORIES: tuple[str]`, `MAX_ITEMS: int` (40), `BATCH_TOKEN_BUDGET: int` (12000)

`_caller` is `fn(prompt) -> list|dict|None` (already-parsed JSON).

- [ ] **Step 1: Write the failing test**

Create `test_dd_ext_triage.py`:

```python
"""Tests for dd_ext_triage — LLM classification of ALREADY-RETRIEVED items.

The triage pass may only label items; it may never add, rename or re-URL them.
Anything the model returns that does not correspond to a retrieved item is
discarded.
"""
import dd_ext_triage as t


def _item(**over):
    base = {
        'title': 'ACME investigada por la CNMC',
        'url': 'https://diario.example/acme',
        'source': 'diario.example',
        'published': '2026-05-01T00:00:00Z',
        'snippet': 'La CNMC abre expediente a ACME SOLUCIONES SL',
        'subject': 'ACME SOLUCIONES SL',
        'role': 'subject',
        'query': '"ACME SOLUCIONES SL"',
        'kind': 'news',
        'fetched_at': '2026-08-04T00:00:00Z',
    }
    base.update(over)
    return base


def test_labels_are_attached_to_the_matching_item():
    def _caller(_prompt):
        return [{'index': 1, 'is_relevant': True, 'is_adverse': True,
                 'category': 'sancion_regulatoria', 'credibility': 'alta',
                 'reasoning': 'Expediente CNMC'}]

    out = t.triage([_item()], _caller=_caller)
    assert len(out) == 1
    assert out[0]['is_adverse'] is True
    assert out[0]['category'] == 'sancion_regulatoria'
    assert out[0]['url'] == 'https://diario.example/acme'  # untouched


def test_irrelevant_items_are_dropped():
    def _caller(_prompt):
        return [{'index': 1, 'is_relevant': False, 'is_adverse': False,
                 'category': 'ninguna', 'credibility': 'baja'}]

    assert t.triage([_item()], _caller=_caller) == []


def test_unknown_category_falls_back_to_otro():
    def _caller(_prompt):
        return [{'index': 1, 'is_relevant': True, 'is_adverse': True,
                 'category': 'inventada', 'credibility': 'alta'}]

    assert t.triage([_item()], _caller=_caller)[0]['category'] == 'otro'


def test_model_cannot_invent_items():
    def _caller(_prompt):
        return [
            {'index': 1, 'is_relevant': True, 'is_adverse': False,
             'category': 'ninguna', 'credibility': 'alta'},
            {'index': 99, 'is_relevant': True, 'is_adverse': True,
             'category': 'fraude', 'credibility': 'alta'},
        ]

    out = t.triage([_item()], _caller=_caller)
    assert len(out) == 1


def test_llm_failure_keeps_items_unclassified_rather_than_dropping_them():
    def _caller(_prompt):
        raise RuntimeError('openrouter down')

    out = t.triage([_item()], _caller=_caller)
    assert len(out) == 1
    assert out[0]['is_adverse'] is False
    assert out[0]['category'] == 'sin_clasificar'
    assert out[0]['is_relevant'] is True


def test_unparseable_response_is_treated_as_failure_not_as_clean():
    out = t.triage([_item()], _caller=lambda _p: 'not json at all')
    assert out[0]['category'] == 'sin_clasificar'


def test_empty_input_short_circuits_without_calling_the_model():
    calls = []
    t.triage([], _caller=lambda p: calls.append(p) or [])
    assert calls == []


def test_items_are_capped():
    def _caller(_prompt):
        return []

    out = t.triage([_item(url=f'https://e.example/{i}') for i in range(60)],
                   _caller=_caller)
    assert len(out) <= t.MAX_ITEMS


def test_batches_respect_the_token_budget():
    big = _item(snippet='x' * 40000)
    batches = t.build_batches([big, big, big], budget=1000)
    assert all(len(b) == 1 for b in batches)


def test_prompt_contains_every_item_url_and_index():
    prompt = t.build_prompt([_item(), _item(url='https://e.example/2')], 0)
    assert 'https://diario.example/acme' in prompt
    assert 'https://e.example/2' in prompt
    assert '1.' in prompt and '2.' in prompt
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest test_dd_ext_triage.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'dd_ext_triage'`

- [ ] **Step 3: Write minimal implementation**

Create `dd_ext_triage.py`:

```python
"""LLM triage of ALREADY-RETRIEVED external items.

Ported from local-rag src/services/adverseMediaAnalysisService.js. The pass
may only LABEL items — never add, rename or re-URL them. Any returned index
that does not correspond to a retrieved item is discarded (hallucination
guard, mirroring the 'names not in the literal set are dropped' rule in
borme_dd_report.llm_registry_long_tail_flags).

On LLM failure items are kept and marked 'sin_clasificar' rather than dropped
or defaulted to clean: silently returning "no adverse coverage" because the
model was unreachable would be the worst possible failure mode for this
product.

Pure module apart from the injected _caller.
"""
import logging

logger = logging.getLogger(__name__)

CATEGORIES = (
    'insolvencia', 'litigio', 'fraude', 'sancion_regulatoria',
    'laboral', 'medioambiental', 'otro', 'ninguna',
)
UNCLASSIFIED = 'sin_clasificar'
CREDIBILITIES = ('alta', 'media', 'baja')

MAX_ITEMS = 40
BATCH_TOKEN_BUDGET = 12000
SNIPPET_IN_PROMPT = 400


def estimate_tokens(text):
    return (len(text or '') // 4) + 1


def build_batches(items, budget=BATCH_TOKEN_BUDGET):
    """Group items so no batch's estimated prompt exceeds `budget` tokens."""
    batches, current, current_tokens = [], [], 0
    for item in items:
        cost = estimate_tokens(
            f"{item.get('title', '')}{item.get('snippet', '')}")
        if current and current_tokens + cost > budget:
            batches.append(current)
            current, current_tokens = [item], cost
        else:
            current.append(item)
            current_tokens += cost
    if current:
        batches.append(current)
    return batches


def build_prompt(batch, start_index):
    lines = []
    for offset, item in enumerate(batch):
        lines.append(
            f"{start_index + offset + 1}. ENTIDAD OBJETIVO: {item.get('subject', '')}\n"
            f"   Titular: {item.get('title', '')}\n"
            f"   Fuente: {item.get('source', '')} · Fecha: {item.get('published', '')}\n"
            f"   URL: {item.get('url', '')}\n"
            f"   Extracto: {(item.get('snippet') or '')[:SNIPPET_IN_PROMPT]}"
        )
    categories = ' | '.join(CATEGORIES)
    return (
        "Eres un analista de due diligence. Clasifica CADA resultado de búsqueda "
        "respecto de su ENTIDAD OBJETIVO. No busques información adicional: "
        "trabaja SOLO con el texto proporcionado.\n\n"
        "Para cada elemento decide:\n"
        "- is_relevant: ¿el texto trata realmente de la ENTIDAD OBJETIVO (no de "
        "otra empresa con nombre parecido, ni de una mención de paso)?\n"
        "- is_adverse: ¿contiene información negativa sobre ella?\n"
        f"- category: una de: {categories}\n"
        "- credibility: alta | media | baja (según la fuente)\n"
        "- reasoning: una frase breve.\n\n"
        "Ante la duda sobre la identidad de la entidad, marca is_relevant=false.\n\n"
        "Resultados:\n" + "\n".join(lines) + "\n\n"
        "Responde SOLO con un array JSON, un objeto por elemento, con las claves "
        '"index", "is_relevant", "is_adverse", "category", "credibility", '
        '"reasoning". "index" es el número mostrado arriba.'
    )


def _coerce(raw, item):
    category = str(raw.get('category') or '').strip().lower()
    if category not in CATEGORIES:
        category = 'otro'
    credibility = str(raw.get('credibility') or '').strip().lower()
    if credibility not in CREDIBILITIES:
        credibility = 'media'
    return {
        **item,
        'is_relevant': bool(raw.get('is_relevant')),
        'is_adverse': bool(raw.get('is_adverse')),
        'category': category,
        'credibility': credibility,
        'reasoning': str(raw.get('reasoning') or '')[:300],
    }


def _unclassified(item):
    return {
        **item,
        'is_relevant': True,
        'is_adverse': False,
        'category': UNCLASSIFIED,
        'credibility': 'media',
        'reasoning': '',
    }


def parse_response(payload, batch, start_index):
    """Map a model payload onto `batch`. Unmatched indices are discarded."""
    if isinstance(payload, dict):
        payload = payload.get('analyses') or payload.get('results') or []
    if not isinstance(payload, list):
        raise ValueError('triage payload is not a list')
    by_index = {}
    for raw in payload:
        if isinstance(raw, dict) and isinstance(raw.get('index'), (int, float)):
            by_index[int(raw['index'])] = raw
    out = []
    for offset, item in enumerate(batch):
        raw = by_index.get(start_index + offset + 1)
        if raw is None:
            continue
        out.append(_coerce(raw, item))
    return out


def triage(items, _caller=None):
    """Classify items. Never raises. Returns only relevant items."""
    items = list(items or [])[:MAX_ITEMS]
    if not items or _caller is None:
        return [_unclassified(i) for i in items]

    results, start = [], 0
    for batch in build_batches(items):
        try:
            parsed = parse_response(_caller(build_prompt(batch, start)),
                                    batch, start)
            results.extend(parsed)
        except Exception as exc:
            logger.warning("external triage batch failed: %s", exc)
            results.extend(_unclassified(i) for i in batch)
        start += len(batch)
    return [r for r in results if r.get('is_relevant')]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest test_dd_ext_triage.py -v`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add dd_ext_triage.py test_dd_ext_triage.py
git -c commit.gpgsign=false commit -m "feat: port adverse-media triage from local-rag to the DD backend

Labels retrieved items only; indices the model invents are discarded. LLM
failure marks items unclassified rather than defaulting them to clean, which
would silently report 'no adverse coverage' on an outage."
```

---

### Task 6: Refutation pass (`dd_ext_refute.py`)

The credibility gate. Every adverse item is challenged independently before it can be printed at full strength.

**Files:**
- Create: `dd_ext_refute.py`
- Test: `test_dd_ext_refute.py`

**Interfaces:**
- Consumes: triaged item shape from `dd_ext_triage.triage`
- Produces:
  - `refute(items, _caller=None) -> list[dict]` — every adverse item gains
    `{'verdict': {'refuted': bool, 'reason': str, 'status': 'ran'|'failed'}}`;
    non-adverse items pass through untouched
  - `build_prompt(item) -> str`
  - `parse_verdict(payload) -> dict`

- [ ] **Step 1: Write the failing test**

Create `test_dd_ext_refute.py`:

```python
"""Tests for dd_ext_refute — the credibility gate.

Every adverse classification is challenged by an independent call prompted to
REFUTE it. Uncertainty resolves to refuted: printing a confident adverse
finding about the wrong company is the single worst output this feature can
produce, and a missed true positive is a far cheaper error.
"""
import dd_ext_refute as r


def _adverse(**over):
    base = {
        'title': 'ACME investigada',
        'url': 'https://diario.example/acme',
        'source': 'diario.example',
        'published': '2026-05-01T00:00:00Z',
        'snippet': 'La CNMC abre expediente',
        'subject': 'ACME SOLUCIONES SL',
        'is_relevant': True,
        'is_adverse': True,
        'category': 'sancion_regulatoria',
        'credibility': 'alta',
    }
    base.update(over)
    return base


def test_surviving_item_is_marked_not_refuted():
    out = r.refute([_adverse()],
                   _caller=lambda _p: {'refuted': False, 'reason': 'Misma entidad'})
    assert out[0]['verdict']['refuted'] is False
    assert out[0]['verdict']['status'] == 'ran'


def test_wrong_entity_is_refuted():
    out = r.refute(
        [_adverse(subject='ACME SOLUCIONES SL',
                  title='ACME Corp (Texas) demandada')],
        _caller=lambda _p: {'refuted': True,
                            'reason': 'Se refiere a una empresa estadounidense homónima'},
    )
    assert out[0]['verdict']['refuted'] is True
    assert 'homónima' in out[0]['verdict']['reason']


def test_non_adverse_items_are_not_challenged():
    calls = []

    def _caller(prompt):
        calls.append(prompt)
        return {'refuted': True}

    clean = _adverse(is_adverse=False, category='ninguna')
    out = r.refute([clean], _caller=_caller)
    assert calls == []
    assert 'verdict' not in out[0]


def test_llm_failure_defaults_to_refuted():
    def _boom(_p):
        raise RuntimeError('down')

    out = r.refute([_adverse()], _caller=_boom)
    assert out[0]['verdict']['refuted'] is True
    assert out[0]['verdict']['status'] == 'failed'


def test_unparseable_verdict_defaults_to_refuted():
    out = r.refute([_adverse()], _caller=lambda _p: 'maybe?')
    assert out[0]['verdict']['refuted'] is True


def test_missing_caller_defaults_to_refuted():
    out = r.refute([_adverse()], _caller=None)
    assert out[0]['verdict']['refuted'] is True


def test_input_items_are_not_mutated():
    item = _adverse()
    r.refute([item], _caller=lambda _p: {'refuted': False})
    assert 'verdict' not in item


def test_prompt_asks_the_model_to_refute():
    prompt = r.build_prompt(_adverse())
    assert 'ACME SOLUCIONES SL' in prompt
    assert 'https://diario.example/acme' in prompt
    assert 'refut' in prompt.lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest test_dd_ext_refute.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'dd_ext_refute'`

- [ ] **Step 3: Write minimal implementation**

Create `dd_ext_refute.py`:

```python
"""Adversarial verification of adverse external findings.

Each item the triage pass flagged adverse is sent to an INDEPENDENT call whose
job is to REFUTE the match — wrong entity, namesake, stale, content-farm
source, or an accusation the text does not actually support.

Uncertainty resolves to refuted. A false positive in a paid due-diligence
report is an accusation against a real company; a false negative is a
documented limitation. The asymmetry is deliberate and it is why this pass
exists at all.

Pure module apart from the injected _caller.
"""
import logging

logger = logging.getLogger(__name__)

_REFUTED_ON_FAILURE = {
    'refuted': True,
    'reason': 'No se pudo verificar de forma independiente.',
    'status': 'failed',
}


def build_prompt(item):
    return (
        "Actúas como verificador escéptico en un informe de due diligence.\n\n"
        f"ENTIDAD OBJETIVO: {item.get('subject', '')}\n"
        f"Titular: {item.get('title', '')}\n"
        f"Fuente: {item.get('source', '')} · Fecha: {item.get('published', '')}\n"
        f"URL: {item.get('url', '')}\n"
        f"Extracto: {item.get('snippet', '')}\n"
        f"Clasificación preliminar: {item.get('category', '')}\n\n"
        "Tu tarea es REFUTAR que este resultado constituya información adversa "
        "sobre la ENTIDAD OBJETIVO. Considera especialmente:\n"
        "- ¿Trata en realidad de otra empresa con nombre igual o parecido "
        "(otra jurisdicción, otro sector, otro grupo)?\n"
        "- ¿La entidad aparece solo de pasada, sin ser objeto de la noticia?\n"
        "- ¿El texto respalda realmente la acusación, o la clasificación la "
        "exagera?\n"
        "- ¿La fuente es agregador, nota de prensa o contenido de baja calidad?\n\n"
        "Si tienes CUALQUIER duda razonable, responde refuted=true.\n\n"
        'Responde SOLO con un objeto JSON: {"refuted": true|false, '
        '"reason": "una frase"}'
    )


def parse_verdict(payload):
    """Coerce a model payload to a verdict. Anything unclear ⇒ refuted."""
    if not isinstance(payload, dict):
        raise ValueError('verdict payload is not an object')
    if 'refuted' not in payload:
        raise ValueError('verdict payload has no "refuted" key')
    return {
        'refuted': bool(payload.get('refuted')),
        'reason': str(payload.get('reason') or '')[:300],
        'status': 'ran',
    }


def refute(items, _caller=None):
    """Return a NEW list; adverse items gain a 'verdict'. Never raises."""
    out = []
    for item in (items or []):
        if not item.get('is_adverse'):
            out.append(item)
            continue
        if _caller is None:
            out.append({**item, 'verdict': dict(_REFUTED_ON_FAILURE)})
            continue
        try:
            verdict = parse_verdict(_caller(build_prompt(item)))
        except Exception as exc:
            logger.warning("refutation failed for %s: %s", item.get('url'), exc)
            verdict = dict(_REFUTED_ON_FAILURE)
        out.append({**item, 'verdict': verdict})
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest test_dd_ext_refute.py -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add dd_ext_refute.py test_dd_ext_refute.py
git -c commit.gpgsign=false commit -m "feat: add adversarial refutation pass over adverse external findings

Uncertainty resolves to refuted: a false positive in a paid report is an
accusation against a real company, a false negative is a documented limit."
```

---

### Task 7: Digital footprint (`dd_ext_footprint.py`)

**Files:**
- Create: `dd_ext_footprint.py`
- Test: `test_dd_ext_footprint.py`

**Interfaces:**
- Consumes: web-kind items from `dd_ext_search.fetch`
- Produces:
  - `assess(subject_name, activity, web_items, _caller=None) -> dict` —
    `{'status','website','presents_as','consistent_with_registry','sources'}`
    where `consistent_with_registry` ∈ `{True, False, None}`
  - `build_prompt(subject_name, activity, web_items) -> str`
  - `parse_footprint(payload, allowed_urls) -> dict`

- [ ] **Step 1: Write the failing test**

Create `test_dd_ext_footprint.py`:

```python
"""Tests for dd_ext_footprint — public-presence corroboration.

'Registry-active but no traceable public presence' is a FINDING, not a gap,
and it is the most common informative result for a Spanish SME.
"""
import dd_ext_footprint as f

WEB = [
    {'title': 'ACME Soluciones — Consultoría IT', 'url': 'https://acme.example',
     'source': 'acme.example', 'snippet': 'Servicios de consultoría', 'kind': 'web'},
]


def test_no_web_results_is_a_finding_not_an_error():
    out = f.assess('ACME SOLUCIONES SL', 'Consultoria informatica', [], _caller=None)
    assert out['status'] == 'ran'
    assert out['website'] is None
    assert out['consistent_with_registry'] is None


def test_website_must_come_from_a_retrieved_url():
    def _caller(_p):
        return {'website': 'https://inventado.example', 'presents_as': 'x',
                'consistent_with_registry': True}

    out = f.assess('ACME SOLUCIONES SL', 'Consultoria', WEB, _caller=_caller)
    assert out['website'] is None  # hallucinated URL rejected


def test_accepts_a_website_present_in_the_retrieved_set():
    def _caller(_p):
        return {'website': 'https://acme.example',
                'presents_as': 'Consultoría IT',
                'consistent_with_registry': True}

    out = f.assess('ACME SOLUCIONES SL', 'Consultoria informatica', WEB,
                   _caller=_caller)
    assert out['website'] == 'https://acme.example'
    assert out['presents_as'] == 'Consultoría IT'
    assert out['consistent_with_registry'] is True
    assert 'https://acme.example' in out['sources']


def test_non_boolean_consistency_becomes_none():
    def _caller(_p):
        return {'website': 'https://acme.example', 'presents_as': 'x',
                'consistent_with_registry': 'quizas'}

    out = f.assess('ACME SOLUCIONES SL', 'Consultoria', WEB, _caller=_caller)
    assert out['consistent_with_registry'] is None


def test_llm_failure_degrades_to_failed_without_raising():
    def _boom(_p):
        raise RuntimeError('down')

    out = f.assess('ACME SOLUCIONES SL', 'Consultoria', WEB, _caller=_boom)
    assert out['status'] == 'failed'
    assert out['website'] is None


def test_prompt_lists_only_retrieved_urls():
    prompt = f.build_prompt('ACME SOLUCIONES SL', 'Consultoria', WEB)
    assert 'https://acme.example' in prompt
    assert 'ACME SOLUCIONES SL' in prompt
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest test_dd_ext_footprint.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'dd_ext_footprint'`

- [ ] **Step 3: Write minimal implementation**

Create `dd_ext_footprint.py`:

```python
"""Digital-footprint corroboration: does this company exist publicly, and does
its public presence match the registry record?

For most Spanish SMEs this is the most informative external output, because
most of them have no media coverage at all. A registry-active company with no
traceable public presence is stated as a FINDING.

Hallucination guard: any website the model returns that is not among the URLs
Python actually retrieved is rejected.

Pure module apart from the injected _caller.
"""
import logging

logger = logging.getLogger(__name__)

MAX_ITEMS_IN_PROMPT = 8
SNIPPET_IN_PROMPT = 300


def _empty(status):
    return {'status': status, 'website': None, 'presents_as': '',
            'consistent_with_registry': None, 'sources': []}


def build_prompt(subject_name, activity, web_items):
    lines = []
    for item in (web_items or [])[:MAX_ITEMS_IN_PROMPT]:
        lines.append(
            f"- {item.get('title', '')}\n"
            f"  URL: {item.get('url', '')}\n"
            f"  Extracto: {(item.get('snippet') or '')[:SNIPPET_IN_PROMPT]}"
        )
    return (
        "Eres un analista de due diligence. A partir EXCLUSIVAMENTE de los "
        "resultados web siguientes, describe la presencia pública de la "
        "empresa. No busques nada más y no uses conocimiento previo.\n\n"
        f"EMPRESA: {subject_name}\n"
        f"Actividad según el registro mercantil: {activity or '(no consta)'}\n\n"
        "Resultados web:\n" + ("\n".join(lines) or "(ninguno)") + "\n\n"
        "Devuelve SOLO un objeto JSON:\n"
        '{"website": "<URL oficial de la empresa, tomada LITERALMENTE de la '
        'lista anterior, o null>", "presents_as": "<una frase: a qué se '
        'dedica según su presencia pública, o cadena vacía>", '
        '"consistent_with_registry": true|false|null}\n\n'
        "consistent_with_registry compara la presencia pública con la "
        "actividad registral. Usa null si no hay evidencia suficiente. "
        "Nunca inventes una URL que no aparezca arriba."
    )


def parse_footprint(payload, allowed_urls):
    if not isinstance(payload, dict):
        raise ValueError('footprint payload is not an object')
    website = payload.get('website')
    if not isinstance(website, str) or website.strip() not in allowed_urls:
        website = None
    else:
        website = website.strip()
    consistent = payload.get('consistent_with_registry')
    if not isinstance(consistent, bool):
        consistent = None
    return {
        'status': 'ran',
        'website': website,
        'presents_as': str(payload.get('presents_as') or '')[:300],
        'consistent_with_registry': consistent,
        'sources': sorted(allowed_urls),
    }


def assess(subject_name, activity, web_items, _caller=None):
    """Never raises. No web results is a valid 'ran' outcome, not a failure."""
    items = [i for i in (web_items or []) if i.get('url')]
    if not items:
        return _empty('ran')
    if _caller is None:
        return _empty('not_run')
    allowed = {i['url'] for i in items}
    try:
        return parse_footprint(_caller(build_prompt(subject_name, activity, items)),
                               allowed)
    except Exception as exc:
        logger.warning("footprint assessment failed for %s: %s", subject_name, exc)
        return _empty('failed')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest test_dd_ext_footprint.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add dd_ext_footprint.py test_dd_ext_footprint.py
git -c commit.gpgsign=false commit -m "feat: add digital-footprint corroboration for external DD screening

A website the model names that Python did not retrieve is rejected. No web
presence is reported as a finding, not as a gap."
```

---

### Task 8: Evidence kinds and claim types (`dd_claims.py`)

Makes external findings citable while keeping them structurally separate from registry facts.

**Files:**
- Modify: `dd_claims.py` — `FACT_KINDS` (~line 22), `CLAIM_TYPES` (~line 40), `claims_system_rules`
- Test: `test_dd_claims.py` (existing file — append)

**Interfaces:**
- Consumes: nothing new
- Produces: `FACT_KINDS['W'|'M'|'H']` and
  `CLAIM_TYPES['cribado_listas'|'cobertura_mediatica'|'huella_digital']`

- [ ] **Step 1: Write the failing test**

First open `test_dd_claims.py` and note the import alias it uses and the exact
`validate_claims` signature the existing tests call. Adjust the snippet below to
match that style before running it — if `validate_claims` takes extra arguments,
pass what the existing tests pass.

Append to `test_dd_claims.py`:

```python
def test_external_evidence_kinds_exist():
    assert dd_claims.FACT_KINDS['W']['es'].startswith('Cribado de listas')
    assert dd_claims.FACT_KINDS['M']['en'].startswith('Media coverage')
    assert dd_claims.FACT_KINDS['H']['es'].startswith('Huella digital')


def test_external_claim_types_accept_only_their_own_kind():
    assert dd_claims.CLAIM_TYPES['cribado_listas']['kinds'] == {'W'}
    assert dd_claims.CLAIM_TYPES['cobertura_mediatica']['kinds'] == {'M'}
    assert dd_claims.CLAIM_TYPES['huella_digital']['kinds'] == {'H'}


def test_registry_claims_cannot_be_grounded_on_media():
    registry = dd_claims.build_registry([
        ('M', 'Cobertura: expediente CNMC (diario.example, 2026-05-01)'),
    ])
    claims = dd_claims.validate_claims(
        [{'tipo': 'propiedad_control', 'texto': 'Controlada por un tercero.',
          'relevancia': 'Importa.', 'evidencia': ['M1'],
          'ambito': 'derivado', 'confianza': 'media', 'comprobacion': ''}],
        registry,
    )
    assert claims == []


def test_media_claims_cannot_be_grounded_on_registry_evidence():
    registry = dd_claims.build_registry([('E', 'Nombramiento de administrador.')])
    claims = dd_claims.validate_claims(
        [{'tipo': 'cobertura_mediatica', 'texto': 'Cobertura adversa detectada.',
          'relevancia': 'Importa.', 'evidencia': ['E1'],
          'ambito': 'cribado', 'confianza': 'media', 'comprobacion': ''}],
        registry,
    )
    assert claims == []


def test_media_claim_grounded_on_media_evidence_survives():
    registry = dd_claims.build_registry([
        ('M', 'Cobertura: expediente CNMC (diario.example, 2026-05-01)'),
    ])
    claims = dd_claims.validate_claims(
        [{'tipo': 'cobertura_mediatica', 'texto': 'Existe cobertura adversa verificada.',
          'relevancia': 'Requiere revision.', 'evidencia': ['M1'],
          'ambito': 'cribado', 'confianza': 'media', 'comprobacion': 'Revisar fuente'}],
        registry,
    )
    assert len(claims) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest test_dd_claims.py -v`
Expected: FAIL — `KeyError: 'W'`

- [ ] **Step 3: Write minimal implementation**

In `dd_claims.py`, extend `FACT_KINDS`:

```python
    'W': {'es': 'Cribado de listas oficiales (comprobación separada)',
          'en': 'Official watchlist screening (separate check)'},
    'M': {'es': 'Cobertura mediática (fuente externa)',
          'en': 'Media coverage (external source)'},
    'H': {'es': 'Huella digital (fuente externa)',
          'en': 'Digital footprint (external source)'},
```

and extend `CLAIM_TYPES`:

```python
    'cribado_listas':      {'kinds': {'W'}},
    'cobertura_mediatica': {'kinds': {'M'}},
    'huella_digital':      {'kinds': {'H'}},
```

Then update `claims_system_rules` in both languages. In the Spanish branch, after the existing `cribado_boe` sentence, add:

```
Los resultados de cribado de listas SOLO respaldan "cribado_listas", la
cobertura mediática SOLO respalda "cobertura_mediatica" y la huella digital
SOLO respalda "huella_digital"; ninguna de ellas respalda jamás una
afirmación registral.
```

and in the English branch:

```
Watchlist screening results ONLY support "cribado_listas", media coverage ONLY
supports "cobertura_mediatica" and digital footprint ONLY supports
"huella_digital"; none of them ever supports a registry claim.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest test_dd_claims.py -v`
Expected: PASS (all existing tests plus 5 new)

- [ ] **Step 5: Run the whole DD suite to check nothing regressed**

Run: `venv/bin/python -m pytest test_dd_*.py -q`
Expected: PASS. `dd_synthesis` builds its schema from `CLAIM_TYPES`, so a snapshot-style assertion there may need updating to include the three new types — if one fails, update the expectation, do not remove the claim types.

- [ ] **Step 6: Commit**

```bash
git add dd_claims.py test_dd_claims.py
git -c commit.gpgsign=false commit -m "feat: add W/M/H evidence kinds for external intelligence

Each new claim type accepts only its own kind, reusing the cribado_boe
separation so a news article can never ground a registry claim."
```

---

### Task 9: Orchestrator (`dd_external.py`)

Single entry point. Owns the per-check status model and the production LLM callers.

**Files:**
- Create: `dd_external.py`
- Test: `test_dd_external.py`

**Interfaces:**
- Consumes: all `dd_ext_*` modules
- Produces:
  - `screen(data, *, brave_token=None, api_key=None, lang='es', is_legal_entity=None, alias_names=None, now=None, cache_dir=DEFAULT_CACHE_DIR, _search_fetch=None, _watchlist_screen=None, _triage_caller=None, _refute_caller=None, _footprint_caller=None) -> dict`
  - result shape:
    ```python
    {'status': 'ran'|'not_run'|'failed',
     'checked_at': '2026-08-04T10:00:00Z',
     'subjects': [{'name','role'}],
     'watchlists': {'status', 'lists': [...]},
     'media': {'status', 'queries': [...], 'items': [...]},
     'footprint': {'status','website','presents_as','consistent_with_registry','sources'}}
    ```
  - `build_llm_caller(api_key, system_prompt, max_tokens=1500) -> callable`
  - `DEFAULT_CACHE_DIR: str`

Corporate group context (spec §6.4) is **not** re-implemented here. It stays `borme_dd_report._fetch_web_context_via_llm`, and Task 11 passes its result through to the renderer. Rewriting it onto deterministic retrieval is a follow-up: it is the one piece whose current behaviour is already shipped and persisted (`enriched_web_context`), and changing its contract mid-plan would put a persisted-field migration inside a task that is about something else.

- [ ] **Step 1: Write the failing test**

Create `test_dd_external.py`:

```python
"""Tests for dd_external — the external-intelligence orchestrator.

The contract that matters: no combination of downstream failures may raise,
and a failure in one check must not degrade the others.
"""
import dd_external as dx


def _is_legal_entity(name):
    return any(t in (name or '').upper() for t in (' SL', ' SA', ' BV'))


DATA = {
    'company': {
        'company_name': 'ACME SOLUCIONES SL',
        'sole_shareholders': ['HOLDING ACME BV'],
        'activity': 'Consultoria informatica',
    },
    'companies_owned': [],
    'ownership_chain': [],
}


def _search_ok(queries, token, fetched_at, _get=None):
    return {'status': 'ran', 'queries': [q['q'] for q in queries], 'items': [{
        'title': 'ACME investigada', 'url': 'https://d.example/1',
        'source': 'd.example', 'published': '2026-05-01', 'snippet': 's',
        'subject': 'ACME SOLUCIONES SL', 'role': 'subject',
        'query': '"ACME SOLUCIONES SL"', 'kind': 'news',
        'fetched_at': fetched_at,
    }]}


def _watchlists_ok(names, cache_dir, today, _load=None):
    return {'status': 'ran', 'lists': [
        {'list_id': 'ofac_sdn', 'label_es': 'OFAC SDN (EE. UU.)',
         'label_en': 'OFAC SDN (US)', 'status': 'ran',
         'names_checked': len(names), 'matches': [],
         'generation_date': '2026-07-31T18:40:51+02:00', 'checked_at': today},
    ]}


def _base_kwargs(**over):
    kwargs = {
        'brave_token': 't',
        'api_key': 'k',
        'is_legal_entity': _is_legal_entity,
        'now': '2026-08-04T10:00:00Z',
        '_search_fetch': _search_ok,
        '_watchlist_screen': _watchlists_ok,
        '_triage_caller': lambda _p: [{'index': 1, 'is_relevant': True,
                                       'is_adverse': True,
                                       'category': 'litigio',
                                       'credibility': 'alta'}],
        '_refute_caller': lambda _p: {'refuted': False, 'reason': 'Misma entidad'},
        '_footprint_caller': lambda _p: {'website': None, 'presents_as': '',
                                         'consistent_with_registry': None},
    }
    kwargs.update(over)
    return kwargs


def test_happy_path_produces_every_block():
    out = dx.screen(DATA, **_base_kwargs())
    assert out['status'] == 'ran'
    assert out['checked_at'] == '2026-08-04T10:00:00Z'
    assert [s['name'] for s in out['subjects']][0] == 'ACME SOLUCIONES SL'
    assert out['watchlists']['status'] == 'ran'
    assert out['media']['status'] == 'ran'
    assert out['media']['items'][0]['verdict']['refuted'] is False
    assert out['footprint']['status'] in ('ran', 'not_run')


def test_search_failure_does_not_affect_watchlists():
    def _search_fail(queries, token, fetched_at, _get=None):
        return {'status': 'failed', 'queries': [], 'items': []}

    out = dx.screen(DATA, **_base_kwargs(_search_fetch=_search_fail))
    assert out['media']['status'] == 'failed'
    assert out['watchlists']['status'] == 'ran'
    assert out['status'] == 'ran'


def test_every_check_failing_makes_the_whole_thing_failed():
    def _search_fail(queries, token, fetched_at, _get=None):
        return {'status': 'failed', 'queries': [], 'items': []}

    def _wl_fail(names, cache_dir, today, _load=None):
        return {'status': 'failed', 'lists': []}

    out = dx.screen(DATA, **_base_kwargs(_search_fetch=_search_fail,
                                         _watchlist_screen=_wl_fail))
    assert out['status'] == 'failed'


def test_a_downstream_module_raising_is_contained():
    def _search_boom(*a, **k):
        raise RuntimeError('unexpected')

    out = dx.screen(DATA, **_base_kwargs(_search_fetch=_search_boom))
    assert out['media']['status'] == 'failed'
    assert out['status'] == 'ran'


def test_no_subjects_is_not_run():
    out = dx.screen({'company': {}}, **_base_kwargs())
    assert out['status'] == 'not_run'


def test_completely_broken_input_never_raises():
    assert dx.screen(None, **_base_kwargs())['status'] == 'not_run'


def test_refuted_items_are_kept_but_flagged():
    out = dx.screen(DATA, **_base_kwargs(
        _refute_caller=lambda _p: {'refuted': True, 'reason': 'Otra empresa'}))
    item = out['media']['items'][0]
    assert item['is_adverse'] is True
    assert item['verdict']['refuted'] is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest test_dd_external.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'dd_external'`

- [ ] **Step 3: Write minimal implementation**

Create `dd_external.py`:

```python
"""Orchestrator for the DD external-intelligence layer.

Single entry point called from borme_dd_report's parallel executor. Owns the
per-check status model and builds the production LLM callers.

Contract: screen() NEVER raises and NEVER blocks report generation. Each check
reports its own status independently, so a Brave outage does not suppress the
watchlist screen and an OpenRouter outage does not suppress either.
"""
import json
import logging
import os
import re
from datetime import datetime, timezone

import dd_ext_footprint
import dd_ext_refute
import dd_ext_search
import dd_ext_subjects
import dd_ext_triage
import dd_ext_watchlists

logger = logging.getLogger(__name__)

DEFAULT_CACHE_DIR = os.getenv('DD_EXTERNAL_CACHE_DIR', '/tmp/dd-external-cache')
_OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
_MODEL = 'anthropic/claude-sonnet-5'
_TIMEOUT = 45


def _parse_json_blob(text):
    """Parse a JSON object or array out of a model response."""
    if not text:
        raise ValueError('empty model response')
    try:
        return json.loads(text)
    except Exception:
        pass
    for pattern in (r'\[.*\]', r'\{.*\}'):
        match = re.search(pattern, text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
    raise ValueError('no JSON found in model response')


def build_llm_caller(api_key, system_prompt, max_tokens=1500):
    """Return fn(prompt) -> parsed JSON. No web-search tool: this layer's LLM
    calls classify text Python already retrieved, they never retrieve."""
    import requests

    def caller(prompt):
        response = requests.post(
            _OPENROUTER_URL,
            headers={'Authorization': f'Bearer {api_key}',
                     'Content-Type': 'application/json'},
            json={
                'model': _MODEL,
                'messages': [{'role': 'system', 'content': system_prompt},
                             {'role': 'user', 'content': prompt}],
                'max_tokens': max_tokens,
                'temperature': 0,
            },
            timeout=_TIMEOUT,
        )
        if response.status_code != 200:
            raise RuntimeError(f'OpenRouter HTTP {response.status_code}')
        content = response.json()['choices'][0].get('message', {}).get('content')
        return _parse_json_blob((content or '').strip())

    return caller


_TRIAGE_SYSTEM = ('Eres un analista de due diligence. Respondes SOLO con un '
                  'array JSON válido, sin markdown ni prosa.')
_REFUTE_SYSTEM = ('Eres un verificador escéptico. Respondes SOLO con un objeto '
                  'JSON válido, sin markdown ni prosa.')
_FOOTPRINT_SYSTEM = ('Eres un analista de due diligence. Respondes SOLO con un '
                     'objeto JSON válido, sin markdown ni prosa.')


def screen(data, *, brave_token=None, api_key=None, lang='es',
           is_legal_entity=None, alias_names=None, now=None,
           cache_dir=DEFAULT_CACHE_DIR, _search_fetch=None,
           _watchlist_screen=None, _triage_caller=None, _refute_caller=None,
           _footprint_caller=None):
    """Run the external-intelligence layer. Never raises."""
    checked_at = now or datetime.now(timezone.utc).isoformat()
    today = checked_at[:10]
    empty = {'status': 'not_run', 'checked_at': checked_at, 'subjects': [],
             'watchlists': {'status': 'not_run', 'lists': []},
             'media': {'status': 'not_run', 'queries': [], 'items': []},
             'footprint': {'status': 'not_run', 'website': None,
                           'presents_as': '', 'consistent_with_registry': None,
                           'sources': []}}
    try:
        subjects = dd_ext_subjects.build_subjects(
            data, alias_names=alias_names, is_legal_entity=is_legal_entity)
    except Exception as exc:
        logger.warning("external subject derivation failed: %s", exc)
        subjects = []
    if not subjects:
        return empty

    # --- Watchlists (deterministic, no LLM) ---
    try:
        wl_screen = _watchlist_screen or dd_ext_watchlists.screen
        watchlists = wl_screen([s['name'] for s in subjects], cache_dir, today)
    except Exception as exc:
        logger.warning("watchlist screening failed: %s", exc)
        watchlists = {'status': 'failed', 'lists': []}

    # --- Retrieval ---
    queries = []
    try:
        queries = dd_ext_search.build_queries(subjects)
        fetch = _search_fetch or dd_ext_search.fetch
        retrieved = fetch(queries, brave_token, checked_at)
    except Exception as exc:
        logger.warning("external retrieval failed: %s", exc)
        retrieved = {'status': 'failed', 'items': [],
                     'queries': [q['q'] for q in queries]}

    # --- Triage + refutation over news items ---
    media = {'status': retrieved.get('status', 'failed'),
             'queries': retrieved.get('queries', []), 'items': []}
    if retrieved.get('status') == 'ran':
        news_items = [i for i in retrieved.get('items', []) if i.get('kind') == 'news']
        try:
            triage_caller = _triage_caller or (
                build_llm_caller(api_key, _TRIAGE_SYSTEM) if api_key else None)
            triaged = dd_ext_triage.triage(news_items, _caller=triage_caller)
            refute_caller = _refute_caller or (
                build_llm_caller(api_key, _REFUTE_SYSTEM, max_tokens=400)
                if api_key else None)
            media['items'] = dd_ext_refute.refute(triaged, _caller=refute_caller)
        except Exception as exc:
            logger.warning("external triage/refutation failed: %s", exc)
            media = {**media, 'status': 'failed', 'items': []}

    # --- Footprint over web items ---
    footprint = dict(empty['footprint'])
    if retrieved.get('status') == 'ran':
        web_items = [i for i in retrieved.get('items', []) if i.get('kind') == 'web']
        try:
            fp_caller = _footprint_caller or (
                build_llm_caller(api_key, _FOOTPRINT_SYSTEM, max_tokens=400)
                if api_key else None)
            footprint = dd_ext_footprint.assess(
                subjects[0]['name'],
                ((data or {}).get('company') or {}).get('activity'),
                web_items, _caller=fp_caller)
        except Exception as exc:
            logger.warning("footprint assessment failed: %s", exc)
            footprint = {**empty['footprint'], 'status': 'failed'}

    statuses = (watchlists.get('status'), media.get('status'),
                footprint.get('status'))
    if any(s == 'ran' for s in statuses):
        status = 'ran'
    elif all(s == 'not_run' for s in statuses):
        status = 'not_run'
    else:
        status = 'failed'

    return {'status': status, 'checked_at': checked_at, 'subjects': subjects,
            'watchlists': watchlists, 'media': media, 'footprint': footprint}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest test_dd_external.py -v`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add dd_external.py test_dd_external.py
git -c commit.gpgsign=false commit -m "feat: add external-intelligence orchestrator

Per-check status model: a Brave outage cannot suppress the watchlist screen,
and no failure inside this layer can block a paid report."
```

---

### Task 10: Presentation (`dd_ext_render.py`)

Turns the result into PDF subsections, evidence entries, the synthesis facts note and the verdict-page summary line. One module owns everything human- or LLM-facing.

**Files:**
- Create: `dd_ext_render.py`
- Test: `test_dd_ext_render.py`

**Interfaces:**
- Consumes: `dd_external.screen` result; the PDF builder's `add_subsection(title)`, `add_callout(title, body, kind)`, `add_data_table(headers, rows, col_widths=None)`, `add_text(text, style_key)`
- Produces:
  - `render(pdf, result, boe_sanctions, web_context, lang) -> None`
  - `confirmed_adverse(result) -> list[dict]`, `refuted_adverse(result) -> list[dict]`
  - `evidence_entries(result, lang) -> list[tuple[str, str]]`
  - `facts_note(result, lang) -> str`
  - `summary_line(result, lang) -> str`
  - `scope_note(lang) -> str`, `methodology_note(lang) -> str`

- [ ] **Step 1: Write the failing test**

Create `test_dd_ext_render.py`:

```python
"""Tests for dd_ext_render — presentation of external intelligence.

The load-bearing tests: a clean result must render an explicit negative rather
than an empty section, a refuted item must not be presented as a finding, and
the officer-exclusion disclosure must always appear.
"""
import dd_ext_render as rr


class FakePdf:
    def __init__(self):
        self.calls = []

    def add_subsection(self, title):
        self.calls.append(('subsection', title))

    def add_callout(self, title, body, kind='info'):
        self.calls.append(('callout', title, body, kind))

    def add_data_table(self, headers, rows, col_widths=None):
        self.calls.append(('table', headers, rows))

    def add_text(self, text, style_key='body'):
        self.calls.append(('text', text, style_key))

    def text_blob(self):
        return ' '.join(str(c) for c in self.calls)


def _result(**over):
    base = {
        'status': 'ran',
        'checked_at': '2026-08-04T10:00:00Z',
        'subjects': [{'name': 'ACME SOLUCIONES SL', 'role': 'subject'}],
        'watchlists': {'status': 'ran', 'lists': [
            {'list_id': 'ofac_sdn', 'label_es': 'OFAC SDN (EE. UU.)',
             'label_en': 'OFAC SDN (US)', 'status': 'ran', 'names_checked': 1,
             'matches': [], 'generation_date': '2026-07-31T18:40:51+02:00', 'checked_at': '2026-08-04'},
        ]},
        'media': {'status': 'ran', 'queries': ['"ACME SOLUCIONES SL"'], 'items': []},
        'footprint': {'status': 'ran', 'website': None, 'presents_as': '',
                      'consistent_with_registry': None, 'sources': []},
    }
    base.update(over)
    return base


def _adverse_item(refuted=False):
    return {
        'title': 'ACME investigada', 'url': 'https://d.example/1',
        'source': 'd.example', 'published': '2026-05-01', 'snippet': 's',
        'subject': 'ACME SOLUCIONES SL', 'is_relevant': True, 'is_adverse': True,
        'category': 'litigio', 'credibility': 'alta',
        'verdict': {'refuted': refuted, 'reason': 'r', 'status': 'ran'},
    }


def test_clean_result_states_the_negative_and_lists_the_queries():
    pdf = FakePdf()
    rr.render(pdf, _result(), boe_sanctions=None, web_context=None, lang='es')
    blob = pdf.text_blob().lower()
    assert 'no se ha encontrado' in blob or 'sin cobertura' in blob
    assert 'acme soluciones sl' in blob


def test_officer_exclusion_is_always_disclosed():
    pdf = FakePdf()
    rr.render(pdf, _result(), boe_sanctions=None, web_context=None, lang='es')
    assert 'no se criban' in pdf.text_blob().lower()
    assert 'not screened' in rr.scope_note('en').lower()


def test_refuted_items_are_not_counted_as_findings():
    result = _result(media={'status': 'ran', 'queries': [],
                            'items': [_adverse_item(refuted=True)]})
    assert rr.confirmed_adverse(result) == []
    assert len(rr.refuted_adverse(result)) == 1


def test_confirmed_adverse_item_is_rendered_with_its_source():
    pdf = FakePdf()
    rr.render(pdf, _result(media={'status': 'ran', 'queries': [],
                                  'items': [_adverse_item(refuted=False)]}),
              boe_sanctions=None, web_context=None, lang='es')
    assert 'https://d.example/1' in pdf.text_blob()


def test_watchlist_table_includes_every_configured_list():
    pdf = FakePdf()
    rr.render(pdf, _result(watchlists={'status': 'ran', 'lists': [
        {'list_id': 'ofac_sdn', 'label_es': 'OFAC SDN (EE. UU.)',
         'label_en': 'OFAC SDN (US)', 'status': 'ran', 'names_checked': 1,
         'matches': [], 'generation_date': '2026-07-31T18:40:51+02:00', 'checked_at': '2026-08-04'},
        {'list_id': 'eu_consolidated', 'label_es': 'Lista UE',
         'label_en': 'EU list', 'status': 'failed', 'names_checked': 0,
         'matches': [], 'generation_date': '2026-07-31T18:40:51+02:00', 'checked_at': '2026-08-04'},
    ]}), boe_sanctions=None, web_context=None, lang='es')
    blob = pdf.text_blob()
    assert 'OFAC SDN (EE. UU.)' in blob
    assert 'Lista UE' in blob


def test_stale_list_is_disclosed_as_stale_with_its_date():
    pdf = FakePdf()
    rr.render(pdf, _result(watchlists={'status': 'ran', 'lists': [
        {'list_id': 'eu_consolidated', 'label_es': 'Lista UE',
         'label_en': 'EU list', 'status': 'stale', 'names_checked': 1,
         'matches': [], 'generation_date': '2026-06-01T00:00:00+02:00',
         'checked_at': '2026-08-04'},
    ]}), boe_sanctions=None, web_context=None, lang='es')
    blob = pdf.text_blob().lower()
    assert 'desactualizada' in blob
    assert '2026-06-01' in pdf.text_blob()


def test_methodology_note_discloses_the_weaker_group_context_sourcing():
    note = rr.methodology_note('es')
    assert '6.4' in note


def test_boe_result_is_folded_into_the_watchlist_table():
    pdf = FakePdf()
    rr.render(pdf, _result(),
              boe_sanctions={'total_checked': 3, 'total_matches': 0},
              web_context=None, lang='es')
    assert 'BOE' in pdf.text_blob()


def test_failed_layer_renders_an_honest_not_completed_notice():
    pdf = FakePdf()
    rr.render(pdf, _result(status='failed',
                           media={'status': 'failed', 'queries': [], 'items': []},
                           watchlists={'status': 'failed', 'lists': []},
                           footprint={'status': 'failed', 'website': None,
                                      'presents_as': '',
                                      'consistent_with_registry': None,
                                      'sources': []}),
              boe_sanctions=None, web_context=None, lang='es')
    assert 'no se pudo' in pdf.text_blob().lower()


def test_evidence_entries_use_the_right_kinds():
    entries = rr.evidence_entries(
        _result(media={'status': 'ran', 'queries': [],
                       'items': [_adverse_item(refuted=False)]}), 'es')
    kinds = {kind for kind, _text in entries}
    assert 'W' in kinds   # watchlist screen ran
    assert 'M' in kinds   # confirmed media item


def test_evidence_entries_exclude_refuted_items():
    entries = rr.evidence_entries(
        _result(media={'status': 'ran', 'queries': [],
                       'items': [_adverse_item(refuted=True)]}), 'es')
    assert all('d.example' not in text for _kind, text in entries)


def test_summary_line_is_neutral_when_clean():
    assert 'sin' in rr.summary_line(_result(), 'es').lower()


def test_summary_line_counts_only_confirmed_items():
    line = rr.summary_line(
        _result(media={'status': 'ran', 'queries': [],
                       'items': [_adverse_item(refuted=False),
                                 _adverse_item(refuted=True)]}), 'es')
    assert '1' in line


def test_facts_note_is_empty_when_the_layer_did_not_run():
    assert rr.facts_note({'status': 'not_run'}, 'es') == ''


def test_all_public_helpers_tolerate_none():
    assert rr.evidence_entries(None, 'es') == []
    assert rr.summary_line(None, 'es') == ''
    assert rr.facts_note(None, 'es') == ''
    assert rr.confirmed_adverse(None) == []
    pdf = FakePdf()
    rr.render(pdf, None, boe_sanctions=None, web_context=None, lang='es')
    assert pdf.calls  # renders the "not run" notice rather than nothing
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest test_dd_ext_render.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'dd_ext_render'`

- [ ] **Step 3: Write minimal implementation**

Create `dd_ext_render.py`, starting from this skeleton and filling in the four subsection renderers:

```python
"""Presentation of the external-intelligence layer.

One module owns every human- and LLM-facing rendering of the result: the PDF
subsections, the dd_claims evidence entries, the synthesis facts note and the
verdict-page summary line.

Two rules run through all of it:
  1. A clean result is an explicit, sourced NEGATIVE — never an empty section.
     For most Spanish SMEs "no media footprint" is the true and useful answer.
  2. A refuted item is never presented, counted or cited as a finding.
"""


def _t(lang, es, en):
    return en if lang == 'en' else es


def confirmed_adverse(result):
    """Adverse items that survived refutation. The ONLY items that count."""
    items = (((result or {}).get('media') or {}).get('items')) or []
    return [i for i in items
            if i.get('is_adverse') and not (i.get('verdict') or {}).get('refuted')]


def refuted_adverse(result):
    items = (((result or {}).get('media') or {}).get('items')) or []
    return [i for i in items
            if i.get('is_adverse') and (i.get('verdict') or {}).get('refuted')]
```

Then implement, in this order inside `render`:

**`scope_note(lang)`** — Spanish: *"Las comprobaciones de esta sección son externas al Registro Mercantil. **No se criban los cargos ni las personas físicas**: el BORME no asigna identificador a las personas, por lo que el cotejo por nombre resulta poco fiable con los patrones de nombre habituales en España, y el cribado de personas identificadas frente a medios plantea problemas de privacidad que este informe no asume."* English must contain the phrase *"are not screened"*.

**Early exit** — `result` is `None` or `result['status'] == 'not_run'` → emit the scope note, then `add_callout` titled *"Verificaciones externas: no ejecutadas"* / *"External checks: not run"*, then return.

**6.1 `add_subsection` + `add_data_table`** — headers `["Lista", "Versión de la lista", "Estado", "Nombres comprobados", "Coincidencias"]` / `["List", "List version", "Status", "Names checked", "Matches"]`. One row per `result['watchlists']['lists']` using `label_es`/`label_en`, with the version cell showing the date part of `generation_date` (or "—" when the source publishes none, as BOE does). Plus a BOE row built from `boe_sanctions` (`None` → status "no ejecutada" / "not run"; otherwise `total_checked` and `total_matches`).

Status renders as *ejecutada / desactualizada / no ejecutada / no disponible / error* (`ran` / `stale` / `not_run` / `unavailable` / `failed`). A `stale` row must additionally get an `add_text` line naming the list's `generation_date` and stating that the current list could not be retrieved, so a reader is never shown an old screen without being told it is old.

If any list has matches, follow the table with `add_text` carrying the non-adjudication sentence: a list match is not an adjudicated finding and requires manual review.

**6.2 `add_subsection`** — if `media['status'] != 'ran'` → `add_callout(kind='info')` whose body contains *"no se pudo"* / *"could not be completed"*. If `ran` and `confirmed_adverse(result)` is empty → `add_callout(kind='success')` whose body contains *"No se ha encontrado cobertura mediática adversa"* / *"No adverse media coverage was found"* for the entity and its former names, then `add_text` listing `media['queries']` verbatim (or, when the query list is empty, the subject names) plus the note that this is the expected result for most Spanish SMEs. If confirmed items exist → `add_data_table` with headers `["Fecha", "Fuente", "Categoría", "Titular / enlace"]` / `["Date", "Source", "Category", "Headline / link"]`, one row per confirmed item whose last cell includes the URL, then `add_text` stating how many items `refuted_adverse` discarded during verification.

**6.3 `add_subsection`** — website, `presents_as`, consistency. When `website` is `None` and `media['status'] == 'ran'`, state the "registry-active, no traceable public presence" finding explicitly.

**6.4 `add_subsection`** — render `web_context` (`{'group_name','group_listed','context'}` from `borme_dd_report._fetch_web_context_via_llm`), or state that no group affiliation was identified.

**`evidence_entries(result, lang)`** — `('W', …)` one entry summarising the list screen when `watchlists['status'] == 'ran'`; `('M', …)` one entry per **confirmed** item, e.g. `f"Cobertura: {title} ({source}, {published})"`; `('H', …)` one entry when `footprint['status'] == 'ran'`. Never emit an entry for a refuted item.

**`facts_note(result, lang)`** — a short block for the synthesis facts input, prefixed `"CRIBADO EXTERNO (fuente NO registral):"` / `"EXTERNAL SCREENING (NON-registry source):"`. Returns `''` when status is `not_run` or the result is `None`.

**`summary_line(result, lang)`** — clean: *"Cribado externo: sin coincidencias en listas · sin cobertura adversa verificada"*; with hits: *"Cribado externo: N elemento(s) requieren revisión (§6)"*. Returns `''` for `None`.

**`methodology_note(lang)`** — the Annex D long form: what was searched, the query policy (verbatim entity names, no adverse-keyword injection), the exact-match-only watchlist policy and the fact that the EU list is screened against sanctioned **entities only**, the subject caps from `dd_ext_subjects` stated numerically (8 total, 2 former names, 3 participadas), the refutation rule, and the officer exclusion with both reasons.

It must **also** state that §6.4 (corporate group context) is the one part of this section not backed by a directly retrieved source: it is a model-asserted summary, unlike §6.1–6.3 where every statement traces to a fetched URL. Section 6 otherwise implies a uniform evidentiary standard it does not yet meet, and the reader is entitled to know which claim is weaker.

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest test_dd_ext_render.py -v`
Expected: PASS (15 tests)

- [ ] **Step 5: Commit**

```bash
git add dd_ext_render.py test_dd_ext_render.py
git -c commit.gpgsign=false commit -m "feat: render external intelligence into DD section 6

A clean result renders an explicit sourced negative rather than an empty
section, and refuted items are never presented, counted or cited."
```

---

### Task 11: Wire into the report (`borme_dd_report.py`)

**Files:**
- Modify: `borme_dd_report.py` — imports (top), option resolver (~1572), evidence entries (~6464), facts block (~6475), verdict page (~8137), section 6 (~9300), Annex D (~9839), executor block (~10199), result stash (~10250)
- Test: `test_dd_ext_wiring.py`

**Interfaces:**
- Consumes: `dd_external.screen`, `dd_ext_render.*`
- Produces: `data['_external_intel']`; `_resolve_external_enabled(options) -> bool`; a new `include_external` report option (default `True`)

- [ ] **Step 1: Write the failing test**

Create `test_dd_ext_wiring.py`:

```python
"""Wiring tests: the report must consume the external layer correctly and must
survive it being absent, failed, or disabled."""
import borme_dd_report as bdr
import dd_claims
import dd_ext_render as rr


def test_report_module_exposes_the_external_option_default_true():
    assert bdr._resolve_external_enabled({}) is True
    assert bdr._resolve_external_enabled({'include_external': False}) is False
    assert bdr._resolve_external_enabled(None) is True


def test_evidence_entries_build_a_valid_registry():
    result = {
        'status': 'ran', 'checked_at': '2026-08-04T10:00:00Z',
        'subjects': [{'name': 'ACME SL', 'role': 'subject'}],
        'watchlists': {'status': 'ran', 'lists': [
            {'list_id': 'ofac_sdn', 'label_es': 'OFAC', 'label_en': 'OFAC',
             'status': 'ran', 'names_checked': 1, 'matches': [],
             'generation_date': '2026-07-31T18:40:51+02:00', 'checked_at': '2026-08-04'}]},
        'media': {'status': 'ran', 'queries': [], 'items': []},
        'footprint': {'status': 'ran', 'website': None, 'presents_as': '',
                      'consistent_with_registry': None, 'sources': []},
    }
    registry = dd_claims.build_registry(rr.evidence_entries(result, 'es'))
    assert registry and all(e['id'][0] in ('W', 'M', 'H') for e in registry)


def test_is_legal_entity_is_the_shared_classifier():
    # dd_ext_subjects must be fed the report's own classifier, not a copy.
    assert bdr._is_legal_entity('ACME SL') is True
    assert bdr._is_legal_entity('JUAN PEREZ GARCIA') is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest test_dd_ext_wiring.py -v`
Expected: FAIL — `AttributeError: module 'borme_dd_report' has no attribute '_resolve_external_enabled'`

- [ ] **Step 3: Write minimal implementation**

**(a)** Near the other `dd_*` imports at the top of `borme_dd_report.py`:

```python
import dd_external
import dd_ext_render
```

**(b)** Next to `_resolve_mode` (~line 1572):

```python
def _resolve_external_enabled(options):
    """External intelligence is on by default; `include_external: False` is an
    ops kill-switch, mirroring `include_web_context`."""
    if not isinstance(options, dict):
        return True
    return options.get('include_external', True) is not False
```

**(c)** In the executor block after the `boe` future (~line 10205):

```python
        _include_external = _resolve_external_enabled(options)
        if _include_external:
            futures['external_intel'] = executor.submit(
                dd_external.screen,
                data,
                brave_token=os.getenv('BRAVE_TOKEN'),
                api_key=openrouter_key,
                lang=lang,
                is_legal_entity=_is_legal_entity,
                alias_names=alias_set,
            )
```

`alias_set` must be the already-resolved alias set for the subject. If it is not in scope at this point, pass `None` — `dd_ext_subjects` treats a missing alias set as "no former names" and degrades cleanly. Do not re-run `resolve_alias_set` here; a second ES round-trip inside the executor is not worth two extra former-name queries.

**(d)** Alongside the other `_safe_result` calls (~line 10250):

```python
        _external_intel = _safe_result('external_intel', None)
        data['_external_intel'] = _external_intel
        if _external_intel:
            logger.info(
                "external intel: status=%s subjects=%d watchlists=%s media=%s "
                "confirmed=%d footprint=%s",
                _external_intel.get('status'),
                len(_external_intel.get('subjects') or []),
                (_external_intel.get('watchlists') or {}).get('status'),
                (_external_intel.get('media') or {}).get('status'),
                len(dd_ext_render.confirmed_adverse(_external_intel)),
                (_external_intel.get('footprint') or {}).get('status'),
            )
```

**(e)** In the `_reg_entries` assembly (~line 6464), immediately before `claims_registry = dd_claims.build_registry(_reg_entries)`:

```python
    _reg_entries.extend(dd_ext_render.evidence_entries(
        data.get('_external_intel'), lang))
```

**(f)** In the `facts_block` list (~line 6475), after `dd_sector_context.external_context_note(...)`:

```python
        dd_ext_render.facts_note(data.get('_external_intel'), lang),
```

**(g)** On the verdict page (~line 8137, the "Valoración" section), after the existing assessment content:

```python
    _ext_line = dd_ext_render.summary_line(data.get('_external_intel'), lang)
    if _ext_line:
        pdf.add_text(_ext_line, 'disclaimer')
```

**(h)** In the "Verificaciones externas" section (~line 9300): delete the existing BOE status callout block (from `if boe_sanctions is None:` through the `pdf.add_callout(_title, _body, kind=_kind)` call — the summary callout only) and insert:

```python
    dd_ext_render.render(
        pdf,
        data.get('_external_intel'),
        boe_sanctions=boe_sanctions,
        web_context=data.get('_final_web_context'),
        lang=lang,
    )
```

Keep the existing BOE per-match explainer and detail table that follows, and leave it after this call — the match detail is still BOE-specific, and `dd_ext_render` renders only its summary row.

**(i)** In Annex D (~line 9839), append:

```python
    pdf.add_text(dd_ext_render.methodology_note(lang), 'disclaimer')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest test_dd_ext_wiring.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the entire DD suite**

Run: `venv/bin/python -m pytest test_dd_*.py test_risk_*.py -q`
Expected: PASS. `test_dd_v2_render.py` and `test_dd_pdf_layout.py` exercise the report end to end; if either fails because section 6's content changed, update the expectation to the new structure — do not revert the wiring.

- [ ] **Step 6: Generate one real report end to end**

With `BRAVE_TOKEN` and `OPENROUTER_API_KEY` set, generate a DD for two companies you can verify by hand: one with real press coverage (a listed or well-known one) and one small SME with none, so both branches are seen.

Check by hand and report these in the commit:
- Every URL printed in 6.2 resolves and is genuinely about the subject company.
- The SME report shows the explicit "no media footprint" negative with its query list, not an empty section.
- The officer-exclusion disclosure appears in section 6 and Annex D.
- Annex E lists the external evidence ids.
- The verdict is unchanged versus a report generated with `include_external: False`.
- The log line from (d) reports plausible statuses.

- [ ] **Step 7: Commit**

```bash
git add borme_dd_report.py test_dd_ext_wiring.py
git -c commit.gpgsign=false commit -m "feat: wire external intelligence into the company DD report

Section 6 now renders official-list screening (BOE folded into a unified
table), media coverage, digital footprint and group context. External findings
are cited through the W/M/H evidence kinds and summarised on the verdict page
without altering the verdict. include_external=False is an ops kill-switch."
```

---

### Task 12: Verification pass

- [ ] **Step 1: Full suite**

Run: `venv/bin/python -m pytest -q`
Expected: PASS, no new failures against `main`.

- [ ] **Step 2: Confirm the degradation guarantee for real**

```bash
venv/bin/python - <<'PY'
import dd_external
out = dd_external.screen(
    {'company': {'company_name': 'ACME SOLUCIONES SL', 'sole_shareholders': []}},
    brave_token=None, api_key=None,
    is_legal_entity=lambda n: ' SL' in (n or '').upper())
print(out['status'], out['media']['status'], out['watchlists']['status'])
PY
```

Expected: prints statuses without raising. A report generated with both credentials unset must still produce a complete PDF.

- [ ] **Step 3: Check module sizes against the global constraint**

Run: `wc -l dd_ext_*.py dd_external.py`
Expected: every file under 400 lines. If one is over, split it before merging.

- [ ] **Step 4: Report cost actuals**

From the log lines in Task 11 (d) plus the OpenRouter dashboard, record the observed per-report cost for the two reports generated in Task 11 Step 6, and the Brave per-query price on the live plan. Compare against the €1.50 ceiling and the "well under €0.30 typical" estimate in the spec. **If actuals exceed the estimate, stop and report rather than merging** — the packaging decision (always included, no price change) was made on that estimate.

- [ ] **Step 5: Request review before merge**

Do not push or merge. Summarise: tests passing, the two hand-verified reports, observed cost, which watchlist sources were confirmed live in Task 4 Step 1, and anything that had to deviate from this plan.

---

## Deployment notes (not part of implementation)

- `ncdata-bormes-impl` deploys by pushing **`main`**, not `server-current`. CI fast-forwards `server-current` from `main`, then ssh-deploys and restarts. The comment in `deploy.sh` is stale.
- `BRAVE_TOKEN` already exists in the server environment (`borme_search_api.py` reads it). Confirm it is also visible to the DD process before enabling.
- `DD_EXTERNAL_CACHE_DIR` defaults to `/tmp/dd-external-cache`; on a server with a wiped `/tmp` the watchlists simply re-download daily, which is acceptable.
- The kill-switch is `include_external: False` in the report options, requiring no redeploy if the layer misbehaves.
