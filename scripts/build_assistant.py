#!/usr/bin/env python3
"""data/assistant_cache.json and data/assistant_gold.json: the evidence assistant's answers, each written from a data
file in data/ (so every number traces to a file and a field), plus a fixed 30-question test set.

    python scripts/build_assistant.py

The assistant on the site does no generation: it matches a question to one of these answers by keywords, and refuses
("No NASA evidence") when nothing matches well enough. The gold set measures exactly that matcher.
"""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
D = lambda n: json.loads((ROOT / "data" / f"{n}.json").read_text())
pct = lambda x: f"{round(100 * x)}%"
lat, sizes, models, gaps, ef, whatif, cal, fs, sp, m7x, inv = (D(n) for n in ("saffire_latency", "smoke_sizes", "models", "gaps", "efield", "whatif", "drift_calibration", "flame_static", "flame_spread", "m7_explorer", "investigations"))
NTRS = lambda i, path: f"https://ntrs.nasa.gov/api/citations/{i}/downloads/{path}"
SRC = dict(
    psi100=dict(label="NASA PSI-100, Saffire-III telemetry (doi 10.60555/040q-4h36)", url="https://doi.org/10.60555/040q-4h36"),
    same2=dict(label="Urban et al. 2012, SAME-2, AIAA 2012-3536 (NTRS 20130000422)", url=NTRS("20130000422", "20130000422.pdf")),
    vent=dict(label="Link and Balistreri, ICES 2015 (NTRS 20150009509), p. 10", url=NTRS("20150009509", "20150009509.pdf")),
    ices24=dict(label="Saffire VI, ICES-2024-365 (NTRS 20240002981)", url=NTRS("20240002981", "Saffire-ICES-2024-ICES-365-accepted%20final.pdf")),
    iss10=dict(label="NASA NTRS 20170002629 (ISS detection threshold)", url=NTRS("20170002629", "20170002629.pdf")),
    flex=dict(label="NASA PSI-69, FLEX (doi 10.60555/mbq8-0451)", url="https://doi.org/10.60555/mbq8-0451"),
    cfi=dict(label="NASA PSI-39, CFI (doi 10.60555/m6pj-a914)", url="https://doi.org/10.60555/m6pj-a914"),
    cfig=dict(label="NASA PSI-159, ACME CFI-G (doi 10.60555/cyt1-kh64)", url="https://doi.org/10.60555/cyt1-kh64"),
    bass2=dict(label="NASA PSI-25, BASS-II (doi 10.60555/4qc4-de67)", url="https://doi.org/10.60555/4qc4-de67"),
    bass2tm=dict(label="BASS-II summary report, NASA/TM-20210011385", url="https://ntrs.nasa.gov/citations/20210011385"),
    efield=dict(label="NASA PSI-22, ACME E-FIELD Flames (doi 10.60555/se5a-8c73)", url="https://doi.org/10.60555/se5a-8c73"),
    psi=dict(label="NASA Physical Sciences Informatics", url="https://psi.nasa.gov"),
    site=lambda page, label: dict(label=label, url=f"#/{page}"),
)
items = []
def ans(id, q, a, sources, keys, trace):
    items.append(dict(id=id, q=q, a=a, sources=sources, kind="answer", keywords=keys, trace=trace))
def refuse(id, q, a, keys, sources=None, hard=None):
    items.append(dict(id=id, q=q, a=a, sources=sources or [SRC["psi"]], kind="refusal", keywords=keys, trace=None, hard=hard or []))

# ---- detection ----
s1 = next(b for b in lat["burns"] if b["key"] == "s1"); ch = {c["key"]: c for c in s1["channels"]}
ans("saffire-latency", "How long did the smoke detector take to notice a real fire in orbit?",
    f"In Saffire-III, a real fire on an uncrewed Cygnus cargo ship, the flame radiometers responded {ch['radiometer']['alarm_s']:.0f} s after ignition of Sample 1. "
    f"The cabin smoke detector's scatter channel crossed our alarm rule after {ch['scatter']['alarm_s']:.0f} s (plus or minus {ch['scatter']['resolution_s']:.0f} s; "
    f"{ch['scatter']['alarm_s_range'][0]:.0f} s with a looser threshold). Its obscuration channel never rose. The alarm rule is ours (baseline + 5 SD), because the file holds raw counts, not the vehicle's setpoint.",
    [SRC["psi100"], SRC["site"]("detect", "Detect page, Blind Spot panel")], ["smoke", "detector", "alarm", "notice", "slow", "saffire", "latency", "orbit", "fire", "long", "time", "detect"],
    "data/saffire_latency.json burns[s1].channels[radiometer, scatter, obscuration].alarm_s")
ans("saffire-what", "What was Saffire-III?",
    "Saffire-III burned large fabric samples inside an uncrewed Cygnus cargo vehicle after it left the space station, at 30 cm/s airflow, one with the flow and one against it. "
    f"Its telemetry file has {inv['items'][0]['rows'].split(';')[-1].strip()}. NASA's summary table lists the two samples.",
    [SRC["psi100"]], ["saffire", "iii", "cygnus", "what", "experiment", "fabric"], "data/investigations.json items[saffire3]")
k = next(m for m in sizes["materials"] if m["name"] == "Kapton"); si = next(m for m in sizes["materials"] if m["name"] == "Silicone")
ans("smoke-fine", "Which materials make smoke that is hardest for a station smoke detector to see?",
    f"In NASA's SAME-2 flight experiment, Kapton made the finest smoke: geometric mean diameter {k['Dg_nm']} nm unaged. From the paper's own size spreads, "
    f"{pct(k['mass_below']['500']['unaged'])} of Kapton's smoke mass is in particles finer than 500 nm, against {pct(si['mass_below']['500']['unaged'])} for silicone. "
    "Light-scattering detectors like the station's respond weakly to particles that fine. The paper itself says the small Kapton and Teflon particles make detection challenging.",
    [SRC["same2"], SRC["site"]("detect", "Detect page, smoke miss panel")], ["smoke", "fine", "small", "particles", "material", "kapton", "teflon", "hardest", "see", "miss", "detector"],
    "data/smoke_sizes.json materials[Kapton, Silicone].Dg_nm, mass_below")
m5 = next(m for m in models["models"] if m["id"] == "smoke-miss")
ans("smoke-airflow", "Does airflow change whether the detector can see the smoke?",
    f"In 16 SAME-2 flight tests, faster air past the heated sample gave finer smoke. Our model ranks air velocity as the main driver ({pct(m5['drivers'][0]['share'])}) of whether most smoke mass falls below 500 nm. "
    f"Its score on held-out tests is AUC {m5['score']:.3f} ({m5['score_range'][0]:.2f} to {m5['score_range'][1]:.2f}), only level with knowing the material alone, so treat it as a trend, not a classifier.",
    [SRC["same2"], SRC["site"]("predict", "Predict page, smoke miss model")], ["airflow", "air", "flow", "velocity", "smoke", "size", "detector", "see", "change"],
    "data/models.json models[smoke-miss].drivers, score, score_range")
# ---- ventilation and drift ----
ans("airflow-iss", "How fast does air move inside the space station?",
    "NASA's requirement is an effective air velocity in the cabin aisleway of 4.6 to 12.2 metres per minute, about 0.08 to 0.2 metres per second. "
    "With no buoyancy, smoke and heat go wherever the ventilation carries them instead of rising.",
    [SRC["vent"]], ["air", "airflow", "fast", "ventilation", "speed", "station", "iss", "move", "cabin"], "data/whatif.json varied.airflow_m_s; NTRS 20150009509 p. 10")
L = {l["name"]: l for l in whatif["layouts"]}; ret = L["At the air return"]; ce = L["Ceiling, mid-cabin (Earth habit)"]
ans("placement", "Where should a smoke detector go in a spacecraft cabin?",
    f"In our drift model of a ventilated cabin, a detector at the air return caught {pct(ret['caught_120'])} of simulated fires within 2 minutes, and one on the ceiling {pct(ce['caught_120'])}: "
    "a small difference. Fire size mattered far more than position. At an ISS-like alarm level of 10 mg/m3 the same detectors caught "
    f"{pct(ret['caught_120_at_10mg'])} and {pct(ce['caught_120_at_10mg'])}. This is a screening model tuned on Saffire-III, not a design rule for a real module.",
    [SRC["site"]("predict", "Predict page, what-if runs"), SRC["iss10"], SRC["ices24"]], ["detector", "place", "placement", "where", "ceiling", "return", "position", "put", "cabin"],
    "data/whatif.json layouts[At the air return, Ceiling].caught_120, caught_120_at_10mg")
ans("alarm-level", "What smoke level sets off a spacecraft smoke alarm?",
    "NASA's Saffire VI paper uses 1 mg/m3 and calls it a relatively tight alarm threshold. A NASA study of smoke detection gives about 10 mg/m3 as the ISS detection threshold and 2 mg/m3 for the Space Shuttle. "
    "Our models report catch rates at both 1 and 10 mg/m3.",
    [SRC["ices24"], SRC["iss10"]], ["alarm", "level", "threshold", "mg", "concentration", "sets", "trigger", "smoke"], "data/whatif.json alarm_mg_m3, alarm_hi_mg_m3")
ans("smoke-clear", "How long does smoke take to clear from a spacecraft cabin?",
    f"Tuning our drift model on the Saffire-III smoke detector record gives a clearance time of {cal['clearance_s_range'][0]:.0f} to {cal['clearance_s_range'][1]:.0f} s "
    "(the time for ventilation and filtering to remove smoke). That range comes from one detector in one vehicle.",
    [SRC["psi100"], SRC["site"]("predict", "Predict page, flight-data check")], ["smoke", "clear", "clearance", "remove", "filter", "long", "linger"], "data/drift_calibration.json clearance_s_range")
# ---- flames ----
z = next(f for f in fs["flames"] if f["fuel"] == "n-heptane" and f["gravity"] == "0 g" and f["flow_m_s"] == 0 and f["X_O2"] == 0.21 and f["P_kPa"] == 101.3)
e = next(f for f in fs["flames"] if f["fuel"] == "n-heptane" and f["gravity"] == "Earth 1 g" and f["flow_m_s"] == 0 and f["X_O2"] == 0.21 and f["P_kPa"] == 101.3)
ans("flame-shape", "Why is a flame round in space?",
    f"Without gravity, hot gas does not rise, so fuel and oxygen meet only by diffusion, which is the same in every direction. In our flame model a heptane droplet flame in still air "
    f"has a length-to-width ratio of {z['aspect']:.1f} in orbit and {e['aspect']:.1f} at Earth gravity. The shapes follow the physics; the model's absolute sizes are 2 to 3 times too large (check S1-height, failed).",
    [SRC["site"]("flame", "Flame page, simulator")], ["flame", "round", "sphere", "spherical", "shape", "space", "gravity", "why", "ball"], "data/flame_static.json flames[n-heptane, 0 g / Earth 1 g].aspect")
st = fs["flex_K_stats"]
ans("droplet-rate", "How fast does a fuel droplet burn in microgravity?",
    f"NASA's FLEX experiment burned {st['methanol']['n']} methanol and {st['n-heptane']['n']} heptane droplets on the space station. Our d-squared-law model matches the measured burning rate "
    f"within {st['methanol']['held_out_median_abs_err_pct']:.0f}% for methanol and {st['n-heptane']['held_out_median_abs_err_pct']:.0f}% for heptane on held-out tests; for heptane a single constant rate does better ({st['n-heptane']['baseline_held_out_median_abs_err_pct']:.0f}%).",
    [SRC["flex"], SRC["site"]("flame", "Flame page, FLEX panel")], ["droplet", "burn", "rate", "fast", "fuel", "flex", "heptane", "methanol"], "data/flame_static.json flex_K_stats")
row = next(t for t in m7x["extinction"]["table"] if t["fuel"] == "heptane" and t["p_atm"] == 1.0 and t["added_gas"] == "no added gas")
rowc = next(t for t in m7x["extinction"]["table"] if t["fuel"] == "heptane" and t["p_atm"] == 1.0 and t["added_gas"] == "20% CO2")
ans("extinction-o2", "At what oxygen level does a droplet flame go out?",
    f"From NASA FLEX data, the M7 model gives a 3 mm heptane droplet at 1 atm a 50% chance of going out at {100 * row['o2_half']:.1f}% oxygen "
    f"({100 * row['o2_half_range'][0]:.1f} to {100 * row['o2_half_range'][1]:.1f}%). Replacing 20% of the nitrogen with CO2 raises that to {100 * rowc['o2_half']:.1f}%. "
    "These are model outputs for one droplet size, not flammability limits.",
    [SRC["flex"], SRC["site"]("respond", "Respond page, extinction explorer")], ["oxygen", "o2", "extinction", "out", "goes", "droplet", "level", "flame", "extinguish"], "data/m7_explorer.json extinction.table")
ans("suppressant", "Which gas is better at putting out a droplet flame, CO2 or helium?",
    f"In the M7 model built on NASA FLEX data, adding 20% CO2 or 20% helium in place of nitrogen both raise the oxygen level a flame needs, by about 2 to 3 points. "
    f"For heptane at 1 atm: {100 * row['o2_half']:.1f}% with no added gas, {100 * rowc['o2_half']:.1f}% with CO2. The raw FLEX extinction shares by gas reflect NASA's test plan, so they are not a fair comparison on their own.",
    [SRC["flex"], SRC["site"]("respond", "Respond page")], ["co2", "helium", "gas", "suppressant", "putting", "out", "better", "extinguish", "suppression", "nitrogen"], "data/m7_explorer.json extinction.table; data/flex_suppression.json")
cf = m7x["cool_flame"]
ans("cool-flame", "What is a cool flame and why is it dangerous?",
    "A cool flame is a low-temperature flame that can keep burning after the visible flame goes out. In NASA's CFI droplet tests the M7 model finds pressure the main driver of whether the cool flame burns the droplet away "
    f"(AUC {cf['headline']['auc_median']:.2f}); for a 4.3 mm n-dodecane droplet in air the 50% point is about {cf['pressure_at_half_atm']:.1f} atm. A fire that looks out may not be.",
    [SRC["cfi"], SRC["cfig"], SRC["site"]("respond", "Respond page, cool-flame panel")], ["cool", "flame", "invisible", "dangerous", "after", "out", "keeps", "burning", "low", "temperature"], "data/m7_explorer.json cool_flame")
G = {g["fuel"]: g for g in sp["bass_ii_groups"].values()} if isinstance(next(iter(sp["bass_ii_groups"].values())), dict) and "fuel" in next(iter(sp["bass_ii_groups"].values())) else sp["bass_ii_groups"]
thin = sp["bass_ii_groups"]["group: thin PMMA (100 um)"]; thick = sp["bass_ii_groups"]["group: thick PMMA (1-5 mm)"]
ans("spread", "How fast does fire spread over plastic in microgravity?",
    f"Our de Ris-based model matches NASA BASS-II spread over thin acrylic (100 micron PMMA) within {thin['median_abs_err_pct']:.0f}% (2 burns), but runs about 3 times too fast for thick acrylic "
    f"(median error {thick['median_abs_err_pct']:.0f}% over {thick['n']} readings), because thick samples in orbit never reached steady spread. BASS-II spread rates come from NASA's summary report.",
    [SRC["bass2tm"], SRC["bass2"], SRC["site"]("flame", "Flame page, spread panel")], ["spread", "fire", "plastic", "acrylic", "pmma", "fast", "solid", "bass"], "data/flame_spread.json bass_ii_groups")
mp = next(m for m in sp["flammability_maps"] if m["gravity"] == "0 g" and m["P_kPa"] == 101.3)
ans("min-oxygen", "What is the lowest oxygen level at which a thin sheet can burn in orbit?",
    f"Our flame-spread model gives {pct(mp['min_O2'])} oxygen at about {100 * mp['min_O2_flow_m_s']:.1f} cm/s airflow for thin acrylic in orbit. That is probably too low: BASS-II observed spread only down to about 16 to 17%.",
    [SRC["bass2tm"], SRC["site"]("flame", "Flame page, survival map")], ["lowest", "oxygen", "minimum", "burn", "limit", "sheet", "thin", "flammability"], "data/flame_spread.json flammability_maps[0 g, 101.3].min_O2")
# ---- gaps, efield, data ----
ans("gaps", "What has NASA not tested?",
    " ".join(v["text"] for v in gaps["verdicts"][:3]),
    [SRC["psi"], SRC["site"]("predict", "Predict page, gap map")], ["not", "tested", "gap", "gaps", "missing", "untested", "never", "data"], "data/gaps.json verdicts")
ans("efield", "Did NASA test electric fields on flames?",
    ef["finding"], [SRC["efield"], SRC["site"]("respond", "Respond page")], ["electric", "field", "ion", "wind", "voltage", "efield", "e-field"], "data/efield.json finding, totals")
ans("datasets", "Which NASA datasets does this project use?",
    "Mainly NASA Physical Sciences Informatics: Saffire-III telemetry (PSI-100), FLEX (PSI-69), CFI (PSI-39), BASS-II (PSI-25), SAME and SAME-R (PSI-102, PSI-101), Saffire-I and II (PSI-98, PSI-99), "
    "ACME E-FIELD (PSI-22), CFI-G (PSI-159) and Flame Design (PSI-10). The Investigations page lists every one with its DOI.",
    [SRC["psi"], SRC["site"]("explorer", "Investigations page")], ["datasets", "data", "nasa", "which", "use", "sources", "psi"], "data/investigations.json")
# ---- refusals ----
refuse("moon", "How fast will a fire spread on the Moon?", "No NASA evidence. The archives we use have no combustion data at lunar gravity. Microgravity and Earth results can bound the answer, but we do not predict a value in between.",
       ["moon", "lunar"], hard=["moon", "lunar"])
refuse("mars", "Would a fire behave differently on Mars?", "No NASA evidence at Martian gravity in the archives we use. Our flame model draws Mars cases only as model output between the 0 g and 1 g results, and labels them as not validated.",
       ["mars", "martian"], hard=["mars", "martian"])
refuse("safe", "Is a 34% oxygen cabin safe?", "We do not say whether any atmosphere or material is safe. The gap map shows that NASA's archives hold no solid-fuel or gas-flame tests near 34% oxygen at 70.3 kPa.",
       ["safe", "safety", "certify", "certified", "34"], hard=["safe", "certify", "certified"])
refuse("ionwind", "Does ion wind put out fires in space?", "No NASA evidence. NASA's E-FIELD experiment studied how electric fields change flames; putting flames out is not among its stated objectives, and our bench runs at Earth gravity.",
       ["ion", "wind", "put", "out", "space", "extinguish"])
out = dict(status="reported", note="Every answer is written by scripts/build_assistant.py from the data files named in its trace; the site matches questions to answers by keywords and never generates text.",
           items=items)
(ROOT / "data" / "assistant_cache.json").write_text(json.dumps(out, indent=1))

gold = [  # question, expected answer id ("refuse" = must give no evidence)
 ("how long did the smoke alarm take in saffire", "saffire-latency"), ("when did the detector notice the orbital fire", "saffire-latency"),
 ("what was the saffire 3 experiment", "saffire-what"), ("which smoke particles are too small for the detector", "smoke-fine"),
 ("is kapton smoke hard to detect", "smoke-fine"), ("does faster airflow make smoke harder to see", "smoke-airflow"),
 ("how fast is the air on the iss", "airflow-iss"), ("what is the cabin ventilation speed", "airflow-iss"),
 ("where should i put the smoke detector", "placement"), ("is the ceiling a good place for a detector in orbit", "placement"),
 ("what concentration triggers the smoke alarm", "alarm-level"), ("how long does smoke linger in the cabin", "smoke-clear"),
 ("why are flames spherical in microgravity", "flame-shape"), ("why is the flame a ball in space", "flame-shape"),
 ("how fast do heptane droplets burn", "droplet-rate"), ("what oxygen level makes a droplet flame go out", "extinction-o2"),
 ("is co2 or helium better to extinguish a flame", "suppressant"), ("what is a cool flame", "cool-flame"),
 ("how fast does flame spread over acrylic", "spread"), ("what is the minimum oxygen to burn a thin sheet", "min-oxygen"),
 ("what conditions has nasa never tested", "gaps"), ("did nasa study electric fields and flames", "efield"),
 ("which datasets do you use", "datasets"), ("how will fire spread on the moon", "refuse"), ("what about fire on mars", "refuse"),
 ("is a high oxygen cabin safe", "refuse"), ("can ion wind extinguish a fire in space", "refuse"),
 ("what is the best pizza in hyderabad", "refuse"), ("who will win the cricket match", "refuse"), ("write me a poem about rockets", "refuse"),
]
(ROOT / "data" / "assistant_gold.json").write_text(json.dumps(dict(status="team", note="Fixed test set written with the answers; the Ask page runs every question through the same matcher and reports the score.",
                                                                    items=[dict(q=q, expect=e) for q, e in gold]), indent=1))
m = json.loads((ROOT / "data/manifest.json").read_text())
if not any(f["name"] == "assistant_gold" for f in m["files"]):
    m["files"].append(dict(name="assistant_gold", status="team", owner="Assistant", what="30 test questions with known answers for the assistant scorecard"))
(ROOT / "data/manifest.json").write_text(json.dumps(m, indent=1))
print(len(items), "answers;", len(gold), "gold questions")
for it in items: print(" -", it["id"], ":", it["a"][:150])
