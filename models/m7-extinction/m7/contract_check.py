"""Exact-shape checks for M7's outputs against CONTRACT.md, plus a self-test that a broken file fails.

CONTRACT.md rows checked:
  models.json           {status, models:[{id, name, question, data, method, validation, metric, score,
                         score_range:[lo,hi], baseline_name, baseline_score, unit,
                         points:[{obs,pred,lo,hi,label}], drivers:[{name,share}], limits}]}
  flex_suppression.json {status, source, groups:[{gas, tests, extinguished}]}
"""
import copy
import math

STATUSES = {"real", "dome", "model", "reported", "demo", "plan", "team"}
MODEL_KEYS = ["id", "name", "question", "data", "method", "validation", "metric", "score", "score_range",
              "baseline_name", "baseline_score", "unit", "points", "drivers", "limits"]
POINT_KEYS = ["obs", "pred", "lo", "hi", "label"]


class ContractError(AssertionError):
    pass


def _req(cond, msg):
    if not cond:
        raise ContractError(msg)


def _num(v, where):
    _req(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v), f"{where}: not a finite number ({v!r})")


def _keys(d, keys, where):
    _req(isinstance(d, dict), f"{where}: not an object")
    _req(set(d) == set(keys), f"{where}: keys {sorted(d)} != contract {sorted(keys)}")


def check_models(doc, only_ids=None):
    _keys(doc, ["status", "models"], "models.json")
    _req(doc["status"] in STATUSES, f"models.json: bad status {doc['status']!r}")
    _req(isinstance(doc["models"], list) and doc["models"], "models.json: models must be a non-empty list")
    ids = [m.get("id") for m in doc["models"]]
    _req(len(ids) == len(set(ids)), "models.json: duplicate ids")
    for m in doc["models"]:
        if only_ids and m.get("id") not in only_ids:
            continue
        w = f"models.json[{m.get('id')}]"
        _keys(m, MODEL_KEYS, w)
        for k in ("id", "name", "question", "data", "method", "validation", "metric", "baseline_name", "unit", "limits"):
            _req(isinstance(m[k], str) and m[k].strip(), f"{w}.{k}: must be a non-empty string")
        _num(m["score"], f"{w}.score")
        _num(m["baseline_score"], f"{w}.baseline_score")
        _req(isinstance(m["score_range"], list) and len(m["score_range"]) == 2, f"{w}.score_range: must be [lo, hi]")
        for v in m["score_range"]:
            _num(v, f"{w}.score_range")
        _req(m["score_range"][0] <= m["score_range"][1], f"{w}.score_range: lo > hi")
        _req(isinstance(m["points"], list) and m["points"], f"{w}.points: must be a non-empty list")
        for i, p in enumerate(m["points"]):
            _keys(p, POINT_KEYS, f"{w}.points[{i}]")
            for k in ("obs", "pred", "lo", "hi"):
                _num(p[k], f"{w}.points[{i}].{k}")
            _req(p["lo"] <= p["pred"] <= p["hi"], f"{w}.points[{i}]: pred outside [lo, hi]")
            _req(isinstance(p["label"], str), f"{w}.points[{i}].label: must be a string")
        _req(isinstance(m["drivers"], list) and m["drivers"], f"{w}.drivers: must be a non-empty list")
        for i, d in enumerate(m["drivers"]):
            _keys(d, ["name", "share"], f"{w}.drivers[{i}]")
            _num(d["share"], f"{w}.drivers[{i}].share")
            _req(0 <= d["share"] <= 1, f"{w}.drivers[{i}].share outside 0-1")
        _req(abs(sum(d["share"] for d in m["drivers"]) - 1) < 0.01, f"{w}.drivers: shares do not sum to 1")


def check_suppression(doc):
    _keys(doc, ["status", "source", "groups"], "flex_suppression.json")
    _req(doc["status"] in STATUSES, "flex_suppression.json: bad status")
    _req(isinstance(doc["source"], str) and doc["source"].strip(), "flex_suppression.json: source must be a string")
    _req(isinstance(doc["groups"], list) and doc["groups"], "flex_suppression.json: groups must be a non-empty list")
    for i, g in enumerate(doc["groups"]):
        _keys(g, ["gas", "tests", "extinguished"], f"flex_suppression.json.groups[{i}]")
        _req(isinstance(g["gas"], str), f"groups[{i}].gas: must be a string")
        for k in ("tests", "extinguished"):
            _req(isinstance(g[k], int) and not isinstance(g[k], bool) and g[k] >= 0, f"groups[{i}].{k}: must be a count")
        _req(g["extinguished"] <= g["tests"], f"groups[{i}]: more extinguished than tests")


def selftest(models_doc, supp_doc, m7_ids):
    """Break each file on purpose; the checks must reject every broken copy."""
    breaks = [
        ("models: extra key", lambda d: d["models"][0].update(extra=1), "m"),
        ("models: missing drivers", lambda d: d["models"][0].pop("drivers"), "m"),
        ("models: NaN score", lambda d: d["models"][0].update(score=float("nan")), "m"),
        ("models: pred outside range", lambda d: d["models"][0]["points"][0].update(lo=2.0, hi=3.0), "m"),
        ("models: shares not summing to 1", lambda d: d["models"][0]["drivers"][0].update(share=5.0), "m"),
        ("models: bad status", lambda d: d.update(status="final"), "m"),
        ("suppression: extra key", lambda d: d.update(note="x"), "s"),
        ("suppression: count as text", lambda d: d["groups"][0].update(tests="40"), "s"),
        ("suppression: more extinguished than tests", lambda d: d["groups"][0].update(extinguished=10 ** 6), "s"),
    ]
    caught = []
    for name, mutate, which in breaks:
        doc = copy.deepcopy(models_doc if which == "m" else supp_doc)
        if which == "m":
            doc["models"] = [m for m in doc["models"] if m["id"] in m7_ids]
        mutate(doc)
        try:
            check_models(doc) if which == "m" else check_suppression(doc)
        except ContractError:
            caught.append(name)
            continue
        raise AssertionError(f"self-test: the broken copy '{name}' was NOT rejected")
    return caught
