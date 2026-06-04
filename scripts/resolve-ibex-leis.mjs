/**
 * One-off: resolve each IBEX 35 seed ISIN -> LEI via the public GLEIF API,
 * so the LEI can be baked into _ibex35.js (the /lei-relationships endpoint
 * needs a LEI, not an ISIN). Run: node scripts/resolve-ibex-leis.mjs
 */
import { SEED } from '../functions/empresa/_ibex35.js';

const GLEIF = 'https://api.gleif.org/api/v1/lei-records';

async function isinToLei(isin) {
  const url = `${GLEIF}?filter[isin]=${encodeURIComponent(isin)}&page[size]=5`;
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) return null;
  const d = await r.json();
  const rec = (d.data || [])[0];
  return rec ? { lei: rec.id, name: rec.attributes?.entity?.legalName?.name } : null;
}

const failures = [];
for (const [slug, v] of Object.entries(SEED)) {
  if (!v.isin) { failures.push([slug, 'no ISIN']); continue; }
  try {
    const hit = await isinToLei(v.isin);
    if (hit) {
      console.log(`  '${slug}': lei '${hit.lei}'  // ${hit.name}`);
    } else {
      failures.push([slug, `no LEI for ISIN ${v.isin}`]);
    }
  } catch (e) {
    failures.push([slug, e.message]);
  }
  await new Promise((res) => setTimeout(res, 250)); // be polite to GLEIF
}

if (failures.length) {
  console.error('\nUNRESOLVED (resolve by name at https://search.gleif.org and add manually):');
  for (const [slug, why] of failures) console.error(`  ${slug}: ${why}`);
}
