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
