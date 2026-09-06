import { describe, it, expect } from 'vitest';
import { officerNodeKey, officerIdFor } from './officerNodeKey';

describe('officerNodeKey', () => {
  it('produces the same key for every legal-form spelling of one entity', () => {
    // The graph must not create two nodes for the same corporate officer just
    // because autocomplete (raw BORME spelling) and v3 (canonical dotless)
    // disagree about the trailing legal form.
    const long = officerNodeKey('DROMO GESTION 2026 SOCIEDAD LIMITADA');
    const short = officerNodeKey('DROMO GESTION 2026 SL');
    const dotted = officerNodeKey('DROMO GESTION 2026 S.L.');

    expect(long).toBe(short);
    expect(dotted).toBe(short);
  });

  it('keeps different legal forms distinct', () => {
    expect(officerNodeKey('ACME SL')).not.toBe(officerNodeKey('ACME SA'));
  });

  it('lowercases and collapses whitespace/hyphens like the legacy key', () => {
    expect(officerNodeKey('FERNANDEZ-PACHECO SANCHEZ  ANTONIO')).toBe(
      'fernandez-pacheco-sanchez-antonio'
    );
  });

  it('is null-safe', () => {
    expect(officerNodeKey('')).toBe('');
    expect(officerNodeKey(null)).toBe('');
  });
});

describe('officerIdFor', () => {
  it('prefixes the canonical key', () => {
    expect(officerIdFor('DROMO GESTION 2026 SOCIEDAD LIMITADA')).toBe(
      'officer-dromo-gestion-2026-sl'
    );
  });
});

// --- filing-order folding ----------------------------------------------------
// BORME prints the same person both ways: FERNANDO ESPAÑA Y SENIOR GRANADA SL
// lists "JOSE GABINO SANCHEZ DELGADO", VITALSERVIT SL lists "SANCHEZ DELGADO
// JOSE GABINO". The backend folds these with rotation variants (officer_query
// _rotation_variants); the canvas must key nodes by the same rule or the one
// director is drawn twice.
import {
  officerNameRotations,
  isSameOfficerName,
  findOfficerNode,
  resolveOfficerNodeId,
  isSameOfficerIdentity,
} from './officerNodeKey';

describe('officerNameRotations', () => {
  it('mirrors the backend: leading 1-2 tokens to the end, trailing 1-2 to the front', () => {
    expect(officerNameRotations('SANCHEZ DELGADO JOSE GABINO')).toEqual([
      'DELGADO JOSE GABINO SANCHEZ',
      'GABINO SANCHEZ DELGADO JOSE',
      'JOSE GABINO SANCHEZ DELGADO',
    ]);
  });

  it('never rotates a corporate officer, a single token, or a name too long to be a person', () => {
    expect(officerNameRotations('DELOITTE SL')).toEqual([]);
    expect(officerNameRotations('PRICEWATERHOUSECOOPERS AUDITORES SOCIEDAD LIMITADA')).toEqual([]);
    expect(officerNameRotations('MADONNA')).toEqual([]);
    expect(officerNameRotations('A B C D E F G')).toEqual([]);
    expect(officerNameRotations('')).toEqual([]);
  });
});

describe('isSameOfficerName', () => {
  it('folds given-name-first and surname-first spellings of one person', () => {
    expect(isSameOfficerName('JOSE GABINO SANCHEZ DELGADO', 'SANCHEZ DELGADO JOSE GABINO')).toBe(true);
    expect(isSameOfficerName('SANCHEZ DELGADO JOSE GABINO', 'JOSE GABINO SANCHEZ DELGADO')).toBe(true);
    expect(isSameOfficerName('ISABEL TOCINO BISCAROLASAGA', 'TOCINO BISCAROLASAGA ISABEL')).toBe(true);
  });

  it('folds the hyphenated given name FAMILY SERVIT MURCIA printed', () => {
    expect(isSameOfficerName('JOSE-GABINO SANCHEZ DELGADO', 'SANCHEZ DELGADO JOSE GABINO')).toBe(true);
  });

  it('SAFETY: surname order is identity — a token sort would merge two men', () => {
    expect(isSameOfficerName('GARCIA MARTIN JOSE', 'MARTIN GARCIA JOSE')).toBe(false);
  });

  it('still folds legal-form spellings of one corporate officer, and nothing else', () => {
    expect(isSameOfficerName('DELOITTE S.L.', 'DELOITTE SOCIEDAD LIMITADA')).toBe(true);
    expect(isSameOfficerName('DELOITTE SL', 'SL DELOITTE')).toBe(false);
    expect(isSameOfficerName('', 'DELOITTE SL')).toBe(false);
  });
});

describe('findOfficerNode / resolveOfficerNodeId', () => {
  const director = {
    id: 'officer-sanchez-delgado-jose-gabino',
    name: 'SANCHEZ DELGADO JOSE GABINO',
    type: 'officer',
  };
  const companyTwin = {
    id: 'company-sanchez-delgado-jose-gabino',
    name: 'SANCHEZ DELGADO JOSE GABINO',
    type: 'spanish-company-group',
  };
  const nodes = [companyTwin, director];

  it('finds the person under the other filing order', () => {
    expect(findOfficerNode(nodes, 'JOSE GABINO SANCHEZ DELGADO')).toBe(director);
    expect(findOfficerNode(nodes, 'JOSE-GABINO SANCHEZ DELGADO')).toBe(director);
  });

  it('prefers the exact key when both spellings are somehow on the canvas', () => {
    const other = { id: 'officer-jose-gabino-sanchez-delgado', name: 'JOSE GABINO SANCHEZ DELGADO', type: 'officer' };
    expect(findOfficerNode([director, other], 'JOSE GABINO SANCHEZ DELGADO')).toBe(other);
  });

  it('never returns a company node, and is undefined when nobody matches', () => {
    expect(findOfficerNode([companyTwin], 'SANCHEZ DELGADO JOSE GABINO')).toBeUndefined();
    expect(findOfficerNode(nodes, 'GARCIA MARTIN JOSE')).toBeUndefined();
    expect(findOfficerNode(undefined, 'GARCIA MARTIN JOSE')).toBeUndefined();
  });

  it('resolves to the existing node id, else mints the id for the name', () => {
    expect(resolveOfficerNodeId(nodes, 'JOSE GABINO SANCHEZ DELGADO')).toBe(director.id);
    expect(resolveOfficerNodeId(nodes, 'GARCIA MARTIN JOSE')).toBe('officer-garcia-martin-jose');
  });
});

describe('isSameOfficerIdentity', () => {
  // The expand-officer exact-match filter: the API substring-matches, so the
  // client keeps only rows naming the searched officer. It must accept every
  // spelling the registry prints for one identity — legal-form and comma
  // variants of a corporate officer, the listed-entity alias, AND the other
  // filing order of a person — or seats silently vanish (2 of Sánchez
  // Delgado's 5 did).
  it('accepts the other filing order and the hyphenated given name', () => {
    expect(isSameOfficerIdentity('JOSE GABINO SANCHEZ DELGADO', 'SANCHEZ DELGADO JOSE GABINO')).toBe(true);
    expect(isSameOfficerIdentity('JOSE-GABINO SANCHEZ DELGADO', 'SANCHEZ DELGADO JOSE GABINO')).toBe(true);
  });

  it('keeps the corporate-officer rules the filter already had', () => {
    expect(isSameOfficerIdentity('BANCO SANTANDER SA', 'BANCO SANTANDER, SA')).toBe(true);
    expect(isSameOfficerIdentity('BANCO SANTANDER', 'BANCO SANTANDER, SA')).toBe(true);
  });

  it('still rejects a longer name and a different surname order', () => {
    expect(isSameOfficerIdentity('PIÑEIRO GOMEZ JOSE MANUEL', 'PIÑEIRO GOMEZ JOSE')).toBe(false);
    expect(isSameOfficerIdentity('MARTIN GARCIA JOSE', 'GARCIA MARTIN JOSE')).toBe(false);
  });
});
