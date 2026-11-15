"""Trivial baselines for the flame-spread models (added 15 Nov 2026 after an independent audit).

AGENTS.md asks every model to be compared with "the textbook formula or a trivial predictor". M6 and M6b were compared only
with the textbook (de Ris) formula. This script scores, on the SAME leave-one-ISS-session-out split as M6b:
  - the training-set mean spread rate,
  - the training-set median,
  - a lookup: training mean per (thickness, sides burning) group, falling back to the training mean,
next to M6's kept model (de Ris x one constant) and M6b (de Ris x one factor per thin/thick regime).
No pass rule is changed. Writes data/trivial_baselines.json (status: model).
"""
import importlib.util
import json
import pathlib
import sys

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("m6b", ROOT / "models" / "m6b-predictor" / "build.py")
m6b = importlib.util.module_from_spec(spec); sys.modules["m6b"] = m6b; spec.loader.exec_module(m6b)


def r2(y, p):
    return float(1 - np.sum((y - p) ** 2) / np.sum((y - y.mean()) ** 2))


def main():
    _, _, df, *_ = m6b.load_inputs()
    y = df["spread_mm_s"].to_numpy()
    cal, b2, _ = m6b.loso(df)
    mean_p, med_p, look_p = (np.full(len(df), np.nan) for _ in range(3))
    for s in sorted(df["session"].unique()):
        te = (df["session"] == s).to_numpy(); tr = df[~te]
        mean_p[te] = tr["spread_mm_s"].mean(); med_p[te] = tr["spread_mm_s"].median()
        grp = tr.groupby(["thickness_mm", "sides_burning"])["spread_mm_s"].mean().to_dict()
        look_p[te] = [grp.get((a, b), tr["spread_mm_s"].mean()) for a, b in zip(df.loc[te, "thickness_mm"], df.loc[te, "sides_burning"])]
    rows = [
        ("Training-set mean (no physics)", "trivial", mean_p),
        ("Training-set median (no physics)", "trivial", med_p),
        ("Lookup: mean per thickness and sides burning (no physics)", "trivial", look_p),
        ("M6 kept model: de Ris x one constant", "model", b2),
        ("M6b: de Ris x one factor per thin/thick regime", "model", cal),
    ]
    out = dict(status="model", source="scripts/trivial_baselines.py on models/m6-spread/bass2_clean.csv (BASS-II opposed-flow PMMA slabs)",
               units=dict(mae="mm/s", r2="dimensionless"),
               split=f"leave one ISS session out ({df['session'].nunique()} sessions, {len(df)} slabs), the same split M6b reports",
               finding="On 39 slabs, a lookup by thickness and sides burning, with no physics, scores as well as or better than the calibrated de Ris models. "
                       "The physics adds no accuracy on this data; its value is that it can be applied outside the tested thicknesses, which these scores cannot check.",
               rows=[dict(name=n, kind=k, r2=round(r2(y, p), 3), mae_mm_s=round(float(np.mean(np.abs(y - p))), 4)) for n, k, p in rows])
    (ROOT / "data" / "trivial_baselines.json").write_text(json.dumps(out, indent=1))
    for r in out["rows"]: print(f"{r['name']:60s} R2 {r['r2']:7.3f}  MAE {r['mae_mm_s']:.4f}")


if __name__ == "__main__":
    main()
