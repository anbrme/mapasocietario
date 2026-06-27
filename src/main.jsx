import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline, Box, Button } from '@mui/material';
import { BrowserRouter, Routes, Route, Link as RouterLink } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { TermsProvider } from './contexts/TermsProvider';
import App from './App';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
const DueDiligencePage = lazy(() => import('./components/DueDiligencePage'));
const SpanishCompanyDueDiligencePage = lazy(() => import('./components/SpanishCompanyDueDiligencePage'));
const PricingPage = lazy(() => import('./components/PricingPage'));
const SpanishSeoPage = lazy(() => import('./components/SpanishSeoPage'));
const ConnectClaudePage = lazy(() => import('./components/ConnectClaudePage'));
const OrderStatusPage = lazy(() => import('./components/OrderStatusPage'));
const AdminPage = lazy(() => import('./components/AdminPage'));
import { FilterProvider } from './contexts/FilterProvider';
import usePageTracking from './hooks/usePageTracking';
import useAndroidBackButton from './hooks/useAndroidBackButton';
import { isNativeApp } from './services/listedCompaniesNav';
import './index.css';

// Shown after a FREE DD report is fulfilled: the user stays on the company
// graph (see the dd_free_report_ready handling in main) and this banner links
// to the report instead of yanking them to the order page.
function FreeReportBanner() {
  const [sessionId, setSessionId] = React.useState(() => {
    try { return sessionStorage.getItem('dd_free_report_ready'); } catch { return null; }
  });
  if (!sessionId) return null;

  const isEs = /[?&]lang=es\b/.test(window.location.search) || window.location.pathname.startsWith('/es');
  const clear = () => {
    try { sessionStorage.removeItem('dd_free_report_ready'); } catch { /* ignore */ }
    setSessionId(null);
  };

  return (
    <Box
      sx={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1400,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 1.5, flexWrap: 'wrap', px: 2, py: 1,
        bgcolor: 'success.dark', color: '#fff',
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)', fontSize: '0.9rem',
      }}
    >
      <span>{isEs ? '✓ Tu informe gratuito está listo.' : '✓ Your free report is ready.'}</span>
      <Button
        component={RouterLink}
        to={`/order/${sessionId}`}
        onClick={clear}
        size="small"
        variant="contained"
        sx={{ textTransform: 'none', fontWeight: 700, color: 'success.dark', bgcolor: '#fff', '&:hover': { bgcolor: '#eee' } }}
      >
        {isEs ? 'Ver informe' : 'View report'}
      </Button>
      <Button onClick={clear} size="small" aria-label={isEs ? 'Cerrar' : 'Dismiss'} sx={{ minWidth: 0, px: 1, color: '#fff', opacity: 0.85 }}>✕</Button>
    </Box>
  );
}

function AppRoutes() {
  usePageTracking();
  useAndroidBackButton();
  return (
    <>
      <FreeReportBanner />
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/es" element={<LandingPage lang="es" />} />
      <Route path="/connect-claude" element={<Suspense fallback={null}><ConnectClaudePage lang="en" /></Suspense>} />
      <Route path="/es/conectar-claude" element={<Suspense fallback={null}><ConnectClaudePage lang="es" /></Suspense>} />
      <Route path="/es/:slug" element={<Suspense fallback={null}><SpanishSeoPage /></Suspense>} />
      <Route path="/app" element={<App />} />
      <Route path="/due-diligence" element={<Suspense fallback={null}><DueDiligencePage /></Suspense>} />
      <Route path="/spanish-company-due-diligence" element={<Suspense fallback={null}><SpanishCompanyDueDiligencePage /></Suspense>} />
      <Route path="/pricing" element={<Suspense fallback={null}><PricingPage /></Suspense>} />
      <Route path="/order/:sessionId" element={<Suspense fallback={null}><OrderStatusPage /></Suspense>} />
      <Route path="/admin" element={<Suspense fallback={null}><AdminPage /></Suspense>} />
      <Route path="/dashboard" element={<FilterProvider><Dashboard /></FilterProvider>} />
      </Routes>
    </>
  );
}

// Handle DD payment return
const params = new URLSearchParams(window.location.search);
if (params.get('dd_payment_cancelled') === 'true') {
  const returnUrl = localStorage.getItem('dd_return_url');
  localStorage.removeItem('dd_return_url');
  if (returnUrl) {
    window.location.replace(returnUrl);
  } else {
    window.location.replace('/');
  }
}

// Handle DD payment success — redirect to persistent order page
const ddSessionId = params.get('dd_payment_success') === 'true' && params.get('session_id')
  ? params.get('session_id')
  : localStorage.getItem('dd_pending_session');

if (ddSessionId && /^cs_(test|live|free)_[A-Za-z0-9_]{10,}$/.test(ddSessionId)) {
  localStorage.removeItem('dd_pending_session');
  localStorage.removeItem('dd_include_fs');
  if (ddSessionId.startsWith('cs_free_')) {
    // Free reports keep the user on the company graph: stash the session so a
    // banner can surface the report, and strip the dd_* params so a refresh
    // won't re-fire. (Paid orders still go to the persistent /order page.)
    try { sessionStorage.setItem('dd_free_report_ready', ddSessionId); } catch { /* ignore */ }
    const cleaned = new URL(window.location.href);
    cleaned.searchParams.delete('dd_payment_success');
    cleaned.searchParams.delete('session_id');
    window.history.replaceState(null, '', cleaned.pathname + cleaned.search + cleaned.hash);
  } else {
    window.location.replace(`/order/${ddSessionId}`);
  }
}

// Native app launches land on the search screen, not the marketing landing
// page. Rewrite (not redirect) only at launch so in-app navigation to "/"
// (graph breadcrumb) still reaches the landing page with the other options.
if (isNativeApp() && window.location.pathname === '/') {
  window.history.replaceState(null, '', '/app');
}

// A lazily-imported route chunk (DueDiligence, Pricing, OrderStatus, …) can
// 404 when a new deploy replaces the content-hashed filenames while this tab is
// still open. With Suspense fallback={null} and no error boundary, that renders
// a blank page until the user manually refreshes (which also picks up the
// trailing-slash directory redirect, so it "works on refresh"). Vite fires
// `vite:preloadError` in exactly this case — reload once to fetch the new asset
// manifest. The timestamp guard stops a genuinely-missing chunk from looping:
// if the reload still fails within 10s we stop trying.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'spa-chunk-reloaded-at';
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last < 10000) return;
  sessionStorage.setItem(KEY, String(Date.now()));
  window.location.reload();
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#1976d2' },
    background: {
      default: '#0a0e1a',
      paper: '#121828',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <BrowserRouter>
          <TermsProvider>
            <AppRoutes />
          </TermsProvider>
        </BrowserRouter>
      </ThemeProvider>
    </HelmetProvider>
  </React.StrictMode>
);
