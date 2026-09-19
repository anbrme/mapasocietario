import { describe, it, expect } from 'vitest';
import { findCompanyNode } from './companyNodeLookup';

// The canvas keys company nodes on their display name. A declared sole
// shareholder arrives under whatever spelling the act printed ("FAMILY SERVIT
// SOCIEDAD LIMITADA"), while the company doc — and its node — carries the
// canonical dotless form ("FAMILY SERVIT SL"). Both are ONE entity and must
// land on ONE node.
const familyServit = {
  id: 'company-family-servit-sl',
  name: 'FAMILY SERVIT SL',
  type: 'spanish-company-group',
};
const officerTwin = {
  id: 'officer-family-servit-sl',
  name: 'FAMILY SERVIT SL',
  type: 'officer',
  subtype: 'company',
};
const nodes = [familyServit, officerTwin];

describe('findCompanyNode', () => {
  it('finds a node by its exact id', () => {
    expect(findCompanyNode(nodes, 'anything', 'company-family-servit-sl')).toBe(familyServit);
  });

  it('folds the long legal-form spelling onto the canonical company node', () => {
    // The FAMILY SERVIT case: the socio único of FERNANDO ESPAÑA Y SENIOR
    // GRANADA SL was declared as "FAMILY SERVIT SOCIEDAD LIMITADA" and drawn
    // as a second, hollow node beside the real FAMILY SERVIT SL.
    expect(findCompanyNode(nodes, 'FAMILY SERVIT SOCIEDAD LIMITADA')).toBe(familyServit);
    expect(findCompanyNode(nodes, 'FAMILY SERVIT, S.L.')).toBe(familyServit);
    expect(findCompanyNode(nodes, 'family servit sl')).toBe(familyServit);
  });

  it('never returns an officer node for a company name', () => {
    expect(findCompanyNode([officerTwin], 'FAMILY SERVIT SL')).toBeUndefined();
  });

  it('keeps different legal forms and different companies apart', () => {
    expect(findCompanyNode(nodes, 'FAMILY SERVIT SA')).toBeUndefined();
    expect(findCompanyNode(nodes, 'FAMILY SERVIT MURCIA SL')).toBeUndefined();
  });

  it('is undefined for an empty name or an empty canvas', () => {
    expect(findCompanyNode(nodes, '')).toBeUndefined();
    expect(findCompanyNode([], 'FAMILY SERVIT SL')).toBeUndefined();
    expect(findCompanyNode(undefined, 'FAMILY SERVIT SL')).toBeUndefined();
  });
});

describe('findCompanyNode — group_key identity', () => {
  // Spanish company names are unique at any given MOMENT, not across time: the
  // registry releases a name once the company is extinguished, and a new,
  // unrelated company takes it. Entity assembly already decides this on the
  // server (temporal compatibility + reuse guard) and hands us two docs with
  // two group_keys. The canvas must not re-merge what the server split.
  //
  // Real pair, verified act by act: PERSONAL FITNESS SL — H:A-141827 (Alicante)
  // runs Constitucion 2014-10-15 -> Extincion 2018-02-27, and H:GC-57012 (Las
  // Palmas) OPENS with its own Constitucion 2020-07-14. Two incorporations, two
  // companies, one name. Same shape in JIMENEZ CAPARROS SL (AL-4278 extinguished
  // 2012, AL-49090 incorporated 2018 — same province) and RESIDENCIA VIRGEN DEL
  // ROSARIO SL (AB-6473 extinguished 2013, CR-28945 incorporated 2017).
  const dissolved = {
    id: 'company-personal-fitness-sl',
    name: 'PERSONAL FITNESS SL',
    type: 'spanish-company-group',
    groupKey: 'H:A-141827',
  };

  it('does not fold a reused name onto the earlier company', () => {
    expect(findCompanyNode([dissolved], 'PERSONAL FITNESS SL', null, 'H:GC-57012')).toBeUndefined();
  });

  it('folds when the group_key agrees, whatever the spelling', () => {
    expect(findCompanyNode([dissolved], 'PERSONAL FITNESS, S.L.', null, 'H:A-141827')).toBe(
      dissolved
    );
  });

  it('falls back to the name when either side has no group_key', () => {
    // Most insert paths (autocomplete rows, declared owners) carry no key.
    expect(findCompanyNode([dissolved], 'PERSONAL FITNESS SL')).toBe(dissolved);
    const unkeyed = { ...dissolved, groupKey: null };
    expect(findCompanyNode([unkeyed], 'PERSONAL FITNESS SL', null, 'H:GC-57012')).toBe(unkeyed);
  });

  it('still matches by exact id even when a group_key is passed', () => {
    expect(
      findCompanyNode([dissolved], 'whatever', 'company-personal-fitness-sl', 'H:GC-57012')
    ).toBe(dissolved);
  });
});
