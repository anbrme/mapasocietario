/**
 * The representative's acceptance screen (/verificacion/confirmar?t=...).
 *
 * Modelled on AlertActivatePage, which already handles the token-in-query
 * pattern. Two rules shape it:
 *
 *  - It NEVER assembles a statement locally. Every fact change is sent to
 *    /api/verify/draft, which persists a new draft and returns its hash; the
 *    screen then displays that. Acceptance always references a draft the server
 *    recorded showing them.
 *  - A 409 from submit means the registry moved while they were reading. They
 *    are not bound to a statement they did not see: the new draft replaces the
 *    old one and they are asked again.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Button, CircularProgress, Paper, Checkbox, FormControlLabel,
  TextField, RadioGroup, Radio, Alert, Divider,
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { uiModeFor, statusForMode, factLabel, displayValue } from '../verify/factUi.js';

const COPY = {
  es: {
    title: 'Confirmar datos registrales | Mapa Societario',
    loading: 'Cargando la declaración…',
    heading: 'Confirmación de vigencia',
    intro: (company) => `Revise cada dato de ${company}. Puede confirmarlo, corregirlo o marcarlo como no aplicable.`,
    seat: 'Cargo registral',
    confirm: 'Es correcto', correct: 'Corregir', na: 'No aplica',
    consentsTitle: 'Lo que usted declara',
    consentsLead: 'Estas tres declaraciones son el contenido jurídico de la confirmación. Léalas antes de marcarlas.',
    privacyLink: 'Política de privacidad de la verificación',
    correctedValue: 'Valor correcto',
    consentAuthority: 'Declaro que ostento la autoridad indicada para hacer esta declaración en nombre de la sociedad.',
    consentPublication: 'Consiento la publicación de esta declaración con mi nombre y cargo registral.',
    consentReconfirmation: 'Me comprometo a responder a las solicitudes de reconfirmación.',
    submit: 'Aceptar y enviar',
    submitting: 'Enviando…',
    received: 'Recibido. Su declaración está en revisión y todavía no está publicada.',
    stale: 'El registro cambió mientras revisaba. Esta es la declaración actualizada: compruébela de nuevo antes de aceptar.',
    failed: 'No hemos podido cargar esta declaración. Los enlaces caducan a las 72 horas.',
    consentsRequired: 'Marque las tres declaraciones para continuar.',
    editFailed: 'No hemos podido guardar ese cambio. Inténtelo de nuevo.',
    editRetry: 'Hemos recargado la declaración. Revise sus correcciones antes de aceptar.',
    already: 'Esta invitación ya se utilizó.',
    privacyTitle: 'Qué conservamos',
    privacy: 'Conservamos la declaración, la evidencia registral del momento y su nombre y cargo (ya públicos en el BORME) mientras la declaración sea consultable. Su correo y la nota de identificación se guardan por separado y puede solicitar su supresión escribiendo a mapasocietario@ncdata.eu.',
    notice: 'Mapa Societario deja constancia de quién hace esta declaración y revisa su autoridad. No verifica su identidad ni certifica que la declaración sea cierta.',
  },
  en: {
    title: 'Confirm registry data | Mapa Societario',
    loading: 'Loading the statement…',
    heading: 'Currency confirmation',
    intro: (company) => `Review each fact about ${company}. You can confirm it, correct it, or mark it not applicable.`,
    seat: 'Registry position',
    confirm: 'Correct', correct: 'Amend', na: 'Not applicable',
    consentsTitle: 'What you are declaring',
    consentsLead: 'These three declarations are the legal substance of the confirmation. Please read them before ticking.',
    privacyLink: 'Verification privacy policy',
    correctedValue: 'Correct value',
    consentAuthority: 'I hold the stated authority to make this statement on behalf of the company.',
    consentPublication: 'I consent to publication of this statement with my name and registry position.',
    consentReconfirmation: 'I will respond to reconfirmation requests.',
    submit: 'Accept and send',
    submitting: 'Sending…',
    received: 'Received. Your statement is under review and is not yet published.',
    stale: 'The registry record changed while you were reviewing. Here is the updated statement — please check it again before accepting.',
    failed: "We couldn't load this statement. Links expire after 72 hours.",
    consentsRequired: 'Tick all three declarations to continue.',
    editFailed: "We couldn't save that change. Please try again.",
    editRetry: 'We reloaded the statement. Please check your corrections before accepting.',
    already: 'This invitation has already been used.',
    privacyTitle: 'What we keep',
    privacy: 'We keep the statement, the registry evidence as at that moment, and your name and position (already public in BORME) for as long as the statement is readable. Your email address and the identification note are stored separately and you can request their erasure at mapasocietario@ncdata.eu.',
    notice: 'Mapa Societario records who makes this statement and reviews their authority. It does not verify your identity, and it does not certify that the statement is true.',
  },
};

const CONSENT_KEYS = ['authority', 'publication', 'reconfirmation'];

export default function VerificationConfirmPage({ lang = 'es' }) {
  const t = COPY[lang] || COPY.es;
  const [params] = useSearchParams();
  const token = params.get('t') || '';

  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);      // { draft_hash, assertion, company_name, seat }
  const [consents, setConsents] = useState({});
  const [staleNotice, setStaleNotice] = useState(false);
  // The status the REGISTRY derived for each fact, captured once. Confirming a
  // fact restores this rather than forcing 'current' - insolvency derives
  // 'none', and forcing 'current' declared insolvency in force on a solvent
  // company.
  const [derived, setDerived] = useState({});
  // Edits are serialised: two in flight from the same base_hash would each carry
  // only their own correction, and whichever landed last would drop the other.
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!token) { setState('failed'); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/verify/session?t=${encodeURIComponent(token)}`);
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok || !data.ok) { setState('failed'); return; }
        if (data.already_submitted) { setState('already'); return; }
        setDerived(Object.fromEntries(
          (data.assertion?.facts || []).map((f) => [f.fact_key, f.declared_status])));
        setDraft(data);
        setState('reviewing');
      } catch { if (!cancelled) setState('failed'); }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Any change to a fact goes to the server, which persists a NEW draft and
  // supersedes the old one. The screen only ever shows a server-held draft.
  const editFact = useCallback(async (factKey, declaredStatus, declaredValue) => {
    if (!draft || editing) return;
    setEditing(true); setError('');
    try {
    const r = await fetch('/api/verify/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        t: token, base_hash: draft.draft_hash,
        edits: [{ fact_key: factKey, declared_status: declaredStatus,
                  declared_value: declaredValue ?? null }],
      }),
    });
    const data = await r.json();
    if (r.ok && data.ok) {
      setDraft((d) => ({ ...d, draft_hash: data.draft_hash, assertion: data.assertion }));
      return;
    }
    // Silence here meant the radio reverted with no explanation and the
    // representative could reasonably believe the correction had been recorded.
    if (data.error === 'draft_superseded') {
      const again = await fetch(`/api/verify/session?t=${encodeURIComponent(token)}`);
      const fresh = await again.json();
      if (again.ok && fresh.ok && fresh.draft_hash) { setDraft(fresh); setError(t.editRetry); return; }
    }
    setError(t.editFailed);
    } catch {
      setError(t.editFailed);
    } finally {
      setEditing(false);
    }
  }, [draft, token, editing, t]);

  const submit = useCallback(async () => {
    if (!CONSENT_KEYS.every((k) => consents[k])) { setError(t.consentsRequired); return; }
    setState('submitting'); setError('');
    const r = await fetch('/api/verify/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ t: token, draft_hash: draft.draft_hash, consents }),
    });
    const data = await r.json();
    if (r.status === 409 && data.error === 'registry_changed') {
      // Never resubmit the old hash: they have not seen this version.
      setDraft((d) => ({ ...d, draft_hash: data.draft_hash, assertion: data.assertion }));
      setStaleNotice(true); setState('reviewing');
      return;
    }
    if (!r.ok || !data.ok) { setError(data.error || 'failed'); setState('reviewing'); return; }
    setState('received');
  }, [consents, draft, token, t]);

  if (state === 'loading') {
    return <Centered><CircularProgress size={22} /><Typography sx={{ mt: 2 }}>{t.loading}</Typography></Centered>;
  }
  if (state === 'failed') return <Centered><Alert severity="error">{t.failed}</Alert></Centered>;
  if (state === 'already') return <Centered><Alert severity="info">{t.already}</Alert></Centered>;
  if (state === 'received') return <Centered><Alert severity="success">{t.received}</Alert></Centered>;

  const facts = draft?.assertion?.facts || [];

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', p: { xs: 2, sm: 4 } }}>
      <Helmet><title>{t.title}</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <Typography variant="h5" gutterBottom>{t.heading}</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>{t.intro(draft.company_name)}</Typography>
      <Typography variant="body2" sx={{ mb: 3 }}>
        <strong>{t.seat}:</strong> {draft.seat?.name} — {draft.seat?.position}
      </Typography>

      {staleNotice && <Alert severity="warning" sx={{ mb: 2 }}>{t.stale}</Alert>}

      {facts.map((f) => (
        <Paper key={f.fact_key} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
          <Typography variant="subtitle2">{factLabel(f.fact_key, lang)}</Typography>
          <Typography variant="body2" sx={{ mb: 1, opacity: 0.85 }}>
            {displayValue(f.fact_key, f.declared_value, lang)}
          </Typography>
          <RadioGroup
            row
            value={uiModeFor(f.declared_status)}
            onChange={(e) => editFact(
              f.fact_key,
              statusForMode(e.target.value, derived[f.fact_key]),
              f.declared_value,
            )}
          >
            <FormControlLabel value="confirm" control={<Radio size="small" />} label={t.confirm} />
            <FormControlLabel value="correct" control={<Radio size="small" />} label={t.correct} />
            <FormControlLabel value="na" control={<Radio size="small" />} label={t.na} />
          </RadioGroup>
          {f.declared_status === 'corrected' && (
            <TextField
              fullWidth size="small" sx={{ mt: 1 }} label={t.correctedValue}
              defaultValue={f.declared_value || ''}
              onBlur={(e) => editFact(f.fact_key, 'corrected', e.target.value)}
            />
          )}
        </Paper>
      ))}

      <Divider sx={{ my: 3 }} />

      {/* The declarations are the legal substance of the whole exercise, so they
          are framed as such rather than trailing the form as three checkboxes
          someone scrolls past on the way to the button. */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5, mb: 2, borderWidth: 2, borderColor: 'primary.main' }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t.consentsTitle}</Typography>
        <Typography variant="body2" sx={{ mb: 1.5, opacity: 0.85 }}>{t.consentsLead}</Typography>
        {CONSENT_KEYS.map((key) => (
          <FormControlLabel
            key={key}
            sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.25, ml: 0 }}
            control={<Checkbox sx={{ pt: 0 }} checked={!!consents[key]}
              onChange={(e) => setConsents((c) => ({ ...c, [key]: e.target.checked }))} />}
            label={<Typography variant="body2">
              {t[`consent${key[0].toUpperCase()}${key.slice(1)}`]}
            </Typography>}
          />
        ))}
      </Paper>

      {/* The notice sits beside the button, never only behind a link: someone
          attesting to their own company's data should see what is kept at the
          moment they decide. The full policy is linked for the detail. */}
      <Paper variant="outlined" sx={{ p: 2, my: 2, bgcolor: 'action.hover' }}>
        <Typography variant="subtitle2">{t.privacyTitle}</Typography>
        <Typography variant="caption" component="p">{t.privacy}</Typography>
        <Typography variant="caption" component="p" sx={{ mt: 1 }}>
          <a href={lang === 'en' ? '/verificacion/privacidad?lang=en' : '/verificacion/privacidad'}
             target="_blank" rel="noreferrer noopener">{t.privacyLink}</a>
        </Typography>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Button variant="contained" onClick={submit} disabled={state === 'submitting'}>
        {state === 'submitting' ? t.submitting : t.submit}
      </Button>

      <Typography variant="caption" component="p" sx={{ mt: 3, opacity: 0.8 }}>{t.notice}</Typography>
    </Box>
  );
}

function Centered({ children }) {
  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', p: 6, textAlign: 'center' }}>{children}</Box>
  );
}
