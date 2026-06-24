import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTokenValid, buildRedeemBody, buildInvestigateHeaders, buildCodeForSessionBody, investigationLaunchState, entitlementSecondsLeft, entitlementChipLabel, buildInvestigationContext, buildInvestigatePayload } from '../src/utils/aiInvestigationClient.js';

test('isTokenValid: valid when not expired', () => {
  assert.equal(isTokenValid({ token: 'x', expiresAt: 2000 }, 1000), true);
});
test('isTokenValid: invalid when expired', () => {
  assert.equal(isTokenValid({ token: 'x', expiresAt: 1000 }, 1000), false);
  assert.equal(isTokenValid({ token: 'x', expiresAt: 999 }, 1000), false);
});
test('isTokenValid: invalid when missing token', () => {
  assert.equal(isTokenValid(null, 1000), false);
  assert.equal(isTokenValid({ expiresAt: 5000 }, 1000), false);
});
test('isTokenValid: invalid when expiresAt is a string', () => {
  assert.equal(isTokenValid({ token: 'x', expiresAt: '2000' }, 1000), false);
});
test('isTokenValid: invalid when expiresAt missing', () => {
  assert.equal(isTokenValid({ token: 'x' }, 1000), false);
});
test('buildRedeemBody trims and lowercases email', () => {
  assert.deepEqual(buildRedeemBody('  Buyer@Example.com ', 'ab12cd34ef56', 'ttok'), {
    email: 'buyer@example.com',
    code: 'ab12cd34ef56',
    turnstileToken: 'ttok',
  });
});
test('buildInvestigateHeaders sets bearer + content-type', () => {
  assert.deepEqual(buildInvestigateHeaders('jwt123'), {
    'Content-Type': 'application/json',
    Authorization: 'Bearer jwt123',
  });
});
test('buildCodeForSessionBody wraps the sessionId', () => {
  assert.deepEqual(buildCodeForSessionBody('cs_test_x'), { sessionId: 'cs_test_x' });
});

test('investigationLaunchState: empty selection launches in focus mode', () => {
  assert.deepEqual(investigationLaunchState(0), { canLaunch: true, mode: 'focus' });
});
test('investigationLaunchState: within cap launches in selection mode', () => {
  assert.deepEqual(investigationLaunchState(1), { canLaunch: true, mode: 'selection' });
  assert.deepEqual(investigationLaunchState(10), { canLaunch: true, mode: 'selection' });
});
test('investigationLaunchState: over cap is blocked', () => {
  assert.deepEqual(investigationLaunchState(11), { canLaunch: false, mode: 'over_cap' });
});

test('entitlementSecondsLeft: positive when valid, 0 when expired/missing', () => {
  assert.equal(entitlementSecondsLeft({ token: 'x', expiresAt: 2000 }, 1000), 1000);
  assert.equal(entitlementSecondsLeft({ token: 'x', expiresAt: 1000 }, 1000), 0);
  assert.equal(entitlementSecondsLeft(null, 1000), 0);
});
test('entitlementChipLabel: authorized shows remaining, else CTA', () => {
  // 1 day + a bit left → "IA · 1 día restante" (es) / "AI · 1 day left" (en)
  const oneDay = { token: 'x', expiresAt: 1000 + 90000 };
  assert.equal(entitlementChipLabel(oneDay, 1000, 'es'), 'IA · 1 día restante');
  assert.equal(entitlementChipLabel(oneDay, 1000, 'en'), 'AI · 1 day left');
  assert.equal(entitlementChipLabel(null, 1000, 'es'), 'Investigación por IA');
  assert.equal(entitlementChipLabel(null, 1000, 'en'), 'AI Investigation');
});

test('buildInvestigationContext: maps selected nodes + edges among them', () => {
  const nodes = [
    { id: 'company-a', name: 'A SL', type: 'spanish-company' },
    { id: 'officer-b', name: 'B PEREZ', type: 'officer' },
    { id: 'company-c', name: 'C SA', type: 'spanish-company' },
  ];
  const links = [
    { source: 'company-a', target: 'officer-b', type: 'director' },
    { source: 'officer-b', target: 'company-c', type: 'director' }, // c not selected → excluded
  ];
  const primary = nodes[0];
  const ctx = buildInvestigationContext(['company-a', 'officer-b'], nodes, links, primary);
  assert.deepEqual(ctx.entities, [
    { id: 'company-a', name: 'A SL', type: 'company' },
    { id: 'officer-b', name: 'B PEREZ', type: 'officer' },
  ]);
  assert.deepEqual(ctx.focus, { id: 'company-a', name: 'A SL', type: 'company' });
  assert.deepEqual(ctx.edges, [{ source: 'company-a', target: 'officer-b', type: 'director' }]);
});
test('buildInvestigationContext: empty selection falls back to primarySubject', () => {
  const primary = { id: 'company-a', name: 'A SL', type: 'spanish-company' };
  const ctx = buildInvestigationContext([], [primary], [], primary);
  assert.deepEqual(ctx.entities, [{ id: 'company-a', name: 'A SL', type: 'company' }]);
  assert.deepEqual(ctx.focus, { id: 'company-a', name: 'A SL', type: 'company' });
  assert.deepEqual(ctx.edges, []);
});
test('buildInvestigationContext: handles links whose source/target are node objects', () => {
  const a = { id: 'company-a', name: 'A SL', type: 'spanish-company' };
  const b = { id: 'officer-b', name: 'B', type: 'officer' };
  const ctx = buildInvestigationContext(['company-a', 'officer-b'], [a, b],
    [{ source: a, target: b, type: 'apoderado' }], a);
  assert.deepEqual(ctx.edges, [{ source: 'company-a', target: 'officer-b', type: 'apoderado' }]);
});

test('buildInvestigatePayload: assembles the request body', () => {
  const payload = buildInvestigatePayload({
    question: 'q', focus: { id: 'company-a', name: 'A', type: 'company' },
    entities: [{ id: 'company-a', name: 'A', type: 'company' }], edges: [],
  });
  assert.deepEqual(payload, {
    question: 'q', focus: { id: 'company-a', name: 'A', type: 'company' },
    entities: [{ id: 'company-a', name: 'A', type: 'company' }], edges: [],
  });
});
