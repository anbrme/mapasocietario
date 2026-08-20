/**
 * The manage page: everything one address monitors, in one place.
 *
 * Two states in one component, because they are the same page seen from
 * either side of the inbox:
 *
 *   no token  — a form asking where to send the link. This is the door for
 *               anyone who never received a digest, which is most self-serve
 *               subscribers: a view token is only minted when a digest goes
 *               out, so monitoring a quiet company meant being locked out.
 *   token     — the list, with a per-company "stop monitoring".
 *
 * The backend scopes the view by identity, not by how the alert was created,
 * so a Due Diligence buyer and someone who subscribed from the graph land on
 * the same page and see the same thing.
 *
 * Nothing here may confirm that an address is subscribed. The request form
 * gets the same answer either way, and the copy below says "if" for that
 * reason — a page that said "sent!" would answer "does this person use the
 * service?" for any address a stranger cared to type.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, TextField, CircularProgress, Paper, Divider, Chip, Alert,
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { fetchMonitoring, stopMonitoring, requestManageLink } from '../services/monitoringService';

const COPY = {
  en: {
    meta: 'Your monitoring | Mapa Societario',
    askTitle: 'Manage your monitoring',
    askBody:
      'Enter the address you used. If it monitors any company, we\'ll email a link to the page where you can see the filings and turn monitoring off.',
    emailLabel: 'Email address',
    send: 'Email me the link',
    sending: 'Sending…',
    // Deliberately conditional. See the file header.
    sentTitle: 'Check your inbox',
    sentBody:
      'If that address monitors anything, a link is on its way. It only works from that inbox, and it stays valid for 30 days.',
    invalidEmail: 'That doesn\'t look like an email address.',
    rateLimited: 'Too many requests right now. Please try again in a few minutes.',
    sendFailed: 'We couldn\'t send the link. Please try again in a moment.',
    loading: 'Loading your monitoring…',
    listTitle: 'Your monitoring',
    listBody: (n) =>
      n === 1 ? 'You are monitoring 1 company.' : `You are monitoring ${n} companies.`,
    emptyTitle: 'Nothing is being monitored',
    emptyBody:
      'This address has no active monitoring. You can start from any Spanish company in the graph — right-click it and choose "Monitor this company".',
    events: (n) => (n === 1 ? '1 event' : `${n} events`),
    noEvents: 'No filings picked up yet.',
    inactive: 'Stopped',
    stop: 'Stop monitoring',
    stopping: 'Stopping…',
    stopFailed: 'That didn\'t work. Please try again.',
    stoppedNote: 'Monitoring stopped. You can start it again from the company in the graph.',
    expiredTitle: 'This link is no longer valid',
    expiredBody:
      'Manage links last 30 days. Enter your address below and we\'ll send a fresh one.',
    backToGraph: 'Back to the graph',
    freeNote: 'Monitoring is free and runs until you stop it.',
  },
  es: {
    meta: 'Tu monitorización | Mapa Societario',
    askTitle: 'Gestiona tu monitorización',
    askBody:
      'Introduce la dirección que usaste. Si tiene alguna empresa monitorizada, te enviaremos un enlace a la página donde puedes ver los actos publicados y desactivarla.',
    emailLabel: 'Correo electrónico',
    send: 'Enviarme el enlace',
    sending: 'Enviando…',
    sentTitle: 'Revisa tu bandeja de entrada',
    sentBody:
      'Si esa dirección monitoriza algo, el enlace ya va de camino. Solo funciona desde ese buzón y es válido durante 30 días.',
    invalidEmail: 'Esto no parece una dirección de correo.',
    rateLimited: 'Demasiadas peticiones ahora mismo. Inténtalo de nuevo en unos minutos.',
    sendFailed: 'No hemos podido enviar el enlace. Inténtalo de nuevo en un momento.',
    loading: 'Cargando tu monitorización…',
    listTitle: 'Tu monitorización',
    listBody: (n) =>
      n === 1 ? 'Estás monitorizando 1 empresa.' : `Estás monitorizando ${n} empresas.`,
    emptyTitle: 'No hay nada monitorizado',
    emptyBody:
      'Esta dirección no tiene monitorización activa. Puedes empezar desde cualquier empresa española del grafo: haz clic derecho y elige «Monitorizar esta empresa».',
    events: (n) => (n === 1 ? '1 acto' : `${n} actos`),
    noEvents: 'Todavía no se ha detectado ningún acto.',
    inactive: 'Detenida',
    stop: 'Dejar de monitorizar',
    stopping: 'Deteniendo…',
    stopFailed: 'No ha funcionado. Inténtalo de nuevo.',
    stoppedNote: 'Monitorización detenida. Puedes reactivarla desde la empresa en el grafo.',
    expiredTitle: 'Este enlace ya no es válido',
    expiredBody:
      'Los enlaces de gestión duran 30 días. Introduce tu dirección y te enviaremos uno nuevo.',
    backToGraph: 'Volver al grafo',
    freeNote: 'La monitorización es gratuita y sigue activa hasta que la detengas.',
  },
};

const PANEL_SX = {
  p: { xs: 3, sm: 4 },
  maxWidth: 640,
  width: '100%',
  bgcolor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 2,
};

function AlertRow({ alert, copy, token, onStopped }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const events = Array.isArray(alert.events) ? alert.events : [];

  const handleStop = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await stopMonitoring(token, alert.id);
      onStopped(alert.id);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ py: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
            {alert.entity_name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {events.length ? copy.events(events.length) : copy.noEvents}
          </Typography>
        </Box>
        {alert.active ? (
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={busy}
            onClick={handleStop}
            sx={{ flexShrink: 0 }}
          >
            {busy ? copy.stopping : copy.stop}
          </Button>
        ) : (
          <Chip size="small" label={copy.inactive} sx={{ flexShrink: 0 }} />
        )}
      </Box>

      {events.slice(0, 5).map((event) => (
        <Typography
          key={event.id}
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, pl: 1.5, borderLeft: '2px solid rgba(255,255,255,0.12)', lineHeight: 1.5 }}
        >
          {event.title || event.event_type}
          {event.occurred_at && (
            <Typography component="span" variant="caption" sx={{ display: 'block', color: 'text.disabled' }}>
              {new Date(event.occurred_at).toLocaleDateString()}
            </Typography>
          )}
        </Typography>
      ))}

      {failed && (
        <Alert severity="error" sx={{ mt: 1.5 }}>{copy.stopFailed}</Alert>
      )}
    </Box>
  );
}

function RequestLinkForm({ copy, expired }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setState('sending');
    try {
      await requestManageLink(email);
      setState('sent');
    } catch (err) {
      setState('idle');
      if (err?.message === 'invalid_email') setError(copy.invalidEmail);
      else if (err?.message === 'rate_limited') setError(copy.rateLimited);
      else setError(copy.sendFailed);
    }
  };

  if (state === 'sent') {
    return (
      <>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <MarkEmailReadIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{copy.sentTitle}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {copy.sentBody}
        </Typography>
      </>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {expired ? <ErrorOutlineIcon color="warning" /> : <NotificationsActiveIcon color="primary" />}
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {expired ? copy.expiredTitle : copy.askTitle}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
        {expired ? copy.expiredBody : copy.askBody}
      </Typography>
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          type="email"
          label={copy.emailLabel}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={!!error}
          helperText={error || ' '}
          fullWidth
          size="small"
          autoComplete="email"
        />
        <Button type="submit" variant="contained" disabled={state === 'sending'}>
          {state === 'sending' ? copy.sending : copy.send}
        </Button>
      </Box>
    </>
  );
}

export default function AlertsManagePage({ lang = 'en' }) {
  const copy = COPY[lang] || COPY.en;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('t') || '';

  const [state, setState] = useState(token ? 'loading' : 'ask');
  const [alerts, setAlerts] = useState([]);
  const [stoppedOne, setStoppedOne] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('ask');
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchMonitoring(token);
        if (cancelled) return;
        setAlerts(result);
        setState('ready');
      } catch {
        // Expired, spent, or malformed all mean the same thing to the reader:
        // ask for a new link. A genuine outage lands here too, and the form is
        // a reasonable response to that as well.
        if (cancelled) return;
        setState('expired');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Reflect the change locally rather than refetching: the row is the only
  // thing that changed, and a refetch would flash the whole list.
  const handleStopped = useCallback((alertId) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, active: false } : a))
    );
    setStoppedOne(true);
  }, []);

  const appHref = lang === 'es' ? '/app/?lang=es' : '/app/';
  const activeCount = alerts.filter((a) => a.active).length;

  return (
    <>
      <Helmet htmlAttributes={{ lang }}>
        <title>{copy.meta}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Box sx={{ minHeight: '100vh', bgcolor: '#0a0e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, py: 6 }}>
        <Paper elevation={0} sx={PANEL_SX}>
          {state === 'loading' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">{copy.loading}</Typography>
            </Box>
          )}

          {(state === 'ask' || state === 'expired') && (
            <RequestLinkForm copy={copy} expired={state === 'expired'} />
          )}

          {state === 'ready' && alerts.length === 0 && (
            <>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{copy.emptyTitle}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
                {copy.emptyBody}
              </Typography>
            </>
          )}

          {state === 'ready' && alerts.length > 0 && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <NotificationsActiveIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{copy.listTitle}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {copy.listBody(activeCount)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {copy.freeNote}
              </Typography>

              {stoppedOne && (
                <Alert severity="success" sx={{ mt: 2 }}>{copy.stoppedNote}</Alert>
              )}

              <Divider sx={{ mt: 2 }} />
              {alerts.map((alert, i) => (
                <React.Fragment key={alert.id}>
                  {i > 0 && <Divider />}
                  <AlertRow alert={alert} copy={copy} token={token} onStopped={handleStopped} />
                </React.Fragment>
              ))}
              <Divider sx={{ mb: 3 }} />
            </>
          )}

          {state !== 'loading' && (
            <Button variant="contained" onClick={() => navigate(appHref)} sx={{ mt: 3 }}>
              {copy.backToGraph}
            </Button>
          )}
        </Paper>
      </Box>
    </>
  );
}
