/**
 * Validates every CONFIRMATIONS entry: (1) its slug resolves to a real curated/
 * seed company, and (2) the named representative is a CURRENT officer of that
 * company in the live v3 index (registry-officer-match — the authority anchor).
 * Fails the build (exit 1) on any violation, so a confirmation can never ship
 * for someone the registry doesn't list as running the company.
 * Run: node scripts/check-confirmations.mjs
 */
import { CONFIRMATIONS } from '../functions/empresa/_confirmations.js';
import { resolveSlug } from '../functions/empresa/_resolve.js';
import { nameIsOfficer } from '../functions/empresa/_confirmation.js';

const API = 'https://api.ncdata.eu';
let failures = 0;

for (const [slug, rec] of Object.entries(CONFIRMATIONS)) {
  const resolved = resolveSlug(slug);
  if (resolved.kind === 'notfound') {
    console.error(`✗ ${slug}: slug does not resolve (add it to CURATED/SEED first)`);
    failures++;
    continue;
  }
  const name = resolved.entry.v3Name;
  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 10_000);
    const r = await fetch(`${API}/bormes/v3/company/${encodeURIComponent(name)}`, { signal: ac.signal });
    clearTimeout(timeout);
    const data = r.ok ? await r.json() : null;
    const company = data && data.company;
    if (!company) {
      console.error(`✗ ${slug}: '${name}' returned no company`);
      failures++;
      continue;
    }
    const officers = (company.officers_active || [])
      .map((o) => o.name || o.name_normalized)
      .filter(Boolean);
    if (!nameIsOfficer(rec.representative, officers)) {
      console.error(
        `✗ ${slug}: representative '${rec.representative}' is not a current officer (${officers.join('; ') || 'none on record'})`,
      );
      failures++;
      continue;
    }
    console.log(`✓ ${slug} → ${rec.representative} verified as a current officer of ${company.company_name}`);
  } catch (e) {
    console.error(`✗ ${slug}: fetch error ${e.message}`);
    failures++;
  }
}

if (failures) {
  console.error(`\n${failures} confirmation(s) failed validation.`);
  process.exit(1);
}
console.log(`\nAll ${Object.keys(CONFIRMATIONS).length} confirmation(s) valid.`);
