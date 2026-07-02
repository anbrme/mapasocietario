# Free DD Per-Email Gate + Admin Visibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the free-first Due Diligence report genuinely one-per-email (server-enforced + reflected in the checkout UI), and give the owner an admin "Free DD" tab to see redemptions, follow-up opt-ins, and abuse attempts, with manual block/reset/waiver controls.

**Architecture:** All new state lives in the existing `PAYMENTS_R2` bucket under `free_first_report_*` prefixes. A new, fully unit-tested worker module `free-report-gate.js` holds the pure identity function and all R2-backed gate/admin logic; the existing `handleCreateDDCheckoutSession` and a handful of thin new route handlers call into it. The frontend gains a debounced eligibility check in the checkout dialog and a new `FreeReportsTab` admin component.

**Tech Stack:** Cloudflare Workers (`stripe-handler`, ESM), `@cloudflare/vitest-pool-workers` + vitest for worker tests, React + MUI (mapasocietario frontend). Two repos: `local-rag` (worker) and `mapasocietario` (frontend). Both are already on branch `feat/free-dd-email-gate`.

## Global Constraints

- Worker path base: `const baseApiRoute = '/api/stripe'` — all new worker routes are under it.
- Admin auth: `Authorization: Bearer ${env.ADMIN_SECRET}` (same as `handleListFSOrders`). Return `401 {"error":"Unauthorized"}` on mismatch.
- R2 keys derive from the canonical identity via `encodeURIComponent(canonical)`.
- R2 key prefixes (exact): ledger `free_first_report_email/`, abuse `free_first_report_abuse/`, block `free_first_report_block/`, waiver `free_first_report_waiver/`, counter `free_first_report_counter` (unchanged). Note each prefix except the counter ends in `/`, so `list({prefix})` never cross-matches.
- Global cap unchanged: `parseInt(env.FREE_FIRST_REPORT_LIMIT || '50', 10)`.
- Hardcoded waived emails (verbatim, moved into the new module): `anurnberg@nurnbergconsulting.com`, `anbr2me@gmail.com`, `jose.fajardo@hethintelligence.com`, `william.lee@securevalue.org`.
- Precedence everywhere: **waiver → block → ledger → global-cap**. A waiver overrides a block.
- Worker repo root for commands: `standalone_rag/local-rag/workers/stripe-handler`. Run tests with `npm test` (`vitest run`).
- Frontend uses `PAYMENTS_API` from `../config` and reaches endpoints at `${PAYMENTS_API}/api/stripe/...`. mapasocietario has no JS test runner — frontend tasks verify via `npm run build` + described manual checks.
- Frontend copy is bilingual: add EN and ES strings to the existing `DD_COPY` object in `DDCheckoutDialog.jsx`.
- Commit with `git -c commit.gpgsign=false commit` (1Password signing fails non-interactively). End commit messages with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
- Deploy order (after merge): worker first, then frontend (the dialog depends on the new eligibility endpoint).

---

## File Structure

**local-rag (worker):**
- Create `workers/stripe-handler/src/free-report-gate.js` — identity fn + all R2 gate/admin logic (Tasks 1–4).
- Create `workers/stripe-handler/test/free-report-gate.spec.js` — unit tests (Tasks 1–4).
- Modify `workers/stripe-handler/src/index.js` — imports, `handleCreateDDCheckoutSession` wiring, new route handlers + registration (Task 5).

**mapasocietario (frontend):**
- Modify `src/components/DDCheckoutDialog.jsx` — eligibility check + defensive submit + copy (Task 6).
- Create `src/components/FreeReportsTab.jsx` — admin tab component (Task 7).
- Modify `src/components/AdminPage.jsx` — register the third tab (Task 7).

---

## Task 1: Email identity normalization

**Files:**
- Create: `workers/stripe-handler/src/free-report-gate.js`
- Test: `workers/stripe-handler/test/free-report-gate.spec.js`

**Interfaces:**
- Produces: `freeReportEmailIdentity(email: string) => string` (canonical identity). `export const WAIVED_EMAILS: string[]`.

- [ ] **Step 1: Write the failing test**

Create `workers/stripe-handler/test/free-report-gate.spec.js`:

```js
import { describe, it, expect } from "vitest";
import { freeReportEmailIdentity } from "../src/free-report-gate.js";

describe("freeReportEmailIdentity", () => {
  it("lowercases and trims", () => {
    expect(freeReportEmailIdentity("  Plain@Example.COM ")).toBe("plain@example.com");
  });
  it("strips +tags for all domains", () => {
    expect(freeReportEmailIdentity("first.last+promo@proton.me")).toBe("first.last@proton.me");
  });
  it("folds Gmail dots and +tags", () => {
    expect(freeReportEmailIdentity("U.S.er+promo@Gmail.com")).toBe("user@gmail.com");
  });
  it("folds googlemail to gmail", () => {
    expect(freeReportEmailIdentity("user+x@googlemail.com")).toBe("user@gmail.com");
  });
  it("keeps dots for non-Gmail", () => {
    expect(freeReportEmailIdentity("a.b.c@outlook.com")).toBe("a.b.c@outlook.com");
  });
  it("returns lowercased raw for malformed input", () => {
    expect(freeReportEmailIdentity("not-an-email")).toBe("not-an-email");
    expect(freeReportEmailIdentity("")).toBe("");
    expect(freeReportEmailIdentity(null)).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- free-report-gate` (from `workers/stripe-handler`)
Expected: FAIL — cannot resolve `../src/free-report-gate.js`.

- [ ] **Step 3: Write minimal implementation**

Create `workers/stripe-handler/src/free-report-gate.js`:

```js
// workers/stripe-handler/src/free-report-gate.js
// Per-email gate + admin controls for the free-first-DD program.
// All state lives in PAYMENTS_R2 under free_first_report_* prefixes.

// Emails that always get free reports, uncapped (admin/partner accounts).
// Kept here (not in index.js) so both the gate and the eligibility endpoint
// share one source of truth.
export const WAIVED_EMAILS = [
  'anurnberg@nurnbergconsulting.com',
  'anbr2me@gmail.com',
  'jose.fajardo@hethintelligence.com',
  'william.lee@securevalue.org',
];

const LEDGER_PREFIX = 'free_first_report_email/';
const ABUSE_PREFIX = 'free_first_report_abuse/';
const BLOCK_PREFIX = 'free_first_report_block/';
const WAIVER_PREFIX = 'free_first_report_waiver/';
const COUNTER_KEY = 'free_first_report_counter';

// Canonical identity: lowercase/trim, strip +tags (all domains), fold Gmail dots.
export function freeReportEmailIdentity(email) {
  const raw = String(email || '').trim().toLowerCase();
  const at = raw.indexOf('@');
  if (at === -1 || raw.indexOf('@', at + 1) !== -1) return raw; // no/malformed @
  let local = raw.slice(0, at);
  let domain = raw.slice(at + 1);
  const plus = local.indexOf('+');
  if (plus !== -1) local = local.slice(0, plus);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
    domain = 'gmail.com';
  }
  return `${local}@${domain}`;
}

function keysFor(canonical) {
  const enc = encodeURIComponent(canonical);
  return {
    ledgerKey: `${LEDGER_PREFIX}${enc}`,
    blockKey: `${BLOCK_PREFIX}${enc}`,
    waiverKey: `${WAIVER_PREFIX}${enc}`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- free-report-gate`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add workers/stripe-handler/src/free-report-gate.js workers/stripe-handler/test/free-report-gate.spec.js
git -c commit.gpgsign=false commit -m "feat(free-dd): canonical email identity for per-email gate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Eligibility check (R2-backed)

**Files:**
- Modify: `workers/stripe-handler/src/free-report-gate.js`
- Test: `workers/stripe-handler/test/free-report-gate.spec.js`

**Interfaces:**
- Consumes: `freeReportEmailIdentity`, `WAIVED_EMAILS`, `keysFor`.
- Produces:
  - `isWaivedIdentity(env, email) => Promise<boolean>`
  - `checkFreeReportEligibility(env, email) => Promise<{ eligible: boolean, reason: string }>` where `reason ∈ {'unknown','waived','blocked','already_used','limit_reached','ok'}`.

- [ ] **Step 1: Write the failing test**

Append to `test/free-report-gate.spec.js` (add `beforeEach` + `env` imports at top — update the import line to `import { describe, it, expect, beforeEach } from "vitest";` and add `import { env } from "cloudflare:test";`):

```js
import {
  isWaivedIdentity,
  checkFreeReportEligibility,
} from "../src/free-report-gate.js";

// Clear all free_first_report_* R2 state between tests.
async function clearFreeReportR2() {
  const prefixes = [
    "free_first_report_email/", "free_first_report_abuse/",
    "free_first_report_block/", "free_first_report_waiver/",
  ];
  for (const p of prefixes) {
    const list = await env.PAYMENTS_R2.list({ prefix: p });
    await Promise.all(list.objects.map((o) => env.PAYMENTS_R2.delete(o.key)));
  }
  await env.PAYMENTS_R2.delete("free_first_report_counter");
}

describe("checkFreeReportEligibility", () => {
  beforeEach(clearFreeReportR2);

  it("returns unknown for blank email", async () => {
    expect(await checkFreeReportEligibility(env, "")).toEqual({ eligible: true, reason: "unknown" });
  });
  it("returns waived for a hardcoded WAIVED_EMAIL", async () => {
    expect(await checkFreeReportEligibility(env, "anurnberg@nurnbergconsulting.com"))
      .toEqual({ eligible: true, reason: "waived" });
  });
  it("returns ok for a fresh email", async () => {
    expect(await checkFreeReportEligibility(env, "fresh@example.com"))
      .toEqual({ eligible: true, reason: "ok" });
  });
  it("returns already_used once a ledger entry exists", async () => {
    await env.PAYMENTS_R2.put("free_first_report_email/" + encodeURIComponent("used@example.com"), "{}");
    expect(await checkFreeReportEligibility(env, "used@example.com"))
      .toEqual({ eligible: false, reason: "already_used" });
  });
  it("returns blocked when a block key exists", async () => {
    await env.PAYMENTS_R2.put("free_first_report_block/" + encodeURIComponent("bad@example.com"), "{}");
    expect(await checkFreeReportEligibility(env, "bad@example.com"))
      .toEqual({ eligible: false, reason: "blocked" });
  });
  it("waiver overrides an existing block", async () => {
    const enc = encodeURIComponent("vip@example.com");
    await env.PAYMENTS_R2.put("free_first_report_block/" + enc, "{}");
    await env.PAYMENTS_R2.put("free_first_report_waiver/" + enc, "{}");
    expect(await isWaivedIdentity(env, "vip@example.com")).toBe(true);
    expect(await checkFreeReportEligibility(env, "vip@example.com"))
      .toEqual({ eligible: true, reason: "waived" });
  });
  it("returns limit_reached when the global counter is at the cap", async () => {
    await env.PAYMENTS_R2.put("free_first_report_counter", JSON.stringify({ count: 50 }));
    expect(await checkFreeReportEligibility(env, "late@example.com"))
      .toEqual({ eligible: false, reason: "limit_reached" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- free-report-gate`
Expected: FAIL — `isWaivedIdentity` / `checkFreeReportEligibility` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/free-report-gate.js`:

```js
async function r2Has(env, key) {
  if (!env.PAYMENTS_R2) return false;
  return !!(await env.PAYMENTS_R2.head(key));
}

// Hardcoded list OR dynamic waiver allowlist.
export async function isWaivedIdentity(env, email) {
  if (!email) return false;
  if (WAIVED_EMAILS.includes(String(email).trim().toLowerCase())) return true;
  const { waiverKey } = keysFor(freeReportEmailIdentity(email));
  return r2Has(env, waiverKey);
}

async function freeReportCount(env) {
  try {
    const existing = env.PAYMENTS_R2 && await env.PAYMENTS_R2.get(COUNTER_KEY);
    if (existing) return (JSON.parse(await existing.text()).count) || 0;
  } catch { /* treat missing/corrupt as 0 */ }
  return 0;
}

function freeReportLimit(env) {
  return parseInt(env.FREE_FIRST_REPORT_LIMIT || '50', 10);
}

// Pre-checkout UX aid. Never throws. Precedence: waiver > block > ledger > cap.
export async function checkFreeReportEligibility(env, email) {
  if (!email || !String(email).trim()) return { eligible: true, reason: 'unknown' };
  if (await isWaivedIdentity(env, email)) return { eligible: true, reason: 'waived' };
  const { ledgerKey, blockKey } = keysFor(freeReportEmailIdentity(email));
  if (await r2Has(env, blockKey)) return { eligible: false, reason: 'blocked' };
  if (await r2Has(env, ledgerKey)) return { eligible: false, reason: 'already_used' };
  if (await freeReportCount(env) >= freeReportLimit(env)) return { eligible: false, reason: 'limit_reached' };
  return { eligible: true, reason: 'ok' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- free-report-gate`
Expected: PASS (all Task 1 + Task 2 tests).

- [ ] **Step 5: Commit**

```bash
git add workers/stripe-handler/src/free-report-gate.js workers/stripe-handler/test/free-report-gate.spec.js
git -c commit.gpgsign=false commit -m "feat(free-dd): R2-backed eligibility check with waiver/block/ledger/cap precedence

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Redemption gate + record writers

**Files:**
- Modify: `workers/stripe-handler/src/free-report-gate.js`
- Test: `workers/stripe-handler/test/free-report-gate.spec.js`

**Interfaces:**
- Consumes: `freeReportEmailIdentity`, `keysFor`, `r2Has`.
- Produces:
  - `recordFreeReportAbuse(env, { email, canonical?, reason, meta? }) => Promise<void>`
  - `recordFreeReportRedemption(env, { email, sessionId, followUpOptIn?, intake?, meta? }) => Promise<void>`
  - `evaluateFreeReportGate(env, { email, meta? }) => Promise<{ decision:'allow' } | { decision:'reject', status:number, error:string }>` — writes an abuse record on reject; does NOT write the ledger.

- [ ] **Step 1: Write the failing test**

Append to `test/free-report-gate.spec.js`:

```js
import {
  evaluateFreeReportGate,
  recordFreeReportRedemption,
  recordFreeReportAbuse,
} from "../src/free-report-gate.js";

describe("evaluateFreeReportGate", () => {
  beforeEach(clearFreeReportR2);
  const meta = { country: "es", companyIdentifier: "X", companyName: "Acme SL" };

  it("allows a fresh identity", async () => {
    expect(await evaluateFreeReportGate(env, { email: "new@example.com", meta }))
      .toEqual({ decision: "allow" });
  });
  it("rejects a previously-redeemed identity and logs abuse", async () => {
    await recordFreeReportRedemption(env, { email: "again@example.com", sessionId: "cs_free_1", meta });
    const res = await evaluateFreeReportGate(env, { email: "AG.AIN@example.com", meta });
    expect(res).toMatchObject({ decision: "reject", status: 403, error: "free_report_already_used" });
    const abuse = await env.PAYMENTS_R2.list({ prefix: "free_first_report_abuse/" });
    expect(abuse.objects.length).toBe(1);
  });
  it("rejects a blocked identity with free_report_blocked", async () => {
    await env.PAYMENTS_R2.put("free_first_report_block/" + encodeURIComponent("blk@example.com"), "{}");
    const res = await evaluateFreeReportGate(env, { email: "blk@example.com", meta });
    expect(res).toMatchObject({ decision: "reject", status: 403, error: "free_report_blocked" });
  });
  it("recordFreeReportRedemption writes a ledger entry keyed by canonical identity", async () => {
    await recordFreeReportRedemption(env, {
      email: "Ledger.Test+x@gmail.com", sessionId: "cs_free_2",
      followUpOptIn: true, intake: { role: "buyer", need: "check supplier" }, meta,
    });
    const key = "free_first_report_email/" + encodeURIComponent("ledgertest@gmail.com");
    const obj = await env.PAYMENTS_R2.get(key);
    expect(obj).not.toBeNull();
    const p = JSON.parse(await obj.text());
    expect(p.followUpOptIn).toBe(true);
    expect(p.sessionId).toBe("cs_free_2");
    expect(p.intakeRole).toBe("buyer");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- free-report-gate`
Expected: FAIL — `evaluateFreeReportGate` / record functions not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/free-report-gate.js`:

```js
export async function recordFreeReportAbuse(env, { email, canonical, reason, meta = {} }) {
  if (!env.PAYMENTS_R2) return;
  const id = canonical || freeReportEmailIdentity(email);
  const key = `${ABUSE_PREFIX}${encodeURIComponent(id)}_${Date.now()}`;
  try {
    await env.PAYMENTS_R2.put(key, JSON.stringify({
      canonicalEmail: id,
      originalEmail: email,
      attemptedAt: new Date().toISOString(),
      reason,
      country: meta.country,
      companyIdentifier: meta.companyIdentifier,
      companyName: (meta.companyName || '').substring(0, 500),
    }));
  } catch (e) { console.error('recordFreeReportAbuse failed:', e); }
}

export async function recordFreeReportRedemption(env, { email, sessionId, followUpOptIn, intake = {}, meta = {} }) {
  if (!env.PAYMENTS_R2) return;
  const canonical = freeReportEmailIdentity(email);
  const { ledgerKey } = keysFor(canonical);
  try {
    await env.PAYMENTS_R2.put(ledgerKey, JSON.stringify({
      canonicalEmail: canonical,
      originalEmail: email,
      firstRedeemedAt: new Date().toISOString(),
      sessionId,
      country: meta.country,
      companyIdentifier: meta.companyIdentifier,
      companyName: (meta.companyName || '').substring(0, 500),
      followUpOptIn: !!followUpOptIn,
      intakeRole: String(intake.role || '').substring(0, 100),
      intakeNeed: String(intake.need || '').substring(0, 480),
    }));
  } catch (e) { console.error('recordFreeReportRedemption failed:', e); }
}

// Gate for the actual free redemption. Caller has already established this is a
// non-waived free-first request with a present email. Writes an abuse record on
// rejection; does NOT write the ledger (caller writes it after the global-cap
// check passes). Precedence: block > ledger.
export async function evaluateFreeReportGate(env, { email, meta = {} }) {
  const canonical = freeReportEmailIdentity(email);
  const { ledgerKey, blockKey } = keysFor(canonical);
  if (await r2Has(env, blockKey)) {
    await recordFreeReportAbuse(env, { email, canonical, reason: 'blocked', meta });
    return { decision: 'reject', status: 403, error: 'free_report_blocked' };
  }
  if (await r2Has(env, ledgerKey)) {
    await recordFreeReportAbuse(env, { email, canonical, reason: 'already_used', meta });
    return { decision: 'reject', status: 403, error: 'free_report_already_used' };
  }
  return { decision: 'allow' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- free-report-gate`
Expected: PASS (all tests through Task 3).

- [ ] **Step 5: Commit**

```bash
git add workers/stripe-handler/src/free-report-gate.js workers/stripe-handler/test/free-report-gate.spec.js
git -c commit.gpgsign=false commit -m "feat(free-dd): redemption gate + ledger/abuse record writers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Admin actions + listing

**Files:**
- Modify: `workers/stripe-handler/src/free-report-gate.js`
- Test: `workers/stripe-handler/test/free-report-gate.spec.js`

**Interfaces:**
- Consumes: all prior module exports + prefixes.
- Produces (each admin action returns `{ canonicalEmail }`):
  - `blockFreeReport(env, email)`, `unblockFreeReport(env, email)`
  - `grantFreeReportWaiver(env, email)`, `revokeFreeReportWaiver(env, email)`
  - `resetFreeReport(env, email)` (deletes ledger + this identity's abuse records)
  - `listFreeReports(env) => Promise<{ redemptions, abuseAttempts, blocked, waivers, summary }>`

- [ ] **Step 1: Write the failing test**

Append to `test/free-report-gate.spec.js`:

```js
import {
  blockFreeReport, unblockFreeReport,
  grantFreeReportWaiver, revokeFreeReportWaiver,
  resetFreeReport, listFreeReports,
} from "../src/free-report-gate.js";

describe("admin actions", () => {
  beforeEach(clearFreeReportR2);
  const meta = { country: "es", companyIdentifier: "X", companyName: "Acme SL" };

  it("block then unblock toggles eligibility", async () => {
    await blockFreeReport(env, "x@example.com");
    expect((await checkFreeReportEligibility(env, "x@example.com")).reason).toBe("blocked");
    await unblockFreeReport(env, "x@example.com");
    expect((await checkFreeReportEligibility(env, "x@example.com")).reason).toBe("ok");
  });
  it("grant then revoke waiver toggles waived", async () => {
    await grantFreeReportWaiver(env, "vip@example.com");
    expect(await isWaivedIdentity(env, "vip@example.com")).toBe(true);
    await revokeFreeReportWaiver(env, "vip@example.com");
    expect(await isWaivedIdentity(env, "vip@example.com")).toBe(false);
  });
  it("reset makes a redeemed identity eligible again and clears its abuse", async () => {
    await recordFreeReportRedemption(env, { email: "r@example.com", sessionId: "cs_free_3", meta });
    await recordFreeReportAbuse(env, { email: "r@example.com", reason: "already_used", meta });
    await resetFreeReport(env, "r@example.com");
    expect((await checkFreeReportEligibility(env, "r@example.com")).reason).toBe("ok");
    const abuse = await env.PAYMENTS_R2.list({ prefix: "free_first_report_abuse/" });
    expect(abuse.objects.length).toBe(0);
  });
});

describe("listFreeReports", () => {
  beforeEach(clearFreeReportR2);
  const meta = { country: "es", companyIdentifier: "X", companyName: "Acme SL" };

  it("aggregates redemptions, abuse (grouped+counted), blocked, waivers, summary", async () => {
    await recordFreeReportRedemption(env, { email: "a@example.com", sessionId: "cs_free_a", followUpOptIn: true, meta });
    await recordFreeReportRedemption(env, { email: "b@example.com", sessionId: "cs_free_b", followUpOptIn: false, meta });
    await recordFreeReportAbuse(env, { email: "a@example.com", reason: "already_used", meta });
    await recordFreeReportAbuse(env, { email: "a@example.com", reason: "already_used", meta });
    await blockFreeReport(env, "bad@example.com");
    await grantFreeReportWaiver(env, "vip@example.com");

    const out = await listFreeReports(env);
    expect(out.summary.redeemedCount).toBe(2);
    expect(out.summary.followUpOptInCount).toBe(1);
    expect(out.summary.abuseAttemptCount).toBe(2);
    expect(out.summary.blockedCount).toBe(1);
    expect(out.summary.waiverCount).toBe(1);
    const aAbuse = out.abuseAttempts.find((x) => x.canonicalEmail === "a@example.com");
    expect(aAbuse.count).toBe(2);
  });

  it("backfills historical free redemptions from dd_orders markers, deduped by ledger", async () => {
    await env.PAYMENTS_R2.put("dd_orders/cs_free_old", JSON.stringify({
      sessionId: "cs_free_old", freeFirstReport: true, customerEmail: "old@example.com",
      companyName: "Old Co", country: "es", createdAt: "2026-06-01T00:00:00.000Z",
      intake: { role: "buyer", need: "x", followUpOptIn: true },
    }));
    const out = await listFreeReports(env);
    const old = out.redemptions.find((r) => r.canonicalEmail === "old@example.com");
    expect(old.source).toBe("dd_orders_backfill");
    expect(old.followUpOptIn).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- free-report-gate`
Expected: FAIL — admin action / listing functions not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/free-report-gate.js`:

```js
export async function blockFreeReport(env, email) {
  const canonical = freeReportEmailIdentity(email);
  const { blockKey } = keysFor(canonical);
  await env.PAYMENTS_R2.put(blockKey, JSON.stringify({ canonicalEmail: canonical, blockedAt: new Date().toISOString() }));
  return { canonicalEmail: canonical };
}

export async function unblockFreeReport(env, email) {
  const canonical = freeReportEmailIdentity(email);
  await env.PAYMENTS_R2.delete(keysFor(canonical).blockKey);
  return { canonicalEmail: canonical };
}

export async function grantFreeReportWaiver(env, email) {
  const canonical = freeReportEmailIdentity(email);
  const { waiverKey } = keysFor(canonical);
  await env.PAYMENTS_R2.put(waiverKey, JSON.stringify({ canonicalEmail: canonical, grantedAt: new Date().toISOString() }));
  return { canonicalEmail: canonical };
}

export async function revokeFreeReportWaiver(env, email) {
  const canonical = freeReportEmailIdentity(email);
  await env.PAYMENTS_R2.delete(keysFor(canonical).waiverKey);
  return { canonicalEmail: canonical };
}

// Grant one more free report: drop the ledger entry + this identity's abuse log.
export async function resetFreeReport(env, email) {
  const canonical = freeReportEmailIdentity(email);
  const enc = encodeURIComponent(canonical);
  await env.PAYMENTS_R2.delete(`${LEDGER_PREFIX}${enc}`);
  const list = await env.PAYMENTS_R2.list({ prefix: `${ABUSE_PREFIX}${enc}_` });
  await Promise.all(list.objects.map((o) => env.PAYMENTS_R2.delete(o.key)));
  return { canonicalEmail: canonical };
}

async function readJson(env, key) {
  try { const d = await env.PAYMENTS_R2.get(key); return d ? JSON.parse(await d.text()) : null; }
  catch { return null; }
}

export async function listFreeReports(env) {
  const redemptionsByCanon = new Map();
  const abuseByCanon = new Map();
  const blocked = [];
  const waivers = [];

  // Ledger redemptions (authoritative).
  const ledgerList = await env.PAYMENTS_R2.list({ prefix: LEDGER_PREFIX });
  for (const obj of ledgerList.objects) {
    const p = await readJson(env, obj.key);
    if (!p) continue;
    redemptionsByCanon.set(p.canonicalEmail, {
      canonicalEmail: p.canonicalEmail,
      originalEmail: p.originalEmail,
      redeemedAt: p.firstRedeemedAt,
      company: p.companyName || p.companyIdentifier,
      country: p.country,
      sessionId: p.sessionId,
      followUpOptIn: !!p.followUpOptIn,
      intakeRole: p.intakeRole,
      intakeNeed: p.intakeNeed,
      source: 'ledger',
    });
  }

  // Backfill historical free redemptions from dd_orders markers (ledger wins).
  const ddList = await env.PAYMENTS_R2.list({ prefix: 'dd_orders/' });
  for (const obj of ddList.objects) {
    const p = await readJson(env, obj.key);
    if (!p || (!p.freeFirstReport && !p.waived) || !p.customerEmail) continue;
    const canonical = freeReportEmailIdentity(p.customerEmail);
    if (redemptionsByCanon.has(canonical)) continue;
    const intake = p.intake || {};
    redemptionsByCanon.set(canonical, {
      canonicalEmail: canonical,
      originalEmail: p.customerEmail,
      redeemedAt: p.createdAt,
      company: p.companyName || p.companyIdentifier,
      country: p.country,
      sessionId: p.sessionId,
      followUpOptIn: !!intake.followUpOptIn,
      intakeRole: intake.role,
      intakeNeed: intake.need,
      source: 'dd_orders_backfill',
    });
  }

  // Abuse attempts grouped by canonical, most-recent kept, counted.
  const abuseList = await env.PAYMENTS_R2.list({ prefix: ABUSE_PREFIX });
  for (const obj of abuseList.objects) {
    const p = await readJson(env, obj.key);
    if (!p) continue;
    const cur = abuseByCanon.get(p.canonicalEmail) || {
      canonicalEmail: p.canonicalEmail, originalEmail: p.originalEmail,
      attemptedAt: p.attemptedAt, reason: p.reason,
      company: p.companyName || p.companyIdentifier, count: 0,
    };
    cur.count += 1;
    if (!cur.attemptedAt || (p.attemptedAt || '') > cur.attemptedAt) {
      cur.attemptedAt = p.attemptedAt; cur.originalEmail = p.originalEmail; cur.reason = p.reason;
    }
    abuseByCanon.set(p.canonicalEmail, cur);
  }

  for (const obj of (await env.PAYMENTS_R2.list({ prefix: BLOCK_PREFIX })).objects) {
    const p = await readJson(env, obj.key);
    if (p) blocked.push({ canonicalEmail: p.canonicalEmail, blockedAt: p.blockedAt });
  }
  for (const obj of (await env.PAYMENTS_R2.list({ prefix: WAIVER_PREFIX })).objects) {
    const p = await readJson(env, obj.key);
    if (p) waivers.push({ canonicalEmail: p.canonicalEmail, grantedAt: p.grantedAt });
  }

  const redemptions = [...redemptionsByCanon.values()]
    .sort((a, b) => new Date(b.redeemedAt || 0) - new Date(a.redeemedAt || 0));
  const abuseAttempts = [...abuseByCanon.values()]
    .sort((a, b) => new Date(b.attemptedAt || 0) - new Date(a.attemptedAt || 0));

  return {
    redemptions, abuseAttempts, blocked, waivers,
    summary: {
      redeemedCount: redemptions.length,
      limit: freeReportLimit(env),
      followUpOptInCount: redemptions.filter((r) => r.followUpOptIn).length,
      abuseAttemptCount: abuseAttempts.reduce((s, a) => s + a.count, 0),
      blockedCount: blocked.length,
      waiverCount: waivers.length,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- free-report-gate`
Expected: PASS (entire module test suite).

- [ ] **Step 5: Commit**

```bash
git add workers/stripe-handler/src/free-report-gate.js workers/stripe-handler/test/free-report-gate.spec.js
git -c commit.gpgsign=false commit -m "feat(free-dd): admin block/reset/waiver actions + list aggregation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire the gate + endpoints into the worker

**Files:**
- Modify: `workers/stripe-handler/src/index.js` (imports near line 177–185; `handleCreateDDCheckoutSession` free block lines ~1694–1825; new handlers before the `fetch` export ~line 2700; router registration in POST block ~line 2829 and GET block ~line 3172)

**Interfaces:**
- Consumes: `free-report-gate.js` exports.
- Produces (route contracts): `POST /api/stripe/check-free-report-eligibility` → `{eligible,reason}`; `GET /api/stripe/list-free-reports` (admin); `POST /api/stripe/{block,unblock,reset}-free-report` and `.../{grant,revoke}-free-report-waiver` (admin, body `{email}`).

- [ ] **Step 1: Add the module import**

In `src/index.js`, after the existing import block (the group ending with `import { handleManualBalanceFix, handleGetBalanceDebug } from './manual-balance-fix.js';`, ~line 185), add:

```js
import {
  freeReportEmailIdentity,
  isWaivedIdentity,
  evaluateFreeReportGate,
  recordFreeReportRedemption,
  checkFreeReportEligibility,
  listFreeReports,
  blockFreeReport,
  unblockFreeReport,
  resetFreeReport,
  grantFreeReportWaiver,
  revokeFreeReportWaiver,
} from './free-report-gate.js';
```

- [ ] **Step 2: Rewrite the free/waiver block in `handleCreateDDCheckoutSession`**

Replace the block that currently begins:

```js
  const WAIVED_EMAILS = ['anurnberg@nurnbergconsulting.com', 'anbr2me@gmail.com', 'jose.fajardo@hethintelligence.com', 'william.lee@securevalue.org'];
  const isWaivedEmail = !!email && WAIVED_EMAILS.includes(email.toLowerCase());
  const isFreeFirstReport = freeFirstReport === true;
  if (isWaivedEmail || isFreeFirstReport) {
    // Cap the public free-first-report program (admin waivers stay uncapped).
    // Counter lives in R2; default 50, overridable via FREE_FIRST_REPORT_LIMIT.
    if (isFreeFirstReport && !isWaivedEmail && env.PAYMENTS_R2) {
      const limit = parseInt(env.FREE_FIRST_REPORT_LIMIT || '50', 10);
      let count = 0;
      try {
        const existing = await env.PAYMENTS_R2.get('free_first_report_counter');
        if (existing) count = (JSON.parse(await existing.text()).count) || 0;
      } catch { /* treat missing/corrupt as 0 */ }
      if (count >= limit) {
        return { statusCode: 403, body: JSON.stringify({ error: 'free_report_limit_reached' }) };
      }
      try {
        await env.PAYMENTS_R2.put('free_first_report_counter', JSON.stringify({ count: count + 1, updatedAt: new Date().toISOString() }));
      } catch { /* non-fatal: don't block the order on the counter write */ }
    }
    const freeSessionId = `cs_free_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
```

with (note: `freeSessionId` moves to the top so the ledger write can reference it; `isWaivedEmail` → `waived`; the per-email gate + email-required check are added before the global cap; the ledger write is added after the cap):

```js
  const waived = await isWaivedIdentity(env, email);
  const isFreeFirstReport = freeFirstReport === true;
  if (waived || isFreeFirstReport) {
    const freeSessionId = `cs_free_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // Public free-first path (not an admin/dynamic waiver): enforce one per email.
    if (isFreeFirstReport && !waived) {
      if (!email || !email.trim()) {
        return { statusCode: 400, body: JSON.stringify({ error: 'free_report_email_required' }) };
      }
      const gate = await evaluateFreeReportGate(env, {
        email, meta: { country, companyIdentifier, companyName },
      });
      if (gate.decision === 'reject') {
        return { statusCode: gate.status, body: JSON.stringify({ error: gate.error }) };
      }
      // Global program cap (admin/dynamic waivers stay uncapped).
      if (env.PAYMENTS_R2) {
        const limit = parseInt(env.FREE_FIRST_REPORT_LIMIT || '50', 10);
        let count = 0;
        try {
          const existing = await env.PAYMENTS_R2.get('free_first_report_counter');
          if (existing) count = (JSON.parse(await existing.text()).count) || 0;
        } catch { /* treat missing/corrupt as 0 */ }
        if (count >= limit) {
          return { statusCode: 403, body: JSON.stringify({ error: 'free_report_limit_reached' }) };
        }
        try {
          await env.PAYMENTS_R2.put('free_first_report_counter', JSON.stringify({ count: count + 1, updatedAt: new Date().toISOString() }));
        } catch { /* non-fatal: don't block the order on the counter write */ }
      }
      // Record the per-email redemption before fulfillment (shrinks the race window).
      await recordFreeReportRedemption(env, {
        email, sessionId: freeSessionId,
        followUpOptIn: intake && intake.followUpOptIn,
        intake: intake || {},
        meta: { country, companyIdentifier, companyName },
      });
    }
```

- [ ] **Step 3: Remove the now-duplicate `freeSessionId` line and fix waived references**

Immediately after the block above, the original code had:

```js
    const freeSessionId = `cs_free_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const parsedOptions = options || {};
```

Delete that duplicate `const freeSessionId = ...` line (it is now declared at the top of the block); keep `const parsedOptions = options || {};`.

Then, within this same `if` block, update the two marker/notify payloads that reference `isWaivedEmail`:
- `waived: isWaivedEmail,` (in the `dd_orders/${freeSessionId}` marker) → `waived,`
- `waived: isWaivedEmail,` (in the `notifyFreeOrder` payload) → `waived,`

(The `waived: true` literal in the `dd_session_used` sentinel stays as-is — every order down this path is a non-Stripe order.)

- [ ] **Step 4: Add the new route handlers**

In `src/index.js`, just before the `export default {` / `async fetch(request, env, ctx)` block (search for `export default` near line 2790), add:

```js
async function handleCheckFreeReportEligibility(body, env) {
  const email = (body && body.email) || '';
  const result = await checkFreeReportEligibility(env, email);
  return { statusCode: 200, body: JSON.stringify(result) };
}

async function handleListFreeReports(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  if (!env.PAYMENTS_R2) return { statusCode: 500, body: JSON.stringify({ error: 'Storage not available' }) };
  const data = await listFreeReports(env);
  return { statusCode: 200, body: JSON.stringify(data) };
}

const FREE_REPORT_ADMIN_ACTIONS = {
  block: blockFreeReport,
  unblock: unblockFreeReport,
  reset: resetFreeReport,
  waive: grantFreeReportWaiver,
  unwaive: revokeFreeReportWaiver,
};

async function handleFreeReportAdminAction(request, env, action) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  if (!env.PAYMENTS_R2) return { statusCode: 500, body: JSON.stringify({ error: 'Storage not available' }) };
  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').trim();
  if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'email is required' }) };
  const fn = FREE_REPORT_ADMIN_ACTIONS[action];
  if (!fn) return { statusCode: 400, body: JSON.stringify({ error: 'unknown action' }) };
  const result = await fn(env, email);
  return { statusCode: 200, body: JSON.stringify({ ok: true, action, ...result }) };
}
```

- [ ] **Step 5: Register the routes**

In the POST section (after the `create-dd-checkout` route, ~line 2832), add:

```js
      if (url.pathname === `${baseApiRoute}/check-free-report-eligibility`) {
        const body = await request.json();
        const response = await handleCheckFreeReportEligibility(body, env);
        return new Response(response.body, { status: response.statusCode, headers });
      }
      if (url.pathname === `${baseApiRoute}/block-free-report`) {
        const r = await handleFreeReportAdminAction(request, env, 'block');
        return new Response(r.body, { status: r.statusCode, headers });
      }
      if (url.pathname === `${baseApiRoute}/unblock-free-report`) {
        const r = await handleFreeReportAdminAction(request, env, 'unblock');
        return new Response(r.body, { status: r.statusCode, headers });
      }
      if (url.pathname === `${baseApiRoute}/reset-free-report`) {
        const r = await handleFreeReportAdminAction(request, env, 'reset');
        return new Response(r.body, { status: r.statusCode, headers });
      }
      if (url.pathname === `${baseApiRoute}/grant-free-report-waiver`) {
        const r = await handleFreeReportAdminAction(request, env, 'waive');
        return new Response(r.body, { status: r.statusCode, headers });
      }
      if (url.pathname === `${baseApiRoute}/revoke-free-report-waiver`) {
        const r = await handleFreeReportAdminAction(request, env, 'unwaive');
        return new Response(r.body, { status: r.statusCode, headers });
      }
```

In the GET section (after the `list-fs-orders` route, ~line 3175), add:

```js
      if (url.pathname === `${baseApiRoute}/list-free-reports`) {
        const response = await handleListFreeReports(request, env);
        return new Response(response.body, { status: response.statusCode, headers });
      }
```

- [ ] **Step 6: Verify the worker still builds and tests pass**

Run: `npm test` (from `workers/stripe-handler`)
Expected: PASS — full suite (mint + free-report-gate) green.

Run: `npx wrangler deploy --dry-run` (from `workers/stripe-handler`)
Expected: bundles with no import/syntax errors (does not deploy).

- [ ] **Step 7: Commit**

```bash
git add workers/stripe-handler/src/index.js
git -c commit.gpgsign=false commit -m "feat(free-dd): enforce per-email gate + eligibility/admin endpoints in handler

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Checkout dialog — live eligibility + defensive submit

**Files:**
- Modify: `src/components/DDCheckoutDialog.jsx` (state ~line 275; copy object `DD_COPY` EN ~line 141 and ES ~line 238; the free-gate JSX ~line 713; submit error handling ~line 535)

**Interfaces:**
- Consumes: `POST ${PAYMENTS_API}/api/stripe/check-free-report-eligibility` → `{eligible,reason}`; the checkout error bodies `free_report_already_used` / `free_report_blocked` / `free_report_email_required`.

- [ ] **Step 1: Add copy strings**

In `DD_COPY.en` add (near the other `freeReport*` keys, ~line 142):

```js
    freeReportIneligible: 'This email has already used its free report.',
    freeReportProgramClosed: 'The free report offer is currently closed.',
    freeReportBlockedRetry: 'This email is not eligible for a free report. Please review and submit again to purchase.',
```

In `DD_COPY.es` add (near the ES `freeReport*` keys, ~line 238):

```js
    freeReportIneligible: 'Este correo ya ha usado su informe gratuito.',
    freeReportProgramClosed: 'La oferta de informe gratuito está cerrada por ahora.',
    freeReportBlockedRetry: 'Este correo no es elegible para un informe gratuito. Revisa y vuelve a enviar para comprarlo.',
```

- [ ] **Step 2: Add eligibility state + debounced check**

After the free-intake state (`const [followUpOptIn, setFollowUpOptIn] = useState(false);`, ~line 275) add:

```js
  // Live free-report eligibility (per-email gate mirror). Default eligible so the
  // offer shows until we learn otherwise; the backend is authoritative regardless.
  const [freeEligible, setFreeEligible] = useState(true);
  const [freeEligibilityReason, setFreeEligibilityReason] = useState('ok');
```

After the existing `useEffect` hooks (~line 313, after the Android products effect) add:

```js
  // Debounced eligibility check: when the program is on and an email is present,
  // ask the worker whether this email may still redeem a free report.
  useEffect(() => {
    if (!FREE_FIRST_REPORT_CODE || isAndroidApp) return;
    const trimmed = email.trim();
    if (!trimmed) { setFreeEligible(true); setFreeEligibilityReason('unknown'); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${PAYMENTS_API}/api/stripe/check-free-report-eligibility`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed }),
        });
        const data = await res.json();
        if (cancelled) return;
        setFreeEligible(data.eligible !== false);
        setFreeEligibilityReason(data.reason || 'ok');
        if (data.eligible === false) setUseFreeReport(false);
      } catch {
        // Network hiccup: don't block the UI — backend still enforces on submit.
        if (!cancelled) { setFreeEligible(true); setFreeEligibilityReason('ok'); }
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [email, isAndroidApp]);
```

- [ ] **Step 3: Gate the free-offer JSX and add the ineligible note**

Change the free-gate wrapper condition (~line 713) from:

```jsx
        {FREE_FIRST_REPORT_CODE && !isAndroidApp && (
```

to:

```jsx
        {FREE_FIRST_REPORT_CODE && !isAndroidApp && freeEligible && (
```

Then, immediately after that block's closing `)}` (the free-gate `<Box>`…`</Box>` wrapper, ~line 800), add an ineligible note:

```jsx
        {FREE_FIRST_REPORT_CODE && !isAndroidApp && !freeEligible && email.trim() && (
          freeEligibilityReason === 'limit_reached' ? (
            <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'text.secondary', fontSize: '0.72rem' }}>
              {copy.freeReportProgramClosed}
            </Typography>
          ) : (
            <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'text.secondary', fontSize: '0.72rem' }}>
              {copy.freeReportIneligible}
            </Typography>
          )
        )}
```

- [ ] **Step 4: Defensive submit handling**

In `handleCheckout`, replace the response handling that currently reads:

```js
      const data = await res.json();
      if (data.url) {
        localStorage.setItem('dd_return_url', window.location.href);
        if (includeFS) {
          localStorage.setItem('dd_include_fs', 'true');
        }
        window.location.href = data.url;
      } else {
        setError(copy.createCheckoutFailed);
      }
```

with:

```js
      const data = await res.json();
      const freeBlockedErrors = ['free_report_already_used', 'free_report_blocked', 'free_report_email_required'];
      if (freeBlockedErrors.includes(data.error)) {
        // The free offer is no longer valid for this email — fall back to paid.
        setUseFreeReport(false);
        setFreeEligible(false);
        setFreeEligibilityReason(data.error === 'free_report_blocked' ? 'blocked' : 'already_used');
        setError(copy.freeReportBlockedRetry);
      } else if (data.url) {
        localStorage.setItem('dd_return_url', window.location.href);
        if (includeFS) {
          localStorage.setItem('dd_include_fs', 'true');
        }
        window.location.href = data.url;
      } else {
        setError(copy.createCheckoutFailed);
      }
```

- [ ] **Step 5: Build to verify no syntax/JSX errors**

Run: `npm run build` (from mapasocietario root)
Expected: build succeeds.

- [ ] **Step 6: Manual verification**

With the worker running locally or against a deploy, and `FREE_FIRST_REPORT_CODE` set:
1. Enter a fresh email → the free offer box shows.
2. Enter an email that already has a ledger entry (seed one via the admin block/redemption or a prior redeem) → the offer hides and the "already used" note appears.
3. Submit a repeat free attempt bypassing the UI (e.g. via devtools) → checkout returns `free_report_already_used`, the toggle un-checks, and the retry-as-paid message shows.

- [ ] **Step 7: Commit**

```bash
git add src/components/DDCheckoutDialog.jsx
git -c commit.gpgsign=false commit -m "feat(free-dd): live eligibility check + defensive paid fallback in checkout dialog

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Admin "Free DD" tab

**Files:**
- Create: `src/components/FreeReportsTab.jsx`
- Modify: `src/components/AdminPage.jsx` (import ~line 26; `<Tabs>` ~line 270–273; tab-panel render after `{tab === 1 && ...}` ~line 379)

**Interfaces:**
- Consumes: `GET/POST ${PAYMENTS_API}/api/stripe/list-free-reports` and the five admin action routes (Bearer `adminKey`).

- [ ] **Step 1: Create the FreeReportsTab component**

Create `src/components/FreeReportsTab.jsx`:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, Button, TextField, CircularProgress, Alert, Chip, Divider } from '@mui/material';
import { PAYMENTS_API } from '../config';

const fmtDate = (s) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
};

export default function FreeReportsTab({ adminKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  const load = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${PAYMENTS_API}/api/stripe/list-free-reports`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (res.status === 401) { setError('Invalid admin key.'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) { setError(`Failed to load: ${e.message}`); }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { load(); }, [load]);

  // action key -> route stem under /api/stripe/.
  const route = (k) => ({
    block: 'block-free-report', unblock: 'unblock-free-report', reset: 'reset-free-report',
    grantWaiver: 'grant-free-report-waiver', revokeWaiver: 'revoke-free-report-waiver',
  }[k]);

  const call = async (k, email) => {
    if (!email) return;
    setBusy(`${k}:${email}`); setError('');
    try {
      const res = await fetch(`${PAYMENTS_API}/api/stripe/${route(k)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
      await load();
    } catch (e) { setError(`Action failed: ${e.message}`); }
    finally { setBusy(''); }
  };

  if (loading && !data) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={32} /></Box>;

  const s = data?.summary || {};
  const btn = (k, email, label, color) => (
    <Button size="small" variant="outlined" color={color || 'inherit'}
      disabled={busy === `${k}:${email}`} onClick={() => call(k, email)}
      sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0, minWidth: 0 }}>
      {busy === `${k}:${email}` ? '…' : label}
    </Button>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && <Alert severity="error" sx={{ fontSize: '0.8rem' }}>{error}</Alert>}

      <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {(s.redeemedCount ?? 0)} / {(s.limit ?? '—')} redeemed · {(s.followUpOptInCount ?? 0)} opted into follow-up · {(s.abuseAttemptCount ?? 0)} blocked attempts · {(s.waiverCount ?? 0)} waivers
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
          <TextField size="small" placeholder="email@example.com" value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8rem' } }} />
          {btn('block', manualEmail.trim(), 'Block', 'error')}
          {btn('grantWaiver', manualEmail.trim(), 'Grant waiver', 'success')}
          <Button size="small" onClick={load} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Refresh</Button>
        </Box>
      </Paper>

      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Redemptions</Typography>
      {(data?.redemptions || []).length === 0 && <Typography variant="caption" sx={{ color: 'text.secondary' }}>None yet.</Typography>}
      {(data?.redemptions || []).map((r) => (
        <Paper key={`red-${r.canonicalEmail}`} sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
              {r.originalEmail || r.canonicalEmail}
              {r.originalEmail && r.originalEmail !== r.canonicalEmail && (
                <Typography component="span" variant="caption" sx={{ color: 'text.disabled', ml: 0.5 }}>({r.canonicalEmail})</Typography>
              )}
            </Typography>
            {r.followUpOptIn && <Chip size="small" color="warning" label="follow-up OK" sx={{ height: 18, fontSize: '0.62rem' }} />}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{fmtDate(r.redeemedAt)}</Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            {r.company || '—'} · {(r.country || '').toUpperCase()} · {r.intakeRole || '—'} · {r.intakeNeed || '—'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.75 }}>
            {btn('reset', r.canonicalEmail, 'Reset (grant one more)')}
            {btn('block', r.canonicalEmail, 'Block', 'error')}
            {btn('grantWaiver', r.canonicalEmail, 'Grant waiver', 'success')}
          </Box>
        </Paper>
      ))}

      <Divider sx={{ my: 1 }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Abuse attempts</Typography>
      {(data?.abuseAttempts || []).length === 0 && <Typography variant="caption" sx={{ color: 'text.secondary' }}>None.</Typography>}
      {(data?.abuseAttempts || []).map((a) => (
        <Paper key={`ab-${a.canonicalEmail}`} sx={{ p: 1.5, bgcolor: 'rgba(255,90,90,0.05)', border: '1px solid rgba(255,90,90,0.2)', borderRadius: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
              {a.originalEmail || a.canonicalEmail}
              {a.originalEmail && a.originalEmail !== a.canonicalEmail && (
                <Typography component="span" variant="caption" sx={{ color: 'text.disabled', ml: 0.5 }}>({a.canonicalEmail})</Typography>
              )}
            </Typography>
            <Chip size="small" label={`${a.count}× ${a.reason || ''}`} sx={{ height: 18, fontSize: '0.62rem' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{fmtDate(a.attemptedAt)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.75 }}>
            {btn('block', a.canonicalEmail, 'Block', 'error')}
            {btn('grantWaiver', a.canonicalEmail, 'Grant waiver', 'success')}
          </Box>
        </Paper>
      ))}

      <Divider sx={{ my: 1 }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Blocked</Typography>
      {(data?.blocked || []).length === 0 && <Typography variant="caption" sx={{ color: 'text.secondary' }}>None.</Typography>}
      {(data?.blocked || []).map((b) => (
        <Box key={`blk-${b.canonicalEmail}`} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ flex: 1 }}>{b.canonicalEmail} · {fmtDate(b.blockedAt)}</Typography>
          {btn('unblock', b.canonicalEmail, 'Unblock')}
        </Box>
      ))}

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>Waivers</Typography>
      {(data?.waivers || []).length === 0 && <Typography variant="caption" sx={{ color: 'text.secondary' }}>None.</Typography>}
      {(data?.waivers || []).map((w) => (
        <Box key={`wv-${w.canonicalEmail}`} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ flex: 1 }}>{w.canonicalEmail} · {fmtDate(w.grantedAt)}</Typography>
          {btn('revokeWaiver', w.canonicalEmail, 'Revoke')}
        </Box>
      ))}
    </Box>
  );
}
```

- [ ] **Step 2: Register the tab in AdminPage**

Add the import after `import CnmvReviewTab from './CnmvReviewTab';` (~line 26):

```jsx
import FreeReportsTab from './FreeReportsTab';
```

Add a third `<Tab>` inside the `<Tabs>` (after the CNMV tab, ~line 272):

```jsx
          <Tab label="Free DD" sx={{ textTransform: 'none' }} />
```

Add the panel after `{tab === 1 && <CnmvReviewTab adminKey={adminKey} />}` (~line 379):

```jsx
        {tab === 2 && <FreeReportsTab adminKey={adminKey} />}
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification**

Open `/admin?key=<ADMIN_SECRET>` → the "Free DD" tab loads, shows the summary line, and (after seeding a redemption/abuse via the checkout flow) lists rows. Test Block → row moves to Blocked; Unblock → removed. Grant waiver → appears under Waivers; Revoke → removed. Reset on a redemption → the email becomes eligible again in the dialog.

- [ ] **Step 5: Commit**

```bash
git add src/components/FreeReportsTab.jsx src/components/AdminPage.jsx
git -c commit.gpgsign=false commit -m "feat(free-dd): admin Free DD tab (redemptions, opt-ins, abuse, block/reset/waiver)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification

- [ ] Worker: `npm test` green (from `workers/stripe-handler`); `npx wrangler deploy --dry-run` bundles clean.
- [ ] Frontend: `npm run build` succeeds (from mapasocietario root).
- [ ] Both repos on branch `feat/free-dd-email-gate` with the task commits + the earlier n8n-fix (worker) / spec (frontend) commits.
- [ ] Deploy order confirmed for rollout: worker first, then frontend.
