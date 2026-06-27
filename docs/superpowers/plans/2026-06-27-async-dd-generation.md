# Async DD Report Generation + Email Notify — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate Spanish DD reports server-side in the background, store the PDF to R2, and email the buyer when ready — so the browser never holds a long synchronous request and large companies stop 504-ing.

**Architecture:** The Cloudflare worker fires a fire-and-forget `generate-async` call to Flask at order confirmation. Flask runs `generate_company_report` on a daemon thread, POSTs the PDF to the worker's existing `store-dd-report` endpoint, and emails the buyer a link to `/order/<id>`. The frontend stops generating client-side and instead polls `verify-dd-payment` for `reportReady` (the FS-order machinery that already exists), with a self-heal re-trigger.

**Tech Stack:** Python/Flask (`ncdata-bormes-impl`), Cloudflare Worker JS (`local-rag`), React/MUI (`mapasocietario`). MailerSend via `mailer.py`. R2 via the worker.

## Global Constraints

- **No Redis** — background work runs on a `threading.Thread`. No RQ/Celery.
- **Flask has no R2 client** — it stores PDFs by POSTing raw bytes to the worker's `store-dd-report?sessionId=<id>` endpoint (verifies `dd_session_used/<id>` exists, caps 20MB).
- **Shared secret** `GENERATE_SECRET` guards `generate-async` (worker sends `X-Generate-Secret`, Flask rejects mismatch).
- **Reuse, don't rebuild:** `generate_company_report(name, es, options) -> (pdf_bytes, resolved_name)`, `mailer.send_email(to_email, subject, html, text) -> bool`, the worker `store-dd-report`, `verify-dd-payment`'s `reportReady`, the `OrderStatusPage` poll loop.
- **Scope:** Spanish `/bormes/dd-report/company` path only. UK/FR/CH/IT stay synchronous.
- **Self-heal threshold:** the order page re-triggers if not ready after ~3 minutes.

## File structure

| Repo | File | Responsibility |
|------|------|----------------|
| `ncdata-bormes-impl` | `borme_dd_async.py` (new) | background job (`generate_and_deliver`), in-flight guard, the `generate-async` route, the "ready" email body |
| `ncdata-bormes-impl` | `borme_dd_async_test.py` (new) | unit tests for the job (stubbed collaborators) |
| `ncdata-bormes-impl` | `borme_search_api.py` (modify) | register the async route |
| `local-rag` | `workers/stripe-handler/src/index.js` (modify) | fire `generate-async` in free + paid confirmation; write `dd_session_used` for paid at trigger; `retrigger-dd-report` endpoint; reword confirmation email |
| `mapasocietario` | `src/components/OrderStatusPage.jsx` (modify) | DD-only branch → processing+poll; copy; self-heal re-trigger |

---

## Phase 1 — Flask: background generation (the core)

### Task 1: The background job `generate_and_deliver`

**Files:**
- Create: `borme_dd_async.py`
- Test: `borme_dd_async_test.py`

**Interfaces:**
- Consumes: `generate_company_report(name, es, options) -> (bytes, str)`; `mailer.send_email(to_email, subject, html, text) -> bool`.
- Produces: `generate_and_deliver(session_id, company_name, options, email, order_origin, es, *, _generate=generate_company_report, _store=store_pdf, _send=send_email) -> str` returning one of `"done"`, `"store_failed"`, `"error"`. `store_pdf(store_url, session_id, pdf_bytes) -> bool`.

- [ ] **Step 1: Write the failing test** (`borme_dd_async_test.py`) — mirror the enricher self-stub pattern so it runs without Flask/ES:

```python
import os, sys, types
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# Stub mailer + generator so the module imports without heavy deps.
_mailer = types.ModuleType('mailer'); _mailer.send_email = lambda **k: True
sys.modules['mailer'] = _mailer
_rep = types.ModuleType('borme_dd_report')
_rep.generate_company_report = lambda name, es, options: (b'%PDF-1.4 fake', name)
sys.modules['borme_dd_report'] = _rep

from borme_dd_async import generate_and_deliver

def test_happy_path_stores_then_emails():
    calls = {'store': None, 'email': None}
    def fake_store(url, sid, pdf): calls['store'] = (url, sid, pdf); return True
    def fake_send(**kw): calls['email'] = kw; return True
    out = generate_and_deliver(
        'cs_free_123456789012', 'FTI CONSULTING SPAIN SL', {'language': 'es'},
        'buyer@example.com', 'https://mapasocietario.es', es=None,
        _store=fake_store, _send=fake_send,
    )
    assert out == 'done'
    assert calls['store'][1] == 'cs_free_123456789012'
    assert calls['store'][2] == b'%PDF-1.4 fake'
    assert 'order/cs_free_123456789012' in calls['email']['html']
    assert calls['email']['to_email'] == 'buyer@example.com'

def test_store_failure_skips_email_and_writes_no_report():
    sent = []
    out = generate_and_deliver(
        'cs_free_123456789012', 'X SA', {}, 'b@e.com', 'https://m.es', es=None,
        _store=lambda *a: False, _send=lambda **k: sent.append(k) or True,
    )
    assert out == 'store_failed'
    assert sent == []

def test_generation_error_is_caught():
    def boom(name, es, options): raise RuntimeError('llm down')
    out = generate_and_deliver(
        'cs_free_123456789012', 'X SA', {}, 'b@e.com', 'https://m.es', es=None,
        _generate=boom, _store=lambda *a: True, _send=lambda **k: True,
    )
    assert out == 'error'

if __name__ == '__main__':
    test_happy_path_stores_then_emails()
    test_store_failure_skips_email_and_writes_no_report()
    test_generation_error_is_caught()
    print('OK — borme_dd_async job tests passed')
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd /home/alex/bormes && python3 borme_dd_async_test.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'borme_dd_async'`

- [ ] **Step 3: Implement `borme_dd_async.py`**

```python
"""Async Spanish DD report generation: generate on a background thread, store
the PDF via the worker's store endpoint, and email the buyer when ready."""
import logging
import os
import threading
import traceback

import requests

from mailer import send_email as _default_send
from borme_dd_report import generate_company_report as _default_generate

logger = logging.getLogger(__name__)

STORE_DD_REPORT_URL = os.getenv(
    'STORE_DD_REPORT_URL', 'https://payments.ncdata.eu/api/stripe/store-dd-report')

_inflight = set()
_inflight_lock = threading.Lock()


def store_pdf(store_url, session_id, pdf_bytes):
    """POST raw PDF bytes to the worker store endpoint. Returns True on 2xx."""
    try:
        resp = requests.post(
            f"{store_url}?sessionId={session_id}",
            data=pdf_bytes,
            headers={'Content-Type': 'application/pdf'},
            timeout=30,
        )
        return resp.ok
    except Exception as e:
        logger.error("store_pdf failed for %s: %s", session_id, e)
        return False


def _ready_email(company_name, order_url, lang):
    es = lang == 'es'
    subject = (f"Tu informe está listo — {company_name}" if es
               else f"Your report is ready — {company_name}")
    html = (
        f"<p>{'Tu informe due diligence de' if es else 'Your due diligence report for'} "
        f"<strong>{company_name}</strong> {'ya está listo.' if es else 'is ready.'}</p>"
        f"<p><a href=\"{order_url}\">{'Ver / descargar el informe' if es else 'View / download the report'}</a></p>"
    )
    text = (f"{company_name}: {'informe listo' if es else 'report ready'} — {order_url}")
    return subject, html, text


def generate_and_deliver(session_id, company_name, options, email, order_origin, es,
                         *, _generate=_default_generate, _store=store_pdf,
                         _send=_default_send):
    """Generate -> store -> email. Returns 'done' | 'store_failed' | 'error'.
    Leaves NO stored PDF on failure so a re-trigger regenerates cleanly."""
    lang = (options or {}).get('language', 'es')
    try:
        pdf_bytes, resolved = _generate(company_name, es, options or {})
        if not _store(STORE_DD_REPORT_URL, session_id, pdf_bytes):
            logger.error("DD store failed for %s", session_id)
            return 'store_failed'
        if email:
            subject, html, text = _ready_email(
                resolved or company_name, f"{order_origin}/order/{session_id}", lang)
            _send(to_email=email, subject=subject, html=html, text=text)
        logger.info("DD async report delivered for %s", session_id)
        return 'done'
    except Exception:
        logger.error("DD async generation failed for %s:\n%s",
                     session_id, traceback.format_exc())
        return 'error'
```

- [ ] **Step 4: Run tests, verify pass**

Run: `python3 borme_dd_async_test.py`
Expected: `OK — borme_dd_async job tests passed`

- [ ] **Step 5: Commit**

```bash
cd /home/alex/bormes  # or the repo root locally: /Users/alessandronurnberg/ncdata-bormes-impl
git add borme_dd_async.py borme_dd_async_test.py
git -c commit.gpgsign=false commit -m "feat(dd): async DD generate-and-deliver background job"
```

---

### Task 2: The `generate-async` route + thread spawn + secret + in-flight guard

**Files:**
- Modify: `borme_dd_async.py` (add `register_async_dd_routes(app, es)`)
- Modify: `borme_search_api.py` (call it next to `register_dd_report_routes`)
- Test: `borme_dd_async_test.py` (add `_should_start` unit test)

**Interfaces:**
- Consumes: `generate_and_deliver(...)` from Task 1.
- Produces: `register_async_dd_routes(app, es)`; `_should_start(session_id) -> bool` (False if already in-flight; marks in-flight as a side effect when True).

- [ ] **Step 1: Write the failing test** (append to `borme_dd_async_test.py`):

```python
def test_should_start_is_idempotent_per_session():
    from borme_dd_async import _should_start, _inflight
    _inflight.discard('cs_free_aaaaaaaaaa')
    assert _should_start('cs_free_aaaaaaaaaa') is True   # first wins, marks in-flight
    assert _should_start('cs_free_aaaaaaaaaa') is False  # second is rejected
```
Add `test_should_start_is_idempotent_per_session()` to the `__main__` block.

- [ ] **Step 2: Run, verify it fails**

Run: `python3 borme_dd_async_test.py`
Expected: FAIL — `cannot import name '_should_start'`

- [ ] **Step 3: Implement the guard + route** (append to `borme_dd_async.py`):

```python
def _should_start(session_id):
    """True iff no generation is in flight for this session; marks it in flight."""
    with _inflight_lock:
        if session_id in _inflight:
            return False
        _inflight.add(session_id)
        return True


def _run_and_clear(session_id, *args):
    try:
        generate_and_deliver(session_id, *args)
    finally:
        with _inflight_lock:
            _inflight.discard(session_id)


def register_async_dd_routes(app, es):
    from flask import request, jsonify

    @app.route('/bormes/dd-report/generate-async', methods=['POST'])
    def dd_generate_async():
        if request.headers.get('X-Generate-Secret') != os.getenv('GENERATE_SECRET'):
            return jsonify({'error': 'forbidden'}), 403
        data = request.get_json(silent=True) or {}
        session_id = (data.get('sessionId') or '').strip()
        company_name = (data.get('company_name') or '').strip()
        if not session_id or len(company_name) < 3:
            return jsonify({'error': 'sessionId and company_name required'}), 400
        if not _should_start(session_id):
            return jsonify({'status': 'in_progress'}), 202
        threading.Thread(
            target=_run_and_clear,
            args=(session_id, company_name, data.get('options') or {},
                  data.get('email') or '', data.get('orderOrigin') or '', es),
            daemon=True,
        ).start()
        return jsonify({'status': 'started'}), 202
```

- [ ] **Step 4: Register the route** in `borme_search_api.py` — next to the existing `register_dd_report_routes(app, es)` (~line 397):

```python
    from borme_dd_async import register_async_dd_routes
    register_async_dd_routes(app, es)
```

- [ ] **Step 5: Run tests, verify pass**

Run: `python3 borme_dd_async_test.py`
Expected: `OK — ...` (all four tests). Then `python3 -c "import ast; ast.parse(open('borme_search_api.py').read())"` → no output (syntax OK).

- [ ] **Step 6: Commit**

```bash
git add borme_dd_async.py borme_dd_async_test.py borme_search_api.py
git -c commit.gpgsign=false commit -m "feat(dd): /bormes/dd-report/generate-async route with secret + in-flight guard"
```

---

## Phase 2 — Worker: trigger generation at confirmation

> No unit-test harness in this repo. Each task verifies with `node --check` and a
> manual `curl`/`wrangler tail`. Set the worker secrets first:
> `cd workers/stripe-handler && npx wrangler secret put GENERATE_SECRET` and
> `npx wrangler secret put BORME_API_URL` (value: `https://api.ncdata.eu`).

### Task 3: Fire `generate-async` for FREE orders + helper

**Files:**
- Modify: `workers/stripe-handler/src/index.js`

**Interfaces:**
- Produces: `triggerDdGeneration(env, { sessionId, companyName, country, options, email, orderOrigin })` — fire-and-forget POST to `${env.BORME_API_URL}/bormes/dd-report/generate-async` with header `X-Generate-Secret`. Awaits only the 202; never throws.

- [ ] **Step 1: Add the helper** near `notifyFreeOrder` (it follows the same non-blocking shape):

```javascript
async function triggerDdGeneration(env, { sessionId, companyName, country, options, email, orderOrigin }) {
  const base = env.BORME_API_URL;
  if (!base) { console.error('BORME_API_URL not set — cannot trigger DD generation'); return; }
  try {
    const res = await fetch(`${base}/bormes/dd-report/generate-async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Generate-Secret': env.GENERATE_SECRET || '' },
      body: JSON.stringify({ sessionId, company_name: companyName, country, options, email, orderOrigin }),
    });
    console.log(`DD generate-async trigger: ${res.status}`);
  } catch (err) {
    console.error('DD generate-async trigger failed:', err.message);
  }
}
```

- [ ] **Step 2: Call it in the free/waiver path** — in `handleCreateDDCheckoutSession`, right after the existing `notifyFreeOrder(...)` call, for DD-only free orders (FS orders wait for admin upload):

```javascript
    if (!parsedOptions.financialStatements) {
      await triggerDdGeneration(env, {
        sessionId: freeSessionId,
        companyName: companyName || companyIdentifier,
        country,
        options: parsedOptions,
        email,
        orderOrigin: parsedOrigin || cleanReturnUrl,
      });
    }
```

- [ ] **Step 3: Verify syntax**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag && node --check workers/stripe-handler/src/index.js`
Expected: no output (OK)

- [ ] **Step 4: Commit**

```bash
git add workers/stripe-handler/src/index.js
git -c commit.gpgsign=false commit -m "feat(dd): trigger async generation for free orders"
```

- [ ] **Step 5: Manual smoke (after deploy)** — `npx wrangler deploy`, place a free order, `npx wrangler tail stripe-handler --format pretty` shows `DD generate-async trigger: 202`, and the report appears on `/order/<id>` + arrives by email.

---

### Task 4: Fire for PAID orders + ensure `dd_session_used` exists at trigger

**Files:**
- Modify: `workers/stripe-handler/src/index.js`

**Why the sentinel:** `store-dd-report` rejects unless `dd_session_used/<id>` exists. For paid orders that sentinel is written by `verify-dd-payment` (first `/order` visit). Since we now generate from the webhook *before* the page is opened, write the sentinel at trigger time.

- [ ] **Step 1: In `handleWebhook`, the `dd_report` paid branch** (the `payment_status` block that calls `notifyNewOrder`), after recording the order, write the sentinel if absent and trigger generation (DD-only):

```javascript
      let parsedOpts = {};
      try { parsedOpts = JSON.parse(session.metadata.options || '{}'); } catch {}
      if (!parsedOpts.financialStatements && env.PAYMENTS_R2) {
        const consumedKey = `dd_session_used/${session.id}`;
        if (!(await env.PAYMENTS_R2.get(consumedKey))) {
          await env.PAYMENTS_R2.put(consumedKey, JSON.stringify({
            consumedAt: new Date().toISOString(), sessionId: session.id,
            country: session.metadata.country,
            companyIdentifier: session.metadata.companyIdentifier,
            companyName: session.metadata.companyName,
            options: session.metadata.options || '{}',
            customerEmail: session.customer_email || '',
          }));
        }
        await triggerDdGeneration(env, {
          sessionId: session.id,
          companyName: session.metadata.companyName || session.metadata.companyIdentifier,
          country: session.metadata.country,
          options: parsedOpts,
          email: session.customer_email || '',
          orderOrigin: session.metadata.orderBaseUrl || '',
        });
      }
```

- [ ] **Step 2: Verify syntax**

Run: `node --check workers/stripe-handler/src/index.js`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add workers/stripe-handler/src/index.js
git -c commit.gpgsign=false commit -m "feat(dd): trigger async generation for paid orders + sentinel at webhook"
```

---

### Task 5: `retrigger-dd-report` endpoint (self-heal) + reword confirmation email

**Files:**
- Modify: `workers/stripe-handler/src/index.js`

**Interfaces:**
- Produces: route `POST /api/stripe/retrigger-dd-report` body `{ sessionId }` → 200 if a real order (`dd_session_used/<id>` exists) and re-fires `triggerDdGeneration`; 403 otherwise. Reads order fields from the `dd_session_used` sentinel.

- [ ] **Step 1: Add the handler**:

```javascript
async function handleRetriggerDdReport(request, env) {
  const { sessionId } = await request.json().catch(() => ({}));
  if (!sessionId || !/^cs_(test|live|free)_[A-Za-z0-9_]{10,}$/.test(sessionId)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Valid sessionId required' }) };
  }
  const obj = env.PAYMENTS_R2 && await env.PAYMENTS_R2.get(`dd_session_used/${sessionId}`);
  if (!obj) return { statusCode: 403, body: JSON.stringify({ error: 'Unknown session' }) };
  const d = JSON.parse(await obj.text());
  let opts = {}; try { opts = JSON.parse(d.options || '{}'); } catch {}
  await triggerDdGeneration(env, {
    sessionId, companyName: d.companyName || d.companyIdentifier, country: d.country,
    options: opts, email: d.customerEmail || '', orderOrigin: d.orderBaseUrl || '',
  });
  return { statusCode: 200, body: JSON.stringify({ retriggered: true }) };
}
```

- [ ] **Step 2: Route it** — next to the `store-dd-report` route registration (~line 2733):

```javascript
      if (url.pathname === `${baseApiRoute}/retrigger-dd-report`) {
        const response = await handleRetriggerDdReport(request, env);
        return jsonResponse(response, corsHeaders);  // match the sibling routes' response shape
      }
```
(Read the two adjacent route handlers to copy their exact response/CORS wrapper.)

- [ ] **Step 3: Reword the confirmation email** — in `sendOrderConfirmationEmail`, for DD-only (non-FS) orders, change the body to set the expectation, e.g. add: *"We're preparing your report now — you'll get an email when it's ready (usually a couple of minutes), and it's always on your order page."* Keep FS wording unchanged.

- [ ] **Step 4: Verify syntax**

Run: `node --check workers/stripe-handler/src/index.js`
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add workers/stripe-handler/src/index.js
git -c commit.gpgsign=false commit -m "feat(dd): retrigger-dd-report self-heal endpoint + confirmation email wording"
```

---

## Phase 3 — Frontend: poll instead of generate

> Verified with `npm run build` + manual. No vitest in this repo.

### Task 6: `OrderStatusPage` — DD-only orders poll, with self-heal

**Files:**
- Modify: `src/components/OrderStatusPage.jsx`

- [ ] **Step 1: Stop client-side generation** — in the mount effect (~line 325-327), replace the DD-only `generateReport(data)` branch with the processing state so the existing poll takes over:

```javascript
        } else {
          // DD-only order: the server generates in the background and emails the
          // buyer; just poll for reportReady (same path as FS orders).
          setStatus('processing');
        }
```

- [ ] **Step 2: Self-heal re-trigger** — add an effect that, while `status === 'processing'` and not `data.options?.financialStatements`, re-fires generation if it hasn't appeared after ~3 minutes:

```javascript
  useEffect(() => {
    if (status !== 'processing' || orderData?.options?.financialStatements) return;
    const RETRIGGER_AFTER_MS = 3 * 60 * 1000;
    const t = setTimeout(() => {
      fetch(`${PAYMENTS_API}/api/stripe/retrigger-dd-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }, RETRIGGER_AFTER_MS);
    return () => clearTimeout(t);
  }, [status, sessionId, orderData]);
```

- [ ] **Step 3: Copy** — ensure the `processing` view for a DD-only order reads like "We're preparing your report — it'll appear here and we'll email you." (the FS-specific "waiting for accounts" copy must not show for DD-only; gate on `orderData?.options?.financialStatements`).

- [ ] **Step 4: Move the GA4 `purchase` event** out of the now-unused client generation into the point where `status` becomes `ready` (so the conversion still fires once), guarded so it fires a single time.

- [ ] **Step 5: Build**

Run: `cd /Users/alessandronurnberg/mapasocietario && npm run build`
Expected: `✓ built in …` (no errors)

- [ ] **Step 6: Commit**

```bash
git add src/components/OrderStatusPage.jsx
git -c commit.gpgsign=false commit -m "feat(dd): order page polls for server-generated report with self-heal"
```

---

## Deploy order (after all tasks pass)

1. Flask: deploy `borme_dd_async.py` + `borme_search_api.py`; set `GENERATE_SECRET`, `STORE_DD_REPORT_URL` env. Restart the API.
2. Worker: set `GENERATE_SECRET` (same value), `BORME_API_URL` secrets; `npx wrangler deploy`.
3. Frontend: deploy via Pages.
4. Smoke: one free order end-to-end (tail the worker for `202`, confirm report on `/order` + email), then one paid order.

## Edge cases covered
- Duplicate/concurrent triggers → `_should_start` in-flight guard.
- Generation failure → no PDF stored → self-heal re-trigger regenerates.
- Buyer closes the tab → email delivers the report.
- FS orders → untouched (still admin-upload + poll).
