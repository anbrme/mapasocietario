import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTokenValid, buildRedeemBody, buildInvestigateHeaders } from '../src/utils/aiInvestigationClient.js';

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
