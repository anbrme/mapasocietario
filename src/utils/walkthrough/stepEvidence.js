// Sourced evidence for a walkthrough step, built only from data the app already
// fetches for the inspector: the v3 company profile, the last events, the
// findings payload, and the visible graph's links. Pure and null-tolerant.
import { isActiveOfficerCategory } from '../relationshipScope';
import { walkthroughCopy, identityLine } from './walkthroughCopy';

export const BOARD_CAP = 12;
const nid = id => (id == null ? '' : String(id));
const refId = ref => (ref && typeof ref === 'object' ? ref.id : ref);
const isCompany = n => !!n && (n.type === 'company' || n.type === 'spanish-company-group');
const day = v => String(v || '').slice(0, 10);
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const REGISTRY_DATA = 'datos registrales';

export const boardRows = (profile) => {
  const active = (profile?.officers_active || []).map(o => ({
    name: o.name || o.name_normalized || '', role: o.position_normalized || o.position || '', since: day(o.appointed_date), status: 'active',
  }));
  const ceased = (profile?.officers_resigned || [])
    .filter(o => String(o.status || '').toLowerCase() !== 'superseded')
    .map(o => ({ name: o.name || o.name_normalized || '', role: o.position_normalized || o.position || '', since: day(o.appointed_date), status: 'ceased' }));
  const byDate = (a, b) => b.since.localeCompare(a.since);
  return [...active.sort(byDate), ...ceased.sort(byDate)].filter(r => r.name).slice(0, BOARD_CAP);
};

export const lastFilings = (payload, lang, n = 3) => {
  const events = payload?.events || payload?.results || [];
  return events
    .map(e => {
      const types = (e.event_types || []).map(t => (typeof t === 'string' ? t : t?.type)).filter(Boolean);
      const informative = types.find(t => fold(t) !== REGISTRY_DATA) || types[0] || '';
      return { date: day(e.event_date || e.date), type: informative };
    })
    .filter(e => e.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);
};

export const personSeats = (node, graphData, lang) => {
  const id = nid(node?.id);
  const byId = new Map((graphData?.nodes || []).map(n => [nid(n.id), n]));
  return (graphData?.links || []).flatMap(l => {
    const a = nid(refId(l.source)); const b = nid(refId(l.target));
    const other = a === id ? b : b === id ? a : null;
    const company = other ? byId.get(other) : null;
    if (!company || !isCompany(company)) return [];
    // A sole-shareholder link is ownership, not a seat — it never belongs in
    // the "cargos" table, however it happens to be categorised.
    if (l.type === 'ownership') return [];
    return [{
      company: company.name || '', companyId: other,
      role: l.relationship || l.category || '',
      since: day(l.date || l.appointed_date), until: day(l.resigned_date),
      status: isActiveOfficerCategory(l.category) ? 'active' : 'ceased',
    }];
  }).sort((x, y) => x.company.localeCompare(y.company));
};

const concernFirst = (a, b) => {
  const r = c => (c === 'concern' ? 0 : 1);
  return r(a.cls) - r(b.cls) || String(b.date || '').localeCompare(String(a.date || ''));
};

const ownershipRows = (node, scope) => (scope?.ownership || [])
  .filter(o => o.owner === node?.name || o.owned === node?.name);

export const companyEvidence = ({
  node, profile, events, findings, scope, lang = 'es',
}) => {
  const t = walkthroughCopy(lang);
  const header = findings?.company || null;
  const all = findings?.findings || [];
  return {
    identity: header ? identityLine(t, header) : '',
    status: { dissolved: !!profile?.is_dissolved, concurso: !!profile?.is_in_concurso, lastFiling: header?.last_filing || null },
    capital: profile?.share_capital ?? profile?.capital ?? null,
    activity: profile?.activity || profile?.enriched_activity || null,
    board: boardRows(profile),
    filings: lastFilings(events, lang),
    findings: [...all.filter(f => f.cls !== 'limitation')].sort(concernFirst).slice(0, 3)
      .map(f => ({ text: f.text || '', date: f.date || null, cls: f.cls || 'context' })),
    unseen: [...(findings?.verification || []), ...all.filter(f => f.cls === 'limitation').map(f => f.text)].filter(Boolean),
    ownership: ownershipRows(node, scope),
  };
};
