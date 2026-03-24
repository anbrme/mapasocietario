import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import BusinessIcon from '@mui/icons-material/Business';
import GavelIcon from '@mui/icons-material/Gavel';
import PeopleIcon from '@mui/icons-material/People';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PersonIcon from '@mui/icons-material/Person';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MapIcon from '@mui/icons-material/Map';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import FilterBar from './FilterBar';
import SankeyChart from './SankeyChart';
import { useFilters } from '../contexts/FilterProvider';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { statsService } from '../services/statsService';
import { useNavigate } from 'react-router-dom';

const COLORS = {
  formations: '#4caf50',
  dissolutions: '#f44336',
  concursos: '#ff9800',
  officers: '#2196f3',
  capital: '#9c27b0',
  neutral: '#607d8b',
};

const PIE_COLORS = ['#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];

function formatNumber(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('es-ES');
}

function formatCurrency(n) {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return n.toFixed(0);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const month = d.toLocaleString('es-ES', { month: 'short' });
  return `${month} ${d.getFullYear()}`;
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}`;
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ title, value, subtitle, icon, color = '#fff' }) {
  return (
    <Paper
      sx={{
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minWidth: 170,
        flex: 1,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: `${color}18`,
          color: color,
          flexShrink: 0,
          '& .MuiSvgIcon-root': { fontSize: 20 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color, lineHeight: 1.2 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', fontSize: '0.65rem' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

// ─── Chart wrapper ──────────────────────────────────────────────────────────

function ChartCard({ title, children, subtitle, sx = {} }) {
  return (
    <Paper sx={{ p: 3, ...sx }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {subtitle}
        </Typography>
      )}
      {children}
    </Paper>
  );
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <Paper sx={{ p: 1.5, border: '1px solid', borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary">
        {formatDate(label)}
      </Typography>
      {payload.map((entry, i) => (
        <Typography key={i} variant="body2" sx={{ color: entry.color, fontWeight: 600 }}>
          {entry.name}: {formatter ? formatter(entry.value) : formatNumber(entry.value)}
        </Typography>
      ))}
    </Paper>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { filterParams, filterKey, interval, provinces: selectedProvinces, companyTypes: selectedCompanyTypes } = useFilters();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [overview, setOverview] = useState(null);
  const [lifecycle, setLifecycle] = useState(null);
  const [yoy, setYoy] = useState(null);
  const [companySizes, setCompanySizes] = useState(null);
  const [topOfficers, setTopOfficers] = useState(null);
  const [capital, setCapital] = useState(null);
  const [provincesData, setProvincesData] = useState(null);
  const [ownership, setOwnership] = useState(null);
  const [ownershipSankey, setOwnershipSankey] = useState(null);
  const [lifecycleSankey, setLifecycleSankey] = useState(null);

  // Load data in two waves to avoid overwhelming the backend / hitting gateway timeouts
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Wave 1: fast endpoints for initial render
    Promise.all([
      statsService.getOverview(filterParams),
      statsService.getLifecycle(filterParams),
    ])
      .then(([ov, lc]) => {
        if (cancelled) return;
        setOverview(ov);
        setLifecycle(lc);
        setLoading(false);

        // Wave 2: slower endpoints loaded after initial paint
        return Promise.all([
          statsService.getYoY(filterParams),
          statsService.getCompanySizes(filterParams),
          statsService.getTopOfficers({ ...filterParams, limit: 25 }),
          statsService.getCapital(filterParams),
          statsService.getProvinces(filterParams),
          statsService.getOwnershipTransitions(filterParams),
          statsService.getOwnershipSankey(filterParams),
          statsService.getLifecycleSankey(filterParams),
        ]);
      })
      .then((results) => {
        if (cancelled || !results) return;
        const [y, cs, to, cap, prov, own, os, ls] = results;
        setYoy(y);
        setCompanySizes(cs);
        setTopOfficers(to);
        setCapital(cap);
        setProvincesData(prov);
        setOwnership(own);
        setOwnershipSankey(os);
        setLifecycleSankey(ls);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [filterKey]);

  // Compute YoY delta for latest full year
  const yoyDelta = useMemo(() => {
    if (!yoy?.data || yoy.data.length < 2) return null;
    const sorted = [...yoy.data].sort((a, b) => a.year.localeCompare(b.year));
    // Skip the last entry if it's the current (incomplete) year
    const currentYear = new Date().getFullYear().toString();
    const complete = sorted.filter((d) => !d.year.startsWith(currentYear));
    if (complete.length < 2) return null;
    const prev = complete[complete.length - 2];
    const last = complete[complete.length - 1];
    const pct = (field) =>
      prev[field] > 0 ? Math.round(((last[field] - prev[field]) / prev[field]) * 100) : null;
    return {
      year: last.year.slice(0, 4),
      prevYear: prev.year.slice(0, 4),
      formations: pct('formations'),
      dissolutions: pct('dissolutions'),
      concursos: pct('concursos'),
    };
  }, [yoy]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  // Build a filter label for chart subtitles
  const filterLabel = [
    selectedProvinces.length > 0 && `Provincias: ${selectedProvinces.join(', ')}`,
    selectedCompanyTypes.length > 0 && `Tipo: ${selectedCompanyTypes.join(', ')}`,
  ].filter(Boolean).join(' | ');

  const lifecycleData = lifecycle?.data?.map((d) => ({
    ...d,
    date: d.date,
    net: d.formations - d.dissolutions,
  })) || [];

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 3 }, height: '100vh', overflowY: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Tooltip title="Volver al buscador">
          <IconButton onClick={() => navigate('/')} sx={{ color: 'text.secondary' }}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Registro Mercantil en Cifras
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {overview?.date_min && overview?.date_max
              ? `${new Date(overview.date_min).getFullYear()} — ${new Date(overview.date_max).getFullYear()}`
              : ''}
            {' | '}
            Fuente: BORME (Bolet&iacute;n Oficial del Registro Mercantil)
          </Typography>
        </Box>
      </Box>

      {/* Filter Bar */}
      <FilterBar />

      {/* Active filter indicator */}
      {filterLabel && (
        <Alert severity="info" icon={false} sx={{ py: 0.5, px: 2, mb: 1, '& .MuiAlert-message': { fontSize: '0.8rem' } }}>
          Datos agregados — {filterLabel}
        </Alert>
      )}

      {/* KPIs */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <KpiCard
          title="Empresas registradas"
          value={formatNumber(overview?.total_companies)}
          icon={<BusinessIcon />}
          color="#2196f3"
        />
        <KpiCard
          title="Constituciones"
          value={formatNumber(overview?.constitutions)}
          subtitle={yoyDelta ? `${yoyDelta.formations > 0 ? '+' : ''}${yoyDelta.formations}% vs ${yoyDelta.prevYear}` : undefined}
          icon={<TrendingUpIcon />}
          color={COLORS.formations}
        />
        <KpiCard
          title="Disoluciones"
          value={formatNumber(overview?.dissolutions)}
          subtitle={yoyDelta ? `${yoyDelta.dissolutions > 0 ? '+' : ''}${yoyDelta.dissolutions}% vs ${yoyDelta.prevYear}` : undefined}
          icon={<TrendingDownIcon />}
          color={COLORS.dissolutions}
        />
        <KpiCard
          title="Concursos"
          value={formatNumber(overview?.concursos)}
          subtitle={yoyDelta ? `${yoyDelta.concursos > 0 ? '+' : ''}${yoyDelta.concursos}% vs ${yoyDelta.prevYear}` : undefined}
          icon={<WarningAmberIcon />}
          color={COLORS.concursos}
        />
        <KpiCard
          title="Publicaciones BORME"
          value={formatNumber(overview?.total_events)}
          icon={<GavelIcon />}
          color={COLORS.neutral}
        />
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 0, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="Ciclo de Vida" icon={<TrendingUpIcon />} iconPosition="start" sx={{ textTransform: 'none', minHeight: 48 }} />
        <Tab label="Comparativa Anual" icon={<GavelIcon />} iconPosition="start" sx={{ textTransform: 'none', minHeight: 48 }} />
        <Tab label="Capital" icon={<AccountBalanceIcon />} iconPosition="start" sx={{ textTransform: 'none', minHeight: 48 }} />
        <Tab label="Provincias" icon={<MapIcon />} iconPosition="start" sx={{ textTransform: 'none', minHeight: 48 }} />
        <Tab label="Propiedad" icon={<SwapHorizIcon />} iconPosition="start" sx={{ textTransform: 'none', minHeight: 48 }} />
        <Tab label="Directivos" icon={<PeopleIcon />} iconPosition="start" sx={{ textTransform: 'none', minHeight: 48 }} />
        <Tab label="Flujos" icon={<AltRouteIcon />} iconPosition="start" sx={{ textTransform: 'none', minHeight: 48 }} />
      </Tabs>

      {/* Scrollable tab content */}
      <Box sx={{ pb: 2 }}>

      {/* Tab 0: Lifecycle */}
      {tab === 0 && (
        <>
          <ChartCard
            title="Constituciones vs Disoluciones"
            subtitle={filterLabel || "Evolución temporal de la creación y cierre de empresas en España"}
            sx={{ mb: 3 }}
          >
            <ResponsiveContainer width="100%" height={420}>
              <AreaChart data={lifecycleData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="date"
                  tickFormatter={interval === 'year' ? formatDateShort : formatDate}
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="formations"
                  name="Constituciones"
                  stroke={COLORS.formations}
                  fill={COLORS.formations}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="dissolutions"
                  name="Disoluciones"
                  stroke={COLORS.dissolutions}
                  fill={COLORS.dissolutions}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="concursos"
                  name="Concursos"
                  stroke={COLORS.concursos}
                  fill={COLORS.concursos}
                  fillOpacity={0.1}
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Per company type breakdown — one chart per type showing all 3 metrics */}
          {selectedCompanyTypes.length > 0 && lifecycleData.length > 0 && lifecycleData[0]?.by_company_type && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: selectedCompanyTypes.length === 1 ? '1fr' : '1fr 1fr' }, gap: 3, mb: 3 }}>
              {selectedCompanyTypes.map((ct, i) => (
                <ChartCard
                  key={ct}
                  title={ct}
                  subtitle={filterLabel}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={lifecycleData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={interval === 'year' ? formatDateShort : formatDate}
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey={`by_company_type.${ct}.formations`}
                        name="Constituciones"
                        stroke={COLORS.formations}
                        fill={COLORS.formations}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey={`by_company_type.${ct}.dissolutions`}
                        name="Disoluciones"
                        stroke={COLORS.dissolutions}
                        fill={COLORS.dissolutions}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey={`by_company_type.${ct}.concursos`}
                        name="Concursos"
                        stroke={COLORS.concursos}
                        fill={COLORS.concursos}
                        fillOpacity={0.1}
                        strokeWidth={1.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              ))}
            </Box>
          )}
        </>
      )}

      {/* Tab 1: Year-over-year */}
      {tab === 1 && (
        <>
          <ChartCard title="Comparativa Anual" subtitle={filterLabel || undefined} sx={{ mb: 3 }}>
            {yoy ? (
              <ResponsiveContainer width="100%" height={420}>
                <BarChart data={yoy.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="year" tickFormatter={(v) => v?.slice(0, 4)} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="formations" name="Constituciones" fill={COLORS.formations} />
                  <Bar dataKey="dissolutions" name="Disoluciones" fill={COLORS.dissolutions} />
                  <Bar dataKey="concursos" name="Concursos" fill={COLORS.concursos} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
            )}
          </ChartCard>

          <ChartCard title="Actividad Total por Año">
            {yoy ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={yoy.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="year" tickFormatter={(v) => v?.slice(0, 4)} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="total_events" name="Publicaciones BORME" fill={COLORS.neutral} />
                  <Bar dataKey="officer_changes" name="Cambios de cargos" fill={COLORS.officers} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
            )}
          </ChartCard>
        </>
      )}

      {/* Tab 2: Capital */}
      {tab === 2 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          <ChartCard
            title="Movimientos de Capital"
            subtitle={filterLabel || "Eventos de ampliación y reducción de capital"}
          >
            {capital ? (
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={capital.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={interval === 'year' ? formatDateShort : formatDate}
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Eventos de capital"
                    stroke={COLORS.capital}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
            )}
          </ChartCard>

          <ChartCard
            title="Distribución por Capital Social"
            subtitle={companySizes?.stats ? `Media: ${formatCurrency(companySizes.stats.avg)}€` : ''}
          >
            {companySizes ? (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={companySizes.distribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                  <YAxis dataKey="range" type="category" width={120} tick={{ fontSize: 10 }} />
                  <RechartsTooltip formatter={(v) => formatNumber(v)} />
                  <Bar dataKey="count" name="Empresas" fill="#2196f3" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
            )}
          </ChartCard>
        </Box>
      )}

      {/* Tab 3: Provinces */}
      {tab === 3 && (
        <ChartCard title="Actividad por Provincia">
          {provincesData ? (
            <ResponsiveContainer width="100%" height={Math.max(500, (provincesData?.data?.length || 0) * 28)}>
              <BarChart
                data={[...(provincesData?.data || [])].sort((a, b) => b.total - a.total)}
                layout="vertical"
                margin={{ left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                <YAxis
                  dataKey="province"
                  type="category"
                  width={160}
                  tick={{ fontSize: 11 }}
                />
                <RechartsTooltip formatter={(v) => formatNumber(v)} />
                <Legend />
                {provincesData?.source === 'borme_events_v3' ? (
                  <>
                    <Bar dataKey="formations" name="Constituciones" fill={COLORS.formations} stackId="a" />
                    <Bar dataKey="dissolutions" name="Disoluciones" fill={COLORS.dissolutions} stackId="a" />
                    <Bar dataKey="concursos" name="Concursos" fill={COLORS.concursos} stackId="a" />
                  </>
                ) : (
                  <Bar dataKey="total" name="Publicaciones" fill="#2196f3" radius={[0, 4, 4, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
          )}
        </ChartCard>
      )}

      {/* Tab 4: Ownership transitions */}
      {tab === 4 && (
        <>
          {ownership ? (
            <>
              {/* KPIs for ownership */}
              <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <KpiCard
                  title="Declaraciones unipersonalidad"
                  value={formatNumber(ownership.total_gained)}
                  icon={<TrendingUpIcon />}
                  color={COLORS.formations}
                />
                <KpiCard
                  title="Pérdidas unipersonalidad"
                  value={formatNumber(ownership.total_lost)}
                  icon={<TrendingDownIcon />}
                  color={COLORS.dissolutions}
                />
                <KpiCard
                  title="Socio único: empresa"
                  value={formatNumber(ownership.by_type?.company_shareholder)}
                  icon={<BusinessIcon />}
                  color="#2196f3"
                />
                <KpiCard
                  title="Socio único: persona"
                  value={formatNumber(ownership.by_type?.individual_shareholder)}
                  icon={<PersonIcon />}
                  color={COLORS.capital}
                />
              </Box>

              {/* Time series: gained vs lost */}
              <ChartCard
                title="Transiciones de Propiedad"
                subtitle={filterLabel || "Declaraciones y pérdidas de unipersonalidad a lo largo del tiempo"}
                sx={{ mb: 3 }}
              >
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={ownership.time_series || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={interval === 'year' ? formatDateShort : formatDate}
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="gained"
                      name="Declaración unipersonalidad"
                      stroke={COLORS.formations}
                      fill={COLORS.formations}
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="lost"
                      name="Pérdida unipersonalidad"
                      stroke={COLORS.dissolutions}
                      fill={COLORS.dissolutions}
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Ownership by company type */}
              {ownership.by_company_type && Object.keys(ownership.by_company_type).length > 0 && (
                <ChartCard
                  title="Unipersonalidad por Tipo de Sociedad"
                  subtitle={filterLabel || "Declaraciones y pérdidas por tipo de empresa"}
                  sx={{ mb: 3 }}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={Object.entries(ownership.by_company_type)
                        .map(([type, vals]) => ({ type, gained: vals.gained, lost: vals.lost }))
                        .sort((a, b) => (b.gained + b.lost) - (a.gained + a.lost))
                        .slice(0, 10)}
                      layout="vertical"
                      margin={{ left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="type" type="category" width={80} tick={{ fontSize: 11 }} />
                      <RechartsTooltip formatter={(v) => formatNumber(v)} />
                      <Legend />
                      <Bar dataKey="gained" name="Declaración" fill="#4caf50" />
                      <Bar dataKey="lost" name="Pérdida" fill="#f44336" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Current state summary */}
              <ChartCard title="Estado Actual de Unipersonalidad">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Unipersonal', value: ownership.current_state?.unipersonal || 0 },
                        { name: 'No unipersonal', value: ownership.current_state?.not_unipersonal || 0 },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                      labelLine={{ stroke: '#666' }}
                    >
                      <Cell fill={COLORS.formations} />
                      <Cell fill={COLORS.neutral} />
                    </Pie>
                    <RechartsTooltip formatter={(v) => formatNumber(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
          )}
        </>
      )}

      {/* Tab 5: Officers */}
      {tab === 5 && (
        <ChartCard title="Directivos con Más Cargos Activos">
          {topOfficers ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {topOfficers.officers.map((o, i) => (
                <Chip
                  key={i}
                  icon={<PersonIcon />}
                  label={`${o.name} (${o.companies})`}
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: i < 3 ? COLORS.concursos : 'divider',
                    fontWeight: i < 3 ? 700 : 400,
                  }}
                />
              ))}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
          )}
        </ChartCard>
      )}

      {/* Tab 6: Sankey flows */}
      {tab === 6 && (
        <>
          <SankeyChart
            data={ownershipSankey}
            title="Flujos de Propiedad"
            subtitle="Transiciones entre múltiples socios y socio único"
            height={300}
          />
          <SankeyChart
            data={lifecycleSankey}
            title="Ciclo de Vida Empresarial"
            subtitle="Flujo de empresas desde constitución hasta disolución o concurso"
            height={300}
          />
        </>
      )}

      {/* Footer */}
      <Typography variant="body2" color="text.disabled" align="center" sx={{ mt: 'auto', pt: 3, pb: 1 }}>
        Datos del Registro Mercantil (BORME). Actualizado diariamente.
      </Typography>

      </Box>{/* end scrollable tab content */}
    </Box>
  );
}
