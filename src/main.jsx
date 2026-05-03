import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { TermsProvider } from './contexts/TermsProvider';
import App from './App';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
const DueDiligencePage = lazy(() => import('./components/DueDiligencePage'));
const SpanishCompanyDueDiligencePage = lazy(() => import('./components/SpanishCompanyDueDiligencePage'));
const SpanishSeoPage = lazy(() => import('./components/SpanishSeoPage'));
const OrderStatusPage = lazy(() => import('./components/OrderStatusPage'));
const AdminPage = lazy(() => import('./components/AdminPage'));
import { FilterProvider } from './contexts/FilterProvider';
import usePageTracking from './hooks/usePageTracking';
import './index.css';

function AppRoutes() {
  usePageTracking();
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/es" element={<Suspense fallback={null}><SpanishSeoPage pageKey="home" /></Suspense>} />
      <Route path="/es/:slug" element={<Suspense fallback={null}><SpanishSeoPage /></Suspense>} />
      <Route path="/app" element={<App />} />
      <Route path="/due-diligence" element={<Suspense fallback={null}><DueDiligencePage /></Suspense>} />
      <Route path="/spanish-company-due-diligence" element={<Suspense fallback={null}><SpanishCompanyDueDiligencePage /></Suspense>} />
      <Route path="/order/:sessionId" element={<Suspense fallback={null}><OrderStatusPage /></Suspense>} />
      <Route path="/admin" element={<Suspense fallback={null}><AdminPage /></Suspense>} />
      <Route path="/dashboard" element={<FilterProvider><Dashboard /></FilterProvider>} />
    </Routes>
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
  window.location.replace(`/order/${ddSessionId}`);
}

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
