import React from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Typography, IconButton, Tooltip, Menu, MenuItem, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TranslateIcon from '@mui/icons-material/Translate';
import MenuIcon from '@mui/icons-material/Menu';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import SpanishCompanyNetworkGraph from './components/SpanishCompanyNetworkGraph';
import { siteNav, isHtmlNav } from './utils/siteNav';
import {
  getBrowserLanguage,
  getStoredSearchLanguage,
  normalizeLanguage,
  persistSearchLanguage,
} from './utils/language';

const APP_COPY = {
  en: {
    title: 'Search | Mapa Societario',
    description:
      'Search Spanish companies and officers. Explore corporate relationships in an interactive network graph based on official BORME data.',
    breadcrumb: 'Search',
    languageLabel: 'Language',
    menu: {
      tooltip: 'Menu',
      guide: 'How it works',
      reports: 'Due Diligence reports',
      pricing: 'Pricing',
      about: 'About',
      faq: 'FAQ',
      terms: 'Terms',
      privacy: 'Privacy',
    },
  },
  es: {
    title: 'Buscar | Mapa Societario',
    description:
      'Busca empresas y administradores españoles. Explora relaciones societarias en un grafo interactivo basado en datos oficiales del BORME.',
    breadcrumb: 'Buscar',
    languageLabel: 'Idioma',
    menu: {
      tooltip: 'Menú',
      guide: 'Cómo funciona',
      reports: 'Informes due diligence',
      pricing: 'Precios',
      about: 'Acerca de',
      faq: 'Preguntas frecuentes',
      terms: 'Términos',
      privacy: 'Privacidad',
    },
  },
};

const getInitialLanguage = () => {
  const params = new URLSearchParams(window.location.search);
  return (
    normalizeLanguage(params.get('lang')) ||
    getStoredSearchLanguage() ||
    getBrowserLanguage() ||
    'en'
  );
};

export default function App() {
  const navigate = useNavigate();
  const [language, setLanguage] = React.useState(getInitialLanguage);
  const [menuAnchor, setMenuAnchor] = React.useState(null);
  const copy = APP_COPY[language] || APP_COPY.en;

  // Secondary navigation for the workspace, so /app is self-sufficient: a
  // returning visitor (redirected past the guide) can still reach the guide,
  // reports, pricing, FAQ and the legal pages without leaving the graph.
  // Links are language-aware (siteNav) and all open in the SAME tab — SPA
  // routes via navigate(), static .html pages via a full-page load.
  const nav = siteNav(language);
  const go = (url) => {
    setMenuAnchor(null);
    if (isHtmlNav(url)) window.location.assign(url);
    else navigate(url);
  };
  const navItems = [
    { label: copy.menu.guide, url: nav.guide },
    { label: copy.menu.reports, url: nav.reports },
    { label: copy.menu.pricing, url: nav.pricing },
    null,
    { label: copy.menu.about, url: nav.about },
    { label: copy.menu.faq, url: nav.faq },
    null,
    { label: copy.menu.terms, url: nav.terms },
    { label: copy.menu.privacy, url: nav.privacy },
  ];

  // /empresa pages and the landing demo link here as /app?search=<company>.
  // Read once on mount; the graph auto-searches via initialCompanyName.
  const initialSearch = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('search') || '').trim() || undefined;
  }, []);

  React.useEffect(() => {
    persistSearchLanguage(language);
  }, [language]);

  const handleLanguageChange = (_, value) => {
    const next = normalizeLanguage(value);
    if (!next) return;
    setLanguage(next);

    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Helmet>
        <title>{copy.title}</title>
        <meta name="description" content={copy.description} />
        <link rel="canonical" href="https://mapasocietario.es/app" />
      </Helmet>

      {/* Slim home breadcrumb. Gives a way back to the homepage (the back gesture
          is also wired in the native app) and lowers the search inputs off the
          very top edge. */}
      <Box
        component="nav"
        aria-label="breadcrumb"
        sx={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.5,
          py: 1,
          pt: 'calc(8px + env(safe-area-inset-top))',
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            minWidth: 0,
            flex: 1,
          }}
        >
          <Box
            role="link"
            tabIndex={0}
            onClick={() => navigate('/')}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/'); }}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: 'pointer',
              color: 'primary.light',
              fontWeight: 600,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 18 }} />
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1 }}>
              Mapa Societario
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'text.disabled', lineHeight: 1 }}>
            ›
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1 }}>
            {copy.breadcrumb}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          <Tooltip title={copy.menu.tooltip}>
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              aria-label={copy.menu.tooltip}
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.light' } }}
            >
              <MenuIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            {navItems.map((item, i) =>
              item === null ? (
                <Divider key={`div-${i}`} />
              ) : (
                <MenuItem
                  key={item.label}
                  onClick={() => go(item.url)}
                  sx={{ fontSize: '0.85rem' }}
                >
                  {item.label}
                </MenuItem>
              ),
            )}
          </Menu>
          <TranslateIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
          <ToggleButtonGroup
            value={language}
            exclusive
            size="small"
            onChange={handleLanguageChange}
            aria-label={copy.languageLabel}
            sx={{
              '& .MuiToggleButton-root': {
                minWidth: 38,
                px: 1,
                py: 0.25,
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'none',
              },
            }}
          >
            <ToggleButton value="es" aria-label="Español">ES</ToggleButton>
            <ToggleButton value="en" aria-label="English">EN</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      <SpanishCompanyNetworkGraph
        visible={true}
        embedded={true}
        initialCompanyName={initialSearch}
        language={language}
      />
    </Box>
  );
}
