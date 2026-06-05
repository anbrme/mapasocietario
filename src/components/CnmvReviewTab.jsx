import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Alert, Chip, Collapse } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const BORME_API = 'https://api.ncdata.eu';
const fmtPct = (n) => (typeof n === 'number' ? `${n.toFixed(3)} %` : '—');
const CHANGE_COLOR = { new: 'success', increased: 'info', decreased: 'warning', dropped: 'default' };

export default function CnmvReviewTab({ adminKey }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null); // `${slug}:${hn}` or `${slug}:ALL`
  const [open, setOpen] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${BORME_API}/bormes/cnmv/pending`, { headers: { 'X-Admin-Token': adminKey } });
      if (res.status === 403) { setError('Admin token rejected by BORME API.'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCompanies(data.companies || []);
    } catch (e) { setError(`Failed to load pending changes: ${e.message}`); }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { load(); }, [load]);

  const review = async (slug, holder_norm, action, scope) => {
    setBusy(`${slug}:${scope === 'company' ? 'ALL' : holder_norm}`); setError('');
    try {
      const res = await fetch(`${BORME_API}/bormes/cnmv/review`, {
        method: 'POST',
        headers: { 'X-Admin-Token': adminKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, holder_norm, action, scope }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
      await load();
    } catch (e) { setError(`Review failed: ${e.message}`); }
    finally { setBusy(null); }
  };

  if (loading && !companies.length) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={32} /></Box>;
  if (error) return <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>;
  if (!companies.length) return (
    <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2, textAlign: 'center' }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>No pending CNMV changes.</Typography>
    </Paper>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {error && <Alert severity="error" sx={{ fontSize: '0.8rem' }}>{error}</Alert>}
      {companies.map((co) => {
        const isOpen = open[co.slug] !== false; // default open
        const allBusy = busy === `${co.slug}:ALL`;
        return (
          <Paper key={co.slug} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                 onClick={() => setOpen((o) => ({ ...o, [co.slug]: o[co.slug] === false }))}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
                {co.slug}{co.ticker ? ` (${co.ticker})` : ''} · {co.changes.length} change(s)
              </Typography>
              {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>
            <Collapse in={isOpen}>
              <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {co.changes.map((ch) => {
                  const rowBusy = busy === `${co.slug}:${ch.holder_norm}`;
                  return (
                    <Box key={ch.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
                                           p: 1, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.2)' }}>
                      <Chip size="small" label={ch.change_type} color={CHANGE_COLOR[ch.change_type] || 'default'}
                            sx={{ fontSize: '0.6rem', height: 18 }} />
                      <Typography variant="body2" sx={{ flex: 1, minWidth: 180 }}>{ch.holder}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                        {fmtPct(ch.existing_pct_total)} → {ch.change_type === 'dropped' ? '(removed)' : fmtPct(ch.new_pct)}
                      </Typography>
                      <Button size="small" variant="contained" color="success" disabled={rowBusy}
                              onClick={() => review(co.slug, ch.holder_norm, 'approve', 'row')}
                              sx={{ textTransform: 'none', fontSize: '0.7rem' }}>
                        {rowBusy ? <CircularProgress size={12} /> : 'Approve'}
                      </Button>
                      <Button size="small" variant="outlined" color="error" disabled={rowBusy}
                              onClick={() => review(co.slug, ch.holder_norm, 'reject', 'row')}
                              sx={{ textTransform: 'none', fontSize: '0.7rem' }}>Reject</Button>
                    </Box>
                  );
                })}
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <Button size="small" variant="contained" color="success" disabled={allBusy}
                          onClick={() => review(co.slug, null, 'approve', 'company')}
                          sx={{ textTransform: 'none', fontSize: '0.7rem' }}>
                    {allBusy ? <CircularProgress size={12} /> : 'Approve all'}
                  </Button>
                  <Button size="small" variant="outlined" color="error" disabled={allBusy}
                          onClick={() => review(co.slug, null, 'reject', 'company')}
                          sx={{ textTransform: 'none', fontSize: '0.7rem' }}>Reject all</Button>
                </Box>
              </Box>
            </Collapse>
          </Paper>
        );
      })}
    </Box>
  );
}
