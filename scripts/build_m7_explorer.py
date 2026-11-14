#!/usr/bin/env python3
"""data/m7_explorer.json: the tables behind the interactive extinction and cool-flame panels, copied from M7's own
results (models/m7-extinction/results.json). Nothing is refitted here.

    python scripts/build_m7_explorer.py
"""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
r = json.loads((ROOT / "models/m7-extinction/results.json").read_text())
e, c = r["extinction"], r["cool_flame"]
out = dict(status="model", source="models/m7-extinction (results.json), trained on NASA FLEX (PSI-69, doi 10.60555/mbq8-0451) and CFI (PSI-39, doi 10.60555/m6pj-a914)",
  units=dict(o2="mole fraction", p_atm="atm", d0_mm="mm"),
  extinction=dict(question="At what oxygen level does a 3 mm droplet flame have a 50% chance of going out?", rows=e["rows"], model=e["final_model"], headline=e["headline"], drivers=e["drivers"],
                  note="Model output for a 3 mm droplet, with a 95% range from 200 session-bootstrap refits. Not a flammability limit.",
                  table=[dict(fuel=t["fuel"], p_atm=t["p_atm"], added_gas=t["added_gas"], o2_half=round(t["o2_at_p_half"], 4), o2_half_range=[round(v, 4) for v in t["o2_at_p_half_95"]],
                              p_out_at_12=round(t["p_ext_at_o2_0.12"], 3), p_out_at_34=round(t["p_ext_at_o2_0.34"], 3)) for t in e["o2_at_half_table"]]),
  cool_flame=dict(question="After the visible flame goes out, does a cool flame keep burning until the fuel is gone?", rows=c["rows"], model=c["final_model"], headline=c["headline"], drivers=c["drivers"],
                  pressure_at_half_atm=c["pressure_at_half_air_4.3mm_dodecane_free"], pressure_at_half_case="air, 4.3 mm n-dodecane droplet, free-floating",
                  observed=[dict(p_atm=o["p_atm"], x_he=o["x_he"], burns=o["burns"], used_up=o["used_up"]) for o in c["observed"]["end_state_by_pressure_and_helium"]],
                  cfig_quote=c["cfig"]["report_quote"], cfig_source="ACME CFI-G final report (2022), NASA PSI-159 (doi 10.60555/cyt1-kh64)"))
(ROOT / "data" / "m7_explorer.json").write_text(json.dumps(out, indent=1))
m = json.loads((ROOT / "data/manifest.json").read_text())
if not any(f["name"] == "m7_explorer" for f in m["files"]):
    m["files"].append(dict(name="m7_explorer", status="model", owner="M7 lane", what="Extinction oxygen levels and cool-flame end states from the M7 models, for the interactive panels"))
(ROOT / "data/manifest.json").write_text(json.dumps(m, indent=1))
print(len(out["extinction"]["table"]), "extinction rows;", len(out["cool_flame"]["observed"]), "cool-flame rows")
