/**
 * Landing page for the monitoring confirmation link (/alerts/activate?t=…).
 *
 * This is the click that turns a request into a subscription — the backend
 * creates the alert inert and only this page's call flips it live. It lives in
 * mapasocietario rather than being borrowed from NC Data's copy because the
 * reader was last on mapasocietario.es, and a confirmation link that lands on
 * an unfamiliar domain reads as phishing.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress, Paper } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { activateMonitoring } from '../services/monitoringService';
import { trackEvent } from '../utils/track';

const COPY = {
  en: {
    title: 'Confirm monitoring | Mapa Societario',
    working: 'Confirming…',
    okTitle: 'Monitoring is on',
    okBody: (name) =>
      `You're now monitoring ${name || 'this company'}. We'll email you when BORME publishes a corporate event — officer changes, capital moves, insolvency, dissolution, name changes — or when a global regulator flags it via IOSCO.`,
    okNote: 'Alerts only arrive when something actually happens; we never send empty digests. Every email has one-click unsubscribe.',
    failTitle: "We couldn't confirm this link",
    failBody: 'Confirmation links work once and expire after 60 minutes. If yours has expired, just ask for monitoring again from the company in the graph.',
    backToGraph: 'Back to the graph',
  },
  es: {
    title: 'Confirmar monitorización | Mapa Societario',
    working: 'Confirmando…',
    okTitle: 'Monitorización activada',
    okBody: (name) =>
      `Ya estás monitorizando ${name || 'esta empresa'}. Te avisaremos por correo cuando el BORME publique un acto societario — cambios de administradores, movimientos de capital, concurso, disolución, cambios de denominación — o cuando un regulador global la señale vía IOSCO.`,
    okNote: 'Las alertas solo llegan cuando ocurre algo; nunca enviamos resúmenes vacíos. Cada correo incluye baja con un clic.',
    failTitle: 'No hemos podido confirmar este enlace',
    failBody: 'Los enlaces de confirmación sirven una sola vez y caducan a los 60 minutos. Si el tuyo ha caducado, vuelve a solicitar la monitorización desde la empresa en el grafo.',
    backToGraph: 'Volver al grafo',
  },
};

export default function AlertActivatePage({ lang = 'en' }) {
  const copy = COPY[lang] || COPY.en;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('t') || '';

  const [state, setState] = useState('working'); // working | ok | failed
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await activateMonitoring(token);
        if (cancelled) return;
        setCompanyName(result?.alert?.entity_name || result?.entity_name || '');
        setState('ok');
        // The request event measures intent; this is the retained-user outcome.
        // Do not send the company name or token to analytics.
        trackEvent('monitor_activated', {
          language: lang,
          activation_source: 'email_confirmation',
        });
      } catch {
        if (cancelled) return;
        // Expired, already used and missing all look identical to the reader,
        // and the recovery is the same in every case: ask again from the graph.
        setState('failed');
      }
    })();
    return () => { cancelled = true; };
  }, [token, lang]);

  const appHref = lang === 'es' ? '/app?lang=es' : '/app';

  return (
    <>
      <Helmet htmlAttributes={{ lang }}>
        <title>{copy.title}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Box sx={{ minHeight: '100vh', bgcolor: '#0a0e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
        <Paper elevation={0} sx={{ p: 4, maxWidth: 520, width: '100%', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 2 }}>
          {state === 'working' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">{copy.working}</Typography>
            </Box>
          )}

          {state === 'ok' && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <MarkEmailReadIcon color="success" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{copy.okTitle}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                {copy.okBody(companyName)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3, lineHeight: 1.5 }}>
                {copy.okNote}
              </Typography>
              <Button variant="contained" onClick={() => navigate(appHref)}>{copy.backToGraph}</Button>
            </>
          )}

          {state === 'failed' && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ErrorOutlineIcon color="warning" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{copy.failTitle}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
                {copy.failBody}
              </Typography>
              <Button variant="contained" onClick={() => navigate(appHref)}>{copy.backToGraph}</Button>
            </>
          )}
        </Paper>
      </Box>
    </>
  );
}
