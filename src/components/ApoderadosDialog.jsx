import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  Chip,
  Box,
  Typography,
  CircularProgress,
  TablePagination,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
// Named singleton (the service has no default export).
import { spanishCompaniesService } from '../services/spanishCompaniesService';
import { positionCategoryFor } from '../utils/positionCategories';

const PAGE_SIZE = 25;

const STRINGS = {
  es: {
    title: 'Apoderados',
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

const ApoderadosDialog = ({ open, company, lang = 'es', onClose, onPin }) => {
  const t = STRINGS[lang === 'en' ? 'en' : 'es'];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [apoderados, setApoderados] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!open || !company || !company.name) return;

    let cancelled = false;
    setLoading(true);
    setError(false);
    setApoderados([]);
    setSearch('');
    setPage(0);

    (async () => {
      try {
        const resp = await spanishCompaniesService.getCompanyProfileV3(company.name, {
          groupKey: company.groupKey || null,
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
  }, [open, company]);

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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t.title}
        {company?.name ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {company.name}
          </Typography>
        ) : null}
      </DialogTitle>
      <DialogContent dividers>
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
              autoFocus
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
                <List dense sx={{ maxHeight: 360, overflowY: 'auto' }}>
                  {pageItems.map((item, idx) => (
                    <ListItem
                      key={`${item.name}-${item.position}-${item.status}-${idx}`}
                      divider
                      secondaryAction={
                        <Button
                          size="small"
                          startIcon={<PushPinOutlinedIcon fontSize="small" />}
                          onClick={() => onPin && onPin(item)}
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t.close}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApoderadosDialog;
