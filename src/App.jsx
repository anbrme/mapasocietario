import React, { useState, useCallback, useEffect } from 'react';
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
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SearchIcon from '@mui/icons-material/Search';
import BusinessIcon from '@mui/icons-material/Business';
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
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchSuggestions = useCallback(
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

  const handleSelect = (name) => {
    if (name) setSelectedCompany(name);
  };

  // Once a company is selected, show the graph full-viewport
  if (selectedCompany) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <SpanishCompanyNetworkGraph
          visible={true}
          embedded={true}
          initialCompanyName={selectedCompany}
        />
        <CookieConsent />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        height: '100vh',
        gap: 3,
        px: 3,
        py: 4,
        pb: 2,
        overflowY: 'auto',
      }}
    >
      <AccountTreeIcon sx={{ fontSize: 56, color: 'rgba(25,118,210,0.35)' }} />
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          Mapa Societario
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Relationships network map of Spanish companies
        </Typography>
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
          bgcolor: 'rgba(255, 167, 38, 0.08)',
          border: '1px solid rgba(255, 167, 38, 0.25)',
          maxWidth: 480,
        }}
      >
        <WarningAmberIcon sx={{ fontSize: 18, color: 'warning.main', flexShrink: 0 }} />
        <Typography variant="caption" sx={{ color: 'warning.light', lineHeight: 1.4 }}>
           Experimental tool. The data originates from BORME, but in this version it may contain errors or be incomplete. For official data, please consult BORME directly on <Link href="https://www.boe.es/diario_borme/" target="_blank" rel="noopener" sx={{ color: 'warning.main' }}>the official BORME website</Link>.
        </Typography>
      </Box>

      <Box sx={{ width: '100%', maxWidth: 560 }}>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 0.8,
            fontWeight: 700,
            color: 'primary.main',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          FAQ
        </Typography>
        {FAQ_ITEMS.map(item => (
          <Accordion
            key={item.question}
            disableGutters
            elevation={0}
            sx={{
              bgcolor: 'rgba(25,118,210,0.04)',
              border: '1px solid rgba(25,118,210,0.2)',
              borderRadius: '10px !important',
              mb: 0.8,
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: 'primary.main' }} />}
              sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.8 } }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {item.question}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1.2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.45 }}>
                {item.answer}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BusinessIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="body2">{option.name || option.label}</Typography>
            </Box>
          </Box>
        )}
        sx={{ width: '100%', maxWidth: 480 }}
        renderInput={params => (
          <TextField
            {...params}
            placeholder="Search company... (e.g. Inditex, Repsol)"
            autoFocus
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
              },
            }}
          />
        )}
      />

      

      {/* Footer */}
      <Typography
        variant="caption"
        sx={{
          mt: 'auto',
          color: 'text.disabled',
          textAlign: 'center',
          fontSize: '0.7rem',
          width: '100%',
          pt: 1.5,
        }}
      >
        {new Date().getFullYear()} Mapa Societario. All rights reserved. Uso gratuito, sin cuenta ni registro. Datos procedentes del BORME (Registro Mercantil).
      </Typography>

      <CookieConsent />
    </Box>
  );
}
