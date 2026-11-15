#!/usr/bin/env python3
"""M5 smoke miss risk: will a light-scattering smoke detector see this smoke?

    python models/m5-smoke-miss/build.py     # writes data/smoke_sizes.json, data/models.json (M5 entry), models/m5-smoke-miss/results.json

Inputs (both in this folder, both from Urban et al. 2012, AIAA 2012-3536, NASA NTRS 20130000422):
  table1.json  Table 1: per-material sizes, unaged and aged 720 s (transcribed; checked against the PDF image)
  traced.csv   16 flight tests from Figures 6-8, read from the PDF's vector drawing by extract.py
Rules: RULES.md, committed before this script was run.
"""
import csv, json, math
from pathlib import Path
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, balanced_accuracy_score

HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[1]
D_DET = 0.5                      # um, headline detector-size limit (RULES.md); 0.3 and 1.0 reported as sensitivity
SEED = 42
MATS = ["Kapton", "Lampwick", "Teflon"]          # materials with per-test data (Figures 6-8)


def mmd(cmd, dam):
    """Mass median diameter of a lognormal from its count mean and average-mass diameters (Hatch-Choate):
    ln^2 sigma_g = ln(DAM/CMD), MMD = Dg exp(3 ln^2 sigma_g) = CMD (DAM/CMD)^2.5."""
    return cmd * (dam / cmd) ** 2.5


def mass_below(d, dg, sg):
    """Share of smoke mass in particles smaller than d (lognormal, mass median = Dg exp(3 ln^2 sg))."""
    s = math.log(sg); m = dg * math.exp(3 * s * s)
    return 0.5 * (1 + math.erf((math.log(d) - math.log(m)) / (s * math.sqrt(2))))


def features(rows):
    return np.array([[1.0 if r["material"] == m else 0.0 for m in MATS] + [max(0.0, r["v"])] for r in rows])


def logo(rows, y):
    """Leave-one-group-out: each traced test is its own group (Figures 6-8 show unaged smoke only, one point per test)."""
    X = features(rows); p = np.zeros(len(rows))
    for i in range(len(rows)):
        tr = np.arange(len(rows)) != i
        if len(set(y[tr])) < 2: p[i] = y[tr].mean(); continue
        m = LogisticRegression(C=1.0, class_weight="balanced", max_iter=2000).fit(X[tr], y[tr]); p[i] = m.predict_proba(X[i:i + 1])[0, 1]
    return p


def logo_ranges(rows, y, n=500):
    """Added 15 Nov 2026 (audit): a 95% range for each held-out prediction, from refits on bootstrap resamples of the other 15 tests."""
    X = features(rows); lo, hi = np.zeros(len(rows)), np.zeros(len(rows)); rng = np.random.default_rng(SEED)
    for i in range(len(rows)):
        tr = np.flatnonzero(np.arange(len(rows)) != i); ps = []
        for _ in range(n):
            idx = rng.choice(tr, len(tr), replace=True)
            if len(set(y[idx])) < 2: continue
            ps.append(LogisticRegression(C=1.0, class_weight="balanced", max_iter=2000).fit(X[idx], y[idx]).predict_proba(X[i:i + 1])[0, 1])
        lo[i], hi[i] = np.percentile(ps, 2.5), np.percentile(ps, 97.5)
    return lo, hi


def logo_material_only(rows, y):
    """Added 15 Nov 2026 (audit): material-only logistic baseline, leave one test out, so the baseline never sees the held-out test."""
    X = features(rows)[:, :3]; p = np.zeros(len(rows))
    for i in range(len(rows)):
        tr = np.arange(len(rows)) != i
        p[i] = LogisticRegression(C=1.0, class_weight="balanced", max_iter=2000).fit(X[tr], y[tr]).predict_proba(X[i:i + 1])[0, 1]
    return p


def boot(y, p, fn, n=2000):
    rng = np.random.default_rng(SEED); out = []
    for _ in range(n):
        idx = rng.integers(0, len(y), len(y))
        if len(set(y[idx])) < 2: continue
        out.append(fn(y[idx], p[idx]))
    return [round(float(np.percentile(out, 2.5)), 3), round(float(np.percentile(out, 97.5)), 3)]


def main():
    T1 = json.loads((HERE / "table1.json").read_text())
    rows = [dict(test=r["test"], material=r["material"], v=float(r["air_velocity_cm_s"]), CMD=float(r["CMD_um"]), DAM=float(r["DAM_um"]),
                 Dg=float(r["Dg_um"]), sg=float(r["sigma_g"])) for r in csv.DictReader(open(HERE / "traced.csv"))]
    for r in rows: r["MMD"] = mmd(r["CMD"], r["DAM"])
    checks = []
    def add(id, what, result, ok): checks.append(dict(id=id, what=what, result=result, ok=ok)); print(("PASS " if ok else "FAIL " if ok is False else "---- ") + id, what, "->", result)

    # ---- M5-lognormal: Table 1's own moment diameters from its Dg and sigma_g ----
    errs = []
    for r in T1["rows"]:
        s = math.log(r["sigma_g"]); errs.append((r["material"] + (" aged" if r["aged"] else " unaged"), r["Dg"] * math.exp(s * s / 2) / r["CMD"] - 1, r["Dg"] * math.exp(1.5 * s * s) / r["DAM"] - 1))
    worst = max(errs, key=lambda e: max(abs(e[1]), abs(e[2])))
    n_ok = sum(max(abs(a), abs(b)) <= 0.10 for _, a, b in errs)
    add("M5-lognormal", "Table 1's count mean and average-mass diameters reproduced from its Dg and sigma_g (limit: every one within 10%)",
        f"{n_ok} of 10 rows within 10% (9 within 1%); worst: {worst[0]}, {worst[1]:+.1%} and {worst[2]:+.1%}", n_ok == 10)
    tc = json.loads((HERE / "trace_check.json").read_text())
    cal = max(v2["max_err_frac"] for v in tc.values() for v2 in v["axis_calibration"].values())
    pair = max(max(v["pairing_error_Dg_median"], v["pairing_error_sigma_median"]) for v in tc.values())
    add("M5-trace", "Extraction error: tick labels vs fitted axes, and each test's Dg and sigma_g rebuilt from its own moments (limit: under 3% of the axis range)",
        f"axis fit worst {cal:.3%} of range; Dg/sigma_g rebuilt within {pair:.2%} (median); read from the PDF's vector drawing, not traced by hand", cal < 0.03)
    k8 = [r for r in rows if r["material"] == "Kapton" and r["v"] > 8.05]          # the four tests drawn at the same 8 cm/s position
    t1k = next(r for r in T1["rows"] if r["material"] == "Kapton" and not r["aged"])
    xcheck = f"Kapton, the {len(k8)} tests drawn at the same 8 cm/s position: mean CMD {np.mean([r['CMD'] for r in k8]):.3f} vs Table 1 {t1k['CMD']}; mean DAM {np.mean([r['DAM'] for r in k8]):.3f} vs {t1k['DAM']} um"

    # ---- labels, model, baselines ----
    def run(d_det):
        y = np.array([1 if r["MMD"] < d_det else 0 for r in rows])        # 1 = likely missed
        p = logo(rows, y)
        t1 = {r["material"]: r for r in T1["rows"] if not r["aged"]}
        base_mat = np.array([1.0 if mass_below(d_det, t1[r["material"]]["Dg"], t1[r["material"]]["sigma_g"]) > 0.5 else 0.0 for r in rows])
        auc = roc_auc_score(y, p) if len(set(y)) > 1 else None
        bacc = balanced_accuracy_score(y, (p >= 0.5).astype(int)) if len(set(y)) > 1 else None
        b_bacc = balanced_accuracy_score(y, base_mat.astype(int)) if len(set(y)) > 1 else None
        return y, p, base_mat, auc, bacc, b_bacc
    y, p, base, auc, bacc, b_bacc = run(D_DET)
    auc_r = boot(y, p, roc_auc_score); bacc_r = boot(y, p, lambda a, b: balanced_accuracy_score(a, (b >= 0.5).astype(int)))
    print(f"labels at {D_DET*1000:.0f} nm: {int(y.sum())} missed / {len(y) - int(y.sum())} seen")
    add("M5-auc", "Logistic model, leave-one-test-out (limit: AUC >= 0.75)", f"AUC {auc:.3f} [{auc_r[0]:.2f}, {auc_r[1]:.2f}] on {len(y)} flight tests", bool(auc >= 0.75))
    add("M5-bacc", "Balanced accuracy at 0.5 (limit: >= 0.70 and not below the material-only baseline)",
        f"{bacc:.3f} [{bacc_r[0]:.2f}, {bacc_r[1]:.2f}]; material-only baseline {b_bacc:.3f}; majority class 0.50", bool(bacc >= 0.70 and bacc >= b_bacc))
    add("M5-base", "Baselines beside the score", f"majority class: AUC 0.50, balanced accuracy 0.50; material-only (Table 1): balanced accuracy {b_bacc:.2f}", None)
    # drivers: permutation importance on the leave-one-out AUC, feature groups permuted together
    rng = np.random.default_rng(SEED); X = features(rows); drops = {"material": [], "air velocity": []}
    full = LogisticRegression(C=1.0, class_weight="balanced", max_iter=2000).fit(X, y)
    base_auc = roc_auc_score(y, full.predict_proba(X)[:, 1])
    for _ in range(500):
        for name, cols in (("material", [0, 1, 2]), ("air velocity", [3])):
            Xp = X.copy(); Xp[:, cols] = X[rng.permutation(len(X))][:, cols]
            drops[name].append(base_auc - roc_auc_score(y, full.predict_proba(Xp)[:, 1]))
    imp = {k: max(0.0, float(np.mean(v))) for k, v in drops.items()}; tot = sum(imp.values()) or 1.0
    drivers = [dict(name=k, share=round(v / tot, 2)) for k, v in sorted(imp.items(), key=lambda kv: -kv[1])]
    add("M5-drivers", "Permutation importance (AUC drop when an input is shuffled)", ", ".join(f"{d['name']} {d['share']:.0%}" for d in drivers), None)
    coef = dict(zip(MATS + ["air velocity (per cm/s)"], [round(float(c), 3) for c in full.coef_[0]]))
    sens = {}
    for dd in (0.3, 1.0):
        ys, ps, bs, a, b, bb = run(dd)
        sens[f"{int(dd*1000)} nm"] = dict(note=None if min(ys.sum(), len(ys) - ys.sum()) >= 3 else "fewer than 3 cases in one class: scores not meaningful", missed=int(ys.sum()), seen=int(len(ys) - ys.sum()), auc=None if a is None else round(float(a), 2), balanced_accuracy=None if b is None else round(float(b), 2), material_baseline=None if bb is None else round(float(bb), 2))
    add("M5-sens", "Same model at a 300 nm and a 1000 nm detector limit", json.dumps(sens), None)

    # ---- outputs ----
    mats = []
    for r in T1["rows"]:
        if r["aged"]: continue
        a = next(q for q in T1["rows"] if q["material"] == r["material"] and q["aged"])
        mats.append(dict(name=r["material"], d_nm=round(r["Dg"] * math.exp(3 * math.log(r["sigma_g"]) ** 2) * 1000),
                         d_kind="mass median diameter, unaged (Table 1 Dg and sigma_g, lognormal)",
                         d_aged_nm=round(a["Dg"] * math.exp(3 * math.log(a["sigma_g"]) ** 2) * 1000), Dg_nm=round(r["Dg"] * 1000), sigma_g=r["sigma_g"],
                         mass_below={str(int(d * 1000)): dict(unaged=round(mass_below(d, r["Dg"], r["sigma_g"]), 3), aged=round(mass_below(d, a["Dg"], a["sigma_g"]), 3)) for d in (0.3, 0.5, 1.0)}))
    mats.sort(key=lambda m: m["d_nm"])
    sizes = dict(status="reported", source=T1["source"], source_url=T1["url"],
                 note="Sizes are NASA's (SAME-2 flight, baseline runs at 8 cm/s). Mass shares below each detector limit are our lognormal calculation from them. "
                      "Sources disagree on where light-scattering detectors lose sensitivity, so the limit is a control (300, 500, 1000 nm), not a fixed fact.",
                 detector_thresholds_nm=[300, 500, 1000], materials=mats, units=dict(d_nm="nm", mass_below="share of smoke mass in smaller particles"))
    plo, phi = logo_ranges(rows, y)
    pm = logo_material_only(rows, y); m_auc = float(roc_auc_score(y, pm))
    add("M5-base2", "Material-only logistic baseline, leave one test out (added 15 Nov 2026 after an audit; not a pass rule)", f"AUC {m_auc:.3f}", None)
    pts = [dict(obs=int(y[i]), pred=round(float(p[i]), 3), x=round(max(0, r["v"]), 1), lo=round(float(plo[i]), 3), hi=round(float(phi[i]), 3), label=f"{r['test']}: {r['material']}, {max(0, r['v']):.0f} cm/s, mass median {r['MMD']*1000:.0f} nm") for i, r in enumerate(rows)]
    entry = dict(id="smoke-miss", status="model", name="Will the detector miss this smoke?", question="Is most of this smoke's mass in particles too small for a light-scattering detector (under 500 nm)?",
                 data="16 SAME-2 flight tests (Kapton, lampwick, Teflon) from Urban et al. 2012, AIAA 2012-3536, Figures 6-8, read from the PDF's vector drawing; Table 1 for the baseline",
                 method="Logistic regression on material and air velocity; label from the lognormal mass median diameter (Hatch-Choate, from each test's count-mean and average-mass diameters)",
                 validation="leave one flight test out (16 folds); ranges from 2,000 bootstrap resamples", metric="AUC", score=round(float(auc), 3), score_range=auc_r, kind="classifier",
                 baseline_name="Material only (logistic, leave one test out)", baseline_score=round(m_auc, 3), baseline_metric_note=f"material-only AUC {m_auc:.2f} (the earlier Table 1 rule, balanced accuracy {b_bacc:.2f}, used 4 of the held-out tests); model balanced accuracy {bacc:.2f} [{bacc_r[0]:.2f}, {bacc_r[1]:.2f}]",
                 unit="1 = likely missed", points=pts, drivers=drivers, coefficients=coef,
                 limits="16 tests, 3 materials, unaged smoke only, airflow 0 to 8 cm/s. A test bench result in orbit, not a detector certification. Detector limit is a choice (300/500/1000 nm reported).")
    entry["checks_note"] = "; ".join(f"{c['id']} {'pass' if c['ok'] else 'FAIL' if c['ok'] is False else 'reported'}" for c in checks) + ". Rules in models/m5-smoke-miss/RULES.md, written before training."
    mp = ROOT / "data" / "models.json"
    models = json.loads(mp.read_text()) if mp.exists() else dict(status="model", models=[])
    if models.get("status") == "missing": models = dict(status="model", models=[])
    models["models"] = [m for m in models.get("models", []) if m.get("id") != "smoke-miss"] + [entry]; models["status"] = "model"
    mp.write_text(json.dumps(models, indent=1))
    (ROOT / "data" / "smoke_sizes.json").write_text(json.dumps(sizes, indent=1))
    ev = json.loads((ROOT / "data" / "evidence.json").read_text())
    ev["checks"] = [c for c in ev["checks"] if not c["id"].startswith("M5-")]
    for c in checks:
        if c["ok"] is None: continue
        ev["checks"].append(dict(id=c["id"], what="Smoke miss risk: " + c["what"], ref="Urban et al. 2012 (AIAA 2012-3536), models/m5-smoke-miss/build.py", limit="see RULES.md",
                                 owner="Karthikeya", result=("Pass: " if c["ok"] else "Fail: ") + c["result"], state="pass" if c["ok"] else "fail"))
    (ROOT / "data" / "evidence.json").write_text(json.dumps(ev, indent=1))
    (HERE / "results.json").write_text(json.dumps(dict(labels_500nm={r["test"]: int(y[i]) for i, r in enumerate(rows)}, mmd_um={r["test"]: round(r["MMD"], 4) for r in rows},
        loo_prob={r["test"]: round(float(p[i]), 3) for i, r in enumerate(rows)}, material_baseline={r["test"]: int(base[i]) for i, r in enumerate(rows)},
        table1_crosscheck=xcheck, sensitivity=sens, coefficients=coef, drivers=drivers, checks=checks), indent=1))
    print(xcheck); print("coefficients", coef)
    for r, pi, yi, bi in zip(rows, p, y, base): print(f"  {r['test']:6s} {r['material']:9s} v={max(0, r['v']):4.1f}  MMD {r['MMD']*1000:5.0f} nm  missed={yi}  p={pi:.2f}  material-baseline={int(bi)}")


if __name__ == "__main__":
    main()
