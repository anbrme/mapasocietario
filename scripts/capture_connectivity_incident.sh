#!/bin/zsh

# Read-only collection of network evidence for a time-limited reachability incident.
# Run through the macOS `script` utility so stdout and stderr are preserved together.

set +e
export LC_ALL=C

section() {
  printf '\n===== %s =====\n' "$1"
}

curl_probe() {
  local label="$1"
  shift
  section "$label"
  date '+local=%Y-%m-%dT%H:%M:%S%z'
  date -u '+utc=%Y-%m-%dT%H:%M:%SZ'
  curl -4 -v --connect-timeout 5 --max-time 12 "$@" -o /dev/null
  printf 'curl_exit=%s\n' "$?"
}

section "COLLECTION START"
date '+local=%Y-%m-%dT%H:%M:%S%z'
date -u '+utc=%Y-%m-%dT%H:%M:%SZ'

section "SYSTEM"
sw_vers
uname -a

section "NETWORK STATE"
scutil --nwi
printf '\nDefault IPv4 route:\n'
route -n get default
printf '\nRoute to blocked Cloudflare IP 188.114.96.5:\n'
route -n get 188.114.96.5
printf '\nRoute to blocked Cloudflare IP 188.114.97.5:\n'
route -n get 188.114.97.5
printf '\nRoute to reachable Cloudflare control IP 104.21.93.248:\n'
route -n get 104.21.93.248

section "SYSTEM PROXY CONFIGURATION"
scutil --proxy

section "PUBLIC SOURCE IP"
printf 'public_ipv4='
curl -4 -sS --connect-timeout 5 --max-time 10 https://ipinfo.io/ip
printf '\n'

section "DNS - SYSTEM RESOLVER"
for host in mapasocietario.es nurnbergconsulting.com ncdata.eu; do
  printf '\n-- %s A --\n' "$host"
  dig +time=2 +tries=1 A "$host"
  printf '\n-- %s AAAA --\n' "$host"
  dig +time=2 +tries=1 AAAA "$host"
  printf '\n-- %s HTTPS/TYPE65 --\n' "$host"
  dig +time=2 +tries=1 TYPE65 "$host"
done

section "DNS - INDEPENDENT RESOLVERS"
for resolver in 1.1.1.1 8.8.8.8 9.9.9.9; do
  for host in mapasocietario.es nurnbergconsulting.com ncdata.eu; do
    printf 'resolver=%s host=%s A=' "$resolver" "$host"
    dig +short +time=2 +tries=1 @"$resolver" A "$host" | tr '\n' ' '
    printf '\n'
  done
done

curl_probe "NORMAL HTTPS - mapasocietario.es" https://mapasocietario.es/
curl_probe "NORMAL HTTPS - nurnbergconsulting.com" https://nurnbergconsulting.com/
curl_probe "NORMAL HTTPS CONTROL - ncdata.eu" https://ncdata.eu/

for ip in 188.114.96.5 188.114.97.5; do
  curl_probe "FORCED AFFECTED HOSTNAME - mapasocietario.es -> $ip" \
    --resolve "mapasocietario.es:443:$ip" https://mapasocietario.es/
done

curl_probe "FORCED AFFECTED HOSTNAME TO CONTROL IP - mapasocietario.es -> 104.21.93.248" \
  --resolve mapasocietario.es:443:104.21.93.248 https://mapasocietario.es/

for ip in 188.114.96.5 188.114.97.5; do
  curl_probe "RECIPROCAL CONTROL HOSTNAME - ncdata.eu -> $ip" \
    --resolve "ncdata.eu:443:$ip" https://ncdata.eu/
done

section "ICMP COMPARISON"
date -u '+utc=%Y-%m-%dT%H:%M:%SZ'
for ip in 188.114.96.5 188.114.97.5 104.21.93.248; do
  printf '\n-- ping %s --\n' "$ip"
  ping -n -c 3 -W 1000 "$ip"
done

section "TRACEROUTE COMPARISON"
date -u '+utc=%Y-%m-%dT%H:%M:%SZ'
for ip in 188.114.96.5 188.114.97.5 104.21.93.248; do
  printf '\n-- traceroute %s --\n' "$ip"
  traceroute -n -m 16 -q 1 -w 1 "$ip"
done

section "COLLECTION END"
date '+local=%Y-%m-%dT%H:%M:%S%z'
date -u '+utc=%Y-%m-%dT%H:%M:%SZ'
