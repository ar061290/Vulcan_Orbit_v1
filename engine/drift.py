#!/usr/bin/env python3
"""Smoke drift in a ventilated cabin with no buoyancy, plus what-if runs over fire position, airflow, mixing,
smoke release rate and fire duration.

    python engine/calibrate.py   # first: tunes clearance time, mixing and detector delay on Saffire-III flight data
    python engine/drift.py       # writes data/drift.json and data/whatif.json, prints every check

Model (2D side view of a cabin section, solver in drift_core.py):
  * Air: steady potential flow from a supply opening to a return opening. No air appears or vanishes inside.
  * Smoke: carried by the air (second-order van Leer scheme) and spread by an effective mixing value D.
    No buoyancy: in orbit hot gas does not rise. Part of the smoke leaving at the return comes back with
    the supply air; the rest is removed by the filter.
  * Detector: samples a 0.2 m patch of air and alarms when the average reaches ALARM_MG_M3, after a delay.
Where each setting comes from:
  * Clearance time, mixing D and detector delay: tuned on the Saffire-III flight record (data/drift_calibration.json).
  * Airflow 0.077 to 0.203 m/s: ISS cabin aisleway requirement of 4.6 to 12.2 m/min (NASA NTRS 20150009509, p. 10).
  * Release rate 0.02 to 2 mg/s: low end from SAME flight weight-loss rates (1 to 2 mg/min, PSI-102); high end assumed.
  * Fire duration: burn times measured in Saffire-I and Saffire-II (PSI-98, PSI-99).
  * Alarm level 1 mg/m3: called 'a relatively tight alarm threshold' in NASA's Saffire VI paper (ICES-2024-365, NTRS 20240002981).
    The ISS detection threshold is about 10 mg/m3 (NTRS 20170002629), so catch rates are also reported at 10 mg/m3.
This is a screening model. It is not a full fluid-dynamics simulation of a real module.
"""
import csv, json, math, re, time
from pathlib import Path
import numpy as np
from drift_core import Cabin, simulate, first_cross
import evidence

ROOT = Path(__file__).resolve().parents[1]
ALARM_MG_M3 = 1.0
T_END = 360.0                 # long enough to score alarms up to 5 minutes, including the detector delay
FLOWS = [0.077, 0.10, 0.15, 0.203]        # m/s, inside the NTRS 20150009509 range
ALARM_HI_MG_M3 = 10.0                      # ISS detection threshold, NTRS 20170002629
PATCH = 1                     # detector averages a 3 x 3 cell patch (0.2 m square)
CABINS = {
    "A": dict(inlet=("top", 0.4 / 3, 2.0 / 3), outlet=("right", 0.8 / 3, 0.8), label="Supply overhead at one end, return low at the other"),
    "B": dict(inlet=("left", 1.2, 1.8), outlet=("right", 0.2, 0.8), label="Supply high on one end wall, return low on the other"),
    "C": dict(inlet=("top", 3.2, 3.8), outlet=("bottom", 0.4, 1.0), label="Supply overhead and return in the floor at opposite ends"),
}


def burn_times():
    """Measured burn durations (s) from the Saffire-I and Saffire-II sample tables."""
    out = []
    for f in ("datasets/psi/PSI-98/PSI-98_Experimental table_SAFFIRE-1.csv", "datasets/psi/PSI-99/PSI-99_Experimental table_SAFFIRE-2.csv"):
        for r in csv.DictReader(open(ROOT / f, newline="")):
            v = next((r[k] for k in r if k and k.strip().startswith("Burn Time")), "")
            m = re.match(r"\s*([\d.]+)", v or "")
            if m: out.append(float(m.group(1)))
    return sorted(out)


def same_rates():
    """SAME weight-loss rates (mg/min) measured in flight, PSI-102."""
    out = []
    for r in csv.DictReader(open(ROOT / "datasets/psi/PSI-102/PSI-102_Experimental table_SAME.csv", newline="")):
        v = (r.get("Weight loss rate (mg/min)") or "").strip()
        if v: out.append(float(v))
    return out


def wall_cells(cab):
    nx, ny = cab.nx, cab.ny
    cells = [(i, ny - 1) for i in range(1, nx, 3)] + [(i, 0) for i in range(1, nx, 3)] + [(0, j) for j in range(2, ny - 1, 3)] + [(nx - 1, j) for j in range(2, ny - 1, 3)]
    return list(dict.fromkeys(cells))


def main():
    t0 = time.time()
    cal = json.loads((ROOT / "data" / "drift_calibration.json").read_text())
    kept_D = sorted({min(cal["D_values_kept"]), max(cal["D_values_kept"])})                 # lowest and highest mixing the flight data allows
    CLEAR = cal["clearance_s_range"]                                                        # [shortest, longest] clearance kept
    DELAY = cal["delay_s_range"]
    PSETS = [(D, Tc) for D in kept_D for Tc in CLEAR]                                       # corners of what the flight data allows
    BURNS = burn_times(); SAME = same_rates()
    RATE = (min(SAME) / 60.0, 2.0)                                                          # mg/s
    print("calibrated settings:", PSETS, "delay", DELAY, "burn times", BURNS, "rates", RATE)
    A = Cabin(name="A", inlet=CABINS["A"]["inlet"], outlet=CABINS["A"]["outlet"])
    checks = []
    def add(id, what, value, limit, ok):
        checks.append(dict(id=id, what=what, value=value, limit=limit, ok=bool(ok))); print(("PASS " if ok else "FAIL ") + id, what, "->", value, flush=True)

    # ---- V: does the solver solve the equations it claims to? ------------------------------------------------
    r = simulate(A, [(10, 10)], 0.10, 0.004, t_end=300, removal=0.3)
    add("V1", "Smoke mass is conserved, with the filter letting some smoke back in", round(float(r["balance"][0]), 5), "0.999 to 1.001", abs(r["balance"][0] - 1) < 1e-3)
    add("V2", "Air neither appears nor vanishes inside the cabin (max divergence / mean speed)", float(f"{A.div_err:.1e}"), "< 1e-6", A.div_err < 1e-6)
    r = simulate(A, [(30, 15)], 1e-12, 0.004, t_end=40, probes=[(26, 15), (34, 15), (30, 11), (30, 19)], patch=0)
    s = r["series"][0, -1]; sym = float(np.ptp(s) / s.mean())
    add("V3", "With the fans off, smoke spreads evenly in every direction", round(sym, 5), "difference between 4 equal-distance points < 1%", sym < 0.01)
    ch = Cabin(nx=120, ny=60, inlet=("left", 0, 2.0), outlet=("right", 0, 2.0)); x = (np.arange(ch.nx) + 0.5) * ch.dx
    s0, U, T, D = 0.15, 0.1, 20.0, 0.002
    c0 = np.tile(np.exp(-(x - 0.8) ** 2 / (2 * s0 ** 2)), (ch.ny, 1)); s2 = s0 ** 2 + 2 * D * T
    exact = s0 / math.sqrt(s2) * np.exp(-(x - 0.8 - U * T) ** 2 / (2 * s2))
    err = {}
    for sch in ("upwind", "vanleer"):
        f = simulate(ch, [(-1, 0)], U, D, rate_mg_s=0, t_end=T, c0=c0, scheme=sch)["final"][ch.ny // 2]
        err[sch] = float(np.linalg.norm(f - exact) / np.linalg.norm(exact))
    add("V4", "Matches the exact answer for a smoke puff drifting and spreading in a duct (error vs exact)",
        f"{err['vanleer']:.1%} (old first-order scheme: {err['upwind']:.1%})", "< 3%", err["vanleer"] < 0.03)
    # grid convergence on the real cabin: alarm times on 60x30 vs 120x60 cells
    A2 = Cabin(nx=120, ny=60, name="A2", inlet=CABINS["A"]["inlet"], outlet=CABINS["A"]["outlet"])
    pts = [(0.6, 1.4), (1.6, 0.4), (2.4, 1.0), (3.2, 1.6)]
    det = [(2.0, 1.97), (3.97, 0.53), (0.03, 1.0)]
    ta = []
    for cab in (A, A2):
        rr = simulate(cab, [cab.cell(*p) for p in pts], 0.10, 0.004, t_end=600, probes=[cab.cell(*q) for q in det], patch=PATCH * cab.nx // 60, removal=0.3)
        ta.append(np.array([first_cross(rr["times"], rr["series"][k], 0.3) for k in range(len(pts))]))
    both = np.isfinite(ta[0]) & np.isfinite(ta[1])
    gerr = float(np.nanmax(np.abs(ta[0][both] - ta[1][both]) / ta[1][both])) if both.any() else float("nan")
    agree = int((np.isfinite(ta[0]) == np.isfinite(ta[1])).sum())
    add("V5", "Same alarm times with cells half the size (worst difference, 12 fire-detector pairs)", f"{gerr:.0%}, {agree}/12 agree on alarm vs no alarm", "< 10% and 12/12", gerr < 0.10 and agree == 12)
    src = A.cell(0.6, 1.4); tret = []
    for f in (0.05, 0.20):
        rr = simulate(A, [src], f, 0.004, t_end=900, probes=[A.return_probe()], removal=0.3)
        tret.append(float(first_cross(rr["times"], rr["series"][0], 0.3)[0]))
    add("V6", "Four times faster air reaches the return sooner, by less than four times (mixing also moves smoke)",
        f"{tret[0]:.0f} s vs {tret[1]:.0f} s, ratio {tret[0]/tret[1]:.1f}", "ratio between 2 and 4", 2 <= tret[0] / tret[1] <= 4)
    add("V7", "Model tuned on the Saffire-III burn reproduces the detector record", f"R2 {cal['best']['burn_r2']:.2f}", "R2 > 0.8", cal["best"]["burn_r2"] > 0.8)
    p = cal["pulse"]
    add("V8", "Held-out test: timing of the smoke-wire puff at the flight detector (never used for tuning)",
        f"observed peak {p['observed_peak_s']:.0f} s; model {p['model_peak_s_range'][0]:.0f} to {p['model_peak_s_range'][2]:.0f} s, typical error {p['peak_error_s_median']:.0f} s, shape R2 {p['shape_r2_median']:.2f}",
        "typical peak-time error within one reading (10 s)", p["peak_error_s_median"] <= 10)

    # ---- library: unit-rate runs for every fire position x airflow x calibrated setting x cabin -----------------
    lib = {}; meta = {}
    for name, spec in CABINS.items():
        cab = A if name == "A" else Cabin(name=name, inlet=spec["inlet"], outlet=spec["outlet"])
        srcs = [(i, j) for j in range(2, cab.ny, 5) for i in range(2, cab.nx, 5)]
        cands = wall_cells(cab)
        named = {"Ceiling, mid-cabin (Earth habit)": (cab.nx // 2, cab.ny - 1), "At the air return": cab.return_probe()}
        for c in named.values():
            if c not in cands: cands.append(c)
        meta[name] = dict(cab=cab, srcs=srcs, cands=cands, named=named)
        for f in FLOWS:
            for D, Tc in PSETS:
                rem = min(1.0, cab.turnover_s(f) / Tc)
                rr = simulate(cab, srcs, f, D, t_end=T_END, probes=cands, patch=PATCH, removal=rem)
                lib[(name, f, D, Tc)] = (rr["times"], rr["series"])
        print(f"cabin {name}: {len(srcs)} fire positions x {len(FLOWS)} airflows x {len(PSETS)} settings in {time.time()-t0:.0f} s", flush=True)

    # ---- what-if runs ---------------------------------------------------------------------------------------
    rng = np.random.default_rng(42); N = 4000
    def whatif(name):
        m = meta[name]; srcs, cands = m["srcs"], m["cands"]
        s_idx = rng.integers(0, len(srcs), N); f_idx = rng.integers(0, len(FLOWS), N); p_idx = rng.integers(0, len(PSETS), N)
        rate = 10 ** rng.uniform(math.log10(RATE[0]), math.log10(RATE[1]), N)
        dur = rng.choice(BURNS, N); delay = rng.uniform(DELAY[0], DELAY[1], N)
        T = np.full((N, len(cands)), np.nan); T10 = np.full((N, len(cands)), np.nan)
        for n in range(N):
            times, arr = lib[(name, FLOWS[f_idx[n]], *PSETS[p_idx[n]])]
            u = arr[s_idx[n]]; k = int(round(dur[n] / (times[1] - times[0])))
            c = u.copy()
            if k < len(times): c[k:] -= u[:len(times) - k]          # the fire stops after its measured burn time
            T[n] = first_cross(times, c * rate[n], ALARM_MG_M3) + delay[n]
            T10[n] = first_cross(times, c * rate[n], ALARM_HI_MG_M3) + delay[n]
        return dict(s=s_idx, f=f_idx, p=p_idx, rate=rate, dur=dur, T=np.where(np.isnan(T), np.inf, T), T10=np.where(np.isnan(T10), np.inf, T10))

    def stats(W, cols, srcs):
        t = W["T"][:, cols].min(axis=1)
        boot = [np.mean(rng.choice(t, len(t)) <= 120) for _ in range(300)]
        per_p = [float(np.mean(t[W["p"] == k] <= 120)) for k in range(len(PSETS))]   # spread across settings the flight data allows
        fin = t[np.isfinite(t)]
        grid = []
        for k in range(len(srcs)):
            tk = t[W["s"] == k]; ok = np.isfinite(tk)
            grid.append(None if ok.mean() < 0.5 else round(float(np.median(tk[ok])), 0))
        bands = [(0, 0.1), (0.1, 0.5), (0.5, 10)]
        by_rate = [dict(lo=lo, hi=hi, caught_120=round(float(np.mean(t[(W["rate"] >= lo) & (W["rate"] < hi)] <= 120)), 3)) for lo, hi in bands]
        by_mix = [dict(D=PSETS[k][0], clearance_s=PSETS[k][1], caught_120=round(float(np.mean(t[W["p"] == k] <= 120)), 3)) for k in range(len(PSETS))]
        t10 = W["T10"][:, cols].min(axis=1)
        return dict(caught_120_at_10mg=round(float(np.mean(t10 <= 120)), 3), caught_300_at_10mg=round(float(np.mean(t10 <= 300)), 3), by_rate=by_rate, by_mix=by_mix, caught_60=round(float(np.mean(t <= 60)), 3), caught_120=round(float(np.mean(t <= 120)), 3), caught_300=round(float(np.mean(t <= 300)), 3),
                    caught_120_range=[round(float(np.percentile(boot, 2.5)), 3), round(float(np.percentile(boot, 97.5)), 3)],
                    caught_120_model_range=[round(min(per_p), 3), round(max(per_p), 3)],
                    never=round(float(np.mean(~np.isfinite(t))), 3), median_s=None if not len(fin) else round(float(np.median(fin)), 0), map=grid), t

    xy = lambda cab, i, j: cab.xy(i, j)
    robust = []; out_layouts = []; Wa = None
    for name in CABINS:
        m = meta[name]; cab, cands = m["cab"], m["cands"]; W = whatif(name); ci = {c: k for k, c in enumerate(cands)}
        score = lambda cols: float(np.mean(W["T"][:, cols].min(axis=1) <= 120))
        b1 = max(range(len(cands)), key=lambda k: score([k]))
        b2 = max((k for k in range(len(cands)) if k != b1), key=lambda k: score([b1, k]))
        lay = [("Ceiling, mid-cabin (Earth habit)", [ci[m["named"]["Ceiling, mid-cabin (Earth habit)"]]]), ("At the air return", [ci[m["named"]["At the air return"]]]),
               ("Best single position found", [b1]), ("Best pair found", [b1, b2])]
        res = {}
        for lname, cols in lay:
            st, _ = stats(W, cols, m["srcs"]); res[lname] = st
            if name == "A": out_layouts.append(dict(name=lname, detectors=[xy(cab, *cands[c]) for c in cols], **st))
        ce, rt = res["Ceiling, mid-cabin (Earth habit)"], res["At the air return"]
        robust.append(dict(cabin=name, label=CABINS[name]["label"], ceiling_range=ce["caught_120_model_range"], return_range=rt["caught_120_model_range"],
                           ceiling_big=ce["by_rate"][2]["caught_120"], return_big=rt["by_rate"][2]["caught_120"], ceiling_120=ce["caught_120"],
                           return_120=res["At the air return"]["caught_120"], pair_120=res["Best pair found"]["caught_120"],
                           best_single=xy(cab, *cands[b1]), best_pair=[xy(cab, *cands[b1]), xy(cab, *cands[b2])]))
        print(f"cabin {name}: " + "  ".join(f"{k}: {v['caught_120']:.0%} (10 mg/m3: {v['caught_120_at_10mg']:.0%}) ({v['caught_120_model_range'][0]:.0%}-{v['caught_120_model_range'][1]:.0%}) by rate {[b['caught_120'] for b in v['by_rate']]} by mix {[b['caught_120'] for b in v['by_mix']]}" for k, v in res.items()), flush=True)
    won = sum(r["return_120"] - r["ceiling_120"] > 0.05 for r in robust)
    add("R1", "Moving the detector from the ceiling to the air return catches at least 5 points more fires, in all three cabin layouts",
        "; ".join(f"{r['cabin']}: {r['ceiling_120']:.0%} -> {r['return_120']:.0%}" for r in robust), "3/3 layouts, otherwise the placement claim is dropped", won == 3)
    sz = sum(r["return_big"] - r["return_120"] > 0.2 for r in robust)
    add("R2", "Fire size matters more than detector position: big fires (over 0.5 mg/s) are caught far more often than average",
        "; ".join(f"{r['cabin']}: {r['return_big']:.0%} vs {r['return_120']:.0%}" for r in robust), "at least 20 points more, 3/3 layouts", sz == 3)

    # ---- one showcase run for the animation (cabin A, middle of the calibrated settings) -------------------------
    show_src, show_flow, show_D, show_Tc, show_rate = (9, 21), 0.10, kept_D[-1], float(np.sqrt(CLEAR[0] * CLEAR[1])), 1.0
    dly = float(np.mean(DELAY)); named = meta["A"]["named"]
    rr = simulate(A, [show_src], show_flow, show_D, t_end=600, probes=list(named.values()), patch=PATCH, frame_dt=10.0,
                  removal=min(1.0, A.turnover_s(show_flow) / show_Tc), rate_mg_s=show_rate)
    alarms = first_cross(rr["times"], rr["series"][0], ALARM_MG_M3) + dly
    cmax = 20.0
    q = lambda f: np.clip(np.round(255 * np.log10(1 + 99 * np.clip(f / cmax, 0, 1)) / 2), 0, 255).astype(int)
    uc, vc = (A.u1[:, 1:] + A.u1[:, :-1]) / 2 * show_flow, (A.v1[1:, :] + A.v1[:-1, :]) / 2 * show_flow
    arrows = [[*A.xy(i, j), round(float(uc[j, i]), 4), round(float(vc[j, i]), 4)] for j in range(1, A.ny, 6) for i in range(1, A.nx, 6)]
    ia, ib = A.cells(A.inlet)[1:]; oa, ob = A.cells(A.outlet)[1:]
    drift = dict(status="model", source="engine/drift.py", units=dict(length="m", time="s", flow="m/s", D="m2/s", rate="mg/s", concentration="mg/m3", frames="0-255, log scale (see scale)"), nx=A.nx, ny=A.ny, lx_m=A.lx, ly_m=A.ly, frame_dt_s=10, flow_m_s=show_flow, D_m2_s=show_D,
                 rate_mg_s=show_rate, clearance_s=round(show_Tc), detector_delay_s=round(dly), alarm_mg_m3=ALARM_MG_M3, scale_max_mg_m3=cmax,
                 scale="value = 255 * log10(1 + 99*c/scale_max) / 2", fire=A.xy(*show_src), supply=[ia * A.dx, ib * A.dx], ret=[oa * A.dx, ob * A.dx],
                 detectors=[dict(name=n, x=A.xy(*c)[0], y=A.xy(*c)[1], alarm_s=None if np.isnan(a) else round(float(a), 1)) for (n, c), a in zip(named.items(), alarms)],
                 arrows=arrows, frames=[q(f)[::-1].ravel().tolist() for f in rr["frames"]],
                 assumptions=["2D side view of a 4.0 x 2.0 m cabin section, 2.0 m deep", "No buoyancy: smoke only moves with the air and by mixing",
                              f"Mixing D = {show_D} m2/s (flight data allows {kept_D[0]} to {kept_D[-1]}) and clearance {show_Tc:.0f} s, both inside the range tuned on Saffire-III flight data",
                              f"Alarm times include a {dly:.0f} s detector delay tuned on the same record", "Supply and return positions are illustrative",
                              "Screening model, not a full fluid-dynamics simulation"])
    mA = meta["A"]
    whatif = dict(status="model", source="engine/drift.py", units=dict(time="s", share="0-1 of simulated fires", alarm="mg/m3", flow="m/s", length="m"), alarm_hi_mg_m3=ALARM_HI_MG_M3,
                  sources=["Airflow: NASA NTRS 20150009509 p. 10 (4.6-12.2 m/min)", "Alarm 1 mg/m3: NASA ICES-2024-365 (NTRS 20240002981)", "Alarm 10 mg/m3: NASA NTRS 20170002629", "Burn times: NASA PSI-98, PSI-99", "Low release rate: NASA PSI-102 (SAME)", "Tuning: NASA PSI-100 (Saffire-III)"], runs=N, seed=42, alarm_mg_m3=ALARM_MG_M3, t_end_s=T_END, lx_m=A.lx, ly_m=A.ly,
                  varied=dict(fire_position=f"{len(mA['srcs'])} positions on a grid", airflow_m_s=FLOWS, mixing_D_m2_s=kept_D, clearance_s=CLEAR,
                              release_mg_s=f"{RATE[0]:.2f} to {RATE[1]:.0f}, log-uniform (low end: SAME flight weight-loss rate)",
                              fire_duration_s=BURNS, detector_delay_s=DELAY),
                  map_nx=len(range(2, A.nx, 5)), map_ny=len(range(2, A.ny, 5)), map_xy=[A.xy(*s) for s in mA["srcs"]], layouts=out_layouts,
                  robustness=robust, checks=checks, calibration="data/drift_calibration.json",
                  note="Share of simulated fires whose smoke reaches the alarm level at a detector within the stated time. "
                       "First range: resampling the runs. Second range: across the settings the Saffire-III flight record cannot tell apart.")
    (ROOT / "data" / "drift.json").write_text(json.dumps(drift, separators=(",", ":")))
    (ROOT / "data" / "whatif.json").write_text(json.dumps(whatif, separators=(",", ":")))
    evidence.write(checks)
    print("showcase alarms:", {d["name"]: d["alarm_s"] for d in drift["detectors"]})
    print(f"failed checks: {[c['id'] for c in checks if not c['ok']]}; done in {time.time()-t0:.0f} s")


if __name__ == "__main__":
    main()
