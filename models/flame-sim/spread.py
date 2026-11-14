"""Stage 3: opposed-flow flame spread over solids, extinction limits, and front marching.

Thermal-regime spread (de Ris 1969, as written by Carmignani 2019, Eqs. 3.1 and 3.2, F = (T_f - T_v)/(T_v - T_inf)):
    thin:  V_f = (pi/4) k_g / (rho_s c_s tau) * F          tau = half thickness (two-sided burning) or thickness (one-sided)
    thick: V_f = V_g (k rho c)_g / (k rho c)_s * F^2
    A sample takes the larger of the two: the thin formula falls as the fuel gets thicker until the thick (flow-driven) value
    takes over, so the larger value marks the regime that applies.
Flame temperature: anchored at air by F_air = 4.76 (Carmignani's thin-fuel value), and scaled to other O2 levels with the
flame-sheet result (T_f - T_inf) proportional to the stoichiometric mixture fraction Z_st.
Extinction (our reduced form, constants set on one reported point each, then tested on others):
    blow-off  : Da = C_Da * X_O2 * exp(-E / (R T_f)) * (alpha_g / V_r^2) < 1, E = 1.45e5 J/mol (BASS-II summary report,
                NASA/TM-20210011385, Sec. 6.1), V_r = V_g + V_f; C_Da set so that 100 um PMMA in air blows off at 40 cm/s
                (BASS-II, NTRS 20160000593 slide 13).
    quenching : surface radiative loss vs gas heating, R = sigma (T_v^4 - T_inf^4) / (rho_g c_g V_r (T_f - T_v)) > R_c,
                R_c set so that thin PMMA in air quenches at 1.0 cm/s (BASS-II summary report Table 2.1: 10 +/- 5 mm/s).
    Spread rate with both effects: V = V_deRis * sqrt(max(0, 1 - R/R_c)) * sqrt(max(0, 1 - 1/Da)); zero outside.
    The square-root form is ours: it makes the rate fall to zero at both limits. It is not taken from a paper.
Gravity (1 g downward spread): the opposed flow gains a buoyant velocity (g alpha_g (T_f - T_inf)/T_inf)^(1/3), a scaling only.
"""
import math
import numpy as np
import chem

P = chem.PROPS["solids"]; GAS = P["gas_for_spread"]; PM = P["PMMA"]
T_INF = 298.15
E_ACT = 1.45e5; R_GAS = 8.314; SIG = 5.669e-8
F_AIR = GAS["de_Ris_F_thin_fit"]
T_V = PM["T_v_K"]
RHO0, CP0, K0 = GAS["rho_g_kg_m3"], GAS["cp_g_kJ_kgK"] * 1e3, GAS["k_g_W_mK"]
ALPHA0 = K0 / (RHO0 * CP0)                       # m2/s at 1 atm


def z_st_pmma(X_O2):
    s = 6 * 31.998 / 100.117                     # kg O2 / kg PMMA, from C5H8O2 + 6 O2 -> 5 CO2 + 4 H2O
    Y = X_O2 * 31.998 / (X_O2 * 31.998 + (1 - X_O2) * 28.014)
    return 1 / (1 + s / Y)


def t_flame(X_O2, T_v=T_V):
    Tf_air = T_v + F_AIR * (T_v - T_INF)
    return T_INF + (Tf_air - T_INF) * z_st_pmma(X_O2) / z_st_pmma(0.21)


def gas(Pa):
    return RHO0 * Pa / 101325.0, ALPHA0 * 101325.0 / Pa


def de_ris(thick_m, sides, X_O2, Pa, Vg):
    Tf = t_flame(X_O2); F = (Tf - T_V) / (T_V - T_INF)
    tau = thick_m / 2 if sides == 2 else thick_m
    thin = math.pi / 4 * K0 / (PM["rho_s_kg_m3"] * PM["cp_s_kJ_kgK"] * 1e3 * tau) * F
    rho, _ = gas(Pa)
    thick = Vg * (K0 * rho * CP0) / (PM["k_s_W_mK"] * PM["rho_s_kg_m3"] * PM["cp_s_kJ_kgK"] * 1e3) * F ** 2
    return max(thin, thick), thin, thick, Tf


def buoyant(g, X_O2):
    if g <= 0: return 0.0
    return (g * ALPHA0 * (t_flame(X_O2) - T_INF) / T_INF) ** (1 / 3)


class Model:
    def __init__(self):
        self.C_Da = 1.0; self.R_c = 1.0
        # calibrate C_Da: 100 um two-sided PMMA, air, 1 atm, blows off at 0.40 m/s
        v, *_ = de_ris(100e-6, 2, 0.21, 101325, 0.40)
        self.C_Da = 1.0 / self._da_raw(0.21, 101325, 0.40 + v)
        v, *_ = de_ris(100e-6, 2, 0.21, 101325, 0.010)
        self.R_c = self._r(0.21, 101325, 0.010 + v)

    def _da_raw(self, X_O2, Pa, Vr):
        _, a = gas(Pa)
        return X_O2 * math.exp(-E_ACT / (R_GAS * t_flame(X_O2))) * a / Vr ** 2

    def _r(self, X_O2, Pa, Vr):
        rho, _ = gas(Pa); Tf = t_flame(X_O2)
        return SIG * (T_V ** 4 - T_INF ** 4) / (rho * CP0 * Vr * (Tf - T_V))

    def rate(self, thick_m, sides, X_O2, Pa, Vg, g=0.0):
        Vg_eff = Vg + buoyant(g, X_O2)
        v0, thin, thick, Tf = de_ris(thick_m, sides, X_O2, Pa, Vg_eff)
        Vr = Vg_eff + v0
        Da = self.C_Da * self._da_raw(X_O2, Pa, Vr); R = self._r(X_O2, Pa, Vr) / self.R_c
        v = v0 * math.sqrt(max(0.0, 1 - R)) * math.sqrt(max(0.0, 1 - 1 / Da))
        return dict(V=v, V_deRis=v0, thin=thin, thick=thick, Da=Da, R_over_Rc=R, T_f=Tf, Vg_eff=Vg_eff,
                    regime="quenched" if R >= 1 else ("blown off" if Da <= 1 else "burning"))

    def limits(self, thick_m, sides, X_O2, Pa, g=0.0, vmin=1e-4, vmax=5.0, n=400):
        """Lowest and highest opposed-flow speeds (m/s) with sustained spread; None if no spread at any speed."""
        vs = np.logspace(math.log10(vmin), math.log10(vmax), n)
        ok = [self.rate(thick_m, sides, X_O2, Pa, v, g)["V"] > 0 for v in vs]
        if not any(ok): return None
        k = [i for i, o in enumerate(ok) if o]
        return float(vs[k[0]]), float(vs[k[-1]])


def march(rate_m_s, m_flux_g_m2_s, area_density_kg_m2, length_m=0.20, width_m=0.02, dt=0.5, t_max=None):
    """Front position and burning area over time for a sample of given length. The burning zone behind the front lasts
    t_burn = area density / burning flux; the trailing edge follows the front after t_burn."""
    t_burn = area_density_kg_m2 * 1e3 / m_flux_g_m2_s
    t_end = length_m / rate_m_s + t_burn if t_max is None else t_max
    t = np.arange(0, t_end + dt, dt)
    front = np.minimum(rate_m_s * t, length_m)
    tail = np.clip(rate_m_s * (t - t_burn), 0, length_m)
    area = (front - tail) * width_m
    return dict(t_s=t.round(3).tolist(), front_cm=(front * 100).round(4).tolist(), burning_area_cm2=(area * 1e4).round(4).tolist(),
                t_burn_s=t_burn, burnout_s=length_m / rate_m_s + t_burn)
