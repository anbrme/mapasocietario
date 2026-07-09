/**
 * Builds the verified data snapshot for the IBEX-35 interlocking-boards study.
 *
 * Pipeline: fetch every seed company's live board from the v3 API → cluster
 * people across companies by TOKEN-SET identity (so name-order flips and
 * middle-name variants match) → apply the hand-maintained CORRECTIONS overlay
 * (reject spurious auto-merges, force spelling-variant merges) → derive edges
 * and stats → write src/data/interlock-ibex35.json.
 *
 * THIS is the manual-correction surface. When you spot a wrong or missing
 * interlock, edit CORRECTIONS below and re-run `node scripts/generate-interlock-data.mjs`.
 * Everything downstream (edges, stats, graph) is derived — you never hand-edit
 * the JSON. Consumed by scripts/generate-interlock-study.mjs at build time.
 *
 * Run manually (not in the build) so publishing stays a deliberate act.
 */

import { writeFileSync } from 'node:fs';
import { SEED } from '../functions/empresa/_ibex35.js';

const API = 'https://api.ncdata.eu/bormes/v3/company';
const OUT = new URL('../src/data/interlock-ibex35.json', import.meta.url);
const AS_OF = process.env.INTERLOCK_AS_OF || '2026-07-09';

// ---------------------------------------------------------------------------
// HAND-MAINTAINED CORRECTIONS OVERLAY  (the manual-correction surface)
// ---------------------------------------------------------------------------
const CORRECTIONS = {
  // Same corporate group → an interlock is expected, so we tag it rather than
  // present it as a surprising cross-group link.
  affiliatedGroups: [['acciona', 'acciona-energia']],

  // Auto-merges the clusterer got WRONG (false positives). Each pair lists two
  // board-member names that are DIFFERENT people the token overlap wrongly fused.
  rejectMerges: [
    // José Antonio Torre de Silva López de Letona (Naturgy)  ≠  Antonio López López (Unicaja)
    ['TORRE DE SILVA LOPEZ DE LETONA JOSE ANTONIO', 'LOPEZ LOPEZ ANTONIO'],
  ],

  // Same person the clusterer MISSED (spelling / language variants it can't
  // safely auto-merge). Each group lists names that are one real person.
  forceMerges: [
    // Josep Oliu Creus (Banco Sabadell chairman) also sits on Puig's board,
    // where the registry records the Castilian "José".
    ['OLIU CREUS JOSEP', 'OLIU CREUS JOSE'],
  ],
};

// ---------------------------------------------------------------------------
const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => stripAccents(String(s || '').toUpperCase()).replace(/[.\-,]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'DA', 'DO', 'SAN']);
const tokens = (name) => norm(name).split(' ').filter((x) => x && !STOP.has(x));
const tokenSet = (name) => new Set(tokens(name));
const groupKey = (hoja) => `H:${hoja.replace(/\s+/g, '-')}`;

const pairKey = (a, b) => [a, b].sort().join('##');
const rejectSet = new Set(CORRECTIONS.rejectMerges.map(([a, b]) => pairKey(norm(a), norm(b))));

async function boardOf(slug, seed) {
  const url = `${API}?group_key=${encodeURIComponent(groupKey(seed.hoja))}&full_officers=1`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${slug} HTTP ${r.status}`);
  const co = (await r.json()).company || {};
  const seen = new Map(); // name_normalized -> display name (first seen)
  for (const o of co.officers_active || []) {
    if (o.seat !== 'BOARD') continue;
    const key = o.name_normalized || o.name;
    if (!seen.has(key)) seen.set(key, o.name);
  }
  return { slug, name: seed.name, members: [...seen.values()] };
}

// Token-set identity: same person if the smaller name's tokens (>=2) are all
// contained in the larger. Equality catches order flips; subset catches middle
// names. Rejected pairs from CORRECTIONS are never merged here.
function autoSamePerson(a, b) {
  if (rejectSet.has(pairKey(norm(a), norm(b)))) return false;
  const A = tokenSet(a);
  const B = tokenSet(b);
  const small = A.size <= B.size ? A : B;
  const big = A.size <= B.size ? B : A;
  if (small.size < 2) return false;
  return [...small].every((t) => big.has(t));
}

const slugs = Object.keys(SEED);
const boards = [];
for (const slug of slugs) {
  boards.push(await boardOf(slug, SEED[slug]));
  process.stderr.write(`  ${slug}\n`);
}

// Union-find over "slug|name" identities.
const parent = new Map();
const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
const union = (a, b) => { if (!parent.has(a)) parent.set(a, a); if (!parent.has(b)) parent.set(b, b); parent.set(find(a), find(b)); };
for (const b of boards) for (const n of b.members) parent.set(`${b.slug}|${n}`, `${b.slug}|${n}`);

// Auto merges.
for (let i = 0; i < boards.length; i++) {
  for (let j = i + 1; j < boards.length; j++) {
    for (const an of boards[i].members) {
      for (const bn of boards[j].members) {
        if (autoSamePerson(an, bn)) union(`${boards[i].slug}|${an}`, `${boards[j].slug}|${bn}`);
      }
    }
  }
}
// Forced merges from CORRECTIONS: union every board node whose name matches any
// variant in the group.
for (const grp of CORRECTIONS.forceMerges) {
  const want = new Set(grp.map(norm));
  const nodes = [];
  for (const b of boards) for (const n of b.members) if (want.has(norm(n))) nodes.push(`${b.slug}|${n}`);
  for (let k = 1; k < nodes.length; k++) union(nodes[0], nodes[k]);
}

// Collect clusters.
const clusters = new Map();
for (const b of boards) for (const n of b.members) {
  const root = find(`${b.slug}|${n}`);
  if (!clusters.has(root)) clusters.set(root, []);
  clusters.get(root).push({ slug: b.slug, name: n });
}

const affiliated = (s1, s2) =>
  CORRECTIONS.affiliatedGroups.some((g) => g.includes(s1) && g.includes(s2));

// people_multi: one entry per person on >=2 distinct boards.
const nameByCount = (variants) => [...variants].sort((a, b) => tokens(b).length - tokens(a).length)[0];
const peopleMulti = [];
for (const members of clusters.values()) {
  const bySlug = new Map();
  for (const m of members) if (!bySlug.has(m.slug)) bySlug.set(m.slug, m.name);
  if (bySlug.size < 2) continue;
  const companies = [...bySlug.keys()].map((slug) => ({ slug, name: SEED[slug].name }));
  const allAffiliated = companies.every((c, _i, arr) => arr.every((d) => c.slug === d.slug || affiliated(c.slug, d.slug)));
  peopleMulti.push({
    name: nameByCount(members.map((m) => m.name)),
    variants: [...new Set(members.map((m) => m.name))],
    count: bySlug.size,
    companies,
    affiliated: allAffiliated,
  });
}
peopleMulti.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

// edges: one per connected company pair, listing the shared people.
const edgeMap = new Map();
for (const p of peopleMulti) {
  for (let i = 0; i < p.companies.length; i++) {
    for (let j = i + 1; j < p.companies.length; j++) {
      const [a, b] = [p.companies[i], p.companies[j]].sort((x, y) => x.slug.localeCompare(y.slug));
      const key = `${a.slug}|${b.slug}`;
      if (!edgeMap.has(key)) edgeMap.set(key, { a: a.slug, a_name: a.name, b: b.slug, b_name: b.name, shared: [], affiliated: affiliated(a.slug, b.slug) });
      edgeMap.get(key).shared.push(p.name);
    }
  }
}
const edges = [...edgeMap.values()].sort((e, f) => f.shared.length - e.shared.length || e.a.localeCompare(f.a));

const boardSizes = boards
  .map((b) => ({ slug: b.slug, name: b.name, count: b.members.length }))
  .sort((a, b) => b.count - a.count);

const connected = new Set(edges.flatMap((e) => [e.a, e.b]));
const stats = {
  total_people_multi: peopleMulti.length,
  cross_group_people: peopleMulti.filter((p) => !p.affiliated).length,
  on_three: peopleMulti.filter((p) => p.count >= 3).length,
  companies_connected: connected.size,
  companies_isolated: slugs.length - connected.size,
  edges_total: edges.length,
  edges_cross_group: edges.filter((e) => !e.affiliated).length,
};

const snapshot = {
  as_of: AS_OF,
  universe: 'IBEX 35',
  n_companies: slugs.length,
  methodology_note:
    'Boards reflect BORME-active board seats (seat=BOARD) per company; a person on >=2 IBEX-35 boards is a shared director. Person identity is resolved across companies by surname+given-name token matching, then hand-verified via a corrections overlay to reject homonyms and merge spelling variants.',
  board_sizes: boardSizes,
  people_multi: peopleMulti,
  edges,
  stats,
};

writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
process.stderr.write(`\nwrote ${OUT.pathname}\n`);
console.log(JSON.stringify(stats, null, 2));
console.log('\nOn 3+ boards:');
for (const p of peopleMulti.filter((x) => x.count >= 3)) console.log(`  ${p.count}  ${p.name}  [${p.companies.map((c) => c.slug).join(', ')}]`);
// Sanity guard: an IBEX-35 company with a tiny board almost always means the
// SEED hoja points at the wrong entity (a subsidiary), not genuine under-capture.
// This is how the Grifols/Mapfre wrong-seed bug surfaced — treat as a red flag.
const TINY_BOARD = 4;
const suspicious = boardSizes.filter((x) => x.count < TINY_BOARD);
if (suspicious.length) {
  process.stderr.write(`\n⚠️  SUSPICIOUS board sizes (<${TINY_BOARD} seats) — likely a wrong SEED hoja, verify the entity:\n`);
  for (const b of suspicious) process.stderr.write(`     ${b.count}  ${b.name} (${b.slug})\n`);
}
