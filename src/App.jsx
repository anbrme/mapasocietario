/*
 * Mapa Societario — Programa de ordenador
 * Autor: Alessandro Nurnberg
 * Todos los derechos reservados.
 */
import React from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Typography, IconButton, Tooltip, Menu, MenuItem, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TranslateIcon from '@mui/icons-material/Translate';
import MenuIcon from '@mui/icons-material/Menu';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import SpanishCompanyNetworkGraph from './components/SpanishCompanyNetworkGraph';
import { ThemeModeToggle } from './theme/ThemeModeToggle';
import { DATA_MAINTENANCE } from './config/dataMaintenance';
import { siteNav, isHtmlNav, isExternalNav } from './utils/siteNav';
import { isNativeApp, openListedCompanies } from './services/listedCompaniesNav';
import { trackEvent, trackUserManualDownload } from './utils/track';
import {
  getBrowserLanguage,
  getStoredSearchLanguage,
  normalizeLanguage,
  persistSearchLanguage,
} from './utils/language';

const APP_COPY = {
  en: {
    title: 'Relationship Graph | Mapa Societario',
    description:
      'Search Spanish company and officer histories compiled from daily BORME publications and explore their relationships in an interactive graph.',
    breadcrumb: 'Relationship graph',
    languageLabel: 'Language',
    menu: {
      tooltip: 'Menu',
      guide: 'How it works',
      userGuidePdf: 'User guide (PDF)',
      registerGuide: 'Spanish company register & BORME guide',
      directorSearch: 'Spanish company director search',
      listed: 'IBEX 35 companies',
      dashboard: 'Stats dashboard',
      monitoring: 'Your monitoring',
      reports: 'Due Diligence reports',
      connectClaude: 'Use in Claude',
      glossary: 'Registry glossary',
      pricing: 'Pricing',
      about: 'About',
      faq: 'FAQ',
      linkedin: 'LinkedIn',
      terms: 'Terms',
      privacy: 'Privacy',
    },
    themeToggle: {
      toLight: 'Switch to light mode',
      toDark: 'Switch to dark mode',
    },
    systemsOperational: 'All systems operational',
  },
  es: {
    title: 'Grafo de Relaciones | Mapa Societario',
    description:
      'Busca empresas y administradores españoles para entender quién está conectado con quién en un grafo de relaciones basado en datos oficiales del BORME.',
    breadcrumb: 'Grafo de relaciones',
    languageLabel: 'Idioma',
    menu: {
      tooltip: 'Menú',
      guide: 'Cómo funciona',
      userGuidePdf: 'Guía de usuario (PDF)',
      registerGuide: 'Guía BORME',
      directorSearch: 'Buscar administradores',
      reports: 'Informes due diligence',
      connectClaude: 'Usar en Claude',
      glossary: 'Glosario registral',
      pricing: 'Precios',
      about: 'Acerca de',
      listed: 'Empresas del IBEX 35',
      dashboard: 'Panel estadístico',
      monitoring: 'Tu monitorización',
      faq: 'Preguntas frecuentes',
      linkedin: 'LinkedIn',
      terms: 'Términos',
      privacy: 'Privacidad',
    },
    themeToggle: {
      toLight: 'Cambiar a modo claro',
      toDark: 'Cambiar a modo oscuro',
    },
    systemsOperational: 'Todos los sistemas operativos',
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
  // Links are language-aware (siteNav). The downloadable guide opens in a new
  // tab so the current graph remains intact; ordinary destinations stay in the
  // same tab (SPA routes via navigate(), static .html pages via full-page load).
  const nav = siteNav(language);
  const go = (url) => {
    setMenuAnchor(null);
    // The IBEX 35 hub is an SSR page, not a SPA route — open it via the helper
    // (full-page load on web, in-app Custom Tab on native), never client-route.
    if (url === nav.listed) { openListedCompanies(language); return; }
    if (isExternalNav(url)) { window.location.assign(url); return; }
    if (isHtmlNav(url)) window.location.assign(url);
    else navigate(url);
  };
  const navItems = [
    { label: copy.menu.guide, url: nav.guide },
    {
      label: copy.menu.userGuidePdf,
      url: nav.userGuidePdf,
      newTab: true,
      downloadPlacement: 'graph_view_menu',
    },
    { label: copy.menu.registerGuide, url: nav.registerGuide },
    { label: copy.menu.directorSearch, url: nav.directorSearch },
    { label: copy.menu.listed, url: nav.listed },
    { label: copy.menu.dashboard, url: nav.dashboard },
    // The only in-app door to the manage page. Every other way in starts with
    // an email, which the people most likely to need it have never received.
    { label: copy.menu.monitoring, url: nav.monitoring },
    null,
    { label: copy.menu.reports, url: nav.reports },
    { label: copy.menu.connectClaude, url: nav.connectClaude },
    { label: copy.menu.glossary, url: nav.glossary },
    { label: copy.menu.pricing, url: nav.pricing },
    null,
    { label: copy.menu.about, url: nav.about },
    { label: copy.menu.faq, url: nav.faq },
    { label: copy.menu.linkedin, url: nav.linkedin },
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
  const initialSearchType = React.useMemo(() => {
    const value = new URLSearchParams(window.location.search).get('type');
    // 'shareholder' arrives from a landing pick the company index cannot answer
    // for — an entity registered only as a socio único (a private individual, a
    // foreign parent). The graph plots it and loads what it owns.
    if (value === 'officer' || value === 'shareholder') return value;
    return 'company';
  }, []);
  // Stable group_key from the landing autocomplete, so a deep-linked company
  // binds to ONE legal entity instead of re-running a fuzzy name search on
  // arrival. Absent for /empresa links and hand-typed URLs, which keep the
  // name-search path.
  const initialGroupKey = React.useMemo(() => {
    const value = (new URLSearchParams(window.location.search).get('gk') || '').trim();
    return value || undefined;
  }, []);
  // Set by the graph overlay on /empresa, which frames this app in a dialog.
  // The company page has its own title, breadcrumb and language switch, so the
  // nav bar here would be a second set of the same controls inside a box.
  const isEmbedded = React.useMemo(
    () => new URLSearchParams(window.location.search).get('embed') === '1',
    [],
  );
  const graphEntrySource = React.useMemo(() => {
    const value = new URLSearchParams(window.location.search).get('source') || '';
    return /^[a-z0-9_]{1,40}$/.test(value) ? value : 'direct';
  }, []);
  const graphViewTrackedRef = React.useRef(false);

  React.useEffect(() => {
    if (graphViewTrackedRef.current) return;
    graphViewTrackedRef.current = true;
    trackEvent('graph_view', {
      entry_source: graphEntrySource,
      language,
      has_prefilled_search: Boolean(initialSearch),
    });
  }, [graphEntrySource, initialSearch, language]);

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
        <link rel="canonical" href="https://mapasocietario.es/app/" />
      </Helmet>

      {/* Slim home breadcrumb. Gives a way back to the homepage (the back gesture
          is also wired in the native app) and lowers the search inputs off the
          very top edge. */}
      {!isEmbedded && (
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
              color: 'accent.primary',
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
          {!DATA_MAINTENANCE.enabled && (
            <Typography
              variant="caption"
              sx={{ color: 'success.main', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              {copy.systemsOperational}
            </Typography>
          )}
          <ThemeModeToggle label={copy.themeToggle} />
          <Tooltip title={copy.menu.tooltip}>
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              aria-label={copy.menu.tooltip}
              sx={{ color: 'text.secondary', '&:hover': { color: 'accent.primary' } }}
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
                  {...(item.newTab
                    ? {
                        component: 'a',
                        href: item.url,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        onClick: () => {
                          if (item.downloadPlacement) {
                            trackUserManualDownload(item.downloadPlacement, language);
                          }
                          setMenuAnchor(null);
                        },
                      }
                    : { onClick: () => go(item.url) })}
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
      )}

      <SpanishCompanyNetworkGraph
        visible={true}
        embedded={true}
        initialCompanyName={initialSearch}
        initialSearchType={initialSearchType}
        initialGroupKey={initialGroupKey}
        language={language}
        entrySource={graphEntrySource}
        forceCompactMode={isNativeApp()}
      />
    </Box>
  );
}
