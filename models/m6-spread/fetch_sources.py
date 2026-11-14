"""Re-download the two public NASA documents M6 was built from into datasets/raw/m6/ (git-ignored) and check their sha256.

    python models/m6-spread/fetch_sources.py

build.py does not need these files: the one table it uses (Table 5.1) is transcribed in source/table5_1_transcribed.csv.
They are here so a reviewer can check the transcription against the original page (report p. 57, PDF page 65).
The two Bhattacharjee et al. (2016) papers are paywalled and are never downloaded or committed; get them from the publisher.
Standard library only.
"""
import hashlib
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "datasets" / "raw" / "m6"
UA = {"User-Agent": "Mozilla/5.0 (student project)"}
PSI = "https://psi.nasa.gov/geode-py/ws/studies/PSI-25/download?file={}&version=1&redirect=false"
FILES = [
    ("PSI-25_Reports_BASS-II Summary Report.pdf", "psi", "5ffa911fd9b6356f204646003fb9342e341810dcdfdf5cb15756e7f01ec5f770"),
    ("PSI-25_Science Documents_BASS-II_ReadMe.docx", "psi", "69f32647792f54ab2a561e3cdafc6c87d854564fe487aed2b09265286bd84e1d"),
    ("NTRS-20160000593_Ferkul_BASS-II_results.pdf",
     "https://ntrs.nasa.gov/api/citations/20160000593/downloads/20160000593.pdf",
     "9f2c89db9e1954c3c44409364ed6764f7e7466250264c28ff2d425350287546c"),
]


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
        return r.read()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, src, sha in FILES:
        dest = OUT / name
        if not dest.exists():
            if src == "psi":  # PSI returns a short-lived signed link to the file
                url = get(PSI.format(urllib.parse.quote(name))).decode().strip().strip('"')
            else:
                url = src
            dest.write_bytes(get(url))
        got = hashlib.sha256(dest.read_bytes()).hexdigest()
        print(("ok  " if got == sha else "MISMATCH ") + f"{name}  {got[:16]}")
        if got != sha:
            raise SystemExit(f"{name}: sha256 differs from the file M6 was built from")


if __name__ == "__main__":
    main()
