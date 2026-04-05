import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Collapse,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DescriptionIcon from '@mui/icons-material/Description';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import { Helmet } from 'react-helmet-async';

const PAYMENTS_API = 'https://payments.ncdata.eu';

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('key') || localStorage.getItem('admin_key') || '';
  });
  const [authenticated, setAuthenticated] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingSession, setUploadingSession] = useState(null);
  const [uploadProgress, setUploadProgress] = useState('');
  const [expandedAnalysis, setExpandedAnalysis] = useState(null);
  const [analysisCache, setAnalysisCache] = useState({});
  const fileInputRef = useRef(null);

  const fetchOrders = useCallback(async (key) => {
    const authKey = key || adminKey;
    if (!authKey) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${PAYMENTS_API}/api/stripe/list-fs-orders`, {
        headers: { 'Authorization': `Bearer ${authKey}` },
      });
      if (res.status === 401) {
        setAuthenticated(false);
        setError('Invalid admin key.');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrders(data.orders || []);
      setAuthenticated(true);
      localStorage.setItem('admin_key', authKey);
    } catch (err) {
      setError(`Failed to load orders: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (adminKey) fetchOrders(adminKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  const handleUpload = async (sessionId, file) => {
    if (!file) return;
    setUploadingSession(sessionId);
    setUploadProgress('Uploading PDF...');
    setError('');

    try {
      const res = await fetch(
        `${PAYMENTS_API}/api/stripe/upload-financial-statements?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${adminKey}` },
          body: file,
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Upload failed (HTTP ${res.status})`);
      }

      const data = await res.json();
      setUploadProgress(
        data.analysisGenerated
          ? 'Upload complete! OCR + LLM analysis generated.'
          : 'Upload complete. LLM analysis may have failed — check logs.'
      );

      // Refresh the orders list
      setTimeout(() => {
        fetchOrders();
        setUploadingSession(null);
        setUploadProgress('');
      }, 3000);
    } catch (err) {
      setError(`Upload error: ${err.message}`);
      setUploadingSession(null);
      setUploadProgress('');
    }
  };

  const handleFileSelect = (sessionId) => {
    setUploadingSession(sessionId);
    fileInputRef.current?.click();
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && uploadingSession) {
      handleUpload(uploadingSession, file);
    }
    e.target.value = '';
  };

  const fetchAnalysis = async (sessionId) => {
    if (analysisCache[sessionId]) {
      setExpandedAnalysis(expandedAnalysis === sessionId ? null : sessionId);
      return;
    }

    try {
      const res = await fetch(
        `${PAYMENTS_API}/api/stripe/get-fs-analysis?sessionId=${encodeURIComponent(sessionId)}`,
        { headers: { 'Authorization': `Bearer ${adminKey}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAnalysisCache((prev) => ({ ...prev, [sessionId]: data.analysisText || 'No analysis available.' }));
      setExpandedAnalysis(sessionId);
    } catch (err) {
      setError(`Failed to load analysis: ${err.message}`);
    }
  };

  // Login screen
  if (!authenticated) {
    return (
      <>
        <Helmet>
          <title>Admin | Mapa Societario</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', px: 2 }}>
          <Paper
            component="form"
            onSubmit={handleLogin}
            sx={{
              p: 4,
              maxWidth: 400,
              width: '100%',
              bgcolor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center' }}>
              Admin Access
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="password"
              label="Admin Key"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              autoFocus
            />
            {error && <Alert severity="error" sx={{ fontSize: '0.75rem' }}>{error}</Alert>}
            <Button
              type="submit"
              variant="contained"
              disabled={!adminKey || loading}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {loading ? <CircularProgress size={20} /> : 'Sign In'}
            </Button>
          </Paper>
        </Box>
      </>
    );
  }

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const completedOrders = orders.filter((o) => o.status === 'completed');

  return (
    <>
      <Helmet>
        <title>Admin | Mapa Societario</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Box sx={{ maxWidth: 900, mx: 'auto', px: 2, py: 4 }}>
        {/* Hidden file input */}
        <input
          type="file"
          accept="application/pdf"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={onFileChange}
        />

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Financial Statements Admin
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Upload cuentas anuales for pending orders
            </Typography>
          </Box>
          <IconButton onClick={() => fetchOrders()} disabled={loading} title="Refresh">
            <RefreshIcon />
          </IconButton>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>}
        {uploadProgress && (
          <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
            {uploadProgress}
          </Alert>
        )}

        {loading && orders.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {/* Pending Orders */}
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <HourglassTopIcon sx={{ fontSize: 20, color: 'warning.main' }} />
          Pending Orders ({pendingOrders.length})
        </Typography>

        {pendingOrders.length === 0 && !loading && (
          <Paper sx={{ p: 3, mb: 4, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No pending financial statement orders.
            </Typography>
          </Paper>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 4 }}>
          {pendingOrders.map((order) => (
            <OrderCard
              key={order.sessionId}
              order={order}
              onUpload={handleFileSelect}
              uploading={uploadingSession === order.sessionId}
            />
          ))}
        </Box>

        {/* Completed Orders */}
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
          Completed Orders ({completedOrders.length})
        </Typography>

        {completedOrders.length === 0 && !loading && (
          <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No completed orders yet.
            </Typography>
          </Paper>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {completedOrders.map((order) => (
            <CompletedOrderCard
              key={order.sessionId}
              order={order}
              expanded={expandedAnalysis === order.sessionId}
              analysis={analysisCache[order.sessionId]}
              onToggleAnalysis={() => fetchAnalysis(order.sessionId)}
            />
          ))}
        </Box>
      </Box>
    </>
  );
}

function buildMailtoLink(order) {
  const companyName = order.companyName || order.companyIdentifier || 'your company';
  const orderUrl = `https://mapasocietario.es/order/${order.sessionId}`;
  const subject = `Your Due Diligence Report is ready — ${companyName}`;
  const body = `Hello,

Your Due Diligence report for ${companyName} is ready for download, including the financial statements analysis.

You can download your reports here:
${orderUrl}

Download links are available for 7 days. Please save a copy for your records.

If you have any questions, reply to this email.

Best regards,
Mapa Societario
mapasocietario.es`;

  const to = order.customerEmail || '';
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function OrderCard({ order, onUpload, uploading }) {
  const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : '—';

  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'rgba(255,167,38,0.04)',
        border: '1px solid rgba(255,167,38,0.15)',
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <DescriptionIcon sx={{ color: 'warning.main', fontSize: 28 }} />
      <Box sx={{ flex: 1, minWidth: 200 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {order.companyName || order.companyIdentifier}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          {order.country?.toUpperCase()} &middot; {date}
          {order.customerEmail && ` · ${order.customerEmail}`}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', fontSize: '0.65rem' }}>
          {order.sessionId}
        </Typography>
      </Box>
      <Button
        variant="contained"
        size="small"
        startIcon={uploading ? <CircularProgress size={14} /> : <UploadFileIcon />}
        disabled={uploading}
        onClick={() => onUpload(order.sessionId)}
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          bgcolor: 'warning.main',
          color: '#000',
          '&:hover': { bgcolor: 'warning.dark' },
        }}
      >
        {uploading ? 'Processing...' : 'Upload PDF'}
      </Button>
    </Paper>
  );
}

function CompletedOrderCard({ order, expanded, analysis, onToggleAnalysis }) {
  const date = order.completedAt ? new Date(order.completedAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : '—';

  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'rgba(46,125,50,0.04)',
        border: '1px solid rgba(46,125,50,0.15)',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 24 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {order.companyName || order.companyIdentifier}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            {order.country?.toUpperCase()} &middot; Completed {date}
            {order.customerEmail && ` · ${order.customerEmail}`}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', fontSize: '0.65rem' }}>
            {order.sessionId}
          </Typography>
        </Box>
        {order.hasAnalysis && (
          <Button
            size="small"
            onClick={onToggleAnalysis}
            endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            {expanded ? 'Hide' : 'View'} Analysis
          </Button>
        )}
        <Button
          size="small"
          startIcon={<EmailOutlinedIcon sx={{ fontSize: 14 }} />}
          href={buildMailtoLink(order)}
          component="a"
          sx={{ textTransform: 'none', fontSize: '0.75rem' }}
        >
          Notify
        </Button>
        <Chip
          label={order.hasAnalysis ? 'Analysis OK' : 'No Analysis'}
          size="small"
          color={order.hasAnalysis ? 'success' : 'default'}
          sx={{ fontSize: '0.65rem', height: 22 }}
        />
      </Box>

      <Collapse in={expanded}>
        {analysis && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              bgcolor: 'rgba(0,0,0,0.2)',
              borderRadius: 1.5,
              maxHeight: 500,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              color: 'text.secondary',
            }}
          >
            {analysis}
          </Box>
        )}
      </Collapse>
    </Paper>
  );
}
