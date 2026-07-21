# BORME MCP Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `borme-mcp`, an anonymous read-only remote MCP server (Cloudflare Worker) that exposes Spanish company-registry facts to Claude users by wrapping the live `/bormes` API.

**Architecture:** A new ESM Worker in `standalone_rag/local-rag/workers/borme-mcp/`. It speaks MCP over a **hand-rolled stateless JSON-RPC handler** on `POST /mcp` (no SDK transport, no Durable Object). Tools call the live `/bormes` endpoints over HTTPS; the Worker holds no data. Per-IP rate limiting via Workers KV. Tests via `@cloudflare/vitest-pool-workers`.

**Tech Stack:** Cloudflare Workers (ESM, `nodejs_compat`), Workers KV, vitest + `@cloudflare/vitest-pool-workers`, wrangler. **Zero runtime dependencies** (no MCP SDK, no zod — the protocol surface is small and hand-validated).

## Global Constraints

- Worker dir: `standalone_rag/local-rag/workers/borme-mcp/`. Worker name: `borme-mcp`. Custom domain: `mcp.mapasocietario.es`.
- Live API base from env var `BORMES_API_BASE` (default `https://api.ncdata.eu`). All registry calls go to `${BORMES_API_BASE}/bormes/...`.
- Anonymous: NO auth, NO API keys, NO billing, NO D1. Read-only. No write/stateful tools.
- MCP transport: hand-rolled stateless JSON-RPC over `POST /mcp`, JSON responses. Methods: `initialize`, `notifications/initialized`, `tools/list`, `tools/call`, `ping`. Unknown method → JSON-RPC error `-32601`.
- Four tools only: `search_companies`, `get_company`, `search_officers`, `get_company_network`. No temporal/event-class tool (Phase 2, out of scope).
- Every company object MUST carry `empresa_url` = `https://mapasocietario.es/empresa/<nameToSlug(name)>`. Company-level results MUST carry `source_note` = `"Unofficial; derived from BORME (Boletín Oficial del Registro Mercantil) publications."`
- `get_company`: dissolution rule — when `is_dissolved` is true, `current_officers` MUST be empty (all officers go to `former_officers`). `sole_shareholder_note` MUST always be present.
- Caps (no silent truncation): `search_companies`/`search_officers` limit default 10, max 25; `get_company_network` fan-out max 25 with `truncated` boolean.
- Rate limit: 30 requests/min and 1,000/day per `CF-Connecting-IP`. On exceed, return a JSON-RPC error (not a transport 429).
- Never expose Cuentas Anuales/financial statements, sanctions/PEP/AI-analysis, or internal URLs/index names/stack traces.
- **Verified live `/bormes` field mappings (confirmed 2026-06-24):**
  - `GET /bormes/v3/search?query=&size=` → `{ results: [doc], total }`. Doc has `company_name`, `company_name_normalized`, `is_dissolved`, `is_in_concurso`, `status`, `first_seen`, `last_seen`, `id`/`group_key`, `province` (if present), `enriched_*` fields. Fuzzy matching is built in (handles typos).
  - `GET /bormes/v3/company/<name>` → `{ company: {...} }` envelope. Officer role field = `position_normalized`; officer name = `name` (fallback `officer_name`). Arrays: `officers_active`, `officers_resigned`, `sole_shareholders` (strings), `sole_shareholder_individuals` (strings), `name_changes`.
  - `GET /bormes/v3/events?company=&size=` → `{ events: [{ event_date, event_types: [{type,category}] }] }`.
  - `GET /bormes/v3/expand-officer?name=&size=` → `{ officers: [{ officer_name, specific_role, company_name, status }] }`.
  - `POST /bormes/sole-shareholder-companies` body `{ shareholder_name, limit }` → `{ companies: [...], total }` (companies the entity owns).

---

### Task 1: Scaffold the worker

**Files:**
- Create: `standalone_rag/local-rag/workers/borme-mcp/package.json`
- Create: `standalone_rag/local-rag/workers/borme-mcp/wrangler.jsonc`
- Create: `standalone_rag/local-rag/workers/borme-mcp/vitest.config.mts`
- Create: `standalone_rag/local-rag/workers/borme-mcp/src/index.js`
- Test: `standalone_rag/local-rag/workers/borme-mcp/test/health.test.js`

**Interfaces:**
- Produces: a Worker `fetch` default export. `GET /health` → 200 `"ok"`. Unknown paths → 404.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "borme-mcp",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.13.5",
    "vitest": "^4.1.0",
    "wrangler": "^4.78.0"
  }
}
```

- [ ] **Step 2: Create `wrangler.jsonc`** (KV binding placeholder filled in Task 9; vars set now)

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "borme-mcp",
  "main": "src/index.js",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": true,
  "preview_urls": false,
  "observability": { "logs": { "enabled": true } },
  "vars": {
    "BORMES_API_BASE": "https://api.ncdata.eu"
  }
}
```

- [ ] **Step 3: Create `vitest.config.mts`**

```ts
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

- [ ] **Step 4: Write the failing test** — `test/health.test.js`

```js
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index.js";

describe("worker routing", () => {
  it("GET /health returns ok", async () => {
    const ctx = createExecutionContext();
    const res = await worker.fetch(new Request("https://x/health"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("unknown path returns 404", async () => {
    const ctx = createExecutionContext();
    const res = await worker.fetch(new Request("https://x/nope"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 5: Run the test, verify it fails**

Run: `cd standalone_rag/local-rag/workers/borme-mcp && npm install && npm test`
Expected: FAIL — `../src/index.js` does not exist.

- [ ] **Step 6: Create minimal `src/index.js`**

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok", { status: 200 });
    return new Response("Not found", { status: 404 });
  },
};
```

- [ ] **Step 7: Run the test, verify it passes**

Run: `npm test`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add standalone_rag/local-rag/workers/borme-mcp
git commit -m "feat(borme-mcp): scaffold worker with health route"
```

---

### Task 2: BORMES API client

**Files:**
- Create: `standalone_rag/local-rag/workers/borme-mcp/src/bormes-client.js`
- Test: `standalone_rag/local-rag/workers/borme-mcp/test/bormes-client.test.js`

**Interfaces:**
- Produces: `makeBormesClient(env, fetchImpl = fetch)` → object with async methods, each returning `{ ok: boolean, status: number, data: any }`:
  - `searchCompanies(query, size)` → GET `v3/search`
  - `getCompany(name)` → GET `v3/company/<name>`
  - `expandOfficer(name, size)` → GET `v3/expand-officer`
  - `soleShareholderCompanies(name, limit)` → POST `sole-shareholder-companies`
  - Each call times out after 15s (AbortController) and never throws — failure → `{ ok:false, status, data:null }`.

- [ ] **Step 1: Write the failing test** — `test/bormes-client.test.js`

```js
import { describe, it, expect } from "vitest";
import { makeBormesClient } from "../src/bormes-client.js";

function mockFetch(record) {
  return async (url, opts) => {
    record.url = url;
    record.opts = opts;
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
}

describe("makeBormesClient", () => {
  const env = { BORMES_API_BASE: "https://api.example" };

  it("searchCompanies builds the v3/search URL and encodes the query", async () => {
    const rec = {};
    const client = makeBormesClient(env, mockFetch(rec));
    const out = await client.searchCompanies("ACME & CO", 10);
    expect(rec.url).toBe("https://api.example/bormes/v3/search?query=ACME%20%26%20CO&size=10");
    expect(out).toEqual({ ok: true, status: 200, data: { ok: true } });
  });

  it("getCompany builds the v3/company path URL", async () => {
    const rec = {};
    const client = makeBormesClient(env, mockFetch(rec));
    await client.getCompany("ACME SL");
    expect(rec.url).toBe("https://api.example/bormes/v3/company/ACME%20SL");
  });

  it("soleShareholderCompanies POSTs shareholder_name", async () => {
    const rec = {};
    const client = makeBormesClient(env, mockFetch(rec));
    await client.soleShareholderCompanies("ACME SL", 25);
    expect(rec.url).toBe("https://api.example/bormes/sole-shareholder-companies");
    expect(rec.opts.method).toBe("POST");
    expect(JSON.parse(rec.opts.body)).toEqual({ shareholder_name: "ACME SL", limit: 25 });
  });

  it("non-ok response yields ok:false", async () => {
    const client = makeBormesClient(env, async () => ({ ok: false, status: 404, json: async () => ({}) }));
    const out = await client.getCompany("X");
    expect(out.ok).toBe(false);
    expect(out.status).toBe(404);
    expect(out.data).toBeNull();
  });

  it("thrown fetch yields ok:false status 0 (never throws)", async () => {
    const client = makeBormesClient(env, async () => { throw new Error("boom"); });
    const out = await client.getCompany("X");
    expect(out).toEqual({ ok: false, status: 0, data: null });
  });

  it("defaults base to api.ncdata.eu when env var missing", async () => {
    const rec = {};
    const client = makeBormesClient({}, mockFetch(rec));
    await client.searchCompanies("x", 5);
    expect(rec.url.startsWith("https://api.ncdata.eu/bormes/")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test -- bormes-client`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/bormes-client.js`**

```js
const DEFAULT_BASE = "https://api.ncdata.eu";
const TIMEOUT_MS = 15000;

async function request(url, init, fetchImpl) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { ...init, signal: ctrl.signal });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    return { ok: true, status: 200, data: await res.json() };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(t);
  }
}

export function makeBormesClient(env, fetchImpl = fetch) {
  const base = (env && env.BORMES_API_BASE) || DEFAULT_BASE;
  const get = (path) => request(`${base}${path}`, { method: "GET" }, fetchImpl);
  const post = (path, body) =>
    request(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, fetchImpl);
  return {
    searchCompanies: (query, size) =>
      get(`/bormes/v3/search?query=${encodeURIComponent(query)}&size=${size}`),
    getCompany: (name) => get(`/bormes/v3/company/${encodeURIComponent(name)}`),
    expandOfficer: (name, size) =>
      get(`/bormes/v3/expand-officer?name=${encodeURIComponent(name)}&size=${size}`),
    soleShareholderCompanies: (name, limit) =>
      post(`/bormes/sole-shareholder-companies`, { shareholder_name: name, limit }),
  };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test -- bormes-client`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/bormes-client.js test/bormes-client.test.js
git commit -m "feat(borme-mcp): bormes API client with timeout + error normalization"
```

---

### Task 3: Formatting & attribution helpers

**Files:**
- Create: `standalone_rag/local-rag/workers/borme-mcp/src/format.js`
- Test: `standalone_rag/local-rag/workers/borme-mcp/test/format.test.js`

**Interfaces:**
- Produces:
  - `SOURCE_NOTE: string`, `SOLE_SHAREHOLDER_NOTE: string`
  - `nameToSlug(name) -> string` (ported verbatim from `functions/empresa/_lib.js`)
  - `buildEmpresaUrl(name) -> string` → `https://mapasocietario.es/empresa/<slug>`
  - `shapeOfficer(o) -> { name, role }` (reads `name`/`officer_name` and `position_normalized`/`role`/`specific_role`)
  - `capList(arr, max) -> { items, truncated }`

- [ ] **Step 1: Write the failing test** — `test/format.test.js`

```js
import { describe, it, expect } from "vitest";
import { nameToSlug, buildEmpresaUrl, shapeOfficer, capList, SOURCE_NOTE, SOLE_SHAREHOLDER_NOTE } from "../src/format.js";

describe("format helpers", () => {
  it("nameToSlug matches the site's slug rules", () => {
    expect(nameToSlug("Acción & Compañía, S.L.")).toBe("accion-y-compania-s-l");
    expect(nameToSlug("EL NIÑO SA")).toBe("el-nino-sa");
    expect(nameToSlug("  --Foo--  ")).toBe("foo");
  });

  it("buildEmpresaUrl wraps the slug", () => {
    expect(buildEmpresaUrl("ACME SL")).toBe("https://mapasocietario.es/empresa/acme-sl");
  });

  it("shapeOfficer reads position_normalized and name", () => {
    expect(shapeOfficer({ name: "ANA", position_normalized: "Administradora única" }))
      .toEqual({ name: "ANA", role: "Administradora única" });
  });

  it("shapeOfficer falls back to officer_name and specific_role", () => {
    expect(shapeOfficer({ officer_name: "LUIS", specific_role: "Consejero" }))
      .toEqual({ name: "LUIS", role: "Consejero" });
  });

  it("capList truncates and flags", () => {
    expect(capList([1, 2, 3], 2)).toEqual({ items: [1, 2], truncated: true });
    expect(capList([1, 2], 2)).toEqual({ items: [1, 2], truncated: false });
  });

  it("notes are non-empty strings", () => {
    expect(SOURCE_NOTE.length).toBeGreaterThan(10);
    expect(SOLE_SHAREHOLDER_NOTE.toLowerCase()).toContain("socio único");
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test -- format`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/format.js`**

```js
export const SOURCE_NOTE = "Unofficial; derived from BORME (Boletín Oficial del Registro Mercantil) publications.";
export const SOLE_SHAREHOLDER_NOTE =
  "BORME records only sole-shareholder ownership (socio único); it does not contain a general shareholder/cap-table. Absence here does not imply the company has no owner.";

const SITE = "https://mapasocietario.es";

// Ported verbatim from functions/empresa/_lib.js so URLs match the live site.
export function nameToSlug(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ñ/gi, "n")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildEmpresaUrl(name) {
  return `${SITE}/empresa/${nameToSlug(name)}`;
}

export function shapeOfficer(o) {
  return {
    name: o.name || o.officer_name || "",
    role: o.position_normalized || o.role || o.specific_role || o.position || "",
  };
}

export function capList(arr, max) {
  const list = Array.isArray(arr) ? arr : [];
  return { items: list.slice(0, max), truncated: list.length > max };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test -- format`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/format.js test/format.test.js
git commit -m "feat(borme-mcp): attribution + slug + shaping helpers (slug ported from site)"
```

---

### Task 4: Tool — `search_companies`

**Files:**
- Create: `standalone_rag/local-rag/workers/borme-mcp/src/tools/search-companies.js`
- Test: `standalone_rag/local-rag/workers/borme-mcp/test/search-companies.test.js`

**Interfaces:**
- Consumes: `makeBormesClient` (Task 2), `buildEmpresaUrl`/`SOURCE_NOTE` (Task 3).
- Produces: `export const definition = { name, description, inputSchema }` and `export async function handler(args, env, fetchImpl)`.
  - `args`: `{ query: string, limit?: number }`. Missing/empty `query` → throws `Error("query is required")`.
  - Returns `{ results: [{ name, status, province, incorporation_year, empresa_url }], total, source_note, note? }`. `limit` clamped to [1,25] default 10.

- [ ] **Step 1: Write the failing test** — `test/search-companies.test.js`

```js
import { describe, it, expect } from "vitest";
import { handler, definition } from "../src/tools/search-companies.js";

const env = { BORMES_API_BASE: "https://api.example" };
function fetchReturning(payload) {
  return async () => ({ ok: true, status: 200, json: async () => payload });
}

describe("search_companies", () => {
  it("definition has name and inputSchema", () => {
    expect(definition.name).toBe("search_companies");
    expect(definition.inputSchema.required).toContain("query");
  });

  it("maps results and adds empresa_url + source_note", async () => {
    const out = await handler({ query: "acme" }, env, fetchReturning({
      results: [{ company_name: "ACME SL", status: "active", province: "Madrid", first_seen: "2011-03-02" }],
      total: 1,
    }));
    expect(out.results[0]).toEqual({
      name: "ACME SL", status: "active", province: "Madrid",
      incorporation_year: "2011", empresa_url: "https://mapasocietario.es/empresa/acme-sl",
    });
    expect(out.source_note.length).toBeGreaterThan(10);
  });

  it("clamps limit to max 25", async () => {
    const rec = {};
    const fetchImpl = async (url) => { rec.url = url; return { ok: true, status: 200, json: async () => ({ results: [], total: 0 }) }; };
    await handler({ query: "x", limit: 999 }, env, fetchImpl);
    expect(rec.url).toContain("size=25");
  });

  it("empty query throws", async () => {
    await expect(handler({ query: "  " }, env, fetchReturning({}))).rejects.toThrow("query is required");
  });

  it("upstream failure returns empty results with a note", async () => {
    const out = await handler({ query: "x" }, env, async () => ({ ok: false, status: 503, json: async () => ({}) }));
    expect(out.results).toEqual([]);
    expect(out.note).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test -- search-companies`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/tools/search-companies.js`**

```js
import { makeBormesClient } from "../bormes-client.js";
import { buildEmpresaUrl, SOURCE_NOTE } from "../format.js";

export const definition = {
  name: "search_companies",
  description:
    "Search Spanish companies by name in the BORME registry. Returns ranked matches (fuzzy — tolerant of typos) with status and a mapasocietario.es/empresa link to cite. Use this first to resolve a company before get_company.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Company name or partial name." },
      limit: { type: "number", description: "Max results (1-25, default 10)." },
    },
    required: ["query"],
  },
};

function clampLimit(n) {
  const v = Number.isFinite(n) ? Math.floor(n) : 10;
  return Math.max(1, Math.min(25, v));
}

export async function handler(args, env, fetchImpl = fetch) {
  const query = (args?.query || "").trim();
  if (!query) throw new Error("query is required");
  const limit = clampLimit(args?.limit);
  const client = makeBormesClient(env, fetchImpl);
  const res = await client.searchCompanies(query, limit);
  if (!res.ok || !res.data) {
    return { results: [], total: 0, source_note: SOURCE_NOTE, note: "Registry search is temporarily unavailable; try again shortly." };
  }
  const results = (res.data.results || []).map((d) => ({
    name: d.company_name || "",
    status: d.is_dissolved ? "dissolved" : d.is_in_concurso ? "concurso" : (d.status || "active"),
    province: d.province || null,
    incorporation_year: (d.first_seen || "").slice(0, 4) || null,
    empresa_url: buildEmpresaUrl(d.company_name || ""),
  }));
  const out = { results, total: res.data.total || results.length, source_note: SOURCE_NOTE };
  if (results.length === 0) out.note = "No company matched. Try a different spelling or a shorter, distinctive part of the name.";
  return out;
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test -- search-companies`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/tools/search-companies.js test/search-companies.test.js
git commit -m "feat(borme-mcp): search_companies tool"
```

---

### Task 5: Tool — `get_company` (dissolution rule + sole-shareholder honesty)

**Files:**
- Create: `standalone_rag/local-rag/workers/borme-mcp/src/tools/get-company.js`
- Test: `standalone_rag/local-rag/workers/borme-mcp/test/get-company.test.js`

**Interfaces:**
- Consumes: `makeBormesClient` (Task 2); `buildEmpresaUrl`, `shapeOfficer`, `SOURCE_NOTE`, `SOLE_SHAREHOLDER_NOTE` (Task 3).
- Produces: `definition` + `async handler(args, env, fetchImpl)`.
  - `args`: `{ name?: string, slug?: string }` (one required; `slug` is de-slugified to a query via `replace(/-+/g," ")`). Missing both → throws `Error("name or slug is required")`.
  - Returns `{ name, status, dissolved, incorporation_date, current_officers, former_officers, sole_shareholder, sole_shareholder_note, empresa_url, source_note }`.
  - **Dissolution rule:** `dissolved === true` ⇒ `current_officers === []` and active officers are appended to `former_officers`.

- [ ] **Step 1: Write the failing test** — `test/get-company.test.js`

```js
import { describe, it, expect } from "vitest";
import { handler } from "../src/tools/get-company.js";

const env = { BORMES_API_BASE: "https://api.example" };
function companyFetch(company) {
  return async () => ({ ok: true, status: 200, json: async () => ({ company }) });
}

describe("get_company", () => {
  it("active company keeps current officers", async () => {
    const out = await handler({ name: "ACME SL" }, env, companyFetch({
      company_name: "ACME SL", is_dissolved: false, first_seen: "2010-01-05",
      officers_active: [{ name: "ANA", position_normalized: "Administradora única" }],
      officers_resigned: [{ name: "LUIS", position_normalized: "Consejero" }],
      sole_shareholders: ["HOLDCO SL"],
    }));
    expect(out.dissolved).toBe(false);
    expect(out.current_officers).toEqual([{ name: "ANA", role: "Administradora única" }]);
    expect(out.former_officers).toEqual([{ name: "LUIS", role: "Consejero" }]);
    expect(out.sole_shareholder).toBe("HOLDCO SL");
    expect(out.sole_shareholder_note).toContain("socio único");
    expect(out.empresa_url).toBe("https://mapasocietario.es/empresa/acme-sl");
    expect(out.source_note.length).toBeGreaterThan(10);
  });

  it("dissolved company reports NO current officers (dissolution rule)", async () => {
    const out = await handler({ name: "DEADCO SL" }, env, companyFetch({
      company_name: "DEADCO SL", is_dissolved: true,
      officers_active: [{ name: "ANA", position_normalized: "Administradora única" }],
      officers_resigned: [],
    }));
    expect(out.dissolved).toBe(true);
    expect(out.current_officers).toEqual([]);
    expect(out.former_officers).toEqual([{ name: "ANA", role: "Administradora única" }]);
    expect(out.source_note.toLowerCase()).toContain("dissol");
  });

  it("no sole shareholder → null with the note still present", async () => {
    const out = await handler({ name: "X SL" }, env, companyFetch({
      company_name: "X SL", is_dissolved: false, officers_active: [], officers_resigned: [], sole_shareholders: [],
    }));
    expect(out.sole_shareholder).toBeNull();
    expect(out.sole_shareholder_note).toContain("socio único");
  });

  it("slug input is de-slugified", async () => {
    const rec = {};
    const fetchImpl = async (url) => { rec.url = url; return { ok: true, status: 200, json: async () => ({ company: { company_name: "ACME SL" } }) }; };
    await handler({ slug: "acme-sl" }, env, fetchImpl);
    expect(decodeURIComponent(rec.url)).toContain("/bormes/v3/company/acme sl");
  });

  it("missing name and slug throws", async () => {
    await expect(handler({}, env, companyFetch({}))).rejects.toThrow("name or slug is required");
  });

  it("upstream 404 returns a not-found note (not an exception)", async () => {
    const out = await handler({ name: "ghost" }, env, async () => ({ ok: false, status: 404, json: async () => ({}) }));
    expect(out.note).toBeTruthy();
    expect(out.current_officers).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test -- get-company`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/tools/get-company.js`**

```js
import { makeBormesClient } from "../bormes-client.js";
import { buildEmpresaUrl, shapeOfficer, SOURCE_NOTE, SOLE_SHAREHOLDER_NOTE } from "../format.js";

export const definition = {
  name: "get_company",
  description:
    "Get the BORME registry profile of one Spanish company: status, incorporation, current and former officers, and sole shareholder (BORME records only sole-shareholder ownership). Includes a mapasocietario.es/empresa link to cite. Pass a name (fuzzy-resolved) or a slug.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Company name (fuzzy-resolved to one entity)." },
      slug: { type: "string", description: "A mapasocietario /empresa slug, e.g. 'acme-sl'." },
    },
  },
};

const DISSOLUTION_NOTE =
  " This company is dissolved; under the registry-faithful rule no officer is reported as currently in office, even if BORME has not inscribed a formal cessation.";

export async function handler(args, env, fetchImpl = fetch) {
  const name = (args?.name || "").trim() || (args?.slug || "").replace(/-+/g, " ").trim();
  if (!name) throw new Error("name or slug is required");
  const client = makeBormesClient(env, fetchImpl);
  const res = await client.getCompany(name);
  if (!res.ok || !res.data) {
    return {
      name, status: "unknown", dissolved: false, incorporation_date: null,
      current_officers: [], former_officers: [], sole_shareholder: null,
      sole_shareholder_note: SOLE_SHAREHOLDER_NOTE, empresa_url: buildEmpresaUrl(name),
      source_note: SOURCE_NOTE, note: "Company not found, or registry temporarily unavailable.",
    };
  }
  const c = res.data.company || res.data || {};
  const dissolved = !!c.is_dissolved;
  const active = (c.officers_active || []).map(shapeOfficer);
  const resigned = (c.officers_resigned || []).map(shapeOfficer);
  const shareholders = [...(c.sole_shareholders || []), ...(c.sole_shareholder_individuals || [])];
  return {
    name: c.company_name || name,
    status: dissolved ? "dissolved" : c.is_in_concurso ? "concurso" : (c.status || "active"),
    dissolved,
    incorporation_date: c.first_seen || null,
    current_officers: dissolved ? [] : active,
    former_officers: dissolved ? [...resigned, ...active] : resigned,
    sole_shareholder: shareholders[0] || null,
    sole_shareholder_note: SOLE_SHAREHOLDER_NOTE,
    empresa_url: buildEmpresaUrl(c.company_name || name),
    source_note: SOURCE_NOTE + (dissolved ? DISSOLUTION_NOTE : ""),
  };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test -- get-company`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/tools/get-company.js test/get-company.test.js
git commit -m "feat(borme-mcp): get_company tool (dissolution rule + sole-shareholder honesty)"
```

---

### Task 6: Tool — `search_officers`

**Files:**
- Create: `standalone_rag/local-rag/workers/borme-mcp/src/tools/search-officers.js`
- Test: `standalone_rag/local-rag/workers/borme-mcp/test/search-officers.test.js`

**Interfaces:**
- Consumes: `makeBormesClient` (Task 2); `buildEmpresaUrl`, `SOURCE_NOTE` (Task 3).
- Produces: `definition` + `async handler(args, env, fetchImpl)`.
  - `args`: `{ name: string, limit?: number }`. Empty `name` → throws `Error("name is required")`.
  - Returns `{ results: [{ officer_name, company_name, role, empresa_url }], source_note, note? }`, capped to limit (default 10, max 25).

- [ ] **Step 1: Write the failing test** — `test/search-officers.test.js`

```js
import { describe, it, expect } from "vitest";
import { handler } from "../src/tools/search-officers.js";

const env = { BORMES_API_BASE: "https://api.example" };

describe("search_officers", () => {
  it("flattens expand-officer rows with empresa_url", async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({
      officers: [
        { officer_name: "ANA GIL", specific_role: "Administradora", company_name: "ACME SL" },
        { officer_name: "ANA GIL", specific_role: "Consejera", company_name: "BETA SA" },
      ],
    }) });
    const out = await handler({ name: "ana gil" }, env, fetchImpl);
    expect(out.results).toEqual([
      { officer_name: "ANA GIL", company_name: "ACME SL", role: "Administradora", empresa_url: "https://mapasocietario.es/empresa/acme-sl" },
      { officer_name: "ANA GIL", company_name: "BETA SA", role: "Consejera", empresa_url: "https://mapasocietario.es/empresa/beta-sa" },
    ]);
    expect(out.source_note.length).toBeGreaterThan(10);
  });

  it("caps to limit", async () => {
    const officers = Array.from({ length: 30 }, (_, i) => ({ officer_name: "X", specific_role: "R", company_name: `C${i}` }));
    const out = await handler({ name: "x", limit: 5 }, env, async () => ({ ok: true, status: 200, json: async () => ({ officers }) }));
    expect(out.results).toHaveLength(5);
    expect(out.note).toContain("more");
  });

  it("empty name throws", async () => {
    await expect(handler({ name: "" }, env, async () => ({}))).rejects.toThrow("name is required");
  });

  it("upstream failure returns empty with a note", async () => {
    const out = await handler({ name: "x" }, env, async () => ({ ok: false, status: 503, json: async () => ({}) }));
    expect(out.results).toEqual([]);
    expect(out.note).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test -- search-officers`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/tools/search-officers.js`**

```js
import { makeBormesClient } from "../bormes-client.js";
import { buildEmpresaUrl, SOURCE_NOTE } from "../format.js";

export const definition = {
  name: "search_officers",
  description:
    "Find a person (administrator/director/apoderado) in the BORME registry and list the companies they are linked to. Answers 'is officer Z present in other companies?'. Each row links to mapasocietario.es/empresa.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Person name or partial name." },
      limit: { type: "number", description: "Max rows (1-25, default 10)." },
    },
    required: ["name"],
  },
};

function clampLimit(n) {
  const v = Number.isFinite(n) ? Math.floor(n) : 10;
  return Math.max(1, Math.min(25, v));
}

export async function handler(args, env, fetchImpl = fetch) {
  const name = (args?.name || "").trim();
  if (!name) throw new Error("name is required");
  const limit = clampLimit(args?.limit);
  const client = makeBormesClient(env, fetchImpl);
  const res = await client.expandOfficer(name, 200);
  if (!res.ok || !res.data) {
    return { results: [], source_note: SOURCE_NOTE, note: "Officer search is temporarily unavailable; try again shortly." };
  }
  const rows = (res.data.officers || []).map((o) => ({
    officer_name: o.officer_name || o.name || "",
    company_name: o.company_name || "",
    role: o.specific_role || o.position_normalized || o.role || "",
    empresa_url: buildEmpresaUrl(o.company_name || ""),
  }));
  const out = { results: rows.slice(0, limit), source_note: SOURCE_NOTE };
  if (rows.length === 0) out.note = "No officer matched. Try a different spelling.";
  else if (rows.length > limit) out.note = `Showing ${limit} of ${rows.length}; more exist — narrow the name to see others.`;
  return out;
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test -- search-officers`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/tools/search-officers.js test/search-officers.test.js
git commit -m "feat(borme-mcp): search_officers tool"
```

---

### Task 7: Tool — `get_company_network`

**Files:**
- Create: `standalone_rag/local-rag/workers/borme-mcp/src/tools/get-company-network.js`
- Test: `standalone_rag/local-rag/workers/borme-mcp/test/get-company-network.test.js`

**Interfaces:**
- Consumes: `makeBormesClient` (Task 2); `buildEmpresaUrl`, `shapeOfficer`, `SOURCE_NOTE`, `capList` (Task 3).
- Produces: `definition` + `async handler(args, env, fetchImpl)`.
  - `args`: `{ name?: string, slug?: string }` (one required). Returns `{ company, connected: [{ name, relationship, via?, empresa_url }], truncated, source_note }`.
  - Edges: `shared_officer` (via each current officer's other companies, `expandOfficer`), `owned_by` (this company's sole shareholders), `owns` (`soleShareholderCompanies`). Self-edges excluded. Deduped by `name`+`relationship`. Total capped at 25 → `truncated`.

- [ ] **Step 1: Write the failing test** — `test/get-company-network.test.js`

```js
import { describe, it, expect } from "vitest";
import { handler } from "../src/tools/get-company-network.js";

const env = { BORMES_API_BASE: "https://api.example" };

// Route mock by URL substring.
function router(map) {
  return async (url, opts) => {
    for (const [frag, payload] of Object.entries(map)) {
      if (url.includes(frag)) return { ok: true, status: 200, json: async () => payload };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
}

describe("get_company_network", () => {
  it("assembles shared_officer, owned_by and owns edges, excluding self", async () => {
    const fetchImpl = router({
      "/bormes/v3/company/": { company: {
        company_name: "ACME SL", is_dissolved: false,
        officers_active: [{ name: "ANA", position_normalized: "Administradora" }],
        sole_shareholders: ["HOLDCO SL"], sole_shareholder_individuals: [],
      } },
      "/bormes/v3/expand-officer": { officers: [
        { officer_name: "ANA", company_name: "ACME SL" },   // self — excluded
        { officer_name: "ANA", company_name: "BETA SA" },
      ] },
      "/bormes/sole-shareholder-companies": { companies: [{ company_name: "SUBCO SL" }], total: 1 },
    });
    const out = await handler({ name: "ACME SL" }, env, fetchImpl);
    expect(out.company).toBe("ACME SL");
    const byName = Object.fromEntries(out.connected.map((c) => [c.name, c.relationship]));
    expect(byName["BETA SA"]).toBe("shared_officer");
    expect(byName["HOLDCO SL"]).toBe("owned_by");
    expect(byName["SUBCO SL"]).toBe("owns");
    expect(byName["ACME SL"]).toBeUndefined();
    expect(out.connected.find((c) => c.name === "BETA SA").empresa_url)
      .toBe("https://mapasocietario.es/empresa/beta-sa");
    expect(out.truncated).toBe(false);
  });

  it("caps connections at 25 and sets truncated", async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ officer_name: "ANA", company_name: `C${i}` }));
    const fetchImpl = router({
      "/bormes/v3/company/": { company: { company_name: "ACME SL", officers_active: [{ name: "ANA" }], sole_shareholders: [] } },
      "/bormes/v3/expand-officer": { officers: many },
      "/bormes/sole-shareholder-companies": { companies: [] },
    });
    const out = await handler({ name: "ACME SL" }, env, fetchImpl);
    expect(out.connected).toHaveLength(25);
    expect(out.truncated).toBe(true);
  });

  it("missing name and slug throws", async () => {
    await expect(handler({}, env, async () => ({}))).rejects.toThrow("name or slug is required");
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test -- get-company-network`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/tools/get-company-network.js`**

```js
import { makeBormesClient } from "../bormes-client.js";
import { buildEmpresaUrl, shapeOfficer, SOURCE_NOTE, capList } from "../format.js";

const MAX_CONNECTIONS = 25;

export const definition = {
  name: "get_company_network",
  description:
    "Show companies directly connected to one Spanish company: via shared officers, via being owned by it (owns), or via owning it (owned_by). Answers 'is there a relationship between company X and company Y?'. Each connection links to mapasocietario.es/empresa.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Company name (fuzzy-resolved)." },
      slug: { type: "string", description: "A mapasocietario /empresa slug." },
    },
  },
};

export async function handler(args, env, fetchImpl = fetch) {
  const name = (args?.name || "").trim() || (args?.slug || "").replace(/-+/g, " ").trim();
  if (!name) throw new Error("name or slug is required");
  const client = makeBormesClient(env, fetchImpl);

  const companyRes = await client.getCompany(name);
  const c = (companyRes.ok && (companyRes.data?.company || companyRes.data)) || {};
  const canonical = c.company_name || name;
  const self = canonical.toUpperCase();

  const edges = [];
  const seen = new Set();
  const add = (rawName, relationship, via) => {
    const n = (rawName || "").trim();
    if (!n || n.toUpperCase() === self) return;
    const key = `${n.toUpperCase()}|${relationship}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ name: n, relationship, ...(via ? { via } : {}), empresa_url: buildEmpresaUrl(n) });
  };

  // owned_by: this company's sole shareholders (from the company doc)
  for (const sh of [...(c.sole_shareholders || []), ...(c.sole_shareholder_individuals || [])]) add(sh, "owned_by");

  // shared_officer: each current officer's other companies
  const officers = (c.officers_active || []).map(shapeOfficer).filter((o) => o.name);
  const officerResults = await Promise.all(officers.map((o) => client.expandOfficer(o.name, 100).then((r) => ({ o, r }))));
  for (const { o, r } of officerResults) {
    if (!r.ok || !r.data) continue;
    for (const row of r.data.officers || []) add(row.company_name, "shared_officer", o.name);
  }

  // owns: companies where this company is the sole shareholder
  const ownsRes = await client.soleShareholderCompanies(canonical, 100);
  if (ownsRes.ok && ownsRes.data) for (const co of ownsRes.data.companies || []) add(co.company_name || co.name, "owns");

  const { items, truncated } = capList(edges, MAX_CONNECTIONS);
  return { company: canonical, connected: items, truncated, source_note: SOURCE_NOTE };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test -- get-company-network`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/tools/get-company-network.js test/get-company-network.test.js
git commit -m "feat(borme-mcp): get_company_network tool (shared_officer/owns/owned_by, capped)"
```

---

### Task 8: MCP JSON-RPC handler

**Files:**
- Create: `standalone_rag/local-rag/workers/borme-mcp/src/tools/index.js`
- Create: `standalone_rag/local-rag/workers/borme-mcp/src/mcp.js`
- Test: `standalone_rag/local-rag/workers/borme-mcp/test/mcp.test.js`

**Interfaces:**
- Consumes: the four tool modules' `definition` + `handler` exports (Tasks 4-7).
- Produces:
  - `src/tools/index.js`: `export const TOOLS = [ {definition, handler}, ... ]` (the 4 tools).
  - `src/mcp.js`: `export const SERVER_INFO`, `export const INSTRUCTIONS`, and `export async function handleRpcMessage(message, ctx)` where `ctx = { tools, env, fetchImpl }`. Returns a JSON-RPC response object, or `null` for notifications (no `id`).
  - `initialize` → `{ protocolVersion, capabilities:{tools:{}}, serverInfo, instructions }` (echoes the client's `protocolVersion`, default `"2024-11-05"`).
  - `tools/list` → `{ tools: [definition...] }`.
  - `tools/call` → `{ content: [{ type:"text", text: JSON.stringify(result) }] }`; tool `throw` → `{ content:[{type:"text",text}], isError:true }`.
  - `ping` → `{}`. Unknown method → error `-32601`. Missing tool name → error `-32602`.

- [ ] **Step 1: Write the failing test** — `test/mcp.test.js`

```js
import { describe, it, expect } from "vitest";
import { handleRpcMessage, SERVER_INFO } from "../src/mcp.js";

const okTool = {
  definition: { name: "echo", description: "d", inputSchema: { type: "object", properties: {} } },
  handler: async (args) => ({ got: args }),
};
const boomTool = {
  definition: { name: "boom", description: "d", inputSchema: { type: "object", properties: {} } },
  handler: async () => { throw new Error("kaboom"); },
};
const ctx = { tools: [okTool, boomTool], env: {}, fetchImpl: async () => ({}) };

describe("handleRpcMessage", () => {
  it("initialize echoes protocolVersion and returns serverInfo + instructions", async () => {
    const r = await handleRpcMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, ctx);
    expect(r.result.protocolVersion).toBe("2025-06-18");
    expect(r.result.capabilities.tools).toBeDefined();
    expect(r.result.serverInfo).toEqual(SERVER_INFO);
    expect(r.result.instructions.length).toBeGreaterThan(20);
  });

  it("initialize without protocolVersion defaults", async () => {
    const r = await handleRpcMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, ctx);
    expect(r.result.protocolVersion).toBe("2024-11-05");
  });

  it("notifications/initialized returns null (no response)", async () => {
    const r = await handleRpcMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, ctx);
    expect(r).toBeNull();
  });

  it("tools/list returns the tool definitions", async () => {
    const r = await handleRpcMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, ctx);
    expect(r.result.tools.map((t) => t.name)).toEqual(["echo", "boom"]);
  });

  it("tools/call runs the tool and wraps the result as text content", async () => {
    const r = await handleRpcMessage({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "echo", arguments: { a: 1 } } }, ctx);
    expect(r.result.content[0].type).toBe("text");
    expect(JSON.parse(r.result.content[0].text)).toEqual({ got: { a: 1 } });
    expect(r.result.isError).toBeFalsy();
  });

  it("tools/call on a throwing tool returns isError content (not a protocol error)", async () => {
    const r = await handleRpcMessage({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "boom", arguments: {} } }, ctx);
    expect(r.result.isError).toBe(true);
    expect(r.result.content[0].text).toContain("kaboom");
  });

  it("unknown tool → error -32602", async () => {
    const r = await handleRpcMessage({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope" } }, ctx);
    expect(r.error.code).toBe(-32602);
  });

  it("unknown method → error -32601", async () => {
    const r = await handleRpcMessage({ jsonrpc: "2.0", id: 6, method: "foo/bar" }, ctx);
    expect(r.error.code).toBe(-32601);
  });

  it("ping → empty result", async () => {
    const r = await handleRpcMessage({ jsonrpc: "2.0", id: 7, method: "ping" }, ctx);
    expect(r.result).toEqual({});
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test -- mcp`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/tools/index.js`**

```js
import * as searchCompanies from "./search-companies.js";
import * as getCompany from "./get-company.js";
import * as searchOfficers from "./search-officers.js";
import * as getCompanyNetwork from "./get-company-network.js";

export const TOOLS = [
  { definition: searchCompanies.definition, handler: searchCompanies.handler },
  { definition: getCompany.definition, handler: getCompany.handler },
  { definition: searchOfficers.definition, handler: searchOfficers.handler },
  { definition: getCompanyNetwork.definition, handler: getCompanyNetwork.handler },
];
```

- [ ] **Step 4: Create `src/mcp.js`**

```js
export const SERVER_INFO = { name: "borme-mcp", version: "1.0.0" };

export const INSTRUCTIONS =
  "Mapa Societario — Spanish company registry (BORME). Search Spanish companies and officers and explore corporate relationships, derived from official BORME (Boletín Oficial del Registro Mercantil) publications since 2009 (~3.2M companies, ~9.5M filings). Data is UNOFFICIAL and provided as-is. Ownership: BORME records only sole-shareholder (socio único), not full shareholder/cap-tables. Cross-company time-range queries (e.g. all registry transfers in a date window) are not supported. For documented or critical use, see the official BORME and the paid Due Diligence report at mapasocietario.es. Every company result includes a mapasocietario.es/empresa link — cite it.";

const DEFAULT_PROTOCOL = "2024-11-05";

function ok(id, result) { return { jsonrpc: "2.0", id, result }; }
function err(id, code, message) { return { jsonrpc: "2.0", id, error: { code, message } }; }

export async function handleRpcMessage(message, ctx) {
  const { tools, env, fetchImpl } = ctx;
  const { id, method, params } = message || {};
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: params?.protocolVersion || DEFAULT_PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: tools.map((t) => t.definition) });
    case "tools/call": {
      const tool = tools.find((t) => t.definition.name === params?.name);
      if (!tool) return err(id, -32602, `Unknown tool: ${params?.name}`);
      try {
        const result = await tool.handler(params?.arguments || {}, env, fetchImpl);
        return ok(id, { content: [{ type: "text", text: JSON.stringify(result) }] });
      } catch (e) {
        return ok(id, { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true });
      }
    }
    default:
      if (isNotification) return null;
      return err(id, -32601, `Method not found: ${method}`);
  }
}
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `npm test -- mcp`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add src/tools/index.js src/mcp.js test/mcp.test.js
git commit -m "feat(borme-mcp): stateless MCP JSON-RPC handler + tool registry"
```

---

### Task 9: Rate limiting + wire the `/mcp` endpoint

**Files:**
- Create: `standalone_rag/local-rag/workers/borme-mcp/src/ratelimit.js`
- Modify: `standalone_rag/local-rag/workers/borme-mcp/src/index.js` (replace the Task 1 body)
- Modify: `standalone_rag/local-rag/workers/borme-mcp/wrangler.jsonc` (add KV binding)
- Test: `standalone_rag/local-rag/workers/borme-mcp/test/ratelimit.test.js`
- Test: `standalone_rag/local-rag/workers/borme-mcp/test/endpoint.test.js`

**Interfaces:**
- Consumes: `handleRpcMessage` (Task 8), `TOOLS` (Task 8).
- Produces:
  - `enforceRateLimit(kv, ip, now, limits = { perMinute: 30, perDay: 1000 })` → `{ allowed: boolean, reason?: string }`. Fixed-window counters in KV with TTL.
  - `src/index.js`: `GET /health` → 200; `POST /mcp` → parse JSON-RPC (single or batch), rate-limit per IP (on exceed return JSON-RPC error `-32000` echoing each id), dispatch via `handleRpcMessage`, respond `application/json`; notifications-only → 202. CORS preflight on `/mcp`.

- [ ] **Step 1: Write the failing test** — `test/ratelimit.test.js`

```js
import { describe, it, expect } from "vitest";
import { enforceRateLimit } from "../src/ratelimit.js";

function fakeKv() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
  };
}

describe("enforceRateLimit", () => {
  it("allows under the per-minute limit and increments", async () => {
    const kv = fakeKv();
    const r = await enforceRateLimit(kv, "1.2.3.4", 0, { perMinute: 2, perDay: 100 });
    expect(r.allowed).toBe(true);
  });

  it("blocks once the per-minute limit is reached", async () => {
    const kv = fakeKv();
    const now = 0;
    await enforceRateLimit(kv, "ip", now, { perMinute: 2, perDay: 100 });
    await enforceRateLimit(kv, "ip", now, { perMinute: 2, perDay: 100 });
    const r = await enforceRateLimit(kv, "ip", now, { perMinute: 2, perDay: 100 });
    expect(r).toEqual({ allowed: false, reason: "rate_minute" });
  });

  it("blocks on the per-day limit", async () => {
    const kv = fakeKv();
    await enforceRateLimit(kv, "ip", 0, { perMinute: 100, perDay: 1 });
    const r = await enforceRateLimit(kv, "ip", 30_000, { perMinute: 100, perDay: 1 });
    expect(r).toEqual({ allowed: false, reason: "rate_day" });
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test -- ratelimit`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/ratelimit.js`**

```js
// Per-IP fixed-window counters in Workers KV. Approximate (KV is eventually
// consistent) but fine for abuse control — this is not billing.
export async function enforceRateLimit(kv, ip, now, limits = { perMinute: 30, perDay: 1000 }) {
  const minKey = `m:${ip}:${Math.floor(now / 60000)}`;
  const dayKey = `d:${ip}:${Math.floor(now / 86400000)}`;
  const [minRaw, dayRaw] = await Promise.all([kv.get(minKey), kv.get(dayKey)]);
  const minCount = Number(minRaw || 0);
  const dayCount = Number(dayRaw || 0);
  if (minCount >= limits.perMinute) return { allowed: false, reason: "rate_minute" };
  if (dayCount >= limits.perDay) return { allowed: false, reason: "rate_day" };
  await Promise.all([
    kv.put(minKey, String(minCount + 1), { expirationTtl: 120 }),
    kv.put(dayKey, String(dayCount + 1), { expirationTtl: 90000 }),
  ]);
  return { allowed: true };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test -- ratelimit`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the KV namespace to `wrangler.jsonc`** (top-level, after `vars`)

```jsonc
  "kv_namespaces": [
    { "binding": "RATE_LIMIT_KV", "id": "PLACEHOLDER_REPLACE_AFTER_CREATE" }
  ]
```

Then create the namespace and paste the real id:
Run: `npx wrangler kv namespace create RATE_LIMIT_KV` → copy the printed `id` into the binding above.
(For tests, `@cloudflare/vitest-pool-workers` provides a local KV for this binding automatically.)

- [ ] **Step 6: Replace `src/index.js`**

```js
import { handleRpcMessage } from "./mcp.js";
import { TOOLS } from "./tools/index.js";
import { enforceRateLimit } from "./ratelimit.js";

const MCP_PATH = "/mcp";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
}
function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok", { status: 200 });
    if (url.pathname !== MCP_PATH) return new Response("Not found", { status: 404 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    let body;
    try { body = await request.json(); }
    catch { return json(rpcError(null, -32700, "Parse error")); }

    const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
    const rl = await enforceRateLimit(env.RATE_LIMIT_KV, ip, Date.now());

    const messages = Array.isArray(body) ? body : [body];
    const ctx = { tools: TOOLS, env, fetchImpl: fetch };
    const responses = [];
    for (const m of messages) {
      if (!rl.allowed) {
        if (m && m.id !== undefined && m.id !== null) {
          responses.push(rpcError(m.id, -32000, "Rate limit reached. Please retry in a moment."));
        }
        continue;
      }
      const r = await handleRpcMessage(m, ctx);
      if (r) responses.push(r);
    }

    if (responses.length === 0) return new Response(null, { status: 202, headers: CORS });
    return json(Array.isArray(body) ? responses : responses[0]);
  },
};
```

- [ ] **Step 7: Write the endpoint integration test** — `test/endpoint.test.js`

```js
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index.js";

async function rpc(message) {
  const ctx = createExecutionContext();
  const res = await worker.fetch(
    new Request("https://x/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(message) }),
    env, ctx,
  );
  await waitOnExecutionContext(ctx);
  return res;
}

describe("/mcp endpoint", () => {
  it("initialize returns a JSON-RPC result", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.serverInfo.name).toBe("borme-mcp");
  });

  it("tools/list returns the four tools", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const body = await res.json();
    expect(body.result.tools.map((t) => t.name).sort()).toEqual(
      ["get_company", "get_company_network", "search_companies", "search_officers"]
    );
  });

  it("a notification returns 202 with no body", async () => {
    const res = await rpc({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(res.status).toBe(202);
  });

  it("malformed JSON returns a parse error", async () => {
    const ctx = createExecutionContext();
    const res = await worker.fetch(new Request("https://x/mcp", { method: "POST", body: "{not json" }), env, ctx);
    await waitOnExecutionContext(ctx);
    const body = await res.json();
    expect(body.error.code).toBe(-32700);
  });
});
```

- [ ] **Step 8: Run all tests, verify they pass**

Run: `npm test`
Expected: PASS — all suites green (health, bormes-client, format, the 4 tools, mcp, ratelimit, endpoint).

- [ ] **Step 9: Commit**

```bash
git add src/ratelimit.js src/index.js wrangler.jsonc test/ratelimit.test.js test/endpoint.test.js
git commit -m "feat(borme-mcp): per-IP rate limiting + /mcp JSON-RPC endpoint"
```

---

### Task 10: Deploy config, README & deprecate the old server

**Files:**
- Modify: `standalone_rag/local-rag/workers/borme-mcp/wrangler.jsonc` (custom domain route)
- Create: `standalone_rag/local-rag/workers/borme-mcp/README.md`
- Modify: `spanish-companies-mcp-server/README.md` (deprecation banner) — path is `/Users/alessandronurnberg/spanish-companies-mcp-server/README.md`

**Interfaces:**
- Produces: deployable worker on `mcp.mapasocietario.es`; README with the connector URL, tool list, scope/limits, and the manual smoke-test checklist; a deprecation note on the old stdio server.

- [ ] **Step 1: Add the custom-domain route to `wrangler.jsonc`** (top-level)

```jsonc
  "routes": [
    { "pattern": "mcp.mapasocietario.es", "custom_domain": true }
  ]
```

- [ ] **Step 2: Create `README.md`**

````markdown
# borme-mcp

Anonymous, read-only **remote MCP server** exposing Spanish company-registry
facts (BORME-derived) as a Claude connector. Wraps the live `/bormes` API; holds
no data of its own. Spec: `mapasocietario/docs/superpowers/specs/2026-06-24-borme-mcp-connector-design.md`.

- **Connector URL:** `https://mcp.mapasocietario.es/mcp` (Streamable HTTP, JSON-RPC)
- **Auth:** none. **Rate limit:** 30/min, 1,000/day per IP.
- **Tools:** `search_companies`, `get_company`, `search_officers`, `get_company_network`.
- **Out of scope:** sanctions/PEP/AI analysis, Cuentas Anuales, and cross-company
  time-range/event queries (Phase 2 — needs a new backend endpoint).

## Develop / test / deploy

```bash
npm install
npm test
npx wrangler kv namespace create RATE_LIMIT_KV   # once; paste id into wrangler.jsonc
npm run deploy
```

## Manual smoke test (against live API + a Claude client)

1. `curl -s https://mcp.mapasocietario.es/health` → `ok`.
2. `initialize` + `tools/list` via curl POST to `/mcp` → four tools listed.
3. `get_company` on a known **active** company → current officers present, `empresa_url` resolves (open it).
4. `get_company` on a known **dissolved** company → `current_officers: []`, dissolution note present.
5. `get_company` on a sole-shareholder company → `sole_shareholder` populated; the note is always present.
6. `search_companies` with a deliberate typo → ranked candidates still returned.
7. `search_officers` for a person in several companies → multiple rows.
8. `get_company_network` for a company with subsidiaries → `owns`/`owned_by`/`shared_officer` edges, ≤25.
9. Add `https://mcp.mapasocietario.es/mcp` as a custom connector in a Claude client → tools usable end to end.
````

- [ ] **Step 3: Add a deprecation banner to the old server README**

At the very top of `/Users/alessandronurnberg/spanish-companies-mcp-server/README.md`, prepend:

```markdown
> **DEPRECATED (2026-06-24).** Superseded by the remote MCP connector `borme-mcp`
> (`standalone_rag/local-rag/workers/borme-mcp`, live at `https://mcp.mapasocietario.es/mcp`),
> which wraps the current entity-assembled backend. This stdio server points at an
> older data path and cannot be used as a Claude.ai connector. Kept for reference only.

```

- [ ] **Step 4: Final verification**

Run: `cd standalone_rag/local-rag/workers/borme-mcp && npm test`
Expected: PASS — full suite green.

- [ ] **Step 5: Commit**

```bash
git add standalone_rag/local-rag/workers/borme-mcp/README.md standalone_rag/local-rag/workers/borme-mcp/wrangler.jsonc
git commit -m "feat(borme-mcp): custom-domain route, README + smoke checklist"
# Commit the old-server deprecation separately (different repo/dir):
git -C /Users/alessandronurnberg/spanish-companies-mcp-server add README.md
git -C /Users/alessandronurnberg/spanish-companies-mcp-server commit -m "docs: deprecate stdio server in favor of borme-mcp connector" || true
```

> **Deploy is gated (user runs it):** after the plan completes, the user runs `npm run deploy`, creates the KV namespace, and points `mcp.mapasocietario.es` DNS — same as other workers. The smoke checklist (Step 2 of this task's README) is run post-deploy.

---

## Notes for the implementer

- **No live network in tests.** Every tool/handler takes a `fetchImpl` argument; tests pass mocks. Never hit `api.ncdata.eu` from the automated suite.
- **Deferred `get_company` fields.** The spec listed `nif`, `address`, `capital`, and `capital_events`; these are intentionally left out of v1 because their exact field names on `v3/company` were not confirmed (and `capital_events` requires mapping `v3/events` `event_types[].category` strings, also unconfirmed). To add them, first `curl "https://api.ncdata.eu/bormes/v3/company/CAIXABANK"` and `curl "https://api.ncdata.eu/bormes/v3/events?company=CAIXABANK&size=5"`, map the real keys defensively (`c.enriched_nif || c.nif || null`), and add a `getEvents(name, size)` method to the client for `capital_events`. This is a small Phase-1.1 follow-up, not a blocker for the connector.
- **Slug parity.** `nameToSlug` is ported verbatim from `mapasocietario/functions/empresa/_lib.js`. If that file's slug rules change, re-sync. The smoke test (open an `empresa_url`) catches drift.
