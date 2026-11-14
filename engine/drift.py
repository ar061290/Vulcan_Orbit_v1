#!/usr/bin/env python3
"""Smoke drift in a cabin with ventilation and no buoyancy, plus what-if runs over fire position,
airflow and smoke release rate.

    python engine/drift.py            # writes data/drift.json and data/whatif.json, prints the checks

Model (2D side view of a cabin section):
  * Air: steady potential flow from a supply slot (overhead, one end) to a return grille (low, other end).
    Divergence-free by construction. Scaled so the mean air speed in the cabin equals the chosen airflow.
  * Smoke: passive scalar carried by the air (first-order upwind) and spread by an effective mixing
    coefficient D. No buoyancy term: in orbit hot gas does not rise.
  * Detector: alarms when the local smoke concentration first reaches ALARM_MG_M3.

Assumptions a reader should know (also written into the output files):
  * Cabin 4.0 m long x 2.0 m high, treated as 2.0 m deep. Supply and return positions are illustrative.
  * Airflow 0.05 to 0.20 m/s (station requirement range, NASA NTRS 20150009509).
  * D = 0.002 to 0.005 m2/s is an assumed effective mixing value, not a measurement.
  * Smoke release 0.2 to 5 mg/s is an assumed range for a small smouldering source.
  * Alarm level 1 mg/m3, the threshold used in NASA's Saffire VI analysis (ICES-2024-365, via our research notes).
This is a screening model. It is not validated fluid dynamics.
"""
import json, math, time
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
LX, LY, DEPTH = 4.0, 2.0, 2.0
NX, NY = 60, 30
DX = LX / NX
ALARM_MG_M3 = 1.0
T_END = 900.0
FLOWS = [0.05, 0.10, 0.20]
DIFFS = [0.002, 0.005]
INLET = (2, 9)        # top wall cells [i0, i1): supply slot, overhead near the left end
OUTLET = (4, 12)      # right wall cells [j0, j1) counted from the floor: return grille, low on the right end

def flow_field():
    """Face velocities (u on vertical faces, v on horizontal faces) for unit inlet speed. Positive v is upward."""
    n_in, n_out = INLET[1] - INLET[0], OUTLET[1] - OUTLET[0]
    v_in, u_out = 1.0, n_in / n_out                       # mass balance: what enters must leave
    b = np.zeros((NY, NX))                                # net prescribed outflow per cell / DX
    b[NY - 1, INLET[0]:INLET[1]] -= v_in / DX             # air entering through the ceiling
    b[OUTLET[0]:OUTLET[1], NX - 1] += u_out / DX          # air leaving through the right wall
    # Discrete continuity in every cell: (sum of neighbour phi - k*phi) / DX^2 = -(prescribed outflow) / DX
    n = NX * NY; A = np.zeros((n, n)); idx = lambda j, i: j * NX + i
    for j in range(NY):
        for i in range(NX):
            r = idx(j, i)
            for jj, ii in ((j, i - 1), (j, i + 1), (j - 1, i), (j + 1, i)):
                if 0 <= jj < NY and 0 <= ii < NX: A[r, idx(jj, ii)] += 1; A[r, r] -= 1
    rhs = (-b * DX * DX).ravel()
    A[0, :] = 0; A[0, 0] = 1; rhs[0] = 0                  # pin one value; the potential is defined up to a constant
    phi = np.linalg.solve(A, rhs).reshape(NY, NX)
    u = np.zeros((NY, NX + 1)); v = np.zeros((NY + 1, NX))
    u[:, 1:-1] = (phi[:, 1:] - phi[:, :-1]) / DX
    v[1:-1, :] = (phi[1:, :] - phi[:-1, :]) / DX
    u[OUTLET[0]:OUTLET[1], NX] = u_out
    v[NY, INLET[0]:INLET[1]] = -v_in
    div = (u[:, 1:] - u[:, :-1] + v[1:, :] - v[:-1, :]) / DX
    uc, vc = (u[:, 1:] + u[:, :-1]) / 2, (v[1:, :] + v[:-1, :]) / 2
    mean_speed = np.hypot(uc, vc).mean()
    return u / mean_speed, v / mean_speed, float(np.abs(div).max() / mean_speed)

U1, V1, DIV_ERR = flow_field()

def simulate(srcs, flow, D, rate_mg_s=1.0, t_end=T_END, probes=None, frame_dt=None):
    """Run one simulation per fire position in `srcs` (list of (i, j) cells), all at once.
    Returns (times, probe concentrations [n_src, n_t, n_probe], frames of the first source, worst mass balance)."""
    if isinstance(srcs, tuple): srcs = [srcs]
    S = len(srcs); u, v = U1 * flow, V1 * flow
    dt = 0.4 * min(DX / max(np.abs(u).max(), np.abs(v).max(), 1e-9), DX * DX / (4 * D))
    n = int(math.ceil(t_end / dt)); dt = t_end / n
    c = np.zeros((S, NY, NX)); cell_vol = DX * DX * DEPTH
    up, um, vp, vm = np.maximum(u, 0), np.minimum(u, 0), np.maximum(v, 0), np.minimum(v, 0)
    si, sj, sk = [a[0] for a in srcs], [a[1] for a in srcs], np.arange(S)
    pi, pj = ([a[0] for a in probes], [a[1] for a in probes]) if probes else ([], [])
    rec_every = max(1, int(round(1.0 / dt)))             # record probes about once a second
    times, series, frames, out_mass, next_frame = [], [], [], np.zeros(S), 0.0
    fx = np.zeros((S, NY, NX + 1)); fy = np.zeros((S, NY + 1, NX))
    for k in range(n + 1):
        t = k * dt
        if k % rec_every == 0 and probes: times.append(t); series.append(c[:, pj, pi].copy())
        if frame_dt and t >= next_frame - 1e-9: frames.append(c[0].copy()); next_frame += frame_dt
        if k == n: break
        fx[:, :, 1:-1] = up[:, 1:-1] * c[:, :, :-1] + um[:, 1:-1] * c[:, :, 1:] - D * (c[:, :, 1:] - c[:, :, :-1]) / DX
        fy[:, 1:-1, :] = vp[1:-1, :] * c[:, :-1, :] + vm[1:-1, :] * c[:, 1:, :] - D * (c[:, 1:, :] - c[:, :-1, :]) / DX
        fx[:, :, NX] = up[:, NX] * c[:, :, NX - 1]        # smoke leaves with the air at the return; walls carry nothing
        out_mass += fx[:, :, NX].sum(axis=1) * DX * DEPTH * dt   # clean air comes in at the supply
        c -= dt * ((fx[:, :, 1:] - fx[:, :, :-1]) + (fy[:, 1:, :] - fy[:, :-1, :])) / DX
        c[sk, sj, si] += rate_mg_s * dt / cell_vol
    released = rate_mg_s * t_end
    balance = (c.sum(axis=(1, 2)) * cell_vol + out_mass) / released
    worst = float(balance[np.argmax(np.abs(balance - 1))])
    return np.array(times), (np.stack(series, axis=1) if probes else None), frames, worst

def first_cross(times, series, level):
    """First time each probe reaches `level` (linear interpolation); nan if never. series is [n_t, n_probe]."""
    hit = series >= level
    k = hit.argmax(axis=0); any_hit = hit.any(axis=0); cols = np.arange(series.shape[1])
    k0 = np.maximum(k - 1, 0); a, b = series[k0, cols], series[k, cols]
    with np.errstate(divide='ignore', invalid='ignore'):
        frac = np.where(b > a, (level - a) / (b - a), 0.0)
    t = np.where(k == 0, times[0], times[k0] + frac * (times[k] - times[k0]))
    return np.where(any_hit, t, np.nan)

def wall_cells():
    """Candidate detector positions: cells along the ceiling, floor and both end walls, every 3rd cell."""
    cells = [(i, NY - 1) for i in range(1, NX, 3)] + [(i, 0) for i in range(1, NX, 3)] + [(0, j) for j in range(2, NY - 1, 3)] + [(NX - 1, j) for j in range(2, NY - 1, 3)]
    return list(dict.fromkeys(cells))

def main():
    t0 = time.time()
    xy = lambda i, j: [round((i + 0.5) * DX, 3), round((j + 0.5) * DX, 3)]
    named = {"Ceiling, mid-cabin (Earth habit)": (NX // 2, NY - 1), "At the air return": (NX - 1, (OUTLET[0] + OUTLET[1]) // 2), "Ceiling, far end": (NX - 4, NY - 1)}
    cands = wall_cells()
    for cell in named.values():
        if cell not in cands: cands.append(cell)
    # ---- checks ---------------------------------------------------------------------------------
    checks = []
    _, _, _, bal = simulate((10, 10), 0.10, 0.002, probes=[(0, 0)], t_end=300)
    checks.append(dict(id="D1", what="Smoke mass is conserved (in cabin + left through the return = released)", value=round(bal, 4), limit="0.99 to 1.01", ok=bool(0.99 <= bal <= 1.01)))
    checks.append(dict(id="D2", what="Air neither appears nor vanishes inside the cabin (max divergence / mean speed, per metre)", value=float(f"{DIV_ERR:.2e}"), limit="< 1e-3", ok=bool(DIV_ERR < 1e-3)))
    tt, ss, _, _ = simulate((30, 15), 1e-9, 0.002, probes=[(26, 15), (34, 15), (30, 11), (30, 19)], t_end=40)
    sym = float(np.ptp(ss[0, -1]) / ss[0, -1].mean())
    checks.append(dict(id="D3", what="With the fans off, smoke spreads evenly in every direction", value=round(sym, 4), limit="spread between 4 equal-distance points < 2%", ok=bool(sym < 0.02)))
    src = (8, 22); ta = []
    for f in (0.05, 0.10, 0.20):
        tt, ss, _, _ = simulate(src, f, 0.002, probes=[named["At the air return"]], t_end=900)
        ta.append(float(first_cross(tt, ss[0], ALARM_MG_M3)[0]))
    ratio = ta[0] / ta[2]
    checks.append(dict(id="D4", what="Faster air carries smoke to the return sooner (0.05 vs 0.20 m/s)", value=f"{ta[0]:.0f} s vs {ta[2]:.0f} s, ratio {ratio:.1f}", limit="ratio between 2 and 4 (4 would be pure transport)", ok=bool(2 <= ratio <= 4.2)))
    for c in checks: print(("PASS " if c["ok"] else "FAIL ") + c["id"], c["what"], "->", c["value"])
    # ---- one showcase run for the animation ---------------------------------------------------------
    show_src, show_flow, show_D = (9, 21), 0.10, 0.002
    probes = list(named.values())
    tt, ss, frames, _ = simulate(show_src, show_flow, show_D, probes=probes, frame_dt=10.0, t_end=600)
    alarms = first_cross(tt, ss[0], ALARM_MG_M3)
    cmax = 20.0                                              # colour scale tops out at 20x the alarm level
    q = lambda f: np.clip(np.round(255 * np.log10(1 + 99 * np.clip(f / cmax, 0, 1)) / 2), 0, 255).astype(int)   # log scale 0..255
    step = 3; uc, vc = (U1[:, 1:] + U1[:, :-1]) / 2 * show_flow, (V1[1:, :] + V1[:-1, :]) / 2 * show_flow
    arrows = [[*xy(i, j), round(float(uc[j, i]), 4), round(float(vc[j, i]), 4)] for j in range(1, NY, step * 2) for i in range(1, NX, step * 2)]
    drift = dict(status="model", source="engine/drift.py", nx=NX, ny=NY, lx_m=LX, ly_m=LY, frame_dt_s=10, flow_m_s=show_flow, D_m2_s=show_D,
                 rate_mg_s=1.0, alarm_mg_m3=ALARM_MG_M3, scale_max_mg_m3=cmax, scale="value = 255 * log10(1 + 99*c/scale_max) / 2",
                 fire=xy(*show_src), supply=[xy(INLET[0], NY - 1)[0] - DX / 2, xy(INLET[1] - 1, NY - 1)[0] + DX / 2], ret=[OUTLET[0] * DX, OUTLET[1] * DX],
                 detectors=[dict(name=n, x=xy(*c)[0], y=xy(*c)[1], alarm_s=None if np.isnan(a) else round(float(a), 1)) for (n, c), a in zip(named.items(), alarms)],
                 arrows=arrows, frames=[q(f)[::-1].ravel().tolist() for f in frames],      # rows from ceiling down, for drawing
                 assumptions=["2D side view of a 4.0 x 2.0 m cabin section, 2.0 m deep", "No buoyancy: smoke only moves with the air and by mixing",
                              "Mixing coefficient D is an assumed effective value", "Supply and return positions are illustrative", "Screening model, not validated fluid dynamics"])
    # ---- library of unit runs: every source on a coarse grid x airflow x mixing --------------------
    srcs = [(i, j) for j in range(2, NY, 5) for i in range(2, NX, 5)]
    lib = {}                                                 # (flow, D) -> array [n_src, n_t, n_cand] at 1 mg/s
    for f in FLOWS:
        for D in DIFFS:
            tt, arr, _, _ = simulate(srcs, f, D, probes=cands)
            lib[(f, D)] = (tt, arr)
    print(f"library: {len(srcs)} fire positions x {len(FLOWS)} airflows x {len(DIFFS)} mixing values in {time.time()-t0:.0f} s")
    # ---- what-if runs ----------------------------------------------------------------------------
    rng = np.random.default_rng(42); N = 3000
    s_idx = rng.integers(0, len(srcs), N); f_idx = rng.integers(0, len(FLOWS), N); d_idx = rng.integers(0, len(DIFFS), N)
    rate = 10 ** rng.uniform(math.log10(0.2), math.log10(5.0), N)
    T = np.full((N, len(cands)), np.nan)                      # time to alarm at every candidate position
    for n in range(N):
        times, arr = lib[(FLOWS[f_idx[n]], DIFFS[d_idx[n]])]
        T[n] = first_cross(times, arr[s_idx[n]] * rate[n], ALARM_MG_M3)   # the model is linear in release rate
    Tinf = np.where(np.isnan(T), np.inf, T)
    def layout_stats(cols):
        t = Tinf[:, cols].min(axis=1); fin = t[np.isfinite(t)]
        boot = [np.mean(rng.choice(t, N) <= 120) for _ in range(300)]
        return dict(caught_60=round(float(np.mean(t <= 60)), 3), caught_120=round(float(np.mean(t <= 120)), 3), caught_300=round(float(np.mean(t <= 300)), 3),
                    caught_120_range=[round(float(np.percentile(boot, 2.5)), 3), round(float(np.percentile(boot, 97.5)), 3)],
                    never=round(float(np.mean(~np.isfinite(t))), 3), median_s=None if not len(fin) else round(float(np.median(t[np.isfinite(t)] if np.mean(np.isfinite(t)) > .5 else fin)), 0)), t
    ci = {c: k for k, c in enumerate(cands)}
    score = lambda cols: float(np.mean(Tinf[:, cols].min(axis=1) <= 120))
    best1 = max(range(len(cands)), key=lambda k: score([k]))
    best2 = max((k for k in range(len(cands)) if k != best1), key=lambda k: score([best1, k]))
    layouts = [("Ceiling, mid-cabin (Earth habit)", [ci[named["Ceiling, mid-cabin (Earth habit)"]]]), ("At the air return", [ci[named["At the air return"]]]),
               ("Best single position found", [best1]), ("Best pair found", [best1, best2])]
    out_layouts = []
    for name, cols in layouts:
        st, t = layout_stats(cols)
        # blind-spot map: median time to alarm for each fire position (rows from ceiling down)
        grid = []
        for k in range(len(srcs)):
            tk = t[s_idx == k]; ok = np.isfinite(tk)
            grid.append(None if ok.mean() < 0.5 else round(float(np.median(tk[ok])), 0))
        out_layouts.append(dict(name=name, detectors=[xy(*cands[c]) for c in cols], **st, map=grid))
        print(f"  {name:36s} caught within 120 s: {st['caught_120']:.0%}  ({st['caught_120_range'][0]:.0%} to {st['caught_120_range'][1]:.0%})  never: {st['never']:.0%}")
    whatif = dict(status="model", source="engine/drift.py", runs=N, seed=42, alarm_mg_m3=ALARM_MG_M3, t_end_s=T_END, lx_m=LX, ly_m=LY,
                  varied=dict(fire_position=f"{len(srcs)} positions on a grid", airflow_m_s=FLOWS, mixing_D_m2_s=DIFFS, release_mg_s="0.2 to 5, log-uniform"),
                  map_nx=len(range(2, NX, 5)), map_ny=len(range(2, NY, 5)), map_xy=[xy(*s) for s in srcs], layouts=out_layouts, checks=checks,
                  note="Share of simulated fires whose smoke reaches the alarm level at a detector within the stated time. Results depend on the assumed cabin layout, mixing value and release-rate range.")
    (ROOT / "data" / "drift.json").write_text(json.dumps(drift, separators=(",", ":")))
    (ROOT / "data" / "whatif.json").write_text(json.dumps(whatif, separators=(",", ":")))
    print(f"wrote data/drift.json ({(ROOT/'data'/'drift.json').stat().st_size/1024:.0f} KB), data/whatif.json ({(ROOT/'data'/'whatif.json').stat().st_size/1024:.0f} KB) in {time.time()-t0:.0f} s")
    print("showcase alarms:", {d['name']: d['alarm_s'] for d in drift['detectors']})

if __name__ == "__main__":
    main()
