# Mapa Societario — Entity Schema Reconciliation (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `mapasocietario.es` declare itself as a *brand* of the single Nurnberg Consulting SL org (not its own Organization), via `WebSite.publisher` → `#org` and a `Brand` node — on both the homepage and the programmatic `/empresa/:slug` pages, without ever attaching Nurnberg ownership to the *described company*.

**Architecture:** React/Vite SPA with static `index.html`, plus Cloudflare Pages Functions that server-render `/empresa/:slug` HTML (`functions/empresa/_lib.js`). JSON-LD lives in `index.html` (homepage) and is assembled in `_lib.js` (company pages).

**Tech Stack:** React, Vite, Cloudflare Pages Functions, MUI.

**Spec:** see `website-nurnberg/docs/superpowers/specs/2026-06-29-three-property-seo-funnel-design.md`

## Global Constraints

- Canonical org `@id` is exactly `https://nurnbergconsulting.com/#org`. Mapa Societario is a **`Brand`** (`@id=https://mapasocietario.es/#brand`), never an `Organization` with a `parentOrganization`.
- **Guard:** on `/empresa/:slug`, the described company (`Corporation`/`Organization` node) must NOT receive `publisher`/`parentOrganization`/`provider` pointing at Nurnberg. The Nurnberg-family link is carried only by a separate site-level `WebSite` node.
- Funnel edges C and D already exist in `DueDiligencePage.jsx` (the work-level ladder) and the footer already links both siblings — this plan does **not** add funnel links, only schema. Verify-only in Task 3.
- JSON-LD validation for the homepage (the per-task "test"):

  ```bash
  python3 - index.html <<'PY'
  import sys,re,json
  html=open(sys.argv[1],encoding='utf-8').read()
  b=re.findall(r'<script type="application/ld\+json">(.*?)</script>',html,re.S)
  assert b, "NO ld+json"
  for i,x in enumerate(b):
      o=json.loads(x); print(f"block {i}: OK keys={list(o.keys())}")
  PY
  ```

---

### Task 1: Rework the homepage `@graph` (brand model)

**Files:**
- Modify: `index.html` (the `<script type="application/ld+json">` `@graph` block, ~lines 63–100)

**Interfaces:**
- Produces: `https://mapasocietario.es/#website` (publisher → `#org`, about → `#brand`) and `https://mapasocietario.es/#brand`. Consumed by the nurnberg plan's `#org.brand[]` reference.

- [ ] **Step 1: Replace** the entire existing `@graph` JSON-LD `<script>` with:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://mapasocietario.es/#website",
      "name": "Mapa Societario",
      "url": "https://mapasocietario.es/",
      "inLanguage": "en",
      "description": "Search and visualize corporate relationships between Spanish companies and directors using official BORME registry data covering 3.1 million companies since 2009.",
      "publisher": { "@id": "https://nurnbergconsulting.com/#org" },
      "about": { "@id": "https://mapasocietario.es/#brand" },
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://mapasocietario.es/app?search={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "Brand",
      "@id": "https://mapasocietario.es/#brand",
      "name": "Mapa Societario",
      "description": "Corporate intelligence and due diligence reports for Spanish companies, built on 9.4 million official BORME registry filings.",
      "sameAs": [
        "https://www.linkedin.com/showcase/mapa-societario/",
        "https://www.facebook.com/profile.php?id=61591449988403"
      ]
    },
    {
      "@type": "ProfessionalService",
      "@id": "https://nurnbergconsulting.com/#org",
      "name": "Nurnberg Consulting",
      "legalName": "Nurnberg Consulting SL",
      "url": "https://nurnbergconsulting.com"
    }
  ]
}
</script>
```

(The previous `parentOrganization`/`contactPoint` on a Mapa-as-Organization node is removed; the Facebook profile moves to the Brand's `sameAs`. The `#org` node here is a deliberately minimal reference — its full description lives on `nurnbergconsulting.com`.)

- [ ] **Step 2: Validate.** Run the Global-Constraints validation command. Expected: `block 0: OK keys=['@context', '@graph']`.
- [ ] **Step 3: Confirm model.** Run `grep -c 'parentOrganization' index.html` → expect `0`. Run `grep -c '#brand' index.html` → expect `2` (the node + the `about` ref).
- [ ] **Step 4: Commit.**

```bash
git -c commit.gpgsign=false add index.html
git -c commit.gpgsign=false commit -m "feat(seo): model Mapa Societario as a Brand of Nurnberg #org (homepage)"
```

---

### Task 2: Add a site-level publisher node to `/empresa/:slug` (with the company-subject guard)

**Files:**
- Modify: `functions/empresa/_lib.js` (the JSON-LD assembly: the `const org = {…}` company node and the `return [org, breadcrumb]…` at the end of the schema builder, ~lines 487–522)

**Interfaces:**
- Consumes: existing `SITE` constant and `org`/`breadcrumb` objects.
- Produces: a third `WebSite` JSON-LD node per company page carrying the Nurnberg link, leaving the company `org` node untouched.

- [ ] **Step 1: Add the site node.** Immediately before the `const serialize = …` line, insert:

```javascript
  // Site-level publisher node — binds the PAGE (not the described company) to the
  // Nurnberg brand/org. The company `org` node above stays free of any Nurnberg link.
  const site = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://mapasocietario.es/#website',
    url: `${SITE}/`,
    name: 'Mapa Societario',
    publisher: { '@id': 'https://nurnbergconsulting.com/#org' },
    about: { '@id': 'https://mapasocietario.es/#brand' },
  };
```

- [ ] **Step 2: Include it in the output.** Change:

```javascript
  return [org, breadcrumb]
```

to:

```javascript
  return [org, breadcrumb, site]
```

- [ ] **Step 3: Verify the guard.** Run:

```bash
node -e "const m=require('./functions/empresa/_lib.js'); console.log(Object.keys(m))" 2>/dev/null || echo "(module not directly requireable — fine)"
grep -n "publisher\|parentOrganization" functions/empresa/_lib.js
```

Confirm `publisher` appears ONLY inside the `site` const, and the `org` company node has no `publisher`/`parentOrganization`.

- [ ] **Step 4: Smoke-test a rendered page.** Start the local dev server (`npx wrangler pages dev` or the project's documented command) and fetch a company page:

```bash
curl -s 'http://localhost:8788/empresa/<known-slug>' | grep -o '"@type":"WebSite"' | head
```

Expected: one `"@type":"WebSite"` match. Also confirm the page still shows the `Corporation` block.

- [ ] **Step 5: Commit.**

```bash
git -c commit.gpgsign=false add functions/empresa/_lib.js
git -c commit.gpgsign=false commit -m "feat(seo): site-level publisher node on /empresa (company node untouched)"
```

---

### Task 3: Verify funnel edges C/D and footer family links (no code expected)

**Files:**
- Inspect only: `src/components/DueDiligencePage.jsx`, `src/components/LandingPage.jsx`

- [ ] **Step 1:** Run `grep -n 'nurnbergconsulting.com\|ncdata.eu' src/components/DueDiligencePage.jsx src/components/LandingPage.jsx`. Confirm: the DD "ladder" links Nurnberg (human-led) and NC Data; the footer links `nurnbergconsulting.com` and `ncdata.eu`.
- [ ] **Step 2:** If — and only if — the footer is missing a sibling link to **Mapa Societario's own** stable surfaces, leave as-is (mapa *is* the current site; a self-link adds nothing). No commit expected. If everything is present, this task is complete with no changes.

---

## Self-review notes
- Spec coverage: brand model homepage (Task 1), `/empresa` publisher guard (Task 2), funnel edges C/D (pre-existing, verified Task 3).
- Guard enforced explicitly in Task 2 Step 3.
- `#org` reference string byte-identical to plan 1 / plan 3.
- Decision flagged: the homepage `contactPoint` (`mapasocietario@ncdata.eu`) is dropped from schema; re-add it under the `Brand` node if a structured contact is wanted.
