// Pure helpers for the AI Investigation gate. Network calls live in the
// component; these are the unit-tested building blocks.

import { isAuthorNode, isAuthorLink } from './authorLayer.js';

export function isTokenValid(stored, nowSec) {
  if (!stored || !stored.token || typeof stored.expiresAt !== 'number') return false;
  return stored.expiresAt > nowSec;
}

export function buildRedeemBody(email, code, turnstileToken) {
  return {
    email: String(email || '').trim().toLowerCase(),
    code: String(code || ''),
    turnstileToken: turnstileToken || '',
  };
}

export function buildInvestigateHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export function buildCodeForSessionBody(sessionId) {
  return { sessionId: String(sessionId || '') };
}

export const TOKEN_KEY = 'ai_investigation_token';
export const INVESTIGATION_CAP = 10;

export function saveToken(stored) {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify(stored)); } catch { /* ignore */ }
}
export function loadToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number') return null;
    return parsed;
  } catch { return null; }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

export function investigationLaunchState(count, cap = INVESTIGATION_CAP) {
  if (count === 0) return { canLaunch: true, mode: 'focus' };
  if (count > cap) return { canLaunch: false, mode: 'over_cap' };
  return { canLaunch: true, mode: 'selection' };
}

export function entitlementSecondsLeft(stored, nowSec) {
  if (!isTokenValid(stored, nowSec)) return 0;
  return stored.expiresAt - nowSec;
}

export function entitlementChipLabel(stored, nowSec, lang) {
  const en = lang === 'en';
  const left = entitlementSecondsLeft(stored, nowSec);
  if (left <= 0) return en ? 'AI Investigation' : 'Investigación por IA';
  const days = Math.floor(left / 86400);
  if (days >= 1) {
    return en ? `AI · ${days} day${days > 1 ? 's' : ''} left` : `IA · ${days} día${days > 1 ? 's' : ''} restante${days > 1 ? 's' : ''}`;
  }
  const hours = Math.max(1, Math.floor(left / 3600));
  return en ? `AI · ${hours}h left` : `IA · ${hours}h restante`;
}

// Normalize a link endpoint that may be an id string or a node object.
function _endpointId(end) {
  return typeof end === 'object' && end !== null ? end.id : end;
}
function _toEntity(node) {
  return { id: node.id, name: node.name || node.label || '', type: node.type === 'officer' ? 'officer' : 'company' };
}

// The context is sent to the AI worker, so it carries only what the registry
// published. An author entity or an author relationship is the author's own
// work: it never leaves the browser by name, here or anywhere else.
export function buildInvestigationContext(selectedIds, nodes, links, primarySubject) {
  const byId = new Map((nodes || []).filter((n) => !isAuthorNode(n)).map((n) => [n.id, n]));
  const registrySubject = primarySubject && !isAuthorNode(primarySubject) ? primarySubject : null;
  let entityNodes = (selectedIds || []).map((id) => byId.get(id)).filter(Boolean);
  if (entityNodes.length === 0 && registrySubject) entityNodes = [registrySubject];
  const entities = entityNodes.map(_toEntity);
  const idSet = new Set(entities.map((e) => e.id));
  const focusNode = (registrySubject && idSet.has(registrySubject.id)) ? registrySubject : entityNodes[0] || registrySubject || null;
  const focus = focusNode ? _toEntity(focusNode) : null;
  const edges = (links || [])
    .filter((l) => !isAuthorLink(l))
    .map((l) => ({ source: _endpointId(l.source), target: _endpointId(l.target), type: l.type || l.category || '' }))
    .filter((e) => idSet.has(e.source) && idSet.has(e.target));
  return { focus, entities, edges };
}

export function buildInvestigatePayload({ question, focus, entities, edges, lang }) {
  return { question, focus, entities, edges, lang: lang || 'es' };
}
