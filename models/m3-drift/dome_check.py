"""Dome check: the same LBM code with gravity on (Boussinesq buoyancy) and a small heat source.

No dome measurements exist in data/ or datasets/ yet (data/manifest.json lists dome_* as "missing"), so `run()` does two things:
  1. looks for data/dome_heat.json (shape in dome_check.md); if present, runs the comparison D-dome;
  2. otherwise runs a DEMONSTRATION on placeholder geometry to show the gravity-on path works (the plume rises).
     The placeholder numbers are not the dome's and the demonstration is not a check.
Air properties come from Cantera (gri30 mixture-averaged transport, dry air at 293.15 K, 101.325 kPa).
"""
import json, math
from pathlib import Path
import numpy as np
from lbm import Lattice, scalar_run, FLUID, SOLID

ROOT = Path(__file__).resolve().parents[2]
DEMO = dict(note="DEMONSTRATION placeholder geometry, not the dome. Replace with the dome's values (dome_check.md).",
            box_m=[0.20, 0.20], depth_m=0.10, dx_m=0.001, source_xy_m=[0.10, 0.02], source_size_m=0.01, source_W=0.05, t_end_s=20.0,
            sensors_xy_m=[[0.10, 0.18], [0.04, 0.18], [0.16, 0.18], [0.02, 0.10], [0.18, 0.10]])


def air_props(T=293.15, P=101325.0):
    import cantera as ct
    g = ct.Solution("gri30.yaml"); g.TPX = T, P, "O2:0.21, N2:0.79"
    return dict(rho=g.density, cp=g.cp_mass, nu=g.viscosity / g.density, alpha=g.thermal_conductivity / (g.density * g.cp_mass), beta=1.0 / T, T=T)


def simulate(cfg, g=9.81):
    a = air_props()
    dx = cfg["dx_m"]; nx, ny = int(round(cfg["box_m"][0] / dx)), int(round(cfg["box_m"][1] / dx))
    typ = np.full((ny + 2, nx + 2), SOLID, np.int64); typ[1:-1, 1:-1] = FLUID
    tau = 0.55
    dt = (tau - 0.5) / 3 * dx * dx / a["nu"]                       # time step that gives tau = 0.55 with real air viscosity
    lat = Lattice(typ, tau)
    open_ = (typ != SOLID).astype(np.int64)
    Tl = np.zeros(typ.shape)                                      # temperature rise above ambient, K
    si, sj = int(cfg["source_xy_m"][0] / dx) + 1, int(cfg["source_xy_m"][1] / dx) + 1
    h = max(0, int(round(cfg.get("source_size_m", dx) / dx / 2)))       # heater spread over a small square, not one cell
    patch = (slice(sj - h, sj + h + 1), slice(si - h, si + h + 1))
    dT_step = cfg["source_W"] / cfg["depth_m"] * dt / (a["rho"] * a["cp"] * dx * dx * (2 * h + 1) ** 2)
    Dl = a["alpha"] * dt / dx ** 2
    n = int(round(cfg["t_end_s"] / dt))
    acc = g * a["beta"] * dt * dt / dx                            # lattice acceleration per kelvin
    e = np.zeros(0, np.int64); ef = np.zeros(0); amt = np.zeros(2)
    pi = np.array([int(p[0] / dx) + 1 for p in cfg["sensors_xy_m"]], np.int64)
    pj = np.array([int(p[1] / dx) + 1 for p in cfg["sensors_xy_m"]], np.int64)
    rec = max(1, int(round(1.0 / dt))); series = []; umax = 0.0
    for k in range(n):
        lat.fy[:, :] = acc * Tl * open_
        lat.run(1)
        _, ux, uy = lat.macro()
        if k % rec == 0:
            series.append(Tl[pj, pi].copy()); umax = max(umax, float(np.hypot(ux, uy).max()))
        _, _, _, Tl = scalar_run(ux, uy, open_, Dl, 1.0, 1, Tl, -1, -1, amt, e, e, ef, ef, 0.0, pi[:1], pj[:1], 0, 1, 0)
        Tl[patch] += dT_step
    ys = (np.arange(ny + 2) - 0.5) * dx
    heat_y = float((Tl.sum(axis=1) * ys).sum() / max(Tl.sum(), 1e-300))
    return dict(dt_s=dt, tau=tau, steps=n, u_lat_max=umax, u_max_m_s=umax * dx / dt, heat_centroid_y_m=heat_y,
                source_y_m=cfg["source_xy_m"][1], sensor_rise_K=np.array(series).round(4).tolist(), air=a)


def run(log):
    f = ROOT / "data" / "dome_heat.json"
    if f.exists():
        d = json.loads(f.read_text())
        cfg = dict(box_m=d["box_m"], depth_m=d["depth_m"], dx_m=d.get("dx_m", 0.001), source_xy_m=d["source_xy_m"], source_W=d["source_W"], source_size_m=d.get("source_size_m", 0.01),
                   t_end_s=d["t_end_s"], sensors_xy_m=[s["xy_m"] for s in d["sensors"]])
        r = simulate(cfg)
        model = np.array(r["sensor_rise_K"][-1]); meas = np.array([s["rise_K"] for s in d["sensors"]])
        ratio = model / np.where(meas == 0, np.nan, meas)
        ok = bool(np.all((ratio > 0.5) & (ratio < 2.0)) and (np.argsort(model) == np.argsort(meas)).all())
        log("D-dome", ok, f"model/measured rise per sensor {np.round(ratio, 2).tolist()} (limit 0.5 to 2, same order)")
        return dict(mode="comparison", result=r, ratio=ratio.tolist())
    r = simulate(DEMO)
    log("D-dome", None, "not run: no dome data in data/ or datasets/. Demonstration on placeholder geometry: "
                        f"heat centroid at y = {r['heat_centroid_y_m']:.3f} m above a source at {r['source_y_m']} m, "
                        f"largest lattice speed {r['u_lat_max']:.3f}")
    return dict(mode="demonstration", config=DEMO, result={k: v for k, v in r.items() if k != "air"}, air=r["air"])
