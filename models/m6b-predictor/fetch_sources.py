"""Re-download the one public paper M6b transcribed from into datasets/raw/m6b/ (git-ignored) and check its sha256.

    python models/m6b-predictor/fetch_sources.py

build.py does not need it: the values used are transcribed with quotes in source/concurrent_reported.csv and source/properties_m6b.csv.
It is here so a reviewer can check the transcription (Table 1 on PDF page 9; burnout time on pages 17-18; area densities on page 7).
Standard library only.
"""
import hashlib
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "datasets" / "raw" / "m6b"
NAME = "olson_saffire_concurrent_ucl10164340.pdf"
URL = ("https://discovery.ucl.ac.uk/id/eprint/10164340/1/"
       "SIBAL-cotton%20revised%20Sept%20per%20review%20track%20changes%20accepted.pdf")
SHA = "455b945bb5cb50eb5e5e34e0c8e8911a561d6336ffb942f185d28e4f13e9f3cc"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / NAME
    if not dest.exists():
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (student project)"})
        with urllib.request.urlopen(req, timeout=300) as r:
            dest.write_bytes(r.read())
    got = hashlib.sha256(dest.read_bytes()).hexdigest()
    print(("ok  " if got == SHA else "MISMATCH ") + f"{NAME}  {got[:16]}")
    if got != SHA:
        raise SystemExit("sha256 differs from the file M6b was built from")


if __name__ == "__main__":
    main()
