#!/usr/bin/env bash
# Render every sitemap URL through the front so the nginx page cache holds a
# fresh copy of each public page. Runs from mapasocietario-cache-warm.timer
# after the daily enrichment; safe to run by hand at any time.
#
# Concurrency 4 at ~8 req/s sits well under the front's 20 r/s per-IP limit
# (mapasocietario-limits.conf). A run over ~8,300 URLs takes 15-20 minutes.
set -uo pipefail
FRONT="${FRONT:-https://mapasocietario.es}"
UA="MapaCacheWarmer/1.0 (+https://mapasocietario.es)"
PAR="${PAR:-4}"
LOG="${LOG:-/var/log/borme/cache-warm.log}"
tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT

curl -fsS -A "$UA" "$FRONT/sitemap.xml" \
  | grep -o '<loc>[^<]*</loc>' | sed 's/<[^>]*>//g' \
  | while read -r sm; do curl -fsS -A "$UA" "$sm" | grep -o '<loc>[^<]*</loc>' | sed 's/<[^>]*>//g'; done \
  > "$tmp"

total=$(wc -l < "$tmp")
started=$(date -u +%FT%TZ)
out="$(mktemp)"; trap 'rm -f "$tmp" "$out"' EXIT
# One line per URL: status cache-status ttfb. X-Cache-Status is set by the
# front, so a run reports how many pages were already hot. Progress goes to
# stdout once a minute so a manual run is not silent for 15 minutes.
xargs -P "$PAR" -I{} sh -c \
  'curl -s -o /dev/null -A "'"$UA"'" -w "%{http_code} %{time_starttransfer}\n" -D - "{}" 2>/dev/null | awk "tolower(\$1)==\"x-cache-status:\"{c=\$2} /^[0-9][0-9][0-9] /{s=\$1; t=\$2} END{print s, c, t}"' \
  < "$tmp" >> "$out" &
xpid=$!
while kill -0 "$xpid" 2>/dev/null; do
  sleep 60
  kill -0 "$xpid" 2>/dev/null && echo "$(date -u +%H:%M:%SZ) $(wc -l < "$out")/$total"
done
wait "$xpid"
breakdown=$(awk '{print $1, ($2 == "" ? "-" : $2)}' "$out" | sort | uniq -c | sort -rn | awk '{printf "%s:%s=%s ", $2, $3, $1}')
hits=$(grep -c " HIT " "$out")
misses=$(grep -c " MISS \| EXPIRED \| STALE \| UPDATING " "$out")
errors=$(grep -vc "^200 " "$out")
summary="$started urls=$total hits=$hits refreshed=$misses errors=$errors finished=$(date -u +%FT%TZ) [$breakdown]"
echo "$summary"
echo "$summary" >> "$LOG"
