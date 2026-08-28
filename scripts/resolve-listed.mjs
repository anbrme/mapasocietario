#!/usr/bin/env node
/**
 * Resolve a listed company to its BORME registry entity, the way the IBEX 35
 * seed was resolved by hand: ISIN -> LEI -> GLEIF legal name -> BORME doc.
 *
 *   node scripts/resolve-listed.mjs selfcheck        # reproduce the 35 verified seeds
 *   node scripts/resolve-listed.mjs resolve <isin>...
 *
 * Why not match on the traded name: the listed entity is NOT the brand.
 * "INDITEX" is a brand; the listed issuer is INDUSTRIA DE DISEÑO TEXTIL SA.
 * Publishing a famous brand's page against the wrong hoja is a worse error
 * than publishing nothing, so every hop here is an identifier, never a string
 * that merely looks right. GLEIF is the pivot because it is the only free
 * source that maps a tradable instrument to a LEGAL name plus a national
 * registration ID.
 */
const GLEIF = 'https://api.gleif.org/api/v1';
const BORME = 'https://api.ncdata.eu';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries - 1) return null;
      await sleep(1200 * (i + 1));
    }
  }
  return null;
}

/** ISIN -> the LEI record of the issuer, with its legal name and national id. */
export async function gleifByIsin(isin) {
  const data = await getJson(`${GLEIF}/lei-records?filter[isin]=${encodeURIComponent(isin)}&page[size]=1`);
  const rec = data?.data?.[0];
  if (!rec) return null;
  const a = rec.attributes || {};
  return {
    lei: a.lei,
    legalName: a.entity?.legalName?.name || '',
    country: a.entity?.legalAddress?.country || '',
    nationalId: a.entity?.registeredAs || '',
    status: a.entity?.status || '',
  };
}

const normalise = (s) => (s || '').toUpperCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
const nifKey = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * GLEIF writes legal forms out in full ("SOCIEDAD ANONIMA"); BORME abbreviates
 * ("SA"). Without this, BBVA and Amadeus — both correctly identified by GLEIF —
 * found no registry doc at all.
 */
export function nameVariants(name) {
  // BME writes legal forms with stops and commas ("CASTELLANA PROPERTIES
  // SOCIMI, S.A."); BORME writes them bare ("CASTELLANA PROPERTIES SOCIMI SA").
  const punctuated = name
    .replace(/\bS\.A\.U\.?/gi, 'SAU')
    .replace(/\bS\.A\.D\.?/gi, 'SAD')
    .replace(/\bS\.A\.?(?=$|[\s,])/gi, 'SA')
    .replace(/\bS\.L\.U\.?/gi, 'SLU')
    .replace(/\bS\.L\.?(?=$|[\s,])/gi, 'SL')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const forms = [
    [/\bSOCIEDAD\s+ANONIMA\b/gi, 'SA'],
    [/\bSOCIEDAD\s+LIMITADA\b/gi, 'SL'],
    [/\bSOCIEDAD\s+DE\s+RESPONSABILIDAD\s+LIMITADA\b/gi, 'SL'],
    [/\bSOCIEDAD\s+ANONIMA\s+UNIPERSONAL\b/gi, 'SAU'],
  ];
  const out = [name, punctuated];
  for (const base of [name, punctuated]) {
    for (const [re, short] of forms) {
      if (re.test(base)) out.push(base.replace(re, short));
    }
  }
  return [...new Set(out.map((n) => n.replace(/\s+/g, ' ').trim()).filter(Boolean))];
}

/** GLEIF legal name -> the v3 company doc, then its stable group_key. */
export async function bormeByName(name) {
  let data = null;
  for (const variant of nameVariants(name)) {
    data = await getJson(`${BORME}/bormes/v3/company/${encodeURIComponent(variant)}`);
    if (data?.company) break;
  }
  const c = data?.company;
  if (!c) return null;
  return {
    groupKey: c.group_key || c._id || null,
    name: c.company_name || '',
    hojas: c.hojas || [],
    nif: c.nif || c.enriched_nif || '',
    province: c.province || '',
    dissolved: !!c.is_dissolved,
  };
}

/**
 * A match is only reported CONFIRMED when two independent identifiers agree:
 * the GLEIF legal name round-trips to the doc's own name, and the national
 * registration id matches the NIF the registry holds. Name-only agreement is
 * reported separately as `name_only` and must be eyeballed before it ships.
 */
export async function resolveIsin(isin) {
  const g = await gleifByIsin(isin);
  if (!g) return { isin, verdict: 'no_lei' };
  if (g.country && g.country !== 'ES') return { isin, verdict: 'not_spanish', ...g };
  const b = await bormeByName(g.legalName);
  if (!b) return { isin, verdict: 'no_borme_doc', ...g };

  // Compare against every spelling variant, not the raw GLEIF string. GLEIF
  // writes "BODEGAS RIOJANAS SOCIEDAD ANONIMA" where BORME writes "BODEGAS
  // RIOJANAS SA"; without this, four correct matches were reported as
  // conflicts and buried the three that were real.
  const nameAgrees = nameVariants(g.legalName).some((v) => normalise(v) === normalise(b.name));
  const nifAgrees = !!g.nationalId && !!b.nif && nifKey(b.nif) === nifKey(g.nationalId);
  const verdict = nameAgrees && nifAgrees ? 'confirmed'
    : nifAgrees ? 'nif_only'
    : nameAgrees ? 'name_only'
    : 'conflict';
  return { isin, verdict, ...g, borme: b };
}

/**
 * Resolve by NAME alone, for a list that ships no ISINs (BME Growth's table).
 *
 * Without an ISIN there is no GLEIF hop, so there is no second identifier to
 * agree with: the best this can return is `name_match`, never `confirmed`. That
 * distinction is the point. A name that round-trips is a strong candidate, not
 * a verified one, and the tier that fooled us before (BANCO SABADELL landing on
 * the wrong hoja) looked exactly like a clean name match.
 */
export async function resolveName(name) {
  const b = await bormeByName(name);
  if (!b) return { input: name, verdict: 'no_borme_doc' };
  const agrees = normalise(b.name) === normalise(name)
    || normalise(b.name) === normalise(nameVariants(name)[1] || '');
  return {
    input: name,
    verdict: agrees ? 'name_match' : 'name_differs',
    borme: b,
  };
}

async function main() {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === 'selfcheck') {
    const { SEED } = await import('../functions/empresa/_ibex35.js');
    const rows = Object.entries(SEED).filter(([, v]) => v.isin);
    console.log(`self-check against ${rows.length} hand-verified IBEX 35 seeds\n`);
    const tally = {};
    for (const [slug, seed] of rows) {
      const r = await resolveIsin(seed.isin);
      const want = nifKey(seed.hoja);
      const got = (r.borme?.hojas || []).map(nifKey);
      const hojaOk = got.some((h) => h === want || h.replace(/^([A-Z]+)0+/, '$1') === want.replace(/^([A-Z]+)0+/, '$1'));
      const key = `${r.verdict}${r.borme ? (hojaOk ? ' / hoja matches seed' : ' / HOJA DIFFERS') : ''}`;
      tally[key] = (tally[key] || 0) + 1;
      if (!hojaOk && r.borme) console.log(`  ${slug}: seed hoja ${seed.hoja} vs resolved ${r.borme.hojas.join(',')} (${r.verdict})`);
      else if (!r.borme) console.log(`  ${slug}: ${r.verdict} (${r.legalName || 'no GLEIF record'})`);
      await sleep(250);
    }
    console.log('\n  outcome                                    n');
    for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(42)} ${String(n).padStart(3)}`);
    }
    return;
  }
  if (mode === 'names') {
    const file = rest[0];
    const names = (await import('node:fs/promises')).then;
    const { readFile } = await import('node:fs/promises');
    const list = (await readFile(file, 'utf8')).split('\n').map((l) => l.trim()).filter(Boolean);
    const out = [];
    for (const name of list) {
      const r = await resolveName(name);
      out.push(r);
      await sleep(200);
    }
    const tally = {};
    for (const r of out) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
    console.error(`resolved ${out.length} names`);
    for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
      console.error(`  ${k.padEnd(16)} ${String(n).padStart(4)}`);
    }
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  if (mode === 'resolve') {
    for (const isin of rest) {
      const r = await resolveIsin(isin);
      console.log(JSON.stringify(r));
      await sleep(250);
    }
    return;
  }
  console.log('usage: resolve-listed.mjs selfcheck | resolve <isin>...');
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
