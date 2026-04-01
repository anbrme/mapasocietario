import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TermsProvider } from './contexts/TermsProvider';
import App from './App';
import Dashboard from './components/Dashboard';
import { FilterProvider } from './contexts/FilterProvider';
import './index.css';

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
if (params.get('dd_payment_success') === 'true' && params.get('session_id')) {
  const sessionId = params.get('session_id');
  // Clean URL immediately
  window.history.replaceState({}, '', window.location.pathname);

  // Validate session ID format
  if (/^cs_(test|live)_[A-Za-z0-9]{10,}$/.test(sessionId)) {
    // Show a simple status indicator while processing
    const statusEl = document.createElement('div');
    statusEl.id = 'dd-payment-status';
    statusEl.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:16px;text-align:center;font-family:sans-serif;font-size:14px;background:#1976d2;color:#fff;';
    statusEl.textContent = 'Verifying payment…';
    document.body.appendChild(statusEl);

    (async () => {
      try {
        // Step 1: Verify payment
        const verifyRes = await fetch('https://payments.ncdata.eu/api/stripe/verify-dd-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        if (!verifyRes.ok) throw new Error(`Payment verification failed (HTTP ${verifyRes.status})`);
        const verifyData = await verifyRes.json();
        if (!verifyData.paid) throw new Error(verifyData.reason || verifyData.error || 'Payment not confirmed');

        // Step 2: Generate report
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

        // Step 3: Download PDF
        const blob = await reportRes.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = (verifyData.companyName || verifyData.companyIdentifier)
          .replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
        a.download = `${verifyData.country.toUpperCase()}_DD_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        statusEl.style.background = '#2e7d32';
        statusEl.textContent = 'Your Due Diligence report has been downloaded!';
        setTimeout(() => statusEl.remove(), 8000);
      } catch (err) {
        console.error('DD payment/generation error:', err);
        statusEl.style.background = '#d32f2f';
        statusEl.textContent = `Error: ${err.message}. Please contact app@ncdata.eu with your session ID.`;
      }
    })();
  }
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
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <BrowserRouter>
        <TermsProvider>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/dashboard" element={<FilterProvider><Dashboard /></FilterProvider>} />
          </Routes>
        </TermsProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
