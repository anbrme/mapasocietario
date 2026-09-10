// mapasocietario/src/components/RelationshipReportModal.jsx
import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box, Button,
  Chip, ToggleButton, ToggleButtonGroup, Table, TableHead, TableBody, TableRow,
  TableCell, Accordion, AccordionSummary, AccordionDetails, Snackbar, TextField,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TranslateIcon from '@mui/icons-material/Translate';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { buildReportHtml } from '../utils/relationshipReportHtml';
import { buildExportHtml, exportFileName } from '../utils/investigationExport';
import { correctionVerb, exportCopy } from '../utils/investigationExport/exportCopy';
import { NODE_NOTE_FLAGS, NODE_NOTE_MAX_LENGTH } from '../utils/nodeNotes';

export default function RelationshipReportModal({
  open, onClose, doc, graphData, networkNote, onNetworkNoteChange,
  lang = 'es', onRemoveCompany, onDownload,
}) {
  const [reportLang, setReportLang] = useState(lang === 'en' ? 'en' : 'es');
  const [copied, setCopied] = useState(false);
  const es = reportLang !== 'en';
  const t = exportCopy(es ? 'es' : 'en');

  useEffect(() => {
    if (open) setReportLang(lang === 'en' ? 'en' : 'es');
  }, [open, lang]);

  const companies = doc?.companies || [];
  const connectors = doc?.connectors || [];
  const ownership = doc?.ownership || [];
  const counts = doc?.counts || { companies: 0, officers: 0, sharedPeople: 0 };
  const flagged = doc?.flagged || [];
  const otherNotes = doc?.otherNotes || [];
  const corrections = doc?.corrections || [];
  const officersByCompany = doc?.officersByCompany || {};
  const noCompanies = companies.length < 1;

  const statusLabel = (s) => es
    ? ({ active: 'Vigente', ceased: 'Cesado', mixed: 'Mixto' }[s] || s)
    : ({ active: 'Active', ceased: 'Ceased', mixed: 'Mixed' }[s] || s);

  const copyForWord = async () => {
    const html = buildReportHtml(doc, { es });
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

  const download = () => {
    const html = buildExportHtml(doc, graphData, { lang: es ? 'es' : 'en' });
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(doc, es ? 'es' : 'en');
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking synchronously can cancel the download in Safari.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onDownload?.();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <AccountTreeIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
            {es ? 'Informe de situación' : 'Situation report'}
          </Typography>
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

      <DialogContent dividers>
        <TextField
          fullWidth
          multiline
          minRows={2}
          size="small"
          value={networkNote}
          onChange={(e) => onNetworkNoteChange(e.target.value.slice(0, NODE_NOTE_MAX_LENGTH))}
          placeholder={es
            ? '¿Qué estás mirando y qué has concluido?'
            : 'What are you looking at, and what did you conclude?'}
          label={es ? 'Resumen' : 'Summary'}
          sx={{ mb: 2 }}
        />

        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>{counts.companies}</strong>{' '}{es ? 'empresas' : 'companies'} ·{' '}
          <strong>{counts.officers}</strong>{' '}{es ? 'administradores' : 'officers'} ·{' '}
          <strong>{counts.sharedPeople}</strong>{' '}{es ? 'conexiones compartidas' : 'shared connections'}
        </Typography>

        {flagged.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 700 }}>
              {es ? 'Señalado' : 'Flagged'}
            </Typography>
            <Box sx={{ mb: 1 }}>
              {flagged.map(f => (
                <Box
                  key={f.nodeId}
                  sx={{
                    borderLeft: `3px solid ${NODE_NOTE_FLAGS[f.flag] || NODE_NOTE_FLAGS.none}`,
                    pl: 1, py: 0.5, mb: 0.5,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{f.name}</Typography>
                  {f.text && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {f.text}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </>
        )}

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 700 }}>
          {es ? 'Empresas analizadas' : 'Companies analysed'}
        </Typography>
        <Box sx={{ mb: 1 }}>
          {companies.map(c => (
            <Box key={c.nodeId} sx={{ display: 'inline-block', mr: 0.5, mb: 0.5, verticalAlign: 'top' }}>
              <Chip label={c.name}
                onDelete={onRemoveCompany ? () => onRemoveCompany(c.name) : undefined} />
              {c.note?.text && (
                <Typography variant="caption" component="div" sx={{ color: 'text.secondary', maxWidth: 220 }}>
                  {c.note.text}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

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
                    {con.note?.text && (
                      <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
                        {con.note.text}
                      </Typography>
                    )}
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

        {otherNotes.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 700 }}>
              {es ? 'Otras notas' : 'Other notes'}
            </Typography>
            <Box component="ul" sx={{ pl: 3, my: 0.5 }}>
              {otherNotes.map((n, i) => (
                <li key={n.nodeId || i}>
                  <Typography variant="body2">
                    <strong>{n.name}</strong>
                    {n.text && (
                      <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                        {' — '}{n.text}
                      </Typography>
                    )}
                  </Typography>
                </li>
              ))}
            </Box>
          </>
        )}

        {corrections.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 700 }}>
              {t.corrections}
            </Typography>
            <Box component="ul" sx={{ pl: 3, my: 0.5 }}>
              {corrections.map((c, i) => (
                <li key={i}>
                  <Typography variant="body2">
                    <strong>{c.nameA}</strong>{' '}
                    {correctionVerb(t, c.action)}
                    {c.nameB ? ` ${c.nameB}` : ''}
                    {c.resignedDate ? ` (${c.resignedDate})` : ''}
                  </Typography>
                </li>
              ))}
            </Box>
          </>
        )}

        <Accordion sx={{ mt: 2 }} disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {es ? 'Administradores por empresa' : 'Officers per company'}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {companies.map(c => {
              const list = [...(officersByCompany[c.name] || [])].sort((a, b) => a.localeCompare(b));
              return (
                <Box key={c.nodeId} sx={{ mb: 1.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {c.name}{' '}
                    <Typography component="span" variant="caption" color="text.secondary">
                      ({list.length})
                    </Typography>
                  </Typography>
                  {list.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">—</Typography>
                  ) : (
                    <Box component="ul" sx={{
                      listStyle: 'none', pl: 0, mt: 0.5, mb: 0,
                      columnWidth: '180px', columnGap: 24,
                    }}>
                      {list.map((name, i) => (
                        <Typography key={i} component="li" variant="caption"
                          sx={{ color: 'text.secondary', breakInside: 'avoid', display: 'block' }}>
                          {name}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })}
          </AccordionDetails>
        </Accordion>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{es ? 'Cerrar' : 'Close'}</Button>
        <Button startIcon={<ContentCopyIcon />} onClick={copyForWord} disabled={noCompanies}>
          {es ? 'Copiar para Word' : 'Copy for Word'}
        </Button>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {es ? 'se abre en tu navegador' : 'opens in your browser'}
        </Typography>
        <Button variant="contained" startIcon={<DownloadIcon />} onClick={download} disabled={noCompanies}>
          {es ? 'Descargar' : 'Download'}
        </Button>
      </DialogActions>

      <Snackbar
        open={copied} autoHideDuration={2500} onClose={() => setCopied(false)}
        message={es ? 'Copiado — pégalo en Word' : 'Copied — paste into Word'}
      />
    </Dialog>
  );
}
