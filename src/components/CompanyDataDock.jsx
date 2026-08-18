import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const PAGE_SIZE = 25;

const STRINGS = {
  es: {
    search: 'Buscar en esta tabla…',
    showing: (from, to, total) => `${from}–${to} de ${total}`,
    empty: 'Sin registros',
    close: 'Cerrar tabla',
    rowsPerPage: 'Por página',
    partial: (loaded, registry) =>
      `Se muestran ${loaded} cargos derivados de los últimos asientos publicados. El registro acumula ${registry}. La ficha completa incluye el histórico íntegro.`,
  },
  en: {
    search: 'Search this table…',
    showing: (from, to, total) => `${from}–${to} of ${total}`,
    empty: 'No records',
    close: 'Close table',
    rowsPerPage: 'Per page',
    partial: (loaded, registry) =>
      `Showing ${loaded} positions derived from the most recent filings. The registry holds ${registry}. The full profile includes the complete history.`,
  },
};

/**
 * Bottom dock for the graph's tabular data.
 *
 * Tables want width, not height: three or four columns squeezed into a 520px
 * side panel wrap every row and show almost nothing. The same table across the
 * full width shows ~8 rows with every column readable, which is why the long
 * lists live down here instead of inside the inspector.
 *
 * Every dataset is paginated, so a company with tens of thousands of registry
 * officers mounts 25 rows rather than all of them. A dataset carries
 * `registryTotal` when its rows are only a subset, so the count on screen is
 * honest about being partial instead of presenting a slice as the whole.
 *
 * Non-copyable, matching the inspector — same registry data, same posture.
 */
const CompanyDataDock = ({
  open,
  onClose,
  datasets = [],
  activeKey,
  onActiveKeyChange,
  lang = 'es',
  height = 300,
  rightOffset = 0,
}) => {
  const t = STRINGS[lang] || STRINGS.es;
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const active = datasets.find(d => d.key === activeKey) || datasets[0] || null;
  const activeRowCount = active?.rows?.length ?? 0;

  // A new dataset (or a new company) starts at the top with a clean filter —
  // carrying a stale page number into a shorter table renders a blank dock.
  useEffect(() => {
    setPage(0);
    setQuery('');
  }, [activeKey, datasets.length, activeRowCount]);

  const filtered = useMemo(() => {
    const rows = active?.rows || [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(row =>
      (active.columns || []).some(col => {
        const raw = row[col.key];
        return raw != null && String(raw).toLowerCase().includes(q);
      })
    );
  }, [active, query]);

  if (!open || !active) return null;

  const total = filtered.length;
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const isPartial =
    Number.isFinite(active.registryTotal) && active.registryTotal > activeRowCount;

  return (
    <Paper
      elevation={8}
      square
      onContextMenu={e => e.preventDefault()}
      onCopy={e => e.preventDefault()}
      sx={{
        position: 'absolute',
        left: 0,
        // Stop where the inspector starts. The dock needs WIDTH, and the canvas
        // already gives it ~1280px; running under the panel would only steal the
        // panel's height back and leave the fact sheet unreadable.
        right: rightOffset,
        bottom: 0,
        height,
        zIndex: 45,
        display: 'flex',
        flexDirection: 'column',
        borderTop: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
      }}
    >
      {/* Toolbar: which dataset, filter within it, and how much of it you see */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          minHeight: 44,
        }}
      >
        <Tabs
          value={active.key}
          onChange={(_, v) => onActiveKeyChange?.(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 44, flex: 1, '& .MuiTab-root': { minHeight: 44, textTransform: 'none' } }}
        >
          {datasets.map(d => (
            <Tab key={d.key} value={d.key} label={`${d.label} (${d.rows?.length ?? 0})`} />
          ))}
        </Tabs>

        <TextField
          size="small"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t.search}
          sx={{ width: { xs: 150, sm: 240 }, flexShrink: 0 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          {t.showing(from, to, total)}
        </Typography>

        {isPartial && (
          <Tooltip title={t.partial(activeRowCount, active.registryTotal)}>
            <InfoOutlinedIcon sx={{ fontSize: 16, color: 'warning.main', flexShrink: 0 }} />
          </Tooltip>
        )}

        <IconButton size="small" onClick={onClose} aria-label={t.close} sx={{ flexShrink: 0 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <TableContainer sx={{ flex: 1 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {active.columns.map(col => (
                <TableCell key={col.key} sx={{ fontWeight: 700, width: col.width }}>
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={active.columns.length}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    {t.empty}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, i) => (
                <TableRow key={`${page}-${i}`} hover>
                  {active.columns.map(col => (
                    <TableCell key={col.key}>
                      {col.render ? col.render(row) : (row[col.key] ?? '-')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={PAGE_SIZE}
        rowsPerPageOptions={[PAGE_SIZE]}
        labelRowsPerPage={t.rowsPerPage}
        labelDisplayedRows={({ from, to, count }) => t.showing(from, to, count)}
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          '& .MuiTablePagination-toolbar': { minHeight: 40 },
        }}
      />
    </Paper>
  );
};

export default CompanyDataDock;
