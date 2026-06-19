import React from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { useNavigate } from 'react-router-dom';
import { spanishCompaniesService } from '../services/spanishCompaniesService';

// Search-to-explore entry point for the landing hero.
//
// The graph is the free, value-first exploration step: a visitor searches a
// company, lands in the interactive graph, SEES everything (directors,
// connections, history), and only THEN decides — buy a Due Diligence report on
// that company, or build a free relationship report when several companies are
// in view. So this box routes to /app?search= (the graph), never straight to a
// checkout or a sales page: you can't ask someone to buy a report on a company
// they haven't seen yet.
//
// Copy lives here (not in landingCopy.jsx) so the component stays a single
// self-contained drop-in. Keep both locales in sync if you edit it.
const COPY = {
  en: {
    label: 'Explore a Spanish company',
    placeholder: 'Search a Spanish company by name…',
    helper:
      'See its directors, connections and history in a free interactive graph — then buy a due diligence report or build a relationship report when you’re ready.',
    noOptions2: 'Type at least 2 letters…',
    noOptionsEmpty: 'No companies found',
  },
  es: {
    label: 'Explora una empresa española',
    placeholder: 'Busca una empresa española por nombre…',
    helper:
      'Consulta sus administradores, conexiones e historial en un grafo interactivo gratuito; después compra un informe due diligence o crea un informe de relaciones cuando quieras.',
    noOptions2: 'Escribe al menos 2 letras…',
    noOptionsEmpty: 'No se encontraron empresas',
  },
};

const DEBOUNCE_MS = 220;

export default function HeroCompanySearch({ lang = 'en' }) {
  const copy = COPY[lang] || COPY.en;
  const navigate = useNavigate();

  const [inputValue, setInputValue] = React.useState('');
  const [options, setOptions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  // Guards against out-of-order responses overwriting newer results.
  const requestSeq = React.useRef(0);

  React.useEffect(() => {
    const q = inputValue.trim();
    if (q.length < 2) {
      setOptions([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      try {
        const result = await spanishCompaniesService.autocompleteCompanies(q, { limit: 8 });
        // Ignore if a newer keystroke already fired.
        if (seq !== requestSeq.current) return;
        setOptions(result.suggestions || []);
      } catch {
        if (seq === requestSeq.current) setOptions([]);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [inputValue]);

  const handleSelect = (_event, option) => {
    if (!option || typeof option === 'string') return;
    const name = (option.name || option.label || '').trim();
    if (!name) return;
    // Explore first: land in the free interactive graph for this company. The
    // buy / relationship-report decisions live there, after the visitor has
    // actually seen the data.
    navigate(`/app?search=${encodeURIComponent(name)}`);
  };

  const trimmed = inputValue.trim();
  const noOptionsText = trimmed.length < 2 ? copy.noOptions2 : copy.noOptionsEmpty;

  return (
    <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto' }}>
      <Typography
        variant="overline"
        sx={{
          display: 'block',
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: 'primary.light',
          mb: 1,
        }}
      >
        {copy.label}
      </Typography>

      <Autocomplete
        freeSolo
        fullWidth
        options={options}
        loading={loading}
        filterOptions={(x) => x} // server already filtered; don't re-filter
        getOptionLabel={(option) => (typeof option === 'string' ? option : option.label || option.name || '')}
        isOptionEqualToValue={(opt, val) => opt.id === val.id}
        onChange={handleSelect}
        onInputChange={(_e, value) => setInputValue(value)}
        noOptionsText={noOptionsText}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={option.id || option.name}>
            <AccountTreeIcon sx={{ fontSize: 16, color: 'primary.light', mr: 1, flexShrink: 0 }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {option.label || option.name}
            </Typography>
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={copy.placeholder}
            variant="outlined"
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'primary.light' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={18} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.04)',
                borderRadius: 2,
                fontSize: '1rem',
                '& fieldset': { borderColor: 'rgba(25,118,210,0.5)' },
                '&:hover fieldset': { borderColor: 'primary.light' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 2 },
              },
            }}
          />
        )}
      />

      <Typography
        variant="caption"
        sx={{ display: 'block', color: 'text.secondary', mt: 1, lineHeight: 1.5 }}
      >
        {copy.helper}
      </Typography>
    </Box>
  );
}
