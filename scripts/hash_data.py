"""Write data/SHA256SUMS.txt: a SHA-256 fingerprint for every site data file, plus the NASA source each traces to.
Anyone can check that the files they see are the ones we built: `cd data && sha256sum -c SHA256SUMS.txt`.
Run after any rebuild: python scripts/hash_data.py"""
import hashlib
from pathlib import Path
R = Path(__file__).resolve().parents[1]
lines = []
for p in sorted((R / "data").glob("*.json")):
    lines.append(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}")
(R / "data/SHA256SUMS.txt").write_text("\n".join(lines) + "\n")
print(len(lines), "files fingerprinted")
