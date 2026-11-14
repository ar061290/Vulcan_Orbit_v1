"""Solver validation V-a, V-b100, V-b400, V-c (see RULES.md). Lattice units."""
import json
from pathlib import Path
import numpy as np
from lbm import Lattice, scalar_run

HERE = Path(__file__).resolve().parent


def poiseuille(H=32, tau=0.8, lam=None):
    """Channel of H nodes between halfway bounce-back walls, periodic along x, driven by a uniform body force."""
    nx, ny = 4, H + 2
    typ = np.zeros((ny, nx), int); typ[0] = 1; typ[-1] = 1
    L = Lattice(typ, tau, lam=lam); g = 1e-6; L.fx[1:-1] = g
    L.run_steady(tol=1e-8, chunk=2000, max_steps=200000)
    _, ux, _ = L.macro()
    u = ux[1:-1, 1]; y = np.arange(H) + 0.5; nu = (tau - 0.5) / 3
    exact = g / (2 * nu) * y * (H - y)
    return float(np.linalg.norm(u - exact) / np.linalg.norm(exact)), dict(y=(y / H).tolist(), u=(u / exact.max()).tolist())


def cavity(Re, N=128, ulid=0.1):
    """Lid-driven square cavity, N x N fluid nodes (halfway walls). Returns centreline profiles vs Ghia et al. (1982)."""
    tau = 0.5 + 3 * ulid * N / Re
    typ = np.ones((N + 2, N + 2), int); typ[1:-1, 1:-1] = 0
    uw = np.zeros_like(typ, float); uw[-1, :] = ulid
    L = Lattice(typ, tau, uw=uw)
    st = L.run_steady(tol=1e-6, chunk=2000, max_steps=600000)
    _, ux, uy = L.macro()
    ux, uy = ux[1:-1, 1:-1] / ulid, uy[1:-1, 1:-1] / ulid
    s = (np.arange(N) + 0.5) / N                            # node positions in cavity units
    # centreline: N even, so the centreline sits between two node columns / rows
    u_c = 0.5 * (ux[:, N // 2 - 1] + ux[:, N // 2]); v_c = 0.5 * (uy[N // 2 - 1, :] + uy[N // 2, :])
    sp = np.concatenate(([0.0], s, [1.0]))
    u_c = np.concatenate(([0.0], u_c, [1.0])); v_c = np.concatenate(([0.0], v_c, [0.0]))
    g = json.loads((HERE / "ghia1982.json").read_text())[f"Re{Re}"]
    um = np.interp(g["y"], sp, u_c); vm = np.interp(g["x"], sp, v_c)
    d = np.concatenate((um - np.array(g["u"]), vm - np.array(g["v"])))
    return dict(Re=Re, tau=tau, steps=st["steps"], steady=st["steady"], rms=float(np.sqrt((d ** 2).mean())), worst=float(np.abs(d).max()),
                y=g["y"], u_model=um.round(4).tolist(), u_ghia=g["u"], x=g["x"], v_model=vm.round(4).tolist(), v_ghia=g["v"])


def diffusion(N=121, D=0.1, s0=4.0, s1=8.0):
    """Gaussian spot in still air, closed box; compare with the exact spreading Gaussian."""
    open_ = np.ones((N, N), np.int64)
    x = np.arange(N) - (N - 1) / 2
    X, Y = np.meshgrid(x, x)
    g = lambda s: np.exp(-(X ** 2 + Y ** 2) / (2 * s * s)) / (2 * np.pi * s * s)
    T = (s1 ** 2 - s0 ** 2) / (2 * D)
    dt = 0.2 / D; n = int(np.ceil(T / dt)); dt = T / n
    z = np.zeros((N, N)); e = np.zeros(0, np.int64); ef = np.zeros(0)
    _, _, _, c = scalar_run(z, z, open_, D, dt, n, g(s0), -1, -1, np.zeros(n + 1), e, e, ef, ef, 0.0,
                            np.zeros(1, np.int64), np.zeros(1, np.int64), 0, n, 0)
    ex = g(s1)
    return float(np.linalg.norm(c - ex) / np.linalg.norm(ex)), float(abs(c.sum() - g(s0).sum()) / g(s0).sum())


def run_all(log):
    out = {}
    e_bgk, prof = poiseuille(); e_trt, _ = poiseuille(lam=3 / 16)
    out["V-a"] = dict(metric="relative L2 error, velocity profile", value=e_bgk, trt=e_trt, limit="< 2 %", ok=e_bgk < 0.02, profile=prof)
    log("V-a", out["V-a"]["ok"], f"Poiseuille L2 error BGK {e_bgk:.2e} (TRT {e_trt:.1e})")
    for Re in (100, 400):
        r = cavity(Re)
        r.update(limit="RMS < 0.02 and largest < 0.05 (lid-speed units)", ok=r["rms"] < 0.02 and r["worst"] < 0.05)
        out[f"V-b{Re}"] = r
        log(f"V-b{Re}", r["ok"], f"cavity Re {Re}: RMS {r['rms']:.4f}, largest {r['worst']:.4f}, tau {r['tau']:.3f}, {r['steps']} steps")
    e, m = diffusion()
    out["V-c"] = dict(metric="relative L2 error; relative change of total", value=e, mass=m, limit="< 2 %; < 1e-6", ok=e < 0.02 and m < 1e-6)
    log("V-c", out["V-c"]["ok"], f"Gaussian diffusion L2 error {e:.2e}, total change {m:.1e}")
    return out
