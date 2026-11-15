"""Drop this file into the FIRE-LOCALIZATION-AND-VOLUME-ESTIMATION repo and call export_cv_latest() after each detection.

It writes the ONE file the Vulcan Orbit site reads, data/cv_latest.json, in the exact shape the site's
store.applyFlameState() accepts (site/CONTRACT_PROPOSAL.md section 2). Pure standard library.

    from cv_export import export_cv_latest
    export_cv_latest("cv_latest.json",
                     frame_time_s=12.4, flame_type="surface",
                     area_cm2=6.2, centroid_cm=[3.1, 2.4], bbox_cm=[1.8, 1.2, 4.4, 3.6],
                     confidence=0.91,                       # this frame's detection score, 0..1
                     fuel_source="PMMA",                    # optional
                     flame_volume_cm3=14.0,                 # optional, from the depth model
                     distance_from_sensor_cm=38.5,          # optional, from the depth model
                     smoke_flow=dict(speed_mm_s=42.0, direction_deg=90.0, frame_time_s=12.4),  # optional, optical flow
                     status="dome")                         # "dome" = measured on the rig; "model" = model run on recorded video

Coordinates are FUEL coordinates in cm: x along the fuel's length, y across its width, origin at a fuel corner.
Convert from pixels with your calibration before calling this. Never pass a made-up number: leave optional fields out.
"""
import json
import math
import pathlib


def _num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def validate(d):
    """Same rules as the site's js/store.js applyFlameState(). Returns a list of problems (empty = OK)."""
    e = []
    if d.get("coordinates") != "fuel": e.append('coordinates must be "fuel"')
    if d.get("flame_type") not in ("surface", "droplet"): e.append('flame_type must be "surface" or "droplet"')
    if d.get("status") not in ("dome", "model"): e.append('status must be "dome" or "model"')
    if not _num(d.get("frame_time_s")): e.append("frame_time_s must be a number (s)")
    c = d.get("confidence")
    if c is not None and not (_num(c) and 0 <= c <= 1): e.append("confidence must be 0..1 or null")
    if d.get("flame_type") == "droplet":
        if not (isinstance(d.get("droplet"), dict) and _num(d["droplet"].get("diameter_mm")) and d["droplet"]["diameter_mm"] > 0):
            e.append('droplet flame needs droplet: {"diameter_mm": > 0}')
    elif d.get("flame_type") == "surface":
        if not (_num(d.get("area_cm2")) and d["area_cm2"] > 0): e.append("area_cm2 must be > 0")
        cc = d.get("centroid_cm")
        if not (isinstance(cc, list) and len(cc) == 2 and all(map(_num, cc))): e.append("centroid_cm must be [x, y] in cm")
        b = d.get("bbox_cm")
        if b is not None:
            if not (isinstance(b, list) and len(b) == 4 and all(map(_num, b))): e.append("bbox_cm must be [x0, y0, x1, y1] or null")
            elif b[0] > b[2] or b[1] > b[3]: e.append("bbox_cm needs x0 <= x1 and y0 <= y1")
        if d.get("droplet") is not None: e.append("droplet must be null for a surface flame")
    for k in ("flame_volume_cm3", "distance_from_sensor_cm"):
        if d.get(k) is not None and not _num(d[k]): e.append(f"{k} must be a number or null")
    sf = d.get("smoke_flow")
    if sf is not None:
        if not (isinstance(sf, dict) and _num(sf.get("speed_mm_s")) and _num(sf.get("direction_deg"))):
            e.append("smoke_flow needs speed_mm_s and direction_deg numbers")
    return e


def export_cv_latest(path, *, frame_time_s, flame_type, status="dome", area_cm2=None, centroid_cm=None, bbox_cm=None,
                     confidence=None, diameter_mm=None, fuel_source=None, flame_volume_cm3=None,
                     distance_from_sensor_cm=None, smoke_flow=None):
    d = {"status": status, "units": {"length": "cm", "area": "cm2", "volume": "cm3", "time": "s", "speed": "mm/s", "angle": "deg"},
         "coordinates": "fuel", "frame_time_s": frame_time_s, "flame_type": flame_type, "confidence": confidence}
    if flame_type == "surface":
        d.update(area_cm2=area_cm2, centroid_cm=list(centroid_cm) if centroid_cm else None,
                 bbox_cm=list(bbox_cm) if bbox_cm else None, droplet=None)
    else:
        d["droplet"] = {"diameter_mm": diameter_mm}
    for k, v in (("fuel_source", fuel_source), ("flame_volume_cm3", flame_volume_cm3), ("distance_from_sensor_cm", distance_from_sensor_cm)):
        if v is not None: d[k] = v
    if smoke_flow is not None:
        d["smoke_flow"] = {**smoke_flow, "frame_time_s": smoke_flow.get("frame_time_s", frame_time_s), "status": smoke_flow.get("status", status)}
    problems = validate(d)
    if problems:
        raise ValueError("cv_latest.json would be rejected by the site: " + "; ".join(problems))
    pathlib.Path(path).write_text(json.dumps(d, indent=1))
    return d
