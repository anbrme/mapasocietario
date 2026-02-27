import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Chip,
  TextField,
  InputAdornment,
  Autocomplete,
  CircularProgress,
  Button,
  Paper,
  Snackbar,
  Link,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SearchIcon from '@mui/icons-material/Search';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CookieIcon from '@mui/icons-material/Cookie';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { debounce } from 'lodash';
import { spanishCompaniesService } from './services/spanishCompaniesService';
import SpanishCompanyNetworkGraph from './components/SpanishCompanyNetworkGraph';


const FAQ_ITEMS = [
  {
    question: 'What should I know before using this app?',
    answer:
      'Software is provided as-is, with no liability for errors, omissions, or outcomes. The application is in active development.',
  },
  {
    question: 'Do I need to pay or create an account?',
    answer: 'No charge, no account, no signup required. The app is free to use.',
  },
  {
    question: 'Can I get API access?',
    answer: 'Yes. I am working on the API, it should be available soon after this experimental phase. When ready, it will be accessible from this page',
  },
  {
    question: 'Will this improve over time?',
    answer: 'Yes. Expect continuous improvements at a sustained pace.',
  },
];

const COOKIE_CONSENT_KEY = 'mapasocietario_cookie_consent';

function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) setOpen(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    setOpen(false);
  };

  const handleReject = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'rejected');
    setOpen(false);
  };

  if (!open) return null;

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Paper
        elevation={6}
        sx={{
          p: 2,
          px: 3,
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CookieIcon sx={{ fontSize: 20, color: 'warning.main' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Cookies y privacidad
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
          Este sitio utiliza cookies esenciales para su funcionamiento. No utilizamos cookies de seguimiento ni compartimos datos personales con terceros. Al continuar navegando, aceptas el uso de cookies esenciales conforme al{' '}
          <Link href="https://gdpr.eu" target="_blank" rel="noopener" sx={{ color: 'primary.main' }}>
            RGPD
          </Link>.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button
            size="small"
            variant="text"
            onClick={handleReject}
            sx={{ color: 'text.secondary', textTransform: 'none', fontSize: '0.8rem' }}
          >
            Rechazar
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleAccept}
            sx={{ textTransform: 'none', fontSize: '0.8rem' }}
          >
            Aceptar
          </Button>
        </Box>
      </Paper>
    </Snackbar>
  );
}

export default function App() {
  const [selectedEntity, setSelectedEntity] = useState(null); // { name, type: 'company'|'officer' }
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState('company'); // 'company' or 'officer'
  const inputRef = useRef(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchCompanySuggestions = useCallback(
    debounce(async (value) => {
      if (!value || value.length < 2) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const result = await spanishCompaniesService.autocompleteCompanies(value, { limit: 10 });
        const suggestions = (result.suggestions || []).map(c => ({
          label: c.label || c.name || c.company_name,
          value: c.value || c.name || c.company_name,
          name: c.name || c.company_name,
          type: 'company',
        }));
        setOptions(suggestions);
      } catch (err) {
        console.error('Autocomplete error:', err);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchOfficerSuggestions = useCallback(
    debounce(async (value) => {
      if (!value || value.length < 2) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const result = await spanishCompaniesService.autocompleteOfficers(value, { limit: 10 });
        const suggestions = (result.suggestions || []).map(o => ({
          label: o.label || o.name,
          value: o.value || o.name,
          name: o.name,
          type: 'officer',
          company_count: o.company_count,
        }));
        setOptions(suggestions);
      } catch (err) {
        console.error('Officer autocomplete error:', err);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  const fetchSuggestions = searchMode === 'company' ? fetchCompanySuggestions : fetchOfficerSuggestions;

  const handleSelect = (name) => {
    if (name) setSelectedEntity({ name, type: searchMode });
  };

  const handleSearchModeChange = (event, newMode) => {
    if (newMode !== null) {
      setSearchMode(newMode);
      setOptions([]);
      setInputValue('');
      // Re-focus the input after mode switch
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Once an entity is selected, show the graph full-viewport
  if (selectedEntity) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <SpanishCompanyNetworkGraph
          visible={true}
          embedded={true}
          initialCompanyName={selectedEntity.name}
          initialSearchType={selectedEntity.type}
        />
        <CookieConsent />
      </Box>
    );
  }

  const placeholderText = searchMode === 'company'
    ? 'Search company... (e.g. Inditex, Repsol)'
    : 'Search officer... (e.g. Amancio Ortega)';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        height: '100vh',
        gap: 2.5,
        px: 3,
        py: 4,
        pb: 2,
        overflowY: 'auto',
      }}
    >
      {/* Hero section */}
      <Box sx={{ textAlign: 'center', mt: 1 }}>
        <AccountTreeIcon
          sx={{
            fontSize: 52,
            color: 'primary.main',
            opacity: 0.6,
            mb: 1.5,
            filter: 'drop-shadow(0 0 12px rgba(25,118,210,0.3))',
          }}
        />
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            mb: 0.5,
            letterSpacing: '-0.02em',
          }}
        >
          Mapa Societario
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 360, mx: 'auto' }}>
          Interactive network map of Spanish corporate relationships
        </Typography>
      </Box>

      {/* Search section */}
      <Box sx={{ width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
        {/* Search mode toggle */}
        <ToggleButtonGroup
          value={searchMode}
          exclusive
          onChange={handleSearchModeChange}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.8rem',
              px: 2.5,
              py: 0.5,
              borderColor: 'rgba(25,118,210,0.3)',
              color: 'text.secondary',
              '&.Mui-selected': {
                bgcolor: 'rgba(25,118,210,0.15)',
                color: 'primary.main',
                borderColor: 'primary.main',
                '&:hover': {
                  bgcolor: 'rgba(25,118,210,0.2)',
                },
              },
              '&:hover': {
                bgcolor: 'rgba(25,118,210,0.06)',
              },
            },
          }}
        >
          <ToggleButton value="company">
            <BusinessIcon sx={{ fontSize: 16, mr: 0.75 }} />
            Company
          </ToggleButton>
          <ToggleButton value="officer">
            <PersonIcon sx={{ fontSize: 16, mr: 0.75 }} />
            Officer
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Autocomplete search field */}
        <Autocomplete
          freeSolo
          options={options}
          loading={loading}
          inputValue={inputValue}
          filterOptions={x => x}
          onInputChange={(event, newValue, reason) => {
            setInputValue(newValue);
            if (reason === 'input') {
              fetchSuggestions(newValue);
            } else if (reason === 'clear') {
              setOptions([]);
            }
          }}
          onChange={(event, value) => {
            if (value && typeof value === 'object') {
              handleSelect(value.name || value.value);
            } else if (typeof value === 'string' && value.trim()) {
              handleSelect(value.trim());
            }
          }}
          getOptionLabel={option => {
            if (typeof option === 'string') return option;
            return option.label || option.value || '';
          }}
          isOptionEqualToValue={(option, val) => {
            if (typeof val === 'string') return option.label === val;
            return option.label === val?.label;
          }}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.label}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                {option.type === 'officer'
                  ? <PersonIcon sx={{ fontSize: 16, color: '#f57c00' }} />
                  : <BusinessIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                }
                <Typography variant="body2" sx={{ flex: 1 }}>{option.name || option.label}</Typography>
                {option.type === 'officer' && option.company_count > 0 && (
                  <Chip
                    label={`${option.company_count} co.`}
                    size="small"
                    sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(245,124,0,0.12)', color: '#f57c00' }}
                  />
                )}
              </Box>
            </Box>
          )}
          sx={{ width: '100%' }}
          renderInput={params => (
            <TextField
              {...params}
              placeholder={placeholderText}
              autoFocus
              inputRef={inputRef}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                    {params.InputProps.startAdornment}
                  </>
                ),
                endAdornment: (
                  <>
                    {loading && <CircularProgress color="inherit" size={18} />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue.trim() && options.length === 0) {
                  handleSelect(inputValue.trim());
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.03)',
                },
              }}
            />
          )}
        />
      </Box>

      {/* Experimental warning */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 0.75,
          borderRadius: 2,
          bgcolor: 'rgba(255, 167, 38, 0.06)',
          border: '1px solid rgba(255, 167, 38, 0.2)',
          maxWidth: 500,
        }}
      >
        <WarningAmberIcon sx={{ fontSize: 16, color: 'warning.main', flexShrink: 0 }} />
        <Typography variant="caption" sx={{ color: 'warning.light', lineHeight: 1.4 }}>
          Experimental tool. Data originates from BORME but may contain errors. For official data, consult{' '}
          <Link href="https://www.boe.es/diario_borme/" target="_blank" rel="noopener" sx={{ color: 'warning.main' }}>
            the official BORME website
          </Link>.
        </Typography>
      </Box>

      {/* FAQ section */}
      <Box sx={{ width: '100%', maxWidth: 500 }}>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 0.8,
            fontWeight: 700,
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            fontSize: '0.65rem',
          }}
        >
          Frequently asked questions
        </Typography>
        {FAQ_ITEMS.map(item => (
          <Accordion
            key={item.question}
            disableGutters
            elevation={0}
            sx={{
              bgcolor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px !important',
              mb: 0.6,
              '&:before': { display: 'none' },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.035)' },
              transition: 'background-color 0.15s',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary', fontSize: 18 }} />}
              sx={{ minHeight: 38, '& .MuiAccordionSummary-content': { my: 0.6 } }}
            >
              <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.primary' }}>
                {item.question}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.45 }}>
                {item.answer}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

      {/* Footer */}
      <Typography
        variant="caption"
        sx={{
          mt: 'auto',
          color: 'text.disabled',
          textAlign: 'center',
          fontSize: '0.65rem',
          width: '100%',
          pt: 1.5,
          lineHeight: 1.5,
        }}
      >
        &copy; {new Date().getFullYear()} Mapa Societario &middot; Free to use, no account required &middot; Data sourced from BORME (Registro Mercantil)
      </Typography>

      <CookieConsent />
    </Box>
  );
}
