import React, { useEffect, useRef, useState } from 'react';
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
  MenuItem,
  Radio,
  RadioGroup,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
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
import { trackEvent } from '../utils/track';
import { buildCheckoutIntake, findCheckoutBlocker } from '../utils/checkoutIntake';
import { checkoutPriceView } from './ddCheckoutPriceView';
import CheckoutErrorBoundary from './CheckoutErrorBoundary';
import { resolveGroupKey, listCorrections } from '../services/correctionsService';

const DD_PRICE = 22.50;
const FS_PRICE = 17.50;
import { furthestCheckoutStage } from '../utils/checkoutAbandon';
// Product Hunt launch promo. Set to null after the launch to hide the banner.
//const LAUNCH_PROMO_CODE = 'PRODUCTHUNT50';
// Free-first-report insight program (intake-gated). Ship DORMANT: keep null
// until the Stripe 100%-off coupon and the payments-worker changes (accept the
// `intake` payload, apply the coupon on `freeFirstReport`, list free orders for
// the admin) are live. Set to the coupon code to activate the offer + gate.
// Spec: docs/superpowers/specs/2026-06-27-free-dd-insight-design.md
// Free-first-report program switch. Truthy = the intake gate + offer are shown
// and a free order is fulfilled via the waiver path (capped). Set it to null in
// src/copy/freeFirstReport.js to turn the whole program off — offer, gate and
// every callout that imports this disappear together. Defined there rather than
// here so surfaces that only announce the offer (landing page, prerenderer)
// don't pull this dialog into their bundle; re-exported for existing importers.
import { FREE_FIRST_REPORT_CODE } from '../copy/freeFirstReport';
export { FREE_FIRST_REPORT_CODE };
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
      `We could not find "${companyName}" in our BORME publication index. ` +
      'This usually means it is a foreign entity that appears only as a shareholder of Spanish companies. ' +
      'We do not hold a corporate profile for it, so a Due Diligence report cannot be generated. ' +
      'If you believe this is wrong, please email mapasocietario@ncdata.eu.',
    fulfillFailed:
      'Google Play purchase was paid, but report fulfillment failed. Please contact mapasocietario@ncdata.eu.',
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
    baseDescription: 'Corporate structure, officer history, sanctions and adverse-media screening, risk analysis',
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
      'Mapa Societario is powered by NC Data, a service of Nurnberg Consulting SL. Your report is issued under the NC Data brand; the invoice is issued by Nurnberg Consulting SL · NIF B86829538 · Madrid, Spain.',
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
    aiIncluded: 'Includes 2 days of AI investigation on this company’s network',
    freeReportToggle: '🎁 Use my free first report',
    freeReportHelp:
      'Your first report is on us — without financial statements. If you have a moment, tell us who you are and what you needed it for; both fields are optional. We may email one short question later. No calls, ever.',
    freeReportRoleLabel: 'Which best describes you? (optional)',
    freeReportNeedLabel: 'What did you need this report for? (optional)',
    freeReportNeedPlaceholder: 'e.g. checking a supplier before signing',
    freeReportFollowUp: 'OK to email me one short question later',
    freeReportConfirm: '✓ This report will be free',
    freeReportConfirmHelp: 'No card, no payment page — the total below is EUR 0.00.',
    freePrice: 'Free',
    freeDiscount: 'First report — on us',
    freeFsExcluded: 'Not included in the free report',
    freeNoTax: 'Nothing to pay',
    generateFree: 'Generate my free report',
    placingFreeOrder: 'Placing your free order...',
    freeDelivery: email => `No payment page. We generate the report now and email it to ${email}, usually within a few minutes.`,
    freeReportIneligible: 'This email has already used its free report.',
    freeReportProgramClosed: 'The free report offer is currently closed.',
    freeReportBlockedRetry: 'This email is not eligible for a free report. Please review and submit again to purchase.',
    roles: {
      legal: 'Lawyer / legal',
      advisor: 'Accountant / advisor',
      compliance: 'Compliance / KYC',
      investor: 'Investor / M&A',
      journalist: 'Journalist',
      owner: 'Business owner',
      other: 'Other',
    },
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
      'Si crees que es un error, escríbenos a mapasocietario@ncdata.eu.',
    fulfillFailed:
      'La compra en Google Play se ha pagado, pero no se pudo preparar el informe. Contacta con mapasocietario@ncdata.eu.',
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
      'Estructura societaria, historial de administradores, cribado de sanciones y prensa adversa, análisis de riesgo',
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
      'Mapa Societario está impulsado por NC Data, un servicio de Nurnberg Consulting SL. El informe se emite bajo la marca NC Data; la factura la emite Nurnberg Consulting SL · NIF B86829538 · Madrid, España.',
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
    aiIncluded: 'Incluye 2 días de investigación por IA sobre la red de esta empresa',
    freeReportToggle: '🎁 Usar mi primer informe gratis',
    freeReportHelp:
      'Tu primer informe corre de nuestra cuenta — sin cuentas anuales. Si tienes un momento, cuéntanos quién eres y para qué lo necesitabas; ambos campos son opcionales. Puede que te enviemos una pregunta corta por email más adelante. Nunca llamadas.',
    freeReportRoleLabel: '¿Qué te describe mejor? (opcional)',
    freeReportNeedLabel: '¿Para qué necesitabas este informe? (opcional)',
    freeReportNeedPlaceholder: 'p. ej. comprobar un proveedor antes de firmar',
    freeReportFollowUp: 'De acuerdo en recibir una pregunta corta por email',
    freeReportConfirm: '✓ Este informe será gratuito',
    freeReportConfirmHelp: 'Sin tarjeta ni página de pago — el total de abajo es 0,00 EUR.',
    freePrice: 'Gratis',
    freeDiscount: 'Primer informe — invitamos nosotros',
    freeFsExcluded: 'No incluidas en el informe gratuito',
    freeNoTax: 'Nada que pagar',
    generateFree: 'Generar mi informe gratis',
    placingFreeOrder: 'Creando tu pedido gratuito...',
    freeDelivery: email => `Sin página de pago. Generamos el informe ahora y lo enviamos a ${email}, normalmente en pocos minutos.`,
    freeReportIneligible: 'Este correo ya ha usado su informe gratuito.',
    freeReportProgramClosed: 'La oferta de informe gratuito está cerrada por ahora.',
    freeReportBlockedRetry: 'Este correo no es elegible para un informe gratuito. Revisa y vuelve a enviar para comprarlo.',
    roles: {
      legal: 'Abogado / jurídico',
      advisor: 'Asesor / gestoría',
      compliance: 'Compliance / KYC',
      investor: 'Inversor / M&A',
      journalist: 'Periodista',
      owner: 'Empresario / autónomo',
      other: 'Otro',
    },
  },
};

function buildFinancialStatementYearOptions() {
  const latestClosedYear = new Date().getFullYear() - 1;
  return Array.from({ length: 6 }, (_, index) => String(latestClosedYear - index));
}

// The exported component wraps the real dialog in an error boundary so a
// render crash here degrades to a small apology dialog instead of blanking
// the whole /app and losing the user's graph. Wrapping at the export covers
// every render site (graph toolbar, /due-diligence) in one place.
export default function DDCheckoutDialog(props) {
  return (
    <CheckoutErrorBoundary onClose={props.onClose} lang={props.language}>
      <DDCheckoutDialogInner {...props} />
    </CheckoutErrorBoundary>
  );
}

function DDCheckoutDialogInner({ open, onClose, companyName, country = 'es', language = 'en' }) {
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
  // Free-first-report insight intake (active only when FREE_FIRST_REPORT_CODE is set).
  const [useFreeReport, setUseFreeReport] = useState(false);
  const [buyerRole, setBuyerRole] = useState('');
  const [needContext, setNeedContext] = useState('');
  const [followUpOptIn, setFollowUpOptIn] = useState(false);
  // Live free-report eligibility (per-email gate mirror). Default eligible so the
  // offer shows until we learn otherwise; the backend is authoritative regardless.
  const [freeEligible, setFreeEligible] = useState(true);
  const [freeEligibilityReason, setFreeEligibilityReason] = useState('ok');

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
  // Free-first-report path: only on the Stripe (web) flow, and only when the
  // program is activated. Drives both the submit payload and every price
  // string the user sees, so the two can never disagree.
  const freeActive = !!FREE_FIRST_REPORT_CODE && useFreeReport && !isAndroidApp;
  const priceView = checkoutPriceView({
    freeActive, isAndroidApp, loading, ddPrice: DD_PRICE, fsPrice: FS_PRICE, includeFS, copy, email,
    androidCardPrice: selectedAndroidProduct?.productId === ANDROID_DD_PRODUCT_IDS.basic
      ? selectedAndroidProduct.formattedPrice
      : null,
    androidDisplayPrice, androidBillingEnabled: ANDROID_PLAY_BILLING_ENABLED,
  });
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (open) setLang(language === 'es' ? 'es' : 'en');
  }, [open, language]);

  // Funnel stage 1: the dialog opening IS the "DD button clicked" signal — all
  // entry points (graph toolbar, node card, /due-diligence page) route here.
  // Pairs with begin_checkout below and purchase in OrderStatusPage.
  useEffect(() => {
    if (!open) return;
    trackEvent('view_item', {
      currency: 'EUR',
      items: [{ item_name: `DD Report — ${(country || 'es').toUpperCase()}`, item_category: 'Due Diligence', quantity: 1 }],
      company: companyName || '',
      page_path: window.location.pathname,
      platform: isAndroidApp ? 'android' : 'web',
    });
  }, [open, companyName, country]);

  // Funnel stage 1b: the dialog closed without a submitted order. view_item and
  // begin_checkout bracket the step but say nothing about the drop-offs in
  // between, which is where the interesting failure lives.
  //
  // The cleanup below runs one commit after the values it reports change, so it
  // reads them from a ref rather than the effect's own closure — a dependency
  // array wide enough to keep the closure fresh would re-run the effect on
  // every keystroke and fire an abandon per character typed.
  const submittedRef = useRef(false);
  const abandonStateRef = useRef({});
  abandonStateRef.current = {
    email,
    useFreeReport,
    buyerRole,
    needContext,
    company: companyName || '',
    hadError: !!error,
  };
  useEffect(() => {
    if (!open) return undefined;
    submittedRef.current = false;
    return () => {
      if (submittedRef.current) return;
      const state = abandonStateRef.current;
      trackEvent('dd_checkout_abandoned', {
        furthest_stage: furthestCheckoutStage(state),
        company: state.company,
        had_error: state.hadError,
        platform: isAndroidApp ? 'android' : 'web',
      });
    };
  }, [open, isAndroidApp]);

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

  // Debounced eligibility check: when the program is on and an email is present,
  // ask the worker whether this email may still redeem a free report.
  useEffect(() => {
    if (!FREE_FIRST_REPORT_CODE || isAndroidApp) return;
    const trimmed = email.trim();
    if (!trimmed) { setFreeEligible(true); setFreeEligibilityReason('unknown'); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${PAYMENTS_API}/api/stripe/check-free-report-eligibility`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed }),
        });
        const data = await res.json();
        if (cancelled) return;
        setFreeEligible(data.eligible !== false);
        setFreeEligibilityReason(data.reason || 'ok');
        if (data.eligible === false) setUseFreeReport(false);
      } catch {
        // Network hiccup: don't block the UI — backend still enforces on submit.
        if (!cancelled) { setFreeEligible(true); setFreeEligibilityReason('ok'); }
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [email, isAndroidApp]);

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

  // `begin_checkout` fires the moment the form is submitted, before the
  // company pre-check and before the worker answers — so a user who keeps
  // hitting a wall emits it again on every retry, and the metric cannot tell
  // intent from success. GA showed 30 begin_checkout from 6 users against 2
  // purchases in 28 days; without these two events there is no way to know
  // whether that is hesitation or a broken path. Log where each attempt ends.
  const trackCheckoutFailure = (reason) => {
    trackEvent('checkout_failed', {
      reason,
      company: companyName || '',
      free_report: !!FREE_FIRST_REPORT_CODE && useFreeReport && !isAndroidApp,
      platform: isAndroidApp ? 'android' : 'web',
    });
  };

  // Terminal states only. Every path that leaves handleSubmit after
  // begin_checkout must call one of these two, or the attempt disappears: the
  // 18-24 Aug week showed 18 begin_checkout against 13 redirects and 0
  // failures, and the five unaccounted submissions could not be explained
  // because the Android returns below fired neither.
  //
  // `destination` distinguishes free_order (fulfilled server-side, no Stripe,
  // no purchase event by design) from the paid Stripe paths and from Google
  // Play. It is USELESS until registered as an event-scoped custom dimension
  // in GA4 — unregistered parameters are invisible to reporting and cannot be
  // backfilled.
  const trackCheckoutRedirect = (destination) => {
    trackEvent('checkout_redirect', { destination, company: companyName || '' });
  };

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
    // Email is the only requirement, free path included — the role and need
    // fields below it are optional. See findCheckoutBlocker.
    if (findCheckoutBlocker({ email }) === 'email') {
      setError(copy.emailRequired);
      return;
    }
    const checkoutIntake = buildCheckoutIntake({
      freeActive,
      role: buyerRole,
      need: needContext,
      followUpOptIn,
    });
    setError('');
    setLoading(true);
    // Funnel stage 2: user submitted the checkout form (pre-redirect). The
    // matching purchase event fires on OrderStatusPage after payment.
    submittedRef.current = true;
    trackEvent('begin_checkout', {
      currency: 'EUR',
      value: freeActive ? 0 : subtotal,
      items: [{ item_name: `DD Report — ${(country || 'es').toUpperCase()}`, item_category: 'Due Diligence', price: freeActive ? 0 : subtotal, quantity: 1 }],
      company: companyName || '',
      include_financials: includeFS,
      free_report: freeActive,
      platform: isAndroidApp ? 'android' : 'web',
    });
    // Open Stripe checkout in a NEW tab so the user's graph — which can hold
    // many plotted companies, their layout, merges and corrections, all in
    // in-memory React state — survives. A same-tab redirect unmounts the SPA
    // and wipes it, forcing the user to rebuild the graph to buy each report.
    // The tab MUST be opened here, synchronously in the click gesture; opening
    // it after the awaits below trips the browser's popup blocker. If the popup
    // is blocked (checkoutTab === null) we fall back to a same-tab redirect so
    // the sale still completes. Android uses its own in-app flow — no new tab.
    // Free/waived orders are fulfilled server-side with no payment page, so they
    // never need a tab either (handled in place below) — only a real paid Stripe
    // redirect does. (Server-side waivers we can't detect here still briefly open
    // and immediately close a tab; that flash is the unavoidable cost of the
    // popup-blocker constraint.)
    const checkoutTab = (isAndroidApp || freeActive) ? null : window.open('', '_blank');
    // The tab above must open in the click gesture, so it exists before we know
    // where it is going — leaving the buyer staring at an empty window for the
    // length of the pre-check plus session creation, and flashing blank-then-gone
    // for an order the server turns out to waive. about:blank is same-origin, so
    // paint it instead of leaving it empty. Plain DOM, no innerHTML: `copy` is
    // ours, but this window is a different document and not worth the exception.
    if (checkoutTab) {
      try {
        const doc = checkoutTab.document;
        doc.title = copy.redirectingStripe;
        const p = doc.createElement('p');
        p.textContent = copy.redirectingStripe;
        p.setAttribute(
          'style',
          'font:16px system-ui,-apple-system,sans-serif;color:#333;text-align:center;margin-top:20vh'
        );
        doc.body.appendChild(p);
      } catch {
        // Cross-origin or a blocked document — the tab still works, just blank.
      }
    }
    try {
      const canGenerate = await ensureReportCanBeGenerated();
      if (!canGenerate) {
        checkoutTab?.close();
        trackCheckoutFailure('company_not_found');
        setLoading(false);
        return;
      }

      if (isAndroidApp) {
        if (!ANDROID_PLAY_BILLING_ENABLED) {
          setError(copy.googlePlayConnecting);
          trackCheckoutFailure('android_billing_disabled');
          return;
        }

        const pendingPurchaseRaw = localStorage.getItem('dd_google_play_pending_purchase');
        if (pendingPurchaseRaw) {
          try {
            await fulfillAndroidPurchase(JSON.parse(pendingPurchaseRaw));
            trackCheckoutRedirect('android_pending_fulfilled');
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
        trackCheckoutRedirect('android_play_billing');
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
        ...((includeFS && !freeActive) ? {
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
          // Free-first-report insight program: the payments worker applies the
          // 100%-off coupon on `freeFirstReport` and persists `intake` to the
          // Stripe session metadata.
          ...(freeActive ? {
            freeFirstReport: true,
            promoCode: FREE_FIRST_REPORT_CODE,
          } : {}),
          // `intake` rides both paths — required role + need on the free gate,
          // optional role alone when paying. Null when the buyer skipped it.
          ...(checkoutIntake ? { intake: checkoutIntake } : {}),
        }),
      });
      const data = await res.json();
      const freeBlockedErrors = ['free_report_already_used', 'free_report_blocked', 'free_report_email_required'];
      // A free/waived order (cs_free_*) is fulfilled server-side with no payment
      // page — the backend returns our own app URL, not a Stripe one.
      const isFreeOrder = typeof data.sessionId === 'string' && data.sessionId.startsWith('cs_free_');
      if (freeBlockedErrors.includes(data.error)) {
        // The free offer is no longer valid for this email — fall back to paid.
        checkoutTab?.close();
        setUseFreeReport(false);
        setFreeEligible(false);
        setFreeEligibilityReason(data.error === 'free_report_blocked' ? 'blocked' : 'already_used');
        setError(copy.freeReportBlockedRetry);
        trackCheckoutFailure(data.error);
      } else if (isFreeOrder) {
        // Free/waived order: already placed on the server. Do NOT navigate or
        // reload — that would wipe the in-memory graph. Keep the user exactly
        // where they are (graph fully intact) and surface the report via the
        // global banner in place, then close the dialog. The banner links to the
        // persistent /order page, which shows live generation status.
        checkoutTab?.close();
        try { sessionStorage.setItem('dd_free_report_ready', data.sessionId); } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent('dd-free-report-ready', { detail: data.sessionId }));
        trackCheckoutRedirect('free_order');
        onClose?.();
      } else if (data.url) {
        localStorage.setItem('dd_return_url', window.location.href);
        if (includeFS) {
          localStorage.setItem('dd_include_fs', 'true');
        }
        if (checkoutTab) {
          // Send the pre-opened tab to Stripe; the graph tab stays intact.
          trackCheckoutRedirect('stripe_new_tab');
          checkoutTab.location.href = data.url;
          // Dismiss the dialog so the user lands back on their intact graph.
          onClose?.();
        } else {
          // Popup blocked — complete the sale via same-tab redirect. The graph
          // is lost in this fallback, but a completed purchase matters more.
          // Counting these separately tells us how often the blocker fires.
          trackCheckoutRedirect('stripe_same_tab');
          window.location.href = data.url;
        }
      } else {
        checkoutTab?.close();
        setError(copy.createCheckoutFailed);
        trackCheckoutFailure('no_checkout_url');
      }
    } catch (err) {
      checkoutTab?.close();
      console.error('DD checkout error:', err);
      setError(err.message || copy.connectionError);
      trackCheckoutFailure('exception');
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
      fullScreen={fullScreen}
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          border: fullScreen ? 'none' : '1px solid',
          borderColor: 'divider',
          borderRadius: fullScreen ? 0 : 5,
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
                  borderColor: 'divider',
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    bgcolor: 'warning.main',
                    color: 'warning.contrastText',
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

      <DialogContent sx={{ pt: 2 }}>
        {/* Email field — first so it's always visible, especially on small Android screens */}
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
            mb: 0.75,
            mt: 1,
            '& .MuiOutlinedInput-root': {
              fontSize: '0.85rem',
              bgcolor: 'action.hover',
            },
          }}
        />
        <Typography variant="caption" sx={{ display: 'block', mb: 2, px: 0.5, color: 'text.disabled', fontSize: '0.7rem', lineHeight: 1.45 }}>
          {copy.emailHelp}
        </Typography>

        {/* The buyer-profile question deliberately does NOT live here. This
            dialog loses 74% of the people who open it (GA, 28d to 2026-08-20:
            23 opened, 6 submitted), so it is the worst place in the product to
            add anything optional. It is asked on the order page after payment
            instead — see OrderStatusPage. */}

        {/* Report mode selector — only when the user has graph corrections for this
            company. Company-based = registry as-is; Custom = applies your corrections. */}
        {correctionsCount > 0 && (
          <Box
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: 1.5,
              bgcolor: (theme) => alpha(theme.palette.success.main, 0.06),
              border: '1px solid',
              borderColor: (theme) => alpha(theme.palette.success.main, 0.2),
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
                  borderColor: 'divider',
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    bgcolor: 'success.main',
                    color: 'success.contrastText',
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
        {/* Free-first-report insight gate. Dormant until FREE_FIRST_REPORT_CODE is set. */}
        {FREE_FIRST_REPORT_CODE && !isAndroidApp && freeEligible && (
          <Box
            sx={{
              p: 1.75,
              mb: 2,
              borderRadius: 1.5,
              bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
              border: '1px solid',
              borderColor: (theme) => alpha(theme.palette.warning.main, 0.3),
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={useFreeReport}
                  onChange={(e) => {
                    setUseFreeReport(e.target.checked);
                    if (e.target.checked) trackEvent('free_report_selected', { company: companyName || '' });
                  }}
                  sx={{ color: 'warning.main', '&.Mui-checked': { color: 'warning.main' }, py: 0.25 }}
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'accent.warning' }}>
                  {copy.freeReportToggle}
                </Typography>
              }
              sx={{ alignItems: 'center', m: 0 }}
            />
            {useFreeReport && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" sx={{ display: 'block', mb: 1.5, color: 'text.secondary', fontSize: '0.72rem', lineHeight: 1.5 }}>
                  {copy.freeReportHelp}
                </Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={copy.freeReportRoleLabel}
                  value={buyerRole}
                  onChange={(e) => setBuyerRole(e.target.value)}
                  sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { fontSize: '0.85rem', bgcolor: 'action.hover' } }}
                >
                  {Object.entries(copy.roles).map(([value, label]) => (
                    <MenuItem key={value} value={value} sx={{ fontSize: '0.85rem' }}>{label}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth
                  size="small"
                  label={copy.freeReportNeedLabel}
                  placeholder={copy.freeReportNeedPlaceholder}
                  value={needContext}
                  onChange={(e) => setNeedContext(e.target.value)}
                  sx={{ mb: 1, '& .MuiOutlinedInput-root': { fontSize: '0.85rem', bgcolor: 'action.hover' } }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={followUpOptIn}
                      onChange={(e) => setFollowUpOptIn(e.target.checked)}
                      size="small"
                      sx={{ color: 'text.disabled', '&.Mui-checked': { color: 'warning.main' }, py: 0.25 }}
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                      {copy.freeReportFollowUp}
                    </Typography>
                  }
                  sx={{ alignItems: 'center', m: 0 }}
                />
                {/* Confirm the report will be free once the intake is filled. The
                    discount is auto-applied by the worker — no code to type. */}
                {buyerRole && needContext.trim() && (
                  <Box sx={{
                    mt: 1.5, p: 1, borderRadius: 1,
                    bgcolor: (theme) => alpha(theme.palette.warning.main, 0.12),
                    border: '1px dashed',
                    borderColor: (theme) => alpha(theme.palette.warning.main, 0.5),
                  }}>
                    <Typography variant="caption" sx={{ display: 'block', color: 'accent.warning', fontSize: '0.72rem', fontWeight: 700 }}>
                      {copy.freeReportConfirm}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.68rem', mt: 0.25 }}>
                      {copy.freeReportConfirmHelp}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
        {FREE_FIRST_REPORT_CODE && !isAndroidApp && !freeEligible && email.trim() && (
          freeEligibilityReason === 'limit_reached' ? (
            <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'text.secondary', fontSize: '0.72rem' }}>
              {copy.freeReportProgramClosed}
            </Typography>
          ) : (
            <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'text.secondary', fontSize: '0.72rem' }}>
              {copy.freeReportIneligible}
            </Typography>
          )
        )}
        {/*
        {!isAndroidApp && LAUNCH_PROMO_CODE && (
          <Box
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: 1.5,
              bgcolor: (theme) => alpha(theme.palette.warning.main, 0.12),
              border: '1px solid',
              borderColor: (theme) => alpha(theme.palette.warning.main, 0.35),
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography component="span" sx={{ fontSize: 18, lineHeight: 1 }}>🚀</Typography>
            <Typography variant="caption" sx={{ color: 'accent.warning', fontSize: '0.78rem', lineHeight: 1.45 }}>
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
            bgcolor: (theme) => alpha(theme.palette.warning.main, 0.06),
            border: '1px solid',
            borderColor: (theme) => alpha(theme.palette.warning.main, 0.15),
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DescriptionIcon sx={{ fontSize: 18, color: 'warning.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {copy.title}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              {priceView.product.was && (
                <Typography
                  variant="body2"
                  sx={{ color: 'text.disabled', textDecoration: 'line-through', fontWeight: 500 }}
                >
                  {priceView.product.was}
                </Typography>
              )}
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: priceView.product.isFree ? 'success.main' : 'warning.main' }}
              >
                {priceView.product.value}
              </Typography>
            </Box>
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
              color: 'accent.warning',
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
            bgcolor: includeFS ? (theme) => alpha(theme.palette.primary.main, 0.06) : 'action.hover',
            border: '1px solid',
            borderColor: includeFS ? (theme) => alpha(theme.palette.primary.main, 0.2) : 'divider',
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
                <Typography variant="caption" sx={{ color: includeFS ? 'accent.primary' : 'text.secondary', display: 'block', mt: 0.25, ml: 3, fontWeight: 600 }}>
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
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
              border: '1px solid',
              borderColor: (theme) => alpha(theme.palette.primary.main, 0.16),
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
                  bgcolor: 'action.hover',
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

        {/* Price breakdown — inside scrollable content so it doesn't steal viewport on mobile */}
        <Box sx={{ mt: 2 }}>
          {priceView.rows.map(row => (
            <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{row.label}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{row.value}</Typography>
            </Box>
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{priceView.total.label}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.main' }}>
              {priceView.total.value}
            </Typography>
          </Box>
          {priceView.note && (
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5, px: 1 }}>
              {priceView.note}
            </Typography>
          )}
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5, px: 1 }}>
            {copy.aiIncluded}
          </Typography>
        </Box>

        {/* Data-quality guarantee */}
        <Box
          sx={{
            mt: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            p: 1.25,
            borderRadius: 1.5,
            bgcolor: (theme) => alpha(theme.palette.success.main, 0.08),
            border: '1px solid',
            borderColor: (theme) => alpha(theme.palette.success.main, 0.25),
          }}
        >
          <VerifiedUserIcon sx={{ fontSize: 18, color: 'accent.success', mt: '1px', flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: 'accent.success', fontSize: '0.74rem', lineHeight: 1.45 }}>
            <strong>{copy.guaranteeTitle}</strong> {copy.guarantee}
          </Typography>
        </Box>

        {/* Legal fine print */}
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 1.5,
            px: 1,
            color: 'text.disabled',
            fontSize: '0.68rem',
            lineHeight: 1.45,
          }}
        >
          {copy.invoice}{' '}
          {/* A free order never touches a payment processor, so the Stripe sentence is dropped rather than contradicted. */}
          {isAndroidApp ? copy.androidPayments : (freeActive ? '' : copy.stripePayments)}{' '}
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
            pb: 1,
            color: 'text.secondary',
            fontSize: '0.72rem',
            lineHeight: 1.5,
          }}
        >
          {copy.questions}{' '}
          {/* Informational contact link — info.main (fix round 1, task-10). */}
          <Box component="a" href="mailto:mapasocietario@ncdata.eu" sx={{ color: 'info.main', textDecoration: 'none' }}>mapasocietario@ncdata.eu</Box>
          {' '}— {copy.reply}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, flexDirection: 'column', gap: 0.5 }}>
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
            color: 'warning.contrastText',
            fontSize: '0.9rem',
            '&:hover': { bgcolor: 'warning.dark' },
          }}
        >
          {priceView.cta}
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
            '&.Mui-checked': { color: 'accent.primary' },
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
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'action.hover',
        alignItems: 'flex-start',
        '&:has(.Mui-checked)': {
          // Mirrors the Radio's own '&.Mui-checked' color (accent.primary,
          // above) so the ring and the dot it surrounds always match — fix
          // round 1, task-10.
          borderColor: (theme) => alpha(theme.palette.accent.primary, 0.5),
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
        },
      }}
    />
  );
}
