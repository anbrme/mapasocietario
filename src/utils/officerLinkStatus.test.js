import { describe, test, expect } from 'vitest';
import { effectiveCategoryFromEvents, isActiveCategory } from './officerLinkStatus';

/**
 * GRUPO AUDITSAFE SLP at FTI CONSULTING SPAIN SL, drawn as a live auditor.
 *
 * BORME revoked it on 2021-01-14, but only in prose inside "Otros conceptos",
 * so the events index carries NO cessation event — only the 2020 appointment.
 * The company doc knows better (the enricher parses that prose), and the link
 * is built from the doc with category "ceses_dimisiones". Then the event
 * refinement overrode it with the older appointment and the seat came back to
 * life.
 *
 * Same shape for every seat closed by SUPERSESSION: those have no cese event
 * BY DEFINITION — that is what supersession means.
 */
describe('effectiveCategoryFromEvents', () => {
  test('an older appointment event cannot resurrect a closed seat', () => {
    // Arrange — the doc says the seat ended 2021-01-14; events only know 2020
    const events = [{ category: 'nombramientos', date: '2020-01-17' }];

    // Act
    const category = effectiveCategoryFromEvents(events, 'ceses_dimisiones', '2021-01-14');

    // Assert
    expect(category).toBe('ceses_dimisiones');
    expect(isActiveCategory(category)).toBe(false);
  });

  test('an appointment AFTER the cessation still reopens the seat', () => {
    // Arrange — a genuine re-appointment must not be suppressed
    const events = [
      { category: 'nombramientos', date: '2020-01-17' },
      { category: 'nombramientos', date: '2023-10-17' },
    ];

    // Act / Assert
    expect(effectiveCategoryFromEvents(events, 'ceses_dimisiones', '2021-01-14'))
      .toBe('nombramientos');
  });

  test('events still correct a seat the doc left open', () => {
    // Arrange — the behaviour this refinement exists for: a cese event the
    // build-time category missed.
    const events = [{ category: 'ceses_dimisiones', date: '2019-04-10' }];

    // Act / Assert — an active fallback is never protected
    expect(effectiveCategoryFromEvents(events, 'nombramientos', '2012-09-11'))
      .toBe('ceses_dimisiones');
  });

  test('a real cessation event still wins on its own date', () => {
    // Arrange — KPMG: the doc and the events agree
    const events = [{ category: 'revocaciones', date: '2019-04-10' }];

    // Act / Assert
    expect(effectiveCategoryFromEvents(events, 'ceses_dimisiones', '2019-04-10'))
      .toBe('revocaciones');
  });

  test('without a fallback date the old behaviour is unchanged', () => {
    // Arrange — links built before categoryDate existed
    const events = [{ category: 'nombramientos', date: '2020-01-17' }];

    // Act / Assert
    expect(effectiveCategoryFromEvents(events, 'ceses_dimisiones')).toBe('nombramientos');
  });

  test('no events means the doc category stands', () => {
    expect(effectiveCategoryFromEvents([], 'ceses_dimisiones', '2021-01-14'))
      .toBe('ceses_dimisiones');
  });
});
