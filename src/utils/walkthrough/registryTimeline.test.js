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
  it('an undated link is live at every date its endpoints exist', () => {
    expect(stateAt(tl, '2020-01-01').links.get('H:2|o3|consejero')).toBe('live');
  });
  it('a link to a company that does not exist yet is hidden with it, and so is the person on it', () => {
    expect(stateAt(tl, '2000-01-01').nodes.get('H:2')).toBe('hidden');
    expect(stateAt(tl, '2000-01-01').links.get('H:2|o3|consejero')).toBe('hidden');
    expect(stateAt(tl, '2000-01-01').nodes.get('o3')).toBe('hidden');
    expect(stateAt(tl, '2015-02-02').links.get('H:2|o3|consejero')).toBe('live');
    expect(stateAt(tl, '2015-02-02').nodes.get('o3')).toBe('live');
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
