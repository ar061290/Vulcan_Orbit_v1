"""M6b growth simulation: how a surface flame seen by the CV model develops on its fuel. Pure function, no file I/O.

    from growth import simulate
    out = simulate(flame_state, fuel, conditions, params)

flame_state (CV model output, shape in CONTRACT_PROPOSAL.md):
    {"flame_type": "surface"|"droplet", "frame_time_s": float, "area_cm2": float,
     "centroid_cm": [x, y], "bbox_cm": [x0, y0, x1, y1]}            # fuel-surface coordinates, x along the fuel length
fuel:       {"material": "PMMA"|"SIBAL"|"cotton", "width_cm", "length_cm", "thickness_mm", "sides_burning": 1|2,
             "area_density_mg_cm2" (fabric, optional)}
conditions: {"flow_cm_s", "flow_direction_deg" (direction the air moves, fuel coordinates, 0 = +x), "o2_vol_pct", "pressure_atm"}
params:     the "constants" block of data/spread_predictor.json (built by build.py).

Method (RULES.md section 6): the burning region grows with a convex spread shape of two half-ellipses (downwind semi-axis V_c,
upwind V_o, cross-flow V_s = (V_c + V_o)/2). Arrival time of each grid cell = smallest gauge distance from the initial burning cells
(exact Huygens propagation for a convex shape on a rectangular fuel; the front at time t is the set of cells with arrival <= t).
Each cell burns for a burnout time t_b after it ignites. Burning area = ignited and not yet burned out. Run at lo / mid / hi.
This is a reduced-order model calibrated to NASA ISS data; it does not reproduce real spacecraft fires.
"""
import math

import numpy as np

from predictor import NO_SPREAD, VERDICTS, FABRICS, geometry_class, spread_rates, verdict

RUNS = ("lo", "mid", "hi")
N_SAMPLES = 301


def _sig(x, n=4):
    if x is None or not np.isfinite(x):
        return None
    return float(f"{x:.{n}g}")


def _grid(fuel, dx_cm):
    """Cell centres. dx_cm: None (default min(0.25 cm, L/200, W/4)), one number, or (dx, dy) to reuse another run's exact cells."""
    L, W = float(fuel["length_cm"]), float(fuel["width_cm"])
    if dx_cm is None:
        dx_cm = min(0.25, L / 200.0, W / 4.0)
    dx, dy = (dx_cm, dx_cm) if np.isscalar(dx_cm) else dx_cm
    nx, ny = max(1, math.ceil(L / dx - 1e-9)), max(1, math.ceil(W / dy - 1e-9))
    dxx, dyy = L / nx, W / ny
    xc = (np.arange(nx) + 0.5) * dxx
    yc = (np.arange(ny) + 0.5) * dyy
    X, Y = np.meshgrid(xc, yc, indexing="ij")          # shape (nx, ny)
    return X, Y, dxx, dyy


def _initial_mask(X, Y, flame):
    x0, y0, x1, y1 = (float(v) for v in flame["bbox_cm"])
    cx, cy = (float(v) for v in flame["centroid_cm"])
    area = float(flame["area_cm2"])
    a, b = max((x1 - x0) / 2.0, 1e-9), max((y1 - y0) / 2.0, 1e-9)
    s = math.sqrt(max(area, 0.0) / (math.pi * a * b))
    m = ((X - cx) / (s * a)) ** 2 + ((Y - cy) / (s * b)) ** 2 <= 1.0
    if not m.any():
        i = int(np.clip(np.searchsorted(X[:, 0], cx), 0, X.shape[0] - 1))
        j = int(np.clip(np.searchsorted(Y[0, :], cy), 0, X.shape[1] - 1))
        m[i, j] = True
    return m


def _boundary(mask):
    """Initial cells with a 4-neighbour outside the initial region (the nearest initial cell to any outside cell is one of these)."""
    p = np.pad(mask, 1, constant_values=False)
    interior = p[1:-1, 1:-1] & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    return mask & ~interior


BIG = 1e150          # stands in for 1/0: BIG**2 = 1e300 stays finite, so 0 * BIG**2 = 0 keeps p = 0 exact; any non-zero displacement becomes unreachable


def _inv(v):
    return 1.0 / v if v > 0 else BIG


def _arrival(X, Y, init, ux, uy, shapes):
    """Arrival time (s) of every cell for each (vc, vo, vs) in `shapes` (cm/s). Initial cells are 0.

    Gauge of the two-half-ellipse shape: t = sqrt((p / a)^2 + (q / vs)^2), p = displacement along the flow (a = vc downwind,
    vo upwind), q = across the flow; minimised over the boundary cells of the initial region (the nearest initial cell to any
    outside cell lies on that boundary)."""
    ts = []
    for _ in shapes:
        t = np.full(X.shape, np.inf)
        t[init] = 0.0
        ts.append(t)
    live = [k for k, (vc, vo, vs) in enumerate(shapes) if max(vc, vo, vs) > 0]
    if not live or init.all():
        return ts
    inv = {k: (_inv(shapes[k][0]), _inv(shapes[k][1]), _inv(shapes[k][2])) for k in live}
    src = np.argwhere(_boundary(init))
    sx, sy = X[src[:, 0], src[:, 1]], Y[src[:, 0], src[:, 1]]
    sp, sq = sx * ux + sy * uy, sx * uy - sy * ux          # source coordinates along / across the flow
    out_idx = np.argwhere(~init)
    tx, ty = X[out_idx[:, 0], out_idx[:, 1]], Y[out_idx[:, 0], out_idx[:, 1]]
    tp, tq = tx * ux + ty * uy, tx * uy - ty * ux
    best = {k: np.empty(len(tx)) for k in live}
    chunk = max(1, 2_000_000 // max(1, len(sx)))
    with np.errstate(over="ignore", invalid="ignore"):
        for i in range(0, len(tx), chunk):
            p = tp[i:i + chunk, None] - sp[None, :]
            q2 = np.square(tq[i:i + chunk, None] - sq[None, :])
            pos = p > 0
            p2 = np.square(p)
            for k in live:
                ic, io, iv = inv[k]
                g2 = p2 * np.where(pos, ic * ic, io * io) + q2 * (iv * iv)
                best[k][i:i + chunk] = g2.min(axis=1)
    for k in live:
        g = np.sqrt(best[k])
        g[~(g < 1e100)] = np.inf
        ts[k][out_idx[:, 0], out_idx[:, 1]] = g
    return ts


def _area_curve(ta, tb, cell_area, times):
    s = np.sort(ta[np.isfinite(ta)])
    lit = np.searchsorted(s, times, side="right")
    out = np.searchsorted(s, times - tb, side="right")
    return (lit - out) * cell_area


def _summary(ta, tb, cell_area, stop_reason):
    s = np.sort(ta[np.isfinite(ta)])
    if len(s) == 0:
        return {"max_area_cm2": 0.0, "t_max_s": 0.0, "t_end_s": 0.0, "area_consumed_cm2": 0.0, "stop_reason": stop_reason}
    ev = np.unique(s)                                      # burning area can only rise at an ignition time
    a = (np.searchsorted(s, ev, side="right") - np.searchsorted(s, ev - tb, side="right")) * cell_area
    k = int(np.argmax(a))
    return {"max_area_cm2": float(a[k]), "t_max_s": float(ev[k]), "t_end_s": float(s[-1] + tb),
            "area_consumed_cm2": float(len(s) * cell_area), "stop_reason": stop_reason}


def droplet_pointer(flame_state):
    return {"status": "model", "flame_type": "droplet", "handled_by": "M7",
            "note": "Droplet flames are not simulated by M6b. Droplet burnout follows the d-squared law: t_burnout = d0^2 / K. "
                    "K (mm^2/s) comes from M7's burning-rate model (data/models.json id 'm7-burning-rate'); the chance the flame goes out "
                    "comes from 'm7-extinction', and whether it burns on invisibly from 'm7-cool-flame'. See GROWTH_API.md.",
            "frame_time_s": flame_state.get("frame_time_s"), "values": None}


def rates_for(fuel, conditions, params):
    """lo/mid/hi opposed, concurrent and cross-flow rates (mm/s) after the null rules of RULES.md section 5, with labels."""
    mat = fuel["material"]
    th = fuel.get("thickness_mm") or 0.0
    sides = fuel.get("sides_burning", 2)
    u, o2, p = float(conditions["flow_cm_s"]), float(conditions["o2_vol_pct"]), float(conditions.get("pressure_atm", 1.0))
    r = spread_rates(mat, th, sides, u, o2, p, params, area_density=fuel.get("area_density_mg_cm2"))
    notes, calibrated, extrapolated, assumed = [], [], [], []
    rates = {}
    for run in RUNS:
        vo, vc = float(r["opposed"][run]), float(r["concurrent"][run])
        if mat in FABRICS:
            if math.isnan(vo):
                vo = 0.0
        else:
            if math.isnan(vc):            # thin-regime PMMA in concurrent flow: no data -> opposed rate
                vc = vo
        rates[run] = {"opposed": vo, "concurrent": vc}
    reg = str(np.asarray(r["opposed"]["regime"]).item()) if mat == "PMMA" else "thin fabric"
    if mat == "PMMA":
        calibrated.append(f"opposed (upwind) rate: de Ris x {reg}-regime factor from 39 BASS-II slab rates")
        (calibrated if bool(r["opposed"]["in_domain"]) else extrapolated).append(
            "opposed rate inside the calibration box" if bool(r["opposed"]["in_domain"]) else
            "opposed rate OUTSIDE the calibration box (thickness, flow, O2 or pressure)")
        if reg == "thick":
            (calibrated if bool(r["concurrent"]["in_domain"]) else extrapolated).append(
                "downwind rate: observed bound 0 to 0.167 mm/s (PSI-99 thick PMMA anchored at 20 cm/s, 22% O2)"
                + ("" if bool(r["concurrent"]["in_domain"]) else ", used outside the observed condition"))
        else:
            assumed.append("downwind rate over thin-regime PMMA: no data; set equal to the opposed rate")
    else:
        calibrated.append("downwind (concurrent) rate: scaling law x one constant from 6 reported spacecraft flights")
        if not bool(r["concurrent"]["in_domain"]):
            extrapolated.append("concurrent rate OUTSIDE the calibration box (flow 19-25 cm/s, O2 21.2-26.9%, 76-102 kPa)")
        assumed.append("upwind (opposed) rate over fabric: no data and no model; set to 0, so upwind growth is not simulated")
    assumed.append("cross-flow rate = mean of downwind and upwind rates (no data)")
    if u == 0:
        assumed.append("zero flow: spread taken as isotropic at the opposed formula's zero-flow rate")
    return rates, {"calibrated": calibrated, "extrapolated": extrapolated, "assumed": assumed, "notes": notes}


def burnout_times(fuel, params):
    b = params["burnout"]
    if fuel["material"] in FABRICS:
        return dict(zip(RUNS, b["fabric_s"]))
    tau = fuel["thickness_mm"] / 2.0 if fuel.get("sides_burning", 2) == 2 else fuel["thickness_mm"]
    return {run: tau / reg for run, reg in zip(RUNS, b["pmma_regression_mm_s"])}


def overall_verdict(fuel, conditions, params):
    """Worst verdict over the two flow directions at the input flow and O2 (RULES.md section 4)."""
    th = fuel.get("thickness_mm") or 0.0
    out = {"code": 0, "label": VERDICTS[0], "by_direction": {}, "matched_cases": []}
    for d in ("opposed", "concurrent"):
        code, matched = verdict(fuel["material"], th, d, conditions["flow_cm_s"], conditions["o2_vol_pct"], params)
        out["by_direction"][d] = VERDICTS[int(code)]
        out["matched_cases"] += [dict(m, flow_direction=d) for m in matched]
        out["code"] = max(out["code"], int(code))
    out["label"] = VERDICTS[out["code"]]
    return out


def simulate(flame_state, fuel, conditions, params, dx_cm=None, n_samples=N_SAMPLES):
    if flame_state.get("flame_type", "surface") == "droplet":
        return droplet_pointer(flame_state)
    geometry_class(fuel["material"], fuel.get("thickness_mm") or 0.0)            # raises for unmodelled materials
    X, Y, dxx, dyy = _grid(fuel, dx_cm)
    cell = dxx * dyy
    init = _initial_mask(X, Y, flame_state)
    v = overall_verdict(fuel, conditions, params)
    rates, labels = rates_for(fuel, conditions, params)
    tbs = burnout_times(fuel, params)
    u = float(conditions["flow_cm_s"])
    ang = math.radians(float(conditions.get("flow_direction_deg", 0.0)))
    ux, uy = math.cos(ang), math.sin(ang)
    shapes = []
    for run in RUNS:
        vo, vc = rates[run]["opposed"], rates[run]["concurrent"]
        if u == 0:
            vc = vo                                  # isotropic
        vs = (vc + vo) / 2.0
        rates[run]["cross_flow"] = vs
        shapes.append((vc / 10.0, vo / 10.0, vs / 10.0))      # mm/s -> cm/s
    if v["code"] == NO_SPREAD:
        tas = [np.where(init, 0.0, np.inf) for _ in RUNS]
    else:
        tas = _arrival(X, Y, init, ux, uy, shapes)
    runs = {}
    for run, ta in zip(RUNS, tas):
        if v["code"] == NO_SPREAD:
            reason = "observed no-spread conditions"
        else:
            reason = "fuel edge" if np.isfinite(ta).all() else "burned out"
        runs[run] = (ta, tbs[run], reason)
    t_end = max(_summary(ta, tb, cell, r)["t_end_s"] for ta, tb, r in runs.values())
    times = np.linspace(0.0, t_end, n_samples) if t_end > 0 else np.zeros(1)
    t0 = float(flame_state.get("frame_time_s", 0.0) or 0.0)
    out = {"status": "model", "flame_type": "surface",
           "units": {"time": "s", "area": "cm2", "rate": "mm/s", "length": "cm"},
           "verdict": v,
           "rates_mm_s": {k: {d: _sig(x) for d, x in r.items()} for k, r in rates.items()},
           "burnout_s": {k: _sig(x) for k, x in tbs.items()},
           "grid": {"dx_cm": _sig(dxx, 6), "dy_cm": _sig(dyy, 6), "nx": int(X.shape[0]), "ny": int(X.shape[1]),
                    "initial_area_cm2": _sig(init.sum() * cell)},
           "t_s": [_sig(x, 6) for x in times], "t_abs_s": [_sig(t0 + x, 8) for x in times],
           "area_cm2": {}, "summary": {}, **labels,
           "limits": "Reduced-order model calibrated to NASA ISS data; not a reproduction of real spacecraft fires. "
                     "Microgravity only. Says nothing about whether a material or atmosphere is safe."}
    for run, (ta, tb, reason) in runs.items():
        out["area_cm2"][run] = [_sig(a) for a in _area_curve(ta, tb, cell, times)]
        out["summary"][run] = {k: (_sig(x) if isinstance(x, float) else x) for k, x in _summary(ta, tb, cell, reason).items()}
    out["_arrays"] = {run: runs[run][0] for run in RUNS}        # for checks in build.py; dropped before writing JSON
    out["_grid"] = (X, Y)
    out["_cell"] = (dxx, dyy)
    out["_init"] = init
    return out
