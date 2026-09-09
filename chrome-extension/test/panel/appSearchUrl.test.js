import { describe, it, expect } from 'vitest';
import { appSearchUrl } from '../../src/panel/appSearchUrl.js';

describe('appSearchUrl', () => {
  it('encodes the full company name including punctuation and accented chars', () => {
    expect(appSearchUrl({ name: 'INDITEX, S.A.(R.M. A CORUÑA)' }))
      .toBe('https://mapasocietario.es/app?search=INDITEX%2C%20S.A.(R.M.%20A%20CORU%C3%91A)&source=chrome_extension');
  });
  it('carries the stable group key as gk so /app opens that exact company', () => {
    // Without gk the app re-runs a fuzzy NAME search and can land on a
    // different legal entity that merely shares a name prefix.
    expect(appSearchUrl({ name: 'NURNBERG CONSULTING SL', groupKey: 'H:M-566914' }))
      .toBe('https://mapasocietario.es/app?search=NURNBERG%20CONSULTING%20SL&gk=H%3AM-566914&source=chrome_extension');
  });
  it('omits gk when the match carries no stable id', () => {
    expect(appSearchUrl({ name: 'ACME SL' }))
      .toBe('https://mapasocietario.es/app?search=ACME%20SL&source=chrome_extension');
  });
  it('encodes a simple name', () => {
    expect(appSearchUrl({ name: 'TELEFONICA SA' }))
      .toBe('https://mapasocietario.es/app?search=TELEFONICA%20SA&source=chrome_extension');
  });

  it('tags the visit as extension traffic so /app can attribute it', () => {
    // /app reads `source` into graph_view.entry_source (it must match
    // /^[a-z0-9_]{1,40}$/ or it is recorded as "direct").
    expect(appSearchUrl({ name: 'ACME SL', groupKey: 'H:M-1' }))
      .toContain('&source=chrome_extension');
  });
});
