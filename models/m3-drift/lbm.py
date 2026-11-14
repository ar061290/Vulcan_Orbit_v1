"""2D lattice Boltzmann solver (D2Q9) and a finite-volume passive-scalar solver that runs on its velocity field.

Lattice units throughout this file (dx = dt = 1). Conversion to metres and seconds is done by the callers (cabin.py).

Flow:   D2Q9, BGK collision by default; TRT (two-relaxation-time) available with `lam` = magic parameter
        (Ginzburg 2008). BGK is TRT with both rates equal. Body force by Guo, Zheng & Shi (2002).
        Walls: halfway bounce-back, with the moving-wall correction (Ladd 1994) for lids.
        Vents:  inlet nodes get the equilibrium at the prescribed velocity and the density of the node inside;
                outlet nodes get the equilibrium at density 1 and the velocity of the node inside.
Scalar: cell-centred finite volume on the same nodes. Advection with van Leer limited slopes (second order in space and
        time), diffusion with central differences. No flux through walls. Vent nodes exchange smoke with the outside:
        outflow carries the local value, inflow carries the supply value. Conservative by construction.
Node types: 0 fluid, 1 solid, 2 inlet, 3 outlet.
"""
import numpy as np
from numba import njit, prange

EX = np.array([0, 1, 0, -1, 0, 1, -1, -1, 1], dtype=np.int64)
EY = np.array([0, 0, 1, 0, -1, 1, 1, -1, -1], dtype=np.int64)
W = np.array([4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36])
OPP = np.array([0, 3, 4, 1, 2, 7, 8, 5, 6], dtype=np.int64)
FLUID, SOLID, INLET, OUTLET = 0, 1, 2, 3


@njit(inline="always")
def _feq(i, rho, ux, uy):
    eu = EX[i] * ux + EY[i] * uy
    return W[i] * rho * (1.0 + 3.0 * eu + 4.5 * eu * eu - 1.5 * (ux * ux + uy * uy))


@njit(parallel=True, cache=True)
def _step(f, fn, typ, uw, vw, fx, fy, wp, wm, bi, bj, bni, bnj, bux, buy):
    ny, nx = typ.shape
    post = np.empty_like(f)
    for j in prange(ny):
        for i in range(nx):
            if typ[j, i] == SOLID:
                continue
            rho = 0.0; mx = 0.0; my = 0.0
            for q in range(9):
                v = f[q, j, i]; rho += v; mx += v * EX[q]; my += v * EY[q]
            Fx = fx[j, i]; Fy = fy[j, i]
            ux = (mx + 0.5 * Fx) / rho; uy = (my + 0.5 * Fy) / rho
            for q in range(9):
                p = OPP[q]
                if p < q:
                    continue
                eq_q = _feq(q, rho, ux, uy); eq_p = _feq(p, rho, ux, uy)
                sp = 0.5 * ((f[q, j, i] + f[p, j, i]) - (eq_q + eq_p))
                sm = 0.5 * ((f[q, j, i] - f[p, j, i]) - (eq_q - eq_p))
                # Guo forcing term, split into symmetric and antisymmetric parts
                eu_q = EX[q] * ux + EY[q] * uy; eu_p = EX[p] * ux + EY[p] * uy
                s_q = W[q] * ((3.0 * (EX[q] - ux) + 9.0 * eu_q * EX[q]) * Fx + (3.0 * (EY[q] - uy) + 9.0 * eu_q * EY[q]) * Fy)
                s_p = W[p] * ((3.0 * (EX[p] - ux) + 9.0 * eu_p * EX[p]) * Fx + (3.0 * (EY[p] - uy) + 9.0 * eu_p * EY[p]) * Fy)
                Sp = 0.5 * (s_q + s_p); Sm = 0.5 * (s_q - s_p)
                gp = -wp * sp + (1.0 - 0.5 * wp) * Sp
                gm = -wm * sm + (1.0 - 0.5 * wm) * Sm
                if p == q:
                    post[q, j, i] = f[q, j, i] + gp
                else:
                    post[q, j, i] = f[q, j, i] + gp + gm
                    post[p, j, i] = f[p, j, i] + gp - gm
    for j in prange(ny):
        for i in range(nx):
            if typ[j, i] == SOLID:
                continue
            rho = 0.0
            for q in range(9):
                rho += f[q, j, i]
            for q in range(9):
                sj = (j - EY[q]) % ny; si = (i - EX[q]) % nx
                if typ[sj, si] == SOLID:
                    fn[q, j, i] = post[OPP[q], j, i] + 6.0 * W[q] * rho * (EX[q] * uw[sj, si] + EY[q] * vw[sj, si])
                else:
                    fn[q, j, i] = post[q, sj, si]
    for k in range(len(bi)):
        i = bi[k]; j = bj[k]; ii = bni[k]; jj = bnj[k]
        rho = 0.0; mx = 0.0; my = 0.0
        for q in range(9):
            v = fn[q, jj, ii]; rho += v; mx += v * EX[q]; my += v * EY[q]
        if typ[j, i] == INLET:
            for q in range(9):
                fn[q, j, i] = _feq(q, rho, bux[k], buy[k])
        else:
            for q in range(9):
                fn[q, j, i] = _feq(q, 1.0, mx / rho, my / rho)


@njit(cache=True)
def _macro(f, typ, fx, fy):
    ny, nx = typ.shape
    rho = np.ones((ny, nx)); ux = np.zeros((ny, nx)); uy = np.zeros((ny, nx))
    for j in range(ny):
        for i in range(nx):
            if typ[j, i] == SOLID:
                continue
            r = 0.0; mx = 0.0; my = 0.0
            for q in range(9):
                v = f[q, j, i]; r += v; mx += v * EX[q]; my += v * EY[q]
            rho[j, i] = r; ux[j, i] = (mx + 0.5 * fx[j, i]) / r; uy[j, i] = (my + 0.5 * fy[j, i]) / r
    return rho, ux, uy


class Lattice:
    """D2Q9 flow on a grid of node types. tau is the relaxation time; lam the TRT magic parameter (None = BGK)."""

    def __init__(self, typ, tau, lam=None, uw=None, vw=None, vents=None):
        self.typ = np.ascontiguousarray(typ, dtype=np.int64)
        ny, nx = self.typ.shape
        self.tau = float(tau)
        self.wp = 1.0 / tau
        self.wm = self.wp if lam is None else 1.0 / (lam / (tau - 0.5) + 0.5)
        self.uw = np.zeros((ny, nx)) if uw is None else np.ascontiguousarray(uw, dtype=float)
        self.vw = np.zeros((ny, nx)) if vw is None else np.ascontiguousarray(vw, dtype=float)
        self.fx = np.zeros((ny, nx)); self.fy = np.zeros((ny, nx))
        vents = vents or []          # [(i, j, i_inside, j_inside, ux, uy)]
        a = np.array(vents, dtype=float).reshape(-1, 6)
        self.bi, self.bj, self.bni, self.bnj = (a[:, k].astype(np.int64) for k in range(4))
        self.bux, self.buy = a[:, 4].copy(), a[:, 5].copy()
        self.f = np.empty((9, ny, nx))
        for q in range(9):
            self.f[q] = W[q]
        self.fn = self.f.copy()
        self.steps = 0

    def set_vent_speed(self, scale):
        self.bux *= scale; self.buy *= scale

    def run(self, n):
        for _ in range(n):
            _step(self.f, self.fn, self.typ, self.uw, self.vw, self.fx, self.fy, self.wp, self.wm,
                  self.bi, self.bj, self.bni, self.bnj, self.bux, self.buy)
            self.f, self.fn = self.fn, self.f
        self.steps += n

    def macro(self):
        return _macro(self.f, self.typ, self.fx, self.fy)

    def run_steady(self, tol=1e-3, chunk=500, max_steps=400000, window=0.02):
        """Run until the velocity changes by less than `tol` (relative) over the last `window` share of the steps run."""
        hist = []
        while self.steps < max_steps:
            self.run(chunk)
            _, ux, uy = self.macro()
            hist.append((self.steps, ux.copy(), uy.copy()))
            back = max(chunk, int(window * self.steps))
            old = [h for h in hist if h[0] <= self.steps - back]
            if old:
                _, ox, oy = old[-1]
                ch = np.sqrt(((ux - ox) ** 2 + (uy - oy) ** 2).sum() / max(((ux ** 2 + uy ** 2).sum()), 1e-300))
                hist = [h for h in hist if h[0] >= self.steps - 2 * back]
                if ch < tol and self.steps >= 4 * chunk:
                    return dict(steps=self.steps, change=float(ch), steady=True)
        return dict(steps=self.steps, change=float(ch), steady=False)


# ---------------------------------------------------------------- scalar transport ------------------------------------------

@njit(cache=True)
def _vl(a, b):
    return 2.0 * a * b / (a + b) if a * b > 0 else 0.0


@njit(cache=True)
def scalar_run(ux, uy, open_, D, dt, nsteps, c0, src_i, src_j, src_amt, vi, vj, vnx, vny, csup_keep,
               probe_i, probe_j, patch, rec_every, frame_every):
    """March c (per unit cell volume, lattice-free physical units chosen by the caller: velocities in cells per unit time,
    D in cells^2 per unit time, dt in the same time unit).
    open_[j,i] = 1 for cells that hold air (fluid and vents). src_amt[k] is the amount added at the source cell on step k.
    Vents (vi, vj) with outward normal (vnx, vny): outflow removes u_n*c, inflow brings u_n*csup where
    csup = csup_keep * (outflowing amount / outflowing volume) from the previous step (recirculation through a filter).
    Returns probe series [n_rec, n_probe] (patch means), frames, total left through vents, final field."""
    ny, nx = ux.shape
    c = c0.copy()
    sx = np.zeros((ny, nx)); sy = np.zeros((ny, nx)); dc = np.zeros((ny, nx))
    npb = len(probe_i)
    series = np.zeros((nsteps // rec_every + 1, npb))
    nfr = nsteps // frame_every + 1 if frame_every > 0 else 0
    frames = np.zeros((max(nfr, 1), ny, nx))
    gone = 0.0; csup = 0.0
    for k in range(nsteps + 1):
        if k % rec_every == 0:
            r = k // rec_every
            for p in range(npb):
                s = 0.0; m = 0
                for jj in range(max(0, probe_j[p] - patch), min(ny, probe_j[p] + patch + 1)):
                    for ii in range(max(0, probe_i[p] - patch), min(nx, probe_i[p] + patch + 1)):
                        if open_[jj, ii]:
                            s += c[jj, ii]; m += 1
                series[r, p] = s / m if m > 0 else 0.0
        if frame_every > 0 and k % frame_every == 0:
            frames[k // frame_every] = c
        if k == nsteps:
            break
        for j in range(ny):
            for i in range(nx):
                dc[j, i] = 0.0
                if not open_[j, i]:
                    continue
                a = c[j, i] - c[j, i - 1] if i > 0 and open_[j, i - 1] else 0.0
                b = c[j, i + 1] - c[j, i] if i < nx - 1 and open_[j, i + 1] else 0.0
                sx[j, i] = _vl(a, b)
                a = c[j, i] - c[j - 1, i] if j > 0 and open_[j - 1, i] else 0.0
                b = c[j + 1, i] - c[j, i] if j < ny - 1 and open_[j + 1, i] else 0.0
                sy[j, i] = _vl(a, b)
        for j in range(ny):
            for i in range(nx - 1):
                if open_[j, i] and open_[j, i + 1]:
                    w = 0.5 * (ux[j, i] + ux[j, i + 1])
                    h = 0.5 * (1.0 - abs(w) * dt)
                    cf = c[j, i] + h * sx[j, i] if w > 0 else c[j, i + 1] - h * sx[j, i + 1]
                    fl = w * cf - D * (c[j, i + 1] - c[j, i])
                    dc[j, i] -= fl; dc[j, i + 1] += fl
        for j in range(ny - 1):
            for i in range(nx):
                if open_[j, i] and open_[j + 1, i]:
                    w = 0.5 * (uy[j, i] + uy[j + 1, i])
                    h = 0.5 * (1.0 - abs(w) * dt)
                    cf = c[j, i] + h * sy[j, i] if w > 0 else c[j + 1, i] - h * sy[j + 1, i]
                    fl = w * cf - D * (c[j + 1, i] - c[j, i])
                    dc[j, i] -= fl; dc[j + 1, i] += fl
        go = 0.0; qo = 0.0
        for v in range(len(vi)):
            i = vi[v]; j = vj[v]
            un = ux[j, i] * vnx[v] + uy[j, i] * vny[v]
            if un > 0:
                fl = un * c[j, i]; go += fl; qo += un
            else:
                fl = un * csup
            dc[j, i] -= fl
            gone += fl * dt
        for j in range(ny):
            for i in range(nx):
                c[j, i] += dt * dc[j, i]
        if src_i >= 0:
            c[src_j, src_i] += src_amt[k]
        csup = csup_keep * go / qo if qo > 0 else 0.0
    return series, frames, gone, c


@njit(parallel=True, cache=True)
def scalar_many(ux, uy, open_, D, dt, nsteps, c0, si, sj, src_amt, vi, vj, vnx, vny, csup_keep, pi, pj, patch, rec_every):
    """Independent scalar runs, one per source cell, in parallel. Returns series [n_src, n_rec, n_probe], gone, totals."""
    S = len(si)
    out = np.zeros((S, nsteps // rec_every + 1, len(pi)))
    gone = np.zeros(S); tot = np.zeros(S)
    for s in prange(S):
        se, _, g, c = scalar_run(ux, uy, open_, D, dt, nsteps, c0, si[s], sj[s], src_amt, vi, vj, vnx, vny, csup_keep,
                                 pi, pj, patch, rec_every, 0)
        out[s] = se; gone[s] = g; tot[s] = c.sum()
    return out, gone, tot


def stable_dt(ux, uy, D, cfl=0.4, fo=0.2):
    """Largest stable explicit step for the scalar (cell units)."""
    umax = max(float(np.abs(ux).max() + np.abs(uy).max()), 1e-12)
    return min(cfl / umax, fo / max(D, 1e-12))
