# Flame simulation: pass rules

Written and committed before any check was run. Thresholds are not changed after results are seen; misses are reported as misses.

Status of everything here: "model". NASA data exists only at 0 g and 1 g. Moon (0.16 g) and Mars (0.38 g) outputs are
"model only, not validated; lies between NASA's microgravity and Earth results" and take part in no check.

If the data a check needs cannot be found, the check is reported as **"not run: no data"**. It is never counted as a pass.

## Stage 1: static flame in open air

Data: NASA FLEX summary table, PSI-69 (`datasets/psi/PSI-69/PSI-69_Experimental table_FLEX.csv`), fuels heptane and methanol.
Split for anything that is tuned: FLEX tests are grouped by test date; dates are sorted and alternate dates go to "tune" and
"held-out" (first date = tune). Scores below are on held-out dates only. The d-squared-law K has no tuned constant, so its
score is reported on all rows and on held-out rows.

| Id | Check | Metric | Pass |
|---|---|---|---|
| S1-K-hep | Burning-rate constant K, heptane, vs FLEX "Burning rate" for the same O2, diluent (N2, CO2, He) and pressure | median absolute error, % of measured; 5th to 95th percentile of signed error reported as the range | median <= 30 % |
| S1-K-meth | Same for methanol (check-only fuel) | same | median <= 30 % |
| S1-K-base | Baseline beside both: one constant K per fuel = mean of the tune-half FLEX values | same metric, reported side by side | no threshold (baseline) |
| S1-ext-class | Radiative-loss criterion says "flame goes out before the droplet is consumed" vs FLEX "Test end" (Extinction vs Completion; Disruption rows left out) | balanced accuracy on held-out dates, bootstrap 95 % range | >= 0.65 |
| S1-ext-diam | Extinction diameter, for held-out FLEX rows that have one and that the model flags as extinguishing. Model gives a range [critical diameter, initial diameter] and a point at the middle | median absolute error of the point, % of measured; share of measured values inside the model range | median <= 35 % |
| S1-sphere | 0 g, no forced flow: flame contour is a sphere | (max radius - min radius) / mean radius over the contour | < 1 % |
| S1-height | 1 g flame height for methane, ethylene, propane vs the Roper laminar-flame correlation at the same fuel flow | ratio model / correlation, per fuel | every ratio between 0.5 and 2.0 |
| S1-order | Ordering by gravity: flame aspect ratio (length / width) does not decrease from 0 g to Moon to Mars to 1 g at zero forced flow | monotone yes/no | yes |

The radiative criterion has at most two lumped constants (a geometry factor and a limit flame temperature). They are tuned on
the tune half only, by grid search maximising balanced accuracy of S1-ext-class, ties to the smallest values.

## Stage 2: static flame on a surface

Literature ranges (status "reported") are written into `literature.json` with their sources before the stage 2 code is run.

| Id | Check | Metric | Pass |
|---|---|---|---|
| S2-rate | PMMA local burning rate from the Emmons solution, 1 g and forced-flow cases, at the plate positions and flow speeds the cited experiments used | model value vs reported range | inside the reported range widened by a factor of 2 on each side |
| S2-standoff | PMMA flame standoff distance, same cases | model value vs reported range | inside the reported range widened by a factor of 2 on each side |
| S2-thick | 0 g flame is thicker: standoff at 0 g vs 1 g, same forced flow (0.05 m/s), at every plate position | ratio 0 g / 1 g | > 1 at every position |
| S2-flat | 0 g flame is flatter at low flow: drop in local burning rate between x = 2 cm and x = 20 cm (g/m2/s), 0 g at 0.05 m/s vs 0 g at 0.20 m/s and vs 1 g at 0.05 m/s | absolute drop | 0 g low-flow drop is the smallest of the three |

Also reported without a threshold: the exponent of standoff vs distance for each case (boundary-layer theory gives 1/2 forced, 1/4 buoyant).

## Stage 3: flame spread over time

Comparison data: BASS-II opposed-flow spread rates. The PSI-25 summary table has no spread-rate column (checked 14 Nov 2026), so
the numbers come from papers by the BASS-II investigators, status "reported". PSI-25 gives the test conditions.

| Id | Check | Metric | Pass |
|---|---|---|---|
| S3-spread | Spread rate vs reported BASS-II values for the same fuel, thickness, O2 and flow | median absolute error, % of reported, per fuel and per flow band; 5th to 95th percentile of signed error as the range | overall median <= 50 % |
| S3-base | Baseline beside it: de Ris thermal-regime formula with no extinction correction | same metric | no threshold (baseline) |
| S3-map | Flammability map (flow vs O2) has a low-flow quenching branch and a high-flow blow-off branch that meet at a minimum O2 | yes/no, with the minimum O2 and the flow where it occurs reported | yes |
| S3-march | Time stepping: for a constant spread rate the front position after time t equals rate x t; burn-out of the 20 cm sample at 20 cm / rate | relative error | < 1 % |

## Reproducibility

| Id | Check | Pass |
|---|---|---|
| R-rebuild | Delete `data/flame_static.json` and `data/flame_spread.json`, run `python models/flame-sim/build.py` twice | the two rebuilt files are byte-identical |
