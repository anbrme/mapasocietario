import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Alert, Chip, TextField } from '@mui/material';
import { API_URL } from '../config';

// Admin review queue for user-reported wrong web-enriched values
// (NIF / capital / address). Applying a report overwrites the shared
// borme_companies_v3 ES field via the backend's _persist_enrichment. Mirrors
// CnmvReviewTab: same X-Admin-Token gate + plain fetch pattern.
const BORME_API = API_URL;
const FIELD_LABEL = { nif: 'NIF/CIF', capital: 'Capital', address: 'Domicilio' }; 
const FIELD_COLOR = { nif: 'primary', capital: 'warning', address: 'success' };

export default function EnrichmentReviewTab({ adminKey }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null); // report id being acted on
  const [values, setValues] = useState({}); // { [id]: editable value to apply }

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${BORME_API}/bormes/enrichment/pending`, { headers: { 'X-Admin-Token': adminKey } });
      if (res.status === 403) { setError('Admin token rejected by BORME API.'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rows = data.reports || [];
      setReports(rows);
      // Prefill each editable value from the reporter's suggestion.
      setValues(Object.fromEntries(rows.map((r) => [r.id, r.suggested_value || ''])));
    } catch (e) { setError(`Failed to load pending reports: ${e.message}`); }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { load(); }, [load]);

  const review = async (id, action) => {
    setBusy(id); setError('');
    try {
      const res = await fetch(`${BORME_API}/bormes/enrichment/review`, {
        method: 'POST',
        headers: { 'X-Admin-Token': adminKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...(action === 'apply' && { value: (values[id] || '').trim() }) }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
      await load();
    } catch (e) { setError(`Review failed: ${e.message}`); }
    finally { setBusy(null); }
  };

  if (loading && !reports.length) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={32} /></Box>;
  if (error && !reports.length) return <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>;
  if (!reports.length) return (
    <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2, textAlign: 'center' }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>No pending enrichment reports.</Typography>
    </Paper>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {error && <Alert severity="error" sx={{ fontSize: '0.8rem' }}>{error}</Alert>}
      {reports.map((r) => {
        const rowBusy = busy === r.id;
        const canApply = !r.es_doc_id ? false : !!(values[r.id] || '').trim();
        return (
          <Paper key={r.id} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={FIELD_LABEL[r.field] || r.field} color={FIELD_COLOR[r.field] || 'default'}
                    sx={{ fontSize: '0.6rem', height: 18 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1, minWidth: 180 }}>
                {r.resolved_name || r.company_name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {r.created_at ? r.created_at.slice(0, 10) : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                Actual: <strong>{r.current_value || '—'}</strong>
              </Typography>
              {r.suggested_value && (
                <Typography variant="caption" sx={{ color: 'success.light', fontFamily: 'monospace' }}>
                  Sugerido: <strong>{r.suggested_value}</strong>
                </Typography>
              )}
            </Box>
            {r.note && (
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontStyle: 'italic', mb: 1 }}>
                “{r.note}”
              </Typography>
            )}
            {!r.es_doc_id && (
              <Alert severity="warning" sx={{ fontSize: '0.7rem', mb: 1, py: 0 }}>
                No se resolvió el documento en el índice; no se puede aplicar automáticamente.
              </Alert>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <TextField size="small" label="Valor a aplicar" value={values[r.id] || ''}
                         onChange={(e) => setValues((v) => ({ ...v, [r.id]: e.target.value }))}
                         sx={{ flex: 1, minWidth: 180 }} />
              <Button size="small" variant="contained" color="success" disabled={rowBusy || !canApply}
                      onClick={() => review(r.id, 'apply')}
                      sx={{ textTransform: 'none', fontSize: '0.7rem' }}>
                {rowBusy ? <CircularProgress size={12} /> : 'Aplicar'}
              </Button>
              <Button size="small" variant="outlined" color="error" disabled={rowBusy}
                      onClick={() => review(r.id, 'reject')}
                      sx={{ textTransform: 'none', fontSize: '0.7rem' }}>Rechazar</Button>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}
