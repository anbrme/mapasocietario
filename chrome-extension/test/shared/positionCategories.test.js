import { describe, it, expect } from 'vitest';
import { isBoardPosition } from '../../src/shared/positionCategories.js';

describe('isBoardPosition', () => {
  it('classifies CONSEJERO as board', () => {
    expect(isBoardPosition('CONSEJERO')).toBe(true);
  });
  it('classifies PRESIDENTE as board', () => {
    expect(isBoardPosition('PRESIDENTE')).toBe(true);
  });
  it('classifies ADMINISTRADOR UNICO as board', () => {
    expect(isBoardPosition('ADMINISTRADOR UNICO')).toBe(true);
  });
  it('classifies APO.SOL. (apoderado) as non-board', () => {
    expect(isBoardPosition('APO.SOL.')).toBe(false);
  });
  it('classifies AUDITOR as non-board', () => {
    expect(isBoardPosition('AUDITOR')).toBe(false);
  });
  it('classifies VOC.COM.AUDIT (vocal/comisión) as non-board', () => {
    expect(isBoardPosition('VOC.COM.AUDIT')).toBe(false);
  });
  it('classifies PTE.C.EJ (executive-committee chair) as non-board', () => {
    expect(isBoardPosition('PTE.C.EJ')).toBe(false);
  });
  it('classifies PRES.NOMB.RE (nominations-committee chair) as non-board', () => {
    expect(isBoardPosition('PRES.NOMB.RE')).toBe(false);
  });
  it('classifies PRECOMAUDIT (fused audit-committee chair) as non-board', () => {
    expect(isBoardPosition('PRECOMAUDIT')).toBe(false);
  });
  it('classifies MICOAUDI (fused audit-committee member) as non-board', () => {
    expect(isBoardPosition('MICOAUDI')).toBe(false);
  });
  it('classifies PRE.NO.EJEC. (non-executive board chair) as board', () => {
    expect(isBoardPosition('PRE.NO.EJEC.')).toBe(true);
  });
});
