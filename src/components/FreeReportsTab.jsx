import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, Button, TextField, CircularProgress, Alert, Chip, Divider } from '@mui/material';
import { PAYMENTS_API } from '../config';

const fmtDate = (s) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
};

export default function FreeReportsTab({ adminKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  const load = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${PAYMENTS_API}/api/stripe/list-free-reports`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (res.status === 401) { setError('Invalid admin key.'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) { setError(`Failed to load: ${e.message}`); }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { load(); }, [load]);

  // action key -> route stem under /api/stripe/.
  const route = (k) => ({
    block: 'block-free-report', unblock: 'unblock-free-report', reset: 'reset-free-report',
    grantWaiver: 'grant-free-report-waiver', revokeWaiver: 'revoke-free-report-waiver',
  }[k]);

  const call = async (k, email) => {
    if (!email) return;
    setBusy(`${k}:${email}`); setError('');
    try {
      const res = await fetch(`${PAYMENTS_API}/api/stripe/${route(k)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
      await load();
    } catch (e) { setError(`Action failed: ${e.message}`); }
    finally { setBusy(''); }
  };

  if (loading && !data) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={32} /></Box>;

  const s = data?.summary || {};
  const btn = (k, email, label, color) => (
    <Button size="small" variant="outlined" color={color || 'inherit'}
      disabled={busy === `${k}:${email}`} onClick={() => call(k, email)}
      sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0, minWidth: 0 }}>
      {busy === `${k}:${email}` ? '…' : label}
    </Button>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && <Alert severity="error" sx={{ fontSize: '0.8rem' }}>{error}</Alert>}

      <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {(s.redeemedCount ?? 0)} / {(s.limit ?? '—')} redeemed · {(s.followUpOptInCount ?? 0)} opted into follow-up · {(s.abuseAttemptCount ?? 0)} blocked attempts · {(s.waiverCount ?? 0)} waivers
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
          <TextField size="small" placeholder="email@example.com" value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8rem' } }} />
          {btn('block', manualEmail.trim(), 'Block', 'error')}
          {btn('grantWaiver', manualEmail.trim(), 'Grant waiver', 'success')}
          <Button size="small" onClick={load} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Refresh</Button>
        </Box>
      </Paper>

      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Redemptions</Typography>
      {(data?.redemptions || []).length === 0 && <Typography variant="caption" sx={{ color: 'text.secondary' }}>None yet.</Typography>}
      {(data?.redemptions || []).map((r) => (
        <Paper key={`red-${r.canonicalEmail}`} sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
              {r.originalEmail || r.canonicalEmail}
              {r.originalEmail && r.originalEmail !== r.canonicalEmail && (
                <Typography component="span" variant="caption" sx={{ color: 'text.disabled', ml: 0.5 }}>({r.canonicalEmail})</Typography>
              )}
            </Typography>
            {r.followUpOptIn && <Chip size="small" color="warning" label="follow-up OK" sx={{ height: 18, fontSize: '0.62rem' }} />}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{fmtDate(r.redeemedAt)}</Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            {r.company || '—'} · {(r.country || '').toUpperCase()} · {r.intakeRole || '—'} · {r.intakeNeed || '—'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.75 }}>
            {btn('reset', r.canonicalEmail, 'Reset (grant one more)')}
            {btn('block', r.canonicalEmail, 'Block', 'error')}
            {btn('grantWaiver', r.canonicalEmail, 'Grant waiver', 'success')}
          </Box>
        </Paper>
      ))}

      <Divider sx={{ my: 1 }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Abuse attempts</Typography>
      {(data?.abuseAttempts || []).length === 0 && <Typography variant="caption" sx={{ color: 'text.secondary' }}>None.</Typography>}
      {(data?.abuseAttempts || []).map((a) => (
        <Paper key={`ab-${a.canonicalEmail}`} sx={{ p: 1.5, bgcolor: 'rgba(255,90,90,0.05)', border: '1px solid rgba(255,90,90,0.2)', borderRadius: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
              {a.originalEmail || a.canonicalEmail}
              {a.originalEmail && a.originalEmail !== a.canonicalEmail && (
                <Typography component="span" variant="caption" sx={{ color: 'text.disabled', ml: 0.5 }}>({a.canonicalEmail})</Typography>
              )}
            </Typography>
            <Chip size="small" label={`${a.count}× ${a.reason || ''}`} sx={{ height: 18, fontSize: '0.62rem' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{fmtDate(a.attemptedAt)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.75 }}>
            {btn('block', a.canonicalEmail, 'Block', 'error')}
            {btn('grantWaiver', a.canonicalEmail, 'Grant waiver', 'success')}
          </Box>
        </Paper>
      ))}

      <Divider sx={{ my: 1 }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Blocked</Typography>
      {(data?.blocked || []).length === 0 && <Typography variant="caption" sx={{ color: 'text.secondary' }}>None.</Typography>}
      {(data?.blocked || []).map((b) => (
        <Box key={`blk-${b.canonicalEmail}`} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ flex: 1 }}>{b.canonicalEmail} · {fmtDate(b.blockedAt)}</Typography>
          {btn('unblock', b.canonicalEmail, 'Unblock')}
        </Box>
      ))}

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>Waivers</Typography>
      {(data?.waivers || []).length === 0 && <Typography variant="caption" sx={{ color: 'text.secondary' }}>None.</Typography>}
      {(data?.waivers || []).map((w) => (
        <Box key={`wv-${w.canonicalEmail}`} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ flex: 1 }}>{w.canonicalEmail} · {fmtDate(w.grantedAt)}</Typography>
          {btn('revokeWaiver', w.canonicalEmail, 'Revoke')}
        </Box>
      ))}
    </Box>
  );
}
