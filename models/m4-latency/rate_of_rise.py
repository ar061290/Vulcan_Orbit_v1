"""Rate-of-rise alarm on the Saffire-III smoke channels, compared with M4's fixed-level alarm.
Rules: models/m4-latency/RULES.md, section "Extension: rate-of-rise alarm" (committed before this ran).
Run: python models/m4-latency/rate_of_rise.py  -> data/rate_of_rise.json"""
import json, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build as M4

LAG, BASE, K, K_LOW = 30.0, 300.0, 5, 3
FLOOR = M4.FLOOR["smoke"] / LAG

def rates(tt, xx):
    out_t, out_r = [], []
    for i, t in enumerate(tt):
        j = np.flatnonzero(tt <= t - LAG)
        if len(j): k = j[-1]; out_t.append(t); out_r.append((xx[i] - xx[k]) / (t - tt[k]))
    return np.array(out_t), np.array(out_r)

def first_cross(rt, rr, t0, t_next, k):
    pre = rr[(rt > t0 - BASE) & (rt < t0)]
    if len(pre) < 8: return "not enough baseline", None
    mu, sd = float(pre.mean()), float(max(pre.std(ddof=1), FLOOR)); thr = mu + k * sd
    w = (rt >= t0) & (rt < t_next); hit = rt[w][rr[w] > thr]
    return (None if not len(hit) else float(hit[0] - t0)), dict(mean=mu, sd=sd, threshold=thr)

def main():
    t, a, col = M4.load()
    wire = M4.on_window(t, a, col, "SmokeWireCurrent"); wire = (wire[0], min(wire[1], 5700.0))
    s2 = M4.on_window(t, a, col, "Sample2IgniterCurrent"); s1 = M4.on_window(t, a, col, "Sample1IgniterCurrent"); end = float(t.max())
    events = [("wire", "Smoke wire: an 11 s puff of smoke, no flame", wire[0], s2[0]), ("s2", "Sample 2 burn (SIBAL fabric, opposed flow)", s2[0], s1[0]),
              ("s1", "Sample 1 burn (SIBAL fabric, concurrent flow)", s1[0], end)]
    fixed = json.load(open(M4.ROOT / "data/saffire_latency.json"))
    fixed_by = {b["name"]: {c["name"]: c["alarm_s"] for c in b["channels"]} for b in fixed["burns"]}
    out_events, quiet = [], []
    for key, name, label in [("scatter", M4.SCAT, "Smoke detector: scatter"), ("obscuration", M4.OBS, "Smoke detector: obscuration")]:
        tt, xx = M4.series(t, a, col, name, "smoke"); rt, rr = rates(tt, xx)
        for ek, en, t0, tn in events:
            hi, info = first_cross(rt, rr, t0, tn, K); lo, _ = first_cross(rt, rr, t0, tn, K_LOW)
            out_events.append(dict(event=en, channel=label, rate_alarm_s=hi, rate_alarm_s_k3=lo, fixed_alarm_s=fixed_by.get(en, {}).get(label), baseline=info))
        # quiet stretches: more than 120 s before any event start and not within 600 s after one
        starts = [e[2] for e in events]
        quiet_mask = np.array([all(not (s - 120 <= x <= s + 600) for s in starts) and x < max(starts) + 600 for x in rt])
        qt = rt[quiet_mask]; qr = rr[quiet_mask]
        pre = rr[(rt > starts[0] - BASE) & (rt < starts[0] - 120)]
        mu, sd = (float(pre.mean()), float(max(pre.std(ddof=1), FLOOR))) if len(pre) >= 8 else (float(qr.mean()), float(max(qr.std(ddof=1), FLOOR)))
        quiet.append(dict(channel=label, quiet_readings=int(len(qt)), false_alarms=int((qr > mu + K * sd).sum()), threshold_from="300 s before the first event"))
    sc = [e for e in out_events if e["channel"] == "Smoke detector: scatter"]
    earlier = sum(1 for e in sc if isinstance(e["rate_alarm_s"], (int, float)) and (e["fixed_alarm_s"] is None or e["rate_alarm_s"] < e["fixed_alarm_s"]))
    fa = sum(q["false_alarms"] for q in quiet)
    passed = earlier >= 2 and fa == 0
    out = dict(status="real", source=f"NASA Saffire-III flight telemetry, PSI-100 (doi 10.60555/040q-4h36), file {M4.SRC}",
               rule="Rise rate over 30 s; alarm when it exceeds the 300 s pre-event mean + 5 SD of rise rates (3 SD as low end). Ours, not a NASA setting.",
               units=dict(time="s after the event's igniter or smoke wire switched on"), events=out_events, quiet=quiet,
               result=dict(scatter_events_earlier=earlier, false_alarms=fa, passed=passed,
                           text=("Pass" if passed else "Fail") + f": rate-of-rise was earlier than the fixed level in {earlier} of 3 events on the scatter channel, with {fa} false alarms in quiet stretches."))
    (M4.ROOT / "data/rate_of_rise.json").write_text(json.dumps(out, indent=1))
    for e in out_events: print(f"{e['channel'][-11:]:12s} {e['event'][:28]:28s} rate {e['rate_alarm_s']} (k3 {e['rate_alarm_s_k3']})  fixed {e['fixed_alarm_s']}")
    print(quiet); print(out["result"]["text"])

if __name__ == "__main__":
    main()
