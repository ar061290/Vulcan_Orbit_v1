#!/usr/bin/env python3
"""Rebuild every M7 output from datasets/.

    python models/m7-extinction/build.py            # writes data/flex_suppression.json, M7 entries in data/models.json
    python models/m7-extinction/build.py --clean    # first removes M7's outputs (only M7 entries of models.json)

Also writes models/m7-extinction/results.json (every number quoted in README.md and REPORT.md) and the
check plots in models/m7-extinction/checks/. Rules: models/m7-extinction/RULES.md.
"""
import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

# One BLAS thread per process: the CV runs folds in parallel processes, and single-threaded linear algebra
# keeps floating-point sums in a fixed order, so a rebuild gives byte-identical outputs.
for _v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ.setdefault(_v, "1")

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import numpy as np  # noqa: E402

from m7 import burning_rate, contract_check, cool_flame, extinction, load, outputs  # noqa: E402
from m7 import estimators as E  # noqa: E402

RESULTS_JSON = HERE / "results.json"
CHECKS = HERE / "checks"

# Reference categorical palette (dataviz skill, light mode), slots 1-3; validated with validate_palette.js.
BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
INK, INK2, MUTED, SURFACE = "#0b0b0b", "#52514e", "#898781", "#fcfcfb"


def log(s):
    print(s, flush=True)


def _clean(obj):
    """Drop private keys (fitted models) and make everything JSON-safe."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items() if not str(k).startswith("_")}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, float):
        return round(obj, 6)
    return obj


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


# --------------------------------------------------------------------------------- check plots
def _style(ax):
    ax.set_facecolor(SURFACE)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(MUTED)
    ax.tick_params(colors=INK2, labelsize=9)
    ax.grid(True, color="#e6e5e1", linewidth=0.8)
    ax.set_axisbelow(True)


def plots(ext_entry, ext_out, k_entry, cf_entry, cf_out):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from sklearn.metrics import roc_curve
    CHECKS.mkdir(exist_ok=True)
    plt.rcParams.update({"font.size": 10, "text.color": INK, "axes.labelcolor": INK2, "figure.facecolor": SURFACE})

    # 1. Extinction: ROC (out-of-fold) and calibration.
    obs = np.array([p["obs"] for p in ext_entry["points"]]); pr = np.array([p["pred"] for p in ext_entry["points"]])
    fig, (a, b) = plt.subplots(1, 2, figsize=(9, 4))
    fpr, tpr, _ = roc_curve(obs, pr)
    a.plot([0, 1], [0, 1], color=MUTED, lw=1, ls=":")
    a.plot(fpr, tpr, color=BLUE, lw=2)
    a.set(xlabel="False-alarm rate", ylabel="Hit rate", title=f"Extinction, held-out sessions: AUC {ext_entry['score']:.2f}")
    bins = np.linspace(0, 1, 6); idx = np.clip(np.digitize(pr, bins) - 1, 0, 4)
    xs = [pr[idx == i].mean() for i in range(5) if (idx == i).any()]
    ys = [obs[idx == i].mean() for i in range(5) if (idx == i).any()]
    ns = [(idx == i).sum() for i in range(5) if (idx == i).any()]
    b.plot([0, 1], [0, 1], color=MUTED, lw=1, ls=":")
    b.plot(xs, ys, color=BLUE, lw=2, marker="o", ms=8, mec=SURFACE, mew=2)
    for x, y_, n in zip(xs, ys, ns):
        b.annotate(f"n={n}", (x, y_), textcoords="offset points", xytext=(6, -12), fontsize=8, color=INK2)
    b.set(xlabel="Predicted chance of extinction", ylabel="Observed share extinguished", title="Calibration (5 bins)")
    for ax in (a, b):
        _style(ax)
    fig.tight_layout(); fig.savefig(CHECKS / "extinction_roc_calibration.png", dpi=120); plt.close(fig)

    # 2. Extinction: chance vs O2 for a 3 mm droplet at 1 atm (final model fitted on all burns).
    final = ext_out["_final"]
    o2 = np.linspace(0.12, 0.34, 89)
    fig, axes = plt.subplots(1, 2, figsize=(9, 4), sharey=True)
    for ax, fuel in zip(axes, ("methanol", "heptane")):
        for name, co2, he, col, level in (("no added gas", 0, 0, BLUE, 0.25), ("20% CO2", 0.2, 0, ORANGE, 0.5),
                                          ("20% He", 0, 0.2, AQUA, 0.75)):
            import pandas as pd
            X = pd.DataFrame({"x_o2": o2, "x_co2": co2, "x_he": he, "p_atm": 1.0, "d0_mm": 3.0,
                              "heptane": 1 if fuel == "heptane" else 0})
            p = E.predict(final, X)
            ax.plot(o2 * 100, p, color=col, lw=2, label=name)
            i = int(np.argmin(np.abs(p - level)))  # each label at its own height on its own curve: no collisions
            ax.annotate(name, (o2[i] * 100, p[i]), textcoords="offset points", xytext=(7, 2), fontsize=8, color=INK2)
        ax.axhline(0.5, color=MUTED, lw=1, ls=":")
        ax.set(xlabel="Oxygen, % by volume", title=f"{fuel}, 3 mm droplet, 1 atm", xlim=(12, 35))
        _style(ax)
    axes[0].set_ylabel("Predicted chance of extinction")
    axes[0].legend(frameon=False, fontsize=8, loc="lower left")
    fig.suptitle("Model output inside the FLEX test range; not a safety limit", fontsize=9, color=INK2)
    fig.tight_layout(); fig.savefig(CHECKS / "extinction_vs_o2.png", dpi=120); plt.close(fig)

    # 3. Burning rate: observed vs predicted (held-out sessions).
    ob = np.array([p["obs"] for p in k_entry["points"]]); pk = np.array([p["pred"] for p in k_entry["points"]])
    lo = np.array([p["lo"] for p in k_entry["points"]]); hi = np.array([p["hi"] for p in k_entry["points"]])
    fig, ax = plt.subplots(figsize=(5, 5))
    m = max(ob.max(), hi.max()) * 1.05
    ax.plot([0, m], [0, m], color=MUTED, lw=1, ls=":")
    ax.vlines(ob, lo, hi, color=BLUE, alpha=0.25, lw=1)
    ax.scatter(ob, pk, s=22, color=BLUE, edgecolor=SURFACE, linewidth=1)
    ax.set(xlim=(0, m), ylim=(0, m), xlabel="Observed K, mm²/s", ylabel="Predicted K, mm²/s",
           title=f"Burning rate, held-out sessions: MAE {k_entry['score']:.3f} mm²/s")
    _style(ax)
    fig.tight_layout(); fig.savefig(CHECKS / "burning_rate_obs_pred.png", dpi=120); plt.close(fig)

    # 4. Cool flame: share of burns used up, by pressure (air only), plus the model curve.
    if cf_entry:
        rows = [b for b in cf_out["observed"]["end_state_by_pressure_and_helium"] if b["x_he"] == 0]
        ps = np.array([b["p_atm"] for b in rows]); share = np.array([b["used_up"] / b["burns"] for b in rows])
        fig, ax = plt.subplots(figsize=(6, 4))
        ax.bar(np.arange(len(ps)), share, width=0.6, color=BLUE, edgecolor=SURFACE, linewidth=2)
        for i, bb in enumerate(rows):
            ax.annotate(f"{bb['used_up']}/{bb['burns']}", (i, share[i]), textcoords="offset points", xytext=(0, 4),
                        ha="center", fontsize=8, color=INK2)
        ax.set_xticks(np.arange(len(ps)), [f"{p:g}" for p in ps])
        ax.set(xlabel="Pressure, atm (no helium)", ylabel="Share of burns where the droplet was used up", ylim=(0, 1.1),
               title="CFI: after the visible flame went out (observed counts)")
        _style(ax)
        fig.tight_layout(); fig.savefig(CHECKS / "cool_flame_by_pressure.png", dpi=120); plt.close(fig)


# --------------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--clean", action="store_true", help="remove M7 outputs before rebuilding")
    ap.add_argument("--repeats", type=int, default=20, help="outer CV repeats (RULES.md: 20)")
    a = ap.parse_args()
    t0 = time.time()
    if a.clean:
        outputs.remove_m7_outputs()
        log("removed data/flex_suppression.json and the M7 entries of data/models.json")

    flex = load.load_flex()
    t = time.time(); e_ext, r_ext = extinction.run(log, a.repeats); log(f"   [{time.time() - t:.0f} s]")
    t = time.time(); e_k, r_k = burning_rate.run(log, a.repeats); log(f"   [{time.time() - t:.0f} s]")
    t = time.time(); e_cf, r_cf = cool_flame.run(log, a.repeats); log(f"   [{time.time() - t:.0f} s]")
    entries = [e for e in (e_ext, e_k, e_cf) if e]

    supp = outputs.suppression(flex)
    log("R4 suppressant counts: " + "; ".join(f"{g['gas']}: {g['extinguished']}/{g['tests']}" for g in supp["groups"]))
    models_doc = outputs.merge_models(entries)
    contract_check.check_models(models_doc, only_ids=outputs.M7_IDS)   # other features (e.g. M5) may extend their own entries
    contract_check.check_suppression(supp)
    caught = contract_check.selftest(models_doc, supp, outputs.M7_IDS)
    log(f"contract: both files match CONTRACT.md; self-test rejected all {len(caught)} broken copies")
    outputs.MODELS_JSON.write_bytes(outputs.models_dumps(models_doc).encode("utf-8"))
    outputs.write(outputs.SUPPRESSION_JSON, supp)
    outputs.update_manifest()

    results = _clean({"repeats": a.repeats, "decisions": load.DECISIONS, "extinction": r_ext, "burning_rate": r_k,
                      "cool_flame": r_cf, "suppression": supp, "contract_selftest_rejected": caught})
    RESULTS_JSON.write_bytes(json.dumps(results, indent=1, ensure_ascii=False).encode("utf-8"))
    plots(e_ext, r_ext, e_k, e_cf, r_cf)

    log("\nDecisions:")
    for d in load.DECISIONS:
        log(f" - {d}")
    log("\nOutputs (sha256):")
    for p in (outputs.MODELS_JSON, outputs.SUPPRESSION_JSON, outputs.MANIFEST_JSON, RESULTS_JSON):
        log(f"  {sha(p)}  {p.relative_to(load.ROOT)}")
    log(f"\nHeadline: extinction AUC {e_ext['score']:.3f} ({e_ext['score_range'][0]:.3f}-{e_ext['score_range'][1]:.3f}) vs "
        f"{e_ext['baseline_name']} {e_ext['baseline_score']:.3f}; PASS R1 {r_ext['pass']}")
    log(f"          burning rate MAE {e_k['score']:.4f} mm2/s ({e_k['score_range'][0]:.4f}-{e_k['score_range'][1]:.4f}) vs "
        f"d2 law {e_k['baseline_score']:.4f}; PASS R2 {r_k['pass']}")
    if e_cf:
        log(f"          cool-flame end state AUC {e_cf['score']:.3f} ({e_cf['score_range'][0]:.3f}-{e_cf['score_range'][1]:.3f}) vs "
            f"{e_cf['baseline_name']} {e_cf['baseline_score']:.3f}; PASS R3 {r_cf['pass']}")
    log(f"built in {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
