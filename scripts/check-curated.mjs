/**
 * Validates every curated company entry resolves in the live v3 index.
 *  - CURATED entries (no hoja) resolve by v3Name.
 *  - SEED (IBEX 35) entries resolve by hoja → group_key, mirroring the
 *    page's lookup in functions/empresa/_lib.js. This catches enrichment
 *    re-canonicalizations that silently 404'd 5 indexed pages in July 2026.
 * Fails the build (exit 1) on any entry that returns no company.
 * Run: node scripts/check-curated.mjs
 */
import { CURATED } from '../functions/empresa/_curated.js';
import { SEED } from '../functions/empresa/_ibex35.js';

const API = 'https://api.ncdata.eu';
let failures = 0;

async function fetchCompany(url) {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 10_000);
  try {
    const r = await fetch(url, { signal: ac.signal });
    const data = r.ok ? await r.json() : null;
    return (data && data.company) || null;
  } finally {
    clearTimeout(timeout);
  }
}

for (const [slug, entry] of Object.entries(CURATED)) {
  try {
    const company = await fetchCompany(`${API}/bormes/v3/company/${encodeURIComponent(entry.v3Name)}`);
    if (!company) {
      console.error(`✗ ${slug}: v3Name '${entry.v3Name}' returned no company`);
      failures++;
    } else {
      console.log(`✓ ${slug} → ${company.company_name}`);
    }
  } catch (e) {
    console.error(`✗ ${slug}: fetch error ${e.message}`);
    failures++;
  }
}

for (const [slug, entry] of Object.entries(SEED)) {
  const groupKey = `H:${entry.hoja.replace(/\s+/g, '-')}`;
  try {
    const company = await fetchCompany(`${API}/bormes/v3/company?group_key=${encodeURIComponent(groupKey)}`);
    if (!company) {
      console.error(`✗ ${slug}: group_key '${groupKey}' returned no company`);
      failures++;
      continue;
    }
    console.log(`✓ ${slug} → ${company.company_name} (${groupKey})`);
    if (company.company_name !== entry.v3Name) {
      console.warn(`  ⚠ ${slug}: stored v3Name '${entry.v3Name}' ≠ live doc name '${company.company_name}' (fallback path would miss)`);
    }
  } catch (e) {
    console.error(`✗ ${slug}: fetch error ${e.message}`);
    failures++;
  }
}

const total = Object.keys(CURATED).length + Object.keys(SEED).length;
if (failures) {
  console.error(`\n${failures} entr${failures === 1 ? 'y' : 'ies'} failed validation.`);
  process.exit(1);
}
console.log(`\nAll ${total} curated + seed entries resolve.`);
