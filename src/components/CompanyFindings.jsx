import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Skeleton, Link, Button } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import { spanishCompaniesService } from '../services/spanishCompaniesService';
import { findingsView, findingsErrorView, findingsVisibleParams } from '../utils/findingsView';
import { trackEvent } from '../utils/track';

// Identity → what changed → what stands out → needs verification → offer.
// No strings live here: texts come from the payload or findingsView.

const TONE_SX = {
  concern: { borderLeft: '3px solid', borderColor: 'warning.main', pl: 1 },
  context: { borderLeft: '3px solid', borderColor: 'divider', pl: 1 },
  limitation: { borderLeft: '3px solid', borderColor: 'divider', pl: 1, color: 'text.secondary', fontStyle: 'italic' },
};

// Fire findings_visible once per company per session, not on every mount
// (panel open/close, re-render) — a module-level set survives across
// instances for the lifetime of the page.
const seenFindings = new Set();

export default function CompanyFindings({ groupKey, name, lang, onOpenReport, offerCta, onEvidence, listed }) {
  const [state, setState] = useState({ status: 'loading', view: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', view: null });
    spanishCompaniesService.getCompanyFindings({ groupKey, name, lang })
      .then(payload => {
        if (cancelled) return;
        const view = findingsView(payload, lang);
        setState({ status: 'ready', view });
        const seenKey = `${groupKey || name}|${lang}`;
        if (!seenFindings.has(seenKey)) {
          seenFindings.add(seenKey);
          trackEvent('findings_visible', findingsVisibleParams(view));
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.error('company findings failed', err);
        trackEvent('findings_unavailable', { status: err?.status || 0 });
        setState({ status: 'error', view: null });
      });
    return () => { cancelled = true; };
  }, [groupKey, name, lang]);

  if (state.status === 'loading') {
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Skeleton width="60%" /><Skeleton width="40%" /><Skeleton width="80%" />
      </Paper>
    );
  }
  if (state.status === 'error') {
    return (
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 2 }}>
        {findingsErrorView(lang).text}
      </Typography>
    );
  }

  const { header, changed, findings, verification, offer, labels } = state.view;
  const clickEvidence = f => {
    trackEvent('evidence_clicked', { kind: f.evidence.kind });
    onEvidence({ kind: f.kind, evidence: f.evidence });
  };
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {header.title}
        <Typography component="span" variant="body2" sx={{ color: 'text.secondary', ml: 1 }}>
          · {header.nifLabel}
          {header.nifMissing && onOpenReport && (
            <> — <Link component="button" onClick={() => onOpenReport('nif', '')}>{labels.nifTellUs}</Link></>
          )}
          {header.province && ` · ${header.province}`}
          {listed && ` · ${listed.label}${listed.ticker ? ` · ${listed.ticker}` : ''}`}
          {header.formerly && ` · ${header.formerly}`}
        </Typography>
      </Typography>
      {changed && (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1.5 }}>{changed}</Typography>
      )}

      {findings.length > 0 && (
        <>
          <Typography variant="overline" sx={{ display: 'block', fontWeight: 700, letterSpacing: '0.08em' }}>{labels.standsOut}</Typography>
          {findings.map((f, index) => (
            <Box key={`${f.key}:${index}`} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.5, ...TONE_SX[f.tone] }}>
              <Typography variant="body2" sx={{ flex: 1 }}>{f.text}</Typography>
              {f.date && <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{f.date}</Typography>}
              {f.evidence?.kind === 'officer' && onEvidence && (
                <Link component="button" variant="caption" onClick={() => clickEvidence(f)}>{labels.evidence}</Link>
              )}
              {f.bormeUrl && (
                <Link href={f.bormeUrl} target="_blank" rel="noopener" variant="caption"
                  onClick={() => trackEvent('evidence_clicked', { kind: 'borme' })}>{labels.borme}</Link>
              )}
            </Box>
          ))}
        </>
      )}

      {verification.length > 0 && (
        <>
          <Typography variant="overline" sx={{ display: 'block', fontWeight: 700, letterSpacing: '0.08em', mt: 1.5 }}>{labels.verification}</Typography>
          {verification.map(line => (
            <Typography key={line} variant="body2" sx={{ color: 'text.secondary' }}>• {line}</Typography>
          ))}
        </>
      )}

      {onOpenReport && offerCta && (
        <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{offer.title}</Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1 }}>
            {offer.body}{offer.more ? ` — ${offer.more}` : ''}
          </Typography>
          <Button size="small" variant="contained" color="warning" startIcon={<DescriptionIcon />}
            onClick={offerCta.onClick} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {offerCta.label}
          </Button>
        </Box>
      )}
    </Paper>
  );
}
