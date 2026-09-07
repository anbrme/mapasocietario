import { describe, expect, it } from 'vitest';
import { resolveSubmitTarget } from './landingSearchSubmit';

const company = (name, id) => ({ type: 'company', name, value: name, label: name, id });

describe('resolveSubmitTarget — what Enter or the Search button opens', () => {
  it('returns null when there is nothing to open', () => {
    expect(resolveSubmitTarget('endesa', [])).toBeNull();
    expect(resolveSubmitTarget('endesa', undefined)).toBeNull();
  });

  it('prefers the row whose name equals the query over the first row', () => {
    // Live autocomplete for "endesa" ranks ENDESA ENERGIA SA first; the visitor
    // who typed "endesa" and pressed Enter meant ENDESA SA.
    const options = [
      company('ENDESA ENERGIA SA', 'H:M-205381'),
      company('ENDESA GENERACION SA', 'H:SE-55559'),
      company('ENDESA SA', 'H:M-6405'),
    ];
    expect(resolveSubmitTarget('endesa', options)).toEqual({
      option: options[2],
      match: 'exact',
      rank: 3,
    });
  });

  it('ignores case, accents and punctuation when matching', () => {
    const options = [company('INDUSTRIA DE DISEÑO TEXTIL, S.A.', 'H:C-3342')];
    expect(resolveSubmitTarget('industria de diseno textil sa', options).match).toBe('exact');
  });

  it('treats the legal-form suffix as optional', () => {
    const options = [
      company('NURNBERG CONSULTING & PARTNERS SL', 'H:M-1'),
      company('NURNBERG CONSULTING SL', 'H:M-2'),
    ];
    expect(resolveSubmitTarget('nurnberg consulting', options)).toMatchObject({
      option: options[1],
      match: 'exact',
      rank: 2,
    });
  });

  it('falls back to the highlighted first row when nothing matches exactly', () => {
    const options = [
      company('FTI CONSULTING SPAIN SL', 'H:M-445656'),
      company('FTI CONSULTING BV', 'FTI CONSULTING BV'),
    ];
    expect(resolveSubmitTarget('fti consulting', options)).toEqual({
      option: options[0],
      match: 'first',
      rank: 1,
    });
  });

  it('matches officers on their displayed name too', () => {
    const officer = { type: 'officer', name: 'ORTEGA GAONA AMANCIO', value: 'ORTEGA GAONA AMANCIO' };
    const options = [company('ORTEGA Y GASSET SL', 'H:M-9'), officer];
    expect(resolveSubmitTarget('ortega gaona amancio', options)).toMatchObject({
      option: officer,
      match: 'exact',
    });
  });
});
