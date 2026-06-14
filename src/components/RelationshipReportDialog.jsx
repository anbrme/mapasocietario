// mapasocietario/src/components/RelationshipReportDialog.jsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box, Button,
  TextField, Alert, CircularProgress, Chip,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { PAYMENTS_API } from '../config';
import { getClientId } from '../utils/clientId';

const SOFT_WARN_COMPANIES = 10;

// `scope`   : { companies:[], officersByCompany:{}, counts:{companies,officers,sharedPeople} }
// `subjects`: [{ name, group_key }]  (group_keys resolved by the parent before opening)
export default function RelationshipReportDialog({ open, onClose, scope, subjects, lang = 'es' }) {
  const [directive, setDirective] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const counts = scope?.counts || { companies: 0, officers: 0, sharedPeople: 0 };
  const large = counts.companies > SOFT_WARN_COMPANIES;

  const handleCheckout = async () => {
    if (!email.trim()) { setError('Introduce un email para recibir el informe.'); return; }
    setError(''); setLoading(true);
    try {
      const visible_officers = {};
      subjects.forEach(s => {
        visible_officers[s.group_key] = scope.officersByCompany[s.name] || [];
      });
      const options = {
        mode: 'relationship',
        account_id: getClientId(),
        language: lang,
        subjects,
        visible_officers,
        directive: directive.trim() || undefined,
      };
      const res = await fetch(`${PAYMENTS_API}/api/stripe/create-dd-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: 'es',
          // No single company — send a synthetic identifier/title.
          companyIdentifier: subjects.map(s => s.group_key).join('+'),
          companyName: subjects.map(s => s.name).join(' · ').slice(0, 200),
          options,
          email: email.trim() || undefined,
          returnUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (data.url) {
        localStorage.setItem('dd_return_url', window.location.href);
        window.location.href = data.url;
      } else {
        setError('No se pudo crear la sesión de pago. Inténtalo de nuevo.');
      }
    } catch (e) {
      setError(e.message || 'Error de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountTreeIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Informe de Relaciones
          </Typography>
          <Chip label="No autoritativo" size="small" color="warning" variant="outlined" />
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Este informe cubre <strong>{counts.companies} empresas</strong>, ~<strong>{counts.officers} administradores</strong> y
          aproximadamente <strong>{counts.sharedPeople} relación(es)</strong> entre ellas (personas en ≥2 empresas).
        </Typography>
        <Box sx={{ mb: 2 }}>
          {scope?.companies?.map(c => (
            <Chip key={c} label={c} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
          ))}
        </Box>
        <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
          El informe analiza lo que ves ahora en el grafo. Si una empresa tiene cientos de
          apoderados, fíltralos salvo que conecten con otras empresas — depura el grafo hasta que
          muestre lo que te interesa y luego genera el informe.
        </Alert>
        {large && (
          <Alert severity="warning" sx={{ mb: 2, fontSize: '0.8rem' }}>
            Has seleccionado {counts.companies} empresas. Cuantas más incluyas, más largo y costoso
            será el informe; considera filtrar a las imprescindibles.
          </Alert>
        )}
        <TextField
          fullWidth multiline minRows={2} size="small"
          label="Indicación para el análisis (opcional)"
          placeholder="p. ej. analiza posibles conflictos de interés entre A y B"
          value={directive} onChange={e => setDirective(e.target.value)} sx={{ mb: 2 }}
        />
        <TextField
          fullWidth size="small" label="Email (obligatorio)" placeholder="tu@email.com"
          value={email} onChange={e => setEmail(e.target.value)}
        />
        {error && <Alert severity="error" sx={{ mt: 2, fontSize: '0.8rem' }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button variant="contained" onClick={handleCheckout} disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}>
          {loading ? 'Redirigiendo…' : 'Continuar al pago'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
