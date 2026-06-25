import { describe, it, expect } from 'vitest';
import { empresaUrl } from '../../src/panel/empresaUrl.js';

describe('empresaUrl', () => {
  it('slugifies the company name', () => {
    expect(empresaUrl({ name: 'TELEFÓNICA SA' }))
      .toBe('https://mapasocietario.es/empresa/telefonica-sa');
  });
  it('collapses punctuation and spaces', () => {
    expect(empresaUrl({ name: 'AENA S.M.E., S.A.' }))
      .toBe('https://mapasocietario.es/empresa/aena-s-m-e-s-a');
  });
});
