import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { TermsProvider } from './contexts/TermsProvider';
import App from './App';
import Dashboard from './components/Dashboard';
const DueDiligencePage = lazy(() => import('./components/DueDiligencePage'));
import { FilterProvider } from './contexts/FilterProvider';
import usePageTracking from './hooks/usePageTracking';
import './index.css';

function AppRoutes() {
  usePageTracking();
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/due-diligence" element={<Suspense fallback={null}><DueDiligencePage /></Suspense>} />
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

// Handle DD payment success — verify payment and download the report
// Also handles retry from localStorage if user navigated away during generation
const ddSessionId = params.get('dd_payment_success') === 'true' && params.get('session_id')
  ? params.get('session_id')
  : localStorage.getItem('dd_pending_session');

if (ddSessionId && /^cs_(test|live)_[A-Za-z0-9]{10,}$/.test(ddSessionId)) {
  // Clean URL and persist session for retry
  if (params.get('dd_payment_success')) {
    window.history.replaceState({}, '', window.location.pathname);
  }
  localStorage.setItem('dd_pending_session', ddSessionId);

  const statusEl = document.createElement('div');
  statusEl.id = 'dd-payment-status';
  statusEl.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:16px;text-align:center;font-family:sans-serif;font-size:14px;background:#1976d2;color:#fff;';
  statusEl.textContent = 'Verifying payment…';
  document.body.appendChild(statusEl);

  const downloadBlob = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  (async () => {
    try {
      // Step 1: Verify payment (also checks if report already exists in R2)
      const verifyRes = await fetch('https://payments.ncdata.eu/api/stripe/verify-dd-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: ddSessionId }),
      });
      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        throw new Error(errData.error || `Payment verification failed (HTTP ${verifyRes.status})`);
      }
      const verifyData = await verifyRes.json();
      if (!verifyData.paid) throw new Error(verifyData.reason || verifyData.error || 'Payment not confirmed');

      // Step 2: If report already stored in R2, download directly
      if (verifyData.reportReady) {
        statusEl.textContent = 'Downloading your report…';
        const dlRes = await fetch(`https://payments.ncdata.eu/api/stripe/get-dd-report?sessionId=${ddSessionId}`);
        if (dlRes.ok) {
          const blob = await dlRes.blob();
          downloadBlob(blob, `DD_Report_${ddSessionId.slice(-8)}_${new Date().toISOString().slice(0, 10)}.pdf`);
          localStorage.removeItem('dd_pending_session');
          statusEl.style.background = '#2e7d32';
          statusEl.textContent = 'Your Due Diligence report has been downloaded!';
          setTimeout(() => statusEl.remove(), 8000);
          return;
        }
        // If download fails, fall through to regenerate
      }

      // Step 3: Generate report
      statusEl.textContent = 'Payment confirmed! Generating your Due Diligence report… This may take up to 60 seconds.';
      const apiUrl = 'https://api.ncdata.eu';
      let endpoint, body;
      if (verifyData.country === 'es') {
        endpoint = `${apiUrl}/bormes/dd-report/company`;
        body = { company_name: verifyData.companyIdentifier, options: verifyData.options || {} };
      } else if (verifyData.country === 'uk') {
        endpoint = `${apiUrl}/uk/dd-report/company`;
        body = { company_number: verifyData.companyIdentifier, options: verifyData.options || {} };
      } else if (verifyData.country === 'fr') {
        endpoint = `${apiUrl}/fr/dd-report/company`;
        body = { siren: verifyData.companyIdentifier, options: verifyData.options || {} };
      } else {
        throw new Error(`Unsupported country: ${verifyData.country}`);
      }

      const reportRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!reportRes.ok) {
        const errData = await reportRes.json().catch(() => ({}));
        throw new Error(errData.error || `Report generation failed (HTTP ${reportRes.status})`);
      }

      const contentType = reportRes.headers.get('content-type') || '';
      if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
        const errData = await reportRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Server returned an unexpected response instead of a PDF');
      }

      // Step 4: Download + store in R2 for re-download
      const blob = await reportRes.blob();
      const safeName = (verifyData.companyName || verifyData.companyIdentifier)
        .replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
      const fileName = `${verifyData.country.toUpperCase()}_DD_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadBlob(blob, fileName);

      // Store in R2 for 24h re-download (fire-and-forget, don't block the user)
      fetch(`https://payments.ncdata.eu/api/stripe/store-dd-report?sessionId=${ddSessionId}`, {
        method: 'POST',
        body: blob,
      }).catch(err => console.warn('Failed to store report in R2 for re-download:', err));

      // Track purchase in GA4
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'purchase', {
          currency: 'EUR',
          value: 2.50,
          items: [{ item_name: `DD Report — ${verifyData.country?.toUpperCase()}`, item_category: 'Due Diligence', price: 2.50, quantity: 1 }],
        });
      }

      localStorage.removeItem('dd_pending_session');
      statusEl.style.background = '#2e7d32';
      statusEl.textContent = 'Your Due Diligence report has been downloaded!';
      setTimeout(() => statusEl.remove(), 8000);
    } catch (err) {
      console.error('DD payment/generation error:', err);
      statusEl.style.background = '#d32f2f';
      statusEl.textContent = `Error: ${err.message}. Please contact app@ncdata.eu for assistance.`;
      // Don't remove dd_pending_session on error — user can retry by refreshing
    }
  })();
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
