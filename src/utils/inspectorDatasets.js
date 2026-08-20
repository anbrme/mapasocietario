import { formatDate } from './formatDate';

/**
 * Turns a resolved preview payload into the tabular datasets shown in the
 * bottom data dock, plus the counts the inspector renders as filter chips.
 *
 * The inspector itself stays a fixed-height fact sheet: everything that grows
 * with company size ends up here, paginated, instead of extending the panel
 * into tens of thousands of pixels of scroll.
 */

/**
 * A later appointment under a drifted name for the same firm ("DELOITTE SL" ->
 * "DELOITTE AUDITORES SL") — a re-inscription, not a change of auditor. Across
 * the live index this is 4,402 of 56,846 superseded seats (7.7%).
 */
const REINSCRIBED = 'reinscribed_same_entity';

const EMPTY_OFFICERS = { nombramientos: [], reelecciones: [], ceses_dimisiones: [], revocaciones: [] };

/** BORME event categories, in the order they read as a history. */
const EVENT_CATEGORIES = [
  { key: 'nombramientos', labelKey: 'appointments' },
  { key: 'reelecciones', labelKey: 'reelections' },
  { key: 'ceses_dimisiones', labelKey: 'cessations' },
  { key: 'revocaciones', labelKey: 'revocations' },
];

/**
 * v3 expand-officer reports `status` ("active"/"ceased") on most rows, but older
 * ones only carry `event_type`. Prefer the explicit field, fall back to the
 * event, and say "unknown" rather than guessing.
 */
export const resolveOfficerStatus = (officer, labels) => {
  const status = (officer.status || '').toLowerCase();
  if (status === 'active') return labels.active;
  if (status === 'ceased') return labels.ceased;
  // Not a cese: BORME published none. A later appointment to a single-holder
  // office closed the seat. Say so rather than implying a cessation was filed.
  if (status === 'superseded') {
    // A re-inscription is not a replacement: the SAME firm was re-recorded under
    // a corrected name. Calling that "replaced" asserts a change of auditor that
    // never happened.
    if (officer.supersession_kind === REINSCRIBED) {
      return labels.reinscribed || labels.superseded || labels.ceased;
    }
    return labels.superseded || labels.ceased;
  }

  const event = (officer.event_type || '').toLowerCase();
  if (event.includes('nombr') || event.includes('reelecc')) return labels.active;
  if (event.includes('cese') || event.includes('dimis') || event.includes('revoc')) return labels.ceased;
  return labels.unknown;
};

/** Both seat tables share a shape; only the successor column differs. */
const seatColumns = (labels, successorKey, successorLabel) => [
  { key: 'name', label: labels.name, width: '35%' },
  { key: 'position', label: labels.role, width: '25%' },
  { key: successorKey, label: successorLabel, width: '25%' },
  { key: 'date', label: labels.date, width: '15%' },
];

const officerColumns = labels => [
  { key: 'name', label: labels.name, width: '45%' },
  { key: 'position', label: labels.role, width: '35%' },
  { key: 'date', label: labels.date, width: '20%' },
];

/**
 * One row per SEAT, not per person: an officer holding three roles becomes three
 * rows, which is what makes the table searchable by role.
 */
const flattenCurrentOfficers = (currentOfficers, lang) =>
  (currentOfficers || []).flatMap(officer =>
    (officer.positions || []).map(position => ({
      name: officer.name || '-',
      position: position.position || '-',
      date: position.date ? formatDate(position.date, lang) : '-',
    }))
  );

const mapEventOfficers = (officers, lang) =>
  (officers || []).map(officer => ({
    name: officer.name || '-',
    position: officer.position || '-',
    date: officer.date ? formatDate(officer.date, lang) : '-',
  }));

const buildCompanyDatasets = (data, { lang, labels }) => {
  const enriched = data.enriched || {};
  const officers = enriched.officers || EMPTY_OFFICERS;

  // The registry's own totals, used to admit when the loaded rows are a subset.
  // These come from the raw v3 doc, not from the event window the rows derive
  // from, so they are the honest denominator.
  const registryActive = data.company?.officers_active?.length;
  const registryResigned = data.company?.officers_resigned?.length;

  // Seats the registry still shows as held, closed by a later appointment to an
  // office that admits one holder. They are listed rather than hidden: a reader
  // who cross-checks against BORME will find them there, and the difference is
  // the useful part.
  const supersededSeats = (data.company?.officers_resigned || [])
    .filter(o => (o.status || '').toLowerCase() === 'superseded');

  // Split by kind: a re-inscription belongs under "name updated", never under
  // "replaced by". Seats enriched before supersession_kind existed carry no
  // kind and stay in the replacement table — the previous behaviour — rather
  // than being upgraded to "same firm" on a guess.
  const toSeatRow = (o, successorKey) => ({
    name: o.name || o.name_normalized || '-',
    position: o.position_normalized || '-',
    date: o.superseded_on ? formatDate(o.superseded_on, lang) : '-',
    [successorKey]: o.superseded_by || '-',
  });

  const supersededRows = supersededSeats
    .filter(o => o.supersession_kind !== REINSCRIBED)
    .map(o => toSeatRow(o, 'supersededBy'));

  const reinscribedRows = supersededSeats
    .filter(o => o.supersession_kind === REINSCRIBED)
    .map(o => toSeatRow(o, 'reinscribedAs'));

  const datasets = [
    {
      key: 'current',
      label: labels.currentOfficersShort,
      columns: officerColumns(labels),
      rows: flattenCurrentOfficers(enriched.currentOfficers, lang),
      registryTotal: registryActive,
    },
    ...EVENT_CATEGORIES.map(({ key, labelKey }) => ({
      key,
      label: labels[labelKey],
      columns: officerColumns(labels),
      rows: mapEventOfficers(officers[key], lang),
      registryTotal: key === 'ceses_dimisiones' ? registryResigned : undefined,
    })),
    {
      key: 'superseded',
      label: labels.supersededSeats || labels.cessations,
      columns: seatColumns(labels, 'supersededBy', labels.supersededBy || labels.name),
      rows: supersededRows,
    },
    {
      key: 'reinscribed',
      label: labels.reinscribedSeats || labels.supersededSeats || labels.cessations,
      columns: seatColumns(labels, 'reinscribedAs', labels.reinscribedAs || labels.name),
      rows: reinscribedRows,
    },
  ];

  return datasets.filter(dataset => dataset.rows.length > 0);
};

const buildOfficerDatasets = (data, { lang, labels }) => {
  const roles = (data.officers || []).map(officer => ({
    company: officer.company_name || officer.company || labels.unknown,
    position:
      officer.specific_role || officer.position_normalized || officer.role || officer.position || '-',
    status: resolveOfficerStatus(officer, labels),
    date: formatDate(officer.date || officer.event_date || '', lang),
  }));

  const owned = (data.whollyOwned || []).map(company => ({
    company: company.name || '-',
    stake: '100%',
    isDissolved: !!company.is_dissolved,
    isInConcurso: !!company.is_in_concurso,
  }));

  return [
    {
      key: 'roles',
      label: labels.rolesShort,
      columns: [
        { key: 'company', label: labels.company, width: '45%' },
        { key: 'position', label: labels.role, width: '25%' },
        { key: 'status', label: labels.status, width: '15%' },
        { key: 'date', label: labels.date, width: '15%' },
      ],
      rows: roles,
    },
    {
      key: 'owned',
      label: labels.whollyOwnedShort,
      columns: [
        { key: 'company', label: labels.company, width: '85%' },
        { key: 'stake', label: '%', width: '15%' },
      ],
      rows: owned,
    },
  ].filter(dataset => dataset.rows.length > 0);
};

export const buildInspectorDatasets = (data, { lang = 'es', labels }) => {
  if (!data) return [];
  if (data.type === 'company') return buildCompanyDatasets(data, { lang, labels });
  if (data.type === 'officer') return buildOfficerDatasets(data, { lang, labels });
  return [];
};

/**
 * Chip counts for the inspector — the same datasets reduced to a label and a
 * number, so clicking one can open the dock on exactly that table.
 */
export const summariseCounts = (datasets = []) =>
  datasets.map(({ key, label, rows }) => ({ key, label, count: rows.length }));
