/**
 * Styled HTML rendering of the weekly GA4 report.
 *
 * One renderer serves both surfaces — the browser view at /report and the email
 * the cron sends — so the two can never drift. That constrains the CSS: every
 * style is inline and the layout is table-based, because mail clients strip
 * <style> blocks, external stylesheets and anything they consider script. A
 * light ground is deliberate here even though the product is dark-only: this
 * document is read in a mail client and printed to PDF, not on the site.
 */

const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const TEAL = '#0f766e';
const TEAL_SOFT = '#f0fdfa';
const WARN = '#b45309';
const WARN_SOFT = '#fffbeb';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const num = (value, digits = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const pct = (value, digits = 1) => {
  const n = Number(value);
  return `${Number.isFinite(n) ? (n * 100).toFixed(digits) : '0.0'}%`;
};

const seconds = (value) => {
  const s = Math.round(Number(value) || 0);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};

/** Percentage change, with "new" reserved for genuine zero-to-something. */
export function change(current, prior) {
  const c = Number(current) || 0;
  const p = Number(prior) || 0;
  if (!p) return c ? 'new' : '—';
  const delta = ((c - p) / p) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
}

const changeColor = (current, prior) => {
  const c = Number(current) || 0;
  const p = Number(prior) || 0;
  if (!p || c === p) return MUTED;
  return c > p ? TEAL : '#b91c1c';
};

/** GA4 hands back YYYYMMDD for the date dimension. */
function gaDate(raw) {
  const s = String(raw ?? '');
  if (!/^\d{8}$/.test(s)) return s;
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const weekday = new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  });
  return `${iso} (${weekday})`;
}

function section(title, body, note) {
  if (!body) return '';
  return `
    <tr><td style="padding:28px 24px 0 24px;">
      <h2 style="margin:0 0 4px 0;font:600 17px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};letter-spacing:-0.01em;">${escapeHtml(title)}</h2>
      ${note ? `<p style="margin:0 0 12px 0;font:400 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${MUTED};">${note}</p>` : '<div style="height:10px"></div>'}
      ${body}
    </td></tr>`;
}

/**
 * @param {string[]} headers
 * @param {Array<Array<{text: string, align?: string, color?: string, bold?: boolean}|string>>} rows
 */
function table(headers, rows) {
  if (!rows.length) return '';
  const th = headers
    .map(
      (h, i) =>
        `<th style="padding:7px 10px;border-bottom:1px solid ${LINE};text-align:${i === 0 ? 'left' : 'right'};font:600 11px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${MUTED};text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">${escapeHtml(h)}</th>`,
    )
    .join('');
  const tr = rows
    .map((cells) => {
      const td = cells
        .map((cell, i) => {
          const c = typeof cell === 'string' ? { text: cell } : cell;
          const align = c.align || (i === 0 ? 'left' : 'right');
          return `<td style="padding:7px 10px;border-bottom:1px solid ${LINE};text-align:${align};font:${c.bold ? 600 : 400} 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${c.color || INK};">${escapeHtml(c.text)}</td>`;
        })
        .join('');
      return `<tr>${td}</tr>`;
    })
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

function metricCard(label, value, sub, subColor) {
  return `
    <td style="padding:0 8px 12px 0;vertical-align:top;width:33%;">
      <div style="border:1px solid ${LINE};border-radius:8px;padding:12px 14px;">
        <div style="font:600 10px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${MUTED};text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(label)}</div>
        <div style="font:700 25px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};margin-top:4px;letter-spacing:-0.02em;">${escapeHtml(value)}</div>
        <div style="font:500 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${subColor || MUTED};margin-top:2px;">${escapeHtml(sub)}</div>
      </div>
    </td>`;
}

function warningsBlock(warnings) {
  if (!warnings?.length) return '';
  const items = warnings
    .map(
      (w) =>
        `<li style="margin:0 0 8px 0;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};">${escapeHtml(w)}</li>`,
    )
    .join('');
  return `
    <tr><td style="padding:24px 24px 0 24px;">
      <div style="background:${WARN_SOFT};border:1px solid #fcd34d;border-left:4px solid ${WARN};border-radius:8px;padding:14px 16px;">
        <div style="font:700 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${WARN};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Read this first</div>
        <ul style="margin:0;padding-left:18px;">${items}</ul>
      </div>
    </td></tr>`;
}

function orderedFunnelSection(ordered) {
  if (!ordered) return '';
  if (!ordered.available) {
    return section(
      'Ordered checkout funnel',
      `<div style="background:${WARN_SOFT};border:1px solid #fcd34d;border-radius:8px;padding:12px 14px;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};">Withheld: ${escapeHtml(ordered.error || 'query failed')}</div>`,
    );
  }
  const first = ordered.stages?.[0]?.users || 0;
  return section(
    'Ordered checkout funnel',
    table(
      ['Sequential stage', 'Users', 'Prior wk', 'Change', '% of first', 'Dropped'],
      (ordered.stages || []).map((s) => [
        s.label,
        { text: num(s.users), bold: true },
        num(s.priorUsers),
        { text: change(s.users, s.priorUsers), color: changeColor(s.users, s.priorUsers) },
        first ? pct(s.users / first) : '—',
        num(s.abandonments),
      ]),
    ),
    'Closed, ordered funnel: a user must complete the stages in this order. This is the conversion question — the tables below count each event independently.',
  );
}

export function renderReportHtml(r) {
  const c = r.totals?.current || {};
  const p = r.totals?.prior || {};
  const window = `${r.period?.current?.start} to ${r.period?.current?.end}`;
  const priorWindow = `${r.period?.prior?.start} to ${r.period?.prior?.end}`;

  const body = [
    warningsBlock(r.warnings),

    `<tr><td style="padding:24px 24px 0 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        ${metricCard('Sessions', num(c.sessions), `${change(c.sessions, p.sessions)} vs prior week`, changeColor(c.sessions, p.sessions))}
        ${metricCard('Users', num(c.totalUsers), `${change(c.totalUsers, p.totalUsers)} vs prior week`, changeColor(c.totalUsers, p.totalUsers))}
        ${metricCard('Page views', num(c.screenPageViews), `${change(c.screenPageViews, p.screenPageViews)} vs prior week`, changeColor(c.screenPageViews, p.screenPageViews))}
      </tr><tr>
        ${metricCard('Engagement rate', pct(c.engagementRate), `${pct(p.engagementRate)} prior week`)}
        ${metricCard('Avg session', seconds(c.averageSessionDuration), `${seconds(p.averageSessionDuration)} prior week`)}
        ${metricCard('Key events', num(c.keyEvents), 'engagement depth, not conversions')}
      </tr></table>
    </td></tr>`,

    orderedFunnelSection(r.orderedCheckout),

    section(
      'Checkout outcomes',
      table(
        ['Outcome', 'Events', 'Users', 'Per user', 'Prior wk', 'Change'],
        (r.checkoutOutcomes || []).map((o) => [
          o.label,
          { text: num(o.eventCount), bold: true },
          num(o.users),
          num(o.attemptsPerUser, 1),
          num(o.priorEventCount),
          { text: change(o.eventCount, o.priorEventCount), color: changeColor(o.eventCount, o.priorEventCount) },
        ]),
      ),
      'Independent event counts. Each column is its own query, so a user can appear at a later stage without the earlier one.',
    ),

    section(
      'Intent funnel (distinct users)',
      table(
        ['Stage', 'Users', 'Prior wk', 'Change', '% of arrivals'],
        (r.funnel || []).map((f) => [
          f.label,
          { text: num(f.users), bold: true },
          num(f.priorUsers),
          { text: change(f.users, f.priorUsers), color: changeColor(f.users, f.priorUsers) },
          pct(f.pctOfTop),
        ]),
      ),
      'Independent distinct-user counts per stage, not a strict sequence: a visitor can reach a later stage without firing an earlier one.',
    ),

    section(
      'Acquisition channels',
      table(
        ['Channel', 'Sessions', 'Prior wk', 'Change', 'Users', 'Engagement'],
        (r.channels || []).map((ch) => [
          ch.channel,
          { text: num(ch.sessions), bold: true },
          num(ch.priorSessions),
          { text: change(ch.sessions, ch.priorSessions), color: changeColor(ch.sessions, ch.priorSessions) },
          num(ch.users),
          pct(ch.engagementRate),
        ]),
      ),
    ),

    section(
      'Daily trend',
      table(
        ['Date', 'Sessions', 'Users', 'Key events'],
        (r.daily || []).map((d) => [gaDate(d.date), num(d.sessions), num(d.totalUsers), num(d.keyEvents)]),
      ),
    ),

    section(
      'Top pages',
      table(
        ['Path', 'Views', 'Users', 'Avg engaged'],
        (r.pages || []).slice(0, 20).map((pg) => [
          pg.path || '(not set)',
          num(pg.views),
          num(pg.users),
          seconds(pg.avgEngagementSeconds),
        ]),
      ),
      'Average engaged time is per user, not per view.',
    ),

    section(
      'Landing pages',
      table(
        ['Landing page', 'Sessions', 'Bounce rate', 'Key events', 'Evidence'],
        (r.landingPages || []).slice(0, 15).map((lp) => [
          lp.landingPage || '(not set)',
          num(lp.sessions),
          pct(lp.bounceRate),
          num(lp.keyEvents),
          {
            text: lp.sessions >= 20 ? 'usable sample' : 'directional',
            color: lp.sessions >= 20 ? TEAL : MUTED,
            align: 'right',
          },
        ]),
      ),
    ),

    section(
      'Top events',
      table(
        ['Event', 'Count', 'Users'],
        (r.events || []).slice(0, 20).map((e) => [e.eventName, num(e.eventCount), num(e.totalUsers)]),
      ),
    ),

    section(
      'Geography and devices',
      `${table(
        ['Country', 'Sessions', 'Users'],
        (r.countries || []).slice(0, 10).map((g) => [g.country, num(g.sessions), num(g.totalUsers)]),
      )}<div style="height:14px"></div>${table(
        ['Device', 'Sessions', 'Engagement'],
        (r.devices || []).map((d) => [d.deviceCategory, num(d.sessions), pct(d.engagementRate)]),
      )}`,
    ),

    section(
      'Measurement quality',
      table(
        ['Session scope', 'Sessions', 'Matches core'],
        Object.entries(r.measurementQuality?.sessionSums || {}).map(([scope, value]) => [
          scope,
          num(value),
          {
            text: value === r.measurementQuality.sessionSums.core ? 'yes' : 'no',
            color: value === r.measurementQuality.sessionSums.core ? TEAL : WARN,
            align: 'right',
          },
        ]),
      ),
      'GA4-filtered traffic. Compare with Cloudflare raw traffic before diagnosing bots.',
    ),
  ].join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>GA4 weekly — mapasocietario.es — ${escapeHtml(window)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;">
<tr><td align="center" style="padding:20px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="680" style="width:680px;max-width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:12px;">
  <tr><td style="padding:24px 24px 0 24px;border-bottom:1px solid ${LINE};padding-bottom:20px;">
    <div style="font:700 11px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${TEAL};text-transform:uppercase;letter-spacing:0.09em;">mapasocietario.es · weekly analytics</div>
    <h1 style="margin:6px 0 4px 0;font:700 22px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};letter-spacing:-0.02em;">${escapeHtml(window)}</h1>
    <div style="font:400 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${MUTED};">Compared with ${escapeHtml(priorWindow)} · GA4 property ${escapeHtml(r.propertyId)} · pulled ${escapeHtml(r.generatedAt)}</div>
  </td></tr>
  ${body}
  <tr><td style="padding:20px 24px 24px 24px;border-top:1px solid ${LINE};">
    <div style="font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${MUTED};">Today is excluded: GA4's current-day data is always partial. Generated by the mapasocietario-analytics Worker.</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** Plain-text alternative. Mail clients that refuse HTML still get the numbers. */
export function renderReportText(r) {
  const c = r.totals?.current || {};
  const p = r.totals?.prior || {};
  const lines = [
    `GA4 weekly — mapasocietario.es`,
    `${r.period?.current?.start} to ${r.period?.current?.end} (vs ${r.period?.prior?.start} to ${r.period?.prior?.end})`,
    '',
  ];
  if (r.warnings?.length) {
    lines.push('READ THIS FIRST');
    r.warnings.forEach((w) => lines.push(`- ${w}`));
    lines.push('');
  }
  lines.push(
    `Sessions ${num(c.sessions)} (${change(c.sessions, p.sessions)})`,
    `Users ${num(c.totalUsers)} (${change(c.totalUsers, p.totalUsers)})`,
    `Page views ${num(c.screenPageViews)} (${change(c.screenPageViews, p.screenPageViews)})`,
    `Engagement ${pct(c.engagementRate)} · avg session ${seconds(c.averageSessionDuration)}`,
    '',
  );
  (r.checkoutOutcomes || []).forEach((o) =>
    lines.push(`${o.label}: ${num(o.eventCount)} events / ${num(o.users)} users (prior ${num(o.priorEventCount)})`),
  );
  return lines.join('\n');
}
