import { describe, test, expect } from 'vitest';
import { roleKey, isCategoryUnambiguous, matchesRole } from './roleKey';
import { effectiveCategoryFromEvents } from './officerLinkStatus';

describe('roleKey', () => {
  test('ignores punctuation and spacing between the same abbreviation', () => {
    expect(roleKey('SEC.COM.AUD.')).toBe(roleKey('SEC COM AUD'));
    expect(roleKey('ADM. MANCOM.')).toBe(roleKey('ADM.MANCOM'));
  });

  test('folds accents and case', () => {
    expect(roleKey('Comisión')).toBe(roleKey('COMISION'));
  });

  test('keeps distinct committee roles apart', () => {
    const keys = ['M.COM.NOM.RE', 'MBRO.COM.AUD', 'SEC.COM.AUD.'].map(roleKey);
    expect(new Set(keys).size).toBe(3);
  });

  test('returns an empty key for a missing role', () => {
    expect(roleKey('')).toBe('');
    expect(roleKey(null)).toBe('');
    expect(roleKey(undefined)).toBe('');
  });
});

describe('isCategoryUnambiguous', () => {
  test('a lone role of its category is unambiguous', () => {
    // Arrange — one Consejero seat alongside an Apoderado one
    const pool = ['CONSEJERO', 'APODERADO'];

    // Act / Assert
    expect(isCategoryUnambiguous(pool, 'CONSEJERO')).toBe(true);
  });

  test('siblings sharing a category are ambiguous', () => {
    // All three are "Vocal / Comisión" — no event of that category can be
    // assigned to one of them without guessing.
    const pool = ['M.COM.NOM.RE', 'MBRO.COM.AUD', 'SEC.COM.AUD.'];
    expect(isCategoryUnambiguous(pool, 'M.COM.NOM.RE')).toBe(false);
  });

  test('the same role spelled twice is still one seat', () => {
    expect(isCategoryUnambiguous(['SEC.COM.AUD.', 'SEC COM AUD'], 'SEC.COM.AUD.')).toBe(true);
  });
});

describe('matchesRole', () => {
  test('an exactly-matching role attaches even among same-category siblings', () => {
    const pool = ['M.COM.NOM.RE', 'MBRO.COM.AUD', 'SEC.COM.AUD.'];
    expect(matchesRole('M.COM.NOM.RE', 'M.COM.NOM.RE', pool)).toBe(true);
  });

  test('a same-category sibling never attaches to another seat', () => {
    // The bug: a current M.COM.NOM.RE appointment reactivating unrelated
    // committee seats because all three share the "Vocal / Comisión" category.
    const pool = ['M.COM.NOM.RE', 'MBRO.COM.AUD', 'SEC.COM.AUD.'];
    expect(matchesRole('M.COM.NOM.RE', 'SEC.COM.AUD.', pool)).toBe(false);
    expect(matchesRole('M.COM.NOM.RE', 'MBRO.COM.AUD', pool)).toBe(false);
  });

  test('falls back to the category when the seat is the only one of its kind', () => {
    // The two stores can spell one role differently. With a single Consejero
    // seat there is nothing to confuse it with, so the category still decides.
    expect(matchesRole('CON.DELEGADO', 'CONS. DELEG.', ['CONS. DELEG.', 'APODERADO'])).toBe(true);
  });

  test('never crosses categories', () => {
    expect(matchesRole('APODERADO', 'CONSEJERO', ['CONSEJERO', 'APODERADO'])).toBe(false);
  });
});

/**
 * DAGA GELABERT TOMAS at GRIFOLS SA, the case this rule exists for.
 *
 * He holds six roles there. Only M.COM.NOM.RE is current — BORME appointed him
 * to it on 2025-08-01, after revoking it on 2024-08-16. The other five each
 * carry a later revocation. Matching events to links by CATEGORY made that one
 * appointment the latest "Vocal / Comisión" act for all three committee seats,
 * so two dead seats were drawn as live.
 *
 * Role strings below are verbatim from both stores, which publish the same
 * BORME cargo token.
 */
describe('the Grifols committee seats', () => {
  const LINK_ROLES = [
    'MBRO.COM.AUD',
    'CONS.OTR.EXT',
    'SEC.COM.AUD.',
    'VICESECRET.',
    'M.COM.NOM.RE',
    'APODERADO',
  ];

  const EVENTS = [
    { position: 'MBRO.COM.AUD', category: 'nombramientos', date: '2022-11-30' },
    { position: 'SEC.COM.AUD.', category: 'revocaciones', date: '2022-11-30' },
    { position: 'MBRO.COM.AUD', category: 'revocaciones', date: '2023-05-30' },
    { position: 'SEC.COM.AUD.', category: 'nombramientos', date: '2023-05-30' },
    { position: 'CONS.OTR.EXT', category: 'nombramientos', date: '2023-08-04' },
    { position: 'M.COM.NOM.RE', category: 'nombramientos', date: '2023-08-04' },
    { position: 'SEC.COM.AUD.', category: 'nombramientos', date: '2023-08-04' },
    { position: 'VICESECRET.', category: 'nombramientos', date: '2023-08-04' },
    { position: 'CONS.OTR.EXT', category: 'revocaciones', date: '2024-02-23' },
    { position: 'M.COM.NOM.RE', category: 'revocaciones', date: '2024-02-23' },
    { position: 'VICESECRET.', category: 'revocaciones', date: '2024-02-23' },
    { position: 'SEC.COM.AUD.', category: 'revocaciones', date: '2024-06-11' },
    { position: 'M.COM.NOM.RE', category: 'revocaciones', date: '2024-08-16' },
    { position: 'APODERADO', category: 'revocaciones', date: '2024-11-29' },
    { position: 'M.COM.NOM.RE', category: 'nombramientos', date: '2025-08-01' },
  ];

  // What the graph does per link: keep this role's events, then let the latest
  // one decide. The aggregate's own word is the fallback.
  const statusOf = (linkRole, fallbackCategory, fallbackDate) => {
    const own = EVENTS.filter(e => matchesRole(e.position, linkRole, LINK_ROLES));
    const category = effectiveCategoryFromEvents(own, fallbackCategory, fallbackDate);
    return category === 'nombramientos' || category === 'reelecciones' ? 'active' : 'ceased';
  };

  test('only the nominations-committee seat reads current', () => {
    expect(statusOf('M.COM.NOM.RE', 'ceses_dimisiones', '2024-02-23')).toBe('active');
  });

  test('the audit-committee seats stay ceased', () => {
    expect(statusOf('SEC.COM.AUD.', 'ceses_dimisiones', '2024-06-11')).toBe('ceased');
    expect(statusOf('MBRO.COM.AUD', 'ceses_dimisiones', '2023-05-30')).toBe('ceased');
  });

  test('the board, secretary and power-of-attorney seats stay ceased', () => {
    expect(statusOf('CONS.OTR.EXT', 'ceses_dimisiones', '2024-02-23')).toBe('ceased');
    expect(statusOf('VICESECRET.', 'ceses_dimisiones', '2024-02-23')).toBe('ceased');
    expect(statusOf('APODERADO', 'ceses_dimisiones', '2024-11-29')).toBe('ceased');
  });

  test('exactly one of the six seats is current', () => {
    const active = LINK_ROLES.filter(role => statusOf(role, 'ceses_dimisiones', null) === 'active');
    expect(active).toEqual(['M.COM.NOM.RE']);
  });
});
