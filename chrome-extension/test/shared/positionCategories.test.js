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
});
