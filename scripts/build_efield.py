#!/usr/bin/env python3
"""data/efield.json from NASA PSI-22 (ACME E-FIELD Flames): the test days and what NASA says the experiment studied.

    python scripts/build_efield.py
"""
import csv, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
D = ROOT / "datasets/psi/PSI-22"
meta = json.loads((D / "investigation.json").read_text())
rows = []
for r in csv.DictReader(open(D / "PSI-22_Experimental table_ACME E-FIELD Flames.csv", newline="", encoding="utf-8", errors="ignore")):
    if not (r.get("Test Day") or "").strip(): continue                     # continuation lines hold notes or extra concentrations
    rows.append(dict(round=r["Test Type"].strip(), date=f"{int(float(r['Year']))}-{int(float(r['Month'])):02d}-{int(float(r['Date'])):02d}",
                     mesh_polarity=r["Mesh Polarity"].strip(), fuel=r["Fuel Bottle"].strip(), fuel_conc=r["Fuel Conc"].strip(),
                     flames_ignited=int(float(r["Flames Ignited"]))))
total = sum(r["flames_ignited"] for r in rows)
out = dict(status="real", source=f"NASA PSI-22, ACME E-FIELD Flames (doi {meta['doi']}): experiment table and investigation description, CC0.",
           finding=(f"NASA ran {len(rows)} test days on the space station in {rows[0]['date'][:4] if rows[0]['date'][:4] == rows[-1]['date'][:4] else rows[0]['date'][:4] + '-' + rows[-1]['date'][:4]} and ignited {total} methane and ethylene flames "
                    "with up to 10 kV between the burner and a mesh above it. It measured ion current, how fast the flame responds to the field, soot, and lifted flames. "
                    "NASA states the research is not aimed at space applications, and putting flames out is not among its stated objectives. Our ion-wind trial is a different question: "
                    "this panel shows what NASA studied, not that electric fields extinguish fires in orbit."),
           units=dict(flames_ignited="count", fuel_conc="volume % fuel, diluted with nitrogen"),
           quotes=dict(objective=meta.get("objective"), research_impacts=meta.get("researchImpacts", "").split(".")[0] + "."),
           totals=dict(test_days=len(rows), flames_ignited=total), rows=rows)
(ROOT / "data" / "efield.json").write_text(json.dumps(out, indent=1))
print(out["finding"]); print(len(rows), total)
