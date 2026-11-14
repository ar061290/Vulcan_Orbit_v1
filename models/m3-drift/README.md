# M3 smoke drift with a lattice Boltzmann air field

A 2D cross-section of a station module (4.2 x 2.2 m) with racks, a supply vent and a return vent. Air flow comes from a lattice
Boltzmann solver. Smoke is a passive scalar carried by that air, and detectors alarm at a stated concentration. Status of every
output: **model**. It is a screening model with an effective viscosity, **not validated fluid dynamics of a real module**, and it
does not predict real spacecraft fires.

```
python models/m3-drift/build.py     # about 7 minutes; writes data/drift_lbm.json, data/drift_whatif.json, models/m3-drift/results.json
```

Run `models/flame-sim/build.py` first if you want the growing smoke source: it reads `data/flame_spread.json`.

This lane does not write `data/drift.json` or `data/whatif.json`. Those belong to the calibrated model in `engine/`, which is
not touched. `drift_lbm.json` has the same shape as `drift.json`, so the same panel can play it.

Pass rules: `RULES.md`, committed before any check was run. Results and misses: `REPORT.md`.

## Method

| Part | What it is | File |
|---|---|---|
| Air | D2Q9 lattice Boltzmann, BGK collision; TRT available (not needed: BGK was stable in every run). Guo body force; halfway bounce-back walls and racks; equilibrium vents. Run to steady state before smoke is released | `lbm.py`, `cabin.py` |
| Smoke | Cell-centred finite volume on the same nodes: van Leer limited advection (second order in space and time) plus central diffusion with mixing value D. Conservative: smoke enters only at the fire and leaves only through the vents | `lbm.py` |
| Recirculation | Part of the smoke leaving at the return comes back with the supply air. The share comes from the clearance time tuned on Saffire-III, the same rule as `engine/drift.py` | `build.py` |
| Gravity | Optional Boussinesq force g beta (T - T_amb). g = 0 for every cabin run; g = 9.81 in the dome check | `dome_check.py` |
| Detectors | Average over a 0.15 m square patch (3 x 3 cells). Alarm when the average reaches 1 mg/m³, plus the detector delay tuned on Saffire-III | `build.py` |
| Fire | Constant source; or a source that grows with the burning area from the flame-spread model | `build.py` |

## Units-conversion table

The lattice works in cells and steps. The conversion is dx = 0.05 m and dt chosen so that the mean cabin air speed equals the
ventilation speed. For each case:
- nu_lattice = nu dt/dx²
- tau = 0.5 + 3 nu_lattice
- u_lattice = u dt/dx

| Quantity | Physical | Lattice |
|---|---|---|
| Cell size dx | 0.05 m | 1 |
| Cabin | 4.2 x 2.2 m | 84 x 44 air cells (+ wall frame) |
| Depth (to turn the 2D section into volumes) | 2.0 m (as `engine/drift_core.py`) | — |
| Molecular kinematic viscosity of air | about 1.6e-5 m²/s (Cantera gri30, 300 K, 1 atm) | would give tau = 0.5004 at 0.2 m/s: unusable |
| Effective (eddy) viscosity used | 0.02 m²/s | see per-case rows |
| Mixing value D for smoke | 0.02 m²/s (sensitivity 0.004 and 0.1) | D dt_s / dx² |

| Ventilation (mean air speed) | dt per LBM step | tau | largest lattice speed | supply volume flow |
|---|---|---|---|---|
| 0.077 m/s | 8.04 ms | 0.693 | 0.052 | 0.249 m³/s |
| 0.100 m/s | 6.22 ms | 0.649 | 0.052 | 0.321 m³/s |
| 0.150 m/s | 4.20 ms | 0.601 | 0.052 | 0.476 m³/s |
| 0.203 m/s | 3.15 ms | 0.576 | 0.052 | 0.634 m³/s |

Rules met in every case: lattice speed under 0.1 and tau of at least 0.55. The Reynolds number with the effective viscosity is
about 8 to 22 (U x 2.2 m / 0.02 m²/s), so the flow is laminar-like by construction. This is the main modelling choice; see
Decisions 2.

## Inputs and where they come from

| Input | Value | Source |
|---|---|---|
| Ventilation speed | 0.077, 0.10, 0.15, 0.203 m/s | NTRS 20150009509 (Link & Balistreri, ICES 2015), p. 9: "effective atmosphere velocity in the cabin aisleway must be maintained between 4.6 and 12.2 meters per minute (15 and 40 feet per minute)" |
| Mixing D | 0.02 m²/s; 0.004 and 0.1 for sensitivity | values kept by the Saffire-III calibration, `data/drift_calibration.json` |
| Clearance time | 170 s (geometric mean of 120 to 240 s) | same calibration |
| Detector delay | 11 s (mean of 0 to 22 s); 0 and 22 s for sensitivity | same calibration |
| Alarm level | 1 mg/m³ | as `engine/drift.py` (NASA Saffire analysis, ICES-2024-365, via engine docs) |
| Release rate | 1 mg/s for the hero run; what-if runs log-uniform 0.017 to 2 mg/s | low end: lowest SAME flight weight-loss rate (PSI-102); high end: upper value **assumed** in `engine/drift.py` |
| Fire growth | burning area of a 20 x 2 cm 100 µm PMMA sample, 0 g, 21 % O2, 0.10 m/s | `data/flame_spread.json` (`growth_for_smoke`) |

## Decisions (made without asking, as the brief instructs)

1. **Ventilation 0.077 to 0.203 m/s, not 0.05 to 0.2.** The NASA source gives 4.6 to 12.2 m/min. Nothing found supports
   0.05 m/s, so it was dropped.
2. **Effective viscosity 0.02 m²/s.** With real air viscosity, the cabin needs tau ≈ 0.5004, which breaks the rule that tau is
   at least 0.55. The effective value equals the middle mixing value tuned on Saffire-III, which assumes a turbulent Schmidt
   number of 1. The air field is therefore a smoothed, laminar-like picture of cabin flow.
3. **"Ventilation speed" = mean air speed in the cabin**, as in `engine/drift.py`. The supply-vent speed is set to give that mean.
4. **Geometry is illustrative**: four rack faces (two overhead, two on the deck), supply in the ceiling at one end, return low on
   the far end wall. Real module layouts differ.
5. **Release rate varied in the what-if runs.** It was added after a first pass at a fixed 1 mg/s caught 100 % of fires for
   every layout within 180 s, which made the layout search meaningless. The rate is log-uniform over the same range
   `engine/drift.py` uses. The fixed-rate shares are still reported (`by_rate`).
6. **Growing source: relative only.** The release follows burning area / peak area times 1 mg/s. No verified smoke yield per
   burned area was found, so the absolute yield is null.
7. **3D (D3Q19) not attempted.** The brief allows it only after everything above passes, and check V-b400 failed.
8. **Dome check: demonstration only.** No dome data exists yet; see `dome_check.md`.

## Limits

- 2D section: real cabins are 3D and smoke can go round racks sideways.
- Effective viscosity and mixing are lumped values, and the Saffire-III record cannot pin down the mixing (0.004 to 0.1 fit equally).
- No buoyancy in orbit runs. That is correct for g = 0, but there is also no fire-driven flow at all.
- Steady ventilation; fans, crew motion and hatches are ignored.
- Detection is a concentration threshold. It does not model particle size or detector type.
