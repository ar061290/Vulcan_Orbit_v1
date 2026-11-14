#!/usr/bin/env python3
"""Download NASA PSI combustion data straight from psi.nasa.gov. Standard library only.

    python scripts/download_psi.py                 # summary tables + key small files (~9 MB)
    python scripts/download_psi.py --max-mb 60     # also pull analysed-data files up to 60 MB each
    python scripts/download_psi.py --ids PSI-100 PSI-69

Files land in datasets/psi/<PSI id>/ and every file is logged in datasets/psi/MANIFEST.csv
(name, DOI, source page, bytes, sha256) for the References section. Data is CC0-1.0; cite the DOI.
Raw video and image archives are skipped: they run to terabytes.
"""
import argparse, csv, hashlib, json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

BASE = "https://psi.nasa.gov/geode-py/ws"
OUT = Path(__file__).resolve().parents[1] / "datasets" / "psi"
UA = {"User-Agent": "Mozilla/5.0 (VulcanOrbit SpaceApps student project)", "Accept": "application/json, text/plain, */*"}
# Fire-safety and combustion investigations (verified on the PSI site, 14 Nov 2026).
IDS = {
    "PSI-100": "Saffire-III", "PSI-99": "Saffire-II", "PSI-98": "Saffire-I", "PSI-102": "SAME", "PSI-101": "SAME-R",
    "PSI-115": "SAME data modelling", "PSI-47": "DAFT", "PSI-69": "FLEX", "PSI-68": "FLEX-2", "PSI-39": "CFI (cool flames, droplets)",
    "PSI-117": "Cool flame CFD on FLEX data", "PSI-142": "Cool flame transitions", "PSI-25": "BASS-II", "PSI-26": "BASS",
    "PSI-62": "Concurrent flame spread modelling", "PSI-107": "SPICE", "PSI-60": "SPICE data analysis", "PSI-106": "SLICE",
    "PSI-22": "ACME E-FIELD Flames", "PSI-159": "ACME CFI-G", "PSI-10": "ACME Flame Design", "PSI-20": "ACME BRE",
    "PSI-21": "ACME CLD Flame", "PSI-23": "ACME s-Flame",
}
# Beyond the summary tables, these small files are worth having.
EXTRA = [
    ("PSI-100", r"Raw Data_(Raw telemetry file\.csv|Saffire_Data_Table.*\.csv)$"),
    ("PSI-98", r"Raw Data_Saffire-I Telemetry Data.*\.xlsx$"),
    ("PSI-117", r"Analyzed Data_.*\.(csv|xlsx)$"), ("PSI-142", r"Analyzed Data_.*\.xlsx$"),
    ("PSI-25", r"(Fan calibration data|Test\.Matrices)\.xlsx$"), ("PSI-26", r"As Run_Test Matrix\.xlsx$"),
    ("PSI-107", r"Raw Data_Spice_Flight_Flamelength\.xls$"),
]

def get(url, binary=False, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                data = r.read()
                return data if binary else data.decode("utf-8", "replace")
        except Exception as e:  # network hiccup: wait and retry
            if i == tries - 1: raise
            time.sleep(2 + 3 * i)

def files_of(meta):
    seen, out = set(), []
    for v in meta.values():
        if isinstance(v, list) and v and isinstance(v[0], dict) and "file_name" in v[0]:
            for f in v:
                if f["file_name"] not in seen and not f.get("restricted"):
                    seen.add(f["file_name"]); out.append(f)
    return out

def wanted(pid, f, max_mb):
    path, size = f.get("remote_path") or "", (f.get("file_size") or 0) / 1e6
    if re.search(r"/(Experimental table|Modeling table|metadata)/", path, re.I): return True
    if any(p == pid and re.search(rx, f["file_name"]) for p, rx in EXTRA): return size <= max(max_mb, 30)
    return max_mb > 8 and size <= max_mb and re.search(r"/(Analyzed Data|Reference Data|Science Documents|Reports)/", path)

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ids", nargs="*", default=list(IDS)); ap.add_argument("--max-mb", type=float, default=8)
    a = ap.parse_args(); OUT.mkdir(parents=True, exist_ok=True)
    rows, failed = [], []
    for pid in a.ids:
        print(f"== {pid}  {IDS.get(pid, '')}")
        try: meta = json.loads(get(f"{BASE}/repo/investigations/{pid}"))
        except Exception as e: print("   could not read investigation:", e); failed.append(pid); continue
        doi = meta.get("doi") or meta.get("DOI") or ""
        d = OUT / pid; d.mkdir(exist_ok=True)
        (d / "investigation.json").write_text(json.dumps({k: v for k, v in meta.items() if not isinstance(v, list)}, indent=1, default=str), encoding="utf-8")
        for f in files_of(meta):
            if not wanted(pid, f, a.max_mb): continue
            name, dest = f["file_name"], d / re.sub(r'[<>:"/\\|?*]', "_", f["file_name"])
            try:
                if not dest.exists() or dest.stat().st_size == 0:
                    link = get(f"{BASE}/studies/{pid}/download?file={urllib.parse.quote(name)}&version={f.get('version', 1)}&redirect=false").strip().strip('"')
                    if not link.startswith("http"): raise RuntimeError("no download link returned")
                    dest.write_bytes(get(link, binary=True))
                b = dest.read_bytes()
                rows.append([f"{pid}/{dest.name}", doi, f"https://psi.nasa.gov/physci/repo/data/investigations/{pid}", len(b), hashlib.sha256(b).hexdigest()])
                print(f"   ok   {len(b)/1024:9.1f} KB  {dest.name}")
            except Exception as e:
                failed.append(f"{pid}/{name}"); print(f"   FAIL {name}: {e}")
    with open(OUT / "MANIFEST.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh); w.writerow(["file", "doi", "source_page", "bytes", "sha256"]); w.writerows(rows)
    print(f"\n{len(rows)} files, {sum(r[3] for r in rows)/1e6:.1f} MB -> {OUT}")
    if failed: print(f"{len(failed)} failed (re-run to retry):", *failed, sep="\n  "); sys.exit(1)

if __name__ == "__main__":
    main()
