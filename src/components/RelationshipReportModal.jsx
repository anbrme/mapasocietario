// mapasocietario/src/components/RelationshipReportModal.jsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box, Button,
  Chip, ToggleButton, ToggleButtonGroup, Table, TableHead, TableBody, TableRow,
  TableCell, Accordion, AccordionSummary, AccordionDetails, Alert, Snackbar,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TranslateIcon from '@mui/icons-material/Translate';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { buildReportHtml } from '../utils/relationshipReportHtml';

export default function RelationshipReportModal({ open, onClose, scope, subjects, lang = 'es', onRemoveCompany }) {
  const [reportLang, setReportLang] = useState(lang === 'en' ? 'en' : 'es');
  const [copied, setCopied] = useState(false);
  const es = reportLang !== 'en';

  const companies = scope?.companies || [];
  const connectors = scope?.connectors || [];
  const ownership = scope?.ownership || [];
  const counts = scope?.counts || { companies: 0, officers: 0, sharedPeople: 0 };
  const officersByCompany = scope?.officersByCompany || {};
  const tooFew = companies.length < 2;

  const statusLabel = (s) => es
    ? ({ active: 'Vigente', ceased: 'Cesado', mixed: 'Mixto' }[s] || s)
    : ({ active: 'Active', ceased: 'Ceased', mixed: 'Mixed' }[s] || s);

  const copyForWord = async () => {
    const html = buildReportHtml(scope, { es });
    try {
      const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })]);
      setCopied(true);
    } catch {
      await navigator.clipboard.writeText(html);
      setCopied(true);
    }
  };

  const saveAsPdf = () => window.print();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle className="rel-report-no-print">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <AccountTreeIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
            {es ? 'Informe de Relaciones' : 'Relationship Report'}
          </Typography>
          <Chip label={es ? 'No autoritativo' : 'Not authoritative'} size="small" color="warning" variant="outlined" />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TranslateIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
            <ToggleButtonGroup
              value={reportLang} exclusive size="small"
              onChange={(_, v) => v && setReportLang(v)}
              sx={{ '& .MuiToggleButton-root': { py: 0.2, px: 1.2, fontSize: '0.72rem', textTransform: 'none' } }}>
              <ToggleButton value="es">ES</ToggleButton>
              <ToggleButton value="en">EN</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent id="relationship-report-print" dividers>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>{counts.companies}</strong>{' '}{es ? 'empresas' : 'companies'} ·{' '}
          <strong>{counts.officers}</strong>{' '}{es ? 'administradores' : 'officers'} ·{' '}
          <strong>{counts.sharedPeople}</strong>{' '}{es ? 'conexiones compartidas' : 'shared connections'}
        </Typography>

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 700 }}>
          {es ? 'Empresas analizadas' : 'Companies analysed'}
        </Typography>
        <Box sx={{ mb: 1 }}>
          {companies.map(c => (
            <Chip key={c} label={c} size="small" sx={{ mr: 0.5, mb: 0.5 }}
              onDelete={onRemoveCompany ? () => onRemoveCompany(c) : undefined} />
          ))}
        </Box>
        {tooFew && (
          <Alert severity="info" className="rel-report-no-print" sx={{ mb: 1, fontSize: '0.8rem' }}>
            {es ? 'Añade al menos 2 empresas para el informe.' : 'Add at least 2 companies for the report.'}
          </Alert>
        )}

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 700 }}>
          {es ? 'Conexiones compartidas' : 'Shared connections'}
        </Typography>
        {connectors.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {es ? 'Ninguna detectada.' : 'None detected.'}
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{es ? 'Persona / entidad' : 'Person / entity'}</TableCell>
                <TableCell>{es ? 'Empresas' : 'Companies'}</TableCell>
                <TableCell>{es ? 'Cargo' : 'Role'}</TableCell>
                <TableCell>{es ? 'Estado' : 'Status'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {connectors.map(con => (
                <TableRow key={con.nodeId || con.name}>
                  <TableCell>
                    {con.name}{' '}
                    <Typography component="span" variant="caption" color="text.secondary">
                      ({con.type === 'entity' ? (es ? 'Entidad' : 'Entity') : (es ? 'Persona' : 'Person')})
                    </Typography>
                  </TableCell>
                  <TableCell>{con.companies.join(', ')}</TableCell>
                  <TableCell>{con.roles.join(' / ')}</TableCell>
                  <TableCell>{statusLabel(con.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 700 }}>
          {es ? 'Vínculos de propiedad' : 'Ownership links'}
        </Typography>
        {ownership.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {es ? 'Ninguno detectado.' : 'None detected.'}
          </Typography>
        ) : (
          <Box component="ul" sx={{ pl: 3, my: 0.5 }}>
            {ownership.map((o, i) => (
              <li key={i}>
                <Typography variant="body2">
                  <strong>{o.owner}</strong>{' '}
                  {o.lost ? (es ? 'fue socio único de' : 'was sole shareholder of') : (es ? 'es socio único de' : 'is sole shareholder of')}{' '}
                  <strong>{o.owned}</strong>
                </Typography>
              </li>
            ))}
          </Box>
        )}

        <Accordion sx={{ mt: 2 }} disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {es ? 'Administradores por empresa' : 'Officers per company'}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {companies.map(c => (
              <Box key={c} sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{c}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {(officersByCompany[c] || []).join(', ') || (es ? '—' : '—')}
                </Typography>
              </Box>
            ))}
          </AccordionDetails>
        </Accordion>
      </DialogContent>

      <DialogActions className="rel-report-no-print" sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{es ? 'Cerrar' : 'Close'}</Button>
        <Button startIcon={<ContentCopyIcon />} onClick={copyForWord} disabled={tooFew}>
          {es ? 'Copiar para Word' : 'Copy for Word'}
        </Button>
        <Button variant="contained" startIcon={<PictureAsPdfIcon />} onClick={saveAsPdf} disabled={tooFew}>
          {es ? 'Guardar como PDF' : 'Save as PDF'}
        </Button>
      </DialogActions>

      <Snackbar
        open={copied} autoHideDuration={2500} onClose={() => setCopied(false)}
        message={es ? 'Copiado — pégalo en Word' : 'Copied — paste into Word'}
      />
    </Dialog>
  );
}
