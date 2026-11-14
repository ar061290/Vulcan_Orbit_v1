#!/usr/bin/env python3
"""Fetch the extra NASA PSI files M7 needs (approved by the M7 owner on 14 Nov 2026).

    python models/m7-extinction/fetch_extra.py

Reuses the download helpers in scripts/download_psi.py (no code copied).
- Data files that build.py reads go to datasets/psi/<PSI id>/ and get a row APPENDED to
  datasets/psi/MANIFEST.csv (the file is never rewritten, so other features' rows are untouched).
- Documentation PDFs go to datasets/raw/<PSI id>/ (git-ignored); their sha256 is checked here
  and quoted in models/m7-extinction/DATA.md.
"""
import csv, hashlib, json, sys, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from download_psi import BASE, get, files_of  # noqa: E402  (shared helper, imported not copied)

PSI_DIR = ROOT / "datasets" / "psi"
RAW_DIR = ROOT / "datasets" / "raw"
MANIFEST = PSI_DIR / "MANIFEST.csv"

# (PSI id, exact file name on psi.nasa.gov, where it goes, expected sha256)
TARGETS = [
    ("PSI-39", "PSI-39_Science Documents_CFI_DataSummary_Spreadsheet_Jan2021.xlsx", "psi",
     "a5b04b6a32bda764a9b367e491cc46b78ad0af0ac6b5e723e63b57abdb1d7dd8"),
    ("PSI-39", "PSI-39_Reports_CFI Science Final Report.pdf", "raw",
     "e15158689180314583917200a071730d3aed9088e1ae689b847bd416674010f9"),
    ("PSI-159", "PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf", "raw",
     "f6cce7cc08ca69c155994d7a8898e21cd4aba122f4e46d5e00708e4889a1ebab"),
]


def main():
    listed = set()
    if MANIFEST.exists():
        with open(MANIFEST, newline="", encoding="utf-8") as fh:
            listed = {row["file"] for row in csv.DictReader(fh)}
    metas, new_rows = {}, []
    for pid, name, where, expected in TARGETS:
        if pid not in metas:
            metas[pid] = json.loads(get(f"{BASE}/repo/investigations/{pid}"))
        meta = metas[pid]
        entry = next((f for f in files_of(meta) if f["file_name"] == name), None)
        if entry is None:
            sys.exit(f"{pid}: {name} is not listed on psi.nasa.gov any more")
        dest = (PSI_DIR if where == "psi" else RAW_DIR) / pid / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists() or dest.stat().st_size == 0:
            q = urllib.parse.quote(name)
            link = get(f"{BASE}/studies/{pid}/download?file={q}&version={entry.get('version', 1)}&redirect=false").strip().strip('"')
            if not link.startswith("http"):
                sys.exit(f"{pid}: no download link returned for {name}")
            dest.write_bytes(get(link, binary=True))
        b = dest.read_bytes()
        sha = hashlib.sha256(b).hexdigest()
        if expected and sha != expected:
            sys.exit(f"{name}: sha256 {sha} does not match the expected {expected}")
        rel = f"{pid}/{name}"
        print(f"ok  {len(b)/1024:8.1f} KB  sha256 {sha}  {dest.relative_to(ROOT)}")
        if where == "psi" and rel not in listed:
            new_rows.append([rel, meta.get("doi", ""), f"https://psi.nasa.gov/physci/repo/data/investigations/{pid}", len(b), sha])
    if new_rows:
        with open(MANIFEST, "a", newline="", encoding="utf-8") as fh:
            csv.writer(fh).writerows(new_rows)
        print(f"appended {len(new_rows)} row(s) to {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
