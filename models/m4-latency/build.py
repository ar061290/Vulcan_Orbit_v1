#!/usr/bin/env python3
"""M4 detection latency: when would each sensor on Saffire-III have alarmed, for each real orbital event?

    python models/m4-latency/build.py      # writes data/saffire_latency.json and models/m4-latency/results.json

Rules (thresholds, windows, checks) are in RULES.md and were committed before this script was run.
Stdlib + numpy only.
"""
import csv, json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SRC = "datasets/psi/PSI-100/PSI-100_Raw Data_Saffire_Data_Table2017.161.00.42.03-EU.csv"
K_HEAD, K_LOW = 5, 3
FLOOR = {"rad": 0.01, "smoke": 0.005}
RADS = [f"Radiometer{i}value" for i in range(1, 5)]
SCAT, OBS = "CDH_F2PCM_SMK_DET_SCAT_SENS_P", "CDH_F2PCM_SMK_DET_OBS_SENS_P"


def load():
    rows = list(csv.reader(open(ROOT / SRC, newline="")))
    head = [h.replace("P@", "").replace("sfsHk.", "") for h in rows[0]]
    def num(x):
        try: return float(x)
        except ValueError: return np.nan
    a = np.array([[num(x) for x in r] for r in rows[1:] if len(r) == len(head)])
    t = a[:, 0] / 1000.0                                   # RelativeSeconds is in milliseconds
    ok = (t >= 0) & (t < 1e4)                              # one corrupt row has a huge negative time
    return t[ok], a[ok], {h: i for i, h in enumerate(head)}


def series(t, a, col, name, kind):
    x = a[:, col[name]]
    m = (x > -1000) if kind == "rad" else (x != 0)        # fill values: about -4000 (radiometers), 0 (packets without the channel)
    tt, xx = t[m], x[m]
    if kind == "smoke":
        keep = np.r_[True, np.diff(tt) > 5.0]               # each smoke reading is logged twice, a few seconds apart
        tt, xx = tt[keep], xx[keep]
    return tt, xx


def on_window(t, a, col, name):
    x = a[:, col[name]]; on = np.sort(t[x > 0.3])          # current above 0.3 A = powered (off reads -0.06 or fill)
    gaps = np.where(np.diff(on) > 5.0)[0]                  # first contiguous pulse only (the smoke wire pulses again later)
    end = on[gaps[0]] if len(gaps) else on.max()
    return float(on.min()), float(end)


def update_interval(tt, xx):
    # radiometers are logged every ~1 s but the values are sample-and-hold: they only change every ~5 s
    ch = tt[1:][np.diff(xx) != 0]
    return float(np.median(np.diff(ch))) if len(ch) > 2 else float(np.median(np.diff(tt)))


def first_alarm(tt, xx, t0, t_from, t_next, k, kind):
    pre = xx[(tt > t0 - 60) & (tt < t0)]
    if len(pre) < 3: return None, None, None, None
    mu, sd = float(pre.mean()), float(max(pre.std(ddof=1), FLOOR[kind]))
    thr = mu + k * sd
    w = (tt >= t_from) & (tt < t_next); hit = tt[w][xx[w] > thr]
    return (None if not len(hit) else float(hit[0] - t0)), mu, sd, thr


def main():
    t, a, col = load()
    wire = on_window(t, a, col, "SmokeWireCurrent")
    s2 = on_window(t, a, col, "Sample2IgniterCurrent"); s1 = on_window(t, a, col, "Sample1IgniterCurrent")
    end = float(t.max())
    events = [
        dict(key="wire", name="Smoke wire: an 11 s puff of smoke, no flame", on=wire, next=s2[0]),
        dict(key="s2", name="Sample 2 burn (SIBAL fabric, opposed flow)", on=s2, next=s1[0]),
        dict(key="s1", name="Sample 1 burn (SIBAL fabric, concurrent flow)", on=s1, next=end),
    ]
    chans = [(f"radiometer{i}", f"Radiometer {i}", n, "rad") for i, n in enumerate(RADS, 1)] + \
            [("scatter", "Cabin smoke detector: scatter", SCAT, "smoke"), ("obscuration", "Cabin smoke detector: obscuration", OBS, "smoke")]
    data = {k: series(t, a, col, n, kind) for k, _, n, kind in chans}
    results, burns, checks = [], [], []
    for ev in events:
        t0, toff, tn = ev["on"][0], ev["on"][1], ev["next"]
        per = {}
        for k, label, n, kind in chans:
            tt, xx = data[k]
            hi, mu, sd, thr = first_alarm(tt, xx, t0, t0, tn, K_HEAD, kind)
            lo, *_ = first_alarm(tt, xx, t0, t0, tn, K_LOW, kind)
            after_off, *_ = first_alarm(tt, xx, t0, toff, tn, K_HEAD, kind)
            res_s = update_interval(tt, xx) if kind == "rad" else float(np.median(np.diff(tt)))
            per[k] = dict(channel=label, alarm_s=hi, alarm_s_k3=lo, alarm_after_igniter_off_s=after_off,  baseline=mu, sd=sd, threshold=thr,
                          resolution_s=round(res_s, 1), peak=float(xx[(tt >= t0) & (tt < tn)].max()))
            results.append(dict(event=ev["key"], **per[k]))
        # display series: one 'fastest radiometer' line plus the two smoke channels, each as a multiple of its own threshold excess
        span = min(tn - t0, 450.0); grid = np.arange(-20.0, span + 0.1, 2.0)
        def norm(k, kind):
            tt, xx = data[k]; p = per[k]
            v = (xx - p["baseline"]) / (p["threshold"] - p["baseline"])
            if kind == "rad": return np.interp(grid + t0, tt, v)
            idx = np.searchsorted(tt, grid + t0, side="right") - 1        # smoke: hold each 10 s reading until the next one
            return np.where(idx >= 0, v[np.clip(idx, 0, len(v) - 1)], 0.0)
        rad_keys = [f"radiometer{i}" for i in range(1, 5)]
        times = [per[k]["alarm_s"] for k in rad_keys if per[k]["alarm_s"] is not None]
        fast = min(rad_keys, key=lambda k: per[k]["alarm_s"] if per[k]["alarm_s"] is not None else 1e9)
        rad_line = np.max([norm(k, "rad") for k in rad_keys], axis=0)
        r3 = lambda v: [round(float(x), 3) for x in v]
        rnd = lambda v: None if v is None else round(v, 0)
        rng = lambda k: [rnd(per[k]["alarm_s_k3"]), rnd(per[k]["alarm_s"])]
        burns.append(dict(name=ev["name"], key=ev["key"], ignition_s=round(t0, 1), igniter_off_s=round(toff - t0, 1), window_s=round(tn - t0, 1),
            t=r3(grid),
            channels=[
                dict(key="radiometer", name="Flame radiometer (first of 4)", values=r3(rad_line), alarm_s=None if not times else round(min(times), 0),
                     alarm_s_range=None, resolution_s=per[fast]["resolution_s"],   # 3 SD is not reported for radiometers: it fails the no-flame control (check L1b)
                     per_radiometer={k: per[k]["alarm_s"] for k in rad_keys}),
                dict(key="scatter", name="Smoke detector: scatter", values=r3(norm("scatter", "smoke")), alarm_s=None if per["scatter"]["alarm_s"] is None else round(per["scatter"]["alarm_s"], 0),
                     alarm_s_range=rng("scatter"), resolution_s=per["scatter"]["resolution_s"]),
                dict(key="obscuration", name="Smoke detector: obscuration", values=r3(norm("obscuration", "smoke")), alarm_s=None if per["obscuration"]["alarm_s"] is None else round(per["obscuration"]["alarm_s"], 0),
                     alarm_s_range=rng("obscuration"), resolution_s=per["obscuration"]["resolution_s"]),
            ]))
    R = {(r["event"], k): r for r in results for k, _, n, kind in chans if r["channel"] == dict((c[0], c[1]) for c in chans)[k]}
    # ---- checks (RULES.md) ----
    wire_rad = [R[("wire", f"radiometer{i}")]["alarm_s"] for i in range(1, 5)]
    checks.append(dict(id="L1", what="Negative control: no radiometer alarm during the smoke-wire puff (smoke, no flame)",
                       result=f"radiometer alarms in the smoke-wire window: {sum(x is not None for x in wire_rad)}", ok=all(x is None for x in wire_rad)))
    wire_rad3 = [R[("wire", f"radiometer{i}")]["alarm_s_k3"] for i in range(1, 5)]
    checks.append(dict(id="L1b", what="Same negative control at the 3 SD low end (added 15 Nov after an audit)",
                       result=f"radiometer alarms in the smoke-wire window at 3 SD: {sum(x is not None for x in wire_rad3)}; so 3 SD is not reported for radiometers", ok=all(x is None for x in wire_rad3)))
    tt, xx = data["scatter"]; s1 = events[2]; flat = xx.copy(); w = (tt >= s1["on"][0] - 60) & (tt < s1["on"][0]); base = flat[w].mean(); flat[tt >= s1["on"][0]] = base
    broke, *_ = first_alarm(tt, flat, s1["on"][0], s1["on"][0], s1["next"], K_HEAD, "smoke")
    checks.append(dict(id="L2", what="The rule can fail: the Sample 1 scatter channel replaced by its own baseline",
                       result=f"alarm with flat signal: {broke}", ok=broke is None))
    diffs = [abs(r["alarm_after_igniter_off_s"] - r["alarm_s"]) for r in results if r["channel"].startswith("Radiometer") and r["alarm_s"] is not None and r["alarm_after_igniter_off_s"] is not None]
    checks.append(dict(id="L3", what="Radiometer alarms are not igniter glow: alarm counted only after the igniter switches off",
                       result=f"largest shift {max(diffs):.0f} s over {len(diffs)} radiometer alarms (limit 2 s)", ok=bool(max(diffs) <= 2)))
    checks.append(dict(id="L4", what="Every event reported on its own", result=f"{len(burns)} events, no averages", ok=len(burns) == 3))
    checks.append(dict(id="E3", what="Reproduces a published Saffire-III alarm time",
                       result="not run: no published Saffire-III smoke-detector alarm time was found (NTRS search, 14 Nov 2026)", ok=None))
    sens = "; ".join(f"{e['key']} {c['key']}: {c['alarm_s_range']}" for e in burns for c in e["channels"] if c.get("alarm_s_range"))
    checks.append(dict(id="L5", what="Threshold sensitivity, alarm time at 3 SD vs 5 SD", result=sens, ok=None))
    for c in checks: print(("PASS " if c["ok"] else "FAIL " if c["ok"] is False else "---- ") + c["id"], c["what"], "->", c["result"])
    out = dict(status="real", source="NASA PSI-100 Saffire-III flight telemetry (doi 10.60555/040q-4h36), processed by models/m4-latency/build.py",
               y_meaning="Signal above its pre-ignition baseline, as a multiple of that channel's alarm margin (1.0 = alarm at baseline + 5 SD)",
               units=dict(time="s after the event's igniter or smoke wire switched on", values="dimensionless", alarm_s_range="[alarm at 3 SD, alarm at 5 SD]"),
               threshold_rule="Alarm at the first reading above the 60 s pre-ignition mean + 5 SD (3 SD reported as the low end). Not the vehicle's real alarm setpoint: "
                              "the smoke channels are raw, uncalibrated counts, so published thresholds in physical units (ISS: 1 %/ft obscuration; about 10 mg/m3) cannot be applied.",
               resolution_note="Radiometers are logged about once a second, but their values are sample-and-hold and only change about every 5 s, so a radiometer alarm at 7 s means the signal crossed somewhere between 2 and 7 s. The smoke channels read about every 10 s, so smoke alarm times are +/- 10 s.",
               baseline_note="Each event's baseline is the 60 s just before it. Before Sample 2 and Sample 1 the cabin smoke detector still reads smoke left from the event before, which raises its baseline and spread; that is why the smoke alarm times move so much with the threshold (Sample 2: 27 s at 3 SD, 127 s at 5 SD).",
               placement_note="The radiometers look at the sample inside the flow duct; the smoke detector is in the Cygnus cabin. The comparison therefore mixes sensor type with sensor position.",
               observation="The obscuration channel never rose. During Sample 1 it fell by at most 0.02 (about 0.5 %), below the 5 SD margin; read as falling light (more obscuration), that would cross a 3 SD margin. The pass rules, written first, count only rises, so it is reported as no alarm.",
               assumption="Igniter 1 is taken as Sample 1 (concurrent) and igniter 2 as Sample 2 (opposed), following the order of the PSI-100 sample table.",
               burns=burns, checks=checks)
    (ROOT / "data" / "saffire_latency.json").write_text(json.dumps(out, separators=(",", ":")))
    (ROOT / "models" / "m4-latency" / "results.json").write_text(json.dumps(dict(per_channel=results, checks=checks), indent=1))
    for e in burns: print(e["key"], {c["key"]: (c["alarm_s"], c.get("alarm_s_range")) for c in e["channels"]}, e["channels"][0]["per_radiometer"])


if __name__ == "__main__":
    main()
