// mapasocietario/src/components/RelationshipReportDialog.jsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box, Button,
  TextField, Alert, CircularProgress, Chip, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TranslateIcon from '@mui/icons-material/Translate';
import { API_URL } from '../config';
import { getClientId } from '../utils/clientId';

const SOFT_WARN_COMPANIES = 10;

// `scope`   : { companies:[], officersByCompany:{}, counts:{companies,officers,sharedPeople} }
// `subjects`: [{ name, group_key }]  (group_keys resolved by the parent before opening)
//
// Free (beta) relationship report: generated and downloaded directly from the
// DD endpoint — no payment flow. The report analyses ALL registered officers of
// the selected companies (the on-screen filtering chooses which COMPANIES to
// include, not which officers). A premium price will attach later, once the
// directed AI analysis layer is added.
export default function RelationshipReportDialog({ open, onClose, scope, subjects, lang = 'es' }) {
  const [directive, setDirective] = useState('');
  const [reportLang, setReportLang] = useState(lang === 'en' ? 'en' : 'es');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const es = reportLang !== 'en';
  const companyNames = scope?.companies || [];
  const n = companyNames.length;
  const large = n > SOFT_WARN_COMPANIES;

  const generate = async () => {
    setError(''); setLoading(true);
    try {
      const title = subjects.map(s => s.name).join(' · ').slice(0, 200);
      const options = {
        mode: 'relationship',
        account_id: getClientId(),
        language: reportLang,
        subjects,
        directive: directive.trim() || undefined,
      };
      const res = await fetch(`${API_URL}/bormes/dd-report/company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: title || 'Relationship Report', options }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error || `Error ${res.status}`);
      }
      const blob = await res.blob();
      const dispo = res.headers.get('Content-Disposition') || '';
      const m = dispo.match(/filename="?([^"]+)"?/);
      const filename = (m && m[1]) || (es ? 'Informe_de_Relaciones.pdf' : 'Relationship_Report.pdf');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      setError(
        (es ? 'No se pudo generar el informe: ' : 'Could not generate the report: ') +
        (e.message || (es ? 'error de conexión.' : 'connection error.')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <AccountTreeIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
            {es ? 'Informe de Relaciones' : 'Relationship Report'}
          </Typography>
          <Chip label={es ? 'No autoritativo' : 'Not authoritative'} size="small" color="warning" variant="outlined" />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
          <TranslateIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {es ? 'Idioma del informe' : 'Report language'}
          </Typography>
          <ToggleButtonGroup
            value={reportLang} exclusive size="small"
            onChange={(_, v) => v && setReportLang(v)}
            sx={{ ml: 0.5, '& .MuiToggleButton-root': { py: 0.2, px: 1.2, fontSize: '0.72rem', textTransform: 'none' } }}>
            <ToggleButton value="es">Español</ToggleButton>
            <ToggleButton value="en">English</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {es
            ? <>Analiza estas <strong>{n} empresas</strong> y las relaciones entre ellas: administradores compartidos, conectores y vínculos de propiedad.</>
            : <>Analyses these <strong>{n} companies</strong> and the relationships between them: shared directors, connectors and ownership links.</>}
        </Typography>
        <Box sx={{ mb: 2 }}>
          {companyNames.map(c => (
            <Chip key={c} label={c} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
          ))}
        </Box>
        <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
          {es
            ? 'Se incluyen todos los administradores registrados de las empresas seleccionadas. Eliges el alcance decidiendo qué empresas añadir al grafo, no qué administradores.'
            : 'All registered officers of the selected companies are included. You set the scope by choosing which companies to add to the graph, not which officers.'}
        </Alert>
        {large && (
          <Alert severity="warning" sx={{ mb: 2, fontSize: '0.8rem' }}>
            {es
              ? `Has seleccionado ${n} empresas. Cuantas más incluyas, más tardará el informe; considera limitarlo a las imprescindibles.`
              : `You selected ${n} companies. The more you include, the longer the report takes; consider limiting it to the essential ones.`}
          </Alert>
        )}
        <TextField
          fullWidth multiline minRows={2} size="small"
          label={es ? 'Indicación para el análisis (opcional)' : 'Analysis directive (optional)'}
          placeholder={es ? 'p. ej. analiza posibles conflictos de interés entre A y B' : 'e.g. analyse possible conflicts of interest between A and B'}
          value={directive} onChange={e => setDirective(e.target.value)}
        />
        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'success.main', fontWeight: 600 }}>
          {es ? 'Gratis durante la fase beta.' : 'Free during beta.'}
        </Typography>
        {error && <Alert severity="error" sx={{ mt: 2, fontSize: '0.8rem' }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>{es ? 'Cancelar' : 'Cancel'}</Button>
        <Button variant="contained" onClick={generate} disabled={loading || n < 2}
          startIcon={loading ? <CircularProgress size={16} /> : <AccountTreeIcon />}>
          {loading
            ? (es ? 'Generando… (hasta ~1 min)' : 'Generating… (up to ~1 min)')
            : (es ? 'Generar informe' : 'Generate report')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
