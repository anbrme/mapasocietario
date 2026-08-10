import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Box, Button, TextField, Alert, CircularProgress,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import { requestMonitoring } from '../services/monitoringService';
import { trackEvent } from '../utils/track';

const COPY = {
  en: {
    title: 'Monitor this company',
    intro: 'Free email alerts when BORME publishes a corporate event — officer changes, capital moves, insolvency, dissolution, name changes — or when a global regulator flags the company via IOSCO.',
    emailLabel: 'Your email',
    // Says plainly that nothing happens without the click, so the wait for an
    // email is expected rather than read as a failure.
    consent: 'We will send you one email with a confirmation link. Monitoring starts only when you click it, and every alert carries a one-click unsubscribe.',
    submit: 'Send me the confirmation link',
    sending: 'Sending…',
    cancel: 'Cancel',
    sentTitle: 'Check your inbox',
    sentBody: 'If that address can receive mail, a confirmation link is on its way. Monitoring starts when you click it.',
    close: 'Close',
    invalidEmail: 'Enter a valid email address.',
    rateLimited: 'Too many requests right now. Please try again a little later.',
    failed: 'Could not send the confirmation link. Please try again.',
  },
  es: {
    title: 'Monitorizar esta empresa',
    intro: 'Alertas gratuitas por correo cuando el BORME publique un acto societario — cambios de administradores, movimientos de capital, concurso, disolución, cambios de denominación — o cuando un regulador global señale a la empresa vía IOSCO.',
    emailLabel: 'Tu correo electrónico',
    consent: 'Te enviaremos un correo con un enlace de confirmación. La monitorización empieza solo cuando lo pulses, y cada alerta incluye baja con un clic.',
    submit: 'Enviarme el enlace de confirmación',
    sending: 'Enviando…',
    cancel: 'Cancelar',
    sentTitle: 'Revisa tu bandeja de entrada',
    sentBody: 'Si esa dirección puede recibir correo, el enlace de confirmación va en camino. La monitorización empieza cuando lo pulses.',
    close: 'Cerrar',
    invalidEmail: 'Introduce una dirección de correo válida.',
    rateLimited: 'Demasiadas solicitudes ahora mismo. Inténtalo de nuevo más tarde.',
    failed: 'No se ha podido enviar el enlace de confirmación. Inténtalo de nuevo.',
  },
};

export default function MonitorRequestDialog({
  open,
  onClose,
  companyName,
  jurisdiction = 'ES',
  language = 'en',
}) {
  const copy = COPY[language] || COPY.en;
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [errorKey, setErrorKey] = useState(null);

  // Reset per company so a second request never shows the previous result.
  useEffect(() => {
    if (open) {
      setState('idle');
      setErrorKey(null);
    }
  }, [open, companyName]);

  const submit = async () => {
    setState('sending');
    setErrorKey(null);
    try {
      await requestMonitoring({ email, entityName: companyName, jurisdiction });
      trackEvent('monitor_request_sent', { language });
      setState('sent');
    } catch (e) {
      if (e?.status === 429) setErrorKey('rateLimited');
      else if (e?.message === 'invalid_email') setErrorKey('invalidEmail');
      else setErrorKey('failed');
      setState('error');
    }
  };

  const busy = state === 'sending';

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      {state === 'sent' ? (
        <>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MarkEmailReadIcon color="success" />
            {copy.sentTitle}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">{copy.sentBody}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} variant="contained">{copy.close}</Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsActiveIcon color="warning" />
            {copy.title}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>{companyName}</Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 2, lineHeight: 1.5 }}>
              {copy.intro}
            </Typography>
            <TextField
              autoFocus
              fullWidth
              size="small"
              type="email"
              label={copy.emailLabel}
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !busy) submit(); }}
            />
            {errorKey && <Alert severity="error" sx={{ mt: 2 }}>{copy[errorKey]}</Alert>}
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                {copy.consent}
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={busy}>{copy.cancel}</Button>
            <Button
              onClick={submit}
              variant="contained"
              disabled={busy || !email.trim()}
              startIcon={busy ? <CircularProgress size={14} /> : <NotificationsActiveIcon />}
            >
              {busy ? copy.sending : copy.submit}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
