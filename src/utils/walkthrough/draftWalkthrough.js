// The drafted walkthrough: an ordered story of the visible graph, written from
// two sources only — the graph's own structure, and the findings endpoint's
// registry sentences (verbatim). No model call. Pure: no DOM, no network, no
// mutation of inputs.
//
// A note on keys: they are the persistence contract for author edits. They
// must depend only on node ids and finding identity, never on order or text.

import { nameKey } from '../pendingOfficerEvents';
import { isSpellingVariant } from '../officerNameVariants';
import { officerNameRotations } from '../officerNodeKey';
import { hasNodeNote } from '../nodeNotes';
import {
  walkthroughCopy, connectorSentence, ownershipSentence, graphOnlyLine, identityLine,
} from './walkthroughCopy';

export const SECTIONS = Object.freeze([
  'subject', 'stands_out', 'connects', 'ownership', 'other_companies', 'unseen', 'author',
]);
export const STANDS_OUT_CAP = 4;
export const CONNECTS_CAP = 8;
export const FINDINGS_FETCH_CAP = 6;

const SITE = 'https://mapasocietario.es';
const FLAG_RANK = { red: 0, amber: 1 };

const nid = id => (id == null ? '' : String(id));
const refId = ref => (ref && typeof ref === 'object' ? ref.id : ref);
const isCompany = n => !!n && (n.type === 'company' || n.type === 'spanish-company-group');

export const pairKey = (a, b) => (nid(a) < nid(b) ? `${nid(a)}|${nid(b)}` : `${nid(b)}|${nid(a)}`);

export const subjectCompanyIds = (scope, primarySubjectId) => {
  const ids = (scope?.companyNodes || []).map(c => nid(c.nodeId));
  const primary = nid(primarySubjectId);
  if (!primary || !ids.includes(primary)) return ids;
  return [primary, ...ids.filter(id => id !== primary)];
};

const deepLink = (node, lang) => {
  const params = new URLSearchParams();
  if (node?.groupKey) params.set('gk', node.groupKey);
  else if (node?.name) params.set('search', node.name);
  params.set('lang', lang);
  return `${SITE}/app?${params}`;
};

const step = fields => ({
  linkKeys: [], date: null, evidence: null, flag: null, authorNote: null, ...fields,
});

// Registry evidence refs a name in filing order ("Ana García López"); the
// visible officer node carries the aggregator's surname-first order
// ("GARCIA LOPEZ ANA"). Fold accents/case with nameKey, then match via the
// same RESTRICTED filing-order rotation the rest of the app uses
// (officerNameRotations): only the leading/trailing 1-2 tokens (a given name)
// may move to the other end. Deliberately NOT a full token sort — surname
// ORDER carries identity, so "GARCIA MARTIN JOSE" and "MARTIN GARCIA JOSE"
// must stay two different people. isSpellingVariant is a further fallback for
// a differing spelling of the same filing order.
const officerNodeByName = (officers, ref) => {
  const wanted = nameKey(ref);
  if (!wanted) return null;
  const accepted = new Set([wanted, ...officerNameRotations(wanted)]);
  return officers.find(o => accepted.has(nameKey(o.name)))
    || officers.find(o => isSpellingVariant(o.name, ref))
    || null;
};

const companyStep = ({
  section, node, payload, t, lang, officerCount,
}) => {
  const header = payload?.company;
  const identity = header ? identityLine(t, header) : '';
  return step({
    key: `${section}:${nid(node.id)}`,
    section,
    nodeIds: [nid(node.id)],
    title: node.name || '',
    text: identity || graphOnlyLine(t, officerCount),
    source: identity ? 'registry' : 'graph',
    deepLink: deepLink(node, lang),
  });
};

const findingStep = ({
  section, node, finding, officers, lang,
}) => {
  const extraNodes = (finding.evidence || [])
    .filter(e => e.kind === 'officer')
    .map(e => officerNodeByName(officers, e.ref))
    .filter(Boolean)
    .map(o => nid(o.id));
  const uniqueExtra = [...new Set(extraNodes)];
  return step({
    key: `${section}:${nid(node.id)}:${finding.kind}:${finding.date || ''}`,
    section,
    nodeIds: [nid(node.id), ...uniqueExtra],
    linkKeys: uniqueExtra.map(o => pairKey(node.id, o)),
    title: node.name || '',
    text: finding.text || '',
    source: 'registry',
    date: finding.date || null,
    evidence: (finding.evidence || [])[0] || null,
    deepLink: deepLink(node, lang),
  });
};

const byClsThenDate = (a, b) => {
  const rank = c => (c === 'concern' ? 0 : 1);
  if (rank(a.cls) !== rank(b.cls)) return rank(a.cls) - rank(b.cls);
  return String(b.date || '').localeCompare(String(a.date || ''));
};

export function draftWalkthrough({
  graphData, scope, findingsByKey, primarySubjectId, lang = 'es',
}) {
  const t = walkthroughCopy(lang);
  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];
  const byId = new Map(nodes.map(n => [nid(n.id), n]));
  const payloads = findingsByKey instanceof Map ? findingsByKey : new Map();

  const subjectIds = subjectCompanyIds(scope, primarySubjectId).filter(id => byId.has(id));
  if (subjectIds.length === 0) return [];
  const [subjectId, ...otherIds] = subjectIds;

  // Officers adjacent to a company, for evidence resolution and counts.
  const officersOf = new Map();
  links.forEach(l => {
    const a = byId.get(nid(refId(l.source)));
    const b = byId.get(nid(refId(l.target)));
    if (!a || !b) return;
    const [c, o] = isCompany(a) && b.type === 'officer' ? [a, b]
      : isCompany(b) && a.type === 'officer' ? [b, a] : [null, null];
    if (!c) return;
    const list = officersOf.get(nid(c.id)) || [];
    if (!list.includes(o)) officersOf.set(nid(c.id), [...list, o]);
  });
  const officersAt = id => officersOf.get(id) || [];

  const steps = [];
  const subject = byId.get(subjectId);
  const subjectPayload = payloads.get(subjectId) || null;

  steps.push(companyStep({
    section: 'subject', node: subject, payload: subjectPayload, t, lang, officerCount: officersAt(subjectId).length,
  }));

  const findings = subjectPayload?.findings || [];
  [...findings.filter(f => f.cls !== 'limitation')].sort(byClsThenDate).slice(0, STANDS_OUT_CAP)
    .forEach(f => steps.push(findingStep({
      section: 'stands_out', node: subject, finding: f, officers: officersAt(subjectId), lang,
    })));

  const companyIdByName = new Map((scope?.companyNodes || []).map(c => [c.name, nid(c.nodeId)]));
  [...(scope?.connectors || [])]
    .sort((x, y) => (y.companies?.length || 0) - (x.companies?.length || 0) || String(x.name).localeCompare(String(y.name)))
    .slice(0, CONNECTS_CAP)
    .forEach(c => {
      const person = byId.get(nid(c.nodeId));
      if (!person) return;
      const companyIds = (c.companies || []).map(n => companyIdByName.get(n)).filter(id => id && byId.has(id));
      steps.push(step({
        key: `connects:${nid(c.nodeId)}`,
        section: 'connects',
        nodeIds: [nid(c.nodeId), ...companyIds],
        linkKeys: companyIds.map(id => pairKey(c.nodeId, id)),
        title: c.name,
        text: connectorSentence(t, c),
        source: 'graph',
        deepLink: deepLink(person, lang),
      }));
    });

  (scope?.ownership || []).forEach(o => {
    const ownerId = companyIdByName.get(o.owner) || nid(nodes.find(n => n.name === o.owner)?.id);
    const ownedId = companyIdByName.get(o.owned) || nid(nodes.find(n => n.name === o.owned)?.id);
    if (!ownerId || !ownedId || !byId.has(ownerId) || !byId.has(ownedId)) return;
    steps.push(step({
      key: `ownership:${ownerId}|${ownedId}`,
      section: 'ownership',
      nodeIds: [ownerId, ownedId],
      linkKeys: [pairKey(ownerId, ownedId)],
      title: o.owner,
      text: ownershipSentence(t, o),
      source: 'graph',
      deepLink: deepLink(byId.get(ownerId), lang),
    }));
  });

  otherIds.forEach(id => {
    const node = byId.get(id);
    const payload = payloads.get(id) || null;
    const concern = (payload?.findings || []).filter(f => f.cls === 'concern').sort(byClsThenDate)[0];
    if (concern) {
      const s = findingStep({
        section: 'other_companies', node, finding: concern, officers: officersAt(id), lang,
      });
      steps.push({ ...s, key: `other_companies:${id}` });
    } else {
      steps.push(companyStep({
        section: 'other_companies', node, payload, t, lang, officerCount: officersAt(id).length,
      }));
    }
  });

  const unseenLines = [
    ...(subjectPayload?.verification || []),
    ...findings.filter(f => f.cls === 'limitation').map(f => f.text),
  ].filter(Boolean);
  if (unseenLines.length) {
    steps.push(step({
      key: `unseen:${subjectId}`,
      section: 'unseen',
      nodeIds: [subjectId],
      title: subject.name || '',
      text: unseenLines.join('\n'),
      source: 'registry',
      deepLink: deepLink(subject, lang),
    }));
  }

  // Notes: attach to the step whose primary node carries the note; the rest
  // become author steps.
  const noted = nodes.filter(hasNodeNote);
  const primaryOf = new Map();
  steps.forEach(s => { if (!primaryOf.has(s.nodeIds[0])) primaryOf.set(s.nodeIds[0], s.key); });
  const attached = new Map();
  const loose = [];
  noted.forEach(n => {
    const key = primaryOf.get(nid(n.id));
    if (key) attached.set(key, { text: n.userNote.text.trim(), flag: n.userNote.flag || 'none', origin: 'node' });
    else loose.push(n);
  });

  const withNotes = steps.map(s => (attached.has(s.key) ? { ...s, authorNote: attached.get(s.key) } : s));

  [...loose].sort((a, b) => {
    const ra = FLAG_RANK[a.userNote.flag] ?? 2;
    const rb = FLAG_RANK[b.userNote.flag] ?? 2;
    return ra - rb || String(a.name).localeCompare(String(b.name));
  }).forEach(n => withNotes.push(step({
    key: `author:${nid(n.id)}`,
    section: 'author',
    nodeIds: [nid(n.id)],
    title: n.name || '',
    text: n.userNote.text.trim(),
    source: 'author',
    flag: n.userNote.flag || 'none',
    deepLink: deepLink(n, lang),
  })));

  return withNotes;
}
