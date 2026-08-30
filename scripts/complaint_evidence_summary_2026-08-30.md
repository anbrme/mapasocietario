# Private complaint evidence — 30 August 2026

This directory contains unredacted diagnostic evidence. It includes the subscriber's public IPv4 address and actual domain names. It should be supplied privately to the ISP, Cloudflare, a regulator, or legal counsel. Redact those identifiers before public publication.

## Incident window captured

- Collection started: **2026-08-30 17:09:31 CEST / 15:09:31 UTC**
- Collection ended: **2026-08-30 17:10:43 CEST / 15:10:43 UTC**
- Location/timezone: Spain, Europe/Madrid (UTC+02:00)
- macOS: 26.6.2, build 25G83, Apple silicon
- Active interface: `en0`, IPv4 only; no active IPv6 state
- Public source IPv4: recorded in `mac-network-transcript.txt`

## Contemporaneous mobile observation

At **2026-08-30 17:11:54 CEST / 15:11:54 UTC**, during the Mac measurements, the site owner separately confirmed that **both affected domains were also unreachable from a Motorola Android phone**. The phone's exact network path (home Wi-Fi or cellular data) was not specified. This is a contemporaneous user observation rather than a packet capture from the phone.

## DNS results

The two affected domains resolved to the same Cloudflare IPv4 pair:

- `mapasocietario.es`: `188.114.96.5`, `188.114.97.5`
- `nurnbergconsulting.com`: `188.114.96.5`, `188.114.97.5`

The working control domain resolved to a different Cloudflare pair:

- `ncdata.eu`: `104.21.93.248`, `172.67.217.35`

Independent resolver checks were performed against `1.1.1.1`, `8.8.8.8`, and `9.9.9.9` and are preserved in the transcript.

## HTTPS/TCP results

At approximately 17:07–17:10 CEST:

- Normal requests to both affected domains timed out before TCP connected (`curl` exit 28, HTTP code 000).
- A normal request to the control domain returned HTTP 200.
- `mapasocietario.es` forced to `188.114.96.5` timed out before TCP connected.
- `mapasocietario.es` forced to `188.114.97.5` timed out before TCP connected.
- The same affected hostname forced to reachable Cloudflare IP `104.21.93.248` completed TCP, TLS 1.3 and HTTP/2, returning HTTP 200 from Cloudflare Madrid.
- The working control hostname `ncdata.eu`, when reciprocally forced to either `188.114.96.5` or `188.114.97.5`, timed out before TCP connected.

This reciprocal test shows that reachability followed the destination IP rather than the hostname, origin application, certificate, or Cloudflare account.

## ICMP and route comparison

- `188.114.96.5`: 3 packets transmitted, 0 received (100% loss).
- `188.114.97.5`: 3 packets transmitted, 0 received (100% loss).
- Control `104.21.93.248`: 3 packets transmitted, 3 received, approximately 7.2 ms average RTT.
- Local routes to all three destinations used the normal Wi-Fi interface and default gateway; there were no reject or blackhole route flags.
- Traceroutes to the affected pair stopped responding after the access-provider's internal hops.
- Traceroute to the control IP continued through the provider and reached Cloudflare at hop 9.

Traceroute non-response alone is not proof of filtering, because routers may suppress TTL-expired messages. It is included only as corroborating comparison alongside the decisive TCP and reciprocal hostname/IP tests.

## Interpretation and attribution limitation

The measurements establish a contemporaneous, destination-IP-specific loss of reachability to the two shared Cloudflare addresses while other Cloudflare addresses remained reachable. The behavior and timing are consistent with publicly documented match-window IP filtering in Spain.

These endpoint measurements do not independently establish who selected the addresses, which entity technically applied the restriction, or the legal authority relied upon. The ISP should preserve and disclose the relevant routing/filtering records and identify the basis for the interruption.

## Files

- `mac-network-transcript.txt` — full terminal transcript, including timestamps, system/network state, public source IP, DNS responses, verbose curl output, ICMP and traceroute comparisons.
- `dns-type65-supplement.txt` — corrected HTTPS/TYPE65 queries using syntax supported by the installed macOS `dig`.
- `capture_connectivity_incident.sh` — exact read-only collection script used.
- `capture_connectivity_packets.sh` — helper for producing a privileged PCAP and readable packet transcript.
- `packet-capture-transcript.txt` — created when the packet helper is run locally.
- `cloudflare-block-188.114.96.5.pcap` and `cloudflare-block-188.114.97.5.pcap` — created when the packet helper is run locally.
- `SHA256SUMS.txt` — integrity hashes, generated after collection is complete.
