#!/usr/bin/env python3
"""data/gaps.json: oxygen and pressure that NASA's microgravity combustion tests actually covered, per investigation,
read from the PSI summary tables in datasets/psi/. Verdicts are computed from those points, not written by hand.

    python scripts/build_gaps.py
"""
import glob, json, re
from pathlib import Path
import numpy as np, pandas as pd
ROOT = Path(__file__).resolve().parents[1]
num = lambda s: pd.to_numeric(s, errors="coerce")
def table(pid, part=""):
    f = [x for x in glob.glob(str(ROOT / f"datasets/psi/{pid}/*Experimental table*.csv")) if part in x][0]
    return pd.read_csv(f, encoding_errors="ignore")
pts = []   # (investigation, fuel kind, O2 %, pressure kPa)
d = table("PSI-69"); pts += [("FLEX (PSI-69)", "liquid droplets", 100 * o, p * 0.133322) for o, p in zip(num(d["O initial ambient composition; mole fraction"]), num(d["Ambient pressure; mmHg"]))]
d = table("PSI-39"); pts += [("CFI (PSI-39)", "liquid droplets", 100 * o, float(re.findall(r"[\d.]+", str(p))[0]) * 101.325 if re.findall(r"[\d.]+", str(p)) else np.nan) for o, p in zip(num(d["Oxygen"]), d["Pressure"])]
d = table("PSI-25"); pts += [("BASS-II (PSI-25)", "solids", o, 101.325) for o in num(d["Calibrated  initial O2 % by vol "])]
for part in ("Inverse", "Normal"):
    d = table("PSI-159", part); oc = "XO2" if "XO2" in d.columns else " XO2 before test"
    pts += [("ACME CFI-G (PSI-159)", "gas flames", 100 * o, p * 100) for o, p in zip(num(d[oc]), num(d["approx p (bar)"]))]
    d = table("PSI-10", part); oc = "XO2" if "XO2" in d.columns else "XO2 (init)"
    pts += [("ACME Flame Design (PSI-10)", "gas flames", 100 * o, p * 101.325) for o, p in zip(num(d[oc]), num(d["pmean (atm)"]))]
P = pd.DataFrame(pts, columns=["inv", "kind", "o2", "kpa"]).dropna()
P = P[(P.o2 > 0) & (P.o2 <= 100) & (P.kpa > 0)]
tested = []
for inv, g in P.groupby("inv"):
    tested.append(dict(inv=inv, kind=g.kind.iloc[0], n=int(len(g)), o2=[float(round(g.o2.min(), 1)), float(round(g.o2.max(), 1))], kpa=[float(round(g.kpa.min(), 1)), float(round(g.kpa.max(), 1))], pressure_assumed=bool(inv.startswith("BASS")),
                       points=[[float(round(a, 2)), float(round(b, 1))] for a, b in sorted(set(zip(g.o2.round(1), g.kpa.round(0))))]))
def near(kind, o2, kpa, do2=3, dk=10):
    g = P[P.kind == kind]; return int(((g.o2 - o2).abs() <= do2).mul((g.kpa - kpa).abs() <= dk).sum())
probe = [("ISS cabin air", 21, 101.3), ("34% O2 at 70.3 kPa (10.2 psi)", 34, 70.3), ("26.5% O2 at 70.3 kPa (10.2 psi)", 26.5, 70.3),
         ("34% O2 at 56.5 kPa (8.2 psia, NASA EAWG 2010 recommendation)", 34, 56.5)]
grid = [dict(atmosphere=n, o2=o, kpa=k, counts={kind: near(kind, o, k) for kind in ("solids", "liquid droplets", "gas flames")}) for n, o, k in probe]
verdicts = []
s = [t for t in tested if t["kind"] == "solids"][0]
verdicts.append(dict(text=f"Solid fuels (BASS-II): tested at {s['o2'][0]}-{s['o2'][1]}% O2. The table records no pressure, so we place these tests at cabin pressure (101.3 kPa); that is our assumption. Either way, these archives hold no solid-fuel spread data at a known reduced pressure.",
                     source="NASA PSI-25 summary table (calibrated initial O2 column; no pressure column)"))
for g in grid:
    missing = [k for k, v in g["counts"].items() if v == 0]
    if missing: verdicts.append(dict(text=f"{g['atmosphere']}: no {', no '.join(missing)} tests within 3 O2 points and 10 kPa.", source="Computed from the PSI tables listed under 'tested'"))
verdicts.append(dict(text="No combustion data at lunar or Martian gravity in these archives: Moon and Mars answers can only be bounded by the 0 g and 1 g results.",
                     source="All investigations here ran in orbit (0 g); the challenge brief notes the same gap"))
# Large-scale flight burns outside the PSI tables, as published (status reported, drawn separately, not counted above).
gas = json.loads((ROOT / "data/saffire_gas.json").read_text())
reported = dict(name="Saffire IV-VI (large burns in Cygnus)", kind="solids", status="reported", source=gas["source"], source_url=gas["source_url"],
                points=[[t["o2"], t["kPa"], t["test"]] for t in gas["tests"]])
verdicts.append(dict(text="Saffire VI (2024) burned large cloth and acrylic samples at 54-55 kPa and 29-31% O2, the closest large-scale flight data to the 8 psia / 32% exploration atmosphere. These are 3 burns in one vehicle: a bound, not a trend.",
                     source="ICES-2024-365 (reported); EAWG recommendation: NASA/TP-2010-216134"))
out = dict(status="real", source="NASA PSI summary tables (FLEX PSI-69, CFI PSI-39, BASS-II PSI-25, ACME CFI-G PSI-159, ACME Flame Design PSI-10), downloaded 14 Nov 2026",
           axes=["O2, % by volume", "Pressure, kPa"], units=dict(o2="% by volume", kpa="kPa"), tested=tested, reported=reported, probes=grid, verdicts=verdicts,
           note="Coverage is read from the published summary tables only. A point means a test was run there, not that it burned. Exploration atmospheres are shown as probes, not as NASA's chosen design.")
(ROOT / "data" / "gaps.json").write_text(json.dumps(out, indent=1))
m = json.loads((ROOT / "data/manifest.json").read_text())
for f in m["files"]:
    if f["name"] == "gaps": f.update(status="real", what="Oxygen and pressure NASA's microgravity tests covered, and the gaps")
(ROOT / "data/manifest.json").write_text(json.dumps(m, indent=1))
for t in tested: print(t["inv"], t["n"], t["o2"], t["kpa"])
for g in grid: print(g)
for v in verdicts: print("-", v["text"])
