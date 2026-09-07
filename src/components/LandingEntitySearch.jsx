import React from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import { spanishCompaniesService } from '../services/spanishCompaniesService';
import { mergeEntitySuggestions } from '../utils/entitySuggestions';
import { classifyEntitySelection } from '../utils/entitySelection';
import { trackEvent } from '../utils/track';
import { initialFunnelState, stepFunnel } from '../utils/landingSearchFunnel';
import { LANDING_EXAMPLES, exampleSearchOption } from '../copy/landingExamples';
import { landingTokens } from '../theme/landingTokens';

const COPY = {
  en: {
    placeholder: 'Search a Spanish company or officer',
    hint: 'Start typing, then choose a result or press Enter.',
    search: 'Search',
    tryLabel: 'Try:',
    noResults: 'No matches. Try the full legal name, or a shorter part of it.',
    tooShort: 'Type at least two characters.',
    company: 'Company',
    officer: 'Officer',
    companyCount: count => `${count} compan${count === 1 ? 'y' : 'ies'}`,
  },
  es: {
    placeholder: 'Busca una empresa o administrador',
    hint: 'Empieza a escribir y elige un resultado o pulsa Intro.',
    search: 'Buscar',
    tryLabel: 'Prueba:',
    noResults: 'Sin coincidencias. Prueba con la denominación completa o una parte más corta.',
    tooShort: 'Escribe al menos dos caracteres.',
    company: 'Empresa',
    officer: 'Administrador o cargo',
    companyCount: count => `${count} empresa${count === 1 ? '' : 's'}`,
  },
};

const MIN_QUERY_LENGTH = 2;
const SUGGESTION_DEBOUNCE_MS = 250;

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

export function buildLandingSearchHref(option, lang = 'en', source = 'home_search') {
  if (!option || typeof option !== 'object') return null;
  // Same routing the graph's own dropdown uses, so a pick behaves identically
  // whether it is made here or inside the app. In particular an entity the
  // registry knows ONLY as an owner (a private individual, a foreign parent)
  // has no company doc, and deep-linking it as a company searched the registry
  // for a company by that name and landed the visitor on "no results".
  const { route } = classifyEntitySelection(option);
  const isOfficer = route === 'officer';
  const entityType = route === 'company' ? 'company' : route === 'officer' ? 'officer' : 'shareholder';
  // Display the current/new name, exactly as the graph's own selection does
  // (applySelectedOption uses value.name for the search box).
  const searchValue = (isOfficer ? (option.value || option.name) : (option.name || option.value)) || '';
  if (!searchValue) return null;

  const params = new URLSearchParams({
    search: searchValue,
    type: entityType,
    source,
  });
  // Bind a company pick to its exact legal entity. Without this the app re-ran
  // a fuzzy NAME search on arrival, so choosing "NURNBERG CONSULTING SL" also
  // pulled in "NURNBERG CONSULTING & PARTNERS" — while the same pick inside the
  // graph resolved to one company, because applySelectedOption passes the
  // suggestion's stable id as handleSearch's groupKeyOverride. Officers have no
  // group key (they are searched by name across companies), so they never carry
  // one. Optional: /empresa deep links arrive without an id and keep the old
  // name-search behaviour.
  // Only a company doc has a group_key; an owner-only row's `id` is the bare
  // name, which would bind the deep link to nothing.
  if (entityType === 'company' && option.id) params.set('gk', String(option.id));
  if (lang === 'es') params.set('lang', 'es');
  return `/app/?${params.toString()}`;
}

export function landingGraphRequestFromHref(href) {
  if (typeof href !== 'string' || !href.startsWith('/app/')) return null;
  const queryIndex = href.indexOf('?');
  const params = new URLSearchParams(queryIndex >= 0 ? href.slice(queryIndex + 1) : '');
  const name = (params.get('search') || '').trim();
  if (!name) return null;
  const requestedType = params.get('type');
  const searchType = requestedType === 'officer' || requestedType === 'shareholder'
    ? requestedType
    : 'company';
  return {
    name,
    searchType,
    groupKey: params.get('gk') || undefined,
    source: params.get('source') || 'home_search',
  };
}

export default function LandingEntitySearch({ lang = 'en', navigate }) {
  const copy = COPY[lang] || COPY.en;
  const tk = landingTokens(useTheme().palette.mode);
  const [inputValue, setInputValue] = React.useState('');
  const [options, setOptions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  // 'noResults' | 'tooShort' | null — what a failed submit tells the visitor.
  const [feedback, setFeedback] = React.useState(null);
  const requestRef = React.useRef(0);
  // Whether the last key pressed in the field was Enter, so an Autocomplete
  // onChange fired by the keyboard can be told apart from a mouse pick — and
  // whether the visitor moved the highlight with the arrow keys first. Enter on
  // MUI's automatic first-row highlight is not a choice of that row: "endesa"
  // + Enter opened ENDESA ENERGIA SA because it happened to rank first.
  const enterPressedRef = React.useRef(false);
  const arrowUsedRef = React.useRef(false);

  // The funnel reducer is pure; the component only forwards its events. Kept
  // in a ref because it drives analytics, never rendering.
  const funnelRef = React.useRef(initialFunnelState());
  const dispatch = React.useCallback(action => {
    const out = stepFunnel(funnelRef.current, { at: Date.now(), ...action });
    funnelRef.current = out.state;
    out.events.forEach(e => trackEvent(e.name, { language: lang, ...e.params }));
    return out;
  }, [lang]);

  const openSelection = React.useCallback((option, { method, match, rank, source = 'home_search', from = options } = {}) => {
    const href = buildLandingSearchHref(option, lang, source);
    if (!href) return;
    const resolvedRank = rank ?? (from.findIndex(candidate => candidate === option) + 1);
    dispatch({ type: 'select', option, method, match, rank: resolvedRank, options: from });
    navigate(href);
  }, [dispatch, lang, navigate, options]);

  React.useEffect(() => {
    const query = inputValue.trim();
    const requestId = ++requestRef.current;
    if (query.length < MIN_QUERY_LENGTH) {
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
      const next = normalizeSuggestions(companies, officers);
      setOptions(next);
      setLoading(false);

      // A submit made while these were loading is resolved now.
      const pendingMethod = funnelRef.current.pendingSubmit?.method;
      const out = dispatch({ type: 'results', query: inputValue, options: next });
      if (out.open) {
        openSelection(out.open.option, { method: pendingMethod, match: out.open.match, rank: out.open.rank, from: next });
      } else if (pendingMethod && next.length === 0) {
        setFeedback('noResults');
      }
    }, SUGGESTION_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
    // Deliberately not keyed on openSelection: it changes with `options`, which
    // this effect sets, so depending on it would refetch after every answer.
  }, [inputValue, dispatch]);

  const submit = method => {
    const out = dispatch({ type: 'submit', method, query: inputValue, options, loading });
    if (out.open) {
      openSelection(out.open.option, { method, match: out.open.match, rank: out.open.rank });
      return;
    }
    if (inputValue.trim().length < MIN_QUERY_LENGTH) setFeedback('tooShort');
    else if (!loading) setFeedback('noResults');
    // Otherwise the submit is held until the suggestions arrive.
  };

  const openExample = example => {
    openSelection(exampleSearchOption(example), {
      method: 'example', match: 'exact', rank: 0, source: 'home_example', from: [],
    });
  };

  const helperText = feedback ? copy[feedback] : copy.hint;

  return (
    <Box sx={{ width: '100%', maxWidth: 600, mx: { xs: 'auto', md: 0 }, mb: 2 }}>
      <Autocomplete
        freeSolo
        autoHighlight
        filterOptions={items => items}
        options={options}
        loading={loading}
        inputValue={inputValue}
        onInputChange={(_, value, reason) => {
          setInputValue(value);
          setFeedback(null);
          if (reason === 'clear') setOptions([]);
          if (reason === 'input') {
            arrowUsedRef.current = false;
            dispatch({ type: 'input', query: value });
          }
        }}
        onChange={(_, option) => {
          const viaEnter = enterPressedRef.current;
          const chosenWithArrows = arrowUsedRef.current;
          enterPressedRef.current = false;
          // freeSolo hands back the raw string when Enter is pressed with no
          // highlighted row (typically: suggestions still loading).
          if (typeof option === 'string') { submit('enter'); return; }
          if (!option) return;
          // Enter on the automatic highlight means "search what I typed":
          // resolve exact-over-first. Arrow keys or a click mean that row.
          if (viaEnter && !chosenWithArrows) { submit('enter'); return; }
          openSelection(option, { method: viaEnter ? 'enter' : 'click', match: 'highlighted' });
        }}
        onFocus={() => dispatch({ type: 'focus' })}
        onBlur={() => dispatch({ type: 'blur' })}
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
            helperText={helperText}
            onKeyDown={event => {
              enterPressedRef.current = event.key === 'Enter';
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') arrowUsedRef.current = true;
            }}
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
                  <Button
                    variant="contained"
                    size="small"
                    disableElevation
                    aria-label={copy.search}
                    // Keep focus in the field: a blur here would read as an
                    // abandoned search a moment before the submit.
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => submit('button')}
                    sx={{ ml: 0.75, px: 1.75, textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {copy.search}
                  </Button>
                </>
              ),
            }}
            sx={{
              // The search box is the landing page's primary action, but it was
              // drawn in teal at 55% opacity — the same hue as most of the text
              // around it — so it receded into the page instead of leading it.
              // Teal stays the brand voice everywhere else; the field wins on
              // CONTRAST instead of a competing hue (amber would have clashed
              // with the report CTA). A near-white border is the highest-contrast
              // neutral available on the navy ground, and focus stays teal so the
              // brand still signs the interaction.
              //
              // The landing follows the system theme; surfaces come from
              // landingTokens so the light variant is solid, not a white wash.
              //
              // Size is the second half of the same argument: the field is the
              // one thing on the first screen the visitor is meant to touch, so
              // it is drawn taller and larger than any surrounding control
              // rather than at the same body size as the paragraphs above it.
              '& .MuiOutlinedInput-root': {
                bgcolor: tk.fieldBg,
                borderRadius: 2,
                fontSize: { xs: '1.02rem', sm: '1.1rem' },
                py: 0.85,
                '& fieldset': { borderColor: tk.fieldBorder, borderWidth: 1.5 },
                '&:hover fieldset': { borderColor: tk.fieldBorderHover },
                '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 2 },
              },
              // The Search button lives in the end adornment; MUI's default
              // right padding is sized for the clear icon alone.
              '& .MuiOutlinedInput-root.MuiInputBase-adornedEnd': { pr: 1 },
              '& .MuiOutlinedInput-root .MuiAutocomplete-input': { py: 0.6 },
              '& .MuiInputBase-input::placeholder': { opacity: 0.75 },
              '& .MuiFormHelperText-root': { color: feedback ? 'accent.warning' : tk.muted, mx: 0.5 },
            }}
          />
        )}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mt: 1, justifyContent: { xs: 'center', md: 'flex-start' } }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', mr: 0.25 }}>{copy.tryLabel}</Typography>
        {LANDING_EXAMPLES.map(example => (
          <Chip
            key={example.id}
            label={example.label}
            size="small"
            variant="outlined"
            clickable
            onClick={() => openExample(example)}
            sx={{
              color: 'accent.primary',
              borderColor: tk.exampleChipBorder,
              fontWeight: 600,
              '&:hover': { borderColor: 'accent.primary', bgcolor: tk.exampleChipHoverBg },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
