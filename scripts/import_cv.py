"""Bring the camera model's output into the site.

    python scripts/import_cv.py path/to/cv_latest.json [--owner "Mukund"]

Validates the file with the same rules the site uses (integration/cv/cv_export.py), copies it to data/cv_latest.json,
adds or updates its line in data/manifest.json, and refreshes data/SHA256SUMS.txt. Nothing is changed if it fails.
Once in, the Assess page ("Load from camera" → growth simulation), the Bench rig card and the model cards pick it up.
"""
import argparse
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "integration" / "cv"))
from cv_export import validate  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("--owner", default="CV owner")
    a = ap.parse_args()
    d = json.loads(pathlib.Path(a.src).read_text())
    problems = validate(d)
    if problems:
        print("REJECTED, nothing changed:\n- " + "\n- ".join(problems)); sys.exit(1)
    (ROOT / "data" / "cv_latest.json").write_text(json.dumps(d, indent=1))
    mp = ROOT / "data" / "manifest.json"; t = mp.read_text(); m = json.loads(t)
    line = {"name": "cv_latest", "status": d["status"], "owner": a.owner,
            "what": "Latest camera-model reading: flame state on the fuel (+ depth and smoke-flow fields when present)"}
    m["files"] = [x for x in m["files"] if x.get("name") != "cv_latest"] + [line]
    mp.write_text(json.dumps(m, indent=1 if '\n "' in t else 2, ensure_ascii=False) + ("\n" if t.endswith("\n") else ""))
    subprocess.run([sys.executable, str(ROOT / "scripts" / "hash_data.py")], check=True, stdout=subprocess.DEVNULL)
    print(f"OK: data/cv_latest.json ({d['flame_type']} flame, status {d['status']}) is in, manifest updated.")


if __name__ == "__main__":
    main()
