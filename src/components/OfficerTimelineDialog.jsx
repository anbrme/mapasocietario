import React, { useCallback, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  TableChart as TableChartIcon,
  Image as ImageIcon,
  Download as DownloadIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
} from '@mui/icons-material';
import { isAppointmentMovement } from '../utils/officerMovements';
import { buildOfficerChart } from '../utils/officerTimeline';
import {
  renderGanttCanvas,
  canvasToPngBlob,
  copyPngToClipboard,
  downloadBlob,
  isImageClipboardSupported,
} from '../utils/ganttImage';

const TIMELINE_COPY = {
  en: {
    timeline: 'Timeline',
    today: 'Today',
    roleAtCompany: (role, company) => `${role} at ${company}`,
    cessation: 'cessation',
    active: 'Active',
    appointment: 'Appointment',
    copiedTable: 'Table copied',
    copiedImage: 'Chart copied as an image',
    copyTable: 'Copy table (for Word)',
    copyChart: 'Copy chart as an image',
    downloadChart: 'Download chart (PNG)',
    imageCopyFailed: 'This browser will not accept an image on the clipboard — the PNG has been downloaded instead.',
    imageFailed: 'The chart could not be rendered as an image.',
    mergedData: 'Combined data from merged nodes',
    mergedWarning: 'If the names belong to different people, the timeline may mix unrelated data.',
    bormeTimeline: count => `BORME timeline (${count} ${count === 1 ? 'movement' : 'movements'})`,
    date: 'Date',
    type: 'Type',
    role: 'Role',
    company: 'Company',
    noData: 'No timeline data available.',
    close: 'Close',
    unknownCompany: 'Unknown',
    chartSource: 'Source: BORME (Registro Mercantil) via mapasocietario.es',
  },
  es: {
    timeline: 'Línea temporal',
    today: 'Hoy',
    roleAtCompany: (role, company) => `${role} en ${company}`,
    cessation: 'cese',
    active: 'Activo',
    appointment: 'Nombramiento',
    copiedTable: 'Tabla copiada',
    copiedImage: 'Gráfico copiado como imagen',
    copyTable: 'Copiar tabla (para Word)',
    copyChart: 'Copiar gráfico como imagen',
    downloadChart: 'Descargar gráfico (PNG)',
    imageCopyFailed: 'Este navegador no admite imágenes en el portapapeles — se ha descargado el PNG en su lugar.',
    imageFailed: 'No se ha podido generar el gráfico como imagen.',
    mergedData: 'Datos combinados de nodos fusionados',
    mergedWarning: 'Si los nombres corresponden a personas distintas, la línea temporal puede mezclar datos no relacionados.',
    bormeTimeline: count => `Cronología BORME (${count} movimientos)`,
    date: 'Fecha',
    type: 'Tipo',
    role: 'Cargo',
    company: 'Empresa',
    noData: 'No hay datos de línea temporal disponibles.',
    close: 'Cerrar',
    unknownCompany: 'Desconocida',
    chartSource: 'Fuente: BORME (Registro Mercantil) vía mapasocietario.es',
  },
};

const ROW_HEIGHT = 32;
const LABEL_COLUMN_WIDTH = 180;

// ─── Gantt Timeline ──────────────────────────────────────────────────────────
const OfficerGanttTimeline = ({ chart, copy }) => {
  const { rows, scale, roles } = chart;
  if (!rows.length || !scale) return null;

  return (
    <Box sx={{ py: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700 }}>
        {copy.timeline}
      </Typography>
      <Box sx={{ position: 'relative', minHeight: rows.length * (ROW_HEIGHT + 4) + 32 }}>
        <Box sx={{ position: 'absolute', top: 0, left: LABEL_COLUMN_WIDTH, right: 0, bottom: 0 }}>
          {scale.years.map(({ year, pct }) => (
            <Box
              key={year}
              sx={{
                position: 'absolute', left: `${pct}%`, top: 0, bottom: 0,
                borderLeft: '1px solid', borderColor: 'divider', zIndex: 0,
              }}
            >
              <Typography
                variant="caption"
                sx={{ position: 'absolute', top: -18, left: 2, fontSize: '0.65rem', color: 'text.secondary', userSelect: 'none' }}
              >
                {year}
              </Typography>
            </Box>
          ))}
          {scale.todayPct >= 0 && scale.todayPct <= 100 && (
            <Box sx={{
              position: 'absolute', left: `${scale.todayPct}%`, top: 0, bottom: 0,
              borderLeft: '2px dashed', borderColor: 'warning.main', zIndex: 1, opacity: 0.6,
            }} />
          )}
        </Box>
        <Box sx={{ pt: 2 }}>
          {rows.map((row, rowIdx) => (
            <Box
              key={`${row.company}-${row.role}-${rowIdx}`}
              sx={{ display: 'flex', alignItems: 'center', height: ROW_HEIGHT, mb: 0.5 }}
            >
              <Tooltip title={copy.roleAtCompany(row.role, row.company)} placement="left" arrow>
                <Box sx={{ width: LABEL_COLUMN_WIDTH, flexShrink: 0, pr: 1, overflow: 'hidden' }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, fontSize: '0.65rem', lineHeight: 1.2, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.primary' }}
                  >
                    {row.company}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {row.role}
                  </Typography>
                </Box>
              </Tooltip>
              <Box sx={{ flex: 1, position: 'relative', height: '100%' }}>
                {row.spans.map((span, sIdx) => {
                  if (span.unknownStart) {
                    const pos = scale.toPercent(span.endDate) ?? 0;
                    return (
                      <Tooltip key={sIdx} title={`${span.role}: ? → ${span.end} (${copy.cessation})`} arrow>
                        {/* border punches the dot out from whatever surface it
                            sits on (this dialog's Paper), so it must match
                            background.paper rather than a fixed white — a
                            literal white ring is invisible on a white paper
                            in light mode. */}
                        <Box sx={{
                          position: 'absolute', left: `${pos}%`, top: 10, width: 12, height: 12,
                          borderRadius: '50%', bgcolor: row.color, opacity: 0.65,
                          transform: 'translateX(-6px)', border: '2px solid',
                          borderColor: 'background.paper', boxShadow: 1,
                        }} />
                      </Tooltip>
                    );
                  }
                  const startPct = scale.toPercent(span.startDate) ?? 0;
                  const endPct = span.endDate ? scale.toPercent(span.endDate) : scale.todayPct;
                  const width = Math.max(endPct - startPct, 0.5);
                  return (
                    <Tooltip key={sIdx} title={`${span.role}: ${span.start || '?'} → ${span.end || copy.active}`} arrow>
                      <Box sx={{
                        position: 'absolute', left: `${startPct}%`, width: `${width}%`, top: 8, height: 16,
                        bgcolor: row.color, opacity: span.isActive ? 1 : 0.65, borderRadius: '3px', minWidth: 4,
                        transition: 'opacity 0.15s', '&:hover': { opacity: 1, boxShadow: 2 },
                        ...(span.isActive && {
                          borderTopRightRadius: 0, borderBottomRightRadius: 0,
                          clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 0 100%)',
                        }),
                      }} />
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {roles.map(role => (
          <Box key={role} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{
              width: 10, height: 10, borderRadius: '2px',
              bgcolor: rows.find(r => r.role === role)?.color,
            }} />
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{role}</Typography>
          </Box>
        ))}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
          <Box sx={{ width: 12, height: 2, borderTop: '2px dashed', borderColor: 'warning.main', opacity: 0.6 }} />
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{copy.today}</Typography>
        </Box>
      </Box>
    </Box>
  );
};

/** Filesystem-safe stem for a downloaded chart. */
const fileStem = (officerName) =>
  (officerName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'linea-temporal';

// ─── Main Dialog ─────────────────────────────────────────────────────────────
const OfficerTimelineDialog = ({ open, officerName, officerRecords, nameVariants, language = 'es', onClose, container }) => {
  const [notice, setNotice] = useState(null);
  const copy = TIMELINE_COPY[language === 'en' ? 'en' : 'es'];

  // One "today" per opening, shared by the on-screen chart and any PNG taken
  // from it: re-reading the clock per render would let the exported image and
  // the visible chart disagree about where the marker sits.
  const chart = useMemo(
    () => buildOfficerChart(officerRecords, {
      unknownLabel: copy.unknownCompany,
      fallbackRole: copy.role,
      today: new Date(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [officerRecords, copy.unknownCompany, copy.role, open],
  );

  // Flat timeline for the table
  const timeline = useMemo(() => {
    if (!officerRecords?.length) return [];
    return officerRecords
      .filter(o => o.date || o.event_date)
      .map(o => ({
        date: o.date || o.event_date,
        company: o.company_name || o.company || copy.unknownCompany,
        position: o.specific_role || o.position_normalized || o.role || o.position || '-',
        isAppointment: isAppointmentMovement(o),
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [officerRecords, copy.unknownCompany]);

  const handleCopyTable = useCallback(() => {
    const rows = timeline.map(evt =>
      `<tr><td style="padding:4px 8px;border:1px solid #ccc">${evt.date}</td><td style="padding:4px 8px;border:1px solid #ccc">${evt.isAppointment ? copy.appointment : copy.cessation}</td><td style="padding:4px 8px;border:1px solid #ccc">${evt.position}</td><td style="padding:4px 8px;border:1px solid #ccc">${evt.company}</td></tr>`
    ).join('');
    const html = `<table style="border-collapse:collapse;font-family:Calibri,sans-serif;font-size:11pt"><thead><tr style="background:#7c3aed;color:white"><th style="padding:6px 10px;border:1px solid #7c3aed;text-align:left">${copy.date}</th><th style="padding:6px 10px;border:1px solid #7c3aed;text-align:left">${copy.type}</th><th style="padding:6px 10px;border:1px solid #7c3aed;text-align:left">${copy.role}</th><th style="padding:6px 10px;border:1px solid #7c3aed;text-align:left">${copy.company}</th></tr></thead><tbody>${rows}</tbody></table>`;
    const plain = `${copy.date}\t${copy.type}\t${copy.role}\t${copy.company}\n` +
      timeline.map(evt => `${evt.date}\t${evt.isAppointment ? copy.appointment : copy.cessation}\t${evt.position}\t${evt.company}`).join('\n');
    navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' }),
    })]);
    setNotice({ severity: 'success', message: copy.copiedTable });
  }, [timeline, copy]);

  const chartImageOptions = useMemo(() => ({
    title: `${copy.timeline} — ${officerName || ''}`.trim(),
    subtitle: nameVariants?.length ? `${copy.mergedData}: ${nameVariants.join(' / ')}` : '',
    source: copy.chartSource,
  }), [copy, officerName, nameVariants]);

  const downloadChartPng = useCallback(async () => {
    const canvas = renderGanttCanvas(chart, chartImageOptions);
    if (!canvas) {
      setNotice({ severity: 'error', message: copy.imageFailed });
      return;
    }
    downloadBlob(await canvasToPngBlob(canvas), `${fileStem(officerName)}-linea-temporal.png`);
  }, [chart, chartImageOptions, copy.imageFailed, officerName]);

  const handleCopyChart = useCallback(() => {
    const canvas = renderGanttCanvas(chart, chartImageOptions);
    if (!canvas) {
      setNotice({ severity: 'error', message: copy.imageFailed });
      return;
    }
    // The ClipboardItem is built from an UNRESOLVED promise on purpose — see
    // copyPngToClipboard. Awaiting the blob first breaks the write in Safari,
    // which requires the item to exist inside the user gesture.
    copyPngToClipboard(canvasToPngBlob(canvas))
      .then(() => setNotice({ severity: 'success', message: copy.copiedImage }))
      .catch(() => {
        // Firefox and older Safari refuse image writes. Rather than fail, hand
        // the user the same picture as a file.
        downloadChartPng();
        setNotice({ severity: 'info', message: copy.imageCopyFailed });
      });
  }, [chart, chartImageOptions, copy, downloadChartPng]);

  const hasChart = chart.rows.length > 0 && !!chart.scale;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth container={container}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <TimelineIcon color="primary" />
          <Typography variant="h6" noWrap>{copy.timeline} — {officerName}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {timeline.length > 0 && (
            <Tooltip title={copy.copyTable}>
              <IconButton size="small" onClick={handleCopyTable} aria-label={copy.copyTable}>
                <TableChartIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {hasChart && isImageClipboardSupported() && (
            <Tooltip title={copy.copyChart}>
              <IconButton size="small" onClick={handleCopyChart} aria-label={copy.copyChart}>
                <ImageIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {hasChart && (
            <Tooltip title={copy.downloadChart}>
              <IconButton size="small" onClick={downloadChartPng} aria-label={copy.downloadChart}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {nameVariants && nameVariants.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
              {copy.mergedData}: {nameVariants.join(' / ')}
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: 'text.secondary', mt: 0.25 }}>
              {copy.mergedWarning}
            </Typography>
          </Alert>
        )}
        {hasChart || timeline.length > 0 ? (
          <>
            {hasChart && <OfficerGanttTimeline chart={chart} copy={copy} />}
            {timeline.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
                  {copy.bormeTimeline(timeline.length)}
                </Typography>
                <Box component="table" sx={{
                  width: '100%', borderCollapse: 'collapse',
                  '& th, & td': { px: 1.5, py: 0.75, border: '1px solid', borderColor: 'divider', fontSize: '0.8rem' },
                  '& th': { bgcolor: 'action.hover', fontWeight: 600, textAlign: 'left' },
                }}>
                  <thead><tr><th>{copy.date}</th><th>{copy.type}</th><th>{copy.role}</th><th>{copy.company}</th></tr></thead>
                  <tbody>
                    {timeline.map((evt, idx) => (
                      <tr key={idx}>
                        <td>{evt.date}</td>
                        <td>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {evt.isAppointment
                              ? <ActiveIcon sx={{ fontSize: 14, color: 'success.main' }} />
                              : <InactiveIcon sx={{ fontSize: 14, color: 'error.main' }} />}
                            {evt.isAppointment ? copy.appointment : copy.cessation}
                          </Box>
                        </td>
                        <td>{evt.position}</td>
                        <td>{evt.company}</td>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Box>
            )}
          </>
        ) : (
          <Typography color="text.secondary">{copy.noData}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{copy.close}</Button>
      </DialogActions>
      <Snackbar
        open={!!notice}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={notice?.severity || 'success'} variant="filled" onClose={() => setNotice(null)}>
          {notice?.message}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default OfficerTimelineDialog;
