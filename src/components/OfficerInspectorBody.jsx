import React, { useMemo } from 'react';
import { Box, Typography, Tooltip, ButtonBase, Skeleton, Chip } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import GroupsIcon from '@mui/icons-material/Groups';
import PieChartOutlineIcon from '@mui/icons-material/PieChartOutline';
import OfficerMiniTimeline from './OfficerMiniTimeline.jsx';
import { summariseOfficerSeats, officerSeatStatus } from '../utils/officerTimeline';
import { formatDate } from '../utils/formatDate';

/**
 * What the inspector shows for a PERSON.
 *
 * The panel was built company-first, where "counts, not tables" is the right
 * rule — a bank with 30,000 registry officers must not stretch the panel into
 * tens of thousands of pixels. Applied to a person that rule inverts: someone
 * holds three seats, and those three seats ARE the record. Exiling them to the
 * bottom dock left the panel almost empty for the common case.
 *
 * So the seats are shown here, capped. Past the cap the dock still takes over,
 * which keeps the panel a bounded height for the rare person with 200 seats.
 * Nothing here is fetched: `officers` and `whollyOwned` were already resolved
 * by openDataPreview and were simply not being rendered.
 */

const MAX_SEATS = 8;
const MAX_OWNED = 5;

const STATUS_COLOR = {
  active: 'success.main',
  ceased: 'text.disabled',
  unknown: 'warning.main',
};

/** Active seats first, then most recent — the order someone reads a CV in. */
const STATUS_ORDER = { active: 0, unknown: 1, ceased: 2 };

const StatTile = ({ label, value, color }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1, color: color || 'text.primary' }}>
      {value}
    </Typography>
    <Typography
      variant="caption"
      sx={{ color: 'text.secondary', fontSize: '0.66rem', display: 'block', lineHeight: 1.2 }}
    >
      {label}
    </Typography>
  </Box>
);

const SectionTitle = ({ icon: Icon, children, action }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 700, minWidth: 0 }}>
      <Icon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
      {children}
    </Typography>
    {action}
  </Box>
);

const OfficerInspectorBody = ({
  data,
  text,
  lang = 'es',
  chart,
  timelineLoading = false,
  onOpenTimeline,
  onFocusCompany,
  onOpenDataset,
}) => {
  const officers = data?.officers || [];
  const whollyOwned = data?.whollyOwned || [];

  const summary = useMemo(() => summariseOfficerSeats(officers), [officers]);

  const seats = useMemo(() => {
    const rows = officers.map((officer) => ({
      company: officer.company_name || officer.company || text.unknown,
      role: officer.specific_role || officer.position_normalized || officer.role || officer.position || '-',
      status: officerSeatStatus(officer),
      date: officer.date || officer.event_date || '',
    }));
    return [...rows].sort((a, b) => {
      const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (byStatus !== 0) return byStatus;
      return String(b.date).localeCompare(String(a.date));
    });
  }, [officers, text.unknown]);

  const visibleSeats = seats.slice(0, MAX_SEATS);
  const hiddenSeats = seats.length - visibleSeats.length;
  const hasChart = !!chart?.rows?.length && !!chart?.scale;

  const miniCopy = useMemo(() => ({
    active: text.active,
    cessation: text.ceased,
    openTimeline: text.openTimeline,
    andMoreSeats: text.andMoreSeats,
  }), [text]);

  return (
    <Box>
      {/* Summary — the numbers that answer "who is this?" before any table is
          opened. Seats, not companies: one person can hold an active and a
          ceased seat at the same company, and collapsing that to a per-company
          status erases exactly the transition a reader is looking for. */}
      {summary.seatCount > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
            <StatTile label={text.active} value={summary.activeCount} color="accent.success" />
            <StatTile label={text.ceased} value={summary.ceasedCount} />
            <StatTile label={text.companiesShort} value={summary.companyCount} />
          </Box>
          {summary.firstDate && (
            <Typography
              variant="caption"
              className="registry-ref"
              sx={{ color: 'text.secondary', display: 'block', mt: 1 }}
            >
              {text.bormeRange}: {formatDate(summary.firstDate, lang)} — {formatDate(summary.lastDate, lang)}
            </Typography>
          )}
        </Box>
      )}

      {/* Track record — the shape of a career at a glance. Clicking opens the
          full chart, where it can be copied into a report. */}
      {(hasChart || timelineLoading) && (
        <Box sx={{ mb: 2.5 }}>
          <SectionTitle icon={TimelineIcon}>{text.trackRecord}</SectionTitle>
          {timelineLoading && !hasChart ? (
            <Skeleton variant="rounded" height={96} />
          ) : (
            <OfficerMiniTimeline chart={chart} copy={miniCopy} onExpand={onOpenTimeline} />
          )}
        </Box>
      )}

      {/* Seats */}
      {visibleSeats.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <SectionTitle
            icon={GroupsIcon}
            action={(
              <Chip
                label={text.seeInTable}
                size="small"
                variant="outlined"
                clickable
                onClick={() => onOpenDataset?.('roles')}
                sx={{ height: 22, fontSize: '0.66rem' }}
              />
            )}
          >
            {text.rolesShort} · {seats.length}
          </SectionTitle>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            {visibleSeats.map((seat, idx) => (
              <ButtonBase
                key={`${seat.company}-${seat.role}-${idx}`}
                onClick={() => onFocusCompany?.(seat.company)}
                sx={{
                  display: 'flex',
                  width: '100%',
                  textAlign: 'left',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.25,
                  py: 0.75,
                  borderTop: idx === 0 ? 'none' : '1px solid',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Tooltip title={text[seat.status] || text.unknown} arrow>
                  <Box sx={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    bgcolor: STATUS_COLOR[seat.status],
                  }} />
                </Tooltip>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {seat.company}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.66rem' }}>
                    {seat.role}
                  </Typography>
                </Box>
                {seat.date && (
                  <Typography
                    variant="caption"
                    className="registry-ref"
                    sx={{ color: 'text.secondary', fontSize: '0.66rem', flexShrink: 0 }}
                  >
                    {formatDate(seat.date, lang)}
                  </Typography>
                )}
              </ButtonBase>
            ))}
          </Box>
          {hiddenSeats > 0 && (
            <Typography
              component="button"
              type="button"
              onClick={() => onOpenDataset?.('roles')}
              variant="caption"
              sx={{
                display: 'block', mt: 0.75, background: 'none', border: 'none', p: 0,
                cursor: 'pointer', color: 'accent.primary', fontWeight: 600,
              }}
            >
              {text.andMoreSeats(hiddenSeats)}
            </Typography>
          )}
        </Box>
      )}

      {/* Sole shareholder — BORME publishes no cap table, so 100% ownership is
          the ONE ownership fact it does record about a person. It was being
          fetched and never shown. */}
      {whollyOwned.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <SectionTitle icon={PieChartOutlineIcon}>{text.whollyOwned(whollyOwned.length)}</SectionTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {whollyOwned.slice(0, MAX_OWNED).map((company, idx) => (
              <ButtonBase
                key={`${company.name}-${idx}`}
                onClick={() => onFocusCompany?.(company.name)}
                sx={{
                  display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center', gap: 0.75,
                  px: 1, py: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '0.78rem', minWidth: 0, flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    textDecoration: company.is_dissolved ? 'line-through' : 'none',
                    color: company.is_dissolved ? 'error.main' : 'inherit',
                  }}
                >
                  {company.name}
                </Typography>
                {company.is_in_concurso && (
                  <Chip label={text.concurso} size="small" color="warning" sx={{ height: 18, fontSize: '0.6rem' }} />
                )}
              </ButtonBase>
            ))}
          </Box>
          {whollyOwned.length > MAX_OWNED && (
            <Typography
              component="button"
              type="button"
              onClick={() => onOpenDataset?.('owned')}
              variant="caption"
              sx={{
                display: 'block', mt: 0.5, background: 'none', border: 'none', p: 0,
                cursor: 'pointer', color: 'accent.primary', fontWeight: 600,
              }}
            >
              {text.andMoreSeats(whollyOwned.length - MAX_OWNED)}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

export default OfficerInspectorBody;
