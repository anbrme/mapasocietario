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
import DescriptionIcon from '@mui/icons-material/Description';
import { useNavigate } from 'react-router-dom';
import { spanishCompaniesService } from '../services/spanishCompaniesService';

// Direct search-to-report entry point for the landing hero.
//
// Rationale: the paid Due Diligence report was previously only reachable
// AFTER a visitor searched a company, waited for the force-graph to render,
// and found the small toolbar button. This box lets a visitor go straight
// from "type a company name" to a trust-first report page (/due-diligence)
// pre-scoped to that company, where they can buy or explore the free graph —
// without ever having to learn the interactive graph first.
//
// We deliberately route to /due-diligence?company= rather than opening the
// checkout dialog immediately: an instant payment dialog reads as a paywall
// trap, whereas the report page shows what's included, a sample, and the
// money-back guarantee before asking for a card.
//
// Copy lives here (not in landingCopy.jsx) so the component stays a single
// self-contained drop-in. Keep both locales in sync if you edit it.
const COPY = {
  en: {
    label: 'Get a due diligence report',
    placeholder: 'Search a Spanish company by name…',
    helper: 'Pick a company, see the price, get your PDF — €22.50, no account needed.',
    noOptions2: 'Type at least 2 letters…',
    noOptionsEmpty: 'No companies found',
    reportFor: (name) => `Due diligence report · ${name}`,
  },
  es: {
    label: 'Consigue un informe due diligence',
    placeholder: 'Busca una empresa española por nombre…',
    helper: 'Elige una empresa, mira el precio y recibe tu PDF: 22,50 €, sin cuenta.',
    noOptions2: 'Escribe al menos 2 letras…',
    noOptionsEmpty: 'No se encontraron empresas',
    reportFor: (name) => `Informe due diligence · ${name}`,
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
    // Trust-first: land on the company's report page (shows what's included,
    // sample, guarantee) where the buyer chooses to checkout or explore free.
    navigate(`/due-diligence?company=${encodeURIComponent(name)}`);
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
          color: 'warning.light',
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
            <DescriptionIcon sx={{ fontSize: 16, color: 'warning.light', mr: 1, flexShrink: 0 }} />
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
                  <SearchIcon sx={{ color: 'warning.light' }} />
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
                '& fieldset': { borderColor: 'rgba(255,167,38,0.5)' },
                '&:hover fieldset': { borderColor: 'warning.light' },
                '&.Mui-focused fieldset': { borderColor: 'warning.main', borderWidth: 2 },
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
