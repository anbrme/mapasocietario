# Conversion Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the actual product (graph screenshot) on the landing page, fix funnel/visual issues at decision points, and open the Android app directly on the search screen.

**Architecture:** All changes are in the React SPA (`src/`). No backend/worker changes. The `/app?search=` param feeds the existing `initialCompanyName` prop of `SpanishCompanyNetworkGraph`. The Android start-screen change is a launch-time `history.replaceState` in `main.jsx` (no router restructuring, landing stays reachable via the in-app breadcrumb).

**Tech Stack:** React 18, MUI 5, react-router 7, Vite 5, Capacitor 8. Tests: `node --test` (pure modules only — there is no component test infra, so JSX tasks are verified with `npx vite build` + manual checks).

**Spec:** `docs/superpowers/specs/2026-06-09-conversion-visuals-design.md`

**Conventions:**
- Verify each task with `npx vite build` (fast, no network). The full `npm run build` (prebuild checks + prerender) runs once in the final task.
- Commit after each task. Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Wire `/app?search=` to the graph

Fixes the dead CTA on every `/empresa/:slug` page (they link to `/app?search=<name>`, which nothing consumes — see `functions/empresa/_lib.js:842`) and powers the landing demo's click-to-try link.

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Read the param and pass it to the graph**

In `src/App.jsx`, the component currently ends with:

```jsx
      <SpanishCompanyNetworkGraph
        visible={true}
        embedded={true}
      />
```

Add the param read at the top of the `App` function body (after `const navigate = useNavigate();`):

```jsx
  // /empresa pages and the landing demo link here as /app?search=<company>.
  // Read once on mount; the graph auto-searches via initialCompanyName.
  const initialSearch = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('search') || '').trim() || undefined;
  }, []);
```

and pass it to the graph:

```jsx
      <SpanishCompanyNetworkGraph
        visible={true}
        embedded={true}
        initialCompanyName={initialSearch}
      />
```

No graph-component change is needed: `initialCompanyName` already triggers `handleSearch` in standalone/embedded mode (see the `Auto-search when initialCompanyName` effect in `SpanishCompanyNetworkGraph.jsx`, which guards on `(visible || embedded)`).

- [ ] **Step 2: Build**

Run: `npx vite build`
Expected: `✓ built in …` with no errors.

- [ ] **Step 3: Manual check**

Run: `npx vite preview` and open `http://localhost:4173/app?search=ACERINOX%20SA`.
Expected: the graph auto-loads Acerinox without typing. Also open `http://localhost:4173/app` (no param) — behaves exactly as before (empty search). Stop the preview server.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: /app?search= preloads the company graph (fixes dead /empresa CTA)"
```

---

### Task 2: Android app opens on the search screen

Native launches should land on `/app`, not the marketing landing page. Use a launch-time URL rewrite (NOT a route redirect) so the landing page stays reachable via the graph's "Mapa Societario" breadcrumb — it serves as the "more options" screen (dashboard, DD, about) in the app.

**Files:**
- Modify: `src/main.jsx`

- [ ] **Step 1: Rewrite the launch URL when native**

In `src/main.jsx`, add the import:

```jsx
import { isNativeApp } from './services/listedCompaniesNav';
```

Then, immediately after the existing DD-payment-return block (after the `if (ddSessionId && …)` block, before `const darkTheme = …`), add:

```jsx
// Native app launches land on the search screen, not the marketing landing
// page. Rewrite (not redirect) only at launch so in-app navigation to "/"
// (graph breadcrumb) still reaches the landing page with the other options.
if (isNativeApp() && window.location.pathname === '/') {
  window.history.replaceState(null, '', '/app');
}
```

Note: this runs at module scope before `BrowserRouter` mounts, so the router simply boots on `/app`. The DD-payment redirect blocks above use `window.location.replace`, which queues a navigation that wins over this same-document `replaceState` — payment returns still land on the order page.

- [ ] **Step 2: Build**

Run: `npx vite build`
Expected: success.

- [ ] **Step 3: Manual check (web unaffected)**

Run: `npx vite preview`, open `http://localhost:4173/`.
Expected: landing page renders as usual (the rewrite is native-only). Stop the server. Full native verification happens at the next `npx cap sync android` + emulator run — note this in the commit body, do not block on it.

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx
git commit -m "feat(android): open native app on the search screen

Web behavior unchanged. Verify on device after next cap sync."
```

---

### Task 3: Landing page product visual (screenshot + click-to-try)

**Files:**
- Modify: `src/components/LandingPage.jsx`
- Asset (user-provided, may land later): `public/graph-demo.png`

- [ ] **Step 1: Add the demo constant and image state**

In `src/components/LandingPage.jsx`, add near the other top-level constants (e.g. right after `PROOF_ITEMS`):

```jsx
// Company shown in the landing demo screenshot. MUST match the company
// captured in public/graph-demo.png so the click-through lands on the
// same graph the visitor just saw.
const DEMO_COMPANY = 'ACERINOX SA';
```

(If the user's screenshot shows a different company, change this constant — nothing else.)

Inside the `LandingPage` function, after `const navigate = useNavigate();`, add:

```jsx
  // Hide the demo frame entirely if the screenshot asset is missing —
  // never render a broken image (spec requirement).
  const [demoImgOk, setDemoImgOk] = React.useState(true);
```

- [ ] **Step 2: Insert the framed screenshot in the "How it works" section**

In the `HOW IT WORKS` section, directly after this existing element:

```jsx
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, maxWidth: 560 }}>
              The graph is fully interactive. Here's what you can do:
            </Typography>
```

insert (before the `HOW_TO_STEPS` grid):

```jsx
            {demoImgOk && (
              <Box sx={{ mb: 4 }}>
                <Box
                  sx={{
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.1)',
                    overflow: 'hidden',
                    bgcolor: '#0d1220',
                  }}
                >
                  {/* Browser-chrome top bar */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
                      <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c, opacity: 0.8 }} />
                    ))}
                    <Typography variant="caption" sx={{ ml: 1, color: 'text.disabled', fontSize: '0.68rem' }}>
                      mapasocietario.es/app
                    </Typography>
                  </Box>
                  <Box component="a" href={`/app?search=${encodeURIComponent(DEMO_COMPANY)}`} sx={{ display: 'block' }}>
                    <Box
                      component="img"
                      src="/graph-demo.png"
                      alt={`Interactive BORME corporate relationship graph of ${DEMO_COMPANY}: directors, officers and connected companies`}
                      loading="lazy"
                      onError={() => setDemoImgOk(false)}
                      sx={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '16 / 9', objectFit: 'cover' }}
                    />
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    Real BORME data: the board and corporate connections of {DEMO_COMPANY}.
                  </Typography>
                  <Link
                    href={`/app?search=${encodeURIComponent(DEMO_COMPANY)}`}
                    variant="caption"
                    sx={{ color: 'primary.light', fontWeight: 700, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    Explore this graph live →
                  </Link>
                </Box>
              </Box>
            )}
```

The `aspectRatio: '16 / 9'` reserves layout space before the image loads (no CLS). When the real asset lands, if its ratio differs visibly, update `aspectRatio` to match (e.g. `'1840 / 1035'`).

- [ ] **Step 3: Build**

Run: `npx vite build`
Expected: success.

- [ ] **Step 4: Manual check (graceful absence)**

Run: `npx vite preview`, open `http://localhost:4173/`.
Expected with NO `public/graph-demo.png` present: the "How it works" section shows no broken image — the whole frame disappears (onError path). If the asset exists: framed screenshot renders, click goes to `/app?search=ACERINOX%20SA` and auto-loads the graph (Task 1). Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/components/LandingPage.jsx
git commit -m "feat(landing): framed product screenshot with click-to-try link"
```

---

### Task 4: Hero CTA hierarchy

One dominant action. The IBEX and statistics buttons lose size and the loud green accent.

**Files:**
- Modify: `src/components/LandingPage.jsx` (hero button row)

- [ ] **Step 1: Demote the two secondary hero buttons**

In the hero `Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}`, leave the first (contained "Search companies and officers") button untouched. Replace the IBEX button:

```jsx
              <Button
                variant="outlined"
                size="large"
                component="a"
                href="/empresas-cotizadas"
                onClick={(e) => {
                  if (isNativeApp()) {
                    e.preventDefault();
                    openListedCompanies();
                  }
                }}
                startIcon={<TrendingUpIcon />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  borderRadius: 2,
                  borderWidth: 1.5,
                  borderColor: 'rgba(102,187,106,0.6)',
                  color: '#81c784',
                  bgcolor: 'rgba(102,187,106,0.08)',
                  '&:hover': {
                    borderWidth: 1.5,
                    borderColor: '#66bb6a',
                    bgcolor: 'rgba(102,187,106,0.16)',
                  },
                }}
              >
                Publicly-traded companies (IBEX 35)
              </Button>
```

with:

```jsx
              <Button
                variant="outlined"
                size="medium"
                component="a"
                href="/empresas-cotizadas"
                onClick={(e) => {
                  if (isNativeApp()) {
                    e.preventDefault();
                    openListedCompanies();
                  }
                }}
                startIcon={<TrendingUpIcon />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 2.5,
                  py: 1,
                  borderRadius: 2,
                  borderColor: 'rgba(255,255,255,0.23)',
                  color: 'text.secondary',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.4)',
                    bgcolor: 'rgba(255,255,255,0.05)',
                    color: 'text.primary',
                  },
                }}
              >
                Publicly-traded companies (IBEX 35)
              </Button>
```

Replace the statistics button:

```jsx
              <Button
                variant="outlined"
                size="large"
                startIcon={<BarChartIcon />}
                onClick={() => navigate('/dashboard')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  borderRadius: 2,
                  borderColor: 'rgba(25,118,210,0.5)',
                  color: '#64b5f6',
                  '&:hover': {
                    borderColor: '#1976d2',
                    bgcolor: 'rgba(25,118,210,0.08)',
                  },
                }}
              >
                Spain company statistics
              </Button>
```

with:

```jsx
              <Button
                variant="outlined"
                size="medium"
                startIcon={<BarChartIcon />}
                onClick={() => navigate('/dashboard')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 2.5,
                  py: 1,
                  borderRadius: 2,
                  borderColor: 'rgba(255,255,255,0.23)',
                  color: 'text.secondary',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.4)',
                    bgcolor: 'rgba(255,255,255,0.05)',
                    color: 'text.primary',
                  },
                }}
              >
                Spain company statistics
              </Button>
```

Also change the row's alignment so the smaller buttons center against the big one — replace the wrapping Box's sx with:

```jsx
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
```

- [ ] **Step 2: Build + visual check**

Run: `npx vite build`, then `npx vite preview`, open `http://localhost:4173/`.
Expected: the blue contained Search button visually dominates; the two secondaries read as quiet neutral outlines, vertically centered. Check a ~375px-wide viewport: buttons stack without crowding. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/components/LandingPage.jsx
git commit -m "feat(landing): single dominant hero CTA, demote secondary buttons"
```

---

### Task 5: Remove the stale "Coming Soon" chip on the DD page

The financial-statements add-on is live (sold on /pricing, in the FAQ, and in checkout via `dd_include_fs`).

**Files:**
- Modify: `src/components/DueDiligencePage.jsx`

- [ ] **Step 1: Delete the chip**

In the "Financial Statements add-on" Paper, delete this entire element:

```jsx
          <Chip
            label="Coming Soon"
            size="small"
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              fontSize: '0.65rem',
              height: 22,
              fontWeight: 700,
              bgcolor: 'rgba(25,118,210,0.15)',
              color: 'primary.light',
            }}
          />
```

Also add a price chip so the card matches /pricing — in the same card's chip row, after the `"30-45 minutes delivery"` chip, add:

```jsx
                <Chip label="+€17.50 per company" variant="outlined" size="small" sx={{ fontSize: '0.7rem', fontWeight: 600 }} />
```

- [ ] **Step 2: Build**

Run: `npx vite build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/DueDiligencePage.jsx
git commit -m "fix(dd): remove stale Coming Soon chip from live financial statements add-on"
```

---

### Task 6: Trust assets on /pricing

The sample report and money-back guarantee appear where the buying decision happens.

**Files:**
- Modify: `src/components/PricingPage.jsx`

- [ ] **Step 1: Add imports**

In `src/components/PricingPage.jsx` add to the icon imports:

```jsx
import VerifiedIcon from '@mui/icons-material/Verified';
```

- [ ] **Step 2: Add the trust row inside the one-off pricing card**

Directly after the action-buttons Box (the one containing "Search a company" / "What is in a report"), still inside the same `Paper`, add:

```jsx
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: { xs: 1.5, sm: 3 }, mt: 2.5 }}>
              <Box
                component="a"
                href="/sample-dd-report.pdf"
                target="_blank"
                rel="noopener"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  color: 'warning.light',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                <DescriptionIcon sx={{ fontSize: 17 }} />
                See a sample report
              </Box>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: 'text.secondary', fontSize: '0.82rem', fontWeight: 500 }}>
                <VerifiedIcon sx={{ fontSize: 17, color: 'success.light' }} />
                Money-back if the data is wrong or inaccurate
              </Box>
            </Box>
```

(This mirrors the landing hero trust row — the duplication is two small Boxes; do NOT extract a shared component for this.)

- [ ] **Step 3: Build + visual check**

Run: `npx vite build`, then `npx vite preview`, open `http://localhost:4173/pricing`.
Expected: trust row sits under the buttons inside the pricing card; sample-report link opens the PDF. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/components/PricingPage.jsx
git commit -m "feat(pricing): surface sample report + money-back guarantee at decision point"
```

---

### Task 7: Sample report link in the DD page hero

**Files:**
- Modify: `src/components/DueDiligencePage.jsx`

- [ ] **Step 1: Add the chip**

In the hero chip row (`<Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>`), after the `"+ Free monitoring"` chip, add:

```jsx
            <Chip
              label="See a sample report (PDF)"
              size="small"
              component="a"
              href="/sample-dd-report.pdf"
              target="_blank"
              rel="noopener"
              clickable
              icon={<DescriptionIcon sx={{ fontSize: 16, color: 'warning.light' }} />}
              variant="outlined"
              sx={{ fontWeight: 600, color: 'warning.light', borderColor: 'rgba(255,167,38,0.5)' }}
            />
```

- [ ] **Step 2: Build + check**

Run: `npx vite build`, then `npx vite preview`, open `http://localhost:4173/due-diligence`.
Expected: clickable chip in the hero opens the sample PDF in a new tab. The accordion lower on the page is unchanged. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/components/DueDiligencePage.jsx
git commit -m "feat(dd): direct sample-report link in hero chips"
```

---

### Task 8: Translate the monitoring card to English

**Files:**
- Modify: `src/components/DueDiligencePage.jsx`

- [ ] **Step 1: Replace the Spanish copy**

In the "Free monitoring included" Paper, replace:

```jsx
              <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.5 }}>
                Monitorización gratuita incluida
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, mb: 1.5 }}>
                Cada informe Due Diligence incluye monitorización gratuita de la empresa. Recibirás alertas
                por email cuando se publiquen nuevos actos en el BORME (nombramientos, ceses, cambios de capital,
                disoluciones) o cuando un regulador internacional emita una advertencia a través de IOSCO.
              </Typography>
```

with:

```jsx
              <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.5 }}>
                Free monitoring included
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, mb: 1.5 }}>
                Every Due Diligence report includes free monitoring of the company. You will receive email
                alerts when new BORME filings are published (appointments, resignations, capital changes,
                dissolutions) or when an international regulator issues a warning through IOSCO.
              </Typography>
```

and the chips:

```jsx
                <Chip label="Alertas BORME" variant="outlined" size="small" sx={{ fontSize: '0.7rem', borderColor: 'rgba(22,163,74,0.3)', color: '#16a34a' }} />
                <Chip label="Alertas IOSCO (90+ reguladores)" variant="outlined" size="small" sx={{ fontSize: '0.7rem', borderColor: 'rgba(22,163,74,0.3)', color: '#16a34a' }} />
                <Chip label="Email automático" variant="outlined" size="small" sx={{ fontSize: '0.7rem', borderColor: 'rgba(22,163,74,0.3)', color: '#16a34a' }} />
```

with:

```jsx
                <Chip label="BORME alerts" variant="outlined" size="small" sx={{ fontSize: '0.7rem', borderColor: 'rgba(22,163,74,0.3)', color: '#16a34a' }} />
                <Chip label="IOSCO alerts (90+ regulators)" variant="outlined" size="small" sx={{ fontSize: '0.7rem', borderColor: 'rgba(22,163,74,0.3)', color: '#16a34a' }} />
                <Chip label="Automatic email" variant="outlined" size="small" sx={{ fontSize: '0.7rem', borderColor: 'rgba(22,163,74,0.3)', color: '#16a34a' }} />
```

- [ ] **Step 2: Build**

Run: `npx vite build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/DueDiligencePage.jsx
git commit -m "fix(dd): translate monitoring card to English for page consistency"
```

---

### Task 9: Full build verification

**Files:** none (verification only)

- [ ] **Step 1: Run the complete pipeline**

Run: `npm run build`
Expected: prebuild checks (GLEIF render, curated, sitemaps, SEO files), vite build, barómetro generation, and **prerender** all succeed. The landing prerender must not error on the new demo-image markup.

- [ ] **Step 2: Run the test suite**

Run: `node --test test/`
Expected: all tests pass (9 existing; none of these tasks add `node --test`-testable pure modules).

- [ ] **Step 3: Final manual sweep**

`npx vite preview`, check `/`, `/pricing`, `/due-diligence`, `/app?search=ACERINOX%20SA` at desktop and ~375px width. Expected: no layout breakage, no broken images, no Spanish/English mixing on the DD page. Stop the server.

- [ ] **Step 4: Commit (only if fixes were needed) and report**

Report completion to the user, including the reminder that `public/graph-demo.png` is still pending from them (the demo frame stays hidden until it lands) and that the Android start-screen change needs an emulator/device check after the next `npx cap sync android`.
