import React from 'react';
import {
  Autocomplete,
  Box,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import { spanishCompaniesService } from '../services/spanishCompaniesService';
import { mergeEntitySuggestions } from '../utils/entitySuggestions';
import { trackEvent } from '../utils/track';

const COPY = {
  en: {
    placeholder: 'Search a Spanish company or officer',
    hint: 'Start typing, then choose a verified company or person result.',
    company: 'Company',
    officer: 'Officer',
    companyCount: count => `${count} compan${count === 1 ? 'y' : 'ies'}`,
  },
  es: {
    placeholder: 'Busca una empresa o administrador',
    hint: 'Empieza a escribir y elige una empresa o persona identificada.',
    company: 'Empresa',
    officer: 'Administrador o cargo',
    companyCount: count => `${count} empresa${count === 1 ? '' : 's'}`,
  },
};

function normalizeSuggestions(companyResults, officerResults) {
  const companies = (companyResults?.suggestions || []).map(company => ({
    ...company,
    label: company.label || company.name,
    value: company.value || company.name,
    name: company.name,
    type: 'company',
  }));
  const officers = (officerResults?.suggestions || []).map(officer => ({
    ...officer,
    label: officer.label || officer.name,
    value: officer.value || officer.name,
    name: officer.name,
    type: officer.type || 'officer',
  }));
  const merged = mergeEntitySuggestions(companies.slice(0, 8), officers);
  return [...merged.companies, ...merged.officers.slice(0, 5)];
}

export function buildLandingSearchHref(option, lang = 'en') {
  if (!option || typeof option !== 'object') return null;
  const isOfficer = option.type === 'officer' || option.type === 'officer_sole_shareholder';
  const entityType = isOfficer ? 'officer' : 'company';
  const searchValue = option.value || option.name || '';
  if (!searchValue) return null;

  const params = new URLSearchParams({
    search: searchValue,
    type: entityType,
    source: 'home_search',
  });
  if (lang === 'es') params.set('lang', 'es');
  return `/app?${params.toString()}`;
}

export default function LandingEntitySearch({ lang = 'en', navigate }) {
  const copy = COPY[lang] || COPY.en;
  const [inputValue, setInputValue] = React.useState('');
  const [options, setOptions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const requestRef = React.useRef(0);

  React.useEffect(() => {
    const query = inputValue.trim();
    const requestId = ++requestRef.current;
    if (query.length < 2) {
      setOptions([]);
      setLoading(false);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      const [companies, officers] = await Promise.all([
        spanishCompaniesService.autocompleteCompanies(query, { limit: 10 }),
        spanishCompaniesService.autocompleteOfficers(query, { limit: 6 }),
      ]);
      if (requestId !== requestRef.current) return;
      setOptions(normalizeSuggestions(companies, officers));
      setLoading(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [inputValue]);

  const openSelection = option => {
    const href = buildLandingSearchHref(option, lang);
    if (!href) return;
    const isOfficer = option.type === 'officer' || option.type === 'officer_sole_shareholder';
    const entityType = isOfficer ? 'officer' : 'company';

    const selectionRank = options.findIndex(candidate => candidate === option) + 1;
    trackEvent('home_search_selection', {
      language: lang,
      entity_type: entityType,
      selection_rank: selectionRank || 0,
      suggestion_count: options.length,
    });

    navigate(href);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 560, mx: { xs: 'auto', md: 0 }, mb: 2 }}>
      <Autocomplete
        freeSolo
        autoHighlight
        filterOptions={items => items}
        options={options}
        loading={loading}
        inputValue={inputValue}
        onInputChange={(_, value, reason) => {
          setInputValue(value);
          if (reason === 'clear') setOptions([]);
        }}
        onChange={(_, option) => openSelection(option)}
        getOptionLabel={option => (typeof option === 'string' ? option : option.label || option.name || '')}
        isOptionEqualToValue={(option, value) => option.type === value.type && option.value === value.value}
        renderOption={(props, option) => {
          const isOfficer = option.type === 'officer' || option.type === 'officer_sole_shareholder';
          return (
            <Box component="li" {...props} key={`${option.type}-${option.value}`} sx={{ gap: 1.25 }}>
              {isOfficer
                ? <PersonIcon sx={{ color: 'info.main', fontSize: 20 }} />
                : <BusinessIcon sx={{ color: 'primary.main', fontSize: 20 }} />}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 650 }} noWrap>
                  {option.name || option.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {isOfficer
                    ? `${copy.officer}${option.company_count ? ` · ${copy.companyCount(option.company_count)}` : ''}`
                    : copy.company}
                </Typography>
              </Box>
            </Box>
          );
        }}
        renderInput={params => (
          <TextField
            {...params}
            placeholder={copy.placeholder}
            aria-label={copy.placeholder}
            helperText={copy.hint}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <InputAdornment position="start"><SearchIcon color="primary" /></InputAdornment>
                  {params.InputProps.startAdornment}
                </>
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
                bgcolor: 'rgba(255,255,255,0.07)',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(94,208,194,0.55)' },
                '&:hover fieldset': { borderColor: 'primary.light' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 2 },
              },
              '& .MuiFormHelperText-root': { color: 'text.disabled', mx: 0.5 },
            }}
          />
        )}
      />
    </Box>
  );
}
