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
} from '@mui/material';
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

  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TableChart as TableIcon,
  VisibilityOff as VisibilityOffIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  DeleteOutline as DeleteOutlineIcon,
  CallMerge as CallMergeIcon,
  Description as DescriptionIcon,
  Preview as PreviewIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import PersonIcon from '@mui/icons-material/Person';
import DDCheckoutDialog from './DDCheckoutDialog';
import OfficerTimelineDialog from './OfficerTimelineDialog';
import TimelineIcon from '@mui/icons-material/Timeline';
import ForceGraph2D from 'react-force-graph-2d';
import { parseSpanishCompanyData } from '../utils/spanishCompanyParserWithTerms';
import { useTerms } from '../hooks/useTerms';
import { spanishCompaniesService, SpanishCompaniesService } from '../services/spanishCompaniesService';
import { findDeputyMatch } from '../services/congresoOfficerMatcher';

const CATEGORY_LABELS = {
  nombramientos: 'Nombramiento',
  reelecciones: 'Reelección',
  ceses_dimisiones: 'Cese/Dimisión',
  revocaciones: 'Revocación',
};

const CATEGORY_LAYOUT_ANGLE = {
  nombramientos: -Math.PI / 2,
  reelecciones: 0,
  ceses_dimisiones: Math.PI / 2,
  revocaciones: Math.PI,
};

const OFFICERS_PER_COMPANY_OPTIONS = [25, 50, 100, 200, 500];
const COMPANIES_PER_SEARCH_OPTIONS = [10, 25, 50, 100];

// Normalize company name for consistent ID generation across all code paths
const normalizeCompanyName = name => {
  return (name || '')
    .replace(/\s*\(\d{4}\)\.?$/, '') // Remove year suffix like (2024).
    .replace(/\.$/, '') // Remove trailing period
    .trim();
};

const companyNameToId = name => {
  const clean = normalizeCompanyName(name);
  return `company-${clean.replace(/\s+/g, '-').toLowerCase()}`;
};

const formatDate = dateStr => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '-';
  }
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

const BORME_SECTION_NAMES = new Set([
  'nombramientos', 'reelecciones', 'ceses_dimisiones', 'ceses', 'revocaciones',
  'dimisiones', 'cargo no especificado',
]);
const normalizeEdgeLabelText = (relationship, _category) => {
  const text = (relationship || '').trim();
  if (!text || BORME_SECTION_NAMES.has(text.toLowerCase())) return '';
  return text;
};

// Map a raw position string (as stored on link.relationship, e.g. "APO.SOL",
// "CONS.EJECUTIVO", "MIE.COM.PER.", "APODERAD.SOL") to one of ~10 canonical
// category labels used for filter chips. Keeps the chip row from growing to 50+
// entries on large companies.
const POSITION_CATEGORY_ORDER = [
  'Presidente',
  'Vicepresidente',
  'Consejero',
  'Administrador',
  'Secretario',
  'Liquidador',
  'Vocal / Comisión',
  'Apoderado',
  'Auditor',
  'Otros',
];
const positionCategoryFor = pos => {
  const p = (pos || '').toUpperCase();
  if (!p) return 'Otros';
  if (p.startsWith('PRESIDENTE') || p.startsWith('PDTE') || p.startsWith('PRES.') || p.startsWith('PRE.COM')) return 'Presidente';
  if (p.startsWith('VICEPRESIDENTE') || p.startsWith('VPDTE') || p.startsWith('VICEPTE') || p.startsWith('VIC.COM') || p.startsWith('VICPTE')) return 'Vicepresidente';
  if (p.startsWith('CONSEJERO') || p.startsWith('CONS.') || p.startsWith('CONS ') || p.startsWith('CON.DEL') || p.startsWith('CONS.EJ') || p.startsWith('CONS.IND')) return 'Consejero';
  if (p.startsWith('ADMINISTRADOR') || p.startsWith('ADM.') || p.startsWith('ADM ')) return 'Administrador';
  if (p.startsWith('SECRETARIO') || p.startsWith('SECRET.') || p.startsWith('SRIO') || p.startsWith('SECR.')) return 'Secretario';
  if (p.startsWith('LIQUIDADOR') || p.startsWith('LIQ.') || p.startsWith('LIQ ')) return 'Liquidador';
  if (p.startsWith('VOCAL')) return 'Vocal / Comisión';
  if (/^(MIE|MBRO|MRO|MIEM|M)\.?COM/.test(p)) return 'Vocal / Comisión';
  if (p.startsWith('AUDITOR') || p.startsWith('AUD.')) return 'Auditor';
  if (p.startsWith('APO') || p.startsWith('APODERADO') || p.startsWith('APD')) return 'Apoderado';
  return 'Otros';
};

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
  embedded = false,
}) => {
  // Graph state
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fgRef = useRef();

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

  // Track pinned node IDs (nodes added by direct search — always shown regardless of filter)
  const [pinnedNodeIds, setPinnedNodeIds] = useState(new Set());
  // Manually hidden nodes (right-click to hide)
  const [hiddenNodeIds, setHiddenNodeIds] = useState(new Set());
  const [hiddenNodesMenuAnchorEl, setHiddenNodesMenuAnchorEl] = useState(null);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [nodeContextMenu, setNodeContextMenu] = useState(null); // { mouseX, mouseY, nodeId }
  const [isEditNodeDialogOpen, setIsEditNodeDialogOpen] = useState(false);
  const [isMergeNodeDialogOpen, setIsMergeNodeDialogOpen] = useState(false);
  const [isDeleteNodeDialogOpen, setIsDeleteNodeDialogOpen] = useState(false);
  const [editNodeName, setEditNodeName] = useState('');
  const [editNodeSubtype, setEditNodeSubtype] = useState('individual');
  const [mergeTargetOption, setMergeTargetOption] = useState(null);
  const [mergeSearchText, setMergeSearchText] = useState('');

  // DD Checkout dialog state
  const [ddCheckoutOpen, setDdCheckoutOpen] = useState(false);
  const [ddCheckoutCompany, setDdCheckoutCompany] = useState('');

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
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);
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
  const [nodeSize, setNodeSize] = useState(9);
  const [labelSize, setLabelSize] = useState(9);
  const [linkDistance, setLinkDistance] = useState(80);
  const [chargeStrength, setChargeStrength] = useState(-350);
  const [showNodeLabels] = useState(true); // Renamed for clarity
  const [zoomLevel, setZoomLevel] = useState(1);

  const MAX_NODE_DRIFT = 5000;
  const MAX_NODE_SPEED = 30;

  // Node colors and shapes
  const nodeColors = React.useMemo(
    () => ({
      company: '#1976d2',
      officer_individual: '#f57c00',
      officer_company: '#9c27b0',
      expanded: '#4caf50',
      selected: '#e91e63',
      searchOrigin: '#e91e63',
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

  // Configure forces and reheat — combined into one effect so reheat always
  // happens AFTER forces are updated (previously separate effects ran in wrong order).
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !containerReady || graphData.nodes.length === 0) return;
    const isPinned = node => !!node && (node.fx != null || node.fy != null);
    const isOfficer = node => !!node && node.type === 'spanish-officer';

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
            ? Math.max(nodeSize + 40, labelLen * 3.5)
            : nodeSize + 14;
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
  ]);

  // Clear graph data when dialog closes so it starts fresh each time (only in dialog mode)
  useEffect(() => {
    if (!embedded && !visible) {
      setGraphData({ nodes: [], links: [] });
      setError(null);
      setSearchQuery('');
      setLastSearchContext(null);
      setLoadingMore(false);
      setContainerReady(false);
      setHiddenNodesMenuAnchorEl(null);
      setActiveNodeId(null);
      setNodeContextMenu(null);
      setIsEditNodeDialogOpen(false);
      setIsMergeNodeDialogOpen(false);
      setIsDeleteNodeDialogOpen(false);
      setMergeTargetOption(null);
      setMergeSearchText('');
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
        entries.forEach(company => {
          const companyName = normalizeCompanyName(company.name || company.company_name || '');
          if (companyName) {
            const companyId = companyNameToId(companyName);
            setPinnedNodeIds(prev => new Set([...prev, companyId]));
          }
        });
      })();
    } else if (initialOfficerData && initialOfficerData.name) {
      const entries = initialOfficerData.companies || [];
      if (entries.length > 0) {
        addOfficerToGraph(entries, initialOfficerData.name);
      }
      // Pin initial officer node
      const officerId = `officer-${initialOfficerData.name.toLowerCase().trim().replace(/\s+/g, '-')}`;
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
      handleSearch(initialCompanyName, true, initialSearchType || null);
    }
  }, [initialCompanyName, visible, embedded]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (count > 0 && count !== prevNodeCountRef.current) {
      prevNodeCountRef.current = count;
      // Delay to let ForceGraph2D process new data and simulation settle
      const timer = setTimeout(() => {
        if (fgRef.current) {
          fgRef.current.zoomToFit(400, 50);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [graphData.nodes.length]);

  // Re-fit graph when container dimensions change significantly (e.g. after table renders)
  const prevDimRef = useRef(containerDimensions);
  useEffect(() => {
    const prev = prevDimRef.current;
    prevDimRef.current = containerDimensions;
    const dw = Math.abs(prev.width - containerDimensions.width);
    const dh = Math.abs(prev.height - containerDimensions.height);
    if ((dw > 50 || dh > 50) && graphData.nodes.length > 0 && fgRef.current) {
      const timer = setTimeout(() => {
        fgRef.current?.zoomToFit(400, 50);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [containerDimensions, graphData.nodes.length]);

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

  // Helper function to determine if an officer name represents a company or individual
  const isCompanyOfficer = useCallback(officerName => {
    const companyIndicators = [
      /\b(S\.?L\.?|S\.?A\.?|SLU|SAU)\b/i, // Spanish company suffixes
      /\b(LTD|LIMITED|INC|CORP|CORPORATION|LLC|PLC)\b/i, // English company suffixes
      /\b(GMBH|AG|KG|OHG)\b/i, // German company suffixes
      /\b(SAS|SARL|SA|EURL)\b/i, // French company suffixes
      /\b(BV|NV)\b/i, // Dutch company suffixes
      /\b(AUDIT|AUDITOR|CONSULTING|CONSULTORIA|ASESORES|GESTORIA|DESPACHO)\b/i, // Service companies
      /\b(PRICEWATERHOUSE|DELOITTE|KPMG|EY|ERNST)\b/i, // Known audit firms
    ];

    return companyIndicators.some(pattern => pattern.test(officerName));
  }, []);

  // Debounced autocomplete handler
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleAutocomplete = useCallback(
    debounce(async value => {
      if (!value || value.length < 2) {
        setAutocompleteOptions([]);
        return;
      }

      const currentSearchType = searchTypeRef.current;
      setAutocompleteLoading(true);
      try {
        let results = [];

        if (currentSearchType === 'company') {
          const companyResults = await spanishCompaniesService.autocompleteCompanies(value, {
            limit: 10,
          });
          // Guard against stale results if searchType changed during await
          if (searchTypeRef.current !== currentSearchType) return;
          const suggestions = companyResults.suggestions || [];
          results = suggestions.map(c => ({
            label: c.label || c.name || c.company_name,
            value: c.value || c.name || c.company_name,
            name: c.name || c.company_name,
            type: 'company',
            cif: c.cif,
            ...c,
          }));
        } else {
          const officerResults = await spanishCompaniesService.autocompleteOfficers(value, {
            limit: 10,
          });
          // Guard against stale results if searchType changed during await
          if (searchTypeRef.current !== currentSearchType) return;
          const suggestions = officerResults.suggestions || [];
          results = suggestions.map(o => ({
            label: o.label || o.name,
            value: o.value || o.name,
            name: o.name,
            type: 'officer',
            company_count: o.company_count,
            ...o,
          }));
        }

        setAutocompleteOptions(results);

        // Enrich officer options with Congreso deputy match in the background.
        const officerOptions = results.filter(r => r.type === 'officer' && r.name);
        if (officerOptions.length > 0) {
          const matches = await Promise.all(
            officerOptions.map(o => findDeputyMatch(o.name).catch(() => null))
          );
          if (searchTypeRef.current !== currentSearchType) return;
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
      } finally {
        setAutocompleteLoading(false);
      }
    }, 300),
    [] // No deps needed - uses ref for searchType
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

  const handleSearch = async (queryOverride = null, exactMatch = false, searchTypeOverride = null) => {
    const query = (queryOverride || searchQuery).trim();
    if (!query) {
      setError('Por favor, introduce un término de búsqueda');
      return;
    }

    const effectiveSearchType = searchTypeOverride || searchType;

    setIsSearching(true);
    setError(null);
    setLastSearchContext(null);

    try {
      if (effectiveSearchType === 'officer') {
        // Officer search: use borme_companies_v3 for explicit active/resigned status
        const data = await spanishCompaniesService.expandOfficerV3(query);

        const fetchedCount = data.officers?.length || 0;
        if (data.success && fetchedCount > 0) {
          await addOfficerToGraph(data.officers, query);
          // Pin the officer node so it survives filtering
          const officerId = `officer-${query.toLowerCase().trim().replace(/\s+/g, '-')}`;
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
          setError(`No results found for officer "${query}".`);
        }
      } else {
        // Company search: use borme_companies_v3 (clean, pre-aggregated index with
        // explicit officers_active/officers_resigned arrays)
        const v3Data = await spanishCompaniesService.searchCompaniesV3(query, {
          size: companiesPerSearch,
          exact: exactMatch,
        });

        const v3Results = v3Data.results || [];
        if (v3Results.length > 0) {
          // Board roles always kept; apoderados/others capped per-company, newest first.
          const baseEntries = await v3DocsToCappedEntries(v3Results, officersPerCompany);
          // Check for name changes on ALL results before filtering,
          // so that old-name entries with has_new_name are discovered
          const { entries: withRelated, aliasMap } = await fetchWithNameChangeRelations(baseEntries, { cap: officersPerCompany });
          const filtered = filterCompanyMatches(withRelated, query);
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
            merged.forEach(company => {
              const companyName = normalizeCompanyName(company.name || company.company_name || '');
              const companyId = companyNameToId(companyName);
              setPinnedNodeIds(prev => new Set([...prev, companyId]));
            });
            setLastSearchContext({
              query,
              searchType: 'company',
              exactMatch: exactMatch,
              size: companiesPerSearch,
              offset: v3Results.length,
              hasMore: false, // v3 company docs are complete (all officers pre-aggregated)
              total: v3Data.total || v3Results.length,
            });
            setSearchQuery('');
          } else {
            setError(`No precise company match found for "${query}". Try a broader search.`);
          }
        } else {
          setError(`No results found for "${query}".`);
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(`Error en la búsqueda: ${err.message}`);
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
          const officerId = `officer-${context.query.toLowerCase().trim().replace(/\s+/g, '-')}`;
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
            setError(`No hay más coincidencias precisas para "${context.query}".`);
          }
        } else {
          setLastSearchContext(prev => (prev ? { ...prev, hasMore: false } : prev));
        }
      }
    } catch (err) {
      console.error('Load more error:', err);
      setError(`Error al cargar más resultados: ${err.message}`);
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
      }));
      const individualShareholders = (result.sole_shareholder_individuals || []).map(s => ({
        name: typeof s === 'string' ? s : (s?.name || s?.shareholder_name || ''),
        kind: 'individual',
      }));
      const shareholders = [...companyShareholders, ...individualShareholders].filter(s => s.name);
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
            const normalizedName = shName.toLowerCase().trim();
            shId = `officer-${normalizedName.replace(/\s+/g, '-')}`;
            existingNode = newNodes.find(
              n => n.type === 'officer' && n.name.trim().toLowerCase() === normalizedName
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

          const linkId = `ownership-${shId}-${companyId}`;
          if (!newLinks.find(l => l.id === linkId)) {
            newLinks.push({
              id: linkId,
              source: shId,
              target: companyId,
              type: 'ownership',
              relationship: 'Socio único',
              category: ownershipLost ? 'socio_perdido' : 'socio_unico',
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

    if (eventMap.size === 0) return;

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
        const events = [];
        ['nombramientos', 'ceses_dimisiones', 'reelecciones', 'revocaciones'].forEach(cat => {
          const entries = eventMap.get(`${officerUpper}|${companyUpper}|${cat}`);
          if (entries) {
            entries.forEach(({ date, position }) => {
              events.push({ category: cat, date, position });
            });
          }
        });

        if (events.length === 0) return link;
        return { ...link, events };
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
              const key = `${o.name.trim().toLowerCase()}||${(o.position || '').trim().toLowerCase()}`;
              const d = new Date(o.date || 0);
              if (!officerEffectiveCategory[key] || d > officerEffectiveCategory[key].date) {
                officerEffectiveCategory[key] = { category: o.category, date: d };
              }
            });


            let officerRingIdx = 0;
            allOfficersList.forEach(officer => {
              // Create a normalized name for consistent node identification
              const normalizedName = officer.name.trim().toLowerCase();
              const officerId = `officer-${normalizedName.replace(/\s+/g, '-')}`;

              // Check if officer already exists by name (not just ID) - also check existing graph data
              let officerNode = newNodes.find(
                n => n.type === 'officer' && n.name.trim().toLowerCase() === normalizedName
              );

              // Also check in the existing graph data (prevData.nodes)
              if (!officerNode) {
                officerNode = prevData.nodes.find(
                  n => n.type === 'officer' && n.name.trim().toLowerCase() === normalizedName
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
        setError(`Error al añadir empresa al grafo: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [extractOfficersFromText, isCompanyOfficer, viewportCenter, showShareholders, addShareholdersForCompany, addOwnedCompaniesForEntity, enrichLinksWithEventDates, officersPerCompany]
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
          const normalizedOfficerName = officerName.toLowerCase().trim();
          const officerId = `officer-${normalizedOfficerName.replace(/\s+/g, '-')}`;

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
            const officerId = `officer-${officerName.toLowerCase().replace(/\s+/g, '-')}`;
            addOwnedCompaniesForEntity(officerName, officerId, 'person');
          }
        }

        // Fire-and-forget: enrich links with real appointment/cessation event dates
        enrichLinksWithEventDates(Array.from(uniqueCompanyNames));
      } catch (err) {
        console.error('Error adding officer to graph:', err);
        setError(`Error al añadir directivo al grafo: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [isCompanyOfficer, viewportCenter, showShareholders, addShareholdersForCompany, addOwnedCompaniesForEntity, enrichLinksWithEventDates]
  );

  // Plot a bare shareholder node (no officers, no subsidiaries) so the user
  // can see the entity on the canvas before deciding to fetch its participadas.
  const plotBareShareholderNode = useCallback(
    (entityName, entityKind) => {
      if (!entityName) return null;
      const isCompanyKind = entityKind === 'company';
      const cleanName = isCompanyKind ? normalizeCompanyName(entityName) : entityName.trim();
      const entityId = isCompanyKind
        ? companyNameToId(cleanName)
        : `officer-${cleanName.toLowerCase().replace(/\s+/g, '-')}`;

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
        setError(`Error al cargar participadas: ${err.message}`);
      } finally {
        setLoadingSubsidiaries(false);
        setPendingSubsidiaries(null);
      }
    },
    [addOwnedCompaniesForEntity]
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
        // explicit active/resigned status
        const v3 = await spanishCompaniesService.getCompanyProfileV3(companyName);
        if (v3.company) {
          const baseEntries = await v3DocsToCappedEntries([v3.company], officersPerCompany);
          const { entries, aliasMap } = await fetchWithNameChangeRelations(baseEntries, { cap: officersPerCompany });
          await addCompanyWithOfficersToGraph(entries, companyNode, aliasMap);
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
          setError(`No se encontraron resultados adicionales para "${node.name}"`);
        }
        // Note: node.expanded = true was set above via direct mutation.
        // Do NOT call setGraphData here to re-create node objects — that breaks
        // ForceGraph2D's internal references (x, y, fx, fy get lost), causing
        // the node to detach from its edges on drag.
      } catch (err) {
        console.error('Error expanding node:', err);
        setError(`Error al expandir nodo: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [expandOfficerNode, expandCompanyNode]
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
    (sourceNodeId, targetNodeId) => {
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

  // Right-click on node to open actions menu (desktop), also called by single tap on touch devices
  const handleNodeRightClick = useCallback(
    (node, event) => {
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
      const MENU_ESTIMATED_HEIGHT = 460;
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
      });
    },
    [closeHiddenNodesMenu, containerEl]
  );

  // Click/tap handler — desktop: double-click expands; mobile: single tap opens context menu, double tap expands
  const handleNodeClick = useCallback(
    (node, event) => {
      const now = Date.now();
      const last = lastClickRef.current;
      const nodeId = normalizeNodeId(node.id);
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
    [expandNode, embedded, isFullscreen, handleNodeRightClick]
  );

  const openEditNodeDialog = useCallback(() => {
    if (!contextNode) return;
    setEditNodeName(contextNode.name || '');
    setEditNodeSubtype(contextNode.subtype || 'individual');
    setIsEditNodeDialogOpen(true);
    closeNodeContextMenu();
  }, [contextNode, closeNodeContextMenu]);

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
    hideNode(contextNode.id, { withConnected: false });
    closeNodeContextMenu();
  }, [contextNode, hideNode, closeNodeContextMenu]);

  const hideNodeWithRelationsFromMenu = useCallback(() => {
    if (!contextNode) return;
    hideNode(contextNode.id, { withConnected: true });
    closeNodeContextMenu();
  }, [contextNode, hideNode, closeNodeContextMenu]);

  // Data preview: fetch company or officer data and show in modal
  const openDataPreview = useCallback(async () => {
    if (!contextNode) return;
    const name = contextNode.name;
    const isOfficer = contextNode.type === 'officer';
    closeNodeContextMenu();
    setPreviewNodeName(name);
    setPreviewNodeType(isOfficer ? 'officer' : 'company');
    setPreviewData(null);
    setPreviewError(null);
    setPreviewLoading(true);
    setPreviewOpen(true);

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
          setPreviewError('No se encontraron datos para este directivo.');
        }
      } else {
        // Fetch both the company profile and events in parallel
        const [v3Result, eventsResult] = await Promise.allSettled([
          spanishCompaniesService.getCompanyProfileV3(name),
          spanishCompaniesService.getCompanyEventsV3(name, { size: 100 }),
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
            setPreviewError('No se encontraron datos para esta empresa.');
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

          // Previous names from the node
          const previousNames = contextNode.companySummary?.previousNames || contextNode.previousNames || [];

          // Format capital with thousands separator
          let formattedCapital = null;
          if (latestCapital) {
            const num = typeof latestCapital === 'number' ? latestCapital : parseFloat(String(latestCapital).replace(/[^\d.,]/g, '').replace(',', '.'));
            if (!isNaN(num)) {
              formattedCapital = new Intl.NumberFormat('es-ES', { useGrouping: true, maximumFractionDigits: 2 }).format(num) + ' \u20AC';
            } else {
              formattedCapital = String(latestCapital);
            }
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
              address: latestAddress,
              activity: latestActivity,
              cif: latestCif,
              firstSeen,
              lastSeen,
              previousNames,
              officers: datedOfficers,
              currentOfficers,
              eventCount: events.length,
            },
          });
        }
      }
    } catch (err) {
      console.error('[Preview] Error fetching data:', err);
      setPreviewError(`Error al obtener datos: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  }, [contextNode, closeNodeContextMenu]);

  const saveNodeEdit = useCallback(() => {
    if (!contextNode) return;
    const nextName = editNodeName.trim();
    if (!nextName) {
      setError('El nombre del nodo no puede estar vacío.');
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
  }, [contextNode, editNodeName, editNodeSubtype]);

  const confirmMergeNodes = useCallback(() => {
    const effectiveTarget = mergeTargetOption || exactTypedMergeOption;
    if (!contextNode || !effectiveTarget?.node) {
      setError('Selecciona un nodo destino para fusionar.');
      return;
    }
    mergeNodes(contextNode.id, effectiveTarget.node.id);
    setIsMergeNodeDialogOpen(false);
    setMergeTargetOption(null);
    setMergeSearchText('');
  }, [contextNode, mergeTargetOption, exactTypedMergeOption, mergeNodes]);

  // Handle zoom changes
  const handleZoom = useCallback(zoom => {
    setZoomLevel(zoom);
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

  // Classify link categories as active or ceased
  const isActiveLinkCategory = cat => {
    const c = (cat || '').toLowerCase();
    return c.includes('nombramiento') || c.includes('reeleccion') || c.includes('reelección');
  };

  // Facet counts for the chip row — each chip's count reflects the other
  // filter's state so users see how many items would remain if they picked it.
  // Position chip counts honour the vigentes/cesados toggle; status chip counts
  // honour the position toggle.
  const linkPassesStatus = React.useCallback(link => {
    if (statusFilters.size === 0) return true;
    if (link.type && link.type !== 'officer-company') return true;
    const active = isActiveLinkCategory(link.category);
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
      if (isActiveLinkCategory(link.category)) active++;
      else ceased++;
    });
    return { active, ceased };
  }, [graphData.links, linkPassesPosition]);

  const hasChipFilters = statusFilters.size > 0 || positionFilters.size > 0;

  const filteredGraphData = React.useMemo(() => {
    // Start by excluding manually hidden nodes
    let activeNodes = graphData.nodes;
    let activeLinks = graphData.links;

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

    // Apply status and position chip filters
    if (hasChipFilters) {
      activeLinks = activeLinks.filter(link => {
        if (link.type && link.type !== 'officer-company') return true;

        if (statusFilters.size > 0) {
          const active = isActiveLinkCategory(link.category);
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

    if (filterTerms.length === 0) return { nodes: activeNodes, links: activeLinks };

    // Find nodes matching filter terms (NOT pinned — pinned are added separately)
    const filterMatchIds = new Set();
    activeNodes.forEach(node => {
      const name = (node.name || '').toLowerCase();
      if (filterTerms.some(term => name.includes(term))) {
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

    const filteredNodes = activeNodes.filter(n => visibleNodeIds.has(normalizeNodeId(n.id)));
    const filteredLinks = activeLinks.filter(l => {
      const sourceId = normalizeNodeId(getNodeIdFromRef(l.source));
      const targetId = normalizeNodeId(getNodeIdFromRef(l.target));
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });

    return { nodes: filteredNodes, links: filteredLinks };
  }, [graphData, filterTerms, pinnedNodeIds, hiddenNodeIds, statusFilters, positionFilters, hasChipFilters, showShareholders]);

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

  // Graph rendering functions
  const nodeCanvasObject = useCallback(
    (node, ctx, globalScale) => {
      const label = node.name || node.label || '';
      const fontSize = Math.max(labelSize / globalScale, 4);
      const nodeRadius = nodeSize;

      // Determine node color and shape
      const isOrigin = pinnedNodeIds.has(normalizeNodeId(node.id));
      let color = nodeColors.company;
      if (node.type === 'officer') {
        color =
          node.subtype === 'company' ? nodeColors.officer_company : nodeColors.officer_individual;
      } else if (node.type === 'spanish-company-group') {
        color = nodeColors.company;
      }

      if (node.expanded) {
        color = nodeColors.expanded;
      }

      if (isOrigin) {
        color = nodeColors.searchOrigin;
      }

      // Draw node based on type and subtype
      ctx.fillStyle = color;

      // Search origin nodes get a glowing ring to stand out
      if (isOrigin) {
        ctx.strokeStyle = nodeColors.searchOrigin;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius + 3, 0, 2 * Math.PI, false);
        ctx.stroke();
      }

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;

      // Draw all nodes as circles
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI, false);
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
          ctx.font = `${fontSize}px Sans-Serif`;
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
    },
    [nodeSize, labelSize, showNodeLabels, nodeColors, filteredGraphData.nodes, pinnedNodeIds, officerDeputyMatches]
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
      const cat = (link.category || '').toLowerCase();
      let linkColor;
      if (link.type === 'ownership') {
        linkColor = cat === 'socio_perdido' ? '#bf8f30' : '#fbc02d'; // Gold — sole shareholder
      } else if (cat.includes('nombramiento') || cat.includes('reeleccion') || cat.includes('reelección')) {
        linkColor = '#43a047'; // Green — appointments and re-elections
      } else if (
        cat.includes('cese') || cat.includes('dimision') || cat.includes('dimisión') ||
        cat.includes('revocacion') || cat.includes('revocación')
      ) {
        linkColor = '#e53935'; // Red — resignations and revocations
      } else {
        linkColor = '#90a4ae'; // Blue-grey for unknown / company-company
      }

      // Draw link — dashed for officers from a previous company name and for ownership links
      ctx.beginPath();
      if (link.fromPreviousName) {
        ctx.setLineDash([Math.max(4, 6 / globalScale), Math.max(2, 3 / globalScale)]);
      } else if (link.type === 'ownership') {
        ctx.setLineDash([Math.max(2, 3 / globalScale), Math.max(2, 3 / globalScale)]);
      }
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = link.fromPreviousName ? (linkColor + 'AA') : linkColor; // Slightly transparent for old-name links
      ctx.lineWidth = link.type === 'ownership'
        ? Math.max(0.6, 1.6 / globalScale)
        : Math.max(0.3, 1 / globalScale);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Arrowhead at the target end. react-force-graph's built-in linkDirectionalArrow is
      // suppressed when a custom linkCanvasObject is in 'replace' mode, so we draw it here.
      {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
          const ux = dx / length;
          const uy = dy / length;
          // Back the arrow off from the target node's edge so the tip is visible.
          const tipOffset = nodeSize + 1;
          const tipX = end.x - ux * tipOffset;
          const tipY = end.y - uy * tipOffset;
          const arrowLen = Math.max(4, 6 / globalScale);
          const arrowHalfWidth = arrowLen * 0.55;
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
          ctx.fillStyle = linkColor;
          ctx.fill();
        }
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
    },
    [filteredGraphData.links, parallelLinkMeta, labelSize, nodeSize]
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
    setGraphData({ nodes: [], links: [] });
    setPinnedNodeIds(new Set());
    setHiddenNodeIds(new Set());
    setError(null);
    setLastSearchContext(null);
    setLoadingMore(false);
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
            date: formatDate(ev.date),
            dateRaw: ev.date || null,
          });
        });
      } else {
        rows.push({
          ...baseRow,
          category: link.category || '-',
          date: formatDate(link.date),
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
  }, [filteredGraphData]);

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

  // Deputy (PEP) match cache keyed by officer name. Populated lazily for the
  // officers shown in the table — `null` means "checked, no match" so we don't
  // refetch the same name on every re-render.
  const [officerDeputyMatches, setOfficerDeputyMatches] = useState({});

  useEffect(() => {
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
  }, [visibleTableRows, filteredGraphData.nodes, previewData, officerDeputyMatches]);

  // Clear the date filter automatically if the underlying rows no longer contain any match
  // (e.g. user collapsed a node or changed filters).
  React.useEffect(() => {
    if (dateFilter && visibleTableRows.length === 0) {
      setDateFilter(null);
    }
  }, [dateFilter, visibleTableRows.length]);

  // Copy table as TSV for Excel/Word paste
  const copyTableToClipboard = useCallback(() => {
    const headers = ['Empresa', 'Directivo', 'Cargo', 'Tipo', 'Fecha'];
    const tsv = [
      headers.join('\t'),
      ...visibleTableRows.map(row =>
        [
          row.company,
          row.officer,
          row.position,
          CATEGORY_LABELS[row.category] || row.category,
          row.date,
        ].join('\t')
      ),
    ].join('\n');
    navigator.clipboard.writeText(tsv).catch(err => {
      console.error('Failed to copy table:', err);
      setError('No se pudo copiar la tabla al portapapeles.');
    });
  }, [visibleTableRows]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (embedded) {
      const el = fullscreenContainerRef.current;
      if (!el || !document.fullscreenEnabled) return;
      if (!document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    } else {
      setIsFullscreen(prev => !prev);
    }
  }, [embedded]);

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

  // Handle key down for search
  const handleKeyDown = e => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Shared search panel content
  const searchPanelContent = (
    <Paper sx={{ p: 1, px: 1.5, m: embedded ? 0 : 2, mb: 0 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Tipo</InputLabel>
          <Select
            value={searchType}
            onChange={e => {
              setSearchType(e.target.value);
              setAutocompleteOptions([]);
              setSelectedAutocomplete(null);
              setLastSearchContext(null);
            }}
            label="Tipo"
          >
            <MenuItem value="company">
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <BusinessIcon sx={{ mr: 1, fontSize: 16 }} />
                Empresa
              </Box>
            </MenuItem>
            <MenuItem value="officer">
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PersonIcon sx={{ mr: 1, fontSize: 16 }} />
                Directivo
              </Box>
            </MenuItem>
          </Select>
        </FormControl>
 
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>Empresas</InputLabel>
          <Select
            value={companiesPerSearch}
            onChange={e => setCompaniesPerSearch(Number(e.target.value))}
            label="Empresas"
          >
            {COMPANIES_PER_SEARCH_OPTIONS.map(size => (
              <MenuItem key={size} value={size}>
                {size}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Cargos/empresa</InputLabel>
          <Select
            value={officersPerCompany}
            onChange={e => setOfficersPerCompany(Number(e.target.value))}
            label="Cargos/empresa"
          >
            {OFFICERS_PER_COMPANY_OPTIONS.map(size => (
              <MenuItem key={size} value={size}>
                {size}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Autocomplete
          freeSolo
          options={autocompleteOptions}
          loading={autocompleteLoading}
          inputValue={searchQuery}
          value={selectedAutocomplete}
          filterOptions={x => x}
          onInputChange={(event, newValue, reason) => {
            setSearchQuery(newValue);
            if (reason === 'input') {
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
              setSelectedAutocomplete(value);
              // Display: new/current name; Search: canonical key (original_name for aliases).
              // The profile is stored under the ORIGINAL name when the company was renamed,
              // so downstream lookups must use that (e.g. "CACTUS CAPITAL" → search
              // "EJEVAERN CONSULTING" to find the actual profile).
              const displayName = value.name || value.company_name || value.value || '';

              // Sole shareholder selection: plot the shareholder node and stage
              // its participadas behind a confirmation pill. Avoids N silent
              // parallel v3 lookups on every selection, and shows the true total
              // (not just the autocomplete-capped sample in value.owns).
              const isSoleShareholderCorporate = value.type === 'sole_shareholder';
              const isSoleShareholderIndividual =
                value.type === 'officer_sole_shareholder' || value.is_sole_shareholder;
              if (
                (isSoleShareholderCorporate || isSoleShareholderIndividual) &&
                (value.owns_total > 0 || (Array.isArray(value.owns) && value.owns.length > 0))
              ) {
                const entityKind = isSoleShareholderCorporate ? 'company' : 'person';
                const entityId = plotBareShareholderNode(displayName, entityKind);
                const total = value.owns_total || value.owns?.length || 0;
                setPendingSubsidiaries({
                  entityName: displayName,
                  entityId,
                  entityKind,
                  count: total,
                });
                setSearchQuery('');
                return;
              }

              const searchKey = value.is_alias
                ? (value.original_name || value.value || displayName)
                : (value.company_name_normalized || value.value || displayName);
              setSearchQuery(displayName);
              handleSearch(searchKey, value.type === 'company');
            } else if (typeof value === 'string') {
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
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.label + (option.cif || '')}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%' }}>
                {option.type === 'sole_shareholder' ? (
                  <AccountTreeIcon sx={{ fontSize: 16, color: 'warning.main', mt: 0.3 }} />
                ) : option.type === 'company' ? (
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
                        Socio único
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
                        🏛️ {option._deputyMatch.deputy.FECHABAJA ? 'Ex-diputado' : 'Diputado'}
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
                        Socio único de {option.owns_total || option.owns?.length || 0} empresa
                        {(option.owns_total || option.owns?.length || 0) !== 1 ? 's' : ''}
                      </Typography>
                    )}
                  {option.is_alias && option.original_name && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Antes: {option.original_name}
                    </Typography>
                  )}
                  {option.has_new_name && option.new_company_name && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Ahora: {option.new_company_name}
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
                        {option.company_count} empresa{option.company_count !== 1 ? 's' : ''} (cargo)
                      </Typography>
                    )}
                  {option.is_sole_shareholder &&
                    ((option.owns_total || 0) > 0 || (option.owns && option.owns.length > 0)) && (
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', color: 'warning.dark', fontStyle: 'italic' }}
                      >
                        Socio único de {option.owns_total || option.owns?.length || 0} empresa
                        {(option.owns_total || option.owns?.length || 0) !== 1 ? 's' : ''}
                      </Typography>
                    )}
                </Box>
              </Box>
            </Box>
          )}
          sx={{ flexGrow: 1, minWidth: 200 }}
          renderInput={params => (
            <TextField
              {...params}
              size="small"
              placeholder={searchType === 'company' ? 'Search company...' : 'Search officer...'}
              onKeyDown={handleKeyDown}
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
          onClick={() => handleSearch()}
          disabled={isSearching || !searchQuery.trim()}
          startIcon={isSearching ? <CircularProgress size={16} /> : <SearchIcon />}
        >
          Search
        </Button>
        {searchType === 'company' && graphData.nodes.length > 0 && (
          <Button
            variant="outlined"
            color="warning"
            size="small"
            startIcon={<DescriptionIcon />}
            sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
            onClick={() => {
              const name = (lastSearchContext?.query || searchQuery || '').trim();
              if (!name) return;
              setDdCheckoutCompany(name);
              setDdCheckoutOpen(true);
            }}
          >
            Due Diligence
          </Button>
        )}
        <TextField
          label="Filtrar nodos"
          placeholder="ej: Garcia, Telefonica"
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
        <IconButton onClick={() => setShowSettings(!showSettings)} title="Configuración del grafo">
          <SettingsIcon />
        </IconButton>
      </Box>

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
            <strong>{pendingSubsidiaries.entityName}</strong> es socio único de{' '}
            {pendingSubsidiaries.count} empresa
            {pendingSubsidiaries.count !== 1 ? 's' : ''}.
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
              ? 'Cargando…'
              : `Cargar ${pendingSubsidiaries.count} participada${pendingSubsidiaries.count !== 1 ? 's' : ''}`}
          </Button>
          <IconButton size="small" onClick={() => setPendingSubsidiaries(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {lastSearchContext && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            Cargados: {lastSearchContext.offset}
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
              {loadingMore ? <CircularProgress size={14} /> : 'Cargar más'}
            </Button>
          )}
        </Box>
      )}

      {/* Status & position filter chips */}
      {graphData.links.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1, alignItems: 'center' }}>
          <Chip
            label={`Vigentes (${statusCounts.active})`}
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
            label={`Cesados (${statusCounts.ceased})`}
            size="small"
            variant={statusFilters.has('ceased') ? 'filled' : 'outlined'}
            color="error"
            onClick={() => setStatusFilters(prev => {
              const next = new Set(prev);
              next.has('ceased') ? next.delete('ceased') : next.add('ceased');
              return next;
            })}
          />
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Chip
            label="Socio único"
            size="small"
            variant={showShareholders ? 'filled' : 'outlined'}
            sx={
              showShareholders
                ? { bgcolor: '#fbc02d', color: '#212121', '&:hover': { bgcolor: '#f9a825' } }
                : { borderColor: '#fbc02d', color: '#9e7b10' }
            }
            onClick={() => setShowShareholders(prev => !prev)}
          />
          {availablePositions.length > 0 && (
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          )}
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
          {hasChipFilters && (
            <Chip
              label="Limpiar filtros"
              size="small"
              variant="outlined"
              onDelete={() => {
                setStatusFilters(new Set());
                setPositionFilters(new Set());
              }}
            />
          )}
        </Box>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Configuración del Grafo
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="caption">Tamaño de nodos</Typography>
              <Slider
                value={nodeSize}
                onChange={(e, value) => setNodeSize(value)}
                min={4}
                max={20}
                step={1}
                size="small"
              />
            </Box>
            <Box>
              <Typography variant="caption">Tamaño de etiquetas</Typography>
              <Slider
                value={labelSize}
                onChange={(e, value) => setLabelSize(value)}
                min={5}
                max={18}
                step={1}
                size="small"
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
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
          px: 1,
          py: 0.25,
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Acercar">
            <IconButton onClick={zoomIn} size="small">
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Alejar">
            <IconButton onClick={zoomOut} size="small">
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Centrar">
            <IconButton onClick={centerGraph} size="small">
              <CenterIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Limpiar grafo">
            <IconButton onClick={clearGraph} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={
              isFullscreen
                ? 'Salir de pantalla completa'
                : embedded
                  ? 'Pantalla completa (necesaria para gestionar nodos con clic derecho)'
                  : 'Pantalla completa'
            }
          >
            <IconButton onClick={toggleFullscreen} size="small">
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {hiddenNodeIds.size > 0 && (
            <Tooltip title="Gestionar nodos ocultos">
              <Button
                size="small"
                variant="outlined"
                onClick={openHiddenNodesMenu}
                startIcon={<VisibilityIcon sx={{ fontSize: 14 }} />}
                sx={{ fontSize: '0.7rem', py: 0, textTransform: 'none' }}
              >
                {hiddenNodesList.length} ocultos
              </Button>
            </Tooltip>
          )}
          <Typography variant="caption">
            Nodos: {filteredGraphData.nodes.length}
            {filterTerms.length > 0 || hiddenNodeIds.size > 0
              ? ` / ${graphData.nodes.length}`
              : ''}{' '}
            | Enlaces: {filteredGraphData.links.length}
            {filterTerms.length > 0 || hiddenNodeIds.size > 0 ? ` / ${graphData.links.length}` : ''}
          </Typography>
          {isLoading && <CircularProgress size={16} />}
        </Box>
      </Box>
      {/* Graph Container (full width, table floats on top) */}
      <Box
        ref={containerCallbackRef}
        sx={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 200 }}
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
            }}
            onNodeClick={handleNodeClick}
            onNodeRightClick={handleNodeRightClick}
            onNodeDrag={handleNodeDrag}
            onNodeDragEnd={handleNodeDragEnd}
            onZoom={handleZoom}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.005}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            linkDirectionalArrowColor={link => {
              const cat = (link.category || '').toLowerCase();
              if (link.type === 'ownership') {
                return cat === 'socio_perdido' ? '#bf8f30' : '#fbc02d';
              }
              if (
                cat.includes('nombramiento') ||
                cat.includes('reeleccion') ||
                cat.includes('reelección')
              ) return '#43a047';
              if (
                cat.includes('cese') ||
                cat.includes('dimision') ||
                cat.includes('dimisión') ||
                cat.includes('revocacion') ||
                cat.includes('revocación')
              ) return '#e53935';
              return '#90a4ae';
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
              background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              color: 'white',
              '&:hover': { background: 'linear-gradient(135deg, #1e88e5 0%, #1976d2 100%)' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              
              <TableIcon sx={{ fontSize: 16 }} />
              <Typography variant="subtitle2" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                Datos (
                {dateFilter
                  ? `${visibleTableRows.length} / ${tableRows.length}`
                  : tableRows.length}
                )
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              {contextNode && contextNode.type !== 'officer' && (
                <Tooltip title="Comprar informe Due Diligence">
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
              <Tooltip title="Copiar tabla (Excel/Word)">
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
              <Tooltip title={isTableCollapsed ? 'Expandir tabla' : 'Minimizar tabla'}>
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
                label={`${CATEGORY_LABELS[dateFilter.category] || dateFilter.category} · ${dateFilter.date}`}
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
                        color: '#1565c0',
                      }}
                    >
                      Empresa
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 'bold',
                        fontSize: '0.7rem',
                        py: 0.5,
                        bgcolor: '#f5f5f5',
                        color: '#1565c0',
                      }}
                    >
                      Directivo
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 'bold',
                        fontSize: '0.7rem',
                        py: 0.5,
                        bgcolor: '#f5f5f5',
                        color: '#1565c0',
                      }}
                    >
                      Cargo
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 'bold',
                        fontSize: '0.7rem',
                        py: 0.5,
                        bgcolor: '#f5f5f5',
                        color: '#1565c0',
                      }}
                    >
                      Tipo
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 'bold',
                        fontSize: '0.7rem',
                        py: 0.5,
                        bgcolor: '#f5f5f5',
                        color: '#1565c0',
                      }}
                    >
                      Fecha
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleTableRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: '#4b5563' }}>
                        <Typography variant="caption" sx={{ color: '#4b5563' }}>
                          Busca una empresa o directivo para ver datos
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleTableRows.map((row, idx) => (
                      <TableRow
                        key={`${row.company}-${row.officer}-${row.position}-${idx}`}
                        hover
                        sx={{
                          '&:nth-of-type(odd)': { bgcolor: 'rgba(25, 118, 210, 0.03)' },
                          '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.08)' },
                        }}
                      >
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
                          title={row.companyNode ? `Acciones sobre ${row.company}` : row.company}
                        >
                          {row.company}
                        </TableCell>
                        <TableCell
                          onClick={
                            row.officerNode
                              ? (e) => handleNodeRightClick(row.officerNode, e)
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
                              ? `${row.officer} — ${officerDeputyMatches[row.officer].deputy.FECHABAJA ? 'Ex-diputado' : 'Diputado'}${officerDeputyMatches[row.officer].deputy.FORMACIONELECTORAL ? ' · ' + officerDeputyMatches[row.officer].deputy.FORMACIONELECTORAL : ''}`
                              : row.officerNode
                                ? `Acciones sobre ${row.officer}`
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
                              🏛️ {officerDeputyMatches[row.officer].deputy.FECHABAJA ? 'Ex-dip.' : 'Diputado'}
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
                            {CATEGORY_LABELS[row.category] || row.category}
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
                              ? `Filtrar por esta fecha en ${row.company}`
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
          { color: nodeColors.company, label: 'Empresas' },
          { color: nodeColors.officer_individual, label: 'Personas' },
          { color: nodeColors.officer_company, label: 'Emp. Directivas' },
          { color: nodeColors.expanded, label: 'Expandidos' },
          { color: nodeColors.searchOrigin, label: 'Búsqueda' },
        ].map(item => (
          <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 'inherit', lineHeight: 1 }}>{item.label}</Typography>
          </Box>
        ))}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Box sx={{ width: 14, height: 2, bgcolor: '#2e7d32' }} />
          <Typography sx={{ fontSize: 'inherit', lineHeight: 1 }}>Nombram.</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Box sx={{ width: 14, height: 2, bgcolor: '#d32f2f' }} />
          <Typography sx={{ fontSize: 'inherit', lineHeight: 1 }}>Ceses</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Box
            sx={{
              width: 14,
              height: 2,
              backgroundImage: 'repeating-linear-gradient(to right, #fbc02d 0 4px, transparent 4px 7px)',
            }}
          />
          <Typography sx={{ fontSize: 'inherit', lineHeight: 1 }}>Socio único</Typography>
        </Box>
        <Typography sx={{ fontSize: 'inherit', lineHeight: 1, ml: 'auto' }}>
          {embedded && !isFullscreen
            ? 'Doble clic: expandir | Pantalla completa para gestionar'
            : 'Doble clic: expandir | Clic derecho: gestionar'}
        </Typography>
      </Box>
    </>
  );

  const nodeManagementOverlays = (() => {
    const overlayContainer = embedded && isFullscreen ? fullscreenContainerRef.current : undefined;
    return (
      <>
        <Menu
          open={Boolean(hiddenNodesMenuAnchorEl)}
          anchorEl={hiddenNodesMenuAnchorEl}
          onClose={closeHiddenNodesMenu}
          container={overlayContainer}
        >
          <Box sx={{ px: 2, py: 1, minWidth: 260 }}>
            <Typography variant="subtitle2">Nodos ocultos</Typography>
            <Typography variant="caption" color="text.secondary">
              {hiddenNodesList.length} nodo(s)
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={unhideAllNodes} disabled={hiddenNodesList.length === 0}>
            <ListItemIcon>
              <VisibilityIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Mostrar todos</ListItemText>
          </MenuItem>
          <Divider />
          {hiddenNodesList.length === 0 ? (
            <MenuItem disabled>
              <ListItemText>Sin nodos ocultos</ListItemText>
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
                  secondary={node.type === 'officer' ? 'Directivo' : 'Empresa'}
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
                {contextNode.type === 'officer' ? 'Directivo' : 'Empresa'}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {contextNode.name}
              </Typography>
            </Box>
          )}
          <Divider />
          <MenuItem onClick={() => { closeNodeContextMenu(); if (contextNode) expandNode(contextNode); }}>
            <ListItemIcon>
              <NetworkIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText>Expandir nodo</ListItemText>
          </MenuItem>
          <MenuItem onClick={openEditNodeDialog}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Modificar nodo</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={openMergeNodeDialog}
            disabled={!contextNode || mergeCandidateOptions.length === 0}
          >
            <ListItemIcon>
              <CallMergeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              {mergeCandidateOptions.length > 0
                ? 'Fusionar nodo'
                : 'Sin nodos compatibles para fusionar'}
            </ListItemText>
          </MenuItem>
          <MenuItem onClick={openDataPreview}>
            <ListItemIcon>
              <PreviewIcon fontSize="small" color="info" />
            </ListItemIcon>
            <ListItemText>Vista previa de datos</ListItemText>
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
              <ListItemText>Línea temporal</ListItemText>
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
              <ListItemText>Comprar Due Diligence</ListItemText>
            </MenuItem>
          )}
          <MenuItem onClick={hideNodeFromMenu}>
            <ListItemIcon>
              <VisibilityOffIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Ocultar solo nodo</ListItemText>
          </MenuItem>
          <MenuItem onClick={hideNodeWithRelationsFromMenu}>
            <ListItemIcon>
              <VisibilityOffIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Ocultar nodo + conectados</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={openDeleteNodeDialog} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteOutlineIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Eliminar nodo</ListItemText>
          </MenuItem>
        </Menu>

        <Dialog
          open={isEditNodeDialogOpen}
          onClose={() => setIsEditNodeDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          container={overlayContainer}
        >
          <DialogTitle>Modificar nodo</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <TextField
                label="Nombre visible"
                value={editNodeName}
                onChange={e => setEditNodeName(e.target.value)}
                fullWidth
                autoFocus
              />
            </Box>
            {contextNode?.type === 'officer' && (
              <Box sx={{ mt: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Tipo de directivo</InputLabel>
                  <Select
                    label="Tipo de directivo"
                    value={editNodeSubtype}
                    onChange={e => setEditNodeSubtype(e.target.value)}
                  >
                    <MenuItem value="individual">Persona física</MenuItem>
                    <MenuItem value="company">Persona jurídica</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Esta operación cambia el nombre mostrado en el grafo para ayudarte a corregir
              variantes.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsEditNodeDialogOpen(false)}>Cancelar</Button>
            <Button variant="contained" onClick={saveNodeEdit}>
              Guardar cambios
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
          <DialogTitle>Fusionar nodos</DialogTitle>
          <DialogContent sx={{ pb: 1 }}>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Fusionar <strong>{contextNode?.name}</strong> en otro nodo. Todas las relaciones
              pasarán al nodo destino.
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
              noOptionsText="No hay nodos que coincidan"
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
                    {params.group}
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
                      {option.node.type === 'officer' ? 'Directivo' : 'Empresa'}
                    </Typography>
                    {option.group === 'Nombres similares' && (
                      <Typography variant="caption" color="primary.main">
                        {(option.score * 100).toFixed(0)}%
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
              renderInput={params => <TextField {...params} label="Nodo destino" />}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Recomendación: fusiona solo nodos que representen claramente la misma entidad.
              En el BORME, un mismo directivo puede aparecer como «SANCHEZ GOMEZ JUAN» y «JUAN SANCHEZ GOMEZ».
              Al fusionar, los datos de ambas variantes se combinan en la vista previa y el informe.
              Si se trata de personas distintas con nombres similares, la fusión mezclará datos no relacionados.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsMergeNodeDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={confirmMergeNodes}
              disabled={!mergeTargetOption && !exactTypedMergeOption}
            >
              Fusionar
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
          <DialogTitle>Eliminar nodo</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              ¿Seguro que quieres eliminar <strong>{contextNode?.name}</strong> y todas sus
              relaciones?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsDeleteNodeDialogOpen(false)}>Cancelar</Button>
            <Button color="error" variant="contained" onClick={confirmDeleteNode}>
              Eliminar
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
                label={previewNodeType === 'officer' ? 'Directivo' : 'Empresa'}
                size="small"
                color={previewNodeType === 'officer' ? 'warning' : 'primary'}
                variant="outlined"
              />
            </Box>
            <IconButton onClick={() => setPreviewOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ userSelect: 'none' }}>
            {previewLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                <CircularProgress size={40} />
                <Typography sx={{ ml: 2 }} color="text.secondary">Cargando datos...</Typography>
              </Box>
            )}
            {previewError && (
              <Alert severity="warning" sx={{ my: 2 }}>{previewError}</Alert>
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
                          <TableCell sx={{ fontWeight: 700 }}>Nombre</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Cargo</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {officers.map((o, i) => (
                          <TableRow key={i}>
                            <TableCell>{o.name || '-'}</TableCell>
                            <TableCell>{o.position || '-'}</TableCell>
                            <TableCell>{o.date ? formatDate(o.date) : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              );

              return (
                <Box>
                  {/* Overview section */}
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                    <InfoIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
                    Resumen
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                      <Box sx={{ gridColumn: '1 / -1' }}>
                        <Typography variant="caption" color="text.secondary">Denominación</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {previewData.name}
                        </Typography>
                        {e?.previousNames?.length > 0 && (
                          <Typography variant="caption" sx={{ color: 'warning.main', fontStyle: 'italic' }}>
                            Antes: {e.previousNames.join(', ')}
                          </Typography>
                        )}
                      </Box>
                      {e?.cif && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">CIF/NIF</Typography>
                          <Typography variant="body2">{e.cif}</Typography>
                        </Box>
                      )}
                      {e?.address && (
                        <Box sx={{ gridColumn: e?.cif ? 'auto' : '1 / -1' }}>
                          <Typography variant="caption" color="text.secondary">Domicilio</Typography>
                          <Typography variant="body2">{e.address}</Typography>
                        </Box>
                      )}
                      {e?.activity && (
                        <Box sx={{ gridColumn: '1 / -1' }}>
                          <Typography variant="caption" color="text.secondary">Objeto social</Typography>
                          <Typography variant="body2">{e.activity}</Typography>
                        </Box>
                      )}
                      {e?.capital && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Capital social</Typography>
                          <Typography variant="body2">{e.capital}</Typography>
                        </Box>
                      )}
                      {(e?.firstSeen || e?.lastSeen) && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Rango de publicaciones BORME</Typography>
                          <Typography variant="body2">
                            {e.firstSeen ? formatDate(e.firstSeen) : '?'} — {e.lastSeen ? formatDate(e.lastSeen) : '?'}
                          </Typography>
                        </Box>
                      )}
                      {e?.eventCount > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Publicaciones encontradas</Typography>
                          <Typography variant="body2">{e.eventCount}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Paper>

                  {/* Current officers — grouped by person, sorted by position importance */}
                  {e?.currentOfficers?.length > 0 && (
                    <>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: '#1976d2' }}>
                        Directivos actuales ({e.currentOfficers.length})
                      </Typography>
                      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>Nombre</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Cargo(s)</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {e.currentOfficers.map((officer, i) => {
                              const dm = officerDeputyMatches[officer.name];
                              const deputyChip = dm?.deputy ? (
                                <Chip
                                  label={dm.deputy.FECHABAJA ? '🏛️ Ex-dip.' : `🏛️ Diputado${dm.deputy.FORMACIONELECTORAL ? ` · ${dm.deputy.FORMACIONELECTORAL}` : ''}`}
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
                                  <TableCell>{officer.positions[0].date ? formatDate(officer.positions[0].date) : '-'}</TableCell>
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
                                      {pos.date ? formatDate(pos.date) : '-'}
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
                      {officerTable(e.officers.nombramientos, '#43a047', 'Nombramientos')}
                      {officerTable(e.officers.reelecciones, '#43a047', 'Reelecciones')}
                      {officerTable(e.officers.ceses_dimisiones, '#e53935', 'Ceses/Dimisiones')}
                      {officerTable(e.officers.revocaciones, '#e53935', 'Revocaciones')}
                    </>
                  )}

                  {/* Watermark */}
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', mt: 2, fontStyle: 'italic' }}
                  >
                    Vista previa — para un informe completo, adquiera una Due Diligence
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
                const companyName = o.company_name || o.company || 'Desconocida';
                if (!byCompany[companyName]) byCompany[companyName] = [];
                byCompany[companyName].push(o);
              });
              // v3 expand-officer returns: officer_name, company_name, specific_role,
              // event_type ("nombramientos"/"ceses_dimisiones"), status ("active"/"ceased"), date
              const resolveStatus = (o) => {
                const st = (o.status || '').toLowerCase();
                if (st === 'active') return { label: 'Activo', color: 'success' };
                if (st === 'ceased') return { label: 'Cesado', color: 'error' };
                const evt = (o.event_type || '').toLowerCase();
                if (evt.includes('nombr') || evt.includes('reelecc')) return { label: 'Activo', color: 'success' };
                if (evt.includes('cese') || evt.includes('dimis') || evt.includes('revoc')) return { label: 'Cesado', color: 'error' };
                return { label: 'Desconocido', color: 'default' };
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
                            🏛️ {isFormer ? 'Ex-diputado del Congreso' : 'Diputado del Congreso'}
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
                            Coincide con: <b>{fullName}</b>
                          </Typography>
                        )}
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mt: 0.5 }}>
                          {d.FORMACIONELECTORAL && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">Partido</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{d.FORMACIONELECTORAL}</Typography>
                            </Box>
                          )}
                          {d.GRUPOPARLAMENTARIO && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">Grupo</Typography>
                              <Typography variant="body2">{d.GRUPOPARLAMENTARIO}</Typography>
                            </Box>
                          )}
                          {d.CIRCUNSCRIPCION && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">Circunscripción</Typography>
                              <Typography variant="body2">{d.CIRCUNSCRIPCION}</Typography>
                            </Box>
                          )}
                          {legs.length > 0 && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Legislatura{legs.length !== 1 ? 's' : ''} ({legs.length})
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
                                {legs.join(', ')}
                              </Typography>
                            </Box>
                          )}
                          {(earliest || latest) && (
                            <Box sx={{ gridColumn: '1 / -1' }}>
                              <Typography variant="caption" color="text.secondary">Período</Typography>
                              <Typography variant="body2">
                                {earliest || '?'}
                                {isFormer ? ` — ${latest || '?'}` : ' — actualidad'}
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
                            Ficha en congreso.es →
                          </Typography>
                        )}
                      </Alert>
                    );
                  })()}
                  {variants && variants.length > 1 && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Datos combinados de nodos fusionados
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Variantes de nombre: {variants.join(' / ')}
                      </Typography>
                      <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                        Si los nombres corresponden a personas distintas, los cargos mostrados pueden mezclar datos de personas diferentes.
                      </Typography>
                    </Alert>
                  )}

                  {/* Wholly-owned companies (sole shareholder positions) */}
                  {whollyOwned.length > 0 && (
                    <Box sx={{ mb: 2.5 }}>
                      <Alert severity="warning" sx={{ mb: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          Socio único de {whollyOwned.length} empresa{whollyOwned.length !== 1 ? 's' : ''}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Esta persona figura como propietaria al 100% de las empresas siguientes.
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
                                {isDissolved && <Chip label="Disuelta" size="small" color="error" />}
                                {isInConcurso && <Chip label="Concurso" size="small" color="warning" />}
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
                    Cargos en {Object.keys(byCompany).length} empresa{Object.keys(byCompany).length !== 1 ? 's' : ''}
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
                            <TableCell sx={{ fontWeight: 700 }}>Cargo</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Estado</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
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
                                <TableCell>{formatDate(resolveDate(o))}</TableCell>
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
                    Vista previa — para un informe completo, adquiera una Due Diligence
                  </Typography>
                </Box>
              );
            })()}
          </DialogContent>
          <DialogActions>
            {previewData?.type === 'company' && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<DescriptionIcon />}
                onClick={() => {
                  setPreviewOpen(false);
                  setDdCheckoutCompany(previewNodeName);
                  setDdCheckoutOpen(true);
                }}
              >
                Comprar Due Diligence
              </Button>
            )}
            <Button onClick={() => setPreviewOpen(false)}>Cerrar</Button>
          </DialogActions>
        </Dialog>

        {/* Officer Timeline Dialog */}
        <OfficerTimelineDialog
          open={timelineDialogOpen}
          officerName={timelineOfficerName}
          officerRecords={timelineOfficerRecords}
          nameVariants={contextNode?.nameVariants}
          onClose={() => setTimelineDialogOpen(false)}
          container={overlayContainer}
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
          bgcolor: isFullscreen ? 'background.paper' : undefined,
          height: isFullscreen ? '100vh' : undefined,
        }}
      >
        {searchPanelContent}
        {/* Loading overlay for initial search */}
        {isSearching && graphData.nodes.length === 0 && (
          <Box sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            bgcolor: 'background.default',
            gap: 2,
          }}>
            <CircularProgress size={40} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Buscando {searchQuery}...
            </Typography>
          </Box>
        )}
        {graphAreaContent}
        {nodeManagementOverlays}
        <DDCheckoutDialog
          open={ddCheckoutOpen}
          onClose={() => setDdCheckoutOpen(false)}
          companyName={ddCheckoutCompany}
          country="es"
        />
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
              <Typography variant="h6">Red de Empresas Españolas</Typography>
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
          <Button onClick={onHide}>Cerrar</Button>
        </DialogActions>
      </Dialog>
      {nodeManagementOverlays}
      <DDCheckoutDialog
        open={ddCheckoutOpen}
        onClose={() => setDdCheckoutOpen(false)}
        companyName={ddCheckoutCompany}
        country="es"
      />
    </>
  );
};

export default SpanishCompanyNetworkGraph;
