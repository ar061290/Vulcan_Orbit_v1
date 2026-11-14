#!/usr/bin/env python3
"""Tune the smoke drift model on the Saffire-III flight record (NASA PSI-100) and test it on a part it never saw.

    python engine/calibrate.py        # writes data/drift_calibration.json

What the flight record has: one cabin smoke detector (Cygnus F2 scatter channel) read every 10 s, and the
times the Saffire igniters, smoke wire and flame radiometers were on. Two events produced smoke:
  * the smoke wire, a short puff (about 11 s)                -> HELD OUT, used only to test
  * the Sample 1 burn, a flame lasting about 350 s            -> used to tune
What we tune: how fast the air clears smoke (ventilation turnover and filter removal), the mixing value D,
where along the cabin the smoke enters, and a detector delay (sampling + travel we cannot see).
What we cannot tune from one detector: the cabin's real shape. Cygnus geometry is not in the record.
"""
import json, time
from pathlib import Path
import numpy as np
from drift_core import Cabin, simulate
import saffire

ROOT = Path(__file__).resolve().parents[1]
# Pressurised module roughly the size of a Cygnus cabin section; shape is an assumption (see above).
CAB = dict(lx=4.8, ly=2.4, depth=2.4, inlet=("top", 0.16, 0.8), outlet=("right", 0.32, 0.96))
TURNOVERS = [30.0, 60.0, 120.0]               # s per cabin volume
CLEARANCE = [60.0, 90.0, 120.0, 170.0, 240.0, 340.0, 480.0]   # s: turnover / filter removal share
DIFFS = [0.004, 0.02, 0.1]                     # m2/s
XS = [0.4, 1.2, 2.0, 2.8, 3.6, 4.2]           # m along the cabin where smoke enters
DELAYS = np.arange(0, 62, 2.0)                # s


def r2(y, f):
    return float(1 - ((y - f) ** 2).sum() / ((y - y.mean()) ** 2).sum())


def fit_gain(m, y):
    return float(m @ y / (m @ m)) if m @ m > 0 else 0.0


def main():
    t0 = time.time()
    d = saffire.load(); ev = saffire.events(d)
    C = Cabin(**CAB)
    t, y = d["t_scat"], d["scat"]
    T0, T1 = 5900.0, 5600.0
    b0, b1 = ev["sample1_flame"][0] - T0, ev["sample1_flame"][1] - T0
    w0, w1 = ev["smoke_wire"][0] - T1, ev["smoke_wire"][1] - T1 + 1
    mb = (t >= 5940) & (t <= 6900); mp = (t >= 5600) & (t <= 5760)
    base_b = float(np.median(y[(t > 5925) & (t < 6005)])); base_p = float(np.median(y[(t > 5500) & (t < 5650)]))
    tb, yb = t[mb] - T0, y[mb] - base_b
    tp, yp = t[mp] - T1, y[mp] - base_p
    srcs = [C.cell(x, C.ly / 2) for x in XS]; pr = [C.return_probe()]
    rows = []
    for tau in TURNOVERS:
        flow = C.volume / (C.q1 * tau)
        for Tc in CLEARANCE:
            rem = tau / Tc
            if rem > 1: continue
            for D in DIFFS:
                A = simulate(C, srcs, flow, D, t_end=1000, probes=pr, profile=lambda s: 1.0 if b0 <= s < b1 else 0.0, removal=rem)
                B = simulate(C, srcs, flow, D, t_end=160, probes=pr, profile=lambda s: 1.0 if w0 <= s < w1 else 0.0, removal=rem)
                for k, x in enumerate(XS):
                    best = None
                    for dl in DELAYS:                       # the delay is tuned on the burn only
                        ma = np.interp(tb - dl, A["times"], A["series"][k, :, 0], left=0)
                        g = fit_gain(ma, yb); sc = r2(yb, g * ma)
                        if best is None or sc > best[0]: best = (sc, float(dl), g)
                    sc, dl, g = best
                    mp_ = np.interp(tp - dl, B["times"], B["series"][k, :, 0], left=0)
                    gp = fit_gain(mp_, yp)
                    fine = np.arange(0, 160, 0.5); mf = np.interp(fine - dl, B["times"], B["series"][k, :, 0], left=0)
                    rows.append(dict(turnover_s=tau, clearance_s=Tc, removal=round(rem, 3), D=D, x_m=x, delay_s=dl, burn_r2=round(sc, 4),
                                     pulse_r2=round(r2(yp, gp * mp_), 4), pulse_peak_s=float(fine[mf.argmax()] - w0), gain=g))
            print(f"turnover {tau:.0f} s done ({time.time()-t0:.0f} s)", flush=True)
    rows.sort(key=lambda r: -r["burn_r2"])
    best = rows[0]; top = best["burn_r2"]
    keep = [r for r in rows if r["burn_r2"] >= top - 0.02]   # every setting the burn record cannot tell apart from the best
    obs_peak = float(tp[yp.argmax()] - w0)
    pk = np.array([r["pulse_peak_s"] for r in keep])
    # curves for the site: observed detector, best model, and the band of all kept settings
    tau, Tc, D, x, dl = best["turnover_s"], best["clearance_s"], best["D"], best["x_m"], best["delay_s"]
    def curve(r, prof, t_end, ts, T):
        flow = C.volume / (C.q1 * r["turnover_s"])
        S = simulate(C, [C.cell(r["x_m"], C.ly / 2)], flow, r["D"], t_end=t_end, probes=pr, profile=prof, removal=r["removal"])
        return np.interp(ts - r["delay_s"], S["times"], S["series"][0, :, 0], left=0)
    grid_b = np.arange(40, 1000, 10.0); grid_p = np.arange(0, 160, 2.0)
    pb = lambda s: 1.0 if b0 <= s < b1 else 0.0; pp = lambda s: 1.0 if w0 <= s < w1 else 0.0
    band_b = []; band_p = []
    for r in keep[:40]:
        m = curve(r, pb, 1000, grid_b, None); band_b.append(r["gain"] * m)
        m2 = curve(r, pp, 160, grid_p, None); mi = np.interp(tp, grid_p, m2); band_p.append(fit_gain(mi, yp) * m2)
    band_b, band_p = np.array(band_b), np.array(band_p)
    clear = sorted({r["clearance_s"] for r in keep})
    out = dict(
        status="model", source="engine/calibrate.py", data="NASA PSI-100 Saffire-III flight telemetry, Cygnus F2 smoke detector (scatter channel)",
        cabin=CAB, tuned_on="Sample 1 burn (flame seen by radiometers %.0f to %.0f s after T0)" % (b0, b1), held_out="Smoke-wire puff (wire on %.0f to %.0f s)" % (w0, w1),
        best=best, settings_kept=len(keep), settings_tried=len(rows),
        clearance_s_range=[min(clear), max(clear)], delay_s_range=[float(min(r["delay_s"] for r in keep)), float(max(r["delay_s"] for r in keep))],
        D_values_kept=sorted({r["D"] for r in keep}), x_values_kept=sorted({r["x_m"] for r in keep}),
        pulse=dict(observed_peak_s=obs_peak, model_peak_s_range=[float(pk.min()), float(np.median(pk)), float(pk.max())],
                   peak_error_s_median=float(np.median(np.abs(pk - obs_peak))), shape_r2_median=float(np.median([r["pulse_r2"] for r in keep])),
                   readings_every_s=10),
        burn_curve=dict(t=[round(float(v), 1) for v in grid_b], lo=[round(float(v), 4) for v in band_b.min(0)], hi=[round(float(v), 4) for v in band_b.max(0)],
                        best=[round(float(v), 4) for v in band_b[0]], obs_t=[round(float(v), 1) for v in tb], obs=[round(float(v), 4) for v in yb],
                        flame=[b0, b1]),
        pulse_curve=dict(t=[round(float(v), 1) for v in grid_p], lo=[round(float(v), 4) for v in band_p.min(0)], hi=[round(float(v), 4) for v in band_p.max(0)],
                         best=[round(float(v), 4) for v in band_p[0]], obs_t=[round(float(v), 1) for v in tp], obs=[round(float(v), 4) for v in yp], wire=[w0, w1]),
        top=rows[:12],
        limits=["One detector in one vehicle: the record pins down how fast smoke clears, not how it spreads across a cabin.",
                "Detector units are the raw scatter channel; gain is fitted per event, so only timing and shape are tested.",
                "Cabin shape is assumed; Cygnus geometry is not in the dataset."])
    (ROOT / "data" / "drift_calibration.json").write_text(json.dumps(out, separators=(",", ":")))
    print(json.dumps({k: out[k] for k in ("best", "settings_kept", "settings_tried", "clearance_s_range", "delay_s_range", "D_values_kept", "x_values_kept", "pulse")}, indent=1))
    print(f"done in {time.time()-t0:.0f} s")


if __name__ == "__main__":
    main()
