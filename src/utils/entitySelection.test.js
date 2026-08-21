import { describe, it, expect } from 'vitest';
import { classifyEntitySelection, ownedCompaniesFromHint } from './entitySelection';

// The directory autocomplete types EVERY sole-shareholder row as
// `sole_shareholder`, whether the owner is a company or a person. PICON OTERO
// ALBERTO is the live case that exposed it: a human, sole shareholder AND
// sole administrator of EQUILATERO SOLUCIONES ESTRATEGICAS SL.
const piconRow = {
  name: 'PICON OTERO ALBERTO',
  type: 'sole_shareholder',
  company_count: 1,
  has_officer_twin: true,
  owns: [{ group_key: 'H:SC-53649', name: 'EQUILATERO SOLUCIONES ESTRATEGICAS SL' }],
  owns_total: 1,
};

describe('classifyEntitySelection', () => {
  it('treats a person typed as sole_shareholder as a person, not a company', () => {
    const { entityKind } = classifyEntitySelection(piconRow);

    expect(entityKind).toBe('person');
  });

  it('routes a sole-shareholder person who also holds cargos to the officer search', () => {
    // Without this the only row in the dropdown plots a bare node and never
    // fetches the company the person administers.
    const { route } = classifyEntitySelection(piconRow);

    expect(route).toBe('officer');
  });

  it('carries the owned companies through so they need no second lookup', () => {
    const { owns, ownsTotal } = classifyEntitySelection(piconRow);

    expect(ownsTotal).toBe(1);
    expect(owns).toEqual([
      { name: 'EQUILATERO SOLUCIONES ESTRATEGICAS SL', groupKey: 'H:SC-53649' },
    ]);
  });

  it('stages a cargo-less owner behind the confirmation pill', () => {
    const { route, entityKind } = classifyEntitySelection({
      name: 'GARCIA LOPEZ MARIA',
      type: 'sole_shareholder',
      owns_total: 4,
      owns: [{ group_key: 'H:M-1', name: 'UNA SL' }],
    });

    expect(route).toBe('shareholder');
    expect(entityKind).toBe('person');
  });

  it('keeps a corporate sole shareholder on the staged path', () => {
    const { route, entityKind } = classifyEntitySelection({
      name: 'INVERSIONES ATLAS SL',
      type: 'sole_shareholder',
      owns_total: 12,
      company_count: 3,
      has_officer_twin: true,
    });

    expect(entityKind).toBe('company');
    expect(route).toBe('shareholder');
  });

  it('leaves a plain officer row on the officer route', () => {
    const { route, entityKind, ownsTotal } = classifyEntitySelection({
      name: 'GARCIA LOPEZ MARIA',
      type: 'officer',
      company_count: 3,
    });

    expect(route).toBe('officer');
    expect(entityKind).toBe('person');
    expect(ownsTotal).toBe(0);
  });

  it('leaves a plain company row on the company route', () => {
    const { route } = classifyEntitySelection({ name: 'ACME SL', type: 'company' });

    expect(route).toBe('company');
  });

  it('routes an owner-less sole_shareholder row like its kind, not the pill', () => {
    // owns_total 0 means there is nothing to stage — the pill would be empty.
    expect(classifyEntitySelection({ name: 'ACME SL', type: 'sole_shareholder' }).route)
      .toBe('company');
    expect(
      classifyEntitySelection({ name: 'GARCIA LOPEZ MARIA', type: 'sole_shareholder' }).route
    ).toBe('officer');
  });

  it('reads the individual-owner flag from the officers backend too', () => {
    const { entityKind, route } = classifyEntitySelection({
      name: 'GARCIA LOPEZ MARIA',
      type: 'officer_sole_shareholder',
      is_sole_shareholder: true,
      company_count: 2,
      owns_total: 1,
    });

    expect(entityKind).toBe('person');
    expect(route).toBe('officer');
  });

  it('survives a missing/blank suggestion', () => {
    expect(classifyEntitySelection(null).route).toBe('company');
    expect(classifyEntitySelection({}).owns).toEqual([]);
  });
});

describe('ownedCompaniesFromHint', () => {
  it('normalizes the directory shape to name + groupKey', () => {
    expect(
      ownedCompaniesFromHint([
        { group_key: 'H:SC-53649', name: 'EQUILATERO SOLUCIONES ESTRATEGICAS SL' },
      ])
    ).toEqual([{ name: 'EQUILATERO SOLUCIONES ESTRATEGICAS SL', groupKey: 'H:SC-53649' }]);
  });

  it('accepts the company_name spelling and a bare id', () => {
    expect(ownedCompaniesFromHint([{ company_name: 'UNA SL', id: 'H:M-1' }])).toEqual([
      { name: 'UNA SL', groupKey: 'H:M-1' },
    ]);
  });

  it('drops nameless entries and dedupes repeats', () => {
    expect(
      ownedCompaniesFromHint([
        { group_key: 'H:M-1', name: 'UNA SL' },
        { group_key: 'H:M-1', name: 'UNA SL' },
        { group_key: 'H:M-2' },
        null,
      ])
    ).toEqual([{ name: 'UNA SL', groupKey: 'H:M-1' }]);
  });

  it('returns an empty list for anything that is not an array', () => {
    expect(ownedCompaniesFromHint(null)).toEqual([]);
    expect(ownedCompaniesFromHint('nope')).toEqual([]);
  });
});

// The directory answers with two different shapes, and the difference decides
// the route:
//   source "v3"              -> a real company doc, `id` is its group_key, and
//                               `is_sole_shareholder` is just a display flag
//   source "sole_shareholder"-> the registry knows this entity ONLY as an
//                               owner: no company doc, `id` is the bare name
describe('classifyEntitySelection — rows that own but also have a company doc', () => {
  const sanitasRow = {
    name: 'SANITAS HOLDING SL',
    type: 'company',
    id: 'H:M-584035',
    is_sole_shareholder: true,
    owns_total: 2,
    owns: [{ group_key: 'H:M-70978', name: 'SANITAS SOCIEDAD ANONIMA DE HOSPITALES' }],
  };

  it('runs the full company search rather than staging a bare node', () => {
    // This company has a group_key and a doc full of officers. Plotting it as a
    // lone node behind a pill threw all of that away.
    const { route } = classifyEntitySelection(sanitasRow);

    expect(route).toBe('company');
  });

  it('never calls a company with a group_key a person', () => {
    // The old check read `is_sole_shareholder` as "individual owner" and plotted
    // this company as a person node.
    const { entityKind } = classifyEntitySelection(sanitasRow);

    expect(entityKind).toBe('company');
  });

  it('stages an owner the registry has no company doc for', () => {
    // A foreign parent: owns Spanish companies, has no Spanish company doc, so
    // a company search would find nothing and the pill is the right answer.
    const { route, entityKind } = classifyEntitySelection({
      name: 'ROCHE HOLDING LTD',
      type: 'sole_shareholder',
      id: 'ROCHE HOLDING LTD',
      owns_total: 4,
      owns: [{ group_key: 'H:M-2', name: 'ROCHE FARMA SA' }],
    });

    expect(route).toBe('shareholder');
    expect(entityKind).toBe('company');
  });

  it('keeps a company-doc row on the company route even without a legal suffix', () => {
    // Plenty of registered names carry no recognizable legal form. The row came
    // from the company index, so it must not be sent to the officer search.
    const { route } = classifyEntitySelection({
      name: 'UTE OBRAS DEL NORTE',
      type: 'company',
      id: 'H:M-9',
    });

    expect(route).toBe('company');
  });
});
