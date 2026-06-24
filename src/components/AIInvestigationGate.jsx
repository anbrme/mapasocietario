import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, Alert, CircularProgress,
} from '@mui/material';
import { AI_INVESTIGATION_API } from '../config';
import {
  buildRedeemBody, buildInvestigateHeaders, isTokenValid,
  buildInvestigatePayload, loadToken, saveToken,
} from '../utils/aiInvestigationClient';

// Cloudflare Turnstile sitekey for the ai-investigation widget.
const TURNSTILE_SITEKEY = '0x4AAAAAADp3WnZGNiZai_32';

const COPY = {
  en: {
    title: 'AI Investigation',
    intro: 'Enter the email you bought with and the code from your confirmation email. Access lasts 2 days from purchase.',
    email: 'Email', code: 'Redemption code', unlock: 'Unlock',
    ask: 'Ask about this company or network…', send: 'Ask', close: 'Close',
    invalid: 'Could not unlock. Check your email and code.',
    rateLimited: 'You have hit the rate limit. Try again shortly.',
    expired: 'Your session expired. Please redeem again.',
  },
  es: {
    title: 'Investigación por IA',
    intro: 'Introduce el email con el que compraste y el código de tu email de confirmación. El acceso dura 2 días desde la compra.',
    email: 'Email', code: 'Código de canje', unlock: 'Desbloquear',
    ask: 'Pregunta sobre esta empresa o red…', send: 'Preguntar', close: 'Cerrar',
    invalid: 'No se pudo desbloquear. Revisa tu email y código.',
    rateLimited: 'Has alcanzado el límite. Inténtalo en un momento.',
    expired: 'Tu sesión ha expirado. Vuelve a canjear.',
  },
};

export default function AIInvestigationGate({ open, onClose, language = 'es', prefillEmail = '', prefillCode = '', context = null }) {
  const t = COPY[language === 'en' ? 'en' : 'es'];
  const [email, setEmail] = useState(prefillEmail);
  useEffect(() => { setEmail(prefillEmail); }, [prefillEmail]);
  const [code, setCode] = useState(prefillCode);
  useEffect(() => { if (prefillCode) setCode(prefillCode); }, [prefillCode]);
  const [session, setSession] = useState(() => {
    const t = loadToken();
    return isTokenValid(t, Math.floor(Date.now() / 1000)) ? t : null;
  });

  // When the dialog (re)opens, refresh session from storage so a token
  // redeemed elsewhere (e.g. the order page) authorizes this instance.
  useEffect(() => {
    if (!open) return;
    const t = loadToken();
    if (isTokenValid(t, Math.floor(Date.now() / 1000))) setSession(t);
  }, [open]);
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
      if (!res.ok) {
        setError(t.invalid);
        if (window.turnstile && widgetId.current != null) window.turnstile.reset(widgetId.current);
        return;
      }
      const data = await res.json();
      const stored = { token: data.token, expiresAt: data.expires_at };
      saveToken(stored);
      setSession(stored);
    } catch {
      setError(t.invalid);
      if (window.turnstile && widgetId.current != null) window.turnstile.reset(widgetId.current);
    } finally {
      setBusy(false);
    }
  }, [email, code, t]);

  const ask = useCallback(async () => {
    if (!isTokenValid(session, Math.floor(Date.now() / 1000))) { setSession(null); setError(t.expired); return; }
    setBusy(true); setError(''); setAnswer(null);
    try {
      const res = await fetch(`${AI_INVESTIGATION_API}/investigate`, {
        method: 'POST',
        headers: buildInvestigateHeaders(session.token),
        body: JSON.stringify(buildInvestigatePayload({
          question,
          focus: context?.focus ?? null,
          entities: context?.entities ?? [],
          edges: context?.edges ?? [],
        })),
      });
      if (res.status === 429) { setError(t.rateLimited); return; }
      if (!res.ok) { setError(t.invalid); return; }
      setAnswer(await res.json());
    } catch {
      setError(t.invalid);
    } finally {
      setBusy(false);
    }
  }, [session, question, context, t]);

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
            {answer && (typeof answer.answer === 'object' && answer.answer !== null ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {answer.answer.summary && (
                  <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>{answer.answer.summary}</Typography>
                )}
                {answer.answer.registry && (
                  <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'rgba(25,118,210,0.08)', border: '1px solid rgba(25,118,210,0.3)' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#90caf9' }}>
                      {language === 'en' ? 'From the registry (BORME)' : 'Del registro (BORME)'}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{answer.answer.registry}</Typography>
                  </Box>
                )}
                {answer.answer.web && (
                  <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'rgba(255,167,38,0.08)', border: '1px solid rgba(255,167,38,0.3)' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#ffb74d' }}>
                      {language === 'en' ? 'Web / Press' : 'Web / Prensa'}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{answer.answer.web}</Typography>
                  </Box>
                )}
                {Array.isArray(answer.citations) && answer.citations.length > 0 && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      {language === 'en' ? 'Sources' : 'Fuentes'}
                    </Typography>
                    <Box component="ol" sx={{ pl: 2, m: 0.5 }}>
                      {answer.citations.map((c, i) => {
                        let safeUrl = null;
                        try {
                          const u = new URL(c.url);
                          if (u.protocol === 'https:' || u.protocol === 'http:') safeUrl = u.toString();
                        } catch { /* invalid URL → no link */ }
                        const label = c.title || c.url || '';
                        return (
                          <li key={c.url || c.n || i}>
                            {safeUrl
                              ? <a href={safeUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#90caf9' }}>{label}</a>
                              : <span style={{ color: '#9aa4b2' }}>{label}</span>}
                          </li>
                        );
                      })}
                    </Box>
                  </Box>
                )}
              </Box>
            ) : (
              <Alert severity="info">{answer.answer}</Alert>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t.close}</Button>
      </DialogActions>
    </Dialog>
  );
}
