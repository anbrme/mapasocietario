import React from 'react';
import { Box, Paper, IconButton, TextField, Typography, CircularProgress, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const STRINGS = {
  en: {
    tabLabel: 'Feedback',
    title: 'How are we doing?',
    placeholder: 'What would you improve?',
    submit: 'Send',
    thanks: 'Thanks! 🎉',
    error: "Couldn't send — try again.",
    close: 'Close',
    reactions: [
      { value: 'bad', emoji: '🙁', label: 'Not good' },
      { value: 'neutral', emoji: '😐', label: 'Neutral' },
      { value: 'good', emoji: '🙂', label: 'Good' },
    ],
  },
  es: {
    tabLabel: 'Opinión',
    title: '¿Qué te parece?',
    placeholder: '¿Qué mejorarías?',
    submit: 'Enviar',
    thanks: '¡Gracias! 🎉',
    error: 'No se pudo enviar — inténtalo de nuevo.',
    close: 'Cerrar',
    reactions: [
      { value: 'bad', emoji: '🙁', label: 'No muy bien' },
      { value: 'neutral', emoji: '😐', label: 'Neutral' },
      { value: 'good', emoji: '🙂', label: 'Bien' },
    ],
  },
};

const CLIENT_MAX_COMMENT_LENGTH = 500;
const THANKS_DISPLAY_MS = 2000;
const WIDGET_Z_INDEX = 1300;

// Bottom-right (not right-edge-centered) so it never collides with the
// existing full-height right-anchored panels (Ibex35MarketSidebar,
// ApoderadosSidebar), which only appear conditionally.
const FIXED_POSITION_SX = {
  position: 'fixed',
  right: 'calc(16px + env(safe-area-inset-right))',
  bottom: 'calc(16px + env(safe-area-inset-bottom))',
  zIndex: WIDGET_Z_INDEX,
};

const FeedbackWidget = ({ lang = 'en' }) => {
  const t = STRINGS[lang === 'es' ? 'es' : 'en'];
  const [open, setOpen] = React.useState(false);
  const [reaction, setReaction] = React.useState(null);
  const [comment, setComment] = React.useState('');
  const [honeypot, setHoneypot] = React.useState('');
  const [status, setStatus] = React.useState('idle'); // idle | submitting | submitted | error

  React.useEffect(() => {
    if (status !== 'submitted') return undefined;
    const timer = setTimeout(() => {
      setOpen(false);
      setStatus('idle');
      setReaction(null);
      setComment('');
    }, THANKS_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const canSubmit = Boolean(reaction || comment.trim());

  const handleSubmit = async () => {
    if (!canSubmit || status === 'submitting') return;
    setStatus('submitting');
    try {
      const res = await fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reaction,
          comment: comment.trim(),
          lang,
          page: window.location.pathname,
          honeypot,
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  };

  if (!open) {
    return (
      <Button
        variant="contained"
        onClick={() => setOpen(true)}
        sx={{
          ...FIXED_POSITION_SX,
          borderRadius: '20px',
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
        }}
      >
        {t.tabLabel}
      </Button>
    );
  }

  return (
    <Paper
      elevation={8}
      sx={{
        ...FIXED_POSITION_SX,
        width: 300,
        maxWidth: 'calc(100vw - 32px)',
        p: 2,
        borderRadius: '12px',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {t.title}
        </Typography>
        <IconButton size="small" aria-label={t.close} onClick={() => setOpen(false)}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {status === 'submitted' ? (
        <Typography variant="body2" sx={{ py: 2, textAlign: 'center' }}>
          {t.thanks}
        </Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 1.5 }}>
            {t.reactions.map(r => (
              <IconButton
                key={r.value}
                aria-label={r.label}
                onClick={() => setReaction(r.value)}
                sx={{
                  fontSize: '1.5rem',
                  border: '2px solid',
                  borderColor: reaction === r.value ? 'primary.main' : 'transparent',
                  bgcolor: reaction === r.value ? 'action.selected' : 'transparent',
                }}
              >
                {r.emoji}
              </IconButton>
            ))}
          </Box>

          <TextField
            multiline
            minRows={2}
            maxRows={4}
            fullWidth
            placeholder={t.placeholder}
            value={comment}
            onChange={e => setComment(e.target.value.slice(0, CLIENT_MAX_COMMENT_LENGTH))}
            size="small"
            sx={{ mb: 1 }}
          />

          {/* Honeypot: visually hidden off-screen, not display:none/type=hidden
              (the first things bots skip). Left blank by a human; a filled
              value tells the server to silently drop the submission. */}
          <Box
            component="input"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={e => setHoneypot(e.target.value)}
            sx={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            aria-hidden="true"
          />

          {status === 'error' && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
              {t.error}
            </Typography>
          )}

          <Button
            fullWidth
            variant="contained"
            disabled={!canSubmit || status === 'submitting'}
            onClick={handleSubmit}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {status === 'submitting' ? <CircularProgress size={16} color="inherit" /> : t.submit}
          </Button>
        </>
      )}
    </Paper>
  );
};

export default FeedbackWidget;
