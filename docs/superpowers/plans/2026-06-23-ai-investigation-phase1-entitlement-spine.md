# AI Investigation — Phase 1: Entitlement Spine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the paid-access loop end-to-end — a DD purchase mints an email-bound redemption code, the buyer redeems `email + code` (Turnstile-gated) for a 2-day signed JWT, and a JWT-gated, rate-limited proxy returns a **stubbed** answer — before any AI is wired in.

**Architecture:** A new dedicated Cloudflare Worker (`ai-investigation`) owns a D1 entitlement store, mints/validates HS256 JWTs (Web Crypto, no libs), hosts the `/redeem` and `/investigate` endpoints, and enforces per-code rate + spend limits. The existing `stripe-handler` worker (`payments.ncdata.eu`) gets a binding to the same D1 and inserts a code row + injects the code into its MailerSend confirmation email on every paid DD. The `mapasocietario` frontend gets a minimal redeem UI + stub-answer box.

**Tech Stack:** Cloudflare Workers (ESM, `nodejs_compat`), Cloudflare D1 (SQLite), Web Crypto SubtleCrypto (HMAC-SHA256), Cloudflare Turnstile, `@cloudflare/vitest-pool-workers` for worker tests, `node:test` for frontend util tests, React 18 + Vite + MUI frontend.

## Global Constraints

- **Two repos.** Tasks 1–7 live in the **`standalone_rag/local-rag`** repo (path `/Users/alessandronurnberg/standalone_rag/local-rag/`). Task 8 lives in the **`mapasocietario`** repo (path `/Users/alessandronurnberg/mapasocietario/`). Each task's `git commit` runs in that task's repo root. Never cross-commit.
- **Zero runtime npm deps in the worker.** JWT signing/verifying uses Web Crypto (`crypto.subtle`), not `jsonwebtoken`. Only dev deps (`vitest`, `@cloudflare/vitest-pool-workers`, `wrangler`) are added.
- **Worker module style:** ESM, `export default { async fetch(request, env, ctx) {...} }`. `compatibility_flags = ["nodejs_compat"]`.
- **D1 access pattern:** `await env.ENTITLEMENTS_DB.prepare(sql).bind(...).first()` / `.run()` / `.all()` (mirrors `workers/encrypted-sync/src/d1-endpoints.js`).
- **Identity = email + code. No accounts.** Email is always lowercased+trimmed before compare/store.
- **Window = 2 days.** `WINDOW_SECONDS = 172800`. `expires_at = paid_at + WINDOW_SECONDS` (epoch **seconds**, integer).
- **Rate tier `default`:** `perMinute: 5`, `perDay: 40`, `spendCapMicros: 200000` (= €0.20 backstop). Tunable later.
- **Code format:** `XXXX-XXXX-XXXX`, Crockford base32 alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (no I/L/O/U), uppercased. Redeem is **case-insensitive** and strips hyphens/spaces before lookup; codes are stored canonical (uppercase, hyphenated).
- **Turnstile in tests:** use Cloudflare's always-pass test secret `1x0000000000000000000000000000000AA`. Sitekey for the always-pass widget is `1x00000000000000000000AA`.
- **CORS allow-list (exact):** `https://mapasocietario.es`, `https://www.mapasocietario.es`, `http://localhost:5173`, `http://localhost:5174`. Methods `POST, OPTIONS`. Allow header `Content-Type, Authorization`.
- **Phase 1 = stub.** `/investigate` records usage and returns a fixed stubbed answer. No OpenRouter, no Brave. Those are Phase 2.
- **Frontend tests** use `node:test` (`*.test.mjs`, run with `node --test`) against **pure util modules only** — the repo does not unit-test React components (see `test/*.test.mjs`). Follow that convention.

---

### Task 1: Scaffold the `ai-investigation` worker + D1 migration

**Files:**
- Create: `workers/ai-investigation/package.json`
- Create: `workers/ai-investigation/wrangler.jsonc`
- Create: `workers/ai-investigation/vitest.config.mts`
- Create: `workers/ai-investigation/test/apply-migrations.js`
- Create: `workers/ai-investigation/migrations/0001_init.sql`
- Create: `workers/ai-investigation/src/index.js`
- Test: `workers/ai-investigation/test/health.spec.js`

(All paths relative to `/Users/alessandronurnberg/standalone_rag/local-rag/`.)

**Interfaces:**
- Produces: a worker whose `fetch` returns `200 {"ok":true,"service":"ai-investigation"}` for `GET /health`; D1 binding name `ENTITLEMENTS_DB`; tables `entitlements` and `usage` (schema below); a test helper `applyMigrations(env)` that applies `migrations/` to the test D1.

- [ ] **Step 1: Write the migration SQL**

Create `workers/ai-investigation/migrations/0001_init.sql`:

```sql
-- One row per minted redemption code.
CREATE TABLE IF NOT EXISTS entitlements (
  code              TEXT PRIMARY KEY,        -- canonical XXXX-XXXX-XXXX, uppercase
  email             TEXT NOT NULL,           -- buyer email, lowercased
  dd_session_id     TEXT,                    -- originating Stripe session id (provenance)
  paid_at           INTEGER NOT NULL,        -- epoch seconds
  expires_at        INTEGER NOT NULL,        -- paid_at + 172800
  bound_email       TEXT,                    -- set on first redeem (must equal email)
  first_redeemed_at INTEGER,                 -- epoch seconds, NULL until first redeem
  status            TEXT NOT NULL DEFAULT 'active'  -- 'active' | 'revoked'
);

-- One row per AI call, for rate-window + spend accounting. Surrogate PK
-- (not (code, ts)) so two calls in the same second don't collide; the
-- (code, ts) index serves the window-count queries.
CREATE TABLE IF NOT EXISTS usage (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT NOT NULL,
  ts              INTEGER NOT NULL,          -- epoch seconds
  est_cost_micros INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_usage_code_ts ON usage (code, ts);
```

- [ ] **Step 2: Write `package.json`**

Create `workers/ai-investigation/package.json`:

```json
{
  "name": "ai-investigation",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "migrate:local": "wrangler d1 migrations apply ai-investigation --local",
    "migrate:remote": "wrangler d1 migrations apply ai-investigation --remote"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.13.5",
    "vitest": "^4.1.0",
    "wrangler": "^4.78.0"
  }
}
```

- [ ] **Step 3: Write `wrangler.jsonc`**

Create `workers/ai-investigation/wrangler.jsonc`. The `database_id` is filled in after Step 7; until then a placeholder is fine for tests (vitest-pool-workers provisions an isolated local D1).

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "ai-investigation",
  "main": "src/index.js",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": true,
  "preview_urls": false,
  "observability": { "logs": { "enabled": true } },
  "d1_databases": [
    {
      "binding": "ENTITLEMENTS_DB",
      "database_name": "ai-investigation",
      "database_id": "PLACEHOLDER_FILL_AFTER_D1_CREATE",
      "migrations_dir": "migrations"
    }
  ],
  "vars": {
    "ALLOWED_ORIGINS": "https://mapasocietario.es,https://www.mapasocietario.es,http://localhost:5173,http://localhost:5174"
  }
}
```

- [ ] **Step 4: Write the vitest config + migration helper**

Create `workers/ai-investigation/vitest.config.mts`:

```typescript
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
});
```

Create `workers/ai-investigation/test/apply-migrations.js`:

```javascript
import { applyD1Migrations, env } from "cloudflare:test";

// Apply ./migrations to the isolated test D1 before each suite that needs it.
export async function applyMigrations() {
  await applyD1Migrations(env.ENTITLEMENTS_DB, env.TEST_MIGRATIONS);
}
```

Add the migrations binding to the **test** config block of `wrangler.jsonc` so `env.TEST_MIGRATIONS` resolves. Append this top-level key:

```jsonc
  ,"unsafe": {}
```

> NOTE: `applyD1Migrations` reads migrations via a `defineWorkersConfig` `miniflare.d1Databases` + `readD1Migrations` setup. If `env.TEST_MIGRATIONS` is unavailable in your `@cloudflare/vitest-pool-workers` version, instead apply the schema inline in the helper:

```javascript
import { env } from "cloudflare:test";
import { readFileSync } from "node:fs";

export async function applyMigrations() {
  const sql = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8");
  for (const stmt of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
    await env.ENTITLEMENTS_DB.exec(stmt.replace(/\n/g, " "));
  }
}
```

Use the inline-`exec` version as the default — it has no version coupling. Delete the `applyD1Migrations` variant.

- [ ] **Step 5: Write the failing health test**

Create `workers/ai-investigation/test/health.spec.js`:

```javascript
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index.js";

describe("health", () => {
  it("GET /health returns ok", async () => {
    const req = new Request("https://ai.ncdata.eu/health");
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: "ai-investigation" });
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/ai-investigation && npm install && npm test`
Expected: FAIL — `Cannot find module '../src/index.js'` (or 404).

- [ ] **Step 7: Write the minimal worker**

Create `workers/ai-investigation/src/index.js`:

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "ai-investigation" });
    }
    return new Response("Not found", { status: 404 });
  },
};
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/ai-investigation && npm test`
Expected: PASS (1 test).

- [ ] **Step 9: Commit**

```bash
cd /Users/alessandronurnberg/standalone_rag/local-rag
git add workers/ai-investigation
git commit -m "feat(ai-investigation): scaffold worker + D1 entitlement schema"
```

---

### Task 2: JWT module (HS256 via Web Crypto)

**Files:**
- Create: `workers/ai-investigation/src/jwt.js`
- Test: `workers/ai-investigation/test/jwt.spec.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `async function signJWT(payload: object, secret: string, opts: { expiresAt: number, now: number }): Promise<string>` — returns a compact JWS `header.payload.signature`. Adds `iat: opts.now` and `exp: opts.expiresAt` (epoch seconds) to the payload.
  - `async function verifyJWT(token: string, secret: string, now: number): Promise<object>` — returns the decoded payload, or throws `JwtError` (exported class) on bad signature / malformed / `exp <= now`.
  - `export class JwtError extends Error {}`

- [ ] **Step 1: Write the failing test**

Create `workers/ai-investigation/test/jwt.spec.js`:

```javascript
import { describe, it, expect } from "vitest";
import { signJWT, verifyJWT, JwtError } from "../src/jwt.js";

const SECRET = "test-secret-please-rotate";

describe("jwt", () => {
  it("round-trips a payload", async () => {
    const token = await signJWT({ code: "ABC" }, SECRET, { now: 1000, expiresAt: 2000 });
    const payload = await verifyJWT(token, SECRET, 1500);
    expect(payload.code).toBe("ABC");
    expect(payload.iat).toBe(1000);
    expect(payload.exp).toBe(2000);
  });

  it("rejects a tampered signature", async () => {
    const token = await signJWT({ code: "ABC" }, SECRET, { now: 1000, expiresAt: 2000 });
    const bad = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    await expect(verifyJWT(bad, SECRET, 1500)).rejects.toBeInstanceOf(JwtError);
  });

  it("rejects an expired token", async () => {
    const token = await signJWT({ code: "ABC" }, SECRET, { now: 1000, expiresAt: 2000 });
    await expect(verifyJWT(token, SECRET, 2001)).rejects.toBeInstanceOf(JwtError);
  });

  it("rejects a wrong secret", async () => {
    const token = await signJWT({ code: "ABC" }, SECRET, { now: 1000, expiresAt: 2000 });
    await expect(verifyJWT(token, "other", 1500)).rejects.toBeInstanceOf(JwtError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/ai-investigation && npm test -- jwt`
Expected: FAIL — `Cannot find module '../src/jwt.js'`.

- [ ] **Step 3: Write the implementation**

Create `workers/ai-investigation/src/jwt.js`:

```javascript
export class JwtError extends Error {}

const enc = new TextEncoder();

function b64urlFromBytes(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlFromString(str) {
  return b64urlFromBytes(enc.encode(str));
}
function bytesFromB64url(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signJWT(payload, secret, { now, expiresAt }) {
  const header = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, iat: now, exp: expiresAt };
  const signingInput =
    b64urlFromString(JSON.stringify(header)) + "." + b64urlFromString(JSON.stringify(body));
  const key = await importKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(signingInput)));
  return signingInput + "." + b64urlFromBytes(sig);
}

export async function verifyJWT(token, secret, now) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new JwtError("malformed token");
  const signingInput = parts[0] + "." + parts[1];
  const key = await importKey(secret);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    bytesFromB64url(parts[2]),
    enc.encode(signingInput)
  );
  if (!ok) throw new JwtError("bad signature");
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytesFromB64url(parts[1])));
  } catch {
    throw new JwtError("bad payload");
  }
  if (typeof payload.exp !== "number" || payload.exp <= now) throw new JwtError("expired");
  return payload;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/ai-investigation && npm test -- jwt`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/alessandronurnberg/standalone_rag/local-rag
git add workers/ai-investigation/src/jwt.js workers/ai-investigation/test/jwt.spec.js
git commit -m "feat(ai-investigation): HS256 JWT sign/verify via Web Crypto"
```

---

### Task 3: Entitlement store module (D1 queries)

**Files:**
- Create: `workers/ai-investigation/src/entitlements.js`
- Test: `workers/ai-investigation/test/entitlements.spec.js`

**Interfaces:**
- Consumes: D1 binding `env.ENTITLEMENTS_DB`; `applyMigrations()` from `test/apply-migrations.js`.
- Produces (all take `db` = a D1 database binding):
  - `function canonicalizeCode(raw: string): string` — strips spaces/hyphens, uppercases, re-hyphenates to `XXXX-XXXX-XXXX` if 12 chars; otherwise returns the cleaned uppercase string.
  - `async function createEntitlement(db, { code, email, ddSessionId, paidAt, expiresAt }): Promise<void>`
  - `async function getEntitlement(db, code): Promise<object|null>` — row by canonical code.
  - `async function redeemEntitlement(db, { code, email, now }): Promise<{ ok: boolean, reason?: string, entitlement?: object }>` — validates exists / `status==='active'` / `expires_at > now` / email matches (against `bound_email` if already bound, else `email`). On first successful redeem, sets `bound_email` + `first_redeemed_at`. `reason` ∈ `not_found | revoked | expired | email_mismatch`.
  - `async function recordUsage(db, { code, ts, estCostMicros }): Promise<void>`
  - `async function getUsageCounts(db, { code, now }): Promise<{ lastMinute: number, lastDay: number, totalCostMicros: number }>`

- [ ] **Step 1: Write the failing test**

Create `workers/ai-investigation/test/entitlements.spec.js`:

```javascript
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations } from "./apply-migrations.js";
import {
  canonicalizeCode,
  createEntitlement,
  getEntitlement,
  redeemEntitlement,
  recordUsage,
  getUsageCounts,
} from "../src/entitlements.js";

const db = () => env.ENTITLEMENTS_DB;

beforeEach(async () => {
  await applyMigrations();
  await db().exec("DELETE FROM entitlements");
  await db().exec("DELETE FROM usage");
});

describe("canonicalizeCode", () => {
  it("normalizes spacing, case and hyphens", () => {
    expect(canonicalizeCode("ab12 cd34-ef56")).toBe("AB12-CD34-EF56");
    expect(canonicalizeCode("AB12CD34EF56")).toBe("AB12-CD34-EF56");
  });
});

describe("entitlements", () => {
  const base = {
    code: "AB12-CD34-EF56",
    email: "buyer@example.com",
    ddSessionId: "cs_test_123",
    paidAt: 1000,
    expiresAt: 1000 + 172800,
  };

  it("creates and fetches", async () => {
    await createEntitlement(db(), base);
    const row = await getEntitlement(db(), "ab12cd34ef56");
    expect(row.email).toBe("buyer@example.com");
    expect(row.status).toBe("active");
    expect(row.first_redeemed_at).toBeNull();
  });

  it("redeems and binds on first use", async () => {
    await createEntitlement(db(), base);
    const r = await redeemEntitlement(db(), { code: "ab12-cd34-ef56", email: "BUYER@example.com", now: 1500 });
    expect(r.ok).toBe(true);
    const row = await getEntitlement(db(), base.code);
    expect(row.bound_email).toBe("buyer@example.com");
    expect(row.first_redeemed_at).toBe(1500);
  });

  it("rejects email mismatch", async () => {
    await createEntitlement(db(), base);
    const r = await redeemEntitlement(db(), { code: base.code, email: "thief@example.com", now: 1500 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("email_mismatch");
  });

  it("rejects expired", async () => {
    await createEntitlement(db(), base);
    const r = await redeemEntitlement(db(), { code: base.code, email: base.email, now: base.expiresAt + 1 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("expired");
  });

  it("rejects unknown code", async () => {
    const r = await redeemEntitlement(db(), { code: "ZZZZ-ZZZZ-ZZZZ", email: base.email, now: 1500 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("not_found");
  });

  it("counts usage in windows", async () => {
    await createEntitlement(db(), base);
    await recordUsage(db(), { code: base.code, ts: 1000, estCostMicros: 50 });
    await recordUsage(db(), { code: base.code, ts: 1010, estCostMicros: 70 });
    await recordUsage(db(), { code: base.code, ts: 1000 - 120, estCostMicros: 30 }); // >60s ago, same day
    const c = await getUsageCounts(db(), { code: base.code, now: 1030 });
    expect(c.lastMinute).toBe(2);
    expect(c.lastDay).toBe(3);
    expect(c.totalCostMicros).toBe(150);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/ai-investigation && npm test -- entitlements`
Expected: FAIL — `Cannot find module '../src/entitlements.js'`.

- [ ] **Step 3: Write the implementation**

Create `workers/ai-investigation/src/entitlements.js`:

```javascript
const WINDOW_DAY = 86400;
const WINDOW_MINUTE = 60;

export function canonicalizeCode(raw) {
  const cleaned = String(raw || "").replace(/[\s-]/g, "").toUpperCase();
  if (cleaned.length === 12) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`;
  }
  return cleaned;
}

const lc = (s) => String(s || "").trim().toLowerCase();

export async function createEntitlement(db, { code, email, ddSessionId, paidAt, expiresAt }) {
  await db
    .prepare(
      `INSERT INTO entitlements (code, email, dd_session_id, paid_at, expires_at, status)
       VALUES (?, ?, ?, ?, ?, 'active')`
    )
    .bind(canonicalizeCode(code), lc(email), ddSessionId || null, paidAt, expiresAt)
    .run();
}

export async function getEntitlement(db, code) {
  return db.prepare(`SELECT * FROM entitlements WHERE code = ?`).bind(canonicalizeCode(code)).first();
}

export async function redeemEntitlement(db, { code, email, now }) {
  const canon = canonicalizeCode(code);
  const row = await getEntitlement(db, canon);
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status !== "active") return { ok: false, reason: "revoked" };
  if (row.expires_at <= now) return { ok: false, reason: "expired" };
  const expected = row.bound_email || row.email;
  if (lc(email) !== expected) return { ok: false, reason: "email_mismatch" };
  if (!row.first_redeemed_at) {
    await db
      .prepare(`UPDATE entitlements SET bound_email = ?, first_redeemed_at = ? WHERE code = ?`)
      .bind(lc(email), now, canon)
      .run();
    row.bound_email = lc(email);
    row.first_redeemed_at = now;
  }
  return { ok: true, entitlement: row };
}

export async function recordUsage(db, { code, ts, estCostMicros }) {
  await db
    .prepare(`INSERT INTO usage (code, ts, est_cost_micros) VALUES (?, ?, ?)`)
    .bind(canonicalizeCode(code), ts, estCostMicros || 0)
    .run();
}

export async function getUsageCounts(db, { code, now }) {
  const canon = canonicalizeCode(code);
  const minuteRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM usage WHERE code = ? AND ts > ?`)
    .bind(canon, now - WINDOW_MINUTE)
    .first();
  const dayRow = await db
    .prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(est_cost_micros), 0) AS cost FROM usage WHERE code = ? AND ts > ?`)
    .bind(canon, now - WINDOW_DAY)
    .first();
  const totalRow = await db
    .prepare(`SELECT COALESCE(SUM(est_cost_micros), 0) AS cost FROM usage WHERE code = ?`)
    .bind(canon)
    .first();
  return {
    lastMinute: Number(minuteRow.n),
    lastDay: Number(dayRow.n),
    totalCostMicros: Number(totalRow.cost),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/ai-investigation && npm test -- entitlements`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/alessandronurnberg/standalone_rag/local-rag
git add workers/ai-investigation/src/entitlements.js workers/ai-investigation/test/entitlements.spec.js
git commit -m "feat(ai-investigation): D1 entitlement store (create/redeem/usage)"
```

---

### Task 4: Turnstile verification module

**Files:**
- Create: `workers/ai-investigation/src/turnstile.js`
- Test: `workers/ai-investigation/test/turnstile.spec.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `async function verifyTurnstile(token: string, secret: string, remoteip?: string, fetchImpl = fetch): Promise<boolean>` — POSTs to `https://challenges.cloudflare.com/turnstile/v0/siteverify` and returns `data.success === true`. `fetchImpl` is injectable for tests. Returns `false` on any network/parse error or empty token.

- [ ] **Step 1: Write the failing test**

Create `workers/ai-investigation/test/turnstile.spec.js`:

```javascript
import { describe, it, expect } from "vitest";
import { verifyTurnstile } from "../src/turnstile.js";

function fakeFetch(success) {
  return async () => new Response(JSON.stringify({ success }), { status: 200 });
}

describe("verifyTurnstile", () => {
  it("returns true when siteverify says success", async () => {
    expect(await verifyTurnstile("tok", "secret", "1.2.3.4", fakeFetch(true))).toBe(true);
  });
  it("returns false when siteverify says failure", async () => {
    expect(await verifyTurnstile("tok", "secret", "1.2.3.4", fakeFetch(false))).toBe(false);
  });
  it("returns false for empty token without calling fetch", async () => {
    let called = false;
    const spy = async () => { called = true; return new Response("{}"); };
    expect(await verifyTurnstile("", "secret", "1.2.3.4", spy)).toBe(false);
    expect(called).toBe(false);
  });
  it("returns false on fetch error", async () => {
    const boom = async () => { throw new Error("network"); };
    expect(await verifyTurnstile("tok", "secret", "1.2.3.4", boom)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/ai-investigation && npm test -- turnstile`
Expected: FAIL — `Cannot find module '../src/turnstile.js'`.

- [ ] **Step 3: Write the implementation**

Create `workers/ai-investigation/src/turnstile.js`:

```javascript
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token, secret, remoteip, fetchImpl = fetch) {
  if (!token) return false;
  try {
    const body = new FormData();
    body.append("secret", secret);
    body.append("response", token);
    if (remoteip) body.append("remoteip", remoteip);
    const res = await fetchImpl(SITEVERIFY, { method: "POST", body });
    if (!res.ok) return false;
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/ai-investigation && npm test -- turnstile`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/alessandronurnberg/standalone_rag/local-rag
git add workers/ai-investigation/src/turnstile.js workers/ai-investigation/test/turnstile.spec.js
git commit -m "feat(ai-investigation): Turnstile siteverify module"
```

---

### Task 5: Rate-limit module + `/redeem` + `/investigate` (stub) wired into the worker

**Files:**
- Create: `workers/ai-investigation/src/ratelimit.js`
- Create: `workers/ai-investigation/src/cors.js`
- Modify: `workers/ai-investigation/src/index.js`
- Test: `workers/ai-investigation/test/ratelimit.spec.js`
- Test: `workers/ai-investigation/test/endpoints.spec.js`

**Interfaces:**
- Consumes: `signJWT`/`verifyJWT`/`JwtError` (Task 2); `redeemEntitlement`/`recordUsage`/`getUsageCounts`/`canonicalizeCode` (Task 3); `verifyTurnstile` (Task 4).
- Produces:
  - `export const TIERS = { default: { perMinute: 5, perDay: 40, spendCapMicros: 200000 } }`
  - `function checkRateLimit(counts, tier): { allowed: boolean, reason?: string }` — `reason` ∈ `rate_minute | rate_day | spend_cap`.
  - `function corsHeaders(origin, allowedOrigins): object` and `function preflight(request, allowedOrigins): Response|null` in `cors.js`.
  - Worker routes: `POST /redeem` → `{ token, expires_at, rate_tier }` or `4xx {error,reason}`; `POST /investigate` → stub `{ answer, citations: [], provenance, stub: true }` or `4xx`.
- Env the worker reads: `ENTITLEMENTS_DB`, `JWT_SIGNING_SECRET`, `TURNSTILE_SECRET_KEY`, `ALLOWED_ORIGINS` (comma string).

- [ ] **Step 1: Write the failing rate-limit test**

Create `workers/ai-investigation/test/ratelimit.spec.js`:

```javascript
import { describe, it, expect } from "vitest";
import { checkRateLimit, TIERS } from "../src/ratelimit.js";

const tier = TIERS.default;

describe("checkRateLimit", () => {
  it("allows within limits", () => {
    expect(checkRateLimit({ lastMinute: 2, lastDay: 10, totalCostMicros: 100 }, tier)).toEqual({ allowed: true });
  });
  it("blocks on per-minute", () => {
    expect(checkRateLimit({ lastMinute: 5, lastDay: 10, totalCostMicros: 0 }, tier).reason).toBe("rate_minute");
  });
  it("blocks on per-day", () => {
    expect(checkRateLimit({ lastMinute: 1, lastDay: 40, totalCostMicros: 0 }, tier).reason).toBe("rate_day");
  });
  it("blocks on spend cap", () => {
    expect(checkRateLimit({ lastMinute: 1, lastDay: 1, totalCostMicros: 200000 }, tier).reason).toBe("spend_cap");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/ai-investigation && npm test -- ratelimit`
Expected: FAIL — `Cannot find module '../src/ratelimit.js'`.

- [ ] **Step 3: Write `ratelimit.js`**

Create `workers/ai-investigation/src/ratelimit.js`:

```javascript
export const TIERS = {
  default: { perMinute: 5, perDay: 40, spendCapMicros: 200000 },
};

export function checkRateLimit(counts, tier) {
  if (counts.lastMinute >= tier.perMinute) return { allowed: false, reason: "rate_minute" };
  if (counts.lastDay >= tier.perDay) return { allowed: false, reason: "rate_day" };
  if (counts.totalCostMicros >= tier.spendCapMicros) return { allowed: false, reason: "spend_cap" };
  return { allowed: true };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/ai-investigation && npm test -- ratelimit`
Expected: PASS (4 tests).

- [ ] **Step 5: Write `cors.js`**

Create `workers/ai-investigation/src/cors.js`:

```javascript
export function corsHeaders(origin, allowedOrigins) {
  const allow = allowedOrigins.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function preflight(request, allowedOrigins) {
  if (request.method !== "OPTIONS") return null;
  const origin = request.headers.get("Origin") || "";
  return new Response(null, { status: 204, headers: corsHeaders(origin, allowedOrigins) });
}
```

- [ ] **Step 6: Write the failing endpoints test**

Create `workers/ai-investigation/test/endpoints.spec.js`:

```javascript
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import worker from "../src/index.js";
import { applyMigrations } from "./apply-migrations.js";
import { createEntitlement } from "../src/entitlements.js";
import { verifyJWT } from "../src/jwt.js";

// Cloudflare always-pass Turnstile test secret.
const testEnv = { ...env, JWT_SIGNING_SECRET: "test-secret", TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA" };
const db = () => env.ENTITLEMENTS_DB;
const PAID_AT = 1_700_000_000;

async function call(path, { body, headers } = {}) {
  const ctx = createExecutionContext();
  const res = await worker.fetch(
    new Request(`https://ai.ncdata.eu${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://mapasocietario.es", ...(headers || {}) },
      body: JSON.stringify(body || {}),
    }),
    testEnv,
    ctx
  );
  await waitOnExecutionContext(ctx);
  return res;
}

beforeEach(async () => {
  await applyMigrations();
  await db().exec("DELETE FROM entitlements");
  await db().exec("DELETE FROM usage");
  await createEntitlement(db(), {
    code: "AB12-CD34-EF56",
    email: "buyer@example.com",
    ddSessionId: "cs_test_1",
    paidAt: PAID_AT,
    expiresAt: PAID_AT + 172800,
  });
});

describe("/redeem", () => {
  it("issues a JWT for a valid email+code+turnstile", async () => {
    const res = await call("/redeem", {
      body: { email: "buyer@example.com", code: "ab12cd34ef56", turnstileToken: "XXXX.DUMMY.TOKEN" },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.token).toBe("string");
    const payload = await verifyJWT(data.token, "test-secret", PAID_AT + 10);
    expect(payload.code).toBe("AB12-CD34-EF56");
    expect(payload.rate_tier).toBe("default");
  });

  it("rejects a wrong email", async () => {
    const res = await call("/redeem", {
      body: { email: "thief@example.com", code: "AB12-CD34-EF56", turnstileToken: "t" },
    });
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("email_mismatch");
  });
});

describe("/investigate", () => {
  async function freshToken() {
    const res = await call("/redeem", {
      body: { email: "buyer@example.com", code: "AB12-CD34-EF56", turnstileToken: "t" },
    });
    return (await res.json()).token;
  }

  it("returns a stub answer for a valid JWT", async () => {
    const token = await freshToken();
    const res = await call("/investigate", {
      headers: { Authorization: `Bearer ${token}` },
      body: { question: "What is this company?" },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stub).toBe(true);
    expect(Array.isArray(data.citations)).toBe(true);
  });

  it("rejects a missing JWT with 401", async () => {
    const res = await call("/investigate", { body: { question: "x" } });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/ai-investigation && npm test -- endpoints`
Expected: FAIL — `/redeem` 404s (routes not implemented yet).

- [ ] **Step 8: Rewrite `src/index.js` with the routes**

Replace `workers/ai-investigation/src/index.js` entirely:

```javascript
import { signJWT, verifyJWT, JwtError } from "./jwt.js";
import {
  redeemEntitlement,
  recordUsage,
  getUsageCounts,
  canonicalizeCode,
} from "./entitlements.js";
import { verifyTurnstile } from "./turnstile.js";
import { TIERS, checkRateLimit } from "./ratelimit.js";
import { corsHeaders, preflight } from "./cors.js";

const nowSec = () => Math.floor(Date.now() / 1000);

function json(data, status, origin, allowed) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowed) },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);

    const pre = preflight(request, allowed);
    if (pre) return pre;

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "ai-investigation" });
    }

    if (request.method === "POST" && url.pathname === "/redeem") {
      return handleRedeem(request, env, origin, allowed);
    }

    if (request.method === "POST" && url.pathname === "/investigate") {
      return handleInvestigate(request, env, origin, allowed);
    }

    return new Response("Not found", { status: 404 });
  },
};

async function handleRedeem(request, env, origin, allowed) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad request", reason: "bad_json" }, 400, origin, allowed);
  }
  const { email, code, turnstileToken } = body || {};
  if (!email || !code) return json({ error: "missing email or code", reason: "missing_fields" }, 400, origin, allowed);

  const remoteip = request.headers.get("CF-Connecting-IP") || undefined;
  const human = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, remoteip);
  if (!human) return json({ error: "turnstile failed", reason: "turnstile" }, 403, origin, allowed);

  const now = nowSec();
  const result = await redeemEntitlement(env.ENTITLEMENTS_DB, { code, email, now });
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 403;
    return json({ error: "redeem failed", reason: result.reason }, status, origin, allowed);
  }

  const ent = result.entitlement;
  const token = await signJWT(
    { code: canonicalizeCode(code), rate_tier: "default", window_expiry: ent.expires_at },
    env.JWT_SIGNING_SECRET,
    { now, expiresAt: ent.expires_at }
  );
  return json({ token, expires_at: ent.expires_at, rate_tier: "default" }, 200, origin, allowed);
}

async function handleInvestigate(request, env, origin, allowed) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "missing token", reason: "no_jwt" }, 401, origin, allowed);
  const token = auth.slice("Bearer ".length).trim();

  const now = nowSec();
  let payload;
  try {
    payload = await verifyJWT(token, env.JWT_SIGNING_SECRET, now);
  } catch (e) {
    if (e instanceof JwtError) return json({ error: "invalid token", reason: "bad_jwt" }, 401, origin, allowed);
    throw e;
  }

  const code = payload.code;
  const counts = await getUsageCounts(env.ENTITLEMENTS_DB, { code, now });
  const tier = TIERS[payload.rate_tier] || TIERS.default;
  const limit = checkRateLimit(counts, tier);
  if (!limit.allowed) return json({ error: "rate limited", reason: limit.reason }, 429, origin, allowed);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad request", reason: "bad_json" }, 400, origin, allowed);
  }
  const question = (body && body.question) || "";

  // Phase 1: record usage and return a stubbed answer. Phase 2 replaces this
  // with context assembly + web search + LLM synthesis.
  await recordUsage(env.ENTITLEMENTS_DB, { code, ts: now, estCostMicros: 0 });

  return json(
    {
      stub: true,
      answer: `STUB: received question "${question}". The investigation engine ships in Phase 2.`,
      citations: [],
      provenance: { registry: [], web: [] },
    },
    200,
    origin,
    allowed
  );
}
```

- [ ] **Step 9: Run the full suite to verify everything passes**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/ai-investigation && npm test`
Expected: PASS — all suites (health, jwt, entitlements, turnstile, ratelimit, endpoints).

- [ ] **Step 10: Commit**

```bash
cd /Users/alessandronurnberg/standalone_rag/local-rag
git add workers/ai-investigation/src workers/ai-investigation/test
git commit -m "feat(ai-investigation): /redeem + /investigate(stub) with rate limits + CORS"
```

---

### Task 6: Provision real D1 + deploy the worker (manual infra step, gated)

**Files:**
- Modify: `workers/ai-investigation/wrangler.jsonc` (real `database_id`)

**Interfaces:**
- Consumes: the completed worker (Task 5).
- Produces: a live worker at its workers.dev URL (custom domain `ai.ncdata.eu` optional, deferred) and a real D1 database `ai-investigation` with migrations applied. The deployed URL is what Task 8 points the frontend at.

> This task touches live Cloudflare infra. Do NOT run it autonomously — present the commands to the user and let them run/confirm (account auth, secrets). Verify each output before the next.

- [ ] **Step 1: Create the D1 database**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/ai-investigation && npx wrangler d1 create ai-investigation`
Expected: prints a `database_id` UUID.

- [ ] **Step 2: Put the real `database_id` into `wrangler.jsonc`**

Replace `"PLACEHOLDER_FILL_AFTER_D1_CREATE"` with the UUID from Step 1.

- [ ] **Step 3: Apply migrations to remote D1**

Run: `npx wrangler d1 migrations apply ai-investigation --remote`
Expected: applies `0001_init.sql`; prints success.

- [ ] **Step 4: Set the secrets**

Run (each prompts for the value):
```bash
npx wrangler secret put JWT_SIGNING_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
```
`JWT_SIGNING_SECRET` = a fresh 32+ byte random string (e.g. `openssl rand -base64 48`). `TURNSTILE_SECRET_KEY` = the secret for a Turnstile widget the user creates in the Cloudflare dashboard (note the **sitekey** for Task 8).

- [ ] **Step 5: Deploy**

Run: `npx wrangler deploy`
Expected: prints the deployed `https://ai-investigation.<subdomain>.workers.dev` URL. Record it for Task 8.

- [ ] **Step 6: Smoke-test the live health endpoint**

Run: `curl -s https://ai-investigation.<subdomain>.workers.dev/health`
Expected: `{"ok":true,"service":"ai-investigation"}`

- [ ] **Step 7: Commit the `database_id`**

```bash
cd /Users/alessandronurnberg/standalone_rag/local-rag
git add workers/ai-investigation/wrangler.jsonc
git commit -m "chore(ai-investigation): wire real D1 database_id"
```

---

### Task 7: Mint the code in `stripe-handler` (D1 insert + email injection)

**Files:**
- Create: `workers/stripe-handler/src/ai-investigation-mint.js`
- Modify: `workers/stripe-handler/wrangler.toml` (add `ENTITLEMENTS_DB` D1 binding)
- Modify: `workers/stripe-handler/src/index.js` (call mint at the 3 paid-DD fulfillment sites; add code to MailerSend `data`)
- Create: `workers/stripe-handler/package.json` test setup (vitest-pool-workers)
- Create: `workers/stripe-handler/vitest.config.mts`
- Create: `workers/stripe-handler/test/apply-migrations.js`
- Test: `workers/stripe-handler/test/mint.spec.js`

**Interfaces:**
- Consumes: D1 binding `env.ENTITLEMENTS_DB` (same DB as Task 6); `createEntitlement` query shape from Task 3 (re-implemented locally to avoid cross-worker imports — `stripe-handler` and `ai-investigation` are separate worker packages).
- Produces:
  - `function generateRedemptionCode(randomBytes?: Uint8Array): string` — returns `XXXX-XXXX-XXXX` Crockford-base32.
  - `async function mintEntitlement(db, { email, ddSessionId, paidAt }): Promise<{ code: string, expiresAt: number }>` — inserts a row, returns the code + expiry. `WINDOW_SECONDS = 172800`.

> NOTE: the D1 database is **shared** between `ai-investigation` (owner, runs migrations) and `stripe-handler` (writer). `stripe-handler` never runs migrations.

- [ ] **Step 1: Add test toolchain to `stripe-handler`**

Edit `workers/stripe-handler/package.json` to add the dev deps + a `test` script (keep existing `wrangler` dep):

```json
{
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.13.5",
    "vitest": "^4.1.0",
    "wrangler": "^4.68.1"
  },
  "scripts": {
    "test": "vitest run"
  }
}
```

Create `workers/stripe-handler/vitest.config.mts`:

```typescript
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.toml" } })],
});
```

Create `workers/stripe-handler/test/apply-migrations.js`:

```javascript
import { env } from "cloudflare:test";

// Mirror of ai-investigation's 0001_init.sql for the shared entitlements DB.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS entitlements (
  code TEXT PRIMARY KEY, email TEXT NOT NULL, dd_session_id TEXT,
  paid_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  bound_email TEXT, first_redeemed_at INTEGER, status TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, ts INTEGER NOT NULL,
  est_cost_micros INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_usage_code_ts ON usage (code, ts);`;

export async function applyMigrations() {
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await env.ENTITLEMENTS_DB.exec(stmt.replace(/\n/g, " "));
  }
}
```

- [ ] **Step 2: Add the D1 binding to `stripe-handler/wrangler.toml`**

Append to `workers/stripe-handler/wrangler.toml` (use the real `database_id` from Task 6 Step 1):

```toml
[[d1_databases]]
binding = "ENTITLEMENTS_DB"
database_name = "ai-investigation"
database_id = "FILL_WITH_TASK6_UUID"
```

- [ ] **Step 3: Write the failing mint test**

Create `workers/stripe-handler/test/mint.spec.js`:

```javascript
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations } from "./apply-migrations.js";
import { generateRedemptionCode, mintEntitlement } from "../src/ai-investigation-mint.js";

const db = () => env.ENTITLEMENTS_DB;

beforeEach(async () => {
  await applyMigrations();
  await db().exec("DELETE FROM entitlements");
});

describe("generateRedemptionCode", () => {
  it("formats as XXXX-XXXX-XXXX with Crockford alphabet", () => {
    const code = generateRedemptionCode(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]));
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  });
  it("is deterministic for given bytes", () => {
    const bytes = new Uint8Array([255, 1, 2, 3, 4, 5, 6, 7]);
    expect(generateRedemptionCode(bytes)).toBe(generateRedemptionCode(bytes));
  });
});

describe("mintEntitlement", () => {
  it("inserts a row with +2d expiry and returns the code", async () => {
    const paidAt = 1_700_000_000;
    const { code, expiresAt } = await mintEntitlement(db(), {
      email: "Buyer@Example.com",
      ddSessionId: "cs_test_9",
      paidAt,
    });
    expect(expiresAt).toBe(paidAt + 172800);
    const row = await db().prepare("SELECT * FROM entitlements WHERE code = ?").bind(code).first();
    expect(row.email).toBe("buyer@example.com");
    expect(row.dd_session_id).toBe("cs_test_9");
    expect(row.expires_at).toBe(paidAt + 172800);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/stripe-handler && npm install && npm test -- mint`
Expected: FAIL — `Cannot find module '../src/ai-investigation-mint.js'`.

- [ ] **Step 5: Write `ai-investigation-mint.js`**

Create `workers/stripe-handler/src/ai-investigation-mint.js`:

```javascript
const WINDOW_SECONDS = 172800; // 2 days
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32, no I/L/O/U

// 12 Crockford chars from 8 random bytes (top 5 bits per char × 12 = 60 bits).
export function generateRedemptionCode(randomBytes) {
  const bytes = randomBytes || crypto.getRandomValues(new Uint8Array(8));
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let out = "";
  for (let i = 0; i < 12; i++) {
    const idx = Number((bits >> BigInt(5 * (11 - i))) & 31n);
    out += ALPHABET[idx];
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

export async function mintEntitlement(db, { email, ddSessionId, paidAt }) {
  const code = generateRedemptionCode();
  const expiresAt = paidAt + WINDOW_SECONDS;
  await db
    .prepare(
      `INSERT INTO entitlements (code, email, dd_session_id, paid_at, expires_at, status)
       VALUES (?, ?, ?, ?, ?, 'active')`
    )
    .bind(code, String(email || "").trim().toLowerCase(), ddSessionId || null, paidAt, expiresAt)
    .run();
  return { code, expiresAt };
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/stripe-handler && npm test -- mint`
Expected: PASS (3 tests).

- [ ] **Step 7: Call mint at the webhook DD fulfillment site + pass code to the email**

In `workers/stripe-handler/src/index.js`, add the import at the top (alongside other imports):

```javascript
import { mintEntitlement } from "./ai-investigation-mint.js";
```

In the `checkout.session.completed` DD handler, immediately **before** the `sendOrderConfirmationEmail` call at line ~730, mint the code (guard so a mint failure never blocks fulfillment):

```javascript
      // Mint a 2-day AI Investigation redemption code bound to the buyer email.
      let aiInvestigationCode = null;
      try {
        if (env.ENTITLEMENTS_DB && (session.customer_email || "")) {
          const paidAtSec = session.created || Math.floor(Date.now() / 1000);
          const minted = await mintEntitlement(env.ENTITLEMENTS_DB, {
            email: session.customer_email,
            ddSessionId: session.id,
            paidAt: paidAtSec,
          });
          aiInvestigationCode = minted.code;
        }
      } catch (e) {
        console.error("mintEntitlement failed:", e);
      }
```

Then change the `sendOrderConfirmationEmail(env, {...})` call at line ~730 to pass the code:

```javascript
        await sendOrderConfirmationEmail(env, {
          customerEmail: session.customer_email || '',
          companyName: session.metadata.companyName,
          companyIdentifier: session.metadata.companyIdentifier,
          country: session.metadata.country,
          sessionId: session.id,
          includesFinancialStatements: !!parsedOpts.financialStatements,
          waived: false,
          amountPaid,
          amountSubtotal: typeof session.amount_subtotal === 'number' ? session.amount_subtotal / 100 : undefined,
          orderBaseUrl: session.metadata.orderBaseUrl,
          aiInvestigationCode,
        });
```

- [ ] **Step 8: Thread the code through `sendOrderConfirmationEmail` into the MailerSend payload**

In `sendOrderConfirmationEmail` (line ~1083), add `aiInvestigationCode` to the destructured params and add it to the personalization `data` so the MailerSend template can render it. Change the signature:

```javascript
async function sendOrderConfirmationEmail(env, { customerEmail, companyName, companyIdentifier, country, sessionId, includesFinancialStatements, waived, amountPaid, amountSubtotal, orderBaseUrl, aiInvestigationCode }) {
```

And inside the `data: { ... }` object (after `country:`), add:

```javascript
            ai_investigation: aiInvestigationCode
              ? { code: aiInvestigationCode, days: '2' }
              : null,
```

> MANUAL STEP (note in the commit body, do not block): the MailerSend template (`env.MAILERSEND_TEMPLATE_ID`) must be edited in the MailerSend dashboard to render `{{ ai_investigation.code }}` and a redeem link. Until then the code is minted and stored but not shown in the email; the redeem UI still works if the user has the code.

- [ ] **Step 9: Apply the same mint+pass at the other two fulfillment sites**

Repeat Step 7's mint block and Step 8's `aiInvestigationCode` argument at the **two** other `sendOrderConfirmationEmail` call sites (line ~1465, the Google-Play fulfill path; and line ~1611, the waived-inline path). For each: mint just before the call using the email + sessionId available in that scope (`customerEmail`/`email` and `session.id`/`sessionId` as named locally), then add `aiInvestigationCode` to the call's object. Use the same try/catch guard verbatim, substituting the locally-available email and session-id variable names.

- [ ] **Step 10: Run the stripe-handler test suite**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/stripe-handler && npm test`
Expected: PASS (mint suite). If pre-existing modules fail to load under vitest-pool-workers, scope the run to the new file: `npm test -- mint`.

- [ ] **Step 11: Deploy stripe-handler (gated — present to user)**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/stripe-handler && npx wrangler deploy`
Expected: deploys `payments.ncdata.eu`. (User-gated: this is live payment infra.)

- [ ] **Step 12: Commit**

```bash
cd /Users/alessandronurnberg/standalone_rag/local-rag
git add workers/stripe-handler
git commit -m "feat(stripe-handler): mint AI Investigation redemption code on paid DD

MANUAL FOLLOW-UP: add {{ ai_investigation.code }} to the MailerSend DD template."
```

---

### Task 8: Frontend — config + minimal redeem UI + stub-answer box

**Files:**
- Modify: `src/config.js` (add `AI_INVESTIGATION_API`)
- Create: `src/utils/aiInvestigationClient.js`
- Create: `src/components/AIInvestigationGate.jsx`
- Modify: `src/components/OrderStatusPage.jsx` (show a redeem entry point on the `ready` state)
- Test: `test/ai-investigation-client.test.mjs`

(All paths relative to `/Users/alessandronurnberg/mapasocietario/`.)

**Interfaces:**
- Consumes: the deployed worker URL from Task 6 Step 5 (`/redeem`, `/investigate`); Turnstile **sitekey** from Task 6 Step 4.
- Produces:
  - `src/config.js` exports `AI_INVESTIGATION_API` (default the deployed workers.dev URL; overridable via `VITE_AI_INVESTIGATION_API`).
  - `aiInvestigationClient.js` pure utils: `isTokenValid(stored, nowSec)`, `buildRedeemBody(email, code, turnstileToken)`, `buildInvestigateHeaders(token)`. (These are the node:test-tested units.)
  - `AIInvestigationGate.jsx`: a MUI `Dialog` that takes `email + code + Turnstile`, calls `/redeem`, stores the token, then shows an ask box that calls `/investigate` and renders the (stub) answer. Props: `{ open, onClose, language, prefillEmail }`.

- [ ] **Step 1: Add the config entry**

Edit `src/config.js`, append after the `PAYMENTS_API` line:

```javascript
// `AI_INVESTIGATION_API` → the ai-investigation worker (redeem + investigate).
export const AI_INVESTIGATION_API =
  import.meta.env.VITE_AI_INVESTIGATION_API ?? 'https://ai-investigation.anurnberg.workers.dev';
```

> Replace the default with the exact deployed URL recorded in Task 6 Step 5.

- [ ] **Step 2: Write the failing client-util test**

Create `test/ai-investigation-client.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTokenValid, buildRedeemBody, buildInvestigateHeaders } from '../src/utils/aiInvestigationClient.js';

test('isTokenValid: valid when not expired', () => {
  assert.equal(isTokenValid({ token: 'x', expiresAt: 2000 }, 1000), true);
});
test('isTokenValid: invalid when expired', () => {
  assert.equal(isTokenValid({ token: 'x', expiresAt: 1000 }, 1000), false);
  assert.equal(isTokenValid({ token: 'x', expiresAt: 999 }, 1000), false);
});
test('isTokenValid: invalid when missing token', () => {
  assert.equal(isTokenValid(null, 1000), false);
  assert.equal(isTokenValid({ expiresAt: 5000 }, 1000), false);
});
test('buildRedeemBody trims and lowercases email', () => {
  assert.deepEqual(buildRedeemBody('  Buyer@Example.com ', 'ab12cd34ef56', 'ttok'), {
    email: 'buyer@example.com',
    code: 'ab12cd34ef56',
    turnstileToken: 'ttok',
  });
});
test('buildInvestigateHeaders sets bearer + content-type', () => {
  assert.deepEqual(buildInvestigateHeaders('jwt123'), {
    'Content-Type': 'application/json',
    Authorization: 'Bearer jwt123',
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd /Users/alessandronurnberg/mapasocietario && node --test test/ai-investigation-client.test.mjs`
Expected: FAIL — cannot find `../src/utils/aiInvestigationClient.js`.

- [ ] **Step 4: Write the client utils**

Create `src/utils/aiInvestigationClient.js`:

```javascript
// Pure helpers for the AI Investigation gate. Network calls live in the
// component; these are the unit-tested building blocks.

export function isTokenValid(stored, nowSec) {
  if (!stored || !stored.token || typeof stored.expiresAt !== 'number') return false;
  return stored.expiresAt > nowSec;
}

export function buildRedeemBody(email, code, turnstileToken) {
  return {
    email: String(email || '').trim().toLowerCase(),
    code: String(code || ''),
    turnstileToken: turnstileToken || '',
  };
}

export function buildInvestigateHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd /Users/alessandronurnberg/mapasocietario && node --test test/ai-investigation-client.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 6: Write the `AIInvestigationGate` component**

Create `src/components/AIInvestigationGate.jsx`:

```jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, Alert, CircularProgress,
} from '@mui/material';
import { AI_INVESTIGATION_API } from '../config';
import { buildRedeemBody, buildInvestigateHeaders, isTokenValid } from '../utils/aiInvestigationClient';

// Cloudflare Turnstile sitekey for the ai-investigation widget (from Task 6).
const TURNSTILE_SITEKEY = '1x00000000000000000000AA'; // REPLACE with the real sitekey

const COPY = {
  en: {
    title: 'AI Investigation',
    intro: 'Enter the email you bought with and the code from your confirmation email. Access lasts 2 days from purchase.',
    email: 'Email', code: 'Redemption code', unlock: 'Unlock',
    ask: 'Ask about this company or network…', send: 'Ask', close: 'Close',
    invalid: 'Could not unlock. Check your email and code.',
    rateLimited: 'You have hit the rate limit. Try again shortly.',
  },
  es: {
    title: 'Investigación por IA',
    intro: 'Introduce el email con el que compraste y el código de tu email de confirmación. El acceso dura 2 días desde la compra.',
    email: 'Email', code: 'Código de canje', unlock: 'Desbloquear',
    ask: 'Pregunta sobre esta empresa o red…', send: 'Preguntar', close: 'Cerrar',
    invalid: 'No se pudo desbloquear. Revisa tu email y código.',
    rateLimited: 'Has alcanzado el límite. Inténtalo en un momento.',
  },
};

export default function AIInvestigationGate({ open, onClose, language = 'es', prefillEmail = '' }) {
  const t = COPY[language === 'en' ? 'en' : 'es'];
  const [email, setEmail] = useState(prefillEmail);
  const [code, setCode] = useState('');
  const [session, setSession] = useState(null); // { token, expiresAt }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const turnstileRef = useRef(null);
  const widgetId = useRef(null);

  // Render the Turnstile widget when the dialog opens and we are not yet unlocked.
  useEffect(() => {
    if (!open || session) return;
    const id = setInterval(() => {
      if (window.turnstile && turnstileRef.current && widgetId.current == null) {
        widgetId.current = window.turnstile.render(turnstileRef.current, { sitekey: TURNSTILE_SITEKEY });
        clearInterval(id);
      }
    }, 200);
    return () => clearInterval(id);
  }, [open, session]);

  const redeem = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const turnstileToken = window.turnstile && widgetId.current != null
        ? window.turnstile.getResponse(widgetId.current) : '';
      const res = await fetch(`${AI_INVESTIGATION_API}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRedeemBody(email, code, turnstileToken)),
      });
      if (!res.ok) { setError(t.invalid); return; }
      const data = await res.json();
      setSession({ token: data.token, expiresAt: data.expires_at });
    } catch {
      setError(t.invalid);
    } finally {
      setBusy(false);
    }
  }, [email, code, t]);

  const ask = useCallback(async () => {
    if (!isTokenValid(session, Math.floor(Date.now() / 1000))) { setSession(null); return; }
    setBusy(true); setError(''); setAnswer(null);
    try {
      const res = await fetch(`${AI_INVESTIGATION_API}/investigate`, {
        method: 'POST',
        headers: buildInvestigateHeaders(session.token),
        body: JSON.stringify({ question }),
      });
      if (res.status === 429) { setError(t.rateLimited); return; }
      if (!res.ok) { setError(t.invalid); return; }
      setAnswer(await res.json());
    } catch {
      setError(t.invalid);
    } finally {
      setBusy(false);
    }
  }, [session, question, t]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: '#121828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 } }}>
      <DialogTitle>{t.title}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!session ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">{t.intro}</Typography>
            <TextField label={t.email} value={email} onChange={(e) => setEmail(e.target.value)} fullWidth size="small" />
            <TextField label={t.code} value={code} onChange={(e) => setCode(e.target.value)} fullWidth size="small" />
            <div ref={turnstileRef} />
            <Button variant="contained" onClick={redeem} disabled={busy || !email || !code}>
              {busy ? <CircularProgress size={20} /> : t.unlock}
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label={t.ask} value={question} onChange={(e) => setQuestion(e.target.value)}
              fullWidth multiline minRows={2} size="small" />
            <Button variant="contained" onClick={ask} disabled={busy || !question}>
              {busy ? <CircularProgress size={20} /> : t.send}
            </Button>
            {answer && (
              <Alert severity={answer.stub ? 'info' : 'success'}>
                {answer.answer}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t.close}</Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 7: Load the Turnstile script in `index.html`**

Edit `index.html`, add inside `<head>`:

```html
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

> SRI note: do NOT add `integrity="sha384-…"` to this tag. Cloudflare serves Turnstile's `api.js` unversioned and rotates it; a pinned SRI hash will break the widget on the next rotation. Cloudflare does not support SRI for this script. This is the one external script we intentionally load without SRI.

- [ ] **Step 8: Surface the gate on the order-ready screen**

In `src/components/OrderStatusPage.jsx`: import the gate and add an "AI Investigation" button on the `ready` state, prefilling the buyer email from `orderData.customerEmail`.

Add the import near the other imports:

```javascript
import AIInvestigationGate from './AIInvestigationGate';
```

Add state near the other `useState` calls (around line 56):

```javascript
  const [aiGateOpen, setAiGateOpen] = useState(false);
```

In the JSX for the `ready` state (where the download button is rendered), add a button and the gate (use the page's existing `language`/lang variable; if none in scope, default `'es'`):

```jsx
          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => setAiGateOpen(true)}>
            {language === 'en' ? 'Open AI Investigation (2 days)' : 'Abrir Investigación por IA (2 días)'}
          </Button>
          <AIInvestigationGate
            open={aiGateOpen}
            onClose={() => setAiGateOpen(false)}
            language={language}
            prefillEmail={orderData?.customerEmail || ''}
          />
```

> If `OrderStatusPage` does not already receive a `language` prop, read it the same way the file currently determines language (check the top of the component); otherwise pass `language="es"`.

- [ ] **Step 9: Run the frontend util test + build**

Run: `cd /Users/alessandronurnberg/mapasocietario && node --test test/ai-investigation-client.test.mjs && npm run build`
Expected: tests PASS; `vite build` completes without errors (the new component compiles).

- [ ] **Step 10: Manual smoke test (gated — present to user)**

Run the dev server (`npm run dev`), open an order page in the `ready` state (or temporarily point `VITE_AI_INVESTIGATION_API` at the deployed worker), click the AI Investigation button, redeem with a real minted code, and confirm a stub answer renders. Confirm a wrong email is rejected.

- [ ] **Step 11: Commit**

```bash
cd /Users/alessandronurnberg/mapasocietario
git add src/config.js src/utils/aiInvestigationClient.js src/components/AIInvestigationGate.jsx src/components/OrderStatusPage.jsx index.html test/ai-investigation-client.test.mjs
git commit -m "feat: AI Investigation redeem gate + stub-answer box (Phase 1)"
```

---

## Self-Review

**Spec coverage (Phase 1 = entitlement spine, spec build-sequence step 1):**
- Mint (code bound to email, +2d, stored) → Task 7. ✓
- Entitlement store (codes + usage; D1) → Tasks 1, 3. ✓
- Redeem endpoint (email+code → validate → bind on first use → JWT; Turnstile-gated) → Tasks 4, 5. ✓
- AI proxy worker (JWT validate + Layer-1 rate/spend limits; stubbed answer) → Task 5. ✓
- Frontend redemption UI + stub answer → Task 8. ✓
- Single OpenRouter key never client-side → N/A in Phase 1 (no AI yet); the proxy is the only future holder. ✓
- Layer 2 (OpenRouter key spend cap) → deferred to Phase 2 (no key used yet). Noted.
- Investigation engine (context assembly, Brave query-planner, synthesis, provenance, citations) → **Phase 2, out of scope here.** The `/investigate` stub returns the `{answer, citations, provenance}` shape so Phase 2 is a drop-in.
- Full graph "Ask about this network" panel → **Phase 3, out of scope here.** Phase 1 ships a minimal gate on the order page.

**Placeholder scan:** Infra IDs that genuinely don't exist yet are explicitly flagged (`PLACEHOLDER_FILL_AFTER_D1_CREATE`, `FILL_WITH_TASK6_UUID`, Turnstile sitekey, deployed worker URL) with the task/step that fills them. No `TBD`/"add error handling"/"write tests for the above" left in code steps.

**Type consistency:** `canonicalizeCode`, `createEntitlement`, `redeemEntitlement`, `recordUsage`, `getUsageCounts` signatures match between Task 3 (def) and Task 5 (use). JWT `signJWT(payload, secret, {now, expiresAt})` / `verifyJWT(token, secret, now)` consistent across Tasks 2 and 5. `mintEntitlement(db, {email, ddSessionId, paidAt})` consistent Task 7. Frontend `isTokenValid/buildRedeemBody/buildInvestigateHeaders` consistent Tasks 8 def/use. The `/investigate` response shape `{stub, answer, citations, provenance}` matches between worker (Task 5) and frontend (Task 8).

**Cross-repo note:** Tasks 1–7 commit in `standalone_rag/local-rag`; Task 8 commits in `mapasocietario`. The shared D1 `database_id` produced in Task 6 is consumed by Task 7's `wrangler.toml`.
