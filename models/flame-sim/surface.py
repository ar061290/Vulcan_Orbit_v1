"""Stage 2: flame on a flat solid fuel plate, Emmons boundary-layer solution.

Emmons (1956) forced-flow flat-plate burning, constant rho*mu, unit Prandtl and Lewis numbers. With Blasius variables
eta = y_H sqrt(U / (nu x)) (y_H: Howarth density-weighted distance) and stream function psi = sqrt(nu U x) f(eta):
    2 f''' + f f'' = 0,   f'(0) = 0,   f'(inf) = 1,   f(0) = -2 B f''(0)        (blowing set by the transfer number B)
    local mass burning flux  m''(x) = rho_inf U B f''(0) / sqrt(Re_x),  Re_x = U x / nu_inf
    (for B -> 0 this gives the Blasius/Reynolds-analogy result 0.332 B rho U Re_x^-1/2, a check run in build.py)
Mixture fraction Z = Z_w (1 - f'(eta)) with Z_w = B / (1 + B); the flame sheet sits where Z = Z_st, i.e.
    f'(eta_f) = 1 - Z_st (1 + B) / B.
Physical standoff from the Howarth transform with the flame-sheet temperature profile:
    y_f = sqrt(nu_inf x / U) * integral_0^eta_f (T / T_inf) d eta.
Buoyancy (vertical plate, flow up the plate): local effective velocity U_eff(x) = U_forced + sqrt(g x (T_f - T_inf) / T_inf)
(scaling only, prefactor 1). Pure buoyant flow then gives m'' ~ x^-1/4 and pure forced flow m'' ~ x^-1/2.
"""
import math
from functools import lru_cache
import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

T_INF = 298.15
ETA_MAX = 14.0


def _shoot(alpha, B):
    sol = solve_ivp(lambda e, y: [y[1], y[2], -0.5 * y[0] * y[2]], (0, ETA_MAX), [-2 * B * alpha, 0.0, alpha],
                    rtol=1e-10, atol=1e-12, dense_output=True)
    return sol


@lru_cache(None)
def emmons(B):
    """f''(0), -f(0) and the solution for transfer number B."""
    g = lambda a: _shoot(a, B).y[1, -1] - 1.0
    a = brentq(g, 1e-6, 2.0, xtol=1e-13)
    s = _shoot(a, B)
    return a, 2 * B * a, s


def flame_eta(B, Z_st):
    fp = 1 - Z_st * (1 + B) / B
    if fp <= 0:
        return None
    a, mf0, s = emmons(B)
    eta = np.linspace(0, ETA_MAX, 4001); f1 = s.sol(eta)[1]
    return float(np.interp(fp, f1, eta)), eta, f1


def plate(B, Z_st, T_f, T_v, rho, nu, U_forced, g, xs):
    """Burning flux (g/m2/s) and standoff (mm) at positions xs (m)."""
    a, mf0, s = emmons(B)
    fe = flame_eta(B, Z_st)
    if fe is None:
        return None
    eta_f, eta, f1 = fe
    Zw = B / (1 + B); Z = Zw * (1 - f1)
    T = np.where(Z <= Z_st, T_INF + (T_f - T_INF) * Z / Z_st, T_v + (T_f - T_v) * (Zw - Z) / (Zw - Z_st))
    m = eta <= eta_f
    stretch = float(np.trapezoid(T[m] / T_INF, eta[m]))
    out_m, out_y, out_u = [], [], []
    for x in xs:
        U = U_forced + (math.sqrt(g * x * (T_f - T_INF) / T_INF) if g > 0 else 0.0)
        if U <= 0:
            out_m.append(None); out_y.append(None); out_u.append(0.0); continue
        Re = U * x / nu
        out_m.append(rho * U * B * a / math.sqrt(Re) * 1e3)
        out_y.append(math.sqrt(nu * x / U) * stretch * 1e3)
        out_u.append(U)
    return dict(m_g_m2_s=out_m, standoff_mm=out_y, U_eff_m_s=out_u, f2_0=a, minus_f0=mf0, eta_f=eta_f)
