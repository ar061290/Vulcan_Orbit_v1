# Dome check (gravity on)

**Status: not run, because there is no dome data.** `data/manifest.json` lists every `dome_*` file as "missing", and no dome
heat readings exist in `data/` or `datasets/` (checked 14 Nov 2026). The script is ready: `dome_check.py` runs the comparison
as soon as `data/dome_heat.json` exists. `build.py` calls it on every rebuild.

## What the check does

The same LBM code as the cabin runs (D2Q9, BGK, `lbm.py`) is used with gravity on: a Boussinesq body force
`F = g * beta * (T - T_amb)` acting upward, with `beta = 1/T_amb`. Temperature is a second scalar on the same velocity field,
solved by the same finite-volume code as the smoke. A small heater adds heat each step. Real air properties come from Cantera
(gri30 mixture-averaged transport, dry air at 293.15 K and 101.325 kPa). The time step is set so that tau = 0.55.

This is a **2D** model of a 3D bench. It can test whether the code puts warm air in the right places (the ordering of the
sensors and the size of the rise, within a factor of 2). It cannot test microgravity behaviour. The dome runs at Earth gravity
only (AGENTS.md).

## The measurement to compare with

Pass rule D-dome (in `RULES.md`, fixed before any run): temperature rise at every sensor within a factor of 2 of the
measured rise, and the sensors in the same order from warmest to coolest.

The dome team (M1 lane) needs to record one steady heater run:

| Item | What to record | Unit |
|---|---|---|
| Geometry | inside width and height of the dome section through the heater and the sensors; depth at right angles to that section | m |
| Heater | position (x, y) in that section; size; electrical power **measured** (V x I), not the nominal rating | m, W |
| Sensors | position (x, y) of each thermopile or thermistor in the same section; which way it faces | m |
| Readings | ambient temperature before switch-on; temperature at each sensor after it stops changing (or at a stated time) | K or °C |
| Timing | time from switch-on to the reading; logging interval | s |
| Repeats | at least 3 runs (AGENTS.md M2 rule), so the measured rise has a spread | |

Only sensors that lie in (or close to) one vertical plane through the heater can be compared with a 2D model. Say which ones.

## File the script reads

`data/dome_heat.json`, status "dome":

```json
{"status": "dome", "units": "m, W, s, K",
 "box_m": [w, h], "depth_m": d, "source_xy_m": [x, y], "source_size_m": s, "source_W": P, "t_end_s": t,
 "sensors": [{"name": "S1", "xy_m": [x, y], "rise_K": dT, "rise_K_range": [lo, hi]}]}
```

The shape is proposed in `models/CONTRACT_PROPOSAL.md`. The team must agree it before anyone writes the file.

## What runs now: a demonstration, not a check

With no dome file, `build.py` runs a **demonstration** on placeholder geometry: a 0.20 x 0.20 m box, 0.10 m deep, with a
0.05 W heater 1 cm across, 2 cm above the floor, for 20 s. These are **not the dome's numbers**. They are set only so that the
lattice speed stays under 0.1 with real air viscosity at 1 mm cells. The demonstration shows the gravity-on path works: the heat
centroid rises well above the heater (values in `results.json` under `dome`). It is reported as "not run" in every check list.

## Limits

- 2D: a plume above a point heater in 3D spreads faster and rises more slowly than the 2D line plume this models.
- Adiabatic walls: the box keeps all the heat. Real dome walls lose heat, so readings after long times will be lower.
- With real air at bench scale the grid has to be fine (1 mm) to keep tau at 0.55 and the lattice speed under 0.1. Strong
  heaters, over about 0.1 W per 10 cm of depth, break the lattice-speed limit at that grid. Use a smaller cell if needed.
