"""Could each trained model's score be luck? Label-permutation tests (scikit-learn guide 3.1.5): shuffle the yes/no labels,
rerun the SAME grouped validation, and count how often the shuffled score reaches the real one. p = (C + 1) / (n + 1).
M5: its exact leave-one-test-out logistic model. M7 extinction and cool flame: their fixed reference model on the first
grouped split (the nested headline is too slow to permute 1,000 times; M7's own fast check used 20 shuffles).
Run: python scripts/permutation_tests.py   ->  data/permutation.json"""
import json, sys, csv
from pathlib import Path
import numpy as np
from sklearn.metrics import roc_auc_score
R = Path(__file__).resolve().parents[1]
rng = np.random.default_rng(20261115)
out = []
# ---- M5 ----
sys.path.insert(0, str(R / "models/m5-smoke-miss")); import build as M5
rows = [dict(test=r["test"], material=r["material"], v=float(r["air_velocity_cm_s"]), CMD=float(r["CMD_um"]), DAM=float(r["DAM_um"]), Dg=float(r["Dg_um"]), sg=float(r["sigma_g"]))
        for r in csv.DictReader(open(R / "models/m5-smoke-miss/traced.csv"))]
for r in rows: r["MMD"] = M5.mmd(r["CMD"], r["DAM"])
y = np.array([1 if r["MMD"] < 0.5 else 0 for r in rows]); real = roc_auc_score(y, M5.logo(rows, y))
N = 2000; null = []
for _ in range(N):
    yp = rng.permutation(y); null.append(roc_auc_score(yp, M5.logo(rows, yp)) if len(set(yp)) > 1 else 0.5)
null = np.array(null); out.append(dict(id="smoke-miss", name="Smoke miss (M5)", real_auc=round(float(real), 3), n_perm=N, null_mean=round(float(null.mean()), 3),
    null_95=round(float(np.percentile(null, 95)), 3), p=round(float((np.sum(null >= real) + 1) / (N + 1)), 4), split="leave one test out (16 tests)"))
print(out[-1])
# ---- M7 ----
sys.path.insert(0, str(R / "models/m7-extinction"))
from m7 import load, cv, estimators as E
def m7perm(name, frame, make, N=1000):
    f, y, g = frame
    real = cv.cross_val(make, f, y, g, y, "clf", 1, n_jobs=1).score
    null = np.array([cv.cross_val(make, f, (yp := rng.permutation(y)), g, yp, "clf", 1, n_jobs=1).score for _ in range(N)])
    out.append(dict(id=name, name={"m7-extinction": "Droplet flame goes out (M7)", "m7-cool-flame": "Cool flame (M7)"}[name], real_auc=round(float(real), 3), n_perm=N,
        null_mean=round(float(null.mean()), 3), null_95=round(float(np.percentile(null, 95)), 3), p=round(float((np.sum(null >= real) + 1) / (N + 1)), 4),
        split="whole test days held out, first grouped split, fixed reference model")); print(out[-1])
fx = load.flex_model_frame(load.load_flex()); m7perm("m7-extinction", (fx, fx["extinguished"].to_numpy(), fx["session"].to_numpy()), lambda: E.Logit("flex_physics", 1.0))
cf = load.cfi_cool_frame(load.load_cfi())
ycol = ["consumed"]
gcol = ["session"]
print("cool-flame columns used:", ycol, gcol)
m7perm("m7-cool-flame", (cf, cf[ycol[0]].to_numpy().astype(int), cf[gcol[0]].to_numpy()), lambda: E.Logit("cfi_raw", 1.0))
res = dict(status="model", what="Label-permutation tests: could each model's score be luck?", method="Shuffle labels, rerun the same grouped validation, p = (C+1)/(n+1). Seed 20261115.", rows=out)
(R / "data/permutation.json").write_text(json.dumps(res, indent=1))
m = json.loads((R / "data/manifest.json").read_text())
if "permutation" not in {f["name"] for f in m["files"]}:
    m["files"].append(dict(name="permutation", status="model", owner="Dashboard", what="Label-permutation p-values for the trained models")); (R / "data/manifest.json").write_text(json.dumps(m, indent=1, ensure_ascii=False))
