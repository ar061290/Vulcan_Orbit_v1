"""M6b flame spread predictor and growth simulation: calibrate, validate, check, and write the site files.

    python models/m6b-predictor/build.py            # rebuild everything
    python models/m6b-predictor/build.py --clean    # delete M6b's outputs only, then exit

Reads   models/m6-spread/bass2_clean.csv, models/m6-spread/source/properties.csv     (M6, never modified)
        datasets/psi/PSI-99/PSI-99_Experimental table_SAFFIRE-2.csv                  (NASA PSI-99, Saffire-II: independent check)
        models/m6b-predictor/source/*.csv                                           (hand transcriptions with quotes)
Writes  data/spread_predictor.json, data/growth_examples.json, their two lines in data/manifest.json,
        models/m6b-predictor/results.json, models/m6b-predictor/checks/*.png
Rules   models/m6b-predictor/RULES.md (committed before any fitting).
"""
import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
from growth import RUNS, overall_verdict, simulate  # noqa: E402
from predictor import P_ATM_KPA, VERDICTS, concurrent_law, de_ris, spread_rates, verdict  # noqa: E402

M6 = ROOT / "models" / "m6-spread"
M6_CLEAN = M6 / "bass2_clean.csv"
M6_PROPS = M6 / "source" / "properties.csv"
PSI99 = ROOT / "datasets" / "psi" / "PSI-99" / "PSI-99_Experimental table_SAFFIRE-2.csv"
SRC = HERE / "source"
PRED_JSON = ROOT / "data" / "spread_predictor.json"
EX_JSON = ROOT / "data" / "growth_examples.json"
MANIFEST = ROOT / "data" / "manifest.json"
RESULTS = HERE / "results.json"
CHECKS = HERE / "checks"
PLOTS = ["opposed_obs_pred.png", "concurrent_obs_pred.png", "growth_examples.png"]
SEED = 0
N_BOOT = 2000
N_RANDOM = 200
M6_MAE = 0.033
PRESSURE_BOX_ATM = [0.97, 1.03]       # "about 1 atm" (README Decisions)
FLOW_GRID = list(range(0, 51, 2))
O2_GRID = list(range(15, 36, 1))
MANIFEST_LINES = [
    {"name": "spread_predictor", "status": "model", "owner": "M6b",
     "what": "Flame spread rate (lo, mid, hi), will-it-spread verdict and calibration label by material, flow and O2"},
    {"name": "growth_examples", "status": "model", "owner": "M6b",
     "what": "Growth simulation: burning area over time for three worked examples"},
]


def say(*a):
    print(*a, flush=True)


def sig(x, n=4):
    if x is None:
        return None
    x = float(x)
    return None if not math.isfinite(x) else float(f"{x:.{n}g}")


def csv(path):
    return pd.read_csv(path, comment="#")


# ---------------------------------------------------------------- 1. inputs
def load_inputs():
    p = csv(M6_PROPS)
    v = {r["name"]: r["value"] for _, r in p.iterrows() if pd.notna(r["value"])}
    dr = {k: float(v[k]) for k in ("c_thin", "c_thick", "F_adb_21", "T_v", "T_inf")}
    pm = csv(SRC / "properties_m6b.csv").set_index("name")["value"].astype(float).to_dict()
    slabs = csv(M6_CLEAN).dropna(subset=["spread_mm_s"]).reset_index(drop=True)
    raw, regime, tau = de_ris(slabs["thickness_mm"], slabs["sides_burning"], slabs["velocity_cm_s"], slabs["o2_vol_pct"], 1.0, dr)
    assert np.allclose(raw, slabs["de_ris_mm_s"], atol=1e-4) and (regime == slabs["de_ris_regime"]).all(), "de Ris copy differs from M6"
    slabs["raw"], slabs["regime"], slabs["tau_mm"] = raw, regime, tau
    conc = csv(SRC / "concurrent_reported.csv")
    film = csv(SRC / "opposed_thin_reported.csv")
    cases = csv(SRC / "no_spread_placed.csv")
    psi = pd.read_csv(PSI99)
    psi.columns = [c.strip() for c in psi.columns]
    s2 = psi[psi["Sample Number"].isin(["2-5", "2-6"])].copy()
    num = lambda t: float(str(t).replace("~", "").split()[0])  # noqa: E731
    s2 = pd.DataFrame({"sample": s2["Sample Number"], "flow_cm_s": s2["Air Flow (cm/s)"].map(num),
                       "o2_vol_pct": s2["Percent O2 (Note 1)"].map(num), "spread_mm_s": s2["?-g Spread Length"].map(num),
                       "burn_time_s": s2["Burn Time (s)"].map(num), "length_cm": s2["Sample Length"].map(num),
                       "width_cm": s2["Sample Width (cm)"].map(num), "direction": s2["Flow Direction"]}).reset_index(drop=True)
    assert list(s2["spread_mm_s"]) == [2.1, 2.6] and (s2["direction"] == "Concurrent").all()
    return dr, pm, slabs, conc, film, cases, s2


# ---------------------------------------------------------------- 2. opposed calibration (RULES section 1)
def factors(df):
    pooled = float(np.exp(np.log(df["spread_mm_s"] / df["raw"]).mean()))
    f, used_pooled = {}, []
    for reg in ("thin", "thick"):
        g = df[df["regime"] == reg]
        if len(g):
            f[reg] = float(np.exp(np.log(g["spread_mm_s"] / g["raw"]).mean()))
        else:
            f[reg] = pooled
            used_pooled.append(reg)
    return f, pooled, used_pooled


def pred_opp(df, f):
    return df["raw"].to_numpy() * np.where(df["regime"] == "thin", f["thin"], f["thick"])


def loso(df):
    """Held-out predictions of the kept model and of B2 (M6's one constant); asserts group disjointness."""
    cal, b2 = np.full(len(df), np.nan), np.full(len(df), np.nan)
    pooled_used = []
    for s in sorted(df["session"].unique()):
        te = (df["session"] == s).to_numpy()
        for col in ("session", "test"):
            assert not set(df.loc[~te, col]) & set(df.loc[te, col]), f"{col} on both sides"
        f, pooled, used = factors(df[~te])
        pooled_used += [(s, u) for u in used]
        cal[te] = pred_opp(df[te], f)
        b2[te] = df.loc[te, "raw"].to_numpy() * pooled
    return cal, b2, pooled_used


def q_range(r):
    return [float(np.percentile(r, 2.5)), float(np.percentile(r, 97.5))]


def nested_coverage_opp(df):
    inside = np.zeros(len(df), bool)
    for s in sorted(df["session"].unique()):
        te = (df["session"] == s).to_numpy()
        tr = df[~te].reset_index(drop=True)
        inner, _, _ = loso(tr)
        lo, hi = q_range(np.log(tr["spread_mm_s"] / inner))
        f, _, _ = factors(tr)
        p = pred_opp(df[te], f)
        y = df.loc[te, "spread_mm_s"].to_numpy()
        inside[te] = (y >= p * math.exp(lo)) & (y <= p * math.exp(hi))
    return inside


def boot_mae(df, preds, rng):
    sessions = df["session"].unique()
    idx = {s: np.flatnonzero(df["session"].to_numpy() == s) for s in sessions}
    y = df["spread_mm_s"].to_numpy()
    out = {k: [] for k in preds}
    for _ in range(N_BOOT):
        pick = np.concatenate([idx[s] for s in rng.choice(sessions, len(sessions), replace=True)])
        for k, p in preds.items():
            out[k].append(np.mean(np.abs(y[pick] - p[pick])))
    return {k: [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))] for k, v in out.items()}


def r2(y, p):
    return float(1 - np.sum((y - p) ** 2) / np.sum((y - np.mean(y)) ** 2))


def opposed(slabs):
    say("\n[2] Opposed flow, PMMA slabs (39 rows, leave one ISS session out)")
    y = slabs["spread_mm_s"].to_numpy()
    cal, b2, pooled_used = loso(slabs)
    raw = slabs["raw"].to_numpy()
    resid = np.log(y / cal)
    log_range = q_range(resid)
    inside_nested = nested_coverage_opp(slabs)
    inside_shipped = (y >= cal * math.exp(log_range[0])) & (y <= cal * math.exp(log_range[1]))
    f_all, pooled_all, _ = factors(slabs)
    rng = np.random.default_rng(SEED)
    mae = {"kept": float(np.mean(np.abs(y - cal))), "B2_one_constant": float(np.mean(np.abs(y - b2))),
           "B1_raw_de_ris": float(np.mean(np.abs(y - raw)))}
    mae_rng = boot_mae(slabs, {"kept": cal, "B2_one_constant": b2, "B1_raw_de_ris": raw}, rng)
    res = {
        "rows": int(len(slabs)), "sessions": int(slabs["session"].nunique()),
        "factors_all_rows": {"thin": f_all["thin"], "thick": f_all["thick"], "one_constant_B2": pooled_all},
        "rows_per_regime": slabs["regime"].value_counts().to_dict(),
        "fold_factors": {}, "pooled_factor_used_in_folds": pooled_used,
        "mae_mm_s": mae, "mae_range_95": mae_rng,
        "r2": {"kept": r2(y, cal), "B2_one_constant": r2(y, b2), "B1_raw_de_ris": r2(y, raw)},
        "log_range": log_range, "range_factor": [math.exp(log_range[0]), math.exp(log_range[1])],
        "coverage_nested": float(inside_nested.mean()), "coverage_shipped_in_sample": float(inside_shipped.mean()),
        "misses_nested": slabs.loc[~inside_nested, ["test", "session", "velocity_cm_s", "spread_mm_s"]].to_dict("records"),
        "R1_mae_le_0.033": {"value": mae["kept"], "pass": bool(mae["kept"] <= M6_MAE)},
        "R2_coverage_ge_0.80": {"value": float(inside_nested.mean()), "pass": bool(inside_nested.mean() >= 0.80)},
    }
    for s in sorted(slabs["session"].unique()):
        f, _, _ = factors(slabs[slabs["session"] != s])
        res["fold_factors"][s] = f
    by_reg = {}
    for reg in ("thin", "thick"):
        m = (slabs["regime"] == reg).to_numpy()
        by_reg[reg] = {"n": int(m.sum()), "mae_kept": float(np.mean(np.abs(y[m] - cal[m]))),
                       "mae_B2": float(np.mean(np.abs(y[m] - b2[m]))), "coverage_nested": float(inside_nested[m].mean())}
    res["by_regime"] = by_reg
    say(f"  factors on all rows: thin {f_all['thin']:.4f}, thick {f_all['thick']:.4f} (M6 one constant {pooled_all:.4f})")
    say(f"  held-out MAE (mm/s): kept {mae['kept']:.4f} {np.round(mae_rng['kept'], 4)} | B2 one constant {mae['B2_one_constant']:.4f}"
        f" | B1 raw de Ris {mae['B1_raw_de_ris']:.4f}")
    say(f"  held-out R2: kept {res['r2']['kept']:.3f} | B2 {res['r2']['B2_one_constant']:.3f} | B1 {res['r2']['B1_raw_de_ris']:.2f}")
    for reg, d in by_reg.items():
        say(f"  {reg:5s} n={d['n']:2d}  MAE kept {d['mae_kept']:.4f}  B2 {d['mae_B2']:.4f}  nested coverage {d['coverage_nested']:.2f}")
    say(f"  shipped range: x[{res['range_factor'][0]:.3f}, {res['range_factor'][1]:.3f}]; nested coverage {res['coverage_nested']:.3f}"
        f" ({int(inside_nested.sum())}/39); in-sample coverage {res['coverage_shipped_in_sample']:.3f}")
    say(f"  R1 MAE <= 0.033: {'PASS' if res['R1_mae_le_0.033']['pass'] else 'MISS'};  R2 coverage >= 0.80: "
        f"{'PASS' if res['R2_coverage_ge_0.80']['pass'] else 'MISS'}")
    if pooled_used:
        say(f"  pooled factor used for missing regimes in folds: {pooled_used}")
    return res, cal, f_all, log_range


# ---------------------------------------------------------------- 3. concurrent calibration (RULES section 2)
def concurrent(conc):
    say("\n[3] Concurrent flow, cellulose fabric (6 reported flights, leave one out)")
    cal = conc[conc["role"] == "calibration"].reset_index(drop=True)
    assert len(cal) == 6 and not cal["flight"].eq("Saffire II").any(), "Saffire-II must never calibrate"
    y = cal["spread_cm_s"].to_numpy() * 10.0
    base = concurrent_law(cal["flow_cm_s"], cal["o2_vol_pct"], cal["pressure_kpa"] / P_ATM_KPA, cal["area_density_mg_cm2"])
    lr = np.log(y / base)
    n = len(y)
    K_loo = np.array([np.exp(np.delete(lr, i).mean()) for i in range(n)])
    pred = K_loo * base
    resid = np.log(y / pred)
    mean_base = np.array([np.delete(y, i).mean() for i in range(n)])
    inside = np.zeros(n, bool)
    for i in range(n):
        rest = [j for j in range(n) if j != i]
        inner = []
        for j in rest:
            k = np.exp(np.mean([lr[m] for m in rest if m != j]))
            inner.append(math.log(y[j] / (k * base[j])))
        inside[i] = min(inner) <= math.log(y[i] / pred[i]) <= max(inner)
    K = float(np.exp(lr.mean()))
    log_range = [float(resid.min()), float(resid.max())]
    res = {"rows": n, "K": K, "K_loo": K_loo.tolist(), "log_range": log_range,
           "range_factor": [math.exp(log_range[0]), math.exp(log_range[1])],
           "mae_mm_s": float(np.mean(np.abs(y - pred))), "mae_baseline_mean_mm_s": float(np.mean(np.abs(y - mean_base))),
           "coverage_nested": float(inside.mean()),
           "points": [{"flight": f"{r.flight} {r.sample}", "material": r.material, "obs_mm_s": float(y[i]),
                       "pred_mm_s": float(pred[i]), "log_resid": float(resid[i]), "inside_nested": bool(inside[i])}
                      for i, r in enumerate(cal.itertuples())],
           "R3_coverage_ge_0.80": {"value": float(inside.mean()), "pass": bool(inside.mean() >= 0.80)}}
    say(f"  K (all 6) = {K:.5f}; held-out MAE {res['mae_mm_s']:.3f} mm/s vs mean-of-training baseline "
        f"{res['mae_baseline_mean_mm_s']:.3f}")
    for p in res["points"]:
        say(f"    {p['flight']:14s} {p['material']:6s} obs {p['obs_mm_s']:.2f}  held-out pred {p['pred_mm_s']:.2f}  "
            f"ln ratio {p['log_resid']:+.3f}  inside nested range: {p['inside_nested']}")
    say(f"  shipped range x[{res['range_factor'][0]:.3f}, {res['range_factor'][1]:.3f}]; nested coverage "
        f"{int(inside.sum())}/6 -> R3 {'PASS' if res['R3_coverage_ge_0.80']['pass'] else 'MISS'}")
    return res, K, log_range


# ---------------------------------------------------------------- 4. params for the predictor and the simulation
def build_params(dr, pm, slabs, f_all, opp_range, K, conc_range, cases):
    def box(g):
        return {"tau_mm": [float(g["tau_mm"].min()), float(g["tau_mm"].max())],
                "flow_cm_s": [float(g["velocity_cm_s"].min()), float(g["velocity_cm_s"].max())],
                "o2_vol_pct": [float(g["o2_vol_pct"].min()), float(g["o2_vol_pct"].max())], "pressure_atm": PRESSURE_BOX_ATM}
    bound = pm["pmma_concurrent_damage_length"] * 10.0 / pm["pmma_concurrent_burn_time"]      # mm/s
    cal = csv(SRC / "concurrent_reported.csv").query("role == 'calibration'")
    vcase = [{k: (None if (isinstance(v, float) and math.isnan(v)) else v) for k, v in r.items()}
             for r in cases.to_dict("records")]
    return {
        "de_ris": dr,
        "opposed": {"f_thin": f_all["thin"], "f_thick": f_all["thick"], "log_range": opp_range,
                    "domain": {"thin": box(slabs[slabs["regime"] == "thin"]), "thick": box(slabs[slabs["regime"] == "thick"])}},
        "concurrent": {"K": K, "log_range": conc_range, "ref_area_density": pm["sibal_area_density"],
                       "domain": {"flow_cm_s": [float(cal["flow_cm_s"].min()), float(cal["flow_cm_s"].max())],
                                  "o2_vol_pct": [float(cal["o2_vol_pct"].min()), float(cal["o2_vol_pct"].max())],
                                  "pressure_atm": [float(cal["pressure_kpa"].min()) / P_ATM_KPA,
                                                   float(cal["pressure_kpa"].max()) / P_ATM_KPA],
                                  "area_density": [float(cal["area_density_mg_cm2"].min()),
                                                   float(cal["area_density_mg_cm2"].max())]}},
        "area_density": {"SIBAL": pm["sibal_area_density"], "cotton": pm["cotton_area_density"]},
        "pmma_concurrent_bound": {"lo": 0.0, "mid": 0.0, "hi": bound,
                                  "domain": {"flow_cm_s": [18.0, 22.0], "o2_vol_pct": [21.4, 22.6], "pressure_atm": PRESSURE_BOX_ATM}},
        "burnout": {"fabric_s": [pm["sibal_burnout_time"], pm["sibal_burnout_time"], pm["sibal_burnout_time_peak"]],
                    "pmma_regression_mm_s": [pm["pmma_regression_hi"], math.sqrt(pm["pmma_regression_lo"] * pm["pmma_regression_hi"]),
                                             pm["pmma_regression_lo"]]},
        "verdict": {"o2_obs": 0.5, "o2_near": 1.5, "flow_obs_abs": 0.5, "flow_obs_rel": 0.1, "flow_near_factor": 2.0, "cases": vcase},
    }


# ---------------------------------------------------------------- 5. independent checks (RULES section 3)
def independent(params, s2, film, conc_res):
    say("\n[4] Independent checks (never used in calibration)")
    out = {"saffire2": [], "film": None}
    p103 = 103.0 / P_ATM_KPA
    for r in s2.itertuples():
        for flow, scored in ((r.flow_cm_s, True), (25.0, False)):
            if not scored and r.sample != "2-6":
                continue
            sr = spread_rates("SIBAL", 0, 2, flow, r.o2_vol_pct, p103, params)["concurrent"]
            mid, lo, hi = float(sr["mid"]), float(sr["lo"]), float(sr["hi"])
            inside = lo <= r.spread_mm_s <= hi
            out["saffire2"].append({"sample": r.sample, "flow_cm_s": flow, "scored": scored, "obs_mm_s": r.spread_mm_s, "pred_mm_s": mid,
                                    "lo": lo, "hi": hi, "inside": bool(inside), "error_mm_s": mid - r.spread_mm_s,
                                    "ratio_pred_obs": mid / r.spread_mm_s, "in_domain": bool(sr["in_domain"])})
            say(f"  Saffire-II {r.sample} at {flow:g} cm/s{'' if scored else ' (sensitivity, Olson et al. flow)'}: obs {r.spread_mm_s} mm/s, "
                f"pred {mid:.2f} [{lo:.2f}, {hi:.2f}] -> {'inside' if inside else 'OUTSIDE'}; pred/obs {mid / r.spread_mm_s:.2f};"
                f" in_domain {bool(sr['in_domain'])}")
    scored = [c for c in out["saffire2"] if c["scored"]]
    out["R4a_both_inside"] = {"pass": all(c["inside"] for c in scored), "mae_mm_s": float(np.mean([abs(c["error_mm_s"]) for c in scored]))}
    f = film.iloc[0]
    sr = spread_rates("PMMA", f["thickness_mm"], int(f["sides_burning"]), f["flow_cm_s"], f["o2_vol_pct"], f["pressure_kpa"] / P_ATM_KPA,
                      params)["opposed"]
    mid, lo, hi, raw = float(sr["mid"]), float(sr["lo"]), float(sr["hi"]), float(sr["raw_de_ris"])
    inside = lo <= f["spread_mm_s"] <= hi
    out["film"] = {"obs_mm_s": float(f["spread_mm_s"]), "pred_mm_s": mid, "lo": lo, "hi": hi, "raw_de_ris_mm_s": raw,
                   "regime": str(sr["regime"]), "in_domain": bool(sr["in_domain"]), "inside": bool(inside)}
    out["R4b_film_inside"] = {"pass": bool(inside)}
    say(f"  100 um PMMA film: obs {f['spread_mm_s']} mm/s; slab-calibrated pred {mid:.2f} [{lo:.2f}, {hi:.2f}] -> "
        f"{'inside' if inside else 'OUTSIDE'}; raw de Ris {raw:.2f}; regime {sr['regime']}; in_domain {bool(sr['in_domain'])}")
    say(f"  R4a {'PASS' if out['R4a_both_inside']['pass'] else 'MISS'} (MAE {out['R4a_both_inside']['mae_mm_s']:.2f} mm/s);"
        f"  R4b {'PASS' if inside else 'MISS'}")
    return out


# ---------------------------------------------------------------- 6. predictor grid (data/spread_predictor.json)
GRID_CASES = [
    ("pmma_film_0.1mm_opposed", "PMMA", 0.1, 2, "opposed", "PMMA film 0.1 mm, both faces burning"),
    ("pmma_film_0.1mm_concurrent", "PMMA", 0.1, 2, "concurrent", "PMMA film 0.1 mm, both faces burning"),
    ("pmma_slab_1mm_opposed", "PMMA", 1.0, 2, "opposed", "PMMA slab 1 mm, both faces burning"),
    ("pmma_slab_1mm_concurrent", "PMMA", 1.0, 2, "concurrent", "PMMA slab 1 mm, both faces burning"),
    ("pmma_slab_5mm_opposed", "PMMA", 5.0, 2, "opposed", "PMMA slab 5 mm, both faces burning"),
    ("pmma_slab_5mm_concurrent", "PMMA", 5.0, 2, "concurrent", "PMMA slab 5 mm, both faces burning"),
    ("sibal_concurrent", "SIBAL", 0.32, 2, "concurrent", "SIBAL cotton-fiberglass fabric, 18.05 mg/cm2"),
    ("sibal_opposed", "SIBAL", 0.32, 2, "opposed", "SIBAL cotton-fiberglass fabric, 18.05 mg/cm2"),
]


def grid_file(params, opp_res, conc_res):
    U, O = np.meshgrid(np.array(FLOW_GRID, float), np.array(O2_GRID, float))       # rows = O2, columns = flow
    cases = []
    for cid, mat, th, sides, d, label in GRID_CASES:
        r = spread_rates(mat, th, sides, U, O, 1.0, params)[d]
        code, _ = verdict(mat, th, d, U, O, params)
        mid = np.broadcast_to(np.asarray(r["mid"], float), U.shape)
        cal = np.broadcast_to(np.asarray(r["calibration"]), U.shape)
        to_list = lambda a: [[sig(x) for x in row] for row in a]  # noqa: E731
        regime = np.broadcast_to(np.asarray(r["regime"]), U.shape)
        cases.append({
            "id": cid, "material": mat, "fuel": label, "thickness_mm": th, "sides_burning": sides, "flow_direction": d,
            "rate_mm_s": to_list(mid), "lo": to_list(np.broadcast_to(np.asarray(r["lo"], float), U.shape)),
            "hi": to_list(np.broadcast_to(np.asarray(r["hi"], float), U.shape)),
            "verdict": code.astype(int).tolist(),
            "in_domain": np.broadcast_to(np.asarray(r["in_domain"]), U.shape).astype(int).tolist(),
            "calibration": [[str(c) for c in row] for row in cal],
            "regime": [[str(c) for c in row] for row in regime],
            "note": GRID_NOTES[cid],
        })
    return {
        "status": "model",
        "what": "M6b flame spread predictor: spread rate with range, will-it-spread verdict, calibration label and in-domain flag, "
                "by material, flow direction, flow speed and O2, at 1 atm, microgravity only.",
        "units": {"rate": "mm/s", "flow": "cm/s", "o2": "vol%", "pressure": "atm", "thickness": "mm"},
        "pressure_atm": 1.0, "flow_cm_s": FLOW_GRID, "o2_vol_pct": O2_GRID,
        "layout": "every 2-D array is [o2 index][flow index]; null = no data and no model",
        "verdict_codes": {str(i): v for i, v in enumerate(VERDICTS)},
        "verdict_meaning": "observed no-spread / near observed extinction: inside the boxes of RULES.md section 4 around an observed NASA "
                           "no-spread case of the same material, flow direction and geometry. 'spreads' only means no such case is near; "
                           "it is not a claim that the fuel is flammable or that anything is safe.",
        "scores": {"opposed_heldout_mae_mm_s": sig(opp_res["mae_mm_s"]["kept"]), "opposed_nested_coverage": sig(opp_res["coverage_nested"]),
                   "concurrent_heldout_mae_mm_s": sig(conc_res["mae_mm_s"]), "concurrent_nested_coverage": sig(conc_res["coverage_nested"])},
        "cases": cases,
        "constants": params,
        "sources": SOURCES,
        "limits": "Reduced-order model calibrated to NASA ISS and spacecraft data; not validated fluid dynamics. Microgravity only: no Moon or "
                  "Mars prediction. Outside the in-domain cells every value is an extrapolation. Nothing here says a material or atmosphere "
                  "is safe.",
    }


GRID_NOTES = {
    "pmma_film_0.1mm_opposed": "de Ris x thin-regime factor fitted on 1-2 mm slabs; films are thinner than any calibration row, so every cell "
                               "is out of domain. Independent check on a 100 um film: see models/m6b-predictor/REPORT.md.",
    "pmma_film_0.1mm_concurrent": "No concurrent spread data or model for PMMA films (null).",
    "pmma_slab_1mm_opposed": "Calibrated de Ris (BASS-II slabs). The regime switches from thin to thick as the flow rises.",
    "pmma_slab_1mm_concurrent": "Thick-regime cells: observed bound from PSI-99 (thick PMMA anchored: 0 to 0.167 mm/s), in domain only near "
                                "20 cm/s and 22% O2. Thin-regime cells: no data (null).",
    "pmma_slab_5mm_opposed": "Calibrated de Ris (BASS-II slabs), thick regime.",
    "pmma_slab_5mm_concurrent": "Observed bound from PSI-99 (thick PMMA anchored at the base: 0 to 0.167 mm/s), in domain only near 20 cm/s "
                                "and 22% O2.",
    "sibal_concurrent": "Concurrent scaling law (rate proportional to flow x O2 x sqrt(pressure) / area density) x one constant fitted on six "
                        "reported spacecraft flights; checked on Saffire-II (PSI-99).",
    "sibal_opposed": "No opposed-flow spread rate for SIBAL in the data and no model with documented properties (null). Verdicts still shown.",
}

SOURCES = [
    {"label": "NASA PSI-25 BASS-II (Table 5.1 of NASA/TM-20210011385 via M6)", "doi": "10.60555/4qc4-de67"},
    {"label": "NASA PSI-99 Saffire-II experimental table", "doi": "10.60555/2chp-m469"},
    {"label": "Olson et al., concurrent flame spread over large cellulose samples in microgravity (accepted manuscript)",
     "url": "https://discovery.ucl.ac.uk/id/eprint/10164340/"},
    {"label": "Bhattacharjee et al. 2016, Fire Safety Journal 79:111", "doi": "10.1016/j.firesaf.2015.11.011"},
    {"label": "Bhattacharjee et al. 2016, Combustion and Flame 163:472", "doi": "10.1016/j.combustflame.2015.10.023"},
]


# ---------------------------------------------------------------- 7. growth checks and examples (RULES section 6)
EXAMPLES = [
    {"id": "sibal_concurrent_panel", "title": "Thin SIBAL fabric panel in concurrent flow (Saffire-II layout)",
     "flame_state": {"flame_type": "surface", "frame_time_s": 0.0, "area_cm2": 2.5, "centroid_cm": [0.25, 2.5], "bbox_cm": [0.0, 0.0, 0.5, 5.0]},
     "fuel": {"material": "SIBAL", "width_cm": 5.0, "length_cm": 29.0, "thickness_mm": 0.32, "sides_burning": 2},
     "conditions": {"flow_cm_s": 20.0, "flow_direction_deg": 0.0, "o2_vol_pct": 22.1, "pressure_atm": 103.0 / P_ATM_KPA},
     "why": "Same sample size, flow and O2 as Saffire-II samples 2-5 and 2-6 (PSI-99); the flame starts as a band at the upstream edge."},
    {"id": "pmma_slab_opposed", "title": "Thick PMMA slab in opposed flow (BASS-II slab layout)",
     "flame_state": {"flame_type": "surface", "frame_time_s": 0.0, "area_cm2": 1.1, "centroid_cm": [8.25, 1.1], "bbox_cm": [8.0, 0.0, 8.5, 2.2]},
     "fuel": {"material": "PMMA", "width_cm": 2.2, "length_cm": 8.5, "thickness_mm": 5.0, "sides_burning": 2},
     "conditions": {"flow_cm_s": 10.0, "flow_direction_deg": 0.0, "o2_vol_pct": 21.0, "pressure_atm": 1.0},
     "why": "5 mm two-sided slab, 2.2 cm wide (BASS-II Table 5.1 widths), 8.5 cm long (the BASS-II slab length in NASA/TM-20210011385 App. D); "
            "flame at the downstream end, spreading upwind against 10 cm/s."},
    {"id": "sibal_low_flow_extinction", "title": "Low-flow case that ends in extinction (SIBAL at 2.2 cm/s, 18.7% O2)",
     "flame_state": {"flame_type": "surface", "frame_time_s": 0.0, "area_cm2": 2.2, "centroid_cm": [0.5, 1.1], "bbox_cm": [0.0, 0.0, 1.0, 2.2]},
     "fuel": {"material": "SIBAL", "width_cm": 2.2, "length_cm": 10.0, "thickness_mm": 0.32, "sides_burning": 2},
     "conditions": {"flow_cm_s": 2.2, "flow_direction_deg": 0.0, "o2_vol_pct": 18.7, "pressure_atm": 1.0},
     "why": "The conditions of BASS-II test GMT45-T4 (Table 7.1: flow turned down to 2.2 cm/s at 18.7% O2, quenched)."},
]


def strip(out):
    return {k: v for k, v in out.items() if not k.startswith("_")}


def check_g1_g2(params):
    say("\n[6] Growth-simulation checks")
    fs = {"flame_type": "surface", "frame_time_s": 0.0, "area_cm2": 0.5, "centroid_cm": [0.25, 0.5], "bbox_cm": [0.0, 0.0, 0.5, 1.0]}
    fuel = {"material": "PMMA", "width_cm": 1.0, "length_cm": 20.0, "thickness_mm": 1.0, "sides_burning": 2}
    cond = {"flow_cm_s": 0.0, "flow_direction_deg": 0.0, "o2_vol_pct": 21.0, "pressure_atm": 1.0}
    out = simulate(fs, fuel, cond, params)
    X, Y = out["_grid"]
    dxx, dyy = out["_cell"]
    ta = out["_arrays"]["mid"]
    init = out["_init"]
    V = float(spread_rates("PMMA", 1.0, 2, 0.0, 21.0, 1.0, params)["opposed"]["mid"]) / 10.0
    j = X.shape[1] // 2
    x_e = X[init[:, j], j].max() + dxx / 2
    t_full = (20.0 - x_e) / V
    errs = []
    for frac in (0.25, 0.5, 0.75):
        t = frac * t_full
        front = X[ta[:, j] <= t, j].max() + dxx / 2
        errs.append({"t_s": t, "sim_cm": float(front), "hand_cm": float(x_e + V * t), "diff_cm": float(front - (x_e + V * t))})
    g1 = all(abs(e["diff_cm"]) <= dxx + 1e-9 for e in errs)
    say(f"  G1 hand calc: V = {V * 10:.4f} mm/s, dx = {dxx:.3f} cm, x_e = {x_e:.3f} cm; diffs (cm) "
        f"{[round(e['diff_cm'], 4) for e in errs]} -> {'PASS' if g1 else 'FAIL'}; verdict '{out['verdict']['label']}'")
    last = np.unravel_index(np.argmax(ta), ta.shape)
    g2 = bool(np.isfinite(ta).all() and last[0] == X.shape[0] - 1 and X.max() < 20.0 and Y.max() < 1.0
              and out["summary"]["mid"]["stop_reason"] == "fuel edge" and out["area_cm2"]["mid"][-1] == 0.0)
    say(f"  G2 fuel edge: all cells reached {bool(np.isfinite(ta).all())}, last reached column {last[0]} of {X.shape[0] - 1}, "
        f"stop '{out['summary']['mid']['stop_reason']}', final area {out['area_cm2']['mid'][-1]} -> {'PASS' if g2 else 'FAIL'}")
    return {"G1": {"pass": g1, "V_mm_s": V * 10, "dx_cm": dxx, "x_e_cm": float(x_e), "points": errs},
            "G2": {"pass": g2, "last_column": int(last[0]), "n_columns": int(X.shape[0]),
                   "stop_reason": out["summary"]["mid"]["stop_reason"]}}


def check_g3(params, cases):
    geom_fuel = {"film": ("PMMA", 0.1), "slab": ("PMMA", 2.0), "fabric": ("SIBAL", 0.32)}
    rows, ok = [], True
    for c in cases.itertuples():
        if c.geometry not in geom_fuel:
            continue
        mat, th = geom_fuel[c.geometry]
        fuel = {"material": mat, "width_cm": 2.0, "length_cm": 10.0, "thickness_mm": th, "sides_burning": 2}
        cond = {"flow_cm_s": (c.flow_lo_cm_s + c.flow_hi_cm_s) / 2, "flow_direction_deg": 0.0,
                "o2_vol_pct": (c.o2_lo_vol_pct + c.o2_hi_vol_pct) / 2, "pressure_atm": 1.0}
        fs = {"flame_type": "surface", "frame_time_s": 0.0, "area_cm2": 0.785, "centroid_cm": [4.5, 1.0], "bbox_cm": [4.0, 0.5, 5.0, 1.5]}
        out = simulate(fs, fuel, cond, params, n_samples=11)
        n0 = int(out["_init"].sum())
        good = all(int(np.isfinite(out["_arrays"][r]).sum()) == n0 and out["summary"][r]["stop_reason"] == "observed no-spread conditions"
                   for r in RUNS)
        ok &= good
        rows.append({"case": c.case_id, "status": c.status, "pass": bool(good)})
    say(f"  G3 no-spread: {sum(r['pass'] for r in rows)}/{len(rows)} placed cases give zero growth -> {'PASS' if ok else 'FAIL'}")
    return {"pass": bool(ok), "cases": rows}


def random_inputs(rng):
    out = []
    for _ in range(N_RANDOM):
        kind = rng.choice(["slab", "film", "fabric"])
        W, L = rng.uniform(1, 40), rng.uniform(2, 100)
        a, b = rng.uniform(0.02, 0.2) * L, rng.uniform(0.02, 0.2) * W
        cx, cy = rng.uniform(0, L), rng.uniform(0, W)
        fuel = {"material": "SIBAL" if kind == "fabric" else "PMMA", "width_cm": W, "length_cm": L,
                "thickness_mm": {"slab": rng.uniform(1, 5), "film": rng.uniform(0.05, 0.4), "fabric": 0.32}[kind],
                "sides_burning": int(rng.choice([1, 2])) if kind != "fabric" else 2}
        flow = 0.0 if rng.random() < 0.1 else rng.uniform(0, 50)
        cond = {"flow_cm_s": flow, "flow_direction_deg": rng.uniform(0, 360), "o2_vol_pct": rng.uniform(15, 35), "pressure_atm": 1.0}
        fs = {"flame_type": "surface", "frame_time_s": 0.0, "area_cm2": math.pi * a * b * rng.uniform(0.3, 1.0),
              "centroid_cm": [cx, cy], "bbox_cm": [cx - a, cy - b, cx + a, cy + b]}
        out.append((fs, fuel, cond))
    return out


def check_g4_g5(params, inputs):
    neg, g5_fail, n = [], [], 0
    for k, (fs, fuel, cond) in enumerate(inputs):
        a = simulate(fs, fuel, cond, params, n_samples=51)
        b = simulate(fs, dict(fuel, length_cm=2 * fuel["length_cm"]), cond, params, dx_cm=a["_cell"], n_samples=51)
        for o in (a, b):
            for r in RUNS:
                if min(o["area_cm2"][r]) < 0 or o["summary"][r]["max_area_cm2"] < 0:
                    neg.append(k)
        for r in RUNS:
            if b["summary"][r]["max_area_cm2"] < a["summary"][r]["max_area_cm2"] - 1e-9:
                g5_fail.append({"input": k, "run": r, "max_area": a["summary"][r]["max_area_cm2"],
                                "max_area_doubled": b["summary"][r]["max_area_cm2"]})
        n += 1
    g4, g5 = not neg, not g5_fail
    say(f"  G4 non-negative area: {n} inputs x 2 lengths x 3 runs, negatives {len(set(neg))} -> {'PASS' if g4 else 'FAIL'}")
    say(f"  G5 doubling length never lowers max area: failures {len(g5_fail)} -> {'PASS' if g5 else 'FAIL'}")
    return {"G4": {"pass": g4, "inputs": n, "negative_inputs": sorted(set(neg))}, "G5": {"pass": g5, "inputs": n, "failures": g5_fail}}


def examples(params, s2):
    say("\n[7] Worked examples")
    out, sims = [], []
    for ex in EXAMPLES:
        sim = simulate(ex["flame_state"], ex["fuel"], ex["conditions"], params)
        sims.append(sim)
        s = sim["summary"]
        say(f"  {ex['id']}: verdict '{sim['verdict']['label']}'; rates mid {sim['rates_mm_s']['mid']}; burnout {sim['burnout_s']}")
        for r in RUNS:
            say(f"    {r:3s} max area {s[r]['max_area_cm2']} cm2 at {s[r]['t_max_s']} s; ends {s[r]['t_end_s']} s; consumed "
                f"{s[r]['area_consumed_cm2']} cm2; stop: {s[r]['stop_reason']}")
        say(f"    calibrated: {sim['calibrated']}\n    extrapolated: {sim['extrapolated']}\n    assumed: {sim['assumed']}")
        out.append({"id": ex["id"], "title": ex["title"], "why": ex["why"], "inputs": {k: ex[k] for k in ("flame_state", "fuel", "conditions")},
                    **strip(sim)})
    ordered = all(sims[i]["summary"]["lo"]["max_area_cm2"] <= sims[i]["summary"]["mid"]["max_area_cm2"] <= sims[i]["summary"]["hi"]["max_area_cm2"]
                  for i in range(len(sims)))
    e1 = sims[0]["summary"]
    cmp = {"psi99_burn_time_s": s2["burn_time_s"].tolist(), "sim_end_s": {r: e1[r]["t_end_s"] for r in RUNS}}
    say(f"  (not scored) lo <= mid <= hi max area in every example: {ordered}")
    say(f"  (not scored) example 1 end time {cmp['sim_end_s']} s vs PSI-99 burn times {cmp['psi99_burn_time_s']} s")
    return out, sims, {"lo_le_mid_le_hi": ordered, "example1_vs_psi99": cmp}


# ---------------------------------------------------------------- 8. plots
def plots(slabs, cal_pred, opp, conc_res, indep, sims):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    CHECKS.mkdir(exist_ok=True)
    fig, ax = plt.subplots(figsize=(5.2, 5))
    lo, hi = opp["range_factor"]
    for reg, mk in (("thin", "o"), ("thick", "s")):
        m = (slabs["regime"] == reg).to_numpy()
        ax.errorbar(slabs["spread_mm_s"][m], cal_pred[m], yerr=[cal_pred[m] * (1 - lo), cal_pred[m] * (hi - 1)], fmt=mk, ms=4,
                    alpha=0.7, label=f"BASS-II slabs, {reg} regime (held-out session)")
    f = indep["film"]
    ax.errorbar([f["obs_mm_s"]], [f["pred_mm_s"]], yerr=[[f["pred_mm_s"] - f["lo"]], [f["hi"] - f["pred_mm_s"]]], fmt="D", color="k",
                label="100 um film (independent, reported)")
    ax.plot([0.005, 5], [0.005, 5], "k--", lw=0.8)
    ax.set(xscale="log", yscale="log", xlabel="observed spread (mm/s)", ylabel="predicted (mm/s)", title="M6b opposed flow, PMMA")
    ax.legend(fontsize=7)
    fig.tight_layout()
    fig.savefig(CHECKS / PLOTS[0], dpi=120)
    plt.close(fig)
    fig, ax = plt.subplots(figsize=(5.2, 5))
    pts = conc_res["points"]
    lo, hi = conc_res["range_factor"]
    ax.errorbar([p["obs_mm_s"] for p in pts], [p["pred_mm_s"] for p in pts],
                yerr=[[p["pred_mm_s"] * (1 - lo) for p in pts], [p["pred_mm_s"] * (hi - 1) for p in pts]], fmt="o",
                label="6 reported flights (leave one out)")
    for p in pts:
        ax.annotate(p["flight"], (p["obs_mm_s"], p["pred_mm_s"]), fontsize=6)
    sc = [c for c in indep["saffire2"] if c["scored"]]
    ax.errorbar([c["obs_mm_s"] for c in sc], [c["pred_mm_s"] for c in sc],
                yerr=[[c["pred_mm_s"] - c["lo"] for c in sc], [c["hi"] - c["pred_mm_s"] for c in sc]], fmt="D", color="k",
                label="Saffire-II, PSI-99 (independent)")
    ax.plot([1, 8], [1, 8], "k--", lw=0.8)
    ax.set(xlabel="observed spread (mm/s)", ylabel="predicted (mm/s)", title="M6b concurrent flow, cellulose fabric")
    ax.legend(fontsize=7)
    fig.tight_layout()
    fig.savefig(CHECKS / PLOTS[1], dpi=120)
    plt.close(fig)
    fig, axs = plt.subplots(1, 3, figsize=(12, 3.6))
    for ax, ex, sim in zip(axs, EXAMPLES, sims):
        t = np.array(sim["t_s"])
        ax.fill_between(t, sim["area_cm2"]["lo"], sim["area_cm2"]["hi"], alpha=0.3, label="lo to hi")
        ax.plot(t, sim["area_cm2"]["mid"], label="mid")
        ax.set(title=ex["id"], xlabel="time after frame (s)", ylabel="burning area (cm2)")
        ax.legend(fontsize=7)
    fig.tight_layout()
    fig.savefig(CHECKS / PLOTS[2], dpi=120)
    plt.close(fig)


# ---------------------------------------------------------------- 9. writing
def dumps_compact(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"


def jsonable(o):
    if isinstance(o, dict):
        return {str(k): jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [jsonable(v) for v in o]
    if isinstance(o, (np.floating, float)):
        return sig(o, 6)
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, np.bool_):
        return bool(o)
    return o


def update_manifest(remove_only=False):
    m = json.loads(MANIFEST.read_text(encoding="utf-8"))
    names = {x["name"] for x in MANIFEST_LINES}
    m["files"] = [f for f in m["files"] if f["name"] not in names]
    if not remove_only:
        m["files"] += MANIFEST_LINES
    MANIFEST.write_text(json.dumps(m, indent=1, ensure_ascii=False), encoding="utf-8")


def validate(pred, ex):
    assert pred["status"] == "model" and ex["status"] == "model"
    ny, nx = len(pred["o2_vol_pct"]), len(pred["flow_cm_s"])
    for c in pred["cases"]:
        for k in ("rate_mm_s", "lo", "hi", "verdict", "in_domain", "calibration", "regime"):
            assert len(c[k]) == ny and all(len(row) == nx for row in c[k]), (c["id"], k)
        assert set(np.ravel(c["verdict"])) <= {0, 1, 2}
    for e in ex["examples"]:
        for r in RUNS:
            assert len(e["area_cm2"][r]) == len(e["t_s"]) and set(e["summary"][r]) >= {"max_area_cm2", "t_max_s", "t_end_s",
                                                                                      "area_consumed_cm2", "stop_reason"}


def clean():
    for p in [PRED_JSON, EX_JSON, RESULTS] + [CHECKS / n for n in PLOTS]:
        if p.exists():
            p.unlink()
    update_manifest(remove_only=True)
    say("removed M6b outputs and its two manifest lines")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--clean", action="store_true")
    if ap.parse_args().clean:
        return clean()
    say("[1] Inputs")
    dr, pm, slabs, conc, film, cases, s2 = load_inputs()
    say(f"  BASS-II slabs {len(slabs)} rows; de Ris copy equals M6's column; regimes {slabs['regime'].value_counts().to_dict()}")
    say(f"  concurrent reported rows {len(conc)} (calibration {int((conc['role'] == 'calibration').sum())}); Saffire-II (PSI-99) "
        f"{s2[['sample', 'flow_cm_s', 'o2_vol_pct', 'spread_mm_s', 'burn_time_s']].to_dict('records')}")
    say(f"  placed no-spread cases {len(cases)} ({cases['status'].value_counts().to_dict()})")
    opp_res, cal_pred, f_all, opp_range = opposed(slabs)
    conc_res, K, conc_range = concurrent(conc)
    params = build_params(dr, pm, slabs, f_all, opp_range, K, conc_range, cases)
    indep = independent(params, s2, film, conc_res)
    say("\n[5] Verdict map (cells of the predictor grid per verdict)")
    pred = grid_file(params, opp_res, conc_res)
    for c in pred["cases"]:
        v = np.array(c["verdict"])
        say(f"  {c['id']:28s} spreads {int((v == 0).sum()):4d}  near {int((v == 1).sum()):3d}  observed no-spread {int((v == 2).sum()):3d}"
            f"  in-domain cells {int(np.sum(c['in_domain'])):3d}")
    checks = check_g1_g2(params)
    checks["G3"] = check_g3(params, cases)
    exs, sims, notscored = examples(params, s2)
    rng = np.random.default_rng(SEED)
    inputs = [(e["flame_state"], e["fuel"], e["conditions"]) for e in EXAMPLES] + random_inputs(rng)
    checks.update(check_g4_g5(params, inputs))
    ex_file = {"status": "model",
               "what": "M6b growth simulation for three worked examples: burning area over time (lo, mid, hi runs) and summary numbers.",
               "units": {"time": "s", "area": "cm2", "rate": "mm/s", "length": "cm"},
               "area_meaning": "projected area of one face of the fuel that is burning (ignited and not yet burned out)",
               "examples": exs,
               "limits": "Reduced-order model calibrated to NASA ISS and spacecraft data; does not reproduce real spacecraft fires. "
                         "Microgravity only. Nothing here says a material or atmosphere is safe."}
    pred, ex_file = jsonable(pred), jsonable(ex_file)
    validate(pred, ex_file)
    PRED_JSON.write_text(dumps_compact(pred), encoding="utf-8")
    EX_JSON.write_text(dumps_compact(ex_file), encoding="utf-8")
    sizes = {p.name: p.stat().st_size for p in (PRED_JSON, EX_JSON)}
    assert sizes[PRED_JSON.name] < 1_000_000, sizes
    update_manifest()
    plots(slabs, cal_pred, opp_res, conc_res, indep, sims)
    passes = {"R1": opp_res["R1_mae_le_0.033"]["pass"], "R2": opp_res["R2_coverage_ge_0.80"]["pass"],
              "R3": conc_res["R3_coverage_ge_0.80"]["pass"], "R4a": indep["R4a_both_inside"]["pass"],
              "R4b": indep["R4b_film_inside"]["pass"], **{g: checks[g]["pass"] for g in ("G1", "G2", "G3", "G4", "G5")}}
    results = jsonable({"opposed": opp_res, "concurrent": conc_res, "independent": indep, "checks": checks, "not_scored": notscored,
                        "rules": passes, "file_bytes": sizes})
    RESULTS.write_text(json.dumps(results, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    say("\n[8] Rules: " + ", ".join(f"{k} {'PASS' if v else 'MISS'}" for k, v in passes.items()))
    say(f"[done] wrote {PRED_JSON.name} ({sizes[PRED_JSON.name]} B), {EX_JSON.name} ({sizes[EX_JSON.name]} B), manifest, results.json, checks/")


if __name__ == "__main__":
    main()
