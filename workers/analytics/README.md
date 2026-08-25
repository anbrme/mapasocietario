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
  -> persists the weekly rollup into D1
                     |
                     v
Claude scheduled task (Fri 17:00 Madrid)
  -> fetches /latest
  -> writes the analysis + styled HTML report
  -> delivers it with a push notification
```

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
| `/latest` | Returns the most recently stored report. |

`/run` and `/latest` return markdown by default; add `&format=json` for the raw
payload.

## What it collects

Two adjacent 7-day windows — the 7 days ending *yesterday*, and the 7 before
that. Today is never included, because GA4's current-day data is always partial.

- **Totals**: sessions, users, new users, page views, engagement rate, average
  session duration, key events — each against the prior week
- **Daily trend** across the current window
- **Acquisition**: channel groups with prior-week comparison, plus source/medium
- **Content**: top pages by views with average engagement time, and landing
  pages with bounce rate
- **Conversions**: key events by channel and landing page, plus the full event
  table
- **Geography and devices**

## Notes

- **DST**: cron is always UTC. `30 14 * * 5` is 16:30 Madrid in summer, 15:30 in
  winter. If you want it pinned to local time year-round, the cron needs editing
  twice a year.
- **`keyEvents` vs `conversions`**: GA4 renamed this metric. The Worker tries the
  modern name and retries once with the old one if the property rejects it.
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
