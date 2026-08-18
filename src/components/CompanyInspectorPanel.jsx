import React, { useEffect } from 'react';
import {
  Typography,
  Box,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Paper,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Business as BusinessIcon,
  OutlinedFlag as ReportIcon,
  Description as DescriptionIcon,
  Info as InfoIcon,
  PictureAsPdf as PictureAsPdfIcon,
  VerifiedUser as VerifiedUserIcon,
} from '@mui/icons-material';
import PersonIcon from '@mui/icons-material/Person';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CurrencyConfirmationCard from './CurrencyConfirmationCard.jsx';
import { CONFIRMATIONS } from '../../functions/empresa/_confirmations.js';
import { nameToSlug } from '../../functions/empresa/_slug.js';
import { fullCompanyPageHref } from '../../functions/empresa/_page_href.js';
import { trackFullCompanyProfileClick } from '../utils/track';
import { recordCompanyDemand } from '../utils/companyDemand';
import { formatDate } from '../utils/formatDate';

/**
 * Company / officer inspector for the network graph.
 *
 * A non-modal panel docked to the right edge: the graph stays visible and
 * interactive behind it, so a profile can be read against the structure it sits
 * in. All fetching stays in the graph (`openDataPreview`); this is a pure
 * renderer over the resolved preview payload.
 *
 * Deliberately non-copyable (userSelect: none, copy/context-menu suppressed) —
 * this is the free preview that sits in front of the paid Due Diligence report.
 */
const CompanyInspectorPanel = ({
  open,
  onClose,
  nodeName,
  nodeType,
  userMerged,
  data,
  loading,
  error,
  lang = 'es',
  text,
  officerDeputyMatches = {},
  entrySource = 'direct',
  onOpenReport,
  onBuyDueDiligence,
}) => {
  // Escape closes the panel — the modal gave users that for free; a non-modal
  // fixed Paper has no backdrop or focus trap, so it has to be wired by hand.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (ev) => {
      if (ev.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const statusChips = data?.type === 'company' && (
    <>
      {data.enriched?.isDissolved && (
        <Chip label={text.dissolved} size="small" color="error" />
      )}
      {data.enriched?.isInConcurso && (
        <Chip label={text.concurso} size="small" color="warning" />
      )}
      {data.enriched?.isUnipersonal && (
        <Chip label={text.unipersonal} size="small" color="info" variant="outlined" />
      )}
      {data.enriched?.previousSoleShareholders?.length > 0 && (() => {
        // Chain of socio único: previous (superseded) → current.
        const chain = [
          ...data.enriched.previousSoleShareholders,
          ...(data.enriched.soleShareholders || []),
        ].join(' → ');
        return (
          <Tooltip title={`${text.unipersonal}: ${chain}`}>
            <Chip
              label={chain}
              size="small"
              color="info"
              variant="outlined"
              sx={{
                maxWidth: '100%',
                '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
              }}
            />
          </Tooltip>
        );
      })()}
    </>
  );

  return (
    // Non-modal, right-anchored inspector: a fixed Paper (NO backdrop, no focus
    // trap) so the graph stays pannable and clickable behind it — the whole point
    // of reading a profile in a graph view is seeing the structure it sits in.
    // Matches the ApoderadosSidebar pattern already used here.
    <Paper
      elevation={8}
      onContextMenu={e => e.preventDefault()}
      onCopy={e => e.preventDefault()}
      sx={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: { xs: '100%', sm: 460, md: 520 },
        maxWidth: '100vw',
        zIndex: theme => theme.zIndex.drawer + 2,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid',
        borderColor: 'divider',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
      }}
    >
      {/* Header — name on its own line, chips wrapping beneath it: the panel is
          far narrower than the dialog was, so the old single-row title overflows. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          p: 2,
          pb: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {nodeType === 'officer' ? <PersonIcon /> : <BusinessIcon />}
            <Typography variant="h6" component="span" noWrap sx={{ minWidth: 0 }}>
              {nodeName}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
            <Chip
              label={nodeType === 'officer' ? text.officer : text.company}
              size="small"
              color={nodeType === 'officer' ? 'warning' : 'primary'}
              variant="outlined"
            />
            {userMerged && (
              <Tooltip title={text.userMergedTooltip}>
                <Chip label={text.userMergedBadge} size="small" color="warning" variant="outlined" />
              </Tooltip>
            )}
            {statusChips}
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label={text.close} sx={{ flexShrink: 0 }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress size={40} />
            <Typography sx={{ ml: 2 }} color="text.secondary">{text.loadingData}</Typography>
          </Box>
        )}
        {error && (
          <Alert severity="warning" sx={{ my: 2 }}>{error}</Alert>
        )}
        {data?.snapshotLocal && (
          <Alert severity="info" sx={{ mb: 2 }}>{text.snapshotPreviewNotice}</Alert>
        )}
        {data && data.type === 'company' && (() => {
          const e = data.enriched;
          const officerTable = (officers, color, title) => officers.length > 0 && (
            <>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color }}>
                {title} ({officers.length})
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>{text.name}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{text.role}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{text.date}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {officers.map((o, i) => (
                      <TableRow key={i}>
                        <TableCell>{o.name || '-'}</TableCell>
                        <TableCell>{o.position || '-'}</TableCell>
                        <TableCell>{o.date ? formatDate(o.date, lang) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          );

          const fullHref = fullCompanyPageHref(data.name, lang);
          return (
            <Box>
              <CurrencyConfirmationCard
                rec={CONFIRMATIONS[nameToSlug(data.name)]}
                lang={lang}
              />
              {/* Overview section */}
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                <InfoIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
                {text.summary}
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Typography variant="caption" color="text.secondary">{text.legalName}</Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        textDecoration: e?.isDissolved ? 'line-through' : 'none',
                        color: e?.isDissolved ? 'error.main' : 'inherit',
                      }}
                    >
                      {data.name}
                    </Typography>
                    {e?.nameChanges?.length > 0 ? (
                      <Box sx={{ mt: 0.25 }}>
                        {e.nameChanges.map((nc, idx) => (
                          <Typography
                            key={idx}
                            variant="caption"
                            display="block"
                            sx={{ color: 'warning.main', fontStyle: 'italic' }}
                          >
                            {nc.date ? `${formatDate(nc.date, lang)}: ` : ''}
                            {nc.old_name} → {nc.new_name}
                          </Typography>
                        ))}
                      </Box>
                    ) : (
                      e?.previousNames?.length > 0 && (
                        <Typography variant="caption" sx={{ color: 'warning.main', fontStyle: 'italic' }}>
                          {text.previous}: {e.previousNames.join(', ')}
                        </Typography>
                      )
                    )}
                  </Box>
                  {(e?.isDissolved || e?.isInConcurso || e?.isUnipersonal) && (
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Typography variant="caption" color="text.secondary">{text.status}</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                        {e.isDissolved && (
                          <Chip label={text.dissolved} size="small" color="error" />
                        )}
                        {e.isInConcurso && (
                          <Chip label={text.concurso} size="small" color="warning" />
                        )}
                        {e.isUnipersonal && (
                          <Chip label={text.unipersonal} size="small" color="info" variant="outlined" />
                        )}
                      </Box>
                    </Box>
                  )}
                  {e?.cif ? (
                    <Box>
                      <Typography variant="caption" color="text.secondary">CIF/NIF</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" className="registry-ref">{e.cif}</Typography>
                        <Tooltip title={text.reportNifTooltip}>
                          <IconButton
                            size="small"
                            onClick={() => onOpenReport('nif', e.cif)}
                            sx={{ p: 0.25 }}
                            aria-label={text.reportNifTooltip}
                          >
                            <ReportIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  ) : data?.type === 'company' ? (
                    <Box>
                      <Typography variant="caption" color="text.secondary">CIF/NIF</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="body2" color="text.disabled">{text.nifMissingLabel}</Typography>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<ReportIcon sx={{ fontSize: 14 }} />}
                          onClick={() => onOpenReport('nif', '')}
                          sx={{ textTransform: 'none', fontSize: '0.7rem', p: 0.25, minWidth: 0, color: 'warning.main' }}
                        >
                          {text.reportNifMissingCta}
                        </Button>
                      </Box>
                    </Box>
                  ) : null}
                  {e?.address && (
                    <Box sx={{ gridColumn: e?.cif ? 'auto' : '1 / -1' }}>
                      <Typography variant="caption" color="text.secondary">{text.address}</Typography>
                      <Typography variant="body2">
                        {e.address}
                        {e.addressExternal && (
                          <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', ml: 0.5 }}>
                            {text.externalEstimate}
                          </Typography>
                        )}
                      </Typography>
                    </Box>
                  )}
                  {e?.activity && (
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Typography variant="caption" color="text.secondary">{text.activity}</Typography>
                      <Typography variant="body2">{e.activity}</Typography>
                    </Box>
                  )}
                  {e?.capital && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">{text.capital}</Typography>
                      <Typography variant="body2" className="registry-ref">
                        {e.capital}
                        {e.capitalExternal && (
                          <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', ml: 0.5 }}>
                            {text.externalEstimate}
                          </Typography>
                        )}
                      </Typography>
                    </Box>
                  )}
                  {(e?.firstSeen || e?.lastSeen) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">{text.bormeRange}</Typography>
                      <Typography variant="body2" className="registry-ref">
                        {e.firstSeen ? formatDate(e.firstSeen, lang) : '?'} — {e.lastSeen ? formatDate(e.lastSeen, lang) : '?'}
                      </Typography>
                    </Box>
                  )}
                  {e?.eventCount > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">{text.publicationsFound}</Typography>
                      <Typography variant="body2" className="registry-ref">{e.eventCount}</Typography>
                    </Box>
                  )}
                  {e?.isUnipersonal &&
                    ((e?.soleShareholdersCorporate?.length || 0) +
                      (e?.soleShareholdersIndividual?.length || 0) > 0) && (
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Typography variant="caption" color="text.secondary">{text.soleShareholder}</Typography>
                      <Typography variant="body2">
                        {[
                          ...e.soleShareholdersCorporate.map((n) => `${n} ${text.companyTag}`),
                          ...e.soleShareholdersIndividual.map((n) => `${n} ${text.naturalPersonTag}`),
                        ].join(', ')}
                      </Typography>
                      {/* Owners renamed since they were declared: show the
                          act's wording so the current label stays traceable
                          to what BORME actually published. */}
                      {e?.soleShareholderRenames?.map((r, idx) => (
                        <Typography
                          key={idx}
                          variant="caption"
                          display="block"
                          sx={{ color: 'text.secondary', fontStyle: 'italic' }}
                        >
                          {text.declaredAs} «{r.declaredName}»
                          {r.declaredDate ? ` (${formatDate(r.declaredDate, lang)})` : ''}
                        </Typography>
                      ))}
                      {e?.previousSoleShareholders?.length > 0 && (
                        <Typography variant="caption" sx={{ color: 'warning.main', fontStyle: 'italic' }}>
                          {text.previous}: {e.previousSoleShareholders.join(', ')}
                        </Typography>
                      )}
                    </Box>
                  )}
                  {e?.hojaHistory?.length > 1 && (
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Typography variant="caption" color="text.secondary">
                        {text.registrySheetChange}
                      </Typography>
                      <Typography variant="body2" className="registry-ref">
                        {e.hojaHistory.map((h, i) => (
                          `${h.hoja}${h.province ? ` (${h.province})` : ''} ${formatDate(h.first_seen, lang)} — ${formatDate(h.last_seen, lang)}`
                        )).join('  →  ')}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>

              {fullHref && (
                <Typography
                  component="a"
                  href={fullHref}
                  target="_blank"
                  rel="noopener"
                  onClick={() => {
                    trackFullCompanyProfileClick({
                      href: fullHref,
                      language: lang,
                      entrySource,
                    });
                    recordCompanyDemand({
                      eventType: 'full_profile_click',
                      language: lang,
                      company: { ...(e || {}), name: data.name },
                    });
                  }}
                  variant="body2"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mb: 3,
                    // accent.primary in both directions, hover included: the
                    // old primary.light -> primary.main hover DIMMED the link
                    // in dark mode (light.dark's "light" shade is brighter than
                    // its "main"), while accent.primary's light-mode value is
                    // already darkened to primary.dark for the 4.5:1 text floor
                    // (finding 1), leaving no further token to darken toward on
                    // hover. Dropping the hover colour swap avoids reintroducing
                    // a wrong-direction change in either mode (finding 6).
                    color: 'accent.primary',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    textDecorationColor: (t) => alpha(t.palette.accent.primary, 0.5),
                  }}
                >
                  {lang === 'en' ? 'Open company profile' : 'Abrir ficha societaria'}
                  <OpenInNewIcon sx={{ fontSize: 16 }} />
                </Typography>
              )}

              {/* Current officers — grouped by person, sorted by position importance */}
              {e?.currentOfficers?.length > 0 && (
                <>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: 'primary.main' }}>
                    {text.currentOfficers(e.currentOfficers.length)}
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>{text.name}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{text.role}(s)</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{text.date}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {e.currentOfficers.map((officer, i) => {
                          const dm = officerDeputyMatches[officer.name];
                          const deputyChip = dm?.deputy ? (
                            <Chip
                              label={dm.deputy.FECHABAJA ? `🏛️ ${lang === 'en' ? 'Former MP' : 'Ex-dip.'}` : `🏛️ ${text.congressDeputy}${dm.deputy.FORMACIONELECTORAL ? ` · ${dm.deputy.FORMACIONELECTORAL}` : ''}`}
                              size="small"
                              variant="outlined"
                              sx={{
                                ml: 0.75,
                                height: 18,
                                fontSize: '0.6rem',
                                color: dm.deputy.FECHABAJA ? 'text.secondary' : 'warning.dark',
                                borderColor: dm.deputy.FECHABAJA ? 'grey.400' : 'warning.main',
                              }}
                            />
                          ) : null;
                          return officer.positions.length === 1 ? (
                            <TableRow key={i}>
                              <TableCell>
                                {officer.name || '-'}
                                {deputyChip}
                              </TableCell>
                              <TableCell>{officer.positions[0].position || '-'}</TableCell>
                              <TableCell>{officer.positions[0].date ? formatDate(officer.positions[0].date, lang) : '-'}</TableCell>
                            </TableRow>
                          ) : (
                            officer.positions.map((pos, j) => (
                              <TableRow key={`${i}-${j}`}>
                                {j === 0 ? (
                                  <TableCell rowSpan={officer.positions.length} sx={{ verticalAlign: 'top', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'divider' }}>
                                    {officer.name || '-'}
                                    {deputyChip}
                                  </TableCell>
                                ) : null}
                                <TableCell sx={j === officer.positions.length - 1 ? { borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'divider' } : undefined}>
                                  {pos.position || '-'}
                                </TableCell>
                                <TableCell sx={j === officer.positions.length - 1 ? { borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'divider' } : undefined}>
                                  {pos.date ? formatDate(pos.date, lang) : '-'}
                                </TableCell>
                              </TableRow>
                            ))
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              {/* Officers by category (historical) */}
              {e?.officers && (
                <>
                  {officerTable(e.officers.nombramientos, 'graph.link.appointment', text.appointments)}
                  {officerTable(e.officers.reelecciones, 'graph.link.appointment', text.reelections)}
                  {officerTable(e.officers.ceses_dimisiones, 'graph.link.cessation', text.cessations)}
                  {officerTable(e.officers.revocaciones, 'graph.link.cessation', text.revocations)}
                </>
              )}

              {/* Watermark */}
              <Typography
                variant="caption"
                sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', mt: 2, fontStyle: 'italic' }}
              >
                {text.previewWatermark}
              </Typography>
            </Box>
          );
        })()}

        {data && data.type === 'officer' && (() => {
          const officers = data.officers || [];
          const variants = data.nameVariants;
          // Group by company
          const byCompany = {};
          officers.forEach(o => {
            const companyName = o.company_name || o.company || text.unknown;
            if (!byCompany[companyName]) byCompany[companyName] = [];
            byCompany[companyName].push(o);
          });
          // v3 expand-officer returns: officer_name, company_name, specific_role,
          // event_type ("nombramientos"/"ceses_dimisiones"), status ("active"/"ceased"), date
          const resolveStatus = (o) => {
            const st = (o.status || '').toLowerCase();
            if (st === 'active') return { label: lang === 'en' ? 'Active' : 'Activo', color: 'success' };
            if (st === 'ceased') return { label: lang === 'en' ? 'Ceased' : 'Cesado', color: 'error' };
            const evt = (o.event_type || '').toLowerCase();
            if (evt.includes('nombr') || evt.includes('reelecc')) return { label: lang === 'en' ? 'Active' : 'Activo', color: 'success' };
            if (evt.includes('cese') || evt.includes('dimis') || evt.includes('revoc')) return { label: lang === 'en' ? 'Ceased' : 'Cesado', color: 'error' };
            return { label: text.unknown, color: 'default' };
          };
          const resolvePosition = (o) => o.specific_role || o.position_normalized || o.role || o.position || '-';
          const resolveDate = (o) => o.date || o.event_date || '';

          const whollyOwned = data.whollyOwned || [];
          const deputyMatch = officerDeputyMatches[data.name];
          return (
            <Box>
              {deputyMatch?.deputy && (() => {
                const d = deputyMatch.deputy;
                const isFormer = !!d.FECHABAJA;
                const fullName = d.APELLIDOS ? `${d.NOMBRE || ''} ${d.APELLIDOS}`.trim() : d.NOMBRE;
                const legs = Array.from(
                  new Set((deputyMatch.rows || []).map(r => r.LEGISLATURA).filter(Boolean))
                );
                const allDates = (deputyMatch.rows || [])
                  .map(r => r.FECHAINICIOLEGISLATURA)
                  .filter(Boolean);
                const allEnds = (deputyMatch.rows || [])
                  .map(r => r.FECHAFINLEGISLATURA || r.FECHABAJA)
                  .filter(Boolean);
                const parseEs = s => {
                  if (!s) return 0;
                  const p = String(s).split('/');
                  return p.length === 3 ? Date.parse(`${p[2]}-${p[1]}-${p[0]}`) || 0 : Date.parse(s) || 0;
                };
                const earliest = allDates.sort((a, b) => parseEs(a) - parseEs(b))[0];
                const sittingRow = (deputyMatch.rows || []).find(r => r.LEGISLATURAACTUAL === 'S');
                const latest = isFormer
                  ? allEnds.sort((a, b) => parseEs(b) - parseEs(a))[0]
                  : null;
                return (
                  <Alert
                    severity={isFormer ? 'info' : 'warning'}
                    icon={false}
                    sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        🏛️ {isFormer ? text.formerCongressDeputy : text.congressDeputy}
                      </Typography>
                      <Chip
                        label={`${Math.round(deputyMatch.confidence * 100)}% match`}
                        size="small"
                        variant="outlined"
                        sx={{ height: 18, fontSize: '0.6rem' }}
                      />
                    </Box>
                    {fullName && fullName.toUpperCase() !== (data.name || '').toUpperCase() && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {text.matchesWith}: <b>{fullName}</b>
                      </Typography>
                    )}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mt: 0.5 }}>
                      {d.FORMACIONELECTORAL && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">{text.party}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{d.FORMACIONELECTORAL}</Typography>
                        </Box>
                      )}
                      {d.GRUPOPARLAMENTARIO && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">{text.group}</Typography>
                          <Typography variant="body2">{d.GRUPOPARLAMENTARIO}</Typography>
                        </Box>
                      )}
                      {d.CIRCUNSCRIPCION && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">{text.constituency}</Typography>
                          <Typography variant="body2">{d.CIRCUNSCRIPCION}</Typography>
                        </Box>
                      )}
                      {legs.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {text.legislature(legs.length)}
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
                            {legs.join(', ')}
                          </Typography>
                        </Box>
                      )}
                      {(earliest || latest) && (
                        <Box sx={{ gridColumn: '1 / -1' }}>
                          <Typography variant="caption" color="text.secondary">{text.period}</Typography>
                          <Typography variant="body2">
                            {earliest || '?'}
                            {isFormer ? ` — ${latest || '?'}` : ` — ${text.present}`}
                            {sittingRow?.LEGISLATURA ? ` (${sittingRow.LEGISLATURA})` : ''}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    {d.BIOGRAFIA && (
                      <Typography
                        variant="caption"
                        component="a"
                        href={d.BIOGRAFIA}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ display: 'block', mt: 1, color: 'primary.main', textDecoration: 'underline' }}
                      >
                        {text.congressProfile} →
                      </Typography>
                    )}
                  </Alert>
                );
              })()}
              {variants && variants.length > 1 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {text.mergedNodesData}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {text.nameVariants}: {variants.join(' / ')}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                    {text.mergedWarning}
                  </Typography>
                </Alert>
              )}

              {/* Wholly-owned companies (sole shareholder positions) */}
              {whollyOwned.length > 0 && (
                <Box sx={{ mb: 2.5 }}>
                  <Alert severity="warning" sx={{ mb: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {text.whollyOwned(whollyOwned.length)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {text.whollyOwnedHelp}
                    </Typography>
                  </Alert>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {whollyOwned.map((c, i) => {
                      const isDissolved = c.is_dissolved;
                      const isInConcurso = c.is_in_concurso;
                      return (
                        <Paper
                          key={`wo-${i}`}
                          variant="outlined"
                          sx={{
                            p: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            bgcolor: isDissolved
                              ? 'error.50'
                              : isInConcurso
                                ? 'warning.50'
                                : 'background.paper',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                            <BusinessIcon sx={{ fontSize: 16, color: isDissolved ? 'error.main' : 'primary.main' }} />
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 500,
                                textDecoration: isDissolved ? 'line-through' : 'none',
                              }}
                              noWrap
                            >
                              {c.name}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                            {isDissolved && <Chip label={text.dissolved} size="small" color="error" />}
                            {isInConcurso && <Chip label={text.concurso} size="small" color="warning" />}
                            <Chip label="100%" size="small" color={isDissolved ? 'error' : 'success'} />
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                </Box>
              )}

              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                <PersonIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
                {text.rolesInCompanies(Object.keys(byCompany).length)}
              </Typography>
              {Object.entries(byCompany).map(([companyName, companyOfficers]) => (
                <Paper key={companyName} variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                    <BusinessIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
                    {companyName}
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>{text.role}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{text.status}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{text.date}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {companyOfficers.map((o, i) => {
                          const status = resolveStatus(o);
                          return (
                            <TableRow key={i}>
                              <TableCell>{resolvePosition(o)}</TableCell>
                              <TableCell>
                                <Chip
                                  label={status.label}
                                  size="small"
                                  color={status.color}
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>{formatDate(resolveDate(o), lang)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              ))}
              <Typography
                variant="caption"
                sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', mt: 2, fontStyle: 'italic' }}
              >
                {text.previewWatermark}
              </Typography>
            </Box>
          );
        })()}
      </Box>
      {data?.type === 'company' ? (
        <Box sx={{ px: 2, pb: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          {/* What the paid report adds over this preview — the value gap, stated plainly. */}
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.5, mb: 1 }}>
            {text.fullReportAdds}
          </Typography>
          {/* Data-quality guarantee — surfaced here, at the decision point, not only at checkout. */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              p: 1.25,
              mb: 1.5,
              borderRadius: 1.5,
              bgcolor: (t) => alpha(t.palette.success.main, 0.08),
              border: (t) => `1px solid ${alpha(t.palette.success.main, 0.25)}`,
            }}
          >
            <VerifiedUserIcon sx={{ fontSize: 18, color: 'accent.success', mt: '1px', flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: 'accent.success', fontSize: '0.74rem', lineHeight: 1.45 }}>
              {text.previewGuarantee}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
            <Button
              variant="contained"
              color="warning"
              startIcon={<DescriptionIcon />}
              onClick={onBuyDueDiligence}
              sx={{ textTransform: 'none', fontWeight: 700, color: 'warning.contrastText' }}
            >
              {text.buyDueDiligencePriced}
            </Button>
            {/* Let buyers see exactly what they're paying for before they commit. */}
            <Button
              component="a"
              href="/sample-dd-report.pdf"
              target="_blank"
              rel="noopener"
              startIcon={<PictureAsPdfIcon />}
              sx={{ textTransform: 'none', color: 'text.secondary' }}
            >
              {text.previewSeeSample}
            </Button>
            <Button onClick={onClose} sx={{ ml: { xs: 0, sm: 'auto' } }}>
              {text.close}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', textAlign: 'right' }}>
          <Button onClick={onClose}>{text.close}</Button>
        </Box>
      )}
    </Paper>
  );
};

export default CompanyInspectorPanel;
