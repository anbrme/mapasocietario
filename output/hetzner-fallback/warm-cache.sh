#!/usr/bin/env bash
# Render every sitemap URL through the front so the nginx page cache holds a
# fresh copy of each public page. Runs from mapasocietario-cache-warm.timer
# after the daily enrichment; safe to run by hand at any time.
#
# The front allows 20 r/s per IP (mapasocietario-limits.conf) and the warmer
# arrives from one IP. Cache hits answer in ~60 ms, so four unpaced workers
# would run at ~65 r/s and get 429s (first runs: half the URLs). Each worker
# pauses PAUSE seconds after every request: 4 workers x (0.06 + 0.2) s ~ 15 r/s.
# Any 429 is retried once, sequentially, at the end. A run over ~8,300 URLs
# takes about 10 minutes.
set -uo pipefail
FRONT="${FRONT:-https://mapasocietario.es}"
UA="MapaCacheWarmer/1.0 (+https://mapasocietario.es)"
PAR="${PAR:-4}"
PAUSE="${PAUSE:-0.2}"
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
fetch_one='curl -s -o /dev/null -A "'"$UA"'" -w "%{http_code} %{time_starttransfer}\n" -D - "$1" 2>/dev/null | awk -v u="$1" "tolower(\$1)==\"x-cache-status:\"{c=\$2; sub(/\r$/, \"\", c)} /^[0-9][0-9][0-9] /{s=\$1; t=\$2} END{print s, (c == \"\" ? \"-\" : c), t, u}"; sleep '"$PAUSE"
xargs -P "$PAR" -I{} sh -c "$fetch_one" _ {} < "$tmp" >> "$out" &
xpid=$!
while kill -0 "$xpid" 2>/dev/null; do
  sleep 60
  kill -0 "$xpid" 2>/dev/null && echo "$(date -u +%H:%M:%SZ) $(wc -l < "$out")/$total"
done
wait "$xpid"
# One sequential retry pass for anything the limiter still refused.
retry="$(mktemp)"; awk '$1 == "429" {print $4}' "$out" > "$retry"
if [ -s "$retry" ]; then
  grep -v '^429 ' "$out" > "$out.keep" && mv "$out.keep" "$out"
  while read -r u; do sh -c "$fetch_one" _ "$u"; done < "$retry" >> "$out"
fi
rm -f "$retry"
breakdown=$(awk '{print $1, $2}' "$out" | sort | uniq -c | sort -rn | awk '{printf "%s:%s=%s ", $2, $3, $1}')
hits=$(grep -c " HIT " "$out")
misses=$(grep -c " MISS \| EXPIRED \| STALE \| UPDATING " "$out")
errors=$(grep -vc "^200 " "$out")
summary="$started urls=$total hits=$hits refreshed=$misses errors=$errors finished=$(date -u +%FT%TZ) [$breakdown]"
echo "$summary"
echo "$summary" >> "$LOG"
