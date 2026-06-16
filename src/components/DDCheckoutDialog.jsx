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
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import {
  ANDROID_DD_PRODUCT_IDS,
  isAndroidNativeApp,
  purchaseAndroidReport,
  queryAndroidBillingProducts,
} from '../services/playBillingService';
import { API_URL, PAYMENTS_API } from '../config';
import { getClientId } from '../utils/clientId';
import { resolveGroupKey, listCorrections } from '../services/correctionsService';

const DD_PRICE = 22.50;
const FS_PRICE = 17.50;
// Product Hunt launch promo. Set to null after the launch to hide the banner.
//const LAUNCH_PROMO_CODE = 'PRODUCTHUNT50';
const ANDROID_PLAY_BILLING_ENABLED = true;
const FS_FALLBACK_KEEP_DD = 'keep_dd_refund_fs';
const FS_FALLBACK_FULL_REFUND = 'full_refund';

const DD_COPY = {
  en: {
    androidVatNote:
      'Final price is set by Google Play and includes VAT calculated for your country, so it may differ from EUR 22.50.',
    googlePlayProductsError:
      'Google Play products are not available yet. Check Play Console product setup.',
    missingCompany: companyName =>
      `We could not find "${companyName}" in our Spanish corporate registry. ` +
      'This usually means it is a foreign entity that appears only as a shareholder of Spanish companies. ' +
      'We do not hold a corporate profile for it, so a Due Diligence report cannot be generated. ' +
      'If you believe this is wrong, please email app@ncdata.eu.',
    fulfillFailed:
      'Google Play purchase was paid, but report fulfillment failed. Please contact app@ncdata.eu.',
    emailRequired: 'Email is required to receive your report.',
    googlePlayConnecting:
      'Google Play checkout is being connected for Android. Stripe checkout is disabled in the Android app.',
    createCheckoutFailed: 'Could not create checkout session. Please try again.',
    connectionError: 'Connection error. Please try again.',
    title: 'Due Diligence Report',
    reportLanguage: 'Report language',
    reportType: 'Report type',
    companyBased: 'Company-based',
    custom: 'Custom',
    amendedMode: count =>
      `Applies your ${count} correction${count === 1 ? '' : 's'} to the report. It is marked as "Custom - not authoritative".`,
    faithfulMode:
      'Registry report: the data as published in the Registro Mercantil, with quality notes.',
    baseDescription: 'Corporate structure, officer history, sanctions screening, risk analysis',
    sampleReport: 'See a sample report before you buy',
    financialStatements: 'Financial Statements (Cuentas Anuales)',
    financialStatementsDescription:
      'Official PDF from Registro Mercantil + AI-powered financial analysis (OCR + LLM). Delivered within 30-45 minutes.',
    financialStatementsYear: 'Financial statements year',
    latestAvailable: 'Latest available',
    fallbackPrompt:
      'If the requested accounts are not available, choose how we should handle the order.',
    keepDd: 'Keep the Due Diligence report',
    keepDdDescription: 'Refund only the financial statements part and keep the DD report.',
    cancelOrder: 'Cancel the whole order',
    cancelOrderDescription: 'Issue a full refund if the requested accounts cannot be retrieved.',
    refundNote:
      'We will handle the refund and tax adjustment for the unavailable part, or for the full order if you choose full refund.',
    emailLabel: 'Email (required)',
    emailHelp:
      'Used only to deliver your report and (if you opt in) BORME monitoring alerts. Never resold.',
    androidInfo:
      'Stripe checkout is disabled in the Android app. Payments are processed by Google Play.',
    googlePlayPrice: 'Google Play price',
    basePrice: 'Base price',
    taxVat: 'Tax / VAT',
    includedGooglePlay: 'Included - set by Google Play per country',
    calculatedStripe: 'Calculated by Stripe',
    total: 'Total',
    shownAtStripe: 'Shown at Stripe Checkout',
    invoice:
      'Invoiced by Nurnberg Consulting SL · NIF B86829538 · Madrid, Spain.',
    androidPayments:
      'Android payments are processed by Google Play, which calculates and remits VAT per country. The final price may differ from EUR 22.50.',
    stripePayments:
      'Payments securely processed by Stripe or Google Pay (for Android). Stripe calculates taxes and validates supported business VAT IDs at checkout.',
    accept: 'By continuing you accept our',
    terms: 'terms',
    and: 'and',
    privacy: 'privacy policy',
    questions: 'Questions before paying? Email',
    reply: 'we usually reply within a few hours on business days.',
    guaranteeTitle: 'Data-quality guarantee.',
    guarantee:
      "If your report has data-quality issues, email us within 7 days and we'll re-issue it free or refund you in full.",
    openingGooglePlay: 'Opening Google Play...',
    redirectingStripe: 'Redirecting to Stripe...',
    payGooglePlay: price => `Pay with Google Play · ${price}`,
    googlePlaySoon: 'Google Play checkout coming soon',
    continueStripe: subtotal => `Continue to Stripe · from EUR ${subtotal.toFixed(2)}`,
    cancel: 'Cancel',
  },
  es: {
    androidVatNote:
      'El precio final lo fija Google Play e incluye el IVA calculado para tu país, por lo que puede diferir de EUR 22,50.',
    googlePlayProductsError:
      'Los productos de Google Play aún no están disponibles. Revisa la configuración en Play Console.',
    missingCompany: companyName =>
      `No hemos encontrado "${companyName}" en nuestro registro societario español. ` +
      'Normalmente esto significa que es una entidad extranjera que solo aparece como accionista de sociedades españolas. ' +
      'No tenemos un perfil societario propio para ella, por lo que no se puede generar un informe Due Diligence. ' +
      'Si crees que es un error, escríbenos a app@ncdata.eu.',
    fulfillFailed:
      'La compra en Google Play se ha pagado, pero no se pudo preparar el informe. Contacta con app@ncdata.eu.',
    emailRequired: 'El email es obligatorio para recibir el informe.',
    googlePlayConnecting:
      'Estamos conectando Google Play para Android. Stripe está desactivado dentro de la app Android.',
    createCheckoutFailed: 'No se pudo crear la sesión de pago. Inténtalo de nuevo.',
    connectionError: 'Error de conexión. Inténtalo de nuevo.',
    title: 'Informe Due Diligence',
    reportLanguage: 'Idioma del informe',
    reportType: 'Tipo de informe',
    companyBased: 'Registral',
    custom: 'Custom',
    amendedMode: count =>
      `Aplica tus ${count} corrección${count === 1 ? '' : 'es'} al informe. Se marca como "Custom - no autoritativo".`,
    faithfulMode:
      'Informe registral: los datos tal como constan en el Registro Mercantil, con notas de calidad.',
    baseDescription:
      'Estructura societaria, historial de administradores, cruce de sanciones y análisis de riesgo',
    sampleReport: 'Ver un informe de ejemplo antes de comprar',
    financialStatements: 'Cuentas anuales',
    financialStatementsDescription:
      'PDF oficial del Registro Mercantil + análisis financiero por IA (OCR + LLM). Entrega en 30-45 minutos.',
    financialStatementsYear: 'Ejercicio de cuentas anuales',
    latestAvailable: 'Último disponible',
    fallbackPrompt:
      'Si las cuentas solicitadas no están disponibles, elige cómo debemos gestionar el pedido.',
    keepDd: 'Mantener el informe Due Diligence',
    keepDdDescription: 'Reembolsar solo la parte de cuentas anuales y mantener el informe DD.',
    cancelOrder: 'Cancelar todo el pedido',
    cancelOrderDescription: 'Emitir un reembolso completo si no se pueden obtener las cuentas solicitadas.',
    refundNote:
      'Gestionaremos el reembolso y el ajuste fiscal de la parte no disponible, o de todo el pedido si eliges reembolso completo.',
    emailLabel: 'Email (obligatorio)',
    emailHelp:
      'Se usa solo para entregar el informe y, si lo activas, alertas de seguimiento BORME. Nunca se revende.',
    androidInfo:
      'Stripe está desactivado en la app Android. Los pagos se procesan con Google Play.',
    googlePlayPrice: 'Precio de Google Play',
    basePrice: 'Precio base',
    taxVat: 'Impuestos / IVA',
    includedGooglePlay: 'Incluido - fijado por Google Play según país',
    calculatedStripe: 'Calculado por Stripe',
    total: 'Total',
    shownAtStripe: 'Mostrado en Stripe Checkout',
    invoice:
      'Factura emitida por Nurnberg Consulting SL · NIF B86829538 · Madrid, España.',
    androidPayments:
      'Los pagos Android se procesan con Google Play, que calcula y liquida el IVA por país. El precio final puede diferir de EUR 22,50.',
    stripePayments:
      'Pagos seguros procesados por Stripe o Google Pay (en Android). Stripe calcula impuestos y valida NIF-IVA empresariales compatibles en el pago.',
    accept: 'Al continuar aceptas nuestros',
    terms: 'términos',
    and: 'y',
    privacy: 'política de privacidad',
    questions: '¿Preguntas antes de pagar? Escribe a',
    reply: 'solemos responder en unas horas en días laborables.',
    guaranteeTitle: 'Garantía de calidad de datos.',
    guarantee:
      'Si tu informe tiene problemas de calidad de datos, escríbenos en un plazo de 7 días y lo reemitiremos gratis o te reembolsaremos el importe completo.',
    openingGooglePlay: 'Abriendo Google Play...',
    redirectingStripe: 'Redirigiendo a Stripe...',
    payGooglePlay: price => `Pagar con Google Play · ${price}`,
    googlePlaySoon: 'Pago con Google Play próximamente',
    continueStripe: subtotal => `Continuar a Stripe · desde EUR ${subtotal.toFixed(2)}`,
    cancel: 'Cancelar',
  },
};

function buildFinancialStatementYearOptions() {
  const latestClosedYear = new Date().getFullYear() - 1;
  return Array.from({ length: 6 }, (_, index) => String(latestClosedYear - index));
}

export default function DDCheckoutDialog({ open, onClose, companyName, country = 'es', language = 'en' }) {
  const [includeFS, setIncludeFS] = useState(false);
  const [financialStatementsYear, setFinancialStatementsYear] = useState('latest');
  const [financialStatementsFallback, setFinancialStatementsFallback] = useState(FS_FALLBACK_KEEP_DD);
  const [email, setEmail] = useState('');
  const [lang, setLang] = useState(language === 'es' ? 'es' : 'en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [androidProducts, setAndroidProducts] = useState([]);
  const [androidProductsLoading, setAndroidProductsLoading] = useState(false);
  // DD mode: 'faithful' (Company-based, registry as-is + quality notes) vs
  // 'amended' (Custom, applies the user's per-company corrections overlay).
  const [mode, setMode] = useState('faithful');
  const [correctionsCount, setCorrectionsCount] = useState(0);
  const [groupKey, setGroupKey] = useState(null);

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
  const copy = DD_COPY[lang === 'es' ? 'es' : 'en'];

  useEffect(() => {
    if (open) setLang(language === 'es' ? 'es' : 'en');
  }, [open, language]);

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
        if (!cancelled) setError(copy.googlePlayProductsError);
      })
      .finally(() => {
        if (!cancelled) setAndroidProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isAndroidApp, copy.googlePlayProductsError]);

  // On open, look up the company's corrections overlay. The "Custom" mode is
  // only offered when the user actually has corrections for this company; until
  // then there is nothing to amend and the Company-based report is the product.
  useEffect(() => {
    if (!open || !companyName) {
      setCorrectionsCount(0);
      setGroupKey(null);
      setMode('faithful');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const gk = await resolveGroupKey(companyName);
        if (cancelled) return;
        setGroupKey(gk);
        if (!gk) {
          setCorrectionsCount(0);
          setMode('faithful');
          return;
        }
        const list = await listCorrections(gk);
        if (cancelled) return;
        setCorrectionsCount(list.length);
        // Default to Custom when the user has corrections — that's why they made them.
        setMode(list.length > 0 ? 'amended' : 'faithful');
      } catch {
        if (!cancelled) {
          setCorrectionsCount(0);
          setMode('faithful');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, companyName]);

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
        setError(copy.missingCompany(companyName));
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
          mode,
          ...(mode === 'amended' ? {
            account_id: getClientId(),
            ...(groupKey ? { group_key: groupKey } : {}),
          } : {}),
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
      throw new Error(fulfillData.error || copy.fulfillFailed);
    }

    localStorage.removeItem('dd_google_play_pending_purchase');
    if (pendingIncludeFS) {
      localStorage.setItem('dd_include_fs', 'true');
    }
    window.location.href = `/order/${fulfillData.sessionId}`;
  };

  const handleCheckout = async () => {
    if (!email.trim()) {
      setError(copy.emailRequired);
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
          setError(copy.googlePlayConnecting);
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
        // Custom (amended) DD: thread the mode + per-user corrections scope so the
        // backend applies the overlay (mode==='amended' branch reads account_id + group_key).
        mode,
        ...(mode === 'amended' ? {
          account_id: getClientId(),
          ...(groupKey ? { group_key: groupKey } : {}),
        } : {}),
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
        setError(copy.createCheckoutFailed);
      }
    } catch (err) {
      console.error('DD checkout error:', err);
      setError(err.message || copy.connectionError);
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
                {copy.title}
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
                {copy.reportLanguage}
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
        {/* Report mode selector — only when the user has graph corrections for this
            company. Company-based = registry as-is; Custom = applies your corrections. */}
        {correctionsCount > 0 && (
          <Box
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: 1.5,
              bgcolor: 'rgba(102,187,106,0.06)',
              border: '1px solid rgba(102,187,106,0.2)',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mb: 1,
                color: 'text.disabled',
                fontSize: '0.62rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 600,
              }}
            >
              {copy.reportType}
            </Typography>
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(_, v) => v && setMode(v)}
              size="small"
              fullWidth
              sx={{
                '& .MuiToggleButton-root': {
                  py: 0.6,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  borderColor: 'rgba(255,255,255,0.15)',
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    bgcolor: 'success.main',
                    color: '#000',
                    '&:hover': { bgcolor: 'success.dark' },
                  },
                },
              }}
            >
              <ToggleButton value="faithful">{copy.companyBased}</ToggleButton>
              <ToggleButton value="amended">{`${copy.custom} (${correctionsCount})`}</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1, lineHeight: 1.45 }}>
              {mode === 'amended'
                ? copy.amendedMode(correctionsCount)
                : copy.faithfulMode}
            </Typography>
          </Box>
        )}
        {/*
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
        */}
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
                {copy.title}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.main' }}>
              {isAndroidApp && selectedAndroidProduct?.productId === ANDROID_DD_PRODUCT_IDS.basic
                ? selectedAndroidProduct.formattedPrice
                : `EUR ${DD_PRICE.toFixed(2)}`}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
            {copy.baseDescription}
          </Typography>
          {/* Let hesitating buyers see exactly what they're paying for, right here at the decision point. */}
          <Box
            component="a"
            href="/sample-dd-report.pdf"
            target="_blank"
            rel="noopener"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              mt: 1,
              color: 'warning.light',
              fontSize: '0.78rem',
              fontWeight: 600,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            <PictureAsPdfIcon sx={{ fontSize: 15 }} />
            {copy.sampleReport}
          </Box>
          {isAndroidApp && (
            <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, display: 'block', fontStyle: 'italic' }}>
              {copy.androidVatNote}
            </Typography>
          )}
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
                    {copy.financialStatements}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25, ml: 3 }}>
                  {copy.financialStatementsDescription}
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
              label={copy.financialStatementsYear}
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
              <option value="latest">{copy.latestAvailable}</option>
              {financialStatementYearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </TextField>

            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
              {copy.fallbackPrompt}
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
                label={copy.keepDd}
                description={copy.keepDdDescription}
              />
              <FallbackRadioOption
                value={FS_FALLBACK_FULL_REFUND}
                label={copy.cancelOrder}
                description={copy.cancelOrderDescription}
              />
            </RadioGroup>
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.75, lineHeight: 1.45 }}>
              {copy.refundNote}
            </Typography>
          </Box>
        )}

        {/* Email field */}
        <TextField
          fullWidth
          size="small"
          label={copy.emailLabel}
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
          {copy.emailHelp}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2, fontSize: '0.75rem' }}>
            {error}
          </Alert>
        )}
        {isAndroidApp && !error && (
          <Alert severity="info" sx={{ mt: 2, fontSize: '0.75rem' }}>
            {copy.androidInfo}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, flexDirection: 'column', gap: 1 }}>
        {/* Price breakdown */}
        <Box sx={{ width: '100%', mb: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {isAndroidApp ? copy.googlePlayPrice : copy.basePrice}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {isAndroidApp ? androidDisplayPrice : `EUR ${subtotal.toFixed(2)}`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{copy.taxVat}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {isAndroidApp ? copy.includedGooglePlay : copy.calculatedStripe}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, mt: 0.5, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{copy.total}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.main' }}>
              {isAndroidApp ? androidDisplayPrice : copy.shownAtStripe}
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
            {copy.invoice}{' '}
            {isAndroidApp ? copy.androidPayments : copy.stripePayments}{' '}
            {copy.accept}{' '}
            <a href="/terms.html" target="_blank" rel="noopener" style={{ color: 'inherit', textDecoration: 'underline' }}>{copy.terms}</a>{' '}
            {copy.and}{' '}
            <a href="/privacy.html" target="_blank" rel="noopener" style={{ color: 'inherit', textDecoration: 'underline' }}>{copy.privacy}</a>.
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
            {copy.questions}{' '}
            <a href="mailto:app@ncdata.eu" style={{ color: '#8bc5ff', textDecoration: 'none' }}>app@ncdata.eu</a>
            {' '}— {copy.reply}
          </Typography>
        </Box>
        {/* Data-quality guarantee — the real refund promise, surfaced at the moment of maximum doubt. */}
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            p: 1.25,
            borderRadius: 1.5,
            bgcolor: 'rgba(102,187,106,0.08)',
            border: '1px solid rgba(102,187,106,0.25)',
          }}
        >
          <VerifiedUserIcon sx={{ fontSize: 18, color: 'success.light', mt: '1px', flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: 'success.light', fontSize: '0.74rem', lineHeight: 1.45 }}>
            <strong>{copy.guaranteeTitle}</strong> {copy.guarantee}
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
            ? (isAndroidApp ? copy.openingGooglePlay : copy.redirectingStripe)
            : isAndroidApp
              ? (ANDROID_PLAY_BILLING_ENABLED ? copy.payGooglePlay(androidDisplayPrice) : copy.googlePlaySoon)
              : copy.continueStripe(subtotal)}
        </Button>
        <Button
          variant="text"
          fullWidth
          onClick={onClose}
          disabled={loading}
          sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '0.8rem' }}
        >
          {copy.cancel}
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
