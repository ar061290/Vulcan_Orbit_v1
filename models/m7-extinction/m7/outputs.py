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


def merge_models(entries: list) -> dict:
    """Replace only the M7 entries in data/models.json; keep every other feature's entries and order."""
    if MODELS_JSON.exists():
        doc = json.loads(MODELS_JSON.read_bytes().decode("utf-8"))
        others = [m for m in doc.get("models", []) if m.get("id") not in M7_IDS]
        status = doc.get("status", "real")
    else:
        others, status = [], "real"
    if status != "real":
        raise SystemExit(f"data/models.json has status '{status}'; M7 entries are NASA-derived ('real'). "
                         "Agree the file status with the team before merging.")
    return {"status": "real", "models": others + entries}


def remove_m7_outputs() -> None:
    """--clean: delete flex_suppression.json and only the M7 entries of models.json."""
    if SUPPRESSION_JSON.exists():
        SUPPRESSION_JSON.unlink()
    if MODELS_JSON.exists():
        doc = json.loads(MODELS_JSON.read_bytes().decode("utf-8"))
        rest = [m for m in doc.get("models", []) if m.get("id") not in M7_IDS]
        if rest:
            write(MODELS_JSON, {**doc, "models": rest})
        else:
            MODELS_JSON.unlink()


def update_manifest() -> None:
    """Set the manifest lines M7 owns ('models', 'flex_suppression') to 'real'."""
    doc = json.loads(MANIFEST_JSON.read_bytes().decode("utf-8"))
    names = {f["name"] for f in doc["files"]}
    assert {"models", "flex_suppression"} <= names, "manifest lines for models/flex_suppression are missing"
    for f in doc["files"]:
        if f["name"] in ("models", "flex_suppression"):
            f["status"] = "real"
    write(MANIFEST_JSON, doc)
