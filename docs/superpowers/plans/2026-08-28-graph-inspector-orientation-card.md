# Graph Inspector Orientation Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the graph's company inspector from a scrolling reading surface into a fixed-height orientation card that sends people to `/empresa`.

**Architecture:** Follow the codebase's established pattern for testable UI: extract the decisions into pure view functions (`graphEmptyStateView`, `ddStatusView` are the precedents) and let the JSX consume them. Vitest runs in the `node` environment, so **no test renders React** — every test in this plan exercises a pure function. Four independent units: a recency-line formatter, a dataset field that feeds it, a fit-bounds calculator, and the panel rewire that consumes both.

**Tech Stack:** React 19, MUI 5, Vite 5, Vitest (environment `node`), `node --test` for `test/*.test.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-28-graph-inspector-orientation-card-design.md`

## Global Constraints

- **Vitest environment is `node`.** Never write a test that renders a React component; extract a pure function and test that instead.
- **The CTA must keep firing BOTH `trackFullCompanyProfileClick` and `recordCompanyDemand({ eventType: 'full_profile_click' })`.** The second feeds `shouldPromoteCompany` (`fullProfileClickCount >= 1`), which promotes pages into the SEO index. Losing it silently stalls indexing.
- **The CTA keeps `target="_blank"` and `rel="noopener"`.**
- **No severity counts, no alarm language.** The card states facts; it never summarises risk. A count is anxiety without information.
- Copy ships in both `es` and `en`; the panel's copy dictionary lives in `SpanishCompanyNetworkGraph.jsx` (`externalEstimate` at lines ~467 EN / ~816 ES mark the block) and is passed down as `text`.
- Run `npm test` before every commit. Baseline is green: 54 vitest files / 658 tests, 265 node tests.

---

### Task 1: The recency line

One line that names the last filing and dates it once. Replaces the separate `bormeRange` and `publicationsFound` grid cells, which repeat the same information across two boxes.

**Files:**
- Create: `src/components/companyRecencyLine.js`
- Test: `src/components/companyRecencyLine.test.js`

**Interfaces:**
- Consumes: `formatDate` from `../utils/formatDate` (existing, pure).
- Produces: `companyRecencyLine({ lastEventType, lastSeen, firstSeen, eventCount, lang }) => string | null`. Task 4 renders the string; Task 2 supplies `lastEventType`.

- [ ] **Step 1: Write the failing test**

```js
// src/components/companyRecencyLine.test.js
import { describe, it, expect } from 'vitest';
import { companyRecencyLine } from './companyRecencyLine';

describe('companyRecencyLine', () => {
  it('names the last filing and dates it once', () => {
    expect(companyRecencyLine({
      lastEventType: 'Nombramientos', lastSeen: '2026-08-04',
      firstSeen: '2009-02-03', eventCount: 24, lang: 'es',
    })).toBe('Última publicación: Nombramientos · 4 ago 2026 · 24 en total desde 2009');
  });

  it('falls back to the date alone when the filing has no readable type', () => {
    expect(companyRecencyLine({
      lastSeen: '2026-08-04', firstSeen: '2009-02-03', eventCount: 24, lang: 'es',
    })).toBe('Última publicación: 4 ago 2026 · 24 en total desde 2009');
  });

  it('drops the total when there is no count to give', () => {
    expect(companyRecencyLine({ lastSeen: '2026-08-04', lang: 'es' }))
      .toBe('Última publicación: 4 ago 2026');
  });

  it('drops "desde" when the first filing is unknown', () => {
    expect(companyRecencyLine({ lastSeen: '2026-08-04', eventCount: 3, lang: 'es' }))
      .toBe('Última publicación: 4 ago 2026 · 3 en total');
  });

  it('speaks English too', () => {
    expect(companyRecencyLine({
      lastEventType: 'Nombramientos', lastSeen: '2026-08-04',
      firstSeen: '2009-02-03', eventCount: 24, lang: 'en',
    })).toBe('Last filing: Nombramientos · 4 Aug 2026 · 24 in total since 2009');
  });

  it('is null with no date — a sparse doc must not render a broken line', () => {
    expect(companyRecencyLine({ lang: 'es' })).toBeNull();
    expect(companyRecencyLine({ eventCount: 5, lang: 'es' })).toBeNull();
    expect(companyRecencyLine({})).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/companyRecencyLine.test.js`
Expected: FAIL — `Failed to resolve import "./companyRecencyLine"`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/components/companyRecencyLine.js
/**
 * One line of recency for the inspector card: what the last filing WAS, when,
 * and how many there have been.
 *
 * The panel used to carry this as two grid cells — a "first — last" range and
 * a separate publication count — which spent two boxes repeating one date. The
 * event TYPE is what makes the line interesting rather than merely recent; the
 * count is what makes the record feel alive. Neither carries severity: this
 * card states what a company IS, never whether something is wrong with it.
 */
import { formatDate } from '../utils/formatDate';

const COPY = {
  es: { lead: 'Última publicación', total: 'en total', since: 'desde' },
  en: { lead: 'Last filing', total: 'in total', since: 'since' },
};

export function companyRecencyLine({
  lastEventType = null, lastSeen = null, firstSeen = null, eventCount = 0, lang = 'es',
} = {}) {
  if (!lastSeen) return null;
  const t = COPY[lang] || COPY.es;

  const head = [lastEventType, formatDate(lastSeen, lang)].filter(Boolean).join(' · ');
  const parts = [`${t.lead}: ${head}`];

  if (Number(eventCount) > 0) {
    const year = String(firstSeen || '').slice(0, 4);
    const tail = /^\d{4}$/.test(year)
      ? `${eventCount} ${t.total} ${t.since} ${year}`
      : `${eventCount} ${t.total}`;
    parts.push(tail);
  }
  return parts.join(' · ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/companyRecencyLine.test.js`
Expected: PASS, 6 tests. If the date format differs, read `src/utils/formatDate.js` and fix the EXPECTED strings in the test to match the real formatter — do not reimplement date formatting here.

- [ ] **Step 5: Commit**

```bash
git add src/components/companyRecencyLine.js src/components/companyRecencyLine.test.js
git commit -m "feat(inspector): one recency line, naming the filing and dating it once"
```

---

### Task 2: Feed the last filing type into the dataset

The panel receives `data.enriched`, which carries `firstSeen`, `lastSeen` and `eventCount` but no filing type. Task 1's line needs one.

**Files:**
- Create: `src/utils/latestEventType.js`
- Test: `src/utils/latestEventType.test.js`
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` (the `enriched: {` dataset literal, ~line 6043)

**Interfaces:**
- Consumes: `sortedEvents` — already in scope where the dataset is built, newest first.
- Produces: `latestEventType(sortedEvents) => string | null`, and `enriched.lastEventType` on the dataset Task 4 reads.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/latestEventType.test.js
import { describe, it, expect } from 'vitest';
import { latestEventType } from './latestEventType';

// v3 events carry event_types: [{ category, type }]. "Datos registrales" is on
// almost every filing and says nothing about what happened, so it is never the
// answer while a real act is present.
describe('latestEventType', () => {
  it('names the act on the newest filing', () => {
    expect(latestEventType([
      { event_types: [{ category: 'officers', type: 'Nombramientos' },
                      { category: 'administrative', type: 'Datos registrales' }] },
    ])).toBe('Nombramientos');
  });

  it('prefers a real act over the registry boilerplate', () => {
    expect(latestEventType([
      { event_types: [{ category: 'administrative', type: 'Datos registrales' },
                      { category: 'capital', type: 'Reducción de capital' }] },
    ])).toBe('Reducción de capital');
  });

  it('falls back to boilerplate when it is genuinely all there is', () => {
    expect(latestEventType([
      { event_types: [{ category: 'administrative', type: 'Datos registrales' }] },
    ])).toBe('Datos registrales');
  });

  it('reads a plain string event type', () => {
    expect(latestEventType([{ event_types: ['Constitución'] }])).toBe('Constitución');
  });

  it('is null when there is nothing to name', () => {
    expect(latestEventType([])).toBeNull();
    expect(latestEventType(null)).toBeNull();
    expect(latestEventType([{}])).toBeNull();
    expect(latestEventType([{ event_types: [] }])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/latestEventType.test.js`
Expected: FAIL — `Failed to resolve import "./latestEventType"`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/utils/latestEventType.js
/**
 * The act on the newest filing, in the registry's own words.
 *
 * "Datos registrales" rides along on nearly every BORME entry and describes
 * bookkeeping rather than an event, so it is only reported when it is
 * genuinely all the filing says.
 */
const BOILERPLATE = /^datos registrales$/i;

const asText = (value) =>
  (typeof value === 'string' ? value : value && value.type ? value.type : '').trim();

export function latestEventType(sortedEvents) {
  const newest = (sortedEvents || [])[0];
  const types = (newest && newest.event_types) || [];
  const named = types.map(asText).filter(Boolean);
  if (!named.length) return null;
  return named.find((t) => !BOILERPLATE.test(t)) || named[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/latestEventType.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire it into the dataset**

In `src/components/SpanishCompanyNetworkGraph.jsx`, add the import next to the other `../utils/` imports:

```js
import { latestEventType } from '../utils/latestEventType';
```

Then inside the `enriched: {` object literal (the one containing `firstSeen,` and `lastSeen,` around line 6052), add one line immediately after `lastSeen,`:

```js
              lastEventType: latestEventType(sortedEvents),
```

- [ ] **Step 6: Verify the build still resolves**

Run: `npm test`
Expected: PASS, no new failures against the 658/265 baseline.

- [ ] **Step 7: Commit**

```bash
git add src/utils/latestEventType.js src/utils/latestEventType.test.js src/components/SpanishCompanyNetworkGraph.jsx
git commit -m "feat(graph): carry the newest filing's act onto the company dataset"
```

---

### Task 3: ~~Fit bounds that exclude the panel~~ — CUT

Cut during implementation on 2026-08-28. The premise was wrong: the canvas
already reserves the panel width (`SpanishCompanyNetworkGraph.jsx:1915-1919`,
`containerDimensions.width - reservedInspectorWidth`), so the graph is docked
beside the panel on `sm`+ and full-screen below it. A fit inset would have
double-counted and pushed the graph off-centre. `graphFitBounds` was written,
tested, and deleted rather than left as dead code.

---

### Task 4: The panel becomes the card

**Files:**
- Modify: `src/components/CompanyInspectorPanel.jsx`
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` (copy dictionary, both languages)

**Interfaces:**
- Consumes: `companyRecencyLine` (Task 1), `enriched.lastEventType` (Task 2).

- [ ] **Step 1: Add the copy, both languages**

In `SpanishCompanyNetworkGraph.jsx`, beside `externalEstimate` in each dictionary:

```js
    // EN block (~line 467)
    moreRegistryDetail: 'More registry detail',
    openFullProfile: 'Open the full company profile',
    fullProfileHint: 'Officers, shareholders, filing history and analysis — opens in a new tab',
```

```js
    // ES block (~line 816)
    moreRegistryDetail: 'Más detalle registral',
    openFullProfile: 'Abrir la ficha completa',
    fullProfileHint: 'Cargos, socios, historial y análisis — se abre en una pestaña nueva',
```

- [ ] **Step 2: Make the panel a card rather than an overlay**

In `CompanyInspectorPanel.jsx`, in the root `<Paper sx={{...}}>` (~line 148):
- change `elevation={8}` to `elevation={0}`
- delete the `boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',` line
- delete `userSelect: 'none'`, `WebkitUserSelect: 'none'`, `MozUserSelect: 'none'`, `msUserSelect: 'none'`
- delete the `onCopy={e => e.preventDefault()}` prop

Leave `onContextMenu`, `position: 'absolute'`, the border and `borderRadius: 0` untouched.

**Keep `overflowY: 'auto'` on the body box (line 223).** The spec's "no internal
scroll" is a statement about CONTENT — with findings gone and the detail
collapsed, the card fits, so the scrollbar never appears. Deleting the property
would not make the card shorter; it would clip and strand content on a short
viewport. The fix is having less to show, not forbidding the overflow.

- [ ] **Step 3: Unmount the findings block**

Delete the whole `{FINDINGS_PANEL_ENABLED && data?.type === 'company' && data.name && (<CompanyFindings ... />)}` expression (~lines 237-248) and its preceding comment block. Then delete the now-unused imports: `CompanyFindings`, `FINDINGS_PANEL_ENABLED`, `listedBadgeFor`, and the `FINDINGS_EVIDENCE_DATASET_KEY` / `FINDINGS_OFFICERS_DATASET_KEY` constants **only if nothing else in the file references them** — grep first:

```bash
grep -n "FINDINGS_EVIDENCE_DATASET_KEY\|FINDINGS_OFFICERS_DATASET_KEY\|listedBadgeFor\|CompanyFindings\|FINDINGS_PANEL_ENABLED" src/components/CompanyInspectorPanel.jsx
```

`FINDINGS_PANEL_ENABLED` stays exported from `src/config` — `/empresa` and any other consumer keep using it. Do not delete the flag itself.

- [ ] **Step 4: Replace the two date cells with the recency line**

Add the import:

```js
import { companyRecencyLine } from './companyRecencyLine';
```

Delete both grid cells — the `{(e?.firstSeen || e?.lastSeen) && (...)}` block (~lines 424-431) and the `{e?.eventCount > 0 && (...)}` block (~lines 432-437). In their place, after the closing `</Paper>` of the overview grid, render:

```jsx
              {recencyLine && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {recencyLine}
                </Typography>
              )}
```

computed once, immediately after `const e = data.enriched;` in the same IIFE:

```js
              const recencyLine = companyRecencyLine({
                lastEventType: e?.lastEventType,
                lastSeen: e?.lastSeen,
                firstSeen: e?.firstSeen,
                eventCount: e?.eventCount,
                lang,
              });
```

- [ ] **Step 5: Make the CTA visible and primary**

Replace the `<Typography component="a" ...>` CTA (~lines 484-500) with a Button that keeps **both** tracking calls verbatim. Do not alter the bodies of `trackFullCompanyProfileClick` or `recordCompanyDemand`:

```jsx
              {fullHref && (
                <Box sx={{ mb: 2 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    href={fullHref}
                    target="_blank"
                    rel="noopener"
                    onClick={() => {
                      trackFullCompanyProfileClick({ href: fullHref, language: lang, entrySource });
                      recordCompanyDemand({
                        eventType: 'full_profile_click',
                        language: lang,
                        company: { ...(e || {}), name: data.name },
                      });
                    }}
                  >
                    {text.openFullProfile}
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    {text.fullProfileHint}
                  </Typography>
                </Box>
              )}
```

Keep any arguments the original `recordCompanyDemand` call passed beyond those shown — copy the original call's object verbatim rather than retyping it from this plan.

- [ ] **Step 6: Put the deep registry detail behind one collapsed disclosure**

Import `Accordion`, `AccordionSummary`, `AccordionDetails` and `ExpandMoreIcon` from MUI. Wrap the remaining detail — the sole-shareholder cell, the hoja-history cell, and the officer tables below the overview — in:

```jsx
              <Accordion
                expanded={detailOpen}
                onChange={(_, open) => setDetailOpen(open)}
                disableGutters
                elevation={0}
                sx={{ '&:before': { display: 'none' }, border: '1px solid', borderColor: 'divider' }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">{text.moreRegistryDetail}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {/* Exactly three things move in here, unchanged:
                      1. the sole-shareholder cell (`e?.isUnipersonal && ...`)
                      2. the hoja-history cell (`e?.hojaHistory?.length > 1`)
                      3. the officer tables rendered below the overview grid
                      Move the JSX verbatim; do not restyle it in this task. */}
                </AccordionDetails>
              </Accordion>
```

Add the state near the component's other hooks, closing it whenever the selected company changes so no node inherits the previous one's open state:

```jsx
  const [detailOpen, setDetailOpen] = useState(false);
  useEffect(() => { setDetailOpen(false); }, [data?.name]);
```

- [ ] **Step 7: Verify the whole suite and the build**

Run: `npm test && npm run build`
Expected: tests PASS with no new failures; build completes through prerender.

- [ ] **Step 8: Commit**

```bash
git add src/components/CompanyInspectorPanel.jsx src/components/SpanishCompanyNetworkGraph.jsx
git commit -m "feat(inspector): an orientation card, not a reading surface

The panel was built to keep people in the graph and was driving them out:
after the 24 Aug findings block, full-profile opens fell 3x while background
dismissal clicks doubled. Findings move to /empresa, where they have evidence
beside them; the card keeps identity, one recency line and a visible door."
```

---

### Task 5: Verify against the spec's success criteria

**Files:** none — this is a read, not a change.

- [ ] **Step 1: Confirm the card no longer scrolls internally**

Run `npm run dev`, open `/app`, search a large company (CAIXABANK SA), click its node. The card must fit without an inner scrollbar with the disclosure closed.

- [ ] **Step 2: Confirm nothing hides behind the panel**

With the panel open, no node may render underneath it. Close it — the graph re-fits to the full canvas.

- [ ] **Step 3: Confirm the text selects and the CTA fires both calls**

Select a line of the card with the mouse — it must highlight. Open devtools, click the CTA, and confirm in the Network tab both a `gtag` collect call and a `POST /api/company-demand` leave the page, and that `/empresa` opens in a NEW tab.

- [ ] **Step 4: Record the baseline to read against**

The spec's criteria, read from the `/series` endpoint two weeks after deploy against the Aug 16-23 baseline: `company_full_profile_click / graph_node_click` back toward **0.30** (from 0.10), `graph_background_click / graph_node_click` back toward **0.38** (from 0.78).

```
/series?token=$REPORT_TOKEN&events=graph_node_click,company_full_profile_click,graph_background_click&days=28&breakdown=entry_source
```

If the ratios do not move, the diagnosis was wrong and the panel was not the cause. Say so rather than iterating on the layout.
