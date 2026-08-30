# Surviving the LaLiga IP blocks

## What is happening

A Barcelona commercial court (Juzgado de lo Mercantil nº 6) lets LaLiga order
the Spanish ISPs — Movistar, MasOrange, Vodafone and DIGI — to null-route
individual IP addresses during football matches, as an anti-piracy measure
against IPTV streams. The order covers the 2024/25 through 2026/27 seasons and
lapses around 20 June 2027.

The addresses they pick are Cloudflare's *shared* anycast ones. Thousands of
unrelated sites share each address, and the order requires no mechanism to
avoid collateral damage, so when an address is blocked every site behind it
disappears for Spanish users at once. Cloudflare's appeal was rejected in
March 2025; a Constitutional Court appeal is pending. The 2026/27 blocks began
on 15 August 2026 and peaked around 550 simultaneously blocked addresses.

## Why it hits us specifically

Every origin this product depends on resolves into `104.21.0.0/16` or
`172.67.0.0/16`:

| Service | Hostname | Address family |
| --- | --- | --- |
| Site | `mapasocietario.es` | `104.21.x` + `172.67.x` |
| BORME API | `api.ncdata.eu` | `104.21.x` + `172.67.x` |
| Payments | `payments.ncdata.eu` | `104.21.x` + `172.67.x` |
| Alerts / RAG | `rag.ncdata.eu` | `104.21.x` + `172.67.x` |
| IBEX 35 API | `ibex35-api.ncdata.eu` | Cloudflare |
| Congreso proxy | `congreso-proxy.anurnberg.workers.dev` | Cloudflare |

On a sampled match day, 165 of the 206 addresses on the public blocklist —
about 80% — were inside those same two ranges. So this is not a question of
whether we get caught, only of when.

Two facts shape the mitigation:

- **Blocks are per-`/32`, not per-prefix.** A dedicated address that is not
  shared with an IPTV service is effectively never hit. Getting off shared
  anycast is the whole fix.
- **A block is a black hole, not a refusal.** The ISP drops the packets, so the
  TCP handshake neither completes nor fails; the socket hangs until the OS
  gives up, 75s or more. Anything that waits for `fetch()` to reject will not
  help a real user.

## What the app does about it

`src/services/originFailover.js` exports `resilientFetch`, a drop-in
replacement for `fetch` used by every cross-origin call site in `src/`. For any
URL whose origin appears in `ORIGIN_GROUPS` (`src/config.js`) it:

1. Puts an abort timer on the request. An origin we have not yet heard from
   gets 8s to produce response headers; past that it is treated as blocked.
   Once an origin has answered, its budget becomes twice its worst observed
   time-to-headers, floored at 8s and capped at 45s — so a snappy API keeps a
   tight budget and fails over quickly, while a genuinely slow BORME query
   earns the room it needs and is never mistaken for a block. A timeout resets
   that learning, so the *next* request fails over briskly rather than
   re-spending the earned budget. This matters because kickoff lands while
   people are already browsing: by then the primary is long since proven, and
   a fixed generous budget would strand the first victim for the full ceiling.
2. Retries the same path against the next mirror in the group.
3. Remembers the working origin in `sessionStorage`, so later requests and
   later page loads in the same session do not re-pay the discovery timeout.
4. Re-probes the primary in the background every 10 minutes and promotes it
   back once the match window closes — no reload needed.

Deliberately, an HTTP status is **not** a failover trigger: a 500 means the
origin answered, so it is reachable, and rerouting would double the load while
hiding a real bug. The exception is Cloudflare's `52x` family, which means the
edge is up but could not reach the VPS behind it — going direct can genuinely
win there, so those do fail over.

A caller-supplied `AbortSignal` still cancels outright; an unmounting component
does not trigger a pointless mirror request.

## Turning it on

Shipping this changed no behaviour: with no mirrors configured each group holds
one origin and `resilientFetch` is a pass-through. To activate it you need a
mirror hostname per service, on an address LaLiga does not touch.

### 1. Expose the API's VPS directly

The BORME API already runs on a VPS with its own dedicated address. Publish a
second hostname that reaches it without passing through Cloudflare's anycast:

- In Cloudflare DNS, add `api-directo.ncdata.eu` as an `A` record to the VPS
  address with the proxy **off** (grey cloud). Orange-clouding it would put it
  straight back into the blocked pool.
- Issue a certificate on the VPS for that name (Let's Encrypt).
- Send `Access-Control-Allow-Origin: https://mapasocietario.es` from it, since
  the browser treats it as a third origin.
- Repeat for `payments.ncdata.eu` and `rag.ncdata.eu` if they share the VPS.

Note the trade-off: a grey-clouded hostname publishes the origin address, so it
loses Cloudflare's DDoS protection and WAF. It is a fallback, not a new front
door — keep the primary orange-clouded and let the failover choose.

### 2. Mirror the static site on Bunny.net

Cloudflare Pages cannot serve from non-Cloudflare addresses, so the site itself
needs a second home. Bunny.net is the cheap credible option: its own EU address
space, roughly €1/month plus traffic, and not a free-tier mass host, so far
less likely to be sharing an address with an IPTV service. Point a pull zone at
the built `dist/`, and keep a `www2.mapasocietario.es` (or similar) hostname on
it as the escape hatch.

Bear in mind the Pages Functions in `functions/` — the server-rendered
`/empresa/[slug]` pages and their D1 lookups — do not run on Bunny. A mirror
serves the SPA shell and the prerendered routes; the dynamic company pages
would need either a Worker on the VPS or a static export.

### 3. Set the repo variables

Add these as GitHub Actions **variables** (Settings → Secrets and variables →
Actions → Variables), comma-separated, most-preferred first. They are consumed
by `.github/workflows/deploy.yml`:

```
VITE_API_FALLBACK_URLS=https://api-directo.ncdata.eu
VITE_PAYMENTS_FALLBACK_URLS=https://payments-directo.ncdata.eu
VITE_RAG_FALLBACK_URLS=https://rag-directo.ncdata.eu
```

`VITE_AI_INVESTIGATION_FALLBACK_URLS`, `VITE_CONGRESO_PROXY_FALLBACK_URLS` and
`VITE_IBEX35_API_FALLBACK_URLS` exist too, for the Workers-hosted services, if
you give them non-Cloudflare homes.

They are variables rather than secrets on purpose: public hostnames that ship
inside the bundle, with nothing to hide.

## Verifying and monitoring

`hayahora.futbol` publishes the live blocklist, which is the only practical way
to confirm an outage is a block rather than a bug — you cannot reproduce it
from outside a Spanish consumer ISP:

- `https://hayahora.futbol/estado/blocked-any.txt` — currently blocked
  addresses, one per line, any operator
- `https://hayahora.futbol/estado/data.json` — full history with per-ISP state
  changes
- Per-operator lists for Movistar, DIGI, Vodafone, Orange and Masmovil

To check whether we are currently caught:

```bash
curl -s https://hayahora.futbol/estado/blocked-any.txt > /tmp/blocked.txt
for host in mapasocietario.es api.ncdata.eu payments.ncdata.eu rag.ncdata.eu; do
  for ip in $(getent ahostsv4 "$host" | awk '{print $1}' | sort -u); do
    grep -qx "$ip" /tmp/blocked.txt && echo "BLOCKED $host $ip" || echo "ok      $host $ip"
  done
done
```

The feed is best-effort — the maintainers guarantee neither availability nor
format stability — so treat it as a diagnostic, not a dependency.

## What this does not solve

The client-side failover keeps the *application* working for anyone who can
load it. It does nothing for a visitor whose very first request for
`mapasocietario.es` is blocked, because no JavaScript is running yet. Closing
that gap needs one or both of:

- **DNS failover** — authoritative DNS off Cloudflare (its nameservers are on
  Cloudflare addresses too, so a block can take out resolution itself), TTLs
  at 60s, and a job that polls the feed above and repoints the record when one
  of our addresses appears on it.
- **A service worker** caching the app shell, so a returning visitor still gets
  a working app during a block and `resilientFetch` routes its API calls to the
  mirrors.

`warmOrigins()` in `originFailover.js` is exported but not wired in. Calling it
at startup would settle on a live origin in the background, so a match-day
visitor never pays the 8s discovery cost on their first search — at the price
of one extra request per mirrored group on every page load.
