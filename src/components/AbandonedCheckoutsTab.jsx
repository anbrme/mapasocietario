import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, Chip, CircularProgress, Alert, Button } from '@mui/material';
import { PAYMENTS_API } from '../config';

/**
 * Checkouts that were started and never paid.
 *
 * A separate tab on purpose. These used to be written into the same R2 prefix
 * as real orders, so an abandoned checkout appeared in the Orders queue looking
 * exactly like a sale — two unpaid sessions were mistaken for revenue on
 * 2026-08-20. Proximity was the whole problem, so the fix keeps them apart:
 * separate prefix, separate endpoint, separate tab. Nothing here is owed to
 * anyone, and nothing here needs doing.
 */

const fmtDateTime = (s) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return s; }
};

const fmtEur = (n) => (typeof n === 'number' ? `EUR ${n.toFixed(2)}` : '—');

export default function AbandonedCheckoutsTab({ adminKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${PAYMENTS_API}/api/stripe/list-abandoned-checkouts`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (res.status === 401) { setError('Invalid admin key.'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(`Failed to load: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={32} /></Box>;
  }

  const summary = data?.summary || {};
  const rows = data?.abandoned || [];

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
          {summary.count ?? 0} started · {summary.withFinancialStatements ?? 0} included accounts
          {' · '}{fmtEur(summary.valueNotTaken)} not taken
        </Typography>
        {/* Said plainly, because the previous version of this data was mistaken
            for revenue. */}
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Nobody paid for these and nothing is owed. Stripe emails each of them a
          link back once the session expires.
        </Typography>
        <Box sx={{ mt: 1.5 }}>
          <Button size="small" onClick={load} disabled={loading} sx={{ textTransform: 'none' }}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </Box>
      </Paper>

      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No abandoned checkouts on record. Only sessions started after 20 Aug 2026 are tracked.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {rows.map((r) => (
            <Paper
              key={r.sessionId}
              elevation={0}
              sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {r.companyName || r.companyIdentifier || '—'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {fmtDateTime(r.startedAt)}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.25 }}>
                {(r.country || '').toUpperCase()} · {r.customerEmail || 'no email given'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip
                  size="small"
                  label={r.includesFinancialStatements ? 'DD + FS' : 'DD only'}
                  sx={{ height: 20, fontSize: '0.68rem' }}
                />
                <Chip
                  size="small"
                  label={fmtEur(r.amountExpected)}
                  sx={{ height: 20, fontSize: '0.68rem' }}
                />
              </Box>
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 1, color: 'text.disabled', fontFamily: 'monospace', wordBreak: 'break-all' }}
              >
                {r.sessionId}
              </Typography>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
}
