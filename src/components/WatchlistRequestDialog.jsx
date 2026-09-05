/*
 * Mapa Societario — Programa de ordenador
 * Autor: Alessandro Nurnberg
 * Todos los derechos reservados.
 */
/**
 * Turn what is on the canvas into a named, monitored set.
 *
 * The graph is already a set-assembly tool — someone searches, expands and
 * prunes until the companies they care about are the ones on screen — so this
 * asks for a name and an address and nothing else. What goes in is what the
 * reader can see; the pruning already happened.
 *
 * Deliberately a sibling of MonitorRequestDialog rather than a mode of it. The
 * two differ in almost every line a reader sees (a set has a name, a size, a
 * cap and a list) and folding them together would leave one component whose
 * every paragraph is a conditional.
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Box, Button, TextField, Alert, CircularProgress, Chip,
} from '@mui/material';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import { requestWatchlist, MAX_WATCHLIST_COMPANIES } from '../services/monitoringService';
import { trackEvent } from '../utils/track';

// How many names to show before collapsing into "+N more". A set is meant to
// be glanced at here, not read: the reader assembled it and already knows what
// is in it. Showing forty names would turn a confirmation into a wall.
const NAMES_SHOWN = 8;

const COPY = {
  en: {
    title: 'Watch these companies',
    count: (n) => (n === 1 ? '1 company on the canvas' : `${n} companies on the canvas`),
    more: (n) => `+${n} more`,
    intro: 'Free email alerts when BORME publishes a corporate event for any company in this set — officer changes, capital moves, insolvency, dissolution, name changes.',
    labelLabel: 'Name this list',
    labelPlaceholder: 'e.g. Suppliers',
    emailLabel: 'Your email',
    consent: 'We will send you ONE email with a confirmation link. Watching starts only when you click it, and every alert carries a one-click unsubscribe.',
    submit: 'Send me the confirmation link',
    sending: 'Sending…',
    sentTitle: 'Check your inbox',
    sentBody: 'One confirmation link is on its way. Clicking it starts watching every company in the list at once.',
    close: 'Close',
    cancel: 'Cancel',
    tooLarge: `A list can hold up to ${MAX_WATCHLIST_COMPANIES} companies. Hide or remove some from the graph, then try again.`,
    empty: 'There are no companies on the canvas to watch yet.',
    invalidEmail: 'Enter a valid email address.',
    missingLabel: 'Give the list a name so you can tell it apart later.',
    rateLimited: 'Too many requests right now. Please try again later.',
    failed: 'Could not send the confirmation link. Please try again.',
  },
  es: {
    title: 'Vigilar estas empresas',
    count: (n) => (n === 1 ? '1 empresa en el lienzo' : `${n} empresas en el lienzo`),
    more: (n) => `+${n} más`,
    intro: 'Alertas gratuitas por correo cuando el BORME publique un acto societario de cualquier empresa de esta lista — cambios de administradores, movimientos de capital, concurso, disolución o cambios de denominación.',
    labelLabel: 'Nombra esta lista',
    labelPlaceholder: 'p. ej. Proveedores',
    emailLabel: 'Tu correo electrónico',
    consent: 'Te enviaremos UN solo correo con un enlace de confirmación. La vigilancia empieza solo cuando lo pulses, y cada alerta incluye baja con un clic.',
    submit: 'Enviarme el enlace de confirmación',
    sending: 'Enviando…',
    sentTitle: 'Revisa tu correo',
    sentBody: 'Un único enlace de confirmación está en camino. Al pulsarlo empezarás a vigilar todas las empresas de la lista a la vez.',
    close: 'Cerrar',
    cancel: 'Cancelar',
    tooLarge: `Una lista admite hasta ${MAX_WATCHLIST_COMPANIES} empresas. Oculta o elimina algunas del grafo e inténtalo de nuevo.`,
    empty: 'Todavía no hay empresas en el lienzo que vigilar.',
    invalidEmail: 'Introduce una dirección de correo válida.',
    missingLabel: 'Ponle un nombre a la lista para distinguirla más adelante.',
    rateLimited: 'Demasiadas solicitudes ahora mismo. Inténtalo de nuevo más tarde.',
    failed: 'No se ha podido enviar el enlace de confirmación. Inténtalo de nuevo.',
  },
};

export default function WatchlistRequestDialog({
  open,
  onClose,
  // [{ name, groupKey }] — the monitorable companies currently on the canvas.
  companies = [],
  language = 'en',
}) {
  const copy = COPY[language] || COPY.en;
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [errorKey, setErrorKey] = useState(null);

  // Reset per opening so a second request never shows the previous result.
  useEffect(() => {
    if (open) {
      setState('idle');
      setErrorKey(null);
    }
  }, [open]);

  const total = companies.length;
  const overCap = total > MAX_WATCHLIST_COMPANIES;
  const shown = companies.slice(0, NAMES_SHOWN);
  const hidden = Math.max(0, total - shown.length);

  const submit = async () => {
    setState('sending');
    setErrorKey(null);
    try {
      await requestWatchlist({ email, label, companies });
      trackEvent('watchlist_request_sent', { language, company_count: total });
      setState('sent');
    } catch (e) {
      if (e?.status === 429) setErrorKey('rateLimited');
      else if (e?.message === 'invalid_email') setErrorKey('invalidEmail');
      else if (e?.message === 'missing_label') setErrorKey('missingLabel');
      else if (e?.message === 'watchlist_too_large') setErrorKey('tooLarge');
      else if (e?.message === 'empty_watchlist') setErrorKey('empty');
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
            <BookmarksIcon color="warning" />
            {copy.title}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
              {copy.count(total)}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
              {shown.map((c) => (
                <Chip key={c.groupKey || c.name} label={c.name} size="small" variant="outlined" />
              ))}
              {hidden > 0 && (
                <Chip label={copy.more(hidden)} size="small" />
              )}
            </Box>
            {/* Said before the form, not after a failed submit: the reader can
                act on it (prune the graph) only while they still have one. */}
            {overCap && <Alert severity="warning" sx={{ mb: 2 }}>{copy.tooLarge}</Alert>}
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 2, lineHeight: 1.5 }}>
              {copy.intro}
            </Typography>
            <TextField
              autoFocus
              fullWidth
              size="small"
              label={copy.labelLabel}
              placeholder={copy.labelPlaceholder}
              value={label}
              disabled={busy || overCap}
              onChange={(e) => setLabel(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              size="small"
              type="email"
              label={copy.emailLabel}
              value={email}
              disabled={busy || overCap}
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
              disabled={busy || overCap || total === 0 || !email.trim() || !label.trim()}
              startIcon={busy ? <CircularProgress size={14} /> : <BookmarksIcon />}
            >
              {busy ? copy.sending : copy.submit}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
