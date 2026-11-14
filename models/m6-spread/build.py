"""M6 flame spread (NASA BASS-II): de Ris physics baseline + learned correction, grouped validation.

    python models/m6-spread/build.py            # rebuild everything
    python models/m6-spread/build.py --clean    # delete M6's outputs only (the m6 entry, bass2_clean.csv, ...), then exit

Reads   datasets/psi/PSI-25/PSI-25_Experimental table_BASS-II.csv           (NASA PSI-25, test conditions, sessions, O2)
        models/m6-spread/source/table5_1_transcribed.csv                     (spread rates, NASA/TM-20210011385 Table 5.1)
        models/m6-spread/source/properties.csv                               (de Ris coefficients, reported)
        models/m6-spread/source/no_spread_reported.csv                       (report Tables 7.1 and 2.1, reported)
Writes  data/models.json (only the entry with id "m6"), data/manifest.json ("models" line),
        models/m6-spread/bass2_clean.csv, no_spread_cases.csv, results.json, checks/obs_pred.png
Rules   models/m6-spread/RULES.md (written and committed before any fitting).
"""
import argparse
import copy
import json
import math
import re
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.exceptions import ConvergenceWarning
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, ConstantKernel, WhiteKernel
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PSI25_CSV = ROOT / "datasets" / "psi" / "PSI-25" / "PSI-25_Experimental table_BASS-II.csv"
TABLE51 = HERE / "source" / "table5_1_transcribed.csv"
PROPS = HERE / "source" / "properties.csv"
REPORTED_NOSPREAD = HERE / "source" / "no_spread_reported.csv"
MODELS_JSON = ROOT / "data" / "models.json"
MANIFEST_JSON = ROOT / "data" / "manifest.json"
CLEAN_CSV = HERE / "bass2_clean.csv"
NOSPREAD_CSV = HERE / "no_spread_cases.csv"
RESULTS_JSON = HERE / "results.json"
PLOT = HERE / "checks" / "obs_pred.png"
M6_ID = "m6"
SEED = 0
N_BOOT = 2000
N_PERM = 50
N_TARGET_SHUFFLE = 20

INPUTS = ["thickness_mm", "width_cm", "sides_burning", "velocity_cm_s", "o2_vol_pct"]
INPUT_NAMES = {"thickness_mm": "Fuel thickness", "width_cm": "Sample width", "sides_burning": "One or two sides burning",
               "velocity_cm_s": "Opposed-flow speed", "o2_vol_pct": "Oxygen"}
NEVER_INPUTS = {"spread_mm_s", "burn_time_min", "test", "sample", "session", "segment", "o2_initial_vol_pct", "o2_final_vol_pct"}
CANDIDATES = ["a_calibrated_deris", "b_linear", "c_gp", "d_gbt"]
CAND_NAMES = {"a_calibrated_deris": "de Ris x one fitted constant", "b_linear": "de Ris x linear-regression correction",
              "c_gp": "de Ris x Gaussian-process correction", "d_gbt": "de Ris x small gradient-boosted-tree correction"}


def r4(x):
    return None if x is None else float(round(float(x), 4))


def say(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------- 1. data
def load_props():
    p = pd.read_csv(PROPS, comment="#")
    v = {r["name"]: r["value"] for _, r in p.iterrows() if pd.notna(r["value"])}
    return {k: float(v[k]) for k in ("c_thin", "c_thick", "F_adb_21", "T_v", "T_inf")}


def load_psi25():
    d = pd.read_csv(PSI25_CSV)
    d.columns = [re.sub(r"\s+", " ", c).strip() for c in d.columns]
    return d


def load_table51(psi):
    t = pd.read_csv(TABLE51, comment="#")
    miller = psi[psi["Test #"].str.fullmatch(r"M\d+")].set_index("Test #")
    assert set(t["test"]) == set(miller.index) and len(miller) == 20, "Table 5.1 tests != PSI-25 Miller tests M1-M20"
    # Cross-check 1: O2 at start and end of every test must match NASA's PSI table exactly.
    for test, g in t.groupby("test"):
        row = miller.loc[test]
        o2i, o2f = float(row["Calibrated initial O2 % by vol"]), float(row["Calibrated final O2 % by vol"])
        assert math.isclose(o2i, g["o2_initial_vol_pct"].iloc[0]) and math.isclose(o2f, g["o2_final_vol_pct"].iloc[0]), \
            f"{test}: O2 in Table 5.1 transcription differs from PSI-25"
        # Cross-check 2: thickness and width written in the PSI fuel text must not contradict the table.
        text = row["Fuel Sample Material"].lower()
        th = re.search(r"(\d+)\s*mm", text)
        assert th and int(th.group(1)) == int(g["thickness_mm"].iloc[0]), f"{test}: thickness differs from PSI text '{text}'"
        wd = re.search(r"(\d+)\s*cm", text)
        assert wd and {1: 1.2, 2: 2.2}[int(wd.group(1))] == g["width_cm"].iloc[0], f"{test}: width differs from PSI text '{text}'"
    t["session"] = t["test"].map(lambda k: f"GMT{int(miller.loc[k, 'GMT'])}")
    t["date"] = t["test"].map(lambda k: miller.loc[k, "Date"])
    t["sample"] = t["test"].map(lambda k: str(miller.loc[k, "Sample #"]))
    assert t.groupby("test")["sample"].nunique().eq(1).all() and t.drop_duplicates("test")["sample"].is_unique, \
        "a Miller sample is shared between tests"
    # Segment O2: linear decay in time, equal-duration segments (RULES.md "Data").
    frac = (t["segment"] - 0.5) / t["n_segments"]
    t["o2_vol_pct"] = t["o2_initial_vol_pct"] + frac * (t["o2_final_vol_pct"] - t["o2_initial_vol_pct"])
    return t


# ---------------------------------------------------------------- 2. physics baseline
def o2_mass_fraction(x):
    return 32.0 * x / (32.0 * x + 28.0 * (1.0 - x))


def flame_coefficient(o2_vol_pct, P):
    """F = (Tf - Tv)/(Tv - Tinf); Tf fixed by F_adb at 21% O2, Tf - Tinf scaled with O2 mass fraction (flame sheet)."""
    tf21 = P["T_v"] + P["F_adb_21"] * (P["T_v"] - P["T_inf"])
    tf = P["T_inf"] + (tf21 - P["T_inf"]) * o2_mass_fraction(np.asarray(o2_vol_pct) / 100.0) / o2_mass_fraction(0.21)
    return (tf - P["T_v"]) / (P["T_v"] - P["T_inf"]), tf21


def de_ris(df, P):
    """Spread rate in mm/s. tau = burning half-thickness (m): half the slab if two-sided, the whole slab if one-sided."""
    F, _ = flame_coefficient(df["o2_vol_pct"], P)
    tau = np.where(df["sides_burning"] == 2, df["thickness_mm"] / 2.0, df["thickness_mm"]) / 1000.0
    vg = df["velocity_cm_s"].to_numpy() / 100.0
    thin = P["c_thin"] * F / tau
    thick = P["c_thick"] * vg * F ** 2
    tau_cr = P["c_thin"] * F / (P["c_thick"] * vg * F ** 2)
    regime = np.where(tau < tau_cr, "thin", "thick")
    vf = np.where(regime == "thin", thin, thick)
    assert np.allclose(vf, np.maximum(thin, thick))
    return vf * 1000.0, regime, F, tau, tau_cr


# ---------------------------------------------------------------- 3. correction models
def features(df, kind):
    if kind == "log":
        return np.column_stack([np.log(df["thickness_mm"]), np.log(df["velocity_cm_s"]), df["o2_vol_pct"],
                                df["sides_burning"], df["width_cm"]])
    return df[["thickness_mm", "velocity_cm_s", "o2_vol_pct", "sides_burning", "width_cm"]].to_numpy(float)


def make_model(name):
    if name == "b_linear":
        return make_pipeline(StandardScaler(), LinearRegression()), "log"
    if name == "c_gp":
        k = ConstantKernel(1.0, (1e-3, 1e3)) * RBF(np.ones(5), (1e-2, 1e3)) + WhiteKernel(0.1, (1e-5, 1e1))
        return make_pipeline(StandardScaler(), GaussianProcessRegressor(k, normalize_y=True, n_restarts_optimizer=3,
                                                                        random_state=SEED)), "log"
    if name == "d_gbt":
        return GradientBoostingRegressor(n_estimators=100, max_depth=2, learning_rate=0.05, subsample=0.8,
                                         random_state=SEED), "raw"
    raise ValueError(name)


def fit_predict(name, train, test, P):
    """Return predicted spread rate (mm/s) for `test`, fitted on `train` only."""
    base_tr = de_ris(train, P)[0]
    base_te = de_ris(test, P)[0]
    r = np.log(train["spread_mm_s"].to_numpy() / base_tr)
    if name == "a_calibrated_deris":
        return base_te * math.exp(r.mean())
    model, kind = make_model(name)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", ConvergenceWarning)
        model.fit(features(train, kind), r)
    return base_te * np.exp(model.predict(features(test, kind)))


def folds(df, group_col):
    for g in sorted(df[group_col].unique()):
        te = df[group_col] == g
        # Asserted on every fold: the held-out group, and every test inside it, never appears in training.
        for col in {group_col, "test"}:
            assert not set(df.loc[~te, col]) & set(df.loc[te, col]), f"{col} on both sides of a split"
        yield g, ~te.to_numpy(), te.to_numpy()


def oof(df, name, group_col, P):
    pred = np.full(len(df), np.nan)
    for _, tr, te in folds(df, group_col):
        pred[te] = fit_predict(name, df[tr], df[te], P)
    assert np.isfinite(pred).all()
    return pred


def session_bootstrap(df, pred, metric, rng):
    sessions = df["session"].unique()
    idx = {s: np.flatnonzero(df["session"].to_numpy() == s) for s in sessions}
    y = df["spread_mm_s"].to_numpy()
    vals = []
    while len(vals) < N_BOOT:
        pick = np.concatenate([idx[s] for s in rng.choice(sessions, len(sessions), replace=True)])
        if np.ptp(y[pick]) == 0:
            continue
        vals.append(metric(y[pick], pred[pick]))
    return [float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))]


# ---------------------------------------------------------------- 4. flammability view
FLAG = re.compile(r"(ext\b|extingu\w*|blow\s*off|blowoff|no ign\w*|would not stay lit|\bout\b)", re.I)
GEOMETRY = {  # quoted from the BASS-II ReadMe (Test Matrix explanation)
    "Bhattacharjee": "very thin PMMA films (opposed flow)",
    "Ferkul": "Nomex III and a candle",
    "Miller": "thick PMMA slabs, one or two sided (opposed flow)",
    "Olson": "PMMA rods ignited at the upstream end (stagnation / concurrent flow)",
    "Fernandez-Pello": "PMMA rods ignited at the downstream end (opposed flow)",
    "T'ien": "SIBAL fabric (concurrent flow) and a PMMA spherical section",
}


def _txt(v):
    return "" if pd.isna(v) else re.sub(r"\s+", " ", str(v)).strip()


def _o2_note(o2i, o2f):
    """Flag O2 readings that cannot be right as printed (kept as printed, never corrected)."""
    vals = []
    for v in (o2i, o2f):
        try:
            vals.append(float(v))
        except (TypeError, ValueError):
            return "an O2 reading is missing in the PSI table"
    return "an O2 reading is implausible as printed in the PSI table" if any(v < 10 or v > 25 for v in vals) else ""


def no_spread_cases(psi):
    """RULES F: observed cases only, words as written; nothing is extrapolated."""
    rows = []
    for _, r in psi.iterrows():
        text = " | ".join(_txt(r[c]) for c in ("Fan display", "Air display"))
        words = sorted({m.group(0).lower() for m in FLAG.finditer(text)})
        if words:
            o2i, o2f = r["Calibrated initial O2 % by vol"], r["Calibrated final O2 % by vol"]
            rows.append({"status": "real", "source": "PSI-25 Experimental table", "test": r["Test #"],
                         "pi_and_geometry": f"{r['PI']}: {GEOMETRY.get(r['PI'], '')}", "fuel": _txt(r["Fuel Sample Material"]),
                         "flow": "Air display (cm/s), as written: " + (_txt(r["Air display"]) or "blank"),
                         "fan_display_as_written": _txt(r["Fan display"]),
                         "o2_vol_pct": f"{_txt(o2i)} to {_txt(o2f)}", "o2_note": _o2_note(o2i, o2f),
                         "outcome": "flow text records: " + ", ".join(words)})
    rep = pd.read_csv(REPORTED_NOSPREAD, comment="#", dtype=str)
    for _, r in rep.iterrows():
        rows.append({"status": "reported", "source": f"NASA/TM-20210011385 Table {r['table']}", "test": r["test"],
                     "pi_and_geometry": f"{r['fuel']}, {r['flow_direction']} flow, {r['width_cm']} cm wide", "fuel": r["fuel"],
                     "flow": f"{r['flow_cm_s']} cm/s", "fan_display_as_written": "", "o2_vol_pct": r["o2_vol_pct"],
                     "o2_note": "", "outcome": r["outcome"]})
    return pd.DataFrame(rows)


# ---------------------------------------------------------------- 5. contract
MODEL_KEYS = ["id", "name", "question", "data", "method", "validation", "metric", "score", "score_range",
              "baseline_name", "baseline_score", "unit", "points", "drivers", "limits"]
STATUSES = {"real", "dome", "model", "reported", "demo", "plan", "team"}


def check_entry(doc, only_id):
    """CONTRACT.md models.json: {status, models:[{id, name, ..., points:[{obs,pred,lo,hi,label}], drivers:[{name,share}], limits}]}"""
    def req(c, m):
        if not c:
            raise AssertionError(m)

    def num(v, w):
        req(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v), f"{w}: not a finite number")
    req(isinstance(doc, dict) and set(doc) == {"status", "models"}, "models.json: top-level keys")
    req(doc["status"] in STATUSES, "models.json: status")
    ids = [m.get("id") for m in doc["models"]]
    req(len(ids) == len(set(ids)), "models.json: duplicate ids")
    m = next(m for m in doc["models"] if m.get("id") == only_id)
    req(set(m) == set(MODEL_KEYS), f"keys {sorted(m)}")
    for k in ("id", "name", "question", "data", "method", "validation", "metric", "baseline_name", "unit", "limits"):
        req(isinstance(m[k], str) and m[k].strip(), f"{k} must be a non-empty string")
    num(m["score"], "score")
    num(m["baseline_score"], "baseline_score")
    req(isinstance(m["score_range"], list) and len(m["score_range"]) == 2, "score_range")
    for v in m["score_range"]:
        num(v, "score_range")
    req(m["score_range"][0] <= m["score_range"][1], "score_range lo > hi")
    req(isinstance(m["points"], list) and m["points"], "points")
    for p in m["points"]:
        req(set(p) == {"obs", "pred", "lo", "hi", "label"}, "point keys")
        for k in ("obs", "pred", "lo", "hi"):
            num(p[k], f"point.{k}")
        req(p["lo"] <= p["pred"] <= p["hi"], "pred outside [lo, hi]")
        req(isinstance(p["label"], str), "label")
    req(isinstance(m["drivers"], list) and m["drivers"], "drivers")
    for d in m["drivers"]:
        req(set(d) == {"name", "share"}, "driver keys")
        num(d["share"], "share")
        req(0 <= d["share"] <= 1, "share outside 0-1")
    req(abs(sum(d["share"] for d in m["drivers"]) - 1) < 0.01, "shares do not sum to 1")


def contract_selftest(doc):
    breaks = [lambda m: m.update(extra=1), lambda m: m.pop("drivers"), lambda m: m.update(score=float("nan")),
              lambda m: m["points"][0].update(lo=1e6, hi=2e6), lambda m: m["drivers"][0].update(share=5.0)]
    for b in breaks:
        bad = copy.deepcopy(doc)
        b(next(m for m in bad["models"] if m["id"] == M6_ID))
        try:
            check_entry(bad, M6_ID)
        except AssertionError:
            continue
        raise AssertionError("contract self-test: a broken copy was not rejected")
    return len(breaks)


def dumps(obj):
    return json.dumps(obj, indent=1, ensure_ascii=False)


def merge_models(entry):
    """Replace only the m6 entry; keep every other entry, its content and its position."""
    doc = json.loads(MODELS_JSON.read_bytes().decode("utf-8")) if MODELS_JSON.exists() else {"status": "real", "models": []}
    if doc.get("status") != "real":
        raise SystemExit(f"data/models.json status is '{doc.get('status')}', not 'real'; agree it with the team first.")
    models = doc["models"]
    pos = next((i for i, m in enumerate(models) if m.get("id") == M6_ID), None)
    if pos is None:
        models.append(entry)
    else:
        models[pos] = entry
    return doc


def clean():
    for p in (CLEAN_CSV, NOSPREAD_CSV, RESULTS_JSON, PLOT):
        if p.exists():
            p.unlink()
    if MODELS_JSON.exists():
        doc = json.loads(MODELS_JSON.read_bytes().decode("utf-8"))
        doc["models"] = [m for m in doc["models"] if m.get("id") != M6_ID]
        MODELS_JSON.write_bytes(dumps(doc).encode("utf-8"))
    say("removed M6 outputs (the m6 entry in data/models.json, bass2_clean.csv, no_spread_cases.csv, results.json, plot)")


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--clean", action="store_true")
    if ap.parse_args().clean:
        return clean()
    np.random.seed(SEED)
    P = load_props()
    psi = load_psi25()
    allrows = load_table51(psi)
    df = allrows[allrows["spread_mm_s"].notna()].reset_index(drop=True)
    say(f"[data] Table 5.1: {len(allrows)} (test, velocity) pairs, {len(df)} with a spread rate, "
        f"{df['test'].nunique()} tests, {df['session'].nunique()} sessions; O2 and thickness/width cross-checked with PSI-25")
    assert not set(INPUTS) & NEVER_INPUTS
    y = df["spread_mm_s"].to_numpy()

    # Baseline (no fitting)
    base, regime, F, tau, tau_cr = de_ris(df, P)
    _, tf21 = flame_coefficient([21.0], P)
    say(f"[de Ris] Tf(21% O2) = {float(np.atleast_1d(tf21)[0]):.0f} K; F range {F.min():.2f}-{F.max():.2f}; "
        f"regime thin={int((regime == 'thin').sum())} thick={int((regime == 'thick').sum())}; "
        f"median obs/deRis = {np.median(y / base):.3f}")
    res = {"baseline": {"r2": r2_score(y, base), "mae": mean_absolute_error(y, base)}}
    rng = np.random.default_rng(SEED)
    res["baseline"]["r2_range"] = session_bootstrap(df, base, r2_score, rng)
    res["baseline"]["mae_range"] = session_bootstrap(df, base, mean_absolute_error, np.random.default_rng(SEED))

    # Candidates under both splits
    preds = {}
    for split in ("session", "test"):
        for c in CANDIDATES:
            p = oof(df, c, split, P)
            preds[(split, c)] = p
            res.setdefault(split, {})[c] = {
                "r2": r2_score(y, p), "mae": mean_absolute_error(y, p),
                "r2_range": session_bootstrap(df, p, r2_score, np.random.default_rng(SEED)),
                "mae_range": session_bootstrap(df, p, mean_absolute_error, np.random.default_rng(SEED))}
    say("[scores] held-out R2 / MAE (mm/s), primary = leave one session out:")
    say(f"   de Ris (no fit)                      R2 {res['baseline']['r2']:7.3f} {np.round(res['baseline']['r2_range'], 3)}"
        f"  MAE {res['baseline']['mae']:.4f}")
    for c in CANDIDATES:
        s, t = res["session"][c], res["test"][c]
        say(f"   {CAND_NAMES[c]:45s} session R2 {s['r2']:6.3f} {np.round(s['r2_range'], 3)} MAE {s['mae']:.4f}"
            f" | test R2 {t['r2']:6.3f} MAE {t['mae']:.4f}")

    # Model choice (RULES C)
    best = max(CANDIDATES, key=lambda c: res["session"][c]["r2"])
    floor = res["session"][best]["r2_range"][0]
    final = next(c for c in CANDIDATES if res["session"][c]["r2"] >= floor)
    say(f"[choice] best = {best} (R2 {res['session'][best]['r2']:.3f}, lower bound {floor:.3f}); final = {final}")
    fp = preds[("session", final)]
    fs = res["session"][final]

    # Point ranges
    logres = np.log(y / fp)
    q_lo, q_hi = np.percentile(logres, [2.5, 97.5])
    lo, hi = np.minimum(fp * math.exp(q_lo), fp), np.maximum(fp * math.exp(q_hi), fp)
    coverage = float(np.mean((y >= lo) & (y <= hi)))

    # Drivers (RULES D): permute an input over all rows, predict each row with its own held-out fold model
    fold_models = {}
    for g, tr, te in folds(df, "session"):
        fold_models[g] = df[tr].copy()
    sess = df["session"].to_numpy()

    def predict_with_folds(frame):
        out = np.empty(len(frame))
        for g, train in fold_models.items():
            m = sess == g
            out[m] = fit_predict(final, train, frame[m], P)
        return out
    base_mae = mean_absolute_error(y, predict_with_folds(df))
    assert math.isclose(base_mae, fs["mae"], rel_tol=1e-9)
    prng = np.random.default_rng(SEED)
    rise = {}
    for col in INPUTS:
        vals = []
        for _ in range(N_PERM):
            shuffled = df.copy()
            shuffled[col] = prng.permutation(df[col].to_numpy())
            vals.append(mean_absolute_error(y, predict_with_folds(shuffled)) - base_mae)
        rise[col] = max(0.0, float(np.mean(vals)))
    tot = sum(rise.values())
    shares = {c: (rise[c] / tot if tot > 0 else 1 / len(INPUTS)) for c in INPUTS}
    rounded = {c: round(shares[c], 4) for c in INPUTS}
    top = max(rounded, key=rounded.get)
    rounded[top] = round(rounded[top] + 1 - sum(rounded.values()), 4)
    drivers = sorted(({"name": INPUT_NAMES[c], "share": rounded[c]} for c in INPUTS), key=lambda d: -d["share"])
    say("[drivers] " + ", ".join(f"{d['name']} {d['share']:.3f}" for d in drivers))

    # Leakage (RULES L)
    leak = {"group_disjoint_asserted_every_fold": True,
            "inputs": INPUTS, "inputs_encoding_spread_rate": sorted(set(INPUTS) & NEVER_INPUTS),
            "triggered": bool(max(res[s][c]["r2"] for s in ("session", "test") for c in CANDIDATES) > 0.90)}
    if leak["triggered"]:
        trng = np.random.default_rng(SEED)
        vals = []
        for _ in range(N_TARGET_SHUFFLE):
            sh = df.copy()
            sh["spread_mm_s"] = trng.permutation(y)
            vals.append(r2_score(sh["spread_mm_s"], oof(sh, final, "session", P)))
        leak["target_shuffle_mean_r2"] = float(np.mean(vals))
    say(f"[leakage] triggered={leak['triggered']}; inputs that encode the spread rate: {leak['inputs_encoding_spread_rate'] or 'none'}")

    # Pass rules
    a = res["session"]["a_calibrated_deris"]
    rules = {
        "P1_r2_ge_0.60": {"value": r4(fs["r2"]), "pass": bool(fs["r2"] >= 0.60)},
        "P2_beats_de_ris": {"mae": [r4(fs["mae"]), r4(res["baseline"]["mae"])], "r2": [r4(fs["r2"]), r4(res["baseline"]["r2"])],
                            "pass": bool(fs["mae"] < res["baseline"]["mae"] and fs["r2"] > res["baseline"]["r2"])},
        "P3_learned_part": ({"pass": None, "note": "not applicable: no learned shape kept"} if final == "a_calibrated_deris" else
                            {"r2_final": r4(fs["r2"]), "r2_calibrated_deris": r4(a["r2"]), "pass": bool(fs["r2"] > a["r2"])}),
        "P4_range": {"range": [r4(v) for v in fs["r2_range"]], "weak_lower_bound": bool(fs["r2_range"][0] < 0.3)},
    }
    say("[rules] " + "; ".join(f"{k}: {v.get('pass')}" for k, v in rules.items() if "pass" in v)
        + f"; P4 lower bound {fs['r2_range'][0]:.3f}")

    # Flammability view
    ns = no_spread_cases(psi)
    ns.to_csv(NOSPREAD_CSV, index=False, lineterminator="\n")
    say(f"[flammability] {int((ns['status'] == 'real').sum())} PSI-25 tests whose flow text records extinction/blow-off/no ignition; "
        f"{int((ns['status'] == 'reported').sum())} reported cases from report Tables 7.1 and 2.1 -> {NOSPREAD_CSV.name}")

    # Handoff table for the flame simulation
    out = allrows.copy()
    out_base, out_regime = de_ris(out, P)[:2]
    out["de_ris_mm_s"] = np.round(out_base, 5)
    out["de_ris_regime"] = out_regime
    out["burning_half_thickness_mm"] = np.where(out["sides_burning"] == 2, out["thickness_mm"] / 2, out["thickness_mm"])
    out["o2_vol_pct"] = out["o2_vol_pct"].round(3)
    out["flow_direction"] = "opposed"
    out["fuel"] = "PMMA slab"
    out["pressure"] = "about 1 atm (not recorded per test)"
    cols = ["test", "session", "date", "sample", "fuel", "flow_direction", "thickness_mm", "width_cm", "sides_burning",
            "burning_half_thickness_mm", "segment", "n_segments", "velocity_cm_s", "o2_vol_pct", "o2_initial_vol_pct",
            "o2_final_vol_pct", "pressure", "spread_mm_s", "de_ris_mm_s", "de_ris_regime", "burn_time_min"]
    header = ("# M6 cleaned BASS-II spread table. Source: NASA PSI-25 (BASS-II, doi:10.60555/4qc4-de67): Table 5.1 of the BASS-II Summary\n"
              "# Report (NASA/TM-20210011385, a PSI-25 file) joined to the PSI-25 Experimental table (session, date, sample, O2).\n"
              "# Units: thickness mm, width cm, velocity cm/s (opposed), O2 vol%, spread and de Ris mm/s, burn time min. Empty spread = 'Not tracked'.\n"
              "# o2_vol_pct = segment estimate (linear decay, equal segments). de_ris_mm_s = M6 baseline (models/m6-spread/README.md).\n"
              "# Written by python models/m6-spread/build.py\n")
    CLEAN_CSV.write_text(header + out[cols].to_csv(index=False, lineterminator="\n"), encoding="utf-8")

    # models.json entry
    pts = []
    for i, r in df.iterrows():
        pts.append({"obs": r4(y[i]), "pred": r4(fp[i]), "lo": r4(lo[i]), "hi": r4(hi[i]),
                    "label": (f"{r['test']} ({r['session']}): PMMA slab {r['thickness_mm']:g} mm, {r['width_cm']:g} cm wide, "
                              f"{'two' if r['sides_burning'] == 2 else 'one'}-sided, opposed flow {r['velocity_cm_s']:g} cm/s, "
                              f"O2 {r['o2_vol_pct']:.1f}%")})
    for p in pts:  # rounding must not push pred outside its range
        p["lo"], p["hi"] = min(p["lo"], p["pred"]), max(p["hi"], p["pred"])
    t = res["test"][final]
    others = [c for c in CANDIDATES if c != final]
    other_txt = "; ".join(f"{CAND_NAMES[c].replace('de Ris x ', '')} R² {res['session'][c]['r2']:.2f} "
                          f"(range {res['session'][c]['r2_range'][0]:.1f} to {res['session'][c]['r2_range'][1]:.2f})" for c in others)
    entry = {
        "id": M6_ID,
        "name": "Flame spread over PMMA slabs (BASS-II)",
        "question": "How fast does a flame spread over a solid fuel in microgravity, given airflow speed, oxygen level, pressure and fuel?",
        "data": ("NASA BASS-II, PSI-25 (doi:10.60555/4qc4-de67): 39 measured opposed-flow spread rates from 18 PMMA slab tests "
                 "(1-5 mm thick, 1.2 or 2.2 cm wide, one- or two-sided) on the ISS in 7 sessions, 2-21 cm/s, 16.8-22.2% O2, about 1 atm. "
                 "Spread rates are NASA's own measurements as printed in Table 5.1 of the BASS-II Summary Report (NASA/TM-20210011385, "
                 "a PSI-25 file), transcribed by us; session and O2 come from the PSI-25 experimental table, which matches the report."),
        "method": (f"de Ris thermal-regime spread formula (thin or thick by burning half-thickness; coefficients from Bhattacharjee et al. 2016, "
                   f"flame coefficient scaled with O2) multiplied by a learned correction of log(observed/de Ris). Tried, simplest first: "
                   f"one constant, linear regression, Gaussian process, small gradient-boosted trees. Kept: {CAND_NAMES[final]} "
                   f"(simplest within the best model's range)."),
        "validation": (f"Whole ISS sessions held out: leave one session out (7 sessions, grouped by GMT day). Score = R2 on the pooled "
                       f"held-out predictions; range = 95% session bootstrap. Holding out single tests instead gives R2 {t['r2']:.2f}."),
        "metric": "R² (held-out sessions, spread rate in mm/s)",
        "score": r4(fs["r2"]),
        "score_range": [r4(v) for v in fs["r2_range"]],
        "baseline_name": "de Ris",
        "baseline_score": r4(res["baseline"]["r2"]),
        "unit": "mm/s",
        "points": pts,
        "drivers": drivers,
        "limits": (f"PMMA slabs in opposed flow at about 1 atm only: other fuels, thin films, rods, fabrics, concurrent flow and other "
                   f"pressures are outside the data, and pressure could not be tested. Mean error {fs['mae']:.3f} mm/s "
                   f"(de Ris alone {res['baseline']['mae']:.3f} mm/s; the textbook formula over-predicts these slabs about "
                   f"{1 / np.median(y / base):.1f}-fold). The other corrections on held-out sessions: {other_txt}; "
                   f"the rule fixed before training keeps the simplest model within the best one's range. Below the 0.6 target. "
                   f"O2 per flow step is estimated from start and end readings. Only 39 points from 7 sessions, so ranges are wide. "
                   f"Microgravity only: nothing here applies to Moon or Mars gravity, and a slow spread rate does not make a "
                   f"material or atmosphere safe."),
    }
    doc = merge_models(entry)
    others_before = None
    if MODELS_JSON.exists():
        old = json.loads(MODELS_JSON.read_bytes().decode("utf-8"))
        others_before = [m for m in old["models"] if m.get("id") != M6_ID]
    check_entry(doc, M6_ID)
    n_breaks = contract_selftest(doc)
    others_after = [m for m in doc["models"] if m.get("id") != M6_ID]
    assert others_before is None or others_before == others_after, "another feature's entry would change"
    MODELS_JSON.write_bytes(dumps(doc).encode("utf-8"))
    man = json.loads(MANIFEST_JSON.read_bytes().decode("utf-8"))
    line = next(f for f in man["files"] if f["name"] == "models")
    line["status"] = "real"
    line["what"] = "NASA-data model results (M6 flame spread, M7 extinction and cool flames)"
    MANIFEST_JSON.write_bytes(dumps(man).encode("utf-8"))
    say(f"[contract] m6 entry valid; {n_breaks} broken copies rejected; other entries unchanged ({len(others_after)})")

    # Check plot
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    PLOT.parent.mkdir(exist_ok=True)
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.loglog(y, base, "o", mfc="none", label=f"de Ris (R² {res['baseline']['r2']:.2f})")
    ax.errorbar(y, fp, yerr=[fp - lo, hi - fp], fmt="o", ms=4, alpha=0.8, label=f"{CAND_NAMES[final]} (R² {fs['r2']:.2f})")
    lim = [0.005, 1.0]
    ax.plot(lim, lim, "k--", lw=0.8)
    ax.set(xlim=lim, ylim=lim, xlabel="observed spread rate, mm/s", ylabel="predicted, mm/s (held-out session)",
           title="M6: BASS-II PMMA slabs")
    ax.legend(fontsize=7)
    fig.tight_layout()
    fig.savefig(PLOT, dpi=110)
    plt.close(fig)

    results = {
        "rows": len(df), "tests": int(df["test"].nunique()), "sessions": sorted(df["session"].unique().tolist()),
        "points_per_session": df.groupby("session").size().to_dict(),
        "de_ris": {"T_f_21_K": r4(np.atleast_1d(tf21)[0]), "F_range": [r4(F.min()), r4(F.max())],
                   "regime_counts": {k: int(v) for k, v in pd.Series(regime).value_counts().items()},
                   "median_obs_over_pred": r4(np.median(y / base)), "r2": r4(res["baseline"]["r2"]),
                   "r2_range": [r4(v) for v in res["baseline"]["r2_range"]], "mae_mm_s": r4(res["baseline"]["mae"]),
                   "mae_range": [r4(v) for v in res["baseline"]["mae_range"]]},
        "candidates": {split: {c: {k: ([r4(x) for x in v] if isinstance(v, list) else r4(v)) for k, v in res[split][c].items()}
                               for c in CANDIDATES} for split in ("session", "test")},
        "best": best, "final": final, "final_name": CAND_NAMES[final],
        "point_range_log_quantiles": [r4(q_lo), r4(q_hi)], "point_range_coverage": r4(coverage),
        "drivers": drivers, "driver_mae_rise_mm_s": {INPUT_NAMES[c]: r4(rise[c]) for c in INPUTS},
        "leakage": leak, "rules": rules,
        "no_spread_cases": {"real": int((ns["status"] == "real").sum()), "reported": int((ns["status"] == "reported").sum())},
    }
    RESULTS_JSON.write_bytes(dumps(results).encode("utf-8"))
    say(f"[done] wrote data/models.json (m6), data/manifest.json, {CLEAN_CSV.name}, {NOSPREAD_CSV.name}, {RESULTS_JSON.name}, checks/{PLOT.name}")


if __name__ == "__main__":
    sys.exit(main())
