# Replay history: a company's or an officer's network, replayed in registry time

**Date:** 2026-09-18
**Repo:** `mapasocietario` (frontend) + one small change in `ncdata-bormes-impl` (officer-events paging).
**Status:** implementation on feat/replay-history (frontend) + feat/officer-events-paging (ncdata-bormes-impl).
**Builds on:** `officerTimeline.js` (`buildTimelineSpans`, the term sweep), the
walkthrough v3 registry timeline (`2026-09-13-walkthrough-v3-scroll-story-timeline-design.md`,
its visual grammar for live / ceased / hidden), and the event endpoints
`/bormes/v3/events` and `/bormes/v3/officer-events`.

## Why

A graph shows the network as it is today, and a Gantt chart shows one person's seats as
bars. Neither shows the *rhythm* of a company's life. Suppose a company appointed two
people in ten years and then twelve in the following year. That burst matters: a
takeover, a restructuring, a family succession, or a management company taking over the
board. Today the reader only sees fourteen lines.

Replay history animates the recorded appointments and cessations in registry order, with
time kept **proportional**. Quiet decades pass slowly and bursts arrive as bursts. The
feature is an analytical instrument, not a decoration. Every frame must be a network the
registry actually published on that day, or be marked where it is not.

## Decisions already taken (not to be relitigated here)

1. **Linear time.** One historical year = 5 s at 1×. Giving each event equal
   screen time would erase the pattern the feature exists to show. Long
   quiet stretches are handled by controls (skip to next act, scrubber,
   activity strip), never by compressing the clock.
2. **Stable positions.** Nodes never move during playback. The layout is
   computed once, for the full history, before play starts.
3. **Load first, then play.** The whole history is fetched up front and
   applied locally as the clock advances. No network calls during playback.
4. **v1 scope = one subject and its first ring.** Either one company and its
   officers, or one officer and their companies. Replaying a multi-hop network
   through time is a later spec.
5. **Publication dates.** `borme_events_v3.event_date` is the BORME
   publication date, not the deed date. The UI says so. Effective dates are
   not offered because we do not hold them.

## What the user sees

### Entry

- **Company:** a *Replay history* / *Reproducir historia* button in
  `CompanyInspectorPanel`, next to the existing report actions.
- **Officer:** the same button in `OfficerInspectorBody`, next to *Open the
  full timeline*.

Both buttons open `ReplayDialog`, a full-screen dialog with its own canvas. The user's
graph is not touched, so closing the dialog returns them to exactly where they were.

### Loading

The dialog opens straight away with a progress line ("Loading 1,240 registry acts…
500 / 1,240"). Pages are fetched **sequentially** because the API rate limiter bans
bursts. The play button enables once every page has arrived or the fetch has stopped at
a cap (see *Completeness*).

### The stage

- **Subject** at the centre, always drawn and labelled.
- **Counterparts** (officers of the company, or companies of the officer) sit
  on concentric rings around it. They are ordered clockwise by their
  **first act date**, so position also reads as time: the earliest arrivals
  sit at 12 o'clock, and a burst lands as a contiguous arc. Ring capacity grows with
  radius. The layout is deterministic, so the same subject gives the same
  picture every time and a screenshot is reproducible.
- **Appointment:** the counterpart fades in (200 ms real time) and its link
  draws from the subject outward. A counterpart that already has a live term does
  not re-enter. Its link pulses once instead (a renewal or a new role).
- **Cessation:** the link flashes in the cessation colour for 600 ms real time,
  then settles into a **historical trace**: a dashed, muted line (the walkthrough's
  "ceased" style). The counterpart dims. *Show past seats* (on by default) toggles
  the traces off, leaving only the live network.
- **Several roles on one link:** the link is live while **any** of that counterpart's
  terms is open. Ending one role flashes the link and updates its label, but the link
  stays solid if another role is still open. For example, a consejero whose apoderado
  power is revoked stays solid.
- **Labels:** the subject is always labelled. Counterparts are labelled on hover and
  focus. They are also labelled for 2 s after they change, so the name of whoever just
  moved is readable.

### The clock and controls

Under the stage, from top to bottom:

1. **Date readout:** "14 March 2021 · BORME publication date".
2. **Activity strip:** a histogram of acts per month over the whole domain.
   Appointments and cessations are stacked in their two colours. Bursts are
   visible before anyone presses play. It shares the scrubber's x-axis.
3. **Scrubber:** draggable, and the playhead sits over the strip. Dragging
   renders that date's state instantly (no animation while dragging).
4. **Buttons:** play/pause, *next act* (moves the clock to 1 historical day before
   the next act and keeps playing), speed 0.5× / 1× / 2× / 4×, and *Show past seats*.
   For a company subject there is also *Include apoderados* (see *Volume*).

Keyboard: Space plays/pauses, ←/→ steps to the previous or next act, and Home/End jump
to the domain ends.

**Clock domain:**
- **Start:** 3 months before the first act. If any term has an unknown start (below),
  the domain starts at that term's first act, and the stage shows those counterparts
  from the first frame.
- **End:** today for a live subject. For a dissolved company or a closed registry
  sheet, the end is 6 months after the last act. Playback stops at the end. Once the
  last act has passed, *next act* becomes *skip to end*.

### The ledger

A collapsible side list (a bottom sheet on mobile) of every act in date order: date, role,
counterpart, and appointment or cessation. The act the clock last passed is highlighted,
and clicking an act moves the clock there. The ledger is what makes the animation
auditable: an analyst can check any frame against the published acts. It also serves as
the accessible, non-visual equivalent of the stage.

### Honesty markers

The stage caption lists what is partial, only when it applies:

- **Records begin in 2009** (or at the earliest loaded act): shown when the company has
  no constitution act (`has_constitution`) in the loaded history. The company existed
  before our records, so the officers already present in the first frame were not all
  appointed then.
- **Unknown start:** a term whose first act is a cessation, so it began before the loaded
  window. Drawn from the domain start as a **dotted** line, not a solid one. The ledger
  row says "appointment not in the record".
- **Inferred closure:** open terms at a company whose history contains a dissolution
  or registry-closure act (`has_dissolution`, `has_registry_closure`) end at
  that act. They are drawn with a **grey fade, not the cessation flash**, and the ledger
  row says "closed by dissolution, no published cessation". Published and inferred
  endings never look the same.
- **Truncated history:** see *Completeness*. Shown as a persistent banner, not a caption,
  because it changes what the first frames mean.

## Completeness

Both endpoints sort by `event_date` **descending**. Any cap therefore drops the **oldest**
acts, which are exactly the ones a replay starts with. That makes a silent cap worse here
than anywhere else in the app.

**Company subject:** `/bormes/v3/events?group_key=…&full_officers=1&size=500&from=N`.
- Page until the loaded count equals `total`.
- `full_officers=1` is required. Without it, `_cap_event_officers` trims the officer lists
  on events that name more than 400 people, and those acts would be lost silently.
- Always use `group_key`, never the name path. The name path leaks other companies' events.
- **Hard cap: the ES 10,000 window.** If `total > 10000`, stop there and show the banner:
  "Showing acts from {date} onwards. {n} earlier acts are not loaded."

**Officer subject:** `/bormes/v3/officer-events` has no `from` today and caps at 500.
- **Backend change (v1):** add a `from` offset to the route and to
  `build_officer_events_query`, capped by the same 10k window. The response already
  returns `events_total` and `events_returned`. It now also **echoes `from`**. The
  client pages only when the echo is present, because an older server ignores `from`
  and would return page one again. Against such a server, replay loads one page and
  shows the truncation banner.
- Page until `events_returned` sums to `events_total`.
- `filter_rows_to_officer` runs per page, so the page counts refer to acts matched
  before that filter. Compare using the event counts, not `movements.length`.

The service layer never changes the existing callers' defaults (50 and 200). Replay has
its own fetchers.

## Data model

```js
// src/utils/replay/replayModel.js — pure
ReplayModel {
  subject: { kind: 'company' | 'officer', id, name, dissolvedOn: 'YYYY-MM-DD' | null,
             hasConstitution: bool },
  counterparts: [{ id, name, kind, firstAct: 'YYYY-MM-DD' }],   // sorted by firstAct
  terms: [{                                     // one per (counterpart, role, term)
    counterpartId, role, category,              // category via positionCategories
    from: 'YYYY-MM-DD' | null,                  // null ⇔ unknownStart
    to:   'YYYY-MM-DD' | null,                  // null ⇔ still open
    endKind: 'published' | 'inferred' | null,
  }],
  acts: [{ date, counterpartId, role, kind: 'appointment' | 'cessation' | 'closure',
           sourceEventId }],                    // the ledger, date ascending
  domain: { start, end },
  completeness: { loaded, total, truncatedBefore: 'YYYY-MM-DD' | null,
                  recordsBegin: 'YYYY-MM-DD' | null },
}
```

**Building terms:** reuse `buildTimelineSpans`. It already does the sweep
(renewal-while-open, cessation-first on same-day ties, `unknownStart`).
- For an **officer** subject, pass `groupRecordsByCompany(movements)` unchanged.
- For a **company** subject, flatten each event's `officers[]` into records, group them
  **by officer** into the same `{ name, positions[] }` shape, and pass that in. The
  function groups by `name` + role and does not care which side of the link `name`
  names, so the adapter only renames `span.company` → `counterpartId`.
- Before the sweep, two cleanups run:
  - **Unmapped acts are dropped** (`classifyAct` → null). They are not passed through
    as cessations: `isAppointmentMovement` treats anything that isn't an appointment as
    an end, so an unmapped act would close a seat.
  - **Role spellings are folded per person-company pair.** Exact `roleKey` matches share
    one spelling. A cessation whose spelling was never appointed attaches to the only
    appointed seat of the same category, and to no seat when there are several (the
    rule from `roleKey.isCategoryUnambiguous`).
- **Dissolution vs extinction:** a dissolution ends the seats appointed before it, but
  not the liquidators or anyone inscribed by that same act. An extinction ends every
  seat.
- Officer identity uses the same name key the graph uses for officer nodes. Name
  variants BORME prints for one person stay separate counterparts in v1 (see *Known
  limits*).

**Inferred closure:** a post-pass over the spans. Any span with `to === null` at a company
with `dissolvedOn` gets `to = dissolvedOn, endKind = 'inferred'`. For an officer subject,
the same applies per company. Dissolution there is known only from the movements'
company, so v1 applies it only when the movement payload carries it. Otherwise the term
stays open, and the caption does not claim anything.

**State at a date:** `replayStateAt(model, date)` returns the same shape as walkthrough
`stateAt` (`nodes: Map<id, 'live'|'ghost'|'hidden'>`, `links: Map<id, 'live'|'ceased'|'hidden'>`)
plus `changedSince(prevDate)`, which lists the acts crossed since the previous frame so
the canvas can play flashes and pulses. The walkthrough's single `from`/`to` per link
cannot represent a reappointment, so replay has its own module. Unifying the two is out
of scope. It is noted under *Later*.

## Volume

- **Apoderados:** large companies grant hundreds of powers of attorney, and at full
  volume they drown the board. For a company subject, *Include apoderados* is
  **off** by default (same category rule as Simplify mode). The ledger and the activity
  strip still count them, in a lighter tone, so the hidden volume stays visible.
- **Counterpart ceiling:** above 400 drawn counterparts, rings get too dense to read.
  The dialog still plays, but it drops labels-on-change and shows a caption: "{n} people,
  showing aggregate motion".
- **Frame cost:** state is recomputed from the terms on every frame. A subject has
  at most a few thousand terms, which costs nothing at 60 fps. A from-scratch answer
  also can never drift from a scrubbed one, so there is no incremental path to test.

## Files

| File | Role |
|---|---|
| `src/utils/replay/replayModel.js` (new) | pure: `buildCompanyReplayModel(events, subject)`, `buildOfficerReplayModel(movements, subject)`; the officer-grouping adapter; inferred-closure pass; domain; honesty flags |
| `src/utils/replay/replayState.js` (new) | pure: `replayStateAt(model, date, {hiddenCategories})`, `actsBetween(model, a, b)` |
| `src/utils/replay/replayClock.js` (new) | pure: date ↔ playback-ms at a speed (`YEAR_MS = 5000`), `nextActDate`, `prevActDate` |
| `src/utils/replay/replayLayout.js` (new) | pure: deterministic ring layout ordered by `firstAct` |
| `src/services/replayHistory.js` (new) | sequential paged fetch of all company events / officer movements, with progress callback, `AbortSignal`, and the 10k cap |
| `src/components/replay/ReplayDialog.jsx` (new) | loading → stage + controls + ledger; lazy-loaded |
| `src/components/replay/ReplayCanvas.jsx` (new) | plain `<canvas>` + rAF, using `graphInk.js` tokens; no force simulation |
| `src/components/replay/ReplayControls.jsx` (new) | activity strip, scrubber, buttons |
| `src/components/replay/ReplayLedger.jsx` (new) | the act list |
| `src/components/CompanyInspectorPanel.jsx`, `OfficerInspectorBody.jsx` | the entry button |
| `src/components/SpanishCompanyNetworkGraph.jsx` | open state + `React.lazy` import only; no replay logic lands in this file |
| `ncdata-bormes-impl/borme_search_api.py`, `officer_query.py` | `from` on `/bormes/v3/officer-events` |

The canvas is plain on purpose. `react-force-graph-2d` exists to run a simulation, and
replay needs fixed positions and frame-exact control over which elements are drawn.

## Analytics

`trackEvent` with `subject_kind`, `acts_total`, `truncated`:
- `replay_open`: dialog opened.
- `replay_play`: first play press.
- `replay_scrub`: first scrubber drag in a session.
- `replay_complete`: the playhead reached the domain end.

Register the params as GA4 custom definitions **before** launch. Registration is not
retroactive.

## Motion and accessibility

- `prefers-reduced-motion`: no fades, flashes or pulses. Play steps from act to act
  at 1 act/s, and the ledger highlight carries the change.
- The ledger is the non-visual equivalent. An `aria-live="polite"` region announces the
  date and the act at each step while playing, throttled to one announcement per second.
- Mobile (<600 px): the stage fills the width, controls stack under it, and the ledger
  is a bottom sheet.

## Testing

Unit tests (vitest, node environment, alongside the modules):

- `replayModel`: reappointment after cessation gives two terms; a renewal while open
  gives one term; a same-day cese + re-appointment ends held; cessation-only gives
  `unknownStart`; dissolution closes open terms as `inferred` and leaves published
  cessations alone; two roles on one counterpart, one ending, leave the link live;
  apoderado filtering changes drawn counterparts but not the act count; `recordsBegin`
  is set when there is no constitution act.
- `replayState`: frame state matches a full `replayStateAt` at every act date
  (incremental == from scratch); `actsBetween` is inclusive/exclusive exactly once
  per act.
- `replayClock`: linear mapping (10 quiet years = 50 s at 1×, the next year
  = 5 s); `next`/`prev` act at the domain edges.
- `replayLayout`: deterministic output; ordering by `firstAct`.
- `replayHistory`: pages until `total`; stops at the 10k window and reports
  `truncatedBefore`; sends `full_officers=1` and `group_key`; aborts cleanly.
- Backend: `from` on officer-events returns the next page, and the total is unchanged.

**Live checks before calling it done:**
- A company with a known burst.
- A company with a reappointment and a dissolution.
- An officer with more than 500 acts (paging).
- MARTIN GUTIERREZ DE CABIEDES at AGENCIA EUROPA PRESS SA: consejero stays live while
  the apoderado role ends.
- Santander-scale company events (the cap path).
- Check each frame shown in a screenshot against its ledger rows.

## Known limits (v1, stated in the UI where they bite)

- Name variants of one person (e.g. with and without a second surname) are
  separate counterparts.
- Dissolution for an officer subject's companies is inferred only when the payload carries it.
- Publication date ≠ deed date. The lag is typically weeks.
- History before 2009 does not exist in our data.

## Later (not v1)

- Multi-hop replay of an expanded network.
- A single time model shared with the walkthrough timeline, with multi-term links.
- Replay export (GIF/MP4) for `/empresa` pages and reports.
- A deep link (`?replay=gk:…&t=YYYY-MM-DD`).

## Owner decisions (2026-09-18)

1. **Free for everyone**, ungated.
2. **Name:** *Reproducir historia* / *Replay history*.
