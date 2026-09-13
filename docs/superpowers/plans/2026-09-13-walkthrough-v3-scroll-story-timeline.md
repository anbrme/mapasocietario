# Walkthrough v3: scroll-driven story over a registry timeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the exported situation report into a scroll-driven story: a sticky map that renders the network as of any registry date, chapters that drive it, a moment per chapter the author can edit, tabbed annexes, and two return links back to the live app.

**Architecture:** A new pure module `registryTimeline.js` derives, from the graph's links and the profiles the walkthrough loader already fetched, the day every node and seat appeared and ceased; the export embeds that table as JSON and a vanilla script in the file re-renders the SVG's `data-state` attributes for any date. The chapters' scroll position (IntersectionObserver at mid-viewport) and a range slider both call the same `renderAt(date)`. The author's per-chapter moment lives in the existing `walkthroughEdits` overlay. The app learns a `c=<groupKey>|<name>` return link with `since` and `watch`.

**Tech Stack:** React 19, Vite 5.4, MUI, vitest (pure-logic tests only, no jsdom), vanilla JS inside the exported file (no dependencies, no network).

**Spec:** `docs/superpowers/specs/2026-09-13-walkthrough-v3-scroll-story-timeline-design.md`

## Global Constraints

- The exported file is self-contained: no external URL, no fetch, no `innerHTML`, never the sequence `</script` inside `WALKTHROUGH_SCRIPT`, JSON embedded with `<` escaped to `\\u003c`.
- The file carries no Mapa Societario wordmark; it is an authored document sourced by us.
- "Investigation report" is a banned name. The artefact is *Informe de situación* / *Situation report*.
- Every copy key exists in both ES and EN (`exportCopy.test.js` and `walkthroughCopy.test.js` enforce parity).
- Immutability: never mutate inputs; return new objects.
- Tests are pure (no DOM). The script is tested as a string: parseable, contains its hooks.
- Dates inside data are ISO days `YYYY-MM-DD`; only rendering formats them.
- Analytics names: `walkthrough_moment_set`, `sitrep_return`. Nothing fires from inside the file.
- Never use a consulting client as an example or fixture subject; fixtures use ALFA SL / BETA SL / invented names.
- Commit with `git -c commit.gpgsign=false commit`. `npm run build` rewrites tracked files (`index.html`, `public/llms.txt`, `public/robots.txt`, `public/sitemap*.xml`, `src/copy/registryScaleData.js`): discard them with `git checkout --` before committing. Never commit `dist/`.
- Ruling (spec says `gk` repeated): the app's company loader requires a name, so the return link carries `c=<groupKey>|<name>` repeated instead. `parseReturnParams` owns the format.

---

### Task 1: `registryTimeline.js` — pure timeline derivation

**Files:**
- Create: `src/utils/walkthrough/registryTimeline.js`
- Create: `src/utils/walkthrough/registryTimeline.test.js`
- Modify: `src/utils/walkthrough/index.js` (re-export)

**Interfaces:**
- Consumes: `pairKey` from `./draftWalkthrough`, `getLinkEffectiveCategory` from `../linkDirectionality`, `isActiveCategory` from `../officerLinkStatus`.
- Produces: `linkKey(link)`, `linkDates(link)`, `nodeDates(node, links, profile)`, `buildTimeline({graphData, stepData, steps, readOn})`, `stateAt(timeline, date)`, `defaultMoment(step)`, `isIsoDay(s)`.

- [ ] **Step 1: Write the failing tests**

```js
// src/utils/walkthrough/registryTimeline.test.js
import { describe, expect, it } from 'vitest';
import {
  linkKey, linkDates, nodeDates, buildTimeline, stateAt, defaultMoment, isIsoDay,
} from './registryTimeline';

const co = (id, name, extra = {}) => ({ id, type: 'spanish-company-group', name, groupKey: id, ...extra });
const off = (id, name, extra = {}) => ({ id, type: 'officer', name, ...extra });
const link = (a, b, extra = {}) => ({ source: a, target: b, ...extra });

const seat = link('o1', 'H:1', {
  id: 'o1-H:1-adm', relationship: 'Administrador', category: 'ceses_dimisiones', categoryDate: '2022-05-01', date: '2022-05-01',
  events: [{ category: 'nombramientos', date: '2019-01-10', position: 'Administrador' }, { category: 'ceses_dimisiones', date: '2022-05-01', position: 'Administrador' }],
});
const liveSeat = link('o2', 'H:1', { id: 'o2-H:1-apo', relationship: 'Apoderado', category: 'nombramientos', date: '2021-03-03' });
const undated = link('o3', 'H:2', { relationship: 'Consejero', category: 'nombramientos' });
const owns = link('H:1', 'H:2', { type: 'ownership', date: '2020-06-01' });

const graph = {
  nodes: [co('H:1', 'ALFA SL'), co('H:2', 'BETA SL', { isDissolved: true }), off('o1', 'RUIZ MARTIN LUIS'), off('o2', 'GARCIA LOPEZ ANA'), off('o3', 'ABAD SORIA CARLA')],
  links: [seat, liveSeat, undated, owns],
};
const stepData = new Map([
  ['H:1', { profile: { first_seen: '2018-11-20', last_seen: '2026-06-03', is_dissolved: false } }],
  ['H:2', { profile: { first_seen: '2015-02-02', last_seen: '2023-09-09', is_dissolved: true } }],
]);
const steps = [
  { key: 'step:H:1', nodeId: 'H:1', kind: 'company', moment: '2024-03-11', evidence: { status: { lastFiling: { date: '2026-06-03' } }, seats: [] } },
  { key: 'step:o1', nodeId: 'o1', kind: 'person', moment: null, evidence: { seats: [{ since: '', until: '2022-05-01' }, { since: '2019-01-10', until: '' }] } },
];

describe('isIsoDay', () => {
  it('accepts YYYY-MM-DD only', () => {
    expect(isIsoDay('2024-03-11')).toBe(true);
    expect(isIsoDay('2024-3-1')).toBe(false);
    expect(isIsoDay('2024-03-11T00:00:00Z')).toBe(false);
    expect(isIsoDay(null)).toBe(false);
  });
});

describe('linkKey', () => {
  it('uses the link id when present, else pair + folded role', () => {
    expect(linkKey(seat)).toBe('o1-H:1-adm');
    expect(linkKey(undated)).toBe('H:2|o3|consejero');
  });
});

describe('linkDates', () => {
  it('a seat with an appointment event and a later cessation: from the appointment, to the cessation', () => {
    expect(linkDates(seat)).toEqual({ from: '2019-01-10', to: '2022-05-01' });
  });
  it('an active seat without events starts at its date and never ends', () => {
    expect(linkDates(liveSeat)).toEqual({ from: '2021-03-03', to: null });
  });
  it('a ceased seat without events: its date is the cessation, the appointment is unknown', () => {
    expect(linkDates(link('a', 'b', { category: 'ceses_dimisiones', date: '2020-01-01' }))).toEqual({ from: null, to: '2020-01-01' });
  });
  it('an undated link has neither', () => {
    expect(linkDates(undated)).toEqual({ from: null, to: null });
  });
  it('an ownership link starts at its date; a lost one ends there', () => {
    expect(linkDates(owns)).toEqual({ from: '2020-06-01', to: null });
    expect(linkDates({ ...owns, lost: true })).toEqual({ from: '2020-06-01', to: '2020-06-01' });
  });
});

describe('nodeDates', () => {
  it('a company takes the profile first/last filing and ghosts only when dissolved', () => {
    expect(nodeDates(graph.nodes[1], graph.links, stepData.get('H:2').profile)).toEqual({ from: '2015-02-02', to: '2023-09-09', dissolved: true });
    expect(nodeDates(graph.nodes[0], graph.links, stepData.get('H:1').profile)).toEqual({ from: '2018-11-20', to: null, dissolved: false });
  });
  it('a company without a profile starts at its earliest link and is never ghosted', () => {
    expect(nodeDates(graph.nodes[1], graph.links, null)).toEqual({ from: '2020-06-01', to: null, dissolved: true });
  });
  it('a person carries no dates of their own', () => {
    expect(nodeDates(graph.nodes[2], graph.links, null)).toEqual({ from: null, to: null, dissolved: false });
  });
});

describe('buildTimeline', () => {
  const tl = buildTimeline({ graphData: graph, stepData, steps, readOn: '2026-09-13T10:00:00.000Z' });
  it('collects a sorted, distinct date domain ending at readOn, including chapter moments', () => {
    expect(tl.dates).toEqual(['2015-02-02', '2018-11-20', '2019-01-10', '2020-06-01', '2021-03-03', '2022-05-01', '2023-09-09', '2024-03-11', '2026-09-13']);
    expect(tl.readOn).toBe('2026-09-13');
  });
  it('keys links by linkKey and counts the undated ones', () => {
    expect(Object.keys(tl.links)).toEqual(['o1-H:1-adm', 'o2-H:1-apo', 'H:2|o3|consejero', 'H:1|H:2|']);
    expect(tl.links['o1-H:1-adm']).toEqual({ a: 'o1', b: 'H:1', from: '2019-01-10', to: '2022-05-01' });
    expect(tl.undated).toBe(1);
  });
  it('does not mutate its inputs', () => {
    const before = JSON.stringify(graph);
    buildTimeline({ graphData: graph, stepData, steps, readOn: '2026-09-13' });
    expect(JSON.stringify(graph)).toBe(before);
  });
  it('tolerates missing inputs', () => {
    expect(buildTimeline({ graphData: null, stepData: null, steps: null, readOn: null }).dates.length).toBeGreaterThan(0);
  });
});

describe('stateAt', () => {
  const tl = buildTimeline({ graphData: graph, stepData, steps, readOn: '2026-09-13' });
  it('a seat is hidden before, live between, ceased after', () => {
    expect(stateAt(tl, '2018-12-31').links.get('o1-H:1-adm')).toBe('hidden');
    expect(stateAt(tl, '2020-01-01').links.get('o1-H:1-adm')).toBe('live');
    expect(stateAt(tl, '2022-05-01').links.get('o1-H:1-adm')).toBe('ceased');
  });
  it('an undated link is live at every date', () => {
    expect(stateAt(tl, '2000-01-01').links.get('H:2|o3|consejero')).toBe('live');
  });
  it('a dissolved company is live before and a ghost from its last filing; its seats read ceased then', () => {
    expect(stateAt(tl, '2020-01-01').nodes.get('H:2')).toBe('live');
    expect(stateAt(tl, '2023-09-09').nodes.get('H:2')).toBe('ghost');
    expect(stateAt(tl, '2023-09-09').links.get('H:2|o3|consejero')).toBe('ceased');
  });
  it('a company is hidden before its first filing', () => {
    expect(stateAt(tl, '2015-01-01').nodes.get('H:2')).toBe('hidden');
  });
  it('a person follows their seats: hidden before any, live while one is live, ghost when all ceased', () => {
    expect(stateAt(tl, '2018-12-31').nodes.get('o1')).toBe('hidden');
    expect(stateAt(tl, '2020-01-01').nodes.get('o1')).toBe('live');
    expect(stateAt(tl, '2023-01-01').nodes.get('o1')).toBe('ghost');
  });
});

describe('defaultMoment', () => {
  it('company: the last filing date', () => {
    expect(defaultMoment(steps[0])).toBe('2026-06-03');
  });
  it('person: the latest seat date', () => {
    expect(defaultMoment(steps[1])).toBe('2022-05-01');
  });
  it('nothing dated: null', () => {
    expect(defaultMoment({ kind: 'company', evidence: { status: {} } })).toBeNull();
    expect(defaultMoment({ kind: 'person', evidence: { seats: [] } })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/walkthrough/registryTimeline.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

```js
// src/utils/walkthrough/registryTimeline.js
// When did each node and each seat of the visible graph exist, according to
// the registry? Pure: derived from the graph's links (role-filtered events,
// categoryDate, date) and the v3 profiles the walkthrough loader already
// fetched. The exported file embeds the result and re-renders the map for
// any date with `stateAt`'s rule; the script inlines the same rule.
import { pairKey } from './draftWalkthrough';
import { getLinkEffectiveCategory } from '../linkDirectionality';
import { isActiveCategory } from '../officerLinkStatus';

const nid = id => (id == null ? '' : String(id));
const refId = ref => (ref && typeof ref === 'object' ? ref.id : ref);
const isCompany = n => !!n && (n.type === 'company' || n.type === 'spanish-company-group');
const day = v => {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

export const isIsoDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const roleKey = l => String(l?.relationship || l?.category || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const isOwnership = l => l?.type === 'ownership' || String(l?.category || '').toLowerCase().startsWith('socio');

/** Stable key for one drawn line: the link id when the graph gave it one. */
export const linkKey = l => {
  const id = nid(l?.id);
  if (id) return id;
  return `${pairKey(refId(l?.source), refId(l?.target))}|${roleKey(l)}`;
};

/** @returns {{from: string|null, to: string|null}} ISO days, null = unknown */
export const linkDates = l => {
  if (!l) return { from: null, to: null };
  if (isOwnership(l)) {
    const d = day(l.date) || null;
    return { from: d, to: l.lost ? d : null };
  }
  const events = Array.isArray(l.events) ? l.events : [];
  const appts = events.filter(e => isActiveCategory(e?.category)).map(e => day(e?.date)).filter(Boolean).sort();
  const ceses = events.filter(e => e?.category && !isActiveCategory(e.category)).map(e => day(e?.date)).filter(Boolean).sort();
  const ceased = !isActiveCategory(getLinkEffectiveCategory(l) || l.category);
  const from = appts[0] || (ceased ? '' : day(l.date)) || null;
  const to = ceased ? (day(l.categoryDate) || ceses[ceses.length - 1] || day(l.date) || null) : null;
  return { from, to };
};

const touches = (l, id) => nid(refId(l?.source)) === id || nid(refId(l?.target)) === id;

/** Company: profile first/last filing, else its links' earliest date. Persons: nothing. */
export const nodeDates = (node, links, profile) => {
  if (!isCompany(node)) return { from: null, to: null, dissolved: false };
  const id = nid(node.id);
  const dissolved = !!(profile?.is_dissolved || node.isDissolved);
  const own = (links || []).filter(l => touches(l, id)).map(linkDates);
  const earliest = own.map(d => d.from).filter(Boolean).sort()[0] || null;
  const last = day(profile?.last_seen) || null;
  return {
    from: day(profile?.first_seen) || earliest,
    to: dissolved && last ? last : null,
    dissolved,
  };
};

const latestOf = list => list.filter(Boolean).sort().slice(-1)[0] || null;

/** The chapter's default date: company → last filing; person → latest seat date. */
export const defaultMoment = step => {
  if (!step) return null;
  if (step.kind === 'person') {
    const seats = step.evidence?.seats || [];
    return latestOf(seats.flatMap(s => [day(s.since), day(s.until)]));
  }
  return day(step.evidence?.status?.lastFiling?.date) || null;
};

/**
 * @param {{ graphData: object, stepData: Map<string, {profile?: object}|null>, steps: Array<object>, readOn: string }} args
 * @returns {{ dates: string[], nodes: object, links: object, undated: number, readOn: string }}
 */
export const buildTimeline = ({ graphData, stepData, steps, readOn }) => {
  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];
  const data = stepData instanceof Map ? stepData : new Map();
  const read = day(readOn) || new Date().toISOString().slice(0, 10);

  const nodeTable = {};
  nodes.forEach(n => {
    nodeTable[nid(n.id)] = nodeDates(n, links, data.get(nid(n.id))?.profile || null);
  });

  const linkTable = {};
  let undated = 0;
  links.forEach(l => {
    const d = linkDates(l);
    if (!d.from && !d.to) undated += 1;
    linkTable[linkKey(l)] = { a: nid(refId(l.source)), b: nid(refId(l.target)), from: d.from, to: d.to };
  });

  const moments = (steps || []).map(s => day(s?.moment)).filter(Boolean);
  const all = [
    ...Object.values(nodeTable).flatMap(d => [d.from, d.to]),
    ...Object.values(linkTable).flatMap(d => [d.from, d.to]),
    ...moments,
    read,
  ].filter(Boolean);
  const dates = [...new Set(all)].sort();

  return { dates, nodes: nodeTable, links: linkTable, undated, readOn: read };
};

const linkState = (d, date) => {
  if (d.from && date < d.from) return 'hidden';
  if (d.to && date >= d.to) return 'ceased';
  return 'live';
};
const companyState = (d, date) => {
  if (d.from && date < d.from) return 'hidden';
  if (d.to && date >= d.to) return 'ghost';
  return 'live';
};

/**
 * The map as of one day. Persons follow their seats; a ghost company's seats read ceased.
 * @returns {{ nodes: Map<string, 'live'|'ghost'|'hidden'>, links: Map<string, 'live'|'ceased'|'hidden'> }}
 */
export const stateAt = (timeline, date) => {
  const nodesOut = new Map();
  const linksOut = new Map();
  const nodeTable = timeline?.nodes || {};
  const linkTable = timeline?.links || {};
  const isDatedCompany = d => d.from !== null || d.to !== null || d.dissolved;

  Object.entries(nodeTable).forEach(([id, d]) => {
    if (isDatedCompany(d)) nodesOut.set(id, companyState(d, date));
  });
  Object.entries(linkTable).forEach(([key, d]) => {
    let st = linkState(d, date);
    if (st !== 'hidden' && (nodesOut.get(d.a) === 'ghost' || nodesOut.get(d.b) === 'ghost')) st = 'ceased';
    linksOut.set(key, st);
  });
  Object.keys(nodeTable).forEach(id => {
    if (nodesOut.has(id)) return;
    const states = Object.entries(linkTable).filter(([, d]) => d.a === id || d.b === id).map(([k]) => linksOut.get(k));
    if (states.length === 0 || states.includes('live')) { nodesOut.set(id, 'live'); return; }
    nodesOut.set(id, states.includes('ceased') ? 'ghost' : 'hidden');
  });
  return { nodes: nodesOut, links: linksOut };
};
```


Note for the H:2-without-profile test: `nodeDates` returns `dissolved: true` from `node.isDissolved` but `to: null`, so the company is dated (from its links) and never ghosted.

Add to `src/utils/walkthrough/index.js`:

```js
export { buildTimeline, stateAt, linkKey, linkDates, nodeDates, defaultMoment, isIsoDay } from './registryTimeline';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/walkthrough/registryTimeline.test.js`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/utils/walkthrough/registryTimeline.js src/utils/walkthrough/registryTimeline.test.js src/utils/walkthrough/index.js
git -c commit.gpgsign=false commit -m "feat(walkthrough): pure registry timeline — when each node and seat existed"
```

---

### Task 2: Moments in the draft, the overlay, the evidence and the copy

**Files:**
- Modify: `src/utils/walkthrough/draftWalkthrough.js` (steps carry `moment`)
- Modify: `src/utils/walkthrough/applyWalkthroughEdits.js` (`moments`, `setStepMoment`)
- Modify: `src/utils/walkthrough/stepEvidence.js` (`firstSeen`, `lastSeen` on company evidence)
- Modify: `src/utils/walkthrough/walkthroughCopy.js` (`momentLabel`)
- Modify: `src/utils/walkthrough/index.js`
- Test: `src/utils/walkthrough/applyWalkthroughEdits.test.js`, `src/utils/walkthrough/draftWalkthrough.test.js`, `src/utils/walkthrough/walkthroughCopy.test.js`

**Interfaces:**
- Consumes: `defaultMoment`, `isIsoDay` (Task 1).
- Produces: `step.moment: 'YYYY-MM-DD'|null` on every drafted step; `edits.moments: {[key]: 'YYYY-MM-DD'}`; `setStepMoment(edits, key, iso)`; `EMPTY_WALKTHROUGH_EDITS.moments = {}`; `wt.momentLabel`.

- [ ] **Step 1: Write the failing tests**

Append to `applyWalkthroughEdits.test.js`:

```js
import { setStepMoment } from './applyWalkthroughEdits';

describe('moments', () => {
  it('EMPTY carries an empty moments map', () => {
    expect(EMPTY_WALKTHROUGH_EDITS.moments).toEqual({});
  });
  it('normalises moments to ISO days only', () => {
    expect(normalizeWalkthroughEdits({ moments: { a: '2024-03-11', b: 'nope', c: 3 } }).moments).toEqual({ a: '2024-03-11' });
    expect(normalizeWalkthroughEdits({ moments: [] }).moments).toEqual({});
  });
  it('an overlay moment wins over the draft moment; a step without one is left untouched', () => {
    const d = [s('a', { moment: '2020-01-01' }), s('b')];
    const out = applyWalkthroughEdits(d, { ...EMPTY_WALKTHROUGH_EDITS, moments: { a: '2024-03-11' } });
    expect(out[0].moment).toBe('2024-03-11');
    expect(out[1]).toEqual(d[1]);
  });
  it('setStepMoment stores a valid day and clears on empty or invalid', () => {
    const e1 = setStepMoment(EMPTY_WALKTHROUGH_EDITS, 'a', '2024-03-11');
    expect(e1.moments).toEqual({ a: '2024-03-11' });
    expect(setStepMoment(e1, 'a', '').moments).toEqual({});
    expect(setStepMoment(e1, 'a', '2024-3-1').moments).toEqual({});
    expect(EMPTY_WALKTHROUGH_EDITS.moments).toEqual({});
  });
});
```

Append to `draftWalkthrough.test.js` (inside the existing `describe('draftWalkthrough'` or a new one, reusing the file's `graph`, `scope`, `profile`, `events`, `findings` fixtures):

```js
describe('moments', () => {
  it('a company step defaults to its last filing; a person step to the latest seat date; graph-only company to null', () => {
    const stepData = new Map([['H:1', { profile, events, findings }]]);
    const steps = draftWalkthrough({ graphData: graph, scope, stepData, selection: ['H:1', 'o1', 'H:2'], lang: 'es' });
    expect(steps[0].moment).toBe('2026-06-03');
    expect(typeof steps[1].moment === 'string' || steps[1].moment === null).toBe(true);
    expect(steps[2].moment).toBeNull();
  });
});
```

Append to `walkthroughCopy.test.js`:

```js
it('labels the moment field in both languages', () => {
  expect(walkthroughCopy('es').momentLabel).toBe('Momento');
  expect(walkthroughCopy('en').momentLabel).toBe('Moment');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/walkthrough`
Expected: FAIL on the new cases only.

- [ ] **Step 3: Implement**

`applyWalkthroughEdits.js`:

```js
import { isIsoDay } from './registryTimeline';

export const EMPTY_WALKTHROUGH_EDITS = Object.freeze({ hidden: [], order: [], notes: {}, moments: {} });

// inside normalizeWalkthroughEdits, after `notes`:
  const moments = raw.moments && typeof raw.moments === 'object' && !Array.isArray(raw.moments)
    ? Object.fromEntries(Object.entries(raw.moments).filter(([, v]) => isIsoDay(v)))
    : {};
  return { hidden: strings(raw.hidden), order: strings(raw.order), notes, moments };

// applyWalkthroughEdits: replace the final map with
  return [...ordered, ...rest].map(s => {
    const withNote = Object.prototype.hasOwnProperty.call(e.notes, s.key)
      ? { ...s, authorNote: { text: e.notes[s.key], flag: null, origin: 'step' } }
      : s;
    return Object.prototype.hasOwnProperty.call(e.moments, s.key)
      ? { ...withNote, moment: e.moments[s.key] }
      : withNote;
  });

export const setStepMoment = (edits, key, iso) => {
  const e = normalizeWalkthroughEdits(edits);
  const moments = { ...e.moments };
  if (isIsoDay(iso)) moments[key] = iso; else delete moments[key];
  return { ...e, moments };
};
```

`stepEvidence.js` — in `companyEvidence`'s returned object add:

```js
    firstSeen: day(profile?.first_seen) || null,
    lastSeen: day(profile?.last_seen) || null,
```

`draftWalkthrough.js` — import `defaultMoment` from `./registryTimeline` (no cycle: registryTimeline imports only `pairKey`, which is a leaf; if vitest reports a circular import, move `pairKey` to a new `src/utils/walkthrough/pairKey.js` and re-export it from `draftWalkthrough.js`). In `companyStep` and `personStep`, build the object, then add `moment`:

```js
const withMoment = step => ({ ...step, moment: defaultMoment(step) });
// companyStep: return withMoment({ ...base(...), evidence, summary, text, source, nodeIds, linkKeys });
// personStep:  return withMoment({ ...base(...), evidence: { seats }, summary, text, source: 'graph', nodeIds, linkKeys });
```

`walkthroughCopy.js`: add `momentLabel: 'Momento'` to ES and `momentLabel: 'Moment'` to EN.

`index.js`: export `setStepMoment` alongside the other edit helpers.

- [ ] **Step 4: Run the whole walkthrough suite**

Run: `npx vitest run src/utils/walkthrough`
Expected: PASS. If `returns the draft untouched for empty edits` fails, the overlay is adding `moment` to steps that have no overlay entry — fix the overlay, not the test.

- [ ] **Step 5: Commit**

```bash
git add src/utils/walkthrough
git -c commit.gpgsign=false commit -m "feat(walkthrough): a moment per step — default from the registry, author-overridable in the edits overlay"
```

---

### Task 3: Hook, modal date field, player chip, document model

**Files:**
- Modify: `src/hooks/useWalkthrough.js` (`setMoment`, reset clears moments)
- Modify: `src/components/RelationshipReportModal.jsx` (date field per step)
- Modify: `src/components/WalkthroughPlayer.jsx` (moment chip)
- Modify: `src/utils/investigationDoc.js` (`timeline` pass-through; `companies[].groupKey`)
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` (build the timeline into `relDoc`)
- Test: `src/utils/investigationDoc.test.js` (exists? if not, create with the two cases below)

**Interfaces:**
- Consumes: `setStepMoment`, `buildTimeline` (Tasks 1–2); `walkthrough.stepData` (Map) from the hook.
- Produces: `walkthrough.setMoment(key, iso)`; `doc.timeline`; `doc.companies[].groupKey`.

- [ ] **Step 1: Write the failing tests** (`src/utils/investigationDoc.test.js`, add or create):

```js
import { describe, expect, it } from 'vitest';
import { buildInvestigationDoc } from './investigationDoc';

const graphData = { nodes: [{ id: 'H:1', type: 'spanish-company-group', name: 'ALFA SL', groupKey: 'gk-alfa' }], links: [] };
const scope = { companyNodes: [{ nodeId: 'H:1', name: 'ALFA SL' }], connectors: [], ownership: [], counts: { companies: 1, officers: 0, sharedPeople: 0 } };

describe('buildInvestigationDoc v3 fields', () => {
  it('copies the timeline and stamps each company with its group key', () => {
    const timeline = { dates: ['2026-09-13'], nodes: {}, links: {}, undated: 0, readOn: '2026-09-13' };
    const doc = buildInvestigationDoc({ graphData, scope, timeline });
    expect(doc.timeline).toEqual(timeline);
    expect(doc.timeline).not.toBe(timeline);
    expect(doc.companies[0].groupKey).toBe('gk-alfa');
  });
  it('a missing timeline is null, a company without a key gets null', () => {
    const doc = buildInvestigationDoc({ graphData: { nodes: [], links: [] }, scope });
    expect(doc.timeline).toBeNull();
    expect(doc.companies[0].groupKey).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/utils/investigationDoc.test.js` → FAIL.

- [ ] **Step 3: Implement**

`investigationDoc.js`: add `timeline = null` to the parameters; build `const nodeById = new Map((graphData?.nodes || []).map(n => [normalizeNodeId(n.id), n]));` and in `companies` add `groupKey: nodeById.get(normalizeNodeId(c.nodeId))?.groupKey || null`; in the returned object add `timeline: timeline && typeof timeline === 'object' ? JSON.parse(JSON.stringify(timeline)) : null`.

`useWalkthrough.js`: import `setStepMoment` from `../utils/walkthrough`; add

```js
  const setMoment = useCallback((key, iso) => {
    setEdits(e => setStepMoment(e, key, iso));
    onTrack?.('walkthrough_moment_set');
  }, [setEdits, onTrack]);
```

change `reset` to write `{ hidden: [], order: [], notes: {}, moments: {} }`, and return `setMoment`.

`RelationshipReportModal.jsx`: under the `StepNoteField` of each step row add

```jsx
                  <TextField
                    size="small" type="date" label={wt.momentLabel}
                    value={s.moment || ''}
                    onChange={e => walkthrough.setMoment(s.key, e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ mt: 1, width: 190 }}
                  />
```

`WalkthroughPlayer.jsx`: after the sources `Chip` add `{step.moment && <Chip size="small" label={step.moment} sx={{ height: 20, fontSize: '0.7rem' }} />}`.

`SpanishCompanyNetworkGraph.jsx`: import `buildTimeline` from `../utils/walkthrough`; in the `relDoc` memo pass

```js
      timeline: buildTimeline({
        graphData: filteredGraphData, stepData: walkthrough.stepData, steps: walkthrough.steps,
        readOn: relGeneratedAt || new Date().toISOString(),
      }),
```

and add `walkthrough.stepData` to the memo's dependency list.

- [ ] **Step 4: Run tests and lint** — `npx vitest run src/utils src/hooks && npx eslint src/hooks/useWalkthrough.js src/components/RelationshipReportModal.jsx src/components/WalkthroughPlayer.jsx src/utils/investigationDoc.js` → PASS, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useWalkthrough.js src/components/RelationshipReportModal.jsx src/components/WalkthroughPlayer.jsx src/utils/investigationDoc.js src/utils/investigationDoc.test.js src/components/SpanishCompanyNetworkGraph.jsx
git -c commit.gpgsign=false commit -m "feat(walkthrough): edit a step's moment in the modal; the document carries the timeline"
```

---

### Task 4: Export copy and SVG link keys

**Files:**
- Modify: `src/utils/investigationExport/exportCopy.js`
- Modify: `src/utils/investigationExport/renderGraphSvg.js` (`data-key`)
- Test: `src/utils/investigationExport/exportCopy.test.js`, `src/utils/investigationExport/renderGraphSvg.test.js`

**Interfaces:**
- Consumes: `linkKey` (Task 1).
- Produces: copy keys `registryAsOf(d)`, `undated(n)`, `dissolvedProxy`, `returnLink(d)`, `watchLink`, `explorer`, `momentLabel`; every `<line class="l">` carries `data-key`.

- [ ] **Step 1: Write the failing tests**

`exportCopy.test.js`:

```js
  it('carries the v3 story keys in both languages', () => {
    ['es', 'en'].forEach(lang => {
      const c = exportCopy(lang);
      expect(c.registryAsOf('2024-03-11')).toContain('2024-03-11');
      expect(c.undated(3)).toContain('3');
      expect(typeof c.dissolvedProxy).toBe('string');
      expect(c.returnLink('13 de septiembre de 2026')).toContain('2026');
      expect(typeof c.watchLink).toBe('string');
      expect(typeof c.explorer).toBe('string');
    });
    expect(exportCopy('es').explorer).toBe('Explorar la evidencia');
    expect(exportCopy('en').explorer).toBe('Explore the evidence');
  });
```

`renderGraphSvg.test.js`:

```js
  it('stamps every line with the timeline link key', () => {
    const svg = renderGraphSvg({
      nodes: [{ id: 'a', type: 'officer', name: 'A', x: 0, y: 0 }, { id: 'b', type: 'company', name: 'B', x: 10, y: 10 }],
      links: [{ id: 'a-b-adm', source: 'a', target: 'b' }, { source: 'a', target: 'b', relationship: 'Apoderado' }],
    });
    expect(svg).toContain('data-key="a-b-adm"');
    expect(svg).toContain('data-key="a|b|apoderado"');
  });
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/utils/investigationExport/exportCopy.test.js src/utils/investigationExport/renderGraphSvg.test.js` → FAIL.

- [ ] **Step 3: Implement**

`exportCopy.js` — add to ES:

```js
  registryAsOf: d => `Estado del registro el ${d}`,
  undated: n => `${n} vínculo${n === 1 ? '' : 's'} sin fecha, siempre visible${n === 1 ? '' : 's'}`,
  dissolvedProxy: 'Disuelta · según su último acto',
  returnLink: d => `Ver esta red en Mapa Societario, con los cambios desde el ${d}`,
  watchLink: 'Avísame si alguna de estas empresas cambia',
  explorer: 'Explorar la evidencia',
  momentLabel: 'Momento',
```

and to EN:

```js
  registryAsOf: d => `Registry as of ${d}`,
  undated: n => `${n} undated link${n === 1 ? '' : 's'}, always shown`,
  dissolvedProxy: 'Dissolved · as of its last filing',
  returnLink: d => `See this network on Mapa Societario, with changes since ${d}`,
  watchLink: 'Alert me when any of these companies changes',
  explorer: 'Explore the evidence',
  momentLabel: 'Moment',
```

`renderGraphSvg.js`: `import { linkKey } from '../walkthrough/registryTimeline';` and in the line template add ` data-key="${escapeHtml(linkKey(l))}"` after `class="l"`.

- [ ] **Step 4: Run** — same command → PASS; also `npx vitest run src/utils/investigationExport` must stay green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/investigationExport/exportCopy.js src/utils/investigationExport/exportCopy.test.js src/utils/investigationExport/renderGraphSvg.js src/utils/investigationExport/renderGraphSvg.test.js
git -c commit.gpgsign=false commit -m "feat(export): v3 story copy; every drawn link carries its timeline key"
```

---

### Task 5: The story section, the annex explorer, the return links, the embedded timeline

**Files:**
- Modify: `src/utils/investigationExport/documentSections.js` (`renderStory`, chapter `data-i`/`data-moment` + moment in head, `renderAnnexes` tabs, footer links)
- Modify: `src/utils/investigationExport/buildExportHtml.js` (use `renderStory`; embed `timeline`, `lang`, `steps[].moment`)
- Modify: `src/utils/investigationExport/documentStyle.js`
- Test: `documentSections.test.js`, `buildExportHtml.test.js`, `documentStyle.test.js`

**Interfaces:**
- Consumes: `doc.timeline`, `doc.steps[].moment`, `doc.companies[].groupKey`, copy from Task 4.
- Produces: markup ids the script (Task 6) binds: `#story`, `#graph`, `#walkthrough`, `.chapter[data-i][data-moment]`, `#wt-time`, `#wt-slider`, `#wt-ticks`, `#wt-date`, `#wt-undated`, `#wt-panel` (unchanged ids inside), `.annex-tabs [role=tab][aria-controls]`, `.annex-panel[role=tabpanel]`; `window.__SITREP__ = { steps, opening, noteLabel, timeline, lang }`.

- [ ] **Step 1: Write the failing tests**

`documentSections.test.js` — add (reuse the file's `companyStep`, `t`, `wt` helpers; import `renderStory`):

```js
describe('renderStory', () => {
  const graphData = { nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 0, y: 0 }], links: [] };
  const timeline = { dates: ['2024-03-11', '2026-09-13'], nodes: {}, links: {}, undated: 2, readOn: '2026-09-13' };
  const doc = { steps: [companyStep('c1', { moment: '2024-03-11' })], counts: {}, timeline };

  it('renders the grid with the map pane and the chapters once each', () => {
    const html = renderStory(doc, graphData, t, wt);
    expect(html.match(/id="story"/g)).toHaveLength(1);
    expect(html.match(/id="graph"/g)).toHaveLength(1);
    expect(html.match(/id="walkthrough"/g)).toHaveLength(1);
    expect(html.match(/<svg id="map"/g)).toHaveLength(1);
  });
  it('chapters carry their index and moment, and show the moment in the head', () => {
    const html = renderStory(doc, graphData, t, wt);
    expect(html).toContain('data-i="0"');
    expect(html).toContain('data-moment="2024-03-11"');
    expect(html).toContain('11 de marzo de 2024');
  });
  it('renders the slider with one tick per chapter moment and the undated caption', () => {
    const html = renderStory(doc, graphData, t, wt);
    expect(html).toContain('id="wt-slider"');
    expect(html).toContain('max="1"');
    expect(html).toContain('<option value="0"');
    expect(html).toContain(t.undated(2));
  });
  it('omits the slider when the domain has fewer than two dates', () => {
    const html = renderStory({ ...doc, timeline: { ...timeline, dates: ['2026-09-13'] } }, graphData, t, wt);
    expect(html).not.toContain('id="wt-slider"');
  });
  it('renders only the map pane when there are no steps', () => {
    const html = renderStory({ steps: [], counts: {}, timeline }, graphData, t, wt);
    expect(html).toContain('id="graph"');
    expect(html).not.toContain('id="walkthrough"');
  });
});

describe('renderAnnexes explorer', () => {
  const base = { steps: [], companies: [{ nodeId: 'x', name: 'GAMMA SL', note: null }], connectors: [{ nodeId: 'p', name: 'PEREZ RUIZ JUAN', type: 'individual', companies: ['GAMMA SL'], roles: ['Apoderado'], status: 'active' }], ownership: [], corrections: [] };
  it('wraps two or more non-empty annexes in a tab strip, first selected, every panel present', () => {
    const html = renderAnnexes(base, t);
    expect(html).toContain(t.explorer);
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toContain('aria-selected="true"');
    expect(html.match(/role="tabpanel"/g)).toHaveLength(2);
    expect(html).toContain('id="companies"');
    expect(html).toContain('id="connections"');
  });
  it('renders no tab strip when only one annex has rows', () => {
    const html = renderAnnexes({ ...base, connectors: [] }, t);
    expect(html).not.toContain('role="tab"');
    expect(html).toContain('id="companies"');
  });
});

describe('renderFooter return links', () => {
  const docWithKeys = { generatedAt: '2026-09-13T10:00:00.000Z', companies: [{ nodeId: 'a', name: 'ALFA SL', groupKey: 'gk-a', note: null }, { nodeId: 'b', name: 'BETA SL', groupKey: null, note: null }], coverage: null };
  it('links back with one c= per keyed company, since and source', () => {
    const html = renderFooter(docWithKeys, t, 'es');
    expect(html).toContain('c=gk-a%7CALFA+SL');
    expect(html).not.toContain('BETA');
    expect(html).toContain('since=2026-09-13');
    expect(html).toContain('source=sitrep');
    expect(html).toContain('watch=1');
    expect(html).toContain(t.watchLink);
  });
  it('renders no return links when no company has a key', () => {
    const html = renderFooter({ ...docWithKeys, companies: [docWithKeys.companies[1]] }, t, 'es');
    expect(html).not.toContain('since=');
    expect(html).not.toContain(t.watchLink);
  });
});
```

`buildExportHtml.test.js`:

```js
  it('embeds the timeline and the language, with < escaped, and the chapter moment', () => {
    const html = buildExportHtml({ ...doc, timeline: { dates: ['2026-09-12'], nodes: {}, links: {}, undated: 0, readOn: '2026-09-12', evil: '</script>' }, steps: [{ ...doc.steps[0], moment: '2024-03-11' }] }, graphData, { lang: 'es' });
    expect(html).toContain('"timeline":{');
    expect(html).toContain('"lang":"es"');
    expect(html).toContain('"moment":"2024-03-11"');
    expect(html).not.toContain('</script>"');
    expect(html).toContain('id="story"');
  });
```

`documentStyle.test.js`:

```js
  it('lays the story out as a sticky pane beside the chapters, animates, respects reduced motion, stacks annex tabs in print', () => {
    expect(DOCUMENT_STYLE).toContain('.story{display:grid');
    expect(DOCUMENT_STYLE).toContain('position:sticky');
    expect(DOCUMENT_STYLE).toContain('#viewport{transition:transform');
    expect(DOCUMENT_STYLE).toContain('prefers-reduced-motion');
    expect(DOCUMENT_STYLE).toContain('[data-state="hidden"]');
    expect(DOCUMENT_STYLE).toContain('[data-state="ceased"]');
    expect(DOCUMENT_STYLE).toContain('[data-state="ghost"]');
    expect(DOCUMENT_STYLE).toMatch(/@media print\{[\s\S]*\.annex-panel\[hidden\]\{display:block!important\}/);
    expect(DOCUMENT_STYLE).toMatch(/@media print\{[\s\S]*\.story\{display:block\}/);
  });
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/utils/investigationExport` → FAIL on the new cases.

- [ ] **Step 3: Implement `documentSections.js`**

Add a day formatter next to `fmtDate` (noon avoids the UTC-midnight day shift):

```js
const fmtDay = (iso, lang) => (iso ? fmtDate(`${iso}T12:00:00`, lang) : '');
```

`renderMapFigure(doc, graphData, t, lang)` keeps its output but (a) drops the `wt-start` controls block (the story starts on scroll; keep the id-free `.wt-controls` out entirely), (b) renders the panel always when steps exist (not `hidden` — the opening block fills it before any chapter enters), and (c) appends, after `</figure>` and before the panel, the time control when `doc.timeline?.dates?.length >= 2`:

```js
const renderTimeControl = (doc, t, lang) => {
  const tl = doc.timeline;
  if (!tl || !Array.isArray(tl.dates) || tl.dates.length < 2) return '';
  const idx = new Map(tl.dates.map((d, i) => [d, i]));
  const ticks = (doc.steps || []).map(s => s.moment).filter(m => idx.has(m))
    .map(m => `<option value="${idx.get(m)}"></option>`).join('');
  const undated = tl.undated > 0 ? `<span id="wt-undated">${esc(t.undated(tl.undated))}</span>` : '<span id="wt-undated"></span>';
  return `<div id="wt-time" class="hide-print">
    <input type="range" id="wt-slider" min="0" max="${tl.dates.length - 1}" step="1" value="${tl.dates.length - 1}" list="wt-ticks" aria-label="${esc(t.registryAsOf(''))}">
    <datalist id="wt-ticks">${ticks}</datalist>
    <div class="meta"><span id="wt-date">${esc(t.registryAsOf(fmtDay(tl.readOn, lang)))}</span> · ${undated}</div>
  </div>`;
};
```

`renderChapters(doc, t, wt, lang)`: the chapter div becomes `<div class="chapter" id="ch-${i}" data-i="${i}" data-moment="${esc(s.moment || '')}">`, and the head appends `${s.moment ? ` · ${esc(fmtDay(s.moment, lang))}` : ''}` after the kind label. The number button keeps `onclick="__sitrepShow(${i})"`.

New export:

```js
export const renderStory = (doc, graphData, t, wt, lang = 'es') => {
  const hasSteps = (doc.steps || []).length > 0;
  return `<div id="story" class="story${hasSteps ? '' : ' solo'}">${renderMapFigure(doc, graphData, t, lang)}${hasSteps ? renderChapters(doc, t, wt, lang) : ''}</div>`;
};
```

`renderAnnexes`: build the four `annex(...)` strings as today into an array of `{ id, title, html }` with empty ones removed. If fewer than two remain, output exactly today's markup. Otherwise:

```js
  const strip = `<div class="annex-tabs" role="tablist" aria-label="${esc(t.explorer)}">${
    panels.map((p, i) => `<button type="button" role="tab" id="tab-${p.id}" aria-controls="${p.id}" aria-selected="${i === 0 ? 'true' : 'false'}" tabindex="${i === 0 ? 0 : -1}">${esc(p.title)}</button>`).join('')}</div>`;
  const body = panels.map((p, i) => `<div class="annex-panel" role="tabpanel" id="${p.id}" aria-labelledby="tab-${p.id}"${i === 0 ? '' : ' hidden'}>${p.inner}</div>`).join('');
  return `<section id="annexes"><h2><span class="num">${num}</span>${esc(t.annexes)}</h2><h3 class="explorer">${esc(t.explorer)}</h3>${strip}${body}</section>`;
```

where `p.inner` is the annex's `<h3>title</h3>` plus table/list exactly as `annex()` renders today (so print, which stacks the panels, keeps its headings). Keep the `annex` helper; give it the `.annex` div as before.

`renderFooter(doc, t, lang)`: after the generated line add

```js
const returnUrl = (doc, watch) => {
  const keyed = (doc.companies || []).filter(c => c.groupKey && c.name);
  if (!keyed.length) return '';
  const p = new URLSearchParams();
  keyed.forEach(c => p.append('c', `${c.groupKey}|${c.name}`));
  p.set('since', String(doc.generatedAt || '').slice(0, 10));
  p.set('source', 'sitrep');
  if (watch) p.set('watch', '1');
  return `${SITE}/app?${p}`;
};
// in renderFooter:
  const back = returnUrl(doc, false);
  const links = back
    ? `<br><a href="${esc(back)}">${esc(t.returnLink(fmtDate(doc.generatedAt, lang)))}</a><br><a href="${esc(returnUrl(doc, true))}">${esc(t.watchLink)}</a>`
    : '';
```

and append `links` before `</footer>` (keep the existing `backLink`).

- [ ] **Step 4: Implement `buildExportHtml.js`**

Replace the `renderMapFigure`/`renderChapters` calls with `${renderStory(safeDoc, graphData, t, wt, lang)}`; pass `lang` to `renderFooter`; add `moment: s.moment || null` to each embedded step; embed

```js
  const stepJson = JSON.stringify({
    steps, opening: safeDoc.opening || null, noteLabel: t.authorNote,
    timeline: safeDoc.timeline || null, lang: lang === 'en' ? 'en' : 'es',
    dissolvedProxy: t.dissolvedProxy, registryAsOf: t.registryAsOf('{d}'),
  }).replace(/</g, '\\u003c');
```

(`registryAsOf('{d}')` gives the script a template; it replaces `{d}` with the formatted day.)

- [ ] **Step 5: Implement `documentStyle.js`**

Append to the screen rules (before `@page`):

```css
.story{display:grid;grid-template-columns:minmax(0,1fr);gap:0 32px;align-items:start}
.story #graph{position:sticky;top:0;z-index:2;background:var(--bg);padding-top:8px;margin:0}
.story #graph #map{height:38vh}
#viewport{transition:transform .6s cubic-bezier(.22,.61,.36,1);transform-origin:0 0;transform-box:view-box}
#map.dragging #viewport{transition:none}
#map g.n,#map .l{transition:opacity .45s ease}
#map [data-state="hidden"]{opacity:0!important;pointer-events:none}
#map .l[data-state="ceased"]{stroke-dasharray:3 3;opacity:.45}
#map g.n[data-state="ghost"] circle{opacity:.35}
#map g.n[data-state="ghost"] text{opacity:.5}
#wt-time{margin-top:8px}
#wt-time input[type=range]{width:100%;accent-color:var(--accent)}
#wt-time .meta{display:flex;gap:6px;flex-wrap:wrap;font-variant-numeric:tabular-nums}
#wt-panel{max-height:34vh;overflow:auto}
.chapter{scroll-margin-top:45vh}
.annex-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}
.annex-tabs [role=tab]{border-radius:999px}
.annex-tabs [role=tab][aria-selected=true]{background:var(--accent);border-color:var(--accent);color:#fff}
h3.explorer{font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 8px}
@media (min-width:960px){
.wrap{max-width:1180px}
.wrap>header,.wrap>nav,.wrap>#summary,.wrap>#annexes,.wrap>footer{max-width:820px;margin-left:auto;margin-right:auto}
.story{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.story.solo{grid-template-columns:minmax(0,820px);justify-content:center}
.story #graph{top:16px;max-height:calc(100vh - 32px);overflow:auto;padding-top:0}
.story #graph #map{height:min(52vh,520px)}
.chapter{scroll-margin-top:50vh}
}
@media (prefers-reduced-motion:reduce){#viewport,#map g.n,#map .l{transition:none}}
```

Inside `@media print{ … }` add: `.story{display:block}.story #graph{position:static;max-height:none;overflow:visible}#wt-time{display:none!important}.annex-tabs{display:none!important}.annex-panel[hidden]{display:block!important}#map [data-state]{opacity:1!important;stroke-dasharray:none}`.

Adjust `.wrap{max-width:820px…}` to stay as is for narrow screens (the 960 px block widens it).

- [ ] **Step 6: Run** — `npx vitest run src/utils/investigationExport` → PASS. Fix any existing `renderMapFigure`/`renderChapters` tests that asserted `wt-start` or `hidden` on `#wt-panel` by updating them to the new contract (the panel is always present when steps exist; there is no start button).

- [ ] **Step 7: Commit**

```bash
git add src/utils/investigationExport
git -c commit.gpgsign=false commit -m "feat(export): scroll-driven story grid, registry-state slider, annex explorer tabs, return links"
```

---

### Task 6: The script — scroll focus, time rendering, slider, animation, tabs

**Files:**
- Modify: `src/utils/investigationExport/walkthroughScript.js`
- Test: `src/utils/investigationExport/walkthroughScript.test.js`

**Interfaces:**
- Consumes: the ids from Task 5 and `window.__SITREP__ = { steps, opening, noteLabel, timeline, lang, dissolvedProxy, registryAsOf }`.
- Produces: `window.__sitrepShow(i)` (scrolls chapter i into view; focus follows through the observer).

- [ ] **Step 1: Write the failing tests** (replace the `wt-start` assertion; add):

```js
  it('binds the controls the template renders', () => {
    ['wt-next', 'wt-prev', 'wt-exit', 'wt-slider'].forEach(id => {
      expect(WALKTHROUGH_SCRIPT, id).toContain(id);
    });
    expect(WALKTHROUGH_SCRIPT).not.toContain('wt-start');
  });
  it('drives focus from scroll position with an IntersectionObserver at mid-viewport', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('IntersectionObserver');
    expect(WALKTHROUGH_SCRIPT).toContain("'-50% 0px -50% 0px'");
  });
  it('renders the registry state for a date through data-state, never innerHTML', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('renderAt');
    expect(WALKTHROUGH_SCRIPT).toContain("'data-state'");
    expect(WALKTHROUGH_SCRIPT).toContain('data-key');
    expect(WALKTHROUGH_SCRIPT).not.toMatch(/\.innerHTML/);
  });
  it('detaches the slider from the chapters when scrubbed by hand and re-attaches on the next chapter', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('detached');
  });
  it('animates the pan with a CSS transform and disables it while dragging', () => {
    expect(WALKTHROUGH_SCRIPT).toContain("style.transform");
    expect(WALKTHROUGH_SCRIPT).toContain("'dragging'");
    expect(WALKTHROUGH_SCRIPT).not.toContain("setAttribute('transform'");
  });
  it('binds the annex tabs with roving focus', () => {
    expect(WALKTHROUGH_SCRIPT).toContain('role="tab"');
    expect(WALKTHROUGH_SCRIPT).toContain('aria-selected');
    expect(WALKTHROUGH_SCRIPT).toContain('aria-controls');
  });
  it('falls back to click-through when IntersectionObserver is missing', () => {
    expect(WALKTHROUGH_SCRIPT).toContain("'IntersectionObserver' in window");
  });
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/utils/investigationExport/walkthroughScript.test.js` → FAIL.

- [ ] **Step 3: Rewrite the script**

Keep the existing helpers (`esc`, `nodeEl`, `clearFocus`, `panTo`, pointer/pinch/wheel handlers, note rendering) and make these changes inside the IIFE:

```js
  var tl = data.timeline || null;
  var dates = (tl && tl.dates) || [];
  var slider = document.getElementById('wt-slider');
  var dateLabel = document.getElementById('wt-date');
  var detached = false;
  var currentDate = (tl && tl.readOn) || null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function apply() {
    if (viewport) viewport.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
  }
  function fmtDay(d) {
    var parts = d.split('-');
    var dt = new Date(+parts[0], +parts[1] - 1, +parts[2], 12);
    return dt.toLocaleDateString(data.lang === 'en' ? 'en-GB' : 'es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  function linkEl(key) { return map.querySelector('line.l[data-key="' + esc(key) + '"]'); }

  // The same rule as stateAt() in registryTimeline.js — keep them in step.
  function renderAt(d) {
    if (!tl || !d) return;
    currentDate = d;
    var nodeState = {};
    var links = tl.links || {}, nodes = tl.nodes || {};
    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id];
      if (n.from === null && n.to === null && !n.dissolved) return;
      nodeState[id] = n.from && d < n.from ? 'hidden' : (n.to && d >= n.to ? 'ghost' : 'live');
    });
    var linkState = {};
    Object.keys(links).forEach(function (k) {
      var L = links[k];
      var st = L.from && d < L.from ? 'hidden' : (L.to && d >= L.to ? 'ceased' : 'live');
      if (st !== 'hidden' && (nodeState[L.a] === 'ghost' || nodeState[L.b] === 'ghost')) st = 'ceased';
      linkState[k] = st;
      var el = linkEl(k); if (el) el.setAttribute('data-state', st);
    });
    Object.keys(nodes).forEach(function (id) {
      if (nodeState[id]) return;
      var mine = Object.keys(links).filter(function (k) { return links[k].a === id || links[k].b === id; }).map(function (k) { return linkState[k]; });
      nodeState[id] = mine.length === 0 || mine.indexOf('live') >= 0 ? 'live' : (mine.indexOf('ceased') >= 0 ? 'ghost' : 'hidden');
    });
    Object.keys(nodeState).forEach(function (id) {
      var el = nodeEl(id); if (!el) return;
      el.setAttribute('data-state', nodeState[id]);
      if (nodeState[id] === 'ghost' && nodes[id] && nodes[id].dissolved) el.setAttribute('data-ghost-title', data.dissolvedProxy || '');
    });
    if (dateLabel) dateLabel.textContent = (data.registryAsOf || '{d}').replace('{d}', fmtDay(d));
    if (slider && dates.indexOf(d) >= 0) slider.value = String(dates.indexOf(d));
  }
  if (slider) {
    slider.addEventListener('input', function () { detached = true; renderAt(dates[+slider.value]); });
  }
```

`show(i, opts)`: same body as today, minus `scrollIntoView`; after `panTo`, add

```js
    var m = step.moment;
    if (!detached || (opts && opts.fromScroll)) { detached = false; renderAt(m && dates.indexOf(m) >= 0 ? m : (tl && tl.readOn)); }
```

The opening block shows when `i === 0` or `idx < 0` (initial state: call `renderOpening()` on load, which fills `wt-opening`, leaves the map unfocused, and calls `renderAt(tl.readOn)`).

`window.__sitrepShow = function (i) { var ch = document.getElementById('ch-' + i); if (ch && ch.scrollIntoView) ch.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); if (!('IntersectionObserver' in window)) show(i); };`

Observer:

```js
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var i = parseInt(en.target.getAttribute('data-i'), 10);
        if (i !== idx) show(i, { fromScroll: true });
      });
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    Array.prototype.forEach.call(document.querySelectorAll('.chapter[data-i]'), function (el) { io.observe(el); });
  }
```

Buttons: `wt-next`/`wt-prev` call `__sitrepShow(idx ± 1)` clamped; `wt-exit` calls `exit()` which clears focus, sets `idx = -1`, shows the opening block and `renderAt(tl.readOn)` (chapters stay). Keyboard ←/→ call `__sitrepShow`; Escape calls `exit()`. Node click on the map keeps its behaviour, through `__sitrepShow`.

Drag/pinch: add `map.classList.add('dragging')` on `pointerdown` and remove it in `up` when `pointers.size === 0`; the wheel zoom adds the class, applies, and removes it on the next frame (`requestAnimationFrame`).

Tabs:

```js
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.annex-tabs [role="tab"]'));
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') selectTab(tabs[(i + 1) % tabs.length]);
      if (e.key === 'ArrowLeft') selectTab(tabs[(i - 1 + tabs.length) % tabs.length]);
    });
  });
```

The string literal `role="tab"` inside the script must be written as `'[role="tab"]'` (single-quoted JS string in the template) so the test finds `role="tab"`.

- [ ] **Step 4: Run** — `npx vitest run src/utils/investigationExport` → PASS. Then a manual smoke: `npx vite-node -e "import('./src/utils/investigationExport/buildExportHtml.js').then(m => console.log(m.buildExportHtml({steps:[]}, {nodes:[],links:[]}).length))"` prints a number.

- [ ] **Step 5: Commit**

```bash
git add src/utils/investigationExport/walkthroughScript.js src/utils/investigationExport/walkthroughScript.test.js
git -c commit.gpgsign=false commit -m "feat(export): scroll-driven focus, registry-state rendering, slider, animated pan, annex tabs"
```

---

### Task 7: The return path in the app

**Files:**
- Create: `src/utils/returnParams.js`, `src/utils/returnParams.test.js`
- Modify: `src/App.jsx` (parse once, pass `initialReturn`)
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` (seed, mark changes, open the watchlist dialog, `sitrep_return`)

**Interfaces:**
- Produces: `parseReturnParams(search) → { companies: [{groupKey, name}], since: 'YYYY-MM-DD'|null, watch: boolean }`; graph prop `initialReturn`.
- Consumes: `loadCompanyRecordIntoGraph(name, null, groupKey)` (extended to return `lastSeen`), the `fetchEvents` wrapper the graph already passes to `useWalkthrough`, `setWatchlistChanges`, `setWatchlistOpen`, `trackEvent`.

- [ ] **Step 1: Write the failing tests**

```js
// src/utils/returnParams.test.js
import { describe, expect, it } from 'vitest';
import { parseReturnParams, RETURN_COMPANY_CAP } from './returnParams';

describe('parseReturnParams', () => {
  it('reads repeated c=<groupKey>|<name> pairs in order', () => {
    const r = parseReturnParams('?c=gk-a%7CALFA+SL&c=gk-b%7CBETA+SL&since=2026-09-13&source=sitrep');
    expect(r.companies).toEqual([{ groupKey: 'gk-a', name: 'ALFA SL' }, { groupKey: 'gk-b', name: 'BETA SL' }]);
    expect(r.since).toBe('2026-09-13');
    expect(r.watch).toBe(false);
  });
  it('drops malformed pairs, junk since, and caps the list', () => {
    const many = Array.from({ length: RETURN_COMPANY_CAP + 3 }, (_, i) => `c=k${i}%7CN${i}`).join('&');
    const r = parseReturnParams(`?${many}&c=nokey&c=%7Cnoname&since=13/09/2026&watch=1`);
    expect(r.companies).toHaveLength(RETURN_COMPANY_CAP);
    expect(r.since).toBeNull();
    expect(r.watch).toBe(true);
  });
  it('is empty for an unrelated query', () => {
    expect(parseReturnParams('?gk=x')).toEqual({ companies: [], since: null, watch: false });
    expect(parseReturnParams('')).toEqual({ companies: [], since: null, watch: false });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/utils/returnParams.test.js` → FAIL.

- [ ] **Step 3: Implement**

```js
// src/utils/returnParams.js
// The situation report's footer links back with the companies it drew:
// /app?c=<groupKey>|<name>&c=…&since=YYYY-MM-DD&source=sitrep[&watch=1].
// Names travel with the keys because the company loader needs one.
export const RETURN_COMPANY_CAP = 12;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const parseReturnParams = search => {
  const p = new URLSearchParams(search || '');
  const companies = p.getAll('c').map(v => {
    const i = v.indexOf('|');
    if (i < 1) return null;
    const groupKey = v.slice(0, i).trim();
    const name = v.slice(i + 1).trim();
    return groupKey && name ? { groupKey, name } : null;
  }).filter(Boolean).slice(0, RETURN_COMPANY_CAP);
  const since = ISO_DAY.test(p.get('since') || '') ? p.get('since') : null;
  return { companies, since, watch: p.get('watch') === '1' };
};
```

`App.jsx`: `const initialReturn = React.useMemo(() => parseReturnParams(window.location.search), []);` and pass `initialReturn={initialReturn}` next to `initialWatchlistToken`.

`SpanishCompanyNetworkGraph.jsx`:

1. Prop `initialReturn = null`.
2. `loadCompanyRecordIntoGraph` returns `{ loaded: true, isDissolved: !!v3.company.is_dissolved, lastSeen: v3.company.last_seen || null }` (the failure returns gain `lastSeen: null`).
3. Extract the group-key stamping block of the watchlist effect into `const stampGroupKeys = useCallback(seeds => { setGraphData(prev => ({ links: prev.links, nodes: prev.nodes.map(/* as today */) })); }, [])` and call it from both effects.
4. New effect, modelled on the watchlist one and placed right after it:

```js
  const returnSeededRef = useRef(false);
  useEffect(() => {
    const ret = initialReturn;
    if (!ret || !ret.companies?.length || returnSeededRef.current) return;
    if (!visible && !embedded) return;
    returnSeededRef.current = true;
    (async () => {
      setIsLoading(true);
      const changes = new Map();
      let loaded = 0;
      try {
        for (const c of ret.companies) {
          try {
            const result = await loadCompanyRecordIntoGraph(c.name, null, c.groupKey);
            if (!result?.loaded) continue;
            loaded += 1;
            if (ret.since && result.lastSeen && String(result.lastSeen).slice(0, 10) > ret.since) {
              let count = 1;
              try {
                const ev = await walkthroughFetchEvents({ groupKey: c.groupKey, name: c.name, size: 25 });
                const list = ev?.events || ev?.results || [];
                count = Math.max(1, list.filter(e => String(e.event_date || e.date || '').slice(0, 10) > ret.since).length);
              } catch { /* the last_seen comparison already proved a change */ }
              changes.set(c.groupKey, count);
            }
          } catch { /* one unreachable company must not cost the others */ }
        }
        if (loaded === 0) { setError(text.watchlistEmpty); return; }
        stampGroupKeys(ret.companies);
        if (changes.size) setWatchlistChanges(changes);
        setSearchQuery('');
        trackEvent('sitrep_return', { companies: ret.companies.length, loaded, changed: changes.size, watch: ret.watch ? 1 : 0 });
        if (ret.watch) setWatchlistOpen(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [initialReturn, visible, embedded]); // eslint-disable-line react-hooks/exhaustive-deps
```

where `walkthroughFetchEvents` is the same wrapper already passed as `fetchEvents` to `useWalkthrough` (find it with `grep -n "fetchEvents" src/components/SpanishCompanyNetworkGraph.jsx`; if it is an inline arrow, lift it into a named `useCallback` above both uses). `stampGroupKeys` takes `[{ name, groupKey }]`, which is what both the watchlist seeds and the return companies carry.

- [ ] **Step 4: Run** — `npx vitest run src/utils/returnParams.test.js && npx eslint src/App.jsx src/components/SpanishCompanyNetworkGraph.jsx src/utils/returnParams.js` → PASS, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/utils/returnParams.js src/utils/returnParams.test.js src/App.jsx src/components/SpanishCompanyNetworkGraph.jsx
git -c commit.gpgsign=false commit -m "feat(app): reopen a situation report's companies from its return link, mark what changed since, offer to watch"
```

---

### Task 8: Full suite, build, spec status

**Files:**
- Modify: `docs/superpowers/specs/2026-09-13-walkthrough-v3-scroll-story-timeline-design.md` (status line)

- [ ] **Step 1: Run everything** — `npx vitest run` → all green. `npx eslint src` → no errors.
- [ ] **Step 2: Build** — `npm run build` succeeds; then `git checkout -- index.html public/llms.txt public/robots.txt public/sitemap*.xml src/copy/registryScaleData.js` and confirm `git status` shows only the spec change. Check the entry chunk does not grow by the export module: `ls -la dist/assets | sort -k5 -n | tail -5` and confirm the `investigationExport` chunk is separate.
- [ ] **Step 3: Spec status** — change the status line to `**Status:** implemented 2026-09-13 on feat/walkthrough-v3 (8 tasks, subagent-driven). Live check pending.`
- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-13-walkthrough-v3-scroll-story-timeline-design.md
git -c commit.gpgsign=false commit -m "docs: walkthrough v3 spec status — implemented, live check pending"
```

The controller runs the live check from the spec's Testing section (laptop and phone-width window, slider scrub and re-attach, return link with one changed company, watch link, print preview) before offering the finishing menu.
