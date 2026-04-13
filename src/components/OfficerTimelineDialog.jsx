import React, { useMemo, useState } from 'react';
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
  Chip,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  ContentCopy as CopyIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
} from '@mui/icons-material';

// ─── Position category colors (pattern-based) ────────────────────────────────
const CATEGORY_COLORS = {
  admin: '#7c3aed',
  consejero: '#2563eb',
  presidente: '#1e40af',
  secretario: '#0891b2',
  apoderado: '#059669',
  auditor: '#d97706',
  comisario: '#dc2626',
  liquidador: '#b91c1c',
  director: '#6d28d9',
  socio: '#0d9488',
  other: '#6366f1',
};

const POSITION_PATTERNS = [
  [/^(ADM|ADMIN)/i, 'admin'],
  [/^(CON\.?DEL|CON\.?IND|CONS|CONSEJ)/i, 'consejero'],
  [/^(PRES|VICEPRES)/i, 'presidente'],
  [/^(SEC|VICESEC|LETRADO)/i, 'secretario'],
  [/^(APO|APOD)/i, 'apoderado'],
  [/^(AUD|COAUD)/i, 'auditor'],
  [/^(COM[IO]S)/i, 'comisario'],
  [/^(LIQ)/i, 'liquidador'],
  [/^(DIR|D\.GRAL|GERENTE)/i, 'director'],
  [/^(SOCIO)/i, 'socio'],
];

const _colorCache = {};
const getPositionColor = (role) => {
  if (_colorCache[role]) return _colorCache[role];
  for (const [pattern, category] of POSITION_PATTERNS) {
    if (pattern.test(role)) {
      _colorCache[role] = CATEGORY_COLORS[category];
      return CATEGORY_COLORS[category];
    }
  }
  _colorCache[role] = CATEGORY_COLORS.other;
  return CATEGORY_COLORS.other;
};

// ─── Date parsing ────────────────────────────────────────────────────────────
const parseDate = (str) => {
  if (!str) return null;
  const iso = String(str).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const d = new Date(str);
  return isNaN(d) ? null : d;
};

// ─── Gantt Timeline Component ────────────────────────────────────────────────
const OfficerGanttTimeline = ({ companies }) => {
  const spans = useMemo(() => {
    if (!companies?.length) return [];
    const result = [];
    companies.forEach((company) => {
      const positions = company.positions || [];
      const byRole = {};
      positions.forEach(pos => {
        const role = pos.specific_role || pos.position || 'Cargo';
        if (!byRole[role]) byRole[role] = { appointments: [], cessations: [] };
        const isAppt = ['nombramientos', 'reelecciones', 'appointment', 'reelection'].includes(pos.event_type);
        const d = parseDate(pos.date);
        if (d) {
          if (isAppt) byRole[role].appointments.push({ date: d, raw: pos.date });
          else byRole[role].cessations.push({ date: d, raw: pos.date });
        }
      });
      Object.entries(byRole).forEach(([role, { appointments, cessations }]) => {
        appointments.sort((a, b) => a.date - b.date);
        cessations.sort((a, b) => a.date - b.date);
        const usedCessations = new Set();
        const paired = [];
        for (let i = appointments.length - 1; i >= 0; i--) {
          const appt = appointments[i];
          const cessIdx = cessations.findIndex(c => c.date >= appt.date && !usedCessations.has(c));
          const cessation = cessIdx >= 0 ? cessations[cessIdx] : null;
          if (cessation) usedCessations.add(cessation);
          paired.unshift({ appt, cessation });
        }
        paired.forEach(({ appt, cessation }) => {
          result.push({
            company: company.name,
            role,
            startDate: appt.date,
            endDate: cessation ? cessation.date : null,
            start: appt.raw,
            end: cessation ? cessation.raw : null,
            isActive: !cessation,
          });
        });
        cessations.forEach(cess => {
          if (!usedCessations.has(cess)) {
            result.push({
              company: company.name, role,
              startDate: cess.date, endDate: cess.date,
              start: cess.raw, end: cess.raw,
              isActive: false, unknownStart: true,
            });
          }
        });
      });
    });
    return result;
  }, [companies]);

  if (!spans.length) return null;

  const allDates = spans.flatMap(s => [s.startDate, s.endDate].filter(Boolean));
  if (!allDates.length) return null;
  const minDate = new Date(Math.min(...allDates));
  const today = new Date();
  const maxDate = new Date(Math.max(...allDates, today));
  const rangeStart = new Date(minDate.getFullYear(), minDate.getMonth() - 3, 1);
  const rangeEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 4, 0);
  const totalMs = rangeEnd - rangeStart || 1;

  const toPercent = (d) => {
    if (!d) return null;
    const date = d instanceof Date ? d : parseDate(d);
    if (!date) return null;
    return Math.max(0, Math.min(100, ((date - rangeStart) / totalMs) * 100));
  };

  const years = [];
  for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) {
    const pct = ((new Date(y, 0, 1) - rangeStart) / totalMs) * 100;
    if (pct >= 0 && pct <= 100) years.push({ year: y, pct });
  }

  const companyNames = [...new Set(spans.map(s => s.company))];
  const rows = [];
  const allRoles = new Set();
  companyNames.forEach(companyName => {
    const companySpans = spans.filter(s => s.company === companyName);
    const roles = [...new Set(companySpans.map(s => s.role))];
    roles.forEach(role => {
      allRoles.add(role);
      rows.push({
        company: companyName, role,
        spans: companySpans.filter(s => s.role === role),
        color: getPositionColor(role),
      });
    });
  });

  const todayPct = Math.max(0, Math.min(100, ((today - rangeStart) / totalMs) * 100));

  return (
    <Box sx={{ py: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700 }}>
        Línea temporal
      </Typography>
      <Box sx={{ position: 'relative', minHeight: rows.length * 36 + 32 }}>
        <Box sx={{ position: 'absolute', top: 0, left: 180, right: 0, bottom: 0 }}>
          {years.map(({ year, pct }) => (
            <Box key={year} sx={{ position: 'absolute', left: `${pct}%`, top: 0, bottom: 0, borderLeft: '1px solid', borderColor: 'grey.200', zIndex: 0 }}>
              <Typography variant="caption" sx={{ position: 'absolute', top: -18, left: 2, fontSize: '0.65rem', color: 'text.secondary', userSelect: 'none' }}>{year}</Typography>
            </Box>
          ))}
          {todayPct >= 0 && todayPct <= 100 && (
            <Box sx={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, borderLeft: '2px dashed', borderColor: 'warning.main', zIndex: 1, opacity: 0.6 }} />
          )}
        </Box>
        <Box sx={{ pt: 2 }}>
          {rows.map((row, rowIdx) => (
            <Box key={`${row.company}-${row.role}-${rowIdx}`} sx={{ display: 'flex', alignItems: 'center', height: 32, mb: 0.5 }}>
              <Tooltip title={`${row.role} en ${row.company}`} placement="left" arrow>
                <Box sx={{ width: 180, flexShrink: 0, pr: 1, overflow: 'hidden' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.65rem', lineHeight: 1.2, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.primary' }}>
                    {row.company}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.role}
                  </Typography>
                </Box>
              </Tooltip>
              <Box sx={{ flex: 1, position: 'relative', height: '100%' }}>
                {row.spans.map((span, sIdx) => {
                  if (span.unknownStart) {
                    const pos = toPercent(span.endDate) ?? 0;
                    return (
                      <Tooltip key={sIdx} title={`${span.role}: ? → ${span.end} (cese)`} arrow>
                        <Box sx={{ position: 'absolute', left: `${pos}%`, top: 10, width: 12, height: 12, borderRadius: '50%', bgcolor: row.color, opacity: 0.65, transform: 'translateX(-6px)', border: '2px solid white', boxShadow: 1 }} />
                      </Tooltip>
                    );
                  }
                  const startPct = toPercent(span.startDate) ?? 0;
                  const endPct = span.endDate ? toPercent(span.endDate) : todayPct;
                  const width = Math.max(endPct - startPct, 0.5);
                  return (
                    <Tooltip key={sIdx} title={`${span.role}: ${span.start || '?'} → ${span.end || 'Activo'}`} arrow>
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
        {[...allRoles].map(role => (
          <Box key={role} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: getPositionColor(role) }} />
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{role}</Typography>
          </Box>
        ))}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
          <Box sx={{ width: 12, height: 2, borderTop: '2px dashed', borderColor: 'warning.main', opacity: 0.6 }} />
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>Hoy</Typography>
        </Box>
      </Box>
    </Box>
  );
};

// ─── Main Dialog ─────────────────────────────────────────────────────────────
const OfficerTimelineDialog = ({ open, officerName, officerRecords, onClose, container }) => {
  const [copied, setCopied] = useState(false);

  // Transform flat officer records into the companies structure the Gantt expects
  const companies = useMemo(() => {
    if (!officerRecords?.length) return [];
    const byCompany = {};
    officerRecords.forEach(o => {
      const name = o.company_name || o.company || 'Desconocida';
      if (!byCompany[name]) byCompany[name] = { name, positions: [] };
      byCompany[name].positions.push({
        date: o.date || o.event_date,
        specific_role: o.specific_role || o.position_normalized || o.role || o.position,
        event_type: o.event_type,
        status: o.status,
      });
    });
    return Object.values(byCompany);
  }, [officerRecords]);

  // Flat timeline for the table
  const timeline = useMemo(() => {
    if (!officerRecords?.length) return [];
    return officerRecords
      .filter(o => o.date || o.event_date)
      .map(o => ({
        date: o.date || o.event_date,
        company: o.company_name || o.company || 'Desconocida',
        position: o.specific_role || o.position_normalized || o.role || o.position || '-',
        isAppointment: ['nombramientos', 'reelecciones'].includes((o.event_type || '').toLowerCase()),
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [officerRecords]);

  const handleCopy = () => {
    const rows = timeline.map(evt =>
      `<tr><td style="padding:4px 8px;border:1px solid #ccc">${evt.date}</td><td style="padding:4px 8px;border:1px solid #ccc">${evt.isAppointment ? 'Nombramiento' : 'Cese'}</td><td style="padding:4px 8px;border:1px solid #ccc">${evt.position}</td><td style="padding:4px 8px;border:1px solid #ccc">${evt.company}</td></tr>`
    ).join('');
    const html = `<table style="border-collapse:collapse;font-family:Calibri,sans-serif;font-size:11pt"><thead><tr style="background:#7c3aed;color:white"><th style="padding:6px 10px;border:1px solid #7c3aed;text-align:left">Fecha</th><th style="padding:6px 10px;border:1px solid #7c3aed;text-align:left">Tipo</th><th style="padding:6px 10px;border:1px solid #7c3aed;text-align:left">Cargo</th><th style="padding:6px 10px;border:1px solid #7c3aed;text-align:left">Empresa</th></tr></thead><tbody>${rows}</tbody></table>`;
    const plain = `Fecha\tTipo\tCargo\tEmpresa\n` +
      timeline.map(evt => `${evt.date}\t${evt.isAppointment ? 'Nombramiento' : 'Cese'}\t${evt.position}\t${evt.company}`).join('\n');
    navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth container={container}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimelineIcon color="primary" />
          <Typography variant="h6">Línea temporal — {officerName}</Typography>
        </Box>
        {timeline.length > 0 && (
          <Tooltip title={copied ? 'Copiado' : 'Copiar para Word'}>
            <IconButton size="small" onClick={handleCopy}>
              <CopyIcon fontSize="small" color={copied ? 'success' : 'inherit'} />
            </IconButton>
          </Tooltip>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {companies.length > 0 ? (
          <>
            <OfficerGanttTimeline companies={companies} />
            {timeline.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
                  Cronología BORME ({timeline.length} movimientos)
                </Typography>
                <Box component="table" sx={{
                  width: '100%', borderCollapse: 'collapse',
                  '& th, & td': { px: 1.5, py: 0.75, border: '1px solid', borderColor: 'divider', fontSize: '0.8rem' },
                  '& th': { bgcolor: 'grey.100', fontWeight: 600, textAlign: 'left' },
                }}>
                  <thead><tr><th>Fecha</th><th>Tipo</th><th>Cargo</th><th>Empresa</th></tr></thead>
                  <tbody>
                    {timeline.map((evt, idx) => (
                      <tr key={idx}>
                        <td>{evt.date}</td>
                        <td>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {evt.isAppointment
                              ? <ActiveIcon sx={{ fontSize: 14, color: 'success.main' }} />
                              : <InactiveIcon sx={{ fontSize: 14, color: 'error.main' }} />}
                            {evt.isAppointment ? 'Nombramiento' : 'Cese'}
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
          <Typography color="text.secondary">No hay datos de línea temporal disponibles.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
};

export default OfficerTimelineDialog;
