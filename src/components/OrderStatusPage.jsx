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
import { Helmet } from 'react-helmet-async';

const POLL_INTERVAL = 15_000; // 15 seconds
const PAYMENTS_API = 'https://payments.ncdata.eu';

/**
 * Possible order states:
 * - verifying:   initial payment verification
 * - processing:  payment confirmed, report(s) being prepared
 * - ready:       all files available for download
 * - error:       something went wrong
 */

export default function OrderStatusPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('verifying'); // verifying | processing | ready | error
  const [errorMsg, setErrorMsg] = useState('');
  const [orderData, setOrderData] = useState(null); // verified payment data
  const [ddReportReady, setDdReportReady] = useState(false);
  const [financialStatementsReady, setFinancialStatementsReady] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasFinancialStatements = orderData?.options?.financialStatements === true;

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

        // If no financial statements requested and report is ready, go straight to ready
        if (!data.options?.financialStatements && data.reportReady) {
          setStatus('ready');
        } else {
          setStatus('processing');
        }
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message);
      }
    })();
  }, [sessionId]);

  // Poll for readiness when processing
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
      a.download = type === 'financial-statements'
        ? `Financial_Statements_${safeName}_${date}.pdf`
        : `${(orderData?.country || 'ES').toUpperCase()}_DD_Report_${safeName}_${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Download error:', err);
    }
  }, [sessionId, orderData]);

  const companyLabel = orderData?.companyName || orderData?.companyIdentifier || '';

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
                      ? 'We are manually retrieving the financial statements from the Registro Mercantil. This usually takes 1-2 business days. We will notify you by email when your report is ready.'
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
              </Box>
            </Box>
          )}
        </Paper>

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
