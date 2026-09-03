import { describe, expect, it } from 'vitest';
import { buildLandingSearchHref, landingGraphRequestFromHref } from './LandingEntitySearch';

describe('buildLandingSearchHref', () => {
  it('deep-links a selected company into the graph', () => {
    expect(buildLandingSearchHref({ type: 'company', value: 'IBERDROLA SA' }, 'en'))
      .toBe('/app/?search=IBERDROLA+SA&type=company&source=home_search');
  });

  it('keeps Spanish and officer intent in the deep link', () => {
    expect(buildLandingSearchHref({ type: 'officer', value: 'ORTEGA GAONA AMANCIO' }, 'es'))
      .toBe('/app/?search=ORTEGA+GAONA+AMANCIO&type=officer&source=home_search&lang=es');
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
      .toBe('/app/?search=IBERDROLA+SA&type=company&source=home_search');
  });

  it('does not attach a group key to officer links', () => {
    const href = buildLandingSearchHref(
      { type: 'officer', value: 'ORTEGA GAONA AMANCIO', id: 'should_be_ignored' }, 'es');
    expect(href).not.toContain('gk=');
  });
});

describe('buildLandingSearchHref — owners the company index cannot answer for', () => {
  // The directory lists an entity it knows only as a socio único with
  // type "sole_shareholder" and no company doc behind it. Sending those to the
  // company search was a dead end: /app searched the registry for a company by
  // that name and reported no results. PICON OTERO ALBERTO (a man, sole
  // shareholder and sole administrator of one company) is the live case.
  const ownerWithCargos = {
    type: 'sole_shareholder',
    name: 'PICON OTERO ALBERTO',
    value: 'PICON OTERO ALBERTO',
    id: 'PICON OTERO ALBERTO',
    company_count: 1,
    has_officer_twin: true,
    owns_total: 1,
  };

  it('sends a person who holds cargos to the officer search', () => {
    const href = buildLandingSearchHref(ownerWithCargos, 'en');

    expect(href).toContain('type=officer');
  });

  it('never passes a name off as a group key', () => {
    // `id` on one of these rows is the bare name, not a group_key; forwarding it
    // as gk would bind the deep link to nothing.
    expect(buildLandingSearchHref(ownerWithCargos, 'en')).not.toContain('gk=');
  });

  it('sends an owner with no company doc and no cargos to the shareholder route', () => {
    const href = buildLandingSearchHref(
      {
        type: 'sole_shareholder',
        name: 'ROCHE HOLDING LTD',
        value: 'ROCHE HOLDING LTD',
        id: 'ROCHE HOLDING LTD',
        owns_total: 4,
      },
      'en'
    );

    expect(href).toContain('type=shareholder');
    expect(href).not.toContain('gk=');
  });

  it('leaves a company that merely owns things on the company route', () => {
    const href = buildLandingSearchHref(
      {
        type: 'company',
        name: 'SANITAS HOLDING SL',
        value: 'SANITAS HOLDING SL',
        id: 'H:M-584035',
        is_sole_shareholder: true,
        owns_total: 2,
      },
      'en'
    );

    expect(href).toContain('type=company');
    expect(href).toContain('gk=H%3AM-584035');
  });
});

describe('landingGraphRequestFromHref', () => {
  it('turns the landing deep link into embedded graph props', () => {
    expect(landingGraphRequestFromHref(
      '/app/?search=NURNBERG+CONSULTING+SL&type=company&source=home_search&gk=grp_abc123'
    )).toEqual({
      name: 'NURNBERG CONSULTING SL',
      searchType: 'company',
      groupKey: 'grp_abc123',
      source: 'home_search',
    });
  });

  it('preserves officer and shareholder routes', () => {
    expect(landingGraphRequestFromHref('/app/?search=ANA+GARCIA&type=officer&source=home_search'))
      .toMatchObject({ name: 'ANA GARCIA', searchType: 'officer' });
    expect(landingGraphRequestFromHref('/app/?search=HOLDING+LTD&type=shareholder&source=home_search'))
      .toMatchObject({ name: 'HOLDING LTD', searchType: 'shareholder' });
  });

  it('rejects generic app links because compact mode needs a selected entity', () => {
    expect(landingGraphRequestFromHref('/app/?source=home_hero')).toBeNull();
    expect(landingGraphRequestFromHref('/pricing')).toBeNull();
  });
});
