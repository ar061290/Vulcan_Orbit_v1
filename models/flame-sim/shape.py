"""Flame shape from a point fuel source in a uniform effective flow.

Mixture fraction around a point source of fuel mass flow m_dot in a uniform flow U (steady advection-diffusion):
    Z(r, phi) = m_dot / (4 pi rhoD r) * exp(-U r (1 - cos phi) / (2 D))
phi is the angle between the position vector and U; D = rhoD / rho. The flame sheet is Z = Z_st (Burke-Schumann). On each ray,
r exp(a r) = L with L = m_dot / (4 pi rhoD Z_st), a = U (1 - cos phi) / (2 D), so r = W(a L) / a (Lambert W).
Effective flow: U = forced flow along +x plus a buoyancy-induced velocity along +z,
    U_b = sqrt(g L (T_f - T_inf) / T_inf), zero at 0 g (prefactor 1: scaling only).
Temperature: Burke-Schumann flame-sheet profile in Z: T rises linearly from T_inf (Z = 0) to T_f (Z = Z_st), then falls
linearly to the source temperature at Z = 1.
"""
import math
import numpy as np
from scipy.special import lambertw

T_INF = 298.15


def flame(m_dot, rhoD, rho_mean, Z_st, T_f, T_src, g, U_forced, n_ang=72, n_grid=31):
    L = m_dot / (4 * math.pi * rhoD * Z_st)                     # flame radius with no flow (m)
    D = rhoD / rho_mean
    Ub = math.sqrt(g * L * (T_f - T_INF) / T_INF) if g > 0 else 0.0
    Uv = np.array([U_forced, Ub]); U = float(np.hypot(*Uv))
    eU = Uv / U if U > 0 else np.array([0.0, 1.0]); eP = np.array([-eU[1], eU[0]])
    phi = np.linspace(0, 2 * np.pi, n_ang, endpoint=False)
    a = U * (1 - np.cos(phi)) / (2 * D)
    with np.errstate(divide="ignore", invalid="ignore"):
        r = np.where(a > 1e-12, np.real(lambertw(a * L)) / np.where(a > 1e-12, a, 1), L)
    pts = r[:, None] * (np.cos(phi)[:, None] * eU + np.sin(phi)[:, None] * eP)
    length = float(r[0] + r[n_ang // 2])                         # along the flow axis, downstream + upstream
    width = float(2 * np.max(np.abs(pts @ eP)))
    # temperature grid around the source
    lo = pts.min(axis=0); hi = pts.max(axis=0); pad = 0.3 * (hi - lo).max()
    xs = np.linspace(lo[0] - pad, hi[0] + pad, n_grid); zs = np.linspace(lo[1] - pad, hi[1] + pad, n_grid)
    X, Zg = np.meshgrid(xs, zs)
    R = np.maximum(np.hypot(X, Zg), 1e-9)
    cosp = (X * eU[0] + Zg * eU[1]) / R
    Zf = np.minimum(L * Z_st / R * np.exp(-U * R * (1 - cosp) / (2 * D)), 1.0)
    T = np.where(Zf <= Z_st, T_INF + (T_f - T_INF) * Zf / Z_st, T_src + (T_f - T_src) * (1 - Zf) / (1 - Z_st))
    tilt = math.degrees(math.atan2(eU[0], eU[1]))                # angle of the flame axis from vertical
    return dict(L_m=L, U_buoy_m_s=Ub, U_eff_m_s=U, D_m2_s=D, contour_m=pts.round(6).tolist(), length_m=length, width_m=width,
                aspect=length / width if width > 0 else None, tilt_deg_from_vertical=round(tilt, 1),
                sphericity=float((r.max() - r.min()) / r.mean()),
                grid=dict(x_m=xs.round(6).tolist(), z_m=zs.round(6).tolist(), T_K=np.round(T).astype(int).tolist()))
