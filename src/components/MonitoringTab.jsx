/**
 * Monitoring: is the alerts feature alive, and what is it watching?
 *
 * The health card is the reason this tab exists. Between 2026-06-13 and
 * 2026-08-10 monitoring produced nothing at all — the matcher was reading an
 * index the June rekey had frozen — and every surface anyone looked at said
 * things were fine. The matcher exited zero, its logs read "nothing to do",
 * and no page anywhere showed that a feature with subscribers had delivered
 * zero events in two months.
 *
 * So health goes at the top, before the list. A stale matcher means every row
 * below it is a promise not being kept.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Alert, Chip, Divider,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { API_URL } from '../config';

import { resilientFetch } from '../services/originFailover';

const fmtDate = (s) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return s; }
};

const fmtLag = (seconds) => {
  if (seconds == null) return '—';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
};

// The health card shows UTC, deliberately. The watermark file, the matcher
// logs and journalctl are all UTC, and this card exists to be cross-referenced
// with them at 2am. Local time here would mean translating in your head at the
// exact moment you least want to.
const fmtUtc = (s) => {
  if (!s) return '—';
  try {
    return `${new Date(s).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    })} UTC`;
  } catch { return s; }
};

const HEALTH = {
  ok:      { color: 'success', label: 'Matcher keeping up' },
  stale:   { color: 'error',   label: 'Matcher is behind' },
  unknown: { color: 'warning', label: 'Health unknown' },
};

// Where the alert came from. Self-serve is the free door; purchase is the
// post-checkout opt-in; clerk is a registered NC Data user.
const sourceLabel = (row) => {
  if (row.identity_type === 'clerk') return 'NC Data account';
  if (row.consent_source === 'double_opt_in') return 'Self-serve';
  if (row.consent_source === 'purchase') return 'After purchase';
  return row.consent_source || '—';
};

function HealthCard({ health }) {
  const meta = HEALTH[health?.status] || HEALTH.unknown;
  const isBad = health?.status !== 'ok';

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5, mb: 3, borderRadius: 2,
        border: '1px solid',
        borderColor: isBad ? 'error.main' : 'rgba(255,255,255,0.12)',
        bgcolor: 'rgba(255,255,255,0.03)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Chip size="small" color={meta.color} label={meta.label} />
        <Typography variant="body2" color="text.secondary">
          {fmtLag(health?.lag_seconds)} behind the newest indexed BORME event
        </Typography>
      </Box>

      {health?.reason && (
        <Alert severity={isBad ? 'error' : 'info'} sx={{ mb: 2 }}>{health.reason}</Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Matcher watermark: <strong>{fmtUtc(health?.watermark)}</strong>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Newest indexed event: <strong>{fmtUtc(health?.newest_indexed)}</strong>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Index: <strong>{health?.index || '—'}</strong>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Stale after: <strong>{fmtLag(health?.stale_after_seconds)}</strong>
        </Typography>
      </Box>
    </Paper>
  );
}

export default function MonitoringTab({ adminKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true); setError('');
    try {
      const res = await resilientFetch(`${API_URL}/bormes/v3/alerts/admin/overview`, {
        headers: { 'X-Admin-Token': adminKey },
      });
      if (res.status === 401) { setError('Invalid admin key.'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) { setError(`Failed to load: ${e.message}`); }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { load(); }, [load]);

  const monitored = data?.monitored || [];
  const funnel = data?.funnel || [];
  // Every subscription silent is what the outage looked like from outside.
  const allSilent = monitored.length > 0 && monitored.every((m) => !m.filings);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Monitoring</Typography>
        <Button size="small" onClick={load} disabled={loading}>Refresh</Button>
        {loading && <CircularProgress size={16} />}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {data && (
        <>
          <HealthCard health={data.health} />

          <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
            <Typography variant="body2">
              <strong>{data.active_count}</strong> active
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>{data.pending_unconfirmed}</strong> requested but never confirmed
            </Typography>
          </Box>

          {allSilent && data.health?.status === 'ok' && (
            <Alert severity="info" sx={{ mb: 3 }}>
              Every subscription is silent. With the matcher keeping up this is
              plausible — BORME simply may not have published anything for these
              companies — but it is also what a broken feature looks like.
            </Alert>
          )}

          {funnel.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Self-serve funnel by country
              </Typography>
              <Table size="small" sx={{ mb: 3 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Country</TableCell>
                    <TableCell align="right">Asked</TableCell>
                    <TableCell align="right">Confirmed</TableCell>
                    <TableCell align="right">Gave up</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {funnel.map((f) => (
                    <TableRow key={f.country}>
                      <TableCell>{f.country}</TableCell>
                      <TableCell align="right">{f.requested}</TableCell>
                      <TableCell align="right">{f.confirmed}</TableCell>
                      <TableCell align="right">{f.abandoned}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}

          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Monitored companies
          </Typography>

          {monitored.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nothing is being monitored.
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Company</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Country</TableCell>
                    <TableCell>Subscriber</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell align="right">Filings</TableCell>
                    <TableCell>Last filing</TableCell>
                    <TableCell>Since</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monitored.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{m.entity_name}</TableCell>
                      <TableCell>{sourceLabel(m)}</TableCell>
                      <TableCell>{m.country || '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {m.email || '—'}
                      </TableCell>
                      <TableCell>
                        {/* An alert can be active, matched and stored and
                            still mail nobody: the dispatcher requires this
                            flag. Off is not a fault — NC Data accounts read
                            alerts in the app — but it must be visible, or
                            "why no email?" has no answer on this page. */}
                        <Chip
                          size="small"
                          variant={m.email_enabled ? 'filled' : 'outlined'}
                          color={m.email_enabled ? 'success' : 'default'}
                          label={m.email_enabled ? 'On' : 'In-app only'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {m.filings ? m.filings : <span style={{ opacity: 0.5 }}>0</span>}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        {fmtDate(m.last_filing)}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        {fmtDate(m.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Subscriber addresses are personal data behind a single shared admin
            key. Treat this page accordingly.
          </Typography>
        </>
      )}
    </Box>
  );
}
