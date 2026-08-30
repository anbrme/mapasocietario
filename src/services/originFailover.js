/*
 * Mapa Societario — Programa de ordenador
 * Autor: Alessandro Nurnberg
 * Todos los derechos reservados.
 */
/**
 * Origin failover for the LaLiga IP blocks.
 *
 * Background: a Barcelona commercial court lets LaLiga order Movistar,
 * MasOrange, Vodafone and DIGI to null-route IP addresses during match
 * windows, and the addresses they pick are Cloudflare's shared anycast ones.
 * Every hostname this app talks to (api/payments/rag/ai.ncdata.eu) resolves
 * into 104.21.0.0/16 and 172.67.0.0/16 — the two ranges that carry ~80% of
 * the blocklist on a match day. The court order runs to June 2027.
 *
 * What a block actually looks like to the browser is the thing that shapes
 * this module: the ISP does not reject the connection, it *drops* it. The
 * TCP SYN goes into a black hole and the socket hangs until the OS gives up,
 * which is 75s+ on most platforms. So the failure signal is a TIMEOUT, not
 * an error, and any failover that waits for fetch() to reject is useless —
 * the user has long since closed the tab.
 *
 * Hence: every request gets an abort timer, and a request that has not
 * produced response headers before it fires is treated as a blocked origin
 * and retried against the next one.
 *
 * Two further design decisions worth stating, because both are deliberate:
 *
 * 1. The timer measures time-to-headers, not time-to-body. fetch() resolves
 *    when headers arrive, which is the moment we know the IP is reachable;
 *    the timer is cleared there and a slow body streams unimpeded.
 *
 * 2. An HTTP status is NOT a failover trigger. A 500 means the origin
 *    answered — it is reachable, so this is a bug in the backend and moving
 *    traffic to the mirror would just double the load and hide it. The one
 *    exception is Cloudflare's own 52x family, which means the edge is up
 *    but could not reach the VPS behind it; going direct genuinely can win
 *    there, so those do fail over.
 */

import { ORIGIN_GROUPS } from '../config';

// Time-to-headers budget for an origin we have not yet heard from in this
// session. Generous enough for a cold BORME query (the Flask API does not
// send headers until it has the result) but far below the ~75s TCP blackhole
// timeout, which is the gap this whole module lives in.
const UNPROVEN_TIMEOUT_MS = 8000;

// Ceiling for an origin we have heard from. The budget below is derived from
// how slow that origin has actually been, so this is only the cap for a
// genuinely sluggish endpoint.
const PROVEN_CEILING_MS = 45000;

// A demotion is remembered this long. Match windows run a few hours; past
// that we would rather re-test the primary than keep a stale mirror choice.
const STICKY_MAX_AGE_MS = 3 * 60 * 60 * 1000;

// How often, while demoted, to quietly re-probe the primary in the
// background so traffic returns to Cloudflare once the block lifts.
const PRIMARY_RECHECK_MS = 10 * 60 * 1000;

const STORAGE_PREFIX = 'ms.origin.';

// Cloudflare's origin-unreachable family. The edge answered, the thing behind
// it did not — a direct-to-origin mirror can still serve these.
const EDGE_ORIGIN_ERRORS = new Set([521, 522, 523, 524, 525, 526, 527]);

/** group name -> { origins: string[], active: number, since: number } */
let groups = new Map();
/** origins that have returned response headers at least once this session. */
let proven = new Set();
/** origin -> slowest time-to-headers observed, in ms. Drives the budget below. */
let slowest = new Map();
/** group name -> timestamp of the last background primary re-probe. */
let lastRecheck = new Map();

const store = () => {
  try {
    // Safari in private mode throws on access rather than returning null, and
    // prerender/vitest run without a DOM at all.
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
};

const normalizeOrigin = value => {
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch {
    return String(value).replace(/\/+$/, '');
  }
};

/**
 * Install the origin table. Called once at module load from config; tests and
 * any runtime re-point call it directly.
 *
 * @param {Record<string, string[]>} table logical name -> [primary, ...mirrors]
 */
export function configureOriginGroups(table) {
  groups = new Map();
  Object.entries(table || {}).forEach(([name, list]) => {
    const origins = (Array.isArray(list) ? list : [list])
      .map(normalizeOrigin)
      .filter(Boolean)
      // A mirror repeated in the list would be probed twice for nothing.
      .filter((origin, i, all) => all.indexOf(origin) === i);
    if (origins.length === 0) return;
    groups.set(name, { origins, active: 0, since: 0 });
  });
  restoreStickyChoices();
}

// A demotion survives navigation inside the session: without this, every page
// load during a block pays the discovery timeout again on its first request.
function restoreStickyChoices() {
  const storage = store();
  if (!storage) return;
  groups.forEach((group, name) => {
    try {
      const raw = storage.getItem(`${STORAGE_PREFIX}${name}`);
      if (!raw) return;
      const { origin, at } = JSON.parse(raw);
      if (!origin || !at || Date.now() - at > STICKY_MAX_AGE_MS) return;
      const index = group.origins.indexOf(normalizeOrigin(origin));
      // A mirror that has since been removed from config must not resurrect.
      if (index > 0) {
        group.active = index;
        group.since = at;
      }
    } catch {
      // A malformed entry is not worth failing a page load over.
    }
  });
}

function persistChoice(name, group) {
  const storage = store();
  if (!storage) return;
  try {
    const key = `${STORAGE_PREFIX}${name}`;
    if (group.active === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify({ origin: group.origins[group.active], at: group.since }));
  } catch {
    // Quota or a locked-down storage partition; the in-memory choice still holds.
  }
}

function groupForOrigin(origin) {
  for (const [name, group] of groups) {
    if (group.origins.includes(origin)) return [name, group];
  }
  return [null, null];
}

/** The origin this group is currently sending traffic to. Exported for tests/telemetry. */
export function activeOrigin(name) {
  const group = groups.get(name);
  return group ? group.origins[group.active] : null;
}

/**
 * Candidate order for one attempt sequence: the active origin first, then
 * every other one in configured order. When demoted we still put the primary
 * back on the end of the list rather than dropping it, so a session that
 * outlives the match window can recover even if the background re-probe never
 * ran.
 */
function candidates(group) {
  const rest = group.origins.filter((_, i) => i !== group.active);
  return [group.origins[group.active], ...rest];
}

/**
 * How long to give this origin before calling it blocked.
 *
 * A fixed generous budget for any proven origin was the obvious design and the
 * wrong one: kickoff happens while people are already browsing, so by the time
 * the block lands the primary has long since been proven and the first victim
 * would wait the full ceiling before failing over.
 *
 * Instead the budget tracks how slow this origin has actually been — twice its
 * worst observed time-to-headers, floored at the unproven budget and capped at
 * the ceiling. A snappy API keeps a tight budget and fails over quickly; an
 * endpoint that genuinely takes 20s earns the room it needs.
 */
function timeoutFor(origin) {
  if (!proven.has(origin)) return UNPROVEN_TIMEOUT_MS;
  const worst = slowest.get(origin) || 0;
  return Math.min(Math.max(worst * 2, UNPROVEN_TIMEOUT_MS), PROVEN_CEILING_MS);
}

/**
 * One attempt against one origin, with a time-to-headers abort.
 *
 * Returns the Response, or throws. The `blocked` flag on a thrown error
 * distinguishes "this IP is unreachable, try the mirror" from "the caller
 * aborted, stop everything".
 */
async function attempt(url, options, origin) {
  const controller = new AbortController();
  const caller = options.signal;

  if (caller?.aborted) throw new DOMException('Aborted', 'AbortError');

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutFor(origin));

  // A component unmounting mid-request must cancel outright, not fail over to
  // the mirror and issue a second pointless request.
  const relay = () => controller.abort();
  caller?.addEventListener('abort', relay);

  const startedAt = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    // Headers are in, so this is the round trip we budget against; the body may
    // stream for as long as it likes.
    const elapsed = Date.now() - startedAt;
    if (elapsed > (slowest.get(origin) || 0)) slowest.set(origin, elapsed);
    return response;
  } catch (error) {
    if (caller?.aborted) throw error;
    // Whatever we had learned about this origin's latency is worthless now:
    // drop it back to unproven so the next attempt fails over briskly instead
    // of spending the earned budget again.
    proven.delete(origin);
    slowest.delete(origin);
    if (timedOut) {
      const blocked = new Error(`Origin ${origin} did not respond within ${timeoutFor(origin)}ms`);
      blocked.blocked = true;
      blocked.origin = origin;
      throw blocked;
    }
    // A TypeError from fetch is DNS failure, TLS failure or connection
    // refused — all of them "this origin is not usable right now".
    error.blocked = true;
    error.origin = origin;
    throw error;
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener('abort', relay);
  }
}

function promote(name, group, index) {
  if (group.active === index) return;
  group.active = index;
  group.since = Date.now();
  persistChoice(name, group);
}

/**
 * While demoted, quietly ask the primary whether it is back. Runs at most
 * once per PRIMARY_RECHECK_MS and never blocks a real request — the point is
 * that a session started during a match returns to Cloudflare afterwards
 * without the user reloading.
 */
function schedulePrimaryRecheck(name, group) {
  if (group.active === 0) return;
  const last = lastRecheck.get(name) || 0;
  if (Date.now() - last < PRIMARY_RECHECK_MS) return;
  lastRecheck.set(name, Date.now());

  const primary = group.origins[0];
  attempt(`${primary}/`, { method: 'GET', mode: 'cors', cache: 'no-store' }, primary)
    .then(() => {
      proven.add(primary);
      promote(name, group, 0);
    })
    .catch(() => {
      // Still blocked. Stay on the mirror; we will look again later.
    });
}

/**
 * Drop-in replacement for `fetch` that reroutes around a blocked origin.
 *
 * A URL whose origin is not in any configured group is passed straight
 * through, so this is safe to use everywhere — same-origin calls, third
 * parties, anything.
 *
 * @param {string|URL} input
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
export async function resilientFetch(input, options = {}) {
  const href = typeof input === 'string' ? input : String(input);

  let parsed;
  try {
    parsed = new URL(href, typeof location === 'undefined' ? undefined : location.href);
  } catch {
    return fetch(input, options);
  }

  const [name, group] = groupForOrigin(parsed.origin);
  if (!group) return fetch(input, options);

  schedulePrimaryRecheck(name, group);

  const order = candidates(group);
  // Where this request started. The background re-probe can promote the
  // primary back while we are mid-flight; without this the winning attempt
  // would then "promote" its own origin and silently undo the recovery.
  const startIndex = group.active;
  let lastError;

  for (const origin of order) {
    const target = `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    try {
      const response = await attempt(target, options, origin);

      // Headers arrived, so the IP is reachable — that is what we were
      // testing. Anything else is the backend's business, not ours.
      proven.add(origin);

      if (EDGE_ORIGIN_ERRORS.has(response.status) && origin !== order[order.length - 1]) {
        lastError = new Error(`Origin ${origin} answered ${response.status}`);
        continue;
      }

      const index = group.origins.indexOf(origin);
      if (index !== startIndex) promote(name, group, index);
      return response;
    } catch (error) {
      if (!error.blocked) throw error; // caller aborted, or something we should not paper over
      lastError = error;
      if (typeof console !== 'undefined') {
        console.warn(`originFailover: ${origin} unreachable, trying next mirror`, error.message);
      }
    }
  }

  throw lastError || new Error(`No reachable origin for ${parsed.origin}`);
}

/**
 * Optional: settle on a live origin before the user asks for anything, so the
 * discovery timeout is paid in the background at startup rather than by the
 * first search of a match-day visit. Never rejects.
 */
export async function warmOrigins() {
  await Promise.all(
    [...groups].map(async ([name, group]) => {
      if (group.origins.length < 2) return;
      for (const origin of candidates(group)) {
        try {
          await attempt(`${origin}/`, { method: 'GET', mode: 'cors', cache: 'no-store' }, origin);
          proven.add(origin);
          promote(name, group, group.origins.indexOf(origin));
          return;
        } catch {
          // Try the next mirror.
        }
      }
    })
  );
}

/** Test seam: wipe all learned state. */
export function __resetOriginFailover() {
  groups = new Map();
  proven = new Set();
  slowest = new Map();
  lastRecheck = new Map();
}

configureOriginGroups(ORIGIN_GROUPS);
