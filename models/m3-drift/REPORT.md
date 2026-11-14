# M3 smoke drift (LBM): report for the reviewer

Branch `feat/sims`. Rebuild: `python models/m3-drift/build.py` (about 7 min). Numbers below are from that build. The checks
were run against `RULES.md`, which was committed before any check ran. No threshold was changed afterwards.

**Status of every output: model.** This is a 2D screening model with an effective viscosity. It is not validated fluid dynamics
of a real module and does not predict real spacecraft fires. All cabin runs are at g = 0.

## Headline results (with ranges)

What-if runs: 524 runs at g = 0. Each run is one of 131 fire positions x 4 ventilation speeds (0.077 to 0.203 m/s), with a release
rate between 0.017 and 2 mg/s. "Caught" means the smoke reaches 1 mg/m³ at any of the 3 detectors, including the 11 s detector
delay.

| Layout (3 detectors) | Caught within 60 s | Caught within 180 s | Never within 300 s |
|---|---|---|---|
| Best found (deck at x = 1.9 m; overhead rack face near x = 3.8 m; at the return) | **47 %** [42 %, 51 %] | **65 %** [61 %, 69 %] | 31 % |
| Worst found (three positions on the end wall by the supply) | 33 % [29 %, 37 %] | 55 % [50 %, 59 %] | 38 % |
| Ceiling gap + air return + deck gap (hero detectors) | 47 % [43 %, 51 %] | 63 % [59 %, 67 %] | 32 % |

How to read the ranges:
- The first range is a bootstrap over runs (1000 resamples, seed 42).
- A second range covers the settings the Saffire-III flight record cannot tell apart (mixing 0.004 to 0.1 m²/s, detector delay
  0 to 22 s). For 180 s it is 62 % to 67 % for the best layout and 54 % to 56 % for the worst.
- 142,880 three-detector layouts were searched from 96 wall positions.

What drives detection in this model, as numbers:
- **Release rate, above all.** At a fixed 0.017 mg/s (the lowest SAME flight rate) no layout catches any fire within 180 s. At a
  fixed 0.2 mg/s or more, every layout tested catches all of them.
- Ventilation speed hardly matters: the best layout catches 63 % to 66 % within 180 s at each of the four speeds.
- Best vs worst layout: 10 points at 180 s, 13 points at 60 s.

Hero run (`data/drift_lbm.json`):
- Fire at (1.0, 0.45) m, 1 mg/s, 0.10 m/s ventilation.
- Alarm times: deck gap 22 s, air return 37 s, ceiling gap 45 s, end wall by the supply 48 s.
- 61 frames, one every 10 s, 0.8 MB.

With the smoke source growing as the flame-spread model's burning area (100 µm PMMA, 0 g, 21 % O2, 0.10 m/s), every detector
alarms about 6 s later: 28, 43, 50 and 54 s.

## Every check

| Id | Result | Pass? |
|---|---|---|
| V-a | Poiseuille L2 error 7.0e-4 with BGK (TRT: 6e-10) (limit < 2 %) | **pass** |
| V-b100 | cavity Re 100 vs Ghia: RMS 0.0026, largest 0.0055 (limit RMS < 0.02, largest < 0.05) | **pass** |
| V-b400 | cavity Re 400 vs Ghia: RMS 0.024, largest 0.139 (same limits) | **fail** |
| V-c | Gaussian diffusion L2 error 1.2e-3; total change 2e-16 (limits < 2 %; < 1e-6) | **pass** |
| N-u | largest lattice speed 0.052 in every air field (limit < 0.1) | **pass** |
| N-tau | tau 0.576 to 0.693 (fine grid 0.802) (limit ≥ 0.55) | **pass** |
| N-mass | smoke balance 1.000000 in the hero run and every what-if run (limit 0.995 to 1.005) | **pass** |
| N-steady | relative change over the last 2 % of steps 5e-5 to 1.4e-4 (limit < 1e-3) | **pass** |
| N-grid | cells half the size: same 4 detectors alarm; worst alarm-time difference 1.2 % (limit < 15 %) | **pass** |
| X-agree | vs `engine/drift_core.py`, same openings, no racks: alarm vs no alarm agree on 94 % of 64 pairs (limit ≥ 75 %) | **pass** |
| X-time | median LBM/engine alarm-time ratio 0.89 (5th to 95th percentile 0.65 to 1.49) over 32 pairs (limit 0.5 to 2.0) | **pass** |
| W-count | 524 runs (limit ≥ 200) | **pass** |
| W-range | shares with bootstrap ranges reported | reported |
| W-layout | best and worst of 142,880 layouts reported | reported |
| G-link | released 98.82 mg = time integral of the source (difference 0) (limit < 1 %) | **pass** |
| D-dome | no dome data exists | **not run: no data** |
| V-a3 | 3D not attempted (V-b400 failed first) | **not run** |
| R-rebuild | deleted and rebuilt twice: byte-identical | **pass** |

**V-b400.** The whole miss comes from one point: v at x = 0.9063, where the model differs from the table by 0.139. Every other
of the 33 points differs by 0.008 or less. The research agent found that both transcriptions of Ghia's Table II carry -0.23827
there. That value breaks the smooth trend between its neighbours (-0.22847 and -0.44993), and it has been flagged in CFD forums
as a likely typo in the original paper. The rule said "at their tabulated points", so this stays a **fail**. A human should check
the value against the scanned paper (link in `ghia1982.json`). Without that point the RMS would be 0.0043 and the largest difference 0.0082.

**X-agree / X-time.** This compares two models (viscous LBM vs potential flow), not a model with data. The match says the LBM
air field does not change the engine model's alarm timing much in an empty cabin. It does not validate either model.

## Decisions made

Full list in README.md ("Decisions"):
- ventilation 0.077 to 0.203 m/s (the NASA source), not 0.05 to 0.2;
- effective viscosity 0.02 m²/s, because real air viscosity breaks the tau limit;
- release rate varied in the what-if runs, a change made after the first pass saturated at 100 %;
- growing source in relative units only;
- 3D skipped;
- dome check is a demonstration only.

## Limits

- 2D cross-section; illustrative rack and vent layout; steady ventilation.
- The effective viscosity smooths the air field. Real cabin flow is turbulent and unsteady.
- Mixing and detector delay come from one detector in one vehicle (Saffire-III). The record cannot fix the mixing value,
  which is why it is a sensitivity range.
- The release-rate range is the main driver of the headline, and its upper end (2 mg/s) is an assumption carried over from
  `engine/drift.py`, not a measurement.
- Detection is a mass-concentration threshold. Particle size, which decides whether a real detector sees smoke (M5), is not modelled.

## What you must verify by hand

1. The NTRS 20150009509 quote (p. 9) and that "cabin aisleway" velocity is the right quantity to compare with a mean
   cross-section air speed.
2. The Ghia Re 400 point v(0.9063) = -0.23827, against the scanned paper.
3. The 1 mg/m³ alarm level and its source (ICES-2024-365, as cited in `engine/drift.py`). This lane reuses it without having
   read the paper.
4. That the hero frames play in the existing drift panel. `drift_lbm.json` has the `drift.json` keys, but the panel was not
   pointed at it because `js/` is out of scope.
5. The dome measurement plan in `dome_check.md`, with the dome team.

## Reproducibility

R-rebuild (both lanes): the four outputs (`data/flame_static.json`, `data/flame_spread.json`, `data/drift_lbm.json`,
`data/drift_whatif.json`) were deleted and rebuilt twice from scratch, flame sim first. See the result line below.

**R-rebuild: pass (both lanes).** The two rebuilds gave byte-identical files (SHA-256):

```
316badcb769e93ae38d00692149ecc0cb9581a596c80ad67e19981088c533348  data/flame_static.json
8659b6a69398386a1379109483d0ab6cdf2bd7737e1dc438f70829bb6a604f02  data/flame_spread.json
6caa1ad79b539dd54b0a750798a3c39e59091c4c6266cbef177c3571161f0ba0  data/drift_lbm.json
a26ebf2e865128ce95f71fdb965bb415fb208535212eed217302fa6b6e302312  data/drift_whatif.json
```

Run on Python 3.14.4 with the pinned `requirements.txt`, 16 cores. Numba's parallel loops write to separate arrays per run,
so the thread count should not change the results, but that was not tested on another machine.
