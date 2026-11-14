#!/usr/bin/env python3
"""M3 smoke drift with a 2D lattice Boltzmann air field. Rebuilds every output from scratch:

    python models/m3-drift/build.py            # data/drift_lbm.json, data/drift_whatif.json, models/m3-drift/results.json

Order: solver validation -> numerical checks -> cross-check with engine/drift_core.py -> hero cabin run (constant source)
-> grid check -> what-if runs -> growing source (if data/flame_spread.json exists) -> dome demonstration.
Every number used as an input is listed in README.md with its source. Status of all outputs: "model".
"""
import os, sys, json, math, time, itertools
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
# keep numba caches and bytecode out of the repo (and out of engine/, which this script must not touch)
os.environ.setdefault("NUMBA_CACHE_DIR", str(Path(os.environ.get("TMPDIR", "/tmp")) / "vulcan_numba_cache"))
sys.dont_write_bytecode = True
sys.path.insert(0, str(HERE))

import numpy as np
import cabin as cb
from cabin import Cabin, first_cross
import validate

SEED = 42
ALARM_MG_M3 = 1.0           # same alarm level as engine/drift.py (NASA Saffire analysis, ICES-2024-365, via engine docs)
FLOWS = [0.077, 0.10, 0.15, 0.203]   # m/s; 4.6 to 12.2 m/min aisleway requirement, NTRS 20150009509 (Link & Balistreri 2015)
D_MAIN = 0.02               # m2/s, middle mixing value kept by the Saffire-III calibration (data/drift_calibration.json)
T_END = 300.0


def same_min_rate():
    """Lowest SAME flight weight-loss rate (mg/min -> mg/s), PSI-102 summary table; engine/drift.py uses the same value."""
    import csv
    v = [float(r["Weight loss rate (mg/min)"]) for r in csv.DictReader(open(ROOT / "datasets/psi/PSI-102/PSI-102_Experimental table_SAME.csv", newline=""))
         if (r.get("Weight loss rate (mg/min)") or "").strip()]
    return min(v) / 60.0


RATE_LO = same_min_rate()   # mg/s
RATE_HI = 2.0               # mg/s, upper value assumed in engine/drift.py (an assumption, not a measurement)
CHECKS = []


def log(cid, ok, text):
    CHECKS.append(dict(id=cid, ok=bool(ok) if ok is not None else None, result=text))
    tag = "PASS" if ok else ("NOT RUN" if ok is None else "FAIL")
    print(f"{tag:8s}{cid:10s}{text}", flush=True)


def calibration():
    cal = json.loads((ROOT / "data" / "drift_calibration.json").read_text())
    return dict(D=sorted(cal["D_values_kept"]), clear=cal["clearance_s_range"], delay=cal["delay_s_range"])


def keep_share(cab, fl, clearance_s):
    """Share of return-air smoke sent back by the supply, from the calibrated clearance time (as engine/drift.py)."""
    turnover = cab.area_open() * cb.DEPTH / fl["q_in"]
    return 1.0 - min(1.0, turnover / clearance_s), turnover


def cross_check(cal):
    """X-agree, X-time: empty cabin, same openings, LBM air vs the potential-flow air of engine/drift_core.py."""
    sys.path.insert(0, str(ROOT / "engine"))
    import drift_core as dc                                   # read-only use; caches redirected above
    flow = 0.10
    lb = Cabin(racks=[])
    fl = lb.flow(flow)
    en = dc.Cabin(nx=lb.nx, ny=lb.ny, lx=lb.lx, ly=lb.ly, inlet=lb.supply, outlet=lb.ret, name="X")
    srcs = [(i, j) for j in (5, 15, 25, 35) for i in (6, 26, 46, 66)]                 # engine cell indices
    dets = [(lb.nx // 2, lb.ny - 1), (lb.nx - 1, 13), (0, lb.ny // 2), (lb.nx // 2, 0)]   # ceiling, return, end wall, deck
    re = dc.simulate(en, srcs, flow, D_MAIN, rate_mg_s=1.0, t_end=T_END, probes=dets, patch=1, removal=1.0)
    rl = lb.run_smoke(fl, [(i + 1, j + 1) for i, j in srcs], D_MAIN, rate_mg_s=1.0, t_end=T_END,
                      probes=[(i + 1, j + 1) for i, j in dets], patch=1, keep=0.0)
    te = np.array([first_cross(re["times"], re["series"][k], ALARM_MG_M3) for k in range(len(srcs))])
    tl = np.array([first_cross(rl["times"], rl["series"][k], ALARM_MG_M3) for k in range(len(srcs))])
    agree = float(np.mean(np.isfinite(te) == np.isfinite(tl)))
    both = np.isfinite(te) & np.isfinite(tl) & (te > 0)
    ratio = float(np.median(tl[both] / te[both])) if both.any() else float("nan")
    log("X-agree", agree >= 0.75, f"alarm vs no alarm agree on {agree:.0%} of {te.size} fire-detector pairs (limit >= 75%)")
    log("X-time", 0.5 <= ratio <= 2.0 if both.any() else False,
        f"median LBM/engine alarm-time ratio {ratio:.2f} over {int(both.sum())} pairs (limit 0.5 to 2.0)")
    return dict(flow_m_s=flow, D_m2_s=D_MAIN, pairs=int(te.size), agree=agree, median_ratio=ratio,
                ratio_range=[float(np.percentile(tl[both] / te[both], 5)), float(np.percentile(tl[both] / te[both], 95))] if both.any() else None,
                lbm_alarm_s=np.where(np.isfinite(tl), tl, -1).round(1).tolist(), engine_alarm_s=np.where(np.isfinite(te), te, -1).round(1).tolist(),
                note="-1 = no alarm within 300 s. Engine air: potential flow; LBM air: viscous, effective viscosity %.3f m2/s." % cb.NU_EFF)


def numerics(name, cab, fl):
    log(f"N-u:{name}", fl["u_lat_max"] < 0.1, f"largest lattice speed {fl['u_lat_max']:.3f} (limit < 0.1)")
    log(f"N-tau:{name}", fl["tau"] >= 0.55, f"tau {fl['tau']:.3f} (limit >= 0.55)")
    log(f"N-steady:{name}", fl["steady"], f"relative change over last 2% of steps {fl['change']:.1e} (limit < 1e-3), {fl['steps']} steps")


def encode(c, cmax):
    return np.clip(np.round(255 * np.log10(1 + 99 * np.clip(c / cmax, 0, 1)) / 2), 0, 255).astype(int)


def main():
    t0 = time.time()
    cal = calibration()
    res = dict(status="model")
    # ---------------------------------------------------------------- validation
    res["validation"] = validate.run_all(log)
    # ---------------------------------------------------------------- cross-check with the calibrated model
    res["cross_check_engine"] = cross_check(cal)
    # ---------------------------------------------------------------- air fields for every ventilation speed
    cab = Cabin()
    fields = {}
    for f in FLOWS:
        fields[f] = cab.flow(f)
        numerics(f"{f}", cab, fields[f])
    res["flow_fields"] = {str(f): {k: v for k, v in fl.items() if k not in ("u", "v")} for f, fl in fields.items()}
    Tc = float(math.sqrt(cal["clear"][0] * cal["clear"][1]))
    delay = float(np.mean(cal["delay"]))
    # ---------------------------------------------------------------- hero run, constant source
    hero_flow = 0.10
    fire = (1.0, 0.45)
    named = {"Ceiling gap, mid-cabin": (2.2, 2.15), "Air return": (4.15, 0.65), "Deck gap, mid-cabin": (2.1, 0.05),
             "End wall by the supply": (0.05, 1.1)}
    det_nodes = {k: cab.node(*v) for k, v in named.items()}
    fl = fields[hero_flow]
    keep, turnover = keep_share(cab, fl, Tc)
    src = cab.node(*fire)
    hero = cab.run_smoke(fl, [src], D_MAIN, rate_mg_s=1.0, t_end=600.0, probes=list(det_nodes.values()), patch=1, keep=keep, frame_dt=10.0)
    log("N-mass:hero", 0.995 <= hero["balance"][0] <= 1.005, f"smoke balance {hero['balance'][0]:.6f} (limit 0.995 to 1.005)")
    alarms = first_cross(hero["times"], hero["series"][0], ALARM_MG_M3) + delay
    # grid check: same scenario on cells half the size
    fine = Cabin(dx=cb.DX / 2)
    ffl = fine.flow(hero_flow)
    numerics("fine", fine, ffl)
    fkeep, _ = keep_share(fine, ffl, Tc)
    fh = fine.run_smoke(ffl, [fine.node(*fire)], D_MAIN, rate_mg_s=1.0, t_end=600.0,
                        probes=[fine.node(*v) for v in named.values()], patch=2, keep=fkeep)
    falarms = first_cross(fh["times"], fh["series"][0], ALARM_MG_M3) + delay
    same = bool(np.all(np.isfinite(alarms) == np.isfinite(falarms)))
    both = np.isfinite(alarms) & np.isfinite(falarms)
    gdiff = float(np.max(np.abs(alarms[both] - falarms[both]) / falarms[both])) if both.any() else float("nan")
    log("N-grid", same and gdiff < 0.15, f"same detectors alarm: {same}; worst alarm-time difference {gdiff:.0%} (limit < 15%)")
    res["grid_check"] = dict(coarse_alarm_s=np.nan_to_num(alarms, nan=-1).round(1).tolist(), fine_alarm_s=np.nan_to_num(falarms, nan=-1).round(1).tolist(),
                             worst_rel_diff=gdiff, same_detectors=same)
    # ---------------------------------------------------------------- what-if runs
    rng = np.random.default_rng(SEED)
    cands = cab.wall_candidates()
    for v in det_nodes.values():
        if v not in cands: cands.append(v)
    srcs = cab.source_grid()
    lib = {}
    for D in [D_MAIN] + [d for d in cal["D"] if d != D_MAIN]:
        for f in FLOWS:
            k, _ = keep_share(cab, fields[f], Tc)
            r = cab.run_smoke(fields[f], srcs, D, rate_mg_s=1.0, t_end=T_END, probes=cands, patch=1, keep=k)
            bal = r["balance"]
            if D == D_MAIN:
                log(f"N-mass:{f}", bool(np.all((bal > 0.995) & (bal < 1.005))), f"smoke balance {bal.min():.6f} to {bal.max():.6f} over {len(srcs)} runs")
            lib[(D, f)] = (r["times"], r["series"])
        print(f"what-if library D={D}: {time.time() - t0:.0f} s", flush=True)

    nruns = len(FLOWS) * len(srcs)
    # Release rate per run, log-uniform between the SAME flight weight-loss rate (PSI-102, 1 mg/min) and the 2 mg/s upper value
    # assumed in engine/drift.py. Added after a first pass at a fixed 1 mg/s caught 100% of fires for every layout (REPORT.md).
    RATES = 10 ** rng.uniform(math.log10(RATE_LO), math.log10(RATE_HI), nruns)

    def alarm_table(D, rate, dly):
        rate = np.broadcast_to(np.asarray(rate, dtype=float), (nruns,))
        rows = []; n = 0
        for f in FLOWS:
            times, ser = lib[(D, f)]
            for s in range(len(srcs)):
                rows.append(first_cross(times, ser[s] * rate[n], ALARM_MG_M3) + dly); n += 1
        T = np.array(rows)
        return np.where(np.isnan(T), np.inf, T)

    T = alarm_table(D_MAIN, RATES, delay)
    log("W-count", nruns >= 200, f"{nruns} runs at g = 0 ({len(srcs)} fire positions x {len(FLOWS)} ventilation speeds)")
    combos = np.array(list(itertools.combinations(range(len(cands)), 3)))

    def share(Tm, cols, lim):
        return float(np.mean(Tm[:, cols].min(axis=1) <= lim))

    def all_scores(Tm, lim):
        out = np.empty(len(combos))
        for a in range(0, len(combos), 20000):
            c = combos[a:a + 20000]
            out[a:a + 20000] = (np.minimum(np.minimum(Tm[:, c[:, 0]], Tm[:, c[:, 1]]), Tm[:, c[:, 2]]) <= lim).mean(axis=0)
        return out

    s180 = all_scores(T, 180.0); s60 = all_scores(T, 60.0)
    key = s180 * 1000 + s60
    best, worst = int(np.argmax(key)), int(np.argmin(key))

    def boot(cols, lim, n=1000):
        t = T[:, cols].min(axis=1) <= lim
        idx = rng.integers(0, nruns, (n, nruns))
        b = t[idx].mean(axis=1)
        return [round(float(np.percentile(b, 2.5)), 3), round(float(np.percentile(b, 97.5)), 3)]

    def layout(name, cols):
        cols = list(cols)
        d = dict(name=name, detectors=[cab.xy(*cands[c]) for c in cols])
        for lim in (60, 180):
            d[f"caught_{lim}"] = round(share(T, cols, lim), 3); d[f"caught_{lim}_range"] = boot(cols, lim)
            sens = [share(alarm_table(Dk, RATES, delay), cols, lim) for Dk in cal["D"]] + \
                   [share(alarm_table(D_MAIN, RATES, dl), cols, lim) for dl in cal["delay"]]
            d[f"caught_{lim}_model_range"] = [round(min(sens), 3), round(max(sens), 3)]
        d["never_300"] = round(float(np.mean(~np.isfinite(T[:, cols].min(axis=1)))), 3)
        return d

    ci = {c: k for k, c in enumerate(cands)}
    hero_cols = [ci[det_nodes[k]] for k in ("Ceiling gap, mid-cabin", "Air return", "Deck gap, mid-cabin")]
    layouts = [layout("Best 3 found", combos[best]), layout("Worst 3 found", combos[worst]),
               layout("Ceiling gap + air return + deck gap", hero_cols)]
    for L in layouts:
        log("W-range", True, f"{L['name']}: caught within 60 s {L['caught_60']:.0%} {L['caught_60_range']}, "
                             f"within 180 s {L['caught_180']:.0%} {L['caught_180_range']}; across calibrated settings 180 s {L['caught_180_model_range']}")
    log("W-layout", True, f"searched {len(combos)} three-detector layouts from {len(cands)} wall positions")
    by_rate = []
    for rate in (RATE_LO, 0.2, 1.0, RATE_HI):
        Tr = alarm_table(D_MAIN, rate, delay)
        by_rate.append(dict(rate_mg_s=rate, best_caught_180=round(share(Tr, list(combos[best]), 180.0), 3),
                            hero_caught_180=round(share(Tr, hero_cols, 180.0), 3)))
    by_flow = []
    for k, f in enumerate(FLOWS):
        rows = slice(k * len(srcs), (k + 1) * len(srcs))
        by_flow.append(dict(flow_m_s=f, best_caught_180=round(float(np.mean(T[rows][:, combos[best]].min(axis=1) <= 180)), 3),
                            best_caught_60=round(float(np.mean(T[rows][:, combos[best]].min(axis=1) <= 60)), 3)))
    tb = T[:, combos[best]].min(axis=1)
    grid = [None if not np.isfinite(np.median(tb[k::len(srcs)])) else round(float(np.median(tb[k::len(srcs)])), 0) for k in range(len(srcs))]

    # ---------------------------------------------------------------- growing source from the flame-spread output
    growing = None
    fsp = ROOT / "data" / "flame_spread.json"
    if fsp.exists():
        sp = json.loads(fsp.read_text())
        g = sp.get("growth_for_smoke")
        if g:
            tg, ag = np.array(g["t_s"]), np.array(g["burning_area_cm2"])
            amax = float(ag.max())
            prof = lambda t: float(np.interp(t, tg, ag, right=ag[-1])) / amax if amax > 0 else 0.0
            gr = cab.run_smoke(fl, [src], D_MAIN, rate_mg_s=1.0, t_end=600.0, probes=list(det_nodes.values()), patch=1, keep=keep,
                               profile=prof)
            ga = first_cross(gr["times"], gr["series"][0], ALARM_MG_M3) + delay
            want = 1.0 * sum(prof(k * gr["dt"]) for k in range(int(round(600.0 / gr["dt"])))) * gr["dt"]
            rel = abs(gr["released"] - want) / want
            log("G-link", rel < 0.01, f"released {gr['released']:.2f} mg vs integral of source {want:.2f} mg (difference {rel:.1e}, limit < 1%)")
            growing = dict(case=g.get("case"), peak_rate_mg_s=1.0, note="release = 1 mg/s x burning area / peak burning area; smoke yield per area not known (null)",
                           smoke_yield_mg_per_cm2=None, detectors=[dict(name=n, alarm_s=None if not np.isfinite(a) else round(float(a), 1),
                                                                         constant_source_alarm_s=None if not np.isfinite(b) else round(float(b), 1))
                                                                    for n, a, b in zip(named, ga, alarms)])
    if growing is None:
        log("G-link", None, "not run: data/flame_spread.json has no growth_for_smoke series")

    # ---------------------------------------------------------------- dome demonstration (gravity on)
    try:
        import dome_check
        res["dome"] = dome_check.run(log)
    except ImportError:
        log("D-dome", None, "not run: dome_check.py missing")

    # ---------------------------------------------------------------- outputs
    cmax = 20.0
    u, v = fl["u"], fl["v"]
    arrows = [[*cab.xy(i, j), round(float(u[j, i]), 4), round(float(v[j, i]), 4)]
              for j in range(2, cab.ny + 1, 4) for i in range(2, cab.nx + 1, 4) if cab.typ[j, i] == 0]
    frames = [encode(fr[1:-1, 1:-1], cmax)[::-1].ravel().tolist() for fr in hero["frames"]]
    sup, ret = cab.supply, cab.ret
    drift = dict(status="model", source="models/m3-drift/build.py", solver="2D lattice Boltzmann D2Q9 BGK air field; finite-volume smoke",
                 nx=cab.nx, ny=cab.ny, lx_m=cab.lx, ly_m=cab.ly, units="m, s, mg/m3", frame_dt_s=10, flow_m_s=hero_flow,
                 D_m2_s=D_MAIN, nu_eff_m2_s=cb.NU_EFF, rate_mg_s=1.0, clearance_s=round(Tc), detector_delay_s=round(delay),
                 alarm_mg_m3=ALARM_MG_M3, scale_max_mg_m3=cmax, scale="value = 255 * log10(1 + 99*c/scale_max) / 2; rows top to bottom",
                 fire=list(fire), supply_wall=sup[0], supply=[sup[1], sup[2]], return_wall=ret[0], ret=[ret[1], ret[2]],
                 racks=[list(r) for r in cab.racks],
                 detectors=[dict(name=n, x=named[n][0], y=named[n][1], alarm_s=None if not np.isfinite(a) else round(float(a), 1)) for n, a in zip(named, alarms)],
                 arrows=arrows, frames=frames, gravity_m_s2=0.0,
                 assumptions=["2D cross-section 4.2 x 2.2 m, 2.0 m deep; rack and vent layout illustrative",
                              "No buoyancy (g = 0): smoke moves only with the air and by mixing",
                              f"Effective viscosity {cb.NU_EFF} m2/s and mixing {D_MAIN} m2/s, inside the range tuned on Saffire-III flight data",
                              f"Alarm times include a {delay:.0f} s detector delay tuned on the same record",
                              "Screening model, not validated fluid dynamics of a real module"])
    whatif = dict(status="model", source="models/m3-drift/build.py", runs=nruns, seed=SEED, gravity_m_s2=0.0, units="s, m, m/s, mg/s, mg/m3",
                  alarm_mg_m3=ALARM_MG_M3, detector_delay_s=round(delay, 1), t_end_s=T_END, D_m2_s=D_MAIN,
                  varied=dict(fire_position=f"{len(srcs)} positions on a 0.25 m grid", flow_m_s=FLOWS,
                              release_mg_s=f"log-uniform {RATE_LO:.3f} to {RATE_HI:.0f} (low end SAME PSI-102; high end assumed in engine/drift.py)"),
                  sensitivity=dict(D_m2_s=cal["D"], detector_delay_s=cal["delay"]), candidates=[cab.xy(*c) for c in cands],
                  layouts=layouts, by_rate=by_rate, by_flow=by_flow, map_xy=[cab.xy(*s) for s in srcs], map_median_alarm_s_best=grid,
                  growing_source=growing, checks=CHECKS,
                  note="Share of simulated fires whose smoke reaches the alarm level at any of the 3 detectors within the time. "
                       "First range: bootstrap over runs (1000 resamples). Model range: across the mixing values and detector delays the "
                       "Saffire-III record cannot tell apart. Model output, not a prediction for a real module.")
    (ROOT / "data" / "drift_lbm.json").write_text(json.dumps(drift, separators=(",", ":")))
    (ROOT / "data" / "drift_whatif.json").write_text(json.dumps(whatif, separators=(",", ":")))
    res.update(hero=dict(alarm_s=np.nan_to_num(alarms, nan=-1).round(1).tolist(), names=list(named), keep=keep, turnover_s=turnover,
                         balance=float(hero["balance"][0])), checks=CHECKS)
    (HERE / "results.json").write_text(json.dumps(res, indent=1, default=float))
    print(f"failed: {[c['id'] for c in CHECKS if c['ok'] is False]}; not run: {[c['id'] for c in CHECKS if c['ok'] is None]}; "
          f"{time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
