import React, { useEffect, useState } from 'react';
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
  Radio,
  RadioGroup,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import EmailIcon from '@mui/icons-material/Email';
import TranslateIcon from '@mui/icons-material/Translate';
import {
  ANDROID_DD_PRODUCT_IDS,
  isAndroidNativeApp,
  purchaseAndroidReport,
  queryAndroidBillingProducts,
} from '../services/playBillingService';

const PAYMENTS_API = 'https://payments.ncdata.eu';
const API_URL = 'https://api.ncdata.eu';
const DD_PRICE = 22.50;
const FS_PRICE = 17.50;
// Product Hunt launch promo. Set to null after the launch to hide the banner.
const LAUNCH_PROMO_CODE = 'PRODUCTHUNT50';
const ANDROID_PLAY_BILLING_ENABLED = true;
const FS_FALLBACK_KEEP_DD = 'keep_dd_refund_fs';
const FS_FALLBACK_FULL_REFUND = 'full_refund';

function buildFinancialStatementYearOptions() {
  const latestClosedYear = new Date().getFullYear() - 1;
  return Array.from({ length: 6 }, (_, index) => String(latestClosedYear - index));
}

export default function DDCheckoutDialog({ open, onClose, companyName, country = 'es' }) {
  const [includeFS, setIncludeFS] = useState(false);
  const [financialStatementsYear, setFinancialStatementsYear] = useState('latest');
  const [financialStatementsFallback, setFinancialStatementsFallback] = useState(FS_FALLBACK_KEEP_DD);
  const [email, setEmail] = useState('');
  const [lang, setLang] = useState('es');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [androidProducts, setAndroidProducts] = useState([]);
  const [androidProductsLoading, setAndroidProductsLoading] = useState(false);

  const subtotal = DD_PRICE + (includeFS ? FS_PRICE : 0);
  const isAndroidApp = isAndroidNativeApp();
  const selectedAndroidProductId = includeFS
    ? ANDROID_DD_PRODUCT_IDS.financialStatements
    : ANDROID_DD_PRODUCT_IDS.basic;
  const selectedAndroidProduct = androidProducts.find(
    product => product.productId === selectedAndroidProductId
  );
  const androidDisplayPrice = selectedAndroidProduct?.formattedPrice || `EUR ${subtotal.toFixed(2)}`;
  const financialStatementYearOptions = buildFinancialStatementYearOptions();

  useEffect(() => {
    if (!open || !isAndroidApp || !ANDROID_PLAY_BILLING_ENABLED) return;
    let cancelled = false;
    setAndroidProductsLoading(true);
    queryAndroidBillingProducts()
      .then(products => {
        if (!cancelled) setAndroidProducts(products);
      })
      .catch(err => {
        console.warn('Google Play product query failed:', err);
        if (!cancelled) setError('Google Play products are not available yet. Check Play Console product setup.');
      })
      .finally(() => {
        if (!cancelled) setAndroidProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isAndroidApp]);

  const ensureReportCanBeGenerated = async () => {
    // Pre-flight: confirm the Spanish company has a v3 profile before
    // starting a checkout. Foreign entities that appear only as
    // bare-string sole_shareholders in another company have no profile
    // to build a DD report from, and we don't want to charge for a
    // report we can't deliver. The endpoint fails open on backend
    // errors (returns exists: true with unverified: true), so transient
    // ES issues don't block valid sales — only a confirmed miss does.
    if (country !== 'es' || !companyName) return true;

    try {
      const checkRes = await fetch(`${API_URL}/bormes/dd-report/check-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: companyName }),
      });
      if (!checkRes.ok) return true;

      const checkData = await checkRes.json();
      if (checkData && checkData.exists === false) {
        setError(
          `We could not find "${companyName}" in our Spanish corporate registry. ` +
          `This usually means it is a foreign entity that appears only as a ` +
          `shareholder of Spanish companies — we do not hold a corporate profile ` +
          `for it, so a Due Diligence report cannot be generated. ` +
          `If you believe this is wrong, please email app@ncdata.eu.`
        );
        return false;
      }
    } catch (preErr) {
      console.warn('DD pre-check failed (proceeding anyway):', preErr);
    }
    return true;
  };

  const fulfillAndroidPurchase = async ({
    productId,
    purchase,
    pendingCompanyName = companyName,
    pendingCountry = country,
    pendingEmail = email.trim(),
    pendingLang = lang,
    pendingIncludeFS = includeFS,
    pendingFinancialStatementsYear = financialStatementsYear,
    pendingFinancialStatementsFallback = financialStatementsFallback,
    pendingAndroidProduct = selectedAndroidProduct,
  }) => {
    const fulfillRes = await fetch(`${PAYMENTS_API}/api/google-play/fulfill-dd-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packageName: 'es.mapasocietario.app',
        productId,
        purchaseToken: purchase.purchaseToken,
        companyName: pendingCompanyName,
        country: pendingCountry,
        email: pendingEmail,
        googlePlayPrice: pendingAndroidProduct ? {
          formattedPrice: pendingAndroidProduct.formattedPrice,
          priceAmountMicros: pendingAndroidProduct.priceAmountMicros,
          priceCurrencyCode: pendingAndroidProduct.priceCurrencyCode,
        } : undefined,
        options: {
          language: pendingLang,
          financialStatements: pendingIncludeFS,
          ...(pendingIncludeFS ? {
            financialStatementsYear: pendingFinancialStatementsYear || 'latest',
            financialStatementsFallback: pendingFinancialStatementsFallback || FS_FALLBACK_KEEP_DD,
          } : {}),
        },
      }),
    });

    const fulfillData = await fulfillRes.json().catch(() => ({}));
    if (!fulfillRes.ok || !fulfillData.sessionId) {
      throw new Error(fulfillData.error || 'Google Play purchase was paid, but report fulfillment failed. Please contact app@ncdata.eu.');
    }

    localStorage.removeItem('dd_google_play_pending_purchase');
    if (pendingIncludeFS) {
      localStorage.setItem('dd_include_fs', 'true');
    }
    window.location.href = `/order/${fulfillData.sessionId}`;
  };

  const handleCheckout = async () => {
    if (!email.trim()) {
      setError('Email is required to receive your report.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const canGenerate = await ensureReportCanBeGenerated();
      if (!canGenerate) {
        setLoading(false);
        return;
      }

      if (isAndroidApp) {
        if (!ANDROID_PLAY_BILLING_ENABLED) {
          setError('Google Play checkout is being connected for Android. Stripe checkout is disabled in the Android app.');
          return;
        }

        const pendingPurchaseRaw = localStorage.getItem('dd_google_play_pending_purchase');
        if (pendingPurchaseRaw) {
          try {
            await fulfillAndroidPurchase(JSON.parse(pendingPurchaseRaw));
            return;
          } catch (pendingErr) {
            console.warn('Pending Google Play fulfillment retry failed:', pendingErr);
          }
        }

        const { productId, purchase, product } = await purchaseAndroidReport({
          includeFinancialStatements: includeFS,
        });

        const pendingPurchase = {
          productId,
          purchase,
          pendingCompanyName: companyName,
          pendingCountry: country,
          pendingEmail: email.trim(),
          pendingLang: lang,
          pendingIncludeFS: includeFS,
          pendingFinancialStatementsYear: financialStatementsYear,
          pendingFinancialStatementsFallback: financialStatementsFallback,
          pendingAndroidProduct: product || selectedAndroidProduct,
        };
        localStorage.setItem('dd_google_play_pending_purchase', JSON.stringify(pendingPurchase));
        await fulfillAndroidPurchase(pendingPurchase);
        return;
      }

      const options = {
        language: lang,
        ...(includeFS ? {
          financialStatements: true,
          financialStatementsYear,
          financialStatementsFallback,
          email: email.trim(),
        } : {}),
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
      setError(err.message || 'Connection error. Please try again.');
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
        {!isAndroidApp && LAUNCH_PROMO_CODE && (
          <Box
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: 1.5,
              bgcolor: 'rgba(255,167,38,0.12)',
              border: '1px solid rgba(255,167,38,0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography component="span" sx={{ fontSize: 18, lineHeight: 1 }}>🚀</Typography>
            <Typography variant="caption" sx={{ color: 'warning.light', fontSize: '0.78rem', lineHeight: 1.45 }}>
              <strong>Product Hunt launch:</strong> enter code{' '}
              <Box component="span" sx={{ fontWeight: 700, color: 'warning.main', letterSpacing: '0.04em' }}>
                {LAUNCH_PROMO_CODE}
              </Box>{' '}
              at checkout for <strong>50% off the Due Diligence report</strong>.
            </Typography>
          </Box>
        )}
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
              {isAndroidApp && selectedAndroidProduct?.productId === ANDROID_DD_PRODUCT_IDS.basic
                ? selectedAndroidProduct.formattedPrice
                : `EUR ${DD_PRICE.toFixed(2)}`}
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
                  Delivered within 30-45 minutes.
                </Typography>
                <Typography variant="caption" sx={{ color: includeFS ? 'primary.light' : 'text.secondary', display: 'block', mt: 0.25, ml: 3, fontWeight: 600 }}>
                  + EUR {FS_PRICE.toFixed(2)}
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', mx: 0, width: '100%' }}
          />
        </Box>

        {includeFS && (
          <Box
            sx={{
              mt: 1.5,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'rgba(25,118,210,0.04)',
              border: '1px solid rgba(25,118,210,0.16)',
            }}
          >
            <TextField
              fullWidth
              select
              size="small"
              label="Financial statements year"
              value={financialStatementsYear}
              onChange={(e) => setFinancialStatementsYear(e.target.value)}
              SelectProps={{ native: true }}
              sx={{
                mb: 1.5,
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.85rem',
                  bgcolor: 'rgba(255,255,255,0.03)',
                },
              }}
            >
              <option value="latest">Latest available</option>
              {financialStatementYearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </TextField>

            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
              If the requested accounts are not available, choose how we should handle the order.
            </Typography>
            <RadioGroup
              value={financialStatementsFallback}
              onChange={(e) => setFinancialStatementsFallback(e.target.value)}
              sx={{
                gap: 0.75,
                '& .MuiFormControlLabel-root': { m: 0 },
              }}
            >
              <FallbackRadioOption
                value={FS_FALLBACK_KEEP_DD}
                label="Keep the Due Diligence report"
                description="Refund only the financial statements part and keep the DD report."
              />
              <FallbackRadioOption
                value={FS_FALLBACK_FULL_REFUND}
                label="Cancel the whole order"
                description="Issue a full refund if the requested accounts cannot be retrieved."
              />
            </RadioGroup>
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.75, lineHeight: 1.45 }}>
              We will handle the refund and tax adjustment for the unavailable part, or for the full order if you choose full refund.
            </Typography>
          </Box>
        )}

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
        {isAndroidApp && !error && (
          <Alert severity="info" sx={{ mt: 2, fontSize: '0.75rem' }}>
            Stripe checkout is disabled in the Android app. Payments are processed by Google Play.
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, flexDirection: 'column', gap: 1 }}>
        {/* Price breakdown */}
        <Box sx={{ width: '100%', mb: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {isAndroidApp ? 'Google Play price' : 'Base price'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {isAndroidApp ? androidDisplayPrice : `EUR ${subtotal.toFixed(2)}`}
            </Typography>
          </Box>
          {!isAndroidApp && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Tax / VAT</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Calculated by Stripe</Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, mt: 0.5, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Total</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.main' }}>
              {isAndroidApp ? androidDisplayPrice : 'Shown at Stripe Checkout'}
            </Typography>
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
            {isAndroidApp
              ? 'Android payments will be processed by Google Play. '
              : 'Payments securely processed by Stripe. Stripe calculates taxes and validates supported business VAT IDs at checkout. '}
            By continuing you accept our{' '}
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
          disabled={loading || androidProductsLoading || (isAndroidApp && !ANDROID_PLAY_BILLING_ENABLED)}
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
          {loading
            ? (isAndroidApp ? 'Opening Google Play...' : 'Redirecting to Stripe...')
            : isAndroidApp
              ? (ANDROID_PLAY_BILLING_ENABLED ? `Pay with Google Play · ${androidDisplayPrice}` : 'Google Play checkout coming soon')
              : `Continue to Stripe · from EUR ${subtotal.toFixed(2)}`}
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

function FallbackRadioOption({ value, label, description }) {
  return (
    <FormControlLabel
      value={value}
      control={
        <Radio
          size="small"
          sx={{
            color: 'text.disabled',
            '&.Mui-checked': { color: 'primary.light' },
          }}
        />
      }
      label={
        <Box sx={{ py: 0.75 }}>
          <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 700 }}>
            {label}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.35 }}>
            {description}
          </Typography>
        </Box>
      }
      sx={{
        px: 1,
        borderRadius: 1,
        border: '1px solid rgba(255,255,255,0.12)',
        bgcolor: 'rgba(255,255,255,0.03)',
        alignItems: 'flex-start',
        '&:has(.Mui-checked)': {
          borderColor: 'rgba(144,202,249,0.5)',
          bgcolor: 'rgba(25,118,210,0.12)',
        },
      }}
    />
  );
}
