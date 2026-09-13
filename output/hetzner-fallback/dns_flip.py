#!/usr/bin/env python3
"""Move mapasocietario.es root + www between Cloudflare and the Hetzner front.

Runs on the Hetzner server with sudo (the token is certbot's root-only
/etc/letsencrypt/cloudflare.ini and never leaves the box):
  sudo ./dns_flip.py show
  sudo ./dns_flip.py to-hetzner          # backs up first, then A/AAAA DNS-only, TTL 60
  sudo ./dns_flip.py restore backup.json # record-for-record restore of a backup
"""
import json, sys, time, urllib.request, urllib.error, pathlib

ZONE = "c9227a4d4c4b9c44b8fadfbdb9359f3f"
NAMES = ("mapasocietario.es", "www.mapasocietario.es")
HETZNER = {"A": "188.245.60.39", "AAAA": "2a01:4f8:c013:108e::1"}
API = f"https://api.cloudflare.com/client/v4/zones/{ZONE}/dns_records"


def load_token():
    """Root-only certbot credentials (run with sudo); a local cf-dns-token file
    is honoured only as a fallback for the initial setup."""
    ini = pathlib.Path("/etc/letsencrypt/cloudflare.ini")
    local = pathlib.Path(__file__).with_name("cf-dns-token")
    for path in (ini, local):
        try:
            text = path.read_text()
        except (PermissionError, FileNotFoundError):
            continue
        for line in text.splitlines():
            if "=" in line:
                line = line.split("=", 1)[1]
            if line.strip():
                return line.strip()
    raise SystemExit("no token: run with sudo (reads /etc/letsencrypt/cloudflare.ini)")


TOKEN = load_token()


def call(method, url, body=None):
    req = urllib.request.Request(url, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            d = json.load(r)
    except urllib.error.HTTPError as e:
        d = json.load(e)
    if not d.get("success"):
        raise SystemExit(f"{method} {url} failed: {d.get('errors')}")
    return d["result"]


ADDRESS_TYPES = ("A", "AAAA", "CNAME")


def records():
    """Only the address records; TXT (verification) records are never touched."""
    out = []
    for name in NAMES:
        out += [r for r in call("GET", f"{API}?name={name}&per_page=100")
                if r["type"] in ADDRESS_TYPES]
    return out


def show(recs):
    for r in recs:
        flag = "proxied" if r["proxied"] else "dns-only"
        print(f"  {r['type']:5} {r['name']:24} -> {r['content']}  {flag}  ttl={r['ttl']}")


def backup(recs):
    path = pathlib.Path(__file__).with_name(f"dns-backup-{time.strftime('%Y%m%d-%H%M%S')}.json")
    path.write_text(json.dumps(recs, indent=2))
    print(f"backup written: {path}")
    return path


def to_hetzner():
    recs = records()
    print("current:"); show(recs); backup(recs)
    for r in recs:
        call("DELETE", f"{API}/{r['id']}")
    for name in NAMES:
        for rtype, content in HETZNER.items():
            call("POST", API, {"type": rtype, "name": name, "content": content,
                               "proxied": False, "ttl": 60})
    print("now:"); show(records())


def restore(path):
    wanted = json.loads(pathlib.Path(path).read_text())
    for r in records():
        call("DELETE", f"{API}/{r['id']}")
    for r in wanted:
        call("POST", API, {k: r[k] for k in ("type", "name", "content", "proxied", "ttl")})
    print("restored:"); show(records())


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "show"
    if cmd == "show": show(records())
    elif cmd == "to-hetzner": to_hetzner()
    elif cmd == "restore": restore(sys.argv[2])
    else: raise SystemExit(__doc__)
