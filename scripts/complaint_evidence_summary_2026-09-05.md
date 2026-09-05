# Private complaint evidence — 5 September 2026

Second dated incident, same methodology as `complaint_evidence_summary_2026-08-30.md`.
Raw transcript is held outside the repository because it contains the subscriber's
public IPv4 address. Redact identifiers before any public publication.

## Incident window captured

- Collection started: **2026-09-05 17:38:17 CEST / 15:38:17 UTC**
- Collection ended: **2026-09-05 17:39:28 CEST / 15:39:28 UTC**
- Location/timezone: Spain, Europe/Madrid (UTC+02:00)
- Collected with `scripts/capture_connectivity_incident.sh` (read-only, no sudo)

## HTTPS/TCP results

| probe | result |
|---|---|
| `mapasocietario.es` (normal) | `curl_exit=28`, timeout before TCP connect |
| `nurnbergconsulting.com` (normal) | `curl_exit=28`, timeout before TCP connect |
| `ncdata.eu` (control, normal) | `curl_exit=0`, HTTP 200 |
| `mapasocietario.es` → `188.114.96.5` | `curl_exit=28` |
| `mapasocietario.es` → `188.114.97.5` | `curl_exit=28` |
| `mapasocietario.es` → `104.21.93.248` | `curl_exit=0`, HTTP 200 |
| `ncdata.eu` → `188.114.96.5` | `curl_exit=28` |
| `ncdata.eu` → `188.114.97.5` | `curl_exit=28` |

The reciprocal test reproduces the 30 August result exactly: reachability follows the
**destination IP**, not the hostname, origin, certificate or Cloudflare account.

## ICMP

- `188.114.96.5`: 3 transmitted, 0 received (100% loss)
- `188.114.97.5`: 3 transmitted, 0 received (100% loss)
- `104.21.93.248` (control): 3 transmitted, 3 received, 0% loss

## New finding — the two authoritative nameservers disagree

Both affected zones are served by `henry.ns.cloudflare.com` and
`melany.ns.cloudflare.com`. Queried directly, they return **different A records**,
consistently and reproducibly (5/5 repeats each):

| zone | `henry.ns` | `melany.ns` |
|---|---|---|
| `mapasocietario.es` | `188.114.96.5`, `188.114.97.5` (blocked) | `104.21.29.241`, `172.67.149.254` (clean) |
| `nurnbergconsulting.com` | `188.114.96.5`, `188.114.97.5` (blocked) | `104.21.47.95`, `172.67.146.99` (clean) |
| `ncdata.eu` (control) | `104.21.93.248`, `172.67.217.35` | `104.21.93.248`, `172.67.217.35` (agree) |

- The SOA serial is **identical** on both nameservers (`2412925226`), so this is not an
  ordinary propagation lag with a version bump.
- The control zone on the same account does **not** exhibit the split.
- The `melany.ns` answers match exactly the addresses Cloudflare support reported as
  the zones' "current" IPs, which explains how a single-vantage check concluded the
  zones had already moved.

### Which answer users actually get

Public recursive resolvers observed during the window, from Spain:

| resolver | `mapasocietario.es` |
|---|---|
| `1.1.1.1` | `188.114.97.5`, `188.114.96.5` (blocked) |
| `8.8.8.8` | `188.114.97.5`, `188.114.96.5` (blocked) |
| `9.9.9.9` | blocked pair on re-query; clean pair on an earlier query in the same window |
| `dns.google` DoH | `188.114.97.5`, `188.114.96.5` (blocked) |

EDNS Client Subnet was varied across eight client subnets against `henry.ns` and did
not change the answer, so the split is per-nameserver, not geographic steering.

## Interpretation and attribution limitation

Two independent effects compound here:

1. ISP-side, destination-IP filtering of `188.114.96.0/20` in Spain during football
   match windows, reproduced identically on 30 August and 5 September.
2. A Cloudflare-side inconsistency in which one of the zones' two authoritative
   nameservers continues to publish addresses inside the filtered range while the
   other publishes addresses outside it.

These endpoint measurements do not establish who selected the filtered addresses,
which entity technically applied the restriction, or the legal authority relied upon.
The ISP should preserve and disclose the relevant routing/filtering records.
