/**
 * Validates every CURATED entry resolves to a real company in the live v3 index.
 * Fails the build (exit 1) on any entry whose v3Name returns no company.
 * Run: node scripts/check-curated.mjs
 */
import { CURATED } from '../functions/empresa/_curated.js';

const API = 'https://api.ncdata.eu';
let failures = 0;

for (const [slug, entry] of Object.entries(CURATED)) {
  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 10_000);
    const r = await fetch(`${API}/bormes/v3/company/${encodeURIComponent(entry.v3Name)}`, { signal: ac.signal });
    clearTimeout(timeout);
    const data = r.ok ? await r.json() : null;
    const company = data && data.company;
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

if (failures) {
  console.error(`\n${failures} curated entr${failures === 1 ? 'y' : 'ies'} failed validation.`);
  process.exit(1);
}
console.log(`\nAll ${Object.keys(CURATED).length} curated entries resolve.`);
