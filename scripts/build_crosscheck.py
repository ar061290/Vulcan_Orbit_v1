"""Build data/crosscheck.json: 'NASA says / we get'. Each row puts a published NASA value next to the number this site
uses or produces, with a verdict. Our side is read from the data files; NASA's side is quoted from the cited source.
Sources were read on 15 Nov 2026 (research report in this conversation). Run: python scripts/build_crosscheck.py"""
import json
from pathlib import Path
R = Path(__file__).resolve().parents[1]
J = lambda n: json.loads((R / "data" / f"{n}.json").read_text())
sm = {m["name"]: m for m in J("smoke_sizes")["materials"]}; sens = J("latency_sensitivity"); x = J("m7_explorer"); mo = {m["id"]: m for m in J("models")["models"]}
ICES21 = ("Urban et al., ICES-2021-266, Table 2", "https://ntrs.nasa.gov/api/citations/20210011521/downloads/ICES%202021-266%200503-2021%20final.pdf")
def s1(ch, k): return next(r[f"k{k}"] for r in sens["rows"] if r["event"].startswith("Sample 1") and r["channel"].startswith(ch))
def s2(ch, k): return next(r[f"k{k}"] for r in sens["rows"] if r["event"].startswith("Sample 2") and r["channel"].startswith(ch))
rows = [
 dict(topic="Saffire-III airflow in the flow duct", nasa="25 cm/s as flown (21% O2, 100 kPa)", ours="NASA's PSI-100 record says 30 cm/s, which we used to quote. We now show both. Our smoke model (M3) models the cargo ship's cabin, not the duct, so this number does not enter it.",
      verdict="Conflict between NASA sources: shown, not hidden", sources=[ICES21, ("PSI-100 record (30 cm/s, likely the planned value)", "https://doi.org/10.60555/040q-4h36")]),
 dict(topic="How sure are the alarm times? (threshold choice)", nasa="NASA published no alarm times for Saffire-III, so there is nothing to match.",
      ours=f"Changing our rule from 4 to 6 standard deviations leaves the flame sensor at {s1('Flame', 4):g} s in both burns and moves the smoke detector between {min(s1('Smoke detector: scatter', 4), s2('Smoke detector: scatter', 4)):g} and {max(s1('Smoke detector: scatter', 6), s2('Smoke detector: scatter', 6)):g} s. Smoke readings come every ~10 s, so smoke times are +/- 10 s.",
      verdict="Robust to the threshold (except the loosest, 3 SD)", sources=[("data/latency_sensitivity.json, models/m4-latency/sensitivity.py", "#/detect")]),
 dict(topic="Does the station's smoke detector miss fine smoke?", nasa="The ISS smoke detector frequently failed to detect the smaller smoke particles from Teflon and Kapton (NIST summary of Meyer et al. 2018; the paper's exact fractions were not checked by us).",
      ours=f"Our size-based view agrees in direction: Kapton and Teflon make the finest smoke ({sm['Kapton']['Dg_nm']} and {sm['Teflon']['Dg_nm']} nm geometric mean diameter).", verdict="Consistent",
      sources=[("Meyer et al., Fire Safety Journal 98:74-81 (2018)", "https://doi.org/10.1016/j.firesaf.2018.04.004")]),
 dict(topic="Smoke particle sizes we use", nasa="Kapton unaged average size 0.042 µm; Teflon 0.081 µm (Table 1)", ours=f"Kapton {sm['Kapton']['Dg_nm']} nm; Teflon {sm['Teflon']['Dg_nm']} nm", verdict="Match",
      sources=[("Urban et al., AIAA 2012-3536, Table 1", "https://ntrs.nasa.gov/api/citations/20130000422/downloads/20130000422.pdf")]),
 dict(topic="Textbook flame-spread formula on BASS-II slabs", nasa="BASS-II measured spread rates over thin and thick acrylic slabs (summary report, Table 5.1).",
      ours="The plain de Ris formula over-predicts them: median 3.5-fold, geometric mean 4.4-fold (M6). M6b calibrates it, but a simple lookup by thickness and sides burning does as well or better (see the baselines on the model cards).", verdict="Our check, with a caveat",
      sources=[("Olson et al., BASS-II Summary Report, NASA/TM-20210011385", "https://ntrs.nasa.gov/citations/20210011385")]),
 dict(topic="Lowest oxygen for flame spread over acrylic", nasa="Steady spread seen at 13.6% O2 on rods in BASS-II; opposed spread not seen below 16.4% O2 in other tests.",
      ours="M6b's calibrated cells for acrylic slabs start at 18% O2 (1 mm: 18-19%; 5 mm: 18-22%); anything lower is labelled outside NASA's data.", verdict="Consistent: low-oxygen cells are not claimed",
      sources=[("NASA NTRS 20160000593", "https://ntrs.nasa.gov/api/citations/20160000593/downloads/20160000593.pdf?attachment=true")]),
 dict(topic="Lowest oxygen for droplet burning (FLEX)", nasa="About 12% O2 for methanol and 15% for heptane (in nitrogen).",
      ours=f"At 12% O2 our model gives at least a {100 * min(r['p_out_at_12'] for r in x['extinction']['table']):.1f}% chance the flame goes out early for every case in its table. Its 50% point (about {round(100 * min(r['o2_half'] for r in x['extinction']['table']))}-{round(100 * max(r['o2_half'] for r in x['extinction']['table']))}% O2) is higher because it predicts going out before the fuel is used up, a stricter question than whether it burns at all.",
      verdict="Consistent", sources=[("Dietrich et al. 2014, Microgravity Sci. Technol. 26:65-76", "https://link.springer.com/article/10.1007/s12217-014-9372-2"), ("Nayagam et al., NTRS 20130014061", "https://ntrs.nasa.gov/citations/20130014061")]),
 dict(topic="When cool flames appear", nasa="In CFI-G, cool diffusion flames of gas fuels were seen only in the 2 bar tests, not at lower pressure.",
      ours=f"Our cool-flame model's 50% point is at {x['cool_flame']['pressure_at_half_atm']} atm, and a pressure-only rule (AUC 0.78) almost matches it (0.82): pressure is the main gate.",
      verdict="Consistent; our model does not yet beat pressure gating", sources=[("Kim et al., Proc. Combust. Inst. 39 (2023)", "https://www.sciencedirect.com/science/article/abs/pii/S1540748922000414")]),
 dict(topic="Smoke alarm after the gas (Saffire VI)", nasa="Far-field smoke monitor reached 1 mg/m³ at 981 s, after much of the hazardous gas had been released. No time zero is given.",
      ours="We quote it as reported and do not turn it into a delay. It is a different vehicle and threshold from our Saffire-III times.", verdict="Reported, not compared",
      sources=[("Urban et al., ICES-2024-365", "https://ntrs.nasa.gov/citations/20240002981")]),
]
out = dict(status="reported", checked="2026-11-15", what="NASA says / we get: published NASA values next to the numbers this site uses or produces.", rows=rows)
(R / "data/crosscheck.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
m = json.loads((R / "data/manifest.json").read_text()); names = {f["name"] for f in m["files"]}
for n, st, w in [("crosscheck", "reported", "NASA says / we get comparison table"), ("latency_sensitivity", "real", "M4 alarm times for thresholds of 3-6 SD")]:
    if n not in names: m["files"].append(dict(name=n, status=st, owner="Dashboard" if n == "crosscheck" else "M4", what=w))
(R / "data/manifest.json").write_text(json.dumps(m, indent=1, ensure_ascii=False))
for r in rows: print("-", r["topic"], "|", r["verdict"], "|", r["ours"][:110])
