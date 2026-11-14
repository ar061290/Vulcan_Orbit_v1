#!/usr/bin/env python3
"""Flame simulation, stages 1 to 3. Rebuilds every output from scratch:

    python models/flame-sim/build.py      # data/flame_static.json, data/flame_spread.json, models/flame-sim/results.json

Reduced-order physics only (no combustion CFD). Status of all outputs: "model". NASA data exists only at 0 g and 1 g;
Moon and Mars outputs are labelled "model only, not validated; lies between NASA's microgravity and Earth results".
"""
import csv, json, math, sys, time, re, warnings
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(HERE))
warnings.filterwarnings("ignore")

import numpy as np
import chem, droplet, shape, surface, spread

SEED = 42
G0 = 9.80665
GRAV = [("0 g", 0.0), ("Moon 0.16 g", 0.16), ("Mars 0.38 g", 0.38), ("Earth 1 g", 1.0)]
LBL_MODEL = "model only, not validated; lies between NASA's microgravity and Earth results"
FUELS = ["methane", "ethylene", "propane", "n-heptane", "ethanol"]
CHECK_ONLY = ["methanol"]
O2S = [0.21, 0.34]
PRESS = [101.3, 70.3]                  # kPa (70.3 kPa = 10.2 psi)
FLOWS = [0.0, 0.05, 0.10, 0.20]        # m/s forced airflow
D_SHAPE = 3.0e-3                       # m, droplet size for the shape cases: FLEX "smaller droplet size (~3 mm)", PSI-69 approach
QF_GAS = 5.0e-6                        # m3/s, gas-jet fuel flow for the shape cases (scenario input, README Decisions)
CHECKS = []


def label(gfrac):
    return "validated" if gfrac in (0.0, 1.0) else LBL_MODEL


def log(cid, ok, text, **kw):
    CHECKS.append(dict(id=cid, ok=None if ok is None else bool(ok), result=text, **kw))
    tag = "PASS" if ok else ("NOT RUN" if ok is None else "FAIL")
    print(f"{tag:8s}{cid:14s}{text}", flush=True)


def pct(a):
    return [round(float(np.percentile(a, 5)), 1), round(float(np.percentile(a, 95)), 1)]


# =============================================================== FLEX data (PSI-69)
def flex_rows():
    f = ROOT / "datasets/psi/PSI-69/PSI-69_Experimental table_FLEX.csv"
    out = []
    num = lambda s: float(s) if re.fullmatch(r"\s*-?[\d.]+\s*", s or "") else None
    for r in csv.DictReader(open(f, encoding="latin-1", newline="")):
        fuel = {"Heptane": "n-heptane", "Methanol": "methanol"}.get(r["Fuel"].strip())
        P = num(r["Ambient pressure; mmHg"]); d0 = num(r["Droplet initial diameter; mm"])
        if not fuel or not P or not d0:
            continue
        try:
            date = datetime.strptime(r["Test Date"].strip(), "%m/%d/%Y")
        except ValueError:
            date = datetime.strptime(r["Test Date"].strip(), "%m/%d/%y")
        X = {k: num(r[c]) or 0.0 for k, c in (("O2", "O initial ambient composition; mole fraction"), ("N2", "N initial ambient composition; mole fraction"),
                                              ("CO2", "CO initial ambient composition; mole fraction"), ("HE", "He initial ambient composition; mole fraction"))}
        s = sum(X.values()); X = {k: v / s for k, v in X.items()}
        de = num(r["Visible flame extinction diameter; mm"])
        out.append(dict(test=r["FLEX Test #"], id=r["FLEX Identifier"], date=date.strftime("%Y-%m-%d"), fuel=fuel, P=P * 133.322, X=X,
                        d0=d0, K=num(r["Burning rate; mm"]), d_ext=de if de and de > 0 else None, end=r["Test end"].strip()))
    dates = sorted({r["date"] for r in out})
    tune = set(dates[0::2])
    for r in out:
        r["half"] = "tune" if r["date"] in tune else "held-out"
    return out


def stage1(res):
    t0 = time.time()
    # ---- chemistry and droplet table
    chemtab = []
    for fuel in FUELS + CHECK_ONLY:
        for x in O2S:
            for p in PRESS:
                b = droplet.burn(fuel, x, p * 1e3)
                e = b["eq"]
                row = dict(fuel=fuel, check_only=fuel in CHECK_ONLY, X_O2=x, P_kPa=p, T_ad_K=round(e["T_ad"], 1), Z_st=round(e["Z_st"], 5),
                           LHV_MJ_kg=round(chem.lhv(fuel) / 1e6, 3), s_O2_per_fuel=round(e["s"], 4))
                if b["K_mm2_s"] is None:
                    row.update(B=None, K_mm2_s=None, standoff_ratio=None, burnout_s=None, critical_diameter_mm=None, note=b["reason"])
                else:
                    row.update(B=round(b["B"], 3), K_mm2_s=round(b["K_mm2_s"], 4), standoff_ratio=round(b["standoff"], 2),
                               kappa_P_1_m=round(b["kappa_P"], 4), T_boil_K=b["T_b"],
                               burnout_s={f"{d}": round(droplet.burnout_s(b, d * 1e-3), 2) for d in (1, 2, 3, 4, 5)})
                chemtab.append(row)
    lhv_rep = chem.PROPS["lhv_reported_MJ_kg"]["values"]
    worst = max(abs(chem.lhv(f) / 1e6 / lhv_rep[f] - 1) for f in lhv_rep)
    print(f"LHV from Cantera vs reported table: worst difference {worst:.1%}")
    res["lhv_vs_reported_worst"] = worst
    # ---- FLEX comparison
    rows = flex_rows()
    for r in rows:
        dil = {k: v for k, v in r["X"].items() if k != "O2"}
        b = droplet.burn(r["fuel"], r["X"]["O2"], r["P"], dil)
        r["b"] = b; r["K_model"] = b["K_mm2_s"]
    K_stats = {}
    for fuel, cid in (("n-heptane", "S1-K-hep"), ("methanol", "S1-K-meth")):
        rr = [r for r in rows if r["fuel"] == fuel and r["K"]]
        err = np.array([(r["K_model"] - r["K"]) / r["K"] * 100 for r in rr])
        ho = np.array([(r["K_model"] - r["K"]) / r["K"] * 100 for r in rr if r["half"] == "held-out"])
        base_K = np.mean([r["K"] for r in rr if r["half"] == "tune"])
        be = np.array([(base_K - r["K"]) / r["K"] * 100 for r in rr if r["half"] == "held-out"])
        med = float(np.median(np.abs(err)))
        K_stats[fuel] = dict(n=len(rr), median_abs_err_pct=round(med, 1), signed_err_5_95_pct=pct(err), bias_pct=round(float(np.median(err)), 1),
                             held_out_n=len(ho), held_out_median_abs_err_pct=round(float(np.median(np.abs(ho))), 1),
                             baseline_K_mm2_s=round(float(base_K), 3), baseline_held_out_median_abs_err_pct=round(float(np.median(np.abs(be))), 1))
        log(cid, med <= 30, f"{fuel}: median |error| {med:.1f}% over {len(rr)} FLEX tests (range of signed error {pct(err)} %), "
                            f"held-out {K_stats[fuel]['held_out_median_abs_err_pct']}%; baseline constant K {base_K:.3f} mm2/s: held-out "
                            f"{K_stats[fuel]['baseline_held_out_median_abs_err_pct']}% (limit <= 30%)")
    log("S1-K-base", True, "baseline reported beside S1-K-hep and S1-K-meth")
    # ---- radiative extinction: tune G, T_lim on the tune half
    cls = [r for r in rows if r["end"] in ("Extinction", "Completion")]
    def predict(r, G, Tl):
        dc = droplet.critical_diameter(r["b"], G, Tl)
        return dc, r["d0"] * 1e-3 > dc
    def bal_acc(sub, G, Tl):
        y = np.array([r["end"] == "Extinction" for r in sub]); p = np.array([predict(r, G, Tl)[1] for r in sub])
        tpr = (p & y).sum() / max(y.sum(), 1); tnr = (~p & ~y).sum() / max((~y).sum(), 1)
        return 0.5 * (tpr + tnr)
    tune = [r for r in cls if r["half"] == "tune"]; held = [r for r in cls if r["half"] == "held-out"]
    best = None
    for G in np.round(np.logspace(-2, 1, 31), 5):
        for Tl in range(1000, 2025, 25):
            s = bal_acc(tune, G, Tl)
            if best is None or s > best[0] + 1e-12:
                best = (s, float(G), Tl)
    _, G, Tl = best
    res["radiative_constants"] = dict(G=G, T_lim_K=Tl, tune_balanced_accuracy=round(best[0], 3), tune_n=len(tune), held_out_n=len(held))
    ba = bal_acc(held, G, Tl)
    rng = np.random.default_rng(SEED)
    boots = [bal_acc([held[i] for i in rng.integers(0, len(held), len(held))], G, Tl) for _ in range(1000)]
    base = 0.5   # trivial predictor (always one class) has balanced accuracy 0.5
    log("S1-ext-class", ba >= 0.65, f"balanced accuracy {ba:.2f} [{np.percentile(boots, 2.5):.2f}, {np.percentile(boots, 97.5):.2f}] on {len(held)} held-out "
                                    f"tests (tuned G={G:g}, T_lim={Tl} K on {len(tune)} tests); always-one-class baseline 0.50 (limit >= 0.65)")
    ext = []
    for r in held:
        if r["d_ext"] is None: continue
        dc, out = predict(r, G, Tl)
        if not out: continue
        pt = 0.5 * (dc * 1e3 + r["d0"])
        ext.append(dict(err=abs(pt - r["d_ext"]) / r["d_ext"] * 100, inside=dc * 1e3 <= r["d_ext"] <= r["d0"]))
    if ext:
        med = float(np.median([e["err"] for e in ext])); ins = float(np.mean([e["inside"] for e in ext]))
        log("S1-ext-diam", med <= 35, f"median |error| {med:.0f}% on {len(ext)} held-out tests; measured value inside model range in {ins:.0%} (limit <= 35%)")
    else:
        log("S1-ext-diam", None, "not run: no held-out test with a measured extinction diameter that the model flags as extinguishing")
    flexcmp = [dict(test=r["test"], id=r["id"], date=r["date"], half=r["half"], fuel=r["fuel"], P_kPa=round(r["P"] / 1e3, 2),
                    X={k: round(v, 3) for k, v in r["X"].items()}, d0_mm=r["d0"], K_meas_mm2_s=r["K"], K_model_mm2_s=round(r["K_model"], 4),
                    d_ext_meas_mm=r["d_ext"], end=r["end"], d_crit_model_mm=round(droplet.critical_diameter(r["b"], G, Tl) * 1e3, 3))
               for r in rows]
    for row in chemtab:
        if row["K_mm2_s"] is not None:
            b = droplet.burn(row["fuel"], row["X_O2"], row["P_kPa"] * 1e3)
            row["critical_diameter_mm"] = round(droplet.critical_diameter(b, G, Tl) * 1e3, 3)
    # ---- flame shapes
    cases = []
    for fuel in FUELS:
        for x in O2S:
            for p in PRESS:
                P = p * 1e3
                b = droplet.burn(fuel, x, P); e = b["eq"]; ox = chem.oxidiser(x)
                if chem.is_liquid(fuel):
                    m_dot = math.pi / 4 * b["rho_l"] * b["K_mm2_s"] * 1e-6 * D_SHAPE; rhoD = b["rhoD"]; Tsrc = b["T_b"]
                    Tbar = 0.5 * (b["T_b"] + e["T_ad"]); src = dict(type="droplet", d0_mm=D_SHAPE * 1e3)
                else:
                    Tbar = 0.5 * (298.15 + e["T_ad"])
                    pf = chem.gas_props({chem.fuel_species(fuel): 1.0}, Tbar, P); pa = chem.gas_props(ox, Tbar, P)
                    rhoD = (0.4 * pf["k"] + 0.6 * pa["k"]) / pf["cp"]; Tsrc = 298.15
                    m_dot = chem.gas_props({chem.fuel_species(fuel): 1.0}, 298.15, 101325.0)["rho"] * QF_GAS
                    src = dict(type="gas jet", Q_F_cm3_s=QF_GAS * 1e6)
                rho_m = chem.gas_props(ox, Tbar, P)["rho"]
                src["m_dot_mg_s"] = round(m_dot * 1e6, 4)
                for gname, gf in GRAV:
                    for U in FLOWS:
                        fl = shape.flame(m_dot, rhoD, rho_m, e["Z_st"], e["T_ad"], Tsrc, gf * G0, U)
                        cases.append(dict(fuel=fuel, X_O2=x, P_kPa=p, gravity=gname, g_m_s2=round(gf * G0, 4), gravity_label=label(gf),
                                          flow_m_s=U, source=src, T_flame_K=round(e["T_ad"]), Z_st=round(e["Z_st"], 5),
                                          flame_radius_no_flow_mm=round(fl["L_m"] * 1e3, 3), U_buoy_m_s=round(fl["U_buoy_m_s"], 4),
                                          length_mm=round(fl["length_m"] * 1e3, 3), width_mm=round(fl["width_m"] * 1e3, 3),
                                          aspect=None if fl["aspect"] is None else round(fl["aspect"], 3), tilt_deg_from_vertical=fl["tilt_deg_from_vertical"],
                                          sphericity=fl["sphericity"],
                                          contour_mm=[[round(a * 1e3, 3), round(c * 1e3, 3)] for a, c in fl["contour_m"]],
                                          grid=dict(x_mm=[round(v * 1e3, 3) for v in fl["grid"]["x_m"]], z_mm=[round(v * 1e3, 3) for v in fl["grid"]["z_m"]],
                                                    T_K=fl["grid"]["T_K"])))
    sph = max(c["sphericity"] for c in cases if c["g_m_s2"] == 0 and c["flow_m_s"] == 0)
    log("S1-sphere", sph < 0.01, f"0 g, no flow: worst (max - min radius)/mean radius {sph:.1e} over {sum(1 for c in cases if c['g_m_s2'] == 0 and c['flow_m_s'] == 0)} cases (limit < 1%)")
    mono = True
    for fuel in FUELS:
        for x in O2S:
            for p in PRESS:
                a = [c["aspect"] for c in cases if c["fuel"] == fuel and c["X_O2"] == x and c["P_kPa"] == p and c["flow_m_s"] == 0]
                mono &= all(a[k] <= a[k + 1] + 1e-9 for k in range(len(a) - 1))
    log("S1-order", mono, "aspect ratio does not decrease from 0 g to Moon to Mars to 1 g at zero forced flow, in every fuel/O2/pressure case")
    # ---- 1 g flame height vs Roper correlation (circular port, laminar)
    roper = []
    for fuel in ("methane", "ethylene", "propane"):
        c = next(c for c in cases if c["fuel"] == fuel and c["X_O2"] == 0.21 and c["P_kPa"] == 101.3 and c["g_m_s2"] > 9 and c["flow_m_s"] == 0)
        sp = chem.fuel_species(fuel); g = chem.mech("gri30.yaml")
        S = chem.stoich_o2(sp, g) / 0.21                                  # mol air per mol fuel at stoichiometric
        Lr = 1330 * QF_GAS * 1.0 / math.log(1 + 1 / S) * 1e3              # mm; T_inf / T_F = 1 (fuel at room temperature)
        Lm = c["flame_radius_no_flow_mm"]                                 # downstream flame length of the point-source flame
        roper.append(dict(fuel=fuel, model_mm=Lm, roper_mm=round(Lr, 2), ratio=round(Lm / Lr, 3)))
    ok = all(0.5 <= r["ratio"] <= 2.0 for r in roper)
    log("S1-height", ok, "model / Roper: " + ", ".join(f"{r['fuel']} {r['model_mm']:.1f}/{r['roper_mm']:.1f} mm = {r['ratio']:.2f}" for r in roper) + " (limit 0.5 to 2.0)")
    print(f"stage 1 done in {time.time() - t0:.0f} s")
    return chemtab, flexcmp, K_stats, cases, roper


# =============================================================== stage 2
def stage2(res):
    lit = HERE / "literature.json"
    LIT = json.loads(lit.read_text()) if lit.exists() else None
    pm = chem.PROPS["solids"]["PMMA"]
    xs = [round(0.01 * k, 2) for k in range(1, 21)]
    plates = []
    def pmma_B(x):
        Y = x * 31.998 / (x * 31.998 + (1 - x) * 28.014); s = 6 * 31.998 / 100.117
        return (Y * pm["dh_c_MJ_kg"] * 1e6 / s - spread.CP0 * (pm["T_v_K"] - 298.15)) / (pm["L_gasif_kJ_kg"] * 1e3)
    for x in O2S:
        for p in PRESS:
            P = p * 1e3
            ga = chem.gas_props(chem.oxidiser(x), 298.15, P); nu = ga["mu"] / ga["rho"]
            B = pmma_B(x)
            for gname, gf in GRAV:
                for U in FLOWS:
                    if gf == 0 and U == 0:
                        plates.append(dict(fuel="PMMA (thick)", X_O2=x, P_kPa=p, gravity=gname, g_m_s2=0.0, gravity_label=label(gf), flow_m_s=U,
                                           x_cm=[v * 100 for v in xs], m_g_m2_s=None, standoff_mm=None,
                                           note="no flow and no buoyancy: no steady boundary layer, Emmons solution does not apply"))
                        continue
                    r = surface.plate(B, spread.z_st_pmma(x), spread.t_flame(x), pm["T_v_K"], ga["rho"], nu, U, gf * G0, xs)
                    plates.append(dict(fuel="PMMA (thick)", X_O2=x, P_kPa=p, gravity=gname, g_m_s2=round(gf * G0, 4), gravity_label=label(gf),
                                       flow_m_s=U, B=round(B, 3), x_cm=[round(v * 100, 1) for v in xs],
                                       m_g_m2_s=[round(v, 3) for v in r["m_g_m2_s"]], standoff_mm=[round(v, 3) for v in r["standoff_mm"]],
                                       U_eff_m_s=[round(v, 4) for v in r["U_eff_m_s"]]))
    sib = chem.PROPS["solids"]["SIBAL"]
    res["sibal_plate"] = "not computed: cotton heat of combustion and heat of gasification have no verified source (properties.json)" \
        if "dh_c_MJ_kg" not in sib else None
    # small-B limit of the Emmons solver vs the Blasius / Reynolds-analogy value 0.332
    a, _, _ = surface.emmons(1e-5)
    res["emmons_smallB_f2"] = a
    print(f"Emmons solver, B -> 0: f''(0) = {a:.5f} (Blasius 0.33206)")
    get = lambda g, U: next(c for c in plates if c["X_O2"] == 0.21 and c["P_kPa"] == 101.3 and c["g_m_s2"] == g and c["flow_m_s"] == U)
    g1 = round(G0, 4)
    z05, e05, z20 = get(0.0, 0.05), get(g1, 0.05), get(0.0, 0.20)
    ratio = [a / b for a, b in zip(z05["standoff_mm"], e05["standoff_mm"])]
    log("S2-thick", all(r > 1 for r in ratio), f"standoff 0 g / 1 g at 0.05 m/s: {min(ratio):.2f} to {max(ratio):.2f} along the plate (limit > 1 everywhere)")
    drop = lambda c: c["m_g_m2_s"][1] - c["m_g_m2_s"][19]
    d = dict(zero_g_005=drop(z05), zero_g_020=drop(z20), one_g_005=drop(e05))
    log("S2-flat", d["zero_g_005"] < min(d["zero_g_020"], d["one_g_005"]),
        f"burning-rate drop from 2 to 20 cm: 0 g at 0.05 m/s {d['zero_g_005']:.2f}, 0 g at 0.20 m/s {d['zero_g_020']:.2f}, 1 g at 0.05 m/s {d['one_g_005']:.2f} g/m2/s (0 g low flow must be smallest)")
    exps = {}
    for c in (z05, e05, get(g1, 0.0)):
        y = np.array(c["standoff_mm"]); xx = np.array(c["x_cm"])
        exps[f"{c['gravity']} {c['flow_m_s']} m/s"] = round(float(np.polyfit(np.log(xx), np.log(y), 1)[0]), 3)
    res["standoff_exponents"] = exps
    print("standoff ~ x^n:", exps)
    if LIT is None:
        log("S2-rate", None, "not run: no literature ranges (literature.json missing)")
        log("S2-standoff", None, "not run: no literature ranges (literature.json missing)")
    else:
        for kind, key, cid in (("rate", "m_g_m2_s", "S2-rate"), ("standoff", "standoff_mm", "S2-standoff")):
            items = [it for it in LIT["pmma"] if it["kind"] == kind]
            if not items:
                log(cid, None, f"not run: no data. No verified measured PMMA {kind} in mm found in text or tables (literature.json)"); continue
            res_items = []
            for it in items:
                ga = chem.gas_props(chem.oxidiser(it.get("X_O2", 0.21)), 298.15, it.get("P_kPa", 101.325) * 1e3)
                xq = list((np.arange(400) + 0.5) / 400 * it["x_m"]) if it.get("avg") else [it["x_m"]]   # midpoint grid for plate averages
                r = surface.plate(pmma_B(it.get("X_O2", 0.21)), spread.z_st_pmma(it.get("X_O2", 0.21)), spread.t_flame(it.get("X_O2", 0.21)),
                                  pm["T_v_K"], ga["rho"], ga["mu"] / ga["rho"], it["flow_m_s"], it["g"] * G0, xq)
                v = float(np.mean(r[key])); lo, hi = it["range"]
                res_items.append(dict(source=it["source"], avg=bool(it.get("avg")), x_m=it["x_m"], flow_m_s=it["flow_m_s"], g=it["g"], model=round(v, 3), reported=[lo, hi],
                                      ok=lo / 2 <= v <= hi * 2))
            ok = all(i["ok"] for i in res_items)
            log(cid, ok, "; ".join(f"{i['source'][:40]}: model {i['model']} vs reported {i['reported']}" for i in res_items)
                + " (limit: inside the reported range widened x2 each side)", items=res_items)
    return plates


# =============================================================== stage 3
BASS_THICK = [  # NASA/TM-20210011385 Table 5.1 (Miller/Wichman): test, thickness mm, sides, [(flow cm/s, rate mm/s)], O2 initial, final
    ("M1", 1, 1, [(9, 0.071)], 22.2, 21.9), ("M2", 3, 1, [(20, 0.052), (15, 0.033)], 22.2, 21.2), ("M3", 5, 1, [(10, 0.029), (20, 0.024)], 20.8, 19.7),
    ("M4", 5, 2, [(5, 0.045), (3, 0.033)], 21.8, 19.8), ("M5", 3, 2, [(10, 0.071)], 22.2, 19), ("M7", 1, 2, [(10, 0.106), (6, 0.099), (5, 0.083), (3, 0.07)], 18.9, 18.4),
    ("M8", 2, 2, [(10, 0.057), (6, 0.056), (5, 0.04)], 19.1, 18.2), ("M9", 3, 2, [(14, 0.025)], 18, 17.6), ("M10", 4, 2, [(15, 0.0373), (10, 0.03)], 20.1, 18.6),
    ("M11", 5, 2, [(21, 0.048), (15, 0.028), (13, 0.022)], 20, 18.5), ("M13", 4, 2, [(6, 0.047), (5, 0.035), (4, 0.033)], 20.8, 19),
    ("M14", 2, 1, [(15, 0.0624), (14, 0.055), (10, 0.0353)], 22.2, 21.6), ("M15", 4, 1, [(20, 0.045)], 21, 20),
    ("M16", 1, 2, [(5, 0.144), (3, 0.1309), (2, 0.1062)], 19.2, 18.7), ("M17", 2, 2, [(5, 0.053), (4, 0.042), (3, 0.026)], 18.8, 17.1),
    ("M18", 3, 2, [(10, 0.026), (8, 0.013)], 17.9, 16.8), ("M19", 4, 2, [(10, 0.027), (6, 0.0159)], 19, 17.4), ("M20", 5, 2, [(10, 0.012)], 18, 17.4),
]
BASS_THIN = [  # NASA/TM-20210011385 Sec. 2.2.5 / 2.3.7: 100 um PMMA, 20 mm wide, 99.2-99.5 kPa
    dict(what="100 um PMMA, 20.7% O2, 0 g, steady spread (flow 1 to 40 cm/s; highest rate over that range)", X_O2=0.207, g=0.0, rate=2.2, flows=(0.01, 0.40)),
    dict(what="100 um PMMA, 21% O2, 1 g downward spread, average", X_O2=0.21, g=1.0, rate=2.0, flows=(0.0, 0.0)),
]


def stage3(res, plates):
    m = spread.Model()
    res["spread_constants"] = dict(C_Da=m.C_Da, R_c=m.R_c, calibration="blow-off of 100 um PMMA in air at 0.40 m/s; quench at 0.010 m/s")
    pts = []
    for test, th, sides, pairs, o0, o1 in BASS_THICK:
        X = 0.5 * (o0 + o1) / 100
        for v, rate in pairs:
            r = m.rate(th * 1e-3, sides, X, 99.35e3, v / 100)
            pts.append(dict(group="thick PMMA (1-5 mm)", test=test, thickness_mm=th, sides=sides, X_O2=round(X, 4), flow_cm_s=v, g=0.0,
                            reported_mm_s=rate, model_mm_s=round(r["V"] * 1e3, 4), baseline_mm_s=round(r["V_deRis"] * 1e3, 4), regime=r["regime"]))
    for t in BASS_THIN:
        if t["g"] == 0:
            vs = np.linspace(*t["flows"], 79)
            rr = [m.rate(100e-6, 2, t["X_O2"], 99.35e3, v) for v in vs]
            k = int(np.argmax([r["V"] for r in rr])); r = rr[k]; v = vs[k]
        else:
            r = m.rate(100e-6, 2, t["X_O2"], 99.35e3, 0.0, G0); v = 0.0
        pts.append(dict(group="thin PMMA (100 um)", test=t["what"], thickness_mm=0.1, sides=2, X_O2=t["X_O2"], flow_cm_s=round(v * 100, 2), g=t["g"],
                        reported_mm_s=t["rate"], model_mm_s=round(r["V"] * 1e3, 4), baseline_mm_s=round(r["V_deRis"] * 1e3, 4), regime=r["regime"]))
    for p in pts:
        p["err_pct"] = round((p["model_mm_s"] - p["reported_mm_s"]) / p["reported_mm_s"] * 100, 1)
        p["base_err_pct"] = round((p["baseline_mm_s"] - p["reported_mm_s"]) / p["reported_mm_s"] * 100, 1)
        p["band"] = "< 5 cm/s" if p["flow_cm_s"] < 5 else ("5 to 10 cm/s" if p["flow_cm_s"] <= 10 else "> 10 cm/s")
    e = np.array([p["err_pct"] for p in pts]); be = np.array([p["base_err_pct"] for p in pts])
    med = float(np.median(np.abs(e)))
    groups = {}
    for key in ("group", "band"):
        for gv in sorted({p[key] for p in pts}):
            sub = [p for p in pts if p[key] == gv]
            groups[f"{key}: {gv}"] = dict(n=len(sub), median_abs_err_pct=round(float(np.median([abs(p["err_pct"]) for p in sub])), 1),
                                          baseline_median_abs_err_pct=round(float(np.median([abs(p["base_err_pct"]) for p in sub])), 1),
                                          signed_err_5_95_pct=pct([p["err_pct"] for p in sub]))
    log("S3-spread", med <= 50, f"median |error| {med:.0f}% over {len(pts)} BASS-II points (range {pct(e)} %); " +
        "; ".join(f"{k} {v['median_abs_err_pct']}%" for k, v in groups.items()) + " (limit <= 50%)", groups=groups)
    log("S3-base", True, f"de Ris without extinction: median |error| {np.median(np.abs(be)):.0f}% (range {pct(be)} %)")
    # supplementary quench comparisons (not calibration points)
    supp = []
    for X, thick, rep, src in ((0.16, 100e-6, 30.0, "TM-20210011385 Table 2.1: 30 +/- 5 mm/s at 16% O2 (thin PMMA, 1 atm)"),
                               (0.21, 400e-6, 15.0, "TM-20210011385 Sec. 2.2.5: about 1.5 cm/s for 400 um at 21% O2")):
        lim = m.limits(thick, 2, X, 101325)
        supp.append(dict(X_O2=X, thickness_um=thick * 1e6, reported_quench_mm_s=rep, model_quench_mm_s=None if lim is None else round(lim[0] * 1e3, 2), source=src))
    res["quench_supplementary"] = supp
    print("quench, supplementary:", supp)
    # ---- flammability map (flow vs O2), 100 um PMMA
    o2 = [round(0.10 + 0.01 * k, 2) for k in range(31)]
    flows = [float(v) for v in np.round(np.logspace(-3, math.log10(3.0), 61), 5)]
    maps = []
    for p in PRESS:
        for gname, gf in GRAV:
            grid = [[1 if m.rate(100e-6, 2, x, p * 1e3, v, gf * G0)["V"] > 0 else 0 for v in flows] for x in o2]
            lims = [m.limits(100e-6, 2, x, p * 1e3, gf * G0) for x in o2]
            ok_x = [x for x, l in zip(o2, lims) if l]
            mo = min(ok_x) if ok_x else None
            at = None
            if mo is not None:
                l = lims[o2.index(mo)]; at = round(math.sqrt(l[0] * l[1]), 4)
            maps.append(dict(fuel="PMMA 100 um, two-sided", P_kPa=p, gravity=gname, g_m_s2=round(gf * G0, 4), gravity_label=label(gf),
                             O2=o2, flow_m_s=flows, burning=grid, quench_m_s=[None if l is None else round(l[0], 5) for l in lims],
                             blowoff_m_s=[None if l is None else round(l[1], 4) for l in lims], min_O2=mo, min_O2_flow_m_s=at))
    m0 = next(mp for mp in maps if mp["P_kPa"] == 101.3 and mp["g_m_s2"] == 0)
    has = m0["min_O2"] is not None and m0["min_O2"] > o2[0]
    k = o2.index(m0["min_O2"]) if has else None
    branches = has and all(m0["quench_m_s"][j] < m0["blowoff_m_s"][j] for j in range(k, len(o2)) if m0["quench_m_s"][j])
    log("S3-map", bool(branches), f"0 g, 101.3 kPa: quenching and blow-off branches meet at minimum O2 {m0['min_O2']} near {m0['min_O2_flow_m_s']} m/s")
    # ---- spread-rate table (flow, O2, pressure, gravity)
    table = []
    for th, sides, nm in ((100e-6, 2, "PMMA 0.1 mm"), (200e-6, 2, "PMMA 0.2 mm"), (3e-3, 2, "PMMA 3 mm")):
        for p in PRESS:
            for x in O2S:
                for gname, gf in GRAV:
                    rates = [round(m.rate(th, sides, x, p * 1e3, v, gf * G0)["V"] * 1e3, 4) for v in (0.0, 0.01, 0.02, 0.05, 0.1, 0.2)]
                    table.append(dict(fuel=nm, P_kPa=p, X_O2=x, gravity=gname, g_m_s2=round(gf * G0, 4), gravity_label=label(gf),
                                      flow_m_s=[0.0, 0.01, 0.02, 0.05, 0.1, 0.2], rate_mm_s=rates))
    # ---- front marching over a 20 cm sample, 2 cm wide (BASS-II sample width), burning flux from the stage 2 Emmons solution
    pm = chem.PROPS["solids"]["PMMA"]
    zg = next(c for c in plates if c["X_O2"] == 0.21 and c["P_kPa"] == 101.3 and c["g_m_s2"] == 0 and c["flow_m_s"] == 0.10)
    xs = np.array(zg["x_cm"]) / 100; mf = np.array(zg["m_g_m2_s"])
    c_em = float(np.mean(mf * np.sqrt(xs)))                      # m'' = c_em / sqrt(x)
    marches = []
    for th, nm in ((100e-6, "PMMA 0.1 mm"), (200e-6, "PMMA 0.2 mm"), (3e-3, "PMMA 3 mm")):
        r = m.rate(th, 2, 0.21, 101325, 0.10)
        V = r["V"]; A = pm["rho_s_kg_m3"] * th
        ell = 0.01
        for _ in range(60):                                       # burning length l = V * t_burn, t_burn = A / (2 sides * mean flux over l)
            flux = 2 * c_em / math.sqrt(ell)                      # mean of c/sqrt(x) over [0, l] = 2 c / sqrt(l)
            ell_new = V * A * 1e3 / (2 * flux)
            if abs(ell_new / ell - 1) < 1e-9: break
            ell = ell_new
        mr = spread.march(V, 2 * flux, A, dt=0.5 if V > 1e-3 else 20.0)
        marches.append(dict(case=f"{nm}, 0 g, 21% O2, 101.3 kPa, 0.10 m/s opposed flow, sample 20 x 2 cm", spread_mm_s=round(V * 1e3, 4),
                            burning_length_cm=round(ell * 100, 3), mean_flux_g_m2_s=round(flux, 3), **mr))
    # S3-march: constant-rate marching against x = V t
    mr = spread.march(2.2e-3, 5.0, 0.119)
    tt = np.array(mr["t_s"]); fr = np.array(mr["front_cm"]) / 100
    k = tt < 0.2 / 2.2e-3
    err = float(np.max(np.abs(fr[k] - 2.2e-3 * tt[k])) / 0.2)
    bo = abs(mr["burnout_s"] - (0.2 / 2.2e-3 + mr["t_burn_s"])) / mr["burnout_s"]
    log("S3-march", err < 0.01 and bo < 0.01, f"front vs V t: worst error {err:.1e} of sample length; burn-out time error {bo:.1e} (limit < 1%)")
    return dict(points=pts, groups=groups, maps=maps, table=table, marches=marches, model=m)


def main():
    t0 = time.time()
    res = dict(status="model")
    chemtab, flexcmp, K_stats, cases, roper = stage1(res)
    plates = stage2(res)
    s3 = stage3(res, plates)
    units = dict(length="mm unless named _m or _cm", temperature="K", pressure="kPa", K="mm2/s", burning_flux="g/m2/s", spread_rate="mm/s",
                 flow="m/s", gravity="m/s2")
    static = dict(status="model", source="models/flame-sim/build.py", units=units,
                  gravity_note=f"NASA data exists only at 0 g and 1 g. Cases labelled '{LBL_MODEL}' are model output only.",
                  label_meaning="'validated' = NASA or Earth data exist at this gravity and the checks in models/flame-sim/REPORT.md apply (some fail); it does not mean every number was checked.",
                  chemistry=chemtab, radiative_extinction=res["radiative_constants"], flex_comparison=flexcmp, flex_K_stats=K_stats,
                  roper_check=roper, flames=cases, plates=plates,
                  checks=[c for c in CHECKS if c["id"].startswith(("S1", "S2"))],
                  limits=["Reduced-order physics, not combustion CFD", "Point-source flame shape with a uniform effective flow",
                          "Quasi-steady d-squared law; radiative criterion ignores the unsteady growth of the flame",
                          "Emmons solution assumes unit Lewis and Prandtl numbers and constant rho*mu"])
    gr = s3["marches"][0]
    spread_out = dict(status="model", source="models/flame-sim/build.py", units=units, gravity_note=static["gravity_note"],
                      constants=res["spread_constants"], bass_ii_comparison=s3["points"], bass_ii_groups=s3["groups"],
                      quench_supplementary=res["quench_supplementary"], rates=s3["table"], flammability_maps=s3["maps"], fronts=s3["marches"],
                      growth_for_smoke=dict(case=gr["case"], t_s=gr["t_s"], burning_area_cm2=gr["burning_area_cm2"], front_cm=gr["front_cm"]),
                      checks=[c for c in CHECKS if c["id"].startswith("S3")],
                      limits=["de Ris thermal-regime formulas with a reduced extinction correction of our own form",
                              "Blow-off and quench constants each set on one reported BASS-II point",
                              "Thick-fuel spread in microgravity is not steady; the formula assumes it is"])
    (ROOT / "data" / "flame_static.json").write_text(json.dumps(static, separators=(",", ":")))
    (ROOT / "data" / "flame_spread.json").write_text(json.dumps(spread_out, separators=(",", ":")))
    res.update(checks=CHECKS, K_stats=K_stats, roper=roper, groups=s3["groups"])
    (HERE / "results.json").write_text(json.dumps(res, indent=1, default=float))
    print(f"failed: {[c['id'] for c in CHECKS if c['ok'] is False]}; not run: {[c['id'] for c in CHECKS if c['ok'] is None]}; {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
