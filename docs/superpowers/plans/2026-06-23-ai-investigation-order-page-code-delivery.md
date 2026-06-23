# AI Investigation — Order-Page Code Delivery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Deliver the minted redemption code to the buyer without a MailerSend template change, by surfacing it on the already-payment-verified order page (`/order/:sessionId`) and pre-filling the redeem gate.

**Architecture:** A new `POST /code-for-session` endpoint on the `ai-investigation` worker server-side-verifies the paid Stripe session (via `payments.ncdata.eu/verify-dd-payment`, the same trust gate `alerts_api.py` uses), looks up the entitlement by `dd_session_id`, and returns the code. The order page fetches it on the `ready` state, displays it, and pre-fills `AIInvestigationGate` (email + code) so the buyer only solves Turnstile and clicks unlock.

**Tech Stack:** Cloudflare Workers (ESM), D1, `@cloudflare/vitest-pool-workers`; React 18 + Vite + MUI; `node:test`.

## Global Constraints
- Two repos: Task 1 → `standalone_rag/local-rag` (branch `feat/ai-investigation-code-for-session`). Task 2 → `mapasocietario` (branch `feat/ai-investigation-order-page-code`).
- Zero runtime npm deps in the worker. ESM. D1 access `prepare(sql).bind(...).first()`.
- The endpoint is authorized ONLY by a server-side-verified paid session — never trust client-supplied paid status. Cross-check the verified `customerEmail` equals the entitlement's stored `email` (both lowercased).
- Session id format: `cs_(test|live|free)_[A-Za-z0-9_]{8,}`.
- CORS allow-list identical to the existing worker (`ALLOWED_ORIGINS`).
- Tests must mock the outbound `verify-dd-payment` fetch (no live network) — use the same `vi.stubGlobal('fetch', …)` hermetic pattern already used in `test/endpoints.spec.js` (`fetchMock` is unavailable in pool v0.13.5).
- Preserve the email+code identity model: show the code; do NOT auto-issue a JWT from the session.

---

### Task 1: `POST /code-for-session` on the ai-investigation worker

**Files:**
- Create: `workers/ai-investigation/src/verify-payment.js`
- Modify: `workers/ai-investigation/src/entitlements.js` (add `getEntitlementBySession`)
- Modify: `workers/ai-investigation/src/index.js` (route + handler)
- Modify: `workers/ai-investigation/wrangler.jsonc` (add `STRIPE_VERIFY_DD_URL` var)
- Test: `workers/ai-investigation/test/verify-payment.spec.js`
- Test: `workers/ai-investigation/test/code-for-session.spec.js`

(Paths relative to `/Users/alessandronurnberg/standalone_rag/local-rag/`.)

**Interfaces:**
- Consumes: `getUsageCounts`/`createEntitlement` (existing); `corsHeaders`/`preflight` (existing); the hermetic-fetch test pattern from `test/endpoints.spec.js`.
- Produces:
  - `async function verifyDdPayment(sessionId, verifyUrl, fetchImpl = fetch): Promise<{paid:true, customerEmail:string}|null>` — POSTs `{sessionId}`; returns the lowercased verified email on `paid===true`, else `null`; never throws.
  - `async function getEntitlementBySession(db, sessionId): Promise<row|null>` — newest entitlement for that `dd_session_id`.
  - Route `POST /code-for-session` → `{ code, email, expires_at }` (200) or `{error,reason}` (400 `bad_session`/`bad_json`, 403 `not_paid`/`email_mismatch`, 404 `not_found`).

- [ ] **Step 1: Write the failing verify-payment unit test**

Create `workers/ai-investigation/test/verify-payment.spec.js`:

```javascript
import { describe, it, expect } from "vitest";
import { verifyDdPayment } from "../src/verify-payment.js";

const ok = (body) => async () => new Response(JSON.stringify(body), { status: 200 });

describe("verifyDdPayment", () => {
  it("returns lowercased email when paid", async () => {
    const r = await verifyDdPayment("cs_test_abc", "https://pay/verify", ok({ paid: true, customerEmail: "Buyer@Example.com" }));
    expect(r).toEqual({ paid: true, customerEmail: "buyer@example.com" });
  });
  it("returns null when not paid", async () => {
    expect(await verifyDdPayment("cs_test_abc", "https://pay/verify", ok({ paid: false }))).toBeNull();
  });
  it("returns null for empty sessionId without calling fetch", async () => {
    let called = false;
    const spy = async () => { called = true; return new Response("{}"); };
    expect(await verifyDdPayment("", "https://pay/verify", spy)).toBeNull();
    expect(called).toBe(false);
  });
  it("returns null on fetch error", async () => {
    const boom = async () => { throw new Error("net"); };
    expect(await verifyDdPayment("cs_test_abc", "https://pay/verify", boom)).toBeNull();
  });
});
```

- [ ] **Step 2: Run → RED**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/ai-investigation && npm test -- verify-payment`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `verify-payment.js`**

Create `workers/ai-investigation/src/verify-payment.js`:

```javascript
export async function verifyDdPayment(sessionId, verifyUrl, fetchImpl = fetch) {
  if (!sessionId) return null;
  try {
    const res = await fetchImpl(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.paid !== true) return null;
    return { paid: true, customerEmail: String(data.customerEmail || "").trim().toLowerCase() };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run → GREEN**

Run: `npm test -- verify-payment`  → PASS (4).

- [ ] **Step 5: Add `getEntitlementBySession` to `entitlements.js`**

Append to `workers/ai-investigation/src/entitlements.js`:

```javascript
export async function getEntitlementBySession(db, sessionId) {
  return db
    .prepare(`SELECT * FROM entitlements WHERE dd_session_id = ? ORDER BY paid_at DESC LIMIT 1`)
    .bind(sessionId)
    .first();
}
```

- [ ] **Step 6: Add `STRIPE_VERIFY_DD_URL` var to `wrangler.jsonc`**

In `workers/ai-investigation/wrangler.jsonc`, add to the `"vars"` object (alongside `ALLOWED_ORIGINS`):

```jsonc
    "STRIPE_VERIFY_DD_URL": "https://payments.ncdata.eu/api/stripe/verify-dd-payment"
```

- [ ] **Step 7: Write the failing endpoint test**

Create `workers/ai-investigation/test/code-for-session.spec.js`:

```javascript
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import worker from "../src/index.js";
import { applyMigrations } from "./apply-migrations.js";
import { createEntitlement } from "../src/entitlements.js";

const VERIFY_URL = "https://payments.ncdata.eu/api/stripe/verify-dd-payment";
const testEnv = { ...env, STRIPE_VERIFY_DD_URL: VERIFY_URL };
const db = () => env.ENTITLEMENTS_DB;
const PAID_AT = Math.floor(Date.now() / 1000);
const SESSION = "cs_test_abc12345";

// Hermetic: stub the outbound verify-dd-payment call. `paidEmail` is the
// email the payments service "confirms"; set to null to simulate unpaid.
let paidEmail = "buyer@example.com";
const realFetch = globalThis.fetch;
beforeAll(() => {
  vi.stubGlobal("fetch", async (url, init) => {
    if (String(url).includes("verify-dd-payment")) {
      return new Response(JSON.stringify(paidEmail ? { paid: true, customerEmail: paidEmail } : { paid: false }), { status: 200 });
    }
    throw new Error(`[hermetic] unexpected outbound fetch: ${url}`);
  });
});
afterAll(() => vi.stubGlobal("fetch", realFetch));

async function call(body) {
  const ctx = createExecutionContext();
  const res = await worker.fetch(
    new Request("https://ai.ncdata.eu/code-for-session", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://mapasocietario.es" },
      body: JSON.stringify(body),
    }), testEnv, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

beforeEach(async () => {
  await applyMigrations();
  await db().exec("DELETE FROM entitlements");
  paidEmail = "buyer@example.com";
  await createEntitlement(db(), { code: "AB12-CD34-EF56", email: "buyer@example.com", ddSessionId: SESSION, paidAt: PAID_AT, expiresAt: PAID_AT + 172800 });
});

describe("/code-for-session", () => {
  it("returns the code for a paid session", async () => {
    const res = await call({ sessionId: SESSION });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.code).toBe("AB12-CD34-EF56");
    expect(data.email).toBe("buyer@example.com");
    expect(data.expires_at).toBe(PAID_AT + 172800);
  });
  it("403 when the session is not paid", async () => {
    paidEmail = null;
    const res = await call({ sessionId: SESSION });
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("not_paid");
  });
  it("404 when no entitlement exists for the session", async () => {
    const res = await call({ sessionId: "cs_test_other999" });
    expect(res.status).toBe(404);
    expect((await res.json()).reason).toBe("not_found");
  });
  it("403 when verified email does not match the minted email", async () => {
    paidEmail = "someone-else@example.com";
    const res = await call({ sessionId: SESSION });
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("email_mismatch");
  });
  it("400 for a malformed session id", async () => {
    const res = await call({ sessionId: "not-a-session" });
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe("bad_session");
  });
});
```

- [ ] **Step 8: Run → RED**

Run: `npm test -- code-for-session`
Expected: FAIL — route 404s (not implemented).

- [ ] **Step 9: Add the route + handler to `index.js`**

In `workers/ai-investigation/src/index.js`, add imports:

```javascript
import { redeemEntitlement, recordUsage, getUsageCounts, canonicalizeCode, getEntitlementBySession } from "./entitlements.js";
import { verifyDdPayment } from "./verify-payment.js";
```
(Merge `getEntitlementBySession` into the EXISTING `./entitlements.js` import line rather than duplicating it.)

Add the route in the `fetch` router (next to the other POST routes):

```javascript
    if (request.method === "POST" && url.pathname === "/code-for-session") {
      return handleCodeForSession(request, env, origin, allowed);
    }
```

Add the handler:

```javascript
const SESSION_RE = /^cs_(test|live|free)_[A-Za-z0-9_]{8,}$/;

async function handleCodeForSession(request, env, origin, allowed) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad request", reason: "bad_json" }, 400, origin, allowed);
  }
  const sessionId = (body && body.sessionId) || "";
  if (!SESSION_RE.test(sessionId)) {
    return json({ error: "invalid session", reason: "bad_session" }, 400, origin, allowed);
  }
  const verifyUrl = env.STRIPE_VERIFY_DD_URL || "https://payments.ncdata.eu/api/stripe/verify-dd-payment";
  const verified = await verifyDdPayment(sessionId, verifyUrl);
  if (!verified) {
    return json({ error: "payment not verified", reason: "not_paid" }, 403, origin, allowed);
  }
  const ent = await getEntitlementBySession(env.ENTITLEMENTS_DB, sessionId);
  if (!ent) {
    return json({ error: "no code for session", reason: "not_found" }, 404, origin, allowed);
  }
  if (ent.email !== verified.customerEmail) {
    return json({ error: "email mismatch", reason: "email_mismatch" }, 403, origin, allowed);
  }
  return json({ code: ent.code, email: ent.email, expires_at: ent.expires_at }, 200, origin, allowed);
}
```

- [ ] **Step 10: Run → GREEN, then full suite**

Run: `npm test -- code-for-session` → PASS (5). Then `npm test` → all suites pass. Then `node scripts/check-schema-drift.mjs` → OK (no schema change, must still pass).

- [ ] **Step 11: Commit**

```bash
cd /Users/alessandronurnberg/standalone_rag/local-rag
git add workers/ai-investigation/src workers/ai-investigation/test workers/ai-investigation/wrangler.jsonc
git commit -m "feat(ai-investigation): POST /code-for-session (paid-session-gated code lookup)"
```

---

### Task 2: Order-page code display + gate pre-fill

**Files:**
- Modify: `src/utils/aiInvestigationClient.js` (add `buildCodeForSessionBody`)
- Modify: `test/ai-investigation-client.test.mjs` (cover it)
- Modify: `src/components/AIInvestigationGate.jsx` (add `prefillCode` prop + sync)
- Modify: `src/components/OrderStatusPage.jsx` (fetch + display code, pass `prefillCode`)

(Paths relative to `/Users/alessandronurnberg/mapasocietario/`.)

**Interfaces:**
- Consumes: `AI_INVESTIGATION_API` (existing); the worker `POST /code-for-session` → `{ code, email, expires_at }`.
- Produces: `buildCodeForSessionBody(sessionId)` → `{ sessionId }`; `AIInvestigationGate` accepts `prefillCode`.

- [ ] **Step 1: Add failing util test**

In `test/ai-investigation-client.test.mjs`, add:

```javascript
test('buildCodeForSessionBody wraps the sessionId', () => {
  assert.deepEqual(buildCodeForSessionBody('cs_test_x'), { sessionId: 'cs_test_x' });
});
```
And add `buildCodeForSessionBody` to the existing import from `../src/utils/aiInvestigationClient.js`.

- [ ] **Step 2: Run → RED**

Run: `cd /Users/alessandronurnberg/mapasocietario && node --test test/ai-investigation-client.test.mjs`
Expected: FAIL — `buildCodeForSessionBody` is not exported.

- [ ] **Step 3: Implement the helper**

In `src/utils/aiInvestigationClient.js` add:

```javascript
export function buildCodeForSessionBody(sessionId) {
  return { sessionId: String(sessionId || '') };
}
```

- [ ] **Step 4: Run → GREEN**

Run: `node --test test/ai-investigation-client.test.mjs` → PASS (8).

- [ ] **Step 5: Add `prefillCode` to the gate**

In `src/components/AIInvestigationGate.jsx`:
- Add `prefillCode = ''` to the destructured props.
- Change the code state init to `const [code, setCode] = useState(prefillCode);`
- Add a sync effect next to the existing `prefillEmail` effect:

```jsx
  useEffect(() => { if (prefillCode) setCode(prefillCode); }, [prefillCode]);
```

- [ ] **Step 6: Fetch + display the code on the order page**

In `src/components/OrderStatusPage.jsx`:
- Add imports (if not present): `AI_INVESTIGATION_API` from `../config`, `buildCodeForSessionBody` from `../utils/aiInvestigationClient`.
- Add state: `const [aiCode, setAiCode] = useState(null);`
- Add an effect that fetches the code once the order is `ready` (the session is paid):

```jsx
  useEffect(() => {
    if (status !== 'ready' || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${AI_INVESTIGATION_API}/code-for-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildCodeForSessionBody(sessionId)),
        });
        if (!res.ok) return; // 404 (older order) / 403 → just don't show the code block
        const data = await res.json();
        if (!cancelled) setAiCode(data.code || null);
      } catch { /* network — silently skip the code block */ }
    })();
    return () => { cancelled = true; };
  }, [status, sessionId]);
```

- In the `ready` JSX, just above the existing AI Investigation button, render the code when present:

```jsx
          {aiCode && (
            <Box sx={{ mt: 2, p: 2, borderRadius: 1, bgcolor: 'rgba(25,118,210,0.08)', border: '1px solid rgba(25,118,210,0.3)' }}>
              <Typography variant="body2" color="text.secondary">
                {language === 'en' ? 'Your AI Investigation code (valid 2 days):' : 'Tu código de Investigación por IA (válido 2 días):'}
              </Typography>
              <Typography variant="h6" sx={{ fontFamily: 'monospace', letterSpacing: 1 }}>{aiCode}</Typography>
            </Box>
          )}
```

- Pass it to the gate: add `prefillCode={aiCode || ''}` to the existing `<AIInvestigationGate ... />`.
- If `Box`/`Typography` aren't already imported in OrderStatusPage, add them to the MUI import.

- [ ] **Step 7: Verify**

Run: `node --test test/ai-investigation-client.test.mjs` (8 pass) and `npx vite build` (compiles; do NOT run `npm run build`).

- [ ] **Step 8: Commit**

```bash
cd /Users/alessandronurnberg/mapasocietario
git add src/utils/aiInvestigationClient.js test/ai-investigation-client.test.mjs src/components/AIInvestigationGate.jsx src/components/OrderStatusPage.jsx
git commit -m "feat: surface AI Investigation code on order page + prefill gate"
```

---

## Self-Review
- Code delivery without a MailerSend template → order-page display (Task B Step 6). ✓
- Authorization = server-side verified paid session, not client claim (Task A handler). ✓ Email cross-check. ✓
- Hermetic tests (mocked verify-dd-payment). ✓
- Identity model preserved (code shown + prefilled; gate still does email+code+Turnstile redeem; no session-issued JWT). ✓
- Graceful fallback: 404/403/network → code block simply not shown (older orders unaffected). ✓
