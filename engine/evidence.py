"""Copy the drift model's checks into data/evidence.json so the Evidence page shows them, passes and failures alike."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REF = {"V7": "NASA PSI-100 Saffire-III flight telemetry", "V8": "NASA PSI-100 Saffire-III flight telemetry (held out)", "R1": "engine/drift.py, three cabin layouts"}


def write(checks):
    p = ROOT / "data" / "evidence.json"; ev = json.loads(p.read_text())
    ev["checks"] = [c for c in ev["checks"] if not (c["id"][:1] in "DVR" and c["id"][1:].isdigit())]
    for c in checks:
        ev["checks"].append(dict(id=c["id"], what="Drift model: " + c["what"], ref=REF.get(c["id"], "engine/drift.py, run on build"), limit=c["limit"],
                                 owner="Karthikeya", result=("Pass: " if c["ok"] else "Fail: ") + str(c["value"]), state="pass" if c["ok"] else "fail"))
    p.write_text(json.dumps(ev, indent=1))


if __name__ == "__main__":
    write(json.loads((ROOT / "data" / "whatif.json").read_text())["checks"])
