import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  Chip,
  Box,
  Paper,
  Typography,
  CircularProgress,
  TablePagination,
  InputAdornment,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
// Named singleton (the service has no default export).
import { spanishCompaniesService } from '../services/spanishCompaniesService';
import { positionCategoryFor } from '../utils/positionCategories';

const PAGE_SIZE = 25;

const STRINGS = {
  es: {
    title: 'Apoderados',
    company: 'Empresa',
    searchPlaceholder: 'Buscar apoderado por nombre…',
    count: n => `${n} apoderado${n === 1 ? '' : 's'}`,
    filtered: (shown, total) => `${shown} de ${total}`,
    active: 'Activo',
    resigned: 'Cesado',
    pin: 'Fijar en el grafo',
    empty: 'Sin apoderados',
    loading: 'Cargando apoderados…',
    error: 'No se pudieron cargar los apoderados.',
    close: 'Cerrar',
    noPosition: 'Apoderado',
    rowsPerPage: 'Por página',
  },
  en: {
    title: 'Apoderados',
    company: 'Company',
    searchPlaceholder: 'Search apoderado by name…',
    count: n => `${n} apoderado${n === 1 ? '' : 's'}`,
    filtered: (shown, total) => `${shown} of ${total}`,
    active: 'Active',
    resigned: 'Resigned',
    pin: 'Pin to graph',
    empty: 'No apoderados',
    loading: 'Loading apoderados…',
    error: 'Could not load apoderados.',
    close: 'Close',
    noPosition: 'Apoderado',
    rowsPerPage: 'Per page',
  },
};

// Accent-insensitive, case-insensitive normaliser for search matching.
const normalizeForSearch = s =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const ApoderadosSidebar = ({ open, companies = [], initialCompany, lang = 'es', onClose, onPin }) => {
  const t = STRINGS[lang === 'en' ? 'en' : 'es'];

  // The company currently shown in the sidebar. Defaults to initialCompany
  // (the right-click target or the focused company), user can switch via the
  // company selector at the top.
  const [selectedCompany, setSelectedCompany] = useState(initialCompany || null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [apoderados, setApoderados] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // Reset the selection to the incoming target whenever the sidebar is opened
  // against a new company (right-click a different node, "Fetch all", etc.).
  useEffect(() => {
    if (open && initialCompany) setSelectedCompany(initialCompany);
  }, [open, initialCompany]);

  // De-duplicated switcher options by uppercased name, ensuring the currently
  // selected company is always present so the Select has a valid value.
  const companyOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    const push = c => {
      if (!c || !c.name) return;
      const key = c.name.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ name: c.name, groupKey: c.groupKey || null });
    };
    (Array.isArray(companies) ? companies : []).forEach(push);
    push(selectedCompany);
    return out;
  }, [companies, selectedCompany]);

  useEffect(() => {
    if (!open || !selectedCompany || !selectedCompany.name) return;

    let cancelled = false;
    setLoading(true);
    setError(false);
    setApoderados([]);
    setSearch('');
    setPage(0);

    (async () => {
      try {
        const resp = await spanishCompaniesService.getCompanyProfileV3(selectedCompany.name, {
          groupKey: selectedCompany.groupKey || null,
          fullOfficers: true,
        });
        if (cancelled) return;
        const c = resp.company || resp;

        const collect = (list, status) =>
          (Array.isArray(list) ? list : [])
            .filter(
              o =>
                positionCategoryFor(o.position_normalized || o.position || '') === 'Apoderado'
            )
            .map(o => ({
              name: o.name || o.name_normalized || '',
              position: o.position_normalized || '',
              status,
              date: o.appointed_date || o.resigned_date || '',
            }));

        const items = [
          ...collect(c.officers_active, 'active'),
          ...collect(c.officers_resigned, 'resigned'),
        ];
        setApoderados(items);
      } catch (err) {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, selectedCompany]);

  const filtered = useMemo(() => {
    const q = normalizeForSearch(search.trim());
    if (!q) return apoderados;
    return apoderados.filter(a => normalizeForSearch(a.name).includes(q));
  }, [apoderados, search]);

  // Keep the page in range as the filter narrows results.
  useEffect(() => {
    setPage(0);
  }, [search]);

  const pageItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page]
  );

  if (!open) return null;

  return (
    // Non-modal, right-anchored sidebar: a fixed Paper (NO backdrop, no focus
    // trap) so the graph stays fully clickable behind it — the user pins nodes
    // and watches them appear while it's open.
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        maxWidth: '100vw',
        zIndex: theme => theme.zIndex.drawer + 2,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid',
        borderColor: 'divider',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          p: 2,
          pb: 1.5,
        }}
      >
        <Box>
          <Typography variant="h6">{t.title}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label={t.close}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Company switcher */}
      <Box sx={{ px: 2, pb: 1.5 }}>
        <FormControl size="small" fullWidth>
          <InputLabel id="apoderados-company-label">{t.company}</InputLabel>
          <Select
            labelId="apoderados-company-label"
            label={t.company}
            value={selectedCompany?.name || ''}
            disabled={companyOptions.length <= 1}
            onChange={e => {
              const next = companyOptions.find(c => c.name === e.target.value);
              if (next) setSelectedCompany(next);
            }}
          >
            {companyOptions.map(c => (
              <MenuItem key={c.name} value={c.name}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Divider />

      {/* Body */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, py: 6 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              {t.loading}
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="error">
              {t.error}
            </Typography>
          </Box>
        ) : (
          <>
            <TextField
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 1.5 }}
            />
            <Typography variant="caption" color="text.secondary">
              {search.trim()
                ? t.filtered(filtered.length, apoderados.length)
                : t.count(apoderados.length)}
            </Typography>

            {apoderados.length === 0 || filtered.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t.empty}
                </Typography>
              </Box>
            ) : (
              <>
                <List dense>
                  {pageItems.map((item, idx) => (
                    <ListItem
                      key={`${item.name}-${item.position}-${item.status}-${idx}`}
                      divider
                      secondaryAction={
                        <Button
                          size="small"
                          startIcon={<PushPinOutlinedIcon fontSize="small" />}
                          onClick={() => onPin && onPin(item, selectedCompany)}
                        >
                          {t.pin}
                        </Button>
                      }
                    >
                      <ListItemText
                        primary={item.name}
                        secondary={
                          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                            <span>{item.position || t.noPosition}</span>
                            <Chip
                              component="span"
                              size="small"
                              label={item.status === 'active' ? t.active : t.resigned}
                              color={item.status === 'active' ? 'success' : 'default'}
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondaryTypographyProps={{ component: 'span' }}
                      />
                    </ListItem>
                  ))}
                </List>
                <TablePagination
                  component="div"
                  count={filtered.length}
                  page={page}
                  onPageChange={(e, newPage) => setPage(newPage)}
                  rowsPerPage={PAGE_SIZE}
                  rowsPerPageOptions={[PAGE_SIZE]}
                  labelRowsPerPage={t.rowsPerPage}
                />
              </>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
};

export default ApoderadosSidebar;
