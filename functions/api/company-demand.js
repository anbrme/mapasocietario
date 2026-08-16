/**
 * POST /api/company-demand — record a product-demand signal for a company.
 *
 * Ordering matters here. The cheap, local checks (origin, size, shape, rate
 * limit) all run BEFORE anything touches the BORME API, so this unauthenticated
 * endpoint cannot be used to amplify traffic against api.ncdata.eu. The upstream
 * verification runs only where it can change an outcome — when a candidate has
 * just earned promotion, or when a promoted page's verification has gone stale.
 */
import {
  MAX_PROMOTIONS_PER_DAY,
  countPromotionsToday,
  demoteCompany,
  isSlugClaimedByAnother,
  isStableCompanyGroupKey,
  markValidationAttempt,
  shouldPromoteCompany,
  shouldValidateCompany,
} from '../empresa/_demand.js';
import { nameToSlug } from '../empresa/_slug.js';

const API_BASE = 'https://api.ncdata.eu';
const EVENT_TYPES = new Set(['search_rendered', 'full_profile_click']);
const MAX_BODY_BYTES = 8_192;
const ALLOWED_HOSTS = new Set(['mapasocietario.es', 'www.mapasocietario.es', 'localhost:5174']);
// One browser generates a handful of signals per session; anything above this
// from a single address in a day is not a person browsing companies.
const MAX_REQUESTS_PER_DAY = 300;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function cleanText(value, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= maxLength ? text : '';
}

/**
 * Browsers send Origin on every cross-site POST, so a mismatch is a positive
 * signal that this did not come from our own page. A MISSING Origin is not
 * treated as hostile (some privacy tooling strips it) — the rate limit is what
 * bounds non-browser callers.
 */
export function isAllowedOrigin(originHeader) {
  if (!originHeader) return true;
  try {
    return ALLOWED_HOSTS.has(new URL(originHeader).host);
  } catch {
    return false;
  }
}

export function validateDemandPayload(body) {
  const eventType = cleanText(body?.event_type, 40);
  const groupKey = cleanText(body?.group_key, 190);
  const companyName = cleanText(body?.company_name, 260);
  const slug = cleanText(body?.slug, 220).toLowerCase();
  const sessionId = cleanText(body?.session_id, 100);

  if (!EVENT_TYPES.has(eventType)) return { ok: false, error: 'invalid_event_type' };
  if (!isStableCompanyGroupKey(groupKey)) return { ok: false, error: 'invalid_group_key' };
  if (!companyName || nameToSlug(companyName) !== slug) return { ok: false, error: 'invalid_company_slug' };
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(sessionId)) return { ok: false, error: 'invalid_session' };

  return {
    ok: true,
    value: {
      eventType,
      groupKey,
      companyName,
      slug,
      sessionId,
      province: cleanText(body?.province, 120) || null,
      hoja: cleanText(body?.hoja, 120) || null,
      language: body?.language === 'en' ? 'en' : 'es',
    },
  };
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Read at most MAX_BODY_BYTES. The Content-Length header is advisory (it can be
 * omitted entirely on a chunked request), so the body itself is measured.
 */
async function readBoundedJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { ok: false, error: 'payload_too_large' };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
}

/** Per-address daily budget, enforced before any upstream request. */
async function withinRateLimit(db, request) {
  const address = request.headers.get('CF-Connecting-IP') || 'unknown';
  const day = today();
  const bucketKey = await sha256(`${address}|${day}`);
  const row = await db.prepare(
    `INSERT INTO company_demand_rate_limits (bucket_key, day, request_count)
     VALUES (?, ?, 1)
     ON CONFLICT(bucket_key) DO UPDATE SET request_count = request_count + 1
     RETURNING request_count`,
  ).bind(bucketKey, day).first();
  const count = Number(row?.request_count || 0);
  if (count === 1) {
    // Buckets are keyed by day, so yesterday's rows are dead weight. Clearing
    // them on the day's first request keeps the table from growing unbounded.
    await db.prepare('DELETE FROM company_demand_rate_limits WHERE day < ?').bind(day).run();
  }
  return count <= MAX_REQUESTS_PER_DAY;
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

/**
 * Verify the company really exists, really carries this slug, and really has
 * substance worth indexing. Returns null for "do not index this".
 */
async function validateCompanyProfile(candidate) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const profile = await fetchJson(
      `${API_BASE}/bormes/v3/company?group_key=${encodeURIComponent(candidate.groupKey)}`,
      controller.signal,
    );
    const company = profile?.company;
    if (!company) return null;

    const returnedKey = company._id || company.id || company.group_key || '';
    if (returnedKey && returnedKey !== candidate.groupKey) return null;

    const canonicalName = cleanText(company.company_name || company.company_name_normalized, 260);
    if (!canonicalName || nameToSlug(canonicalName) !== candidate.slug) return null;

    const officerCount = (company.officers_active || []).length + (company.officers_resigned || []).length;
    let hasPublication = Number(company.total_publications || company.publication_count || 0) > 0;
    if (!hasPublication && officerCount === 0) {
      const events = await fetchJson(
        `${API_BASE}/bormes/v3/events?group_key=${encodeURIComponent(candidate.groupKey)}&size=1`,
        controller.signal,
      );
      hasPublication = (events?.events || []).length > 0 || Number(events?.total || 0) > 0;
    }
    if (!hasPublication && officerCount === 0) return null;

    return {
      canonicalName,
      province: cleanText(company.province, 120) || candidate.province,
      hoja: cleanText((company.hojas || [])[0], 120) || candidate.hoja,
      nif: cleanText(company.nif, 24) || null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function recordDemand(db, candidate) {
  await db.prepare(
    `INSERT INTO company_index_candidates
       (group_key, slug, canonical_name, province, hoja, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(group_key) DO UPDATE SET
       slug = excluded.slug,
       canonical_name = excluded.canonical_name,
       province = COALESCE(excluded.province, company_index_candidates.province),
       hoja = COALESCE(excluded.hoja, company_index_candidates.hoja),
       last_seen_at = CURRENT_TIMESTAMP`,
  ).bind(
    candidate.groupKey,
    candidate.slug,
    candidate.companyName,
    candidate.province,
    candidate.hoja,
  ).run();

  const dedupeKey = await sha256(
    `${candidate.eventType}|${candidate.groupKey}|${candidate.sessionId}|${today()}`,
  );
  const inserted = await db.prepare(
    `INSERT INTO company_demand_events (dedupe_key, group_key, event_type)
     VALUES (?, ?, ?)
     ON CONFLICT(dedupe_key) DO NOTHING`,
  ).bind(dedupeKey, candidate.groupKey, candidate.eventType).run();

  if (Number(inserted?.meta?.changes || 0) > 0) {
    const column = candidate.eventType === 'full_profile_click'
      ? 'full_profile_click_count'
      : 'search_render_count';
    await db.prepare(
      `UPDATE company_index_candidates
       SET ${column} = ${column} + 1, last_seen_at = CURRENT_TIMESTAMP
       WHERE group_key = ?`,
    ).bind(candidate.groupKey).run();
  }

  return db.prepare(
    `SELECT search_render_count, full_profile_click_count, status, validated_at
     FROM company_index_candidates
     WHERE group_key = ?`,
  ).bind(candidate.groupKey).first();
}

async function promoteCompany(db, candidate, profile) {
  await db.prepare(
    `UPDATE company_index_candidates
     SET status = 'promoted', canonical_name = ?, province = ?, hoja = ?, nif = ?,
         promoted_at = COALESCE(promoted_at, CURRENT_TIMESTAMP),
         validated_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP
     WHERE group_key = ?`,
  ).bind(
    profile.canonicalName,
    profile.province,
    profile.hoja,
    profile.nif,
    candidate.groupKey,
  ).run();
}

/**
 * Decide what this signal changes. Split out from the request handler so the
 * promotion rules are readable in one place.
 */
export async function applyIndexDecision(db, candidate, row) {
  if (!shouldValidateCompany(row)) {
    return { promoted: row?.status === 'promoted', validated: false, reason: 'no_check_needed' };
  }

  const profile = await validateCompanyProfile(candidate);
  if (!profile) {
    // Stamp the attempt either way so a failing candidate backs off instead of
    // re-hitting the BORME API on every subsequent signal.
    if (row?.status === 'promoted') {
      await demoteCompany(db, candidate.groupKey);
      return { promoted: false, validated: true, reason: 'demoted' };
    }
    await markValidationAttempt(db, candidate.groupKey);
    return { promoted: false, validated: true, reason: 'not_verified' };
  }

  if (row?.status === 'promoted') {
    await promoteCompany(db, candidate, profile);   // refreshes the stored facts
    return { promoted: true, validated: true, reason: 'revalidated' };
  }

  if (!shouldPromoteCompany({
    searchRenderCount: row?.search_render_count,
    fullProfileClickCount: row?.full_profile_click_count,
  })) {
    return { promoted: false, validated: true, reason: 'below_threshold' };
  }

  // Two registry identities can produce one slug; only the first may own the URL.
  if (await isSlugClaimedByAnother(db, candidate.slug, candidate.groupKey)) {
    await markValidationAttempt(db, candidate.groupKey);
    return { promoted: false, validated: true, reason: 'slug_claimed' };
  }

  if (await countPromotionsToday(db) >= MAX_PROMOTIONS_PER_DAY) {
    return { promoted: false, validated: true, reason: 'daily_cap' };
  }

  await promoteCompany(db, candidate, profile);
  return { promoted: true, validated: true, reason: 'promoted' };
}

export async function onRequestPost({ request, env }) {
  if (!env.SEO_DB) return json({ ok: true, recorded: false, reason: 'not_configured' }, 202);
  if (!isAllowedOrigin(request.headers.get('Origin'))) {
    return json({ ok: false, error: 'forbidden_origin' }, 403);
  }

  const parsed = await readBoundedJson(request);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.error }, parsed.error === 'payload_too_large' ? 413 : 400);
  }

  const validated = validateDemandPayload(parsed.value);
  if (!validated.ok) return json({ ok: false, error: validated.error }, 400);
  const candidate = validated.value;

  try {
    if (!await withinRateLimit(env.SEO_DB, request)) {
      return json({ ok: false, error: 'rate_limited' }, 429);
    }

    const row = await recordDemand(env.SEO_DB, candidate);
    const decision = await applyIndexDecision(env.SEO_DB, candidate, row);
    return json({ ok: true, recorded: true, promoted: decision.promoted }, 200);
  } catch (error) {
    console.error('[company-demand] failed:', error?.message || error);
    return json({ ok: false, error: 'record_failed' }, 503);
  }
}
