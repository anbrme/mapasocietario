import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, Alert, CircularProgress,
} from '@mui/material';
import { AI_INVESTIGATION_API } from '../config';
import { buildRedeemBody, buildInvestigateHeaders, isTokenValid } from '../utils/aiInvestigationClient';

// Cloudflare Turnstile sitekey for the ai-investigation widget (from Task 6).
const TURNSTILE_SITEKEY = '1x00000000000000000000AA'; // REPLACE with the real sitekey

const COPY = {
  en: {
    title: 'AI Investigation',
    intro: 'Enter the email you bought with and the code from your confirmation email. Access lasts 2 days from purchase.',
    email: 'Email', code: 'Redemption code', unlock: 'Unlock',
    ask: 'Ask about this company or network…', send: 'Ask', close: 'Close',
    invalid: 'Could not unlock. Check your email and code.',
    rateLimited: 'You have hit the rate limit. Try again shortly.',
  },
  es: {
    title: 'Investigación por IA',
    intro: 'Introduce el email con el que compraste y el código de tu email de confirmación. El acceso dura 2 días desde la compra.',
    email: 'Email', code: 'Código de canje', unlock: 'Desbloquear',
    ask: 'Pregunta sobre esta empresa o red…', send: 'Preguntar', close: 'Cerrar',
    invalid: 'No se pudo desbloquear. Revisa tu email y código.',
    rateLimited: 'Has alcanzado el límite. Inténtalo en un momento.',
  },
};

export default function AIInvestigationGate({ open, onClose, language = 'es', prefillEmail = '' }) {
  const t = COPY[language === 'en' ? 'en' : 'es'];
  const [email, setEmail] = useState(prefillEmail);
  const [code, setCode] = useState('');
  const [session, setSession] = useState(null); // { token, expiresAt }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const turnstileRef = useRef(null);
  const widgetId = useRef(null);

  // Render the Turnstile widget when the dialog opens and we are not yet unlocked.
  useEffect(() => {
    if (!open || session) return;
    const id = setInterval(() => {
      if (window.turnstile && turnstileRef.current && widgetId.current == null) {
        widgetId.current = window.turnstile.render(turnstileRef.current, { sitekey: TURNSTILE_SITEKEY });
        clearInterval(id);
      }
    }, 200);
    return () => clearInterval(id);
  }, [open, session]);

  const redeem = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const turnstileToken = window.turnstile && widgetId.current != null
        ? window.turnstile.getResponse(widgetId.current) : '';
      const res = await fetch(`${AI_INVESTIGATION_API}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRedeemBody(email, code, turnstileToken)),
      });
      if (!res.ok) { setError(t.invalid); return; }
      const data = await res.json();
      setSession({ token: data.token, expiresAt: data.expires_at });
    } catch {
      setError(t.invalid);
    } finally {
      setBusy(false);
    }
  }, [email, code, t]);

  const ask = useCallback(async () => {
    if (!isTokenValid(session, Math.floor(Date.now() / 1000))) { setSession(null); return; }
    setBusy(true); setError(''); setAnswer(null);
    try {
      const res = await fetch(`${AI_INVESTIGATION_API}/investigate`, {
        method: 'POST',
        headers: buildInvestigateHeaders(session.token),
        body: JSON.stringify({ question }),
      });
      if (res.status === 429) { setError(t.rateLimited); return; }
      if (!res.ok) { setError(t.invalid); return; }
      setAnswer(await res.json());
    } catch {
      setError(t.invalid);
    } finally {
      setBusy(false);
    }
  }, [session, question, t]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: '#121828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 } }}>
      <DialogTitle>{t.title}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!session ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">{t.intro}</Typography>
            <TextField label={t.email} value={email} onChange={(e) => setEmail(e.target.value)} fullWidth size="small" />
            <TextField label={t.code} value={code} onChange={(e) => setCode(e.target.value)} fullWidth size="small" />
            <div ref={turnstileRef} />
            <Button variant="contained" onClick={redeem} disabled={busy || !email || !code}>
              {busy ? <CircularProgress size={20} /> : t.unlock}
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label={t.ask} value={question} onChange={(e) => setQuestion(e.target.value)}
              fullWidth multiline minRows={2} size="small" />
            <Button variant="contained" onClick={ask} disabled={busy || !question}>
              {busy ? <CircularProgress size={20} /> : t.send}
            </Button>
            {answer && (
              <Alert severity={answer.stub ? 'info' : 'success'}>
                {answer.answer}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t.close}</Button>
      </DialogActions>
    </Dialog>
  );
}
