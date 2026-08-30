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
  TextField,
  MenuItem,
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
import { isAndroidNativeApp } from '../services/playBillingService';
import { API_URL, PAYMENTS_API, AI_INVESTIGATION_API } from '../config';
import { buildCodeForSessionBody } from '../utils/aiInvestigationClient';
import {
  getBrowserLanguage,
  getStoredSearchLanguage,
  normalizeLanguage,
} from '../utils/language';
import AIInvestigationGate from './AIInvestigationGate';

import { resilientFetch } from '../services/originFailover';

const POLL_INTERVAL = 15_000; // 15 seconds
const DD_PRICE_EUR = 22.50;
// Flask backend hosting the anonymous alert endpoint. Lives on rag.ncdata.eu
// behind the Nginx /bormes/* location block.
const ALERTS_API = 'https://rag.ncdata.eu/bormes/v3/alerts';

const SUPPORT_EMAIL = 'mapasocietario@ncdata.eu';

// Bilingual copy for the order/download page. The buyer reaches this page
// straight from checkout (and from the receipt-email link), so it follows the
// same language the visitor was using: ?lang → stored search language →
// browser → English. Keep keys in sync between en and es.
const ORDER_COPY = {
  en: {
    pageTitle: 'Order Status | Mapa Societario',
    heading: 'Order Status',
    verifying: 'Verifying your payment…',
    invalidSession: 'Invalid session ID.',
    contactPre: 'Please contact',
    contactPost: 'for assistance.',
    copyLink: 'Copy order link',
    copied: 'Copied!',
    // Buyer profile, asked only AFTER payment. It used to sit in the checkout
    // dialog; GA (28d to 2026-08-20) showed that dialog losing 74% of the
    // people who open it, so nothing optional belongs there.
    buyerRole: {
      title: 'One optional question',
      help: 'What are you using this report for? It helps us decide what future reports should lead with. Your report is already on its way and this changes nothing about it.',
      label: 'Best description',
      submit: 'Send',
      thanks: 'Thank you — that genuinely helps.',
      failed: 'Could not save that. No matter — your report is unaffected.',
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
    generating: {
      title: 'Generating your Due Diligence report',
      sub: 'This may take up to 60 seconds. Please do not close this page.',
      saveLink: 'You can save this page link to come back anytime within 7 days to re-download your report.',
      longerPre: 'Taking longer than 2 minutes? Email',
      longerPost: "with your order reference and we'll look into it.",
    },
    processing: {
      title: 'Your report is being prepared',
      fsSub: (year, fallback) =>
        `We are manually retrieving the ${year} financial statements from the Registro Mercantil. This usually takes 30-45 minutes. If they are unavailable, your preference is: ${fallback}.`,
      ddSub: 'Your report is being generated. This page will update automatically.',
      ddItemLabel: 'Due Diligence Report',
      ddItemDescFs: 'Includes LLM-powered financial analysis',
      ddItemDesc: 'AI-powered corporate analysis',
      fsItemLabel: 'Financial Statements (Cuentas Anuales)',
      fsItemDesc: (year) => `Official document from Registro Mercantil · ${year}`,
      emailNotice: 'We will send you an email when your report is ready. If the requested accounts are not available, we will contact you and handle the refund and tax adjustment according to your preference.',
      ddEmailNotice: "We're preparing your report — it will appear here and we'll email you when it's ready.",
      anyQuestionPre: 'Any question or concern? Email',
      anyQuestionPost: 'with your order reference — we usually reply within a few hours on business days.',
    },
    ready: {
      title: 'Your report is ready!',
      sub: 'Download links are available for 7 days.',
      downloadDd: 'Download Due Diligence Report',
      downloadHtml: 'Download interactive edition (HTML)',
      downloadFs: (year) => `Download Financial Statements (${year})`,
      searchAnother: 'Search another company',
      openAi: 'Open AI Investigation (2 days)',
    },
    aiCode: {
      label: 'Your AI Investigation code (valid 2 days):',
      hint: 'Keep it: this is the same code available from this page for the next 2 days.',
    },
    monitor: {
      activated: 'Monitoring activated',
      activatedPre: "We'll email you when there's new BORME corporate activity or a global regulator warning (IOSCO) for ",
      unsubscribe: 'One-click unsubscribe in every email. Free for as long as you stay subscribed.',
      titlePre: 'Monitor ',
      titlePost: ' for free',
      body: 'Get email alerts when BORME publishes corporate events (officer changes, capital moves, insolvency, dissolution, name changes) or when a global regulator flags the company via IOSCO.',
      start: 'Start free monitoring',
      enabling: 'Enabling…',
      sentTo: 'Sent to the email you used at checkout. One-click unsubscribe in every message.',
    },
    orderRef: 'Order reference:',
    footer: { home: 'Home', search: 'Search companies', contact: 'Contact support' },
    fsYearLatest: 'latest available',
    fallbackFullRefund: 'full refund if the accounts are unavailable',
    fallbackKeep: 'keep the Due Diligence report and refund the financial statements part',
  },
  es: {
    pageTitle: 'Estado del pedido | Mapa Societario',
    heading: 'Estado del pedido',
    verifying: 'Verificando tu pago…',
    invalidSession: 'ID de sesión no válido.',
    contactPre: 'Ponte en contacto con',
    contactPost: 'para obtener ayuda.',
    copyLink: 'Copiar enlace del pedido',
    copied: '¡Copiado!',
    // Perfil del comprador, preguntado solo DESPUÉS del pago. Ver la nota en la
    // versión inglesa: el diálogo de compra pierde al 74% de quien lo abre.
    buyerRole: {
      title: 'Una pregunta opcional',
      help: '¿Para qué vas a usar este informe? Nos ayuda a decidir con qué deberían empezar los próximos informes. Tu informe ya está en camino y esto no lo cambia en nada.',
      label: 'Qué te describe mejor',
      submit: 'Enviar',
      thanks: 'Gracias — nos ayuda de verdad.',
      failed: 'No se pudo guardar. No pasa nada: tu informe no se ve afectado.',
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
    generating: {
      title: 'Generando tu informe de Due Diligence',
      sub: 'Esto puede tardar hasta 60 segundos. Por favor, no cierres esta página.',
      saveLink: 'Puedes guardar el enlace de esta página para volver cuando quieras durante 7 días y descargar de nuevo tu informe. También lo tienes en el correo electrónico que te hemos enviado',
      longerPre: '¿Tarda más de 2 minutos? Escribe a',
      longerPost: 'con la referencia de tu pedido y lo revisaremos.',
    },
    processing: {
      title: 'Tu informe se está preparando',
      fsSub: (year, fallback) =>
        `Estamos recuperando manualmente las cuentas anuales de ${year} del Registro Mercantil. Esto suele tardar entre 30 y 45 minutos. Si no están disponibles, tu preferencia es: ${fallback}.`,
      ddSub: 'Tu informe se está generando. Esta página se actualizará automáticamente.',
      ddItemLabel: 'Informe de Due Diligence',
      ddItemDescFs: 'Incluye análisis financiero con IA',
      ddItemDesc: 'Análisis societario con IA',
      fsItemLabel: 'Cuentas Anuales',
      fsItemDesc: (year) => `Documento oficial del Registro Mercantil · ${year}`,
      emailNotice: 'Te enviaremos un email cuando tu informe esté listo. Si las cuentas solicitadas no están disponibles, te contactaremos y gestionaremos el reembolso y el ajuste fiscal según tu preferencia.',
      ddEmailNotice: 'Estamos preparando tu informe — aparecerá aquí y te avisaremos por email cuando esté listo.',
      anyQuestionPre: '¿Alguna pregunta o duda? Escribe a',
      anyQuestionPost: 'con la referencia de tu pedido — solemos responder en unas horas en días laborables.',
    },
    ready: {
      title: '¡Tu informe está listo!',
      sub: 'Los enlaces de descarga están disponibles durante 7 días.',
      downloadDd: 'Descargar informe de Due Diligence',
      downloadHtml: 'Descargar edición interactiva (HTML)',
      downloadFs: (year) => `Descargar Cuentas Anuales (${year})`,
      searchAnother: 'Buscar otra empresa',
      openAi: 'Abrir Investigación por IA (2 días)',
    },
    aiCode: {
      label: 'Tu código de Investigación por IA (válido 2 días):',
      hint: 'Guárdalo: es el mismo código disponible desde esta página durante los próximos 2 días.',
    },
    monitor: {
      activated: 'Monitorización activada',
      activatedPre: 'Te avisaremos por email cuando haya nueva actividad societaria en el BORME o una alerta de un regulador global (IOSCO) para ',
      unsubscribe: 'Cancela la suscripción con un clic en cada email. Gratis mientras sigas suscrito.',
      titlePre: 'Monitoriza ',
      titlePost: ' gratis',
      body: 'Recibe alertas por email cuando el BORME publique eventos societarios (cambios de administradores, movimientos de capital, concurso, disolución, cambios de nombre) o cuando un regulador global señale la empresa vía IOSCO.',
      start: 'Activar monitorización gratis',
      enabling: 'Activando…',
      sentTo: 'Se envía al email que usaste en el pago. Cancela la suscripción con un clic en cada mensaje.',
    },
    orderRef: 'Referencia del pedido:',
    footer: { home: 'Inicio', search: 'Buscar empresas', contact: 'Contacto' },
    fsYearLatest: 'las últimas disponibles',
    fallbackFullRefund: 'reembolso completo si las cuentas no están disponibles',
    fallbackKeep: 'conservar el informe de Due Diligence y reembolsar la parte de las cuentas anuales',
  },
};

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

  // Match the visitor's language the same way the rest of the site does. There
  // is no toggle here (transactional page) — we detect once on mount.
  const [language] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      normalizeLanguage(params.get('lang')) ||
      getStoredSearchLanguage() ||
      getBrowserLanguage() ||
      'en'
    );
  });
  const copy = ORDER_COPY[language] || ORDER_COPY.en;

  const [status, setStatus] = useState('verifying'); // verifying | generating | processing | ready | error
  const [errorMsg, setErrorMsg] = useState('');
  const [orderData, setOrderData] = useState(null); // verified payment data
  const [ddReportReady, setDdReportReady] = useState(false);
  const [financialStatementsReady, setFinancialStatementsReady] = useState(false);
  // The interactive edition is stored beside the PDF but is secondary: an
  // order is complete without it, so its absence hides the button and never
  // holds back the 'ready' state.
  const [htmlEditionReady, setHtmlEditionReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const generatingRef = React.useRef(false);
  const ga4FiredRef = React.useRef(false);
  const prevStatusRef = React.useRef(null);
  const orderDataRef = React.useRef(null);

  // Free-monitoring opt-in state (Day 1b anonymous flow).
  // Mapasocietario.es has no user accounts — anonymous DD buyers land
  // here after paying, and this card offers them free alerts on the
  // company they just bought a report on. Consent event = button click.
  const [aiGateOpen, setAiGateOpen] = useState(false);

  const [aiCode, setAiCode] = useState(null);

  // Post-purchase buyer profile. Asked here, never in the checkout dialog.
  const [buyerRole, setBuyerRole] = useState('');
  const [buyerRoleState, setBuyerRoleState] = useState('idle'); // idle | saving | done | error
  const [monitorState, setMonitorState] = useState('idle'); // idle | loading | success | error
  const [monitorError, setMonitorError] = useState('');
  const [monitorAlert, setMonitorAlert] = useState(null);

  const hasFinancialStatements = orderData?.options?.financialStatements === true;
  const financialStatementsYearLabel = formatFinancialStatementsYear(
    orderData?.options?.financialStatementsYear,
    copy
  );
  const financialStatementsFallbackLabel = formatFinancialStatementsFallback(
    orderData?.options?.financialStatementsFallback,
    copy
  );

  // Generate DD report, store in R2, then mark ready
  const generateReport = React.useCallback(async (data) => {
    if (generatingRef.current) return;
    generatingRef.current = true;

    try {
      setStatus('generating');

      let endpoint, body;
      if (data.country === 'uk') {
        endpoint = `${API_URL}/uk/dd-report/company`;
        body = { company_number: data.companyIdentifier, options: data.options || {} };
      } else if (data.country === 'fr') {
        endpoint = `${API_URL}/fr/dd-report/company`;
        body = { siren: data.companyIdentifier, options: data.options || {} };
      } else if (data.country === 'ch') {
        endpoint = `${API_URL}/ch/dd-report/company`;
        body = { chid: data.companyIdentifier, options: data.options || {} };
      } else if (data.country === 'it') {
        // companyIdentifier may be a VAT code or an OpenAPI.it company id;
        // the server's /it/dd-report/company endpoint introspects the
        // ``identifier`` field and runs IT-start if needed.
        endpoint = `${API_URL}/it/dd-report/company`;
        body = { identifier: data.companyIdentifier, options: data.options || {} };
      } else {
        throw new Error(`Unsupported country: ${data.country}`);
      }

      const reportRes = await resilientFetch(endpoint, {
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
      await resilientFetch(`${PAYMENTS_API}/api/stripe/store-dd-report?sessionId=${sessionId}`, {
        method: 'POST',
        body: blob,
      });

      // Track purchase in GA4. transaction_id lets GA4 deduplicate the event
      // when the buyer refreshes or revisits this page (a remount resets the
      // in-memory fired-guards, so without it every reload double-counts).
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'purchase', {
          transaction_id: sessionId,
          currency: 'EUR',
          value: DD_PRICE_EUR,
          items: [{ item_name: `DD Report — ${data.country?.toUpperCase()}`, item_category: 'Due Diligence', price: DD_PRICE_EUR, quantity: 1 }],
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
  // Fire-and-forget: this is a nicety, and a failure must never look like a
  // problem with the order the buyer just paid for.
  const submitBuyerRole = useCallback(async () => {
    if (!buyerRole || !sessionId) return;
    setBuyerRoleState('saving');
    try {
      const res = await resilientFetch(`${PAYMENTS_API}/api/stripe/set-order-intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, role: buyerRole }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBuyerRoleState('done');
    } catch (err) {
      console.warn('Buyer-role capture failed (non-fatal):', err);
      setBuyerRoleState('error');
    }
  }, [buyerRole, sessionId]);

  useEffect(() => {
    if (!sessionId || !/^cs_(test|live|free)_[A-Za-z0-9_]{10,}$/.test(sessionId)) {
      setStatus('error');
      setErrorMsg(copy.invalidSession);
      return;
    }

    (async () => {
      try {
        const res = await resilientFetch(`${PAYMENTS_API}/api/stripe/verify-dd-payment`, {
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
        } else if (data.country === 'es') {
          // ES DD-only order: the server generates in the background and emails the
          // buyer; just poll for reportReady (same path as FS orders).
          setStatus('processing');
        } else {
          // Non-ES DD-only order: generate synchronously (UK/FR/CH/IT)
          generateReport(data);
        }
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message);
      }
    })();
  }, [sessionId, generateReport, copy.invalidSession]);

  // Poll for readiness when processing (FS orders and ES DD-only orders)
  useEffect(() => {
    if (status !== 'processing') return;

    const poll = async () => {
      try {
        const res = await resilientFetch(`${PAYMENTS_API}/api/stripe/verify-dd-payment`, {
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
          const fsRes = await resilientFetch(
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

  // The interactive edition gets its OWN effect rather than riding on the poll
  // above, which returns immediately unless status === 'processing'. An order
  // page opened after the report finished never enters that loop, so the check
  // never ran and the button never appeared — which is exactly how it behaved
  // on the first real order.
  //
  // The two artifacts are stored back to back but not atomically (measured 0.4s
  // apart), so a first miss is retried a couple of times rather than treated as
  // absent. It never gates the ready state: an order is complete without it.
  React.useEffect(() => {
    if (!sessionId || !ddReportReady) return undefined;
    let cancelled = false;
    let attempts = 0;
    const check = async () => {
      try {
        const res = await resilientFetch(
          `${PAYMENTS_API}/api/stripe/get-dd-report?sessionId=${sessionId}&type=html`,
          { method: 'HEAD' }
        );
        if (cancelled) return;
        if (res.ok) {
          setHtmlEditionReady(true);
          return;
        }
      } catch {
        // fall through to the retry below
      }
      attempts += 1;
      if (!cancelled && attempts < 3) setTimeout(check, 4000);
    };
    check();
    return () => { cancelled = true; };
  }, [sessionId, ddReportReady]);

  // Keep the ref in sync with the latest orderData so effects that should not
  // re-run on every poll can read the current value via the ref instead.
  React.useEffect(() => { orderDataRef.current = orderData; }, [orderData]);

  // Self-heal: if a DD-only ES order is still processing after ~3 minutes,
  // re-trigger server-side generation (handles cases where the initial trigger
  // failed or the thread died silently).
  // Deps are [status, sessionId] only — polling updates orderData every 15s
  // which would otherwise reset the timer on every cycle, preventing it from
  // ever firing. The FS-order exclusion is read from the ref instead.
  React.useEffect(() => {
    if (status !== 'processing') return;
    if (orderDataRef.current?.options?.financialStatements) return; // FS waits for admin upload
    const t = setTimeout(() => {
      resilientFetch(`${PAYMENTS_API}/api/stripe/retrigger-dd-report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }, 3 * 60 * 1000);
    return () => clearTimeout(t);
  }, [status, sessionId]);

  // GA4 purchase event — fires once when a DD-only ES order transitions from
  // processing to ready (i.e. server generation just completed). Guarded by
  // ga4FiredRef so it cannot double-fire within a single page session.
  // prevStatusRef tracks the previous status so return visits (verifying →
  // ready, where the report was already in R2) do not trigger a duplicate event.
  // Deps are [status] only — including orderData would cause prevStatusRef to
  // be overwritten on every poll cycle, breaking the processing→ready transition
  // detection. Order fields are read from orderDataRef instead.
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (
      status === 'ready' &&
      prev === 'processing' &&
      !ga4FiredRef.current &&
      orderDataRef.current &&
      !orderDataRef.current.options?.financialStatements
    ) {
      ga4FiredRef.current = true;
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'purchase', {
          transaction_id: sessionId,
          currency: 'EUR',
          value: DD_PRICE_EUR,
          items: [{ item_name: `DD Report — ${orderDataRef.current?.country?.toUpperCase()}`, item_category: 'Due Diligence', price: DD_PRICE_EUR, quantity: 1 }],
        });
      }
    }
  }, [status]);

  // Fetch the AI Investigation redemption code as soon as the payment is
  // verified — the buyer waits on THIS page while the report generates, so the
  // code should appear here directly, not require opening the receipt email
  // (which only links back to this same page). The code is minted during Stripe
  // fulfillment; if it isn't queryable in the first moment, retry briefly.
  useEffect(() => {
    if (!sessionId || !orderData?.paid || aiCode) return;
    let cancelled = false;
    let attempts = 0;
    const fetchCode = async () => {
      attempts += 1;
      try {
        const res = await resilientFetch(`${AI_INVESTIGATION_API}/code-for-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildCodeForSessionBody(sessionId)),
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.code) { setAiCode(data.code); return; }
        }
        // 404 (older order) / 403 / not-yet-minted → fall through to retry.
      } catch { /* network — fall through to retry */ }
      if (!cancelled && attempts < 5) setTimeout(fetchCode, 3000);
    };
    fetchCode();
    return () => { cancelled = true; };
  }, [sessionId, orderData?.paid, aiCode]);

  const downloadFile = useCallback(async (type) => {
    const baseUrl = type === 'financial-statements'
      ? `${PAYMENTS_API}/api/stripe/get-dd-report?sessionId=${sessionId}&type=financial-statements`
      : type === 'html'
        ? `${PAYMENTS_API}/api/stripe/get-dd-report?sessionId=${sessionId}&type=html`
        : `${PAYMENTS_API}/api/stripe/get-dd-report?sessionId=${sessionId}`;

    const safeName = (orderData?.companyName || orderData?.companyIdentifier || 'report')
      .replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
    const date = new Date().toISOString().slice(0, 10);
    const langPrefix = (orderData?.options?.language || orderData?.country || 'ES').toUpperCase();
    const fileName = type === 'financial-statements'
      ? `Financial_Statements_${safeName}_${date}.pdf`
      : type === 'html'
        ? `${langPrefix}_DD_Report_${safeName}_${date}.html`
        : `${langPrefix}_DD_Report_${safeName}_${date}.pdf`;

    // Android WebView can't download blob: URLs or honour the <a download>
    // attribute, so the blob path below silently does nothing in the app.
    // Instead hand the real HTTPS URL to the WebView's DownloadListener
    // (MainActivity -> Android DownloadManager). The Worker echoes the
    // ?filename param into Content-Disposition so the saved file is named
    // correctly (DownloadManager has no JS context to read fileName).
    if (isAndroidNativeApp()) {
      const dlUrl = `${baseUrl}&filename=${encodeURIComponent(fileName)}`;
      const a = document.createElement('a');
      a.href = dlUrl;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    try {
      const res = await resilientFetch(baseUrl);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
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
      const res = await resilientFetch(`${ALERTS_API}/anonymous`, {
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

  // The 2-day AI Investigation code, shown in every post-payment state
  // (generating / processing / ready) so the waiting buyer sees it here and
  // never has to dig it out of the receipt email (which only links back here).
  const aiCodeBlock = aiCode ? (
    <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.3)' }}>
      <Typography variant="body2" color="text.secondary">
        {copy.aiCode.label}
      </Typography>
      <Typography variant="h6" sx={{ fontFamily: 'monospace', letterSpacing: 1 }}>{aiCode}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {copy.aiCode.hint}
      </Typography>
    </Box>
  ) : null;

  return (
    <>
      <Helmet>
        <title>{copy.pageTitle}</title>
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
            {copy.heading}
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
                {copy.verifying}
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
                {copy.contactPre}{' '}
                <Link href={`mailto:${SUPPORT_EMAIL}`} sx={{ color: 'primary.main' }}>
                  {SUPPORT_EMAIL}
                </Link>{' '}
                {copy.contactPost}
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
                    {copy.generating.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {copy.generating.sub}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <CircularProgress size={32} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Alert severity="info" variant="outlined" sx={{ '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
                  {copy.generating.saveLink}
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
                  {copied ? copy.copied : copy.copyLink}
                </Button>
                <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5 }}>
                  {copy.generating.longerPre}{' '}
                  <Link href={`mailto:${SUPPORT_EMAIL}`} sx={{ color: 'text.secondary' }}>{SUPPORT_EMAIL}</Link>
                  {' '}{copy.generating.longerPost}
                </Typography>
              </Box>
              {aiCodeBlock}
            </Box>
          )}

          {/* Processing */}
          {status === 'processing' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <HourglassTopIcon sx={{ color: 'warning.main', fontSize: 28 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {copy.processing.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {hasFinancialStatements
                      ? copy.processing.fsSub(financialStatementsYearLabel, financialStatementsFallbackLabel)
                      : copy.processing.ddSub}
                  </Typography>
                </Box>
              </Box>

              {/* Progress items */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 1 }}>
                <StatusItem
                  label={copy.processing.ddItemLabel}
                  icon={<DescriptionIcon sx={{ fontSize: 18 }} />}
                  ready={ddReportReady}
                  description={hasFinancialStatements
                    ? copy.processing.ddItemDescFs
                    : copy.processing.ddItemDesc}
                />
                {hasFinancialStatements && (
                  <StatusItem
                    label={copy.processing.fsItemLabel}
                    icon={<AccountBalanceIcon sx={{ fontSize: 18 }} />}
                    ready={financialStatementsReady}
                    description={copy.processing.fsItemDesc(financialStatementsYearLabel)}
                  />
                )}
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                <Alert severity="info" variant="outlined" sx={{ '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
                  {hasFinancialStatements ? copy.processing.emailNotice : copy.processing.ddEmailNotice}
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
                  {copied ? copy.copied : copy.copyLink}
                </Button>
                <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5 }}>
                  {copy.processing.anyQuestionPre}{' '}
                  <Link href={`mailto:${SUPPORT_EMAIL}`} sx={{ color: 'text.secondary' }}>{SUPPORT_EMAIL}</Link>
                  {' '}{copy.processing.anyQuestionPost}
                </Typography>
              </Box>
              {aiCodeBlock}
            </Box>
          )}

          {/* Ready */}
          {status === 'ready' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CheckCircleIcon sx={{ color: 'success.main', fontSize: 28 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {copy.ready.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {copy.ready.sub}
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
                  {copy.ready.downloadDd}
                </Button>

                {htmlEditionReady && (
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => downloadFile('html')}
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
                    {copy.ready.downloadHtml}
                  </Button>
                )}

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
                    {copy.ready.downloadFs(financialStatementsYearLabel)}
                  </Button>
                )}

                <Button
                  variant="text"
                  href="/app/"
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    color: 'text.secondary',
                    mt: 0.5,
                    '&:hover': { color: 'text.primary' },
                  }}
                >
                  {copy.ready.searchAnother}
                </Button>

                {/* AI Investigation — available to DD buyers for 2 days from purchase. */}
                {aiCodeBlock && <Box sx={{ mt: 1 }}>{aiCodeBlock}</Box>}
                <Button variant="outlined" sx={{ mt: 2 }} onClick={() => setAiGateOpen(true)}>
                  {copy.ready.openAi}
                </Button>
                <AIInvestigationGate
                  open={aiGateOpen}
                  onClose={() => setAiGateOpen(false)}
                  language={language}
                  prefillEmail={orderData?.customerEmail || ''}
                  prefillCode={aiCode || ''}
                />
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
                      {copy.monitor.activated}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {copy.monitor.activatedPre}
                      <strong>{monitorAlert?.entity_name || companyLabel}</strong>.
                    </Typography>
                  </Box>
                </Box>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', mt: 0.5 }}
                >
                  {copy.monitor.unsubscribe}
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
                      {copy.monitor.titlePre}{companyLabel}{copy.monitor.titlePost}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {copy.monitor.body}
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
                    ? copy.monitor.enabling
                    : copy.monitor.start}
                </Button>

                <Typography
                  variant="caption"
                  sx={{ color: 'text.disabled', textAlign: 'center' }}
                >
                  {copy.monitor.sentTo}
                </Typography>
              </Box>
            )}
          </Paper>
        )}

        {/* One optional question, asked only once the payment is verified. It
            deliberately does not live in the checkout dialog: that step loses
            74% of the people who reach it (GA, 28d to 2026-08-20), so the cost
            of a field there is real while here it is nil. Hidden once answered
            so a returning buyer is never asked twice. */}
        {orderData && (
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              p: 3,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            {buyerRoleState === 'done' ? (
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {copy.buyerRole.thanks}
              </Typography>
            ) : (
            <>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>
              {copy.buyerRole.title}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 2, lineHeight: 1.5 }}>
              {copy.buyerRole.help}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <TextField
                select
                size="small"
                label={copy.buyerRole.label}
                value={buyerRole}
                onChange={(e) => setBuyerRole(e.target.value)}
                sx={{ minWidth: 220, '& .MuiOutlinedInput-root': { fontSize: '0.85rem' } }}
              >
                {Object.entries(copy.buyerRole.roles).map(([value, label]) => (
                  <MenuItem key={value} value={value} sx={{ fontSize: '0.85rem' }}>{label}</MenuItem>
                ))}
              </TextField>
              <Button
                variant="outlined"
                onClick={submitBuyerRole}
                disabled={!buyerRole || buyerRoleState === 'saving'}
                sx={{ textTransform: 'none', mt: 0.25 }}
              >
                {copy.buyerRole.submit}
              </Button>
            </Box>
            {buyerRoleState === 'error' && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.disabled' }}>
                {copy.buyerRole.failed}
              </Typography>
            )}
            </>
            )}
          </Paper>
        )}

        {/* Order reference */}
        {sessionId && (
          <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center' }}>
            {copy.orderRef} {sessionId.slice(-12)}
          </Typography>
        )}

        {/* Footer nav */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', mt: 2 }}>
          <Link
            href="/"
            variant="caption"
            sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            {copy.footer.home}
          </Link>
          <Link
            href="/app/"
            variant="caption"
            sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            {copy.footer.search}
          </Link>
          <Link
            href={`mailto:${SUPPORT_EMAIL}`}
            variant="caption"
            sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            {copy.footer.contact}
          </Link>
        </Box>
      </Box>
    </>
  );
}

function formatFinancialStatementsYear(year, copy) {
  if (!year || year === 'latest') return copy.fsYearLatest;
  return String(year);
}

function formatFinancialStatementsFallback(fallback, copy) {
  if (fallback === 'full_refund') {
    return copy.fallbackFullRefund;
  }
  return copy.fallbackKeep;
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
