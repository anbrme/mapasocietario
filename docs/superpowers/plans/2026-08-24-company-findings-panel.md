# Company Findings Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a decision-ready findings block (identity, what changed, dated findings with evidence, needs-verification, offer) at the top of the company inspector, produced by the same story spine as the paid DD report.

**Architecture:** A new pure module `dd_findings.py` in `ncdata-bormes-impl` turns a `CompanyStory` (from `dd_story.build_story`) into typed findings and a free-tier projection; a small registrar exposes it as `GET /bormes/v3/company-findings`. The spine gains three structured facts it did not carry (dated seat events, dated capital history, registry facts on the company block) so the findings module never touches raw ES documents. In `mapasocietario`, a pure `findingsView.js` maps the payload to display data and a string-free `CompanyFindings.jsx` renders it first in `CompanyInspectorPanel`.

**Tech Stack:** Python 3.12 / Flask / Elasticsearch client (backend, pytest); React 19 + MUI + Vite 5 (frontend, vitest node-env only); Cloudflare Pages deploy on push to `main`; backend deploys on push to `main` (CI fast-forwards `server-current`).

**Spec:** `docs/superpowers/specs/2026-08-24-company-findings-panel-design.md`

## Global Constraints

- Backend tests that must run in CI live at the repo ROOT as `tests_*.py` (CI runs `pytest tests_*.py`; files under `tests/` or named `test_*.py` inside packages are invisible to CI).
- Git commits in both repos need `-c commit.gpgsign=false` (1Password signing fails non-interactively).
- `dd_findings.py` is PURE: no HTTP, no ES, no `datetime.now()` — `today` is injected.
- Every finding text that carries a date shows it as `YYYY-MM-DD`; a finding whose date is unknown is omitted, never rendered undated (spec: capital movement rule).
- The two honesty sentences are verbatim per spec (EN/ES) and asserted in tests:
  - EN `no_insolvency_notice`: "No dissolution, liquidation or insolvency notice found in indexed BORME publications since 2009. This is not a certificate of current status."
  - ES `no_insolvency_notice`: "No consta ninguna inscripción de disolución, liquidación ni concurso en las publicaciones del BORME indexadas desde 2009. No es un certificado de la situación actual."
  - EN `sole_shareholder_declared`: "Sole-shareholder declaration published {date}; any later change would appear as a new filing — none indexed."
  - ES `sole_shareholder_declared`: "Declaración de socio único publicada el {date}; cualquier cambio posterior constaría como nueva inscripción — ninguna indexada."
- Free projection cap: 5 findings; `more` carries the dropped count.
- Frontend component `CompanyFindings.jsx` contains NO user-visible strings; all copy lives in `src/utils/findingsView.js` or comes from the payload.
- Frontend feature flag `FINDINGS_PANEL_ENABLED` in `src/config.js`, default `false`; the endpoint is always on.
- The api-proxy Worker already dispatches and allowlists `pathname.startsWith('/bormes/v3/')` (`local-rag/workers/api-proxy/src/index.js:610` and `:1918`), so NO Worker change is planned — Task 4 verifies this live instead of editing.
- Deviation from spec, deliberate: event documents already carry `pdf_url`, `borme_entry_number`, `event_date`, so `borme_ref` is POPULATED in v1 for event-backed findings (`{date, entry, url}`) rather than reserved.
- No `console.log` in production code; `console.error` is acceptable in error paths.

---

## File map

**ncdata-bormes-impl** (`~/ncdata-bormes-impl`)
- Modify `dd_story.py` — `_authority_layer` detail gains `seat_events`; `_shape_layer` detail gains `capital_history`; `structural_events` entries gain `event_ref`; `build_story` company block gains `province`, `last_seen`, `name_changes`, `sole_shareholder_declarations`, `is_dissolved`, `is_in_concurso`.
- Create `dd_findings.py` — `build_findings(story, today, lang)`, `project_free(findings)`, `verification_lines(story, lang)`, `FREE_CAP`, `OFFICER_IDENTITY_FINDINGS`.
- Create `dd_findings_api.py` — `register_findings_routes(app, es, *, assemble=None, get_doc=None, today=None, cache=None)`.
- Modify `borme_search_api.py` (~line 50 import, ~line 414 registration).
- Create `tests_story_findings_facts.py`, `tests_dd_findings.py`, `tests_dd_findings_api.py` (repo root).

**mapasocietario** (`~/mapasocietario`)
- Modify `src/config.js` — `FINDINGS_PANEL_ENABLED`.
- Modify `src/services/spanishCompaniesService.js` — `getCompanyFindings`.
- Create `src/utils/findingsView.js`, `src/utils/findingsView.test.js`.
- Create `src/components/CompanyFindings.jsx`.
- Modify `src/components/CompanyInspectorPanel.jsx` — mount the block first in the company view.
- Modify `src/components/DDCheckoutDialog.jsx` — `free_report_selected` event.
- Modify `src/services/spanishCompaniesService.cache.test.js` — two tests.

---

### Task 1: The spine carries the dated facts the findings need

**Files:**
- Modify: `~/ncdata-bormes-impl/dd_story.py` (`_authority_layer` ~213, `structural_events` ~251, `_shape_layer` ~267, `build_story` ~543)
- Test: `~/ncdata-bormes-impl/tests_story_findings_facts.py`

**Interfaces:**
- Consumes: existing `dd_story.build_story(data, registry, lang, ownership=None)` and `dd_story.layer(story, key)`.
- Produces (read by Task 2):
  - `story['company']` additionally has `province: str|None`, `last_seen: 'YYYY-MM-DD'|None`, `name_changes: [{old_name,new_name,date}]`, `sole_shareholder_declarations: [{name,date,is_individual}]`, `is_dissolved: bool`, `is_in_concurso: bool`.
  - authority layer `detail[0]['seat_events']`: `[{'date': 'YYYY-MM-DD', 'name': str, 'position': str, 'kind': 'appointment'|'cessation', 'event_ref': {'date','entry','url'}|None}]` — governing-body positions only, newest first.
  - shape layer `detail[0]['capital_history']`: `[{'amount': float, 'date': 'YYYY-MM-DD'}]` in input order, unparseable or undated entries dropped.
  - shape layer `detail[0]['events']` entries additionally carry `'event_ref': {'date','entry','url'}|None`.

- [ ] **Step 1: Write the failing tests**

```python
# ~/ncdata-bormes-impl/tests_story_findings_facts.py
"""The story carries the dated registry facts the findings module reads.

dd_findings consumes the STORY, never raw ES docs, so every date it renders
must already be on a layer's detail or the company block. These tests pin
that contract.
"""
import dd_story


def _evt(type_, date, officers=None, entry='2024-01', url='https://boe.es/x.pdf'):
    return {'event_date': date, 'event_types': [{'type': type_}],
            'officers': officers or [], 'borme_entry_number': entry, 'pdf_url': url}


def _data(events=None, company=None):
    base = {'company_name': 'X SL', 'capital_history': [], 'officers_active': []}
    base.update(company or {})
    return {'company': base, 'events': events or []}


def test_company_block_carries_registry_facts():
    data = _data(company={
        'province': 'Madrid', 'last_seen': '2026-06-12',
        'name_changes': [{'old_name': 'OLD SL', 'new_name': 'X SL', 'date': '2020-01-10'}],
        'sole_shareholder_declarations': [{'name': 'P', 'date': '2019-03-01', 'is_individual': False}],
        'is_dissolved': False, 'is_in_concurso': True,
    })
    s = dd_story.build_story(data, [], 'en')
    c = s['company']
    assert c['province'] == 'Madrid'
    assert c['last_seen'] == '2026-06-12'
    assert c['name_changes'][0]['old_name'] == 'OLD SL'
    assert c['sole_shareholder_declarations'][0]['date'] == '2019-03-01'
    assert c['is_dissolved'] is False and c['is_in_concurso'] is True


def test_company_block_defaults_when_facts_absent():
    s = dd_story.build_story(_data(), [], 'en')
    c = s['company']
    assert c['province'] is None and c['last_seen'] is None
    assert c['name_changes'] == [] and c['sole_shareholder_declarations'] == []
    assert c['is_dissolved'] is False and c['is_in_concurso'] is False


def test_authority_detail_lists_dated_governing_body_seat_events():
    events = [
        _evt('Nombramientos', '2026-02-01',
             officers=[{'name': 'A', 'position_normalized': 'Administrador Unico', 'event_type': 'Nombramientos'}]),
        _evt('Ceses/Dimisiones', '2025-11-15',
             officers=[{'name': 'B', 'position_normalized': 'Consejero', 'event_type': 'Ceses/Dimisiones'}]),
        # a power of attorney is NOT a governing-body seat
        _evt('Nombramientos', '2026-03-01',
             officers=[{'name': 'C', 'position_normalized': 'Apoderado', 'event_type': 'Nombramientos'}]),
    ]
    s = dd_story.build_story(_data(events=events), [], 'en')
    auth = dd_story.layer(s, 'authority')
    seats = auth['detail'][0]['seat_events'] if auth['detail'] else []
    assert [(e['name'], e['kind'], e['date']) for e in seats] == [
        ('A', 'appointment', '2026-02-01'), ('B', 'cessation', '2025-11-15')]
    assert seats[0]['event_ref'] == {'date': '2026-02-01', 'entry': '2024-01', 'url': 'https://boe.es/x.pdf'}


def test_authority_detail_exists_even_with_no_active_officers():
    events = [_evt('Ceses/Dimisiones', '2025-11-15',
                   officers=[{'name': 'B', 'position_normalized': 'Consejero', 'event_type': 'Ceses/Dimisiones'}])]
    s = dd_story.build_story(_data(events=events), [], 'en')
    auth = dd_story.layer(s, 'authority')
    assert auth['detail'] and auth['detail'][0]['seat_events'][0]['kind'] == 'cessation'
    assert auth['weight'] == 0 and auth['confidence'] == 'absent'


def test_shape_detail_carries_dated_capital_history_and_event_refs():
    data = _data(events=[_evt('Fusión', '2023-05-05')],
                 company={'capital_history': [
                     {'amount': '3.000,00', 'date': '2010-01-01'},
                     {'amount': 'garbage', 'date': '2011-01-01'},
                     {'amount': '1.000,00', 'date': '2024-03-11'}]})
    s = dd_story.build_story(data, [], 'en')
    shape = dd_story.layer(s, 'shape')['detail'][0]
    assert shape['capital_history'] == [{'amount': 3000.0, 'date': '2010-01-01'},
                                        {'amount': 1000.0, 'date': '2024-03-11'}]
    assert shape['events'][0]['event_ref']['url'] == 'https://boe.es/x.pdf'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd ~/ncdata-bormes-impl && python -m pytest tests_story_findings_facts.py -q`
Expected: 5 failures — `KeyError: 'province'`, `KeyError: 'seat_events'` / empty `detail`, `KeyError: 'capital_history'`.

- [ ] **Step 3: Implement in `dd_story.py`**

Move `_fold` (currently ~line 245) up to sit right after `_date_of` (~line 160) so the helpers below can use it, then add:

```python
_APPOINT_RE = _re.compile(r'nombramiento', _re.I)
_CEASE_RE = _re.compile(r'cese|dimisi', _re.I)


def _event_ref(evt):
    """The BORME notice behind an event doc, or None when the doc has no url."""
    url = (evt or {}).get('pdf_url')
    if not url:
        return None
    return {'date': evt.get('event_date') or evt.get('date'),
            'entry': evt.get('borme_entry_number') or None, 'url': url}


def seat_events(events):
    """Dated governing-body seat changes from the event docs, newest first.

    Powers of attorney are excluded (they are not seats); re-elections and
    revocations are excluded (neither is a change of who governs)."""
    out = []
    for evt in (events or []):
        if not isinstance(evt, dict):
            continue
        date = str(evt.get('event_date') or evt.get('date') or '')[:10]
        if not date:
            continue
        for off in (evt.get('officers') or []):
            if not isinstance(off, dict):
                continue
            pos = _position_of(off)
            if not _ADMIN_RE.match(pos.strip()):
                continue
            et = _fold(off.get('event_type') or '')
            if _APPOINT_RE.search(et):
                kind = 'appointment'
            elif _CEASE_RE.search(et):
                kind = 'cessation'
            else:
                continue
            out.append({'date': date, 'name': _name_of(off), 'position': pos,
                        'kind': kind, 'event_ref': _event_ref(evt)})
    return sorted(out, key=lambda e: e['date'], reverse=True)
```

`_ADMIN_RE` is defined at ~line 131, above these — fine. Replace `_authority_layer`:

```python
def _authority_layer(data, registry, lang):
    q = LAYER_QUESTIONS[lang]['authority']
    company = (data or {}).get('company') or {}
    auth = classify_authority(company, lang)
    seats = seat_events((data or {}).get('events'))
    if not auth['answer'] and not seats:
        return make_layer('authority', q)
    weight = 1 if auth['answer'] else 0
    n_admin = max(len(auth['administrators']), 1)
    if len(auth['powers']) >= 10 and len(auth['powers']) >= 8 * n_admin:
        weight = 2
    return make_layer(
        'authority', q, answer=auth['answer'], weight=weight,
        confidence='registry' if auth['answer'] else 'absent',
        evidence=ids_of_kind(registry, 'G') + ids_of_kind(registry, 'O'),
        detail=[{'kind': 'authority_shape', 'organ': auth['organ'],
                 'administrators': auth['administrators'], 'powers': auth['powers'],
                 'administrator_dates': auth['administrator_dates'],
                 'power_dates': auth['power_dates'],
                 'superseded': company.get('superseded_seats') or [],
                 'seat_events': seats,
                 'sole_shareholder_name': ((company.get('sole_shareholder_individuals') or [None])[0]
                                           or (company.get('sole_shareholders') or [None])[0])}])
```

In `structural_events`, add the ref:

```python
            if any(k in _fold(t) for k in STRUCTURAL_EVENT_TYPES):
                out.append({'type': t,
                            'date': evt.get('date') or evt.get('event_date'),
                            'event_ref': _event_ref(evt)})
```

In `_shape_layer`, after the `amounts = [...]` lines:

```python
    capital_history = []
    for ch in (company.get('capital_history') or []):
        if not isinstance(ch, dict):
            continue
        amt = dd_signal_levels._parse_capital_amount(
            ch.get('amount', ch.get('capital', ch.get('current_capital'))))
        date = str(ch.get('date') or '')[:10]
        if amt is not None and date:
            capital_history.append({'amount': amt, 'date': date})
```

and in its `make_layer(...)` detail add `'capital_history': capital_history,` after `'capital': …`.

In `build_story`, replace the `'company'` block:

```python
        'company': {'name': company.get('company_name'),
                    'identifier': company.get('identifier'),
                    'group_key': company.get('group_key'),
                    'province': company.get('province') or None,
                    'last_seen': (str(company.get('last_seen') or '')[:10] or None),
                    'name_changes': [n for n in (company.get('name_changes') or []) if isinstance(n, dict)],
                    'sole_shareholder_declarations': [d for d in (company.get('sole_shareholder_declarations') or [])
                                                      if isinstance(d, dict)],
                    'is_dissolved': bool(company.get('is_dissolved')),
                    'is_in_concurso': bool(company.get('is_in_concurso'))},
```

- [ ] **Step 4: Run the new tests and the whole story suite**

Run: `cd ~/ncdata-bormes-impl && python -m pytest tests_story_findings_facts.py tests_story_*.py tests_readings_*.py tests_opening_*.py -q`
Expected: all pass. If a test in `tests_story_authority.py` asserts that a company with no active officers has an absent authority layer while its fixture has admin seat events, add `events=[]` to that fixture rather than weakening the rule — an event-only authority layer at weight 0 / confidence absent is the honest state.

- [ ] **Step 5: Commit**

```bash
cd ~/ncdata-bormes-impl && git add dd_story.py tests_story_findings_facts.py && git -c commit.gpgsign=false commit -m "feat(story): carry dated seat events, capital history and registry facts

The findings module consumes the story, never raw ES docs, so the dates it
renders must already live on a layer. Authority detail gains seat_events
(governing-body appointments/cessations with the BORME notice ref), shape
detail gains a dated capital_history, structural events carry their notice
ref, and the company block gains province, last_seen, name_changes,
sole_shareholder_declarations and the dissolved/concurso flags."
```

---

### Task 2: `dd_findings.py` — typed findings and the free projection

**Files:**
- Create: `~/ncdata-bormes-impl/dd_findings.py`
- Test: `~/ncdata-bormes-impl/tests_dd_findings.py`

**Interfaces:**
- Consumes: `story` as produced by Task 1 (`story['company']`, `dd_story.layer(story, key)['detail'][0]`, `story['gaps']`).
- Produces:
  - `build_findings(story: dict, today: datetime.date, lang: str) -> list[dict]` — each dict: `{kind, cls, text, date, layer, evidence: [{kind, ref}], borme_ref: dict|None, paid_only: bool}`.
  - `project_free(findings) -> {'findings': [...], 'more': int}` — drops `paid_only` findings, strips the `paid_only` key, keeps order, caps at `FREE_CAP = 5`.
  - `verification_lines(story, lang) -> list[str]` — the gap sentences (`what_is_missing`) in order.
  - `OFFICER_IDENTITY_FINDINGS = False` module constant.

- [ ] **Step 1: Write the failing tests**

```python
# ~/ncdata-bormes-impl/tests_dd_findings.py
"""dd_findings turns a CompanyStory into typed, dated findings.

Fixtures go through dd_story.build_story so the tests exercise the real
story shape, not a hand-typed imitation of it."""
import datetime

import dd_story
import dd_findings

TODAY = datetime.date(2026, 8, 24)


def _evt(type_, date, officers=None, url='https://boe.es/n.pdf', entry='E-1'):
    return {'event_date': date, 'event_types': [{'type': type_}],
            'officers': officers or [], 'pdf_url': url, 'borme_entry_number': entry}


def _admin(name, kind, date):
    et = 'Nombramientos' if kind == 'appointment' else 'Ceses/Dimisiones'
    return _evt(et, date, officers=[{'name': name, 'position_normalized': 'Consejero', 'event_type': et}])


def _story(events=None, company=None, lang='en'):
    base = {'company_name': 'X SL', 'capital_history': [], 'officers_active': []}
    base.update(company or {})
    return dd_story.build_story({'company': base, 'events': events or []}, [], lang)


def kinds(fs):
    return [f['kind'] for f in fs]


def test_quiet_company_yields_only_the_qualified_negative():
    fs = dd_findings.build_findings(_story(), TODAY, 'en')
    assert kinds(fs) == ['no_insolvency_notice']
    f = fs[0]
    assert f['cls'] == 'limitation' and f['date'] is None and f['layer'] == 'shape'
    assert f['text'] == ('No dissolution, liquidation or insolvency notice found in indexed '
                         'BORME publications since 2009. This is not a certificate of current status.')


def test_qualified_negative_spanish_is_verbatim():
    fs = dd_findings.build_findings(_story(lang='es'), TODAY, 'es')
    assert fs[0]['text'] == ('No consta ninguna inscripción de disolución, liquidación ni concurso en las '
                             'publicaciones del BORME indexadas desde 2009. No es un certificado de la situación actual.')


def test_dissolution_notice_is_a_concern_and_comes_first_and_suppresses_the_negative():
    fs = dd_findings.build_findings(_story(events=[
        _admin('A', 'appointment', '2026-05-01'),
        _evt('Disolución', '2024-02-02')]), TODAY, 'en')
    assert kinds(fs)[0] == 'insolvency_or_dissolution'
    assert 'no_insolvency_notice' not in kinds(fs)
    f = fs[0]
    assert f['cls'] == 'concern' and f['date'] == '2024-02-02'
    assert f['text'] == 'Disolución notice published on 2024-02-02'
    assert f['borme_ref'] == {'date': '2024-02-02', 'entry': 'E-1', 'url': 'https://boe.es/n.pdf'}
    assert f['evidence'] == [{'kind': 'event', 'ref': '2024-02-02:Disolución'}]


def test_governing_body_turnover_counts_seat_events_in_the_last_365_days():
    fs = dd_findings.build_findings(_story(events=[
        _admin('A', 'appointment', '2026-05-01'),
        _admin('B', 'cessation', '2026-01-15'),
        _admin('C', 'appointment', '2025-09-01'),
        _admin('D', 'cessation', '2024-01-01'),   # older than 365 days — ignored
    ]), TODAY, 'en')
    f = next(x for x in fs if x['kind'] == 'governing_body_turnover')
    assert f['text'] == '3 governing-body changes published in the last 12 months'
    assert f['cls'] == 'concern' and f['date'] == '2026-05-01'
    assert f['evidence'] == [{'kind': 'officer', 'ref': 'A'}, {'kind': 'officer', 'ref': 'B'},
                             {'kind': 'officer', 'ref': 'C'}]


def test_one_or_two_turnover_events_are_context_and_zero_is_omitted():
    fs = dd_findings.build_findings(_story(events=[_admin('A', 'appointment', '2026-05-01')]), TODAY, 'en')
    f = next(x for x in fs if x['kind'] == 'governing_body_turnover')
    assert f['cls'] == 'context' and f['text'] == '1 governing-body change published in the last 12 months'
    assert 'governing_body_turnover' not in kinds(dd_findings.build_findings(_story(), TODAY, 'en'))


def test_capital_reduction_is_a_concern_with_its_date_and_increase_is_context():
    fs = dd_findings.build_findings(_story(company={'capital_history': [
        {'amount': '3.000,00', 'date': '2010-01-01'},
        {'amount': '5.000,00', 'date': '2015-06-01'},
        {'amount': '1.000,00', 'date': '2024-03-11'}]}), TODAY, 'en')
    caps = [f for f in fs if f['kind'] == 'capital_movement']
    assert [(f['cls'], f['date'], f['text']) for f in caps] == [
        ('concern', '2024-03-11', 'Share capital reduced on 2024-03-11'),
        ('context', '2015-06-01', 'Share capital increased on 2015-06-01')]
    assert caps[0]['evidence'] == [{'kind': 'capital', 'ref': '2024-03-11'}]


def test_capital_movement_without_a_date_is_omitted_not_vague():
    fs = dd_findings.build_findings(_story(company={'capital_history': [
        {'amount': '3.000,00'}, {'amount': '1.000,00'}]}), TODAY, 'en')
    assert 'capital_movement' not in kinds(fs)


def test_sole_shareholder_declaration_is_context_with_verbatim_wording():
    fs = dd_findings.build_findings(_story(company={'sole_shareholder_declarations': [
        {'name': 'P', 'date': '2015-01-01', 'is_individual': False},
        {'name': 'Q', 'date': '2019-03-01', 'is_individual': False}]}), TODAY, 'en')
    f = next(x for x in fs if x['kind'] == 'sole_shareholder_declared')
    assert f['cls'] == 'context' and f['date'] == '2019-03-01' and f['layer'] == 'ownership'
    assert f['text'] == ('Sole-shareholder declaration published 2019-03-01; any later change '
                         'would appear as a new filing — none indexed.')
    assert f['evidence'] == [{'kind': 'ownership', 'ref': 'Q'}]


def test_previous_name_is_context_dated_by_the_change():
    fs = dd_findings.build_findings(_story(company={'name_changes': [
        {'old_name': 'OLD SL', 'new_name': 'X SL', 'date': '2020-01-10'}]}), TODAY, 'en')
    f = next(x for x in fs if x['kind'] == 'previous_name')
    assert f['text'] == 'Previously registered as OLD SL' and f['date'] == '2020-01-10'


def test_structural_events_newest_first_capped_at_two():
    fs = dd_findings.build_findings(_story(events=[
        _evt('Fusión', '2021-01-01'), _evt('Transformación de sociedad', '2023-01-01'),
        _evt('Cambio de denominación social', '2022-01-01')]), TODAY, 'en')
    se = [f for f in fs if f['kind'] == 'structural_event']
    assert [(f['date'], f['text']) for f in se] == [
        ('2023-01-01', 'Transformación de sociedad published on 2023-01-01'),
        ('2022-01-01', 'Cambio de denominación social published on 2022-01-01')]


def test_ordering_insolvency_then_concerns_then_context_then_limitations():
    fs = dd_findings.build_findings(_story(
        events=[_admin(n, 'appointment', d) for n, d in
                [('A', '2026-05-01'), ('B', '2026-04-01'), ('C', '2026-03-01')]]
               + [_evt('Concurso de acreedores', '2020-01-01'), _evt('Fusión', '2025-01-01')],
        company={'name_changes': [{'old_name': 'OLD', 'new_name': 'X SL', 'date': '2019-01-01'}]},
    ), TODAY, 'en')
    assert kinds(fs) == ['insolvency_or_dissolution', 'governing_body_turnover',
                         'structural_event', 'previous_name']


def test_power_density_is_paid_only_and_stripped_by_project_free():
    active = [{'name': f'P{i}', 'position_normalized': 'Apoderado', 'appointed_date': '2020-01-01'}
              for i in range(12)] + [{'name': 'A', 'position_normalized': 'Administrador Unico',
                                      'appointed_date': '2020-01-01'}]
    fs = dd_findings.build_findings(_story(company={'officers_active': active}), TODAY, 'en')
    pd = next(x for x in fs if x['kind'] == 'power_density')
    assert pd['paid_only'] is True
    free = dd_findings.project_free(fs)
    assert 'power_density' not in [f['kind'] for f in free['findings']]
    assert all('paid_only' not in f for f in free['findings'])


def test_project_free_caps_at_five_and_reports_the_rest():
    fs = dd_findings.build_findings(_story(
        events=[_evt('Fusión', '2025-01-01'), _evt('Escisión', '2024-01-01'), _admin('A', 'appointment', '2026-05-01')],
        company={'name_changes': [{'old_name': 'OLD', 'new_name': 'X SL', 'date': '2019-01-01'}],
                 'sole_shareholder_declarations': [{'name': 'Q', 'date': '2019-03-01', 'is_individual': False}],
                 'capital_history': [{'amount': '3.000', 'date': '2010-01-01'}, {'amount': '1.000', 'date': '2024-03-11'}]},
    ), TODAY, 'en')
    assert len(fs) >= 6
    free = dd_findings.project_free(fs)
    assert len(free['findings']) == 5 and free['more'] == len(fs) - 5


def test_officer_elsewhere_is_gated_off():
    assert dd_findings.OFFICER_IDENTITY_FINDINGS is False
    assert 'officer_elsewhere' not in kinds(dd_findings.build_findings(_story(), TODAY, 'en'))


def test_verification_lines_are_the_gap_sentences():
    story = _story()
    story['gaps'] = [{'what_is_missing': 'Gap one.', 'document_that_closes_it': 'D', 'why_it_matters': 'W'}]
    assert dd_findings.verification_lines(story, 'en') == ['Gap one.']
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd ~/ncdata-bormes-impl && python -m pytest tests_dd_findings.py -q`
Expected: `ModuleNotFoundError: No module named 'dd_findings'`.

- [ ] **Step 3: Implement `dd_findings.py`**

```python
"""Findings — the dated, typed one-liners a reader sees before the graph.

Consumes a CompanyStory (dd_story.build_story), never raw ES documents, so
the inspector's free block and the paid report cannot disagree: both read
this module. Pure: no HTTP, no ES, `today` is injected.

Each finding has a class decided by its KIND, never by a renderer:
  concern    — a dated registry fact a careful reader wants explained
  context    — a dated registry fact with no default reading
  limitation — something indexed BORME publications cannot show
"""
import datetime
import re as _re

import dd_story

FREE_CAP = 5
TURNOVER_WINDOW_DAYS = 365
TURNOVER_CONCERN_AT = 3
STRUCTURAL_MAX = 2
POWER_DENSITY_MIN = 10
POWER_DENSITY_RATIO = 8

# Gate for the cross-company "same officer name elsewhere" finding. Off until
# the officer name-order fix is deployed; before that the count is
# order-sensitive and would be wrong. The kind is documented in the spec and
# intentionally has no generator while this is False.
OFFICER_IDENTITY_FINDINGS = False

_INSOLVENCY_RE = _re.compile(r'disoluci|liquidaci|concurso', _re.I)
_GROUP = {'concern': 1, 'context': 2, 'limitation': 3}

COPY = {
    'en': {
        'no_insolvency_notice': ('No dissolution, liquidation or insolvency notice found in indexed '
                                 'BORME publications since 2009. This is not a certificate of current status.'),
        'insolvency': '{type} notice published on {date}',
        'structural': '{type} published on {date}',
        'turnover': '{n} governing-body change{s} published in the last 12 months',
        'capital_reduced': 'Share capital reduced on {date}',
        'capital_increased': 'Share capital increased on {date}',
        'sole_declared': ('Sole-shareholder declaration published {date}; any later change '
                          'would appear as a new filing — none indexed.'),
        'previous_name': 'Previously registered as {names}',
        'superseded_succession': '{n} seat{s} superseded by a later appointment to the same role',
        'superseded_reinscription': '{n} seat{s} re-inscribed under a later filing',
        'power_density': '{n} powers of attorney on record against {a} governing-body seat{as_}',
    },
    'es': {
        'no_insolvency_notice': ('No consta ninguna inscripción de disolución, liquidación ni concurso en las '
                                 'publicaciones del BORME indexadas desde 2009. No es un certificado de la situación actual.'),
        'insolvency': 'Inscripción de {type} publicada el {date}',
        'structural': '{type} publicada el {date}',
        'turnover': '{n} cambio{s} en el órgano de administración publicado{s} en los últimos 12 meses',
        'capital_reduced': 'Reducción de capital social el {date}',
        'capital_increased': 'Ampliación de capital social el {date}',
        'sole_declared': ('Declaración de socio único publicada el {date}; cualquier cambio posterior '
                          'constaría como nueva inscripción — ninguna indexada.'),
        'previous_name': 'Inscrita anteriormente como {names}',
        'superseded_succession': '{n} cargo{s} sustituido{s} por un nombramiento posterior en el mismo puesto',
        'superseded_reinscription': '{n} cargo{s} reinscrito{s} en una inscripción posterior',
        'power_density': '{n} apoderamientos vigentes frente a {a} cargo{as_} de administración',
    },
}


def _t(lang, key, **kw):
    return COPY[lang if lang in COPY else 'es'][key].format(**kw)


def _s(n):
    return '' if n == 1 else 's'


def _finding(kind, cls, text, date, layer, evidence=None, borme_ref=None, paid_only=False):
    return {'kind': kind, 'cls': cls, 'text': text, 'date': date, 'layer': layer,
            'evidence': list(evidence or []), 'borme_ref': borme_ref, 'paid_only': paid_only}


def _detail(story, key):
    layer = dd_story.layer(story, key) or {}
    detail = layer.get('detail') or []
    return detail[0] if detail and isinstance(detail[0], dict) else {}


def _date(value):
    v = str(value or '')[:10]
    return v if len(v) == 10 else None


def _shape_findings(story, lang):
    shape = _detail(story, 'shape')
    events = sorted([e for e in (shape.get('events') or []) if _date(e.get('date'))],
                    key=lambda e: _date(e['date']), reverse=True)
    out = []
    insolvency = [e for e in events if _INSOLVENCY_RE.search(e.get('type') or '')]
    for e in insolvency[:1]:
        out.append(_finding('insolvency_or_dissolution', 'concern',
                            _t(lang, 'insolvency', type=e['type'], date=_date(e['date'])),
                            _date(e['date']), 'shape',
                            evidence=[{'kind': 'event', 'ref': f"{_date(e['date'])}:{e['type']}"}],
                            borme_ref=e.get('event_ref')))
    if not insolvency:
        out.append(_finding('no_insolvency_notice', 'limitation',
                            _t(lang, 'no_insolvency_notice'), None, 'shape'))
    structural = [e for e in events if not _INSOLVENCY_RE.search(e.get('type') or '')]
    for e in structural[:STRUCTURAL_MAX]:
        out.append(_finding('structural_event', 'concern',
                            _t(lang, 'structural', type=e['type'], date=_date(e['date'])),
                            _date(e['date']), 'shape',
                            evidence=[{'kind': 'event', 'ref': f"{_date(e['date'])}:{e['type']}"}],
                            borme_ref=e.get('event_ref')))
    history = [h for h in (shape.get('capital_history') or []) if _date(h.get('date'))]
    for prev, cur in zip(history, history[1:]):
        if cur['amount'] == prev['amount']:
            continue
        reduced = cur['amount'] < prev['amount']
        out.append(_finding('capital_movement', 'concern' if reduced else 'context',
                            _t(lang, 'capital_reduced' if reduced else 'capital_increased', date=cur['date']),
                            cur['date'], 'shape', evidence=[{'kind': 'capital', 'ref': cur['date']}]))
    return out


def _authority_findings(story, today, lang):
    auth = _detail(story, 'authority')
    out = []
    cutoff = (today - datetime.timedelta(days=TURNOVER_WINDOW_DAYS)).isoformat()
    recent = [e for e in (auth.get('seat_events') or []) if _date(e.get('date')) and e['date'] >= cutoff]
    if recent:
        n = len(recent)
        out.append(_finding('governing_body_turnover',
                            'concern' if n >= TURNOVER_CONCERN_AT else 'context',
                            _t(lang, 'turnover', n=n, s=_s(n)), recent[0]['date'], 'authority',
                            evidence=[{'kind': 'officer', 'ref': e['name']} for e in recent],
                            borme_ref=recent[0].get('event_ref')))
    superseded = [s for s in (auth.get('superseded') or []) if isinstance(s, dict)]
    if superseded:
        kinds = {s.get('supersession_kind') for s in superseded}
        key = 'superseded_reinscription' if kinds == {'re_inscription'} else 'superseded_succession'
        n = len(superseded)
        latest = max((_date(s.get('superseded_on') or s.get('date')) or '' for s in superseded), default='') or None
        out.append(_finding('superseded_seats', 'context', _t(lang, key, n=n, s=_s(n)), latest, 'authority',
                            evidence=[{'kind': 'officer', 'ref': s.get('name') or s.get('officer_name') or ''}
                                      for s in superseded]))
    powers, admins = auth.get('powers') or [], auth.get('administrators') or []
    a = max(len(admins), 1)
    if len(powers) >= POWER_DENSITY_MIN and len(powers) >= POWER_DENSITY_RATIO * a:
        out.append(_finding('power_density', 'context',
                            _t(lang, 'power_density', n=len(powers), a=len(admins), as_=_s(len(admins))),
                            None, 'authority', evidence=[{'kind': 'officer', 'ref': p} for p in powers[:5]],
                            paid_only=True))
    return out


def _company_findings(story, lang):
    company = story.get('company') or {}
    out = []
    decls = [d for d in (company.get('sole_shareholder_declarations') or []) if _date(d.get('date'))]
    if decls:
        last = max(decls, key=lambda d: _date(d['date']))
        out.append(_finding('sole_shareholder_declared', 'context',
                            _t(lang, 'sole_declared', date=_date(last['date'])), _date(last['date']),
                            'ownership', evidence=[{'kind': 'ownership', 'ref': last.get('name') or ''}]))
    changes = [c for c in (company.get('name_changes') or []) if c.get('old_name')]
    if changes:
        names = ', '.join(dict.fromkeys(c['old_name'] for c in changes))
        latest = max((_date(c.get('date')) or '' for c in changes), default='') or None
        out.append(_finding('previous_name', 'context', _t(lang, 'previous_name', names=names),
                            latest, 'identity', evidence=[{'kind': 'event', 'ref': f"{latest}:name_change"}]))
    return out


def build_findings(story, today, lang='es'):
    """All findings for a story, ordered: insolvency first, then concerns by
    date desc, then context by date desc, then limitations. Never raises on
    a partial story — a missing layer simply contributes nothing."""
    lang = lang if lang in COPY else 'es'
    story = story or {}
    findings = (_shape_findings(story, lang) + _authority_findings(story, today, lang)
                + _company_findings(story, lang))
    by_date = sorted(findings, key=lambda f: f['date'] or '', reverse=True)   # newest first
    return sorted(by_date, key=lambda f: 0 if f['kind'] == 'insolvency_or_dissolution' else _GROUP[f['cls']])


def project_free(findings):
    """The free tier: no paid-only kinds, capped, and the `paid_only` marker
    itself removed from what leaves the server."""
    visible = [{k: v for k, v in f.items() if k != 'paid_only'}
               for f in (findings or []) if not f.get('paid_only')]
    return {'findings': visible[:FREE_CAP], 'more': max(0, len(visible) - FREE_CAP)}


def verification_lines(story, lang='es'):
    """The spine's gaps as plain sentences — derived from the layers, so they
    cannot disagree with the findings."""
    return [g.get('what_is_missing') for g in ((story or {}).get('gaps') or [])
            if isinstance(g, dict) and g.get('what_is_missing')]
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd ~/ncdata-bormes-impl && python -m pytest tests_dd_findings.py -q`
Expected: 15 pass. Python's sort is stable, so the two-pass sort yields "by group, then newest first" exactly as the ordering test expects.

- [ ] **Step 5: Commit**

```bash
cd ~/ncdata-bormes-impl && git add dd_findings.py tests_dd_findings.py && git -c commit.gpgsign=false commit -m "feat(findings): typed, dated findings from the story spine + free projection

One generator for the inspector's free block and (later) the report: every
finding has a class decided by its kind — concern / context / limitation —
a date, evidence refs and, when an event backs it, the BORME notice ref.
The two honesty sentences (no insolvency notice; sole-shareholder
declaration) are verbatim per the spec in both languages. project_free
strips paid-only kinds and caps at five."
```

---

### Task 3: The endpoint, injectable and cached

**Files:**
- Create: `~/ncdata-bormes-impl/dd_findings_api.py`
- Test: `~/ncdata-bormes-impl/tests_dd_findings_api.py`

**Interfaces:**
- Consumes: Task 2 (`build_findings`, `project_free`, `verification_lines`), `dd_story.build_story`, and — imported lazily inside functions so tests never load reportlab — from `borme_dd_report`: `assemble_company_data(company_name, es)`, `_resolve_v3_company(es, name)`, `classify_ownership_visibility(data, lang)`, `V3_COMPANIES_INDEX`.
- Produces: `register_findings_routes(app, es, *, assemble=None, get_doc=None, today=None, cache=None)` registering `GET/OPTIONS /bormes/v3/company-findings`. Response per spec §Endpoint.

- [ ] **Step 1: Write the failing tests**

```python
# ~/ncdata-bormes-impl/tests_dd_findings_api.py
"""GET /bormes/v3/company-findings — the free projection over the story spine.

The assembler and the doc lookup are injected so the route is tested with a
plain Flask app and no Elasticsearch."""
import datetime

from flask import Flask

import dd_findings_api

TODAY = datetime.date(2026, 8, 24)

DOC = {'company_name': 'X SL', 'company_name_normalized': 'X SL', 'province': 'Madrid',
       'last_seen': '2026-06-12', 'enriched_nif': 'B12345678', 'name_changes': [],
       'sole_shareholder_declarations': [], 'is_dissolved': False, 'is_in_concurso': False,
       'capital_history': [], 'officers_active': [], 'hojas': ['M-1']}


def _app(get_doc=None, assemble=None, cache=None):
    app = Flask(__name__)
    calls = {'assemble': 0}

    def _get_doc(es, group_key=None, name=None):
        if group_key == 'H:M-1' or name == 'X SL':
            return dict(DOC, group_key='H:M-1')
        return None

    def _assemble(company_name, es):
        calls['assemble'] += 1
        return {'company': dict(DOC), 'events': [
            {'event_date': '2026-06-12', 'event_types': [{'type': 'Nombramientos'}],
             'officers': [{'name': 'A', 'position_normalized': 'Consejero', 'event_type': 'Nombramientos'}],
             'pdf_url': 'https://boe.es/n.pdf', 'borme_entry_number': 'E-9'}]}

    dd_findings_api.register_findings_routes(
        app, es=None, get_doc=get_doc or _get_doc, assemble=assemble or _assemble,
        today=lambda: TODAY, cache=cache if cache is not None else {})
    return app.test_client(), calls


def test_by_group_key_returns_header_findings_verification_and_coverage():
    c, _ = _app()
    r = c.get('/bormes/v3/company-findings?group_key=H:M-1&lang=en')
    assert r.status_code == 200
    body = r.get_json()
    assert body['tier'] == 'free' and body['lang'] == 'en'
    assert body['company'] == {'name': 'X SL', 'group_key': 'H:M-1', 'nif': 'B12345678',
                               'province': 'Madrid', 'registry': 'M-1', 'previous_names': [],
                               'last_filing': {'date': '2026-06-12', 'type': 'Nombramientos'}}
    assert [f['kind'] for f in body['findings']] == ['governing_body_turnover', 'no_insolvency_notice']
    assert body['findings'][0]['borme_ref']['url'] == 'https://boe.es/n.pdf'
    assert all('paid_only' not in f for f in body['findings'])
    assert body['more'] == 0
    assert isinstance(body['verification'], list)
    assert body['coverage'] == {'since': '2009', 'indexed_through': '2026-06-12'}
    assert r.headers.get('Access-Control-Allow-Origin')


def test_by_name_fallback_and_default_language_is_spanish():
    c, _ = _app()
    r = c.get('/bormes/v3/company-findings?name=X%20SL')
    assert r.status_code == 200 and r.get_json()['lang'] == 'es'


def test_unknown_company_is_404_not_empty_200():
    c, _ = _app()
    r = c.get('/bormes/v3/company-findings?group_key=NOPE&lang=en')
    assert r.status_code == 404 and r.get_json() == {'error': 'not_found'}


def test_missing_params_is_400():
    c, _ = _app()
    assert c.get('/bormes/v3/company-findings').status_code == 400


def test_assembler_failure_is_502_never_an_empty_list():
    def boom(company_name, es):
        raise RuntimeError('es down')
    c, _ = _app(assemble=boom)
    r = c.get('/bormes/v3/company-findings?group_key=H:M-1&lang=en')
    assert r.status_code == 502 and r.get_json()['error'] == 'assembly_failed'


def test_cache_hits_on_same_key_and_misses_when_language_changes():
    cache = {}
    c, calls = _app(cache=cache)
    c.get('/bormes/v3/company-findings?group_key=H:M-1&lang=en')
    c.get('/bormes/v3/company-findings?group_key=H:M-1&lang=en')
    assert calls['assemble'] == 1
    c.get('/bormes/v3/company-findings?group_key=H:M-1&lang=es')
    assert calls['assemble'] == 2
    key = next(k for k in cache if k[0] == 'H:M-1' and k[1] == 'en')
    assert key[2] == '2026-06-12'  # last_seen is part of the key: a new filing invalidates


def test_options_preflight_is_allowed():
    c, _ = _app()
    assert c.open('/bormes/v3/company-findings', method='OPTIONS').status_code == 200
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd ~/ncdata-bormes-impl && python -m pytest tests_dd_findings_api.py -q`
Expected: `ModuleNotFoundError: No module named 'dd_findings_api'`.

- [ ] **Step 3: Implement `dd_findings_api.py`**

```python
"""GET /bormes/v3/company-findings — the inspector's free findings block.

Same engine as the paid report: assemble_company_data → dd_story.build_story
→ dd_findings.build_findings, projected to the free tier. The assembler and
the doc lookup are injectable so the route runs under a plain Flask app in
tests; production wiring passes nothing and gets the real ones.
"""
import datetime
import logging
import time

from flask import jsonify, request

import dd_findings
import dd_story

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 24 * 3600
COVERAGE_SINCE = '2009'


def _cors(payload, status=200):
    resp = jsonify(payload)
    resp.status_code = status
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    return resp


def _default_get_doc(es, group_key=None, name=None):
    from borme_dd_report import V3_COMPANIES_INDEX, _resolve_v3_company
    if group_key:
        result = es.get(index=V3_COMPANIES_INDEX, id=group_key, ignore=404)
        if not result or not result.get('found'):
            return None
        return dict(result['_source'], group_key=result['_id'])
    hit, _resolved_name, _norm = _resolve_v3_company(es, name)
    if not hit:
        return None
    return dict(hit, group_key=hit.get('group_key'))


def _default_assemble(company_name, es):
    from borme_dd_report import assemble_company_data
    return assemble_company_data(company_name, es)


def _ownership(data, lang):
    try:
        from borme_dd_report import classify_ownership_visibility
        return classify_ownership_visibility(data, lang)
    except Exception:  # test envs without reportlab; the ownership layer is then absent
        logger.exception('findings: ownership classification unavailable')
        return None


def _last_filing(events):
    dated = [e for e in (events or []) if isinstance(e, dict) and (e.get('event_date') or e.get('date'))]
    if not dated:
        return None
    last = max(dated, key=lambda e: str(e.get('event_date') or e.get('date')))
    types = last.get('event_types') or []
    first = types[0].get('type') if types and isinstance(types[0], dict) else (types[0] if types else None)
    return {'date': str(last.get('event_date') or last.get('date'))[:10], 'type': first}


def _header(doc, story, data):
    company = story.get('company') or {}
    hojas = doc.get('hojas') or []
    return {
        'name': company.get('name') or doc.get('company_name'),
        'group_key': doc.get('group_key'),
        'nif': doc.get('enriched_nif') or doc.get('identifier')
               or next(iter(doc.get('identifiers') or []), None),
        'province': doc.get('province') or None,
        'registry': hojas[-1] if hojas else None,
        'previous_names': [c.get('old_name') for c in (doc.get('name_changes') or []) if c.get('old_name')],
        'last_filing': _last_filing(data.get('events')) or (
            {'date': str(doc.get('last_seen'))[:10], 'type': None} if doc.get('last_seen') else None),
    }


def register_findings_routes(app, es, *, assemble=None, get_doc=None, today=None, cache=None):
    assemble = assemble or _default_assemble
    get_doc = get_doc or _default_get_doc
    today = today or datetime.date.today
    cache = cache if cache is not None else {}

    @app.route('/bormes/v3/company-findings', methods=['GET', 'OPTIONS'])
    def v3_company_findings():
        if request.method == 'OPTIONS':
            return _cors({})
        group_key = (request.args.get('group_key') or '').strip()
        name = (request.args.get('name') or '').strip()
        lang = 'en' if request.args.get('lang', 'es').lower() == 'en' else 'es'
        if not group_key and len(name) < 3:
            return _cors({'error': 'group_key or name (min 3 chars) required'}, 400)

        doc = get_doc(es, group_key=group_key or None, name=name or None)
        if not doc:
            return _cors({'error': 'not_found'}, 404)

        key = (doc.get('group_key') or doc.get('company_name'), lang, str(doc.get('last_seen') or '')[:10])
        hit = cache.get(key)
        if hit and hit[0] > time.time():
            return _cors(hit[1])

        try:
            data = assemble(doc.get('company_name'), es)
        except Exception as exc:
            logger.exception('findings: assembly failed for %s', doc.get('company_name'))
            return _cors({'error': 'assembly_failed', 'detail': str(exc)[:200]}, 502)

        # The assembler re-resolves by name; if it landed on a different doc
        # (live + dissolved namesake), the group_key doc's facts win for the
        # header and the company-level findings. Assembler-computed fields
        # (superseded_seats, etc.) are kept.
        company = data.get('company') or {}
        if doc.get('company_name_normalized') and company.get('company_name_normalized') \
                and doc['company_name_normalized'] != company['company_name_normalized']:
            logger.warning('findings: assembler resolved %r, requested %r — using requested doc facts',
                           company.get('company_name'), doc.get('company_name'))
        data['company'] = {**company, **doc, 'group_key': doc.get('group_key'),
                           'superseded_seats': company.get('superseded_seats') or []}

        story = dd_story.build_story(data, [], lang, ownership=_ownership(data, lang))
        findings = dd_findings.build_findings(story, today(), lang)
        free = dd_findings.project_free(findings)
        payload = {
            'company': _header(doc, story, data),
            'findings': free['findings'],
            'more': free['more'],
            'verification': dd_findings.verification_lines(story, lang),
            'coverage': {'since': COVERAGE_SINCE,
                         'indexed_through': str(doc.get('last_seen') or '')[:10] or None},
            'generated_at': datetime.datetime.utcnow().isoformat() + 'Z',
            'lang': lang,
            'tier': 'free',
        }
        cache[key] = (time.time() + CACHE_TTL_SECONDS, payload)
        return _cors(payload)

    return v3_company_findings
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd ~/ncdata-bormes-impl && python -m pytest tests_dd_findings_api.py tests_dd_findings.py -q`
Expected: 22 pass. In the test env `_ownership` may log an exception (no reportlab) and return None — the tests do not assert on the ownership layer.

- [ ] **Step 5: Commit**

```bash
cd ~/ncdata-bormes-impl && git add dd_findings_api.py tests_dd_findings_api.py && git -c commit.gpgsign=false commit -m "feat(api): GET /bormes/v3/company-findings — free projection of the story spine

Resolves the company by group_key (the companies_v3 _id) or by name through
the report's own resolver, runs the report's assembler and spine, and
returns the header, the free findings, the gap sentences and coverage.
24h in-process cache keyed on (group_key, lang, last_seen) so a new filing
invalidates it. Unknown company is 404 and an assembler failure is 502 —
never a 200 with an empty list, which would read as 'nothing to report'."
```

---

### Task 4: Wire, deploy, verify live through the proxy

**Files:**
- Modify: `~/ncdata-bormes-impl/borme_search_api.py` (~line 50 import; ~line 414 next to `register_dd_report_routes(app, es)`)

**Interfaces:**
- Consumes: Task 3 `register_findings_routes`.
- Produces: live `https://api.ncdata.eu/bormes/v3/company-findings` for Task 6.

- [ ] **Step 1: Register the routes**

After `from borme_dd_report import register_dd_report_routes` (line 50):

```python
from dd_findings_api import register_findings_routes
```

Directly after `register_dd_report_routes(app, es)` (~line 414), same indentation:

```python
    register_findings_routes(app, es)
```

- [ ] **Step 2: Import-check and run the CI-visible suite**

Run: `cd ~/ncdata-bormes-impl && python -c "import dd_findings_api, dd_findings, dd_story; print('ok')" && python -m pytest tests_*.py -q 2>&1 | tail -3`
Expected: `ok`; suite = previous count + 27 new tests; the pre-existing known failures (unimplemented boe spec, defusedxml — see memory `project_test_infra_triage`) unchanged; no new failures.

- [ ] **Step 3: Commit and push `main`**

```bash
cd ~/ncdata-bormes-impl && git add borme_search_api.py && git -c commit.gpgsign=false commit -m "feat(api): register the company-findings route" && git push origin main
```

CI fast-forwards `server-current` and restarts the service (~3 min; `gh run watch` in that repo if needed).

- [ ] **Step 4: Verify live — proxy passes the new path with no Worker change**

```bash
curl -s -H 'Origin: https://mapasocietario.es' 'https://api.ncdata.eu/bormes/v3/company-findings?name=INDITEX%2C%20SA&lang=en' | python3 -m json.tool | head -40
curl -s -o /dev/null -w '%{http_code}\n' 'https://api.ncdata.eu/bormes/v3/company-findings?group_key=NOPE'
curl -s -o /dev/null -w 'warm %{time_total}s\n' 'https://api.ncdata.eu/bormes/v3/company-findings?name=INDITEX%2C%20SA&lang=en'
```
Expected: JSON with `tier: free`, a `company.name`, `findings[]`, an `access-control-allow-origin` header; `404` for the bogus key; the warm call well under 0.5 s. Note the first (cold) call's time: the spec budget is p95 < 1.5 s and this number decides whether the lighter-assembler follow-up is needed.

If the response is the working-search JSON instead of findings, the proxy fell through: add `else if (pathname === '/bormes/v3/company-findings') { targetPath = pathname; }` to the dispatch in `handleSpanishCompaniesRequest` (`~/standalone_rag/local-rag/workers/api-proxy/src/index.js` ~line 610) and `pathname === '/bormes/v3/company-findings' ||` to the allowlist (~line 1918), then `cd ~/standalone_rag/local-rag/workers/api-proxy/src && npx wrangler deploy`, commit in local-rag, and recheck.

- [ ] **Step 5: Record the numbers**

Append one line under the 2026-08-24 entry in `~/.claude/projects/-Users-alessandronurnberg-mapasocietario/memory/project_conversion_focus.md`: cold/warm latency for INDITEX and one small SL, and whether the proxy needed a change.

---

### Task 5: `findingsView.js` — the pure display mapping (frontend)

**Files:**
- Create: `src/utils/findingsView.js`
- Test: `src/utils/findingsView.test.js`

**Interfaces:**
- Consumes: the endpoint payload from Task 3.
- Produces:
  - `FINDINGS_COPY = { en: {...}, es: {...} }`
  - `findingsView(payload, lang) -> { header: {title, nifLabel, nifMissing, province}, changed: string|null, findings: [{key, text, date, tone, evidence: {kind, ref}|null, bormeUrl}], verification: string[], offer: {title, body, more: string|null}, moreCount: number, labels: {standsOut, verification, evidence, borme, nifTellUs, loading} }`
  - `findingsErrorView(lang) -> { text }`
  - `findingsVisibleParams(view) -> { count, concerns, limitations, more }`

- [ ] **Step 1: Write the failing tests**

```javascript
// src/utils/findingsView.test.js
import { describe, it, expect } from 'vitest';
import { findingsView, findingsErrorView, findingsVisibleParams } from './findingsView';

const payload = {
  company: { name: 'INDITEX, SA', group_key: 'H:C-1', nif: 'A15075062', province: 'A Coruña',
             registry: 'C-1', previous_names: [], last_filing: { date: '2026-06-12', type: 'Nombramientos' } },
  findings: [
    { kind: 'governing_body_turnover', cls: 'concern', text: '3 governing-body changes published in the last 12 months',
      date: '2026-05-01', layer: 'authority', evidence: [{ kind: 'officer', ref: 'A' }],
      borme_ref: { date: '2026-05-01', entry: 'E-1', url: 'https://boe.es/n.pdf' } },
    { kind: 'no_insolvency_notice', cls: 'limitation', text: 'No dissolution … status.', date: null,
      layer: 'shape', evidence: [], borme_ref: null },
  ],
  more: 2,
  verification: ['The shareholder composition is not published by Spanish law.'],
  coverage: { since: '2009', indexed_through: '2026-06-12' },
  lang: 'en', tier: 'free',
};

describe('findingsView', () => {
  it('builds the identity header with NIF and province', () => {
    expect(findingsView(payload, 'en').header)
      .toEqual({ title: 'INDITEX, SA', nifLabel: 'NIF A15075062', nifMissing: false, province: 'A Coruña' });
  });

  it('never leaves an empty NIF slot', () => {
    const v = findingsView({ ...payload, company: { ...payload.company, nif: null, province: null } }, 'en');
    expect(v.header.nifLabel).toBe('NIF not published in BORME');
    expect(v.header.nifMissing).toBe(true);
    expect(v.header.province).toBeNull();
  });

  it('states the latest filing, and omits the line when unknown', () => {
    expect(findingsView(payload, 'en').changed).toBe('Latest BORME filing: 2026-06-12 — Nombramientos');
    expect(findingsView({ ...payload, company: { ...payload.company, last_filing: null } }, 'en').changed).toBeNull();
  });

  it('maps findings to tone, evidence target and BORME url in payload order', () => {
    const v = findingsView(payload, 'en');
    expect(v.findings.map(f => [f.tone, f.date, f.evidence, f.bormeUrl])).toEqual([
      ['concern', '2026-05-01', { kind: 'officer', ref: 'A' }, 'https://boe.es/n.pdf'],
      ['limitation', null, null, null],
    ]);
    expect(v.findings[0].key).toBe('governing_body_turnover:2026-05-01');
  });

  it('names what paid adds and how many more findings the report holds', () => {
    const v = findingsView(payload, 'en');
    expect(v.offer.title).toBe('Get the complete sourced assessment');
    expect(v.offer.more).toBe('and 2 more findings in the report');
    expect(v.moreCount).toBe(2);
    expect(findingsView({ ...payload, more: 0 }, 'en').offer.more).toBeNull();
    expect(findingsView({ ...payload, more: 1 }, 'es').offer.more).toBe('y 1 hallazgo más en el informe');
  });

  it('passes verification lines through', () => {
    expect(findingsView(payload, 'en').verification).toEqual(payload.verification);
  });

  it('speaks Spanish when asked', () => {
    const v = findingsView(payload, 'es');
    expect(v.changed).toBe('Última inscripción en el BORME: 2026-06-12 — Nombramientos');
    expect(v.labels.standsOut).toBe('Lo que destaca');
  });

  it('has an honest error line', () => {
    expect(findingsErrorView('en').text).toBe('Findings unavailable right now — the table below is unaffected.');
    expect(findingsErrorView('es').text).toBe('Los hallazgos no están disponibles ahora mismo — la tabla de abajo no se ve afectada.');
  });

  it('summarises the block for the findings_visible event', () => {
    expect(findingsVisibleParams(findingsView(payload, 'en'))).toEqual({ count: 2, concerns: 1, limitations: 1, more: 2 });
  });

  it('tolerates an empty payload', () => {
    const v = findingsView({}, 'en');
    expect(v.findings).toEqual([]);
    expect(v.header.nifMissing).toBe(true);
    expect(v.changed).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/utils/findingsView.test.js`
Expected: fails to load `./findingsView`.

- [ ] **Step 3: Implement `src/utils/findingsView.js`**

```javascript
// Pure display mapping for the company findings block. The component that
// renders it (CompanyFindings.jsx) holds no strings: everything a user reads
// is either in the API payload (finding texts, gap sentences — written once,
// server-side, shared with the paid report) or in FINDINGS_COPY here.

export const FINDINGS_COPY = {
  en: {
    nif: nif => `NIF ${nif}`,
    nifMissing: 'NIF not published in BORME',
    nifTellUs: 'know it? tell us',
    changed: (date, type) => `Latest BORME filing: ${date}${type ? ` — ${type}` : ''}`,
    standsOut: 'What stands out',
    verification: 'Needs verification',
    evidence: 'Show in table',
    borme: 'BORME notice',
    offerTitle: 'Get the complete sourced assessment',
    offerBody: 'Every finding with its BORME evidence, sanctions and adverse-media screening, risk interpretation and a PDF.',
    more: n => `and ${n} more finding${n === 1 ? '' : 's'} in the report`,
    unavailable: 'Findings unavailable right now — the table below is unaffected.',
    loading: 'Reading the registry…',
  },
  es: {
    nif: nif => `NIF ${nif}`,
    nifMissing: 'NIF no publicado en el BORME',
    nifTellUs: '¿lo conoces? dínoslo',
    changed: (date, type) => `Última inscripción en el BORME: ${date}${type ? ` — ${type}` : ''}`,
    standsOut: 'Lo que destaca',
    verification: 'Pendiente de verificar',
    evidence: 'Ver en la tabla',
    borme: 'Anuncio BORME',
    offerTitle: 'Consigue la evaluación completa con fuentes',
    offerBody: 'Cada hallazgo con su evidencia del BORME, cribado de sanciones y prensa adversa, lectura de riesgo y PDF.',
    more: n => `y ${n} hallazgo${n === 1 ? '' : 's'} más en el informe`,
    unavailable: 'Los hallazgos no están disponibles ahora mismo — la tabla de abajo no se ve afectada.',
    loading: 'Leyendo el registro…',
  },
};

const copyFor = lang => FINDINGS_COPY[lang === 'en' ? 'en' : 'es'];

export function findingsView(payload, lang) {
  const copy = copyFor(lang);
  const company = payload?.company || {};
  const lastFiling = company.last_filing;
  const findings = (Array.isArray(payload?.findings) ? payload.findings : []).map(f => ({
    key: `${f.kind}:${f.date || ''}`,
    text: f.text,
    date: f.date || null,
    tone: f.cls,
    evidence: Array.isArray(f.evidence) && f.evidence.length ? f.evidence[0] : null,
    bormeUrl: f.borme_ref?.url || null,
  }));
  const moreCount = Number(payload?.more) || 0;
  return {
    header: {
      title: company.name || '',
      nifLabel: company.nif ? copy.nif(company.nif) : copy.nifMissing,
      nifMissing: !company.nif,
      province: company.province || null,
    },
    changed: lastFiling?.date ? copy.changed(lastFiling.date, lastFiling.type) : null,
    findings,
    verification: Array.isArray(payload?.verification) ? payload.verification : [],
    offer: { title: copy.offerTitle, body: copy.offerBody, more: moreCount > 0 ? copy.more(moreCount) : null },
    moreCount,
    labels: { standsOut: copy.standsOut, verification: copy.verification, evidence: copy.evidence,
              borme: copy.borme, nifTellUs: copy.nifTellUs, loading: copy.loading },
  };
}

export function findingsErrorView(lang) {
  return { text: copyFor(lang).unavailable };
}

export function findingsVisibleParams(view) {
  const findings = view?.findings || [];
  return {
    count: findings.length,
    concerns: findings.filter(f => f.tone === 'concern').length,
    limitations: findings.filter(f => f.tone === 'limitation').length,
    more: view?.moreCount || 0,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/utils/findingsView.test.js`
Expected: 10 pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/findingsView.js src/utils/findingsView.test.js && git -c commit.gpgsign=false commit -m "feat(findings): pure view mapping + EN/ES copy for the company findings block"
```

---

### Task 6: Service method, flag, component, mount, events

**Files:**
- Modify: `src/config.js` (append)
- Modify: `src/services/spanishCompaniesService.js` (after `_fetchCompanyProfileV3`, ~line 578)
- Modify: `src/services/spanishCompaniesService.cache.test.js` (append)
- Create: `src/components/CompanyFindings.jsx`
- Modify: `src/components/CompanyInspectorPanel.jsx` (~line 242, company view)
- Modify: `src/components/DDCheckoutDialog.jsx` (free checkbox `onChange`, ~line 922)

**Interfaces:**
- Consumes: Task 5 (`findingsView`, `findingsErrorView`, `findingsVisibleParams`), Task 4 endpoint.
- Produces: `spanishCompaniesService.getCompanyFindings({ groupKey, name, lang })` → payload; `<CompanyFindings groupKey name lang onOpenReport offerCta onEvidence />`.

- [ ] **Step 1: Write the failing service tests**

Open `src/services/spanishCompaniesService.cache.test.js`, reuse its existing service factory and `fetchWithRetry` stubbing pattern (read the first 40 lines), and append:

```javascript
describe('getCompanyFindings', () => {
  it('requests the free findings by group_key and caches per language', async () => {
    const svc = makeService();
    const calls = [];
    svc.fetchWithRetry = async (url) => { calls.push(url); return { ok: true, json: async () => ({ tier: 'free', findings: [] }) }; };
    await svc.getCompanyFindings({ groupKey: 'H:M-1', lang: 'en' });
    await svc.getCompanyFindings({ groupKey: 'H:M-1', lang: 'en' });
    await svc.getCompanyFindings({ groupKey: 'H:M-1', lang: 'es' });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('/bormes/v3/company-findings?group_key=H%3AM-1&lang=en');
  });

  it('falls back to the name when there is no group key', async () => {
    const svc = makeService();
    let url = '';
    svc.fetchWithRetry = async (u) => { url = u; return { ok: true, json: async () => ({ tier: 'free', findings: [] }) }; };
    await svc.getCompanyFindings({ name: 'X SL', lang: 'es' });
    expect(url).toContain('/bormes/v3/company-findings?name=X+SL&lang=es');
  });

  it('throws with the status on a non-2xx so the panel can report it', async () => {
    const svc = makeService();
    svc.fetchWithRetry = async () => ({ ok: false, status: 502, json: async () => ({ error: 'assembly_failed' }) });
    await expect(svc.getCompanyFindings({ groupKey: 'H:M-1', lang: 'en' })).rejects.toMatchObject({ status: 502 });
  });
});
```

If the file's factory is named differently from `makeService`, use its name. Run: `npx vitest run src/services/spanishCompaniesService.cache.test.js` → expected: `svc.getCompanyFindings is not a function`.

- [ ] **Step 2: Implement the service method and the flag**

`src/config.js` (append):

```javascript
// Company findings block at the top of the inspector. Ships dark; flipped to
// true by the last task of docs/superpowers/plans/2026-08-24-company-findings-panel.md.
export const FINDINGS_PANEL_ENABLED = false;
```

`src/services/spanishCompaniesService.js`, after `_fetchCompanyProfileV3`:

```javascript
  /**
   * Free findings block for the inspector (same engine as the paid report).
   * Cached per (group_key|name, lang); the server invalidates on new filings.
   */
  async getCompanyFindings({ groupKey = null, name = '', lang = 'es' } = {}) {
    const key = `findings|${groupKey || ''}|${groupKey ? '' : name}|${lang}`;
    return this.cache.fetch(key, async () => {
      const params = new URLSearchParams(groupKey ? { group_key: groupKey, lang } : { name, lang });
      const response = await this.fetchWithRetry(`${this.baseUrl}/bormes/v3/company-findings?${params}`, { method: 'GET' });
      if (!response.ok) {
        const err = new Error(`findings ${response.status}`);
        err.status = response.status;
        throw err;
      }
      return response.json();
    });
  }
```

Run the service test → expected: 3 pass. If `this.cache.fetch` caches rejected promises, check the cache class (`src/services/…cache`) and, if so, `catch` → delete the key → rethrow, so a failed call is retried next time.

- [ ] **Step 3: The component**

Before writing it, look up two things in `CompanyInspectorPanel.jsx`: (a) how the existing order-report button calls `onOpenReport` and which `text.*` key labels it (`grep -n "onOpenReport(" src/components/CompanyInspectorPanel.jsx`); (b) the dataset keys `onOpenDataset` accepts (`grep -n "onOpenDataset(" src/components/CompanyInspectorPanel.jsx`). Use those exact values in Step 4.

```jsx
// src/components/CompanyFindings.jsx
import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Skeleton, Link, Button } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import spanishCompaniesService from '../services/spanishCompaniesService';
import { findingsView, findingsErrorView, findingsVisibleParams } from '../utils/findingsView';
import { trackEvent } from '../utils/track';

// Identity → what changed → what stands out → needs verification → offer.
// No strings live here: texts come from the payload or findingsView.

const TONE_SX = {
  concern: { borderLeft: '3px solid', borderColor: 'warning.main', pl: 1 },
  context: { borderLeft: '3px solid', borderColor: 'divider', pl: 1 },
  limitation: { borderLeft: '3px solid', borderColor: 'divider', pl: 1, color: 'text.secondary', fontStyle: 'italic' },
};

export default function CompanyFindings({ groupKey, name, lang, onOpenReport, offerCta, onEvidence }) {
  const [state, setState] = useState({ status: 'loading', view: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', view: null });
    spanishCompaniesService.getCompanyFindings({ groupKey, name, lang })
      .then(payload => {
        if (cancelled) return;
        const view = findingsView(payload, lang);
        setState({ status: 'ready', view });
        trackEvent('findings_visible', findingsVisibleParams(view));
      })
      .catch(err => {
        if (cancelled) return;
        console.error('company findings failed', err);
        trackEvent('findings_unavailable', { status: err?.status || 0 });
        setState({ status: 'error', view: null });
      });
    return () => { cancelled = true; };
  }, [groupKey, name, lang]);

  if (state.status === 'loading') {
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Skeleton width="60%" /><Skeleton width="40%" /><Skeleton width="80%" />
      </Paper>
    );
  }
  if (state.status === 'error') {
    return (
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 2 }}>
        {findingsErrorView(lang).text}
      </Typography>
    );
  }

  const { header, changed, findings, verification, offer, labels } = state.view;
  const clickEvidence = f => {
    trackEvent('evidence_clicked', { kind: f.evidence.kind });
    onEvidence(f.evidence);
  };
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {header.title}
        <Typography component="span" variant="body2" sx={{ color: 'text.secondary', ml: 1 }}>
          · {header.nifLabel}
          {header.nifMissing && onOpenReport && (
            <> — <Link component="button" onClick={() => onOpenReport('nif', '')}>{labels.nifTellUs}</Link></>
          )}
          {header.province && ` · ${header.province}`}
        </Typography>
      </Typography>
      {changed && (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1.5 }}>{changed}</Typography>
      )}

      <Typography variant="overline" sx={{ display: 'block', fontWeight: 700, letterSpacing: '0.08em' }}>{labels.standsOut}</Typography>
      {findings.map(f => (
        <Box key={f.key} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.5, ...TONE_SX[f.tone] }}>
          <Typography variant="body2" sx={{ flex: 1 }}>{f.text}</Typography>
          {f.date && <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{f.date}</Typography>}
          {f.evidence && onEvidence && (
            <Link component="button" variant="caption" onClick={() => clickEvidence(f)}>{labels.evidence}</Link>
          )}
          {f.bormeUrl && (
            <Link href={f.bormeUrl} target="_blank" rel="noopener" variant="caption"
              onClick={() => trackEvent('evidence_clicked', { kind: 'borme' })}>{labels.borme}</Link>
          )}
        </Box>
      ))}

      {verification.length > 0 && (
        <>
          <Typography variant="overline" sx={{ display: 'block', fontWeight: 700, letterSpacing: '0.08em', mt: 1.5 }}>{labels.verification}</Typography>
          {verification.map(line => (
            <Typography key={line} variant="body2" sx={{ color: 'text.secondary' }}>• {line}</Typography>
          ))}
        </>
      )}

      {onOpenReport && offerCta && (
        <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{offer.title}</Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1 }}>
            {offer.body}{offer.more ? ` — ${offer.more}` : ''}
          </Typography>
          <Button size="small" variant="contained" color="warning" startIcon={<DescriptionIcon />}
            onClick={offerCta.onClick} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {offerCta.label}
          </Button>
        </Box>
      )}
    </Paper>
  );
}
```

`offerCta` is `{ label, onClick }` — both taken from the panel's existing report button so the block never invents its own price copy or open logic.

- [ ] **Step 4: Mount it first in the inspector and gate on the flag**

In `CompanyInspectorPanel.jsx` add:

```javascript
import CompanyFindings from './CompanyFindings';
import { FINDINGS_PANEL_ENABLED } from '../config';
```

Inside the company branch (`{data && data.type === 'company' && (() => {`), as the FIRST element inside the returned `<Box>`, before `<CurrencyConfirmationCard …/>`:

```jsx
              {FINDINGS_PANEL_ENABLED && (
                <CompanyFindings
                  groupKey={data.company?.group_key || null}
                  name={data.name}
                  lang={lang}
                  onOpenReport={onOpenReport}
                  offerCta={{ label: /* existing report-button label from text */ text.REPORT_LABEL_KEY,
                              onClick: () => /* the existing report button's handler, verbatim */ null }}
                  onEvidence={ev => onOpenDataset?.(ev.kind === 'officer' ? OFFICERS_DATASET_KEY : EVENTS_DATASET_KEY)}
                />
              )}
```

Replace `text.REPORT_LABEL_KEY`, the `onClick` body, `OFFICERS_DATASET_KEY` and `EVENTS_DATASET_KEY` with the exact values found in Step 3's two greps — the plan cannot know them without reading the file, and a wrong key would open nothing.

The Overview grid's "legal name" cell (~line 248-262) duplicates the header when the flag is on: wrap that single cell in `{!FINDINGS_PANEL_ENABLED && ( … )}` so flipping the flag swaps them.

- [ ] **Step 5: The free-report event**

In `DDCheckoutDialog.jsx`, the free toggle's checkbox (`checked={useFreeReport}`), replace its `onChange`:

```jsx
onChange={(e) => {
  setUseFreeReport(e.target.checked);
  if (e.target.checked) trackEvent('free_report_selected', { company: companyName || '' });
}}
```

- [ ] **Step 6: Build, test, browser-check the dark state**

Run: `npx vitest run 2>&1 | grep -E "Tests " && npx vite build 2>&1 | tail -1`
Expected: all pass (460 + 13 new), build green.

`npx vite --port 5199 --strictPort` in the background, open `http://localhost:5199/due-diligence?company=INDITEX%2C+SA` and `http://localhost:5199/app/` in Chrome: the app renders, no console exception, and (flag off) no `company-findings` request. Kill the server.

- [ ] **Step 7: Commit (flag off)**

```bash
git add src/config.js src/services/spanishCompaniesService.js src/services/spanishCompaniesService.cache.test.js src/components/CompanyFindings.jsx src/components/CompanyInspectorPanel.jsx src/components/DDCheckoutDialog.jsx && git -c commit.gpgsign=false commit -m "feat(inspector): company findings block (dark behind FINDINGS_PANEL_ENABLED)

Identity header, latest filing, dated findings with evidence links, needs-
verification and the offer, first in the inspector, from
/bormes/v3/company-findings — the same engine as the paid report. Ships
with the flag off; findings_visible / evidence_clicked /
free_report_selected / findings_unavailable events added."
```

---

### Task 7: Flip the flag, deploy, verify live, record

**Files:**
- Modify: `src/config.js` (`FINDINGS_PANEL_ENABLED = true`)

- [ ] **Step 1: Flip, test, push**

```bash
sed -i '' 's/export const FINDINGS_PANEL_ENABLED = false;/export const FINDINGS_PANEL_ENABLED = true;/' src/config.js
npx vitest run 2>&1 | grep -E "Tests " && git add src/config.js && git -c commit.gpgsign=false commit -m "feat(inspector): enable the company findings block" && git push origin main
```

- [ ] **Step 2: Verify on the live origin (Chrome)**

Wait for the CF Pages deploy (~2 min). If `mapasocietario.es` looks down from this Mac, it is the local 188.114.x edge filtering (memory `env_local_edge_ip_block`), not the deploy — verify with `curl --resolve` or another network. Load `https://mapasocietario.es/app/?search=INDITEX+SA&type=company&lang=en` and check:
- Inspector opens with the findings block FIRST; header shows name · NIF · province; "Latest BORME filing" line present.
- At least one dated finding; the `no_insolvency_notice` sentence is verbatim; "Show in table" opens the right dataset; "BORME notice" opens the PDF in a new tab.
- `&lang=es`: copy and finding texts are Spanish.
- A company with the `dissolved` chip: `insolvency_or_dissolution` first, no `no_insolvency_notice`.
- Network: one `company-findings` request per company per language; revisiting the same company makes none.
- `findings_visible` fires once with `{count, concerns, limitations, more}` (GA DebugView or a `gtag` breakpoint).
- 375 px width: block first in the drawer, no overlap.

A wrong finding text or class is fixed in `dd_findings.py` with a test first (Task 2's file) and a backend redeploy — the frontend needs no change.

- [ ] **Step 3: Record**

Update `~/.claude/projects/-Users-alessandronurnberg-mapasocietario/memory/project_conversion_focus.md`: findings block LIVE {date}, endpoint latencies, the four-week read date (deploy + 28 days), and the primary-metric baseline (`graph_search_selection → view_item`, 94→23 over 16–20 Aug). Update the index line in `MEMORY.md`.

---

## Self-review against the spec

- Identity header, what-changed, findings, verification, offer — Tasks 5/6. ✔
- Findings kinds: insolvency_or_dissolution, no_insolvency_notice, structural_event (cap 2), capital_movement (undated omitted), sole_shareholder_declared, previous_name, governing_body_turnover (365 d, admins only, ≥3 concern), superseded_seats (branch on kind), power_density (paid_only), officer_elsewhere (gated constant, no generator) — Task 2. ✔
- Ordering + cap 5 + `more` — Task 2 `project_free`, tested. ✔
- Verification = gap sentences — `verification_lines`. ✔
- Endpoint contract, cache keyed on last filing, 404/502 semantics, CORS — Task 3. ✔
- Proxy: no change needed (prefix dispatch); verified live in Task 4 with the fallback instruction. ✔
- `borme_ref` populated from event docs — Tasks 1–3 (deviation recorded in Global Constraints). ✔
- Frontend flag default off, string-free component, error line not silent, loading skeleton, evidence handlers reuse `onOpenDataset` — Task 6. ✔
- Analytics: `findings_visible`, `evidence_clicked`, `free_report_selected`, `findings_unavailable` — Task 6. ✔
- Tests at repo root as `tests_*.py` — Tasks 1–3. ✔
- Rollout order backend → verify → frontend dark → flip — Tasks 4, 6, 7. ✔
- Type consistency: `findingsView` returns `labels` and `moreCount` (both used by the component and tests); `getCompanyFindings({groupKey,name,lang})` matches the component's call; `onEvidence` receives `{kind, ref}` as produced by `findingsView`; `offerCta` is `{label, onClick}` in both the component and the mount. ✔
- Plan-time unknowns each have an explicit look-up step instead of an assumption: the panel's report-button label/handler and dataset keys (Task 6 Steps 3–4), the cache-test factory name (Task 6 Step 1), the story-authority fixture (Task 1 Step 4), the cache class's handling of rejections (Task 6 Step 2).
