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

describe('buildLandingSearchHref — binding to the exact legal entity', () => {
  // The graph's own autocomplete binds a company selection to its stable
  // group_key (applySelectedOption -> handleSearch(..., value.id)), which makes
  // handleSearch fetch the ONE matching company doc. The landing page used to
  // pass only a name, so /app re-ran a fuzzy name search and picking
  // "NURNBERG CONSULTING" also dragged in "NURNBERG CONSULTING & PARTNERS".
  const company = {
    type: 'company',
    name: 'NURNBERG CONSULTING SL',
    value: 'NURNBERG CONSULTING SL',
    id: 'grp_abc123',
    company_name_normalized: 'nurnberg consulting sl',
  };

  it('carries the group key so the deep link resolves one entity', () => {
    const href = buildLandingSearchHref(company, 'en');
    expect(href).toContain('gk=grp_abc123');
  });

  it('still shows the readable name in the search box', () => {
    const href = buildLandingSearchHref(company, 'en');
    expect(href).toContain('search=NURNBERG+CONSULTING+SL');
  });

  it('prefers the current name for a renamed company, matching the graph', () => {
    // Graph: displayName = value.name; the alias key rides in `gk`.
    const alias = {
      type: 'company',
      name: 'NEW NAME SL',
      value: 'OLD NAME SL',
      original_name: 'OLD NAME SL',
      is_alias: true,
      id: 'grp_xyz789',
    };
    const href = buildLandingSearchHref(alias, 'es');
    expect(href).toContain('gk=grp_xyz789');
  });

  it('omits the group key when the suggestion has none', () => {
    // /empresa pages link as /app?search=<company> with no id — must still work.
    expect(buildLandingSearchHref({ type: 'company', value: 'IBERDROLA SA' }, 'en'))
      .toBe('/app?search=IBERDROLA+SA&type=company&source=home_search');
  });

  it('does not attach a group key to officer links', () => {
    const href = buildLandingSearchHref(
      { type: 'officer', value: 'ORTEGA GAONA AMANCIO', id: 'should_be_ignored' }, 'es');
    expect(href).not.toContain('gk=');
  });
});
