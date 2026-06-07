#!/usr/bin/env python3
"""
Convert the official Colegio de Registradores XLSX files into the committed CSVs
the Barómetro build reads.

The source endpoints (opendata.registradores.org) are WAF-protected and reject
scripted downloads, so the DOWNLOAD step is manual (do it in a browser, monthly):

  https://opendata.registradores.org/data-integration/constituciones-mensuales-provincias-es/RM_Const_2011-2026.xlsx
  https://opendata.registradores.org/data-integration/extinciones-mensuales-provincias-es/RM_Extin_2011-2026.xlsx
  https://opendata.registradores.org/data-integration/ampliaciones-mensuales-provincias-es/RM_Ampli_2011-2026.xlsx
  (also available: reducciones-…/RM_Reduc, traslados-…/RM_Trasl, depositos-…/RM_Depst — not yet used)

Then convert + commit + rebuild:

  python3 scripts/refresh-registradores.py [SOURCE_DIR]      # default: ~/Desktop/registradores
  git add data/registradores && git commit -m "data: refresh Registradores (YYYY-MM)"
  npm run build

This is a LOCAL step — the Cloudflare build never hits the network; it reads the CSVs.

XML note: parsed with the stdlib (defusedxml unavailable under PEP-668). Acceptable here
— inputs are official Registradores files the operator downloaded, not untrusted input.
"""
import csv
import os
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

A = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "registradores")
SRC_DEFAULT = os.path.expanduser("~/Desktop/registradores")

# (output csv, source xlsx filename, count column, capital column or None)
SOURCES = [
    ("const.csv", "RM_Const_2011-2026.xlsx", "num-con", "capt-suscr-con"),
    ("extin.csv", "RM_Extin_2011-2026.xlsx", "num-ext", None),
    ("ampli.csv", "RM_Ampli_2011-2026.xlsx", "num-amp", "capt-suscr-amp"),
]


def col_idx(ref):
    letters = re.match(r"[A-Z]+", ref).group()
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def read_xlsx(path):
    z = zipfile.ZipFile(path)
    try:
        ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
        shared = ["".join(t.text or "" for t in si.iter(A + "t")) for si in ss.findall(A + "si")]
    except KeyError:
        shared = []
    sheet_name = [n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n)][0]
    sheet = ET.fromstring(z.read(sheet_name))
    rows = []
    for row in sheet.iter(A + "row"):
        cells = {}
        for c in row.findall(A + "c"):
            v = c.find(A + "v")
            val = v.text if v is not None else None
            if c.get("t") == "s" and val is not None:
                val = shared[int(val)]
            cells[col_idx(c.get("r"))] = val
        rows.append([cells.get(j) for j in range(max(cells) + 1 if cells else 0)])
    return rows


def num(x):
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return 0


def convert(src_dir, out_name, xlsx_name, numcol, capcol):
    src = os.path.join(src_dir, xlsx_name)
    if not os.path.isfile(src):
        raise FileNotFoundError(f"missing source: {src} (download it from registradores.org first)")
    rows = read_xlsx(src)
    h = [str(c).strip().lower() if c else "" for c in rows[0]]
    pi, yi, mi, fi = h.index("prov"), h.index("ano"), h.index("mes"), h.index("form-soc")
    ni = h.index(numcol)
    ci = h.index(capcol) if capcol and capcol in h else None
    path = os.path.join(OUT, out_name)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["province", "year", "month", "form", "count"] + (["capital_subscribed"] if ci is not None else []))
        n = 0
        for r in rows[1:]:
            row = [r[pi], r[yi], r[mi], r[fi], num(r[ni])] + ([num(r[ci])] if ci is not None else [])
            w.writerow(row)
            n += 1
    return path, n


def main():
    src_dir = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    print(f"Source XLSX dir: {src_dir}")
    os.makedirs(OUT, exist_ok=True)
    written = {}
    for out_name, xlsx_name, numcol, capcol in SOURCES:
        path, n = convert(src_dir, out_name, xlsx_name, numcol, capcol)
        written[out_name] = path
        print(f"  ✓ {out_name}: {n} rows")
    # sanity: net for the latest full year (12 months) — should match the official figures
    crows = list(csv.DictReader(open(written["const.csv"], encoding="utf-8")))
    erows = list(csv.DictReader(open(written["extin.csv"], encoding="utf-8")))
    months = {}
    for r in crows:
        months.setdefault(r["year"], set()).add(r["month"])
    full = max(y for y, ms in months.items() if len(ms) >= 12)
    tot = lambda rows, y: sum(int(r["count"]) for r in rows if r["year"] == y)
    c, e = tot(crows, full), tot(erows, full)
    print(f"  sanity (latest full year {full}): const={c} extin={e} net={c - e}")
    print("Done. Review the diff, commit data/registradores, and rebuild.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print(f"refresh failed: {e}", file=sys.stderr)
        sys.exit(1)
