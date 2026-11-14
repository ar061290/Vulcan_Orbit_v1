"""M6b spread-rate predictor: calibrated physics + observed no-spread verdicts. Pure functions over a `params` dict.

`params` is built by build.py (calibration on NASA data) and written verbatim into data/spread_predictor.json under "constants",
so the site can port these functions without re-fitting anything. Rules: models/m6b-predictor/RULES.md (committed before fitting).

Units everywhere: spread rate mm/s, flow cm/s, O2 vol%, pressure atm, thickness mm, area density mg/cm^2.
"""
import math

import numpy as np

P_ATM_KPA = 101.325
VERDICTS = ["spreads", "near observed extinction", "observed no-spread"]   # codes 0, 1, 2
SPREADS, NEAR, NO_SPREAD = 0, 1, 2
FABRICS = {"SIBAL": "sibal_area_density", "cotton": "cotton_area_density"}


# ---------------------------------------------------------------- de Ris (copied from models/m6-spread/build.py, same formulas)
def o2_mass_fraction(x):
    return 32.0 * x / (32.0 * x + 28.0 * (1.0 - x))


def flame_coefficient(o2_vol_pct, dr):
    """M6: F = (Tf - Tv)/(Tv - Tinf); Tf fixed by F_adb at 21% O2, Tf - Tinf scaled with the O2 mass fraction (flame sheet)."""
    tf21 = dr["T_v"] + dr["F_adb_21"] * (dr["T_v"] - dr["T_inf"])
    tf = dr["T_inf"] + (tf21 - dr["T_inf"]) * o2_mass_fraction(np.asarray(o2_vol_pct, float) / 100.0) / o2_mass_fraction(0.21)
    return (tf - dr["T_v"]) / (dr["T_v"] - dr["T_inf"])


def de_ris(thickness_mm, sides, flow_cm_s, o2_vol_pct, pressure_atm, dr):
    """Raw de Ris opposed-flow spread rate (mm/s), regime ('thin'/'thick') and burning half-thickness (mm).

    M6's formulas: thin = c_thin F / tau; thick = c_thick Vg F^2 (x P/1 atm, since the grouped coefficient holds rho_g, which scales with P).
    tau = half the slab if two-sided, the whole slab if one-sided. Thin when thin > thick (M6: tau < tau_cr)."""
    th, sd, u, o2, p = np.broadcast_arrays(*(np.asarray(v, float) for v in (thickness_mm, sides, flow_cm_s, o2_vol_pct, pressure_atm)))
    F = flame_coefficient(o2, dr)
    tau_mm = np.where(sd == 2, th / 2.0, th)
    thin = dr["c_thin"] * F / (tau_mm / 1000.0)
    thick = dr["c_thick"] * (u / 100.0) * F ** 2 * p
    regime = np.where(thin > thick, "thin", "thick")
    return np.maximum(thin, thick) * 1000.0, regime, tau_mm


# ---------------------------------------------------------------- concurrent law (Olson et al., reported)
def concurrent_law(flow_cm_s, o2_vol_pct, pressure_atm, area_density, K=1.0, ref_area_density=18.05):
    """V_f = K U X_O2 (P/1 atm)^0.5 (ref area density / area density), returned in mm/s (U in cm/s gives cm/s; x10)."""
    u, o2, p, ad = (np.asarray(v, float) for v in (flow_cm_s, o2_vol_pct, pressure_atm, area_density))
    return K * u * (o2 / 100.0) * np.sqrt(p) * (ref_area_density / ad) * 10.0


# ---------------------------------------------------------------- domain boxes
def in_box(box, **vals):
    """True where every named value lies inside box[name] = [lo, hi] (inclusive)."""
    ok = True
    for k, v in vals.items():
        lo, hi = box[k]
        v = np.asarray(v, float)
        ok = ok & (v >= lo - 1e-9) & (v <= hi + 1e-9)
    return ok


# ---------------------------------------------------------------- the predictor
def geometry_class(material, thickness_mm):
    if material in FABRICS:
        return "fabric"
    if material == "PMMA":
        return "film" if float(thickness_mm) < 0.5 else "slab"
    raise ValueError(f"material {material!r} is not modelled (PMMA, SIBAL, cotton)")


def spread_rates(material, thickness_mm, sides, flow_cm_s, o2_vol_pct, pressure_atm, params, area_density=None):
    """Opposed and concurrent spread rates (mm/s) with lo/hi, regime, calibration label and in-domain flag.

    Works on scalars or broadcastable arrays. A rate is None where M6b has no data and no model (RULES.md section 5)."""
    out = {}
    if material == "PMMA":
        dr = params["de_ris"]
        op = params["opposed"]
        raw, regime, tau = de_ris(thickness_mm, sides, flow_cm_s, o2_vol_pct, pressure_atm, dr)
        f = np.where(regime == "thin", op["f_thin"], op["f_thick"])
        mid = raw * f
        lo, hi = mid * math.exp(op["log_range"][0]), mid * math.exp(op["log_range"][1])
        dom_thin = in_box(op["domain"]["thin"], tau_mm=tau, flow_cm_s=flow_cm_s, o2_vol_pct=o2_vol_pct, pressure_atm=pressure_atm)
        dom_thick = in_box(op["domain"]["thick"], tau_mm=tau, flow_cm_s=flow_cm_s, o2_vol_pct=o2_vol_pct, pressure_atm=pressure_atm)
        out["opposed"] = {"mid": mid, "lo": lo, "hi": hi, "raw_de_ris": raw, "regime": regime,
                          "calibration": "calibrated", "in_domain": np.where(regime == "thin", dom_thin, dom_thick)}
        cb = params["pmma_concurrent_bound"]
        thick = regime == "thick"
        dom_c = in_box(cb["domain"], flow_cm_s=flow_cm_s, o2_vol_pct=o2_vol_pct, pressure_atm=pressure_atm) & thick
        nan = np.full(np.shape(mid), np.nan)
        out["concurrent"] = {"mid": np.where(thick, cb["mid"], nan), "lo": np.where(thick, cb["lo"], nan),
                             "hi": np.where(thick, cb["hi"], nan), "regime": regime,
                             "calibration": np.where(thick, "observed bound", "none"), "in_domain": dom_c}
    elif material in FABRICS:
        cc = params["concurrent"]
        ad = params["area_density"][material] if area_density is None else area_density
        mid = concurrent_law(flow_cm_s, o2_vol_pct, pressure_atm, ad, cc["K"], cc["ref_area_density"])
        lo, hi = mid * math.exp(cc["log_range"][0]), mid * math.exp(cc["log_range"][1])
        dom = in_box(cc["domain"], flow_cm_s=flow_cm_s, o2_vol_pct=o2_vol_pct, pressure_atm=pressure_atm,
                     area_density=np.broadcast_to(ad, np.shape(mid)))
        out["concurrent"] = {"mid": mid, "lo": lo, "hi": hi, "regime": "thin fabric", "calibration": "calibrated", "in_domain": dom}
        nan = np.full(np.shape(mid), np.nan)
        out["opposed"] = {"mid": nan, "lo": nan, "hi": nan, "regime": "thin fabric", "calibration": "none",
                          "in_domain": np.zeros(np.shape(mid), bool)}
    else:
        raise ValueError(f"material {material!r} is not modelled")
    return out


def verdict(material, thickness_mm, flow_direction, flow_cm_s, o2_vol_pct, params):
    """RULES.md section 4. Returns (code array, list of matched case ids per code level, split by status).

    code 2 = inside an observed no-spread box, 1 = inside a near box, 0 = no observed no-spread case near ('spreads')."""
    geom = geometry_class(material, thickness_mm)
    mat = "SIBAL" if material in FABRICS else material   # all no-spread fabric cases are SIBAL; cotton uses them (stated in README)
    v = params["verdict"]
    u = np.asarray(flow_cm_s, float)
    o = np.asarray(o2_vol_pct, float)
    code = np.zeros(np.broadcast(u, o).shape, int)
    matched = []
    for c in v["cases"]:
        if c["material"] != mat or c["geometry"] != geom or c["flow_direction"] != flow_direction:
            continue
        ulo, uhi, olo, ohi = c["flow_lo_cm_s"], c["flow_hi_cm_s"], c["o2_lo_vol_pct"], c["o2_hi_vol_pct"]
        obs = (o >= olo - v["o2_obs"]) & (o <= ohi + v["o2_obs"]) & \
              (u >= max(0.0, ulo - max(v["flow_obs_abs"], v["flow_obs_rel"] * ulo))) & \
              (u <= uhi + max(v["flow_obs_abs"], v["flow_obs_rel"] * uhi))
        near = (o >= olo - v["o2_near"]) & (o <= ohi + v["o2_near"]) & \
               (u >= max(0.0, ulo / v["flow_near_factor"] - v["flow_obs_abs"])) & \
               (u <= uhi * v["flow_near_factor"] + v["flow_obs_abs"])
        lvl = np.where(obs, NO_SPREAD, np.where(near, NEAR, SPREADS))
        if np.ndim(lvl) == 0 and lvl > 0:
            matched.append({"case_id": c["case_id"], "status": c["status"], "level": VERDICTS[int(lvl)], "outcome": c["outcome"]})
        code = np.maximum(code, lvl)
    return code, matched
