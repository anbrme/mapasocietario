# mapasocietario-analytics

Weekly GA4 pull for mapasocietario.es, running as a Cloudflare Worker.

The source of truth is this directory. Pushing a change under
`workers/analytics/**` to `main` deploys the Worker through
`.github/workflows/deploy-analytics-worker.yml`; that deployment also applies
the cron trigger from `wrangler.toml`.

## Why a Worker

The scheduled Claude task cannot call the GA4 API directly: neither the Cowork
cloud sandbox nor the on-device sandbox has outbound network access to
`googleapis.com` (both fail at the OAuth token exchange). Cloudflare does have
network access, so the split is:

```
Cloudflare Worker (cron, Fri 14:30 UTC)
  -> signs a JWT with the service account key
  -> calls the GA4 Data API
  -> cross-checks the sections against each other
  -> persists the weekly rollup into D1
  -> renders the styled HTML report
  -> emails it, and serves it at /report
                     |
                     v
Claude scheduled task (optional, Fri 17:00 Madrid)
  -> fetches /latest for commentary on top of the numbers
```

The styled report no longer depends on a Claude session being alive: the Worker
renders it itself. Email is a notification layer over a report that is already
persisted and readable at `/report`, so a mail failure never costs you the pull.

The service account key lives only in Cloudflare's secret store. It is never in
the repo, never in the Claude session, never on disk.

## Deploy

Everything below is run by you — the key and the deploy stay under your control.

**1. Deploy the Worker** (creates it; the cron and D1 binding come from
`wrangler.toml`):

```bash
cd workers/analytics
npx wrangler deploy
```

For the normal production path, commit and push the change instead. The
dedicated GitHub workflow runs a dry-run for pull requests and deploys only on
pushes to `main`. Merely committing Worker code without that workflow does not
change the live Worker.

**2. Set the two secrets:**

```bash
# The full service account JSON, pasted as one blob.
npx wrangler secret put GA_SA_KEY

# A random string you invent — required as ?token= on every request.
# e.g. openssl rand -hex 24
npx wrangler secret put REPORT_TOKEN
```

**3. Confirm it is wired up** (no Google call, just config):

```bash
curl "https://mapasocietario-analytics.<your-subdomain>.workers.dev/health?token=$TOKEN"
```

Expect `serviceAccountLoaded: true`, `d1Bound: true`, `propertyIdSet: false`.

**4. Find the property ID.** The site's `G-HHWT6ZTKZD` is a *measurement* ID;
the Data API needs the numeric property ID:

```bash
curl "https://mapasocietario-analytics.<your-subdomain>.workers.dev/discover?token=$TOKEN"
```

If this returns `found: 0`, the service account has not been granted access yet.
In GA4: **Admin > Property access management > +**, add
`google-analytics-4@crack-audio-506110-h0.iam.gserviceaccount.com` with the
**Viewer** role. Then re-run.

**5. Put the property ID in `wrangler.toml`** under `[vars] GA_PROPERTY_ID`, then
redeploy:

```bash
npx wrangler deploy
```

**6. Prove the pull works end to end:**

```bash
curl "https://mapasocietario-analytics.<your-subdomain>.workers.dev/run?token=$TOKEN"
```

This returns the full weekly report as markdown and stores it in D1. Send me the
Worker URL and token once this works and I will wire up the Friday Claude task
against it.

## Endpoints

All require `?token=<REPORT_TOKEN>`.

| Path | Purpose |
| --- | --- |
| `/health` | Config check. Does not call Google. |
| `/discover` | Lists GA4 properties the service account can see. |
| `/run` | Pulls now, persists to D1, returns the report. |
| `/today` | Pulls a partial current-day behavior snapshot, including the four graph-interaction custom dimensions. It is not persisted. |
| `/latest` | Returns the most recently stored report. |
| `/report` | The stored report as styled HTML — the same document the cron emails. |
| `/send-test` | Emails the stored report now and returns exactly what the Email API said. |
| `/interactions` | Probes event-parameter custom dimensions (`?days=28`). |
| `/diagnose` | Raw GA4 payloads for the two queries that have already drifted. |

`/run` and `/latest` return markdown by default; add `&format=json` for the raw
payload.

## Email delivery

The cron mails the styled report through the Cloudflare Email Sending REST API —
the same mechanism `functions/feedback.js` already uses in production, from the
same onboarded domain. It needs one secret:

```bash
cd workers/analytics
npx wrangler secret put CLOUDFLARE_EMAIL_API_TOKEN   # same token the Pages project uses
curl "https://mapasocietario-analytics.<subdomain>.workers.dev/send-test?token=$TOKEN"
```

This is the same secret name, account and endpoint as `functions/feedback.js`,
so the existing feedback token can be reused verbatim rather than minted again.

`/send-test` returns `{"sent": true}` or the API's own error, so delivery is
confirmed in seconds rather than a week later. Without the secret the cron still
pulls, persists, and serves `/report`; it logs that mail was skipped.

Sender and recipient are `[vars]` in `wrangler.toml` (`REPORT_EMAIL_FROM`,
`REPORT_EMAIL_TO`), not secrets.

## Warnings

Every report carries a `warnings[]` array, rendered at the top of both the
markdown and the HTML. It holds contradictions between sections that are
each internally consistent — the failure mode that produced three wrong
sections in the 18–24 August report:

- the ordered funnel reporting zero users at a stage the independent event
  count says is populated
- `checkout_failed` disagreeing with the sum of its own failure-reason rows
- every failure reason reading `(not set)`, which means the `reason` event
  parameter is not registered as a custom dimension
- session totals that differ between dimensioned cuts

An all-zero ordered funnel is now **withheld** rather than published: it is
indistinguishable from zero conversion, and publishing it invites exactly the
wrong decision.

## What it collects

Two adjacent 7-day windows — the 7 days ending *yesterday*, and the 7 before
that. Today is never included, because GA4's current-day data is always partial.

- **Totals**: sessions, users, new users, page views, engagement rate, average
  session duration, key events — each against the prior week
- **Daily trend** across the current window
- **Acquisition**: channel groups with prior-week comparison, plus source/medium
- **Content**: top pages by views with average engagement time, and landing
  pages with bounce rate and an explicit low-sample warning
- **Commercial outcomes**: explicit `view_item`, `begin_checkout`,
  `checkout_failed`, `checkout_redirect`, and `purchase` counts, plus a closed,
  ordered checkout funnel from GA4's funnel API. Failure reasons are included
  when the `reason` event parameter is registered as a GA4 custom dimension.
- **Measurement quality**: session-total reconciliation and a source/landing
  page breakdown for Unassigned traffic before anyone changes UTMs
- **Conversions**: key events by channel and landing page, plus the top event
  table. Key events are treated as engagement depth, not purchases.
- **Geography and devices**

## Notes

- **DST**: cron is always UTC. `30 14 * * 5` is 16:30 Madrid in summer, 15:30 in
  winter. If you want it pinned to local time year-round, the cron needs editing
  twice a year.
- **`keyEvents` vs `conversions`**: GA4 renamed this metric. The Worker tries the
  modern name and retries once with the old one if the property rejects it.
- **Ordered funnel API**: Google's funnel reporting endpoint is currently
  v1alpha. If it changes or fails, the ordered-funnel section reports the error
  but the rest of the weekly report still runs and persists. It repeats its
  metric header block (eight headers for four values per row) and prefixes its
  metrics `funnelStep*`; both cost a silent all-zero funnel before 25 Aug 2026.
  `/diagnose` returns the raw response — read it before touching the parser.
- **Named results**: the GA4 requests in `gather()` are a named map, not an
  array. They were positional once, two entries were transposed, and the report
  erased a real purchase while inventing seven failures that never happened.
  Keep them named.
- **Bots**: GA4 is not the raw traffic source. Compare anomalies with Cloudflare
  traffic before treating them as real users or diagnosing bot activity.
- **D1**: reuses the existing `mapasocietario-seo` database but creates and owns
  its own `analytics_weekly` table. Nothing else in that database is touched.
- Reports upsert on `(period_start, period_end)`, so re-running for the same
  window overwrites rather than duplicating.

## Cron diagnostics

The configured trigger runs once a week, on Friday at 14:30 UTC. On Tuesday 25
August 2026, that means there had been only one possible scheduled invocation
since the Worker was first committed on Thursday 20 August: Friday 21 August.
Claims that several daily cron runs failed do not match the configuration in
this repository.

To inspect the deployed trigger and its execution history:

1. Open **Cloudflare dashboard > Workers & Pages > mapasocietario-analytics**.
2. Check **Settings > Trigger Events** for `30 14 * * 5`.
3. Select **View events** to inspect the most recent scheduled invocations.
4. Check **Logs** for `scheduled GA4 pull failed` and the associated error.

For local handler testing:

```bash
cd workers/analytics
npx wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=30+14+*+*+5"
```

For a live log stream around a manual test:

```bash
cd workers/analytics
npx wrangler tail mapasocietario-analytics --status error
```

The dashboard's Cron Events and persisted Worker Logs are the authoritative
historical evidence. A successful `/run` proves the GA4 and D1 path works, but
it does not prove that a Cron Trigger is attached to the deployed Worker.
