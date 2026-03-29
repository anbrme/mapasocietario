import React, { useState, useCallback, useRef, lazy, Suspense } from 'react';
import {
  Box,
  Typography,
  Chip,
  TextField,
  InputAdornment,
  Autocomplete,
  CircularProgress,
  Link,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButton,
  ToggleButtonGroup,
  Button,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SearchIcon from '@mui/icons-material/Search';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import BarChartIcon from '@mui/icons-material/BarChart';
import DescriptionIcon from '@mui/icons-material/Description';
import { debounce } from 'lodash';
import { useNavigate } from 'react-router-dom';
import { spanishCompaniesService } from './services/spanishCompaniesService';
import SpanishCompanyNetworkGraph from './components/SpanishCompanyNetworkGraph';
const SampleReportViewer = lazy(() => import('./components/SampleReportViewer'));
import AdSenseAdUnit from './components/AdSenseAdUnit';


const FAQ_ITEMS = [
  {
    question: 'What should I know before using this app?',
    answer:
      'Software is provided as-is, with no liability for errors, omissions, or outcomes. The application is in active development.',
  },
  {
    question: 'Is the data accurate and up-to-date?',
    answer: (
      <>
        The data is sourced from official Spanish public registries and is updated regularly. However, please note that while we strive for accuracy, we cannot guarantee it 100%, as the data parsing from PDF is inherently imperfect. Use this tool for exploratory and educational purposes, but always verify critical information with official sources when needed.
      </>
    ),
  },
  {
    question: 'What is a Due Diligence report?',
    answer: 'A Due Diligence report is a comprehensive PDF with an AI-powered analysis and sanctions cross-checking, covering corporate structure, full officer history, capital events, red flags, and key changes over time — far more detail than the network graph alone. Search for a company and click the "Due Diligence" button in the search toolbar to purchase one.',
  },
  {
    question: 'Do I need to pay or create an account?',
    answer: 'The network graph is completely free — no account, no signup. Due Diligence reports are a paid feature available via a one-time purchase per company.',
  },
  {
    question: 'Can I get API access?',
    answer: (
      <>
        Yes. Please write us at app@ncdata.eu with a brief description of your intended use case, so that we can tailor our response to your needs.
      </>
    ),
  },
  {
    question: 'Will this improve over time?',
    answer: 'Yes. Expect continuous improvements at a sustained pace.',
  },
];

export default function App() {
  const navigate = useNavigate();
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
          component="h1"
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

      {/* Due Diligence feature highlight */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          px: 2,
          py: 1.25,
          borderRadius: 2,
          bgcolor: 'rgba(255, 167, 38, 0.06)',
          border: '1px solid rgba(255, 167, 38, 0.25)',
          maxWidth: 500,
          width: '100%',
        }}
      >
        <DescriptionIcon sx={{ fontSize: 20, color: 'warning.main', flexShrink: 0, mt: 0.25 }} />
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'warning.light', display: 'block', mb: 0.25 }}>
            Due Diligence Reports, only EUR 5 per company
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
            Get comprehensive company reports including AI-powered analysis and sanctions cross-checking, corporate structure, officer history, capital changes, red flags, and more. Search for a company, then click the "Due Diligence" button in the toolbar.
          </Typography>
        </Box>
      </Box>

      {/* Sample DD report preview */}
      <Accordion
        disableGutters
        elevation={0}
        sx={{
          maxWidth: 500,
          width: '100%',
          bgcolor: 'rgba(255, 167, 38, 0.04)',
          border: '1px solid rgba(255, 167, 38, 0.2)',
          borderRadius: '8px !important',
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon sx={{ color: 'warning.main', fontSize: 18 }} />}
          sx={{ minHeight: 38, '& .MuiAccordionSummary-content': { my: 0.6 } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DescriptionIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'warning.light' }}>
              See a sample Due Diligence report
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
          <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>}>
            <SampleReportViewer />
          </Suspense>
        </AccordionDetails>
      </Accordion>

      {/* Dashboard link */}
      <Button
        onClick={() => navigate('/dashboard')}
        variant="outlined"
        size="small"
        startIcon={<BarChartIcon sx={{ fontSize: '1.1rem !important' }} />}
        sx={{
          px: 2.5,
          py: 0.5,
          color: 'text.secondary',
          borderColor: 'rgba(33, 150, 243, 0.35)',
          bgcolor: 'rgba(33, 150, 243, 0.06)',
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.8rem',
          borderRadius: 6,
          '&:hover': {
            borderColor: '#1976d2',
            color: '#1976d2',
            bgcolor: 'rgba(25, 118, 210, 0.1)',
          },
        }}
      >
        Dashboard
      </Button>

      {/* Buy me a coffee */}
      <Button
        href="https://buymeacoffee.com/anbrme"
        target="_blank"
        rel="noopener noreferrer"
        variant="outlined"
        size="small"
        startIcon={<LocalCafeIcon sx={{ fontSize: '1.1rem !important' }} />}
        sx={{
          px: 2.5,
          py: 0.5,
          color: 'text.secondary',
          borderColor: 'rgba(255, 167, 38, 0.35)',
          bgcolor: 'rgba(255, 167, 38, 0.06)',
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.8rem',
          borderRadius: 6,
          '&:hover': {
            borderColor: '#f57c00',
            color: '#f57c00',
            bgcolor: 'rgba(245, 124, 0, 0.1)',
          },
        }}
      >
        Buy me a coffee
      </Button>

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

      <AdSenseAdUnit />

      {/* FAQ section */}
      <Box sx={{ width: '100%', maxWidth: 500 }}>
        <Typography
          variant="caption"
          component="h2"
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
      <Box
        sx={{
          mt: 'auto',
          textAlign: 'center',
          width: '100%',
          pt: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          alignItems: 'center',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            fontSize: '0.65rem',
            lineHeight: 1.5,
          }}
        >
          &copy; {new Date().getFullYear()} Mapa Societario &middot; Free to use, no account required &middot; Data sourced from BORME (Registro Mercantil)
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
          <Link
            href="/dashboard.html"
            variant="caption"
            sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            Dashboard
          </Link>
          <Link
            href="/about.html"
            target="_blank"
            rel="noopener"
            variant="caption"
            sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            About
          </Link>
          <Link
            href="https://github.com/anbrme/borme-public-api"
            target="_blank"
            rel="noopener"
            variant="caption"
            sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            Public API docs
          </Link>
          <Link
            href="/privacy.html"
            target="_blank"
            rel="noopener"
            variant="caption"
            sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            Privacy & Cookies
          </Link>
        </Box>
      </Box>
    </Box>
  );
}
