import { describe, test, expect } from 'vitest';
import { buildInspectorDatasets, summariseCounts } from './inspectorDatasets';

const LABELS = {
  currentOfficersShort: 'Directivos',
  appointments: 'Nombramientos',
  reelections: 'Reelecciones',
  cessations: 'Ceses',
  revocations: 'Revocaciones',
  rolesShort: 'Cargos',
  whollyOwnedShort: 'Participadas',
  name: 'Nombre',
  role: 'Cargo',
  date: 'Fecha',
  status: 'Estado',
  company: 'Empresa',
  active: 'Activo',
  ceased: 'Cesado',
  unknown: 'Desconocido',
};

describe('buildInspectorDatasets — company', () => {
  test('flattens one row per officer position, not per officer', () => {
    // Arrange — one officer holding two seats
    const data = {
      type: 'company',
      enriched: {
        currentOfficers: [
          { name: 'MONTEOLIVA DIAZ JAVIER', positions: [
            { position: 'CONSEJERO', date: '2022-01-24' },
            { position: 'SECRETARIO', date: '2022-01-24' },
          ] },
        ],
        officers: { nombramientos: [], reelecciones: [], ceses_dimisiones: [], revocaciones: [] },
      },
    };

    // Act
    const sets = buildInspectorDatasets(data, { lang: 'es', labels: LABELS });

    // Assert
    const current = sets.find(s => s.key === 'current');
    expect(current.rows).toHaveLength(2);
    expect(current.rows.map(r => r.position)).toEqual(['CONSEJERO', 'SECRETARIO']);
    expect(current.rows[0].name).toBe('MONTEOLIVA DIAZ JAVIER');
  });

  test('formats dates for the active language', () => {
    const data = {
      type: 'company',
      enriched: {
        currentOfficers: [{ name: 'A', positions: [{ position: 'ADMIN', date: '2024-03-14' }] }],
        officers: { nombramientos: [], reelecciones: [], ceses_dimisiones: [], revocaciones: [] },
      },
    };

    expect(buildInspectorDatasets(data, { lang: 'es', labels: LABELS })
      .find(s => s.key === 'current').rows[0].date).toBe('14/03/2024');
  });

  test('marks a dataset partial when the registry holds more than was loaded', () => {
    // Arrange — 2 officers derived from events, 7948 in the registry
    const data = {
      type: 'company',
      company: { officers_active: new Array(7948).fill({ name: 'x' }) },
      enriched: {
        currentOfficers: [
          { name: 'A', positions: [{ position: 'ADMIN', date: '' }] },
          { name: 'B', positions: [{ position: 'ADMIN', date: '' }] },
        ],
        officers: { nombramientos: [], reelecciones: [], ceses_dimisiones: [], revocaciones: [] },
      },
    };

    // Act
    const current = buildInspectorDatasets(data, { lang: 'es', labels: LABELS })
      .find(s => s.key === 'current');

    // Assert — the count on screen must be able to say "2 of 7948"
    expect(current.registryTotal).toBe(7948);
    expect(current.rows).toHaveLength(2);
  });

  test('omits datasets that have no rows', () => {
    const data = {
      type: 'company',
      enriched: {
        currentOfficers: [],
        officers: {
          nombramientos: [{ name: 'A', position: 'ADMIN', date: '' }],
          reelecciones: [],
          ceses_dimisiones: [],
          revocaciones: [],
        },
      },
    };

    const keys = buildInspectorDatasets(data, { lang: 'es', labels: LABELS }).map(s => s.key);
    expect(keys).toEqual(['nombramientos']);
  });
});

describe('buildInspectorDatasets — officer', () => {
  test('one row per role with a resolved status', () => {
    const data = {
      type: 'officer',
      name: 'RUBIO MERINO ANTONIO',
      officers: [
        { company_name: 'PROSEGUR CASH SA', specific_role: 'SECRETARIO', status: 'active', date: '2025-06-11' },
        { company_name: 'PROSEGUR CASH SA', specific_role: 'APODERADO', status: 'ceased', date: '2024-04-02' },
      ],
      whollyOwned: [],
    };

    const roles = buildInspectorDatasets(data, { lang: 'es', labels: LABELS }).find(s => s.key === 'roles');
    expect(roles.rows).toHaveLength(2);
    expect(roles.rows[0]).toMatchObject({ company: 'PROSEGUR CASH SA', position: 'SECRETARIO', status: 'Activo' });
    expect(roles.rows[1].status).toBe('Cesado');
  });

  test('falls back to event_type when status is absent', () => {
    const data = {
      type: 'officer',
      officers: [{ company_name: 'X SL', specific_role: 'ADMIN', event_type: 'ceses_dimisiones', date: '' }],
      whollyOwned: [],
    };

    const roles = buildInspectorDatasets(data, { lang: 'es', labels: LABELS }).find(s => s.key === 'roles');
    expect(roles.rows[0].status).toBe('Cesado');
  });
});

describe('summariseCounts', () => {
  test('returns chip counts that mirror the datasets', () => {
    const data = {
      type: 'company',
      enriched: {
        currentOfficers: [{ name: 'A', positions: [{ position: 'ADMIN', date: '' }] }],
        officers: { nombramientos: [], reelecciones: [], ceses_dimisiones: [{ name: 'B', position: 'X', date: '' }], revocaciones: [] },
      },
    };

    const sets = buildInspectorDatasets(data, { lang: 'es', labels: LABELS });
    const counts = summariseCounts(sets);

    expect(counts).toEqual([
      { key: 'current', label: 'Directivos', count: 1 },
      { key: 'ceses_dimisiones', label: 'Ceses', count: 1 },
    ]);
  });

  test('is empty when there is nothing tabular to show', () => {
    expect(summariseCounts([])).toEqual([]);
  });
});
