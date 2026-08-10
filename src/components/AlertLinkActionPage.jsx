/**
 * Landing page for the unsubscribe and resubscribe magic links carried in every
 * alert digest.
 *
 * One component for both actions: the layout, the token handling and the three
 * outcomes are identical, and only the copy and the call differ. It lives in
 * mapasocietario because a digest sent to a self-serve subscriber now links
 * here — an unsubscribe link pointing at a domain the reader does not
 * recognise gets reported as spam rather than followed.
 *
 * The backend's /unsubscribe endpoint accepts both the per-alert and the
 * unsubscribe-all token purposes and dispatches on whichever it matched, so
 * this page does not need to know which kind of link was clicked.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress, Paper } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import UnsubscribeIcon from '@mui/icons-material/Unsubscribe';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { unsubscribeWithToken, resubscribeWithToken } from '../services/monitoringService';

const COPY = {
  en: {
    unsubscribe: {
      meta: 'Unsubscribe | Mapa Societario',
      working: 'Unsubscribing…',
      okTitle: 'You will not receive these alerts again',
      okBody: (name) =>
        `Monitoring is off${name ? ` for ${name}` : ''}. No further emails about it will be sent.`,
      okNote: 'Changed your mind? You can start monitoring again any time from the company in the graph.',
    },
    resubscribe: {
      meta: 'Resume alerts | Mapa Societario',
      working: 'Turning alerts back on…',
      okTitle: 'Alerts are back on',
      okBody: (name) =>
        `You're monitoring ${name || 'this company'} again. We'll email you when BORME publishes a corporate event or a regulator flags it via IOSCO.`,
      okNote: 'Every alert still carries a one-click unsubscribe.',
    },
    failTitle: "This link didn't work",
    failBody:
      'The link may be malformed or no longer valid. You can always manage monitoring from the company in the graph.',
    backToGraph: 'Back to the graph',
  },
  es: {
    unsubscribe: {
      meta: 'Baja de alertas | Mapa Societario',
      working: 'Dando de baja…',
      okTitle: 'No volverás a recibir estas alertas',
      okBody: (name) =>
        `La monitorización está desactivada${name ? ` para ${name}` : ''}. No se enviarán más correos al respecto.`,
      okNote: '¿Has cambiado de opinión? Puedes volver a activarla cuando quieras desde la empresa en el grafo.',
    },
    resubscribe: {
      meta: 'Reanudar alertas | Mapa Societario',
      working: 'Reactivando las alertas…',
      okTitle: 'Alertas reactivadas',
      okBody: (name) =>
        `Vuelves a monitorizar ${name || 'esta empresa'}. Te avisaremos cuando el BORME publique un acto societario o un regulador la señale vía IOSCO.`,
      okNote: 'Cada alerta sigue incluyendo baja con un clic.',
    },
    failTitle: 'Este enlace no ha funcionado',
    failBody:
      'Puede que el enlace esté mal formado o ya no sea válido. Siempre puedes gestionar la monitorización desde la empresa en el grafo.',
    backToGraph: 'Volver al grafo',
  },
};

export default function AlertLinkActionPage({ action = 'unsubscribe', lang = 'en' }) {
  const root = COPY[lang] || COPY.en;
  const copy = root[action] || root.unsubscribe;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('t') || '';

  const [state, setState] = useState('working'); // working | ok | failed
  const [entityName, setEntityName] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const call = action === 'resubscribe' ? resubscribeWithToken : unsubscribeWithToken;
        const result = await call(token);
        if (cancelled) return;
        setEntityName(result?.alert?.entity_name || result?.entity_name || '');
        setState('ok');
      } catch {
        if (cancelled) return;
        setState('failed');
      }
    })();
    return () => { cancelled = true; };
  }, [token, action]);

  const appHref = lang === 'es' ? '/app?lang=es' : '/app';
  const OkIcon = action === 'resubscribe' ? NotificationsActiveIcon : UnsubscribeIcon;

  return (
    <>
      <Helmet htmlAttributes={{ lang }}>
        <title>{copy.meta}</title>
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
                <OkIcon color={action === 'resubscribe' ? 'success' : 'primary'} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{copy.okTitle}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                {copy.okBody(entityName)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3, lineHeight: 1.5 }}>
                {copy.okNote}
              </Typography>
              <Button variant="contained" onClick={() => navigate(appHref)}>{root.backToGraph}</Button>
            </>
          )}

          {state === 'failed' && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ErrorOutlineIcon color="warning" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{root.failTitle}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
                {root.failBody}
              </Typography>
              <Button variant="contained" onClick={() => navigate(appHref)}>{root.backToGraph}</Button>
            </>
          )}
        </Paper>
      </Box>
    </>
  );
}
