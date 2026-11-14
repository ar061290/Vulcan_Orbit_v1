# M3 smoke drift (lattice Boltzmann): pass rules

Written and committed before any check was run. Thresholds are not changed after results are seen; misses are reported as misses.

Status of everything here: "model". This is a 2D screening model with an effective (eddy) viscosity, not validated fluid dynamics
of a real module. If the data a check needs does not exist, the check is reported as **"not run: no data"**, never as a pass.

No cabin run is used until V-a, V-b and V-c have been run. If one of them fails, the cabin results are still written but every
output file and the report carry the failure.

## Solver validation (before any cabin run)

| Id | Check | Metric | Pass |
|---|---|---|---|
| V-a | Poiseuille channel flow, body-force driven, vs the exact parabola | relative L2 error of the velocity profile | < 2 % |
| V-b100 | Lid-driven cavity, Re = 100, 129 x 129 nodes, vs Ghia, Ghia & Shin (1982): u on the vertical centreline and v on the horizontal centreline at their tabulated points | RMS difference and largest difference, in units of lid speed | RMS < 0.02 and largest < 0.05 |
| V-b400 | Same at Re = 400 | same | RMS < 0.02 and largest < 0.05 |
| V-c | Pure diffusion of a Gaussian scalar spot in still air vs the analytic Gaussian | relative L2 error of the field; change in total scalar | error < 2 %; total changes by < 1e-6 |

## Numerical limits (every run)

| Id | Check | Pass |
|---|---|---|
| N-u | Largest lattice velocity anywhere in the converged field | < 0.1 |
| N-tau | Relaxation time | >= 0.55 |
| N-mass | Smoke balance: (smoke in the cabin + smoke that left through the return) / smoke released | between 0.995 and 1.005 |
| N-steady | Flow field has stopped changing before smoke is released: relative change of velocity over the last 2 % of the run | < 1e-3; if not met, the run is reported as unsteady |
| N-grid | Hero scenario on the working grid vs a grid with cells half the size: alarm time at each detector | same detectors alarm, and alarm times differ by < 15 % |

## Cross-check against the calibrated drift model (`engine/drift_core.py`, not edited)

Same cabin size, same supply and return openings, no racks, same fire positions, same mixing value D, same release rate and
alarm level, no smoke returned by the supply. The two models differ in the air field (viscous LBM vs potential flow), so this is
a comparison between two models, not a validation of either.

| Id | Check | Metric | Pass |
|---|---|---|---|
| X-agree | Alarm vs no alarm within 300 s for every fire position x detector pair | share of pairs that agree | >= 75 % |
| X-time | Alarm times for pairs where both models alarm | median of (LBM time / engine time) | between 0.5 and 2.0 |

## What-if runs

| Id | Check | Pass |
|---|---|---|
| W-count | Number of runs at g = 0 with varied fire position and ventilation speed | >= 200 |
| W-range | Share detected within 60 s and within 180 s, each with a bootstrap 95 % range (1000 resamples, seed fixed) | reported; no target share is set, because there is no measurement to compare with |
| W-layout | Best and worst detector layouts among all 3-detector choices from the candidate positions | reported with their shares and ranges |

## Dome check (gravity on)

| Id | Check | Pass |
|---|---|---|
| D-dome | Same code with g = 9.81 and a small heat source vs a dome measurement described in `dome_check.md` | if dome data exists in `data/` or `datasets/`: temperature rise at each sensor within a factor of 2 and the same ordering of sensors. If not: "not run: no data" |

## Growing smoke source

| Id | Check | Pass |
|---|---|---|
| G-link | Smoke release follows the burning area from the flame-spread output; total released equals the time integral of the source | relative difference < 1 % |

## 3D (stretch)

| Id | Check | Metric | Pass |
|---|---|---|---|
| V-a3 | Square duct flow, D3Q19, vs the exact series solution | relative L2 error of the velocity field | < 3 % |

## Reproducibility

| Id | Check | Pass |
|---|---|---|
| R-rebuild | Delete `data/drift_lbm.json` and `data/drift_whatif.json`, run `python models/m3-drift/build.py` twice | the two rebuilt files are byte-identical |
