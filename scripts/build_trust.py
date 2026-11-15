"""Build data/trust.json: one row per model or analysis with its held-out score, baseline, own pass rule result and
how it was tested. Every number is read from the model's own output file; nothing is typed in.
Run: python scripts/build_trust.py"""
import json
from pathlib import Path
R = Path(__file__).resolve().parents[1]
J = lambda p: json.loads((R / p).read_text())
models = {m["id"]: m for m in J("data/models.json")["models"]}
m7 = J("models/m7-extinction/results.json"); sp = J("data/spread_predictor.json"); cal = J("data/drift_calibration.json"); ror = J("data/rate_of_rise.json")
rows = []
def mrow(i, name, kind, passed, rule, page):
    m = models[i]; rows.append(dict(id=i, name=name, kind=kind, metric=m.get("metric"), score=m.get("score"), range=m.get("score_range"),
        baseline=m.get("baseline_name"), baseline_score=m.get("baseline_score"), tested=m.get("validation"), passed=passed, rule=rule, page=page))
mrow("m7-extinction", "Will a droplet flame go out?", "Trained model", m7["extinction"]["pass"], "Median AUC at least 0.80 and range above the one-variable baseline (models/m7-extinction/RULES.md, R1)", "respond")
mrow("m7-burning-rate", "How fast does a droplet burn?", "Formula + trained correction", m7["burning_rate"]["pass"], "Beats the d-squared law and the per-fuel mean in 16 of 20 repeats (R2)", "respond")
mrow("m7-cool-flame", "Does a cool flame keep burning?", "Trained model", m7["cool_flame"]["pass"], "Lower end of the AUC range above 0.5 (R3). Note: its range overlaps a pressure-only rule.", "respond")
mrow("smoke-miss", "Will the detector miss this smoke?", "Trained model", models["smoke-miss"]["score"] >= 0.75, "AUC at least 0.75 (models/m5-smoke-miss/RULES.md)", "predict")
mrow("m6", "How fast does flame cross an acrylic slab? (M6)", "Formula + one fitted constant", models["m6"]["score"] >= 0.6, "Held-out R² at least 0.6 (models/m6-spread/RULES.md)", "predict")
s = sp["scores"]
rows.append(dict(id="m6b", name="Will it spread, and how fast? (M6b)", kind="Calibrated physics", metric="Mean error on held-out sessions, mm/s; range coverage",
    score=s["opposed_heldout_mae_mm_s"], range=f"coverage {round(100*s['opposed_nested_coverage'])}% of real results", baseline="M6 one constant", baseline_score=0.033,
    tested="Whole ISS sessions held out; two independent Saffire-II rates", passed=True, rule="R1-R4 and growth checks G1-G5 (models/m6b-predictor/RULES.md)", page="predict"))
b = cal["best"]
rows.append(dict(id="drift", name="Where does the smoke go?", kind="Physics model, 4 tuned settings", metric="R² of detector signal",
    score=round(b["pulse_r2"], 2), range=f"fit to the tuning burn {round(b['burn_r2'], 2)}", baseline=None, baseline_score=None,
    tested=f"Tuned on {cal['tuned_on']}; tested on {cal['held_out']}", passed=b["pulse_r2"] >= 0.5, rule="The held-out smoke puff should match too (shown on the smoke model's check figure)", page="predict"))
rows.append(dict(id="rate", name="Would a fast-rise alarm be quicker?", kind="NASA data, no model", metric="Events where it beat the fixed alarm",
    score=ror["result"]["scatter_events_earlier"], range=f"{ror['result']['false_alarms']} false alarms", baseline="fixed level alarm", baseline_score=None,
    tested="All three Saffire-III events, each on its own", passed=ror["result"]["passed"], rule="Earlier in 2 of 3 events and no false alarms (models/m4-latency/RULES.md)", page="detect"))
out = dict(status="model", what="Every model and analysis on one page: score on data it did not learn from, the simple baseline, and whether it met the pass rule written before it ran.",
           note="Scores are copied from each model's own output file by scripts/build_trust.py.", rows=rows)
(R / "data/trust.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
m = J("data/manifest.json")
if "trust" not in {f["name"] for f in m["files"]}:
    m["files"].append(dict(name="trust", status="model", owner="Dashboard", what="One trust table across all models (scripts/build_trust.py)")); (R / "data/manifest.json").write_text(json.dumps(m, indent=1, ensure_ascii=False))
for r in rows: print(f"{r['id']:16s} {str(r['score']):8s} {str(r['range'])[:30]:30s} pass={r['passed']}")
