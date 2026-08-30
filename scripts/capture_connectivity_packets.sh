#!/bin/zsh

# Run this helper from Terminal. It requests sudo only for tcpdump.
# Place it inside the evidence directory before running it.

set +e
export LC_ALL=C

evidence_dir="${0:A:h}"

printf 'Packet capture start\n'
date '+local=%Y-%m-%dT%H:%M:%S%z'
date -u '+utc=%Y-%m-%dT%H:%M:%SZ'
printf 'interface=en0\n'
printf 'filter=(host 188.114.96.5 or host 188.114.97.5) and (tcp port 443 or icmp)\n'

sudo -v || exit 1

for ip in 188.114.96.5 188.114.97.5; do
  pcap_path="$evidence_dir/cloudflare-block-$ip.pcap"

  sudo tcpdump -ni en0 -U -s 0 -c 4 \
    -w "$pcap_path" \
    "host $ip and tcp port 443" &
  tcpdump_pid=$!
  sleep 1

  printf '\nForced request to %s\n' "$ip"
  date '+local=%Y-%m-%dT%H:%M:%S%z'
  date -u '+utc=%Y-%m-%dT%H:%M:%SZ'
  curl -4 -v --connect-timeout 5 --max-time 10 \
    --resolve "mapasocietario.es:443:$ip" \
    https://mapasocietario.es/ -o /dev/null
  printf 'curl_exit=%s\n' "$?"

  wait "$tcpdump_pid"

  printf '\nReadable packet decode for %s\n' "$ip"
  sudo tcpdump -nn -tttt -r "$pcap_path"
  sudo chown "$(id -un)":staff "$pcap_path"
done

printf '\nPacket capture end\n'
date '+local=%Y-%m-%dT%H:%M:%S%z'
date -u '+utc=%Y-%m-%dT%H:%M:%SZ'
printf 'pcaps=%s/cloudflare-block-188.114.96.5.pcap %s/cloudflare-block-188.114.97.5.pcap\n' \
  "$evidence_dir" "$evidence_dir"
