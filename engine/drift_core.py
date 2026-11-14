"""Core of the smoke drift model: cabin air field + smoke transport solver.

Air:   steady potential flow between a supply opening and a return opening (no air appears or vanishes).
Smoke: passive scalar. Advection by a flux-limited (van Leer) second-order scheme, or first-order upwind
       for comparison; explicit central mixing term with effective coefficient D. No buoyancy.
The scheme is conservative: smoke only enters at the source and only leaves through the return.
"""
import math
import numpy as np
from numba import njit, prange
from scipy.sparse import lil_matrix, csr_matrix
from scipy.sparse.linalg import spsolve

DEPTH = 2.0   # m, cabin depth used to turn the 2D picture into volumes


class Cabin:
    """Rectangular cabin section. Openings are (wall, start_m, end_m) with wall in top/bottom/left/right."""

    def __init__(self, nx=60, ny=30, lx=4.0, ly=2.0, inlet=("top", 0.4 / 3, 2.0 / 3), outlet=("right", 0.8 / 3, 0.8), name="A", depth=DEPTH):
        self.nx, self.ny, self.lx, self.ly, self.name, self.depth = nx, ny, lx, ly, name, depth
        self.dx = lx / nx
        assert abs(ly / ny - self.dx) < 1e-12, "cells must be square"
        self.inlet, self.outlet = inlet, outlet
        self._solve()

    def cells(self, opening):
        wall, a, b = opening
        i0, i1 = int(round(a / self.dx)), int(round(b / self.dx))
        return wall, i0, max(i1, i0 + 1)

    def _set(self, u, v, opening, speed_in):
        """Write the normal speed on an opening. speed_in > 0 means air entering the cabin."""
        wall, a, b = self.cells(opening)
        if wall == "top": v[self.ny, a:b] = -speed_in
        elif wall == "bottom": v[0, a:b] = speed_in
        elif wall == "left": u[a:b, 0] = speed_in
        elif wall == "right": u[a:b, self.nx] = -speed_in

    def _solve(self):
        nx, ny, dx = self.nx, self.ny, self.dx
        u = np.zeros((ny, nx + 1)); v = np.zeros((ny + 1, nx))
        n_in = self.cells(self.inlet)[2] - self.cells(self.inlet)[1]
        n_out = self.cells(self.outlet)[2] - self.cells(self.outlet)[1]
        self._set(u, v, self.inlet, 1.0)
        self._set(u, v, self.outlet, -n_in / n_out)            # what enters must leave
        b = (u[:, 1:] - u[:, :-1] + v[1:, :] - v[:-1, :]) / dx   # net prescribed outflow per cell
        n = nx * ny; A = lil_matrix((n, n))
        for j in range(ny):
            for i in range(nx):
                r = j * nx + i; k = 0
                if i > 0: A[r, r - 1] = 1; k += 1
                if i < nx - 1: A[r, r + 1] = 1; k += 1
                if j > 0: A[r, r - nx] = 1; k += 1
                if j < ny - 1: A[r, r + nx] = 1; k += 1
                A[r, r] = -k
        rhs = (-b * dx * dx).ravel()
        A[0, :] = 0; A[0, 0] = 1; rhs[0] = 0                     # the potential is defined up to a constant
        phi = spsolve(csr_matrix(A), rhs).reshape(ny, nx)
        u[:, 1:-1] = (phi[:, 1:] - phi[:, :-1]) / dx
        v[1:-1, :] = (phi[1:, :] - phi[:-1, :]) / dx
        div = (u[:, 1:] - u[:, :-1] + v[1:, :] - v[:-1, :]) / dx
        uc, vc = (u[:, 1:] + u[:, :-1]) / 2, (v[1:, :] + v[:-1, :]) / 2
        mean = np.hypot(uc, vc).mean()
        self.u1, self.v1 = u / mean, v / mean                     # scaled so the mean air speed is 1
        self.div_err = float(np.abs(div).max() / mean)
        # volume flow through the cabin per unit mean speed (m3/s per m/s)
        self.q1 = float(n_in * dx * self.depth / mean)
        self.volume = self.lx * self.ly * self.depth

    def turnover_s(self, flow):
        """Time for the ventilation to move one cabin volume of air."""
        return self.volume / (self.q1 * flow)

    def xy(self, i, j):
        return [round((i + 0.5) * self.dx, 3), round((j + 0.5) * self.dx, 3)]

    def cell(self, x, y):
        return (min(self.nx - 1, max(0, int(x / self.dx))), min(self.ny - 1, max(0, int(y / self.dx))))

    def outlet_cells(self):
        wall, a, b = self.cells(self.outlet)
        if wall == "right": return [(self.nx - 1, j) for j in range(a, b)]
        if wall == "left": return [(0, j) for j in range(a, b)]
        if wall == "top": return [(i, self.ny - 1) for i in range(a, b)]
        return [(i, 0) for i in range(a, b)]

    def return_probe(self):
        c = self.outlet_cells(); return c[len(c) // 2]


@njit(cache=True)
def _one(u, v, D, dx, dt, nsteps, si, sj, add, prof, c0, pi, pj, pr, rec_every, frame_every, scheme, keep):
    ny, nx = u.shape[0], v.shape[1]
    c = c0.copy()
    sx = np.zeros((ny, nx)); sy = np.zeros((ny, nx))
    fx = np.zeros((ny, nx + 1)); fy = np.zeros((ny + 1, nx))
    npb = len(pi)
    series = np.zeros((nsteps // rec_every + 1, npb))
    nfr = nsteps // frame_every + 1 if frame_every > 0 else 0
    frames = np.zeros((nfr, ny, nx))
    out = 0.0
    csup = 0.0                                        # smoke concentration in the supply air (recirculated share)
    for k in range(nsteps + 1):
        if k % rec_every == 0:
            r = k // rec_every
            for p in range(npb):                      # a detector samples a small patch of air, not a point
                s = 0.0; m = 0
                for jj in range(max(0, pj[p] - pr), min(ny, pj[p] + pr + 1)):
                    for ii in range(max(0, pi[p] - pr), min(nx, pi[p] + pr + 1)):
                        s += c[jj, ii]; m += 1
                series[r, p] = s / m
        if frame_every > 0 and k % frame_every == 0:
            frames[k // frame_every] = c
        if k == nsteps:
            break
        if scheme == 1:                               # van Leer limited slopes
            for j in range(ny):
                for i in range(nx):
                    a = c[j, i] - c[j, i - 1] if i > 0 else 0.0
                    b = c[j, i + 1] - c[j, i] if i < nx - 1 else 0.0
                    sx[j, i] = 2 * a * b / (a + b) if a * b > 0 else 0.0
                    a = c[j, i] - c[j - 1, i] if j > 0 else 0.0
                    b = c[j + 1, i] - c[j, i] if j < ny - 1 else 0.0
                    sy[j, i] = 2 * a * b / (a + b) if a * b > 0 else 0.0
        go = 0.0; qo = 0.0
        for j in range(ny):
            for i in range(1, nx):
                w = u[j, i]
                h = 0.5 * (1.0 - abs(w) * dt / dx)          # second order in time as well as space
                cf = c[j, i - 1] + h * sx[j, i - 1] if w > 0 else c[j, i] - h * sx[j, i]
                fx[j, i] = w * cf - D * (c[j, i] - c[j, i - 1]) / dx
            fx[j, 0] = u[j, 0] * (c[j, 0] if u[j, 0] < 0 else csup)          # smoke leaves at the return; supply air carries csup
            fx[j, nx] = u[j, nx] * (c[j, nx - 1] if u[j, nx] > 0 else csup)
            out += (fx[j, nx] - fx[j, 0]) * dt
            if u[j, 0] < 0: go -= fx[j, 0]; qo -= u[j, 0]
            if u[j, nx] > 0: go += fx[j, nx]; qo += u[j, nx]
        for i in range(nx):
            for j in range(1, ny):
                w = v[j, i]
                h = 0.5 * (1.0 - abs(w) * dt / dx)
                cf = c[j - 1, i] + h * sy[j - 1, i] if w > 0 else c[j, i] - h * sy[j, i]
                fy[j, i] = w * cf - D * (c[j, i] - c[j - 1, i]) / dx
            fy[0, i] = v[0, i] * (c[0, i] if v[0, i] < 0 else csup)
            fy[ny, i] = v[ny, i] * (c[ny - 1, i] if v[ny, i] > 0 else csup)
            out += (fy[ny, i] - fy[0, i]) * dt
            if v[0, i] < 0: go -= fy[0, i]; qo -= v[0, i]
            if v[ny, i] > 0: go += fy[ny, i]; qo += v[ny, i]
        for j in range(ny):
            for i in range(nx):
                c[j, i] -= dt * ((fx[j, i + 1] - fx[j, i]) + (fy[j + 1, i] - fy[j, i])) / dx
        if si >= 0:
            c[sj, si] += add * prof[k]
        csup = keep * go / qo if qo > 0 else 0.0     # the share of return-air smoke that the filter lets back in
    return series, frames, out, c


@njit(parallel=True, cache=True)
def _many(u, v, D, dx, dt, nsteps, si, sj, add, prof, c0, pi, pj, pr, rec_every, frame_every, scheme, keep):
    S = len(si)
    series = np.zeros((S, nsteps // rec_every + 1, len(pi)))
    outs = np.zeros(S); tot = np.zeros(S)
    nfr = nsteps // frame_every + 1 if frame_every > 0 else 0
    frames = np.zeros((nfr, u.shape[0], v.shape[1])); final = np.zeros((u.shape[0], v.shape[1]))
    for s in prange(S):
        se, fr, o, c = _one(u, v, D, dx, dt, nsteps, si[s], sj[s], add, prof, c0, pi, pj, pr, rec_every, frame_every if s == 0 else 0, scheme, keep)
        series[s] = se; outs[s] = o; tot[s] = c.sum()
        if s == 0:
            final[:, :] = c
            if frame_every > 0: frames[:, :, :] = fr
    return series, frames, outs, tot, final


def simulate(cab, srcs, flow, D, rate_mg_s=1.0, t_end=900.0, probes=None, frame_dt=None, scheme="vanleer",
             profile=None, c0=None, patch=1, cfl=0.25, rec_dt=1.0, removal=1.0):
    """One run per fire position in `srcs` [(i, j), ...]. Smoke release is rate_mg_s * profile(t) (profile defaults to 1).
    `removal` is the share of smoke the return filter takes out per pass (1 = none comes back with the supply air).
    Returns dict(times, series[n_src, n_t, n_probe], frames (first source), balance (per source), final field (first source), dt)."""
    if isinstance(srcs, tuple): srcs = [srcs]
    u, v = np.ascontiguousarray(cab.u1 * flow), np.ascontiguousarray(cab.v1 * flow)
    dx = cab.dx
    umax = max(float((np.abs(u[:, 1:]) + np.abs(v[1:, :])).max()), 1e-12)
    dt0 = min(cfl * dx / umax, 0.8 * cfl * dx * dx / max(D, 1e-12), rec_dt)
    m = int(math.ceil(rec_dt / dt0)); dt = rec_dt / m
    nsteps = int(round(t_end / dt))
    prof = np.ones(nsteps + 1) if profile is None else np.array([profile(k * dt) for k in range(nsteps + 1)], dtype=float)
    probes = probes or [(0, 0)]
    si = np.array([s[0] for s in srcs], dtype=np.int64); sj = np.array([s[1] for s in srcs], dtype=np.int64)
    pi = np.array([p[0] for p in probes], dtype=np.int64); pj = np.array([p[1] for p in probes], dtype=np.int64)
    cell_vol = dx * dx * cab.depth
    c0a = np.zeros((cab.ny, cab.nx)) if c0 is None else np.ascontiguousarray(c0, dtype=float)
    fe = int(round(frame_dt / dt)) if frame_dt else 0
    series, frames, outs, tot, final = _many(u, v, float(D), dx, dt, nsteps, si, sj, rate_mg_s * dt / cell_vol, prof, c0a, pi, pj,
                                             int(patch), m, fe, 1 if scheme == "vanleer" else 0, 1.0 - float(removal))
    released = rate_mg_s * prof[:-1].sum() * dt + c0a.sum() * cell_vol
    balance = (tot * cell_vol + outs * dx * cab.depth) / max(released, 1e-300)
    return dict(times=np.arange(series.shape[1]) * rec_dt, series=series, frames=frames, balance=balance, final=final, dt=dt)


def first_cross(times, series, level):
    """First time each probe reaches `level` (linear interpolation); nan if never. series is [n_t, n_probe]."""
    hit = series >= level
    k = hit.argmax(axis=0); any_hit = hit.any(axis=0); cols = np.arange(series.shape[1])
    k0 = np.maximum(k - 1, 0); a, b = series[k0, cols], series[k, cols]
    with np.errstate(divide="ignore", invalid="ignore"):
        frac = np.where(b > a, (level - a) / (b - a), 0.0)
    t = np.where(k == 0, times[0], times[k0] + frac * (times[k] - times[k0]))
    return np.where(any_hit, t, np.nan)
