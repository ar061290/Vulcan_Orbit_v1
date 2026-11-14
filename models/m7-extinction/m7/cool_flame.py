"""R3: after the visible flame goes out, does the droplet keep burning until the fuel is gone? (NASA CFI, PSI-39)
plus the observed cool-flame cases in CFI and CFI-G (PSI-159)."""
from collections import Counter
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

from . import cv, load
from . import estimators as E

NAMES = {"p_atm": "Pressure", "x_o2": "Oxygen", "x_he": "Helium", "d0_mm": "Initial droplet size",
         "dodecane_frac": "Fuel blend (n-dodecane share)", "fiber": "Support fibre"}

CFIG_REPORT_QUOTE = ("A total of 280 hot diffusion flames were observed. Among them, 189 flames experienced radiative "
                     "extinction ... Of those that extinguished radiatively, 15 subsequently reignited as cool diffusion "
                     "flames. These cool flames were observed only with the following conditions: a) concentrations of "
                     "30 vol% n-butane and 40 vol% O2, b) normal flames, c) a pressure of 2.03 bar, and d) mass flow rates "
                     "between 0.75 - 1.5 mg/s.")


def candidates():
    return {f"LR (C={C:g})": E.Logit("cfi_raw", C) for C in (0.1, 1, 10)}


def nested():
    return E.Selector(candidates(), "clf")


def _summ(res, y, g):
    return {"auc_median": res.score, "auc_repeat_range": [float(np.percentile(res.per_repeat, 2.5)),
                                                           float(np.percentile(res.per_repeat, 97.5))],
            "auc_session_bootstrap_95": cv.session_bootstrap(res, y, g)}


def _fuel_name(frac):
    return "n-dodecane" if frac == 1.0 else f"{frac:.0%}/{1 - frac:.0%} n-dodecane/iso-dodecane"


def describe(cfi, cf):
    """Observed cases, no model."""
    a = cfi[cfi["analysed"] & cfi["d0_mm"].notna()]
    desc = {
        "analysed_burns": int(len(a)),
        "kcool_recorded": int(a["k_cool_mm2_s"].notna().sum()),
        "d0_range_mm": [float(a["d0_mm"].min()), float(a["d0_mm"].max())],
        "dext_hot_range_mm": [float(a["dext_hot_mm"].min()), float(a["dext_hot_mm"].max())],
        "k_cool_range": [float(a["k_cool_mm2_s"].min()), float(a["k_cool_mm2_s"].max())],
        "conditions": {"p_atm": sorted(map(float, a["p_atm"].unique())), "x_o2": sorted(map(float, a["x_o2"].unique())),
                       "x_he": sorted(map(float, a["x_he"].unique())),
                       "fuels": sorted({_fuel_name(v) for v in a["dodecane_frac"].dropna().unique()})},
    }
    by = []
    for keys, grp in cf.groupby(["p_atm", "x_he"]):
        left = grp[grp["dext_cool_mm"] > 0]["dext_cool_mm"]
        by.append({"p_atm": float(keys[0]), "x_he": float(keys[1]), "burns": int(len(grp)),
                   "used_up": int(grp["consumed"].sum()),
                   "median_cool_ext_diameter_mm_when_left": float(left.median()) if len(left) else None,
                   "median_k_cool": float(grp["k_cool_mm2_s"].median()) if grp["k_cool_mm2_s"].notna().any() else None})
    desc["end_state_by_pressure_and_helium"] = by
    desc["end_state_by_fuel"] = [{"fuel": _fuel_name(k), "burns": int(len(v)), "used_up": int(v["consumed"].sum())}
                                 for k, v in cf.groupby("dodecane_frac")]
    return desc


def describe_cfig():
    g = load.load_cfig_normal()
    filled = g[g["cool_flame"] != ""]
    yes = filled[filled["cool_flame"].str.lower().str.startswith("yes")]
    return {
        "rows": int(len(g)), "cool_flame_column_filled": int(len(filled)), "cool_flame_yes": int(len(yes)),
        "yes_conditions": {"fuel": sorted(yes["fuel"].unique()), "p_bar": sorted(map(float, yes["p_bar"].unique())),
                           "x_o2_before": [float(yes["x_o2_before"].min()), float(yes["x_o2_before"].max())],
                           "fuel_flow_mg_s": sorted(map(float, yes["m_fuel_mg_s"].unique())),
                           "tests": list(yes["test"])},
        "report_quote": CFIG_REPORT_QUOTE,
    }


def run(log, n_repeats):
    cfi = load.load_cfi()
    cf = load.cfi_cool_frame(cfi)
    y, g = cf["consumed"].to_numpy(), cf["session"].to_numpy()
    n_pos_sess, n_neg_sess = cf[cf.consumed == 1].session.nunique(), cf[cf.consumed == 0].session.nunique()
    fit_ok = (y.sum() >= 10 and (len(y) - y.sum()) >= 10 and n_pos_sess >= 3 and n_neg_sess >= 3)
    out = {"rows": len(cf), "used_up": int(y.sum()), "left_fuel": int(len(y) - y.sum()), "sessions": int(cf.session.nunique()),
           "sessions_used_up": int(n_pos_sess), "sessions_left_fuel": int(n_neg_sess), "fit_condition_met": bool(fit_ok)}
    log(f"R3 cool-flame end state: {len(cf)} CFI burns, {y.sum()} used up / {len(y) - y.sum()} left fuel, "
        f"{out['sessions']} sessions; fit condition met: {fit_ok}")
    out["observed"] = describe(cfi, cf)
    out["cfig"] = describe_cfig()
    log(f"   observed: kcool recorded in {out['observed']['kcool_recorded']} of {out['observed']['analysed_burns']} analysed "
        f"CFI burns; CFI-G cool flames recorded in {out['cfig']['cool_flame_yes']} rows, all {out['cfig']['yes_conditions']['fuel']} "
        f"at {out['cfig']['yes_conditions']['p_bar']} bar")
    for b in out["observed"]["end_state_by_pressure_and_helium"]:
        log(f"     {b['p_atm']:>4} atm, He {b['x_he']:.2f}: {b['used_up']}/{b['burns']} used up; median cool-flame "
            f"extinction diameter when fuel left {b['median_cool_ext_diameter_mm_when_left']}")
    if not fit_ok:
        out["pass"] = None
        return None, out

    head = cv.cross_val(nested, cf, y, g, y, "clf", n_repeats, importance_inputs=E.CFI_INPUTS, log=log)
    single = cv.cross_val(lambda: E.SingleVariable(tuple(E.CFI_INPUTS)), cf, y, g, y, "clf", n_repeats)
    out["headline"] = _summ(head, y, g)
    out["chosen_counts"] = dict(Counter(head.chosen))
    out["baseline_single"] = _summ(single, y, g)
    out["baseline_majority_auc"] = 0.5
    out["single_variable_on_all_rows"] = E.SingleVariable(tuple(E.CFI_INPUTS)).fit(cf, y).col_
    m3 = (cf["extrap_cf"] != 1).to_numpy()
    c3 = cf[m3].reset_index(drop=True); y3, g3 = c3["consumed"].to_numpy(), c3["session"].to_numpy()
    out["S3_drop_extrapolated"] = {"rows": len(c3), **_summ(cv.cross_val(nested, c3, y3, g3, y3, "clf", n_repeats), y3, g3)}
    log(f"   AUC {out['headline']['auc_median']:.3f} ({out['headline']['auc_session_bootstrap_95'][0]:.3f}-"
        f"{out['headline']['auc_session_bootstrap_95'][1]:.3f}); single-variable rule ({out['single_variable_on_all_rows']}) "
        f"{out['baseline_single']['auc_median']:.3f}; S3 {out['S3_drop_extrapolated']['auc_median']:.3f}")

    out["single_input_auc"] = {NAMES[c]: float(max(roc_auc_score(y, cf[c]), 1 - roc_auc_score(y, cf[c])))
                               for c in E.CFI_INPUTS if cf[c].nunique() > 1}
    out["inputs"] = [NAMES[c] for c in E.CFI_INPUTS]
    out["excluded_columns"] = ["Dext, hot", "khot", "kcool", "Dext,cool (defines the label)", "Reignitions", "Extrap CF?",
                               "HF Burn Time", "radiometer columns", "Actual D", "Comments"]
    perm_fast = [cv.cross_val(lambda: E.Logit("cfi_raw", 1.0), cf, yp, g, yp, "clf", 1).score
                 for yp in (np.random.default_rng(900 + s).permutation(y) for s in range(20))]
    out["label_permutation_fast"] = {"model": "LR (C=1), repeat-0 split, 20 shuffles",
                                     "auc_mean": float(np.mean(perm_fast)), "auc_max": float(np.max(perm_fast))}
    log(f"   label-permutation check: mean AUC {np.mean(perm_fast):.3f}, max {np.max(perm_fast):.3f} (should be ~0.5)")
    out["leakage_triggered"] = bool(out["headline"]["auc_median"] > 0.95)
    if out["leakage_triggered"]:
        perm = []
        for s in range(20):
            yp = np.random.default_rng(700 + s).permutation(y)
            perm.append(cv.cross_val(nested, cf, yp, g, yp, "clf", 1).score)
        out["label_permutation_auc_mean"] = float(np.mean(perm))
        log(f"   leakage checks: label-permutation mean AUC {out['label_permutation_auc_mean']:.3f}; "
            f"single-input AUCs { {k: round(v, 3) for k, v in out['single_input_auc'].items()} }")
    else:
        log(f"   single-input AUCs: { {k: round(v, 3) for k, v in out['single_input_auc'].items()} }")
    lo = out["headline"]["auc_session_bootstrap_95"][0]
    out["pass"] = bool(lo > 0.5)
    log(f"   PASS R3: {out['pass']} (range low {lo:.3f} > 0.5)")

    final = nested().fit(cf, y, g, y, seed=0)
    out["final_model"] = final.chosen_
    lr = final.best_
    out["final_standardised_coefficients"] = {NAMES[c]: float(v) for c, v in zip(E.CFI_INPUTS, lr.lr_.coef_[0])}
    # Pressure at which the chance of 'used up' crosses 0.5, for a 4.3 mm free n-dodecane droplet in air.
    ps = np.round(np.arange(0.5, 5.001, 0.01), 3)
    X = pd.DataFrame({"p_atm": ps, "x_o2": 0.21, "x_he": 0.0, "d0_mm": 4.3, "dodecane_frac": 1.0, "fiber": 0})
    pr = E.predict(final, X)
    cross = ps[np.flatnonzero(pr >= 0.5)]
    out["pressure_at_half_air_4.3mm_dodecane_free"] = float(cross[0]) if len(cross) else None
    log(f"   final model: {final.chosen_}; standardised coefficients "
        f"{ {k: round(v, 2) for k, v in out['final_standardised_coefficients'].items()} }; "
        f"P(used up) passes 0.5 at {out['pressure_at_half_air_4.3mm_dodecane_free']} atm (4.3 mm n-dodecane, air, free)")

    p_med = head.pred_median()
    lo_q, hi_q = np.percentile(head.oof, 2.5, axis=0), np.percentile(head.oof, 97.5, axis=0)
    pts = [{"obs": int(y[i]), "pred": round(float(p_med[i]), 4), "lo": round(float(lo_q[i]), 4), "hi": round(float(hi_q[i]), 4),
            "label": (f"{r.test_id}: {_fuel_name(r.dodecane_frac)}, {r.p_atm:g} atm, O2 {r.x_o2:.2f}, He {r.x_he:.2f}, "
                      f"d0 {r.d0_mm:.2f} mm, {'fibre' if r.fiber == 1 else 'free'}; visible flame out at {r.dext_hot_mm:.2f} mm, "
                      + ("droplet used up" if r.consumed == 1 else f"cool flame out at {r.dext_cool_mm:.2f} mm"))}
           for i, r in cf.iterrows()]
    shares = cv.shares(head.importance, NAMES)
    out["drivers"] = shares
    out["importance_raw"] = {NAMES[k]: v for k, v in head.importance.items()}
    log(f"   drivers: {[(d['name'], round(d['share'], 3)) for d in shares]}")
    ob = out["observed"]
    entry = {
        "id": "m7-cool-flame",
        "name": "Burns on invisibly after the flame goes out (CFI)",
        "question": ("After the visible flame goes out, does a cool flame keep the droplet burning until all the fuel "
                     "is used up?"),
        "data": (f"NASA CFI, PSI-39 (doi:10.60555/m6pj-a914): {len(cf)} n-dodecane and n-dodecane/iso-dodecane droplet "
                 f"burns ({cf.d0_mm.min():.1f}-{cf.d0_mm.max():.1f} mm) whose visible flame went out and then "
                 f"burned on as a cool flame, {min(ob['conditions']['p_atm']):g}-{max(ob['conditions']['p_atm']):g} atm, "
                 f"{min(ob['conditions']['x_o2']):.0%}-{max(ob['conditions']['x_o2']):.0%} O2, 0-{max(ob['conditions']['x_he']):.0%} He. "
                 "Gas flames (CFI-G, PSI-159): cool flames were seen only with 30% n-butane and 40% O2 at 2.03 bar."),
        "method": ("Logistic regression on pressure, O2, helium, droplet size, fuel blend and support fibre; strength "
                   "chosen inside every training split. Label: 'Dext,cool' = 0 in NASA's analysis (droplet used up) "
                   "versus a cool flame that went out and left fuel."),
        "validation": (f"Whole test sessions held out: 5-fold grouped by ISS test date ({out['sessions']} dates), "
                       f"repeated {n_repeats} times. Score = median AUC; range = 95% session bootstrap."),
        "metric": "AUC",
        "score": round(out["headline"]["auc_median"], 4),
        "score_range": [round(v, 4) for v in out["headline"]["auc_session_bootstrap_95"]],
        "baseline_name": f"Best single input ({NAMES[out['single_variable_on_all_rows']].lower()})",
        "baseline_score": round(out["baseline_single"]["auc_median"], 4),
        "unit": "chance the droplet is used up (0-1)",
        "points": pts,
        "drivers": [{"name": d["name"], "share": round(d["share"], 4)} for d in shares],
        "limits": ("A visible flame going out does not mean the fire is out: in these burns a flame too dim for the "
                   "colour camera kept consuming fuel. 'Used up' includes droplets finished off by a reignited hot "
                   "flame (common above about 2 atm). Whether a cool flame appears at all is not modelled, because "
                   "missing cool-flame data usually means the droplet drifted out of view. One fuel family, about 4-6 mm "
                   "droplets, microgravity only; nothing here applies to Moon or Mars gravity."),
    }
    return entry, out
