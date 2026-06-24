# AI Investigation Phase 2 — Investigation Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `ai-investigation` worker's `/investigate` stub with a real engine: assemble trusted registry signals for the selected entities, run one OpenRouter web-search call that answers the question with separated provenance, and return structured JSON the panel renders as registry/web cards + cited sources.

**Architecture:** Inside the existing `/investigate` (after JWT + rate-limit), three units — a **context assembler** (pure signal derivation + a thin `/bormes` fetch adapter), a **synthesizer** (pure prompt builder + injected OpenRouter call + pure response shaper), and **cost metering** (records real OpenRouter cost so the per-code spend cap bites). Frontend renders the new structured answer.

**Tech Stack:** Cloudflare Workers (ESM), `@cloudflare/vitest-pool-workers`; OpenRouter (`anthropic/claude-haiku-4.5` + `openrouter:web_search` exa tool); React/MUI frontend; `node:test` not used here (worker tests are vitest).

## Global Constraints

- Two repos: Tasks 1–4 in `standalone_rag/local-rag` (branch created at execution). Task 5 in `mapasocietario`.
- **No change** to the JWT/redeem/rate-limit path or the request contract `{question, focus, entities, edges}` (`type` ∈ `'company'|'officer'`, ≤10 entities).
- Worker tests use `@cloudflare/vitest-pool-workers` (`cloudflare:test`); pure helpers tested directly; all network (`/bormes`, OpenRouter) is via an **injected `fetchImpl`** (default `fetch`) and mocked in tests — mirror `verifyTurnstile`/`verifyDdPayment`. **Hermetic**: no live OpenRouter/`/bormes` in tests (stub fetch + throw on un-mocked URLs, like `test/endpoints.spec.js`).
- OpenRouter call shape is **verbatim** from `ncdata_infra/bormes/borme_dd_report.py:_llm_json_round` (endpoint `https://openrouter.ai/api/v1/chat/completions`; `tools:[{type:"openrouter:web_search",parameters:{engine:"exa",max_results:8,max_total_results:8,search_context_size:"medium"}}]`; `temperature:0`) **plus** `usage:{include:true}` and citation extraction from `choices[0].message.annotations`.
- Model: `anthropic/claude-haiku-4.5`. Key: worker secret `OPENROUTER_API_KEY` (server-side only). `/bormes` base: `env.BORMES_API_BASE` (default `https://api.ncdata.eu`).
- Cost: `estCostMicros = round((usage.cost || tokenEstimate) * 1_000_000)`; recorded via the existing `recordUsage`. The existing `checkRateLimit` `spend_cap` (200000 micros) + 5/min + 40/day are unchanged.
- Output JSON shape (exact): `{ answer: { summary, registry, web }, citations: [{n,title,url}], usage: { cost_micros, model } }`.
- No fabrication: prompt forbids registry claims absent from the FACTS block; every web claim cited; empty web → explicit "no relevant findings", never invented.

---

### Task 1: Registry signal derivation (pure) + fixtures

**Files:**
- Create: `workers/ai-investigation/src/registry-signals.js`
- Test: `workers/ai-investigation/test/registry-signals.spec.js`

(Paths relative to `/Users/alessandronurnberg/standalone_rag/local-rag/`.)

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `classifyRole(role: string): 'director'|'apoderado'|'auditor'|'other'`
  - `deriveCompanySignals(ctx): object` where `ctx = { name, status, firstSeen, lastSeen, officersActive:[{name,role}], officersResigned:[{name,role}], soleShareholders:[string], soleShareholderIndividuals:[string], events:[{date:'YYYY-MM-DD', types:[string]}], nowYear:number }` → `{ name, status, ageYears, span:{first,last}, composition:{directors,apoderados,auditors,total,unipersonal,soleShareholders}, cadence:{appointments,cessations,pattern:'linear'|'spiky'|'sparse',spikeYears:[]}, stability:{addressChanges,capitalChanges,dissolution,concurso} }`
  - `deriveOfficerProfile({ officers:[{company_name,status,role}] }, name): { name, activeSeats, ceasedSeats, companies, roles:[string] }`
  - `formatRegistryFacts(companySignals:[], officerProfiles:[], edges:[]): string` — the compact REGISTRY FACTS text block.

- [ ] **Step 1: Write the failing tests**

Create `workers/ai-investigation/test/registry-signals.spec.js`:

```javascript
import { describe, it, expect } from "vitest";
import { classifyRole, deriveCompanySignals, deriveOfficerProfile, formatRegistryFacts } from "../src/registry-signals.js";

describe("classifyRole", () => {
  it("buckets Spanish registry roles", () => {
    expect(classifyRole("Administrador Único")).toBe("director");
    expect(classifyRole("CONSEJERO DELEGADO")).toBe("director");
    expect(classifyRole("Apoderado")).toBe("apoderado");
    expect(classifyRole("Auditor de Cuentas")).toBe("auditor");
    expect(classifyRole("Socio")).toBe("other");
  });
});

describe("deriveCompanySignals", () => {
  const ctx = {
    name: "ACME SL", status: "active", firstSeen: "2006-03-01", lastSeen: "2024-05-01",
    officersActive: [
      { name: "A", role: "Administrador Único" }, { name: "B", role: "Consejero" },
      ...Array.from({ length: 32 }, (_, i) => ({ name: `P${i}`, role: "Apoderado" })),
    ],
    officersResigned: [{ name: "C", role: "Apoderado" }],
    soleShareholders: ["PARENT SA"], soleShareholderIndividuals: [],
    events: [
      { date: "2019-04-01", types: ["Nombramientos"] }, { date: "2019-06-01", types: ["Nombramientos"] },
      { date: "2019-09-01", types: ["Ceses/Dimisiones"] }, { date: "2020-01-01", types: ["Ceses/Dimisiones"] },
      { date: "2020-02-01", types: ["Nombramientos"] }, { date: "2012-01-01", types: ["Cambio de domicilio social"] },
      { date: "2015-01-01", types: ["Ampliación de capital"] }, { date: "2010-01-01", types: ["Nombramientos"] },
    ],
    nowYear: 2024,
  };
  const s = deriveCompanySignals(ctx);
  it("counts composition (large via apoderados)", () => {
    expect(s.composition).toMatchObject({ directors: 2, apoderados: 32, auditors: 0 });
    expect(s.composition.soleShareholders).toEqual(["PARENT SA"]);
  });
  it("computes span/age", () => {
    expect(s.span).toEqual({ first: "2006-03-01", last: "2024-05-01" });
    expect(s.ageYears).toBe(18);
  });
  it("flags a churn spike year", () => {
    expect(s.cadence.appointments).toBe(4);
    expect(s.cadence.cessations).toBe(2);
    expect(s.cadence.spikeYears).toContain(2019);
    expect(s.cadence.pattern).toBe("spiky");
  });
  it("counts stability events", () => {
    expect(s.stability.addressChanges).toBe(1);
    expect(s.stability.capitalChanges).toBe(1);
    expect(s.stability.dissolution).toBe(false);
    expect(s.stability.concurso).toBe(false);
  });
});

describe("deriveOfficerProfile", () => {
  it("summarizes active vs ceased seats", () => {
    const p = deriveOfficerProfile({ officers: [
      { company_name: "X SL", status: "active", role: "Administrador" },
      { company_name: "Y SL", status: "active", role: "Administrador" },
      { company_name: "Z SL", status: "resigned", role: "Apoderado" },
    ] }, "JOHN DOE");
    expect(p).toMatchObject({ name: "JOHN DOE", activeSeats: 2, ceasedSeats: 1, companies: 3 });
    expect(p.roles).toEqual(expect.arrayContaining(["Administrador", "Apoderado"]));
  });
});

describe("formatRegistryFacts", () => {
  it("renders a compact block mentioning key signals", () => {
    const block = formatRegistryFacts(
      [deriveCompanySignals({ name: "ACME SL", status: "active", firstSeen: "2006-03-01", lastSeen: "2024-05-01",
        officersActive: [{ name: "A", role: "Administrador Único" }], officersResigned: [], soleShareholders: [],
        soleShareholderIndividuals: [], events: [], nowYear: 2024 })],
      [{ name: "JOHN DOE", activeSeats: 2, ceasedSeats: 1, companies: 3, roles: ["Administrador"] }],
      [{ source: "company-acme", target: "officer-john", type: "director" }],
    );
    expect(block).toContain("ACME SL");
    expect(block).toContain("JOHN DOE");
    expect(typeof block).toBe("string");
    expect(block.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run → RED**

Run: `cd /Users/alessandronurnberg/standalone_rag/local-rag/workers/ai-investigation && npm test -- registry-signals`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `registry-signals.js`**

Create `workers/ai-investigation/src/registry-signals.js`:

```javascript
// Pure registry-signal derivation for the investigation context. No I/O.

const DIRECTOR_RE = /administrador|consejero|admin|presidente|liquidador|gerente/i;
const APODERADO_RE = /apoderad/i;
const AUDITOR_RE = /auditor/i;

export function classifyRole(role) {
  const r = String(role || "");
  if (APODERADO_RE.test(r)) return "apoderado";
  if (AUDITOR_RE.test(r)) return "auditor";
  if (DIRECTOR_RE.test(r)) return "director";
  return "other";
}

const yearOf = (d) => (typeof d === "string" && d.length >= 4 ? Number(d.slice(0, 4)) : null);
const APPT_RE = /nombramiento/i;
const CESS_RE = /cese|dimisi|cancelaci/i;
const ADDR_RE = /domicilio/i;
const CAP_RE = /capital/i;
const DISS_RE = /disoluci|extinci|liquidaci/i;
const CONC_RE = /concurso/i;

export function deriveCompanySignals(ctx) {
  const active = ctx.officersActive || [];
  const composition = { directors: 0, apoderados: 0, auditors: 0, total: active.length, unipersonal: false, soleShareholders: ctx.soleShareholders || [] };
  for (const o of active) {
    const k = classifyRole(o.role);
    if (k === "director") composition.directors++;
    else if (k === "apoderado") composition.apoderados++;
    else if (k === "auditor") composition.auditors++;
  }
  composition.unipersonal = (ctx.soleShareholders || []).length > 0 || (ctx.soleShareholderIndividuals || []).length > 0;

  const first = ctx.firstSeen || null, last = ctx.lastSeen || null;
  const fy = yearOf(first), ly = yearOf(last) || ctx.nowYear;
  const ageYears = fy ? Math.max(0, (ly || ctx.nowYear) - fy) : 0;

  const byYear = {};
  let appointments = 0, cessations = 0, addressChanges = 0, capitalChanges = 0, dissolution = false, concurso = false;
  for (const e of ctx.events || []) {
    const y = yearOf(e.date);
    const types = (e.types || []).join(" ");
    const isAppt = APPT_RE.test(types), isCess = CESS_RE.test(types);
    if (isAppt) { appointments++; if (y) (byYear[y] = byYear[y] || { app: 0, ces: 0 }).app++; }
    if (isCess) { cessations++; if (y) (byYear[y] = byYear[y] || { app: 0, ces: 0 }).ces++; }
    if (ADDR_RE.test(types)) addressChanges++;
    if (CAP_RE.test(types)) capitalChanges++;
    if (DISS_RE.test(types)) dissolution = true;
    if (CONC_RE.test(types)) concurso = true;
  }
  // Spike detection: a year whose appointment+cessation count is >=3 AND >= 2x the
  // mean of active years. "spiky" if any spike year; "linear" if changes spread over
  // >=3 years with no spike; "sparse" otherwise.
  const yearTotals = Object.entries(byYear).map(([y, c]) => [Number(y), c.app + c.ces]);
  const activeYears = yearTotals.length;
  const mean = activeYears ? yearTotals.reduce((a, [, t]) => a + t, 0) / activeYears : 0;
  const spikeYears = yearTotals.filter(([, t]) => t >= 3 && t >= 2 * mean).map(([y]) => y).sort();
  const pattern = spikeYears.length ? "spiky" : activeYears >= 3 ? "linear" : "sparse";

  const status = ctx.status || "active";
  return {
    name: ctx.name, status, ageYears, span: { first, last },
    composition,
    cadence: { appointments, cessations, pattern, spikeYears },
    stability: { addressChanges, capitalChanges, dissolution: dissolution || /dissolv|disuelt/i.test(status), concurso: concurso || /concurso/i.test(status) },
  };
}

export function deriveOfficerProfile(data, name) {
  const officers = (data && data.officers) || [];
  let activeSeats = 0, ceasedSeats = 0;
  const companies = new Set(), roles = new Set();
  for (const o of officers) {
    const st = String(o.status || "").toLowerCase();
    if (st === "active") activeSeats++; else ceasedSeats++;
    if (o.company_name) companies.add(o.company_name);
    if (o.role) roles.add(o.role);
  }
  return { name, activeSeats, ceasedSeats, companies: companies.size, roles: [...roles] };
}

export function formatRegistryFacts(companySignals, officerProfiles, edges) {
  const lines = ["REGISTRY FACTS (BORME — the ONLY source for registry claims):"];
  for (const c of companySignals || []) {
    const comp = c.composition;
    lines.push(
      `• ${c.name} — estado: ${c.status}; ${c.span.first || "?"}→${c.span.last || "?"} (${c.ageYears} años). ` +
      `Órgano: ${comp.directors} administrador(es), ${comp.apoderados} apoderado(s), ${comp.auditors} auditor(es)` +
      `${comp.unipersonal ? `; unipersonal (socio único: ${(comp.soleShareholders || []).join(", ") || "individual"})` : ""}. ` +
      `Cadencia: ${c.cadence.appointments} nombramientos / ${c.cadence.cessations} ceses, patrón ${c.cadence.pattern}` +
      `${c.cadence.spikeYears.length ? ` (picos: ${c.cadence.spikeYears.join(", ")})` : ""}. ` +
      `Estabilidad: ${c.stability.addressChanges} cambio(s) de domicilio, ${c.stability.capitalChanges} cambio(s) de capital` +
      `${c.stability.concurso ? ", EN CONCURSO" : ""}${c.stability.dissolution ? ", DISUELTA/EXTINGUIDA" : ""}.`
    );
  }
  for (const p of officerProfiles || []) {
    lines.push(`• ${p.name} (persona) — ${p.activeSeats} cargo(s) activo(s) / ${p.ceasedSeats} cesado(s) en ${p.companies} empresa(s); roles: ${(p.roles || []).join(", ") || "n/d"}.`);
  }
  if ((edges || []).length) {
    lines.push("Relaciones seleccionadas: " + edges.map((e) => `${e.source}—[${e.type || "rel"}]→${e.target}`).join("; ") + ".");
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run → GREEN**

Run: `npm test -- registry-signals`  → PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/alessandronurnberg/standalone_rag/local-rag
git add workers/ai-investigation/src/registry-signals.js workers/ai-investigation/test/registry-signals.spec.js
git commit -m "feat(ai-investigation): pure registry-signal derivation (composition, cadence, stability)"
```

---

### Task 2: Registry context assembler (the `/bormes` adapter)

**Files:**
- Create: `workers/ai-investigation/src/registry-context.js`
- Test: `workers/ai-investigation/test/registry-context.spec.js`

**Interfaces:**
- Consumes (Task 1): `deriveCompanySignals`, `deriveOfficerProfile`, `formatRegistryFacts`.
- Produces: `async function assembleRegistryContext({ focus, entities, edges }, env, fetchImpl = fetch): Promise<string>` — fetches `/bormes` data for each selected entity (in parallel), normalizes the responses, derives signals, and returns the REGISTRY FACTS text block. Failed lookups degrade that entity to name-only.

> **IMPLEMENTER:** the normalization mapping below is the one place that touches real `/bormes` response shapes. Verify the field names against a live response (`curl "https://api.ncdata.eu/bormes/v3/company/BANCO%20SANTANDER%20SA"`, `.../v3/events?company=...&size=50`, `.../v3/expand-officer?name=...`) and adjust the `_normalizeCompany`/`_normalizeEvents`/officer mapping if a field differs. Keep all access defensive (`?.` + `|| []`).

- [ ] **Step 1: Write the failing test (mocked fetch returning fixture API payloads)**

Create `workers/ai-investigation/test/registry-context.spec.js`:

```javascript
import { describe, it, expect } from "vitest";
import { assembleRegistryContext } from "../src/registry-context.js";

function mockFetch(routes) {
  return async (url) => {
    const u = String(url);
    for (const [needle, body] of routes) if (u.includes(needle)) return new Response(JSON.stringify(body), { status: 200 });
    throw new Error(`[hermetic] unexpected fetch: ${u}`);
  };
}

const env = { BORMES_API_BASE: "https://api.test" };

describe("assembleRegistryContext", () => {
  it("builds a facts block from company + officer lookups", async () => {
    const fetchImpl = mockFetch([
      ["/v3/company/", { company_name: "ACME SL", status: "active", first_seen: "2006-01-01", last_seen: "2024-01-01",
        officers_active: [{ name: "A", role: "Administrador Único" }, { name: "P1", role: "Apoderado" }],
        officers_resigned: [], sole_shareholders: ["PARENT SA"], sole_shareholder_individuals: [] }],
      ["/v3/events", { events: [{ event_date: "2019-01-01", event_types: ["Nombramientos"] }] }],
      ["/v3/expand-officer", { officers: [{ company_name: "X SL", status: "active", role: "Administrador" }] }],
    ]);
    const ctx = await assembleRegistryContext({
      focus: { id: "company-acme", name: "ACME SL", type: "company" },
      entities: [
        { id: "company-acme", name: "ACME SL", type: "company" },
        { id: "officer-a", name: "A", type: "officer" },
      ],
      edges: [{ source: "company-acme", target: "officer-a", type: "director" }],
    }, env, fetchImpl);
    expect(ctx).toContain("ACME SL");
    expect(ctx).toContain("apoderado");
    expect(ctx).toContain("A (persona)");
  });

  it("degrades a failed company lookup to name-only without throwing", async () => {
    const fetchImpl = async (url) => {
      if (String(url).includes("/v3/company/")) return new Response("err", { status: 500 });
      return new Response(JSON.stringify({ events: [] }), { status: 200 });
    };
    const ctx = await assembleRegistryContext(
      { focus: { id: "c", name: "BROKEN SL", type: "company" }, entities: [{ id: "c", name: "BROKEN SL", type: "company" }], edges: [] },
      env, fetchImpl);
    expect(ctx).toContain("BROKEN SL");
  });
});
```

- [ ] **Step 2: Run → RED**

Run: `npm test -- registry-context`  → FAIL (module missing).

- [ ] **Step 3: Implement `registry-context.js`**

Create `workers/ai-investigation/src/registry-context.js`:

```javascript
import { deriveCompanySignals, deriveOfficerProfile, formatRegistryFacts } from "./registry-signals.js";

const NOW_YEAR = 2026; // updated at build; only used as a fallback span end.

async function _getJson(url, fetchImpl) {
  try {
    const res = await fetchImpl(url, { method: "GET" });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Map a /bormes/v3/company doc → deriveCompanySignals input. Defensive: field
// names verified against the live endpoint at implementation time.
function _normalizeCompany(name, companyDoc, eventsDoc) {
  const c = companyDoc || {};
  const events = ((eventsDoc && eventsDoc.events) || []).map((e) => ({
    date: e.event_date || e.date || "",
    types: (e.event_types || e.types || []).map((t) => (typeof t === "string" ? t : t?.type || "")),
  }));
  return {
    name: c.company_name || name,
    status: c.is_dissolved ? "dissolved" : c.is_in_concurso ? "concurso" : (c.status || "active"),
    firstSeen: c.first_seen || null, lastSeen: c.last_seen || null,
    officersActive: (c.officers_active || []).map((o) => ({ name: o.name || o.officer_name || "", role: o.role || o.specific_role || o.position || "" })),
    officersResigned: (c.officers_resigned || []).map((o) => ({ name: o.name || o.officer_name || "", role: o.role || o.specific_role || o.position || "" })),
    soleShareholders: c.sole_shareholders || [],
    soleShareholderIndividuals: c.sole_shareholder_individuals || [],
    events, nowYear: NOW_YEAR,
  };
}

export async function assembleRegistryContext({ focus, entities, edges }, env, fetchImpl = fetch) {
  const base = (env && env.BORMES_API_BASE) || "https://api.ncdata.eu";
  const companies = (entities || []).filter((e) => e.type === "company");
  const officers = (entities || []).filter((e) => e.type === "officer");
  // Ensure the focus company is included even if not in entities.
  if (focus && focus.type === "company" && !companies.some((c) => c.id === focus.id)) companies.unshift(focus);

  const companySignals = await Promise.all(companies.map(async (c) => {
    const [doc, ev] = await Promise.all([
      _getJson(`${base}/bormes/v3/company/${encodeURIComponent(c.name)}`, fetchImpl),
      _getJson(`${base}/bormes/v3/events?company=${encodeURIComponent(c.name)}&size=50`, fetchImpl),
    ]);
    if (!doc) return deriveCompanySignals({ name: c.name, status: "active", firstSeen: null, lastSeen: null, officersActive: [], officersResigned: [], soleShareholders: [], soleShareholderIndividuals: [], events: [], nowYear: NOW_YEAR });
    return deriveCompanySignals(_normalizeCompany(c.name, doc, ev));
  }));

  const officerProfiles = await Promise.all(officers.map(async (o) => {
    const data = await _getJson(`${base}/bormes/v3/expand-officer?name=${encodeURIComponent(o.name)}&size=200`, fetchImpl);
    if (!data) return { name: o.name, activeSeats: 0, ceasedSeats: 0, companies: 0, roles: [] };
    return deriveOfficerProfile(data, o.name);
  }));

  return formatRegistryFacts(companySignals, officerProfiles, edges || []);
}
```

- [ ] **Step 4: Run → GREEN, then verify field names against the live API**

Run: `npm test -- registry-context` → PASS. Then run the `curl` checks from the IMPLEMENTER note and adjust `_normalizeCompany`/officer mapping if any field name differs; re-run the test.

- [ ] **Step 5: Commit**

```bash
cd /Users/alessandronurnberg/standalone_rag/local-rag
git add workers/ai-investigation/src/registry-context.js workers/ai-investigation/test/registry-context.spec.js
git commit -m "feat(ai-investigation): registry-context assembler (/bormes lookups → facts block)"
```

---

### Task 3: Synthesizer — prompt builder, OpenRouter call, response shaper

**Files:**
- Create: `workers/ai-investigation/src/synthesis.js`
- Test: `workers/ai-investigation/test/synthesis.spec.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (operates on the facts string + question).
- Produces:
  - `buildInvestigationPrompt(question: string, registryFacts: string): { system, user }` (pure)
  - `async function runSynthesis({ system, user }, env, fetchImpl = fetch): Promise<{ content, annotations, usage }>` — the OpenRouter call.
  - `shapeResponse(content: string, annotations: array, usage: object): { answer:{summary,registry,web}, citations, usage:{cost_micros,model} }` (pure)
  - `parseLlmJson(text: string): object|null` (pure; strips ```json fences)

- [ ] **Step 1: Write the failing tests**

Create `workers/ai-investigation/test/synthesis.spec.js`:

```javascript
import { describe, it, expect } from "vitest";
import { buildInvestigationPrompt, shapeResponse, parseLlmJson, runSynthesis } from "../src/synthesis.js";

describe("buildInvestigationPrompt", () => {
  const { system, user } = buildInvestigationPrompt("¿Riesgos?", "REGISTRY FACTS:\n• ACME SL ...");
  it("includes the facts and the anchoring/provenance instructions", () => {
    expect(user).toContain("REGISTRY FACTS");
    expect(user).toContain("¿Riesgos?");
    expect(system.toLowerCase()).toContain("json");
    expect(system).toMatch(/CIF|NIF/);
    expect(system.toLowerCase()).toMatch(/fraude|concurso|sanci/);
    expect(system.toLowerCase()).toMatch(/cite|cita/);
  });
});

describe("parseLlmJson", () => {
  it("parses plain and fenced JSON", () => {
    expect(parseLlmJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseLlmJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(parseLlmJson("not json")).toBeNull();
  });
});

describe("shapeResponse", () => {
  it("normalizes a good answer + annotations + usage", () => {
    const content = JSON.stringify({ summary: "s", registry: "r", web: "w [1]" });
    const annotations = [{ type: "url_citation", url_citation: { url: "https://x", title: "X" } }];
    const out = shapeResponse(content, annotations, { cost: 0.0012, model: "anthropic/claude-haiku-4.5" });
    expect(out.answer).toEqual({ summary: "s", registry: "r", web: "w [1]" });
    expect(out.citations).toEqual([{ n: 1, title: "X", url: "https://x" }]);
    expect(out.usage.cost_micros).toBe(1200);
  });
  it("degrades gracefully on unparseable content", () => {
    const out = shapeResponse("garbage", [], { cost: 0 });
    expect(out.answer.summary).toBeTruthy();
    expect(Array.isArray(out.citations)).toBe(true);
  });
});

describe("runSynthesis", () => {
  it("posts the openrouter web_search shape and returns content/annotations/usage", async () => {
    let captured;
    const fetchImpl = async (url, init) => {
      captured = { url: String(url), body: JSON.parse(init.body) };
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"summary":"s","registry":"r","web":"w"}', annotations: [] } }],
        usage: { cost: 0.0005 },
      }), { status: 200 });
    };
    const r = await runSynthesis({ system: "sys", user: "usr" }, { OPENROUTER_API_KEY: "k" }, fetchImpl);
    expect(captured.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(captured.body.model).toBe("anthropic/claude-haiku-4.5");
    expect(captured.body.tools[0].type).toBe("openrouter:web_search");
    expect(captured.body.usage).toEqual({ include: true });
    expect(r.content).toContain("summary");
    expect(r.usage.cost).toBe(0.0005);
  });
});
```

- [ ] **Step 2: Run → RED**

Run: `npm test -- synthesis`  → FAIL (module missing).

- [ ] **Step 3: Implement `synthesis.js`**

Create `workers/ai-investigation/src/synthesis.js`:

```javascript
const MODEL = "anthropic/claude-haiku-4.5";

export function buildInvestigationPrompt(question, registryFacts) {
  const system = [
    "Eres un analista de due diligence de empresas españolas (BORME).",
    "Respondes SIEMPRE con un único objeto JSON válido: {\"summary\":\"...\",\"registry\":\"...\",\"web\":\"...\"}. Nada fuera del JSON.",
    "- summary: una línea que responde directamente a la pregunta.",
    "- registry: SOLO hechos presentes en el bloque REGISTRY FACTS. Nunca inventes datos registrales ni añadas otros.",
    "- web: hallazgos de búsqueda web, cada afirmación con un marcador [n] que corresponde a una fuente citada. Si no hay hallazgos relevantes, escribe exactamente 'Sin menciones relevantes.'",
    "Para la búsqueda web: ancla en el nombre legal + CIF/NIF cuando se conozca; desambigua por provincia/sector; busca en español e inglés; cubre prensa adversa (fraude, concurso, blanqueo, sanción, investigación), perfil general y screening de personas (los nombres BORME son apellido-primero).",
    "No mezcles registro y web: cada afirmación registral va en 'registry', cada afirmación web (citada) en 'web'.",
  ].join("\n");
  const user = `${registryFacts}\n\nPREGUNTA DEL USUARIO:\n${question}\n\nResponde con el objeto JSON.`;
  return { system, user };
}

export function parseLlmJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch { /* try to find the first {...} */ }
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { return null; } }
  return null;
}

export async function runSynthesis({ system, user }, env, fetchImpl = fetch) {
  const res = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      tools: [{ type: "openrouter:web_search", parameters: { engine: "exa", max_results: 8, max_total_results: 8, search_context_size: "medium" } }],
      max_tokens: 1200,
      temperature: 0,
      usage: { include: true },
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json();
  const message = (data.choices && data.choices[0] && data.choices[0].message) || {};
  return { content: (message.content || "").trim(), annotations: message.annotations || [], usage: data.usage || {} };
}

export function shapeResponse(content, annotations, usage) {
  const parsed = parseLlmJson(content) || {};
  const answer = {
    summary: parsed.summary || "No se pudo generar un resumen.",
    registry: parsed.registry || "",
    web: parsed.web || "Sin menciones relevantes.",
  };
  const citations = (annotations || [])
    .filter((a) => a && (a.type === "url_citation" || a.url_citation))
    .map((a, i) => ({ n: i + 1, title: a.url_citation?.title || "", url: a.url_citation?.url || "" }))
    .filter((c) => c.url);
  const cost = typeof usage?.cost === "number" ? usage.cost : 0;
  return { answer, citations, usage: { cost_micros: Math.round(cost * 1_000_000), model: MODEL } };
}
```

- [ ] **Step 4: Run → GREEN**

Run: `npm test -- synthesis`  → PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/alessandronurnberg/standalone_rag/local-rag
git add workers/ai-investigation/src/synthesis.js workers/ai-investigation/test/synthesis.spec.js
git commit -m "feat(ai-investigation): synthesis — prompt builder, OpenRouter web-search call, response shaper"
```

---

### Task 4: Wire the engine into `/investigate` + config

**Files:**
- Modify: `workers/ai-investigation/src/index.js`
- Modify: `workers/ai-investigation/wrangler.jsonc`
- Test: `workers/ai-investigation/test/endpoints.spec.js` (extend)

**Interfaces:**
- Consumes (Tasks 2,3): `assembleRegistryContext`, `buildInvestigationPrompt`, `runSynthesis`, `shapeResponse`.
- Produces: `/investigate` returns `{ answer:{summary,registry,web}, citations, usage:{cost_micros,model} }` (no more `stub`); records real `estCostMicros`.

- [ ] **Step 1: Add config to `wrangler.jsonc`**

In `workers/ai-investigation/wrangler.jsonc` `"vars"`, add: `"BORMES_API_BASE": "https://api.ncdata.eu"`. (Secret `OPENROUTER_API_KEY` is set via `wrangler secret put` in the setup step, not in the file.)

- [ ] **Step 2: Write the failing endpoint test (hermetic: mock both /bormes and OpenRouter)**

Add to `workers/ai-investigation/test/endpoints.spec.js` a block that stubs `fetch` so `/bormes/*` returns a fixture company doc/events and `openrouter.ai` returns a fixture JSON answer (and any other URL throws), seeds an entitlement, redeems for a JWT, then calls `/investigate` with a one-company selection and asserts: status 200; `body.answer.summary` present; `body.answer.registry` mentions the company; `body.stub` is undefined; `body.usage.cost_micros` ≥ 0; and a usage row was recorded. Also assert the existing 401-without-JWT and 429-over-limit paths still short-circuit BEFORE any OpenRouter call (the OpenRouter stub must not be hit on those). Use the same `vi.stubGlobal('fetch', ...)` hermetic pattern already in the file; the Turnstile siteverify stub must remain for the `/redeem` calls.

```javascript
// sketch — integrate with the file's existing stub/seed helpers:
// fetch stub routes: 'verify-dd-payment' or 'siteverify' → pass; '/bormes/v3/company' → company fixture;
// '/bormes/v3/events' → {events:[...]}; 'openrouter.ai' → {choices:[{message:{content:'{"summary":"s","registry":"ACME SL ...","web":"Sin menciones relevantes."}',annotations:[]}}],usage:{cost:0.0008}};
// else throw '[hermetic]'.
it("/investigate returns a synthesized answer (no stub) and records cost", async () => {
  const token = await freshToken();
  const res = await call("/investigate", { headers: { Authorization: `Bearer ${token}` },
    body: { question: "¿Riesgos?", focus: { id: "c", name: "ACME SL", type: "company" },
            entities: [{ id: "c", name: "ACME SL", type: "company" }], edges: [] } });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.stub).toBeUndefined();
  expect(data.answer.summary).toBeTruthy();
  expect(data.answer.registry).toContain("ACME SL");
  expect(data.usage.cost_micros).toBe(800);
});
```

- [ ] **Step 3: Run → RED**

Run: `npm test -- endpoints` → the new test FAILS (still returns the stub).

- [ ] **Step 4: Replace the stub in `handleInvestigate`**

In `src/index.js`, add imports: `import { assembleRegistryContext } from "./registry-context.js";` and `import { buildInvestigationPrompt, runSynthesis, shapeResponse } from "./synthesis.js";`.

Replace the Phase-1 stub block (the part that builds and returns `{ stub:true, ... }` after `recordUsage`) with:

```javascript
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad request", reason: "bad_json" }, 400, origin, allowed); }
  const question = (body && body.question) || "";
  const focus = body?.focus || null;
  const entities = Array.isArray(body?.entities) ? body.entities.slice(0, 10) : [];
  const edges = Array.isArray(body?.edges) ? body.edges : [];

  let shaped;
  try {
    const registryFacts = await assembleRegistryContext({ focus, entities, edges }, env);
    const prompt = buildInvestigationPrompt(question, registryFacts);
    const raw = await runSynthesis(prompt, env);
    shaped = shapeResponse(raw.content, raw.annotations, raw.usage);
  } catch (e) {
    return json({ error: "investigation failed", reason: "engine_error" }, 502, origin, allowed);
  }

  await recordUsage(env.ENTITLEMENTS_DB, { code, ts: now, estCostMicros: shaped.usage.cost_micros || 0 });
  return json(shaped, 200, origin, allowed);
```

(Keep everything above it — JWT validation, `getUsageCounts` + `checkRateLimit` — unchanged, so 401/429 still short-circuit before the engine runs. Remove the now-unused stub.)

- [ ] **Step 5: Run → GREEN, then full suite**

Run: `npm test -- endpoints` → PASS. Then `npm test` → all suites pass. Then `node scripts/check-schema-drift.mjs` → OK (no schema change).

- [ ] **Step 6: Commit**

```bash
cd /Users/alessandronurnberg/standalone_rag/local-rag
git add workers/ai-investigation/src/index.js workers/ai-investigation/wrangler.jsonc workers/ai-investigation/test/endpoints.spec.js
git commit -m "feat(ai-investigation): wire the investigation engine into /investigate + real cost metering"
```

---

### Task 5: Frontend — render the structured answer

**Files:**
- Modify: `src/components/AIInvestigationGate.jsx`

(Path relative to `/Users/alessandronurnberg/mapasocietario/`.)

**Interfaces:**
- Consumes: the new `/investigate` response `{ answer:{summary,registry,web}, citations, usage }`.
- Produces: the ask-phase answer area renders summary + two provenance cards + a Sources list.

- [ ] **Step 1: Render the structured answer**

In `src/components/AIInvestigationGate.jsx`, the ask phase currently stores the response in `answer` state and renders it in a single `Alert` (`{answer && <Alert ...>{answer.answer}</Alert>}`). Replace that render with a structured block. Keep it backward-safe (if `answer.answer` is a string — the old stub — render it as before).

Replace the answer `Alert` JSX with:

```jsx
            {answer && (typeof answer.answer === 'object' && answer.answer !== null ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {answer.answer.summary && (
                  <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>{answer.answer.summary}</Typography>
                )}
                {answer.answer.registry && (
                  <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'rgba(25,118,210,0.08)', border: '1px solid rgba(25,118,210,0.3)' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#90caf9' }}>
                      {language === 'en' ? 'From the registry (BORME)' : 'Del registro (BORME)'}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{answer.answer.registry}</Typography>
                  </Box>
                )}
                {answer.answer.web && (
                  <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'rgba(255,167,38,0.08)', border: '1px solid rgba(255,167,38,0.3)' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#ffb74d' }}>
                      {language === 'en' ? 'Web / Press' : 'Web / Prensa'}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{answer.answer.web}</Typography>
                  </Box>
                )}
                {Array.isArray(answer.citations) && answer.citations.length > 0 && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      {language === 'en' ? 'Sources' : 'Fuentes'}
                    </Typography>
                    <Box component="ol" sx={{ pl: 2, m: 0.5 }}>
                      {answer.citations.map((c) => (
                        <li key={c.n}>
                          <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: '#90caf9' }}>
                            {c.title || c.url}
                          </a>
                        </li>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            ) : (
              <Alert severity="info">{answer.answer}</Alert>
            ))}
```

Ensure `Box` and `Typography` are imported (they are — used elsewhere in the gate).

- [ ] **Step 2: Verify the build**

Run: `cd /Users/alessandronurnberg/mapasocietario && npx vite build`
Expected: completes with no errors. (Do NOT run `npm run build`.)

- [ ] **Step 3: Commit**

```bash
cd /Users/alessandronurnberg/mapasocietario
git add src/components/AIInvestigationGate.jsx
git commit -m "feat: render structured AI Investigation answer (summary + registry/web cards + sources)"
```

---

## Setup (gated — user runs after Task 4)

1. Create a **dedicated** OpenRouter API key; set its spend ceiling in the OpenRouter dashboard (Layer 2).
2. `cd standalone_rag/local-rag/workers/ai-investigation && npx wrangler secret put OPENROUTER_API_KEY` (paste the key).
3. `npx wrangler deploy` (worker, picks up `BORMES_API_BASE` + the new code).
4. Deploy the frontend (push `mapasocietario` main → Pages) for the new rendering.

## Self-Review

**Spec coverage:** web layer = OpenRouter native search (Task 3, verbatim shape + `usage:{include:true}`) ✓; registry signals per company + officer screening profile (Tasks 1–2) ✓; situational-awareness signals (composition/cadence/stability/span) ✓; structured `{answer:{summary,registry,web},citations,usage}` output (Task 3 shaper) + two-card+sources render (Task 5) ✓; dedicated key + real cost metering closing the Phase-1 gap (Task 4) ✓; JWT/rate path unchanged (Task 4 keeps it above the engine) ✓; no-fabrication via prompt (Task 3) ✓; hermetic injected-fetch tests (Tasks 2–4) ✓; degradation to name-only (Task 2) ✓.

**Placeholder scan:** No TBD/TODO. The one real unknown — exact `/bormes` field names — is isolated to `registry-context.js`'s `_normalizeCompany` with a concrete `curl`-verify instruction and defensive access; the pure derivation (Task 1) is fully pinned by fixtures. Component render (Task 5) verified via `npx vite build` per repo convention.

**Type consistency:** `assembleRegistryContext(...)→string` consumed by `buildInvestigationPrompt(question, facts)` (Task 4); `runSynthesis→{content,annotations,usage}` consumed by `shapeResponse` (same names); `shapeResponse→{answer:{summary,registry,web},citations,usage:{cost_micros}}` matches the Task-4 return, the Task-5 render, and the spec's output shape. `deriveCompanySignals`/`deriveOfficerProfile`/`formatRegistryFacts` signatures consistent Tasks 1↔2.
