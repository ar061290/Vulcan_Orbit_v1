"""How much do M4's alarm times depend on the threshold? Same rule as build.py (pre-ignition 60 s mean + k SD), k = 3..6.
t = 0 is when the event's igniter (or smoke wire) current switches on in the telemetry. Radiometers are logged about once a second but only
change about every 5 s (sample-and-hold); the smoke channels about every 10 s, so smoke times are +/- 10 s. Run: python models/m4-latency/sensitivity.py"""
import json, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build as M4
KS = [3, 4, 5, 6]
t, a, col = M4.load()
wire = M4.on_window(t, a, col, "SmokeWireCurrent"); wire = (wire[0], min(wire[1], 5700.0))
s2 = M4.on_window(t, a, col, "Sample2IgniterCurrent"); s1 = M4.on_window(t, a, col, "Sample1IgniterCurrent"); end = float(t.max())
events = [("Smoke wire puff", wire[0], s2[0]), ("Sample 2 burn (opposed)", s2[0], s1[0]), ("Sample 1 burn (concurrent)", s1[0], end)]
chans = [("Flame radiometers (first of 4)", [(n, "rad") for n in M4.RADS]), ("Smoke detector: scatter", [(M4.SCAT, "smoke")]), ("Smoke detector: obscuration", [(M4.OBS, "smoke")])]
rows = []
for en, t0, tn in events:
    for label, srcs in chans:
        r = dict(event=en, channel=label)
        for k in KS:
            times = []
            for n, kind in srcs:
                tt, xx = M4.series(t, a, col, n, kind); hit, *_ = M4.first_alarm(tt, xx, t0, t0, tn, k, kind)
                if hit is not None: times.append(hit)
            r[f"k{k}"] = None if not times else round(min(times), 1)
        rows.append(r)
out = dict(status="real", source="NASA PSI-100 Saffire-III telemetry (doi 10.60555/040q-4h36); rule as in models/m4-latency/build.py",
           units=dict(time="s after the event's igniter or smoke wire current switches on"),
           t0="Igniter (or smoke-wire) current onset in the telemetry", resolution="radiometers ~1 s; smoke channels ~10 s (+/- 10 s)",
           ks=KS, rows=rows)
(M4.ROOT / "data/latency_sensitivity.json").write_text(json.dumps(out, indent=1))
for r in rows: print(f"{r['event'][:26]:26s} {r['channel'][:30]:30s}", [r[f'k{k}'] for k in KS])
