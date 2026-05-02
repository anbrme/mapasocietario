// src/services/congresoOfficerMatcher.js
// Cross-checks Spanish officer names against the Congreso de los Diputados
// deputies dataset so KYC/DD surfaces can flag PEP exposure.
//
// Congreso names typically come as "APELLIDO1 APELLIDO2, NOMBRE";
// BORME officer names as "NOMBRE APELLIDO1 APELLIDO2". Matching is
// order-agnostic — we tokenize, accent-strip, and compare token sets.

import { congresoCacheService } from './congresoCacheService';

const WORKER_BASE_URL = 'https://congreso-proxy.anurnberg.workers.dev';
// Bumped to v4 when we taught the matcher about the historical file's
// {NOMBRE, APELLIDOS} schema (one row per legislatura) — the v3 cache held
// rows that, when tokenized via NOMBRE alone, were just first names like
// "José Luis" and never matched any BORME officer.
const INDEX_CACHE_KEY = 'all_deputies_index_v4';
const PAGE_SIZE = 500;
const MIN_TOKEN_OVERLAP = 3;
const MIN_JACCARD = 0.7;

const STOPWORDS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do']);

// Spanish-aware tokenizer: NFD-normalize so accented letters survive lowercase
// before we strip diacritics, then drop short tokens and connector words like
// "de", "del", "la" so "JUAN DE LA TORRE" and "TORRE, JUAN" still match.
export function tokenizeName(name) {
  if (!name || typeof name !== 'string') return [];
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

function jaccard(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersect = 0;
  for (const t of setA) if (setB.has(t)) intersect += 1;
  const union = setA.size + setB.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

let indexPromise = null;

async function fetchDeputiesFrom(sourceParam) {
  const all = [];
  let page = 1;
  // Hard-cap as a safety net; the dataset is ~6k entries across all legislaturas.
  while (page < 50) {
    const sourceQuery = sourceParam ? `source=${sourceParam}&` : '';
    const url = `${WORKER_BASE_URL}/deputies?${sourceQuery}page=${page}&limit=${PAGE_SIZE}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Congreso /deputies HTTP ${res.status}`);
    const body = await res.json();
    const rows = Array.isArray(body) ? body : body.data || [];
    if (rows.length === 0) break;
    all.push(...rows);
    const pagination = body.pagination;
    if (!pagination || pagination.page >= pagination.totalPages) break;
    page += 1;
  }
  return all;
}

async function fetchAllDeputies() {
  // Prefer the historical "all" file (current + ex-deputies across every
  // legislatura, ~6k entries). If the worker hasn't been redeployed with
  // ?source=all support yet, the request returns 0 rows — fall back to the
  // active-only default so the matcher still works for sitting deputies.
  try {
    const all = await fetchDeputiesFrom('all');
    if (all.length > 0) return all;
    console.warn(
      '[CongresoMatcher] ?source=all returned 0 rows — worker likely not redeployed yet, falling back to active-only.'
    );
  } catch (err) {
    console.warn('[CongresoMatcher] ?source=all failed, falling back to active-only:', err);
  }
  return fetchDeputiesFrom(null);
}

// Schema differences:
//   - DiputadosActivos: NOMBRE = "Apellido1 Apellido2, Nombre" (full name),
//     plus FORMACIONELECTORAL / GRUPOPARLAMENTARIO / CIRCUNSCRIPCION /
//     FECHAALTA / FECHABAJA / BIOGRAFIA.
//   - Diput__ (historical): NOMBRE = first name only, APELLIDOS = surnames,
//     LEGISLATURA + FECHAINICIOLEGISLATURA + FECHAFINLEGISLATURA, no party
//     or group fields. One row per (deputy × legislatura).
export function fullDeputyName(d) {
  if (!d) return '';
  if (d.APELLIDOS) return `${d.NOMBRE || ''} ${d.APELLIDOS}`.trim();
  return d.NOMBRE || '';
}

function buildIndex(rows) {
  // Group rows by person — historical schema produces one row per legislatura,
  // so a single deputy can appear ~7 times. We keep all the rows on the entry
  // so the badge tooltip can show legislatura coverage, and pick a "primary"
  // row preferring (a) sitting deputy, (b) most recent legislatura end.
  const byPerson = new Map();
  for (const d of rows) {
    const tokens = tokenizeName(fullDeputyName(d));
    if (tokens.length < 2) continue;
    // Sort tokens so "Apellido1 Apellido2, Nombre" and "Nombre Apellido1
    // Apellido2" produce the same key — multiple rows for the same person
    // reliably collapse into one index entry regardless of source schema.
    const key = [...tokens].sort().join(' ');
    let entry = byPerson.get(key);
    if (!entry) {
      entry = { tokens: new Set(tokens), rows: [] };
      byPerson.set(key, entry);
    }
    entry.rows.push(d);
  }
  return [...byPerson.values()].map(entry => ({
    raw: pickPrimaryRow(entry.rows),
    rows: entry.rows,
    tokens: entry.tokens,
  }));
}

function pickPrimaryRow(rows) {
  // Prefer rows from the active file (have FORMACIONELECTORAL — they carry
  // party + group info we want for the badge tooltip).
  const withParty = rows.find(r => r.FORMACIONELECTORAL);
  if (withParty) return withParty;
  // Otherwise prefer the row with the latest legislatura end date.
  const parseEsDate = s => {
    if (!s) return 0;
    const parts = String(s).split('/');
    if (parts.length === 3) return Date.parse(`${parts[2]}-${parts[1]}-${parts[0]}`) || 0;
    return Date.parse(s) || 0;
  };
  return [...rows].sort(
    (a, b) => parseEsDate(b.FECHAFINLEGISLATURA) - parseEsDate(a.FECHAFINLEGISLATURA)
  )[0];
}

async function loadIndex() {
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    try {
      const cached = await congresoCacheService.getCachedData(INDEX_CACHE_KEY);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        // Cache stores raw rows; rebuild the deduped per-person index on read.
        return buildIndex(cached);
      }
    } catch (err) {
      console.warn('[CongresoMatcher] cache read failed', err);
    }
    const rows = await fetchAllDeputies();
    // Refuse to cache an empty payload — that just locks in a "no matches"
    // state for a week if the worker hiccups during this fetch.
    if (rows.length > 0) {
      try {
        // Cache the raw rows; tokens are cheap to recompute on read.
        await congresoCacheService.setCachedData(INDEX_CACHE_KEY, rows);
      } catch (err) {
        console.warn('[CongresoMatcher] cache write failed', err);
      }
    }
    return buildIndex(rows);
  })();
  // Clear the in-memory promise on empty result so the next call retries
  // instead of permanently serving a no-match index until page reload.
  indexPromise
    .then(idx => {
      if (!idx || idx.length === 0) indexPromise = null;
    })
    .catch(() => {
      indexPromise = null;
    });
  return indexPromise;
}

/**
 * Find the best matching deputy for an officer name.
 *
 * Returns null when no row in the index passes the dual gate
 * (≥ MIN_TOKEN_OVERLAP shared tokens AND Jaccard ≥ MIN_JACCARD), or
 * when the officer name itself doesn't have enough distinct tokens to
 * match safely (avoids spurious hits on common 2-token Spanish names).
 */
export async function findDeputyMatch(officerName) {
  if (!officerName) return null;
  const queryTokens = new Set(tokenizeName(officerName));
  if (queryTokens.size < 2) return null;

  const index = await loadIndex();
  let best = null;

  for (const entry of index) {
    let overlap = 0;
    for (const t of queryTokens) if (entry.tokens.has(t)) overlap += 1;
    if (overlap < MIN_TOKEN_OVERLAP) continue;
    const sim = jaccard(queryTokens, entry.tokens);
    if (sim < MIN_JACCARD) continue;
    if (!best || sim > best.confidence) {
      best = { deputy: entry.raw, rows: entry.rows, confidence: sim, overlap };
    }
  }

  return best;
}

// Test hook so we can clear the in-memory promise during dev iteration.
export function _resetMatcherCache() {
  indexPromise = null;
}
