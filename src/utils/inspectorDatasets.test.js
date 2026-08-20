import { describe, test, expect } from 'vitest';
import { buildInspectorDatasets, summariseCounts, resolveOfficerStatus } from './inspectorDatasets';

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

describe('superseded seats', () => {
  const SUPERSEDED_LABELS = {
    ...LABELS,
    superseded: 'Replaced (no cessation filed)',
    supersededSeats: 'Replaced — no cessation filed',
    supersededBy: 'Replaced by',
  };

  const withSuperseded = () => ({
    type: 'company',
    company: {
      officers_active: [{ name: 'GEAUDIT SLP', position_normalized: 'Auditor' }],
      officers_resigned: [
        {
          name: 'STAFF SLP',
          position_normalized: 'Auditor',
          status: 'superseded',
          registry_status: 'active',
          superseded_by: 'GEAUDIT SLP',
          superseded_on: '2024-11-14',
        },
        {
          name: 'KPMG SL',
          position_normalized: 'Auditor',
          status: 'resigned',
          resigned_date: '2011-01-01',
        },
      ],
    },
    enriched: { officers: { nombramientos: [], reelecciones: [], ceses_dimisiones: [], revocaciones: [] } },
  });

  test('lists a superseded seat in its own table rather than hiding it', () => {
    // Arrange / Act
    const datasets = buildInspectorDatasets(withSuperseded(), { lang: 'en', labels: SUPERSEDED_LABELS });
    const table = datasets.find(d => d.key === 'superseded');

    // Assert — shown, with who replaced them and when
    expect(table).toBeTruthy();
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].name).toBe('STAFF SLP');
    expect(table.rows[0].supersededBy).toBe('GEAUDIT SLP');
  });

  test('does not treat an inscribed cessation as superseded', () => {
    // Arrange / Act
    const datasets = buildInspectorDatasets(withSuperseded(), { lang: 'en', labels: SUPERSEDED_LABELS });
    const table = datasets.find(d => d.key === 'superseded');

    // Assert
    expect(table.rows.map(r => r.name)).not.toContain('KPMG SL');
  });

  test('omits the table entirely when nothing is superseded', () => {
    // Arrange
    const data = withSuperseded();
    data.company.officers_resigned = [
      { name: 'KPMG SL', position_normalized: 'Auditor', status: 'resigned', resigned_date: '2011-01-01' },
    ];

    // Act
    const datasets = buildInspectorDatasets(data, { lang: 'en', labels: SUPERSEDED_LABELS });

    // Assert
    expect(datasets.find(d => d.key === 'superseded')).toBeUndefined();
  });

  test('never calls a superseded seat a cessation', () => {
    // Arrange / Act
    const status = resolveOfficerStatus({ status: 'superseded' }, SUPERSEDED_LABELS);

    // Assert — the whole point: BORME filed no cese
    expect(status).toBe('Replaced (no cessation filed)');
    expect(status).not.toBe(SUPERSEDED_LABELS.ceased);
  });
});

describe('re-inscribed seats vs real successions', () => {
  const KIND_LABELS = {
    ...LABELS,
    superseded: 'Replaced (no cessation filed)',
    supersededSeats: 'Replaced — no cessation filed',
    supersededBy: 'Replaced by',
    reinscribed: 'Same firm, name updated',
    reinscribedSeats: 'Same firm — name updated',
    reinscribedAs: 'Now recorded as',
  };

  // Shapes taken verbatim from borme_companies_v3_live (T SYSTEMS ITC IBERIA SA):
  // one company carrying BOTH kinds, superseded on the same date by the same name.
  const mixed = () => ({
    type: 'company',
    company: {
      officers_resigned: [
        {
          name: 'ERNST & YOUNG SL',
          position_normalized: 'AUDIT.CUENT.',
          status: 'superseded',
          supersession_kind: 'succession',
          registry_status: 'active',
          superseded_by: 'DELOITTE AUDITORES SL',
          superseded_on: '2025-10-06',
        },
        {
          name: 'DELOITTE SL',
          position_normalized: 'AUDIT.INDIV.',
          status: 'superseded',
          supersession_kind: 'reinscribed_same_entity',
          registry_status: 'active',
          superseded_by: 'DELOITTE AUDITORES SL',
          superseded_on: '2025-10-06',
        },
      ],
    },
    enriched: { officers: { nombramientos: [], reelecciones: [], ceses_dimisiones: [], revocaciones: [] } },
  });

  test('keeps a re-inscription out of the "Replaced by" table', () => {
    // Arrange / Act
    const datasets = buildInspectorDatasets(mixed(), { lang: 'en', labels: KIND_LABELS });
    const replaced = datasets.find(d => d.key === 'superseded');

    // Assert — DELOITTE SL was not replaced by DELOITTE AUDITORES SL; it IS it
    expect(replaced.rows.map(r => r.name)).toEqual(['ERNST & YOUNG SL']);
  });

  test('lists the re-inscription in its own table, as a renaming', () => {
    // Arrange / Act
    const datasets = buildInspectorDatasets(mixed(), { lang: 'en', labels: KIND_LABELS });
    const reinscribed = datasets.find(d => d.key === 'reinscribed');

    // Assert
    expect(reinscribed).toBeTruthy();
    expect(reinscribed.rows).toHaveLength(1);
    expect(reinscribed.rows[0].name).toBe('DELOITTE SL');
    expect(reinscribed.rows[0].reinscribedAs).toBe('DELOITTE AUDITORES SL');
  });

  test('treats a seat with no supersession_kind as a replacement, not a renaming', () => {
    // Arrange — docs enriched before the kind field existed
    const data = mixed();
    delete data.company.officers_resigned[1].supersession_kind;

    // Act
    const datasets = buildInspectorDatasets(data, { lang: 'en', labels: KIND_LABELS });

    // Assert — old payloads keep the previous behaviour rather than silently
    // claiming two different firms are the same one
    expect(datasets.find(d => d.key === 'superseded').rows).toHaveLength(2);
    expect(datasets.find(d => d.key === 'reinscribed')).toBeUndefined();
  });

  test('does not say a re-inscribed firm was replaced', () => {
    // Arrange / Act
    const status = resolveOfficerStatus(
      { status: 'superseded', supersession_kind: 'reinscribed_same_entity' },
      KIND_LABELS
    );

    // Assert
    expect(status).toBe('Same firm, name updated');
    expect(status).not.toBe(KIND_LABELS.superseded);
  });
});
