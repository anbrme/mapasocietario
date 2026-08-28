# Graph inspector: an orientation card, not a reading surface

**Date:** 2026-08-28
**Status:** design, awaiting review
**Surface:** `src/components/CompanyInspectorPanel.jsx`, `src/components/SpanishCompanyNetworkGraph.jsx`

## The problem

The inspector panel was built to keep people in the graph. It is driving them
out of it.

On 2026-08-24 the panel gained a company findings block and a findings-first
reorder (`c7203c7`, `52fac01`). GA4, read as a daily series split by
`entry_source`:

| period | node clicks | profile opens | background clicks | profile/node | background/node |
|---|---|---|---|---|---|
| Aug 16-23 | 189 | 57 | 72 | **0.302** | **0.38** |
| Aug 24-27 | 129 | 13 | 100 | **0.101** | **0.78** |

Opening the full profile fell threefold. Clicking empty canvas — how the panel
is dismissed — doubled. Both step on the 24th.

Three alternative explanations were tested and rejected:

- **Tracking break.** The CTA is still present and still wired
  (`CompanyInspectorPanel.jsx:492`). The drop is behaviour.
- **Audience shift.** Every `entry_source` in the series is an app-entry source
  (`returning_home_redirect`, `direct`, `home_search`, `home_hero`,
  `home_demo`, `register_guide`, `director_search`). The SEO arrivals that grew
  53% that week are not in this data at all — `source=company_profile` only
  shipped 2026-08-28. The mix barely moved: `returning_home_redirect` is 55% of
  node clicks before and 60% after.
- **Seasonality.** The step is same-day with the deploy, not gradual.

**Sample sizes are small** — 57 profile opens before, 13 after, 1-5 users per
day — and the pre-period ratio swings from 0.00 to 1.38 day to day. This is
strong evidence, not proof, and the design should be judged on whether the
ratio recovers.

### The second cost

`company_full_profile_click` is not only a funnel step. The same handler calls
`recordCompanyDemand({ eventType: 'full_profile_click' })`, and
`shouldPromoteCompany` promotes a company into the indexable set on
`fullProfileClickCount >= 1`. A threefold drop in that click is also throttling
organic growth of the SEO surface. The panel regression and the indexing
pipeline are the same wound.

## The diagnosis

The panel tried to become a reading surface inside a container that cannot be
one:

- `position: absolute`, pinned `top/right/bottom`, `elevation={8}` with a
  `-4px 0 24px` shadow. It floats over the canvas. Overlays read as temporary.
- A fixed outer frame containing `<Box sx={{ flex: 1, overflowY: 'auto' }}>`
  (line 223) — a scrolling frame nested in a fixed one. The outer frame cannot
  grow, so everything added since has been compressed into that inner well.
- `userSelect: 'none'` and `onCopy={e => e.preventDefault()}`. The reader
  cannot select or copy a single line. It does not behave like a document; it
  behaves like a HUD.

And it is a worse duplicate of a surface that already exists. `/empresa` is
legible, permanent, addressable, copyable and indexed. The panel is a
condensed, non-copyable version of it inside an overlay.

The fear the panel was solving does not exist: the CTA is already
`target="_blank"` (line 489), so opening the full profile never cost anyone
their graph.

## The decision

**The panel answers "what is this company", not "is something wrong with it."**

Findings are an interpretation. Interpretation needs room to justify itself —
the dated fact, the filing it came from, why it is worth noting. The panel has
no room for that, which is why every compressed version of it becomes either a
wall or an alarm. A bare severity count was considered and rejected: it is
anxiety without information, and it converts by worry rather than interest.

Orientation is identity, scale and recency. Those are facts, gentle by nature,
and they are what tells someone whether to keep exploring.

## The design

Three tiers, by how much room the content needs to be honest.

### Always visible — the identity card

Fixed height, no internal scroll. A card that fits never needs an inner scroll,
and a thing that does not scroll inside itself reads as an object rather than a
feed.

- Company name, legal form, province
- Active and former officer counts
- Last publication date and total publications
  (*"Última publicación: 4 de agosto de 2026 · 24 en total desde 2009"*)
- The most recent registry event in plain words, no severity, no
  interpretation (*"Nombramiento de apoderado — 4 ago 2026"*)
- **"Abrir ficha completa" — visible, primary, opens in a new window.** Not
  chrome that can be pushed down by whatever is added next.

### Collapsed by default — one disclosure

The deeper registry detail some people genuinely want without leaving the
graph: officer list, sole shareholder. Opt-in, so it may scroll without feeling
imposed. Closed on every node open; no memory of the previous node's state.

### Moved to `/empresa` — everything that needs to justify itself

Findings, capital history, publication history. Nothing is lost; it moves to
where it already reads properly and has evidence beside it.

### Presentation

- Drop `elevation={8}` and the heavy shadow for a quieter, anchored card. The
  panel stays anchored rather than becoming a docked column: the docking
  argument was about it being a reading surface, which it no longer is.
- **Lift `userSelect: 'none'` and the `onCopy` block.** Text you cannot select
  is a large part of why it does not feel real, and blocking copy on a handful
  of registry facts protects nothing — the same facts are copyable on
  `/empresa` and served by the public API.

## Components

| unit | responsibility |
|---|---|
| `CompanyInspectorPanel` | the card: identity, recency, the disclosure, the CTA |
| `CompanyFindings` | unchanged, unmounted here; remains on `/empresa` |
| `FINDINGS_PANEL_ENABLED` | remains, now governing `/empresa` only |
| `trackFullCompanyProfileClick` / `recordCompanyDemand` | unchanged; both must still fire from the CTA |

The panel's dependency on `buildCompanyDatasets` for findings-evidence routing
(`src/utils/inspectorDatasets.js`) goes with the findings block. The data dock
keeps its other entry points.

## Testing

- The card renders with no internal scroll container.
- Identity, recency and the CTA are present for a company with no events, no
  officers, and no last-seen date — a sparse doc must not produce a broken card.
- The CTA still fires **both** `trackFullCompanyProfileClick` and
  `recordCompanyDemand({ eventType: 'full_profile_click' })`. The demand
  promotion depends on the second; losing it silently would stall indexing.
- The CTA carries `target="_blank"` and `rel="noopener"`.
- The disclosure is closed on mount and closed again when the selected node
  changes.
- Text in the card is selectable (no `userSelect: 'none'`).
- No findings block is mounted in the panel.

## Success criteria

Read from the `/series` endpoint over the two weeks after deploy, against the
Aug 16-23 baseline:

- `company_full_profile_click / graph_node_click` returns toward **0.30**
  (from 0.10).
- `graph_background_click / graph_node_click` falls back toward **0.38**
  (from 0.78).
- `company_index_candidates` gains candidate rows again as
  `full_profile_click` demand resumes.

If the ratios do not move, the diagnosis was wrong and the panel was not the
cause — say so rather than iterating on the layout.

## Out of scope

- Converting the panel to a docked column that resizes the canvas.
- Redesigning `/empresa`.
- Changing what findings say or how they are computed.
