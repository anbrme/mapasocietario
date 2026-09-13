#!/usr/bin/env bash
# Run ON the Hetzner server as root:  sudo ./install.sh
# Issues the mapasocietario.es certificate and enables the Nginx front.
# Needs ./cf-dns-token (one line, a Cloudflare token with Zone.DNS:Edit on
# mapasocietario.es) next to this script. With MODE=webroot it skips the
# token and uses HTTP-01 instead, which only works AFTER DNS points here.
set -euo pipefail
cd "$(dirname "$0")"
MODE="${MODE:-dns}"
DOMAINS=(-d mapasocietario.es -d www.mapasocietario.es)
[ "$(id -u)" -eq 0 ] || { echo "run with sudo" >&2; exit 1; }
[ -f mapasocietario.conf ] || { echo "mapasocietario.conf missing" >&2; exit 1; }

mkdir -p /var/www/acme

if [ "$MODE" = dns ]; then
  [ -s cf-dns-token ] || { echo "cf-dns-token missing or empty" >&2; exit 1; }
  apt-get install -y -q python3-certbot-dns-cloudflare >/dev/null
  install -m 600 /dev/null /etc/letsencrypt/cloudflare.ini
  printf 'dns_cloudflare_api_token = %s\n' "$(tr -d '[:space:]' < cf-dns-token)" > /etc/letsencrypt/cloudflare.ini
  certbot certonly --non-interactive --agree-tos --keep-until-expiring \
    --dns-cloudflare --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
    --dns-cloudflare-propagation-seconds 30 \
    --deploy-hook 'systemctl reload nginx' "${DOMAINS[@]}"
else
  # Stage-1: only the port-80 block so the ACME challenge is served.
  awk '/^server \{/{n++} n==1' mapasocietario.conf > /etc/nginx/sites-available/mapasocietario
  ln -sfn /etc/nginx/sites-available/mapasocietario /etc/nginx/sites-enabled/mapasocietario
  nginx -t && systemctl reload nginx
  certbot certonly --non-interactive --agree-tos --keep-until-expiring \
    --webroot -w /var/www/acme --deploy-hook 'systemctl reload nginx' "${DOMAINS[@]}"
fi

install -m 644 mapasocietario.conf /etc/nginx/sites-available/mapasocietario
ln -sfn /etc/nginx/sites-available/mapasocietario /etc/nginx/sites-enabled/mapasocietario
nginx -t
systemctl reload nginx
certbot renew --dry-run --cert-name mapasocietario.es >/dev/null && echo "renewal dry-run OK"
echo "front installed. Test before flipping DNS:"
echo "  curl -sI --resolve mapasocietario.es:443:188.245.60.39 https://mapasocietario.es/ | head -5"
