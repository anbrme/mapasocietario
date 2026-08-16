import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PROMOTIONS_PER_DAY,
  isStableCompanyGroupKey,
  shouldPromoteCompany,
  shouldValidateCompany,
} from '../functions/empresa/_demand.js';
import { applyIndexDecision, isAllowedOrigin, validateDemandPayload } from '../functions/api/company-demand.js';

test('stable company group keys accept hoja and name-based v3 identities', () => {
  assert.equal(isStableCompanyGroupKey('H:M-396846'), true);
  assert.equal(isStableCompanyGroupKey('N:EMPRESA SIN HOJA SL'), true);
  assert.equal(isStableCompanyGroupKey('company-123'), false);
  assert.equal(isStableCompanyGroupKey('H:x\nforged'), false);
});

test('promotion requires one genuine click or two deduplicated search renders', () => {
  assert.equal(shouldPromoteCompany({ searchRenderCount: 1 }), false);
  assert.equal(shouldPromoteCompany({ searchRenderCount: 2 }), true);
  assert.equal(shouldPromoteCompany({ fullProfileClickCount: 1 }), true);
});

test('demand payload validates the stable identity and canonical slug', () => {
  const result = validateDemandPayload({
    event_type: 'search_rendered',
    group_key: 'H:M-396846',
    company_name: 'ACME & PARTNERS SL',
    slug: 'acme-y-partners-sl',
    session_id: 'session_123456',
    language: 'en',
    province: 'Madrid',
    hoja: 'M-396846',
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.groupKey, 'H:M-396846');
  assert.equal(result.value.language, 'en');
});

test('demand payload rejects forged slugs and arbitrary events', () => {
  assert.deepEqual(validateDemandPayload({
    event_type: 'simulated_profile_view',
    group_key: 'H:M-396846',
    company_name: 'ACME SL',
    slug: 'acme-sl',
    session_id: 'session_123456',
  }), { ok: false, error: 'invalid_event_type' });

  assert.deepEqual(validateDemandPayload({
    event_type: 'full_profile_click',
    group_key: 'H:M-396846',
    company_name: 'ACME SL',
    slug: 'different-company',
    session_id: 'session_123456',
  }), { ok: false, error: 'invalid_company_slug' });
});

// ---------------------------------------------------------------------------
// Identity validation
// ---------------------------------------------------------------------------

test('name-based identities keep their accents, ampersands and punctuation', () => {
  // company_name_normalized is NOT ascii-folded, so a stricter charset would
  // silently make every hoja-less company with an "ñ" unpromotable.
  assert.equal(isStableCompanyGroupKey('N:HERMANOS MUNOZ SL'), true);
  assert.equal(isStableCompanyGroupKey('N:ACME & PARTNERS, SL'), true);
  assert.equal(isStableCompanyGroupKey('H:M-396846'), true);
  assert.equal(isStableCompanyGroupKey('no-prefix'), false);
  assert.equal(isStableCompanyGroupKey('H:' + 'x'.repeat(200)), false);
});

test('only a mismatching Origin is rejected; a missing one is not', () => {
  assert.equal(isAllowedOrigin(null), true);
  assert.equal(isAllowedOrigin('https://mapasocietario.es'), true);
  assert.equal(isAllowedOrigin('https://evil.example'), false);
  assert.equal(isAllowedOrigin('not-a-url'), false);
});

// ---------------------------------------------------------------------------
// When the BORME API is consulted at all
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(Date.now() - ms).toISOString().slice(0, 19).replace('T', ' ');

test('a company below the promotion threshold is never verified upstream', () => {
  assert.equal(shouldValidateCompany({ status: 'candidate', search_render_count: 1 }), false);
});

test('a candidate that just earned promotion is verified once, then backs off', () => {
  const earned = { status: 'candidate', full_profile_click_count: 1 };
  assert.equal(shouldValidateCompany(earned), true);
  assert.equal(shouldValidateCompany({ ...earned, validated_at: iso(1000) }), false);
  assert.equal(shouldValidateCompany({ ...earned, validated_at: iso(2 * DAY) }), true);
});

test('a promoted page is re-verified only once its check goes stale', () => {
  assert.equal(shouldValidateCompany({ status: 'promoted', validated_at: iso(DAY) }), false);
  assert.equal(shouldValidateCompany({ status: 'promoted', validated_at: iso(40 * DAY) }), true);
});

// ---------------------------------------------------------------------------
// Promotion decisions
// ---------------------------------------------------------------------------

function fakeDb(respond) {
  const statements = [];
  return {
    statements,
    prepare(sql) {
      return {
        bind(...args) {
          statements.push({ sql, args });
          return {
            first: async () => respond(sql, args),
            run: async () => ({ meta: { changes: 1 } }),
            all: async () => ({ results: [] }),
          };
        },
      };
    },
  };
}

const CANDIDATE = {
  eventType: 'full_profile_click',
  groupKey: 'H:M-396846',
  companyName: 'ACME SL',
  slug: 'acme-sl',
  sessionId: 'session_123456',
  province: 'Madrid',
  hoja: 'M-396846',
};

function stubProfileFetch(company) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ company }) });
  return () => { globalThis.fetch = original; };
}

const VERIFIABLE = {
  _id: 'H:M-396846',
  company_name: 'ACME SL',
  province: 'Madrid',
  hojas: ['M-396846'],
  total_publications: 4,
};

test('a verified click promotes the company', async () => {
  const restore = stubProfileFetch(VERIFIABLE);
  try {
    const db = fakeDb((sql) => (sql.includes('COUNT(*)') ? { total: 0 } : null));
    const decision = await applyIndexDecision(db, CANDIDATE,
      { status: 'candidate', full_profile_click_count: 1 });
    assert.equal(decision.promoted, true);
    assert.equal(decision.reason, 'promoted');
  } finally { restore(); }
});

test('a slug already owned by another registry identity is never taken over', async () => {
  const restore = stubProfileFetch(VERIFIABLE);
  try {
    // nameToSlug is lossy, so two group_keys can produce one slug. Only the
    // incumbent may own the indexable URL.
    const db = fakeDb((sql) => (sql.includes('AND group_key <> ?') ? { group_key: 'H:B-1' } : null));
    const decision = await applyIndexDecision(db, CANDIDATE,
      { status: 'candidate', full_profile_click_count: 1 });
    assert.equal(decision.promoted, false);
    assert.equal(decision.reason, 'slug_claimed');
  } finally { restore(); }
});

test('the daily promotion cap bounds how fast the index can grow', async () => {
  const restore = stubProfileFetch(VERIFIABLE);
  try {
    const db = fakeDb((sql) => (sql.includes('COUNT(*)') ? { total: MAX_PROMOTIONS_PER_DAY } : null));
    const decision = await applyIndexDecision(db, CANDIDATE,
      { status: 'candidate', full_profile_click_count: 1 });
    assert.equal(decision.promoted, false);
    assert.equal(decision.reason, 'daily_cap');
  } finally { restore(); }
});

test('a promoted company that no longer verifies is demoted', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
  try {
    const db = fakeDb(() => null);
    const decision = await applyIndexDecision(db, CANDIDATE,
      { status: 'promoted', validated_at: iso(40 * DAY) });
    assert.equal(decision.promoted, false);
    assert.equal(decision.reason, 'demoted');
    assert.ok(db.statements.some((s) => s.sql.includes("status = 'candidate'")));
  } finally { globalThis.fetch = original; }
});

test('a renamed company fails the slug round-trip and is not promoted', async () => {
  const restore = stubProfileFetch({ ...VERIFIABLE, company_name: 'RENAMED HOLDING SL' });
  try {
    const db = fakeDb(() => null);
    const decision = await applyIndexDecision(db, CANDIDATE,
      { status: 'candidate', full_profile_click_count: 1 });
    assert.equal(decision.promoted, false);
    assert.equal(decision.reason, 'not_verified');
  } finally { restore(); }
});
