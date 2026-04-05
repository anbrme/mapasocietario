import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Button,
  TextField,
  Checkbox,
  FormControlLabel,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import EmailIcon from '@mui/icons-material/Email';

const PAYMENTS_API = 'https://payments.ncdata.eu';
const DD_PRICE = 2.50;
const FS_PRICE = 9.90;

export default function DDCheckoutDialog({ open, onClose, companyName, country = 'es' }) {
  const [includeFS, setIncludeFS] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalPrice = DD_PRICE + (includeFS ? FS_PRICE : 0);

  const handleCheckout = async () => {
    if (includeFS && !email.trim()) {
      setError('Email is required for financial statements delivery.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const options = includeFS
        ? { financialStatements: true, email: email.trim() }
        : {};
      const res = await fetch(`${PAYMENTS_API}/api/stripe/create-dd-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country,
          companyIdentifier: companyName,
          companyName,
          options,
          returnUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (data.url) {
        localStorage.setItem('dd_return_url', window.location.href);
        if (includeFS) {
          localStorage.setItem('dd_include_fs', 'true');
        }
        window.location.href = data.url;
      } else {
        setError('Could not create checkout session. Please try again.');
      }
    } catch (err) {
      console.error('DD checkout error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#121828',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DescriptionIcon sx={{ color: 'warning.main', fontSize: 22 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Due Diligence Report
          </Typography>
        </Box>
        {companyName && (
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
            {companyName}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Base product */}
        <Box
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 1.5,
            bgcolor: 'rgba(255,167,38,0.06)',
            border: '1px solid rgba(255,167,38,0.15)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DescriptionIcon sx={{ fontSize: 18, color: 'warning.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Due Diligence Report
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.main' }}>
              EUR {DD_PRICE.toFixed(2)}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
            Corporate structure, officer history, sanctions screening, risk analysis
          </Typography>
        </Box>

        {/* Financial statements add-on */}
        <Box
          sx={{
            p: 2,
            borderRadius: 1.5,
            bgcolor: includeFS ? 'rgba(25,118,210,0.06)' : 'rgba(255,255,255,0.02)',
            border: '1px solid',
            borderColor: includeFS ? 'rgba(25,118,210,0.2)' : 'rgba(255,255,255,0.06)',
            transition: 'all 0.2s',
            opacity: 0.55,
            position: 'relative',
          }}
        >
          <Chip
            label="Coming Soon"
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              fontSize: '0.65rem',
              height: 20,
              fontWeight: 700,
              bgcolor: 'rgba(25,118,210,0.15)',
              color: 'primary.light',
            }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={false}
                disabled
                size="small"
                sx={{ '&.Mui-checked': { color: 'primary.main' } }}
              />
            }
            label={
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccountBalanceIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.disabled' }}>
                    Financial Statements (Cuentas Anuales)
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.25, ml: 3 }}>
                  Official PDF from Registro Mercantil + AI-powered financial analysis (OCR + LLM).
                  Delivered within 1-2 business days.
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.25, ml: 3, fontWeight: 600 }}>
                  EUR {FS_PRICE.toFixed(2)}
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', mx: 0, width: '100%' }}
          />
        </Box>

        {/* Email field (shown when FS is selected - disabled for now) */}

        {error && (
          <Alert severity="error" sx={{ mt: 2, fontSize: '0.75rem' }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, flexDirection: 'column', gap: 1 }}>
        <Button
          variant="contained"
          fullWidth
          onClick={handleCheckout}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            py: 1.25,
            borderRadius: 2,
            bgcolor: 'warning.main',
            color: '#000',
            fontSize: '0.9rem',
            '&:hover': { bgcolor: 'warning.dark' },
          }}
        >
          {loading ? 'Redirecting to Stripe...' : `Pay EUR ${totalPrice.toFixed(2)}`}
        </Button>
        <Button
          variant="text"
          fullWidth
          onClick={onClose}
          disabled={loading}
          sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '0.8rem' }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
