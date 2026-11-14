"""Station-module cross-section for the LBM smoke model: geometry, steady air field, smoke runs.

Physical units: metres, seconds, mg. The cabin is a 2D section DEPTH metres deep (same as engine/drift_core.py) so that a
release in mg/s becomes a concentration in mg/m3.
"""
import math
import numpy as np
from lbm import Lattice, scalar_many, scalar_run, stable_dt, FLUID, SOLID, INLET, OUTLET

LX, LY, DX = 4.2, 2.2, 0.05          # m; 84 x 44 air cells
DEPTH = 2.0                          # m, as engine/drift_core.py
NU_EFF = 0.02                        # m2/s, effective (eddy) viscosity = middle mixing value kept by the Saffire-III
                                     # calibration (data/drift_calibration.json), turbulent Schmidt number 1 (README, Decisions)
U_LAT_VENT = 0.05                    # target lattice speed at the supply vent

# Rectangles (x0, x1, y0, y1) in metres: rack fronts on the overhead and deck. Illustrative layout (README, Decisions).
RACKS = [(0.60, 2.00, 1.90, 2.20), (2.40, 3.80, 1.90, 2.20), (0.40, 1.90, 0.00, 0.30), (2.30, 3.60, 0.00, 0.30)]
SUPPLY = ("top", 0.15, 0.55)         # wall, start, end (m along the wall)
RETURN = ("right", 0.40, 0.90)


class Cabin:
    def __init__(self, racks=RACKS, supply=SUPPLY, ret=RETURN, lx=LX, ly=LY, dx=DX):
        self.lx, self.ly, self.dx = lx, ly, dx
        self.nx, self.ny = int(round(lx / dx)), int(round(ly / dx))
        self.racks, self.supply, self.ret = racks, supply, ret
        typ = np.full((self.ny + 2, self.nx + 2), SOLID, dtype=np.int64)
        typ[1:-1, 1:-1] = FLUID
        for x0, x1, y0, y1 in racks:
            i0, i1 = int(round(x0 / dx)), int(round(x1 / dx)); j0, j1 = int(round(y0 / dx)), int(round(y1 / dx))
            typ[1 + j0:1 + j1, 1 + i0:1 + i1] = SOLID
        self.vent_cells = {}
        for name, (wall, a, b), kind in (("supply", supply, INLET), ("return", ret, OUTLET)):
            k0, k1 = int(round(a / dx)), int(round(b / dx))
            cells = []
            for k in range(k0, k1):
                if wall == "top": c = (1 + k, self.ny + 1, 0, 1)
                elif wall == "bottom": c = (1 + k, 0, 0, -1)
                elif wall == "left": c = (0, 1 + k, -1, 0)
                else: c = (self.nx + 1, 1 + k, 1, 0)
                cells.append(c); typ[c[1], c[0]] = kind
            self.vent_cells[name] = cells
        self.typ = typ
        self.open = (typ != SOLID).astype(np.int64)
        self.air = (typ == FLUID)

    # ---- coordinates: array node (i, j) <-> metres. Air cell centres sit at (i - 0.5) * dx.
    def xy(self, i, j):
        return [round((i - 0.5) * self.dx, 3), round((j - 0.5) * self.dx, 3)]

    def node(self, x, y):
        return (int(min(self.nx, max(1, math.floor(x / self.dx) + 1))), int(min(self.ny, max(1, math.floor(y / self.dx) + 1))))

    def area_open(self):
        return float(self.air.sum()) * self.dx ** 2

    def flow(self, mean_speed, nu=NU_EFF, iters=4):
        """Steady air field with the mean air speed over the cabin = mean_speed (m/s). Returns dict with u, v (m/s)."""
        dx = self.dx
        sgn = {"top": (0, -1), "bottom": (0, 1), "left": (1, 0), "right": (-1, 0)}[self.supply[0]]
        vents = [(i, j, i - nx_, j - ny_, U_LAT_VENT * sgn[0], U_LAT_VENT * sgn[1]) for i, j, nx_, ny_ in self.vent_cells["supply"]]
        vents += [(i, j, i - nx_, j - ny_, 0.0, 0.0) for i, j, nx_, ny_ in self.vent_cells["return"]]
        dt = U_LAT_VENT * dx / (mean_speed * 5.0)               # first guess; corrected below
        lat = None; log = []
        for it in range(iters):
            tau = 0.5 + 3.0 * nu * dt / dx ** 2
            if lat is None:
                lat = Lattice(self.typ, tau, vents=vents)
            else:
                lat.tau = tau; lat.wp = lat.wm = 1.0 / tau
            st = lat.run_steady(tol=1e-3 if it < iters - 1 else 2e-4, chunk=1000)
            _, ux, uy = lat.macro()
            m_lat = float(np.hypot(ux, uy)[self.air].mean())
            dt_new = m_lat * dx / mean_speed
            log.append(dict(iter=it, tau=tau, dt=dt, steps=st["steps"], change=st["change"], mean_lat=m_lat))
            if abs(dt_new / dt - 1) < 0.01 and it > 0:
                dt = dt_new; break
            dt = dt_new
        tau = 0.5 + 3.0 * nu * dt / dx ** 2
        lat.tau = tau; lat.wp = lat.wm = 1.0 / tau
        st = lat.run_steady(tol=2e-4, chunk=1000)
        rho, ux, uy = lat.macro()
        sc = dx / dt
        u = np.where(self.open == 1, ux * sc, 0.0); v = np.where(self.open == 1, uy * sc, 0.0)
        mean = float(np.hypot(u, v)[self.air].mean())
        lat_max = float(np.hypot(ux, uy)[self.open == 1].max())
        # volume flow in through the supply (m3/s), from the field itself
        q_in = sum(-(u[j, i] * nx_ + v[j, i] * ny_) for i, j, nx_, ny_ in self.vent_cells["supply"]) * dx * DEPTH
        return dict(u=u, v=v, dt_lbm=dt, tau=tau, u_lat_max=lat_max, mean=mean, steady=st["steady"], change=st["change"],
                    steps=lat.steps, q_in=float(q_in), rho_range=[float(rho[self.open == 1].min()), float(rho[self.open == 1].max())],
                    log=log)

    def vents_arrays(self):
        vc = self.vent_cells["supply"] + self.vent_cells["return"]
        a = np.array(vc, dtype=np.int64)
        return a[:, 0].copy(), a[:, 1].copy(), a[:, 2].astype(float), a[:, 3].astype(float)

    def run_smoke(self, fl, sources, D, rate_mg_s=1.0, t_end=300.0, probes=None, patch=1, keep=0.0, profile=None,
                  frame_dt=None, rec_dt=1.0, c0=None):
        """Smoke runs on a steady field `fl`. sources: list of nodes; one independent run per source.
        Concentration in mg/m3. profile(t) multiplies the release rate (default 1). keep: share of return-air smoke sent back
        by the supply (1 - filter removal). Returns times, series [n_src, n_t, n_probe], balance, and frames for one source."""
        dx = self.dx
        ux, uy = np.ascontiguousarray(fl["u"] / dx), np.ascontiguousarray(fl["v"] / dx)     # cells per second
        Dc = D / dx ** 2
        dt0 = stable_dt(ux, uy, Dc)
        m = int(math.ceil(rec_dt / dt0)); dt = rec_dt / m
        n = int(round(t_end / dt))
        cell_vol = dx * dx * DEPTH
        tk = np.arange(n + 1) * dt
        prof = np.ones(n + 1) if profile is None else np.array([profile(t) for t in tk], dtype=float)
        amt = rate_mg_s * dt / cell_vol * prof
        amt[-1] = 0.0                                          # the last record is taken before this step
        vi, vj, vnx, vny = self.vents_arrays()
        probes = probes or [(1, 1)]
        pi = np.array([p[0] for p in probes], dtype=np.int64); pj = np.array([p[1] for p in probes], dtype=np.int64)
        c0a = np.zeros_like(fl["u"]) if c0 is None else c0
        released = amt[:-1].sum() * cell_vol + c0a.sum() * cell_vol
        if frame_dt:
            s = sources[0]
            se, fr, gone, c = scalar_run(ux, uy, self.open, Dc, dt, n, c0a, s[0], s[1], amt, vi, vj, vnx, vny, keep,
                                         pi, pj, patch, m, int(round(frame_dt / dt)))
            bal = (c.sum() * cell_vol + gone * cell_vol) / max(released, 1e-300)
            return dict(times=np.arange(se.shape[0]) * rec_dt, series=se[None], frames=fr, balance=np.array([bal]), dt=dt,
                        released=released, final=c)
        si = np.array([s[0] for s in sources], dtype=np.int64); sj = np.array([s[1] for s in sources], dtype=np.int64)
        se, gone, tot = scalar_many(ux, uy, self.open, Dc, dt, n, c0a, si, sj, amt, vi, vj, vnx, vny, keep, pi, pj, patch, m)
        bal = (tot * cell_vol + gone * cell_vol) / max(released, 1e-300)
        return dict(times=np.arange(se.shape[1]) * rec_dt, series=se, balance=bal, dt=dt, released=released)

    def wall_candidates(self, every=3):
        """Air cells touching a wall or rack face: places a detector could be mounted."""
        out = []
        ny, nx = self.typ.shape
        for j in range(1, ny - 1):
            for i in range(1, nx - 1):
                if self.typ[j, i] != FLUID:
                    continue
                if any(self.typ[j + dj, i + di] == SOLID for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    out.append((i, j))
        out = out[::every]
        return out

    def source_grid(self, step=5):
        return [(i, j) for j in range(3, self.ny + 1, step) for i in range(3, self.nx + 1, step) if self.typ[j, i] == FLUID]


def first_cross(times, series, level):
    """First time each column of series [n_t, n_probe] reaches level (linear interpolation); nan if never."""
    hit = series >= level
    k = hit.argmax(axis=0); anyh = hit.any(axis=0); cols = np.arange(series.shape[1])
    k0 = np.maximum(k - 1, 0); a, b = series[k0, cols], series[k, cols]
    with np.errstate(divide="ignore", invalid="ignore"):
        frac = np.where(b > a, (level - a) / (b - a), 0.0)
    t = np.where(k == 0, times[0], times[k0] + frac * (times[k] - times[k0]))
    return np.where(anyh, t, np.nan)
