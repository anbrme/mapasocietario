import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TermsProvider } from './contexts/TermsProvider';
import App from './App';
import Dashboard from './components/Dashboard';
import { FilterProvider } from './contexts/FilterProvider';
import './index.css';

// If user cancelled a DD payment, redirect back to the page they came from
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
