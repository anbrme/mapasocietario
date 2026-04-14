import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Chip,
  Link,
  Alert,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { Helmet } from 'react-helmet-async';

const POLL_INTERVAL = 15_000; // 15 seconds
const PAYMENTS_API = 'https://payments.ncdata.eu';
const API_URL = 'https://api.ncdata.eu';
// Flask backend hosting the anonymous alert endpoint. Lives on rag.ncdata.eu
// behind the Nginx /bormes/* location block.
const ALERTS_API = 'https://rag.ncdata.eu/bormes/v3/alerts';

/**
 * Possible order states:
 * - verifying:   initial payment verification
 * - generating:  DD-only order, generating report client-side
 * - processing:  payment confirmed, report(s) being prepared (FS orders)
 * - ready:       all files available for download
 * - error:       something went wrong
 */

export default function OrderStatusPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('verifying'); // verifying | generating | processing | ready | error
  const [errorMsg, setErrorMsg] = useState('');
  const [orderData, setOrderData] = useState(null); // verified payment data
  const [ddReportReady, setDdReportReady] = useState(false);
  const [financialStatementsReady, setFinancialStatementsReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const generatingRef = React.useRef(false);

  // Free-monitoring opt-in state (Day 1b anonymous flow).
  // Mapasocietario.es has no user accounts — anonymous DD buyers land
  // here after paying, and this card offers them free alerts on the
  // company they just bought a report on. Consent event = button click.
  const [monitorState, setMonitorState] = useState('idle'); // idle | loading | success | error
  const [monitorError, setMonitorError] = useState('');
  const [monitorAlert, setMonitorAlert] = useState(null);

  const hasFinancialStatements = orderData?.options?.financialStatements === true;

  // Generate DD report, store in R2, then mark ready
  const generateReport = React.useCallback(async (data) => {
    if (generatingRef.current) return;
    generatingRef.current = true;

    try {
      setStatus('generating');

      let endpoint, body;
      if (data.country === 'es') {
        endpoint = `${API_URL}/bormes/dd-report/company`;
        body = { company_name: data.companyIdentifier, options: data.options || {} };
      } else if (data.country === 'uk') {
        endpoint = `${API_URL}/uk/dd-report/company`;
        body = { company_number: data.companyIdentifier, options: data.options || {} };
      } else if (data.country === 'fr') {
        endpoint = `${API_URL}/fr/dd-report/company`;
        body = { siren: data.companyIdentifier, options: data.options || {} };
      } else {
        throw new Error(`Unsupported country: ${data.country}`);
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

      const blob = await reportRes.blob();

      // Store in R2 for 7-day re-download
      await fetch(`${PAYMENTS_API}/api/stripe/store-dd-report?sessionId=${sessionId}`, {
        method: 'POST',
        body: blob,
      });

      // Track purchase in GA4
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'purchase', {
          currency: 'EUR',
          value: 22.50,
          items: [{ item_name: `DD Report — ${data.country?.toUpperCase()}`, item_category: 'Due Diligence', price: 22.50, quantity: 1 }],
        });
      }

      setDdReportReady(true);
      setStatus('ready');
    } catch (err) {
      console.error('Report generation error:', err);
      setStatus('error');
      setErrorMsg(err.message);
      generatingRef.current = false;
    }
  }, [sessionId]);

  // Verify payment on mount
  useEffect(() => {
    if (!sessionId || !/^cs_(test|live|free)_[A-Za-z0-9_]{10,}$/.test(sessionId)) {
      setStatus('error');
      setErrorMsg('Invalid session ID.');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${PAYMENTS_API}/api/stripe/verify-dd-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Verification failed (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (!data.paid) throw new Error(data.reason || data.error || 'Payment not confirmed');

        setOrderData(data);
        setDdReportReady(!!data.reportReady);

        if (data.reportReady) {
          // Report already in R2, go straight to download
          setStatus('ready');
        } else if (data.options?.financialStatements) {
          // FS order — wait for admin upload
          setStatus('processing');
        } else {
          // DD-only order, report not yet generated — generate it now
          generateReport(data);
        }
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message);
      }
    })();
  }, [sessionId, generateReport]);

  // Poll for readiness when processing (FS orders only)
  useEffect(() => {
    if (status !== 'processing') return;

    const poll = async () => {
      try {
        const res = await fetch(`${PAYMENTS_API}/api/stripe/verify-dd-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.paid) return;

        setOrderData(data);
        const ddReady = !!data.reportReady;
        setDdReportReady(ddReady);

        // For financial statements, check if the supplementary file exists
        if (data.options?.financialStatements) {
          const fsRes = await fetch(
            `${PAYMENTS_API}/api/stripe/get-dd-report?sessionId=${sessionId}&type=financial-statements`,
            { method: 'HEAD' }
          );
          const fsReady = fsRes.ok;
          setFinancialStatementsReady(fsReady);

          if (ddReady && fsReady) setStatus('ready');
        } else {
          if (ddReady) setStatus('ready');
        }
      } catch {
        // Silently retry on next interval
      }
    };

    poll(); // immediate first check
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [status, sessionId]);

  const downloadFile = useCallback(async (type) => {
    const url = type === 'financial-statements'
      ? `${PAYMENTS_API}/api/stripe/get-dd-report?sessionId=${sessionId}&type=financial-statements`
      : `${PAYMENTS_API}/api/stripe/get-dd-report?sessionId=${sessionId}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      const safeName = (orderData?.companyName || orderData?.companyIdentifier || 'report')
        .replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
      const date = new Date().toISOString().slice(0, 10);
      a.href = URL.createObjectURL(blob);
      const langPrefix = (orderData?.options?.language || orderData?.country || 'ES').toUpperCase();
      a.download = type === 'financial-statements'
        ? `Financial_Statements_${safeName}_${date}.pdf`
        : `${langPrefix}_DD_Report_${safeName}_${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Download error:', err);
    }
  }, [sessionId, orderData]);

  const companyLabel = orderData?.companyName || orderData?.companyIdentifier || '';

  const handleStartMonitoring = useCallback(async () => {
    if (!sessionId) return;
    setMonitorState('loading');
    setMonitorError('');
    try {
      const res = await fetch(`${ALERTS_API}/anonymous`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripe_session_id: sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Failed (HTTP ${res.status})`);
      }
      setMonitorAlert(data.alert);
      setMonitorState('success');
    } catch (err) {
      setMonitorError(err?.message || 'Failed to enable monitoring');
      setMonitorState('error');
    }
  }, [sessionId]);

  // Only offer free monitoring for Spanish companies — BORME is the
  // primary signal source and alone justifies the "free trial" hook.
  // Show the card once the report is ready (no point offering it while
  // the report is still generating) or while the order is still
  // processing for financial statements (user sees the option early).
  const showMonitorCard =
    orderData &&
    (orderData.country || '').toLowerCase() === 'es' &&
    (status === 'ready' || status === 'processing');

  return (
    <>
      <Helmet>
        <title>Order Status | Mapa Societario</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: '100vh',
          px: 2,
          py: 6,
          maxWidth: 600,
          mx: 'auto',
          gap: 3,
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center' }}>
          <DescriptionIcon sx={{ fontSize: 44, color: 'warning.main', mb: 1, opacity: 0.8 }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>
            Order Status
          </Typography>
          {companyLabel && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {companyLabel}
            </Typography>
          )}
        </Box>

        {/* Status card */}
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            p: 3,
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 2,
          }}
        >
          {/* Verifying */}
          {status === 'verifying' && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={36} sx={{ mb: 2 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Verifying your payment...
              </Typography>
            </Box>
          )}

          {/* Error */}
          {status === 'error' && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <ErrorOutlineIcon sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'error.main', mb: 2 }}>
                {errorMsg}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Please contact{' '}
                <Link href="mailto:app@ncdata.eu" sx={{ color: 'primary.main' }}>
                  app@ncdata.eu
                </Link>{' '}
                for assistance.
              </Typography>
            </Box>
          )}

          {/* Generating (DD-only, report being created) */}
          {status === 'generating' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <HourglassTopIcon sx={{ color: 'warning.main', fontSize: 28 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Generating your Due Diligence report
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    This may take up to 60 seconds. Please do not close this page.
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <CircularProgress size={32} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Alert severity="info" variant="outlined" sx={{ '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
                  You can save this page link to come back anytime within 7 days to re-download your report.
                </Alert>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', alignSelf: 'flex-start' }}
                >
                  {copied ? 'Copied!' : 'Copy order link'}
                </Button>
              </Box>
            </Box>
          )}

          {/* Processing */}
          {status === 'processing' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <HourglassTopIcon sx={{ color: 'warning.main', fontSize: 28 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Your report is being prepared
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {hasFinancialStatements
                      ? 'We are manually retrieving the financial statements from the Registro Mercantil. This usually takes 30-45 minutes. We will notify you by email when your report is ready.'
                      : 'Your report is being generated. This page will update automatically.'}
                  </Typography>
                </Box>
              </Box>

              {/* Progress items */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 1 }}>
                <StatusItem
                  label="Due Diligence Report"
                  icon={<DescriptionIcon sx={{ fontSize: 18 }} />}
                  ready={ddReportReady}
                  description={hasFinancialStatements
                    ? 'Includes LLM-powered financial analysis'
                    : 'AI-powered corporate analysis'}
                />
                {hasFinancialStatements && (
                  <StatusItem
                    label="Financial Statements (Cuentas Anuales)"
                    icon={<AccountBalanceIcon sx={{ fontSize: 18 }} />}
                    ready={financialStatementsReady}
                    description="Official document from Registro Mercantil"
                  />
                )}
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                <Alert severity="info" variant="outlined" sx={{ '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
                  We will send you an email when your report is ready. You can also save this page link to check back later.
                </Alert>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', alignSelf: 'flex-start' }}
                >
                  {copied ? 'Copied!' : 'Copy order link'}
                </Button>
              </Box>
            </Box>
          )}

          {/* Ready */}
          {status === 'ready' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CheckCircleIcon sx={{ color: 'success.main', fontSize: 28 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Your report is ready!
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Download links are available for 7 days.
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={() => downloadFile('dd-report')}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    py: 1.25,
                    borderRadius: 2,
                    bgcolor: 'warning.main',
                    color: '#000',
                    '&:hover': { bgcolor: 'warning.dark' },
                  }}
                >
                  Download Due Diligence Report
                </Button>

                {hasFinancialStatements && (
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => downloadFile('financial-statements')}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      py: 1.25,
                      borderRadius: 2,
                      borderColor: 'rgba(255,167,38,0.5)',
                      color: 'warning.light',
                      '&:hover': {
                        borderColor: '#f57c00',
                        bgcolor: 'rgba(255,167,38,0.08)',
                      },
                    }}
                  >
                    Download Financial Statements (PDF)
                  </Button>
                )}

                <Button
                  variant="text"
                  href="/app"
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    color: 'text.secondary',
                    mt: 0.5,
                    '&:hover': { color: 'text.primary' },
                  }}
                >
                  Search another company
                </Button>
              </Box>
            </Box>
          )}
        </Paper>

        {/* Free monitoring opt-in card (Day 1b anonymous flow).
            Offered to Spanish DD buyers after the report is ready or
            while the FS order is still processing. Opt-in means the
            button click — we use the customer email from the verified
            Stripe session, not a form field, so there's nothing for the
            user to type. */}
        {showMonitorCard && (
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              p: 3,
              border: '1px solid',
              borderColor:
                monitorState === 'success'
                  ? 'rgba(46,125,50,0.4)'
                  : 'rgba(255,167,38,0.3)',
              borderRadius: 2,
              bgcolor:
                monitorState === 'success'
                  ? 'rgba(46,125,50,0.08)'
                  : 'rgba(255,167,38,0.04)',
            }}
          >
            {monitorState === 'success' ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CheckCircleIcon sx={{ color: 'success.main', fontSize: 28 }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Monitoring activated
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      We'll email you when there's new BORME corporate
                      activity or a global regulator warning (IOSCO) for{' '}
                      <strong>{monitorAlert?.entity_name || companyLabel}</strong>.
                    </Typography>
                  </Box>
                </Box>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', mt: 0.5 }}
                >
                  One-click unsubscribe in every email. Free for as long
                  as you stay subscribed.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <NotificationsActiveIcon
                    sx={{ color: 'warning.main', fontSize: 28 }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Monitor {companyLabel} for free
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Get email alerts when BORME publishes corporate
                      events (officer changes, capital moves, insolvency,
                      dissolution, name changes) or when a global
                      regulator flags the company via IOSCO.
                    </Typography>
                  </Box>
                </Box>

                {monitorState === 'error' && (
                  <Alert
                    severity="error"
                    onClose={() => setMonitorState('idle')}
                  >
                    {monitorError}
                  </Alert>
                )}

                <Button
                  variant="contained"
                  onClick={handleStartMonitoring}
                  disabled={monitorState === 'loading'}
                  startIcon={
                    monitorState === 'loading' ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <NotificationsActiveIcon />
                    )
                  }
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    py: 1.25,
                    borderRadius: 2,
                    bgcolor: 'warning.main',
                    color: '#000',
                    '&:hover': { bgcolor: 'warning.dark' },
                  }}
                >
                  {monitorState === 'loading'
                    ? 'Enabling…'
                    : 'Start free monitoring'}
                </Button>

                <Typography
                  variant="caption"
                  sx={{ color: 'text.disabled', textAlign: 'center' }}
                >
                  Sent to the email you used at checkout. One-click
                  unsubscribe in every message.
                </Typography>
              </Box>
            )}
          </Paper>
        )}

        {/* Order reference */}
        {sessionId && (
          <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center' }}>
            Order reference: {sessionId.slice(-12)}
          </Typography>
        )}

        {/* Footer nav */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', mt: 2 }}>
          <Link
            href="/"
            variant="caption"
            sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            Home
          </Link>
          <Link
            href="/app"
            variant="caption"
            sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            Search companies
          </Link>
          <Link
            href="mailto:app@ncdata.eu"
            variant="caption"
            sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            Contact support
          </Link>
        </Box>
      </Box>
    </>
  );
}

function StatusItem({ label, icon, ready, description }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: ready ? 'rgba(46,125,50,0.08)' : 'rgba(255,255,255,0.02)',
        border: '1px solid',
        borderColor: ready ? 'rgba(46,125,50,0.2)' : 'rgba(255,255,255,0.06)',
      }}
    >
      <Box sx={{ color: ready ? 'success.main' : 'text.disabled' }}>{icon}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
          {description}
        </Typography>
      </Box>
      {ready ? (
        <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
      ) : (
        <CircularProgress size={16} sx={{ color: 'text.disabled' }} />
      )}
    </Box>
  );
}
