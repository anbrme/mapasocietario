#!/usr/bin/env bash
# Run ON the Hetzner server as root:  sudo ./install-front-secret.sh
# Installs the rate-limit zones, the X-Front-Secret snippet (from ./front-secret)
# and the updated site, then reloads Nginx.
set -euo pipefail
cd "$(dirname "$0")"
[ "$(id -u)" -eq 0 ] || { echo "run with sudo" >&2; exit 1; }
[ -s front-secret ] || { echo "front-secret missing" >&2; exit 1; }
mkdir -p /etc/nginx/snippets
install -m 640 -o root -g root /dev/null /etc/nginx/snippets/mapasocietario-front-secret.conf
printf 'proxy_set_header X-Front-Secret "%s";\n' "$(tr -d '[:space:]' < front-secret)" \
  > /etc/nginx/snippets/mapasocietario-front-secret.conf
install -m 644 mapasocietario-limits.conf /etc/nginx/conf.d/mapasocietario-limits.conf
install -m 644 mapasocietario.conf /etc/nginx/sites-available/mapasocietario
nginx -t
systemctl reload nginx
echo "front secret + rate limits installed"
