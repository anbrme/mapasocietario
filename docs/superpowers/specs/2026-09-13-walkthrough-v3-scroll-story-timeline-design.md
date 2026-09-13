# Walkthrough v3: a scroll-driven story over a registry timeline

**Date:** 2026-09-13
**Repo:** `mapasocietario` only (frontend). No backend change.
**Status:** approved 2026-09-13.
**Builds on:** `2026-09-13-walkthrough-v2-selection-dossier-design.md` (the
step object, the selection model, the chapter/evidence split). Everything not
named here stays as v2 built it.

## Why

The v2 file is a dossier: a map figure, then chapters, then annexes. It reads
well, but it reads. The PDF due diligence already owns "static tables";
what nobody in this market ships is a portable file that *moves*: a visual
that changes under the text as the reader scrolls, a network that shows its
own history, and a way back to the live data. That is the format this spec
builds. The brief, in the author's words: "visually enticing, light, dynamic
and as living as it can be". Living, not live: motion and state inside the
file, never a network feed.

Three decisions, taken in chat and not to be relitigated here:

1. **The dataset builds the skeleton, the author owns the story.** No model
   writes prose in this version. A drafted-lead LLM layer is a later, paid,
   separate spec.
2. **The file stays a snapshot.** It opens offline, forwards intact, and
   says which day the registry was read. "Live" means a return path to the
   app, never a network call from inside the file.
3. **Three items only:** the scroll-driven layout with a registry-state
   timeline, a moment per chapter, and the return links. Presenter mode and
   map layer filters wait.

## What the reader sees

### Layout

On a screen 960 px or wider the story section is two columns. The left
column is the map, sticky, filling the viewport height: the network at the
top, the timeline slider under it, and a compact step card (title, moment,
first evidence line) at the bottom. The right column is the chapters,
scrolling. When a chapter's top crosses the middle of the viewport it becomes
current: its number lights up, the map animates to that step's focus set and
to that step's moment.

Under 960 px the map sits sticky at the top of the screen at 38 % of the
viewport height with the slider under it, and the chapters scroll beneath.
Same behaviour, one column.

In print the layout is the v2 one: the map once as a figure at the full
current state, chapters after it. Nothing sticky, no slider.

The cover, contents, summary and annexes keep their single-column width. Only
the story section widens.

### The annexes as an explorer

On screen the annexes become one tabbed block, *Explorar la evidencia* /
*Explore the evidence*: one tab per non-empty annex (companies, connections,
ownership, corrections), the first open by default, switched with buttons
(`role="tablist"`, arrow keys move between tabs). In print every tab is
stacked in order under its own heading, as today. The tab strip is the only
new control; the tables inside are unchanged.

### The timeline

The map has a date. A range slider under it runs across every date the
network knows: each seat's appointment, each cessation, each company's first
and last filing, each chapter's moment. Moving it renders the network as the
registry showed it on that day:

- a seat that had not been inscribed yet is not drawn;
- a seat that was live is a solid line;
- a seat that had ceased is a dashed, muted line;
- a person with no seat drawn at that date is not drawn;
- a company before its first filing is not drawn; a dissolved company after
  its last filing is a ghost (faint fill, no label weight);
- a link without any date is always drawn, and the caption counts them
  ("3 vínculos sin fecha"), so the reader knows the picture is partial rather
  than believing it is complete.

Entering a chapter moves the slider to that chapter's moment. Moving the
slider by hand detaches it from the chapters until the next chapter enters.
The transitions animate: pan and zoom over 600 ms, links fading in and out,
nodes fading. `prefers-reduced-motion` turns every transition off.

The slider's label shows the date in the document language. Chapter moments
are tick marks on the slider, so the story's beats are visible as a shape
before the reader has read a word.

### A moment per chapter

Every step carries a `moment`, a calendar day. Defaults, computed at draft
time:

- company: the date of its last filing (`status.lastFiling.date`, falling
  back to the profile's `last_seen`);
- person: the latest date across their visible seats (`since` or `until`);
- nothing dated: `null`, and the chapter renders the full current state,
  slider at its right end.

The author edits a moment in the modal's Recorrido list, one native date
field per step next to the note field, labelled *Momento* / *Moment*. The
value is stored in the `walkthroughEdits` overlay under `moments[key]`, so it
survives autosave and snapshot import like hidden steps and notes do. Reset
clears moments with the other edits.

The chapter head shows the moment after the eyebrow: `01 · Empresa ·
Registro (BORME) · 14 marzo 2021`. The live player card shows the same date
as a chip. The live canvas does **not** render time in this version; that is
the file's job (out of scope below).

### The return path

The footer gains two lines under the source line:

- *Ver esta red en Mapa Societario, con los cambios desde el 13 de
  septiembre de 2026* → `https://mapasocietario.es/app?gk=A&gk=B&…&since=2026-09-13&source=sitrep`
- *Avísame si alguna de estas empresas cambia* → the same URL with `&watch=1`

The app learns two things:

- `gk` may repeat. Every value seeds one company, the way a watchlist token
  seeds its set today (`loadCompanyRecordIntoGraph`, group key stamped on the
  node). One unreachable company never costs the others.
- `since=YYYY-MM-DD` marks every seeded company whose `last_seen` is later
  than that day with the existing changed-since marker, so the reader who
  comes back from the file sees at a glance which companies have moved.
  `watch=1` opens the watchlist dialog once seeding finishes, with those
  companies preselected.

The cover's status block keeps the "read on" line and adds nothing; the
footer is where the reader looks for what to do next.

## Data model

```js
Step {
  …v2 fields…,
  moment: 'YYYY-MM-DD' | null,        // default computed, author-overridable
}

// Embedded in the file as window.__SITREP__ next to steps/opening/noteLabel:
timeline: {
  dates: ['YYYY-MM-DD', …],           // sorted, distinct; the slider domain
  nodes: { [id]: { from: 'YYYY-MM-DD'|null, to: 'YYYY-MM-DD'|null, dissolved: bool } },
  links: { ['a|b|role']: { a, b, from: 'YYYY-MM-DD'|null, to: 'YYYY-MM-DD'|null } },
  undated: number,                    // links with neither from nor to
  readOn: 'YYYY-MM-DD',               // doc.generatedAt, the right end
}
```

`walkthroughEdits` gains `moments: { [stepKey]: 'YYYY-MM-DD' }`, normalised
by `normalizeWalkthroughEdits` (invalid or non-ISO values dropped).

## Where the dates come from

| Fact | Source | Note |
|---|---|---|
| seat inscribed | earliest `link.events[].date` with an appointment category, else `link.date` | events are role-filtered at enrichment |
| seat ceased | `link.categoryDate` when the effective category is a cessation, else the latest cessation event date | effective category via `getLinkEffectiveCategory` |
| ownership link | `link.date` as `from`, `to` = null (lost-ownership rows: `to` = `link.date`) | |
| company first / last filing | v3 profile `first_seen` / `last_seen` from the loader | persons carry no dates of their own |
| dissolved | node `isDissolved` or profile `is_dissolved`; ghost from `last_seen` | the dissolution's own date is not a field we hold; the last filing is the honest proxy and the caption says "según su último acto" |
| chapter moment | as above | |

Company dates resolve in this order: the profile's `first_seen`/`last_seen`
when the loader fetched it; otherwise the earliest and latest dates of the
company's own links, with `to` = null (a company is never ghosted without a
profile saying it is dissolved); otherwise null/null, always drawn and counted
as undated. Nothing new goes on the wire: the loader already fetches the
profile for every selected company, and in draft mode (no selection) for the
subject companies only.

## Files

| File | Change |
|---|---|
| `src/utils/walkthrough/registryTimeline.js` (new) | pure: `buildTimeline({graphData, stepData, steps, readOn})` → the `timeline` object above; `defaultMoment(step)`; `stateAt(timeline, date)` → `{nodes: Map<id,'live'|'ghost'|'hidden'>, links: Map<key,'live'|'ceased'|'hidden'>}` (used by tests and by the script, which inlines the same rule) |
| `src/utils/walkthrough/draftWalkthrough.js` | steps carry `moment` (default); `SELECTION_CAP` unchanged |
| `src/utils/walkthrough/applyWalkthroughEdits.js` | `moments` in the overlay; `setStepMoment(edits, key, iso)`; the overlay's moment wins over the default |
| `src/hooks/useWalkthrough.js` | `setMoment(key, iso)`; `reset` clears moments |
| `src/components/RelationshipReportModal.jsx` | date field per step; footer copy unchanged |
| `src/components/WalkthroughPlayer.jsx` | moment chip on the card |
| `src/utils/investigationDoc.js` | `timeline` and `steps[].moment` pass through |
| `src/utils/investigationExport/documentSections.js` | `renderStory(doc, graphData, t, wt)` replaces `renderMapFigure` + `renderChapters` on screen: the two-column grid, the sticky pane (map, slider, card), chapters with `data-moment`; print keeps the figure-then-chapters order via CSS order, not a second render; footer return links |
| `src/utils/investigationExport/documentStyle.js` | grid, sticky pane, slider, ghost/ceased/hidden states, transitions, reduced-motion, 960 px and print rules |
| `src/utils/investigationExport/walkthroughScript.js` | IntersectionObserver over `.chapter` (rootMargin `-50% 0px -50% 0px`); `renderAt(date)` applying `stateAt`'s rule through classes; slider binding; animated pan via CSS `transform` on `#viewport` (`transform-origin: 0 0`, transition disabled while dragging or pinching); detach/re-attach logic; keyboard ←/→ still steps chapters |
| `src/utils/investigationExport/renderGraphSvg.js` | links carry `data-key="a|b|role"` (role folded like `pairKey` + relationship) so the script can address one seat among several on the same pair |
| `src/utils/investigationExport/exportCopy.js` | return-link copy, slider labels, undated caption, "según su último acto", explorer title |
| `src/utils/investigationExport/documentSections.js` (annexes) | `renderAnnexes` wraps the non-empty annexes in a tab strip; print stacks them |
| `src/utils/walkthrough/walkthroughCopy.js` | *Momento* / *Moment* label |
| `src/App.jsx` | `gk` via `getAll`; `since`, `watch` parsed by a pure `parseReturnParams(search)` in `src/utils/returnParams.js` (new) |
| `src/components/SpanishCompanyNetworkGraph.jsx` | seed every `gk`; changed-since marker from `since`; open the watchlist dialog on `watch=1` after seeding |

`renderGraphSvg` today draws one `<line>` per graph link, and the graph
already holds one link per officer-position pair, so `data-key` is a
labelling change, not a structural one.

## Copy

| Key | ES | EN |
|---|---|---|
| Moment label | Momento | Moment |
| Slider caption | Estado del registro el {date} | Registry as of {date} |
| Undated | {n} vínculo(s) sin fecha, siempre visibles | {n} undated link(s), always shown |
| Dissolved proxy | Disuelta · según su último acto | Dissolved · as of its last filing |
| Return link | Ver esta red en Mapa Societario, con los cambios desde el {date} | See this network on Mapa Societario, with changes since {date} |
| Watch link | Avísame si alguna de estas empresas cambia | Alert me when any of these companies changes |
| Chapter head moment | {date} appended after the eyebrow with " · " | same |
| Explorer title | Explorar la evidencia | Explore the evidence |

Dates render with the document's existing `fmtDate` (long form). The URL
carries ISO.

## Analytics

- `walkthrough_moment_set` when the author edits a moment.
- On arrival from a file: the existing `graph_view` already carries
  `entry_source: 'sitrep'` through the `source` param. Add
  `sitrep_return { companies, changed, watch }` after seeding.
- Nothing fires from inside the file. It has no network.

## Testing

Pure, in vitest as today:

- `registryTimeline`: a seat with an appointment event and a later
  cessation is hidden before, live between, ceased after; an undated link is
  live at every date and counted; a dissolved company is a ghost after
  `last_seen` and live before; a company with no profile is always live; the
  slider domain is sorted and distinct and ends at `readOn`; `defaultMoment`
  for company, person and nothing-dated.
- `applyWalkthroughEdits`: moments normalised, overlay wins, reset clears.
- `documentSections`: the story grid renders once, chapters carry
  `data-moment`, the slider is omitted when the domain has fewer than two
  dates, the footer carries both links with every company's `gk` and the
  `since` date, no link when no company has a group key.
- `walkthroughScript`: contains `IntersectionObserver`, `prefers-reduced-motion`,
  binds `wt-slider`, binds the annex tabs, never uses `innerHTML`, never
  contains `</script`, parses.
- `documentSections` (annexes): one tab per non-empty annex, none when only
  one annex has rows, every panel present in the markup for print.
- `returnParams`: repeated `gk`, ISO `since` only, `watch` boolean, junk
  ignored.
- `buildExportHtml`: `timeline` embedded with `<` escaped.

Live check, as v2: a 4-step selection across two companies and one person on
a wide graph, scrolled on a laptop and on a phone-width window; the slider
scrubbed by hand and re-attached by the next chapter; the return link opened
in the app with one company changed since; the watch link opening the
dialog; print preview showing figure-then-chapters.

## Out of scope

Time rendering on the live canvas; presenter mode; map layer filters; a
model-written lead; a hosted share link; changes to the AI panel; any
network call from inside the file.
