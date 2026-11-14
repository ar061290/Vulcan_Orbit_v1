"""Build data/daft.json from the NASA PSI-47 (DAFT / DAFT-2) files. Run: python scripts/build_daft.py"""
import csv, json, zipfile, glob, re
from pathlib import Path
R = Path(__file__).resolve().parents[1]
rows = list(csv.DictReader(open(R / 'datasets/psi/PSI-47/PSI-47_Experimental table_DAFT.csv', encoding='utf-8-sig')))
z = zipfile.ZipFile(glob.glob(str(R / 'datasets/psi/PSI-47/*.zip'))[0])
inv = z.read('i_Investigation.txt').decode('utf-8', 'replace')
obj = re.search(r'Comment\[Objective\]\t"(.*?)"', inv, re.S).group(1)
first = obj.split('. ')[0] + '.'
out = {
  'status': 'real',
  'source': 'NASA PSI-47 DAFT / DAFT-2, doi:10.60555/ztgj-d202 (experimental table and i_Investigation.txt)',
  'sessions': [{'session': r['Session Name'], 'day': r['Actual Day'], 'hardware': r['Hardware Description'], 'sample': r['Sample Material'], 'where': r['Sampled Location']} for r in rows],
  'objective_quote': first,
  'what_it_means': 'DAFT checked, with test dust instead of smoke, whether the P-Trak particle counter that SAME relied on to count smoke particles works without gravity. The SAME smoke data feed our smoke-miss model.',
  'not_in_archive': 'The PSI-47 files hold no particle counts or sizes, so this site shows no dust-versus-smoke size comparison.',
}
(R / 'data/daft.json').write_text(json.dumps(out, indent=1, ensure_ascii=False))
print(json.dumps(out, indent=1)[:1500])
