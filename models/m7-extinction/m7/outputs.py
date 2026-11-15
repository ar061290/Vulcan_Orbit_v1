"""Write M7's files in data/ in the CONTRACT.md shapes, merging shared files instead of overwriting them."""
import json
from pathlib import Path

from . import load

DATA = load.ROOT / "data"
MODELS_JSON = DATA / "models.json"
SUPPRESSION_JSON = DATA / "flex_suppression.json"
MANIFEST_JSON = DATA / "manifest.json"
M7_IDS = ("m7-extinction", "m7-burning-rate", "m7-cool-flame")


def dumps(obj) -> str:
    """Same style as the existing data files: indent 1, UTF-8, LF, no trailing newline."""
    return json.dumps(obj, indent=1, ensure_ascii=False)


def write(path: Path, obj) -> None:
    path.write_bytes(dumps(obj).encode("utf-8"))


def suppression(flex) -> dict:
    """R4: counts of FLEX burns and 'Extinction' outcomes by added gas (all burns after de-duplication)."""
    groups = []
    for gas, label in (("N2 only", "None (O2/N2 only)"), ("CO2", "CO2"), ("He", "He")):
        g = flex[flex["diluent"] == gas]
        groups.append({"gas": label, "tests": int(len(g)), "extinguished": int((g["test_end"] == "Extinction").sum())})
    return {
        "status": "real",
        "source": ("NASA FLEX experimental table, PSI-69 (doi:10.60555/mbq8-0451), all burns. A burn counts as "
                   "extinguished when NASA's 'Test end' is 'Extinction'. FLEX chose near-limit conditions on purpose, "
                   "so these shares reflect the test plan and are not a controlled comparison of the gases."),
        "groups": groups,
    }


def models_dumps(obj) -> str:
    """data/models.json is shared with M5, whose builder reads it without naming an encoding: keep it pure ASCII
    (unicode escapes), indent 1, no trailing newline, as on main."""
    return json.dumps(obj, indent=1)


def merge_models(entries: list) -> dict:
    """Replace only the M7 entries in data/models.json, in place; keep every other feature's entries, their order and any
    extra top-level keys (main's 'note' and 'source').

    File status: 'real' (all entries NASA-derived) or, as on main since M5 joined, 'model' with a status on every entry.
    In the second case each M7 entry carries "status": "model" (predictions and scores; corrected 15 Nov 2026 from "real" after an audit)."""
    if MODELS_JSON.exists():
        doc = json.loads(MODELS_JSON.read_bytes().decode("utf-8"))
    else:
        doc = {"status": "real", "models": []}
    status = doc.get("status", "real")
    if status not in ("real", "model"):
        raise SystemExit(f"data/models.json has status '{status}'; expected 'real' or 'model' with per-entry status. "
                         "Agree the file status with the team before merging.")
    per_entry = status != "real" or any("status" in m for m in doc.get("models", []))
    if per_entry:
        entries = [{**{k: v for k, v in e.items() if k != "status"}, "status": "model"} for e in entries]   # last, as on main
    new = {e["id"]: e for e in entries}
    models, seen = [], set()
    for m in doc.get("models", []):
        if m.get("id") in M7_IDS:
            if m["id"] in new and m["id"] not in seen:
                models.append(new[m["id"]])
                seen.add(m["id"])
        else:
            models.append(m)
    models += [e for e in entries if e["id"] not in seen]
    return {**doc, "status": status, "models": models}


def remove_m7_outputs() -> None:
    """--clean: delete flex_suppression.json and only the M7 entries of models.json."""
    if SUPPRESSION_JSON.exists():
        SUPPRESSION_JSON.unlink()
    if MODELS_JSON.exists():
        doc = json.loads(MODELS_JSON.read_bytes().decode("utf-8"))
        rest = [m for m in doc.get("models", []) if m.get("id") not in M7_IDS]
        if rest:
            MODELS_JSON.write_bytes(models_dumps({**doc, "models": rest}).encode("utf-8"))
        else:
            MODELS_JSON.unlink()


def update_manifest() -> None:
    """Set the manifest lines M7 owns: 'flex_suppression' to 'real'; 'models' to the file status of data/models.json
    ('real', or 'model' once it also holds M5's model-status entry)."""
    doc = json.loads(MANIFEST_JSON.read_bytes().decode("utf-8"))
    names = {f["name"] for f in doc["files"]}
    assert {"models", "flex_suppression"} <= names, "manifest lines for models/flex_suppression are missing"
    models_status = "real"
    if MODELS_JSON.exists():
        models_status = json.loads(MODELS_JSON.read_bytes().decode("utf-8")).get("status", "real")
    for f in doc["files"]:
        if f["name"] == "flex_suppression":
            f["status"] = "real"
        elif f["name"] == "models":
            f["status"] = models_status
    write(MANIFEST_JSON, doc)
