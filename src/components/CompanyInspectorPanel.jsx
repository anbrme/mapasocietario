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
  NotificationsActive as NotificationsActiveIcon,
} from '@mui/icons-material';
import PersonIcon from '@mui/icons-material/Person';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import GroupsIcon from '@mui/icons-material/Groups';
import TableRowsIcon from '@mui/icons-material/TableRows';
import CurrencyConfirmationCard from './CurrencyConfirmationCard.jsx';
import OfficerInspectorBody from './OfficerInspectorBody.jsx';
import CompanyFindings from './CompanyFindings';
import { FINDINGS_PANEL_ENABLED } from '../config';
import { listedBadgeFor } from '../utils/ibex35Match';
import { CONFIRMATIONS } from '../../functions/empresa/_confirmations.js';
import { nameToSlug } from '../../functions/empresa/_slug.js';
import { fullCompanyPageHref } from '../../functions/empresa/_page_href.js';
import { trackFullCompanyProfileClick } from '../utils/track';
import { recordCompanyDemand } from '../utils/companyDemand';
import { formatDate } from '../utils/formatDate';

// Findings-block evidence links open the data dock. The inspector has no
// events/capital/ownership dataset (buildCompanyDatasets in
// src/utils/inspectorDatasets.js has no generic "events" table), so only
// officer-kind evidence gets a link — the component itself only renders the
// link for that kind. 'current' is the only true officers table, and is the
// fallback for any other officer-evidence finding kind.
const FINDINGS_OFFICERS_DATASET_KEY = 'current';

// Finding kind -> the officer dataset key that actually backs it.
const FINDINGS_EVIDENCE_DATASET_KEY = {
  superseded_seats: 'superseded',
  governing_body_turnover: 'nombramientos',
};

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
  width = null,
  counts = [],
  isCorporateOfficer = false,
  onViewAsCompany,
  activeDatasetKey = null,
  onOpenDataset,
  onOpenReport,
  onBuyDueDiligence,
  onMonitorCompany,
  // Officer track record. The chart is prefetched alongside the profile so the
  // preview is populated by the time the panel paints, and so opening the full
  // dialog costs no second wait.
  officerChart = null,
  officerChartLoading = false,
  onOpenTimeline,
  onFocusCompany,
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
    // Docked to the right edge of the GRAPH CONTAINER, not the viewport. The
    // container reserves this width out of the canvas, so the graph reflows
    // beside the panel instead of hiding under it. `width` null means the
    // viewport is too narrow to sit side by side — the panel covers the canvas.
    <Paper
      elevation={8}
      onContextMenu={e => e.preventDefault()}
      onCopy={e => e.preventDefault()}
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: width ?? '100%',
        maxWidth: '100%',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
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
            {/* An officer node can BE one of the curated listed entities, when
                the filing printed the company without its legal form ("BANCO
                SANTANDER"). The company path badges via CompanyFindings. */}
            {nodeType === 'officer' && listedBadgeFor(nodeName, lang) && (
              <Chip
                label={listedBadgeFor(nodeName, lang).label}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
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

        {/* Findings — the on-ramp to the paid report. Sits first in the
            scrollable body, above the Structure chips and the rest of the
            fact sheet, so it is the first thing a reader hits after the
            header. */}
        {FINDINGS_PANEL_ENABLED && data?.type === 'company' && data.name && (
          <CompanyFindings
            groupKey={data.company?.group_key || data.company?._id || null}
            name={data.name}
            lang={lang}
            onOpenReport={onOpenReport}
            onEvidence={ev => onOpenDataset?.(FINDINGS_EVIDENCE_DATASET_KEY[ev.kind] || FINDINGS_OFFICERS_DATASET_KEY)}
            listed={listedBadgeFor(data.name, lang)}
          />
        )}

        {/* Structure — the parts of the record the GRAPH already draws. Showing
            them as counts rather than tables keeps this panel a fixed height
            whatever the company's size: a bank with 30,000 registry officers
            renders the same four chips as a two-person SL. Clicking one opens
            that table in the data dock, paginated. */}
        {/* Officers get their seats rendered in full below, so the chip row
            would only restate them. It stays for companies, where the counts
            ARE the summary. */}
        {counts.length > 0 && data?.type !== 'officer' && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              <GroupsIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
              {text.structureSection}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {counts.map(({ key, label, count }) => (
                <Chip
                  key={key}
                  label={`${label} · ${count}`}
                  size="small"
                  clickable
                  onClick={() => onOpenDataset?.(key)}
                  color={key === activeDatasetKey ? 'primary' : 'default'}
                  variant={key === activeDatasetKey ? 'filled' : 'outlined'}
                  icon={<TableRowsIcon sx={{ fontSize: 15 }} />}
                />
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
              {text.structureHint}
            </Typography>
          </Box>
        )}
        {data && data.type === 'company' && (() => {
          const e = data.enriched;
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
                  {!FINDINGS_PANEL_ENABLED && (
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
                  )}
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
                        {e.capitalUnverified && (
                          <Typography component="span" variant="caption" sx={{ color: 'warning.main', fontStyle: 'italic', ml: 0.5 }}>
                            {text.capitalUnverified}
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

        {data?.type === 'officer' && isCorporateOfficer && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <Button size="small" onClick={() => onViewAsCompany?.()} sx={{ textTransform: 'none', fontWeight: 700 }}>
                {text.viewAsCompany}
              </Button>
            }
          >
            <Typography variant="body2">{text.corporateOfficerNotice}</Typography>
          </Alert>
        )}

        {data && data.type === 'officer' && (() => {
          // The roles-per-company and wholly-owned tables live in the data dock;
          // this branch only renders what the graph cannot draw about a person.
          const variants = data.nameVariants;
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

              <OfficerInspectorBody
                data={data}
                text={text}
                lang={lang}
                chart={officerChart}
                timelineLoading={officerChartLoading}
                onOpenTimeline={onOpenTimeline}
                onFocusCompany={onFocusCompany}
                onOpenDataset={onOpenDataset}
              />

              <Typography
                variant="caption"
                sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', mt: 2, fontStyle: 'italic' }}
              >
                {text.previewWatermark}
              </Typography>
            </Box>
          );
        })()}

        {/* What the paid report adds over this preview — the value gap, stated
            plainly. Lives in the scroll area so the pinned footer stays short. */}
        {data?.type === 'company' && (
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.5, mt: 3 }}>
            {text.fullReportAdds}
          </Typography>
        )}

      </Box>
      {data?.type === 'company' ? (
        <Box sx={{ px: 2, pb: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          {/* Data-quality guarantee — kept at the decision point, but on one line
              so the pinned footer does not crowd out the fact sheet above it. */}
          <Tooltip title={text.previewGuarantee}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
              <VerifiedUserIcon sx={{ fontSize: 16, color: 'accent.success', flexShrink: 0 }} />
              <Typography
                variant="caption"
                noWrap
                sx={{ color: 'accent.success', fontSize: '0.72rem', minWidth: 0 }}
              >
                {text.previewGuarantee}
              </Typography>
            </Box>
          </Tooltip>
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
            {onMonitorCompany && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<NotificationsActiveIcon />}
                onClick={onMonitorCompany}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                {text.monitorCompany}
              </Button>
            )}
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
