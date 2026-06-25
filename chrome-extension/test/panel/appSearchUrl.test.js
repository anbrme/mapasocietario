import { describe, it, expect } from 'vitest';
import { appSearchUrl } from '../../src/panel/appSearchUrl.js';

describe('appSearchUrl', () => {
  it('encodes the full company name including punctuation and accented chars', () => {
    expect(appSearchUrl({ name: 'INDITEX, S.A.(R.M. A CORUÑA)' }))
      .toBe('https://mapasocietario.es/app?search=INDITEX%2C%20S.A.(R.M.%20A%20CORU%C3%91A)');
  });
  it('encodes a simple name', () => {
    expect(appSearchUrl({ name: 'TELEFONICA SA' }))
      .toBe('https://mapasocietario.es/app?search=TELEFONICA%20SA');
  });
});
