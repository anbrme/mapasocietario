// mapasocietario/src/components/RelationshipReportModal.jsx
import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box, Button,
  Chip, ToggleButton, ToggleButtonGroup, Table, TableHead, TableBody, TableRow,
  TableCell, Accordion, AccordionSummary, AccordionDetails, Snackbar, TextField,
  IconButton, FormControlLabel, Checkbox,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TranslateIcon from '@mui/icons-material/Translate';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EventNoteIcon from '@mui/icons-material/EventNote';
import { DEFAULT_BLOCKS } from '../utils/sitrepAuthor';
import { buildReportHtml } from '../utils/relationshipReportHtml';
import { correctionVerb, exportCopy } from '../utils/investigationExport/exportCopy';
import { NODE_NOTE_MAX_LENGTH } from '../utils/nodeNotes';
import { REPORT_TITLE_MAX_LENGTH } from '../utils/investigationDoc';
import { isoDayShort } from '../utils/isoDay';
import {
  walkthroughCopy, editsCounts, platformModifier, momentOptions, momentReason,
  ANNOTATION_TEXT_MAX_LENGTH, ANNOTATIONS_PER_STEP_CAP,
} from '../utils/walkthrough';

function StepNoteField({ stepKey, initialText, label, disabled, onCommit }) {
  const [value, setValue] = useState(initialText);
  useEffect(() => { setValue(initialText); }, [stepKey, initialText]);
  return (
    <TextField
      size="small" fullWidth multiline maxRows={3} variant="standard" label={label}
      value={value} disabled={disabled}
      onChange={e => setValue(e.target.value.slice(0, NODE_NOTE_MAX_LENGTH))}
      onBlur={() => { if (!disabled && value !== initialText) onCommit(value); }}
      sx={{ mt: 0.5 }}
    />
  );
}

/**
 * A chapter's date, with the registry's reason for it on screen.
 *
 * It used to be a bare date input carrying a preselected day — the company's
 * last filing, or the most recent of a person's seat dates — with nothing
 * saying which. The picker now lists the dates this chapter actually has,
 * each labelled with the act it comes from, and the line underneath says
 * whether the current one was preselected or chosen.
 */
function StepMomentField({ step, options, reason, wt, lang, onChange }) {
  const known = options.some(o => o.date === step.moment);
  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {options.length > 0 && (
          <TextField
            select size="small" label={wt.momentPick}
            value={known ? step.moment : ''}
            onChange={e => onChange(e.target.value)}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 240, flex: 1 }}
          >
            <option value="">{wt.momentNone}</option>
            {options.map(o => (
              <option key={o.date} value={o.date}>{`${isoDayShort(o.date, lang)} · ${o.label}`}</option>
            ))}
          </TextField>
        )}
        <TextField
          size="small" type="date" label={options.length ? wt.momentCustom : wt.momentLabel}
          value={step.moment || ''}
          onChange={e => onChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 190 }}
        />
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
        {reason}
      </Typography>
    </Box>
  );
}

/** One dated note: its own date, its own text, removable on its own. */
function DatedNoteRow({ annotation, wt, onChange, onRemove }) {
  const [text, setText] = useState(annotation.text);
  useEffect(() => { setText(annotation.text); }, [annotation.id, annotation.text]);
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 0.75 }}>
      <TextField
        size="small" type="date" label={wt.datedNoteDate}
        value={annotation.date || ''}
        onChange={e => onChange({ ...annotation, date: e.target.value })}
        InputLabelProps={{ shrink: true }}
        sx={{ width: 170, flexShrink: 0 }}
      />
      <TextField
        size="small" fullWidth multiline maxRows={3} label={wt.datedNoteText}
        value={text}
        onChange={e => setText(e.target.value.slice(0, ANNOTATION_TEXT_MAX_LENGTH))}
        onBlur={() => { if (text !== annotation.text) onChange({ ...annotation, text }); }}
      />
      <IconButton size="small" onClick={onRemove} title={wt.removeDatedNote} sx={{ mt: 0.5 }}>
        <DeleteOutlineIcon fontSize="inherit" />
      </IconButton>
    </Box>
  );
}

export default function RelationshipReportModal({
  open, onClose, doc, graphData, networkNote, onNetworkNoteChange,
  reportTitle = '', onReportTitleChange = () => {},
  lang = 'es', reportLang = 'es', onReportLangChange = () => {}, onRemoveCompany,
  walkthrough = null, author = { name: '', organisation: '' }, onAuthorChange = () => {},
  edits = null, onPlay = null,
  // Every export path reports through one GA4 seam so the caller can stamp
  // the report's language and size on each action.
  onTrack = () => {},
}) {
  const [copied, setCopied] = useState(false);
  const [previewBlocked, setPreviewBlocked] = useState(false);
  const es = reportLang !== 'en';
  const t = exportCopy(es ? 'es' : 'en');
  const wt = walkthroughCopy(es ? 'es' : 'en');
  const steps = walkthrough?.steps || [];
  const suggestions = walkthrough?.suggestions || [];
  const nodeName = id => (graphData?.nodes || []).find(n => String(n.id) === String(id))?.name || id;
  const joinNames = names => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} ${wt.and} ${names[names.length - 1]}`);

  const companies = doc?.companies || [];
  const connectors = doc?.connectors || [];
  const ownership = doc?.ownership || [];
  const counts = doc?.counts || { companies: 0, officers: 0, sharedPeople: 0 };
  const otherNotes = doc?.otherNotes || [];
  const corrections = doc?.corrections || [];
  const officersByCompany = doc?.officersByCompany || {};
  const noDocument = !doc || !(graphData?.nodes?.length);

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
    onTrack('situation_report_copy');
  };

  const openPreview = async () => {
    // Open the tab synchronously, inside the click handler — Safari and Chrome
    // pop-up blockers only allow window.open when it runs directly from the
    // user gesture, not after an intervening await (the dynamic import below).
    const w = window.open('', '_blank');
    if (!w) { setPreviewBlocked(true); onTrack('walkthrough_preview_blocked'); return; }
    w.opener = null;
    const { buildExportHtml } = await import('../utils/investigationExport');
    const html = buildExportHtml(doc, graphData, { lang: es ? 'es' : 'en' });
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    w.location = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    onTrack('walkthrough_preview');
  };

  const download = async () => {
    const { buildExportHtml, exportFileName } = await import('../utils/investigationExport');
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
    onTrack('situation_report_download');
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
              onChange={(_, v) => v && onReportLangChange(v)}
              sx={{ '& .MuiToggleButton-root': { py: 0.2, px: 1.2, fontSize: '0.72rem', textTransform: 'none' } }}>
              <ToggleButton value="es">ES</ToggleButton>
              <ToggleButton value="en">EN</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* The title is the analyst's: an investigation that starts on one
            company can end up describing a web of interests, and the export's
            H1 and file name should say so. Blank keeps the first subject. */}
        <TextField
          fullWidth
          size="small"
          value={reportTitle}
          onChange={(e) => onReportTitleChange(e.target.value.slice(0, REPORT_TITLE_MAX_LENGTH))}
          placeholder={doc?.defaultSubject || (es ? 'Nombre del primer sujeto' : 'First subject name')}
          label={es ? 'Título del informe' : 'Report title'}
          inputProps={{ maxLength: REPORT_TITLE_MAX_LENGTH }}
          sx={{ mb: 2 }}
        />
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

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField size="small" label={wt.authorField} value={author.name}
            onChange={e => onAuthorChange({ ...author, name: e.target.value })} sx={{ flex: 1 }} />
          <TextField size="small" label={wt.organisationField} value={author.organisation}
            onChange={e => onAuthorChange({ ...author, organisation: e.target.value })} sx={{ flex: 1 }} />
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          {Object.keys(DEFAULT_BLOCKS).map(k => (
            <FormControlLabel
              key={k}
              control={(
                <Checkbox
                  size="small"
                  checked={author.blocks?.[k] ?? true}
                  onChange={e => onAuthorChange({
                    ...author,
                    blocks: { ...(author.blocks || DEFAULT_BLOCKS), [k]: e.target.checked },
                  })}
                />
              )}
              label={wt.blocks[k]}
            />
          ))}
        </Box>

        {steps.length > 0 && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 0.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>{t.walkthroughSection}</Typography>
              <Button size="small" onClick={() => {
                const c = editsCounts(edits);
                // Dated notes are notes: the confirmation counts what would be lost.
                if (window.confirm(wt.resetConfirm(c.hidden, c.notes + c.annotations))) walkthrough.reset();
              }} sx={{ textTransform: 'none' }}>{wt.reset}</Button>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {walkthrough?.mode === 'selection'
                ? wt.selectionHelp(platformModifier(typeof navigator !== 'undefined' ? navigator : undefined))
                : wt.draftHelp}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
              {wt.momentHelp}
            </Typography>
            {steps.map((s, i) => (
              <Box key={s.key} sx={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 1, py: 0.75, borderTop: '1px solid', borderColor: 'divider', alignItems: 'start' }}>
                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, pt: 0.5 }}>{String(i + 1).padStart(2, '0')}</Typography>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {wt.kinds?.[s.kind] || wt.sections?.[s.section]} · {wt.sources[s.source]}{s.date ? ` · ${s.date}` : ''}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.title}</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{s.summary || s.text}</Typography>
                  <StepNoteField
                    stepKey={s.key}
                    initialText={s.narrative?.text || s.authorNote?.text || ''}
                    label={wt.noteField}
                    onCommit={v => walkthrough.setNote(s.key, v)}
                  />
                  <StepMomentField
                    step={s}
                    options={momentOptions(s, reportLang)}
                    reason={momentReason(s, reportLang)}
                    wt={wt}
                    lang={es ? 'es' : 'en'}
                    onChange={v => walkthrough.setMoment(s.key, v)}
                  />
                  {/* One date per note. A chapter's own Momento pins the map to a
                      single day; an argument about someone's position in a group
                      usually runs across several, and each of those needs its own
                      sentence rather than a date nobody can account for. */}
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      {wt.datedNotes}
                    </Typography>
                    {(s.annotations || []).map(a => (
                      <DatedNoteRow
                        key={a.id}
                        annotation={a}
                        wt={wt}
                        onChange={next => walkthrough.setAnnotation(s.key, next)}
                        onRemove={() => walkthrough.removeAnnotation(s.key, a.id)}
                      />
                    ))}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                      <Button
                        size="small" startIcon={<EventNoteIcon />}
                        disabled={(s.annotations || []).length >= ANNOTATIONS_PER_STEP_CAP}
                        onClick={() => walkthrough.addAnnotation(s.key)}
                        sx={{ textTransform: 'none' }}
                      >
                        {wt.addDatedNote}
                      </Button>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {(s.annotations || []).length >= ANNOTATIONS_PER_STEP_CAP
                          ? wt.datedNotesFull(ANNOTATIONS_PER_STEP_CAP)
                          : wt.datedNotesHelp}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex' }}>
                  <IconButton size="small" disabled={i === 0} onClick={() => walkthrough.move(s.key, -1)} title={wt.moveUp}><ArrowUpwardIcon fontSize="inherit" /></IconButton>
                  <IconButton size="small" disabled={i === steps.length - 1} onClick={() => walkthrough.move(s.key, 1)} title={wt.moveDown}><ArrowDownwardIcon fontSize="inherit" /></IconButton>
                  <IconButton size="small" onClick={() => walkthrough.hide(s.key)} title={wt.hideStep}><VisibilityOffIcon fontSize="inherit" /></IconButton>
                </Box>
              </Box>
            ))}
          </>
        )}

        {suggestions.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{wt.suggestionsTitle}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>{wt.suggestionsHelp}</Typography>
            {suggestions.map(sg => (
              <Box key={sg.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {wt.connectionLine(joinNames(sg.ends.map(nodeName)), joinNames(sg.via.map(nodeName)), sg.hops)}
                </Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => walkthrough.acceptConnection(sg.key)} sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}>
                  {wt.addStep}
                </Button>
              </Box>
            ))}
          </Box>
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

      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap' }}>
        <Typography variant="caption" component="p" sx={{ width: '100%', mb: 0.5, color: 'text.secondary' }}>
          {es
            ? 'Tu resumen y las notas de los nodos se incluyen al copiar o descargar este informe de situación. Revísalos antes de compartirlo.'
            : 'Your summary and node notes are included when you copy or download this situation report. Review them before sharing it.'}
        </Typography>
        <Button onClick={onClose}>{es ? 'Cerrar' : 'Close'}</Button>
        <Button startIcon={<ContentCopyIcon />} onClick={copyForWord} disabled={noDocument}>
          {es ? 'Copiar para Word' : 'Copy for Word'}
        </Button>
        {/* The walkthrough plays from here, beside the other ways out of the
            modal — a footer action, not a header link nobody looks for. */}
        {onPlay && steps.length > 0 && (
          <Button variant="outlined" startIcon={<PlayArrowIcon />} onClick={onPlay} sx={{ textTransform: 'none' }}>
            {wt.playOnMap}
          </Button>
        )}
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {es ? 'se abre en tu navegador' : 'opens in your browser'}
        </Typography>
        <Button variant="outlined" startIcon={<OpenInNewIcon />} onClick={openPreview} disabled={noDocument}>
          {wt.openPreview}
        </Button>
        <Button variant="contained" startIcon={<DownloadIcon />} onClick={download} disabled={noDocument}>
          {es ? 'Descargar' : 'Download'}
        </Button>
      </DialogActions>

      <Snackbar
        open={copied} autoHideDuration={2500} onClose={() => setCopied(false)}
        message={es ? 'Copiado — pégalo en Word' : 'Copied — paste into Word'}
      />
      <Snackbar
        open={previewBlocked} autoHideDuration={4000} onClose={() => setPreviewBlocked(false)}
        message={wt.previewBlocked}
      />
    </Dialog>
  );
}
