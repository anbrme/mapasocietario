/**
 * Delivery of the daily report.
 *
 * Uses the Cloudflare Email Sending REST API — the same mechanism, account,
 * endpoint and secret name already in production in functions/feedback.js, so
 * one token serves both — rather than a send_email binding,
 * because the pinned wrangler (4.14.4) has no `email` command to onboard one
 * and an unonboarded binding fails at send time rather than at deploy time.
 *
 * Delivery is deliberately best-effort: a mail failure must never fail the
 * pull. The report is persisted to D1 first and is always readable at /report,
 * so email is a notification layer, not the system of record.
 */
import { renderReportHtml, renderReportText } from './report-html.js';

// Same account as functions/feedback.js. Not a secret — account ids appear in
// every dashboard URL — but overridable so the Worker is not pinned to it.
const DEFAULT_ACCOUNT_ID = 'e0f6d4652827b154cc920fd53ed54101';
const DEFAULT_FROM = 'analytics@ncdata.eu';
const DEFAULT_TO = 'mapasocietario@ncdata.eu';

export function reportSubject(report) {
  const window = `${report?.period?.current?.start} to ${report?.period?.current?.end}`;
  const flag = report?.warnings?.length ? '⚠ ' : '';
  return `${flag}mapasocietario.es daily analytics — ${window}`;
}

export async function sendReportEmail(env, report) {
  const token = env?.CLOUDFLARE_EMAIL_API_TOKEN;
  if (!token) {
    return {
      sent: false,
      reason: 'not_configured',
      hint: 'Set the CLOUDFLARE_EMAIL_API_TOKEN secret (wrangler secret put CLOUDFLARE_EMAIL_API_TOKEN) to have the cron mail the styled report. The report is stored and served at /report either way.',
    };
  }

  const accountId = env.CF_ACCOUNT_ID || DEFAULT_ACCOUNT_ID;
  const from = env.REPORT_EMAIL_FROM || DEFAULT_FROM;
  const to = env.REPORT_EMAIL_TO || DEFAULT_TO;

  const payload = {
    from: { address: from, name: 'Mapa Societario Analytics' },
    to: [{ address: to }],
    subject: reportSubject(report),
    html: renderReportHtml(report),
    // Always paired: some clients render only the plain-text part, and a
    // text alternative measurably helps the message clear spam filters.
    text: renderReportText(report),
  };

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      return { sent: false, status: res.status, error: detail.slice(0, 500), to };
    }
    return { sent: true, to };
  } catch (error) {
    return { sent: false, error: String(error?.message || error).slice(0, 500), to };
  }
}
