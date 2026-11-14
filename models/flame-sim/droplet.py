"""Droplet burning: d-squared law with a radiative-loss extinction criterion.

Quasi-steady spherical droplet flame (d-squared law; e.g. Turns, An Introduction to Combustion, ch. 10):
    B   = (Y_O2,inf * LHV / s + cp_g (T_inf - T_b)) / h_fg          Spalding transfer number, droplet at its boiling point
    K   = 8 k_g / (rho_l cp_g) * ln(1 + B)                           burning-rate constant, d^2 = d0^2 - K t
    t_b = d0^2 / K                                                    burn-out time
    r_f / r_s = ln(1 + B) / ln(1 + Y_O2,inf / s)                      flame standoff ratio
Gas properties at T_bar = (T_b + T_f)/2 with the Law & Williams rule: cp_g = cp of fuel vapour, k_g = 0.4 k_fuel + 0.6 k_amb.

Radiative-loss extinction (optically thin flame; RADCAL Planck-mean fits from the TNF workshop):
    heat release        Q_c = m_dot * LHV,  m_dot = (pi/4) rho_l K d
    radiative loss      Q_r = 4 sigma kappa_P (T_f^4 - T_inf^4) * G * (4/3) pi r_f^3,  kappa_P = p (X_CO2 a_CO2 + X_H2O a_H2O)
    loss fraction       chi = Q_r / Q_c, which grows as d^2 (r_f is proportional to d)
    extinction when the flame temperature lowered by the loss, T_f - chi (T_f - T_inf), falls below T_lim.
G (hot-gas volume relative to the flame sphere) and T_lim are the two lumped constants, tuned on half of the FLEX tests
(RULES.md). Critical diameter d_c solves chi(d_c) = (T_f - T_lim)/(T_f - T_inf): droplets larger than d_c extinguish early.
The quasi-steady form ignores the unsteady growth of the flame; this is the main limit of the criterion.
"""
import math
import numpy as np
import chem

SIG = chem.PROPS["radiation"]["sigma_W_m2K4"]
T_INF = 298.15


def planck(T, X_CO2, X_H2O, P):
    r = chem.PROPS["radiation"]; x = 1000.0 / T
    a = lambda c: sum(ci * x ** k for k, ci in enumerate(c))
    return P / 101325.0 * (X_CO2 * a(r["CO2"]) + X_H2O * a(r["H2O"]))      # 1/m


def burn(fuel, X_O2, P, dil=None):
    """Everything about a burning droplet of `fuel` in oxidiser (X_O2, diluents) at pressure P (Pa)."""
    eq = chem.equilibrium(fuel, X_O2, P, dil)
    if not chem.is_liquid(fuel):
        return dict(eq=eq, K_mm2_s=None, B=None, standoff=None, reason="gas at cabin conditions: no droplet")
    L = chem.PROPS["liquids"][fuel]
    Tb, hfg, rhol = L["T_boil_K"], L["h_fg_kJ_kg"] * 1e3, L["rho_l_kg_m3"]
    Tf = eq["T_ad"]; Tbar = 0.5 * (Tb + Tf)
    ox = chem.oxidiser(X_O2, dil)
    pf = chem.gas_props({chem.fuel_species(fuel): 1.0}, Tbar, P)
    pa = chem.gas_props(ox, Tbar, P)
    cp, k = pf["cp"], 0.4 * pf["k"] + 0.6 * pa["k"]
    Q = chem.lhv(fuel)
    B = (eq["Y_O2"] * Q / eq["s"] + cp * (T_INF - Tb)) / hfg
    K = 8 * k / (rhol * cp) * math.log(1 + B)                           # m2/s
    ratio = math.log(1 + B) / math.log(1 + eq["Y_O2"] / eq["s"])
    kap = planck(Tf, eq["X_products"]["CO2"], eq["X_products"]["H2O"], P)
    # chi(d) = c2 * G * d^2 :  Q_r / Q_c with r_f = ratio * d / 2
    c2 = 4 * SIG * kap * (Tf ** 4 - T_INF ** 4) * (4 / 3) * math.pi * (ratio / 2) ** 3 / ((math.pi / 4) * rhol * K * Q)
    return dict(eq=eq, T_f=Tf, B=B, K_mm2_s=K * 1e6, standoff=ratio, kappa_P=kap, chi_per_d2=c2, k_g=k, cp_g=cp,
                rho_l=rhol, LHV=Q, rhoD=k / cp, T_b=Tb)


def critical_diameter(b, G, T_lim):
    """Initial diameter (m) above which the radiative loss puts the flame out; inf if never, 0 if always."""
    if b.get("K_mm2_s") is None:
        return None
    lim = (b["T_f"] - T_lim) / (b["T_f"] - T_INF)
    if lim <= 0:
        return 0.0
    return math.sqrt(lim / (b["chi_per_d2"] * G))


def burnout_s(b, d0):
    return d0 ** 2 / (b["K_mm2_s"] * 1e-6)
