import React, { useState, useCallback, useRef, useEffect } from 'react';
import { debounce } from 'lodash';
import { forceCollide } from 'd3-force';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Button,
  TextField,
  IconButton,
  CircularProgress,
  Alert,
  Paper,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Slider,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Switch,
  FormControlLabel,
  Snackbar,
  Badge,
  Checkbox,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  AccountTree as NetworkIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  Refresh as RefreshIcon,
  Business as BusinessIcon,
  AccountTree as AccountTreeIcon,
  Settings as SettingsIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  ContentCopy as CopyIcon,
  OutlinedFlag as ReportIcon,

  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TableChart as TableIcon,
  VisibilityOff as VisibilityOffIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  DeleteOutline as DeleteOutlineIcon,
  CallMerge as CallMergeIcon,
  CallSplit as CallSplitIcon,
  Description as DescriptionIcon,
  Preview as PreviewIcon,
  Info as InfoIcon,
  AltRoute as RouteIcon,
  EventBusy as EventBusyIcon,
  EventAvailable as EventAvailableIcon,
  FactCheck as FactCheckIcon,
  PictureAsPdf as PictureAsPdfIcon,
  VerifiedUser as VerifiedUserIcon,
  Download as DownloadIcon,
  UploadFile as UploadFileIcon,
  StickyNote2 as NoteIcon,
  DeleteSweep as RemoveNoteIcon,
} from '@mui/icons-material';
import PersonIcon from '@mui/icons-material/Person';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import HubIcon from '@mui/icons-material/Hub';
import DDCheckoutDialog from './DDCheckoutDialog';
import RelationshipReportModal from './RelationshipReportModal';
import { extractVisibleScope } from '../utils/relationshipScope';
import { normalizeCompanyName } from '../utils/companyName';
import { trackEvent } from '../utils/track';
import { captureMergeSnapshot, restoreMergeSnapshot } from '../utils/mergeUndo';
import { postCorrection, listCorrections, deleteCorrection, resolveGroupKey } from '../services/correctionsService';
import OfficerTimelineDialog from './OfficerTimelineDialog';
import ApoderadosSidebar from './ApoderadosSidebar';
import Ibex35MarketSidebar from './Ibex35MarketSidebar';
import Ibex35MarketDialog from './Ibex35MarketDialog';
import LegalDisclaimer from './LegalDisclaimer';
import TimelineIcon from '@mui/icons-material/Timeline';
import PsychologyIcon from '@mui/icons-material/Psychology';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ForceGraph2D from 'react-force-graph-2d';
import AIInvestigationGate from './AIInvestigationGate';
import { investigationLaunchState, entitlementChipLabel, buildInvestigationContext, loadToken, INVESTIGATION_CAP } from '../utils/aiInvestigationClient';
import { isLegalEntityName } from '../utils/legalEntity';
import { detectCargoPresence } from '../utils/cargoDetection';
import { mergeCargoIntoCompanyNode, undoCargoUnify } from '../utils/graphUnify';
import { parseSpanishCompanyData } from '../utils/spanishCompanyParserWithTerms';
import {
  POSITION_CATEGORY_ORDER,
  positionCategoryFor,
  sameRoleCategory,
  SIMPLIFIED_EXCLUDED_CATEGORIES,
} from '../utils/positionCategories';
import { isActiveCategory, effectiveCategoryFromEvents } from '../utils/officerLinkStatus';
import { BORME_SECTION_NAMES, getLinkEffectiveCategory, isDirectionalLink } from '../utils/linkDirectionality';
import { useTerms } from '../hooks/useTerms';
import { spanishCompaniesService, SpanishCompaniesService } from '../services/spanishCompaniesService';
import {
  DATA_MAINTENANCE,
  isDataIndexUnavailableError,
} from '../config/dataMaintenance';
import { findDeputyMatch } from '../services/congresoOfficerMatcher';
import {
  findShortestPath,
  detectConnectedComponents,
} from '../utils/networkAnalysis';
import CurrencyConfirmationCard from './CurrencyConfirmationCard.jsx';
import { CONFIRMATIONS } from '../../functions/empresa/_confirmations.js';
import {
  createGraphSnapshot,
  MAX_GRAPH_SNAPSHOT_BYTES,
  parseGraphSnapshot,
} from '../utils/graphSnapshot';
import {
  clearGraphAutosave,
  loadGraphAutosave,
  saveGraphAutosave,
} from '../utils/graphAutosave';
import {
  getNodeNoteMarkerGeometry,
  hasNodeNote,
  mergeNodeNotes,
  nodeMatchesFilterTerms,
  NODE_NOTE_FLAGS,
  NODE_NOTE_MAX_LENGTH,
  removeNodeNote,
  setNodeNote,
} from '../utils/nodeNotes';
import { nameToSlug } from '../../functions/empresa/_slug.js';
import { fullCompanyPageHref } from '../../functions/empresa/_page_href.js';
import { matchIbexSeed, matchAllIbexNodes } from '../utils/ibex35Match';
import { getIbexCompanyData } from '../services/ibex35DashboardClient';
import { isAndroidNativeApp } from '../services/playBillingService';

// Cloudflare Turnstile sitekey — shared with AIInvestigationGate. Gates the
// anonymous enrichment-report submission from the public data preview.
const REPORT_TURNSTILE_SITEKEY = '0x4AAAAAADp3WnZGNiZai_32';

const formatAutosaveTimestamp = (value, language, includeDate = false) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const locale = language === 'es' ? 'es-ES' : 'en-GB';
  return new Intl.DateTimeFormat(
    locale,
    includeDate
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { hour: '2-digit', minute: '2-digit' }
  ).format(date);
};

const CATEGORY_LABELS = {
  es: {
    nombramientos: 'Nombramiento',
    reelecciones: 'Reelección',
    ceses_dimisiones: 'Cese/Dimisión',
    revocaciones: 'Revocación',
    socio_unico: 'Socio único',
    socio_perdido: 'Pérdida socio único',
    socio_anterior: 'Socio único (anterior)',
  },
  en: {
    nombramientos: 'Appointment',
    reelecciones: 'Re-election',
    ceses_dimisiones: 'Termination/Resignation',
    revocaciones: 'Revocation',
    socio_unico: 'Sole shareholder',
    socio_perdido: 'Loss of sole shareholder',
    socio_anterior: 'Previous sole shareholder',
  },
};

const getCategoryLabel = (category, language = 'es') => {
  const labels = CATEGORY_LABELS[language === 'en' ? 'en' : 'es'];
  if (!category) return language === 'en' ? 'Relationship' : 'Relación';
  return labels[category] || category;
};

const CATEGORY_LAYOUT_ANGLE = {
  nombramientos: -Math.PI / 2,
  reelecciones: 0,
  ceses_dimisiones: Math.PI / 2,
  revocaciones: Math.PI,
};

const OFFICERS_PER_COMPANY_OPTIONS = [25, 50, 100, 200, 500];
const COMPANIES_PER_SEARCH_OPTIONS = [10, 25, 50, 100];

// normalizeCompanyName is imported from ../utils/companyName (shared with the
// API service so name normalization can never drift between the two paths).

const companyNameToId = name => {
  const clean = normalizeCompanyName(name);
  return `company-${clean.replace(/\s+/g, '-').toLowerCase()}`;
};

const formatDate = (dateStr, language = 'es') => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(language === 'en' ? 'en-GB' : 'es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
};

const SEARCH_COPY = {
  en: {
    type: 'Type',
    company: 'Company',
    companies: 'Companies',
    officer: 'Officer',
    officers: 'Officers',
    officersPerCompany: 'Officers/company',
    fetchAllOfficers: 'Fetch all',
    showApoderados: 'Show apoderados',
    marketData: 'Market data',
    searchCompanyPlaceholder: 'Search company...',
    searchOfficerPlaceholder: 'Search officer...',
    searchUnifiedPlaceholder: 'Search a company or person…',
    search: 'Search',
    dueDiligence: 'Due Diligence',
    relationshipReportTooltip: 'Relationship report for visible companies (free)',
    relationshipReport: 'Relationship report',
    hideShared: 'Hide shared connections',
    showShared: 'Highlight officers/entities across several companies and dim the rest',
    sharedConnections: 'Shared connections',
    myCorrectionsTooltip: 'Your corrections for this company\'s "Custom" report',
    myCorrections: count => `My corrections (${count})`,
    filterNodes: 'Filter nodes and notes',
    filterPlaceholder: 'e.g. Garcia, relevant manager',
    legalTooltip: 'Source and legal notice',
    legalLabel: 'Source and legal notice',
    pathfinderTooltip: 'Find connection path (Pathfinder)',
    graphSettingsTitle: 'Graph controls',
    pathfinderTitle: 'Connection Path Finder (Pathfinder)',
    originNode: 'Source milestone',
    destinationNode: 'Destination milestone',
    nodePlaceholder: 'Company or officer...',
    officerIndividual: 'Individual officer',
    officerCompany: 'Corporate officer',
    clear: 'Clear',
    connectionFound: jumps => `CONNECTION FOUND (${jumps} ${jumps === 1 ? 'jump' : 'jumps'})`,
    hideDetail: 'Hide details',
    showDetail: 'Show details',
    pathDetails: 'PATH DETAILS',
    jump: index => `Jump ${index}`,
    lastRecord: 'Latest record',
    moreRelationships: count => `+${count} more relationships`,
    connectedWith: (a, b, count) => `${a} connected with ${b}${count > 1 ? ` through ${count} loaded links.` : '.'}`,
    noConnection: 'No direct or indirect connection was found between these two milestones in the loaded network.',
    soleShareholderOf: (name, count) => (
      <>
        <strong>{name}</strong> is sole shareholder of {count} compan{count === 1 ? 'y' : 'ies'}.
      </>
    ),
    loadSubsidiaries: count => `Load ${count} subsidiar${count === 1 ? 'y' : 'ies'}`,
    loading: 'Loading...',
    loaded: 'Loaded',
    loadMore: 'Load more',
    active: 'Active',
    ceased: 'Ceased',
    soleShareholder: 'Sole shareholder',
    previousSoleShareholder: 'Previous sole shareholder',
    simplify: 'Simplify',
    hidden: 'hidden',
    positions: 'Roles',
    clearFilters: 'Clear filters',
    statusTooltip:
      'Each role is tracked by its exact BORME title. If a person changes role type over time, each title is tracked separately, so the same person may appear as active under one title and ceased under another.',
    nodeSize: 'Node size',
    labelSize: 'Label size',
    colorByNetworks: 'Color by networks',
    spacing: 'Edge length',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    center: 'Center',
    clearGraph: 'Clear graph',
    exportGraph: 'Export graph snapshot',
    importGraph: 'Import graph snapshot',
    importedSnapshot: 'Imported snapshot',
    restoredSession: 'Restored session',
    snapshotExported: count => `Graph snapshot exported (${count} nodes).`,
    snapshotImported: (nodes, links) => `Snapshot imported: ${nodes} nodes and ${links} links.`,
    snapshotEmpty: 'Add at least one node before exporting a snapshot.',
    snapshotTooLarge: 'The selected snapshot is larger than 100 MB.',
    snapshotExportError: message => `Could not export the graph snapshot: ${message}`,
    snapshotImportError: message => `Could not import the graph snapshot: ${message}`,
    snapshotPreviewNotice: 'Showing data stored in the imported snapshot. No new lookup was made.',
    autosaveSaving: 'Saving locally…',
    autosaveSavedAt: time => `Saved locally · ${time}`,
    autosaveUnavailable: 'Local autosave unavailable',
    autosaveRestoreTitle: 'Restore your previous session?',
    autosaveRestoreBody: (nodes, links, savedAt) => `A graph saved on this device at ${savedAt} contains ${nodes} nodes and ${links} links.`,
    autosaveDeviceOnly: 'This recovery copy stays in this browser. Export the graph when you need a portable backup.',
    autosaveRestore: 'Restore session',
    autosaveStartFresh: 'Start fresh',
    autosaveRestored: (nodes, links) => `Local session restored: ${nodes} nodes and ${links} links.`,
    fullscreenExit: 'Exit fullscreen',
    fullscreenEmbedded: 'Fullscreen (needed to manage nodes with right click)',
    fullscreen: 'Fullscreen',
    manageHiddenNodes: 'Manage hidden nodes',
    hiddenButton: count => `${count} hidden`,
    nodes: 'Nodes',
    links: 'Links',
    data: 'Data',
    buyDdTooltip: 'Buy Due Diligence report',
    copyTableTooltip: 'Copy table (Excel/Word)',
    expandTable: 'Expand table',
    minimizeTable: 'Minimize table',
    tableCompany: 'Company',
    tableOfficer: 'Officer',
    tableRole: 'Role',
    tableType: 'Type',
    tableDate: 'Date',
    emptyTable: 'Search for a company or officer to see data',
    rowCompanyActions: company => `Actions for ${company}`,
    rowOfficerActions: officer => `Actions for ${officer}`,
    filterByDate: company => `Filter by this date in ${company}`,
    legendCompanies: 'Companies',
    legendPeople: 'People',
    legendCorporateOfficers: 'Corp. officers',
    legendExpanded: 'Expanded',
    legendSearch: 'Search',
    legendAppointments: 'Appts.',
    legendCessations: 'Cessations',
    legendHintEmbedded: 'Double click: expand | Fullscreen to manage',
    legendHint: 'Double click: expand | Right click: manage',
    hiddenNodes: 'Hidden nodes',
    nodeCount: count => `${count} node${count === 1 ? '' : 's'}`,
    showAll: 'Show all',
    noHiddenNodes: 'No hidden nodes',
    // Company⇄cargo unify
    cargoBadge: count => `+${count} cargo${count === 1 ? '' : 's'}`,
    cargoBannerTitle: 'This entity also holds cargos',
    cargoBannerBody: (name, count) => `“${name}” also appears as an officer in ${count} other ${count === 1 ? 'company' : 'companies'}. Unify them onto this node?`,
    cargoUnify: 'Unify',
    cargoUnifying: 'Unifying…',
    cargoDismiss: 'Dismiss',
    cargoUnified: 'Unified — cargos attached',
    cargoUndoChip: count => `⚭ ${count} cargo${count === 1 ? '' : 's'}`,
    cargoUndo: 'Undo unify',
    cargoToggleLabel: count => `Unify cargos (${count})`,
    cargoToggleTooltip: 'This entity also holds officer seats in other companies. Toggle to unify them onto this node (or undo).',
    unifyCargosError: msg => `Could not unify cargos: ${msg}`,
    expandNode: 'Expand node',
    editNode: 'Edit node',
    addPrivateNote: 'Add private note',
    editPrivateNote: 'Edit private note',
    removePrivateNote: 'Remove private note',
    privateNoteTitle: 'Private node note',
    privateNoteLabel: 'Private note',
    privateNoteHelp: 'This is your annotation, not BORME or Registro Mercantil data. It stays with the graph and is included in exported graph snapshots, but never in reports.',
    privateNotePreviewHelp: 'Read-only · Right-click the node to edit or remove.',
    noteFlag: 'Flag colour',
    noteFlagNone: 'No flag',
    noteFlagAmber: 'Amber',
    noteFlagRed: 'Red',
    noteFlagBlue: 'Blue',
    noteFlagGreen: 'Green',
    saveNote: 'Save note',
    noteSaved: 'Private note saved',
    noteRemoved: 'Private note removed',
    mergeNode: 'Merge node',
    unmergeNode: 'Undo merge (unmerge)',
    noMergeCandidates: 'No compatible nodes to merge',
    userMergedBadge: 'User-created grouping',
    userMergedTooltip:
      'You grouped these records manually. The grouping is your working hypothesis — it is not confirmed by BORME data.',
    nodesMergedToast: (from, to) => `Merged: ${from} → ${to}`,
    dataPreview: 'Data preview',
    timeline: 'Timeline',
    markResigned: 'Mark as ceased',
    markActive: 'Mark as active',
    buyDueDiligence: 'Buy Due Diligence',
    buyDueDiligencePriced: 'Get the full report · EUR 22.50',
    fullReportAdds: 'The full report adds an AI risk score, sanctions & PEP screening, full officer history and red-flag analysis.',
    previewSeeSample: 'See a sample report (PDF)',
    previewGuarantee: 'Data-quality guarantee — if anything is wrong, we re-issue it free or refund you within 7 days.',
    hideNodeOnly: 'Hide this node only',
    hideNodeRelations: 'Hide node + connected',
    deleteNode: 'Delete node',
    visibleName: 'Visible name',
    officerType: 'Officer type',
    individualPerson: 'Individual person',
    legalPerson: 'Legal entity',
    editHelp: 'This changes the name shown in the graph to help correct variants.',
    cancel: 'Cancel',
    saveChanges: 'Save changes',
    mergeNodes: 'Merge nodes',
    mergeBody: name => <>Merge <strong>{name}</strong> into another node. All relationships will move to the target node.</>,
    targetNode: 'Target node',
    noMatchingNodes: 'No matching nodes',
    similarNames: 'Similar names',
    mergeRecommendation:
      'Recommendation: merge only nodes that clearly represent the same entity. BORME may spell the same officer in different ways. Merging combines both variants in the preview and report. If they are different people with similar names, the merge will mix unrelated data.',
    merge: 'Merge',
    deleteBody: name => <>Are you sure you want to delete <strong>{name}</strong> and all its relationships?</>,
    delete: 'Delete',
    dissolved: 'Dissolved',
    concurso: 'Insolvency',
    unipersonal: 'Single-member',
    //soleShareholder: 'Sole shareholder',
    naturalPersonTag: '(natural person)',
    companyTag: '(company)',
    loadingData: 'Loading data...',
    name: 'Name',
    date: 'Date',
    summary: 'Summary',
    legalName: 'Legal name',
    previous: 'Previous',
    status: 'Status',
    address: 'Address',
    externalEstimate: '(external-source estimate - verify)',
    reportNifTooltip: 'Report incorrect NIF',
    reportNifTitle: 'Report incorrect NIF',
    reportIntro: 'This NIF comes from a web search and may be wrong. Send a correction and an administrator will review it.',
    reportCurrentValue: 'Current value',
    reportSuggestedLabel: 'Correct value (if known)',
    reportNoteLabel: 'Note (optional)',
    reportCancel: 'Cancel',
    reportSubmit: 'Send report',
    reportVerifyPending: 'Please complete the verification below.',
    reportThanks: 'Thanks — an administrator will review the correction.',
    reportError: (msg) => `Could not send the report: ${msg}`,
    nifMissingLabel: 'No NIF on record',
    reportNifMissingCta: 'Suggest one',
    reportNifMissingTitle: 'Suggest a NIF',
    reportMissingIntro: 'No NIF is on record for this company. If you know it, suggest it and an administrator will review it.',
    activity: 'Corporate purpose',
    capital: 'Share capital',
    bormeRange: 'BORME publication range',
    publicationsFound: 'Publications found',
    registrySheetChange: 'Registry sheet change (re-registration)',
    currentOfficers: count => `Current officers (${count})`,
    appointments: 'Appointments',
    reelections: 'Re-elections',
    cessations: 'Terminations/Resignations',
    revocations: 'Revocations',
    previewWatermark: 'Preview - buy a Due Diligence report for the full report',
    congressDeputy: 'Congress deputy',
    formerCongressDeputy: 'Former Congress deputy',
    matchesWith: 'Matches',
    party: 'Party',
    group: 'Group',
    constituency: 'Constituency',
    legislature: count => `Legislature${count === 1 ? '' : 's'} (${count})`,
    period: 'Period',
    present: 'present',
    congressProfile: 'Profile on congreso.es',
    mergedNodesData: 'Combined data from merged nodes',
    nameVariants: 'Name variants',
    mergedWarning: 'If the names belong to different people, the shown roles may mix data from different people.',
    whollyOwned: count => `Sole shareholder of ${count} compan${count === 1 ? 'y' : 'ies'}`,
    whollyOwnedHelp: 'This person appears as 100% owner of the following companies.',
    rolesInCompanies: count => `Roles in ${count} compan${count === 1 ? 'y' : 'ies'}`,
    role: 'Role',
    unknown: 'Unknown',
    close: 'Close',
    legalTitle: 'Source and legal notice',
    markResignedBody: name => (
      <>
        Mark <strong>{name}</strong> as ceased in the custom report. This does not modify the Registro Mercantil; it only affects your "Custom" report.
      </>
    ),
    resignationDate: 'Cessation date (optional)',
    noSelectedCompany: 'No company selected',
    emptyCorrections:
      'You have not made corrections for this company yet. Use an officer menu action (hide, merge, mark as ceased) to create them.',
    correctionLabel: correction => {
      if (correction.action === 'hide') return `Hide: ${correction.name_a}`;
      if (correction.action === 'merge') return `Merge: ${correction.name_a} -> ${correction.name_b}`;
      return `Ceased: ${correction.name_a}${correction.resigned_date ? ` (${correction.resigned_date})` : ''}`;
    },
    removeCorrection: 'Remove correction',
    undo: 'Undo',
    graphTitle: 'Spanish Company Network',
    searching: query => `Searching ${query}...`,
    searchEmpty: 'Please enter a search term',
    officerNoResults: query => `No results found for officer "${query}".`,
    noPreciseMatch: query => `No precise company match found for "${query}". Try a broader search.`,
    noResults: query => `No results found for "${query}".`,
    searchError: message => `Search error: ${message}`,
    noMorePrecise: query => `No more precise matches for "${query}".`,
    loadMoreError: message => `Error loading more results: ${message}`,
    addCompanyError: message => `Error adding company to graph: ${message}`,
    addOfficerError: message => `Error adding officer to graph: ${message}`,
    loadSubsidiariesError: message => `Error loading subsidiaries: ${message}`,
    noAdditionalResults: name => `No additional results found for "${name}"`,
    expandError: message => `Error expanding node: ${message}`,
    correctionSubjectError:
      'I could not link the correction to the main company; the change is visual only and will not affect the report.',
    correctionSaved: 'Correction saved',
    hiddenOfficerCorrection: name => `Officer hidden: ${name}`,
    resignedOfficerCorrection: name => `Marked as ceased: ${name}`,
    activeOfficerCorrection: name => `Marked as active: ${name}`,
    mergedOfficerCorrection: (from, to) => `Merged: ${from} -> ${to}`,
    correctionSaveError: message => `Could not save the correction: ${message}`,
    correctionUndoError: message => `Could not undo the correction: ${message}`,
    correctionsLoadError: message => `Could not load corrections: ${message}`,
    correctionDeleteError: message => `Could not remove the correction: ${message}`,
    noOfficerPreview: 'No data found for this officer.',
    noCompanyPreview: 'No data found for this company.',
    previewError: message => `Error fetching data: ${message}`,
    emptyNodeName: 'Node name cannot be empty.',
    selectMergeTarget: 'Select a target node to merge into.',
    relationshipResolveError:
      'I could not reliably identify at least 2 visible companies. Try searching for them by exact name.',
    relationshipPrepareError: message => `Could not prepare the relationship report: ${message}`,
    copyTableError: 'Could not copy the table to the clipboard.',
    investigationAdd: 'Add to AI investigation',
    investigationRemove: 'Remove from AI investigation',
    investigateSelection: 'Investigate selection',
    investigationOverCap: `Reduce the selection to ${INVESTIGATION_CAP} entities`,
  },
  es: {
    type: 'Tipo',
    company: 'Empresa',
    companies: 'Empresas',
    officer: 'Directivo',
    officers: 'Directivos',
    officersPerCompany: 'Cargos/empresa',
    fetchAllOfficers: 'Ver todos',
    showApoderados: 'Ver apoderados',
    marketData: 'Datos de mercado',
    searchCompanyPlaceholder: 'Buscar empresa...',
    searchOfficerPlaceholder: 'Buscar directivo...',
    searchUnifiedPlaceholder: 'Busca una empresa o persona…',
    search: 'Buscar',
    dueDiligence: 'Due Diligence',
    relationshipReportTooltip: 'Informe de relaciones sobre las empresas visibles (gratis)',
    relationshipReport: 'Informe de relaciones',
    hideShared: 'Ocultar conexiones compartidas',
    showShared: 'Resaltar administradores/entidades en varias empresas y atenuar el resto',
    sharedConnections: 'Conexiones compartidas',
    myCorrectionsTooltip: 'Tus correcciones para el informe "Custom" de esta empresa',
    myCorrections: count => `Mis correcciones (${count})`,
    filterNodes: 'Filtrar nodos y notas',
    filterPlaceholder: 'ej: Garcia, directivo relevante',
    legalTooltip: 'Fuente y aviso legal',
    legalLabel: 'Fuente y aviso legal',
    pathfinderTooltip: 'Buscar camino de conexión (Pathfinder)',
    graphSettingsTitle: 'Controles del grafo',
    pathfinderTitle: 'Buscador de Caminos de Conexión (Pathfinder)',
    originNode: 'Hito de origen',
    destinationNode: 'Hito de destino',
    nodePlaceholder: 'Empresa o administrador...',
    officerIndividual: 'Administrador persona física',
    officerCompany: 'Administrador persona jurídica',
    clear: 'Limpiar',
    connectionFound: jumps => `CONEXIÓN ENCONTRADA (${jumps} saltos)`,
    hideDetail: 'Ocultar detalle',
    showDetail: 'Ver detalle',
    pathDetails: 'DETALLE DEL CAMINO',
    jump: index => `Salto ${index}`,
    lastRecord: 'Último registro',
    moreRelationships: count => `+${count} relaciones más`,
    connectedWith: (a, b, count) => `${a} conectado con ${b}${count > 1 ? ` mediante ${count} enlaces cargados.` : '.'}`,
    noConnection: 'No se ha encontrado ninguna conexión directa o indirecta entre estos dos hitos en la red cargada.',
    soleShareholderOf: (name, count) => (
      <>
        <strong>{name}</strong> es socio único de {count} empresa{count === 1 ? '' : 's'}.
      </>
    ),
    loadSubsidiaries: count => `Cargar ${count} participada${count === 1 ? '' : 's'}`,
    loading: 'Cargando...',
    loaded: 'Cargados',
    loadMore: 'Cargar más',
    active: 'Vigentes',
    ceased: 'Cesados',
    soleShareholder: 'Socio único',
    previousSoleShareholder: 'Socio único anterior',
    simplify: 'Simplificar',
    hidden: 'ocultos',
    positions: 'Cargos',
    clearFilters: 'Limpiar filtros',
    statusTooltip:
      'Cada cargo se sigue por su denominación exacta en el BORME. Si una persona cambia de tipo de cargo con el tiempo, cada denominación se registra por separado, por lo que una misma persona puede aparecer a la vez como vigente bajo una denominación y como cesada bajo otra.',
    nodeSize: 'Tamaño de nodos',
    labelSize: 'Tamaño de etiquetas',
    colorByNetworks: 'Colorear por redes',
    spacing: 'Longitud de enlaces',
    zoomIn: 'Acercar',
    zoomOut: 'Alejar',
    center: 'Centrar',
    clearGraph: 'Limpiar grafo',
    exportGraph: 'Exportar instantánea del grafo',
    importGraph: 'Importar instantánea del grafo',
    importedSnapshot: 'Instantánea importada',
    restoredSession: 'Sesión restaurada',
    snapshotExported: count => `Instantánea exportada (${count} nodos).`,
    snapshotImported: (nodes, links) => `Instantánea importada: ${nodes} nodos y ${links} enlaces.`,
    snapshotEmpty: 'Añade al menos un nodo antes de exportar una instantánea.',
    snapshotTooLarge: 'La instantánea seleccionada supera los 100 MB.',
    snapshotExportError: message => `No se pudo exportar la instantánea: ${message}`,
    snapshotImportError: message => `No se pudo importar la instantánea: ${message}`,
    snapshotPreviewNotice: 'Se muestran los datos guardados en la instantánea. No se ha realizado una nueva consulta.',
    autosaveSaving: 'Guardando localmente…',
    autosaveSavedAt: time => `Guardado localmente · ${time}`,
    autosaveUnavailable: 'Guardado local no disponible',
    autosaveRestoreTitle: '¿Restaurar la sesión anterior?',
    autosaveRestoreBody: (nodes, links, savedAt) => `Un grafo guardado en este dispositivo a las ${savedAt} contiene ${nodes} nodos y ${links} enlaces.`,
    autosaveDeviceOnly: 'Esta copia de recuperación permanece en este navegador. Exporta el grafo cuando necesites una copia portátil.',
    autosaveRestore: 'Restaurar sesión',
    autosaveStartFresh: 'Empezar de cero',
    autosaveRestored: (nodes, links) => `Sesión local restaurada: ${nodes} nodos y ${links} enlaces.`,
    fullscreenExit: 'Salir de pantalla completa',
    fullscreenEmbedded: 'Pantalla completa (necesaria para gestionar nodos con clic derecho)',
    fullscreen: 'Pantalla completa',
    manageHiddenNodes: 'Gestionar nodos ocultos',
    hiddenButton: count => `${count} ocultos`,
    nodes: 'Nodos',
    links: 'Enlaces',
    data: 'Datos',
    buyDdTooltip: 'Comprar informe Due Diligence',
    copyTableTooltip: 'Copiar tabla (Excel/Word)',
    expandTable: 'Expandir tabla',
    minimizeTable: 'Minimizar tabla',
    tableCompany: 'Empresa',
    tableOfficer: 'Directivo',
    tableRole: 'Cargo',
    tableType: 'Tipo',
    tableDate: 'Fecha',
    emptyTable: 'Busca una empresa o directivo para ver datos',
    rowCompanyActions: company => `Acciones sobre ${company}`,
    rowOfficerActions: officer => `Acciones sobre ${officer}`,
    filterByDate: company => `Filtrar por esta fecha en ${company}`,
    legendCompanies: 'Empresas',
    legendPeople: 'Personas',
    legendCorporateOfficers: 'Emp. directivas',
    legendExpanded: 'Expandidos',
    legendSearch: 'Búsqueda',
    legendAppointments: 'Nombram.',
    legendCessations: 'Ceses',
    legendHintEmbedded: 'Doble clic: expandir | Pantalla completa para gestionar',
    legendHint: 'Doble clic: expandir | Clic derecho: gestionar',
    hiddenNodes: 'Nodos ocultos',
    nodeCount: count => `${count} nodo${count === 1 ? '' : 's'}`,
    showAll: 'Mostrar todos',
    noHiddenNodes: 'Sin nodos ocultos',
    // Unificación empresa⇄cargo
    cargoBadge: count => `+${count} cargo${count === 1 ? '' : 's'}`,
    cargoBannerTitle: 'Esta entidad también figura como cargo',
    cargoBannerBody: (name, count) => `«${name}» también figura como cargo en ${count} ${count === 1 ? 'sociedad' : 'sociedades'}. ¿Unificarlas en este nodo?`,
    cargoUnify: 'Unificar',
    cargoUnifying: 'Unificando…',
    cargoDismiss: 'Descartar',
    cargoUnified: 'Unificada — cargos añadidos',
    cargoUndoChip: count => `⚭ ${count} cargo${count === 1 ? '' : 's'}`,
    cargoUndo: 'Deshacer unificación',
    cargoToggleLabel: count => `Unificar cargos (${count})`,
    cargoToggleTooltip: 'Esta entidad también ocupa cargos en otras sociedades. Actívalo para unificarlos en este nodo (o deshacer).',
    unifyCargosError: msg => `No se pudieron unificar los cargos: ${msg}`,
    expandNode: 'Expandir nodo',
    editNode: 'Modificar nodo',
    addPrivateNote: 'Añadir nota privada',
    editPrivateNote: 'Editar nota privada',
    removePrivateNote: 'Eliminar nota privada',
    privateNoteTitle: 'Nota privada del nodo',
    privateNoteLabel: 'Nota privada',
    privateNoteHelp: 'Esta es tu anotación, no un dato del BORME ni del Registro Mercantil. Se conserva con el grafo y se incluye en las instantáneas exportadas, pero nunca en los informes.',
    privateNotePreviewHelp: 'Solo lectura · Haz clic derecho en el nodo para editar o eliminar.',
    noteFlag: 'Color de marca',
    noteFlagNone: 'Sin marca',
    noteFlagAmber: 'Ámbar',
    noteFlagRed: 'Rojo',
    noteFlagBlue: 'Azul',
    noteFlagGreen: 'Verde',
    saveNote: 'Guardar nota',
    noteSaved: 'Nota privada guardada',
    noteRemoved: 'Nota privada eliminada',
    mergeNode: 'Fusionar nodo',
    unmergeNode: 'Deshacer fusión',
    noMergeCandidates: 'Sin nodos compatibles para fusionar',
    userMergedBadge: 'Agrupación creada por el usuario',
    userMergedTooltip:
      'Has agrupado estos registros manualmente. La agrupación es tu hipótesis de trabajo — no está confirmada por los datos del BORME.',
    nodesMergedToast: (from, to) => `Fusionados: ${from} → ${to}`,
    dataPreview: 'Vista previa de datos',
    timeline: 'Línea temporal',
    markResigned: 'Marcar como cesado',
    markActive: 'Marcar como activo',
    buyDueDiligence: 'Comprar Due Diligence',
    buyDueDiligencePriced: 'Obtener el informe completo · 22,50 €',
    fullReportAdds: 'El informe completo añade una puntuación de riesgo por IA, cruce de sanciones y PEP, historial completo de administradores y análisis de señales de alerta.',
    previewSeeSample: 'Ver un informe de ejemplo (PDF)',
    previewGuarantee: 'Garantía de calidad de datos: si algo es incorrecto, lo reemitimos gratis o te reembolsamos en un plazo de 7 días.',
    hideNodeOnly: 'Ocultar solo nodo',
    hideNodeRelations: 'Ocultar nodo + conectados',
    deleteNode: 'Eliminar nodo',
    visibleName: 'Nombre visible',
    officerType: 'Tipo de directivo',
    individualPerson: 'Persona física',
    legalPerson: 'Persona jurídica',
    editHelp: 'Esta operación cambia el nombre mostrado en el grafo para ayudarte a corregir variantes.',
    cancel: 'Cancelar',
    saveChanges: 'Guardar cambios',
    mergeNodes: 'Fusionar nodos',
    mergeBody: name => <>Fusionar <strong>{name}</strong> en otro nodo. Todas las relaciones pasarán al nodo destino.</>,
    targetNode: 'Nodo destino',
    noMatchingNodes: 'No hay nodos que coincidan',
    similarNames: 'Nombres similares',
    mergeRecommendation:
      'Recomendación: fusiona solo nodos que representen claramente la misma entidad. En el BORME, un mismo directivo puede aparecer con variantes de nombre. Al fusionar, los datos de ambas variantes se combinan en la vista previa y el informe. Si se trata de personas distintas con nombres similares, la fusión mezclará datos no relacionados.',
    merge: 'Fusionar',
    deleteBody: name => <>¿Seguro que quieres eliminar <strong>{name}</strong> y todas sus relaciones?</>,
    delete: 'Eliminar',
    dissolved: 'Disuelta',
    concurso: 'Concurso',
    unipersonal: 'Unipersonal',
    //soleShareholder: 'Socio único',
    naturalPersonTag: '(persona física)',
    companyTag: '(sociedad)',
    loadingData: 'Cargando datos...',
    name: 'Nombre',
    date: 'Fecha',
    summary: 'Resumen',
    legalName: 'Denominación',
    previous: 'Antes',
    status: 'Estado',
    address: 'Domicilio',
    externalEstimate: '(estimación de fuente externa - verificar)',
    reportNifTooltip: 'Reportar NIF incorrecto',
    reportNifTitle: 'Reportar NIF incorrecto',
    reportIntro: 'Este NIF procede de una búsqueda web y puede ser erróneo. Envía una corrección y un administrador la revisará.',
    reportCurrentValue: 'Valor actual',
    reportSuggestedLabel: 'Valor correcto (si lo conoces)',
    reportNoteLabel: 'Nota (opcional)',
    reportCancel: 'Cancelar',
    reportSubmit: 'Enviar reporte',
    reportVerifyPending: 'Completa la verificación de abajo.',
    reportThanks: 'Gracias — un administrador revisará la corrección.',
    reportError: (msg) => `No se pudo enviar el reporte: ${msg}`,
    nifMissingLabel: 'Sin NIF registrado',
    reportNifMissingCta: 'Sugerir uno',
    reportNifMissingTitle: 'Sugerir un NIF',
    reportMissingIntro: 'No consta ningún NIF para esta empresa. Si lo conoces, sugiérelo y un administrador lo revisará.',
    activity: 'Objeto social',
    capital: 'Capital social',
    bormeRange: 'Rango de publicaciones BORME',
    publicationsFound: 'Publicaciones encontradas',
    registrySheetChange: 'Cambio de hoja registral (reinscripción)',
    currentOfficers: count => `Directivos actuales (${count})`,
    appointments: 'Nombramientos',
    reelections: 'Reelecciones',
    cessations: 'Ceses/Dimisiones',
    revocations: 'Revocaciones',
    previewWatermark: 'Vista previa - para un informe completo, adquiera una Due Diligence',
    congressDeputy: 'Diputado del Congreso',
    formerCongressDeputy: 'Ex-diputado del Congreso',
    matchesWith: 'Coincide con',
    party: 'Partido',
    group: 'Grupo',
    constituency: 'Circunscripción',
    legislature: count => `Legislatura${count === 1 ? '' : 's'} (${count})`,
    period: 'Período',
    present: 'actualidad',
    congressProfile: 'Ficha en congreso.es',
    mergedNodesData: 'Datos combinados de nodos fusionados',
    nameVariants: 'Variantes de nombre',
    mergedWarning: 'Si los nombres corresponden a personas distintas, los cargos mostrados pueden mezclar datos de personas diferentes.',
    whollyOwned: count => `Socio único de ${count} empresa${count === 1 ? '' : 's'}`,
    whollyOwnedHelp: 'Esta persona figura como propietaria al 100% de las empresas siguientes.',
    rolesInCompanies: count => `Cargos en ${count} empresa${count === 1 ? '' : 's'}`,
    role: 'Cargo',
    unknown: 'Desconocido',
    close: 'Cerrar',
    legalTitle: 'Fuente y aviso legal',
    markResignedBody: name => (
      <>
        Marcar a <strong>{name}</strong> como cesado en el informe personalizado. Esto no modifica el Registro Mercantil; solo afecta a tu informe "Custom".
      </>
    ),
    resignationDate: 'Fecha de cese (opcional)',
    noSelectedCompany: 'Sin empresa seleccionada',
    emptyCorrections:
      'Aún no has hecho correcciones en esta empresa. Usa el menú de un directivo (ocultar, fusionar, marcar como cesado) para crearlas.',
    correctionLabel: correction => {
      if (correction.action === 'hide') return `Ocultar: ${correction.name_a}`;
      if (correction.action === 'merge') return `Fusionar: ${correction.name_a} -> ${correction.name_b}`;
      return `Cesado: ${correction.name_a}${correction.resigned_date ? ` (${correction.resigned_date})` : ''}`;
    },
    removeCorrection: 'Eliminar corrección',
    undo: 'Deshacer',
    graphTitle: 'Red de Empresas Españolas',
    searching: query => `Buscando ${query}...`,
    searchEmpty: 'Por favor, introduce un término de búsqueda',
    officerNoResults: query => `No se encontraron resultados para el directivo "${query}".`,
    noPreciseMatch: query => `No se encontró una coincidencia precisa para "${query}". Prueba con una búsqueda más amplia.`,
    noResults: query => `No se encontraron resultados para "${query}".`,
    searchError: message => `Error en la búsqueda: ${message}`,
    noMorePrecise: query => `No hay más coincidencias precisas para "${query}".`,
    loadMoreError: message => `Error al cargar más resultados: ${message}`,
    addCompanyError: message => `Error al añadir empresa al grafo: ${message}`,
    addOfficerError: message => `Error al añadir directivo al grafo: ${message}`,
    loadSubsidiariesError: message => `Error al cargar participadas: ${message}`,
    noAdditionalResults: name => `No se encontraron resultados adicionales para "${name}"`,
    expandError: message => `Error al expandir nodo: ${message}`,
    correctionSubjectError:
      'No pude vincular la corrección a la empresa principal; el cambio es solo visual y no afectará al informe.',
    correctionSaved: 'Corrección guardada',
    hiddenOfficerCorrection: name => `Directivo ocultado: ${name}`,
    resignedOfficerCorrection: name => `Marcado como cesado: ${name}`,
    activeOfficerCorrection: name => `Marcado como activo: ${name}`,
    mergedOfficerCorrection: (from, to) => `Fusionado: ${from} -> ${to}`,
    correctionSaveError: message => `No se pudo guardar la corrección: ${message}`,
    correctionUndoError: message => `No se pudo deshacer la corrección: ${message}`,
    correctionsLoadError: message => `No se pudieron cargar las correcciones: ${message}`,
    correctionDeleteError: message => `No se pudo eliminar la corrección: ${message}`,
    noOfficerPreview: 'No se encontraron datos para este directivo.',
    noCompanyPreview: 'No se encontraron datos para esta empresa.',
    previewError: message => `Error al obtener datos: ${message}`,
    emptyNodeName: 'El nombre del nodo no puede estar vacío.',
    selectMergeTarget: 'Selecciona un nodo destino para fusionar.',
    relationshipResolveError:
      'No pude identificar con seguridad al menos 2 de las empresas visibles. Prueba a buscarlas por su nombre exacto.',
    relationshipPrepareError: message => `No se pudo preparar el informe de relaciones: ${message}`,
    copyTableError: 'No se pudo copiar la tabla al portapapeles.',
    investigationAdd: 'Añadir a investigación por IA',
    investigationRemove: 'Quitar de la investigación por IA',
    investigateSelection: 'Investigar selección',
    investigationOverCap: `Reduce la selección a ${INVESTIGATION_CAP} entidades`,
  },
};

const isFinitePoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);

const computeGraphCentroid = (nodes, fallback = null) => {
  const positioned = (nodes || []).filter(isFinitePoint);
  if (positioned.length === 0) return fallback || { x: 0, y: 0 };
  return {
    x: positioned.reduce((sum, n) => sum + n.x, 0) / positioned.length,
    y: positioned.reduce((sum, n) => sum + n.y, 0) / positioned.length,
  };
};

// Simple ring layout: places nodes in a circle around the anchor.
// Used for the initial search result and direct children of a company.
const ringPosition = ({
  anchor,
  index,
  total,
  existingNodes,
  radius = 180,
  minDistance = 50,
  startAngle = -Math.PI / 2,
  ringGap = 55,
}) => {
  const maxPerRing = Math.max(total, 1);
  const ring = Math.floor(index / maxPerRing);
  const slotInRing = index % maxPerRing;
  const nodesInRing = Math.min(maxPerRing, total - ring * maxPerRing);
  const r = radius + ring * ringGap;
  const angleStep = (2 * Math.PI) / nodesInRing;
  const angle = startAngle + slotInRing * angleStep;

  let x = anchor.x + Math.cos(angle) * r;
  let y = anchor.y + Math.sin(angle) * r;

  // Light nudge if overlapping existing nodes
  const positioned = (existingNodes || []).filter(isFinitePoint);
  const minDistSq = minDistance * minDistance;
  for (let attempt = 0; attempt < 12; attempt++) {
    const hasOverlap = positioned.some(n => {
      const dx = n.x - x;
      const dy = n.y - y;
      return dx * dx + dy * dy < minDistSq;
    });
    if (!hasOverlap) break;
    const a = Math.atan2(y - anchor.y, x - anchor.x) + 0.3;
    const rr = Math.hypot(x - anchor.x, y - anchor.y) + 20;
    x = anchor.x + Math.cos(a) * rr;
    y = anchor.y + Math.sin(a) * rr;
  }

  return { x, y };
};

// Find the least-crowded direction from `anchor` considering all existing nodes.
// Returns an angle (radians) pointing away from the densest area.
const leastCrowdedAngle = (anchor, existingNodes) => {
  const positioned = (existingNodes || []).filter(isFinitePoint);
  if (positioned.length === 0) return -Math.PI / 2; // default: upward

  const SECTORS = 24;
  const sectorWeight = new Array(SECTORS).fill(0);
  positioned.forEach(n => {
    const dx = n.x - anchor.x;
    const dy = n.y - anchor.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < 1) return;
    const angle = Math.atan2(dy, dx);
    const idx = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * SECTORS) % SECTORS;
    const weight = 1 / Math.max(distSq, 100);
    sectorWeight[idx] += weight;
    sectorWeight[(idx + 1) % SECTORS] += weight * 0.5;
    sectorWeight[(idx - 1 + SECTORS) % SECTORS] += weight * 0.5;
  });

  let minIdx = 0;
  let minW = Infinity;
  for (let i = 0; i < SECTORS; i++) {
    if (sectorWeight[i] < minW) {
      minW = sectorWeight[i];
      minIdx = i;
    }
  }
  return -Math.PI + ((minIdx + 0.5) / SECTORS) * 2 * Math.PI;
};

// Check if a circular area is free of existing nodes.
const isAreaFree = (center, radius, existingNodes, buffer = 0) => {
  const checkR = radius + buffer;
  const checkRSq = checkR * checkR;
  return !(existingNodes || []).some(n => {
    if (!isFinitePoint(n)) return false;
    const dx = n.x - center.x;
    const dy = n.y - center.y;
    return dx * dx + dy * dy < checkRSq;
  });
};

// Find a hub point at `stemLength` from anchor in the least-crowded direction.
// Tries rotating to find a free spot, but NEVER exceeds stemLength * 1.1
// to prevent edges from growing unboundedly with each expansion.
const findHubPoint = ({ anchor, stemLength, existingNodes, hubRadius = 80 }) => {
  const positioned = (existingNodes || []).filter(isFinitePoint);
  const baseAngle = leastCrowdedAngle(anchor, positioned);
  const maxDist = stemLength * 1.1; // hard cap — never go further than this

  // Try rotating in increments to find a free spot at fixed distance
  for (let attempt = 0; attempt < 16; attempt++) {
    const angleOffset = attempt === 0 ? 0 : ((attempt % 2 === 1 ? 1 : -1) * Math.ceil(attempt / 2) * (Math.PI / 8));
    const angle = baseAngle + angleOffset;
    const candidate = {
      x: anchor.x + Math.cos(angle) * stemLength,
      y: anchor.y + Math.sin(angle) * stemLength,
    };
    if (isAreaFree(candidate, hubRadius, positioned, 10)) {
      return candidate;
    }
  }

  // No free spot found — just use least-crowded direction at capped distance.
  // Accept some overlap rather than creating a very long edge.
  return {
    x: anchor.x + Math.cos(baseAngle) * maxDist,
    y: anchor.y + Math.sin(baseAngle) * maxDist,
  };
};

// "Flower cluster" layout: places nodes in a tight cluster around a hub point
// that is offset from the anchor by a long stem. Creates the flower effect:
// long stem from parent → tight cluster of children.
//
// Call computeClusterHub() once per expansion, then clusterPosition() per node.
const computeClusterHub = ({
  anchor,          // The expanded node's position
  total,           // Total number of new nodes to place
  existingNodes,   // All existing nodes (for collision avoidance)
  stemLength = 180, // Distance from anchor to cluster center
  clusterSpacing = 45, // Spacing between nodes within the cluster
}) => {
  // Estimate how big the cluster will be
  const clusterRadius = Math.max(40, Math.sqrt(total) * clusterSpacing / 2);

  const hub = findHubPoint({
    anchor,
    stemLength: Math.max(stemLength, clusterRadius + 80), // ensure hub is far enough
    existingNodes,
    hubRadius: clusterRadius,
  });

  return { hub, clusterRadius };
};

// Place a single node within a cluster around the hub.
const clusterPosition = ({
  hub,              // The cluster center (from computeClusterHub)
  index,
  total,
  existingNodes,
  clusterSpacing = 45,
  minDistance = 40,
}) => {
  if (total <= 1) {
    return { x: hub.x, y: hub.y };
  }

  // Arrange in concentric rings around the hub
  // Inner ring fits ~6 nodes, each subsequent ring fits more
  const nodesPerRing = (ring) => Math.max(6, Math.floor(2 * Math.PI * (ring + 1) * clusterSpacing / clusterSpacing));
  let ring = 0;
  let accumulated = 0;
  while (accumulated + nodesPerRing(ring) <= index) {
    accumulated += nodesPerRing(ring);
    ring++;
  }
  const slotInRing = index - accumulated;
  const nodesInThisRing = Math.min(nodesPerRing(ring), total - accumulated);

  const radius = ring === 0
    ? clusterSpacing * 0.8
    : clusterSpacing * 0.8 + ring * clusterSpacing * 0.7;
  const angleStep = (2 * Math.PI) / nodesInThisRing;
  // Offset each ring slightly so nodes don't line up radially
  const ringOffset = ring * 0.3;
  const angle = ringOffset + slotInRing * angleStep;

  let x = hub.x + Math.cos(angle) * radius;
  let y = hub.y + Math.sin(angle) * radius;

  // Light nudge if overlapping
  const positioned = (existingNodes || []).filter(isFinitePoint);
  const minDistSq = minDistance * minDistance;
  for (let attempt = 0; attempt < 12; attempt++) {
    const hasOverlap = positioned.some(n => {
      const dx = n.x - x;
      const dy = n.y - y;
      return dx * dx + dy * dy < minDistSq;
    });
    if (!hasOverlap) break;
    // Push slightly outward from hub
    const a = Math.atan2(y - hub.y, x - hub.x) + 0.3;
    const r = Math.hypot(x - hub.x, y - hub.y) + 15;
    x = hub.x + Math.cos(a) * r;
    y = hub.y + Math.sin(a) * r;
  }

  return { x, y };
};

const normalizeNodeId = id => (id == null ? '' : String(id));
const isSameNodeId = (a, b) => normalizeNodeId(a) === normalizeNodeId(b);
const getNodeIdFromRef = ref => (ref && typeof ref === 'object' ? ref.id : ref);

const normalizeCategoryKey = category => {
  if (!category) return 'nombramientos';
  const cat = category.toLowerCase();
  if (cat.includes('reelec')) return 'reelecciones';
  if (cat.includes('revoc')) return 'revocaciones';
  if (cat.includes('cese') || cat.includes('dimis') || cat === 'resignations') return 'ceses_dimisiones';
  if (cat.includes('nombramiento') || cat === 'appointments') return 'nombramientos';
  return 'nombramientos';
};

const isActiveLinkCategory = isActiveCategory;

// getLinkEffectiveCategory now lives in ../utils/linkDirectionality (imported
// above), shared with isDirectionalLink so the arrowhead/particle gate and the
// active/ceased status logic resolve a link's category identically.

// A dissolved company can't have current officers — a dissolution implies
// cessation even if BORME never inscribed individual ceses. When
// enrichLinksWithEventDates stamps link.companyDissolved = true (by reading
// the company node's isDissolved flag), we treat the link as ceased regardless
// of its event-derived category.
const getOfficerLinkStatus = link => {
  if (link.companyDissolved) return 'ceased';
  return isActiveLinkCategory(getLinkEffectiveCategory(link)) ? 'active' : 'ceased';
};

// Resolve category for a v3 expand-officer entry. Prefer the explicit
// `status` field (active/ceased) the backend copied from officers_active /
// officers_resigned; fall back to `event_type` when status is absent.
const resolveOfficerEntryCategory = entry => {
  const status = (entry?.status || '').toLowerCase();
  if (status === 'ceased' || status === 'resigned') return 'ceses_dimisiones';
  if (status === 'active') {
    const evt = (entry.event_type || entry.entry_type || '').toLowerCase();
    if (evt.includes('reelecc')) return 'reelecciones';
    return 'nombramientos';
  }
  return normalizeCategoryKey(entry?.event_type || entry?.entry_type);
};

const entryTimestamp = entry => {
  const v = entry?.date || entry?.event_date || entry?.indexed_date;
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};

// Determine the effective category for a group of entries sharing the
// same (officer, company, position). A ceased status wins unless a later
// appointment exists for the same role.
const resolveEffectiveCategoryForEntries = entries => {
  if (!entries || entries.length === 0) return 'nombramientos';
  const sorted = entries.slice().sort((a, b) => entryTimestamp(b) - entryTimestamp(a));
  return resolveOfficerEntryCategory(sorted[0]);
};

const normalizeNameForMerge = value =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// Officer node identity. BORME spells the same person differently across
// hojas ("GARCIA-BRAGADO" in one era's doc, "GARCIA BRAGADO" in another), and
// node ids collapse whitespace to hyphens — so the existing-node check must be
// exactly as tolerant as the id, or two node objects end up sharing one id and
// ForceGraph attaches every link to a single one (the other renders orphaned).
const officerNodeKey = name => (name || '').trim().toLowerCase().replace(/[\s-]+/g, '-');
const officerIdFor = name => `officer-${officerNodeKey(name)}`;

// BORME_SECTION_NAMES and isDirectionalLink now live in
// ../utils/linkDirectionality (imported above).

const normalizeEdgeLabelText = (relationship, _category) => {
  const text = (relationship || '').trim();
  if (!text || BORME_SECTION_NAMES.has(text.toLowerCase())) return '';
  return text;
};

const getPathNodeKindLabel = (node, language = 'es') => {
  if (!node) return language === 'en' ? 'Milestone' : 'Hito';
  if (node.type === 'officer') {
    if (language === 'en') return node.subtype === 'company' ? 'corporate officer' : 'officer';
    return node.subtype === 'company' ? 'Administrador persona jurídica' : 'Administrador';
  }
  return language === 'en' ? 'company' : 'Empresa';
};

const getPathNodeName = node => node?.name || node?.label || node?.id || 'Hito desconocido';

const getPathLinkLabel = (link, language = 'es') => {
  const relationship = normalizeEdgeLabelText(link?.relationship, link?.category);
  return relationship || getCategoryLabel(link?.category, language);
};

const getPathLinkDateLabel = (link, language = 'es') => {
  const dates = [];
  if (Array.isArray(link?.events)) {
    link.events.forEach(event => {
      if (event?.date) dates.push(event.date);
    });
  }
  if (link?.date) dates.push(link.date);

  const sorted = Array.from(new Set(dates))
    .map(date => ({ date, ts: entryTimestamp(date) }))
    .filter(item => item.ts > 0)
    .sort((a, b) => b.ts - a.ts);

  if (sorted.length === 0) return '';
  const latest = formatDate(sorted[0].date, language);
  return sorted.length > 1 ? `${latest} (+${sorted.length - 1})` : latest;
};

const summarizePathLinks = (links, language = 'es') => {
  if (!links || links.length === 0) {
    return {
      relationship: language === 'en' ? 'Loaded relationship' : 'Relación cargada',
      category: language === 'en' ? 'Relationship' : 'Relación',
      date: '',
      extraCount: 0,
    };
  }

  const labels = Array.from(new Set(links.map(link => getPathLinkLabel(link, language)).filter(Boolean)));
  const categories = Array.from(new Set(links.map(link => getCategoryLabel(link.category, language)).filter(Boolean)));
  const dateLabels = Array.from(new Set(links.map(link => getPathLinkDateLabel(link, language)).filter(Boolean)));

  return {
    relationship: labels.slice(0, 2).join(' / ') || (language === 'en' ? 'Loaded relationship' : 'Relación cargada'),
    category: categories.slice(0, 2).join(' / ') || (language === 'en' ? 'Relationship' : 'Relación'),
    date: dateLabels[0] || '',
    extraCount: Math.max(0, labels.length - 2),
  };
};

// Position-category mapping (filter chips + simplified mode) lives in
// ../utils/positionCategories so the capping service and tests share it.

// Convert v3 company docs to graph-ready entries with per-company officer caps.
// Board roles (Presidente, Vicepresidente, Consejero, Administrador, Secretario,
// Liquidador, Vocal, comisión members) are always kept. Non-board officers
// (apoderados, auditors, unknown roles) are truncated newest-first using
// appointed_date / resigned_date carried on each v3 officer object. Synchronous —
// no extra network round-trips.
const v3DocsToCappedEntries = (docs, cap) => {
  if (!cap || cap <= 0) {
    return docs.flatMap(c => SpanishCompaniesService.v3CompanyToEntries(c));
  }
  return docs.flatMap(c => SpanishCompaniesService.v3CompanyToEntries(c, { maxOfficers: cap }));
};

const dedupeGraphLinks = links => {
  const dedupedMap = new Map();

  (links || []).forEach((link, index) => {
    const sourceId = normalizeNodeId(getNodeIdFromRef(link.source));
    const targetId = normalizeNodeId(getNodeIdFromRef(link.target));
    if (!sourceId || !targetId || isSameNodeId(sourceId, targetId)) return;

    const pairKey = sourceId < targetId ? `${sourceId}|${targetId}` : `${targetId}|${sourceId}`;
    const labelText = normalizeEdgeLabelText(link.relationship, link.category);
    const labelKey = normalizeNameForMerge(labelText);
    const dedupeKey = `${pairKey}|${labelKey}`;

    if (!dedupedMap.has(dedupeKey)) {
      dedupedMap.set(dedupeKey, {
        ...link,
        id: link.id || `link-${pairKey}-${labelKey || index}`,
        source: sourceId,
        target: targetId,
      });
      return;
    }

    // Merge sparse metadata from repeated entries while keeping a single visual edge/label.
    const existing = dedupedMap.get(dedupeKey);
    if (!existing.relationship && link.relationship) existing.relationship = link.relationship;
    if (!existing.category && link.category) existing.category = link.category;
    if (!existing.date && link.date) existing.date = link.date;
  });

  return Array.from(dedupedMap.values());
};

const tokenizeForMerge = value => normalizeNameForMerge(value).split(' ').filter(Boolean);

const mergeNameSimilarityScore = (baseName, candidateName) => {
  const baseNorm = normalizeNameForMerge(baseName);
  const candidateNorm = normalizeNameForMerge(candidateName);
  if (!baseNorm || !candidateNorm) return 0;
  if (baseNorm === candidateNorm) return 1;

  const baseTokens = tokenizeForMerge(baseNorm);
  const candidateTokens = tokenizeForMerge(candidateNorm);
  const baseSet = new Set(baseTokens);
  const candidateSet = new Set(candidateTokens);

  const intersectionSize = [...baseSet].filter(token => candidateSet.has(token)).length;
  const unionSize = new Set([...baseSet, ...candidateSet]).size || 1;
  const jaccard = intersectionSize / unionSize;

  const baseSorted = [...baseTokens].sort().join(' ');
  const candidateSorted = [...candidateTokens].sort().join(' ');
  if (baseSorted === candidateSorted && baseSorted.length > 0) return 0.96;
  if (baseNorm.includes(candidateNorm) || candidateNorm.includes(baseNorm)) return 0.85;
  return jaccard;
};

const getNodeGroupType = node => {
  if (!node) return 'unknown';
  return node.type === 'officer' ? 'officer' : 'company';
};

const uniqStrings = values => Array.from(new Set((values || []).filter(Boolean)));

const mergeCompanySummary = (targetSummary, sourceSummary) => {
  if (!targetSummary && !sourceSummary) return undefined;
  if (!targetSummary) return sourceSummary;
  if (!sourceSummary) return targetSummary;

  const entries = [...(targetSummary.entries || []), ...(sourceSummary.entries || [])];
  const entryMap = new Map();
  entries.forEach(entry => {
    const key =
      entry?.identifier ||
      entry?.id ||
      `${entry?.indexed_date || entry?.date || ''}-${entry?.full_entry || entry?.title || ''}`;
    if (!entryMap.has(key)) entryMap.set(key, entry);
  });
  const uniqueEntries = Array.from(entryMap.values());

  const parseDate = v => (v ? new Date(v) : null);
  const targetEarliest = parseDate(targetSummary.dateRange?.earliest);
  const sourceEarliest = parseDate(sourceSummary.dateRange?.earliest);
  const targetLatest = parseDate(targetSummary.dateRange?.latest);
  const sourceLatest = parseDate(sourceSummary.dateRange?.latest);
  const earliest =
    [targetEarliest, sourceEarliest].filter(Boolean).sort((a, b) => a - b)[0] || null;
  const latest = [targetLatest, sourceLatest].filter(Boolean).sort((a, b) => b - a)[0] || null;

  return {
    entries: uniqueEntries,
    totalEntries: uniqueEntries.length,
    dateRange: {
      earliest: earliest ? earliest.toISOString() : null,
      latest: latest ? latest.toISOString() : null,
    },
  };
};

const SpanishCompanyNetworkGraph = ({
  visible,
  onHide,
  initialCompanyData,
  initialOfficerData,
  initialCompanyName,
  initialSearchType,
  language = 'es',
  embedded = false,
  entrySource = 'direct',
}) => {
  const uiLanguage = language === 'en' ? 'en' : 'es';
  const text = SEARCH_COPY[uiLanguage];

  // Graph state
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fgRef = useRef();
  const snapshotInputRef = useRef(null);
  const pendingSnapshotCameraRef = useRef(null);
  const [snapshotMode, setSnapshotMode] = useState(false);
  const [snapshotSource, setSnapshotSource] = useState(null);
  const [snapshotNotice, setSnapshotNotice] = useState('');
  const [autosaveStatus, setAutosaveStatus] = useState('idle');
  const [autosaveSavedAt, setAutosaveSavedAt] = useState(null);
  const [pendingAutosaveRecord, setPendingAutosaveRecord] = useState(null);
  const [autosaveRevision, setAutosaveRevision] = useState(0);
  const autosaveReadyRef = useRef(false);
  const autosaveTimerRef = useRef(null);
  const autosaveWriteIdRef = useRef(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('company'); // 'company' or 'officer'
  const [labelFilterText, setLabelFilterText] = useState('');
  const [statusFilters, setStatusFilters] = useState(new Set()); // 'active' | 'ceased'
  const [positionFilters, setPositionFilters] = useState(new Set());
  const [isSearching, setIsSearching] = useState(false);
  // Per-company cap on officer nodes; apoderados truncated newest-first.
  const [officersPerCompany, setOfficersPerCompany] = useState(100);
  // Company-level cap sent as `size` to /bormes/v3/search — how many company
  // docs the backend returns for a given query.
  const [companiesPerSearch, setCompaniesPerSearch] = useState(25);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastSearchContext, setLastSearchContext] = useState(null);
  const graphEnteredAtRef = useRef(Date.now());
  const searchFocusTrackedRef = useRef(false);
  const searchTypingTrackedRef = useRef(false);
  const suggestionsTrackedRef = useRef(false);

  // Track pinned node IDs (nodes added by direct search — always shown regardless of filter)
  const [pinnedNodeIds, setPinnedNodeIds] = useState(new Set());
  // Manually hidden nodes (right-click to hide)
  const [hiddenNodeIds, setHiddenNodeIds] = useState(new Set());
  const [hiddenNodesMenuAnchorEl, setHiddenNodesMenuAnchorEl] = useState(null);
  const [activeNodeId, setActiveNodeId] = useState(null);
  // Company⇄cargo unify: `isUnifying` gates the toolbar toggle's spinner while the
  // reverse lookup + merge runs. The presence/state of the unify-capable node is
  // derived from graph nodes (cargoCount / unified) via cargoToggleNode, so no
  // separate affordance state is needed.
  const [isUnifying, setIsUnifying] = useState(false);
  const [nodeContextMenu, setNodeContextMenu] = useState(null); // { mouseX, mouseY, nodeId }
  const [investigationSet, setInvestigationSet] = useState(() => new Set());
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPanelContext, setAiPanelContext] = useState(null);
  // Re-render the chip as the entitlement ticks; loadToken() is read at render.
  const [entitlementTick, setEntitlementTick] = useState(0);
  const [isEditNodeDialogOpen, setIsEditNodeDialogOpen] = useState(false);
  const [isNodeNoteDialogOpen, setIsNodeNoteDialogOpen] = useState(false);
  const [nodeNotePreviewId, setNodeNotePreviewId] = useState(null);
  const [nodeNoteTargetId, setNodeNoteTargetId] = useState(null);
  const [nodeNoteText, setNodeNoteText] = useState('');
  const [nodeNoteFlag, setNodeNoteFlag] = useState('none');
  const [isMergeNodeDialogOpen, setIsMergeNodeDialogOpen] = useState(false);
  const [isDeleteNodeDialogOpen, setIsDeleteNodeDialogOpen] = useState(false);
  const [editNodeName, setEditNodeName] = useState('');
  const [editNodeSubtype, setEditNodeSubtype] = useState('individual');
  const [mergeTargetOption, setMergeTargetOption] = useState(null);
  const [mergeSearchText, setMergeSearchText] = useState('');

  // DD Checkout dialog state
  const [ddCheckoutOpen, setDdCheckoutOpen] = useState(false);
  const [ddCheckoutCompany, setDdCheckoutCompany] = useState('');

  // Relationship Report dialog state
  const [relReportOpen, setRelReportOpen] = useState(false);
  const [relScope, setRelScope] = useState(null);
  const [relSubjects, setRelSubjects] = useState([]);
  const [relResolving, setRelResolving] = useState(false);
  const [showSharedConnections, setShowSharedConnections] = useState(false);

  // Corrections overlay state (feeds the "Custom" amended DD; see correctionsService).
  // Officer edits (hide / merge / mark-resigned) on the subject company are
  // persisted per-user and scoped to that company's group_key.
  const [correctionsCount, setCorrectionsCount] = useState(0);
  const [correctionsSnackbar, setCorrectionsSnackbar] = useState(null); // { id, message, undoGraph }
  const [myCorrectionsAnchor, setMyCorrectionsAnchor] = useState(null);
  const [myCorrectionsList, setMyCorrectionsList] = useState([]);
  const [myCorrectionsLoading, setMyCorrectionsLoading] = useState(false);
  // Mark-resigned dialog state (optional resignation date)
  const [markResignedNode, setMarkResignedNode] = useState(null);
  const [markResignedDate, setMarkResignedDate] = useState('');
  // Cache of subject company name -> resolved group_key (avoids re-querying autocomplete)
  const subjectGroupKeyCache = useRef(new Map());
  // The "primary subject" = the FIRST company loaded into the graph. Corrections
  // and the Custom DD attach to it. It is sticky: officer searches, node
  // expansions, and additional companies do NOT change it — only a graph reset
  // clears it. (Derived-from-lastSearchContext was fragile: exploring the graph
  // moved the subject off the company the user was actually investigating.)
  const [primarySubject, setPrimarySubject] = useState(null);

  // On-demand apoderados sidebar state (non-modal, right-anchored). Fetches the
  // FULL officer list (full_officers=1) so a user can reach a specific apoderado
  // that the default capped/simplified graph hides. `company` = the initial
  // target ({ name, groupKey }); the sidebar's own switcher can change it.
  const [apoderadosSidebar, setApoderadosSidebar] = useState({ open: false, company: null });

  // Officer timeline dialog state
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [timelineOfficerName, setTimelineOfficerName] = useState('');
  const [timelineOfficerRecords, setTimelineOfficerRecords] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Data preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewNodeName, setPreviewNodeName] = useState('');
  const [previewNodeType, setPreviewNodeType] = useState('company');
  const [previewUserMerged, setPreviewUserMerged] = useState(false);
  const [legalDisclaimerOpen, setLegalDisclaimerOpen] = useState(false);

  // "Report an incorrect enriched value" flow. mapasocietario is the public,
  // login-less app, so submission is Turnstile-gated (mirrors AIInvestigationGate)
  // and lands in the same admin review queue. Currently wired for the NIF only.
  const [reportDialog, setReportDialog] = useState(null); // { companyName, field, currentValue } | null
  const [reportSuggested, setReportSuggested] = useState('');
  const [reportNote, setReportNote] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSnack, setReportSnack] = useState('');
  const reportTurnstileRef = useRef(null);
  const reportWidgetId = useRef(null);

  // Render the Turnstile widget once the report dialog mounts its container
  // (mirrors AIInvestigationGate). The dialog unmounts its content on close, so
  // the widget id is reset and re-rendered fresh on each open.
  useEffect(() => {
    if (!reportDialog) { reportWidgetId.current = null; return undefined; }
    const id = setInterval(() => {
      if (window.turnstile && reportTurnstileRef.current && reportWidgetId.current == null) {
        reportWidgetId.current = window.turnstile.render(reportTurnstileRef.current, { sitekey: REPORT_TURNSTILE_SITEKEY });
        clearInterval(id);
      }
    }, 200);
    return () => clearInterval(id);
  }, [reportDialog]);

  const openReport = useCallback((field, currentValue) => {
    setReportSuggested('');
    setReportNote('');
    reportWidgetId.current = null;
    setReportDialog({
      companyName: previewData?.name || previewNodeName || '',
      field,
      currentValue: currentValue ? String(currentValue) : '',
    });
  }, [previewData, previewNodeName]);

  const submitReport = useCallback(async () => {
    if (!reportDialog) return;
    const token = (window.turnstile && reportWidgetId.current != null)
      ? window.turnstile.getResponse(reportWidgetId.current) : '';
    if (!token) { setReportSnack(text.reportVerifyPending); return; }
    setReportSubmitting(true);
    try {
      await spanishCompaniesService.reportEnrichment({
        companyName: reportDialog.companyName,
        field: reportDialog.field,
        currentValue: reportDialog.currentValue || null,
        suggestedValue: reportSuggested.trim() || null,
        note: reportNote.trim() || null,
        turnstileToken: token,
      });
      setReportDialog(null);
      setReportSnack(text.reportThanks);
    } catch (err) {
      setReportSnack(text.reportError(err.message));
      if (window.turnstile && reportWidgetId.current != null) window.turnstile.reset(reportWidgetId.current);
    } finally {
      setReportSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDialog, reportSuggested, reportNote]);

  // Report-an-incorrect/missing-NIF modal + confirmation snackbar. Defined once
  // and rendered in BOTH the embedded and Dialog-mode return branches so the
  // flag/suggest buttons in the preview always have a mounted dialog to open.
  const reportModal = (
    <>
      <Dialog open={!!reportDialog} onClose={() => setReportDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{reportDialog?.currentValue ? text.reportNifTitle : text.reportNifMissingTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, fontSize: '0.85rem', color: 'text.secondary' }}>
            {reportDialog?.currentValue ? text.reportIntro : text.reportMissingIntro}
          </Typography>
          {reportDialog?.currentValue && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              {text.reportCurrentValue}: <strong>{reportDialog.currentValue}</strong>
            </Typography>
          )}
          <TextField
            fullWidth
            size="small"
            label={text.reportSuggestedLabel}
            value={reportSuggested}
            onChange={(e) => setReportSuggested(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label={text.reportNoteLabel}
            multiline
            minRows={2}
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Box ref={reportTurnstileRef} sx={{ display: 'flex', justifyContent: 'center' }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialog(null)} disabled={reportSubmitting}>
            {text.reportCancel}
          </Button>
          <Button variant="contained" onClick={submitReport} disabled={reportSubmitting}>
            {reportSubmitting ? <CircularProgress size={16} /> : text.reportSubmit}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={!!reportSnack}
        autoHideDuration={5000}
        onClose={() => setReportSnack('')}
        message={reportSnack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );

  // Deputy (PEP) match cache keyed by officer name. Populated lazily from a
  // `useEffect` further down — declared up here so `nodeCanvasObject` (which
  // also lives above the effect) can close over it without a TDZ error.
  const [officerDeputyMatches, setOfficerDeputyMatches] = useState({});

  // Container dimensions for ForceGraph2D (callback ref to detect DOM attachment in Dialog Portal)
  const [containerEl, setContainerEl] = useState(null);
  const containerCallbackRef = useCallback(node => {
    setContainerEl(node);
  }, []);
  const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 500 });
  // ForceGraph2D's camera is anchored at world (0, 0) — placing initial nodes there
  // keeps the first frame centered. (DOM half-dimensions would render off to the bottom-right.)
  const viewportCenter = React.useMemo(() => ({ x: 0, y: 0 }), []);
  const [containerReady, setContainerReady] = useState(false);

  // Double-click detection via single click timer
  const lastClickRef = useRef({ nodeId: null, time: 0 });

  // Fullscreen support
  const fullscreenContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Floating table panel state
  const [tablePosition, setTablePosition] = useState({ x: null, y: null }); // null = default position
  // Default collapsed everywhere so the Datos panel doesn't cover the graph on
  // open; the user expands it on demand (it was intrusive opening expanded).
  const [isTableCollapsed, setIsTableCollapsed] = useState(true);
  // Date filter: click on a date cell filters the table to rows sharing same date + company + category
  // Shape: { date, companyNodeId, category } or null
  const [dateFilter, setDateFilter] = useState(null);
  const tableDragRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const dragFreezeRef = useRef(null);

  // Autocomplete state
  const [autocompleteOptions, setAutocompleteOptions] = useState([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [selectedAutocomplete, setSelectedAutocomplete] = useState(null);
  const searchTypeRef = useRef(searchType);
  searchTypeRef.current = searchType;

  // When a sole_shareholder is selected from autocomplete, we plot the shareholder
  // node immediately and defer fetching its N participadas until the user confirms
  // (prevents silent N parallel v3 lookups on every selection).
  const [pendingSubsidiaries, setPendingSubsidiaries] = useState(null);
  const [loadingSubsidiaries, setLoadingSubsidiaries] = useState(false);

  // Terms hook for officer validation
  const { termData, isReady: termsAreReady } = useTerms();

  // Graph settings
  const [showSettings, setShowSettings] = useState(false);
  const [showShareholders, setShowShareholders] = useState(true);
  const [showPreviousShareholders, setShowPreviousShareholders] = useState(true);
  const [nodeSize, setNodeSize] = useState(9);
  const [labelSize, setLabelSize] = useState(4.5);
  const [linkDistance, setLinkDistance] = useState(80);
  const [chargeStrength, setChargeStrength] = useState(-350);
  // Edge-length / spacing control. The layout PINS nodes (fx/fy) at deterministic
  // positions, so d3 forces can't move them — the control therefore scales the
  // pinned positions directly. `spacing` is an absolute factor (1 = as laid out);
  // prevSpacingRef tracks the last-applied factor so each change scales by the delta.
  const [spacing, setSpacing] = useState(1);
  const prevSpacingRef = useRef(1);
  const [showNodeLabels] = useState(true); // Renamed for clarity
  const [zoomLevel, setZoomLevel] = useState(1);
  const [cameraState, setCameraState] = useState({ x: 0, y: 0, k: 1 });
  const [simplifyGraph, setSimplifyGraph] = useState(true);
  const [positionFiltersExpanded, setPositionFiltersExpanded] = useState(false);

  // Corporate Intelligence States
  const [colorByCluster, setColorByCluster] = useState(false);

  // Pathfinder States
  const [pathfinderActive, setPathfinderActive] = useState(false);
  const [pathfinderStartNode, setPathfinderStartNode] = useState(null);
  const [pathfinderEndNode, setPathfinderEndNode] = useState(null);
  const [shortestPathNodes, setShortestPathNodes] = useState(new Set());
  const [shortestPathLinks, setShortestPathLinks] = useState(new Set());
  const [shortestPathArray, setShortestPathArray] = useState([]);
  const [pathDetailsExpanded, setPathDetailsExpanded] = useState(false);

  const MAX_NODE_DRIFT = 5000;
  const MAX_NODE_SPEED = 30;

  // Node colors and shapes
  const nodeColors = React.useMemo(
    () => ({
      company: '#33bdad',
      officer_individual: '#cd87c0',
      officer_company: '#8a86d4',
      expanded: '#56b387',
      selected: '#e26d9a',
      searchOrigin: '#5fd6c6',
    }),
    []
  );

  // Constants for label visibility control
  const MAX_NODES_FOR_LABELS = 120;
  const MAX_LINKS_FOR_LABELS = 120;
  const NODE_LABEL_VISIBILITY_SCALE_NORMAL = 0.65;
  const NODE_LABEL_VISIBILITY_SCALE_DENSE = 1.1; // Requires extra zoom only when very dense
  const LINK_LABEL_VISIBILITY_SCALE_NORMAL = 0.75;
  const LINK_LABEL_VISIBILITY_SCALE_DENSE = 1.2; // Requires extra zoom only when very dense
  const PATH_HIGHLIGHT_COLOR = '#4dd0e1';
  const PATH_DIM_ALPHA = 0.28;

  // Configure forces and reheat — combined into one effect so reheat always
  // happens AFTER forces are updated (previously separate effects ran in wrong order).
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !containerReady || graphData.nodes.length === 0) return;
    const isPinned = node => !!node && (node.fx != null || node.fy != null);
    const isOfficer = node => !!node && node.type === 'officer';

    const chargeForce = fg.d3Force('charge');
    if (chargeForce) {
      chargeForce.strength(node => {
        if (isPinned(node)) return 0;
        return isOfficer(node) ? chargeStrength * 0.4 : chargeStrength;
      });
      if (typeof chargeForce.distanceMax === 'function') {
        chargeForce.distanceMax(Math.max(linkDistance * 2, 300));
      }
    }

    const linkForce = fg.d3Force('link');
    if (linkForce) {
      linkForce.distance(link => {
        const source = typeof link.source === 'object' ? link.source : null;
        const target = typeof link.target === 'object' ? link.target : null;
        const isOfficerLink =
          (source && isOfficer(source)) || (target && isOfficer(target));
        const base = isOfficerLink ? Math.round(linkDistance * 0.45) : linkDistance * 1.4;
        return Math.max(30, base);
      });
      linkForce.strength(link => {
        const source = typeof link.source === 'object' ? link.source : null;
        const target = typeof link.target === 'object' ? link.target : null;
        const isOfficerLink =
          (source && isOfficer(source)) || (target && isOfficer(target));
        if (isPinned(source) && isPinned(target)) return 0.03;
        return isOfficerLink ? 0.35 : 0.12;
      });
      if (typeof linkForce.iterations === 'function') {
        linkForce.iterations(3);
      }
    }

    const forceX = fg.d3Force('x');
    if (forceX && typeof forceX.strength === 'function') {
      forceX.strength(node => (isPinned(node) ? 0 : 0.04));
    }
    const forceY = fg.d3Force('y');
    if (forceY && typeof forceY.strength === 'function') {
      forceY.strength(node => (isPinned(node) ? 0 : 0.04));
    }

    fg.d3Force(
      'collision',
      forceCollide()
        .radius(node => {
          const labelLen = (node.name || '').length;
          return node.type === 'spanish-company-group'
            ? Math.max(nodeSize + 28, labelLen * 2.6)
            : nodeSize + 8;
        })
        .iterations(3)
    );

    if (typeof fg.d3AlphaDecay === 'function') fg.d3AlphaDecay(0.028);
    if (typeof fg.d3VelocityDecay === 'function') fg.d3VelocityDecay(0.4);

    // Reheat AFTER forces are configured so the new settings take effect immediately.
    fg.d3ReheatSimulation();
  }, [
    containerReady,
    graphData.nodes.length,
    graphData.links.length,
    chargeStrength,
    linkDistance,
    nodeSize,
    visible,
    embedded,
    simplifyGraph,
  ]);

  // Edge-length / spacing control: scale node positions around the graph centroid.
  // Runs ONLY when the slider moves (not on data changes) so it never clobbers a
  // manual drag or a node expansion. Because most nodes are pinned (fx/fy), we move
  // both x/y and fx/fy; the reheat repaints links/particles. New searches reset
  // `spacing` to 1 (handleSearch), keeping the slider consistent with the layout.
  useEffect(() => {
    const fg = fgRef.current;
    const nodes = graphData?.nodes;
    const prev = prevSpacingRef.current;
    if (!fg || !nodes?.length || prev === spacing) return;
    const factor = spacing / prev;
    prevSpacingRef.current = spacing;
    let cx = 0, cy = 0, k = 0;
    nodes.forEach(n => {
      if (Number.isFinite(n.x) && Number.isFinite(n.y)) { cx += n.x; cy += n.y; k += 1; }
    });
    if (!k) return;
    cx /= k; cy /= k;
    nodes.forEach(n => {
      if (Number.isFinite(n.x)) { n.x = cx + (n.x - cx) * factor; if (n.fx != null) n.fx = n.x; }
      if (Number.isFinite(n.y)) { n.y = cy + (n.y - cy) * factor; if (n.fy != null) n.fy = n.y; }
    });
    if (typeof fg.d3ReheatSimulation === 'function') fg.d3ReheatSimulation();
  }, [spacing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear graph data when dialog closes so it starts fresh each time (only in dialog mode)
  useEffect(() => {
    if (!embedded && !visible) {
      setGraphData({ nodes: [], links: [] });
      setSnapshotMode(false);
      setSnapshotSource(null);
      pendingSnapshotCameraRef.current = null;
      setError(null);
      setSearchQuery('');
      setLastSearchContext(null);
      setPrimarySubject(null);
      setSelectedSidebarCompany(null);
      setLoadingMore(false);
      setContainerReady(false);
      setHiddenNodesMenuAnchorEl(null);
      setActiveNodeId(null);
      setNodeContextMenu(null);
      setIsEditNodeDialogOpen(false);
      setIsNodeNoteDialogOpen(false);
      setNodeNotePreviewId(null);
      setNodeNoteTargetId(null);
      setIsMergeNodeDialogOpen(false);
      setIsDeleteNodeDialogOpen(false);
      setMergeTargetOption(null);
      setMergeSearchText('');

      // Clean up intelligence states
      setColorByCluster(false);
      setPathfinderActive(false);
      setPathfinderStartNode(null);
      setPathfinderEndNode(null);
      setShortestPathNodes(new Set());
      setShortestPathLinks(new Set());
      setShortestPathArray([]);
    }
  }, [visible, embedded]);

  // Helper: given a list of v3 company entries, check for name change relationships,
  // fetch the related company data, and return { entries, aliasMap } so officers are unified.
  //
  // The autocomplete API only stores alias info on the OLD name (has_new_name → new name).
  // The NEW name returns is_alias:false with no link back. So when we only have the new
  // name, we also do a v3 search to discover the old name among sibling results.
  const fetchWithNameChangeRelations = useCallback(async (entries, options = {}) => {
    const { cap } = options;
    const allEntries = [...entries];
    const aliasMap = new Map();
    const namesInEntries = new Set(
      entries.map(e => (e.name || e.company_name || '').trim().toUpperCase()).filter(Boolean)
    );

    for (const name of [...namesInEntries]) {
      try {
        const acResult = await spanishCompaniesService.autocompleteCompanies(name, { limit: 5 });
        const match = (acResult.suggestions || []).find(
          s => (s.name || '').trim().toUpperCase() === name
        );

        let relatedName = null;
        if (match) {
          if (match.has_new_name && match.new_company_name) {
            relatedName = match.new_company_name;
            aliasMap.set(
              normalizeCompanyName(name).toUpperCase(),
              normalizeCompanyName(relatedName).toUpperCase()
            );
          } else if (match.is_alias && match.original_name) {
            relatedName = match.original_name;
            aliasMap.set(
              normalizeCompanyName(relatedName).toUpperCase(),
              normalizeCompanyName(name).toUpperCase()
            );
          }
        }

        // If autocomplete didn't find a relationship, check if any OTHER suggestion
        // for this query has has_new_name pointing to this name (reverse lookup).
        if (!relatedName && acResult.suggestions) {
          const reverseMatch = acResult.suggestions.find(
            s =>
              s.has_new_name &&
              (s.new_company_name || '').trim().toUpperCase() === name &&
              (s.name || '').trim().toUpperCase() !== name
          );
          if (reverseMatch) {
            relatedName = reverseMatch.name;
            aliasMap.set(
              normalizeCompanyName(relatedName).toUpperCase(),
              normalizeCompanyName(name).toUpperCase()
            );
          }
        }

        // Still no relationship? Try a v3 search — the search engine often returns
        // both old and new name as sibling results. Check those for has_new_name.
        if (!relatedName && namesInEntries.size === 1) {
          try {
            const searchResult = await spanishCompaniesService.searchCompaniesV3(name, { size: 5 });
            for (const sibling of searchResult.results || []) {
              const siblingName = (sibling.company_name || '').trim().toUpperCase();
              if (siblingName && siblingName !== name && !namesInEntries.has(siblingName)) {
                const sibAc = await spanishCompaniesService.autocompleteCompanies(siblingName, { limit: 3 });
                const sibMatch = (sibAc.suggestions || []).find(
                  s => (s.name || '').trim().toUpperCase() === siblingName
                );
                if (
                  sibMatch?.has_new_name &&
                  (sibMatch.new_company_name || '').trim().toUpperCase() === name
                ) {
                  relatedName = sibMatch.name || siblingName;
                  aliasMap.set(
                    normalizeCompanyName(relatedName).toUpperCase(),
                    normalizeCompanyName(name).toUpperCase()
                  );
                  break;
                }
              }
            }
          } catch {
            // Non-fatal
          }
        }

        if (relatedName && !namesInEntries.has(relatedName.trim().toUpperCase())) {
          try {
            const v3 = await spanishCompaniesService.getCompanyProfileV3(relatedName);
            if (v3.company) {
              const relatedEntries = await v3DocsToCappedEntries([v3.company], cap);
              allEntries.push(...relatedEntries);
              namesInEntries.add(relatedName.trim().toUpperCase());
              console.log(`[NetworkGraph] Added related company "${relatedName}" for name change`);
            }
          } catch (err) {
            console.log(`[NetworkGraph] Error fetching related company "${relatedName}":`, err);
          }
        }
      } catch (err) {
        console.log(`[NetworkGraph] Error checking name change for "${name}":`, err);
      }
    }

    return { entries: allEntries, aliasMap: aliasMap.size > 0 ? aliasMap : null };
  }, []);

  // Auto-load initial data when dialog opens with initialCompanyData or initialOfficerData
  useEffect(() => {
    if (!visible && !embedded) return;

    if (initialCompanyData && initialCompanyData.length > 0) {
      (async () => {
        const { entries, aliasMap } = await fetchWithNameChangeRelations(initialCompanyData, { cap: officersPerCompany });
        await addCompanyWithOfficersToGraph(entries, null, aliasMap);
        let firstCompanyName = null;
        entries.forEach(company => {
          const companyName = normalizeCompanyName(company.name || company.company_name || '');
          if (companyName) {
            if (!firstCompanyName) firstCompanyName = companyName;
            const companyId = companyNameToId(companyName);
            setPinnedNodeIds(prev => new Set([...prev, companyId]));
          }
        });
        if (firstCompanyName) {
          setPrimarySubject(prev => prev || firstCompanyName);
          // Deep-link / initial load: focus the market sidebar on the loaded company.
          setSelectedSidebarCompany(firstCompanyName);
          // Company⇄cargo: surface the affordance for the initially-loaded company.
          runCargoDetection(firstCompanyName, companyNameToId(firstCompanyName));
        }
      })();
    } else if (initialOfficerData && initialOfficerData.name) {
      const entries = initialOfficerData.companies || [];
      if (entries.length > 0) {
        addOfficerToGraph(entries, initialOfficerData.name);
      }
      // Pin initial officer node
      const officerId = officerIdFor(initialOfficerData.name);
      setPinnedNodeIds(prev => new Set([...prev, officerId]));
    }
  }, [visible, initialCompanyData, initialOfficerData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-search when initialCompanyName prop is provided (standalone mode)
  const initialCompanyNameRef = useRef(null);
  useEffect(() => {
    if (initialCompanyName && initialCompanyName !== initialCompanyNameRef.current && (visible || embedded)) {
      initialCompanyNameRef.current = initialCompanyName;
      if (initialSearchType === 'officer') {
        setSearchType('officer');
      }
      setSearchQuery(initialCompanyName);
      handleSearch(initialCompanyName, true, initialSearchType || null, null, 'deep_link');
    }
  }, [initialCompanyName, visible, embedded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refetch when the per-company officer cap ("Cargos/empresa") changes, so
  // the selector is live — e.g. raise it to 500 to pull in apoderados without
  // having to re-search. Only refetches when a company search is loaded.
  const officersCapRef = useRef(officersPerCompany);
  useEffect(() => {
    if (officersCapRef.current === officersPerCompany) return; // skip initial mount
    officersCapRef.current = officersPerCompany;
    if (lastSearchContext?.searchType === 'company' && lastSearchContext.query) {
      handleSearch(lastSearchContext.query, lastSearchContext.exactMatch || false, 'company', null, 'settings_refetch');
    }
  }, [officersPerCompany]); // eslint-disable-line react-hooks/exhaustive-deps

  // Add roundRect polyfill for older browsers
  useEffect(() => {
    if (
      typeof CanvasRenderingContext2D !== 'undefined' &&
      !CanvasRenderingContext2D.prototype.roundRect
    ) {
      CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        this.beginPath();
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + width, y, radius);
        this.closePath();
        return this;
      };
    }
  }, []);

  // Track container dimensions for ForceGraph2D explicit sizing
  // Uses containerEl (from callback ref) so it auto-attaches when the DOM element appears
  // (critical for Dialog mode where Portal mounting is deferred)
  useEffect(() => {
    if (!containerEl) {
      setContainerReady(false);
      return;
    }
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerDimensions({ width: Math.floor(width), height: Math.floor(height) });
          setContainerReady(true);
        }
      }
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, [containerEl]);

  // Auto-fit graph when node count changes (after data loads)
  const prevNodeCountRef = useRef(0);
  useEffect(() => {
    const count = graphData.nodes.length;
    if (!snapshotMode && count > 0 && count !== prevNodeCountRef.current) {
      prevNodeCountRef.current = count;
      // Delay to let ForceGraph2D process new data and simulation settle
      const timer = setTimeout(() => {
        if (fgRef.current) {
          fgRef.current.zoomToFit(400, 50);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [graphData.nodes.length, snapshotMode]);

  // Re-fit graph when container dimensions change significantly (e.g. after table renders)
  const prevDimRef = useRef(containerDimensions);
  useEffect(() => {
    const prev = prevDimRef.current;
    prevDimRef.current = containerDimensions;
    const dw = Math.abs(prev.width - containerDimensions.width);
    const dh = Math.abs(prev.height - containerDimensions.height);
    if (!snapshotMode && (dw > 50 || dh > 50) && graphData.nodes.length > 0 && fgRef.current) {
      const timer = setTimeout(() => {
        fgRef.current?.zoomToFit(400, 50);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [containerDimensions, graphData.nodes.length, snapshotMode]);

  // Imported snapshots carry their own camera. Apply it after ForceGraph has
  // attached to the canvas and consumed the restored graph data.
  useEffect(() => {
    const camera = pendingSnapshotCameraRef.current;
    if (!snapshotMode || !containerReady || !camera || !fgRef.current || graphData.nodes.length === 0) return;
    const timer = setTimeout(() => {
      const fg = fgRef.current;
      if (!fg) return;
      if (Number.isFinite(camera.x) && Number.isFinite(camera.y)) fg.centerAt(camera.x, camera.y, 0);
      if (Number.isFinite(camera.k) && camera.k > 0) fg.zoom(camera.k, 0);
      pendingSnapshotCameraRef.current = null;
    }, 100);
    return () => clearTimeout(timer);
  }, [snapshotMode, containerReady, graphData.nodes.length]);

  // Fullscreen change listener (browser API, for embedded mode)
  useEffect(() => {
    if (!embedded) return;
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [embedded]);

  // Enhanced helper function to extract officers from text (same as in SpanishCompanyDetailsDialog)
  const extractOfficersFromText = useCallback(
    (text, category) => {
      if (!text) return [];

      const officers = [];

      // Enhanced patterns to handle Spanish BORME format
      const patterns = [
        // Pattern for abbreviated positions
        /(ADM\.?\s*SOLID\.?):\s*([^.]+?)(?:\.|$)/gi,
        /(LIQUIDADOR):\s*([^.]+?)(?:\.|$)/gi,
        /(ADMINISTRADOR\s*UNICO\.?):\s*([^.]+?)(?:\.|$)/gi,
        /(ADMINISTRADOR\.?):\s*([^.]+?)(?:\.|$)/gi, // General Administrador
        /(APODERADO\.?\s*SOLID\.?):\s*([^.]+?)(?:\.|$)/gi,
        /(APODERADO\.?):\s*([^.]+?)(?:\.|$)/gi,
        /(CONSEJERO\.?\s*DELEGADO\.?):\s*([^.]+?)(?:\.|$)/gi,
        /(CONSEJERO\.?):\s*([^.]+?)(?:\.|$)/gi,
        // More general patterns (should come after specific ones)
        /([A-ZÁÉÍÓÚÑa-z][A-ZÁÉÍÓÚÑa-záéíóúñ\s.()/-]*[A-ZÁÉÍÓÚÑa-z]):\s*([^.]+?)(?:\.|$)/g, // Position ending with a letter/number
        // More flexible pattern for any position followed by colon and names
        /([A-ZÁÉÍÓÚÑa-z][A-ZÁÉÍÓÚÑa-záéíóúñ\s.()/-]+?):\s*([^.]+?)(?:\.|$)/g,
      ];

      for (const pattern of patterns) {
        let match;
        pattern.lastIndex = 0; // Reset regex state

        while ((match = pattern.exec(text)) !== null) {
          const position = match[1].trim().replace(/\.$/, ''); // Remove trailing period
          const namesText = match[2].trim().replace(/\.$/, ''); // Remove trailing period


          // Validate position looks like an officer position
          const positionLower = position.toLowerCase();
          let isValidPosition = false;

          if (
            termsAreReady &&
            termData &&
            termData.allOfficerRoles &&
            termData.allOfficerRoles.length > 0
          ) {
            // Primary validation: Check against officer roles from terms.json
            isValidPosition = termData.allOfficerRoles.some(role =>
              positionLower.includes(role.toLowerCase())
            );
            if (!isValidPosition) {
              // Secondary check: if the found position is a substring of any term role (e.g. "Adm. Solid." in "Administrador Solidario")
              isValidPosition = termData.allOfficerRoles.some(role =>
                role.toLowerCase().includes(positionLower)
              );
            }
          } else {
            // Fallback validation if terms are not ready or don't contain officer roles
            const fallbackKnownPositions = [
              'adm',
              'administrador',
              'liquidador',
              'presidente',
              'secretario',
              'consejero',
              'gerente',
              'director',
              'apoderado',
              'auditor',
              'interventor',
              'vocal',
              'tesorero',
              'comisario',
              'unico',
              'único',
              'solidario',
              'solid',
              'mancomunado',
              'delegado',
            ];
            isValidPosition = fallbackKnownPositions.some(knownPos =>
              positionLower.includes(knownPos)
            );
          }
          isValidPosition =
            isValidPosition ||
            (position.split(/\s+/).length <= 4 && position.length > 3 && position.length > 0); // Allow short, multi-word positions

          // Skip common non-officer headers that might be caught by flexible regex
          if (
            /^(datos registrales|capital social|domicilio social|objeto social|nombramientos|ceses|dimisiones|revocaciones|reelecciones)/i.test(
              positionLower
            )
          )
            continue;

          if (!isValidPosition) {
            continue;
          }

          // Split names by semicolon and comma, clean them
          const names = namesText
            .split(/[;,]/)
            .map(name => name.trim())
            .filter(name => name.length > 0);


          names.forEach(name => {
            // Enhanced name validation
            const cleanName = name.replace(/\s+/g, ' ').trim();

            // Validate that this looks like a Spanish name
            const isValidName =
              cleanName.length >= 5 && // Minimum length for a name
              (cleanName.includes(' ') || cleanName.includes(',')) && // Usually has a space (first/last) or comma (last, first)
              /[a-záéíóúñü]/i.test(cleanName) && // Contains at least one letter
              !/^\d+$/.test(cleanName) && // Not purely numeric
              !/(datos|registrales|sociedad|capital|euros|fecha|cargo|cese|nombramiento|dimision|revocacion|reeleccion)/i.test(
                cleanName
              ) && // Not common keywords
              !/^(SL|SA|S\.L|S\.A|S L|S A)$/i.test(cleanName) && // Not company suffixes
              cleanName.split(/\s+/).every(word => word.length < 25); // Individual words not excessively long

            if (isValidName) {
              officers.push({
                name: cleanName,
                position: position,
                category: category,
                raw_entry: match[0],
              });
            } else {
            }
          });
        }
      }

      return officers;
    },
    [termData, termsAreReady]
  );

  // Helper function to determine if an officer name represents a company or individual.
  // Base check is the shared, pure isLegalEntityName (SL/SA/SGIIC/SCOOP/AIE/UTE/
  // foreign forms/...); plus a few known-firm-name heuristics that aren't a legal
  // form per se (audit/consulting houses commonly seen acting as officers).
  const isCompanyOfficer = useCallback(officerName => {
    if (isLegalEntityName(officerName)) return true;

    const knownFirmIndicators = [
      /\b(AUDIT|AUDITOR|CONSULTING|CONSULTORIA|ASESORES|GESTORIA|DESPACHO)\b/i, // Service companies
      /\b(PRICEWATERHOUSE|DELOITTE|KPMG|EY|ERNST)\b/i, // Known audit firms
    ];

    return knownFirmIndicators.some(pattern => pattern.test(officerName));
  }, []);

  // Debounced autocomplete handler
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleAutocomplete = useCallback(
    debounce(async value => {
      if (!value || value.length < 2) {
        setAutocompleteOptions([]);
        return;
      }

      setAutocompleteLoading(true);
      try {
        // Unified search: query companies AND people at once so the user never
        // has to pre-declare which they want. Each suggestion already carries its
        // own `type` (company / officer / sole_shareholder), so the dropdown and
        // the dispatch can route per-item. Failures on one side don't sink the other.
        const [companyResults, officerResults] = await Promise.all([
          spanishCompaniesService.autocompleteCompanies(value, { limit: 20 }).catch(() => ({ suggestions: [] })),
          spanishCompaniesService.autocompleteOfficers(value, { limit: 8 }).catch(() => ({ suggestions: [] })),
        ]);

        const companySuggestions = companyResults.suggestions || [];

        const companyItems = companySuggestions.map(c => ({
          label: c.label || c.name || c.company_name,
          value: c.value || c.name || c.company_name,
          name: c.name || c.company_name,
          type: 'company',
          cif: c.cif,
          ...c,
        }));
        const officerItems = (officerResults.suggestions || []).map(o => ({
          label: o.label || o.name,
          value: o.value || o.name,
          name: o.name,
          type: 'officer',
          company_count: o.company_count,
          ...o,
        }));

        // Keep both modalities visible: cap each side so a flood of company
        // matches can't bury the people (and vice-versa). Companies lead since
        // they're the more common intent.
        const results = [...companyItems.slice(0, 14), ...officerItems.slice(0, 6)];

        setAutocompleteOptions(results);
        if (!suggestionsTrackedRef.current) {
          suggestionsTrackedRef.current = true;
          trackEvent('graph_search_suggestions', {
            entry_source: entrySource,
            result_state: results.length > 0 ? 'shown' : 'empty',
            suggestion_count: results.length,
            company_suggestion_count: companyItems.length,
            officer_suggestion_count: officerItems.length,
            time_to_suggestions_ms: Date.now() - graphEnteredAtRef.current,
          });
        }

        // Enrich officer options with Congreso deputy match in the background.
        const officerOptions = results.filter(r => r.type === 'officer' && r.name);
        if (officerOptions.length > 0) {
          const matches = await Promise.all(
            officerOptions.map(o => findDeputyMatch(o.name).catch(() => null))
          );
          setAutocompleteOptions(prev => {
            if (prev !== results) return prev;
            return prev.map(opt => {
              const idx = officerOptions.indexOf(opt);
              return idx >= 0 ? { ...opt, _deputyMatch: matches[idx] } : opt;
            });
          });
        }
      } catch (error) {
        console.error('Autocomplete error:', error);
        setAutocompleteOptions([]);
        if (!suggestionsTrackedRef.current) {
          suggestionsTrackedRef.current = true;
          trackEvent('graph_search_suggestions', {
            entry_source: entrySource,
            result_state: 'error',
            suggestion_count: 0,
            time_to_suggestions_ms: Date.now() - graphEnteredAtRef.current,
          });
        }
      } finally {
        setAutocompleteLoading(false);
      }
    }, 300),
    [] // No deps needed
  );

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      handleAutocomplete.cancel();
    };
  }, [handleAutocomplete]);

  // Search for companies or officers and automatically add to graph
  // queryOverride allows passing the exact name from autocomplete selection
  const filterCompanyMatches = useCallback((results, query) => {
    const lowerQuery = query.toLowerCase();
    const queryTerms = lowerQuery.split(/\s+/).filter(t => t.length > 0);
    return (results || []).filter(company => {
      const name = (company.name || company.company_name || '').toLowerCase();
      return queryTerms.every(term => name.includes(term));
    });
  }, []);

  const handleSearch = async (
    queryOverride = null,
    exactMatch = false,
    searchTypeOverride = null,
    groupKeyOverride = null,
    analyticsOrigin = 'user_selection'
  ) => {
    const query = (queryOverride || searchQuery).trim();
    if (!query) {
      setError(text.searchEmpty);
      return;
    }

    const effectiveSearchType = searchTypeOverride || searchType;
    const trackSearchResult = (resultState, resultCount = 0) => {
      if (analyticsOrigin === 'settings_refetch') return;
      trackEvent('graph_search_result', {
        entry_source: entrySource,
        search_origin: analyticsOrigin,
        entity_type: effectiveSearchType,
        result_state: resultState,
        result_count: resultCount,
      });
    };

    // A deliberate new search leaves offline snapshot mode and may use live data.
    setSnapshotMode(false);
    setSnapshotSource(null);
    setIsSearching(true);
    setError(null);
    setLastSearchContext(null);
    // Fresh layout → reset the spacing control to neutral (1) so the slider stays
    // consistent with the new graph. Set the ref first so the effect sees no delta.
    prevSpacingRef.current = 1;
    setSpacing(1);

    try {
      if (effectiveSearchType === 'officer') {
        // Officer search: use borme_companies_v3 for explicit active/resigned status
        const data = await spanishCompaniesService.expandOfficerV3(query, {
          analyticsSource: 'officer',
        });

        const fetchedCount = data.officers?.length || 0;
        if (data.success && fetchedCount > 0) {
          await addOfficerToGraph(data.officers, query);
          trackSearchResult('success', fetchedCount);
          // Pin the officer node so it survives filtering
          const officerId = officerIdFor(query);
          setPinnedNodeIds(prev => new Set([...prev, officerId]));
          setLastSearchContext({
            query,
            searchType: 'officer',
            exactMatch: false,
            size: companiesPerSearch,
            offset: fetchedCount,
            hasMore: false, // v3 returns all companies for this officer
            total: data.total || fetchedCount,
          });
          setSearchQuery('');
        } else {
          trackSearchResult('no_results');
          setError(text.officerNoResults(query));
        }
      } else {
        // Company search: use borme_companies_v3 (clean, pre-aggregated index with
        // explicit officers_active/officers_resigned arrays).
        //
        // When the selection carried a stable group_key (e.g. the autocomplete
        // option's `id`), resolve+fetch the EXACT company doc by that key so an
        // ambiguous name (e.g. "NAMISA") binds to the correct legal entity rather
        // than whatever the fuzzy/exact-name search ranks first. resolveCompanyGroupKey
        // prefers the explicit key and skips the directory lookup when present.
        const groupKey = groupKeyOverride
          ? await spanishCompaniesService.resolveCompanyGroupKey(query, groupKeyOverride)
          : null;

        let v3Data;
        if (groupKey) {
          const profile = await spanishCompaniesService.getCompanyProfileV3(query, {
            groupKey,
            analyticsSource: 'company',
          });
          v3Data = { results: profile.company ? [profile.company] : [], total: profile.company ? 1 : 0 };
        } else {
          v3Data = await spanishCompaniesService.searchCompaniesV3(query, {
            size: companiesPerSearch,
            exact: exactMatch,
            analyticsSource: 'company',
          });
        }

        const v3Results = v3Data.results || [];
        if (v3Results.length > 0) {
          // Board roles always kept; apoderados/others capped per-company, newest first.
          const baseEntries = await v3DocsToCappedEntries(v3Results, officersPerCompany);
          // Check for name changes on ALL results before filtering,
          // so that old-name entries with has_new_name are discovered
          const { entries: withRelated, aliasMap } = await fetchWithNameChangeRelations(baseEntries, { cap: officersPerCompany });
          // When we fetched the exact company by group_key, the result IS the
          // right entity — skip the name-term filter (its current name may not
          // contain the typed query terms, e.g. a renamed company).
          const filtered = groupKey ? withRelated : filterCompanyMatches(withRelated, query);
          // Also include entries that didn't match the query but are linked via name change
          const aliasedEntries = aliasMap
            ? withRelated.filter(e => {
                const n = (e.name || e.company_name || '').trim().toUpperCase();
                // Keep if it's a name that maps to a query match or is mapped FROM a query match
                return [...aliasMap.entries()].some(([old, cur]) => n === old || n === cur);
              })
            : [];
          const merged = [...filtered];
          aliasedEntries.forEach(e => {
            if (!merged.includes(e)) merged.push(e);
          });

          if (merged.length > 0) {
            await addCompanyWithOfficersToGraph(merged, null, aliasMap);
            trackSearchResult('success', merged.length);
            const pinnedIds = [];
            merged.forEach(company => {
              const companyName = normalizeCompanyName(company.name || company.company_name || '');
              const companyId = companyNameToId(companyName);
              pinnedIds.push(companyId);
              setPinnedNodeIds(prev => new Set([...prev, companyId]));
            });
            // Build a map of nodeId→isDissolved from the raw v3 results so we can
            // stamp the dissolved flag on company graph nodes. This is the only
            // point in the search path where is_dissolved is available without an
            // extra API call; enrichLinksWithEventDates reads it back from
            // companyNode.isDissolved when marking links as companyDissolved.
            const dissolvedIds = new Set(
              v3Results
                .filter(c => c.is_dissolved)
                .map(c => companyNameToId(normalizeCompanyName(c.company_name || c.name || '')))
            );
            if (dissolvedIds.size > 0 || groupKey) {
              setGraphData(prev => ({
                ...prev,
                nodes: prev.nodes.map(n => {
                  const updates = {};
                  if (dissolvedIds.has(n.id)) updates.isDissolved = true;
                  if (groupKey && pinnedIds.includes(n.id) && !n.groupKey) updates.groupKey = groupKey;
                  return Object.keys(updates).length > 0 ? { ...n, ...updates } : n;
                }),
              }));
            } else if (groupKey && pinnedIds.length > 0) {
              // Stamp the resolved group_key onto the searched company node so a
              // later preview/expand reuses it (step 1 of resolveCompanyGroupKey)
              // instead of re-resolving the name.
              setGraphData(prev => ({
                ...prev,
                nodes: prev.nodes.map(n =>
                  pinnedIds.includes(n.id) && !n.groupKey ? { ...n, groupKey } : n
                ),
              }));
            }
            setLastSearchContext({
              query,
              searchType: 'company',
              exactMatch: exactMatch,
              size: companiesPerSearch,
              offset: v3Results.length,
              hasMore: false, // v3 company docs are complete (all officers pre-aggregated)
              total: v3Data.total || v3Results.length,
            });
            // First company loaded becomes the sticky Custom-DD subject; later
            // company searches append to the graph but keep the original subject.
            setPrimarySubject(prev => prev || query);
            setSearchQuery('');
            // Company⇄cargo: does this same entity also hold cargos elsewhere?
            if (pinnedIds.length > 0) {
              const primaryName = normalizeCompanyName(
                merged[0].name || merged[0].company_name || ''
              );
              runCargoDetection(primaryName, pinnedIds[0]);
            }
          } else {
            trackSearchResult('no_precise_match');
            setError(text.noPreciseMatch(query));
          }
        } else {
          trackSearchResult('no_results');
          setError(text.noResults(query));
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      trackSearchResult(isDataIndexUnavailableError(err) ? 'maintenance' : 'error');
      if (isDataIndexUnavailableError(err)) {
        setError({
          kind: 'maintenance',
          title: DATA_MAINTENANCE.title,
          message: DATA_MAINTENANCE.message,
        });
      } else {
        setError(text.searchError(err.message));
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = async () => {
    const context = lastSearchContext;
    if (!context?.hasMore || loadingMore) return;

    setLoadingMore(true);
    setError(null);

    try {
      const data = await spanishCompaniesService.workingSearch(context.query, {
        size: context.size,
        offset: context.offset,
        officerMode: context.searchType === 'officer',
        exactMatch: context.exactMatch,
      });

      if (context.searchType === 'officer') {
        const fetchedCount = data.officers?.length || 0;
        if (data.success && fetchedCount > 0) {
          await addOfficerToGraph(data.officers, context.query);
          const officerId = officerIdFor(context.query);
          setPinnedNodeIds(prev => new Set([...prev, officerId]));
          setLastSearchContext(prev =>
            prev
              ? {
                  ...prev,
                  offset: prev.offset + fetchedCount,
                  hasMore: data.hasMore,
                  total: data.total || prev.total,
                }
              : prev
          );
        } else {
          setLastSearchContext(prev => (prev ? { ...prev, hasMore: false } : prev));
        }
      } else {
        const fetchedCount = data.results?.length || 0;
        if (data.success && fetchedCount > 0) {
          const filtered = filterCompanyMatches(data.results, context.query);
          if (filtered.length > 0) {
            await addCompanyWithOfficersToGraph(filtered);
            filtered.forEach(company => {
              const companyName = normalizeCompanyName(company.name || company.company_name || '');
              const companyId = companyNameToId(companyName);
              setPinnedNodeIds(prev => new Set([...prev, companyId]));
            });
          }

          setLastSearchContext(prev =>
            prev
              ? {
                  ...prev,
                  offset: prev.offset + fetchedCount,
                  hasMore: data.hasMore,
                  total: data.total || prev.total,
                }
              : prev
          );

          if (filtered.length === 0 && !data.hasMore) {
            setError(text.noMorePrecise(context.query));
          }
        } else {
          setLastSearchContext(prev => (prev ? { ...prev, hasMore: false } : prev));
        }
      }
    } catch (err) {
      console.error('Load more error:', err);
      setError(text.loadMoreError(err.message));
    } finally {
      setLoadingMore(false);
    }
  };

  // Fetch companies that this entity (company or person) is sole shareholder OF,
  // and append ownership nodes/links (entity → owned company). This is the OUTGOING
  // ownership direction — e.g. FASTIGHETSBYRAN → ALICANTE ESTATE GROUP.
  const addOwnedCompaniesForEntity = useCallback(async (entityName, entityId, entityKind) => {
    if (!entityName || !entityId) return;
    try {
      const result = await spanishCompaniesService.getCompaniesOwnedByShareholder(entityName, {
        limit: 50,
      });
      const owned = result?.companies || [];
      console.debug('[OwnsCompanies]', entityName, { count: owned.length });
      if (!result?.success || owned.length === 0) return;

      // Resolve a STABLE group_key per owned company so the new node binds to the
      // correct legal entity when later expanded/previewed (the ownership payload
      // today carries identifier: "" — no id — so an ambiguous name like "NAMISA"
      // would otherwise fuzzy-resolve to the wrong company). resolveCompanyGroupKey
      // prefers any group_key already on the record (forward-compatible: once the
      // backend adds group_key here, the directory lookup is skipped), else falls
      // back to the directory autocomplete.
      const ownedGroupKeys = await Promise.all(
        owned.map(c =>
          spanishCompaniesService
            .resolveCompanyGroupKey(c.name || c.company_name || '', c)
            .catch(() => null)
        )
      );

      setGraphData(prev => {
        const entityNode = prev.nodes.find(n => n.id === entityId);
        if (!entityNode) return prev;

        const newNodes = [...prev.nodes];
        const newLinks = [...prev.links];

        owned.forEach((c, idx) => {
          const cName = (c.name || c.company_name || '').trim();
          if (!cName) return;
          // For a person entity we only want companies owned by the person (shareholder_type: individual)
          // For a company entity the shareholder is the company itself.
          if (entityKind === 'person' && c.shareholder_type && c.shareholder_type !== 'individual') return;

          const cId = companyNameToId(cName);
          const targetUpper = normalizeCompanyName(cName).toUpperCase();
          let existing = newNodes.find(
            n => n.id === cId ||
              (n.type === 'spanish-company-group' && normalizeCompanyName(n.name).toUpperCase() === targetUpper)
          );
          const resolvedId = existing ? existing.id : cId;
          if (resolvedId === entityId) return;
          const ownedGroupKey = ownedGroupKeys[idx] || null;

          if (!existing) {
            const baseX = Number.isFinite(entityNode.x) ? entityNode.x : 0;
            const baseY = Number.isFinite(entityNode.y) ? entityNode.y : 0;
            const angle = (idx / Math.max(owned.length, 1)) * 2 * Math.PI + Math.PI; // offset to avoid overlap with inbound shareholders
            const dist = 100;
            const px = baseX + Math.cos(angle) * dist;
            const py = baseY + Math.sin(angle) * dist;
            newNodes.push({
              id: resolvedId,
              name: cName,
              type: 'spanish-company-group',
              // Stable group_key so expand/preview fetches bind to the right entity.
              groupKey: ownedGroupKey,
              previousNames: [],
              companySummary: {
                entries: [],
                totalEntries: 0,
                previousNames: [],
                dateRange: { earliest: null, latest: null },
              },
              x: px,
              y: py,
              fx: px,
              fy: py,
            });
          } else if (ownedGroupKey && !existing.groupKey) {
            // Backfill the group_key onto a pre-existing node that lacked one.
            existing.groupKey = ownedGroupKey;
          }

          const linkId = `ownership-${entityId}-${resolvedId}`;
          if (!newLinks.find(l => l.id === linkId)) {
            newLinks.push({
              id: linkId,
              source: entityId,
              target: resolvedId,
              type: 'ownership',
              relationship: 'Socio único',
              category: 'socio_unico',
              date: null,
            });
          }
        });

        return { nodes: newNodes, links: dedupeGraphLinks(newLinks) };
      });
    } catch (err) {
      console.warn('[OwnsCompanies] Fetch failed for', entityName, err?.message || err);
    }
  }, []);

  // Fetch sole-shareholder data for a company and append ownership nodes/links.
  // Fire-and-forget: runs after the initial company insert so the graph appears
  // immediately and ownership info streams in. Idempotent — safe to call repeatedly.
  // API shape: sole_shareholders / sole_shareholder_individuals are arrays of bare strings
  // (entity names); sole_shareholder_lost is a top-level boolean for the whole company.
  const addShareholdersForCompany = useCallback(async (companyName, companyId) => {
    if (!companyName || !companyId) return;
    try {
      const result = await spanishCompaniesService.getCompanySoleShareholderData(companyName);
      console.debug('[Shareholders]', companyName, {
        success: result?.success,
        companies: (result?.sole_shareholders || []).length,
        individuals: (result?.sole_shareholder_individuals || []).length,
        lost: result?.sole_shareholder_lost,
      });
      if (!result?.success) return;

      const companyShareholders = (result.sole_shareholders || []).map(s => ({
        name: typeof s === 'string' ? s : (s?.name || s?.shareholder_name || ''),
        kind: 'company',
        historical: false,
      }));
      const individualShareholders = (result.sole_shareholder_individuals || []).map(s => ({
        name: typeof s === 'string' ? s : (s?.name || s?.shareholder_name || ''),
        kind: 'individual',
        historical: false,
      }));
      // Previous (superseded) sole shareholders — after a "cambio de socio
      // único". Drawn set apart as historical so they don't read as current.
      const prevCompanyShareholders = (result.previous_sole_shareholders || []).map(s => ({
        name: typeof s === 'string' ? s : (s?.name || s?.shareholder_name || ''),
        kind: 'company',
        historical: true,
      }));
      const prevIndividualShareholders = (result.previous_sole_shareholder_individuals || []).map(
        s => ({
          name: typeof s === 'string' ? s : (s?.name || s?.shareholder_name || ''),
          kind: 'individual',
          historical: true,
        })
      );
      const shareholders = [
        ...companyShareholders,
        ...individualShareholders,
        ...prevCompanyShareholders,
        ...prevIndividualShareholders,
      ].filter(s => s.name);
      if (shareholders.length === 0) return;
      const ownershipLost = !!result.sole_shareholder_lost;

      setGraphData(prev => {
        const companyNode = prev.nodes.find(n => n.id === companyId);
        if (!companyNode) return prev;

        const newNodes = [...prev.nodes];
        const newLinks = [...prev.links];

        shareholders.forEach((sh, idx) => {
          const shName = sh.name.trim();
          if (!shName) return;
          const isCompanyShareholder = sh.kind === 'company' || isCompanyOfficer(shName);

          let shId;
          let existingNode = null;
          if (isCompanyShareholder) {
            shId = companyNameToId(shName);
            const target = normalizeCompanyName(shName).toUpperCase();
            existingNode = newNodes.find(
              n => n.id === shId ||
                (n.type === 'spanish-company-group' && normalizeCompanyName(n.name).toUpperCase() === target)
            );
            if (existingNode) shId = existingNode.id;
          } else {
            const nameKey = officerNodeKey(shName);
            shId = officerIdFor(shName);
            existingNode = newNodes.find(
              n => n.type === 'officer' && officerNodeKey(n.name) === nameKey
            );
            if (existingNode) shId = existingNode.id;
          }

          // Don't link a company to itself.
          if (shId === companyId) return;

          if (!existingNode) {
            const baseX = Number.isFinite(companyNode.x) ? companyNode.x : 0;
            const baseY = Number.isFinite(companyNode.y) ? companyNode.y : 0;
            const angle = (idx / Math.max(shareholders.length, 1)) * 2 * Math.PI;
            const dist = 80;
            const px = baseX + Math.cos(angle) * dist;
            const py = baseY + Math.sin(angle) * dist;

            const newNode = isCompanyShareholder
              ? {
                  id: shId,
                  name: shName,
                  type: 'spanish-company-group',
                  previousNames: [],
                  companySummary: {
                    entries: [],
                    totalEntries: 0,
                    previousNames: [],
                    dateRange: { earliest: null, latest: null },
                  },
                  x: px,
                  y: py,
                  fx: px,
                  fy: py,
                }
              : {
                  id: shId,
                  name: shName,
                  type: 'officer',
                  subtype: 'individual',
                  position: 'Socio único',
                  category: 'nombramientos',
                  data: { name: shName, kind: 'individual' },
                  companies: [companyName],
                  positions: [
                    { company: companyName, position: 'Socio único', category: 'nombramientos' },
                  ],
                  x: px,
                  y: py,
                  fx: px,
                  fy: py,
                };
            newNodes.push(newNode);
          }

          const linkId = sh.historical
            ? `ownership-prev-${shId}-${companyId}`
            : `ownership-${shId}-${companyId}`;
          if (!newLinks.find(l => l.id === linkId)) {
            newLinks.push({
              id: linkId,
              source: shId,
              target: companyId,
              type: 'ownership',
              relationship: sh.historical ? 'Socio único (anterior)' : 'Socio único',
              category: sh.historical
                ? 'socio_anterior'
                : ownershipLost
                  ? 'socio_perdido'
                  : 'socio_unico',
              date: null,
            });
          }
        });

        return { nodes: newNodes, links: dedupeGraphLinks(newLinks) };
      });
    } catch (err) {
      console.warn('[Shareholders] Fetch failed for', companyName, err?.message || err);
    }
  }, [isCompanyOfficer]);

  // Fetch real appointment/cessation event dates per company via borme_events_v3
  // and patch existing officer-company links with link.events = [{ category, date, position }, ...].
  // Runs fire-and-forget after the initial graph build — dates appear progressively.
  const enrichLinksWithEventDates = useCallback(async (companyNamesRaw) => {
    const unique = Array.from(
      new Set(
        (companyNamesRaw || [])
          .map(n => normalizeCompanyName(n))
          .filter(Boolean)
      )
    );
    if (unique.length === 0) return;

    const results = await Promise.all(
      unique.map(async cname => {
        try {
          const resp = await spanishCompaniesService.getCompanyEventsV3(cname);
          return { company: cname, events: resp?.events || [] };
        } catch (err) {
          console.warn(`[enrichLinks] events fetch failed for "${cname}":`, err?.message || err);
          return { company: cname, events: [] };
        }
      })
    );

    // Build (officerUpper|companyUpper|category) → Map<"date|position", {date, position}>
    // Keyed by date+position so that e.g. a revocation as "APO." and an appointment
    // as "ADM." on the same date remain distinct rows with their own Cargo.
    const eventMap = new Map();
    results.forEach(({ company, events }) => {
      const companyUpper = company.toUpperCase();
      events.forEach(evt => {
        const evtDate = evt.event_date || evt.indexed_date || evt.date;
        if (!evtDate) return;
        (evt.officers || []).forEach(o => {
          const officerUpper = (o.name || '').trim().toUpperCase();
          if (!officerUpper) return;
          const evtType = (o.event_type || '').toLowerCase();
          let cat = null;
          if (evtType.includes('cese') || evtType.includes('dimisi')) cat = 'ceses_dimisiones';
          else if (evtType.includes('reelecc')) cat = 'reelecciones';
          else if (evtType.includes('revocac')) cat = 'revocaciones';
          else if (evtType.includes('nombr')) cat = 'nombramientos';
          if (!cat) return;
          const position = o.specific_role || o.position_normalized || o.role || o.position || '';
          const key = `${officerUpper}|${companyUpper}|${cat}`;
          if (!eventMap.has(key)) eventMap.set(key, new Map());
          const dedupKey = `${evtDate}|${position}`;
          if (!eventMap.get(key).has(dedupKey)) {
            eventMap.get(key).set(dedupKey, { date: evtDate, position });
          }
        });
      });
    });

    // Do NOT early-return when eventMap is empty: a dissolved company that has
    // no events in the v3 index still needs its officer links stamped
    // companyDissolved=true.  The setGraphData pass below already skips links
    // where events.length===0 && !companyDissolved (line ~2479), so the
    // non-dissolved / no-event path is unaffected.

    setGraphData(prev => {
      const nodesById = new Map(prev.nodes.map(n => [n.id, n]));
      const newLinks = prev.links.map(link => {
        const sourceNode =
          typeof link.source === 'object' ? link.source : nodesById.get(link.source);
        const targetNode =
          typeof link.target === 'object' ? link.target : nodesById.get(link.target);
        if (!sourceNode || !targetNode) return link;

        let officerNode, companyNode;
        if (sourceNode.type === 'officer') {
          officerNode = sourceNode;
          companyNode = targetNode;
        } else if (targetNode.type === 'officer') {
          officerNode = targetNode;
          companyNode = sourceNode;
        } else {
          return link;
        }

        const officerUpper = (officerNode.name || '').toUpperCase();
        const companyUpper = (companyNode.name || '').toUpperCase();

        // If the company node is marked dissolved, every officer-company link
        // for this company is implicitly ceased — dissolution implies cessation
        // even when individual cese events were never inscribed in BORME.
        const companyDissolved = !!companyNode.isDissolved;

        // Only attach events for THIS link's role. An officer can hold several
        // roles at one company with independent active/ceased status (e.g. an
        // active CONSEJERO and a later-revoked APODERADO); without this filter
        // every role-link inherits the company's latest event, so a still-active
        // seat is mislabeled ceased and the company disappears under an
        // active-only filter. See sameRoleCategory.
        const linkRole = link.relationship || '';
        const events = [];
        ['nombramientos', 'ceses_dimisiones', 'reelecciones', 'revocaciones'].forEach(cat => {
          const entries = eventMap.get(`${officerUpper}|${companyUpper}|${cat}`);
          if (entries) {
            entries.forEach(({ date, position }) => {
              if (!sameRoleCategory(position, linkRole)) return;
              events.push({ category: cat, date, position });
            });
          }
        });

        if (events.length === 0 && !companyDissolved) return link;
        return {
          ...link,
          ...(events.length > 0 && { events }),
          ...(companyDissolved && { companyDissolved: true }),
        };
      });
      return { nodes: prev.nodes, links: newLinks };
    });
  }, []);

  // Add company with all its officers to the graph
  const addCompanyWithOfficersToGraph = useCallback(
    async (searchResults, anchorNode = null, nameChangeAliasMap = null) => {

      setIsLoading(true);
      setError(null);

      try {
        setGraphData(prevData => {
          const newNodes = [...prevData.nodes];
          const newLinks = [...prevData.links];

          const hasExplicitAnchor = isFinitePoint(anchorNode);
          const defaultAnchor = computeGraphCentroid(prevData.nodes, viewportCenter);
          const anchor = hasExplicitAnchor ? { x: anchorNode.x, y: anchorNode.y } : defaultAnchor;
          const keepExpansionNodesFixed = hasExplicitAnchor;

          // Group companies by name to avoid duplicates
          const companiesByName = {};

          searchResults.forEach(company => {
            const companyName = company.name || company.company_name || 'Unknown';
            // Skip corrupt ES documents where company_name is a BORME issue blob
            if (companyName.length > 200) return;
            const cleanName = normalizeCompanyName(companyName);

            // Resolve name change aliases: group old name entries under the new (current) name.
            //
            // Previously the fallback (no matching newNameEntry in searchResults) silently
            // kept ``cleanName`` (the old name) as the group key, so the graph node ended
            // up labelled with the previous denomination even though autocomplete had
            // correctly resolved the current one. Fall back to the ``resolved`` new name
            // instead — it's already normalised, so at worst the label is uppercase but
            // always correct; a nicer-cased sibling entry still wins when present.
            let groupKey = cleanName;
            if (nameChangeAliasMap) {
              const resolved = nameChangeAliasMap.get(cleanName.toUpperCase());
              if (resolved) {
                const newNameEntry = searchResults.find(
                  c => normalizeCompanyName(c.name || c.company_name || '').toUpperCase() === resolved
                );
                groupKey = newNameEntry
                  ? normalizeCompanyName(newNameEntry.name || newNameEntry.company_name)
                  : resolved;
              }
            }

            if (!companiesByName[groupKey]) {
              companiesByName[groupKey] = {
                entries: [],
                dateRange: { earliest: null, latest: null },
                previousNames: [],
              };
            }

            companiesByName[groupKey].entries.push(company);

            // Track previous names
            if (groupKey !== cleanName && !companiesByName[groupKey].previousNames.includes(cleanName)) {
              companiesByName[groupKey].previousNames.push(cleanName);
            }

            // Track date range
            const entryDate = new Date(company.indexed_date || company.date || 0);
            if (
              !companiesByName[groupKey].dateRange.earliest ||
              entryDate < companiesByName[groupKey].dateRange.earliest
            ) {
              companiesByName[groupKey].dateRange.earliest = entryDate;
            }
            if (
              !companiesByName[groupKey].dateRange.latest ||
              entryDate > companiesByName[groupKey].dateRange.latest
            ) {
              companiesByName[groupKey].dateRange.latest = entryDate;
            }
          });

          // Add grouped company nodes and extract officers
          const groupedCompanies = Object.entries(companiesByName);

          // Pre-count genuinely new companies
          const newCompanyCount = groupedCompanies.filter(([cn]) => {
            const cid = companyNameToId(cn);
            return !newNodes.find(
              n => n.id === cid ||
                (n.type === 'spanish-company-group' &&
                  normalizeCompanyName(n.name).toUpperCase() === cn.toUpperCase())
            );
          }).length;

          // For expansions (has anchor node), cluster away; for initial search, ring around center
          const companyClusterHub = hasExplicitAnchor
            ? computeClusterHub({
                anchor,
                total: newCompanyCount,
                existingNodes: newNodes,
                stemLength: 180,
                clusterSpacing: 70,
              })
            : null;

          let newCompanyIdx = 0;
          groupedCompanies.forEach(([companyName, summary]) => {
            let companyId = companyNameToId(companyName);

            // Check if company already exists by ID or by normalized name — only skip node creation, still extract officers
            const companyExists = newNodes.find(
              n =>
                n.id === companyId ||
                (n.type === 'spanish-company-group' &&
                  normalizeCompanyName(n.name).toUpperCase() === companyName.toUpperCase())
            );

            // Use existing node's ID for links (may differ from generated ID if name varied)
            if (companyExists) {
              companyId = companyExists.id;
            }

            if (!companyExists) {
              const companyPosition = companyClusterHub
                ? clusterPosition({
                    hub: companyClusterHub.hub,
                    index: newCompanyIdx,
                    total: newCompanyCount,
                    existingNodes: newNodes,
                    clusterSpacing: 70,
                    minDistance: 60,
                  })
                : ringPosition({
                    anchor,
                    index: newCompanyIdx,
                    total: newCompanyCount,
                    existingNodes: newNodes,
                    radius: 220,
                    minDistance: 80,
                  });
              newCompanyIdx++;

              // Add company node — always pin temporarily so the simulation
              // settles *around* new nodes rather than collapsing them inward.
              const companyNode = {
                id: companyId,
                name: companyName,
                type: 'spanish-company-group',
                previousNames: summary.previousNames || [],
                companySummary: {
                  entries: summary.entries,
                  totalEntries: summary.entries.length,
                  previousNames: summary.previousNames || [],
                  dateRange: {
                    earliest: summary.dateRange.earliest?.toISOString(),
                    latest: summary.dateRange.latest?.toISOString(),
                  },
                },
                ...companyPosition,
                fx: companyPosition.x,
                fy: companyPosition.y,
              };
              newNodes.push(companyNode);
            }

            const companyNodeForLayout = newNodes.find(n => n.id === companyId) || companyExists;
            const companyAnchor = isFinitePoint(companyNodeForLayout)
              ? { x: companyNodeForLayout.x, y: companyNodeForLayout.y }
              : anchor;

            // Extract all officers from all entries (even if company already existed in graph)
            const allOfficers = {
              nombramientos: [],
              reelecciones: [],
              revocaciones: [],
              ceses_dimisiones: [],
            };

            // Track previous names (from name change grouping) for link annotation
            const previousNamesUpper = (summary.previousNames || []).map(n => n.toUpperCase());

            // Process each entry to extract officers
            summary.entries.forEach(entry => {
              const entryDate = entry.indexed_date || entry.date;
              // Track which company name this entry originally came from
              const entrySourceName = (entry.name || entry.company_name || '').trim();
              const getOfficerCategory = officer => {
                const categoryHint = `${officer?.category || ''} ${officer?.type || ''} ${
                  officer?.raw_entry || ''
                } ${officer?.position || ''} ${officer?.role || ''}`.toLowerCase();
                if (categoryHint.includes('reelec')) return 'reelecciones';
                if (categoryHint.includes('revoc')) return 'revocaciones';
                if (categoryHint.includes('cese') || categoryHint.includes('dimis')) {
                  return 'ceses_dimisiones';
                }
                return 'nombramientos';
              };
              const toSafeString = value => (typeof value === 'string' ? value.trim() : '');
              const countCollectedOfficers = () =>
                Object.values(allOfficers).reduce((sum, categoryList) => sum + categoryList.length, 0);
              const collectedBeforeEntry = countCollectedOfficers();

              // Use pre-parsed data if available
              let entryParsed;
              if (entry.parsed && entry.parsed.officers) {
                entryParsed = entry.parsed;
              } else {
                // Fallback to parsing if not available
                entryParsed = parseSpanishCompanyData(entry);
              }

              // Iterate over each officer category to populate allOfficers
              Object.keys(allOfficers).forEach(categoryKey => {
                // Check if the primary parser found officers for this category
                if (
                  entryParsed.officers[categoryKey] &&
                  entryParsed.officers[categoryKey].length > 0
                ) {
                  entryParsed.officers[categoryKey].forEach(parsedOfficer => {
                    // Renamed to avoid confusion
                    allOfficers[categoryKey].push({
                      ...parsedOfficer,
                      category: categoryKey, // Explicitly set the category
                      date: entryDate,
                      entry_identifier: entry.identifier,
                      source_parser: 'primary',
                      _sourceCompanyName: entrySourceName,
                    });
                  });
                }
                // If primary parsing for this category is empty, AND raw text for this category exists in parsed_details
                else if (entry.parsed_details && entry.parsed_details[categoryKey]) {
                  const officersFromFallback = extractOfficersFromText(
                    entry.parsed_details[categoryKey],
                    categoryKey
                  );

                  if (officersFromFallback.length > 0) {
                    officersFromFallback.forEach(officer => {
                      allOfficers[categoryKey].push({
                        ...officer,
                        date: entryDate,
                        entry_identifier: entry.identifier,
                        source_parser: 'network_fallback',
                        _sourceCompanyName: entrySourceName,
                      });
                    });
                  }
                }
              });

              // Fallback: use backend-provided officers array when parser found none for this entry.
              if (countCollectedOfficers() === collectedBeforeEntry && Array.isArray(entry.officers)) {
                entry.officers.forEach(officer => {
                  const name = toSafeString(officer?.name || officer?.officer_name || officer?.full_name);
                  if (!name) return;

                  const position = toSafeString(
                    officer?.position || officer?.role || officer?.title || ''
                  );
                  const category = getOfficerCategory(officer);

                  allOfficers[category].push({
                    ...officer,
                    name,
                    position,
                    category,
                    date: entryDate,
                    entry_identifier: entry.identifier,
                    source_parser: 'direct_officers_fallback',
                    _sourceCompanyName: entrySourceName,
                  });
                });
              }
            });

            // Deduplicate officers within each category (same name + position)
            Object.keys(allOfficers).forEach(categoryKey => {
              const seen = new Set();
              allOfficers[categoryKey] = allOfficers[categoryKey].filter(officer => {
                const key = `${officer.name}-${officer.position}`;
                if (seen.has(key)) {
                  return false;
                }
                seen.add(key);
                return true;
              });
            });

            // Add officer nodes and links to company
            let allOfficersList = [
              ...allOfficers.nombramientos,
              ...allOfficers.reelecciones,
              ...allOfficers.revocaciones,
              ...allOfficers.ceses_dimisiones,
            ];

            // Post-merge cap: the per-v3-doc cap already fired, but several docs
            // (e.g. "CAIXABANK SA" + "CAIXABANK S.A." + a previous-name doc) get
            // grouped into one company node here, stacking their capped officer
            // lists. Apply the cap again on the merged list so the UI limit is
            // actually enforced per company node.
            if (officersPerCompany && allOfficersList.length > officersPerCompany) {
              const tierFor = pos => {
                const p = (pos || '').toUpperCase();
                if (p.startsWith('PRESIDENTE') || p.startsWith('PDTE') || p.startsWith('PRES.') || p.startsWith('PRE.COM')) return 0;
                if (p.startsWith('VICEPRESIDENTE') || p.startsWith('VPDTE') || p.startsWith('VICEPTE') || p.startsWith('VIC.COM')) return 1;
                if (p.startsWith('CONSEJERO') || p.startsWith('CONS.') || p.startsWith('CONS ') || p.startsWith('CON.DEL')) return 2;
                if (p.startsWith('ADMINISTRADOR') || p.startsWith('ADM.') || p.startsWith('ADM ')) return 3;
                if (p.startsWith('SECRETARIO') || p.startsWith('SECRET.') || p.startsWith('SRIO')) return 4;
                if (p.startsWith('LIQUIDADOR') || p.startsWith('LIQ.') || p.startsWith('LIQ ')) return 5;
                if (p.startsWith('VOCAL')) return 6;
                if (/^(MIE|MBRO|MRO|MIEM|M)\.?COM/.test(p)) return 6;
                if (p.startsWith('AUDITOR') || p.startsWith('AUD.')) return 8;
                if (p.startsWith('APO') || p.startsWith('APODERADO')) return 9;
                return 7;
              };
              const dateOf = o => {
                const v = o.appointed_date || o.resigned_date || o.date;
                if (!v) return 0;
                const t = new Date(v).getTime();
                return Number.isFinite(t) ? t : 0;
              };
              allOfficersList.sort((a, b) => {
                const ta = tierFor(a.position), tb = tierFor(b.position);
                if (ta !== tb) return ta - tb;
                const da = dateOf(a), db = dateOf(b);
                if (db !== da) return db - da;
                return (a.name || '').localeCompare(b.name || '');
              });
              allOfficersList = allOfficersList.slice(0, officersPerCompany);
              // Rebuild per-category buckets so downstream link-category logic
              // still sees the right events for each kept officer.
              const keptKeys = new Set(allOfficersList.map(o => `${o.name}-${o.position}`));
              Object.keys(allOfficers).forEach(k => {
                allOfficers[k] = allOfficers[k].filter(o => keptKeys.has(`${o.name}-${o.position}`));
              });
            }

            // Determine effective (most recent) category per (officer, position) pair.
            // Mirrors spanishOfficerAnalyzer: tracks each role independently so a cessation
            // from role X does not mark the officer as resigned from role Y.
            const officerEffectiveCategory = {};
            allOfficersList.forEach(o => {
              const key = `${officerNodeKey(o.name)}||${(o.position || '').trim().toLowerCase()}`;
              const d = new Date(o.date || 0);
              if (!officerEffectiveCategory[key] || d > officerEffectiveCategory[key].date) {
                officerEffectiveCategory[key] = { category: o.category, date: d };
              }
            });


            let officerRingIdx = 0;
            allOfficersList.forEach(officer => {
              // Create a normalized name for consistent node identification
              const normalizedName = officerNodeKey(officer.name);
              const officerId = officerIdFor(officer.name);

              // Check if officer already exists by name (not just ID) - also check existing graph data
              let officerNode = newNodes.find(
                n => n.type === 'officer' && officerNodeKey(n.name) === normalizedName
              );

              // Also check in the existing graph data (prevData.nodes)
              if (!officerNode) {
                officerNode = prevData.nodes.find(
                  n => n.type === 'officer' && officerNodeKey(n.name) === normalizedName
                );
                if (officerNode) {
                  // If found in existing data, add it to newNodes to work with
                  officerNode = { ...officerNode };
                  const existingIndex = newNodes.findIndex(n => n.id === officerNode.id);
                  if (existingIndex === -1) {
                    newNodes.push(officerNode);
                  }
                }
              }

              if (!officerNode) {
                // Determine if this is a company or individual officer
                const isCompany = isCompanyOfficer(officer.name);
                const officerPosition = ringPosition({
                  anchor: companyAnchor,
                  index: officerRingIdx,
                  total: allOfficersList.length,
                  existingNodes: newNodes,
                  radius: 140,
                  minDistance: 45,
                });
                officerRingIdx++;

                // Add new officer node
                officerNode = {
                  id: officerId,
                  name: officer.name,
                  type: 'officer',
                  subtype: isCompany ? 'company' : 'individual',
                  position: officer.position,
                  category: officer.category,
                  data: officer,
                  companies: [companyName], // Track which companies this officer is associated with
                  positions: [
                    {
                      company: companyName,
                      position: officer.position,
                      category: officer.category,
                    },
                  ],
                  ...officerPosition,
                  fx: officerPosition.x,
                  fy: officerPosition.y,
                };
                newNodes.push(officerNode);
              } else {
                // Officer already exists, merge information
                if (!officerNode.companies.includes(companyName)) {
                  officerNode.companies.push(companyName);
                }

                // Add position if not already present
                const existingPosition = officerNode.positions.find(
                  p => p.company === companyName && p.position === officer.position
                );
                if (!existingPosition) {
                  officerNode.positions.push({
                    company: companyName,
                    position: officer.position,
                    category: officer.category,
                  });
                }
              }

              // Add link between company and officer
              // One link per officer-position pair; category derived from most recent event.
              const positionKey = officer.position
                ? officer.position.toLowerCase().replace(/[^a-z0-9]/g, '')
                : 'unknownpos';
              const linkId = `${officerNode.id}-${companyId}-${positionKey}`;

              if (!newLinks.find(l => l.id === linkId)) {
                const posEffKey = `${normalizedName}||${(officer.position || '').trim().toLowerCase()}`;
                const effectiveCategory =
                  officerEffectiveCategory[posEffKey]?.category || officer.category;
                // Check if this officer came from a previous (old) company name
                const isFromPreviousName = officer._sourceCompanyName &&
                  previousNamesUpper.includes(officer._sourceCompanyName.toUpperCase());
                newLinks.push({
                  id: linkId,
                  source: officerNode.id,
                  target: companyId,
                  type: 'officer-company',
                  relationship: officer.specific_role || officer.position,
                  category: effectiveCategory,
                  date: officer.date || null,
                  ...(isFromPreviousName && { fromPreviousName: officer._sourceCompanyName }),
                });
              }
            });
          });

          return { nodes: newNodes, links: dedupeGraphLinks(newLinks) };
        });

        // Collect unique company names across the search results
        const uniqueCompanyNames = new Set();
        searchResults.forEach(c => {
          const raw = c.name || c.company_name || '';
          if (!raw || raw.length > 200) return;
          uniqueCompanyNames.add(normalizeCompanyName(raw));
        });

        // Fire-and-forget shareholder fetches per unique company (both directions).
        if (showShareholders) {
          uniqueCompanyNames.forEach(n => {
            const cId = companyNameToId(n);
            addShareholdersForCompany(n, cId);        // who owns it
            addOwnedCompaniesForEntity(n, cId, 'company'); // what it owns
          });
        }

        // Fire-and-forget: enrich links with real appointment/cessation event dates
        enrichLinksWithEventDates(Array.from(uniqueCompanyNames));

      } catch (err) {
        console.error('Error adding company with officers to graph:', err);
        setError(text.addCompanyError(err.message));
      } finally {
        setIsLoading(false);
      }
    },
    [extractOfficersFromText, isCompanyOfficer, viewportCenter, showShareholders, addShareholdersForCompany, addOwnedCompaniesForEntity, enrichLinksWithEventDates, officersPerCompany, text]
  );

  // Add officer to graph with associated companies
  const addOfficerToGraph = useCallback(
    async (searchResults, officerNameParam) => {

      setIsLoading(true);
      setError(null);

      try {
        // If searchResults is a single result, wrap it in an array
        const results = Array.isArray(searchResults) ? searchResults : [searchResults];

        // Check for name change aliases among the companies this officer appears in
        const uniqueNames = new Set(
          results
            .map(e => (e.company_name || e.company || e.name || '').trim().toUpperCase())
            .filter(Boolean)
        );
        const officerAliasMap = new Map(); // oldNameUpper → newNameUpper
        for (const name of uniqueNames) {
          try {
            const acResult = await spanishCompaniesService.autocompleteCompanies(name, { limit: 3 });
            const match = (acResult.suggestions || []).find(
              s => (s.name || '').trim().toUpperCase() === name
            );
            if (match) {
              if (match.has_new_name && match.new_company_name) {
                officerAliasMap.set(name, match.new_company_name.trim().toUpperCase());
              } else if (match.is_alias && match.original_name) {
                officerAliasMap.set(match.original_name.trim().toUpperCase(), name);
              }
            }
          } catch {
            // Non-fatal
          }
        }

        // Group officer results by (company, position), merging name-changed
        // companies. Splitting per role is critical: one officer can hold
        // multiple positions at the same company (e.g. APODERADO + ADM. MANCOM)
        // with independent active/ceased status. Collapsing them would hide
        // roles and mis-label status.
        const companiesMap = new Map();
        results.forEach(entry => {
          const companyName = (entry.company_name || entry.company || entry.name || '').trim();
          if (!companyName) return;
          let key = companyName.toUpperCase();
          // Resolve old name → new name for grouping
          const resolved = officerAliasMap.get(key);
          if (resolved) key = resolved;
          if (!companiesMap.has(key)) {
            const displayName = resolved ? resolved : companyName;
            companiesMap.set(key, {
              name: displayName,
              entries: [],
              previousNames: [],
              positionGroups: new Map(),
            });
          }
          const group = companiesMap.get(key);
          group.entries.push(entry);
          if (resolved && !group.previousNames.includes(companyName)) {
            group.previousNames.push(companyName);
          }
          // Prefer specific_role (actual job title) over position (BORME section name)
          const roleLabel = (entry.specific_role || entry.role || entry.position || '').trim();
          const posKey = roleLabel.toLowerCase() || '_unknown_';
          if (!group.positionGroups.has(posKey)) {
            group.positionGroups.set(posKey, { role: roleLabel, entries: [] });
          }
          group.positionGroups.get(posKey).entries.push(entry);
        });

        const companyEntries = Array.from(companiesMap.values());

        setGraphData(prevData => {
          const newNodes = [...prevData.nodes];
          const newLinks = [...prevData.links];
          const graphCenter = computeGraphCentroid(prevData.nodes, viewportCenter);

          // Create the officer node first - use parameter instead of state
          const officerName = officerNameParam || results[0]?.name || 'Unknown Officer';
          const normalizedOfficerName = officerNodeKey(officerName);
          const officerId = officerIdFor(officerName);

          // Check if officer already exists
          let officerNode = newNodes.find(n => n.id === officerId);
          if (!officerNode) {
            const isCompany = isCompanyOfficer(officerName);
            const officerPosition = ringPosition({
              anchor: graphCenter,
              index: 0,
              total: 1,
              existingNodes: newNodes,
              radius: 0,
              minDistance: 120,
            });

            officerNode = {
              id: officerId,
              name: officerName,
              type: 'officer',
              subtype: isCompany ? 'company' : 'individual',
              companies: [],
              positions: [],
              data: results[0],
              ...officerPosition,
              fx: officerPosition.x,
              fy: officerPosition.y,
            };
            newNodes.push(officerNode);
          }

          const officerAnchor = isFinitePoint(officerNode)
            ? { x: officerNode.x, y: officerNode.y }
            : graphCenter;

          // Add company nodes and links for each grouped company
          const newCompanyCountForOfficer = companyEntries.filter(g => {
            const cid = companyNameToId(normalizeCompanyName(g.name || 'Unknown Company'));
            return !newNodes.find(n => n.id === cid);
          }).length;
          const officerCompCluster = computeClusterHub({
            anchor: officerAnchor,
            total: newCompanyCountForOfficer,
            existingNodes: newNodes,
            stemLength: 160,
            clusterSpacing: 65,
          });

          let newOfficerCompanyIdx = 0;
          companyEntries.forEach((group) => {
            const companyName = normalizeCompanyName(group.name || 'Unknown Company');
            const companyId = companyNameToId(companyName);

            // Add company to officer's list if not already there
            if (!officerNode.companies.includes(companyName)) {
              officerNode.companies.push(companyName);
            }

            // Check if company already exists
            let companyNode = newNodes.find(n => n.id === companyId);
            if (!companyNode) {
              const companyPosition = clusterPosition({
                hub: officerCompCluster.hub,
                index: newOfficerCompanyIdx,
                total: newCompanyCountForOfficer,
                existingNodes: newNodes,
                clusterSpacing: 65,
                minDistance: 55,
              });
              newOfficerCompanyIdx++;

              companyNode = {
                id: companyId,
                name: companyName,
                type: 'spanish-company-group',
                companySummary: {
                  entries: group.entries,
                  totalEntries: group.entries.length,
                  dateRange: {
                    earliest: group.entries[0]?.indexed_date || group.entries[0]?.date,
                    latest:
                      group.entries[group.entries.length - 1]?.indexed_date ||
                      group.entries[group.entries.length - 1]?.date,
                  },
                },
                ...companyPosition,
                fx: companyPosition.x,
                fy: companyPosition.y,
              };
              newNodes.push(companyNode);
            }

            // One link per (officer, company, position) — category derived
            // from the most recent event for that specific role, preferring
            // the explicit status field (active/ceased) over event_type.
            const prevNames = group.previousNames || [];
            const fromPrevName = prevNames.length > 0 ? prevNames[0] : null;
            if (!officerNode.positions) officerNode.positions = [];
            group.positionGroups.forEach((posGroup, posKey) => {
              const category = resolveEffectiveCategoryForEntries(posGroup.entries);
              const linkIdSuffix = posKey.replace(/[^a-z0-9]/g, '') || 'unknownpos';
              const linkId = `${officerId}-${companyId}-${linkIdSuffix}`;
              if (newLinks.find(l => l.id === linkId)) return;
              const latestEntry = posGroup.entries
                .slice()
                .sort((a, b) => entryTimestamp(b) - entryTimestamp(a))[0];
              if (!officerNode.positions.some(
                p => p.company === companyName && p.position === posGroup.role
              )) {
                officerNode.positions.push({
                  company: companyName,
                  position: posGroup.role,
                  category,
                });
              }
              newLinks.push({
                id: linkId,
                source: officerId,
                target: companyId,
                type: 'officer-company',
                relationship: posGroup.role,
                category,
                date: latestEntry?.date || latestEntry?.event_date || latestEntry?.indexed_date || null,
                ...(fromPrevName && { fromPreviousName: fromPrevName }),
              });
            });
          });

          return { nodes: newNodes, links: dedupeGraphLinks(newLinks) };
        });

        // Collect unique company names for this officer's expanded results
        const uniqueCompanyNames = new Set();
        (searchResults || []).forEach(group => {
          const raw = group?.name || '';
          if (!raw) return;
          uniqueCompanyNames.add(normalizeCompanyName(raw));
        });

        // Fire-and-forget shareholder fetches for the companies discovered for this officer,
        // and for the officer themselves (companies they may be sole shareholder of).
        if (showShareholders) {
          uniqueCompanyNames.forEach(n => {
            const cId = companyNameToId(n);
            addShareholdersForCompany(n, cId);
            addOwnedCompaniesForEntity(n, cId, 'company');
          });
          // Officer may be a sole shareholder of other companies that don't appear here.
          const officerName = (officerNameParam || '').trim();
          if (officerName) {
            const officerId = officerIdFor(officerName);
            addOwnedCompaniesForEntity(officerName, officerId, 'person');
          }
        }

        // Fire-and-forget: enrich links with real appointment/cessation event dates
        enrichLinksWithEventDates(Array.from(uniqueCompanyNames));
      } catch (err) {
        console.error('Error adding officer to graph:', err);
        setError(text.addOfficerError(err.message));
      } finally {
        setIsLoading(false);
      }
    },
    [isCompanyOfficer, viewportCenter, showShareholders, addShareholdersForCompany, addOwnedCompaniesForEntity, enrichLinksWithEventDates, text]
  );

  // Company⇄cargo detection: after a company loads, cheaply check (reverse lookup)
  // whether that same entity also holds cargos (officer seats) on OTHER companies.
  // If so, stamp a `cargoCount` on the node (drives the on-node "+N cargos" badge)
  // and surface a persistent, non-blocking affordance banner. Never throws.
  const runCargoDetection = useCallback(async (companyName, companyId) => {
    if (!companyName || !companyId) return;
    try {
      const res = await detectCargoPresence(spanishCompaniesService, companyName);
      if (!res.hasCargo || res.count <= 0) return;
      setGraphData(prev => ({
        ...prev,
        nodes: prev.nodes.map(n =>
          n.id === companyId && !n.unified ? { ...n, cargoCount: res.count } : n
        ),
      }));
    } catch {
      // Non-fatal — detection is best-effort.
    }
  }, []);

  // Unify: reuse the EXACT existing reverse-lookup render path
  // (expandOfficerV3 → addOfficerToGraph) to build the cargo nodes/links, then fold
  // them off the throwaway officer node ONTO the loaded company node via the pure
  // mergeCargoIntoCompanyNode transform (one node, marked unified).
  const unifyCargosForNode = useCallback(async (companyNodeId, companyName) => {
    if (!companyNodeId || !companyName) return;
    setIsLoading(true);
    setIsUnifying(true);
    setError(null);
    try {
      const data = await spanishCompaniesService.expandOfficerV3(companyName);
      if (data.success && Array.isArray(data.officers) && data.officers.length > 0) {
        // Builds the officer node + cargo company nodes + officer-company links.
        await addOfficerToGraph(data.officers, companyName);
        const officerNodeId = officerIdFor(companyName);
        // Relocate those cargo links onto the company node and drop the officer node.
        setGraphData(prev => mergeCargoIntoCompanyNode(prev, companyNodeId, officerNodeId));
        // The officer node (if it had been pinned) no longer exists — clean up.
        setPinnedNodeIds(prev => {
          if (!prev.has(officerNodeId)) return prev;
          const next = new Set(prev);
          next.delete(officerNodeId);
          return next;
        });
      }
    } catch (err) {
      console.error('Unify cargos failed:', err);
      setError(text.unifyCargosError(err.message));
    } finally {
      setIsLoading(false);
      setIsUnifying(false);
    }
  }, [addOfficerToGraph, text]);

  // Reverse a unify: strip the relocated cargo edges + the cargo-only nodes and
  // restore the amber "+N cargos" affordance. Pure transform via undoCargoUnify.
  const undoCargoUnifyForNode = useCallback((companyNodeId) => {
    if (!companyNodeId) return;
    setGraphData(prev => undoCargoUnify(prev, companyNodeId));
  }, []);

  // Plot a bare shareholder node (no officers, no subsidiaries) so the user
  // can see the entity on the canvas before deciding to fetch its participadas.
  const plotBareShareholderNode = useCallback(
    (entityName, entityKind) => {
      if (!entityName) return null;
      const isCompanyKind = entityKind === 'company';
      const cleanName = isCompanyKind ? normalizeCompanyName(entityName) : entityName.trim();
      const entityId = isCompanyKind
        ? companyNameToId(cleanName)
        : officerIdFor(cleanName);

      setGraphData(prev => {
        if (prev.nodes.find(n => n.id === entityId)) return prev;
        const anchor = computeGraphCentroid(prev.nodes, viewportCenter);
        const position = { x: anchor.x, y: anchor.y };
        const newNode = isCompanyKind
          ? {
              id: entityId,
              name: cleanName,
              type: 'spanish-company-group',
              previousNames: [],
              companySummary: {
                entries: [],
                totalEntries: 0,
                previousNames: [],
                dateRange: { earliest: null, latest: null },
              },
              ...position,
              fx: position.x,
              fy: position.y,
            }
          : {
              id: entityId,
              name: cleanName,
              type: 'officer',
              subtype: 'individual',
              companies: [],
              positions: [],
              data: { name: cleanName, kind: 'individual' },
              ...position,
              fx: position.x,
              fy: position.y,
            };
        return { nodes: [...prev.nodes, newNode], links: prev.links };
      });
      setPinnedNodeIds(prev => new Set([...prev, entityId]));
      return entityId;
    },
    [viewportCenter]
  );

  // Plot every company the shareholder owns as a bare node with an ownership link
  // back to the shareholder. Officers are NOT fetched — user can expand a
  // subsidiary node on demand later. Reuses addOwnedCompaniesForEntity.
  const loadSubsidiariesForShareholder = useCallback(
    async (entityName, entityId, entityKind) => {
      if (!entityName || !entityId) return;
      setLoadingSubsidiaries(true);
      setError(null);
      try {
        await addOwnedCompaniesForEntity(entityName, entityId, entityKind);
      } catch (err) {
        console.error('Load subsidiaries failed:', err);
        setError(text.loadSubsidiariesError(err.message));
      } finally {
        setLoadingSubsidiaries(false);
        setPendingSubsidiaries(null);
      }
    },
    [addOwnedCompaniesForEntity, text]
  );

  // Expand officer node to show other companies
  const expandOfficerNode = useCallback(async officerNode => {
    try {
      // Use borme_companies_v3 for explicit active/resigned status
      const data = await spanishCompaniesService.expandOfficerV3(officerNode.name.trim());

      if (data.success && data.officers && data.officers.length > 0) {
        // Check for name change aliases among the companies
        const uniqueNames = new Set(
          data.officers
            .map(e => (e.company_name || e.company || e.name || '').trim().toUpperCase())
            .filter(Boolean)
        );
        const expandAliasMap = new Map();
        for (const name of uniqueNames) {
          try {
            const acResult = await spanishCompaniesService.autocompleteCompanies(name, { limit: 3 });
            const match = (acResult.suggestions || []).find(
              s => (s.name || '').trim().toUpperCase() === name
            );
            if (match) {
              if (match.has_new_name && match.new_company_name) {
                expandAliasMap.set(name, match.new_company_name.trim().toUpperCase());
              } else if (match.is_alias && match.original_name) {
                expandAliasMap.set(match.original_name.trim().toUpperCase(), name);
              }
            }
          } catch { /* non-fatal */ }
        }

        // Group officer results by (company, position), merging name-changed
        // companies. See addOfficerToGraph — same rationale: one role per link.
        const companiesMap = new Map();
        data.officers.forEach(entry => {
          const companyName = (entry.company_name || entry.company || entry.name || '').trim();
          if (!companyName) return;
          let key = companyName.toUpperCase();
          const resolved = expandAliasMap.get(key);
          if (resolved) key = resolved;
          if (!companiesMap.has(key)) {
            const displayName = resolved ? resolved : companyName;
            companiesMap.set(key, {
              name: displayName,
              entries: [],
              previousNames: [],
              positionGroups: new Map(),
            });
          }
          const group = companiesMap.get(key);
          group.entries.push(entry);
          if (resolved && !group.previousNames.includes(companyName)) {
            group.previousNames.push(companyName);
          }
          const roleText = (entry.specific_role || entry.role || entry.position || '').trim();
          const isSectionName = roleText && BORME_SECTION_NAMES.has(roleText.toLowerCase());
          const posRole = isSectionName ? '' : roleText;
          const posKey = posRole.toLowerCase() || '_unknown_';
          if (!group.positionGroups.has(posKey)) {
            group.positionGroups.set(posKey, { role: posRole, entries: [] });
          }
          group.positionGroups.get(posKey).entries.push(entry);
        });
        const companyEntries = Array.from(companiesMap.values());

        setGraphData(prevData => {
          const newNodes = [...prevData.nodes];
          const newLinks = [...prevData.links];
          const officerAnchor = isFinitePoint(officerNode)
            ? { x: officerNode.x, y: officerNode.y }
            : computeGraphCentroid(prevData.nodes, viewportCenter);

          // Count how many genuinely new companies we'll add (for adaptive layout)
          const newCompanyCount = companyEntries.filter(group => {
            const cn = normalizeCompanyName(group.name || 'Unknown Company');
            const cid = companyNameToId(cn);
            return !newNodes.find(
              n => n.id === cid ||
                (n.type === 'spanish-company-group' &&
                  normalizeCompanyName(n.name).toUpperCase() === cn.toUpperCase())
            );
          }).length;
          const expandOfficerCluster = computeClusterHub({
            anchor: officerAnchor,
            total: newCompanyCount,
            existingNodes: newNodes,
            stemLength: 160,
            clusterSpacing: 65,
          });
          let newIdx = 0;
          companyEntries.forEach((group) => {
            const companyName = normalizeCompanyName(group.name || 'Unknown Company');
            let companyId = companyNameToId(companyName);

            // Check if this company is already in the graph (by ID or normalized name)
            const existingCompany = newNodes.find(
              n =>
                n.id === companyId ||
                (n.type === 'spanish-company-group' &&
                  normalizeCompanyName(n.name).toUpperCase() === companyName.toUpperCase())
            );
            if (existingCompany) {
              companyId = existingCompany.id;
            }
            if (!existingCompany) {
              const companyPosition = clusterPosition({
                hub: expandOfficerCluster.hub,
                index: newIdx,
                total: newCompanyCount,
                existingNodes: newNodes,
                clusterSpacing: 65,
                minDistance: 55,
              });
              newIdx++;

              newNodes.push({
                id: companyId,
                name: companyName,
                type: 'spanish-company-group',
                companySummary: {
                  entries: group.entries,
                  totalEntries: group.entries.length,
                  dateRange: {
                    earliest: group.entries[0]?.indexed_date || group.entries[0]?.date,
                    latest:
                      group.entries[group.entries.length - 1]?.indexed_date ||
                      group.entries[group.entries.length - 1]?.date,
                  },
                },
                expanded: false,
                ...companyPosition,
                fx: companyPosition.x,
                fy: companyPosition.y,
              });
            }

            // One link per (officer, company, position). See addOfficerToGraph.
            const prevNames = group.previousNames || [];
            const fromPrevName = prevNames.length > 0 ? prevNames[0] : null;
            const liveOfficerNode =
              newNodes.find(n => n.id === officerNode.id) || officerNode;
            if (!liveOfficerNode.positions) liveOfficerNode.positions = [];
            group.positionGroups.forEach((posGroup, posKey) => {
              const category = resolveEffectiveCategoryForEntries(posGroup.entries);
              const linkIdSuffix = posKey.replace(/[^a-z0-9]/g, '') || 'unknownpos';
              const linkId = `${officerNode.id}-${companyId}-${linkIdSuffix}`;
              if (newLinks.find(l => l.id === linkId)) return;
              const latestEntry = posGroup.entries
                .slice()
                .sort((a, b) => entryTimestamp(b) - entryTimestamp(a))[0];
              if (!liveOfficerNode.positions.some(
                p => p.company === companyName && p.position === posGroup.role
              )) {
                liveOfficerNode.positions.push({
                  company: companyName,
                  position: posGroup.role,
                  category,
                });
              }
              newLinks.push({
                id: linkId,
                source: officerNode.id,
                target: companyId,
                type: 'officer-company',
                relationship: posGroup.role,
                category,
                date: latestEntry?.date || latestEntry?.event_date || latestEntry?.indexed_date || null,
                ...(fromPrevName && { fromPreviousName: fromPrevName }),
              });
            });
          });

          return { nodes: newNodes, links: dedupeGraphLinks(newLinks) };
        });

        if (showShareholders) {
          companyEntries.forEach(group => {
            const cn = normalizeCompanyName(group.name || 'Unknown Company');
            const cId = companyNameToId(cn);
            addShareholdersForCompany(cn, cId);
            addOwnedCompaniesForEntity(cn, cId, 'company');
          });
        }
        // Fire-and-forget: enrich links with real appointment/cessation dates
        // from borme_events_v3 so tooltips/side panel show per-role history.
        const enrichNames = companyEntries
          .map(g => normalizeCompanyName(g.name || ''))
          .filter(Boolean);
        if (enrichNames.length) enrichLinksWithEventDates(enrichNames);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error expanding officer node:', err);
      return false;
    }
  }, [viewportCenter, showShareholders, addShareholdersForCompany, addOwnedCompaniesForEntity, enrichLinksWithEventDates]);

  // Expand company node to show its officers
  const expandCompanyNode = useCallback(
    async companyNode => {
      try {
        const companyName = companyNode.name.trim();
        // Use borme_companies_v3 for clean, pre-aggregated officers with
        // explicit active/resigned status. Resolve a stable group_key first
        // (preferring one already on the node) so an ambiguous name binds to the
        // correct entity rather than a fuzzy-name match.
        const groupKey = await spanishCompaniesService.resolveCompanyGroupKey(
          companyName,
          companyNode.groupKey || null
        );
        const v3 = await spanishCompaniesService.getCompanyProfileV3(companyName, { groupKey });
        if (v3.company) {
          const baseEntries = await v3DocsToCappedEntries([v3.company], officersPerCompany);
          const { entries, aliasMap } = await fetchWithNameChangeRelations(baseEntries, { cap: officersPerCompany });
          await addCompanyWithOfficersToGraph(entries, companyNode, aliasMap);
          // Stamp isDissolved on the company node so enrichLinksWithEventDates can
          // mark its officer links as companyDissolved (mirrors handleSearch path).
          if (v3.company.is_dissolved) {
            const nodeId = companyNode.id;
            setGraphData(prev => ({
              ...prev,
              nodes: prev.nodes.map(n =>
                n.id === nodeId && !n.isDissolved ? { ...n, isDissolved: true } : n
              ),
            }));
          }
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error expanding company node:', err);
        return false;
      }
    },
    [addCompanyWithOfficersToGraph, fetchWithNameChangeRelations, officersPerCompany]
  );

  // Expand a node (called on double-click)
  const expandNode = useCallback(
    async node => {
      if (node.expanded) return;

      setIsLoading(true);
      try {
        node.expanded = true;
        let found = false;

        if (node.type === 'officer') {
          found = await expandOfficerNode(node);
        } else if (node.type === 'company' || node.type === 'spanish-company-group') {
          found = await expandCompanyNode(node);
        }

        if (!found) {
          setError(text.noAdditionalResults(node.name));
        }
        // Note: node.expanded = true was set above via direct mutation.
        // Do NOT call setGraphData here to re-create node objects — that breaks
        // ForceGraph2D's internal references (x, y, fx, fy get lost), causing
        // the node to detach from its edges on drag.
      } catch (err) {
        console.error('Error expanding node:', err);
        setError(text.expandError(err.message));
      } finally {
        setIsLoading(false);
      }
    },
    [expandOfficerNode, expandCompanyNode, text]
  );

  // handleNodeClick is defined after handleNodeRightClick (below) for mobile touch support
  const DOUBLE_CLICK_MS = 450;
  const EMBEDDED_DOUBLE_CLICK_MS = 750;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const singleTapTimerRef = useRef(null);

  const contextNode = React.useMemo(() => {
    if (!activeNodeId) return null;
    return graphData.nodes.find(n => isSameNodeId(n.id, activeNodeId)) || null;
  }, [activeNodeId, graphData.nodes]);

  const nodeNoteTarget = React.useMemo(() => {
    if (!nodeNoteTargetId) return null;
    return graphData.nodes.find(n => isSameNodeId(n.id, nodeNoteTargetId)) || null;
  }, [nodeNoteTargetId, graphData.nodes]);

  const nodeNotePreview = React.useMemo(() => {
    if (!nodeNotePreviewId) return null;
    const node = graphData.nodes.find(n => isSameNodeId(n.id, nodeNotePreviewId)) || null;
    return hasNodeNote(node) ? node : null;
  }, [nodeNotePreviewId, graphData.nodes]);

  // Drives the persistent toolbar toggle (like "Simplify"): the company node that
  // either is currently unified (cargos merged onto it) OR has a detected cargo
  // presence (cargoCount > 0) waiting to be unified. A unified node takes
  // precedence. `.unified` on the returned node tells the toggle which way it sits,
  // so one control both unifies and undoes — re-toggleable, never disappears.
  const cargoToggleNode = React.useMemo(
    () =>
      graphData.nodes.find(n => n.unified) ||
      graphData.nodes.find(n => n.type !== 'officer' && n.cargoCount > 0) ||
      null,
    [graphData.nodes]
  );

  const mergeCandidateNodes = React.useMemo(() => {
    if (!contextNode) return [];
    return graphData.nodes
      .filter(node => !isSameNodeId(node.id, contextNode.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [contextNode, graphData.nodes]);

  const mergeCandidateOptions = React.useMemo(() => {
    if (!contextNode) return [];
    return mergeCandidateNodes
      .map(node => {
        const score = mergeNameSimilarityScore(contextNode.name, node.name);
        const group = score >= 0.55 ? 'Nombres similares' : 'Otros nodos';
        return { node, score, group };
      })
      .sort((a, b) => b.score - a.score || (a.node.name || '').localeCompare(b.node.name || ''));
  }, [contextNode, mergeCandidateNodes]);

  const exactTypedMergeOption = React.useMemo(() => {
    const typed = normalizeNameForMerge(mergeSearchText);
    if (!typed) return null;
    return (
      mergeCandidateOptions.find(option => normalizeNameForMerge(option.node.name) === typed) ||
      null
    );
  }, [mergeSearchText, mergeCandidateOptions]);

  useEffect(() => {
    if (!isMergeNodeDialogOpen) return;
    if (!exactTypedMergeOption) return;
    if (
      mergeTargetOption &&
      isSameNodeId(mergeTargetOption.node.id, exactTypedMergeOption.node.id)
    ) {
      return;
    }
    setMergeTargetOption(exactTypedMergeOption);
  }, [isMergeNodeDialogOpen, exactTypedMergeOption, mergeTargetOption]);

  const hiddenNodesList = React.useMemo(() => {
    if (hiddenNodeIds.size === 0) return [];
    return graphData.nodes
      .filter(node => hiddenNodeIds.has(normalizeNodeId(node.id)))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [graphData.nodes, hiddenNodeIds]);

  const closeNodeContextMenu = useCallback(() => {
    setNodeContextMenu(null);
  }, []);

  const openHiddenNodesMenu = useCallback(event => {
    setHiddenNodesMenuAnchorEl(event.currentTarget);
  }, []);

  const closeHiddenNodesMenu = useCallback(() => {
    setHiddenNodesMenuAnchorEl(null);
  }, []);

  const unhideNode = useCallback(nodeId => {
    const nodeKey = normalizeNodeId(nodeId);
    setHiddenNodeIds(prev => {
      const next = new Set();
      prev.forEach(id => {
        if (!isSameNodeId(id, nodeKey)) next.add(id);
      });
      return next;
    });
  }, []);

  const unhideAllNodes = useCallback(() => {
    setHiddenNodeIds(new Set());
    closeHiddenNodesMenu();
  }, [closeHiddenNodesMenu]);

  const hideNode = useCallback(
    (nodeId, options = {}) => {
      const { withConnected = false } = options;
      const nodeKey = normalizeNodeId(nodeId);
      const idsToHide = new Set([nodeKey]);

      if (withConnected) {
        graphData.links.forEach(link => {
          const sourceId = normalizeNodeId(getNodeIdFromRef(link.source));
          const targetId = normalizeNodeId(getNodeIdFromRef(link.target));
          if (sourceId === nodeKey && targetId) idsToHide.add(targetId);
          if (targetId === nodeKey && sourceId) idsToHide.add(sourceId);
        });
      }

      setHiddenNodeIds(prev => {
        const next = new Set(prev);
        idsToHide.forEach(id => next.add(id));
        return next;
      });
    },
    [graphData.links]
  );

  const deleteNode = useCallback(
    nodeId => {
      const nodeKey = normalizeNodeId(nodeId);
      setGraphData(prev => {
        const nextNodes = prev.nodes.filter(node => !isSameNodeId(node.id, nodeKey));
        const nextLinks = prev.links.filter(link => {
          const sourceId = normalizeNodeId(getNodeIdFromRef(link.source));
          const targetId = normalizeNodeId(getNodeIdFromRef(link.target));
          return sourceId !== nodeKey && targetId !== nodeKey;
        });
        return { nodes: nextNodes, links: nextLinks };
      });
      setPinnedNodeIds(prev => {
        const next = new Set();
        prev.forEach(id => {
          if (!isSameNodeId(id, nodeKey)) next.add(id);
        });
        return next;
      });
      setHiddenNodeIds(prev => {
        const next = new Set();
        prev.forEach(id => {
          if (!isSameNodeId(id, nodeKey)) next.add(id);
        });
        return next;
      });
      if (isSameNodeId(activeNodeId, nodeKey)) {
        setActiveNodeId(null);
      }
      closeHiddenNodesMenu();
    },
    [activeNodeId, closeHiddenNodesMenu]
  );

  const mergeNodes = useCallback(
    (sourceNodeId, targetNodeId, snapshot = null) => {
      setGraphData(prev => {
        const sourceNode = prev.nodes.find(node => isSameNodeId(node.id, sourceNodeId));
        const targetNode = prev.nodes.find(node => isSameNodeId(node.id, targetNodeId));
        if (!sourceNode || !targetNode) return prev;
        if (getNodeGroupType(sourceNode) !== getNodeGroupType(targetNode)) return prev;

        // Preserve all name variants so preview/DD can query every spelling
        const targetVariants = targetNode.nameVariants || [];
        const sourceVariants = sourceNode.nameVariants || [];
        const allVariants = uniqStrings([
          ...targetVariants,
          ...sourceVariants,
          // If the source had a different name, keep it as a variant
          ...(sourceNode.name && sourceNode.name !== targetNode.name ? [sourceNode.name] : []),
        ]);

        const mergedTargetNode = {
          ...targetNode,
          companies: uniqStrings([
            ...(targetNode.companies || []),
            ...(sourceNode.companies || []),
          ]),
          nameVariants: allVariants,
          subtype: targetNode.subtype || sourceNode.subtype,
          expanded: !!(targetNode.expanded || sourceNode.expanded),
          data: targetNode.data || sourceNode.data,
          companySummary: mergeCompanySummary(targetNode.companySummary, sourceNode.companySummary),
          userNote: mergeNodeNotes(targetNode.userNote, sourceNode.userNote),
          // Provenance: this identity grouping was decided by the user, not by
          // BORME data. Surfaced as a badge in the data preview + a canvas ring.
          userMerged: true,
          // Pre-merge snapshots (LIFO) so the merge stays reversible at any time
          // via the "Deshacer fusión" action, not only through the transient toast.
          mergeHistory: [
            ...(targetNode.mergeHistory || []),
            ...(snapshot ? [snapshot] : []),
          ],
        };

        if (targetNode.positions || sourceNode.positions) {
          const positionMap = new Map();
          [...(targetNode.positions || []), ...(sourceNode.positions || [])].forEach(position => {
            const key = `${position.company || ''}|${position.position || ''}|${position.category || ''}`;
            if (!positionMap.has(key)) positionMap.set(key, position);
          });
          mergedTargetNode.positions = Array.from(positionMap.values());
        }

        const nextNodes = prev.nodes
          .filter(node => !isSameNodeId(node.id, sourceNodeId))
          .map(node => (isSameNodeId(node.id, targetNodeId) ? mergedTargetNode : node));

        const linkMap = new Map();
        prev.links.forEach(link => {
          const sourceId = normalizeNodeId(getNodeIdFromRef(link.source));
          const targetId = normalizeNodeId(getNodeIdFromRef(link.target));
          const rewiredSource = isSameNodeId(sourceId, sourceNodeId)
            ? normalizeNodeId(targetNodeId)
            : sourceId;
          const rewiredTarget = isSameNodeId(targetId, sourceNodeId)
            ? normalizeNodeId(targetNodeId)
            : targetId;
          if (isSameNodeId(rewiredSource, rewiredTarget)) return;

          const dedupeKey = `${rewiredSource}|${rewiredTarget}|${link.relationship || ''}|${
            link.category || ''
          }|${link.type || ''}`;
          if (linkMap.has(dedupeKey)) return;
          linkMap.set(dedupeKey, {
            ...link,
            source: rewiredSource,
            target: rewiredTarget,
            id: link.id || dedupeKey,
          });
        });

        return { nodes: nextNodes, links: dedupeGraphLinks(Array.from(linkMap.values())) };
      });

      setPinnedNodeIds(prev => {
        const next = new Set(prev);
        if (next.has(sourceNodeId) || next.has(normalizeNodeId(sourceNodeId))) {
          next.add(normalizeNodeId(targetNodeId));
        }
        next.delete(sourceNodeId);
        next.delete(normalizeNodeId(sourceNodeId));
        return next;
      });
      setHiddenNodeIds(prev => {
        const next = new Set(prev);
        next.delete(sourceNodeId);
        next.delete(normalizeNodeId(sourceNodeId));
        return next;
      });
      if (isSameNodeId(activeNodeId, sourceNodeId)) {
        setActiveNodeId(normalizeNodeId(targetNodeId));
      }
    },
    [activeNodeId]
  );

  // ── Corrections overlay (Custom DD) ──────────────────────────────────────
  // The subject company of any persisted correction is the primary subject (the
  // first company loaded — sticky across graph exploration). Officer edits attach
  // to its group_key; if no company has been loaded yet (e.g. an officer-only
  // search), edits stay graph-only and nothing is persisted.
  const subjectCompanyName = primarySubject;

  // Company nodes currently in the graph, as { name, groupKey } for the
  // apoderados sidebar switcher. De-duplicated by uppercased name.
  const apoderadosCompanies = React.useMemo(() => {
    const seen = new Set();
    const out = [];
    (graphData.nodes || []).forEach(n => {
      if (n.type !== 'spanish-company-group' || !n.name) return;
      const key = n.name.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ name: n.name, groupKey: n.groupKey || null });
    });
    return out;
  }, [graphData.nodes]);

  // Resolve the focused company as { name, groupKey }. Uses primarySubject (a
  // STRING company name; may be null) to find its node's group_key; falls back
  // to the FIRST company node in the graph. Returns null if the graph has no
  // company nodes.
  const resolveFocusedCompany = useCallback(() => {
    const companyNodes = (graphData.nodes || []).filter(
      n => n.type === 'spanish-company-group' && n.name
    );
    if (companyNodes.length === 0) return null;
    if (primarySubject) {
      const match = companyNodes.find(
        n => n.name.toUpperCase() === primarySubject.toUpperCase()
      );
      if (match) return { name: match.name, groupKey: match.groupKey || null };
    }
    const first = companyNodes[0];
    return { name: first.name, groupKey: first.groupKey || null };
  }, [graphData.nodes, primarySubject]);

  // The company the user most recently focused — set on autocomplete selection,
  // initial/deep-link load, and company-node click. Non-sticky (unlike the DD
  // subject primarySubject), so the market sidebar follows the current company
  // and closes for non-IBEX ones. Cleared on graph reset.
  const [selectedSidebarCompany, setSelectedSidebarCompany] = useState(null);
  const [ibexSidebarDismissed, setIbexSidebarDismissed] = useState(false);

  // The focused company's IBEX 35 SEED entry, or null. Cheap map lookup against
  // the ~35-entry SEED, recomputed whenever the focused company changes.
  const focusedIbexSeed = selectedSidebarCompany ? matchIbexSeed(selectedSidebarCompany) : null;

  // Re-arm the sidebar whenever the focused company changes: a manual dismiss
  // only hides it for the current company, not for the next IBEX one selected.
  useEffect(() => {
    setIbexSidebarDismissed(false);
  }, [selectedSidebarCompany]);

  // Android-only: NIF -> apiRow|null cache for every IBEX 35 company node
  // currently loaded in the graph, populated by the background prefetch
  // effect below. Lets the node context menu decide, per right-clicked
  // node, whether "Datos de mercado" has real data to show, without
  // blocking the menu on an async check. No-op (and no extra network
  // calls) on web.
  const [androidIbexDataCache, setAndroidIbexDataCache] = useState({});
  const androidIbexCheckedRef = useRef(new Set());
  const [ibexMarketDialog, setIbexMarketDialog] = useState({
    open: false,
    seedEntry: null,
    apiRow: null,
  });

  useEffect(() => {
    if (snapshotMode) return undefined;
    if (!isAndroidNativeApp()) return undefined;
    const matches = matchAllIbexNodes(graphData.nodes);
    const toFetch = matches.filter(m => !androidIbexCheckedRef.current.has(m.nif));
    if (toFetch.length === 0) return undefined;
    toFetch.forEach(m => androidIbexCheckedRef.current.add(m.nif));
    let cancelled = false;
    // NIFs whose fetch settled (resolved or rejected) during this effect run.
    // Only fetches that never settle before cleanup are "cancelled mid-flight"
    // and need their "checked" mark undone below — settled ones are done and
    // cached, so they must stay marked to avoid needless refetching on every
    // later graphData.nodes change (cleanup runs on every dependency change,
    // not just unmount).
    const settled = new Set();
    toFetch.forEach(seedEntry => {
      getIbexCompanyData(seedEntry.nif)
        .then(apiRow => {
          settled.add(seedEntry.nif);
          if (!cancelled) {
            setAndroidIbexDataCache(prev => ({ ...prev, [seedEntry.nif]: apiRow }));
          }
        })
        .catch(err => {
          console.warn('[Android IBEX prefetch] failed to fetch market data:', err.message);
          settled.add(seedEntry.nif);
        });
    });
    return () => {
      cancelled = true;
      // A fetch cancelled mid-flight (e.g. graphData.nodes changed again
      // before it resolved) never gets to write into the cache above — undo
      // its "checked" mark so a later effect run retries it, instead of
      // silently and permanently losing that company's market data. Fetches
      // that already settled keep their mark so they aren't retried for no
      // reason.
      toFetch.forEach(m => {
        if (!settled.has(m.nif)) androidIbexCheckedRef.current.delete(m.nif);
      });
    };
  }, [graphData.nodes, snapshotMode]);

  // Resolve (and cache) the subject company's group_key on demand. Graph nodes
  // are name-keyed, not group_key-keyed, so we resolve via directory autocomplete.
  const resolveSubjectGroupKey = useCallback(async name => {
    if (!name) return null;
    const cache = subjectGroupKeyCache.current;
    if (cache.has(name)) return cache.get(name);
    const gk = await resolveGroupKey(name);
    cache.set(name, gk);
    return gk;
  }, []);

  // Persist one officer correction scoped to the subject company, then surface
  // an undo toast. No-ops (silently) when there is no subject company.
  const recordCorrection = useCallback(
    async ({ action, nameA, nameB, resignedDate, undoGraph, label }) => {
      if (!subjectCompanyName || !nameA) return;
      try {
        const groupKey = await resolveSubjectGroupKey(subjectCompanyName);
        if (!groupKey) {
          setError(text.correctionSubjectError);
          return;
        }
        const { id } = await postCorrection({ groupKey, action, nameA, nameB, resignedDate });
        setCorrectionsCount(c => c + 1);
        setCorrectionsSnackbar({ id, message: label || text.correctionSaved, undoGraph: undoGraph || null });
      } catch (e) {
        setError(text.correctionSaveError(e.message));
      }
    },
    [subjectCompanyName, resolveSubjectGroupKey, text]
  );

  // Registry-faithful by default: do NOT auto-load/show the per-browser
  // corrections overlay when a company loads. The old behavior silently
  // restored prior edits (scoped to this browser's client_id) and surfaced the
  // "My corrections (N)" chip — misleading, because those corrections are not
  // applied to the rendered (registry-faithful) graph. We only reset the
  // counter when the loaded company changes; corrections made in THIS session
  // still increment it (see recordCorrection) and surface the chip + panel.
  // An explicit "view saved corrections" / amended view is the dd_two_modes
  // follow-on, not a silent default.
  useEffect(() => {
    setCorrectionsCount(0);
  }, [subjectCompanyName]);

  // Undo from the toast: delete the persisted correction (when one exists) and
  // revert the graph for reversible actions (hide, merge via pre-merge
  // snapshot). Mark-resigned only removes the overlay row.
  const undoCorrectionFromSnackbar = useCallback(async () => {
    const snack = correctionsSnackbar;
    setCorrectionsSnackbar(null);
    if (!snack) return;
    try {
      if (snack.id) {
        await deleteCorrection(snack.id);
        setCorrectionsCount(c => Math.max(0, c - 1));
      }
      if (typeof snack.undoGraph === 'function') snack.undoGraph();
    } catch (e) {
      setError(text.correctionUndoError(e.message));
    }
  }, [correctionsSnackbar, text]);

  // "Mis correcciones" panel: load the current list when opened.
  const openMyCorrections = useCallback(
    async event => {
      const anchor = event.currentTarget;
      setMyCorrectionsAnchor(anchor);
      if (!subjectCompanyName) {
        setMyCorrectionsList([]);
        return;
      }
      setMyCorrectionsLoading(true);
      try {
        const gk = await resolveSubjectGroupKey(subjectCompanyName);
        const list = gk ? await listCorrections(gk) : [];
        setMyCorrectionsList(list);
        setCorrectionsCount(list.length);
      } catch (e) {
        setError(text.correctionsLoadError(e.message));
        setMyCorrectionsList([]);
      } finally {
        setMyCorrectionsLoading(false);
      }
    },
    [subjectCompanyName, resolveSubjectGroupKey, text]
  );

  const closeMyCorrections = useCallback(() => setMyCorrectionsAnchor(null), []);

  const removeCorrectionFromPanel = useCallback(async correctionId => {
    try {
      await deleteCorrection(correctionId);
      setMyCorrectionsList(prev => prev.filter(c => c.id !== correctionId));
      setCorrectionsCount(c => Math.max(0, c - 1));
    } catch (e) {
      setError(text.correctionDeleteError(e.message));
    }
  }, [text]);

  // Right-click on node to open actions menu (desktop), also called by single tap on touch devices.
  // Table rows can pass a status category so the menu reflects the clicked row,
  // not just the node's aggregate status across all loaded relationships.
  const handleNodeRightClick = useCallback(
    (node, event, options = {}) => {
      event.preventDefault();
      closeHiddenNodesMenu();
      const nodeId = normalizeNodeId(node.id);

      let menuX = event.clientX + 10;
      let menuY = event.clientY + 6;
      if (fgRef.current && Number.isFinite(node.x) && Number.isFinite(node.y)) {
        const localPoint = fgRef.current.graph2ScreenCoords(node.x, node.y);
        if (Number.isFinite(localPoint?.x) && Number.isFinite(localPoint?.y)) {
          let anchorX = localPoint.x;
          let anchorY = localPoint.y;

          if (containerEl) {
            const rect = containerEl.getBoundingClientRect();
            const looksLocalToContainer =
              localPoint.x >= -2 &&
              localPoint.x <= rect.width + 2 &&
              localPoint.y >= -2 &&
              localPoint.y <= rect.height + 2;
            if (looksLocalToContainer) {
              anchorX = rect.left + localPoint.x;
              anchorY = rect.top + localPoint.y;
            }
          }

          const distanceFromClick = Math.hypot(anchorX - event.clientX, anchorY - event.clientY);
          if (Number.isFinite(distanceFromClick) && distanceFromClick < 140) {
            menuX = anchorX + 12;
            menuY = anchorY + 4;
          }
        }
      }

      const MENU_ESTIMATED_WIDTH = 340;
      const MENU_ESTIMATED_HEIGHT = 540;
      const VIEWPORT_MARGIN = 10;
      menuX = Math.min(
        Math.max(menuX, VIEWPORT_MARGIN),
        window.innerWidth - MENU_ESTIMATED_WIDTH - VIEWPORT_MARGIN
      );
      menuY = Math.min(
        Math.max(menuY, VIEWPORT_MARGIN),
        window.innerHeight - MENU_ESTIMATED_HEIGHT - VIEWPORT_MARGIN
      );

      setActiveNodeId(nodeId);
      setNodeContextMenu({
        mouseX: menuX,
        mouseY: menuY,
        nodeId,
        statusCategory: options.statusCategory || null,
      });
    },
    [closeHiddenNodesMenu, containerEl]
  );

  const toggleInvestigationNode = useCallback((rawId) => {
    const id = normalizeNodeId(rawId);
    setInvestigationSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const isNodeNoteMarkerClick = useCallback((node, event) => {
    if (!hasNodeNote(node) || !event || !fgRef.current) return false;

    const marker = getNodeNoteMarkerGeometry(node, nodeSize);
    const markerPoint = fgRef.current.graph2ScreenCoords(marker.x, marker.y);
    const markerEdgePoint = fgRef.current.graph2ScreenCoords(marker.x + marker.radius, marker.y);
    if (!Number.isFinite(markerPoint?.x) || !Number.isFinite(markerPoint?.y)) return false;

    let clickX = Number(event.offsetX);
    let clickY = Number(event.offsetY);
    if ((!Number.isFinite(clickX) || !Number.isFinite(clickY)) && containerEl) {
      const rect = containerEl.getBoundingClientRect();
      clickX = Number(event.clientX) - rect.left;
      clickY = Number(event.clientY) - rect.top;
    }
    if (!Number.isFinite(clickX) || !Number.isFinite(clickY)) return false;

    const renderedRadius = Number.isFinite(markerEdgePoint?.x)
      ? Math.abs(markerEdgePoint.x - markerPoint.x)
      : marker.radius;
    const hitRadius = Math.max(8, renderedRadius + 3);
    return Math.hypot(clickX - markerPoint.x, clickY - markerPoint.y) <= hitRadius;
  }, [containerEl, nodeSize]);

  // Click/tap handler — desktop: double-click expands; mobile: single tap opens context menu, double tap expands
  const handleNodeClick = useCallback(
    (node, event) => {
      const now = Date.now();
      const last = lastClickRef.current;
      const nodeId = normalizeNodeId(node.id);

      if (isNodeNoteMarkerClick(node, event)) {
        event.preventDefault?.();
        lastClickRef.current = { nodeId: null, time: 0 };
        setActiveNodeId(nodeId);
        setNodeNotePreviewId(nodeId);
        return;
      }

      // Selecting a company node focuses the market sidebar on it (opens for an
      // IBEX company, closes for a non-IBEX one). Officer/person clicks leave
      // the current focus untouched.
      if (node.type === 'spanish-company-group' && node.name) {
        setSelectedSidebarCompany(node.name);
      }

      if (event && (event.shiftKey || event.metaKey || event.ctrlKey)) {
        event.preventDefault?.();
        toggleInvestigationNode(nodeId);
        return;
      }

      const threshold = embedded && !isFullscreen ? EMBEDDED_DOUBLE_CLICK_MS : DOUBLE_CLICK_MS;
      const browserDoubleClick = Number(event?.detail) >= 2;

      // On touch devices: first tap selects node, second tap on same node opens context menu
      if (isTouchDevice) {
        if (isSameNodeId(last.nodeId, nodeId) && now - last.time < 600) {
          // Second tap on same node — open context menu
          lastClickRef.current = { nodeId: null, time: 0 };
          const syntheticEvent = {
            clientX: event?.clientX ?? 0,
            clientY: event?.clientY ?? 0,
            preventDefault: () => {},
          };
          handleNodeRightClick(node, syntheticEvent);
        } else {
          // First tap — just select/highlight the node
          lastClickRef.current = { nodeId, time: now };
          setActiveNodeId(nodeId);
        }
        return;
      }

      if (
        browserDoubleClick ||
        (isSameNodeId(last.nodeId, nodeId) && now - last.time < threshold)
      ) {
        lastClickRef.current = { nodeId: null, time: 0 };
        expandNode(node);
      } else {
        lastClickRef.current = { nodeId, time: now };
      }
    },
    [expandNode, embedded, isFullscreen, handleNodeRightClick, toggleInvestigationNode, isNodeNoteMarkerClick]
  );

  const openEditNodeDialog = useCallback(() => {
    if (!contextNode) return;
    setEditNodeName(contextNode.name || '');
    setEditNodeSubtype(contextNode.subtype || 'individual');
    setIsEditNodeDialogOpen(true);
    closeNodeContextMenu();
  }, [contextNode, closeNodeContextMenu]);

  const openNodeNoteDialog = useCallback(() => {
    if (!contextNode) return;
    setNodeNoteTargetId(normalizeNodeId(contextNode.id));
    setNodeNoteText(contextNode.userNote?.text || '');
    setNodeNoteFlag(
      Object.prototype.hasOwnProperty.call(NODE_NOTE_FLAGS, contextNode.userNote?.flag)
        ? contextNode.userNote.flag
        : 'none'
    );
    setIsNodeNoteDialogOpen(true);
    closeNodeContextMenu();
  }, [contextNode, closeNodeContextMenu]);

  const closeNodeNoteDialog = useCallback(() => {
    setIsNodeNoteDialogOpen(false);
    setNodeNotePreviewId(null);
    setNodeNoteTargetId(null);
    setNodeNoteText('');
    setNodeNoteFlag('none');
  }, []);

  const saveContextNodeNote = useCallback(() => {
    if (!nodeNoteTargetId || !nodeNoteText.trim()) return;
    setGraphData(prev => setNodeNote(prev, nodeNoteTargetId, {
      text: nodeNoteText,
      flag: nodeNoteFlag,
    }));
    closeNodeNoteDialog();
    setSnapshotNotice(text.noteSaved);
  }, [nodeNoteTargetId, nodeNoteText, nodeNoteFlag, closeNodeNoteDialog, text]);

  const removeContextNodeNote = useCallback(() => {
    const targetId = nodeNoteTargetId || contextNode?.id;
    if (!targetId) return;
    setGraphData(prev => removeNodeNote(prev, targetId));
    closeNodeNoteDialog();
    closeNodeContextMenu();
    setSnapshotNotice(text.noteRemoved);
  }, [nodeNoteTargetId, contextNode, closeNodeNoteDialog, closeNodeContextMenu, text]);

  const openMergeNodeDialog = useCallback(() => {
    if (!contextNode) return;
    setMergeTargetOption(null);
    setMergeSearchText('');
    setIsMergeNodeDialogOpen(true);
    closeNodeContextMenu();
  }, [contextNode, closeNodeContextMenu]);

  const openDeleteNodeDialog = useCallback(() => {
    if (!contextNode) return;
    setIsDeleteNodeDialogOpen(true);
    closeNodeContextMenu();
  }, [contextNode, closeNodeContextMenu]);

  const confirmDeleteNode = useCallback(() => {
    if (!contextNode) return;
    deleteNode(contextNode.id);
    setIsDeleteNodeDialogOpen(false);
  }, [contextNode, deleteNode]);

  const hideNodeFromMenu = useCallback(() => {
    if (!contextNode) return;
    const node = contextNode;
    hideNode(node.id, { withConnected: false });
    closeNodeContextMenu();
    if (node.type === 'officer' && node.name) {
      recordCorrection({
        action: 'hide',
        nameA: node.name,
        label: text.hiddenOfficerCorrection(node.name),
        undoGraph: () => unhideNode(node.id),
      });
    }
  }, [contextNode, hideNode, closeNodeContextMenu, recordCorrection, unhideNode, text]);

  const hideNodeWithRelationsFromMenu = useCallback(() => {
    if (!contextNode) return;
    const node = contextNode;
    hideNode(node.id, { withConnected: true });
    closeNodeContextMenu();
    // Only the officer itself is a DD correction; connected nodes stay graph-only.
    if (node.type === 'officer' && node.name) {
      recordCorrection({
        action: 'hide',
        nameA: node.name,
        label: text.hiddenOfficerCorrection(node.name),
        undoGraph: () => unhideNode(node.id),
      });
    }
  }, [contextNode, hideNode, closeNodeContextMenu, recordCorrection, unhideNode, text]);

  // Mark an officer as resigned (DD overlay only — moves the officer from the
  // active to the resigned set in the Custom report). Opens a small dialog so
  // the user can optionally supply the resignation date.
  const openMarkResignedDialog = useCallback(() => {
    if (!contextNode || contextNode.type !== 'officer') return;
    setMarkResignedNode(contextNode);
    setMarkResignedDate('');
    closeNodeContextMenu();
  }, [contextNode, closeNodeContextMenu]);

  // Optimistically recolor an officer's edges to reflect a status correction so
  // the change is visible immediately (green = active/nombramiento, red =
  // ceased/cese). Edge colour is derived from link.category, so we retag the
  // officer's officer-company links. Returns an undo that restores the prior
  // categories. Client-side only — registry data is never mutated.
  const applyOfficerStatusToGraph = useCallback((officerNodeId, status) => {
    const newCat = status === 'ceased' ? 'Ceses/Dimisiones' : 'Nombramientos';
    const id = normalizeNodeId(officerNodeId);
    const snapshot = [];
    setGraphData(prev => ({
      ...prev,
      links: prev.links.map(l => {
        if (l.type && l.type !== 'officer-company') return l;
        const sid = normalizeNodeId(getNodeIdFromRef(l.source));
        const tid = normalizeNodeId(getNodeIdFromRef(l.target));
        if (sid !== id && tid !== id) return l;
        snapshot.push({ id: l.id, category: l.category, relationship: l.relationship });
        return { ...l, category: newCat, relationship: newCat, userAmended: true };
      }),
    }));
    return () =>
      setGraphData(prev => ({
        ...prev,
        links: prev.links.map(l => {
          const s = snapshot.find(x => x.id === l.id);
          return s
            ? { ...l, category: s.category, relationship: s.relationship, userAmended: false }
            : l;
        }),
      }));
  }, []);

  const confirmMarkResigned = useCallback(() => {
    const node = markResignedNode;
    setMarkResignedNode(null);
    if (!node || !node.name) return;
    const undoGraph = applyOfficerStatusToGraph(node.id, 'ceased');
    recordCorrection({
      action: 'mark_resigned',
      nameA: node.name,
      resignedDate: markResignedDate || undefined,
      label: text.resignedOfficerCorrection(node.name),
      undoGraph,
    });
  }, [markResignedNode, markResignedDate, recordCorrection, applyOfficerStatusToGraph, text]);

  const buildSnapshotPreview = useCallback(node => {
    if (!node) return null;
    const nodeId = normalizeNodeId(node.id);
    const nodesById = new Map(
      graphData.nodes.map(item => [normalizeNodeId(item.id), item])
    );
    const connectedLinks = graphData.links.filter(link => {
      const sourceId = normalizeNodeId(getNodeIdFromRef(link.source));
      const targetId = normalizeNodeId(getNodeIdFromRef(link.target));
      return sourceId === nodeId || targetId === nodeId;
    });

    if (node.type === 'officer') {
      const officers = [];
      const whollyOwned = [];
      const seen = new Set();
      connectedLinks.forEach(link => {
        const sourceId = normalizeNodeId(getNodeIdFromRef(link.source));
        const targetId = normalizeNodeId(getNodeIdFromRef(link.target));
        const otherNode = nodesById.get(sourceId === nodeId ? targetId : sourceId);
        if (!otherNode) return;
        if (link.type === 'ownership' && sourceId === nodeId) {
          whollyOwned.push({
            company_name: otherNode.name,
            shareholder_type: node.subtype === 'company' ? 'company' : 'individual',
            category: link.category,
            date: link.date || null,
          });
          return;
        }
        if (link.type && link.type !== 'officer-company') return;
        const events = Array.isArray(link.events) && link.events.length > 0
          ? link.events
          : [{
              position: link.relationship || node.position,
              category: link.category,
              date: link.date,
            }];
        events.forEach(event => {
          const position = event.position || event.relationship || link.relationship || node.position || '';
          const category = event.category || link.category || '';
          const date = event.date || link.date || null;
          const key = `${otherNode.name}|${position}|${category}|${date || ''}`;
          if (seen.has(key)) return;
          seen.add(key);
          officers.push({
            officer_name: node.name,
            company_name: otherNode.name,
            specific_role: position,
            event_type: category,
            status: isActiveCategory(category) ? 'active' : 'ceased',
            date,
          });
        });
      });
      return {
        type: 'officer',
        name: node.name,
        officers,
        whollyOwned,
        total: officers.length,
        nameVariants: node.nameVariants,
        snapshotLocal: true,
      };
    }

    const entries = node.companySummary?.entries || [];
    let parsed = null;
    if (entries.length > 0) {
      try {
        parsed = parseSpanishCompanyData(entries[0]);
      } catch (err) {
        console.warn('[Snapshot Preview] Could not parse stored company entry:', err.message);
      }
    }
    const officers = {
      nombramientos: [],
      reelecciones: [],
      ceses_dimisiones: [],
      revocaciones: [],
    };
    const currentByName = new Map();
    connectedLinks.forEach(link => {
      if (link.type && link.type !== 'officer-company') return;
      const sourceId = normalizeNodeId(getNodeIdFromRef(link.source));
      const targetId = normalizeNodeId(getNodeIdFromRef(link.target));
      const officerNode = nodesById.get(sourceId === nodeId ? targetId : sourceId);
      if (!officerNode || officerNode.type !== 'officer') return;
      const events = Array.isArray(link.events) && link.events.length > 0
        ? link.events
        : [{ position: link.relationship, category: link.category, date: link.date }];
      events.forEach(event => {
        const category = String(event.category || link.category || '').toLowerCase();
        let bucket = 'nombramientos';
        if (category.includes('reelecc')) bucket = 'reelecciones';
        else if (category.includes('revoc')) bucket = 'revocaciones';
        else if (category.includes('cese') || category.includes('dimis')) bucket = 'ceses_dimisiones';
        officers[bucket].push({
          name: officerNode.name,
          position: event.position || link.relationship || officerNode.position || '',
          date: event.date || link.date || null,
        });
      });
      if (getOfficerLinkStatus(link) === 'active') {
        const nameKey = (officerNode.name || '').toUpperCase();
        const current = currentByName.get(nameKey) || { name: officerNode.name, positions: [] };
        current.positions.push({ position: link.relationship || officerNode.position || '', date: link.date || '' });
        currentByName.set(nameKey, current);
      }
    });

    return {
      type: 'company',
      name: node.name,
      entries,
      parsed,
      company: null,
      snapshotLocal: true,
      enriched: {
        capital: parsed?.capital || node.capital || null,
        address: parsed?.address || node.address || null,
        activity: parsed?.activity || node.activity || null,
        cif: parsed?.cif || node.cif || node.nif || null,
        firstSeen: node.companySummary?.dateRange?.earliest || null,
        lastSeen: node.companySummary?.dateRange?.latest || null,
        previousNames: node.companySummary?.previousNames || node.previousNames || [],
        nameChanges: [],
        isDissolved: !!node.isDissolved,
        isInConcurso: !!node.isInConcurso,
        isUnipersonal: !!node.isUnipersonal,
        soleShareholders: [],
        previousSoleShareholders: [],
        soleShareholdersCorporate: [],
        soleShareholdersIndividual: [],
        hojaHistory: [],
        officers,
        currentOfficers: Array.from(currentByName.values()),
        eventCount: entries.length,
      },
    };
  }, [graphData.nodes, graphData.links]);

  // Data preview: fetch live data normally, or read only the imported snapshot.
  const openDataPreview = useCallback(async () => {
    if (!contextNode) return;
    const name = contextNode.name;
    const isOfficer = contextNode.type === 'officer';
    closeNodeContextMenu();
    setPreviewNodeName(name);
    setPreviewNodeType(isOfficer ? 'officer' : 'company');
    setPreviewUserMerged(!!contextNode.userMerged);
    setPreviewData(null);
    setPreviewError(null);
    setPreviewLoading(true);
    setPreviewOpen(true);

    if (snapshotMode) {
      const localPreview = buildSnapshotPreview(contextNode);
      if (localPreview) setPreviewData(localPreview);
      else setPreviewError(text.noCompanyPreview);
      setPreviewLoading(false);
      return;
    }

    try {
      if (isOfficer) {
        // Query all name variants (from merged nodes) to get complete appointment history
        const nameVariants = contextNode.nameVariants || [];
        const allNames = [name, ...nameVariants.filter(v => v !== name)];

        const allOfficers = [];
        const seenKeys = new Set();
        await Promise.all(
          allNames.map(async (queryName) => {
            try {
              const data = await spanishCompaniesService.expandOfficerV3(queryName);
              if (data.success && data.officers?.length > 0) {
                data.officers.forEach(o => {
                  // Deduplicate by company+role+date
                  const key = `${(o.company_name || '').toUpperCase()}|${(o.specific_role || o.position || '').toUpperCase()}|${o.date || o.event_date || ''}`;
                  if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    allOfficers.push(o);
                  }
                });
              }
            } catch (err) {
              console.warn(`[Preview] Failed to expand variant "${queryName}":`, err.message);
            }
          })
        );

        // Also fetch companies where this person is sole shareholder (100% owner)
        let whollyOwned = [];
        try {
          const ownedRes = await spanishCompaniesService.getCompaniesOwnedByShareholder(
            name,
            { limit: 100 },
          );
          whollyOwned = (ownedRes.companies || []).filter(
            c => c.shareholder_type === 'individual',
          );
        } catch (err) {
          console.warn('[Preview] Failed to fetch wholly-owned companies:', err.message);
        }

        if (allOfficers.length > 0 || whollyOwned.length > 0) {
          setPreviewData({
            type: 'officer',
            name,
            officers: allOfficers,
            whollyOwned,
            total: allOfficers.length,
            nameVariants: allNames.length > 1 ? allNames : undefined,
          });
        } else {
          setPreviewError(text.noOfficerPreview);
        }
      } else {
        // Resolve the company to a STABLE group_key before fetching so an
        // ambiguous/short name (e.g. "NAMISA") binds to the correct legal entity
        // rather than whatever working-search/exact-name ranks first. Prefer a
        // group_key already on the node; otherwise resolve via the directory.
        const groupKey = await spanishCompaniesService.resolveCompanyGroupKey(
          name,
          contextNode.groupKey || null
        );

        // Fetch both the company profile and events in parallel, scoped to the
        // resolved group_key (the v3 endpoints query by group_key, not name).
        const [v3Result, eventsResult] = await Promise.allSettled([
          spanishCompaniesService.getCompanyProfileV3(name, { groupKey }),
          spanishCompaniesService.getCompanyEventsV3(name, { size: 100, groupKey }),
        ]);

        const v3 = v3Result.status === 'fulfilled' ? v3Result.value : null;
        const eventsData = eventsResult.status === 'fulfilled' ? eventsResult.value : null;
        const company = v3?.company;
        const events = eventsData?.events || [];

        console.log('[Preview] v3 company:', company);
        console.log('[Preview] events count:', events.length, 'sample:', events[0]);

        if (!company && events.length === 0) {
          // Fallback: use data already in the node
          const summary = contextNode.companySummary;
          if (summary?.entries?.length > 0) {
            const parsedFallback = parseSpanishCompanyData(summary.entries[0]);
            setPreviewData({ type: 'company', name, entries: summary.entries, parsed: parsedFallback, company: null, enriched: null });
          } else {
            setPreviewError(text.noCompanyPreview);
          }
        } else {
          // Extract rich data from events (capital, address, activity, CIF, dated officers)
          // Sort events newest first — v3 events use event_date field
          const sortedEvents = [...events].sort((a, b) =>
            new Date(b.event_date || b.indexed_date || b.date || 0) - new Date(a.event_date || a.indexed_date || a.date || 0)
          );

          let latestCapital = null;
          let latestAddress = null;
          let latestActivity = null;
          let latestCif = null;
          const datedOfficers = { nombramientos: [], reelecciones: [], ceses_dimisiones: [], revocaciones: [] };

          for (const evt of sortedEvents) {
            const pd = evt.parsed_details || {};
            const evtDate = evt.event_date || evt.indexed_date || evt.date || '';

            // Capital — v3 events store capital as a float directly on the event
            if (!latestCapital) {
              const cap = evt.capital || pd.capital || pd.capital_social || evt.capital_social;
              if (cap && cap !== '0' && cap !== '0.00' && cap !== 0) latestCapital = cap;
            }
            // Address — v3 events store address directly on the event
            if (!latestAddress) {
              const addr = evt.address || pd.cambio_de_domicilio_social || pd.domicilio || pd.address || evt.domicilio;
              if (addr) latestAddress = addr;
            }
            // Activity — v3 events store activity directly
            if (!latestActivity) {
              const act = evt.activity || pd.objeto_social || pd.activity || evt.objeto_social;
              if (act) latestActivity = act;
            }
            // CIF
            if (!latestCif) {
              const cif = evt.cif || evt.nif || pd.cif;
              if (cif) latestCif = cif;
            }

            // Dated officers from events
            // v3 events return officers as a flat array with event_type field
            const evtOfficers = evt.officers || [];
            const officerList = Array.isArray(evtOfficers) ? evtOfficers : [];
            officerList.forEach(o => {
              if (!o.name) return;
              // Map event_type to our category keys
              const evtType = (o.event_type || '').toLowerCase();
              let cat = 'nombramientos';
              if (evtType.includes('cese') || evtType.includes('dimisi')) cat = 'ceses_dimisiones';
              else if (evtType.includes('reelecc')) cat = 'reelecciones';
              else if (evtType.includes('revocac')) cat = 'revocaciones';
              else if (evtType.includes('nombr')) cat = 'nombramientos';
              datedOfficers[cat].push({
                name: o.name,
                position: o.position_normalized || o.position || '',
                date: o.date || evtDate,
              });
            });
          }

          // Deduplicate officers by name+position+category, keeping the latest date
          const dedupeOfficers = (officers) => {
            const map = new Map();
            officers.forEach(o => {
              const key = `${(o.name || '').toUpperCase()}|${(o.position || '').toUpperCase()}`;
              const existing = map.get(key);
              if (!existing || new Date(o.date || 0) > new Date(existing.date || 0)) {
                map.set(key, o);
              }
            });
            return Array.from(map.values());
          };

          Object.keys(datedOfficers).forEach(cat => {
            datedOfficers[cat] = dedupeOfficers(datedOfficers[cat]);
          });

          // If events didn't have officers, fall back to v3 company doc (undated)
          const hasEventOfficers = Object.values(datedOfficers).some(arr => arr.length > 0);
          if (!hasEventOfficers && company) {
            (company.officers_active || []).forEach(o => {
              datedOfficers.nombramientos.push({
                name: o.name || o.name_normalized,
                position: o.position_normalized || '',
                date: '',
              });
            });
            (company.officers_resigned || []).forEach(o => {
              datedOfficers.ceses_dimisiones.push({
                name: o.name || o.name_normalized,
                position: o.position_normalized || '',
                date: '',
              });
            });
          }

          // Compute date range from the v3 company doc, falling back to events
          const firstSeen = company?.first_seen || (sortedEvents.length > 0 ? (sortedEvents[sortedEvents.length - 1].event_date || sortedEvents[sortedEvents.length - 1].indexed_date) : null);
          const lastSeen = company?.last_seen || (sortedEvents.length > 0 ? (sortedEvents[0].event_date || sortedEvents[0].indexed_date) : null);

          // Previous names — merge node-derived names with v3 name_changes
          const nodePrevNames = contextNode.companySummary?.previousNames || contextNode.previousNames || [];
          const nameChanges = Array.isArray(company?.name_changes) ? company.name_changes : [];
          const previousNamesSet = new Set(nodePrevNames);
          nameChanges.forEach(nc => {
            const currentName = company?.company_name || name;
            if (nc?.old_name && nc.old_name !== currentName) previousNamesSet.add(nc.old_name);
          });
          const previousNames = Array.from(previousNamesSet);

          // Status flags from v3 company doc
          const isDissolved = !!company?.is_dissolved;
          const isInConcurso = !!company?.is_in_concurso;
          const isUnipersonal = !!company?.is_unipersonal;

          // Format capital with thousands separator. BORME (event-sourced)
          // capital wins; if there is none (e.g. set before 2009 and never
          // amended), fall back to the LLM-enriched value persisted on the v3
          // company doc, flagged as external so the UI can caveat it.
          let capitalRaw = latestCapital;
          let capitalExternal = false;
          if (!capitalRaw && company?.enriched_capital != null) {
            capitalRaw = company.enriched_capital;
            capitalExternal = true;
          }
          let formattedCapital = null;
          if (capitalRaw) {
            const num = typeof capitalRaw === 'number' ? capitalRaw : parseFloat(String(capitalRaw).replace(/[^\d.,]/g, '').replace(',', '.'));
            if (!isNaN(num)) {
              formattedCapital = new Intl.NumberFormat(uiLanguage === 'en' ? 'en-GB' : 'es-ES', { useGrouping: true, maximumFractionDigits: 2 }).format(num) + ' \u20AC';
            } else {
              formattedCapital = String(capitalRaw);
            }
          }

          // Address: prefer event-derived, then the BORME current_address on the
          // v3 doc, then the LLM-enriched fallback (flagged external for caveat).
          let addressValue = latestAddress || company?.current_address || null;
          let addressExternal = false;
          if (!addressValue && company?.enriched_address) {
            addressValue = company.enriched_address;
            addressExternal = true;
          }

          // Compute current officers grouped by person with all their positions
          // An officer+position is "current" if their latest event for that position
          // is a nombramiento or reelección (not a cese/revocación)
          const allOfficerEvents = [];
          ['nombramientos', 'reelecciones', 'ceses_dimisiones', 'revocaciones'].forEach(cat => {
            datedOfficers[cat].forEach(o => allOfficerEvents.push({ ...o, category: cat }));
          });
          // For each officer+position pair, find the latest event
          const positionStatusMap = new Map(); // "NAME|POSITION" → latest event
          allOfficerEvents
            .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
            .forEach(o => {
              const key = `${(o.name || '').toUpperCase()}|${(o.position || '').toUpperCase()}`;
              positionStatusMap.set(key, o);
            });
          // Group active positions by officer name
          const officerPositionsMap = new Map(); // NAME → { name, positions: [{ position, date }] }
          positionStatusMap.forEach(o => {
            if (o.category !== 'nombramientos' && o.category !== 'reelecciones') return;
            const nameKey = (o.name || '').toUpperCase();
            if (!officerPositionsMap.has(nameKey)) {
              officerPositionsMap.set(nameKey, { name: o.name, positions: [] });
            }
            officerPositionsMap.get(nameKey).positions.push({
              position: o.position || '',
              date: o.date || '',
            });
          });

          // Position importance tiers for sorting
          const positionTier = (pos) => {
            const p = (pos || '').toUpperCase();
            if (p.startsWith('PRESIDENTE') || p.startsWith('PDTE') || p.startsWith('PRES.')) return 0;
            if (p.startsWith('VICEPRESIDENTE') || p.startsWith('VPDTE') || p.startsWith('VICEPTE')) return 1;
            if (p.startsWith('CONSEJERO') || p.startsWith('CONS.') || p.startsWith('CONS ')) return 2;
            if (p.startsWith('ADMINISTRADOR') || p.startsWith('ADM.') || p.startsWith('ADM ')) return 3;
            if (p.startsWith('SECRETARIO') || p.startsWith('SECRET.') || p.startsWith('SRIO')) return 4;
            if (p.startsWith('LIQUIDADOR') || p.startsWith('LIQ.') || p.startsWith('LIQ ')) return 5;
            if (p.startsWith('VOCAL')) return 6;
            if (p.startsWith('AUDITOR') || p.startsWith('AUD.')) return 8;
            if (p.startsWith('APO') || p.startsWith('APODERADO')) return 9;
            return 7; // other
          };

          // Sort each officer's positions by tier, then sort officers by their best tier, then alphabetically
          const currentOfficers = Array.from(officerPositionsMap.values()).map(o => {
            o.positions.sort((a, b) => positionTier(a.position) - positionTier(b.position) || a.position.localeCompare(b.position));
            return { ...o, bestTier: positionTier(o.positions[0]?.position) };
          });
          currentOfficers.sort((a, b) => a.bestTier - b.bestTier || (a.name || '').localeCompare(b.name || ''));

          setPreviewData({
            type: 'company',
            name: company?.company_name || name,
            company,
            enriched: {
              capital: formattedCapital,
              capitalExternal,
              address: addressValue,
              addressExternal,
              activity: latestActivity,
              // BORME events carry no NIF; fall back to the LLM-enriched NIF
              // persisted on the v3 company doc (checksum-validated, shown plain).
              cif: latestCif || company?.enriched_nif || null,
              firstSeen,
              lastSeen,
              previousNames,
              nameChanges,
              isDissolved,
              isInConcurso,
              isUnipersonal,
              // Current + previous (superseded) socio único — for the chain chip.
              soleShareholders: [
                ...(company?.sole_shareholders || []),
                ...(company?.sole_shareholder_individuals || []),
              ],
              previousSoleShareholders: [
                ...(company?.previous_sole_shareholders || []),
                ...(company?.previous_sole_shareholder_individuals || []),
              ],
              // Split kept separately so the preview can label owner type honestly
              // (the merged soleShareholders array above loses this distinction).
              soleShareholdersCorporate: company?.sole_shareholders || [],
              soleShareholdersIndividual: company?.sole_shareholder_individuals || [],
              // Re-registration trail: >1 entry means the company changed its
              // hoja registral (e.g. a provincial move — CaixaBank 2017).
              hojaHistory: company?.hoja_history || [],
              officers: datedOfficers,
              currentOfficers,
              eventCount: events.length,
            },
          });
        }
      }
    } catch (err) {
      console.error('[Preview] Error fetching data:', err);
      setPreviewError(text.previewError(err.message));
    } finally {
      setPreviewLoading(false);
    }
  }, [contextNode, closeNodeContextMenu, text, uiLanguage, snapshotMode, buildSnapshotPreview]);

  const saveNodeEdit = useCallback(() => {
    if (!contextNode) return;
    const nextName = editNodeName.trim();
    if (!nextName) {
      setError(text.emptyNodeName);
      return;
    }

    setGraphData(prev => {
      const oldName = contextNode.name;
      const updatedNodes = prev.nodes.map(node => {
        if (node.id === contextNode.id) {
          return {
            ...node,
            name: nextName,
            ...(node.type === 'officer' ? { subtype: editNodeSubtype } : {}),
          };
        }
        // Keep company/officer textual references aligned when renaming companies.
        if (oldName && oldName !== nextName) {
          return {
            ...node,
            companies: (node.companies || []).map(company =>
              company === oldName ? nextName : company
            ),
            positions: (node.positions || []).map(position => ({
              ...position,
              company: position.company === oldName ? nextName : position.company,
            })),
          };
        }
        return node;
      });
      return { ...prev, nodes: updatedNodes };
    });

    setIsEditNodeDialogOpen(false);
  }, [contextNode, editNodeName, editNodeSubtype, text]);

  const confirmMergeNodes = useCallback(() => {
    const effectiveTarget = mergeTargetOption || exactTypedMergeOption;
    if (!contextNode || !effectiveTarget?.node) {
      setError(text.selectMergeTarget);
      return;
    }
    const sourceNode = contextNode;
    const targetNode = effectiveTarget.node;
    // Snapshot the pre-merge neighborhood so the undo toast can restore the
    // graph itself, not just delete the persisted overlay row.
    const snapshot = captureMergeSnapshot(graphData, sourceNode.id, targetNode.id);
    const undoGraph = snapshot
      ? () => setGraphData(prev => restoreMergeSnapshot(prev, snapshot))
      : null;
    mergeNodes(sourceNode.id, targetNode.id, snapshot);
    setIsMergeNodeDialogOpen(false);
    setMergeTargetOption(null);
    setMergeSearchText('');
    // Persist as a DD correction only when both are officers. name_a (the merged
    // duplicate) collapses into name_b (the canonical spelling).
    if (sourceNode.type === 'officer' && targetNode.type === 'officer' && sourceNode.name && targetNode.name) {
      recordCorrection({
        action: 'merge',
        nameA: sourceNode.name,
        nameB: targetNode.name,
        undoGraph,
        label: text.mergedOfficerCorrection(sourceNode.name, targetNode.name),
      });
    } else if (undoGraph) {
      // Non-officer merges have no overlay row, but the graph undo still applies.
      setCorrectionsSnackbar({
        id: null,
        message: text.nodesMergedToast(sourceNode.name, targetNode.name),
        undoGraph,
      });
    }
  }, [contextNode, mergeTargetOption, exactTypedMergeOption, graphData, mergeNodes, recordCorrection, text]);

  // Persistent unmerge: pop the most recent pre-merge snapshot from the node's
  // history and restore that neighborhood, so a merge can be undone at any time
  // (not only within the toast window). Also removes the persisted overlay row
  // for officer merges so the graph and the Custom DD report stay in sync.
  const unmergeNode = useCallback(async () => {
    const node = contextNode;
    closeNodeContextMenu();
    const history = node?.mergeHistory || [];
    if (!history.length) return;
    const snapshot = history[history.length - 1];
    setGraphData(prev => restoreMergeSnapshot(prev, snapshot));

    const sourceName = snapshot.sourceNode?.name;
    const targetName = snapshot.targetNode?.name;
    if (node.type === 'officer' && sourceName && targetName && subjectCompanyName) {
      try {
        const groupKey = await resolveSubjectGroupKey(subjectCompanyName);
        if (groupKey) {
          const rows = await listCorrections(groupKey);
          const row = rows.find(
            c => c.action === 'merge' && c.name_a === sourceName && c.name_b === targetName
          );
          if (row) {
            await deleteCorrection(row.id);
            setCorrectionsCount(c => Math.max(0, c - 1));
          }
        }
      } catch (e) {
        // Graph is already unmerged; the overlay-row cleanup is best-effort.
      }
    }
  }, [contextNode, subjectCompanyName, resolveSubjectGroupKey]);

  // Handle zoom changes
  const handleZoom = useCallback(transform => {
    const k = typeof transform === 'number' ? transform : transform?.k;
    if (Number.isFinite(k) && k > 0) setZoomLevel(k);
    if (
      transform && typeof transform === 'object' &&
      Number.isFinite(transform.x) && Number.isFinite(transform.y) &&
      Number.isFinite(k) && k > 0
    ) {
      setCameraState({ x: transform.x, y: transform.y, k });
    }
  }, []);

  // Freeze all other nodes during drag to avoid graph drift and restore after drag.
  const handleNodeDrag = useCallback(
    node => {
      const freezeSession = dragFreezeRef.current;
      if (!freezeSession || freezeSession.draggedNodeId !== node.id) {
        const frozenNodes = new Map();

        graphData.nodes.forEach(otherNode => {
          if (!otherNode || otherNode.id === node.id) return;
          frozenNodes.set(otherNode.id, {
            fx: otherNode.fx,
            fy: otherNode.fy,
            vx: otherNode.vx,
            vy: otherNode.vy,
          });
          otherNode.fx = otherNode.x;
          otherNode.fy = otherNode.y;
          otherNode.vx = 0;
          otherNode.vy = 0;
        });

        dragFreezeRef.current = {
          draggedNodeId: node.id,
          frozenNodes,
        };
      }

      // Keep dragged node tightly pinned to pointer position while dragging.
      node.fx = node.x;
      node.fy = node.y;
      node.vx = 0;
      node.vy = 0;
    },
    [graphData.nodes]
  );

  const handleNodeDragEnd = useCallback(
    node => {

      // Keep dragged node pinned where released.
      node.fx = node.x;
      node.fy = node.y;
      node.vx = 0;
      node.vy = 0;

      // Keep all other nodes fixed at their current coordinates.
      // This prevents post-release drift after a manual reposition.
      const freezeSession = dragFreezeRef.current;
      if (freezeSession && freezeSession.draggedNodeId === node.id) {
        graphData.nodes.forEach(otherNode => {
          if (!otherNode || otherNode.id === node.id) return;
          otherNode.fx = otherNode.x;
          otherNode.fy = otherNode.y;
          otherNode.vx = 0;
          otherNode.vy = 0;
        });
        dragFreezeRef.current = null;
      }
      setAutosaveRevision(revision => revision + 1);
    },
    [graphData.nodes]
  );

  useEffect(() => {
    return () => {
      if (!dragFreezeRef.current) return;
      // Safety restore if component unmounts during a drag.
      graphData.nodes.forEach(otherNode => {
        if (!otherNode) return;
        const prev = dragFreezeRef.current.frozenNodes.get(otherNode.id);
        if (!prev) return;
        otherNode.fx = prev.fx ?? null;
        otherNode.fy = prev.fy ?? null;
        otherNode.vx = prev.vx ?? 0;
        otherNode.vy = prev.vy ?? 0;
      });
      dragFreezeRef.current = null;
    };
  }, [graphData.nodes]);

  const handleEngineTick = useCallback(() => {
    graphData.nodes.forEach(node => {
      if (!node) return;

      if (node.fx != null || node.fy != null) {
        node.vx = 0;
        node.vy = 0;
        return;
      }

      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
        node.x = 0;
        node.y = 0;
        node.vx = 0;
        node.vy = 0;
        return;
      }

      if (Math.abs(node.x) > MAX_NODE_DRIFT || Math.abs(node.y) > MAX_NODE_DRIFT) {
        node.x = Math.max(-MAX_NODE_DRIFT, Math.min(MAX_NODE_DRIFT, node.x));
        node.y = Math.max(-MAX_NODE_DRIFT, Math.min(MAX_NODE_DRIFT, node.y));
        node.vx = (node.vx || 0) * 0.35;
        node.vy = (node.vy || 0) * 0.35;
      }

      const vx = node.vx || 0;
      const vy = node.vy || 0;
      const speed = Math.hypot(vx, vy);
      if (speed > MAX_NODE_SPEED) {
        const factor = MAX_NODE_SPEED / speed;
        node.vx = vx * factor;
        node.vy = vy * factor;
      }
    });
  }, [graphData.nodes]);

  // Parse filter into multiple terms and compute filtered graph data
  const filterTerms = React.useMemo(() => {
    return labelFilterText
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);
  }, [labelFilterText]);

  // Facet counts for the chip row — each chip's count reflects the other
  // filter's state so users see how many items would remain if they picked it.
  // Position chip counts honour the vigentes/cesados toggle; status chip counts
  // honour the position toggle.
  const linkPassesStatus = React.useCallback(link => {
    if (statusFilters.size === 0) return true;
    if (link.type && link.type !== 'officer-company') return true;
    const active = getOfficerLinkStatus(link) === 'active';
    const wantActive = statusFilters.has('active');
    const wantCeased = statusFilters.has('ceased');
    if (wantActive && !wantCeased && !active) return false;
    if (wantCeased && !wantActive && active) return false;
    return true;
  }, [statusFilters]);
  const linkPassesPosition = React.useCallback(link => {
    if (positionFilters.size === 0) return true;
    if (link.type && link.type !== 'officer-company') return true;
    const rel = (link.relationship || '').trim();
    return positionFilters.has(positionCategoryFor(rel));
  }, [positionFilters]);

  const availablePositions = React.useMemo(() => {
    const countByCategory = new Map();
    graphData.links.forEach(link => {
      const rel = (link.relationship || '').trim();
      if (!rel) return;
      if (!linkPassesStatus(link)) return;
      const cat = positionCategoryFor(rel);
      countByCategory.set(cat, (countByCategory.get(cat) || 0) + 1);
    });
    return POSITION_CATEGORY_ORDER
      .filter(cat => countByCategory.has(cat))
      .map(cat => ({ category: cat, count: countByCategory.get(cat) }));
  }, [graphData.links, linkPassesStatus]);

  const statusCounts = React.useMemo(() => {
    let active = 0, ceased = 0;
    graphData.links.forEach(link => {
      if (link.type && link.type !== 'officer-company') return;
      if (!linkPassesPosition(link)) return;
      if (getOfficerLinkStatus(link) === 'active') active++;
      else ceased++;
    });
    return { active, ceased };
  }, [graphData.links, linkPassesPosition]);

  // Record a "mark active" correction (reactivate a registry-ceased officer in
  // the Custom report) + recolor edges green. No date needed, so unlike
  // mark-resigned it fires directly without a dialog.
  const markContextOfficerActive = useCallback(() => {
    const node = contextNode;
    closeNodeContextMenu();
    if (!node || !node.name) return;
    const undoGraph = applyOfficerStatusToGraph(node.id, 'active');
    recordCorrection({
      action: 'mark_active',
      nameA: node.name,
      label: text.activeOfficerCorrection(node.name),
      undoGraph,
    });
  }, [contextNode, closeNodeContextMenu, recordCorrection, applyOfficerStatusToGraph, text]);

  const hasChipFilters = statusFilters.size > 0 || positionFilters.size > 0;
  const selectedPositionFilterCount = positionFilters.size;
  const availablePositionCount = availablePositions.length;

  const filteredGraphData = React.useMemo(() => {
    // Start by excluding manually hidden nodes
    let activeNodes = graphData.nodes;
    let activeLinks = graphData.links;

    // When an officer holds an ACTIVE seat at a company, drop their resigned
    // sibling-seat edges to that SAME company — otherwise a currently-active
    // officer reads as "resigned" (e.g. an active Adm. Mancom. who was formerly
    // Secretario shows a red edge overlapping the green one). The resigned role
    // still appears in the officer detail panel. Pairs with no active seat keep
    // their resigned edges (genuinely former officers stay red). Skipped when the
    // user explicitly filters to "Cesados" — there they want every resigned role.
    if (!statusFilters.has('ceased')) {
      const isOfficerLink = l => l.type === 'officer-company';
      const pairKey = l =>
        [normalizeNodeId(getNodeIdFromRef(l.source)), normalizeNodeId(getNodeIdFromRef(l.target))]
          .sort().join('|');
      const activePairs = new Set();
      activeLinks.forEach(l => {
        if (isOfficerLink(l) && getOfficerLinkStatus(l) === 'active') activePairs.add(pairKey(l));
      });
      if (activePairs.size > 0) {
        activeLinks = activeLinks.filter(
          l => !(isOfficerLink(l) && getOfficerLinkStatus(l) !== 'active' && activePairs.has(pairKey(l)))
        );
      }
    }

    if (hiddenNodeIds.size > 0) {
      activeNodes = activeNodes.filter(n => !hiddenNodeIds.has(normalizeNodeId(n.id)));
      activeLinks = activeLinks.filter(l => {
        const sid = normalizeNodeId(getNodeIdFromRef(l.source));
        const tid = normalizeNodeId(getNodeIdFromRef(l.target));
        return !hiddenNodeIds.has(sid) && !hiddenNodeIds.has(tid);
      });
    }

    if (!showShareholders) {
      activeLinks = activeLinks.filter(l => l.type !== 'ownership');
      // Drop nodes that became orphaned only because their ownership links were hidden.
      const linkedIds = new Set();
      activeLinks.forEach(l => {
        linkedIds.add(normalizeNodeId(getNodeIdFromRef(l.source)));
        linkedIds.add(normalizeNodeId(getNodeIdFromRef(l.target)));
      });
      activeNodes = activeNodes.filter(n => linkedIds.has(normalizeNodeId(n.id)) || pinnedNodeIds.has(normalizeNodeId(n.id)));
    }

    if (!showPreviousShareholders) {
      // Hide superseded (anterior) sole-shareholder edges so the user can see
      // the current ownership only.
      activeLinks = activeLinks.filter(l => l.category !== 'socio_anterior');
      const linkedIds = new Set();
      activeLinks.forEach(l => {
        linkedIds.add(normalizeNodeId(getNodeIdFromRef(l.source)));
        linkedIds.add(normalizeNodeId(getNodeIdFromRef(l.target)));
      });
      activeNodes = activeNodes.filter(n => linkedIds.has(normalizeNodeId(n.id)) || pinnedNodeIds.has(normalizeNodeId(n.id)));
    }

    // Apply status and position chip filters
    if (hasChipFilters) {
      activeLinks = activeLinks.filter(link => {
        if (link.type && link.type !== 'officer-company') return true;

        if (statusFilters.size > 0) {
          const active = getOfficerLinkStatus(link) === 'active';
          const wantActive = statusFilters.has('active');
          const wantCeased = statusFilters.has('ceased');
          if (wantActive && !wantCeased && !active) return false;
          if (wantCeased && !wantActive && active) return false;
        }

        if (positionFilters.size > 0) {
          const rel = (link.relationship || '').trim();
          if (!positionFilters.has(positionCategoryFor(rel))) return false;
        }

        return true;
      });

      // Remove any nodes that have no remaining links (orphaned by the filter)
      const linkedNodeIds = new Set();
      activeLinks.forEach(link => {
        linkedNodeIds.add(normalizeNodeId(getNodeIdFromRef(link.source)));
        linkedNodeIds.add(normalizeNodeId(getNodeIdFromRef(link.target)));
      });
      activeNodes = activeNodes.filter(n => {
        return linkedNodeIds.has(normalizeNodeId(n.id));
      });
    }

    let filteredNodes = activeNodes;
    let filteredLinks = activeLinks;

    if (filterTerms.length > 0) {
      // Find nodes matching filter terms (NOT pinned — pinned are added separately)
      const filterMatchIds = new Set();
      activeNodes.forEach(node => {
        if (nodeMatchesFilterTerms(node, filterTerms)) {
          filterMatchIds.add(normalizeNodeId(node.id));
        }
      });

      // Build visible set: filter matches + pinned + neighbors of filter matches only
      const visibleNodeIds = new Set(filterMatchIds);
      pinnedNodeIds.forEach(id => {
        const nodeId = normalizeNodeId(id);
        if (!hiddenNodeIds.has(nodeId)) visibleNodeIds.add(nodeId);
      });

      // Expand neighbors only for filter-matched nodes (not pinned),
      // so pinned nodes don't drag all their connections into view
      activeLinks.forEach(link => {
        const sourceId = normalizeNodeId(getNodeIdFromRef(link.source));
        const targetId = normalizeNodeId(getNodeIdFromRef(link.target));
        if (filterMatchIds.has(sourceId)) visibleNodeIds.add(targetId);
        if (filterMatchIds.has(targetId)) visibleNodeIds.add(sourceId);
      });

      filteredNodes = activeNodes.filter(n => visibleNodeIds.has(normalizeNodeId(n.id)));
      filteredLinks = activeLinks.filter(l => {
        const sourceId = normalizeNodeId(getNodeIdFromRef(l.source));
        const targetId = normalizeNodeId(getNodeIdFromRef(l.target));
        return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
      });
    }

    if (simplifyGraph && filterTerms.length === 0) {
      const linksByNodeId = new Map();
      filteredLinks.forEach(link => {
        const sourceId = normalizeNodeId(getNodeIdFromRef(link.source));
        const targetId = normalizeNodeId(getNodeIdFromRef(link.target));
        if (!linksByNodeId.has(sourceId)) linksByNodeId.set(sourceId, []);
        if (!linksByNodeId.has(targetId)) linksByNodeId.set(targetId, []);
        linksByNodeId.get(sourceId).push(link);
        linksByNodeId.get(targetId).push(link);
      });

      const lowValueNodeIds = new Set();
      filteredNodes.forEach(node => {
        if (node.type !== 'officer') return;
        const nodeId = normalizeNodeId(node.id);
        if (pinnedNodeIds.has(nodeId)) return;
        if (isSameNodeId(pathfinderStartNode?.id, nodeId) || isSameNodeId(pathfinderEndNode?.id, nodeId)) return;

        const nodeLinks = linksByNodeId.get(nodeId) || [];
        if (nodeLinks.length === 0) return;

        // Exclusion list: simplified mode hides ONLY apoderado-type roles.
        // Collapse requires EVERY link to be an excluded role (an apoderado
        // with both an appointment and a revocation edge, or proxy roles in
        // several companies, still collapses; anyone holding a single
        // non-excluded position anywhere stays visible). Non officer-company
        // links (e.g. merge edges) keep the node, conservatively.
        const allLinksExcluded = nodeLinks.every(link =>
          (!link.type || link.type === 'officer-company') &&
          SIMPLIFIED_EXCLUDED_CATEGORIES.has(positionCategoryFor(link.relationship))
        );
        if (!allLinksExcluded) return;
        lowValueNodeIds.add(nodeId);
      });

      if (lowValueNodeIds.size > 0) {
        filteredNodes = filteredNodes.filter(node => !lowValueNodeIds.has(normalizeNodeId(node.id)));
        filteredLinks = filteredLinks.filter(link => {
          const sourceId = normalizeNodeId(getNodeIdFromRef(link.source));
          const targetId = normalizeNodeId(getNodeIdFromRef(link.target));
          return !lowValueNodeIds.has(sourceId) && !lowValueNodeIds.has(targetId);
        });

        return {
          nodes: filteredNodes,
          links: filteredLinks,
          simplifiedCount: lowValueNodeIds.size,
        };
      }
    }

    return { nodes: filteredNodes, links: filteredLinks, simplifiedCount: 0 };
  }, [
    graphData,
    filterTerms,
    pinnedNodeIds,
    hiddenNodeIds,
    statusFilters,
    positionFilters,
    hasChipFilters,
    showShareholders,
    showPreviousShareholders,
    simplifyGraph,
    pathfinderStartNode,
    pathfinderEndNode,
  ]);

  const simplifiedLowValueCount = filteredGraphData.simplifiedCount || 0;

  const contextOfficerStatus = React.useMemo(() => {
    if (!contextNode || contextNode.type !== 'officer') return 'unknown';

    if (nodeContextMenu?.statusCategory) {
      return isActiveLinkCategory(nodeContextMenu.statusCategory) ? 'active' : 'ceased';
    }

    const nodeId = normalizeNodeId(contextNode.id);
    const matchingOfficerLinks = links =>
      links.filter(link => {
        if (link.type && link.type !== 'officer-company') return false;
        const sid = normalizeNodeId(getNodeIdFromRef(link.source));
        const tid = normalizeNodeId(getNodeIdFromRef(link.target));
        return sid === nodeId || tid === nodeId;
      });

    const visibleLinks = matchingOfficerLinks(filteredGraphData.links);
    const links = visibleLinks.length > 0 ? visibleLinks : matchingOfficerLinks(graphData.links);

    let active = 0;
    let ceased = 0;
    links.forEach(link => {
      if (getOfficerLinkStatus(link) === 'active') active++;
      else ceased++;
    });

    if (active > 0 && ceased > 0) return 'mixed';
    if (active > 0) return 'active';
    if (ceased > 0) return 'ceased';
    return 'unknown';
  }, [contextNode, nodeContextMenu, filteredGraphData.links, graphData.links]);

  const contextOfficerCanMarkCeased =
    contextOfficerStatus === 'active' || contextOfficerStatus === 'mixed';
  const contextOfficerCanMarkActive =
    contextOfficerStatus === 'ceased' || contextOfficerStatus === 'mixed';

  // Relationship-report subjects = the companies the user explicitly added
  // (searched/expanded → pinned), NOT auto-pulled socio-único subsidiaries.
  // Restrict to those that are still visible (in filteredGraphData).
  const relationshipSubjectIds = React.useMemo(
    () => new Set([...pinnedNodeIds].map(normalizeNodeId)),
    [pinnedNodeIds]);

  const visibleCompanyCount = React.useMemo(
    () => filteredGraphData.nodes.filter(
      n => (n.type === 'company' || n.type === 'spanish-company-group')
        && relationshipSubjectIds.has(normalizeNodeId(n.id))).length,
    [filteredGraphData.nodes, relationshipSubjectIds]);

  // Live, detailed relationship scope from the visible graph — single source of
  // truth for both the report modal and the shared-connections highlight.
  const relationshipDetailedScope = React.useMemo(
    () => extractVisibleScope(filteredGraphData, normalizeNodeId, relationshipSubjectIds),
    [filteredGraphData, relationshipSubjectIds]);

  const sharedHighlightIds = showSharedConnections
    ? relationshipDetailedScope.sharedNodeIds
    : null;

  // Build a Relationship Report from the visible graph. Declared AFTER
  // filteredGraphData: its dependency array reads filteredGraphData at render
  // time, so defining it earlier triggers a temporal-dead-zone ReferenceError.
  const openRelationshipReport = useCallback(async () => {
    const scope = relationshipDetailedScope;
    if (scope.companies.length < 2) return;
    setRelResolving(true);
    try {
      // Resolve a group_key per visible company; drop ones we can't confidently resolve.
      const resolved = await Promise.all(
        scope.companies.map(async name => ({ name, group_key: await resolveGroupKey(name) })));
      const subjects = resolved.filter(s => s.group_key);
      if (subjects.length < 2) {
        setError(text.relationshipResolveError);
        return;
      }
      setRelScope(scope);
      setRelSubjects(subjects);
      setRelReportOpen(true);
    } catch (e) {
      setError(text.relationshipPrepareError(e.message));
    } finally {
      setRelResolving(false);
    }
  }, [relationshipDetailedScope, filteredGraphData, relationshipSubjectIds, text]);

  // Remove a company from the report: hide it AND any officers/subsidiaries that
  // were only attached to it, so no orphan nodes are left floating. Nodes still
  // reachable from another visible company (e.g. a shared director) are kept.
  // Then unpin everything hidden. The modal reads the live scope, so it updates.
  const removeCompanyFromReport = useCallback((companyName) => {
    const node = graphData.nodes.find(
      n => (n.type === 'company' || n.type === 'spanish-company-group') && n.name === companyName);
    if (!node) return;
    const id = normalizeNodeId(node.id);

    const visible = new Set(
      graphData.nodes.map(n => normalizeNodeId(n.id)).filter(nid => !hiddenNodeIds.has(nid)));
    const adj = new Map();
    graphData.links.forEach(l => {
      const s = normalizeNodeId(getNodeIdFromRef(l.source));
      const t = normalizeNodeId(getNodeIdFromRef(l.target));
      if (!visible.has(s) || !visible.has(t)) return;
      if (!adj.has(s)) adj.set(s, []);
      if (!adj.has(t)) adj.set(t, []);
      adj.get(s).push(t);
      adj.get(t).push(s);
    });

    // Cluster of visible nodes connected to the removed company.
    const cluster = new Set();
    const cs = [id];
    while (cs.length) {
      const c = cs.pop();
      if (cluster.has(c) || !visible.has(c)) continue;
      cluster.add(c);
      (adj.get(c) || []).forEach(nb => { if (!cluster.has(nb)) cs.push(nb); });
    }

    // Nodes reachable from ANOTHER visible company without passing through the
    // removed one must stay (shared directors / jointly-owned subsidiaries).
    const keep = new Set();
    const ks = [];
    graphData.nodes.forEach(n => {
      const nid = normalizeNodeId(n.id);
      if (nid === id || !visible.has(nid)) return;
      if (n.type === 'company' || n.type === 'spanish-company-group') ks.push(nid);
    });
    while (ks.length) {
      const c = ks.pop();
      if (keep.has(c) || c === id || !visible.has(c)) continue;
      keep.add(c);
      (adj.get(c) || []).forEach(nb => { if (nb !== id && !keep.has(nb)) ks.push(nb); });
    }

    // Hide the company + its cluster members that aren't anchored elsewhere.
    const toHide = new Set([id]);
    cluster.forEach(c => { if (!keep.has(c)) toHide.add(c); });

    setPinnedNodeIds(prev => {
      const next = new Set(prev); toHide.forEach(x => next.delete(x)); return next;
    });
    setHiddenNodeIds(prev => new Set([...prev, ...toHide]));
  }, [graphData, hiddenNodeIds]);

  // Connected Components / Clusters analysis for the active rendered graph.
  const clustersData = React.useMemo(() => {
    return detectConnectedComponents(filteredGraphData.nodes, filteredGraphData.links);
  }, [filteredGraphData.nodes, filteredGraphData.links]);

  const clusterColorById = React.useMemo(() => {
    const colors = new Map();
    clustersData.clusters.forEach((cluster, index) => {
      const hue = Math.round((210 + index * 137.508) % 360);
      const saturation = index % 3 === 0 ? 68 : index % 3 === 1 ? 62 : 72;
      const lightness = index % 2 === 0 ? 45 : 38;
      colors.set(cluster.id, `hsl(${hue}, ${saturation}%, ${lightness}%)`);
    });
    return colors;
  }, [clustersData]);

  const getClusterColor = useCallback((nodeId) => {
    const clusterId = clustersData.nodeClusters.get(normalizeNodeId(nodeId));
    if (!clusterId) return '#607d8b';
    return clusterColorById.get(clusterId) || '#607d8b';
  }, [clustersData, clusterColorById]);

  const parallelLinkMeta = React.useMemo(() => {
    const perPair = new Map();
    filteredGraphData.links.forEach(link => {
      const sourceId = normalizeNodeId(getNodeIdFromRef(link.source));
      const targetId = normalizeNodeId(getNodeIdFromRef(link.target));
      if (!sourceId || !targetId) return;
      const pairKey = sourceId < targetId ? `${sourceId}|${targetId}` : `${targetId}|${sourceId}`;
      if (!perPair.has(pairKey)) perPair.set(pairKey, []);
      perPair.get(pairKey).push(link);
    });

    const byLinkId = new Map();
    perPair.forEach(pairLinks => {
      pairLinks.sort((a, b) => {
        const aLabel = normalizeEdgeLabelText(a.relationship, a.category).toLowerCase();
        const bLabel = normalizeEdgeLabelText(b.relationship, b.category).toLowerCase();
        if (aLabel !== bLabel) return aLabel.localeCompare(bLabel);
        return String(a.id || '').localeCompare(String(b.id || ''));
      });

      const count = pairLinks.length;
      pairLinks.forEach((link, index) => {
        byLinkId.set(normalizeNodeId(link.id), { index, count });
      });
    });

    return byLinkId;
  }, [filteredGraphData.links]);

  // Pathfinder path-calculation logic (placed here to avoid TDZ reference errors on filteredGraphData)
  useEffect(() => {
    if (!pathfinderActive || !pathfinderStartNode || !pathfinderEndNode) {
      setShortestPathNodes(new Set());
      setShortestPathLinks(new Set());
      setShortestPathArray([]);
      return;
    }

    const path = findShortestPath(
      filteredGraphData.nodes,
      filteredGraphData.links,
      pathfinderStartNode.id,
      pathfinderEndNode.id
    );

    if (path) {
      const pathNodes = new Set(path);
      const pathLinks = new Set();
      
      for (let i = 0; i < path.length - 1; i++) {
        const u = path[i];
        const v = path[i + 1];
        
        filteredGraphData.links.forEach(l => {
          const sid = normalizeNodeId(getNodeIdFromRef(l.source));
          const tid = normalizeNodeId(getNodeIdFromRef(l.target));
          if ((sid === u && tid === v) || (sid === v && tid === u)) {
            pathLinks.add(l.id);
          }
        });
      }
      
      setShortestPathNodes(pathNodes);
      setShortestPathLinks(pathLinks);
      setShortestPathArray(path);
    } else {
      setShortestPathNodes(new Set());
      setShortestPathLinks(new Set());
      setShortestPathArray([]);
    }
  }, [pathfinderActive, pathfinderStartNode, pathfinderEndNode, filteredGraphData.nodes, filteredGraphData.links]);

  useEffect(() => {
    if (snapshotMode) return;
    setPathDetailsExpanded(false);
  }, [pathfinderStartNode?.id, pathfinderEndNode?.id, snapshotMode]);

  const pathSegments = React.useMemo(() => {
    if (shortestPathArray.length < 2) return [];

    const nodeById = new Map(
      filteredGraphData.nodes.map(node => [normalizeNodeId(node.id), node])
    );

    return shortestPathArray.slice(0, -1).map((sourceId, index) => {
      const targetId = shortestPathArray[index + 1];
      const sourceNode = nodeById.get(normalizeNodeId(sourceId));
      const targetNode = nodeById.get(normalizeNodeId(targetId));
      const links = filteredGraphData.links.filter(link => {
        const sid = normalizeNodeId(getNodeIdFromRef(link.source));
        const tid = normalizeNodeId(getNodeIdFromRef(link.target));
        return (
          (sid === normalizeNodeId(sourceId) && tid === normalizeNodeId(targetId)) ||
          (sid === normalizeNodeId(targetId) && tid === normalizeNodeId(sourceId))
        );
      });

      return {
        id: `${sourceId}-${targetId}-${index}`,
        sourceNode,
        targetNode,
        links,
        summary: summarizePathLinks(links, uiLanguage),
      };
    });
  }, [shortestPathArray, filteredGraphData.nodes, filteredGraphData.links, uiLanguage]);

  // Graph rendering functions
  const nodeCanvasObject = useCallback(
    (node, ctx, globalScale) => {
      const label = node.name || node.label || '';
      const fontSize = Math.max(labelSize / globalScale, 4);
      const nodeRadius = nodeSize;

      // Pathfinder alpha control
      const inPath = shortestPathNodes.has(normalizeNodeId(node.id));
      const isSharedConnector = !!sharedHighlightIds && sharedHighlightIds.has(normalizeNodeId(node.id));
      if (pathfinderActive && shortestPathNodes.size > 0) {
        ctx.globalAlpha = inPath ? 1.0 : PATH_DIM_ALPHA;
      } else if (sharedHighlightIds) {
        ctx.globalAlpha = isSharedConnector ? 1.0 : PATH_DIM_ALPHA;
      } else {
        ctx.globalAlpha = 1.0;
      }

      // Determine node color and shape for normal nodes
      const isOrigin = pinnedNodeIds.has(normalizeNodeId(node.id));
      let color = nodeColors.company;
      if (colorByCluster) {
        color = getClusterColor(node.id);
      } else {
        if (node.type === 'officer') {
          color =
            node.subtype === 'company' ? nodeColors.officer_company : nodeColors.officer_individual;
        } else if (node.type === 'spanish-company-group') {
          color = nodeColors.company;
        }

        if (node.expanded) {
          color = nodeColors.expanded;
        }
        // Origin keeps its base color (teal for companies); it's set apart by a
        // glowing ring below, mirroring the hero network's hub — not a clashing hue.
      }

      // Draw node based on type and subtype
      ctx.fillStyle = color;

      // Search origin nodes get a glowing teal ring to stand out (hero-hub language)
      if (isOrigin) {
        ctx.save();
        ctx.shadowColor = nodeColors.searchOrigin;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = nodeColors.searchOrigin;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius + 3.5, 0, 2 * Math.PI, false);
        ctx.stroke();
        ctx.restore();
      } else if (pathfinderActive && inPath) {
        ctx.strokeStyle = PATH_HIGHLIGHT_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius + 4, 0, 2 * Math.PI, false);
        ctx.stroke();
      } else if (isSharedConnector) {
        ctx.strokeStyle = PATH_HIGHLIGHT_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius + 4, 0, 2 * Math.PI, false);
        ctx.stroke();
      }

      // Hollow/outlined nodes to match the hero network: a dark fill with the
      // node's color as the outline — the identity is the border, not a solid fill.
      ctx.fillStyle = '#0d1220';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      // Shape encodes type: companies are rounded squares, officers are circles
      // (same grammar as the hero network, so the real graph reads as the same product).
      const isCompany = node.type !== 'officer';
      ctx.beginPath();
      if (isCompany) {
        const s = nodeRadius * 1.55;
        const r = Math.max(s * 0.3, 1);
        const x0 = node.x - s;
        const y0 = node.y - s;
        const w = s * 2;
        ctx.moveTo(x0 + r, y0);
        ctx.arcTo(x0 + w, y0, x0 + w, y0 + w, r);
        ctx.arcTo(x0 + w, y0 + w, x0, y0 + w, r);
        ctx.arcTo(x0, y0 + w, x0, y0, r);
        ctx.arcTo(x0, y0, x0 + w, y0, r);
        ctx.closePath();
      } else {
        ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI, false);
      }
      ctx.fill();
      ctx.stroke();

      // Deputy/PEP chip on officer nodes that match a Congreso deputy.
      if (node.type === 'officer') {
        const match = officerDeputyMatches[node.name];
        if (match?.deputy) {
          const isFormer = !!match.deputy.FECHABAJA;
          const chipR = nodeRadius * 0.55;
          const chipX = node.x + nodeRadius * 0.7;
          const chipY = node.y - nodeRadius * 0.7;
          ctx.beginPath();
          ctx.arc(chipX, chipY, chipR, 0, 2 * Math.PI, false);
          ctx.fillStyle = isFormer ? '#9ca3af' : '#f59e0b';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();
          // Cap glyph size so it stays legible at any zoom
          const glyphSize = Math.min(Math.max(chipR * 1.2, 6), 11);
          ctx.font = `${glyphSize}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
          ctx.fillText('🏛', chipX, chipY);
        }
      }

      // Company⇄cargo badge (top-right pill). Two states:
      //  • unified → teal "⚭ N" marker (this node's cargos are attached here).
      //  • pending affordance → amber "+N" (this entity also holds cargos elsewhere).
      // Drawn for company nodes only; small yet high-contrast so it's unmissable.
      if (node.type !== 'officer' && (node.unified || node.cargoCount > 0)) {
        const isUnified = !!node.unified;
        const badgeText = isUnified
          ? `⚭${node.unifiedCargoCount ? ' ' + node.unifiedCargoCount : ''}`
          : `+${node.cargoCount}`;
        const bg = isUnified ? '#14b8a6' : '#f59e0b';
        const s = nodeRadius * 1.55; // half-side of the company rounded square
        const pillH = Math.min(Math.max(nodeRadius * 0.9, 6), 12);
        const glyphSize = pillH * 0.72;
        ctx.font = `600 ${glyphSize}px "IBM Plex Mono", monospace`;
        const textW = ctx.measureText(badgeText).width;
        const padX = pillH * 0.35;
        const pillW = textW + padX * 2;
        // Anchor at the top-right corner of the square.
        const pillX = node.x + s - pillW * 0.55;
        const pillY = node.y - s - pillH * 0.55;
        const r = pillH / 2;
        ctx.beginPath();
        ctx.moveTo(pillX + r, pillY);
        ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, r);
        ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, r);
        ctx.arcTo(pillX, pillY + pillH, pillX, pillY, r);
        ctx.arcTo(pillX, pillY, pillX + pillW, pillY, r);
        ctx.closePath();
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = 'rgba(4, 18, 31, 0.9)';
        ctx.lineWidth = Math.max(0.5, 1 / globalScale);
        ctx.stroke();
        ctx.fillStyle = isUnified ? '#04121f' : '#1a1206';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, pillX + pillW / 2, pillY + pillH / 2 + 0.5);
      }

      // Conditional label rendering based on density and zoom
      if (showNodeLabels) {
        const isDense = filteredGraphData.nodes.length > MAX_NODES_FOR_LABELS;
        let shouldRenderLabel = false;

        if (isDense) {
          shouldRenderLabel = globalScale > NODE_LABEL_VISIBILITY_SCALE_DENSE;
        } else {
          shouldRenderLabel = globalScale > NODE_LABEL_VISIBILITY_SCALE_NORMAL;
        }

        if (shouldRenderLabel) {
          ctx.font = `${fontSize}px "IBM Plex Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Truncate long labels — show more characters when zoomed in
          const maxLength = Math.max(15, Math.round(30 * globalScale));
          const truncatedLabel =
            label.length > maxLength ? label.substring(0, maxLength) + '...' : label;

          const labelY = node.y + nodeRadius + fontSize * 0.85;

          // Draw text with subtle dark outline for readability on dark background
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.lineWidth = 3 / globalScale;
          ctx.lineJoin = 'round';
          ctx.strokeText(truncatedLabel, node.x, labelY);
          ctx.fillStyle = '#e0e0e0';
          ctx.fillText(truncatedLabel, node.x, labelY);

          // Show previous names as subtitle "(antes: ...)"
          const prevNames = node.companySummary?.previousNames || node.previousNames;
          if (prevNames && prevNames.length > 0) {
            const subtitleFontSize = Math.max(fontSize * 0.7, 3);
            ctx.font = `italic ${subtitleFontSize}px Sans-Serif`;
            const subtitleText = `(antes: ${prevNames[0]}${prevNames.length > 1 ? ` +${prevNames.length - 1}` : ''})`;
            const maxSubLen = Math.max(20, Math.round(40 * globalScale));
            const truncatedSubtitle = subtitleText.length > maxSubLen
              ? subtitleText.substring(0, maxSubLen) + '...)'
              : subtitleText;
            const subtitleY = labelY + subtitleFontSize * 1.3;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.lineWidth = 2.5 / globalScale;
            ctx.strokeText(truncatedSubtitle, node.x, subtitleY);
            ctx.fillStyle = 'rgba(180, 180, 180, 0.85)';
            ctx.fillText(truncatedSubtitle, node.x, subtitleY);
          }
        }
      }

      if (investigationSet.has(normalizeNodeId(node.id))) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius + 2.5, 0, 2 * Math.PI);
        ctx.strokeStyle = '#7c4dff'; // distinct from status colors
        ctx.lineWidth = 2 / globalScale;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.restore();
      }

      // User-created merge marker: an amber dashed ring so a merged node is
      // visibly distinct from a registry-sourced one at a glance (right-click
      // for "Deshacer fusión", or open the preview for the provenance badge).
      if (node.userMerged) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius + 4.5, 0, 2 * Math.PI);
        ctx.strokeStyle = '#f59e0b'; // amber = user-created grouping
        ctx.lineWidth = 1.5 / globalScale;
        ctx.setLineDash([3 / globalScale, 2 / globalScale]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Private analyst-note marker. It stays visually separate from registry
      // status colours and is always fully opaque, even when Pathfinder dims
      // the underlying network.
      if (hasNodeNote(node)) {
        const noteColor = NODE_NOTE_FLAGS[node.userNote.flag] || NODE_NOTE_FLAGS.none;
        const marker = getNodeNoteMarkerGeometry(node, nodeRadius);
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, marker.radius, 0, 2 * Math.PI);
        ctx.fillStyle = noteColor;
        ctx.fill();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = Math.max(0.8, 1 / globalScale);
        ctx.stroke();
        ctx.font = `700 ${Math.min(Math.max(marker.radius * 1.25, 6), 10)}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0f172a';
        ctx.fillText('✎', marker.x, marker.y + 0.25);
        ctx.restore();
      }

      ctx.globalAlpha = 1.0;
    },
    [nodeSize, labelSize, showNodeLabels, nodeColors, filteredGraphData.nodes, pinnedNodeIds, officerDeputyMatches, pathfinderActive, shortestPathNodes, colorByCluster, getClusterColor, PATH_DIM_ALPHA, PATH_HIGHLIGHT_COLOR, sharedHighlightIds, investigationSet]
  );

  const linkCanvasObject = useCallback(
    (link, ctx, globalScale) => {
      const start = link.source;
      const end = link.target;
      const BASE_LABEL_STACK_SPACING = 18;
      const BASE_LABEL_ALONG_EDGE_SPACING = 10;
      // Ensure nodes are positioned
      if (
        typeof start !== 'object' ||
        typeof end !== 'object' ||
        !Object.prototype.hasOwnProperty.call(start, 'x') ||
        !Object.prototype.hasOwnProperty.call(start, 'y') ||
        !Object.prototype.hasOwnProperty.call(end, 'x') ||
        !Object.prototype.hasOwnProperty.call(end, 'y')
      ) {
        return;
      }

      // Determine link color based on appointment category
      const cat = (getLinkEffectiveCategory(link) || '').toLowerCase();
      const isLinkInPath = shortestPathLinks.has(normalizeNodeId(link.id));
      const touchesShared = !!sharedHighlightIds && (
        sharedHighlightIds.has(normalizeNodeId(typeof start === 'object' ? start.id : start)) ||
        sharedHighlightIds.has(normalizeNodeId(typeof end === 'object' ? end.id : end)));
      let linkColor;

      if (pathfinderActive && isLinkInPath) {
        linkColor = PATH_HIGHLIGHT_COLOR;
      } else if (sharedHighlightIds && touchesShared) {
        linkColor = PATH_HIGHLIGHT_COLOR;
      } else if (link.type === 'ownership') {
        linkColor =
          cat === 'socio_anterior'
            ? '#94a3b8' // Slate — previous (superseded) sole shareholder
            : cat === 'socio_perdido'
              ? '#c79a3a'
              : '#fbbf24'; // Amber — current sole shareholder
      } else if (link.companyDissolved) {
        linkColor = '#f87171'; // Red — officer link to a DISSOLVED company is not current
      } else if (cat.includes('nombramiento') || cat.includes('reeleccion') || cat.includes('reelección')) {
        linkColor = '#34d399'; // Green — appointments and re-elections
      } else if (
        cat.includes('cese') || cat.includes('dimision') || cat.includes('dimisión') ||
        cat.includes('revocacion') || cat.includes('revocación')
      ) {
        linkColor = '#f87171'; // Red — resignations and revocations
      } else {
        linkColor = '#64748b'; // Slate for unknown / company-company
      }

      // Pathfinder alpha control
      if (pathfinderActive && shortestPathNodes.size > 0) {
        ctx.globalAlpha = isLinkInPath ? 0.95 : PATH_DIM_ALPHA;
      } else if (sharedHighlightIds) {
        ctx.globalAlpha = touchesShared ? 1.0 : PATH_DIM_ALPHA;
      } else {
        ctx.globalAlpha = 0.78;
      }

      // Draw link — dashed for officers from a previous company name and ownership links
      ctx.beginPath();
      if (link.fromPreviousName) {
        ctx.setLineDash([Math.max(4, 6 / globalScale), Math.max(2, 3 / globalScale)]);
      } else if (link.type === 'ownership') {
        ctx.setLineDash([Math.max(2, 3 / globalScale), Math.max(2, 3 / globalScale)]);
      }
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = link.fromPreviousName ? (linkColor + 'AA') : linkColor; // Slightly transparent for old-name links
      
      let strokeWidth = Math.max(0.3, 1 / globalScale);
      if (pathfinderActive && isLinkInPath) {
        strokeWidth = Math.max(1.3, 3 / globalScale);
      } else if (link.type === 'ownership') {
        strokeWidth = Math.max(0.6, 1.6 / globalScale);
      }
      ctx.lineWidth = strokeWidth;
      
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Arrowhead at the target end — DIRECTIONAL edges only (entity→company cargo
      // appointments/ceses and owner→owned ownership). Non-directional links (e.g.
      // untyped company-company / structural links) get no arrow. react-force-graph's
      // built-in linkDirectionalArrow is suppressed when a custom linkCanvasObject is
      // in 'replace' mode, so we draw it here manually. isDirectionalLink (module
      // scope) also matches resolved BORME/ownership categories, since main-graph
      // officer→company edges carry category: 'nombramientos' etc rather than
      // type: 'officer-company'.
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (isDirectionalLink(link) && length > 0) {
        const ux = dx / length;
        const uy = dy / length;
        // Size the arrowhead in GRAPH units relative to the node radius so it stays
        // proportional to the nodes at ANY zoom. The previous screen-pixel sizing
        // (6 / globalScale) collapsed to a couple of pixels and effectively vanished
        // as you zoomed in; a graph-unit size scales with the nodes instead.
        const arrowLen = (pathfinderActive && isLinkInPath)
          ? nodeSize * 1.2
          : nodeSize * 0.85;
        const arrowHalfWidth = arrowLen * 0.55;
        // Sit the WHOLE arrowhead in the gap between the edge and the target node,
        // with clear breathing room, so the icon never covers it. tip = node edge +
        // gap; the head then extends further back along the edge from there.
        const tipGap = Math.max(4, nodeSize * 0.7);
        const tipOffset = nodeSize + tipGap;
        const tipX = end.x - ux * tipOffset;
        const tipY = end.y - uy * tipOffset;
        const baseX = tipX - ux * arrowLen;
        const baseY = tipY - uy * arrowLen;
        const leftX = baseX + -uy * arrowHalfWidth;
        const leftY = baseY + ux * arrowHalfWidth;
        const rightX = baseX - -uy * arrowHalfWidth;
        const rightY = baseY - ux * arrowHalfWidth;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(leftX, leftY);
        ctx.lineTo(rightX, rightY);
        ctx.closePath();
        // Thin canvas-background outline separates the head from the edge line so it
        // reads as a crisp arrow rather than a blob fused to the stroke.
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(0.4, 0.9 / globalScale);
        ctx.strokeStyle = '#0d1220';
        ctx.stroke();
        ctx.fillStyle = linkColor;
        ctx.fill();
      }

      // Conditional link label rendering
      let edgeLabel = normalizeEdgeLabelText(link.relationship, link.category);
      if (link.fromPreviousName) {
        edgeLabel = edgeLabel
          ? `${edgeLabel} (bajo ${link.fromPreviousName})`
          : `(bajo ${link.fromPreviousName})`;
      }
      if (edgeLabel) {
        const isDense = filteredGraphData.links.length > MAX_LINKS_FOR_LABELS;
        let shouldRenderLabel = false;

        if (isDense) {
          shouldRenderLabel = globalScale > LINK_LABEL_VISIBILITY_SCALE_DENSE;
        } else {
          shouldRenderLabel = globalScale > LINK_LABEL_VISIBILITY_SCALE_NORMAL;
        }

        if (shouldRenderLabel) {
          const fontSize = Math.max(labelSize / globalScale, 4);
          let midX = (start.x + end.x) / 2;
          let midY = (start.y + end.y) / 2;
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const length = Math.sqrt(dx * dx + dy * dy);

            // Stack labels on parallel edges to avoid overlap.
            const linkMeta = parallelLinkMeta.get(normalizeNodeId(link.id));
            if (linkMeta && linkMeta.count > 1 && length > 0) {
              const centeredIndex = linkMeta.index - (linkMeta.count - 1) / 2;
              // Dynamic spacing: keep multi-label edges readable regardless of zoom/font size.
              const stackSpacingPx = Math.max(BASE_LABEL_STACK_SPACING, fontSize * 2.4);
              const alongEdgeSpacingPx = Math.max(BASE_LABEL_ALONG_EDGE_SPACING, fontSize * 1.1);
              const perpOffset = (centeredIndex * stackSpacingPx) / globalScale;
              const tangentOffset = (centeredIndex * alongEdgeSpacingPx) / globalScale;

              const perpDx = -dy / length;
              const perpDy = dx / length;
              const tangentDx = dx / length;
              const tangentDy = dy / length;
              midX += perpDx * perpOffset + tangentDx * tangentOffset;
              midY += perpDy * perpOffset + tangentDy * tangentOffset;
            }

            ctx.font = `${fontSize}px Sans-Serif`;
            const text = edgeLabel;
            const textWidth = ctx.measureText(text).width;
            const paddingX = 2;
            const paddingY = 1;
            ctx.fillStyle = 'rgba(18, 24, 40, 0.75)';
            ctx.fillRect(
              midX - textWidth / 2 - paddingX,
              midY - fontSize / 2 - paddingY,
              textWidth + paddingX * 2,
              fontSize + paddingY * 2
            );
            ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, midX, midY);
        }
      }

      ctx.globalAlpha = 1.0;
    },
    [filteredGraphData.links, parallelLinkMeta, labelSize, nodeSize, pathfinderActive, shortestPathNodes, shortestPathLinks, PATH_DIM_ALPHA, PATH_HIGHLIGHT_COLOR, sharedHighlightIds]
  );

  // Graph controls
  const zoomIn = () => {
    if (fgRef.current) {
      fgRef.current.zoom(zoomLevel * 1.5, 400);
    }
  };

  const zoomOut = () => {
    if (fgRef.current) {
      fgRef.current.zoom(zoomLevel * 0.75, 400);
    }
  };

  const centerGraph = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 50);
    }
  };

  const clearGraph = () => {
    if (embedded) {
      autosaveWriteIdRef.current += 1;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveReadyRef.current = true;
      setPendingAutosaveRecord(null);
      setAutosaveSavedAt(null);
      setAutosaveStatus('idle');
      clearGraphAutosave().catch(() => setAutosaveStatus('error'));
    }
    setGraphData({ nodes: [], links: [] });
    setSnapshotMode(false);
    setSnapshotSource(null);
    pendingSnapshotCameraRef.current = null;
    setPinnedNodeIds(new Set());
    setHiddenNodeIds(new Set());
    setError(null);
    setLastSearchContext(null);
    setPrimarySubject(null);
    setSelectedSidebarCompany(null);
    setLoadingMore(false);
    setSimplifyGraph(false);
    setCameraState({ x: 0, y: 0, k: 1 });
    setIsNodeNoteDialogOpen(false);
    setNodeNoteTargetId(null);
  };

  // Compute table data from graph links
  const tableRows = React.useMemo(() => {
    const rows = [];
    filteredGraphData.links.forEach(link => {
      const sourceNode =
        typeof link.source === 'object'
          ? link.source
          : filteredGraphData.nodes.find(n => n.id === link.source);
      const targetNode =
        typeof link.target === 'object'
          ? link.target
          : filteredGraphData.nodes.find(n => n.id === link.target);
      if (!sourceNode || !targetNode) return;

      let companyName, officerName, companyNode, officerNode;
      if (link.type === 'ownership') {
        // Ownership: source is always shareholder (the "officer" column), target is owned company.
        officerName = sourceNode.name;
        companyName = targetNode.name;
        officerNode = sourceNode;
        companyNode = targetNode;
      } else if (sourceNode.type === 'officer') {
        officerName = sourceNode.name;
        companyName = targetNode.name;
        officerNode = sourceNode;
        companyNode = targetNode;
      } else {
        companyName = sourceNode.name;
        officerName = targetNode.name;
        companyNode = sourceNode;
        officerNode = targetNode;
      }

      const baseRow = {
        company: companyName || '-',
        officer: officerName || '-',
        companyNode,
        officerNode,
        position: link.relationship || '-',
      };

      // Prefer the per-event entries enriched from borme_events_v3.
      // Fall back to the link-level category/date until enrichment arrives.
      if (Array.isArray(link.events) && link.events.length > 0) {
        link.events.forEach(ev => {
          rows.push({
            ...baseRow,
            position: ev.position || baseRow.position,
            category: ev.category,
            date: formatDate(ev.date, uiLanguage),
            dateRaw: ev.date || null,
          });
        });
      } else {
        rows.push({
          ...baseRow,
          category: link.category || '-',
          date: formatDate(link.date, uiLanguage),
          dateRaw: link.date || null,
        });
      }
    });
    rows.sort(
      (a, b) =>
        a.company.localeCompare(b.company) ||
        a.officer.localeCompare(b.officer) ||
        (a.dateRaw || '').localeCompare(b.dateRaw || '')
    );
    return rows;
  }, [filteredGraphData, uiLanguage]);

  // Rows visible in the table after applying the optional date filter.
  const visibleTableRows = React.useMemo(() => {
    if (!dateFilter) return tableRows;
    return tableRows.filter(
      r =>
        r.date === dateFilter.date &&
        r.companyNode?.id === dateFilter.companyNodeId &&
        r.category === dateFilter.category
    );
  }, [tableRows, dateFilter]);

  // Lazy enrichment for the officer-name → deputy-match cache. Triggers a
  // background lookup for any officer surfaced in the table, the graph, or the
  // open preview that isn't already cached. `null` in the cache = "checked, no
  // match" so we don't refetch the same name on every re-render.
  useEffect(() => {
    if (snapshotMode) return undefined;
    const officerNodeNames = filteredGraphData.nodes
      .filter(n => n.type === 'officer')
      .map(n => n.name);
    const previewNames = [];
    if (previewData?.type === 'officer' && previewData.name) {
      previewNames.push(previewData.name);
    }
    if (previewData?.type === 'company') {
      const e = previewData.enriched;
      (e?.currentOfficers || []).forEach(o => o.name && previewNames.push(o.name));
      ['nombramientos', 'reelecciones', 'ceses_dimisiones', 'revocaciones'].forEach(cat => {
        (e?.officers?.[cat] || []).forEach(o => o.name && previewNames.push(o.name));
      });
    }
    const namesToCheck = Array.from(
      new Set([
        ...visibleTableRows.map(r => r.officer),
        ...officerNodeNames,
        ...previewNames,
      ])
    ).filter(name => name && officerDeputyMatches[name] === undefined);
    if (namesToCheck.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        namesToCheck.map(name => findDeputyMatch(name).catch(() => null))
      );
      if (cancelled) return;
      setOfficerDeputyMatches(prev => {
        const next = { ...prev };
        namesToCheck.forEach((name, i) => {
          next[name] = results[i] || null;
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [visibleTableRows, filteredGraphData.nodes, previewData, officerDeputyMatches, snapshotMode]);

  // Clear the date filter automatically if the underlying rows no longer contain any match
  // (e.g. user collapsed a node or changed filters).
  React.useEffect(() => {
    if (dateFilter && visibleTableRows.length === 0) {
      setDateFilter(null);
    }
  }, [dateFilter, visibleTableRows.length]);

  // Copy table as TSV for Excel/Word paste
  const copyTableToClipboard = useCallback(() => {
    const headers = [text.tableCompany, text.tableOfficer, text.tableRole, text.tableType, text.tableDate];
    const tsv = [
      headers.join('\t'),
      ...visibleTableRows.map(row =>
        [
          row.company,
          row.officer,
          row.position,
          getCategoryLabel(row.category, uiLanguage),
          row.date,
        ].join('\t')
      ),
    ].join('\n');
    navigator.clipboard.writeText(tsv).catch(err => {
      console.error('Failed to copy table:', err);
      setError(text.copyTableError);
    });
  }, [visibleTableRows, text, uiLanguage]);

  const buildCurrentGraphSnapshot = useCallback(() => createGraphSnapshot({
    graphData,
    view: {
      searchQuery,
      searchType,
      labelFilterText,
      statusFilters: Array.from(statusFilters),
      positionFilters: Array.from(positionFilters),
      officersPerCompany,
      companiesPerSearch,
      pinnedNodeIds: Array.from(pinnedNodeIds),
      hiddenNodeIds: Array.from(hiddenNodeIds),
      activeNodeId,
      investigationSet: Array.from(investigationSet),
      showShareholders,
      showPreviousShareholders,
      nodeSize,
      labelSize,
      linkDistance,
      chargeStrength,
      spacing,
      simplifyGraph,
      colorByCluster,
      showSharedConnections,
      tablePosition,
      isTableCollapsed,
      dateFilter,
      camera: cameraState,
      pathfinder: {
        active: pathfinderActive,
        startNodeId: pathfinderStartNode?.id || null,
        endNodeId: pathfinderEndNode?.id || null,
        detailsExpanded: pathDetailsExpanded,
      },
    },
    context: { primarySubject },
    enrichments: { officerDeputyMatches },
  }), [
    graphData,
    searchQuery,
    searchType,
    labelFilterText,
    statusFilters,
    positionFilters,
    officersPerCompany,
    companiesPerSearch,
    pinnedNodeIds,
    hiddenNodeIds,
    activeNodeId,
    investigationSet,
    showShareholders,
    showPreviousShareholders,
    nodeSize,
    labelSize,
    linkDistance,
    chargeStrength,
    spacing,
    simplifyGraph,
    colorByCluster,
    showSharedConnections,
    tablePosition,
    isTableCollapsed,
    dateFilter,
    cameraState,
    pathfinderActive,
    pathfinderStartNode,
    pathfinderEndNode,
    pathDetailsExpanded,
    primarySubject,
    officerDeputyMatches,
  ]);

  const exportGraphSnapshot = useCallback(() => {
    if (graphData.nodes.length === 0) {
      setError(text.snapshotEmpty);
      return;
    }
    try {
      const snapshot = buildCurrentGraphSnapshot();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const subject = (primarySubject || graphData.nodes[0]?.name || 'graph')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
        .slice(0, 60) || 'graph';
      anchor.href = url;
      anchor.download = `mapasocietario-${subject}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setError(null);
      setSnapshotNotice(text.snapshotExported(graphData.nodes.length));
    } catch (err) {
      setError(text.snapshotExportError(err.message));
    }
  }, [buildCurrentGraphSnapshot, graphData.nodes, primarySubject, text]);

  const applyGraphSnapshot = useCallback((snapshot, notice, source = 'imported') => {
    const view = snapshot.view || {};
    const nodeById = new Map(
      snapshot.graph.nodes.map(node => [normalizeNodeId(node.id), node])
    );
    const finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback;
    const camera = {
      x: finiteOr(view.camera?.x, 0),
      y: finiteOr(view.camera?.y, 0),
      k: Math.max(0.05, finiteOr(view.camera?.k, 1)),
    };
    const importedSpacing = Math.min(2.5, Math.max(0.5, finiteOr(view.spacing, 1)));
    const importedOfficerCap = Math.max(1, Math.round(finiteOr(view.officersPerCompany, 100)));

    pendingSnapshotCameraRef.current = camera;
    prevSpacingRef.current = importedSpacing;
    officersCapRef.current = importedOfficerCap;
    prevNodeCountRef.current = snapshot.graph.nodes.length;
    setSnapshotMode(true);
    setSnapshotSource(source);
    setGraphData(snapshot.graph);
    setSearchQuery(typeof view.searchQuery === 'string' ? view.searchQuery : '');
    setSearchType(view.searchType === 'officer' ? 'officer' : 'company');
    setLabelFilterText(typeof view.labelFilterText === 'string' ? view.labelFilterText : '');
    setStatusFilters(new Set(Array.isArray(view.statusFilters) ? view.statusFilters : []));
    setPositionFilters(new Set(Array.isArray(view.positionFilters) ? view.positionFilters : []));
    setOfficersPerCompany(importedOfficerCap);
    setCompaniesPerSearch(Math.max(1, Math.round(finiteOr(view.companiesPerSearch, 25))));
    setPinnedNodeIds(new Set(Array.isArray(view.pinnedNodeIds) ? view.pinnedNodeIds.map(normalizeNodeId) : []));
    setHiddenNodeIds(new Set(Array.isArray(view.hiddenNodeIds) ? view.hiddenNodeIds.map(normalizeNodeId) : []));
    setActiveNodeId(view.activeNodeId ?? null);
    setInvestigationSet(new Set(Array.isArray(view.investigationSet) ? view.investigationSet : []));
    setShowShareholders(view.showShareholders !== false);
    setShowPreviousShareholders(view.showPreviousShareholders !== false);
    setNodeSize(Math.min(28, Math.max(4, finiteOr(view.nodeSize, 9))));
    setLabelSize(Math.min(18, Math.max(3, finiteOr(view.labelSize, 4.5))));
    setLinkDistance(Math.max(1, finiteOr(view.linkDistance, 80)));
    setChargeStrength(finiteOr(view.chargeStrength, -350));
    setSpacing(importedSpacing);
    setSimplifyGraph(view.simplifyGraph !== false);
    setColorByCluster(!!view.colorByCluster);
    setShowSharedConnections(!!view.showSharedConnections);
    setTablePosition(
      view.tablePosition && typeof view.tablePosition === 'object'
        ? { x: view.tablePosition.x ?? null, y: view.tablePosition.y ?? null }
        : { x: null, y: null }
    );
    setIsTableCollapsed(view.isTableCollapsed !== false);
    setDateFilter(view.dateFilter && typeof view.dateFilter === 'object' ? view.dateFilter : null);
    setCameraState(camera);
    setZoomLevel(camera.k);
    setPathfinderActive(!!view.pathfinder?.active);
    setPathfinderStartNode(nodeById.get(normalizeNodeId(view.pathfinder?.startNodeId)) || null);
    setPathfinderEndNode(nodeById.get(normalizeNodeId(view.pathfinder?.endNodeId)) || null);
    setPathDetailsExpanded(!!view.pathfinder?.detailsExpanded);
    setShortestPathNodes(new Set());
    setShortestPathLinks(new Set());
    setShortestPathArray([]);
    setPrimarySubject(snapshot.context?.primarySubject || null);
    setLastSearchContext(null);
    setLoadingMore(false);
    setSelectedSidebarCompany(null);
    setPendingSubsidiaries(null);
    setApoderadosSidebar({ open: false, company: null });
    setAutocompleteOptions([]);
    setSelectedAutocomplete(null);
    setOfficerDeputyMatches(
      snapshot.enrichments?.officerDeputyMatches && typeof snapshot.enrichments.officerDeputyMatches === 'object'
        ? snapshot.enrichments.officerDeputyMatches
        : {}
    );
    setPreviewOpen(false);
    setPreviewData(null);
    setIsNodeNoteDialogOpen(false);
    setNodeNotePreviewId(null);
    setNodeNoteTargetId(null);
    setNodeContextMenu(null);
    setError(null);
    setSnapshotNotice(notice || '');
  }, []);

  const importGraphSnapshot = useCallback(async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_GRAPH_SNAPSHOT_BYTES) throw new Error(text.snapshotTooLarge);
      const snapshot = parseGraphSnapshot(await file.text());
      applyGraphSnapshot(
        snapshot,
        text.snapshotImported(snapshot.graph.nodes.length, snapshot.graph.links.length)
      );
    } catch (err) {
      const message = err.message === text.snapshotTooLarge ? err.message : text.snapshotImportError(err.message);
      setError(message);
    }
  }, [applyGraphSnapshot, text]);

  useEffect(() => {
    if (!embedded) {
      autosaveReadyRef.current = true;
      return undefined;
    }

    const hasInitialRequest = Boolean(
      initialCompanyData || initialOfficerData || initialCompanyName
    );
    if (hasInitialRequest) {
      autosaveReadyRef.current = true;
      return undefined;
    }

    let cancelled = false;
    loadGraphAutosave()
      .then(record => {
        if (cancelled) return;
        if (!record) {
          autosaveReadyRef.current = true;
          return;
        }
        const snapshot = parseGraphSnapshot(record.snapshot);
        if (snapshot.graph.nodes.length === 0) {
          autosaveReadyRef.current = true;
          clearGraphAutosave().catch(() => {});
          return;
        }
        setPendingAutosaveRecord({ ...record, snapshot });
      })
      .catch(() => {
        if (cancelled) return;
        autosaveReadyRef.current = true;
        setAutosaveStatus('error');
        clearGraphAutosave().catch(() => {});
      });

    return () => {
      cancelled = true;
    };
  }, [embedded, initialCompanyData, initialOfficerData, initialCompanyName]);

  const startFreshAutosaveSession = useCallback(() => {
    autosaveWriteIdRef.current += 1;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveReadyRef.current = true;
    setPendingAutosaveRecord(null);
    setAutosaveSavedAt(null);
    setAutosaveStatus('idle');
    clearGraphAutosave().catch(() => setAutosaveStatus('error'));
  }, []);

  const restoreAutosavedSession = useCallback(() => {
    if (!pendingAutosaveRecord) return;
    const snapshot = pendingAutosaveRecord.snapshot;
    applyGraphSnapshot(
      snapshot,
      text.autosaveRestored(snapshot.graph.nodes.length, snapshot.graph.links.length),
      'autosave'
    );
    autosaveReadyRef.current = true;
    setAutosaveSavedAt(pendingAutosaveRecord.savedAt);
    setAutosaveStatus('saved');
    setPendingAutosaveRecord(null);
  }, [applyGraphSnapshot, pendingAutosaveRecord, text]);

  useEffect(() => {
    if (!embedded || !autosaveReadyRef.current || graphData.nodes.length === 0) {
      return undefined;
    }

    const writeId = autosaveWriteIdRef.current + 1;
    autosaveWriteIdRef.current = writeId;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setAutosaveStatus('saving');

    autosaveTimerRef.current = setTimeout(() => {
      try {
        const snapshot = buildCurrentGraphSnapshot();
        const savedAt = new Date().toISOString();
        saveGraphAutosave(snapshot, { savedAt })
          .then(() => {
            if (autosaveWriteIdRef.current !== writeId) return;
            setAutosaveSavedAt(savedAt);
            setAutosaveStatus('saved');
          })
          .catch(() => {
            if (autosaveWriteIdRef.current === writeId) setAutosaveStatus('error');
          });
      } catch {
        if (autosaveWriteIdRef.current === writeId) setAutosaveStatus('error');
      }
    }, 900);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [autosaveRevision, buildCurrentGraphSnapshot, embedded, graphData.nodes.length]);

  useEffect(() => {
    if (!embedded) return undefined;
    const flushAutosave = () => {
      if (!autosaveReadyRef.current || graphData.nodes.length === 0) return;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      try {
        saveGraphAutosave(buildCurrentGraphSnapshot()).catch(() => {});
      } catch {
        // Best-effort page-exit save; the last completed autosave remains available.
      }
    };
    window.addEventListener('pagehide', flushAutosave);
    return () => window.removeEventListener('pagehide', flushAutosave);
  }, [buildCurrentGraphSnapshot, embedded, graphData.nodes.length]);

  const autosaveTimeLabel = React.useMemo(
    () => autosaveSavedAt ? formatAutosaveTimestamp(autosaveSavedAt, uiLanguage) : '',
    [autosaveSavedAt, uiLanguage]
  );

  // Toggle fullscreen. The CSS overlay (position:fixed / inset:0, applied by the
  // embedded container below when isFullscreen) is what ACTUALLY fills the screen,
  // and it works everywhere — including the Capacitor Android WebView, where the
  // native Fullscreen API is a silent no-op (the previous native-first path resolved
  // but did nothing, leaving the graph cramped). So we always drive the overlay
  // state, and treat the native Fullscreen API as a best-effort web enhancement
  // (hides the browser chrome) layered on top — never depended on.
  const toggleFullscreen = useCallback(() => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    const el = fullscreenContainerRef.current;
    if (el && document.fullscreenEnabled) {
      try {
        if (next && !document.fullscreenElement && typeof el.requestFullscreen === 'function') {
          el.requestFullscreen().catch(() => {});
        } else if (!next && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
          document.exitFullscreen().catch(() => {});
        }
      } catch {
        /* native fullscreen unavailable — the CSS overlay already covers it */
      }
    }
    // The canvas resizes (panel hidden ⇄ shown, overlay on ⇄ off); re-fit the graph
    // to the new size once the layout has settled so it re-centers instead of sitting
    // off to one side.
    setTimeout(() => {
      try { fgRef.current?.zoomToFit(400, 60); } catch { /* ref not ready */ }
    }, 300);
  }, [isFullscreen]);

  // Table drag handlers (always absolute, relative to offsetParent container)
  const handleTableDragStart = useCallback(e => {
    // Drag only with primary mouse button.
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const tableEl = tableDragRef.current?.closest('[data-floating-table]');
    if (!tableEl) return;
    const tableRect = tableEl.getBoundingClientRect();
    const parentRect = tableEl.offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };
    // Current position relative to the container
    const currentLeft = tableRect.left - parentRect.left;
    const currentTop = tableRect.top - parentRect.top;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: currentLeft,
      posY: currentTop,
    };

    const handleMove = ev => {
      const dx = ev.clientX - dragStartRef.current.x;
      const dy = ev.clientY - dragStartRef.current.y;
      setTablePosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove, true);
      document.removeEventListener('mouseup', handleUp, true);
    };
    // Capture phase avoids losing mouseup when parent containers stop bubbling.
    document.addEventListener('mousemove', handleMove, true);
    document.addEventListener('mouseup', handleUp, true);
  }, []);

  // Apply a chosen autocomplete suggestion. Search is selection-only: we always
  // act on a real, specific database entity here, never a free-text query (which
  // used to dump an arbitrary relevance-capped slice of companies onto the graph).
  // Each option carries its own `type`, so we route per-item — companies, people
  // and sole-shareholders all dispatch correctly without a mode toggle.
  const applySelectedOption = (value, selectionMethod = 'autocomplete') => {
    if (!value || typeof value !== 'object') return;
    setSelectedAutocomplete(value);
    // Display: new/current name; Search: canonical key (original_name for aliases).
    // The profile is stored under the ORIGINAL name when the company was renamed,
    // so downstream lookups must use that (e.g. "CACTUS CAPITAL" → search
    // "EJEVAERN CONSULTING" to find the actual profile).
    const displayName = value.name || value.company_name || value.value || '';
    const selectionIndex = autocompleteOptions.findIndex(option =>
      option === value || (
        (option.id || option.value || option.label) === (value.id || value.value || value.label)
        && option.type === value.type
      )
    );
    trackEvent('graph_search_selection', {
      entry_source: entrySource,
      entity_type: value.type || 'unknown',
      selection_method: selectionMethod,
      selection_rank: selectionIndex >= 0 ? selectionIndex + 1 : 0,
      time_to_selection_ms: Date.now() - graphEnteredAtRef.current,
    });

    // Sole shareholder selection: plot the shareholder node and stage its
    // participadas behind a confirmation pill. Avoids N silent parallel v3
    // lookups on every selection, and shows the true total.
    const isSoleShareholderCorporate = value.type === 'sole_shareholder';
    const isSoleShareholderIndividual =
      value.type === 'officer_sole_shareholder' || value.is_sole_shareholder;

    // The market sidebar follows whatever entity you select (non-sticky, unlike
    // the DD subject). We set the raw selection name and let matchIbexSeed
    // decide: an IBEX company name matches and opens the sidebar; anything else
    // — a non-IBEX company, or a person (autocomplete types some owning
    // companies as "officer") — doesn't match, so the sidebar closes. Any
    // selection re-arms a prior manual dismiss (even re-selecting the same one).
    setSelectedSidebarCompany(displayName);
    setIbexSidebarDismissed(false);

    if (
      (isSoleShareholderCorporate || isSoleShareholderIndividual) &&
      (value.owns_total > 0 || (Array.isArray(value.owns) && value.owns.length > 0))
    ) {
      const entityKind = isSoleShareholderCorporate ? 'company' : 'person';
      const entityId = plotBareShareholderNode(displayName, entityKind);
      const total = value.owns_total || value.owns?.length || 0;
      setPendingSubsidiaries({ entityName: displayName, entityId, entityKind, count: total });
      trackEvent('graph_search_result', {
        entry_source: entrySource,
        search_origin: 'user_selection',
        entity_type: entityKind,
        result_state: 'success',
        result_count: total,
      });
      setSearchQuery('');
      return;
    }

    // Person selection → officer search (find every company they're linked to).
    if (value.type === 'officer') {
      const officerName = value.value || value.name || displayName;
      setSearchQuery(displayName);
      handleSearch(officerName, false, 'officer', null);
      return;
    }

    // Company selection → bind to the exact legal entity via its stable id
    // (group_key) so an ambiguous name resolves to the right doc.
    const searchKey = value.is_alias
      ? (value.original_name || value.value || displayName)
      : (value.company_name_normalized || value.value || displayName);
    setSearchQuery(displayName);
    handleSearch(searchKey, true, 'company', value.id || null);
  };

  // Shared search panel content
  const searchPanelContent = (
    <Paper sx={{ p: 1, px: 1.5, m: embedded ? 0 : 2, mb: 0 }}>
      {DATA_MAINTENANCE.enabled && (
        <Alert
          severity="info"
          sx={{
            mb: 1.25,
            '& .MuiAlert-message': { width: '100%' },
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {DATA_MAINTENANCE.title}
          </Typography>
          <Typography variant="body2">{DATA_MAINTENANCE.message}</Typography>
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Company/officer toggle removed: the unified autocomplete returns both,
            so there's nothing to pre-select. Search is driven entirely by picking
            a real suggestion. */}
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>{text.companies}</InputLabel>
          <Select
            value={companiesPerSearch}
            onChange={e => setCompaniesPerSearch(Number(e.target.value))}
            label={text.companies}
          >
            {COMPANIES_PER_SEARCH_OPTIONS.map(size => (
              <MenuItem key={size} value={size}>
                {size}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>{text.officersPerCompany}</InputLabel>
          <Select
            value={officersPerCompany}
            onChange={e => {
              // "all" is a transient action, NOT a cap value: open the apoderados
              // sidebar for the focused company and leave officersPerCompany
              // (and thus the Select's displayed numeric value) unchanged.
              if (e.target.value === 'all') {
                const focused = resolveFocusedCompany();
                if (focused) setApoderadosSidebar({ open: true, company: focused });
                return;
              }
              setOfficersPerCompany(Number(e.target.value));
            }}
            label={text.officersPerCompany}
          >
            {OFFICERS_PER_COMPANY_OPTIONS.map(size => (
              <MenuItem key={size} value={size}>
                {size}
              </MenuItem>
            ))}
            <MenuItem value="all">{text.fetchAllOfficers}</MenuItem>
          </Select>
        </FormControl>

        <Autocomplete
          freeSolo
          autoHighlight
          options={autocompleteOptions}
          loading={autocompleteLoading}
          inputValue={searchQuery}
          value={selectedAutocomplete}
          filterOptions={x => x}
          onInputChange={(event, newValue, reason) => {
            setSearchQuery(newValue);
            if (reason === 'input') {
              if (newValue && !searchTypingTrackedRef.current) {
                searchTypingTrackedRef.current = true;
                trackEvent('graph_search_typing_started', {
                  entry_source: entrySource,
                  time_to_type_ms: Date.now() - graphEnteredAtRef.current,
                });
              }
              setLastSearchContext(null);
              setSelectedAutocomplete(null);
              handleAutocomplete(newValue);
            } else if (reason === 'clear') {
              setLastSearchContext(null);
              setAutocompleteOptions([]);
            }
          }}
          onChange={(event, value) => {
            if (value && typeof value === 'object') {
              applySelectedOption(value, 'autocomplete');
            } else if (typeof value === 'string') {
              // Free-typed text (freeSolo) is not a real entity — never search it.
              setSearchQuery(value);
              setSelectedAutocomplete(null);
            }
          }}
          getOptionLabel={option => {
            if (typeof option === 'string') return option;
            return option.label || option.value || '';
          }}
          isOptionEqualToValue={(option, value) => {
            if (typeof value === 'string') return option.label === value;
            return option.label === value?.label;
          }}
          renderOption={(props, option) => {
            // An officer suggestion's `type` is 'officer'/'officer_sole_shareholder'
            // regardless of whether the officer itself is a company (e.g. a
            // corporate administrador like "CAJAMAR GESTION SGIIC SA"), so fall
            // back to the name-based legal-entity check to pick the right icon.
            const isCompanyLike =
              option.type === 'company' || isLegalEntityName(option.name || option.label);
            return (
            <Box component="li" {...props} key={option.label + (option.cif || '')}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%' }}>
                {option.type === 'sole_shareholder' ? (
                  <AccountTreeIcon sx={{ fontSize: 16, color: 'warning.main', mt: 0.3 }} />
                ) : isCompanyLike ? (
                  <BusinessIcon sx={{ fontSize: 16, color: 'primary.main', mt: 0.3 }} />
                ) : (
                  <PersonIcon sx={{ fontSize: 16, color: 'info.main', mt: 0.3 }} />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    <Typography variant="body2">{option.name || option.label}</Typography>
                    {option.type === 'sole_shareholder' && (
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.65rem',
                          color: 'warning.dark',
                          bgcolor: 'warning.light',
                          px: 0.6,
                          py: 0.1,
                          borderRadius: 0.5,
                        }}
                      >
                        {text.soleShareholder}
                      </Typography>
                    )}
                    {option._deputyMatch?.deputy && (
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          color: option._deputyMatch.deputy.FECHABAJA
                            ? 'text.secondary'
                            : 'warning.dark',
                          bgcolor: option._deputyMatch.deputy.FECHABAJA
                            ? 'grey.100'
                            : 'warning.light',
                          px: 0.6,
                          py: 0.1,
                          borderRadius: 0.5,
                        }}
                      >
                        🏛️ {option._deputyMatch.deputy.FECHABAJA ? text.formerCongressDeputy : text.congressDeputy}
                        {option._deputyMatch.deputy.FORMACIONELECTORAL
                          ? ` · ${option._deputyMatch.deputy.FORMACIONELECTORAL}`
                          : ''}
                      </Typography>
                    )}
                  </Box>
                  {option.type === 'sole_shareholder' &&
                    ((option.owns_total || 0) > 0 || (option.owns && option.owns.length > 0)) && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', fontStyle: 'italic' }}
                      >
                        {text.whollyOwned(option.owns_total || option.owns?.length || 0)}
                      </Typography>
                    )}
                  {option.is_alias && option.original_name && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {text.previous}: {option.original_name}
                    </Typography>
                  )}
                  {option.has_new_name && option.new_company_name && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {uiLanguage === 'en' ? 'Now' : 'Ahora'}: {option.new_company_name}
                    </Typography>
                  )}
                  {option.type === 'company' && option.cif && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {option.cif}
                    </Typography>
                  )}
                  {(option.type === 'officer' || option.type === 'officer_sole_shareholder') &&
                    option.company_count != null && option.company_count > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {uiLanguage === 'en'
                          ? `${option.company_count} compan${option.company_count === 1 ? 'y' : 'ies'} (${text.role.toLowerCase()})`
                          : `${option.company_count} empresa${option.company_count !== 1 ? 's' : ''} (cargo)`}
                      </Typography>
                    )}
                  {option.is_sole_shareholder &&
                    ((option.owns_total || 0) > 0 || (option.owns && option.owns.length > 0)) && (
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', color: 'warning.dark', fontStyle: 'italic' }}
                      >
                        {text.whollyOwned(option.owns_total || option.owns?.length || 0)}
                      </Typography>
                    )}
                </Box>
              </Box>
            </Box>
            );
          }}
          sx={{
            flexGrow: 1,
            minWidth: 200,
            '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main',
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.light',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main',
              borderWidth: 2,
            },
          }}
          renderInput={params => (
            <TextField
              {...params}
              size="small"
              placeholder={text.searchUnifiedPlaceholder}
              onFocus={() => {
                if (searchFocusTrackedRef.current) return;
                searchFocusTrackedRef.current = true;
                trackEvent('graph_search_focus', {
                  entry_source: entrySource,
                  time_to_focus_ms: Date.now() - graphEnteredAtRef.current,
                });
              }}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                    {params.InputProps.startAdornment}
                  </>
                ),
                endAdornment: (
                  <>
                    {autocompleteLoading || isSearching ? <CircularProgress size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />

        <Button
          variant="contained"
          onClick={() => autocompleteOptions.length > 0 && applySelectedOption(autocompleteOptions[0], 'search_button')}
          disabled={isSearching || autocompleteOptions.length === 0}
          startIcon={isSearching ? <CircularProgress size={16} /> : <SearchIcon />}
        >
          {text.search}
        </Button>
        {graphData.nodes.some(n => n.type === 'company' || n.type === 'spanish-company-group') && (
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<DescriptionIcon />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              color: '#04231f',
              boxShadow: '0 2px 10px rgba(20,184,166,0.35)',
            }}
            onClick={() => {
              // DD is per-company. Prefer the sticky subject (always a company,
              // and may carry corrections for the Custom option); fall back to the
              // latest company search — never an officer query.
              const lastCompanyQuery =
                lastSearchContext?.searchType === 'company' ? lastSearchContext.query : '';
              const name = (
                (correctionsCount > 0 && primarySubject)
                  ? primarySubject
                  : (primarySubject || lastCompanyQuery || '')
              ).trim();
              if (!name) return;
              setDdCheckoutCompany(name);
              setDdCheckoutOpen(true);
            }}
          >
            {text.dueDiligence}
          </Button>
        )}
        {visibleCompanyCount >= 2 && (
          <Tooltip title={text.relationshipReportTooltip}>
            <span>
              <Badge badgeContent={visibleCompanyCount} color="primary"
                sx={{ '& .MuiBadge-badge': { right: 2, top: 2 } }}>
                <Button
                  variant="contained" color="primary" size="small"
                  startIcon={relResolving ? <CircularProgress size={14} /> : <AccountTreeIcon />}
                  disabled={relResolving}
                  sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(20,184,166,0.35)' }}
                  onClick={openRelationshipReport}>
                  {text.relationshipReport}
                </Button>
              </Badge>
            </span>
          </Tooltip>
        )}
        {visibleCompanyCount >= 2 && (
          <Tooltip title={showSharedConnections ? text.hideShared : text.showShared}>
            <Button
              variant={showSharedConnections ? 'contained' : 'outlined'}
              color="info" size="small"
              startIcon={<HubIcon />}
              sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
              onClick={() => setShowSharedConnections(v => !v)}>
              {showSharedConnections ? `${text.sharedConnections} ✓` : text.sharedConnections}
            </Button>
          </Tooltip>
        )}
        {subjectCompanyName && correctionsCount > 0 && (
          <Tooltip title={text.myCorrectionsTooltip}>
            <Chip
              icon={<FactCheckIcon />}
              label={text.myCorrections(correctionsCount)}
              size="small"
              color="info"
              variant="outlined"
              onClick={openMyCorrections}
              sx={{ fontWeight: 600 }}
            />
          </Tooltip>
        )}
        <TextField
          label={text.filterNodes}
          placeholder={text.filterPlaceholder}
          value={labelFilterText}
          onChange={e => setLabelFilterText(e.target.value)}
          size="small"
          sx={{ flexGrow: 0.5, minWidth: 150 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Tooltip title={text.legalTooltip}>
          <IconButton
            onClick={() => setLegalDisclaimerOpen(true)}
            size="small"
            aria-label={text.legalLabel}
          >
            <InfoIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={text.pathfinderTooltip}>
          <IconButton
            onClick={() => setPathfinderActive(!pathfinderActive)}
            color={pathfinderActive ? "primary" : "default"}
            size="small"
            aria-label={text.pathfinderTooltip}
          >
            <RouteIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={text.graphSettingsTitle}>
          <IconButton
            onClick={() => setShowSettings(!showSettings)}
            color={showSettings ? 'primary' : 'default'}
            aria-label={text.graphSettingsTitle}
          >
            <TuneIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Pathfinder Panel */}
      {pathfinderActive && (
        <Paper
          elevation={1}
          sx={{
            mt: 1.5,
            p: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <RouteIcon color="primary" />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {text.pathfinderTitle}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setPathfinderActive(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              mb: 2,
            }}
          >
            <Autocomplete
              options={filteredGraphData.nodes}
              getOptionLabel={(option) => option.name || option.label || ''}
              value={pathfinderStartNode}
              onChange={(event, newValue) => setPathfinderStartNode(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={text.originNode}
                  size="small"
                  placeholder={text.nodePlaceholder}
                />
              )}
              renderOption={(props, option) => {
                const { key, ...restProps } = props;
                return (
                  <Box key={option.id} component="li" {...restProps} sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                    <Typography variant="body2">{option.name || option.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.type === 'officer'
                        ? `👥 ${option.subtype === 'company' ? text.officerCompany : text.officerIndividual}`
                        : `🏢 ${text.company}`}
                    </Typography>
                  </Box>
                );
              }}
              sx={{ flexGrow: 1 }}
            />

            <Autocomplete
              options={filteredGraphData.nodes}
              getOptionLabel={(option) => option.name || option.label || ''}
              value={pathfinderEndNode}
              onChange={(event, newValue) => setPathfinderEndNode(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={text.destinationNode}
                  size="small"
                  placeholder={text.nodePlaceholder}
                />
              )}
              renderOption={(props, option) => {
                const { key, ...restProps } = props;
                return (
                  <Box key={option.id} component="li" {...restProps} sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                    <Typography variant="body2">{option.name || option.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.type === 'officer'
                        ? `👥 ${option.subtype === 'company' ? text.officerCompany : text.officerIndividual}`
                        : `🏢 ${text.company}`}
                    </Typography>
                  </Box>
                );
              }}
              sx={{ flexGrow: 1 }}
            />

            {(pathfinderStartNode || pathfinderEndNode) && (
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                onClick={() => {
                  setPathfinderStartNode(null);
                  setPathfinderEndNode(null);
                  setPathDetailsExpanded(false);
                }}
                sx={{ alignSelf: { sm: 'center' }, height: 40 }}
              >
                {text.clear}
              </Button>
            )}
          </Box>

          {/* Path Display */}
          {pathfinderStartNode && pathfinderEndNode && (
            <Box sx={{ mt: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              {shortestPathArray.length > 0 ? (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {text.connectionFound(shortestPathArray.length - 1)}
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setPathDetailsExpanded(prev => !prev)}
                      endIcon={pathDetailsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      sx={{ minHeight: 26, py: 0, textTransform: 'none' }}
                    >
                      {pathDetailsExpanded ? text.hideDetail : text.showDetail}
                    </Button>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'nowrap',
                      gap: 1,
                      mt: 1,
                      overflowX: 'auto',
                      pb: 0.5,
                    }}
                  >
                    {shortestPathArray.map((nodeId, idx) => {
                      const matchedNode = filteredGraphData.nodes.find(n => n.id === nodeId);
                      const isStart = idx === 0;
                      const isEnd = idx === shortestPathArray.length - 1;

                      return (
                        <React.Fragment key={nodeId}>
                          {idx > 0 && (
                            <Typography variant="body2" color="primary" sx={{ mx: 0.5, fontWeight: 'bold' }}>
                              ➔
                            </Typography>
                          )}
                          <Chip
                            label={matchedNode ? (matchedNode.name || matchedNode.label) : nodeId}
                            size="small"
                            color={isStart ? "success" : isEnd ? "error" : "primary"}
                            variant={isStart || isEnd ? "filled" : "outlined"}
                            icon={matchedNode?.type === 'officer' ? <PersonIcon /> : <BusinessIcon />}
                            sx={{
                              fontWeight: isStart || isEnd ? 'bold' : 'normal',
                              maxWidth: 280,
                              flexShrink: 0,
                            }}
                          />
                        </React.Fragment>
                      );
                    })}
                  </Box>
                  {pathDetailsExpanded && (
                  <Box
                    sx={{
                      mt: 1.5,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      maxHeight: 220,
                      overflowY: 'auto',
                      pr: 0.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {text.pathDetails}
                    </Typography>
                    {pathSegments.map((segment, idx) => (
                      <Paper
                        key={segment.id}
                        variant="outlined"
                        sx={{
                          p: 1,
                          bgcolor: 'background.paper',
                          borderColor: 'divider',
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            flexWrap: 'wrap',
                            mb: 0.5,
                          }}
                        >
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                            {text.jump(idx + 1)}
                          </Typography>
                          <Chip
                            size="small"
                            variant="outlined"
                            icon={segment.sourceNode?.type === 'officer' ? <PersonIcon /> : <BusinessIcon />}
                            label={getPathNodeName(segment.sourceNode)}
                            sx={{ maxWidth: 260 }}
                          />
                          <Typography variant="caption" color="primary" sx={{ fontWeight: 700 }}>
                            →
                          </Typography>
                          <Chip
                            size="small"
                            variant="outlined"
                            icon={segment.targetNode?.type === 'officer' ? <PersonIcon /> : <BusinessIcon />}
                            label={getPathNodeName(segment.targetNode)}
                            sx={{ maxWidth: 260 }}
                          />
                        </Box>
                        <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                          <strong>{segment.summary.relationship}</strong>
                          {' · '}
                          {segment.summary.category}
                          {segment.summary.date ? ` · ${text.lastRecord}: ${segment.summary.date}` : ''}
                          {segment.summary.extraCount > 0 ? ` · ${text.moreRelationships(segment.summary.extraCount)}` : ''}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {text.connectedWith(
                            getPathNodeKindLabel(segment.sourceNode, uiLanguage),
                            getPathNodeKindLabel(segment.targetNode, uiLanguage),
                            segment.links.length
                          )}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="error" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  ⚠️ {text.noConnection}
                </Typography>
              )}
            </Box>
          )}
        </Paper>
      )}

      {pendingSubsidiaries && (
        <Box
          sx={{
            mt: 1,
            mx: 2,
            p: 1.2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            bgcolor: 'warning.50',
            border: '1px solid',
            borderColor: 'warning.light',
            borderRadius: 1,
          }}
        >
          <Typography variant="body2" sx={{ flex: 1 }}>
            {text.soleShareholderOf(pendingSubsidiaries.entityName, pendingSubsidiaries.count)}
          </Typography>
          <Button
            size="small"
            variant="contained"
            color="warning"
            disabled={loadingSubsidiaries}
            onClick={() =>
              loadSubsidiariesForShareholder(
                pendingSubsidiaries.entityName,
                pendingSubsidiaries.entityId,
                pendingSubsidiaries.entityKind
              )
            }
            startIcon={loadingSubsidiaries ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {loadingSubsidiaries
              ? text.loading
              : text.loadSubsidiaries(pendingSubsidiaries.count)}
          </Button>
          <IconButton size="small" onClick={() => setPendingSubsidiaries(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {lastSearchContext && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            {text.loaded}: {lastSearchContext.offset}
            {lastSearchContext.total ? ` / ${lastSearchContext.total}` : ''}
          </Typography>
          {lastSearchContext.hasMore && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleLoadMore}
              disabled={loadingMore || isSearching}
              sx={{ textTransform: 'none' }}
            >
              {loadingMore ? <CircularProgress size={14} /> : text.loadMore}
            </Button>
          )}
        </Box>
      )}

      {/* Status & position filter chips */}
      {graphData.links.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
            <Chip
              label={`${text.active} (${statusCounts.active})`}
              size="small"
              variant={statusFilters.has('active') ? 'filled' : 'outlined'}
              color="success"
              onClick={() => setStatusFilters(prev => {
                const next = new Set(prev);
                next.has('active') ? next.delete('active') : next.add('active');
                return next;
              })}
            />
            <Chip
              label={`${text.ceased} (${statusCounts.ceased})`}
              size="small"
              variant={statusFilters.has('ceased') ? 'filled' : 'outlined'}
              color="error"
              onClick={() => setStatusFilters(prev => {
                const next = new Set(prev);
                next.has('ceased') ? next.delete('ceased') : next.add('ceased');
                return next;
              })}
            />
            <Tooltip
              arrow
              title={text.statusTooltip}
            >
              <InfoIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Chip
              label={text.soleShareholder}
              size="small"
              variant={showShareholders ? 'filled' : 'outlined'}
              sx={
                showShareholders
                  ? { bgcolor: '#fbc02d', color: '#212121', '&:hover': { bgcolor: '#f9a825' } }
                  : { borderColor: '#fbc02d', color: '#9e7b10' }
              }
              onClick={() => setShowShareholders(prev => !prev)}
            />
            <Chip
              label={text.previousSoleShareholder}
              size="small"
              variant={showPreviousShareholders ? 'filled' : 'outlined'}
              sx={
                showPreviousShareholders
                  ? { bgcolor: '#9e9e9e', color: '#212121', '&:hover': { bgcolor: '#8d8d8d' } }
                  : { borderColor: '#9e9e9e', color: '#616161' }
              }
              onClick={() => setShowPreviousShareholders(prev => !prev)}
            />
            <Chip
              label={
                simplifyGraph && simplifiedLowValueCount > 0
                  ? `${text.simplify} (${simplifiedLowValueCount} ${text.hidden})`
                  : text.simplify
              }
              size="small"
              variant={simplifyGraph ? 'filled' : 'outlined'}
              color={simplifyGraph ? 'info' : 'default'}
              onClick={() => setSimplifyGraph(prev => !prev)}
            />
            {cargoToggleNode && (
              <Tooltip arrow title={text.cargoToggleTooltip}>
                <Chip
                  label={text.cargoToggleLabel(
                    cargoToggleNode.unified
                      ? (cargoToggleNode.unifiedCargoCount || 0)
                      : (cargoToggleNode.cargoCount || 0)
                  )}
                  size="small"
                  icon={
                    isUnifying
                      ? <CircularProgress size={12} sx={{ color: 'inherit', ml: 0.5 }} />
                      : <HubIcon sx={{ fontSize: 15 }} />
                  }
                  variant={cargoToggleNode.unified ? 'filled' : 'outlined'}
                  disabled={isUnifying}
                  onClick={() =>
                    cargoToggleNode.unified
                      ? undoCargoUnifyForNode(cargoToggleNode.id)
                      : unifyCargosForNode(cargoToggleNode.id, cargoToggleNode.name)
                  }
                  sx={
                    cargoToggleNode.unified
                      ? { bgcolor: '#0d9488', color: '#ecfeff', fontWeight: 600, '& .MuiChip-icon': { color: '#5eead4' }, '&:hover': { bgcolor: '#0f766e' } }
                      : { borderColor: '#5eead4', color: '#5eead4', '& .MuiChip-icon': { color: '#5eead4' } }
                  }
                />
              </Tooltip>
            )}
            {availablePositionCount > 0 && (
              <Button
                size="small"
                variant={selectedPositionFilterCount > 0 ? 'contained' : 'outlined'}
                endIcon={positionFiltersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => setPositionFiltersExpanded(prev => !prev)}
                sx={{ minHeight: 24, py: 0, px: 1, textTransform: 'none', borderRadius: 4 }}
              >
                {selectedPositionFilterCount > 0
                  ? `${text.positions} (${selectedPositionFilterCount}/${availablePositionCount})`
                  : `${text.positions} (${availablePositionCount})`}
              </Button>
            )}
            {hasChipFilters && (
              <Chip
                label={text.clearFilters}
                size="small"
                variant="outlined"
                onDelete={() => {
                  setStatusFilters(new Set());
                  setPositionFilters(new Set());
                }}
              />
            )}
          </Box>
          {positionFiltersExpanded && availablePositionCount > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                mt: 0.75,
                maxHeight: { xs: 96, sm: 120 },
                overflowY: 'auto',
                pr: 0.5,
              }}
            >
              {availablePositions.map(({ category, count }) => (
                <Chip
                  key={category}
                  label={`${category} (${count})`}
                  size="small"
                  variant={positionFilters.has(category) ? 'filled' : 'outlined'}
                  onClick={() => setPositionFilters(prev => {
                    const next = new Set(prev);
                    next.has(category) ? next.delete(category) : next.add(category);
                    return next;
                  })}
                />
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Graph Control Panel — layout, labels, node size, color-by-network in one place */}
      {showSettings && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <TuneIcon fontSize="small" /> {text.graphSettingsTitle}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: 2,
              alignItems: 'center',
            }}
          >
            <Box>
              <Typography variant="caption">{text.spacing}</Typography>
              <Slider
                value={spacing}
                onChange={(e, value) => setSpacing(value)}
                min={0.5}
                max={2.5}
                step={0.1}
                size="small"
              />
            </Box>
            <Box>
              <Typography variant="caption">{text.nodeSize}</Typography>
              <Slider
                value={nodeSize}
                onChange={(e, value) => setNodeSize(value)}
                min={4}
                max={28}
                step={1}
                size="small"
              />
            </Box>
            <Box>
              <Typography variant="caption">{text.labelSize}</Typography>
              <Slider
                value={labelSize}
                onChange={(e, value) => setLabelSize(value)}
                min={3}
                max={18}
                step={0.5}
                size="small"
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={colorByCluster}
                    onChange={(e) => setColorByCluster(e.target.checked)}
                    size="small"
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                    {text.colorByNetworks}
                  </Typography>
                }
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* Error Display */}
      {error && (
        <Alert
          severity={typeof error === 'object' && error.kind === 'maintenance' ? 'info' : 'error'}
          sx={{ mt: 2 }}
          onClose={() => setError(null)}
        >
          {typeof error === 'object' && error.kind === 'maintenance' ? (
            <>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {error.title}
              </Typography>
              <Typography variant="body2">{error.message}</Typography>
            </>
          ) : (
            error
          )}
        </Alert>
      )}
    </Paper>
  );

  // Shared graph area content (controls + graph/table split + legend)
  const graphAreaContent = (
    <>
      {/* Graph Controls */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 0.5,
          px: 1,
          py: 0.25,
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
          <Tooltip title={text.zoomIn}>
            <IconButton onClick={zoomIn} size="small">
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={text.zoomOut}>
            <IconButton onClick={zoomOut} size="small">
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={text.center}>
            <IconButton onClick={centerGraph} size="small">
              <CenterIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={text.clearGraph}>
            <IconButton onClick={clearGraph} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={text.exportGraph}>
            <span>
              <IconButton
                onClick={exportGraphSnapshot}
                size="small"
                disabled={graphData.nodes.length === 0 || isSearching || isLoading || loadingMore || loadingSubsidiaries}
              >
                <DownloadIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={text.importGraph}>
            <IconButton
              onClick={() => snapshotInputRef.current?.click()}
              size="small"
              disabled={isSearching || isLoading || loadingMore || loadingSubsidiaries}
            >
              <UploadFileIcon />
            </IconButton>
          </Tooltip>
          <input
            ref={snapshotInputRef}
            type="file"
            accept="application/json,.json"
            onChange={importGraphSnapshot}
            hidden
          />
          <Tooltip
            title={
              isFullscreen
                ? text.fullscreenExit
                : embedded
                  ? text.fullscreenEmbedded
                  : text.fullscreen
            }
          >
            <IconButton onClick={toggleFullscreen} size="small">
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          {embedded && graphData.nodes.length > 0 && autosaveStatus !== 'idle' && (
            <Chip
              label={
                autosaveStatus === 'saving'
                  ? text.autosaveSaving
                  : autosaveStatus === 'saved'
                    ? text.autosaveSavedAt(autosaveTimeLabel)
                    : text.autosaveUnavailable
              }
              icon={
                autosaveStatus === 'saving'
                  ? <CircularProgress size={12} color="inherit" />
                  : undefined
              }
              size="small"
              color={autosaveStatus === 'error' ? 'error' : autosaveStatus === 'saved' ? 'success' : 'default'}
              variant="outlined"
              sx={{ height: 22, fontSize: '0.68rem' }}
            />
          )}
          {snapshotMode && (
            <Chip
              label={snapshotSource === 'autosave' ? text.restoredSession : text.importedSnapshot}
              size="small"
              color="info"
              variant="outlined"
              sx={{ height: 22, fontSize: '0.68rem' }}
            />
          )}
          {hiddenNodeIds.size > 0 && (
            <Tooltip title={text.manageHiddenNodes}>
              <Button
                size="small"
                variant="outlined"
                onClick={openHiddenNodesMenu}
                startIcon={<VisibilityIcon sx={{ fontSize: 14 }} />}
                sx={{ fontSize: '0.7rem', py: 0, textTransform: 'none' }}
              >
                {text.hiddenButton(hiddenNodesList.length)}
              </Button>
            </Tooltip>
          )}
          <Typography variant="caption">
            {text.nodes}: {filteredGraphData.nodes.length}
            {filterTerms.length > 0 || hiddenNodeIds.size > 0
              ? ` / ${graphData.nodes.length}`
              : ''}{' '}
            | {text.links}: {filteredGraphData.links.length}
            {filterTerms.length > 0 || hiddenNodeIds.size > 0 ? ` / ${graphData.links.length}` : ''}
          </Typography>
          {isLoading && !isSearching && <CircularProgress size={16} />}
        </Box>
      </Box>
      <Snackbar
        open={!!snapshotNotice}
        autoHideDuration={4500}
        onClose={() => setSnapshotNotice('')}
        message={snapshotNotice}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
      {/* Graph Container (full width, table floats on top) */}
      <Box
        ref={containerCallbackRef}
        sx={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 200, bgcolor: '#0d1220' }}
      >
        {containerReady && (
          <ForceGraph2D
            ref={fgRef}
            graphData={filteredGraphData}
            nodeCanvasObject={nodeCanvasObject}
            linkCanvasObject={linkCanvasObject}
            nodePointerAreaPaint={(node, color, ctx) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI, false);
              ctx.fill();
              if (hasNodeNote(node)) {
                const marker = getNodeNoteMarkerGeometry(node, nodeSize);
                ctx.beginPath();
                ctx.arc(marker.x, marker.y, marker.radius + 2, 0, 2 * Math.PI, false);
                ctx.fill();
              }
            }}
            onNodeClick={handleNodeClick}
            onNodeRightClick={handleNodeRightClick}
            onNodeDrag={handleNodeDrag}
            onNodeDragEnd={handleNodeDragEnd}
            onZoom={handleZoom}
            // Light particle flow — DIRECTIONAL edges only (source→target), same gate as
            // the arrowheads in linkCanvasObject (isDirectionalLink, module scope).
            // Arrowheads are drawn manually in linkCanvasObject (built-in
            // linkDirectionalArrow* props are ignored under a custom 'replace'-mode
            // renderer). Kept light: one slow particle so a ~50-edge graph stays smooth.
            linkDirectionalParticles={link => (isDirectionalLink(link) ? 2 : 0)}
            linkDirectionalParticleSpeed={0.006}
            linkDirectionalParticleWidth={3}
            // Bright, edge-matched particle color so the flow is visible on the dark
            // canvas (the default particle color is a faint link tint). Mirrors the
            // linkCanvasObject color rules: amber ownership, red ceased, teal active.
            linkDirectionalParticleColor={link => {
              const cat = (getLinkEffectiveCategory(link) || '').toLowerCase();
              if (link.type === 'ownership' || cat.startsWith('socio')) return '#fbbf24';
              if (
                link.companyDissolved ||
                cat.includes('cese') || cat.includes('dimision') || cat.includes('dimisión') ||
                cat.includes('revocacion') || cat.includes('revocación')
              ) return '#f87171';
              return '#5eead4';
            }}
            d3AlphaDecay={0.08}
            d3VelocityDecay={0.8}
            cooldownTicks={40}
            onEngineTick={handleEngineTick}
            onEngineStop={handleEngineTick}
            width={containerDimensions.width}
            height={containerDimensions.height}
          />
        )}

        {/* Company⇄cargo unify is now a persistent toolbar toggle ("Unify cargos")
            next to Simplify — see cargoToggleNode above. It replaces the old
            discovery banner + transient undo chip: one re-toggleable control that
            both unifies and undoes, paired with the on-node "+N cargos" / "⚭ N"
            badge as the discovery cue. */}

        {/* Loading state — scoped to the graph canvas only, so a search shows a
            calm indicator on the graph surface instead of a bare black viewport.
            Semi-transparent so a re-search dims the existing graph rather than
            blanking it. */}
        {isSearching && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 15,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              bgcolor: 'rgba(13, 18, 32, 0.82)',
              backdropFilter: 'blur(1px)',
              pointerEvents: 'none',
            }}
          >
            <CircularProgress size={40} thickness={4} sx={{ color: '#2dd4bf' }} />
            <Typography variant="body2" sx={{ color: 'rgba(224, 224, 224, 0.75)', letterSpacing: 0.3 }}>
              {searchQuery ? text.searching(searchQuery) : text.loadingData}
            </Typography>
          </Box>
        )}

        {/* Floating AI Investigation Launcher */}
        {(() => {
          const count = investigationSet.size;
          const launch = investigationLaunchState(count);
          const stored = loadToken();
          const nowSec = Math.floor(Date.now() / 1000);
          const label = count > 0
            ? `${text.investigateSelection} (${count})`
            : entitlementChipLabel(stored, nowSec, uiLanguage);
          return (
            <Paper sx={{ position: 'absolute', top: 12, left: 12, zIndex: 20, p: 0.5, display: 'flex', gap: 1, alignItems: 'center', bgcolor: 'rgba(18,24,40,0.9)' }}>
              <Button
                size="small"
                variant={count > 0 ? 'contained' : 'outlined'}
                startIcon={<PsychologyIcon />}
                disabled={!launch.canLaunch}
                // Empty-state launcher is an enabled CTA (focuses the primary
                // company), but the default outlined primary blue (#14b8a6) is
                // near-invisible on the dark rgba(18,24,40,.9) Paper. Brighten
                // to blue[200] with a visible border so it reads on dark.
                sx={count > 0 ? undefined : {
                  color: '#90caf9',
                  borderColor: 'rgba(144,202,249,0.7)',
                  '&:hover': { borderColor: '#90caf9', backgroundColor: 'rgba(144,202,249,0.12)' },
                }}
                onClick={() => {
                  const primary = graphData.nodes.find((n) => isSameNodeId(n.id, activeNodeId))
                    || graphData.nodes.find((n) => typeof primarySubject === 'string' && n.name && n.name.toUpperCase() === primarySubject.toUpperCase())
                    || null;
                  setAiPanelContext(
                    buildInvestigationContext(Array.from(investigationSet), graphData.nodes, graphData.links, primary)
                  );
                  setAiPanelOpen(true);
                }}
              >
                {launch.mode === 'over_cap' ? text.investigationOverCap : label}
              </Button>
            </Paper>
          );
        })()}

        {/* Floating Data Table */}
        <Paper
          data-floating-table
          elevation={6}
          sx={{
            position: 'absolute',
            ...(tablePosition.x != null
              ? { left: tablePosition.x, top: tablePosition.y }
              : { right: 12, top: 12 }),
            width: isTableCollapsed ? 'auto' : 520,
            maxHeight: isTableCollapsed ? 'auto' : '70%',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(8px)',
            border: '1px solid',
            borderColor: 'divider',
            transition: 'width 0.2s ease',
          }}
        >
          {/* Drag header */}
          <Box
            ref={tableDragRef}
            onMouseDown={handleTableDragStart}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              px: 1.5,
              py: 0.75,
              cursor: 'move',
              userSelect: 'none',
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              color: 'white',
              '&:hover': { background: 'linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%)' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              
              <TableIcon sx={{ fontSize: 16 }} />
              <Typography variant="subtitle2" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {text.data} (
                {dateFilter
                  ? `${visibleTableRows.length} / ${tableRows.length}`
                  : tableRows.length}
                )
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              {contextNode && contextNode.type !== 'officer' && (
                <Tooltip title={text.buyDdTooltip}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => {
                        const name = contextNode.name;
                        if (!name) return;
                        setDdCheckoutCompany(name);
                        setDdCheckoutOpen(true);
                      }}
                      sx={{ color: '#ffeb3b', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
                    >
                      <DescriptionIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              <Tooltip title={text.copyTableTooltip}>
                <span>
                  <IconButton
                    size="small"
                    onClick={copyTableToClipboard}
                    disabled={tableRows.length === 0}
                    sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
                  >
                    <CopyIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={isTableCollapsed ? text.expandTable : text.minimizeTable}>
                <IconButton
                  size="small"
                  onClick={() => setIsTableCollapsed(prev => !prev)}
                  sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
                >
                  {isTableCollapsed ? (
                    <ExpandMoreIcon sx={{ fontSize: 16 }} />
                  ) : (
                    <ExpandLessIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Active date-filter chip */}
          {!isTableCollapsed && dateFilter && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.5,
                bgcolor: '#fff8e1',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Chip
                size="small"
                color={
                  dateFilter.category === 'ceses_dimisiones' ||
                  dateFilter.category === 'revocaciones'
                    ? 'error'
                    : 'success'
                }
                label={`${getCategoryLabel(dateFilter.category, uiLanguage)} · ${dateFilter.date}`}
                onDelete={() => setDateFilter(null)}
                sx={{ fontSize: '0.65rem', height: 22 }}
              />
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', flexGrow: 1 }}>
                {dateFilter.companyName || ''}
              </Typography>
            </Box>
          )}

          {/* Table body (collapsible) */}
          {!isTableCollapsed && (
            <TableContainer sx={{ flex: 1, overflow: 'auto', maxHeight: 400 }}>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& .MuiTableBody-root .MuiTableCell-root': {
                    color: '#1f2937',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 'bold',
                        fontSize: '0.7rem',
                        py: 0.5,
                        bgcolor: '#f5f5f5',
                        color: '#0d9488',
                        width: 32,
                        px: 0.5,
                      }}
                    />
                    <TableCell
                      sx={{
                        fontWeight: 'bold',
                        fontSize: '0.7rem',
                        py: 0.5,
                        bgcolor: '#f5f5f5',
                        color: '#0d9488',
                      }}
                    >
                      {text.tableCompany}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 'bold',
                        fontSize: '0.7rem',
                        py: 0.5,
                        bgcolor: '#f5f5f5',
                        color: '#0d9488',
                      }}
                    >
                      {text.tableOfficer}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 'bold',
                        fontSize: '0.7rem',
                        py: 0.5,
                        bgcolor: '#f5f5f5',
                        color: '#0d9488',
                      }}
                    >
                      {text.tableRole}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 'bold',
                        fontSize: '0.7rem',
                        py: 0.5,
                        bgcolor: '#f5f5f5',
                        color: '#0d9488',
                      }}
                    >
                      {text.tableType}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 'bold',
                        fontSize: '0.7rem',
                        py: 0.5,
                        bgcolor: '#f5f5f5',
                        color: '#0d9488',
                      }}
                    >
                      {text.tableDate}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleTableRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: '#4b5563' }}>
                        <Typography variant="caption" sx={{ color: '#4b5563' }}>
                          {text.emptyTable}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleTableRows.map((row, idx) => (
                      <TableRow
                        key={`${row.company}-${row.officer}-${row.position}-${idx}`}
                        hover
                        sx={{
                          '&:nth-of-type(odd)': { bgcolor: 'rgba(20,184,166, 0.03)' },
                          '&:hover': { bgcolor: 'rgba(20,184,166, 0.08)' },
                        }}
                      >
                        <TableCell sx={{ py: 0.25, px: 0.5, width: 32 }}>
                          {(row.officerNode || row.companyNode) && (() => {
                            const toggleNode = row.officerNode || row.companyNode;
                            const inSet = investigationSet.has(normalizeNodeId(toggleNode.id));
                            return (
                              <Checkbox
                                size="small"
                                checked={inSet}
                                onChange={() => toggleInvestigationNode(toggleNode.id)}
                                title={inSet ? text.investigationRemove : text.investigationAdd}
                                sx={{ p: 0 }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell
                          onClick={
                            row.companyNode
                              ? (e) => handleNodeRightClick(row.companyNode, e)
                              : undefined
                          }
                          sx={{
                            fontSize: '0.7rem',
                            py: 0.25,
                            maxWidth: 110,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: row.companyNode ? 'pointer' : 'default',
                            color: row.companyNode ? 'primary.main' : 'inherit',
                            '&:hover': row.companyNode
                              ? { textDecoration: 'underline' }
                              : undefined,
                          }}
                          title={row.companyNode ? text.rowCompanyActions(row.company) : row.company}
                        >
                          {row.company}
                        </TableCell>
                        <TableCell
                          onClick={
                            row.officerNode
                              ? (e) => handleNodeRightClick(row.officerNode, e, { statusCategory: row.category })
                              : undefined
                          }
                          sx={{
                            fontSize: '0.7rem',
                            py: 0.25,
                            maxWidth: 110,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: row.officerNode ? 'pointer' : 'default',
                            color: row.officerNode ? 'primary.main' : 'inherit',
                            '&:hover': row.officerNode
                              ? { textDecoration: 'underline' }
                              : undefined,
                          }}
                          title={
                            officerDeputyMatches[row.officer]?.deputy
                              ? `${row.officer} — ${officerDeputyMatches[row.officer].deputy.FECHABAJA ? text.formerCongressDeputy : text.congressDeputy}${officerDeputyMatches[row.officer].deputy.FORMACIONELECTORAL ? ' · ' + officerDeputyMatches[row.officer].deputy.FORMACIONELECTORAL : ''}`
                              : row.officerNode
                                ? text.rowOfficerActions(row.officer)
                                : row.officer
                          }
                        >
                          {row.officer}
                          {officerDeputyMatches[row.officer]?.deputy && (
                            <Box
                              component="span"
                              sx={{
                                ml: 0.5,
                                fontSize: '0.6rem',
                                fontWeight: 600,
                                px: 0.5,
                                py: 0.05,
                                borderRadius: 0.5,
                                color: officerDeputyMatches[row.officer].deputy.FECHABAJA
                                  ? '#6b7280'
                                  : '#b26500',
                                bgcolor: officerDeputyMatches[row.officer].deputy.FECHABAJA
                                  ? '#f3f4f6'
                                  : '#fff4e0',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              🏛️ {officerDeputyMatches[row.officer].deputy.FECHABAJA ? (uiLanguage === 'en' ? 'Former MP' : 'Ex-dip.') : text.congressDeputy}
                            </Box>
                          )}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontSize: '0.7rem',
                            py: 0.25,
                            maxWidth: 90,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={row.position}
                        >
                          {row.position}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', py: 0.25 }}>
                          <Box
                            component="span"
                            sx={{
                              px: 0.5,
                              py: 0.125,
                              borderRadius: 0.5,
                              bgcolor:
                                row.category === 'ceses_dimisiones' ||
                                row.category === 'revocaciones'
                                  ? '#ffebee'
                                  : '#e8f5e9',
                              color:
                                row.category === 'ceses_dimisiones' ||
                                row.category === 'revocaciones'
                                  ? '#c62828'
                                  : '#2e7d32',
                              fontSize: '0.65rem',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {getCategoryLabel(row.category, uiLanguage)}
                          </Box>
                        </TableCell>
                        <TableCell
                          onClick={
                            row.date && row.date !== '-' && row.companyNode
                              ? () => {
                                  const isActive =
                                    dateFilter &&
                                    dateFilter.date === row.date &&
                                    dateFilter.companyNodeId === row.companyNode.id &&
                                    dateFilter.category === row.category;
                                  setDateFilter(
                                    isActive
                                      ? null
                                      : {
                                          date: row.date,
                                          companyNodeId: row.companyNode.id,
                                          companyName: row.company,
                                          category: row.category,
                                        }
                                  );
                                }
                              : undefined
                          }
                          sx={{
                            fontSize: '0.7rem',
                            py: 0.25,
                            whiteSpace: 'nowrap',
                            cursor:
                              row.date && row.date !== '-' && row.companyNode
                                ? 'pointer'
                                : 'default',
                            color:
                              dateFilter &&
                              row.companyNode &&
                              dateFilter.date === row.date &&
                              dateFilter.companyNodeId === row.companyNode.id &&
                              dateFilter.category === row.category
                                ? 'primary.main'
                                : 'inherit',
                            fontWeight:
                              dateFilter &&
                              row.companyNode &&
                              dateFilter.date === row.date &&
                              dateFilter.companyNodeId === row.companyNode.id &&
                              dateFilter.category === row.category
                                ? 600
                                : 400,
                            '&:hover':
                              row.date && row.date !== '-' && row.companyNode
                                ? { textDecoration: 'underline' }
                                : undefined,
                          }}
                          title={
                            row.date && row.date !== '-' && row.companyNode
                              ? text.filterByDate(row.company)
                              : row.date
                          }
                        >
                          {row.date}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* Legend - compact inline bar */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', px: 2, py: 0.5, opacity: 0.7, fontSize: '0.65rem' }}>
        {[
          { color: nodeColors.company, label: text.legendCompanies },
          { color: nodeColors.officer_individual, label: text.legendPeople },
          { color: nodeColors.officer_company, label: text.legendCorporateOfficers },
          { color: nodeColors.expanded, label: text.legendExpanded },
          { color: nodeColors.searchOrigin, label: text.legendSearch },
        ].map(item => (
          <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 'inherit', lineHeight: 1 }}>{item.label}</Typography>
          </Box>
        ))}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Box sx={{ width: 14, height: 2, bgcolor: '#2e7d32' }} />
          <Typography sx={{ fontSize: 'inherit', lineHeight: 1 }}>{text.legendAppointments}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Box sx={{ width: 14, height: 2, bgcolor: '#d32f2f' }} />
          <Typography sx={{ fontSize: 'inherit', lineHeight: 1 }}>{text.legendCessations}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Box
            sx={{
              width: 14,
              height: 2,
              backgroundImage: 'repeating-linear-gradient(to right, #fbc02d 0 4px, transparent 4px 7px)',
            }}
          />
          <Typography sx={{ fontSize: 'inherit', lineHeight: 1 }}>{text.soleShareholder}</Typography>
        </Box>
        <Typography sx={{ fontSize: 'inherit', lineHeight: 1, ml: 'auto' }}>
          {embedded && !isFullscreen
            ? text.legendHintEmbedded
            : text.legendHint}
        </Typography>
      </Box>
    </>
  );

  const nodeManagementOverlays = (() => {
    const overlayContainer = embedded && isFullscreen ? fullscreenContainerRef.current : undefined;
    return (
      <>
        <Dialog
          open={embedded && Boolean(pendingAutosaveRecord)}
          maxWidth="xs"
          fullWidth
          disableEscapeKeyDown
          container={overlayContainer}
        >
          <DialogTitle>{text.autosaveRestoreTitle}</DialogTitle>
          <DialogContent>
            {pendingAutosaveRecord && (
              <>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  {text.autosaveRestoreBody(
                    pendingAutosaveRecord.snapshot.graph.nodes.length,
                    pendingAutosaveRecord.snapshot.graph.links.length,
                    formatAutosaveTimestamp(pendingAutosaveRecord.savedAt, uiLanguage, true)
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  {text.autosaveDeviceOnly}
                </Typography>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={startFreshAutosaveSession}>{text.autosaveStartFresh}</Button>
            <Button variant="contained" onClick={restoreAutosavedSession}>
              {text.autosaveRestore}
            </Button>
          </DialogActions>
        </Dialog>

        <Menu
          open={Boolean(hiddenNodesMenuAnchorEl)}
          anchorEl={hiddenNodesMenuAnchorEl}
          onClose={closeHiddenNodesMenu}
          container={overlayContainer}
        >
          <Box sx={{ px: 2, py: 1, minWidth: 260 }}>
            <Typography variant="subtitle2">{text.hiddenNodes}</Typography>
            <Typography variant="caption" color="text.secondary">
              {text.nodeCount(hiddenNodesList.length)}
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={unhideAllNodes} disabled={hiddenNodesList.length === 0}>
            <ListItemIcon>
              <VisibilityIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{text.showAll}</ListItemText>
          </MenuItem>
          <Divider />
          {hiddenNodesList.length === 0 ? (
            <MenuItem disabled>
              <ListItemText>{text.noHiddenNodes}</ListItemText>
            </MenuItem>
          ) : (
            hiddenNodesList.map(node => (
              <MenuItem
                key={`hidden-${node.id}`}
                onClick={() => {
                  unhideNode(node.id);
                  closeHiddenNodesMenu();
                }}
              >
                <ListItemIcon>
                  <VisibilityIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={node.name}
                  secondary={node.type === 'officer' ? text.officer : text.company}
                />
              </MenuItem>
            ))
          )}
        </Menu>

        <Menu
          open={!!nodeContextMenu}
          onClose={closeNodeContextMenu}
          anchorReference="anchorPosition"
          container={overlayContainer}
          anchorPosition={
            nodeContextMenu
              ? { top: nodeContextMenu.mouseY, left: nodeContextMenu.mouseX }
              : undefined
          }
        >
          {contextNode && (
            <Box sx={{ px: 2, py: 1, maxWidth: 320 }}>
              <Typography variant="caption" color="text.secondary">
                {contextNode.type === 'officer' ? text.officer : text.company}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {contextNode.name}
              </Typography>
              {hasNodeNote(contextNode) && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mt: 0.75 }}>
                  <NoteIcon
                    sx={{
                      fontSize: 15,
                      color: NODE_NOTE_FLAGS[contextNode.userNote.flag] || NODE_NOTE_FLAGS.none,
                      flexShrink: 0,
                      mt: '2px',
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      lineHeight: 1.35,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {contextNode.userNote.text}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          <Divider />
          <MenuItem onClick={() => { if (contextNode) toggleInvestigationNode(contextNode.id); closeNodeContextMenu(); }}>
            <ListItemIcon><PsychologyIcon fontSize="small" /></ListItemIcon>
            <ListItemText>
              {investigationSet.has(normalizeNodeId(contextNode?.id))
                ? text.investigationRemove
                : text.investigationAdd}
            </ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { closeNodeContextMenu(); if (contextNode) expandNode(contextNode); }}>
            <ListItemIcon>
              <NetworkIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText>{text.expandNode}</ListItemText>
          </MenuItem>
          {contextNode && contextNode.type !== 'officer' && contextNode.cargoCount > 0 && !contextNode.unified && (
            <MenuItem
              onClick={() => {
                closeNodeContextMenu();
                unifyCargosForNode(contextNode.id, contextNode.name);
              }}
            >
              <ListItemIcon>
                <HubIcon fontSize="small" sx={{ color: '#38bdf8' }} />
              </ListItemIcon>
              <ListItemText>{text.cargoBadge(contextNode.cargoCount)}</ListItemText>
            </MenuItem>
          )}
          {contextNode && contextNode.unified && (
            <MenuItem
              onClick={() => {
                closeNodeContextMenu();
                undoCargoUnifyForNode(contextNode.id);
              }}
            >
              <ListItemIcon>
                <HubIcon fontSize="small" sx={{ color: '#5eead4' }} />
              </ListItemIcon>
              <ListItemText>{text.cargoUndo}</ListItemText>
            </MenuItem>
          )}
          <MenuItem onClick={openEditNodeDialog}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{text.editNode}</ListItemText>
          </MenuItem>
          <MenuItem onClick={openNodeNoteDialog}>
            <ListItemIcon>
              <NoteIcon
                fontSize="small"
                sx={{
                  color: hasNodeNote(contextNode)
                    ? (NODE_NOTE_FLAGS[contextNode.userNote.flag] || NODE_NOTE_FLAGS.none)
                    : 'text.secondary',
                }}
              />
            </ListItemIcon>
            <ListItemText>
              {hasNodeNote(contextNode) ? text.editPrivateNote : text.addPrivateNote}
            </ListItemText>
          </MenuItem>
          {hasNodeNote(contextNode) && (
            <MenuItem onClick={removeContextNodeNote}>
              <ListItemIcon>
                <RemoveNoteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{text.removePrivateNote}</ListItemText>
            </MenuItem>
          )}
          <MenuItem
            onClick={openMergeNodeDialog}
            disabled={!contextNode || mergeCandidateOptions.length === 0}
          >
            <ListItemIcon>
              <CallMergeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              {mergeCandidateOptions.length > 0
                ? text.mergeNode
                : text.noMergeCandidates}
            </ListItemText>
          </MenuItem>
          {contextNode && contextNode.mergeHistory?.length > 0 && (
            <MenuItem onClick={unmergeNode}>
              <ListItemIcon>
                <CallSplitIcon fontSize="small" color="warning" />
              </ListItemIcon>
              <ListItemText>{text.unmergeNode}</ListItemText>
            </MenuItem>
          )}
          <MenuItem onClick={openDataPreview}>
            <ListItemIcon>
              <PreviewIcon fontSize="small" color="info" />
            </ListItemIcon>
            <ListItemText>{text.dataPreview}</ListItemText>
          </MenuItem>
          {contextNode && contextNode.type === 'officer' && (
            <MenuItem
              disabled={timelineLoading}
              onClick={async () => {
                const name = contextNode.name;
                closeNodeContextMenu();
                if (!name) return;
                setTimelineLoading(true);
                setTimelineOfficerName(name);
                setTimelineOfficerRecords([]);
                setTimelineDialogOpen(true);
                try {
                  // Query all name variants (from merged nodes) for complete timeline
                  const nameVariants = contextNode.nameVariants || [];
                  const allNames = [name, ...nameVariants.filter(v => v !== name)];
                  const allRecords = [];
                  const seenKeys = new Set();
                  await Promise.all(
                    allNames.map(async (queryName) => {
                      try {
                        const data = await spanishCompaniesService.expandOfficerV3(queryName);
                        if (data.success && data.officers?.length > 0) {
                          data.officers.forEach(o => {
                            const key = `${(o.company_name || '').toUpperCase()}|${(o.specific_role || o.position || '').toUpperCase()}|${o.date || o.event_date || ''}`;
                            if (!seenKeys.has(key)) {
                              seenKeys.add(key);
                              allRecords.push(o);
                            }
                          });
                        }
                      } catch (err) {
                        console.warn(`[Timeline] Failed to expand variant "${queryName}":`, err.message);
                      }
                    })
                  );
                  if (allRecords.length > 0) {
                    setTimelineOfficerRecords(allRecords);
                  }
                } catch (err) {
                  console.error('Error fetching officer timeline:', err);
                } finally {
                  setTimelineLoading(false);
                }
              }}
            >
              <ListItemIcon>
                <TimelineIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText>{text.timeline}</ListItemText>
            </MenuItem>
          )}
          {contextNode && contextNode.type === 'officer' && contextOfficerCanMarkCeased && (
            <MenuItem onClick={openMarkResignedDialog}>
              <ListItemIcon>
                <EventBusyIcon fontSize="small" color="warning" />
              </ListItemIcon>
              <ListItemText>{text.markResigned}</ListItemText>
            </MenuItem>
          )}
          {contextNode && contextNode.type === 'officer' && contextOfficerCanMarkActive && (
            <MenuItem onClick={markContextOfficerActive}>
              <ListItemIcon>
                <EventAvailableIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText>{text.markActive}</ListItemText>
            </MenuItem>
          )}
          {contextNode && contextNode.type !== 'officer' && (
            <MenuItem
              onClick={() => {
                closeNodeContextMenu();
                const name = contextNode.name;
                if (!name) return;
                setDdCheckoutCompany(name);
                setDdCheckoutOpen(true);
              }}
            >
              <ListItemIcon>
                <DescriptionIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText>{text.buyDueDiligence}</ListItemText>
            </MenuItem>
          )}
          {contextNode && contextNode.type === 'spanish-company-group' && (
            <MenuItem
              onClick={() => {
                const n = contextNode;
                closeNodeContextMenu();
                if (n) setApoderadosSidebar({ open: true, company: { name: n.name, groupKey: n.groupKey || null } });
              }}
            >
              <ListItemIcon>
                <PersonIcon fontSize="small" color="action" />
              </ListItemIcon>
              <ListItemText>{text.showApoderados}</ListItemText>
            </MenuItem>
          )}
          {contextNode && contextNode.type === 'spanish-company-group' && isAndroidNativeApp() && (() => {
            const ibexSeed = matchIbexSeed(contextNode.name);
            const ibexData = ibexSeed ? androidIbexDataCache[ibexSeed.nif] : null;
            if (!ibexSeed || !ibexData) return null;
            return (
              <MenuItem
                onClick={() => {
                  closeNodeContextMenu();
                  setIbexMarketDialog({ open: true, seedEntry: ibexSeed, apiRow: ibexData });
                }}
              >
                <ListItemIcon>
                  <ShowChartIcon fontSize="small" color="action" />
                </ListItemIcon>
                <ListItemText>{text.marketData}</ListItemText>
              </MenuItem>
            );
          })()}
          <MenuItem onClick={hideNodeFromMenu}>
            <ListItemIcon>
              <VisibilityOffIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{text.hideNodeOnly}</ListItemText>
          </MenuItem>
          <MenuItem onClick={hideNodeWithRelationsFromMenu}>
            <ListItemIcon>
              <VisibilityOffIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{text.hideNodeRelations}</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={openDeleteNodeDialog} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteOutlineIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>{text.deleteNode}</ListItemText>
          </MenuItem>
        </Menu>

        <ApoderadosSidebar
          open={apoderadosSidebar.open}
          initialCompany={apoderadosSidebar.company}
          companies={apoderadosCompanies}
          lang={language}
          onClose={() => setApoderadosSidebar({ open: false, company: null })}
          onPin={(officer, company) => {
            // Attribute the pin to the company currently shown in the sidebar
            // (the switcher may have changed it), falling back to the initial target.
            const companyName = company?.name || apoderadosSidebar.company?.name;
            if (!companyName) return;
            // Route resigned apoderados into ceses_dimisiones so the link renders
            // as ceased; active ones go into nombramientos. Either way this just
            // adds the officer node + company link (MVP: no full event semantics).
            const isResigned = officer.status === 'resigned';
            const officerItem = { name: officer.name, position: officer.position };
            const entry = {
              name: companyName,
              company_name: companyName,
              parsed: {
                officers: {
                  nombramientos: isResigned ? [] : [officerItem],
                  reelecciones: [],
                  ceses_dimisiones: isResigned ? [officerItem] : [],
                  revocaciones: [],
                },
              },
              officers: [],
              parsed_details: {},
              entry_type: [],
            };
            addCompanyWithOfficersToGraph([entry]);
          }}
        />

        <Ibex35MarketSidebar
          open={Boolean(focusedIbexSeed) && !snapshotMode && !ibexSidebarDismissed && !apoderadosSidebar.open && !isAndroidNativeApp()}
          seedEntry={focusedIbexSeed}
          lang={uiLanguage}
          onClose={() => setIbexSidebarDismissed(true)}
        />

        <Ibex35MarketDialog
          open={ibexMarketDialog.open}
          onClose={() => setIbexMarketDialog({ open: false, seedEntry: null, apiRow: null })}
          seedEntry={ibexMarketDialog.seedEntry}
          apiRow={ibexMarketDialog.apiRow}
          lang={uiLanguage}
        />

        <Dialog
          open={isEditNodeDialogOpen}
          onClose={() => setIsEditNodeDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          container={overlayContainer}
        >
          <DialogTitle>{text.editNode}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <TextField
                label={text.visibleName}
                value={editNodeName}
                onChange={e => setEditNodeName(e.target.value)}
                fullWidth
                autoFocus
              />
            </Box>
            {contextNode?.type === 'officer' && (
              <Box sx={{ mt: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>{text.officerType}</InputLabel>
                  <Select
                    label={text.officerType}
                    value={editNodeSubtype}
                    onChange={e => setEditNodeSubtype(e.target.value)}
                  >
                    <MenuItem value="individual">{text.individualPerson}</MenuItem>
                    <MenuItem value="company">{text.legalPerson}</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              {text.editHelp}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsEditNodeDialogOpen(false)}>{text.cancel}</Button>
            <Button variant="contained" onClick={saveNodeEdit}>
              {text.saveChanges}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={!!nodeNotePreview}
          onClose={() => setNodeNotePreviewId(null)}
          maxWidth="sm"
          fullWidth
          container={overlayContainer}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NoteIcon
              sx={{
                color: nodeNotePreview
                  ? (NODE_NOTE_FLAGS[nodeNotePreview.userNote.flag] || NODE_NOTE_FLAGS.none)
                  : NODE_NOTE_FLAGS.none,
              }}
            />
            {text.privateNoteTitle}
          </DialogTitle>
          <DialogContent>
            {nodeNotePreview && (
              <>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5 }}>
                  {nodeNotePreview.name}
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2.25,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    bgcolor: 'rgba(148, 163, 184, 0.06)',
                  }}
                >
                  <Typography variant="body1" sx={{ lineHeight: 1.65 }}>
                    {nodeNotePreview.userNote.text}
                  </Typography>
                </Paper>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    mt: 1.25,
                    color: 'text.secondary',
                  }}
                >
                  <InfoIcon sx={{ fontSize: 15, flexShrink: 0 }} />
                  <Typography variant="caption">{text.privateNotePreviewHelp}</Typography>
                </Box>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNodeNotePreviewId(null)}>{text.close}</Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={isNodeNoteDialogOpen}
          onClose={closeNodeNoteDialog}
          maxWidth="sm"
          fullWidth
          container={overlayContainer}
        >
          <DialogTitle>{text.privateNoteTitle}</DialogTitle>
          <DialogContent>
            {nodeNoteTarget && (
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5 }}>
                {nodeNoteTarget.name}
              </Typography>
            )}
            <Alert severity="info" sx={{ mb: 2 }}>
              {text.privateNoteHelp}
            </Alert>
            <TextField
              label={text.privateNoteLabel}
              value={nodeNoteText}
              onChange={event => setNodeNoteText(event.target.value)}
              inputProps={{ maxLength: NODE_NOTE_MAX_LENGTH }}
              helperText={`${nodeNoteText.length} / ${NODE_NOTE_MAX_LENGTH}`}
              multiline
              minRows={5}
              fullWidth
              autoFocus
            />
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>{text.noteFlag}</InputLabel>
              <Select
                label={text.noteFlag}
                value={nodeNoteFlag}
                onChange={event => setNodeNoteFlag(event.target.value)}
              >
                {[
                  ['none', text.noteFlagNone],
                  ['amber', text.noteFlagAmber],
                  ['red', text.noteFlagRed],
                  ['blue', text.noteFlagBlue],
                  ['green', text.noteFlagGreen],
                ].map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    <Box
                      component="span"
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: NODE_NOTE_FLAGS[value],
                        border: '1px solid rgba(255,255,255,0.65)',
                        mr: 1.25,
                        flexShrink: 0,
                      }}
                    />
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            {hasNodeNote(nodeNoteTarget) && (
              <Button color="error" onClick={removeContextNodeNote} sx={{ mr: 'auto' }}>
                {text.removePrivateNote}
              </Button>
            )}
            <Button onClick={closeNodeNoteDialog}>{text.cancel}</Button>
            <Button
              variant="contained"
              onClick={saveContextNodeNote}
              disabled={!nodeNoteText.trim()}
            >
              {text.saveNote}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={isMergeNodeDialogOpen}
          onClose={() => setIsMergeNodeDialogOpen(false)}
          maxWidth="md"
          fullWidth
          container={overlayContainer}
          PaperProps={{
            sx: {
              minHeight: { xs: 420, sm: 520 },
            },
          }}
        >
          <DialogTitle>{text.mergeNodes}</DialogTitle>
          <DialogContent sx={{ pb: 1 }}>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {text.mergeBody(contextNode?.name)}
            </Typography>
            <Autocomplete
              options={mergeCandidateOptions}
              value={mergeTargetOption}
              inputValue={mergeSearchText}
              disablePortal={!!embedded}
              openOnFocus
              autoHighlight
              includeInputInList
              onInputChange={(event, value) => setMergeSearchText(value)}
              onChange={(event, value) => setMergeTargetOption(value)}
              getOptionLabel={option => option?.node?.name || ''}
              isOptionEqualToValue={(option, value) =>
                isSameNodeId(option.node.id, value?.node?.id)
              }
              noOptionsText={text.noMatchingNodes}
              ListboxProps={{
                sx: {
                  maxHeight: { xs: 280, sm: 420 },
                },
              }}
              groupBy={option => option.group}
              renderGroup={params => (
                <li key={params.key}>
                  <Typography
                    variant="caption"
                    sx={{
                      px: 1.5,
                      py: 0.75,
                      fontWeight: 700,
                      color: 'text.secondary',
                      display: 'block',
                    }}
                  >
                    {params.group === 'Nombres similares' ? text.similarNames : params.group}
                  </Typography>
                  <Divider />
                  <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                    {params.children}
                  </Box>
                </li>
              )}
              filterOptions={(options, state) => {
                const query = normalizeNameForMerge(state.inputValue);
                if (!query) return options;
                return options.filter(option => {
                  const name = normalizeNameForMerge(option.node.name);
                  const companies = normalizeNameForMerge((option.node.companies || []).join(' '));
                  return name.includes(query) || companies.includes(query);
                });
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <Typography variant="body2" sx={{ mr: 1 }}>
                      {option.node.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                      {option.node.type === 'officer' ? text.officer : text.company}
                    </Typography>
                    {option.group === 'Nombres similares' && (
                      <Typography variant="caption" color="primary.main">
                        {(option.score * 100).toFixed(0)}%
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
              renderInput={params => <TextField {...params} label={text.targetNode} />}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              {text.mergeRecommendation}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsMergeNodeDialogOpen(false)}>{text.cancel}</Button>
            <Button
              variant="contained"
              onClick={confirmMergeNodes}
              disabled={!mergeTargetOption && !exactTypedMergeOption}
            >
              {text.merge}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={isDeleteNodeDialogOpen}
          onClose={() => setIsDeleteNodeDialogOpen(false)}
          maxWidth="xs"
          fullWidth
          container={overlayContainer}
        >
          <DialogTitle>{text.deleteNode}</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              {text.deleteBody(contextNode?.name)}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsDeleteNodeDialogOpen(false)}>{text.cancel}</Button>
            <Button color="error" variant="contained" onClick={confirmDeleteNode}>
              {text.delete}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Data Preview Modal — non-copyable */}
        <Dialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          maxWidth="md"
          fullWidth
          container={overlayContainer}
          PaperProps={{
            sx: {
              maxHeight: '85vh',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
            },
            onContextMenu: e => e.preventDefault(),
            onCopy: e => e.preventDefault(),
          }}
        >
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {previewNodeType === 'officer' ? <PersonIcon /> : <BusinessIcon />}
              <Typography variant="h6" component="span" noWrap sx={{ maxWidth: 500 }}>
                {previewNodeName}
              </Typography>
              <Chip
                label={previewNodeType === 'officer' ? text.officer : text.company}
                size="small"
                color={previewNodeType === 'officer' ? 'warning' : 'primary'}
                variant="outlined"
              />
              {previewUserMerged && (
                <Tooltip title={text.userMergedTooltip}>
                  <Chip label={text.userMergedBadge} size="small" color="warning" variant="outlined" />
                </Tooltip>
              )}
              {previewData?.type === 'company' && previewData.enriched?.isDissolved && (
                <Chip label={text.dissolved} size="small" color="error" />
              )}
              {previewData?.type === 'company' && previewData.enriched?.isInConcurso && (
                <Chip label={text.concurso} size="small" color="warning" />
              )}
              {previewData?.type === 'company' && previewData.enriched?.isUnipersonal && (
                <Chip label={text.unipersonal} size="small" color="info" variant="outlined" />
              )}
              {previewData?.type === 'company' &&
                previewData.enriched?.previousSoleShareholders?.length > 0 &&
                (() => {
                  // Chain of socio único: previous (superseded) → current.
                  const chain = [
                    ...previewData.enriched.previousSoleShareholders,
                    ...(previewData.enriched.soleShareholders || []),
                  ].join(' → ');
                  return (
                    <Tooltip title={`${text.unipersonal}: ${chain}`}>
                      <Chip
                        label={chain}
                        size="small"
                        color="info"
                        variant="outlined"
                        sx={{
                          maxWidth: 380,
                          '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                        }}
                      />
                    </Tooltip>
                  );
                })()}
            </Box>
            <IconButton onClick={() => setPreviewOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ userSelect: 'none' }}>
            {previewLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                <CircularProgress size={40} />
                <Typography sx={{ ml: 2 }} color="text.secondary">{text.loadingData}</Typography>
              </Box>
            )}
            {previewError && (
              <Alert severity="warning" sx={{ my: 2 }}>{previewError}</Alert>
            )}
            {previewData?.snapshotLocal && (
              <Alert severity="info" sx={{ mb: 2 }}>{text.snapshotPreviewNotice}</Alert>
            )}
            {previewData && previewData.type === 'company' && (() => {
              const e = previewData.enriched;
              const officerTable = (officers, color, title) => officers.length > 0 && (
                <>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color }}>
                    {title} ({officers.length})
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>{text.name}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{text.role}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{text.date}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {officers.map((o, i) => (
                          <TableRow key={i}>
                            <TableCell>{o.name || '-'}</TableCell>
                            <TableCell>{o.position || '-'}</TableCell>
                            <TableCell>{o.date ? formatDate(o.date, uiLanguage) : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              );

              const fullHref = fullCompanyPageHref(previewData.name, uiLanguage);
              return (
                <Box>
                  <CurrencyConfirmationCard
                    rec={CONFIRMATIONS[nameToSlug(previewData.name)]}
                    lang={uiLanguage}
                  />
                  {/* Overview section */}
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                    <InfoIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
                    {text.summary}
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                      <Box sx={{ gridColumn: '1 / -1' }}>
                        <Typography variant="caption" color="text.secondary">{text.legalName}</Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            textDecoration: e?.isDissolved ? 'line-through' : 'none',
                            color: e?.isDissolved ? 'error.main' : 'inherit',
                          }}
                        >
                          {previewData.name}
                        </Typography>
                        {e?.nameChanges?.length > 0 ? (
                          <Box sx={{ mt: 0.25 }}>
                            {e.nameChanges.map((nc, idx) => (
                              <Typography
                                key={idx}
                                variant="caption"
                                display="block"
                                sx={{ color: 'warning.main', fontStyle: 'italic' }}
                              >
                                {nc.date ? `${formatDate(nc.date, uiLanguage)}: ` : ''}
                                {nc.old_name} → {nc.new_name}
                              </Typography>
                            ))}
                          </Box>
                        ) : (
                          e?.previousNames?.length > 0 && (
                            <Typography variant="caption" sx={{ color: 'warning.main', fontStyle: 'italic' }}>
                              {text.previous}: {e.previousNames.join(', ')}
                            </Typography>
                          )
                        )}
                      </Box>
                      {(e?.isDissolved || e?.isInConcurso || e?.isUnipersonal) && (
                        <Box sx={{ gridColumn: '1 / -1' }}>
                          <Typography variant="caption" color="text.secondary">{text.status}</Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                            {e.isDissolved && (
                              <Chip label={text.dissolved} size="small" color="error" />
                            )}
                            {e.isInConcurso && (
                              <Chip label={text.concurso} size="small" color="warning" />
                            )}
                            {e.isUnipersonal && (
                              <Chip label={text.unipersonal} size="small" color="info" variant="outlined" />
                            )}
                          </Box>
                        </Box>
                      )}
                      {e?.cif ? (
                        <Box>
                          <Typography variant="caption" color="text.secondary">CIF/NIF</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2" className="registry-ref">{e.cif}</Typography>
                            <Tooltip title={text.reportNifTooltip}>
                              <IconButton
                                size="small"
                                onClick={() => openReport('nif', e.cif)}
                                sx={{ p: 0.25 }}
                                aria-label={text.reportNifTooltip}
                              >
                                <ReportIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      ) : previewData?.type === 'company' ? (
                        <Box>
                          <Typography variant="caption" color="text.secondary">CIF/NIF</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                            <Typography variant="body2" color="text.disabled">{text.nifMissingLabel}</Typography>
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<ReportIcon sx={{ fontSize: 14 }} />}
                              onClick={() => openReport('nif', '')}
                              sx={{ textTransform: 'none', fontSize: '0.7rem', p: 0.25, minWidth: 0, color: 'warning.main' }}
                            >
                              {text.reportNifMissingCta}
                            </Button>
                          </Box>
                        </Box>
                      ) : null}
                      {e?.address && (
                        <Box sx={{ gridColumn: e?.cif ? 'auto' : '1 / -1' }}>
                          <Typography variant="caption" color="text.secondary">{text.address}</Typography>
                          <Typography variant="body2">
                            {e.address}
                            {e.addressExternal && (
                              <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', ml: 0.5 }}>
                                {text.externalEstimate}
                              </Typography>
                            )}
                          </Typography>
                        </Box>
                      )}
                      {e?.activity && (
                        <Box sx={{ gridColumn: '1 / -1' }}>
                          <Typography variant="caption" color="text.secondary">{text.activity}</Typography>
                          <Typography variant="body2">{e.activity}</Typography>
                        </Box>
                      )}
                      {e?.capital && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">{text.capital}</Typography>
                          <Typography variant="body2" className="registry-ref">
                            {e.capital}
                            {e.capitalExternal && (
                              <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', ml: 0.5 }}>
                                {text.externalEstimate}
                              </Typography>
                            )}
                          </Typography>
                        </Box>
                      )}
                      {(e?.firstSeen || e?.lastSeen) && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">{text.bormeRange}</Typography>
                          <Typography variant="body2" className="registry-ref">
                            {e.firstSeen ? formatDate(e.firstSeen, uiLanguage) : '?'} — {e.lastSeen ? formatDate(e.lastSeen, uiLanguage) : '?'}
                          </Typography>
                        </Box>
                      )}
                      {e?.eventCount > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">{text.publicationsFound}</Typography>
                          <Typography variant="body2" className="registry-ref">{e.eventCount}</Typography>
                        </Box>
                      )}
                      {e?.isUnipersonal &&
                        ((e?.soleShareholdersCorporate?.length || 0) +
                          (e?.soleShareholdersIndividual?.length || 0) > 0) && (
                        <Box sx={{ gridColumn: '1 / -1' }}>
                          <Typography variant="caption" color="text.secondary">{text.soleShareholder}</Typography>
                          <Typography variant="body2">
                            {[
                              ...e.soleShareholdersCorporate.map((n) => `${n} ${text.companyTag}`),
                              ...e.soleShareholdersIndividual.map((n) => `${n} ${text.naturalPersonTag}`),
                            ].join(', ')}
                          </Typography>
                          {e?.previousSoleShareholders?.length > 0 && (
                            <Typography variant="caption" sx={{ color: 'warning.main', fontStyle: 'italic' }}>
                              {text.previous}: {e.previousSoleShareholders.join(', ')}
                            </Typography>
                          )}
                        </Box>
                      )}
                      {e?.hojaHistory?.length > 1 && (
                        <Box sx={{ gridColumn: '1 / -1' }}>
                          <Typography variant="caption" color="text.secondary">
                            {text.registrySheetChange}
                          </Typography>
                          <Typography variant="body2" className="registry-ref">
                            {e.hojaHistory.map((h, i) => (
                              `${h.hoja}${h.province ? ` (${h.province})` : ''} ${formatDate(h.first_seen, uiLanguage)} — ${formatDate(h.last_seen, uiLanguage)}`
                            )).join('  →  ')}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Paper>

                  {fullHref && (
                    <Typography
                      component="a"
                      href={fullHref}
                      target="_blank"
                      rel="noopener"
                      variant="body2"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        mb: 3,
                        color: '#90caf9',
                        fontWeight: 600,
                        textDecoration: 'underline',
                        textDecorationColor: 'rgba(144,202,249,0.5)',
                        '&:hover': { color: '#bbdefb', textDecorationColor: '#bbdefb' },
                      }}
                    >
                      {uiLanguage === 'en' ? 'View full profile' : 'Ver ficha completa'}
                      <OpenInNewIcon sx={{ fontSize: 16 }} />
                    </Typography>
                  )}

                  {/* Current officers — grouped by person, sorted by position importance */}
                  {e?.currentOfficers?.length > 0 && (
                    <>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: '#14b8a6' }}>
                        {text.currentOfficers(e.currentOfficers.length)}
                      </Typography>
                      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>{text.name}</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>{text.role}(s)</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>{text.date}</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {e.currentOfficers.map((officer, i) => {
                              const dm = officerDeputyMatches[officer.name];
                              const deputyChip = dm?.deputy ? (
                                <Chip
                                  label={dm.deputy.FECHABAJA ? `🏛️ ${uiLanguage === 'en' ? 'Former MP' : 'Ex-dip.'}` : `🏛️ ${text.congressDeputy}${dm.deputy.FORMACIONELECTORAL ? ` · ${dm.deputy.FORMACIONELECTORAL}` : ''}`}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    ml: 0.75,
                                    height: 18,
                                    fontSize: '0.6rem',
                                    color: dm.deputy.FECHABAJA ? 'text.secondary' : 'warning.dark',
                                    borderColor: dm.deputy.FECHABAJA ? 'grey.400' : 'warning.main',
                                  }}
                                />
                              ) : null;
                              return officer.positions.length === 1 ? (
                                <TableRow key={i}>
                                  <TableCell>
                                    {officer.name || '-'}
                                    {deputyChip}
                                  </TableCell>
                                  <TableCell>{officer.positions[0].position || '-'}</TableCell>
                                  <TableCell>{officer.positions[0].date ? formatDate(officer.positions[0].date, uiLanguage) : '-'}</TableCell>
                                </TableRow>
                              ) : (
                                officer.positions.map((pos, j) => (
                                  <TableRow key={`${i}-${j}`}>
                                    {j === 0 ? (
                                      <TableCell rowSpan={officer.positions.length} sx={{ verticalAlign: 'top', borderBottom: '2px solid rgba(255,255,255,0.12)' }}>
                                        {officer.name || '-'}
                                        {deputyChip}
                                      </TableCell>
                                    ) : null}
                                    <TableCell sx={j === officer.positions.length - 1 ? { borderBottom: '2px solid rgba(255,255,255,0.12)' } : undefined}>
                                      {pos.position || '-'}
                                    </TableCell>
                                    <TableCell sx={j === officer.positions.length - 1 ? { borderBottom: '2px solid rgba(255,255,255,0.12)' } : undefined}>
                                      {pos.date ? formatDate(pos.date, uiLanguage) : '-'}
                                    </TableCell>
                                  </TableRow>
                                ))
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  )}

                  {/* Officers by category (historical) */}
                  {e?.officers && (
                    <>
                      {officerTable(e.officers.nombramientos, '#43a047', text.appointments)}
                      {officerTable(e.officers.reelecciones, '#43a047', text.reelections)}
                      {officerTable(e.officers.ceses_dimisiones, '#e53935', text.cessations)}
                      {officerTable(e.officers.revocaciones, '#e53935', text.revocations)}
                    </>
                  )}

                  {/* Watermark */}
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', mt: 2, fontStyle: 'italic' }}
                  >
                    {text.previewWatermark}
                  </Typography>
                </Box>
              );
            })()}

            {previewData && previewData.type === 'officer' && (() => {
              const officers = previewData.officers || [];
              const variants = previewData.nameVariants;
              // Group by company
              const byCompany = {};
              officers.forEach(o => {
                const companyName = o.company_name || o.company || text.unknown;
                if (!byCompany[companyName]) byCompany[companyName] = [];
                byCompany[companyName].push(o);
              });
              // v3 expand-officer returns: officer_name, company_name, specific_role,
              // event_type ("nombramientos"/"ceses_dimisiones"), status ("active"/"ceased"), date
              const resolveStatus = (o) => {
                const st = (o.status || '').toLowerCase();
                if (st === 'active') return { label: uiLanguage === 'en' ? 'Active' : 'Activo', color: 'success' };
                if (st === 'ceased') return { label: uiLanguage === 'en' ? 'Ceased' : 'Cesado', color: 'error' };
                const evt = (o.event_type || '').toLowerCase();
                if (evt.includes('nombr') || evt.includes('reelecc')) return { label: uiLanguage === 'en' ? 'Active' : 'Activo', color: 'success' };
                if (evt.includes('cese') || evt.includes('dimis') || evt.includes('revoc')) return { label: uiLanguage === 'en' ? 'Ceased' : 'Cesado', color: 'error' };
                return { label: text.unknown, color: 'default' };
              };
              const resolvePosition = (o) => o.specific_role || o.position_normalized || o.role || o.position || '-';
              const resolveDate = (o) => o.date || o.event_date || '';

              const whollyOwned = previewData.whollyOwned || [];
              const deputyMatch = officerDeputyMatches[previewData.name];
              return (
                <Box>
                  {deputyMatch?.deputy && (() => {
                    const d = deputyMatch.deputy;
                    const isFormer = !!d.FECHABAJA;
                    const fullName = d.APELLIDOS ? `${d.NOMBRE || ''} ${d.APELLIDOS}`.trim() : d.NOMBRE;
                    const legs = Array.from(
                      new Set((deputyMatch.rows || []).map(r => r.LEGISLATURA).filter(Boolean))
                    );
                    const allDates = (deputyMatch.rows || [])
                      .map(r => r.FECHAINICIOLEGISLATURA)
                      .filter(Boolean);
                    const allEnds = (deputyMatch.rows || [])
                      .map(r => r.FECHAFINLEGISLATURA || r.FECHABAJA)
                      .filter(Boolean);
                    const parseEs = s => {
                      if (!s) return 0;
                      const p = String(s).split('/');
                      return p.length === 3 ? Date.parse(`${p[2]}-${p[1]}-${p[0]}`) || 0 : Date.parse(s) || 0;
                    };
                    const earliest = allDates.sort((a, b) => parseEs(a) - parseEs(b))[0];
                    const sittingRow = (deputyMatch.rows || []).find(r => r.LEGISLATURAACTUAL === 'S');
                    const latest = isFormer
                      ? allEnds.sort((a, b) => parseEs(b) - parseEs(a))[0]
                      : null;
                    return (
                      <Alert
                        severity={isFormer ? 'info' : 'warning'}
                        icon={false}
                        sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            🏛️ {isFormer ? text.formerCongressDeputy : text.congressDeputy}
                          </Typography>
                          <Chip
                            label={`${Math.round(deputyMatch.confidence * 100)}% match`}
                            size="small"
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.6rem' }}
                          />
                        </Box>
                        {fullName && fullName.toUpperCase() !== (previewData.name || '').toUpperCase() && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            {text.matchesWith}: <b>{fullName}</b>
                          </Typography>
                        )}
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mt: 0.5 }}>
                          {d.FORMACIONELECTORAL && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">{text.party}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{d.FORMACIONELECTORAL}</Typography>
                            </Box>
                          )}
                          {d.GRUPOPARLAMENTARIO && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">{text.group}</Typography>
                              <Typography variant="body2">{d.GRUPOPARLAMENTARIO}</Typography>
                            </Box>
                          )}
                          {d.CIRCUNSCRIPCION && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">{text.constituency}</Typography>
                              <Typography variant="body2">{d.CIRCUNSCRIPCION}</Typography>
                            </Box>
                          )}
                          {legs.length > 0 && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                {text.legislature(legs.length)}
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
                                {legs.join(', ')}
                              </Typography>
                            </Box>
                          )}
                          {(earliest || latest) && (
                            <Box sx={{ gridColumn: '1 / -1' }}>
                              <Typography variant="caption" color="text.secondary">{text.period}</Typography>
                              <Typography variant="body2">
                                {earliest || '?'}
                                {isFormer ? ` — ${latest || '?'}` : ` — ${text.present}`}
                                {sittingRow?.LEGISLATURA ? ` (${sittingRow.LEGISLATURA})` : ''}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                        {d.BIOGRAFIA && (
                          <Typography
                            variant="caption"
                            component="a"
                            href={d.BIOGRAFIA}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ display: 'block', mt: 1, color: 'primary.main', textDecoration: 'underline' }}
                          >
                            {text.congressProfile} →
                          </Typography>
                        )}
                      </Alert>
                    );
                  })()}
                  {variants && variants.length > 1 && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {text.mergedNodesData}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {text.nameVariants}: {variants.join(' / ')}
                      </Typography>
                      <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                        {text.mergedWarning}
                      </Typography>
                    </Alert>
                  )}

                  {/* Wholly-owned companies (sole shareholder positions) */}
                  {whollyOwned.length > 0 && (
                    <Box sx={{ mb: 2.5 }}>
                      <Alert severity="warning" sx={{ mb: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {text.whollyOwned(whollyOwned.length)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {text.whollyOwnedHelp}
                        </Typography>
                      </Alert>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                        {whollyOwned.map((c, i) => {
                          const isDissolved = c.is_dissolved;
                          const isInConcurso = c.is_in_concurso;
                          return (
                            <Paper
                              key={`wo-${i}`}
                              variant="outlined"
                              sx={{
                                p: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                bgcolor: isDissolved
                                  ? 'error.50'
                                  : isInConcurso
                                    ? 'warning.50'
                                    : 'background.paper',
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                                <BusinessIcon sx={{ fontSize: 16, color: isDissolved ? 'error.main' : 'primary.main' }} />
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 500,
                                    textDecoration: isDissolved ? 'line-through' : 'none',
                                  }}
                                  noWrap
                                >
                                  {c.name}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                                {isDissolved && <Chip label={text.dissolved} size="small" color="error" />}
                                {isInConcurso && <Chip label={text.concurso} size="small" color="warning" />}
                                <Chip label="100%" size="small" color={isDissolved ? 'error' : 'success'} />
                              </Box>
                            </Paper>
                          );
                        })}
                      </Box>
                    </Box>
                  )}

                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                    <PersonIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
                    {text.rolesInCompanies(Object.keys(byCompany).length)}
                  </Typography>
                  {Object.entries(byCompany).map(([companyName, companyOfficers]) => (
                    <Paper key={companyName} variant="outlined" sx={{ p: 2, mb: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                        <BusinessIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
                        {companyName}
                      </Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>{text.role}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{text.status}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{text.date}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {companyOfficers.map((o, i) => {
                            const status = resolveStatus(o);
                            return (
                              <TableRow key={i}>
                                <TableCell>{resolvePosition(o)}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={status.label}
                                    size="small"
                                    color={status.color}
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell>{formatDate(resolveDate(o), uiLanguage)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </Paper>
                  ))}
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', mt: 2, fontStyle: 'italic' }}
                  >
                    {text.previewWatermark}
                  </Typography>
                </Box>
              );
            })()}
          </DialogContent>
          {previewData?.type === 'company' ? (
            <Box sx={{ px: 3, pb: 2, pt: 1 }}>
              {/* What the paid report adds over this preview — the value gap, stated plainly. */}
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.5, mb: 1 }}>
                {text.fullReportAdds}
              </Typography>
              {/* Data-quality guarantee — surfaced here, at the decision point, not only at checkout. */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  p: 1.25,
                  mb: 1.5,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(102,187,106,0.08)',
                  border: '1px solid rgba(102,187,106,0.25)',
                }}
              >
                <VerifiedUserIcon sx={{ fontSize: 18, color: 'success.light', mt: '1px', flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: 'success.light', fontSize: '0.74rem', lineHeight: 1.45 }}>
                  {text.previewGuarantee}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<DescriptionIcon />}
                  onClick={() => {
                    setPreviewOpen(false);
                    setDdCheckoutCompany(previewNodeName);
                    setDdCheckoutOpen(true);
                  }}
                  sx={{ textTransform: 'none', fontWeight: 700, color: '#000' }}
                >
                  {text.buyDueDiligencePriced}
                </Button>
                {/* Let buyers see exactly what they're paying for before they commit. */}
                <Button
                  component="a"
                  href="/sample-dd-report.pdf"
                  target="_blank"
                  rel="noopener"
                  startIcon={<PictureAsPdfIcon />}
                  sx={{ textTransform: 'none', color: 'text.secondary' }}
                >
                  {text.previewSeeSample}
                </Button>
                <Button onClick={() => setPreviewOpen(false)} sx={{ ml: { xs: 0, sm: 'auto' } }}>
                  {text.close}
                </Button>
              </Box>
            </Box>
          ) : (
            <DialogActions>
              <Button onClick={() => setPreviewOpen(false)}>{text.close}</Button>
            </DialogActions>
          )}
        </Dialog>

        {/* Officer Timeline Dialog */}
        <OfficerTimelineDialog
          open={timelineDialogOpen}
          officerName={timelineOfficerName}
          officerRecords={timelineOfficerRecords}
          nameVariants={contextNode?.nameVariants}
          language={uiLanguage}
          onClose={() => setTimelineDialogOpen(false)}
          container={overlayContainer}
        />

        <Dialog
          open={legalDisclaimerOpen}
          onClose={() => setLegalDisclaimerOpen(false)}
          maxWidth="md"
          fullWidth
          container={overlayContainer}
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon color="info" />
              <Typography variant="h6">{text.legalTitle}</Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <LegalDisclaimer language={uiLanguage} sx={{ mt: 1 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLegalDisclaimerOpen(false)}>{text.close}</Button>
          </DialogActions>
        </Dialog>

        {/* Mark-resigned dialog (optional resignation date) — Custom DD overlay */}
        <Dialog
          open={Boolean(markResignedNode)}
          onClose={() => setMarkResignedNode(null)}
          maxWidth="xs"
          fullWidth
          container={overlayContainer}
        >
          <DialogTitle>{text.markResigned}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {text.markResignedBody(markResignedNode?.name)}
            </Typography>
            <TextField
              type="date"
              label={text.resignationDate}
              value={markResignedDate}
              onChange={e => setMarkResignedDate(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMarkResignedNode(null)}>{text.cancel}</Button>
            <Button color="warning" variant="contained" onClick={confirmMarkResigned}>
              {text.markResigned}
            </Button>
          </DialogActions>
        </Dialog>

        {/* "Mis correcciones (N)" panel — list + per-row undo */}
        <Menu
          open={Boolean(myCorrectionsAnchor)}
          anchorEl={myCorrectionsAnchor}
          onClose={closeMyCorrections}
          container={overlayContainer}
        >
          <Box sx={{ px: 2, py: 1, minWidth: 300, maxWidth: 380 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {text.myCorrections(correctionsCount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {subjectCompanyName || text.noSelectedCompany}
            </Typography>
          </Box>
          <Divider />
          {myCorrectionsLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          )}
          {!myCorrectionsLoading && myCorrectionsList.length === 0 && (
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                {text.emptyCorrections}
              </Typography>
            </Box>
          )}
          {!myCorrectionsLoading &&
            myCorrectionsList.map(c => {
              const label = text.correctionLabel(c);
              return (
                <Box
                  key={c.id}
                  sx={{
                    px: 2,
                    py: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    maxWidth: 380,
                  }}
                >
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                    {label}
                  </Typography>
                  <Tooltip title={text.removeCorrection}>
                    <IconButton size="small" onClick={() => removeCorrectionFromPanel(c.id)}>
                      <DeleteOutlineIcon fontSize="small" color="error" />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })}
        </Menu>

        {/* Undo toast after a correction is saved */}
        <Snackbar
          open={Boolean(correctionsSnackbar)}
          autoHideDuration={6000}
          onClose={() => setCorrectionsSnackbar(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          message={correctionsSnackbar?.message}
          action={
            <Button color="warning" size="small" onClick={undoCorrectionFromSnackbar}>
              {text.undo}
            </Button>
          }
        />
      </>
    );
  })();

  // Embedded mode: render directly without dialog wrapper
  if (embedded) {
    return (
      <Box
        ref={fullscreenContainerRef}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          p: 0,
          overflow: 'hidden',
          // Fullscreen: a fixed, inset:0 overlay fills the entire app viewport
          // (works in the Capacitor Android WebView, where the native Fullscreen API
          // is a no-op). inset:0 stretches to all four edges — no vh/dvh unit needed.
          // env(safe-area-inset-*) protects content from notches/system bars on
          // edge-to-edge devices (0 otherwise, so harmless).
          ...(isFullscreen
            ? {
                position: 'fixed',
                inset: 0,
                zIndex: 1300,
                bgcolor: 'background.paper',
                pt: 'env(safe-area-inset-top)',
                pb: 'env(safe-area-inset-bottom)',
                pl: 'env(safe-area-inset-left)',
                pr: 'env(safe-area-inset-right)',
              }
            : {}),
        }}
      >
        {/* In fullscreen (esp. on phones) the bulky search/filter panel is hidden so
            the graph canvas actually fills the screen — otherwise fullscreen only
            reclaimed the thin breadcrumb and the graph barely grew. The graph's own
            toolbar (incl. the exit-fullscreen button) + legend live in
            graphAreaContent, so the user can still fit/zoom and leave fullscreen. */}
        {!isFullscreen && searchPanelContent}
        {/* Search loading state is rendered INSIDE the graph container
            (graphAreaContent) so it covers only the canvas, not the whole
            viewport — the search panel above stays visible. */}
        {graphAreaContent}
        {nodeManagementOverlays}
        <DDCheckoutDialog
          open={ddCheckoutOpen}
          onClose={() => setDdCheckoutOpen(false)}
          companyName={ddCheckoutCompany}
          country="es"
          language={uiLanguage}
        />
        <RelationshipReportModal
          open={relReportOpen}
          onClose={() => setRelReportOpen(false)}
          scope={relationshipDetailedScope}
          subjects={relSubjects}
          lang={uiLanguage}
          onRemoveCompany={removeCompanyFromReport}
        />
        <AIInvestigationGate
          open={aiPanelOpen}
          onClose={() => { setAiPanelOpen(false); setEntitlementTick((t) => t + 1); }}
          language={uiLanguage}
          context={aiPanelContext}
          focusCompany={primarySubject || ''}
          onBuy={(name) => {
            const company = (name || primarySubject || '').trim();
            if (!company) return;
            setDdCheckoutCompany(company);
            setDdCheckoutOpen(true);
          }}
        />
        {reportModal}
      </Box>
    );
  }

  // Dialog mode: wrap in Dialog
  return (
    <>
      <Dialog
        open={visible}
        onClose={onHide}
        maxWidth={isFullscreen ? false : 'xl'}
        fullWidth={!isFullscreen}
        fullScreen={isFullscreen}
        PaperProps={{
          sx: {
            height: isFullscreen ? '100vh' : '90vh',
            maxHeight: isFullscreen ? '100vh' : '90vh',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <NetworkIcon sx={{ mr: 1 }} />
              <Typography variant="h6">{text.graphTitle}</Typography>
            </Box>
            <IconButton onClick={onHide} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent
          sx={{
            p: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flex: 1,
            minHeight: 0,
          }}
        >
          {searchPanelContent}
          {graphAreaContent}
        </DialogContent>

        <DialogActions>
          <Button onClick={onHide}>{text.close}</Button>
        </DialogActions>
      </Dialog>
      {nodeManagementOverlays}
      <DDCheckoutDialog
        open={ddCheckoutOpen}
        onClose={() => setDdCheckoutOpen(false)}
        companyName={ddCheckoutCompany}
        country="es"
        language={uiLanguage}
      />
      <RelationshipReportModal
        open={relReportOpen}
        onClose={() => setRelReportOpen(false)}
        scope={relScope}
        subjects={relSubjects}
        lang={uiLanguage}
        onRemoveCompany={removeCompanyFromReport}
      />
      <AIInvestigationGate
        open={aiPanelOpen}
        onClose={() => { setAiPanelOpen(false); setEntitlementTick((t) => t + 1); }}
        language={uiLanguage}
        context={aiPanelContext}
        focusCompany={primarySubject || ''}
        onBuy={(name) => {
          const company = (name || primarySubject || '').trim();
          if (!company) return;
          setDdCheckoutCompany(company);
          setDdCheckoutOpen(true);
        }}
      />
      {reportModal}
    </>
  );
};

export default SpanishCompanyNetworkGraph;
