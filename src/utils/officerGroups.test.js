import { describe, expect, test } from 'vitest';
import {
  groupOfficersForDisplay,
  pairRepresentatives143,
} from './officerGroups.js';

// The Art. 143 RRM representative is the natural person who exercises the
// office when a COMPANY is appointed administrator. BORME publishes the
// representative as a row of its own and never says which corporate officer
// they act for, so the pairing below is our inference — and it is only made
// when the table leaves no room for doubt.
//
// Mirrors tests_rep143_pairing.py in ncdata-bormes; the two must agree.

const row = (name, pos, extra = {}) => ({
  name,
  position_normalized: pos,
  appointed_date: '2020-01-01',
  ...extra,
});

// LIDL SUPERMERCADOS SA, former officers: one corporate sole administrator and
// one representative. Dates omitted — they play no part in the rule.
const LIDL_PAIR = [
  row('GESTION DE AUTOSERVICIOS ADLID SL', 'ADM.UNICO'),
  row('ARANDA PANKOW MIGUEL WERNER', 'REPR.143 RRM'),
];

// SPANAIR SA (dissolved), former officers: two corporate consejeros and three
// representatives. FIRA INTERNACIONAL DE BARCELONA carries no legal-form
// suffix, so the classifier reads it as a person — which only makes the case
// MORE ambiguous, never less.
const SPANAIR_AMBIGUOUS = [
  row('INVERSIONS TURISTIQUES I COMERCIALS 2009 SA', 'CONSEJERO'),
  row('FIRA INTERNACIONAL DE BARCELONA', 'CONSEJERO'),
  row('SORIANO COMPTE FERRAN', 'CONSEJERO'),
  row('CORDON BARRENECHEA ARANDO AGUSTI', 'REPR.143 RRM'),
  row('SUÑOL TREPAT RAFAEL', 'REPR.143 RRM'),
  row('ALBANELL MIRA MANUEL', 'REPR.143 RRM'),
];

describe('pairRepresentatives143', () => {
  test('one corporate director + one representative: the representative folds into the director row', () => {
    const paired = pairRepresentatives143(LIDL_PAIR);

    expect(paired).toHaveLength(1);
    expect(paired[0].name).toBe('GESTION DE AUTOSERVICIOS ADLID SL');
    expect(paired[0].position_normalized).toBe('ADM.UNICO');
    expect(paired[0].representative.name).toBe('ARANDA PANKOW MIGUEL WERNER');
  });

  test('does not mutate its input', () => {
    const input = LIDL_PAIR.map(o => ({ ...o }));
    pairRepresentatives143(input);
    expect(input).toEqual(LIDL_PAIR);
    expect(input[0].representative).toBeUndefined();
  });

  test('every row of the corporate director carries the representative', () => {
    // A corporate consejero that also chairs: two rows, one person. The
    // collapse step keeps the first row's fields, so both must carry it.
    const paired = pairRepresentatives143([
      row('HOLDING SL', 'CONSEJERO'),
      row('HOLDING SL', 'PRESIDENTE'),
      row('PERSONA FISICA', 'REPR.143 RRM'),
    ]);
    expect(paired.filter(o => o.representative)).toHaveLength(2);
    expect(paired.some(o => o.position_normalized === 'REPR.143 RRM')).toBe(false);
  });

  test('several corporate directors or several representatives: nobody is paired', () => {
    const paired = pairRepresentatives143(SPANAIR_AMBIGUOUS);

    expect(paired).toHaveLength(SPANAIR_AMBIGUOUS.length);
    expect(paired.some(o => o.representative)).toBe(false);
    expect(paired.some(o => o.representativeAlone)).toBe(false);
  });

  test('one corporate director + two representatives is ambiguous too', () => {
    // A corporate administrator has ONE permanent representative at a time;
    // two live rows means one was never ceased, and we cannot tell which.
    const paired = pairRepresentatives143([
      row('HOLDING SL', 'ADM.UNICO'),
      row('PRIMERA PERSONA', 'REPR.143 RRM'),
      row('SEGUNDA PERSONA', 'REPR.143 RRM'),
    ]);
    expect(paired.some(o => o.representative)).toBe(false);
    expect(paired.filter(o => o.position_normalized === 'REPR.143 RRM')).toHaveLength(2);
  });

  test('two corporate directors + one representative is ambiguous', () => {
    const paired = pairRepresentatives143([
      row('HOLDING UNO SL', 'ADM. MANCOM.'),
      row('HOLDING DOS SL', 'ADM. MANCOM.'),
      row('PERSONA FISICA', 'REPR.143 RRM'),
    ]);
    expect(paired.some(o => o.representative)).toBe(false);
  });

  test('no corporate director: pairs with a single corporate liquidator instead', () => {
    // 1,593 dissolved companies hold their only corporate officer as
    // LIQUIDADOR. A liquidator is not a board seat, so the representative
    // follows the liquidator's row wherever the surface files it.
    const paired = pairRepresentatives143([
      row('SOCIO FUNDADOR', 'ADM.UNICO'),
      row('UNA LIQUIDADORA SL', 'LIQUIDADOR'),
      row('PERSONA FISICA', 'REPR.143 RRM'),
    ]);
    const liquidator = paired.find(o => o.position_normalized === 'LIQUIDADOR');
    expect(liquidator.representative.name).toBe('PERSONA FISICA');
    expect(paired.some(o => o.position_normalized === 'REPR.143 RRM')).toBe(false);
  });

  test('a corporate director takes precedence over a corporate liquidator', () => {
    const paired = pairRepresentatives143([
      row('HOLDING SL', 'ADM.UNICO'),
      row('UNA LIQUIDADORA SL', 'LIQUIDADOR'),
      row('PERSONA FISICA', 'REPR.143 RRM'),
    ]);
    expect(paired.find(o => o.name === 'HOLDING SL').representative).toBeDefined();
    expect(paired.find(o => o.name === 'UNA LIQUIDADORA SL').representative).toBeUndefined();
  });

  test('no corporate director or liquidator at all: the representative stands alone', () => {
    // The appointing corporate administrator predates the corpus, or the only
    // corporate name on the table is the auditor. The representative is then
    // the only trace of the administration we hold.
    const paired = pairRepresentatives143([
      row('AUDITORA SL', 'AUDITOR'),
      row('PERSONA FISICA', 'REPR.143 RRM'),
    ]);
    const rep = paired.find(o => o.position_normalized === 'REPR.143 RRM');
    expect(rep.representativeAlone).toBe(true);
    expect(paired.find(o => o.name === 'AUDITORA SL').representative).toBeUndefined();
  });

  test('a corporate administrador concursal pairs like any corporate administrator', () => {
    const paired = pairRepresentatives143([
      row('DESPACHO CONCURSAL SLP', 'ADM.CONCURS.'),
      row('PERSONA FISICA', 'REPR.143 RRM'),
    ]);
    expect(paired).toHaveLength(1);
    expect(paired[0].representative.name).toBe('PERSONA FISICA');
  });

  test('spelling variants of one corporate name fold to one director', () => {
    // Registry rows differ by punctuation for the same firm. Counting them as
    // two would make the case ambiguous and lose a sound pairing.
    const paired = pairRepresentatives143([
      row('GESTION DE AUTOSERVICIOS ADLID, S.L.', 'ADM.UNICO'),
      row('GESTION DE AUTOSERVICIOS ADLID SL', 'ADM.UNICO'),
      row('ARANDA PANKOW MIGUEL WERNER', 'REPR.143 RRM'),
    ]);
    expect(paired.filter(o => o.representative)).toHaveLength(2);
  });

  test('a natural-person director is not a candidate, and the representative is not alone', () => {
    // A natural-person administrator holds the board. The representative acts
    // for a corporate officer we do not hold, so they are not the only trace
    // of the administration: listed as a representative, never seated.
    const paired = pairRepresentatives143([
      row('PERSONA ADMINISTRADORA', 'ADM.UNICO'),
      row('PERSONA FISICA', 'REPR.143 RRM'),
    ]);
    expect(paired.find(o => o.name === 'PERSONA ADMINISTRADORA').representative).toBeUndefined();
    expect(paired.find(o => o.position_normalized === 'REPR.143 RRM').representativeAlone).toBeUndefined();
  });

  test('a table without representatives is returned unchanged', () => {
    const input = [row('HOLDING SL', 'ADM.UNICO')];
    expect(pairRepresentatives143(input)).toEqual(input);
  });
});

describe('groupOfficersForDisplay with representatives', () => {
  const groupsOf = officers => new Map(groupOfficersForDisplay(officers, 'appointed_date'));

  test('a paired representative never adds a board row', () => {
    const groups = groupsOf(LIDL_PAIR);
    expect(groups.get('consejo')).toHaveLength(1);
    expect(groups.get('consejo')[0].representative.name).toBe('ARANDA PANKOW MIGUEL WERNER');
    expect(groups.has('auditoria_representantes')).toBe(false);
  });

  test('unpaired representatives are listed as representatives, not directors', () => {
    const groups = groupsOf(SPANAIR_AMBIGUOUS);
    const boardNames = groups.get('consejo').map(o => o.name);
    expect(boardNames).not.toContain('SUÑOL TREPAT RAFAEL');
    expect(groups.get('auditoria_representantes').map(o => o.name)).toEqual([
      'CORDON BARRENECHEA ARANDO AGUSTI',
      'SUÑOL TREPAT RAFAEL',
      'ALBANELL MIRA MANUEL',
    ]);
  });

  test('a representative standing alone is the board', () => {
    const groups = groupsOf([row('PERSONA FISICA', 'REPR.143 RRM')]);
    expect(groups.get('consejo').map(o => o.name)).toEqual(['PERSONA FISICA']);
  });

  test('a representative next to natural-person directors is listed, not seated', () => {
    const groups = groupsOf([
      row('PRIMERA CONSEJERA', 'CONSEJERO'),
      row('SEGUNDO CONSEJERO', 'CONSEJERO'),
      row('PERSONA FISICA', 'REPR.143 RRM'),
    ]);
    expect(groups.get('consejo').map(o => o.name)).toEqual(['PRIMERA CONSEJERA', 'SEGUNDO CONSEJERO']);
    expect(groups.get('auditoria_representantes').map(o => o.name)).toEqual(['PERSONA FISICA']);
  });

  test('a representative paired with a liquidator follows the liquidator into otros', () => {
    const groups = groupsOf([
      row('UNA LIQUIDADORA SL', 'LIQUIDADOR'),
      row('PERSONA FISICA', 'REPR.143 RRM'),
    ]);
    expect(groups.has('consejo')).toBe(false);
    expect(groups.get('otros')[0].representative.name).toBe('PERSONA FISICA');
  });
});
