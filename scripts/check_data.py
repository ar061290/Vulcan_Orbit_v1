"""Check every data file against the house rules: a known status, listed in the manifest (and the manifest lists nothing
that is missing). Exit code 1 on any failure. Run: python scripts/check_data.py"""
import json, sys
from pathlib import Path
R = Path(__file__).resolve().parents[1]
OK = {"real", "dome", "model", "reported", "demo", "plan", "team", "missing"}
man = json.loads((R / "data/manifest.json").read_text()); listed = {f["name"]: f for f in man["files"]}
bad = []
for p in sorted((R / "data").glob("*.json")):
    if p.stem == "manifest": continue
    d = json.loads(p.read_text())
    st = d.get("status") if isinstance(d, dict) else None
    if st not in OK: bad.append(f"{p.name}: status {st!r} is not one of {sorted(OK)}")
    if p.stem not in listed: bad.append(f"{p.name}: not listed in data/manifest.json")
    elif listed[p.stem].get("status") not in (st, None) and listed[p.stem].get("status") != "missing": bad.append(f"{p.name}: status {st!r} but manifest says {listed[p.stem].get('status')!r}")
for n, f in listed.items():
    if f.get("status") != "missing" and not (R / "data" / f"{n}.json").exists(): bad.append(f"manifest lists {n} but data/{n}.json is missing")
print("\n".join(bad) if bad else f"OK: {len(list((R / 'data').glob('*.json'))) - 1} data files, all with a known status and in the manifest.")
sys.exit(1 if bad else 0)
