# Hetzner front for mapasocietario.es

Why: Spanish ISPs filter Cloudflare's 188.114.96.0/20 during LaLiga match
windows. Only the mapasocietario.es and nurnbergconsulting.com zones sit on that
range. api.ncdata.eu, payments.ncdata.eu, the Workers and Turnstile sit on
104.x/172.67 and stay reachable, so only the site's public entry point moves.

Shape: visitor -> Hetzner Nginx (188.245.60.39 / 2a01:4f8:c013:108e::1)
-> https://mapasocietario.pages.dev (stable Pages name, never the custom domain).
No frontend or API change is needed; API URLs are absolute and canonical URLs
are hardcoded to https://mapasocietario.es.

Files (copied to ncdata:~/hetzner-front/):
- mapasocietario.conf  Nginx site: 80 -> 301 https, www -> root, root -> Pages
- install.sh           sudo; issues the cert (DNS-01) and enables the site
- dns_flip.py          sudo; show / to-hetzner (backs up first) / restore <backup>

## Steps

1. Cloudflare token (dashboard > My Profile > API Tokens > Create):
   Permissions Zone:DNS:Edit + Zone:Zone:Read, Zone Resources = mapasocietario.es.
   Used by certbot (issuance + renewals) and by dns_flip.py. Stays on the server.
2. On the server:
       printf '%s\n' 'THE_TOKEN' > ~/hetzner-front/cf-dns-token
       chmod 600 ~/hetzner-front/cf-dns-token
       sudo ~/hetzner-front/install.sh
3. Test the real hostname without touching public DNS (from Spain, ideally
   during a block):
       curl -sI --resolve mapasocietario.es:443:188.245.60.39 https://mapasocietario.es/ | head
       curl -s  --resolve mapasocietario.es:443:188.245.60.39 https://mapasocietario.es/empresa/acciona | grep -c canonical
4. Flip:  sudo ~/hetzner-front/dns_flip.py to-hetzner   (writes a backup JSON first)
   Revert: sudo ~/hetzner-front/dns_flip.py restore ~/hetzner-front/dns-backup-*.json
5. Verify from Spain: dig +short mapasocietario.es must return 188.245.60.39.

## Known consequences

- Pages Functions read CF-Connecting-IP, which is now always the Hetzner IP.
  company-demand's 300/day limit and the verification Turnstile IP collapse to
  one bucket. Follow-up: trust X-Forwarded-For only when a shared-secret header
  from Nginx is present (functions/api/company-demand.js, functions/api/verify/request.js).
- Cloudflare WAF/bot rules no longer sit in front of the site; the API is still
  behind Cloudflare.
- The Pages custom domain may show "inactive" while DNS points away. Leave it
  configured; restore re-activates it.
- Fallback if no token: MODE=webroot sudo ./install.sh AFTER the flip (HTTP-01);
  expect a few minutes of TLS errors between flip and issuance.
