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
# One line per URL: status cache-status ttfb. The cache-status header is set by
# the front (X-Cache-Status) so a run reports how many pages were already hot.
results=$(xargs -P "$PAR" -I{} sh -c \
  'curl -s -o /dev/null -A "'"$UA"'" -w "%{http_code} %{time_starttransfer}\n" -D - "{}" 2>/dev/null | awk "tolower(\$1)==\"x-cache-status:\"{c=\$2} /^[0-9][0-9][0-9] /{s=\$1; t=\$2} END{print s, c, t}"' \
  < "$tmp")
hits=$(echo "$results" | grep -c " HIT ")
misses=$(echo "$results" | grep -c " MISS \| EXPIRED \| STALE \| UPDATING ")
errors=$(echo "$results" | grep -vc "^200 ")
echo "$started urls=$total hits=$hits refreshed=$misses errors=$errors finished=$(date -u +%FT%TZ)" >> "$LOG"
