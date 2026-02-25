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
} from '@mui/icons-material';
import PersonIcon from '@mui/icons-material/Person';
import ForceGraph2D from 'react-force-graph-2d';
import { parseSpanishCompanyData } from '../utils/spanishCompanyParserWithTerms';
import { useTerms } from '../hooks/useTerms';
import { spanishCompaniesService } from '../services/spanishCompaniesService';

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

const SEARCH_SIZE_OPTIONS = [25, 50, 100, 200, 500];

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

const computeGraphCentroid = nodes => {
  const positioned = (nodes || []).filter(isFinitePoint);
  if (positioned.length === 0) return { x: 0, y: 0 };
  return {
    x: positioned.reduce((sum, n) => sum + n.x, 0) / positioned.length,
    y: positioned.reduce((sum, n) => sum + n.y, 0) / positioned.length,
  };
};

const findNonOverlappingPosition = ({
  anchor,
  candidate,
  occupiedNodes,
  minDistance = 80,
  maxAttempts = 36,
}) => {
  const occupied = (occupiedNodes || []).filter(isFinitePoint);
  let x = candidate.x;
  let y = candidate.y;
  const minDistanceSq = minDistance * minDistance;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const hasOverlap = occupied.some(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return dx * dx + dy * dy < minDistanceSq;
    });

    if (!hasOverlap) return { x, y };

    const baseAngle = Math.atan2(y - anchor.y, x - anchor.x) || 0;
    const angle = baseAngle + 0.45 * (attempt + 1);
    const radius = Math.hypot(x - anchor.x, y - anchor.y) + 40 + attempt * 10;
    x = anchor.x + Math.cos(angle) * radius;
    y = anchor.y + Math.sin(angle) * radius;
  }

  return { x, y };
};

const radialPosition = ({
  anchor,
  index,
  total,
  occupiedNodes,
  baseRadius = 280,
  minDistance = 90,
  startAngle = -Math.PI / 2,
}) => {
  const slots = Math.max(total, 1);
  const ring = Math.floor(index / slots);
  const slotInRing = index % slots;
  const angle = startAngle + (2 * Math.PI * slotInRing) / slots;
  const radius = baseRadius + ring * 80;
  const candidate = {
    x: anchor.x + Math.cos(angle) * radius,
    y: anchor.y + Math.sin(angle) * radius,
  };

  return findNonOverlappingPosition({
    anchor,
    candidate,
    occupiedNodes,
    minDistance,
  });
};

const categorySectorPosition = ({
  anchor,
  category,
  slot,
  occupiedNodes,
  baseRadius = 320,
  minDistance = 90,
}) => {
  const centerAngle = CATEGORY_LAYOUT_ANGLE[category] ?? -Math.PI / 2;
  const sectorWidth = 6;
  const ring = Math.floor(slot / sectorWidth);
  const slotInRing = slot % sectorWidth;
  const angle = centerAngle + (slotInRing - (sectorWidth - 1) / 2) * 0.24;
  const radius = baseRadius + ring * 80;
  const candidate = {
    x: anchor.x + Math.cos(angle) * radius,
    y: anchor.y + Math.sin(angle) * radius,
  };

  return findNonOverlappingPosition({
    anchor,
    candidate,
    occupiedNodes,
    minDistance,
  });
};

const normalizeNodeId = id => (id == null ? '' : String(id));
const isSameNodeId = (a, b) => normalizeNodeId(a) === normalizeNodeId(b);
const getNodeIdFromRef = ref => (ref && typeof ref === 'object' ? ref.id : ref);

const createCategorySlots = () => ({
  nombramientos: 0,
  reelecciones: 0,
  revocaciones: 0,
  ceses_dimisiones: 0,
});

const normalizeCategoryKey = category => {
  if (category === 'reelecciones') return 'reelecciones';
  if (category === 'revocaciones') return 'revocaciones';
  if (category === 'ceses_dimisiones') return 'ceses_dimisiones';
  return 'nombramientos';
};

const seedCategorySlotsFromExistingLinks = ({ companyId, nodes, links }) => {
  const slots = createCategorySlots();
  const normalizedCompanyId = normalizeNodeId(companyId);
  if (!normalizedCompanyId) return slots;

  const nodeById = new Map((nodes || []).map(node => [normalizeNodeId(node.id), node]));
  (links || []).forEach(link => {
    const sourceId = normalizeNodeId(getNodeIdFromRef(link.source));
    const targetId = normalizeNodeId(getNodeIdFromRef(link.target));
    if (!sourceId || !targetId) return;

    let neighborId = null;
    if (isSameNodeId(sourceId, normalizedCompanyId)) {
      neighborId = targetId;
    } else if (isSameNodeId(targetId, normalizedCompanyId)) {
      neighborId = sourceId;
    } else {
      return;
    }

    const neighborNode = nodeById.get(neighborId);
    if (!neighborNode || neighborNode.type !== 'officer') return;

    const categoryKey = normalizeCategoryKey(link.category);
    slots[categoryKey] += 1;
  });

  return slots;
};

const normalizeNameForMerge = value =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeEdgeLabelText = (relationship, category) =>
  (relationship || CATEGORY_LABELS[category] || '').trim();

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
  const [labelFilterText, setLabelFilterText] = useState(''); // New state for label text filter
  const [isSearching, setIsSearching] = useState(false);
  const [searchResultSize, setSearchResultSize] = useState(50);
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

  // Container dimensions for ForceGraph2D (callback ref to detect DOM attachment in Dialog Portal)
  const [containerEl, setContainerEl] = useState(null);
  const containerCallbackRef = useCallback(node => {
    setContainerEl(node);
  }, []);
  const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 500 });
  const [containerReady, setContainerReady] = useState(false);

  // Double-click detection via single click timer
  const lastClickRef = useRef({ nodeId: null, time: 0 });

  // Fullscreen support
  const fullscreenContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Floating table panel state
  const [tablePosition, setTablePosition] = useState({ x: null, y: null }); // null = default position
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);
  const tableDragRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const dragFreezeRef = useRef(null);

  // Autocomplete state
  const [autocompleteOptions, setAutocompleteOptions] = useState([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [selectedAutocomplete, setSelectedAutocomplete] = useState(null);
  const searchTypeRef = useRef(searchType);
  searchTypeRef.current = searchType;

  // Terms hook for officer validation
  const { termData, isReady: termsAreReady } = useTerms();

  // Graph settings
  const [showSettings, setShowSettings] = useState(false);
  const [nodeSize, setNodeSize] = useState(9);
  const [linkDistance, setLinkDistance] = useState(130);
  const [chargeStrength, setChargeStrength] = useState(-170);
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

  useEffect(() => {
    if (fgRef.current && (visible || embedded)) {
      // Only reheat if visible and ref is available
      console.log('Reheating simulation due to settings change (linkDistance or chargeStrength).');
      fgRef.current.d3ReheatSimulation();
    }
  }, [linkDistance, chargeStrength, visible, embedded]);

  // Configure forces through the graph instance (stable under repeated node pinning)
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !containerReady || graphData.nodes.length === 0) return;
    const isPinned = node => !!node && (node.fx != null || node.fy != null);

    const chargeForce = fg.d3Force('charge');
    if (chargeForce) {
      // Pinned nodes act as anchors; they should not keep repelling the rest of the graph.
      chargeForce.strength(node => (isPinned(node) ? 0 : chargeStrength));
      if (typeof chargeForce.distanceMax === 'function') {
        // Bound long-range repulsion to avoid runaway drift when many nodes are pinned.
        chargeForce.distanceMax(Math.max(linkDistance * 1.5, 240));
      }
    }

    const linkForce = fg.d3Force('link');
    if (linkForce) {
      linkForce.distance(link => {
        const source = typeof link.source === 'object' ? link.source : null;
        const target = typeof link.target === 'object' ? link.target : null;
        return isPinned(source) || isPinned(target)
          ? Math.max(60, linkDistance * 0.7)
          : linkDistance;
      });
      linkForce.strength(link => {
        const source = typeof link.source === 'object' ? link.source : null;
        const target = typeof link.target === 'object' ? link.target : null;
        const sourcePinned = isPinned(source);
        const targetPinned = isPinned(target);
        if (sourcePinned && targetPinned) return 0.03;
        if (sourcePinned || targetPinned) return 0.08;
        return 0.18;
      });
      if (typeof linkForce.iterations === 'function') {
        linkForce.iterations(2);
      }
    }

    const forceX = fg.d3Force('x');
    if (forceX && typeof forceX.strength === 'function') {
      forceX.strength(node => (isPinned(node) ? 0 : 0.14));
    }
    const forceY = fg.d3Force('y');
    if (forceY && typeof forceY.strength === 'function') {
      forceY.strength(node => (isPinned(node) ? 0 : 0.14));
    }

    fg.d3Force(
      'collision',
      forceCollide()
        .radius(() => nodeSize + 4)
        .iterations(2)
    );

    if (typeof fg.d3AlphaDecay === 'function') {
      fg.d3AlphaDecay(0.06);
    }
    if (typeof fg.d3VelocityDecay === 'function') {
      fg.d3VelocityDecay(0.75);
    }
  }, [
    containerReady,
    graphData.nodes.length,
    graphData.links.length,
    chargeStrength,
    linkDistance,
    nodeSize,
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

  // Auto-load initial data when dialog opens with initialCompanyData or initialOfficerData
  useEffect(() => {
    if (!visible && !embedded) return;

    if (initialCompanyData && initialCompanyData.length > 0) {
      console.log(
        'Auto-loading initial company data into network graph:',
        initialCompanyData.length,
        'entries'
      );
      addCompanyWithOfficersToGraph(initialCompanyData);
      // Pin initial company nodes so they survive filtering
      initialCompanyData.forEach(company => {
        const companyName = normalizeCompanyName(company.name || company.company_name || '');
        if (companyName) {
          const companyId = companyNameToId(companyName);
          setPinnedNodeIds(prev => new Set([...prev, companyId]));
        }
      });
    } else if (initialOfficerData && initialOfficerData.name) {
      console.log('Auto-loading initial officer data into network graph:', initialOfficerData.name);
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
      setSearchQuery(initialCompanyName);
      handleSearch(initialCompanyName, true);
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
      console.log(`=== EXTRACTING OFFICERS FROM TEXT (${category}) ===`);
      console.log('Text:', text);

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

          console.log(`Pattern match - Position: "${position}", Names: "${namesText}"`);

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
            console.log(`Skipping invalid position: "${position}"`);
            continue;
          }

          // Split names by semicolon and comma, clean them
          const names = namesText
            .split(/[;,]/)
            .map(name => name.trim())
            .filter(name => name.length > 0);

          console.log(`Split names:`, names);

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
              console.log(`Added officer: ${cleanName} - ${position} (${category})`);
            } else {
              console.log(`Skipping invalid name: "${cleanName}"`);
            }
          });
        }
      }

      console.log(`Final extracted ${officers.length} officers:`, officers);
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

  const handleSearch = async (queryOverride = null, exactMatch = false) => {
    const query = (queryOverride || searchQuery).trim();
    if (!query) {
      setError('Por favor, introduce un término de búsqueda');
      return;
    }

    setIsSearching(true);
    setError(null);
    setLastSearchContext(null);

    try {
      if (searchType === 'officer') {
        // Officer search: use workingSearch with officerMode
        // Backend returns officer data in `officers` array, not `results`
        const data = await spanishCompaniesService.workingSearch(query, {
          size: searchResultSize,
          officerMode: true,
        });

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
            size: searchResultSize,
            offset: fetchedCount,
            hasMore: data.hasMore,
            total: data.total || fetchedCount,
          });
          setSearchQuery('');
        } else {
          setError(`No se encontraron resultados para el directivo "${query}".`);
        }
      } else {
        // Company search: use workingSearch
        const data = await spanishCompaniesService.workingSearch(query, {
          size: searchResultSize,
          exactMatch: exactMatch,
        });

        const fetchedCount = data.results?.length || 0;
        if (data.success && fetchedCount > 0) {
          const filtered = filterCompanyMatches(data.results, query);

          if (filtered.length > 0) {
            await addCompanyWithOfficersToGraph(filtered);
            // Pin company nodes so they survive filtering
            filtered.forEach(company => {
              const companyName = normalizeCompanyName(company.name || company.company_name || '');
              const companyId = companyNameToId(companyName);
              setPinnedNodeIds(prev => new Set([...prev, companyId]));
            });
            setLastSearchContext({
              query,
              searchType: 'company',
              exactMatch: exactMatch,
              size: searchResultSize,
              offset: fetchedCount,
              hasMore: data.hasMore,
              total: data.total || fetchedCount,
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

  // Add company with all its officers to the graph
  const addCompanyWithOfficersToGraph = useCallback(
    async (searchResults, anchorNode = null) => {
      console.log('Adding company with officers to graph:', searchResults);

      setIsLoading(true);
      setError(null);

      try {
        setGraphData(prevData => {
          const newNodes = [...prevData.nodes];
          const newLinks = [...prevData.links];

          const hasExplicitAnchor = isFinitePoint(anchorNode);
          const defaultAnchor = computeGraphCentroid(prevData.nodes);
          const anchor = hasExplicitAnchor ? { x: anchorNode.x, y: anchorNode.y } : defaultAnchor;
          const keepExpansionNodesFixed = hasExplicitAnchor;

          // Group companies by name to avoid duplicates
          const companiesByName = {};

          searchResults.forEach(company => {
            const companyName = company.name || company.company_name || 'Unknown';
            const cleanName = normalizeCompanyName(companyName);

            if (!companiesByName[cleanName]) {
              companiesByName[cleanName] = {
                entries: [],
                dateRange: { earliest: null, latest: null },
              };
            }

            companiesByName[cleanName].entries.push(company);

            // Track date range
            const entryDate = new Date(company.indexed_date || company.date || 0);
            if (
              !companiesByName[cleanName].dateRange.earliest ||
              entryDate < companiesByName[cleanName].dateRange.earliest
            ) {
              companiesByName[cleanName].dateRange.earliest = entryDate;
            }
            if (
              !companiesByName[cleanName].dateRange.latest ||
              entryDate > companiesByName[cleanName].dateRange.latest
            ) {
              companiesByName[cleanName].dateRange.latest = entryDate;
            }
          });

          // Add grouped company nodes and extract officers
          const groupedCompanies = Object.entries(companiesByName);
          groupedCompanies.forEach(([companyName, summary], companyIdx) => {
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
              const companyPosition = radialPosition({
                anchor,
                index: companyIdx,
                total: groupedCompanies.length,
                occupiedNodes: newNodes,
                baseRadius: 280,
                minDistance: 95,
              });

              // Add company node
              const companyNode = {
                id: companyId,
                name: companyName,
                type: 'spanish-company-group',
                companySummary: {
                  entries: summary.entries,
                  totalEntries: summary.entries.length,
                  dateRange: {
                    earliest: summary.dateRange.earliest?.toISOString(),
                    latest: summary.dateRange.latest?.toISOString(),
                  },
                },
                ...companyPosition,
                fx: keepExpansionNodesFixed ? companyPosition.x : null,
                fy: keepExpansionNodesFixed ? companyPosition.y : null,
              };
              newNodes.push(companyNode);
            }

            const companyNodeForLayout = newNodes.find(n => n.id === companyId) || companyExists;
            const companyAnchor = isFinitePoint(companyNodeForLayout)
              ? { x: companyNodeForLayout.x, y: companyNodeForLayout.y }
              : anchor;
            const categorySlots = seedCategorySlotsFromExistingLinks({
              companyId,
              nodes: newNodes,
              links: newLinks,
            });

            // Extract all officers from all entries (even if company already existed in graph)
            const allOfficers = {
              nombramientos: [],
              reelecciones: [],
              revocaciones: [],
              ceses_dimisiones: [],
            };

            // Process each entry to extract officers
            summary.entries.forEach(entry => {
              const entryDate = entry.indexed_date || entry.date;
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
                console.log(
                  `Using pre-parsed data for entry ${entry.identifier}:`,
                  entryParsed.officers
                );
              } else {
                // Fallback to parsing if not available
                entryParsed = parseSpanishCompanyData(entry);
                console.log(`Parsing entry ${entry.identifier} on-the-fly:`, entryParsed.officers);
              }

              // Iterate over each officer category to populate allOfficers
              Object.keys(allOfficers).forEach(categoryKey => {
                // Check if the primary parser found officers for this category
                if (
                  entryParsed.officers[categoryKey] &&
                  entryParsed.officers[categoryKey].length > 0
                ) {
                  console.log(
                    `Using primary parsed officers for ${categoryKey} in entry ${entry.identifier}`
                  );
                  entryParsed.officers[categoryKey].forEach(parsedOfficer => {
                    // Renamed to avoid confusion
                    allOfficers[categoryKey].push({
                      ...parsedOfficer,
                      category: categoryKey, // Explicitly set the category
                      date: entryDate,
                      entry_identifier: entry.identifier,
                      source_parser: 'primary',
                    });
                  });
                }
                // If primary parsing for this category is empty, AND raw text for this category exists in parsed_details
                else if (entry.parsed_details && entry.parsed_details[categoryKey]) {
                  console.log(
                    `Primary parsing for ${categoryKey} for entry ${entry.identifier} is empty. Trying fallback from parsed_details text: "${entry.parsed_details[categoryKey]}"`
                  );
                  const officersFromFallback = extractOfficersFromText(
                    entry.parsed_details[categoryKey],
                    categoryKey
                  );

                  if (officersFromFallback.length > 0) {
                    console.log(
                      `Fallback parser found ${officersFromFallback.length} officers for ${categoryKey} in entry ${entry.identifier}`
                    );
                    officersFromFallback.forEach(officer => {
                      allOfficers[categoryKey].push({
                        ...officer,
                        date: entryDate,
                        entry_identifier: entry.identifier,
                        source_parser: 'network_fallback',
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
                    officer?.position || officer?.role || officer?.title || 'associated_with'
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
                  console.log(
                    `Network: Removing duplicate officer in ${categoryKey}: ${officer.name} - ${officer.position}`
                  );
                  return false;
                }
                seen.add(key);
                return true;
              });
            });

            // Add officer nodes and links to company
            const allOfficersList = [
              ...allOfficers.nombramientos,
              ...allOfficers.reelecciones,
              ...allOfficers.revocaciones,
              ...allOfficers.ceses_dimisiones,
            ];

            console.log(`Adding ${allOfficersList.length} officers for company ${companyName}`);

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
                const categoryKey =
                  categorySlots[officer.category] != null ? officer.category : 'nombramientos';
                const slot = categorySlots[categoryKey];
                categorySlots[categoryKey] += 1;
                const officerPosition = categorySectorPosition({
                  anchor: companyAnchor,
                  category: categoryKey,
                  slot,
                  occupiedNodes: newNodes,
                  baseRadius: 300,
                  minDistance: 86,
                });

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
                  fx: keepExpansionNodesFixed ? officerPosition.x : null,
                  fy: keepExpansionNodesFixed ? officerPosition.y : null,
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
              // Make linkId unique by including category to allow multiple relationship types
              // between the same officer and company.
              const positionKey = officer.position
                ? officer.position.toLowerCase().replace(/[^a-z0-9]/g, '')
                : 'unknownpos';
              const linkId = `${companyId}-${officerNode.id}-${officer.category}-${positionKey}`;

              if (!newLinks.find(l => l.id === linkId)) {
                newLinks.push({
                  id: linkId,
                  source: companyId,
                  target: officerNode.id,
                  type: 'officer-company',
                  relationship: officer.position,
                  category: officer.category,
                  date: officer.date || null,
                });
              }
            });
          });

          return { nodes: newNodes, links: dedupeGraphLinks(newLinks) };
        });
      } catch (err) {
        console.error('Error adding company with officers to graph:', err);
        setError(`Error al añadir empresa al grafo: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [extractOfficersFromText, isCompanyOfficer]
  );

  // Add officer to graph with associated companies
  const addOfficerToGraph = useCallback(
    async (searchResults, officerNameParam) => {
      console.log('Adding officer to graph:', searchResults);

      setIsLoading(true);
      setError(null);

      try {
        // If searchResults is a single result, wrap it in an array
        const results = Array.isArray(searchResults) ? searchResults : [searchResults];

        // Group officer results by company name directly
        // Officer results from backend have { company_name, company, role, ... } structure
        const companiesMap = new Map();
        results.forEach(entry => {
          const companyName = (entry.company_name || entry.company || entry.name || '').trim();
          if (!companyName) return;
          const key = companyName.toUpperCase();
          if (!companiesMap.has(key)) {
            companiesMap.set(key, {
              name: companyName,
              entries: [],
              roles: [],
            });
          }
          const group = companiesMap.get(key);
          group.entries.push(entry);
          if (entry.role || entry.position) {
            group.roles.push(entry.role || entry.position);
          }
        });

        const companyEntries = Array.from(companiesMap.values());

        setGraphData(prevData => {
          const newNodes = [...prevData.nodes];
          const newLinks = [...prevData.links];
          const graphCenter = computeGraphCentroid(prevData.nodes);

          // Create the officer node first - use parameter instead of state
          const officerName = officerNameParam || results[0]?.name || 'Unknown Officer';
          const normalizedOfficerName = officerName.toLowerCase().trim();
          const officerId = `officer-${normalizedOfficerName.replace(/\s+/g, '-')}`;

          // Check if officer already exists
          let officerNode = newNodes.find(n => n.id === officerId);
          if (!officerNode) {
            const isCompany = isCompanyOfficer(officerName);
            const officerPosition = findNonOverlappingPosition({
              anchor: graphCenter,
              candidate: graphCenter,
              occupiedNodes: newNodes,
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
              fx: null,
              fy: null,
            };
            newNodes.push(officerNode);
          }

          const officerAnchor = isFinitePoint(officerNode)
            ? { x: officerNode.x, y: officerNode.y }
            : graphCenter;

          // Add company nodes and links for each grouped company
          companyEntries.forEach((group, companyIdx) => {
            const companyName = normalizeCompanyName(group.name || 'Unknown Company');
            const companyId = companyNameToId(companyName);

            // Add company to officer's list if not already there
            if (!officerNode.companies.includes(companyName)) {
              officerNode.companies.push(companyName);
            }

            // Check if company already exists
            let companyNode = newNodes.find(n => n.id === companyId);
            if (!companyNode) {
              const companyPosition = radialPosition({
                anchor: officerAnchor,
                index: companyIdx,
                total: companyEntries.length,
                occupiedNodes: newNodes,
                baseRadius: 130,
                minDistance: 92,
              });

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
                fx: null,
                fy: null,
              };
              newNodes.push(companyNode);
            }

            // Add link between officer and company
            const relationship = group.roles[0] || 'associated_with';
            const linkId = `${officerId}-${companyId}`;
            if (!newLinks.find(l => l.id === linkId)) {
              newLinks.push({
                id: linkId,
                source: officerId,
                target: companyId,
                type: 'officer-company',
                relationship: relationship,
                category: 'nombramientos',
                date: group.entries[0]?.indexed_date || group.entries[0]?.date || null,
              });
            }
          });

          return { nodes: newNodes, links: dedupeGraphLinks(newLinks) };
        });
      } catch (err) {
        console.error('Error adding officer to graph:', err);
        setError(`Error al añadir directivo al grafo: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [isCompanyOfficer]
  );

  // Expand officer node to show other companies
  const expandOfficerNode = useCallback(async officerNode => {
    try {
      // Use PostgreSQL for canonical company names (no ES parsing noise)
      const data = await spanishCompaniesService.pgExpandOfficer(officerNode.name.trim(), {
        size: searchResultSize,
      });

      if (data.success && data.officers && data.officers.length > 0) {
        // Group officer results by company name directly
        const companiesMap = new Map();
        data.officers.forEach(entry => {
          const companyName = (entry.company_name || entry.company || entry.name || '').trim();
          if (!companyName) return;
          const key = companyName.toUpperCase();
          if (!companiesMap.has(key)) {
            companiesMap.set(key, { name: companyName, entries: [], roles: [] });
          }
          const group = companiesMap.get(key);
          group.entries.push(entry);
          if (entry.role || entry.position) group.roles.push(entry.role || entry.position);
        });
        const companyEntries = Array.from(companiesMap.values());

        setGraphData(prevData => {
          const newNodes = [...prevData.nodes];
          const newLinks = [...prevData.links];
          const officerAnchor = isFinitePoint(officerNode)
            ? { x: officerNode.x, y: officerNode.y }
            : computeGraphCentroid(prevData.nodes);

          companyEntries.forEach((group, companyIdx) => {
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
              const companyPosition = radialPosition({
                anchor: officerAnchor,
                index: companyIdx,
                total: companyEntries.length,
                occupiedNodes: newNodes,
                baseRadius: 280,
                minDistance: 92,
              });

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

            // Always add link (even if company node already existed)
            const relationship = group.roles[0] || 'associated_with';
            const linkId = `${officerNode.id}-${companyId}`;
            if (!newLinks.find(l => l.id === linkId)) {
              newLinks.push({
                id: linkId,
                source: officerNode.id,
                target: companyId,
                type: 'officer-company',
                relationship: relationship,
                category: 'nombramientos',
                date: group.entries[0]?.indexed_date || group.entries[0]?.date || null,
              });
            }
          });

          return { nodes: newNodes, links: dedupeGraphLinks(newLinks) };
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error expanding officer node:', err);
      return false;
    }
  }, [searchResultSize]);

  // Expand company node to show its officers
  const expandCompanyNode = useCallback(
    async companyNode => {
      try {
        const companyName = companyNode.name.trim();
        // Use PostgreSQL for canonical officer names (no ES parsing noise)
        const data = await spanishCompaniesService.pgExpandCompany(companyName, {
          size: searchResultSize,
        });

        if (data.success && data.officers && data.officers.length > 0) {
          // PG returns pre-structured officers — add them directly to the graph
          setGraphData(prevData => {
            const newNodes = [...prevData.nodes];
            const newLinks = [...prevData.links];
            const anchor = isFinitePoint(companyNode)
              ? { x: companyNode.x, y: companyNode.y }
              : computeGraphCentroid(prevData.nodes);

            // Deduplicate officers by name
            const seen = new Map();
            data.officers.forEach(o => {
              const key = (o.name || '').toUpperCase();
              if (!seen.has(key)) seen.set(key, o);
            });

            let idx = 0;
            seen.forEach((officer, key) => {
              const officerId = `officer-${key.toLowerCase().replace(/\s+/g, '-')}`;
              const existingOfficer = newNodes.find(n => n.id === officerId);

              if (!existingOfficer) {
                const pos = radialPosition({
                  anchor,
                  index: idx,
                  total: seen.size,
                  occupiedNodes: newNodes,
                  baseRadius: 200,
                  minDistance: 80,
                });
                newNodes.push({
                  id: officerId,
                  name: officer.name,
                  type: 'officer',
                  subtype: 'individual',
                  positions: [{ company: companyName, position: officer.position, category: officer.event_type }],
                  companies: [companyName],
                  ...pos,
                  fx: null,
                  fy: null,
                });
              }

              const linkId = `${companyNode.id}--${officerId}`;
              if (!newLinks.find(l => l.id === linkId)) {
                newLinks.push({
                  id: linkId,
                  source: companyNode.id,
                  target: officerId,
                  relationship: officer.position || 'Cargo no especificado',
                  category: officer.event_type || 'nombramientos',
                });
              }
              idx++;
            });

            return { nodes: newNodes, links: newLinks };
          });
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error expanding company node:', err);
        return false;
      }
    },
    [searchResultSize]
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

  // Double-click detection via onNodeClick (library has no onNodeDoubleClick)
  const DOUBLE_CLICK_MS = 450;
  const EMBEDDED_DOUBLE_CLICK_MS = 750;
  const handleNodeClick = useCallback(
    (node, event) => {
      const now = Date.now();
      const last = lastClickRef.current;
      const nodeId = normalizeNodeId(node.id);
      const threshold = embedded && !isFullscreen ? EMBEDDED_DOUBLE_CLICK_MS : DOUBLE_CLICK_MS;
      const browserDoubleClick = Number(event?.detail) >= 2;

      if (
        browserDoubleClick ||
        (isSameNodeId(last.nodeId, nodeId) && now - last.time < threshold)
      ) {
        // Double click detected
        lastClickRef.current = { nodeId: null, time: 0 };
        expandNode(node);
      } else {
        lastClickRef.current = { nodeId, time: now };
      }
    },
    [expandNode, embedded, isFullscreen]
  );

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

        const mergedTargetNode = {
          ...targetNode,
          companies: uniqStrings([
            ...(targetNode.companies || []),
            ...(sourceNode.companies || []),
          ]),
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

  // Right-click on node to open actions menu
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
      console.log('Node dragged, fixing position:', node.name);

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
  }, [graphData, filterTerms, pinnedNodeIds, hiddenNodeIds]);

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
      const fontSize = Math.max(12 / globalScale, 6);
      const nodeRadius = nodeSize;

      // Determine node color and shape
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

      // Draw node based on type and subtype
      ctx.fillStyle = color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;

      // Draw all nodes as circles
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI, false);
      ctx.fill();
      ctx.stroke();

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
        }
      }
    },
    [nodeSize, showNodeLabels, nodeColors, filteredGraphData.nodes]
  );

  const linkCanvasObject = useCallback(
    (link, ctx, globalScale) => {
      const start = link.source;
      const end = link.target;
      const LABEL_STACK_SPACING = 14;
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
      let linkColor = '#999'; // Default color
      if (link.category) {
        switch (link.category) {
          case 'nombramientos':
          case 'reelecciones':
            linkColor = '#2e7d32'; // Dark green for appointments and re-elections
            break;
          case 'ceses_dimisiones':
          case 'revocaciones':
            linkColor = '#d32f2f'; // Red for resignations and revocations
            break;
          default:
            linkColor = '#999'; // Gray for unknown or general relationships
        }
      }

      // Draw link
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = linkColor;
      ctx.lineWidth = Math.max(0.3, 1 / globalScale); // Adjust line width with zoom
      ctx.stroke();

      // Conditional link label rendering
      const edgeLabel = normalizeEdgeLabelText(link.relationship, link.category);
      if (edgeLabel) {
        const isDense = filteredGraphData.links.length > MAX_LINKS_FOR_LABELS;
        let shouldRenderLabel = false;

        if (isDense) {
          shouldRenderLabel = globalScale > LINK_LABEL_VISIBILITY_SCALE_DENSE;
        } else {
          shouldRenderLabel = globalScale > LINK_LABEL_VISIBILITY_SCALE_NORMAL;
        }

        if (shouldRenderLabel) {
          let midX = (start.x + end.x) / 2;
          let midY = (start.y + end.y) / 2;

          // Stack labels on parallel edges to avoid overlap.
          const linkMeta = parallelLinkMeta.get(normalizeNodeId(link.id));
          if (linkMeta && linkMeta.count > 1) {
            const centeredIndex = linkMeta.index - (linkMeta.count - 1) / 2;
            const effectiveOffset = (centeredIndex * LABEL_STACK_SPACING) / globalScale;

            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length > 0) {
              const perpDx = -dy / length;
              const perpDy = dx / length;
              midX += perpDx * effectiveOffset;
              midY += perpDy * effectiveOffset;
            }
          }

          const fontSize = Math.max(10 / globalScale, 5);
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
    [filteredGraphData.links, parallelLinkMeta]
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

      let companyName, officerName;
      if (sourceNode.type === 'officer') {
        officerName = sourceNode.name;
        companyName = targetNode.name;
      } else {
        companyName = sourceNode.name;
        officerName = targetNode.name;
      }

      rows.push({
        company: companyName || '-',
        officer: officerName || '-',
        position: link.relationship || '-',
        category: link.category || '-',
        date: formatDate(link.date),
      });
    });
    rows.sort((a, b) => a.company.localeCompare(b.company) || a.officer.localeCompare(b.officer));
    return rows;
  }, [filteredGraphData]);

  // Copy table as TSV for Excel/Word paste
  const copyTableToClipboard = useCallback(() => {
    const headers = ['Empresa', 'Directivo', 'Cargo', 'Tipo', 'Fecha'];
    const tsv = [
      headers.join('\t'),
      ...tableRows.map(row =>
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
  }, [tableRows]);

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

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Resultados</InputLabel>
          <Select
            value={searchResultSize}
            onChange={e => setSearchResultSize(Number(e.target.value))}
            label="Resultados"
          >
            {SEARCH_SIZE_OPTIONS.map(size => (
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
              const selectedName = value.name || value.value || '';
              setSearchQuery(selectedName);
              handleSearch(selectedName, value.type === 'company');
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                {option.type === 'company' ? (
                  <BusinessIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                ) : (
                  <PersonIcon sx={{ fontSize: 16, color: 'info.main' }} />
                )}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2">{option.name || option.label}</Typography>
                  {option.type === 'company' && option.cif && (
                    <Typography variant="caption" color="text.secondary">
                      {option.cif}
                    </Typography>
                  )}
                  {option.type === 'officer' && option.company_count != null && (
                    <Typography variant="caption" color="text.secondary">
                      {option.company_count} empresa{option.company_count !== 1 ? 's' : ''}
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
              placeholder={searchType === 'company' ? 'Buscar empresa...' : 'Buscar directivo...'}
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
          Buscar
        </Button>
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
                min={6}
                max={24}
                step={1}
                size="small"
              />
            </Box>
            <Box>
              <Typography variant="caption">Distancia de enlaces</Typography>
              <Slider
                value={linkDistance}
                onChange={(e, value) => setLinkDistance(value)}
                min={40}
                max={220}
                step={5}
                size="small"
              />
            </Box>
            <Box>
              <Typography variant="caption">Fuerza de repulsión</Typography>
              <Slider
                value={Math.abs(chargeStrength)}
                onChange={(e, value) => setChargeStrength(-value)}
                min={100}
                max={500}
                step={50}
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
            d3AlphaDecay={0.06}
            d3VelocityDecay={0.75}
            cooldownTicks={60}
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
            width: isTableCollapsed ? 'auto' : 420,
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
                Datos ({tableRows.length})
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
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
                  {tableRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: '#4b5563' }}>
                        <Typography variant="caption" sx={{ color: '#4b5563' }}>
                          Busca una empresa o directivo para ver datos
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableRows.map((row, idx) => (
                      <TableRow
                        key={`${row.company}-${row.officer}-${row.position}-${idx}`}
                        hover
                        sx={{
                          '&:nth-of-type(odd)': { bgcolor: 'rgba(25, 118, 210, 0.03)' },
                          '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.08)' },
                        }}
                      >
                        <TableCell
                          sx={{
                            fontSize: '0.7rem',
                            py: 0.25,
                            maxWidth: 110,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={row.company}
                        >
                          {row.company}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontSize: '0.7rem',
                            py: 0.25,
                            maxWidth: 110,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={row.officer}
                        >
                          {row.officer}
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
                        <TableCell sx={{ fontSize: '0.7rem', py: 0.25, whiteSpace: 'nowrap' }}>
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
    </>
  );
};

export default SpanishCompanyNetworkGraph;
