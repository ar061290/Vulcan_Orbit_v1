"""R2: how fast does the droplet burn? Burning-rate constant K (mm2/s) from NASA FLEX (PSI-69)."""
from collections import Counter
import numpy as np

from . import cv, load
from . import estimators as E
from .extinction import NAMES


def candidates():
    c = {f"d2 law x ridge (alpha={a:g})": E.D2Corrected("ridge", a) for a in (0.1, 1, 10)}
    c["d2 law x Gaussian process"] = E.D2Corrected("gp")
    return c


def nested():
    return E.Selector(candidates(), "reg")


def _summ(res, y, g):
    r2 = cv.r2_per_repeat(res, y)
    return {"mae_median": res.score,
            "mae_repeat_range": [float(np.percentile(res.per_repeat, 2.5)), float(np.percentile(res.per_repeat, 97.5))],
            "mae_session_bootstrap_95": cv.session_bootstrap(res, y, g),
            "r2_median": float(np.median(r2))}


def run(log, n_repeats):
    f = load.flex_model_frame(load.load_flex())
    f = f[f["k_mm2_s"].notna()].reset_index(drop=True)
    y, g, strat = f["k_mm2_s"].to_numpy(), f["session"].to_numpy(), f["heptane"].to_numpy()
    out = {"rows": len(f), "sessions": int(f.session.nunique()),
           "k_range": [float(y.min()), float(y.max())]}
    log(f"R2 burning rate: {len(f)} burns, K {y.min():.2f}-{y.max():.2f} mm2/s, {out['sessions']} sessions")

    head = cv.cross_val(nested, f, y, g, strat, "reg", n_repeats, importance_inputs=E.FLEX_INPUTS, log=log)
    d2 = cv.cross_val(lambda: E.D2Scaled(), f, y, g, strat, "reg", n_repeats)
    fm = cv.cross_val(lambda: E.FuelMean(), f, y, g, strat, "reg", n_repeats)
    th = cv.cross_val(lambda: E.D2Theory(), f, y, g, strat, "reg", n_repeats)
    out["headline"] = _summ(head, y, g)
    out["chosen_counts"] = dict(Counter(head.chosen))
    out["baseline_d2_scaled"] = _summ(d2, y, g)
    out["baseline_fuel_mean"] = _summ(fm, y, g)
    out["d2_textbook_no_fit"] = _summ(th, y, g)
    wins = int(np.sum((head.per_repeat < d2.per_repeat) & (head.per_repeat < fm.per_repeat)))
    out["repeats_model_beats_both"] = wins
    out["pass"] = bool(wins >= int(np.ceil(0.8 * n_repeats)))
    for k in ("headline", "baseline_d2_scaled", "baseline_fuel_mean", "d2_textbook_no_fit"):
        v = out[k]
        log(f"   {k}: MAE {v['mae_median']:.4f} mm2/s ({v['mae_session_bootstrap_95'][0]:.4f}-"
            f"{v['mae_session_bootstrap_95'][1]:.4f}), R2 {v['r2_median']:.3f}")
    log(f"   picked per outer fold: {out['chosen_counts']}")
    log(f"   PASS R2: {out['pass']} (model beats both baselines in {wins}/{n_repeats} repeats; needs "
        f"{int(np.ceil(0.8 * n_repeats))})")

    # d2-law consistency check (not a model): burn time vs (d0^2 - dext^2)/K.
    c = f[f["burn_time_s"].notna() & f["dext_mm"].notna() & (f["test_end"] == "Extinction")
          & (f["d0_mm"] > f["dext_mm"])].copy()
    t_pred = (c["d0_mm"] ** 2 - c["dext_mm"] ** 2) / c["k_mm2_s"]
    ratio = c["burn_time_s"] / t_pred
    out["consistency"] = {"rows": int(len(c)), "median_measured_over_d2": float(ratio.median()),
                          "iqr": [float(ratio.quantile(0.25)), float(ratio.quantile(0.75))]}
    log(f"   d2 consistency check on {len(c)} burns: measured burn time / (d0^2-dext^2)/K median "
        f"{ratio.median():.2f} (IQR {ratio.quantile(0.25):.2f}-{ratio.quantile(0.75):.2f})")

    pred = head.pred_median()
    resid = np.log(np.repeat(y[None, :], head.oof.shape[0], 0) / head.oof).ravel()
    q_lo, q_hi = np.percentile(resid, 2.5), np.percentile(resid, 97.5)
    out["point_interval_log_resid"] = [float(q_lo), float(q_hi)]
    cover = float(np.mean((y >= pred * np.exp(q_lo)) & (y <= pred * np.exp(q_hi))))
    out["point_interval_coverage"] = cover
    log(f"   point ranges: pred x [{np.exp(q_lo):.2f}, {np.exp(q_hi):.2f}], covering {cover:.0%} of burns")
    shares = cv.shares(head.importance, NAMES)
    out["drivers"] = shares
    out["importance_raw"] = {NAMES[k]: v for k, v in head.importance.items()}
    log(f"   drivers: {[(d['name'], round(d['share'], 3)) for d in shares]}")
    final = nested().fit(f, y, g, strat, seed=0)
    out["final_model"] = final.chosen_
    out["d2_constants_all_rows"] = {("heptane" if k else "methanol"): v for k, v in E.D2Scaled().fit(f, y).c_.items()}

    pts = []
    for i, r in f.iterrows():
        pts.append({"obs": round(float(y[i]), 4), "pred": round(float(pred[i]), 4),
                    "lo": round(float(pred[i] * np.exp(q_lo)), 4), "hi": round(float(pred[i] * np.exp(q_hi)), 4),
                    "label": f"{r.test_id}: {r.fuel}, O2 {r.x_o2:.2f}, CO2 {r.x_co2:.2f}, He {r.x_he:.2f}, "
                             f"{r.p_atm:.2f} atm, d0 {r.d0_mm:.2f} mm"})
    picked = ", ".join(f"{k} {v / len(head.chosen):.0%}" for k, v in Counter(head.chosen).most_common())
    entry = {
        "id": "m7-burning-rate",
        "name": "Droplet burning rate (FLEX)",
        "question": "How fast does a burning fuel droplet shrink, in this atmosphere?",
        "data": (f"NASA FLEX, PSI-69 (doi:10.60555/mbq8-0451): {len(f)} methanol and n-heptane droplet burns with a "
                 "measured burning-rate constant K = -d(D^2)/dt."),
        "method": ("Textbook d-squared law (K proportional to gas conductivity/heat capacity times ln(1+B), constants "
                   "from NIST, one scale factor per fuel) multiplied by a learned correction chosen inside every "
                   "training split. Picked: " + picked + "."),
        "validation": (f"Whole test sessions held out: 5-fold grouped by ISS test date ({out['sessions']} dates), "
                       f"repeated {n_repeats} times. Score = median MAE; range = 95% session bootstrap."),
        "metric": "MAE (mm²/s, lower is better)",
        "score": round(out["headline"]["mae_median"], 4),
        "score_range": [round(v, 4) for v in out["headline"]["mae_session_bootstrap_95"]],
        "baseline_name": "d-squared law (one constant per fuel)",
        "baseline_score": round(out["baseline_d2_scaled"]["mae_median"], 4),
        "unit": "mm²/s",
        "points": pts,
        "drivers": [{"name": d["name"], "share": round(d["share"], 4)} for d in shares],
        "limits": (f"Two fuels and the FLEX test range only. R² on held-out sessions {out['headline']['r2_median']:.2f} "
                   f"(d-squared law {out['baseline_d2_scaled']['r2_median']:.2f}). The textbook law with no fitted "
                   f"constant is off by a mean {out['d2_textbook_no_fit']['mae_median']:.2f} mm²/s. Burning rate says how "
                   "fast fuel is consumed, not whether a fire is dangerous."),
    }
    return entry, out
