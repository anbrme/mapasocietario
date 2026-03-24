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
        p: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        minWidth: 200,
        flex: 1,
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: `${color}18`,
          color: color,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color, lineHeight: 1.2 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.disabled">
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
  const [interval, setInterval_] = useState('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [overview, setOverview] = useState(null);
  const [lifecycle, setLifecycle] = useState(null);
  const [yoy, setYoy] = useState(null);
  const [eventTypes, setEventTypes] = useState(null);
  const [companySizes, setCompanySizes] = useState(null);
  const [topOfficers, setTopOfficers] = useState(null);
  const [capital, setCapital] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = { interval };

    Promise.all([
      statsService.getOverview(),
      statsService.getLifecycle(params),
      statsService.getYoY(),
      statsService.getEventTypes(),
      statsService.getCompanySizes(),
      statsService.getTopOfficers({ limit: 25 }),
      statsService.getCapital(params),
    ])
      .then(([ov, lc, y, et, cs, to, cap]) => {
        if (cancelled) return;
        setOverview(ov);
        setLifecycle(lc);
        setYoy(y);
        setEventTypes(et);
        setCompanySizes(cs);
        setTopOfficers(to);
        setCapital(cap);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [interval]);

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

  const lifecycleData = lifecycle?.data?.map((d) => ({
    ...d,
    date: d.date,
    net: d.formations - d.dissolutions,
  })) || [];

  const CATEGORY_LABELS = {
    officers: 'Cargos',
    lifecycle: 'Ciclo de vida',
    capital: 'Capital',
    governance: 'Gobierno',
    ownership: 'Propiedad',
    structural: 'Estructural',
    identity: 'Identidad',
    administrative: 'Administrativo',
    other: 'Otros',
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
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
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup
          value={interval}
          exclusive
          onChange={(_, v) => v && setInterval_(v)}
          size="small"
        >
          <ToggleButton value="month">Mensual</ToggleButton>
          <ToggleButton value="quarter">Trimestral</ToggleButton>
          <ToggleButton value="year">Anual</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* KPIs */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
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

      {/* Main lifecycle chart */}
      <ChartCard
        title="Constituciones vs Disoluciones"
        subtitle="Evolución temporal de la creación y cierre de empresas en España"
        sx={{ mb: 3 }}
      >
        <ResponsiveContainer width="100%" height={380}>
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

      {/* Two-column row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
        {/* Year-over-year table */}
        <ChartCard title="Comparativa Anual">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={yoy?.data || []}>
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
        </ChartCard>

        {/* Event type distribution */}
        <ChartCard title="Distribución por Tipo de Evento">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={(eventTypes?.by_category || []).map((d) => ({
                  ...d,
                  name: CATEGORY_LABELS[d.category] || d.category,
                }))}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={110}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#666' }}
              >
                {(eventTypes?.by_category || []).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(value) => formatNumber(value)}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </Box>

      {/* Capital + officer changes */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
        {/* Capital changes over time */}
        <ChartCard
          title="Movimientos de Capital"
          subtitle="Eventos de ampliación y reducción de capital"
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={capital?.data || []}>
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
        </ChartCard>

        {/* Company size distribution */}
        <ChartCard
          title="Distribución por Capital Social"
          subtitle={companySizes?.stats ? `Media: ${formatCurrency(companySizes.stats.avg)}€` : ''}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={companySizes?.distribution || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
              <YAxis dataKey="range" type="category" width={120} tick={{ fontSize: 10 }} />
              <RechartsTooltip formatter={(v) => formatNumber(v)} />
              <Bar dataKey="count" name="Empresas" fill="#2196f3" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Box>

      {/* Top officers */}
      <ChartCard title="Directivos con Más Cargos Activos" sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {(topOfficers?.officers || []).map((o, i) => (
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
      </ChartCard>

      {/* Footer */}
      <Typography variant="body2" color="text.disabled" align="center" sx={{ mt: 4, mb: 2 }}>
        Datos del Registro Mercantil (BORME). Actualizado diariamente.
      </Typography>
    </Box>
  );
}
