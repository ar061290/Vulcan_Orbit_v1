"""R1: will a droplet flame go out? (NASA FLEX, PSI-69)."""
from collections import Counter
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.metrics import roc_auc_score

from . import cv, load
from . import estimators as E

NAMES = {"x_o2": "Oxygen", "x_co2": "CO2", "x_he": "Helium", "p_atm": "Pressure",
         "d0_mm": "Initial droplet size", "heptane": "Fuel"}


def candidates():
    c = {f"LR raw+fuel interactions (C={C:g})": E.Logit("flex_interact", C) for C in (0.1, 1, 10)}
    c.update({f"LR physics features (C={C:g})": E.Logit("flex_physics", C) for C in (0.1, 1, 10)})
    c["Gaussian-process classifier"] = E.GPClassifier()
    return c


def nested():
    return E.Selector(candidates(), "clf")


def _label(r):
    return (f"{r.test_id}: {r.fuel}, O2 {r.x_o2:.2f}, CO2 {r.x_co2:.2f}, He {r.x_he:.2f}, "
            f"{r.p_atm:.2f} atm, d0 {r.d0_mm:.2f} mm, NASA: {r.test_end}")


def _summ(res, y, g):
    return {"auc_median": res.score, "auc_repeat_range": [float(np.percentile(res.per_repeat, 2.5)),
                                                           float(np.percentile(res.per_repeat, 97.5))],
            "auc_session_bootstrap_95": cv.session_bootstrap(res, y, g)}


def _o2_at_half(model, fuel, p_atm, d0, co2, he):
    """Smallest-to-largest O2 scan; returns the O2 fraction where P(extinction) crosses 0.5, or None."""
    o2 = np.round(np.arange(0.12, 0.3401, 0.0025), 4)
    X = pd.DataFrame({"x_o2": o2, "x_co2": co2, "x_he": he, "p_atm": p_atm, "d0_mm": d0,
                      "heptane": 1 if fuel == "heptane" else 0})
    p = E.predict(model, X)
    s = np.sign(p - 0.5)
    idx = np.flatnonzero(np.diff(s) != 0)
    if len(idx) == 0:
        return None, float(p[0]), float(p[-1])
    i = idx[0]
    x = o2[i] + (0.5 - p[i]) * (o2[i + 1] - o2[i]) / (p[i + 1] - p[i])
    return float(x), float(p[0]), float(p[-1])


def run(log, n_repeats):
    flex = load.load_flex()
    f = load.flex_model_frame(flex)
    y, g = f["extinguished"].to_numpy(), f["session"].to_numpy()
    out = {"rows": len(f), "positives": int(y.sum()), "sessions": int(f.session.nunique()),
           "atmospheres": int(f.atmosphere.nunique())}
    log(f"R1 extinction: {len(f)} burns, {y.sum()} extinguished / {len(y) - y.sum()} not, "
        f"{out['sessions']} sessions, {out['atmospheres']} atmospheres")

    log("   headline: nested selection (LR raw / LR physics / GP classifier) ...")
    head = cv.cross_val(nested, f, y, g, y, "clf", n_repeats, importance_inputs=E.FLEX_INPUTS, log=log)
    out["headline"] = _summ(head, y, g)
    out["chosen_counts"] = dict(Counter(head.chosen))
    single = cv.cross_val(lambda: E.SingleVariable(tuple(E.FLEX_INPUTS)), f, y, g, y, "clf", n_repeats)
    majority = cv.cross_val(lambda: E.Majority(), f, y, g, y, "clf", n_repeats)
    out["baseline_single"] = _summ(single, y, g)
    out["baseline_majority_auc"] = majority.score
    # Which input the single-variable rule picks on all rows (for the label only).
    out["single_variable_on_all_rows"] = E.SingleVariable(tuple(E.FLEX_INPUTS)).fit(f, y).col_
    fixed = {"LR raw+fuel interactions (C=1)": E.Logit("flex_interact", 1.0),
             "LR physics features (C=1)": E.Logit("flex_physics", 1.0),
             "Gaussian-process classifier": E.GPClassifier()}
    out["candidates_fixed"] = {k: _summ(cv.candidate_cv(v, f, y, g, y, "clf", n_repeats), y, g) for k, v in fixed.items()}
    # Calibration.
    p_med = head.pred_median()
    out["brier_model"] = float(np.median([cv.brier(y, head.oof[r]) for r in range(n_repeats)]))
    out["brier_no_skill"] = float(np.median([cv.brier(y, majority.oof[r]) for r in range(n_repeats)]))
    log(f"   AUC {out['headline']['auc_median']:.3f} (95% session bootstrap {out['headline']['auc_session_bootstrap_95'][0]:.3f}"
        f"-{out['headline']['auc_session_bootstrap_95'][1]:.3f}); single-variable rule {out['baseline_single']['auc_median']:.3f}; "
        f"majority {out['baseline_majority_auc']:.3f}")
    log(f"   picked per outer fold: {out['chosen_counts']}")
    for k, v in out["candidates_fixed"].items():
        log(f"   {k}: AUC {v['auc_median']:.3f} ({v['auc_session_bootstrap_95'][0]:.3f}-{v['auc_session_bootstrap_95'][1]:.3f})")
    log(f"   Brier {out['brier_model']:.3f} vs no-skill {out['brier_no_skill']:.3f}")

    # Sensitivity analyses and the stricter split (same nested procedure).
    m1 = (f["test_end"] != "Disruption").to_numpy()
    f1 = f[m1].reset_index(drop=True); y1 = f1["extinguished"].to_numpy(); g1 = f1["session"].to_numpy()
    out["S1_drop_disruption"] = {"rows": len(f1), **_summ(cv.cross_val(nested, f1, y1, g1, y1, "clf", n_repeats), y1, g1)}
    f2 = f[f["dext_mm"].notna()].reset_index(drop=True)
    y2 = (f2["dext_mm"] > 0).astype(int).to_numpy(); g2 = f2["session"].to_numpy()
    out["S2_label_dext_gt0"] = {"rows": len(f2), "positives": int(y2.sum()),
                                **_summ(cv.cross_val(nested, f2, y2, g2, y2, "clf", n_repeats), y2, g2)}
    ga = f["atmosphere"].to_numpy()
    out["atmosphere_held_out"] = _summ(cv.cross_val(nested, f, y, ga, y, "clf", n_repeats), y, ga)
    for k in ("S1_drop_disruption", "S2_label_dext_gt0", "atmosphere_held_out"):
        v = out[k]
        log(f"   {k}: AUC {v['auc_median']:.3f} ({v['auc_session_bootstrap_95'][0]:.3f}-{v['auc_session_bootstrap_95'][1]:.3f})")

    # Leakage checks: overlap is asserted on every fold above; the rest always printed here.
    out["single_input_auc"] = {NAMES[c]: float(max(roc_auc_score(y, f[c]), 1 - roc_auc_score(y, f[c]))) for c in E.FLEX_INPUTS}
    out["inputs"] = [NAMES[c] for c in E.FLEX_INPUTS]
    out["excluded_columns"] = ["Visible flame extinction diameter", "Burning rate", "Burn time", "Test end",
                               "FLEX Identifier", "Test Date", "Test GMT"]
    # Always-run sanity check (cheap): shuffled labels through the same grouped splits should give AUC ~0.5.
    perm_fast = [cv.cross_val(lambda: E.Logit("flex_physics", 1.0), f, yp, g, yp, "clf", 1).score
                 for yp in (np.random.default_rng(900 + s).permutation(y) for s in range(20))]
    out["label_permutation_fast"] = {"model": "LR physics features (C=1), repeat-0 split, 20 shuffles",
                                     "auc_mean": float(np.mean(perm_fast)), "auc_max": float(np.max(perm_fast))}
    log(f"   label-permutation check: mean AUC {np.mean(perm_fast):.3f}, max {np.max(perm_fast):.3f} (should be ~0.5)")
    out["leakage_triggered"] = bool(out["headline"]["auc_median"] > 0.95)
    if out["leakage_triggered"]:
        perm = []
        for s in range(20):
            yp = np.random.default_rng(500 + s).permutation(y)
            perm.append(cv.cross_val(nested, f, yp, g, yp, "clf", 1).score)
        out["label_permutation_auc_mean"] = float(np.mean(perm))
    log(f"   single-input AUCs: { {k: round(v, 3) for k, v in out['single_input_auc'].items()} }; "
        f"leakage trigger (AUC>0.95): {out['leakage_triggered']}")

    # Pass rule R1.
    lo = out["headline"]["auc_session_bootstrap_95"][0]
    out["pass"] = bool(out["headline"]["auc_median"] >= 0.80 and lo > out["baseline_single"]["auc_median"])
    log(f"   PASS R1: {out['pass']} (median >= 0.80: {out['headline']['auc_median'] >= 0.80}; "
        f"range low {lo:.3f} > single-variable {out['baseline_single']['auc_median']:.3f}: {lo > out['baseline_single']['auc_median']})")

    # Final model on all rows: the O2 level where the chance of extinction crosses 0.5 (model numbers, REPORT only).
    final = nested().fit(f, y, g, y, seed=0)
    out["final_model"] = final.chosen_
    out["_final"] = final  # not written to results.json (build.py drops keys starting with "_")
    scenarios = [(fuel, p_atm, name, co2, he) for fuel in ("methanol", "heptane") for p_atm in (0.7, 1.0)
                 for name, co2, he in (("no added gas", 0.0, 0.0), ("20% CO2", 0.2, 0.0), ("20% He", 0.0, 0.2))]
    # Range: refit the chosen model type on 200 session-bootstrap resamples and repeat the scan.
    proto = candidates()[final.chosen_]
    sess = {s: np.flatnonzero(g == s) for s in pd.unique(g)}
    keys = list(sess)
    rng = np.random.default_rng(4242)
    boots = []
    while len(boots) < 200:
        rows = np.concatenate([sess[keys[i]] for i in rng.choice(len(keys), len(keys), replace=True)])
        if len(np.unique(y[rows])) < 2:
            continue
        m = clone(proto).fit(f.iloc[rows].reset_index(drop=True), y[rows])
        boots.append([_o2_at_half(m, fu, pa, 3.0, co, he)[0] for fu, pa, _, co, he in scenarios])
    o2_table = []
    for k, (fuel, p_atm, name, co2, he) in enumerate(scenarios):
        x, p_lo, p_hi = _o2_at_half(final, fuel, p_atm, 3.0, co2, he)
        bv = [b[k] for b in boots if b[k] is not None]
        o2_table.append({"fuel": fuel, "p_atm": p_atm, "added_gas": name, "d0_mm": 3.0, "o2_at_p_half": x,
                         "o2_at_p_half_95": [float(np.percentile(bv, 2.5)), float(np.percentile(bv, 97.5))] if bv else None,
                         "bootstrap_fits_without_crossing": 200 - len(bv),
                         "p_ext_at_o2_0.12": p_lo, "p_ext_at_o2_0.34": p_hi})
    out["o2_at_half_table"] = o2_table
    log(f"   final model on all rows: {final.chosen_}")
    for t in o2_table:
        r95 = t["o2_at_p_half_95"]
        log(f"     {t['fuel']:<8} {t['p_atm']} atm {t['added_gas']:<12}: P(ext)=0.5 at O2 "
            f"{t['o2_at_p_half'] if t['o2_at_p_half'] is None else round(100 * t['o2_at_p_half'], 1)}% "
            f"(95% {r95 and [round(100 * v, 1) for v in r95]})")

    pts = []
    lo_q, hi_q = np.percentile(head.oof, 2.5, axis=0), np.percentile(head.oof, 97.5, axis=0)
    for i, r in f.iterrows():
        pts.append({"obs": int(y[i]), "pred": round(float(p_med[i]), 4), "lo": round(float(lo_q[i]), 4),
                    "hi": round(float(hi_q[i]), 4), "label": _label(r)})
    shares = cv.shares(head.importance, NAMES)
    out["drivers"] = shares
    out["importance_raw"] = {NAMES[k]: v for k, v in head.importance.items()}
    log(f"   drivers: {[(d['name'], round(d['share'], 3)) for d in shares]}")

    picked = ", ".join(f"{k} {v / len(head.chosen):.0%}" for k, v in Counter(head.chosen).most_common())
    entry = {
        "id": "m7-extinction",
        "name": "Droplet flame goes out (FLEX)",
        "question": "Will a burning fuel droplet's flame go out on its own before the fuel is used up?",
        "data": (f"NASA FLEX, PSI-69 (doi:10.60555/mbq8-0451): {len(f)} methanol and n-heptane droplet burns on the ISS, "
                 f"{f.p_atm.min():.2f}-{f.p_atm.max():.2f} atm, {f.x_o2.min():.0%}-{f.x_o2.max():.0%} O2, up to "
                 f"{f.x_co2.max():.0%} CO2 or {f.x_he.max():.0%} He added, initial diameter {f.d0_mm.min():.1f}-{f.d0_mm.max():.1f} mm. "
                 "Outcome: NASA's 'Test end' = Extinction (vs Disruption or Completion)."),
        "method": ("Model chosen inside every training split from: logistic regression on the raw inputs with fuel "
                   "interactions; logistic regression on physics features (inert heat capacity per O2, O2 partial "
                   "pressure, gas conductivity); Gaussian-process classifier. Picked: " + picked + "."),
        "validation": (f"Whole test sessions held out: 5-fold grouped by ISS test date ({out['sessions']} dates), "
                       f"repeated {n_repeats} times. Score = median AUC; range = 95% session bootstrap."),
        "metric": "AUC",
        "score": round(out["headline"]["auc_median"], 4),
        "score_range": [round(v, 4) for v in out["headline"]["auc_session_bootstrap_95"]],
        "baseline_name": f"Best single input ({NAMES[out['single_variable_on_all_rows']].lower()})",
        "baseline_score": round(out["baseline_single"]["auc_median"], 4),
        "unit": "chance of extinction (0-1)",
        "points": pts,
        "drivers": [{"name": d["name"], "share": round(d["share"], 4)} for d in shares],
        "limits": (f"Microgravity droplets only (two fuels, {f.d0_mm.min():.1f}-{f.d0_mm.max():.1f} mm). NASA does not define 'Test end' publicly; "
                   "with Disruption burns dropped the AUC is "
                   f"{out['S1_drop_disruption']['auc_median']:.2f}, and with whole atmospheres held out it is "
                   f"{out['atmosphere_held_out']['auc_median']:.2f}. The FLEX plan aimed at near-limit conditions, so "
                   "the chance shown is for those conditions, not for cabin fires in general. A low chance of "
                   "extinction does not make an atmosphere safe, and nothing here applies to Moon or Mars gravity."),
    }
    return entry, out
