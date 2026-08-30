/**
 * Styled HTML rendering of the daily report (GA4 + Cloudflare edge + Search Console).
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

/**
 * Cloudflare edge traffic. Deliberately placed before "Measurement quality":
 * it IS the measurement-quality section that matters most, because it sizes
 * everything above it.
 */
function edgeSection(edge) {
  if (!edge) return '';
  if (!edge.available) {
    return section(
      'Edge traffic (Cloudflare)',
      `<div style="background:${WARN_SOFT};border:1px solid #fcd34d;border-radius:8px;padding:12px 14px;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};">Unavailable: ${escapeHtml(edge.error || edge.hint || edge.reason || 'not configured')}</div>`,
    );
  }

  const t = edge.totals || {};
  const totalsTable = table(
    ['Cloudflare (every request that reached the edge)', 'Count'],
    [
      ['Requests', { text: num(t.requests), bold: true }],
      ['Page views', { text: num(t.pageViews), bold: true }],
      ['Unique visitors (by IP)', num(t.uniques)],
      ['Threats blocked', num(t.threats)],
    ],
  );

  const comparison = (edge.comparison || []).slice(0, 12);
  const countryTable = table(
    ['Country', 'CF requests', 'Threats', 'GA4 sessions', 'Requests / session'],
    comparison.map((row) => [
      row.country,
      num(row.requests),
      num(row.threats),
      num(row.sessions),
      {
        // Null, never Infinity: "GA4 recorded nothing here" is a different
        // statement from "the ratio is very large".
        text: row.requestsPerSession === null ? 'no GA4 data' : row.requestsPerSession.toFixed(1),
        color: row.requestsPerSession === null ? WARN : INK,
        align: 'right',
      },
    ]),
  );

  const browsers = edge.browsers || {};
  const totalViews = browsers.totalPageViews || 0;
  const browserTable = table(
    ['User agent', 'Page views', 'Share'],
    [
      ...(browsers.rows || []).slice(0, 8).map((row) => [
        row.browser,
        num(row.pageViews),
        totalViews ? pct(row.pageViews / totalViews) : '—',
      ]),
      ...(browsers.unidentified > 0
        ? [['(unmapped)', num(browsers.unidentified), totalViews ? pct(browsers.unidentified / totalViews) : '—']]
        : []),
    ],
  );

  return section(
    'Edge traffic (Cloudflare)',
    `${totalsTable}<div style="height:16px"></div>${countryTable}<div style="height:16px"></div>${browserTable}`,
    'Compare each country\'s requests-per-session against the countries where GA4 records real sessions, not against zero — that ratio is what a human browser session costs. "Unknown" is Cloudflare\'s bucket for agents claiming no browser; named bot rows come from the user-agent string, which is trivially spoofed.',
  );
}

/* --------------------------------------------------- search console */

/**
 * Search performance. Rendered separately from GA4 because it measures a
 * different thing (what Google SHOWED, not what a browser reported) and lags
 * it by two to three days — the section states the date it is actually talking
 * about, so a lagging figure is never read as a traffic collapse.
 */
function searchConsoleSection(sc) {
  if (!sc) return '';
  if (!sc.available) {
    return section(
      'Search Console',
      `<p style="margin:0;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${MUTED};">Not available this run — ${escapeHtml(sc.reason || 'unknown reason')}</p>`,
      'GA4 and edge figures above are unaffected.',
    );
  }
  const d = sc.day || {};
  const pd = sc.priorDay || {};
  const e = sc.empresaDay || {};
  const ep = sc.empresaPriorDay || {};
  const posText = (v) => (v == null ? '—' : num(v, 1));
  // Position improves as it FALLS, so the usual up-is-good colouring is
  // inverted here. Getting this backwards would paint a ranking loss green.
  const posColor = (cur, pri) =>
    cur == null || pri == null ? MUTED : cur < pri ? TEAL : cur > pri ? '#b91c1c' : MUTED;

  const cards = `<tr><td style="padding:4px 24px 0 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        ${metricCard('Clicks', num(d.clicks), `${change(d.clicks, pd.clicks)} vs same day last week`, changeColor(d.clicks, pd.clicks))}
        ${metricCard('Impressions', num(d.impressions), `${change(d.impressions, pd.impressions)} vs same day last week`, changeColor(d.impressions, pd.impressions))}
        ${metricCard('Avg position', posText(d.position), `${posText(pd.position)} a week earlier`, posColor(d.position, pd.position))}
      </tr></table>
    </td></tr>`;

  const empresa = table(
    ['Surface', 'Clicks', 'Impressions', 'CTR', 'Position'],
    [
      ['Whole site', num(d.clicks), num(d.impressions), pct(d.ctr), posText(d.position)],
      ['/empresa pages', { text: num(e.clicks), bold: true }, num(e.impressions), pct(e.ctr), posText(e.position)],
      ['/empresa a week earlier', num(ep.clicks), num(ep.impressions), pct(ep.ctr), posText(ep.position)],
    ],
  );

  const trend = table(
    ['Date', 'Clicks', 'Impressions', 'CTR', 'Position'],
    (sc.trend || []).map((r) => [
      r.date, num(r.clicks), num(r.impressions), pct(r.ctr), num(r.position, 1),
    ]),
  );

  const queries = table(
    ['Query', 'Clicks', 'Impressions', 'CTR', 'Position'],
    (sc.topQueries || []).map((q) => [
      q.query, num(q.clicks), num(q.impressions), pct(q.ctr), num(q.position, 1),
    ]),
  );

  const striking = table(
    ['Page', 'Clicks', 'Impressions', 'CTR', 'Position'],
    (sc.strikingDistance || []).map((p) => [
      p.page, num(p.clicks), num(p.impressions), pct(p.ctr), num(p.position, 1),
    ]),
  );

  const ex = sc.experiment;
  const experiment = ex && (ex.variant?.impressions || ex.control?.impressions)
    ? table(
        ['Arm', 'Pages', 'Clicks', 'Impressions', 'CTR', 'Position'],
        [
          ['Variant (counts-first title)', num(ex.variant.pages), num(ex.variant.clicks),
           num(ex.variant.impressions), { text: pct(ex.variant.ctr), bold: true }, posText(ex.variant.position)],
          ['Control (CIF-first title)', num(ex.control.pages), num(ex.control.clicks),
           num(ex.control.impressions), { text: pct(ex.control.ctr), bold: true }, posText(ex.control.position)],
        ],
      )
    : '';

  return [
    section(
      'Search Console',
      cards + empresa,
      `Google data through <strong>${escapeHtml(sc.dataThrough)}</strong>${sc.lagDays ? ` — ${sc.lagDays} day${sc.lagDays === 1 ? '' : 's'} behind the rest of this report, which is normal` : ''}. Compared with ${escapeHtml(sc.comparedWith)}, the same weekday a week earlier. Settled figures only.${
        sc.provisional?.days?.length
          ? ` Google has also begun ${sc.provisional.days.length} newer day${sc.provisional.days.length === 1 ? '' : 's'} (through ${escapeHtml(sc.provisional.through)}) carrying at least ${num(sc.provisional.clicksSoFar)} more click${sc.provisional.clicksSoFar === 1 ? '' : 's'} — a floor that can only rise, never a decline.`
          : ''
      }`,
    ),
    section('Search, last 7 days', trend),
    section('Top search queries', queries, 'Trailing 7 days, by impressions.'),
    section(
      'Ranking but not clicked',
      striking,
      'Position 3-12 with 20+ impressions and CTR at or below 2%. These are already visible to a human; the title and snippet are what is losing the click.',
    ),
    experiment
      ? section(
          'Title A/B test',
          experiment,
          'Both arms were drawn from the same population, so the CTR difference is readable directly. Watch POSITION as well: a CTR win that came with a worse position means the CIF leaving the title head cost the exact-match ranking, which is a loss, not a win.',
        )
      : '',
  ].join('');
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
        ${metricCard(
          'Engagement rate',
          r.measurementQuality?.engagement?.reconciled === false
            ? 'unreadable'
            : pct(c.engagementRate),
          r.measurementQuality?.engagement?.reconciled === false
            ? 'daily and window cuts disagree'
            : `${num(c.engagedSessions)} engaged · ${pct(p.engagementRate)} prior week`,
          r.measurementQuality?.engagement?.reconciled === false ? WARN : undefined,
        )}
        ${metricCard('Avg session', seconds(c.averageSessionDuration), `${seconds(p.averageSessionDuration)} prior week`)}
        ${metricCard('Key events', num(c.keyEvents), 'engagement depth, not conversions')}
      </tr></table>
    </td></tr>`,

    orderedFunnelSection(r.orderedCheckout),

    searchConsoleSection(r.searchConsole),

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
      'Checkout redirects by destination',
      table(
        ['Destination', 'Events', 'Users'],
        (r.checkoutDestinations?.rows || []).map((row) => [
          row.destination,
          { text: num(row.eventCount), bold: true },
          num(row.users),
        ]),
      ),
      'free_order is a waived report fulfilled without Stripe — it never emits a purchase event, by design. Only the stripe_* rows represent revenue that should have completed.',
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
      'The graph journey, in order. Every stage is genuinely nested in the one above it, so a later stage larger than an earlier one means the definition is wrong, not the behaviour.',
    ),

    (r.sideSignals || []).length
      ? section(
          'Outside the graph funnel',
          table(
            ['Signal', 'Users', 'Prior wk', 'Why it is not a stage'],
            (r.sideSignals || []).map((sig) => [
              sig.label,
              { text: num(sig.users), bold: true },
              num(sig.priorUsers),
              sig.note || '',
            ]),
          ),
          'These reach the product by a different route, so counting them as funnel stages produced a funnel whose last stage was larger than the two before it.',
        )
      : '',

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

    edgeSection(r.edge),

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
<title>Daily analytics — mapasocietario.es — ${escapeHtml(window)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;">
<tr><td align="center" style="padding:20px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="680" style="width:680px;max-width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:12px;">
  <tr><td style="padding:24px 24px 0 24px;border-bottom:1px solid ${LINE};padding-bottom:20px;">
    <div style="font:700 11px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${TEAL};text-transform:uppercase;letter-spacing:0.09em;">mapasocietario.es · daily analytics</div>
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
    `Daily analytics — mapasocietario.es`,
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
