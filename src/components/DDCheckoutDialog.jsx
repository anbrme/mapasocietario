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
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import EmailIcon from '@mui/icons-material/Email';
import TranslateIcon from '@mui/icons-material/Translate';

const PAYMENTS_API = 'https://payments.ncdata.eu';
const DD_PRICE = 22.50;
const FS_PRICE = 17.50;
const VAT_RATE = 0.21;

export default function DDCheckoutDialog({ open, onClose, companyName, country = 'es' }) {
  const [includeFS, setIncludeFS] = useState(false);
  const [email, setEmail] = useState('');
  const [lang, setLang] = useState('es');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const subtotal = DD_PRICE + (includeFS ? FS_PRICE : 0);
  const vatAmount = subtotal * VAT_RATE;
  const totalPrice = subtotal + vatAmount;

  const handleCheckout = async () => {
    if (!email.trim()) {
      setError('Email is required to receive your report.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const options = {
        language: lang,
        ...(includeFS ? { financialStatements: true, email: email.trim() } : {}),
      };
      const res = await fetch(`${PAYMENTS_API}/api/stripe/create-dd-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country,
          companyIdentifier: companyName,
          companyName,
          options,
          email: email.trim() || undefined,
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
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#121828',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
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
          </Box>
          {/* Language selector — anchored to the header so it's always visible */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <TranslateIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              <Typography
                variant="caption"
                sx={{
                  color: 'text.disabled',
                  fontSize: '0.62rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                }}
              >
                Report language
              </Typography>
            </Box>
            <ToggleButtonGroup
              value={lang}
              exclusive
              onChange={(_, v) => v && setLang(v)}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  py: 0.4,
                  px: 1.5,
                  fontSize: '0.78rem',
                  textTransform: 'none',
                  fontWeight: 600,
                  borderColor: 'rgba(255,255,255,0.15)',
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    bgcolor: 'warning.main',
                    color: '#000',
                    '&:hover': { bgcolor: 'warning.dark' },
                  },
                },
              }}
            >
              <ToggleButton value="es">Español</ToggleButton>
              <ToggleButton value="en">English</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
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
          }}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={includeFS}
                onChange={(e) => setIncludeFS(e.target.checked)}
                size="small"
                sx={{ '&.Mui-checked': { color: 'primary.main' } }}
              />
            }
            label={
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccountBalanceIcon sx={{ fontSize: 16, color: includeFS ? 'primary.main' : 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: includeFS ? 'text.primary' : 'text.secondary' }}>
                    Financial Statements (Cuentas Anuales)
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25, ml: 3 }}>
                  Official PDF from Registro Mercantil + AI-powered financial analysis (OCR + LLM).
                  Delivered within 1-2 business days.
                </Typography>
                <Typography variant="caption" sx={{ color: includeFS ? 'primary.light' : 'text.secondary', display: 'block', mt: 0.25, ml: 3, fontWeight: 600 }}>
                  + EUR {FS_PRICE.toFixed(2)}
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', mx: 0, width: '100%' }}
          />
        </Box>

        {/* Email field */}
        <TextField
          fullWidth
          size="small"
          label="Email (required)"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          InputProps={{
            startAdornment: <EmailIcon sx={{ fontSize: 16, color: 'text.disabled', mr: 1 }} />,
          }}
          sx={{
            mt: 2,
            '& .MuiOutlinedInput-root': {
              fontSize: '0.85rem',
              bgcolor: 'rgba(255,255,255,0.03)',
            },
          }}
        />
        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, px: 0.5, color: 'text.disabled', fontSize: '0.7rem', lineHeight: 1.45 }}>
          Used only to deliver your report and (if you opt in) BORME monitoring alerts. Never resold.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2, fontSize: '0.75rem' }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, flexDirection: 'column', gap: 1 }}>
        {/* Price breakdown */}
        <Box sx={{ width: '100%', mb: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Subtotal</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>EUR {subtotal.toFixed(2)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>IVA (21%)</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>EUR {vatAmount.toFixed(2)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, mt: 0.5, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Total</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.main' }}>EUR {totalPrice.toFixed(2)}</Typography>
          </Box>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 1,
              px: 1,
              color: 'text.disabled',
              fontSize: '0.68rem',
              lineHeight: 1.45,
            }}
          >
            Invoiced by <strong>Nurnberg Consulting SL</strong> &middot; NIF B86829538 &middot; Madrid, Spain.
            Payments securely processed by Stripe. By continuing you accept our{' '}
            <a href="/terms.html" target="_blank" rel="noopener" style={{ color: 'inherit', textDecoration: 'underline' }}>terms</a>{' '}
            and{' '}
            <a href="/privacy.html" target="_blank" rel="noopener" style={{ color: 'inherit', textDecoration: 'underline' }}>privacy policy</a>.
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 0.75,
              px: 1,
              color: 'text.secondary',
              fontSize: '0.72rem',
              lineHeight: 1.5,
            }}
          >
            Questions before paying? Email{' '}
            <a href="mailto:app@ncdata.eu" style={{ color: '#8bc5ff', textDecoration: 'none' }}>app@ncdata.eu</a>
            {' '}— we usually reply within a few hours on business days.
          </Typography>
        </Box>
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
