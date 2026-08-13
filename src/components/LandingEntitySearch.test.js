import { describe, expect, it } from 'vitest';
import { buildLandingSearchHref } from './LandingEntitySearch';

describe('buildLandingSearchHref', () => {
  it('deep-links a selected company into the graph', () => {
    expect(buildLandingSearchHref({ type: 'company', value: 'IBERDROLA SA' }, 'en'))
      .toBe('/app?search=IBERDROLA+SA&type=company&source=home_search');
  });

  it('keeps Spanish and officer intent in the deep link', () => {
    expect(buildLandingSearchHref({ type: 'officer', value: 'ORTEGA GAONA AMANCIO' }, 'es'))
      .toBe('/app?search=ORTEGA+GAONA+AMANCIO&type=officer&source=home_search&lang=es');
  });

  it('rejects free text and empty suggestions', () => {
    expect(buildLandingSearchHref('IBERDROLA', 'es')).toBeNull();
    expect(buildLandingSearchHref({ type: 'company' }, 'es')).toBeNull();
  });
});
