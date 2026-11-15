"""Build data/kb.json: the passages the AI assistant may quote. Every passage comes from one of the site's own data
files and keeps its source. The assistant answers only from these. Run: python scripts/build_kb.py"""
import json
from pathlib import Path
R = Path(__file__).resolve().parents[1]
J = lambda n: json.loads((R / "data" / f"{n}.json").read_text())
P = []
def add(pid, title, text, label, url, file):
    P.append(dict(id=pid, title=title, text=" ".join(str(text).split()), source=label, url=url, file=file))
for it in J("assistant_cache")["items"]:
    if it["kind"] == "answer":
        s = it["sources"][0] if it["sources"] else {"label": "", "url": ""}
        add(f"qa-{it['id']}", it["q"], it["a"], s["label"], s["url"], it.get("trace", "data/assistant_cache.json"))
for m in J("models")["models"]:
    add(f"model-{m['id']}", m["name"], f"Question: {m.get('question','')} Data: {m.get('data','')} Method: {m.get('method','')} Tested: {m.get('validation','')} "
        f"Score: {m.get('metric','')} {m.get('score')} range {m.get('score_range')}; baseline {m.get('baseline_name')} {m.get('baseline_score')}. Limits: {m.get('limits','')}",
        "Vulcan Orbit models", "#/predict", "data/models.json")
mem = J("memory")
for i, e in enumerate(mem["entries"]):
    add(f"history-{i}", f"{e['date']}: {e['title']}", f"{e['where']}. {e['text']} What changed: {e['changed']}", e["sources"][0][0], e["sources"][0][1], "data/memory.json")
gas = J("saffire_gas")
add("saffire-gas", "Saffire IV-VI cabin gas vs crew limits", gas["takeaway"] + " " + gas["alarm"]["note"] + " Tests: " + "; ".join(f"{t['test']} {t['material']}: CO +{t['co_rise']} ppm, CO2 +{t['co2_rise_mmHg']} mmHg, peak {t['peak_hrr']} W" for t in gas["tests"]), "ICES-2024-365", gas["source_url"], "data/saffire_gas.json")
ror = J("rate_of_rise"); add("rate-of-rise", "Rate-of-rise alarm test on Saffire-III", ror["result"]["text"] + " Rule: " + ror["rule"], "NASA PSI-100", "https://doi.org/10.60555/040q-4h36", "data/rate_of_rise.json")
for i, v in enumerate(J("gaps")["verdicts"]):
    add(f"gap-{i}", "What NASA has not tested", v["text"], v.get("source", ""), "#/predict", "data/gaps.json")
ind = J("india")
for i, f in enumerate(ind["facts"]):
    add(f"india-{i}", f["topic"], f"{f['text']} (verification: {f['level']})", f["source"], f["url"], "data/india.json")
inv = J("investigations"); key = [k for k, v in inv.items() if isinstance(v, list)][0]
for x in inv[key]:
    add(f"inv-{x.get('id', x.get('name'))}", x.get("name", ""), " ".join(f"{k}: {v}" for k, v in x.items() if isinstance(v, (str, int, float))), x.get("doi", "NASA PSI"), f"https://doi.org/{x['doi']}" if x.get("doi") else "#/explorer", "data/investigations.json")
d = J("drift"); add("drift-assumptions", "Smoke drift model assumptions", " ".join(d["assumptions"]), "Vulcan Orbit smoke model", "#/predict", "data/drift.json")
sp = J("spread_predictor"); add("m6b", "Flame spread predictor (M6b)", sp["what"] + " " + sp["limits"] + f" Held-out error {sp['scores']['opposed_heldout_mae_mm_s']} mm/s; range coverage {sp['scores']['opposed_nested_coverage']}.", "Vulcan Orbit M6b", "#/predict", "data/spread_predictor.json")
e = J("efield"); add("efield", "NASA E-FIELD Flames", e.get("finding", ""), "NASA PSI-22", "https://doi.org/10.60555/se5a-8c73", "data/efield.json")
out = dict(status="model", what="Passages the AI assistant may answer from; each keeps its source and the data file it came from.", passages=P)
(R / "data/kb.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
m = json.loads((R / "data/manifest.json").read_text())
if "kb" not in {f["name"] for f in m["files"]}:
    m["files"].append(dict(name="kb", status="model", owner="Dashboard", what="Assistant passages built from the site's data files")); (R / "data/manifest.json").write_text(json.dumps(m, indent=1, ensure_ascii=False))
print(len(P), "passages,", sum(len(p["text"]) for p in P) // 1000, "k chars")
