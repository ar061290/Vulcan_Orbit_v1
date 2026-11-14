# Flame simulation: report for the reviewer

Branch `feat/sims`. Rebuild: `python models/flame-sim/build.py` (about 2.5 min). Numbers below are from that build. The
checks were run once against `RULES.md`, which was committed before any check ran. No threshold was changed afterwards.

**Status of every output: model.** NASA data exists only at 0 g and 1 g. Every Moon and Mars number is **model only, not
validated; lies between NASA's microgravity and Earth results**. None of it is a prediction of real spacecraft fires. Nothing
here says a material or an atmosphere is safe.

## Headline results (with ranges)

| Result | Value | Range | Baseline beside it |
|---|---|---|---|
| Droplet burning-rate constant K, n-heptane vs 107 FLEX tests | median error 25 % | signed error 5th to 95th percentile -8 % to +79 %; model is biased high by 25 % | constant K = 0.53 mm²/s (mean of the tune half): held-out error 22 %, better than the model's 29 % on held-out tests |
| K, methanol vs 150 FLEX tests | median error 7 % | -17 % to +33 % | constant K = 0.50 mm²/s: held-out 18 %; model 6 % |
| Radiative extinction: flame goes out vs burns to completion (held-out FLEX dates, 108 tests) | balanced accuracy 0.64 | bootstrap 95 % range 0.48 to 0.74 | always-one-class: 0.50 |
| Extinction diameter (38 held-out tests flagged as extinguishing) | median error 30 % | measured value inside the model range [d_c, d0] in 82 % of tests | none |
| Critical droplet diameter for radiative extinction, heptane, air, 101.3 kPa | 2.5 mm | 2.5 to 5.0 mm across the two O2 levels and two pressures (heptane) | — |
| Spread rate, thin PMMA (100 µm), 0 g and 1 g, vs BASS-II | 2.0 mm/s (0 g) and 1.9 mm/s (1 g) vs reported 2.2 and 2.0 | error -10 % to -4 % | de Ris alone: 2.2 mm/s |
| Spread rate, thick PMMA (1 to 5 mm), 0 g, vs 39 BASS-II readings | median error 190 % (model too fast) | +16 % to +900 % | de Ris alone: 262 % |
| PMMA plate burning rate vs 5 literature values | all inside the pass band | model 3.9 vs 4.0; 20.7 vs 18.2; 6.8 vs 6.0; 11.0 vs 7.8; 8.9 vs 8.9 g/m²s | — |
| Minimum O2 for spread, 100 µm PMMA, 0 g | 11 % at 101.3 kPa, 12 % at 70.3 kPa | grid step 1 % O2 | — |

## Every check

| Id | Result | Pass? |
|---|---|---|
| S1-K-hep | median \|error\| 25.0 % over 107 tests (limit ≤ 30 %) | **pass** |
| S1-K-meth | median \|error\| 7.0 % over 150 tests (limit ≤ 30 %) | **pass** |
| S1-K-base | baseline reported beside both | reported |
| S1-ext-class | balanced accuracy 0.64 [0.48, 0.74] (limit ≥ 0.65) | **fail** |
| S1-ext-diam | median \|error\| 30 % on 38 tests (limit ≤ 35 %) | **pass** |
| S1-sphere | 0 g, no flow: radius spread 0 (limit < 1 %) | **pass** |
| S1-order | aspect ratio rises 0 g → Moon → Mars → 1 g in every case | **pass** |
| S1-height | model/Roper: methane 2.60, ethylene 2.23, propane 2.80 (limit 0.5 to 2.0) | **fail** |
| S2-rate | 5 of 5 literature values inside the band (reported range widened x2) | **pass** |
| S2-standoff | no measured PMMA standoff in mm found in text or tables | **not run: no data** |
| S2-thick | standoff 0 g / 1 g at 0.05 m/s: 4.2 to 8.7 (limit > 1) | **pass** |
| S2-flat | burning-rate drop from 2 to 20 cm: 0 g 0.05 m/s 1.33; 0 g 0.20 m/s 2.67; 1 g 0.05 m/s 4.32 g/m²s | **pass** |
| S3-spread | median \|error\| 175 % over 41 BASS-II points (limit ≤ 50 %) | **fail** |
| S3-base | de Ris without extinction: median 216 % | reported |
| S3-map | quench and blow-off branches meet at 11 % O2 near 2.7 cm/s | **pass** |
| S3-march | front error 1e-16, burn-out time exact (limit < 1 %) | **pass** |
| R-rebuild | deleted and rebuilt twice: byte-identical | **pass** |

Per fuel and flow band (S3-spread):
- thin PMMA 7 %;
- thick PMMA 190 %;
- flow under 5 cm/s 64 %;
- flow 5 to 10 cm/s 155 %;
- flow over 10 cm/s 680 %.

### What the misses mean

- **S1-ext-class (0.64 vs 0.65).** Many FLEX "Extinction" tests are *diffusive* extinctions of small droplets. This criterion
  only models *radiative* extinction of large ones. The tuned geometry factor G landed on the lowest value of its grid (0.01),
  which shows the fit is poorly constrained.
- **S1-height (ratio 2.2 to 2.8).** The point-source solution uses rho*D at the mean flame temperature. Roper's correlation
  corresponds to D at ambient temperature times (T0/Tf)^0.67. So the model's absolute flame sizes are about 2 to 3 times too
  large, for gas jets and for droplet flames. The 0 g flame around a 3 mm heptane droplet is 108 mm in radius here, while the
  d-squared standoff gives 52 mm. Flame **shapes** (sphere, teardrop, tilt) are usable. Absolute **sizes** are not.
- **S3-spread (thick PMMA).** The de Ris thick formula scales with the flow. In BASS-II, thick slabs spread at 0.01 to
  0.14 mm/s with no rise with flow, and O2 drifted down during each test. Thick spread in microgravity was not steady (the
  summary report says so), so the formula is outside its range. Thin PMMA is reproduced within 10 %.

## Decisions made

They are listed in README.md ("Decisions"). The ones that change numbers:
- methanol added as a check-only fuel;
- gaseous fuels have no droplet values;
- buoyant velocity prefactor = 1;
- F = 4.76 anchors the solid flame temperature;
- the extinction correction to the spread rate has a square-root form of our own, sqrt(1 - R/R_c) sqrt(1 - 1/Da);
- SIBAL cases are left out for lack of verified cotton properties;
- the blow-off and quench constants are each set on one BASS-II point (blow-off of 100 µm PMMA at 40 cm/s; quench at 1.0 cm/s,
  both in air). Those two points are therefore not checks.

Supplementary, not in RULES: the model quench speed at 16 % O2 is 15 mm/s, against a reported 30 ± 5 mm/s (TM Table 2.1). For
400 µm at 21 % it is 12 mm/s, against about 15 mm/s reported. So the low-flow branch is too lenient at low O2, and the minimum
O2 of 11 % is probably too low. BASS-II reports spread down to about 16 to 17 % O2.

## Limits

- Reduced-order, quasi-steady physics. No soot and no unsteady ignition phase. Radiation is optically thin and only from CO2 and H2O.
- Absolute flame sizes are 2 to 3 times too large (S1-height). Use shapes and trends, not sizes.
- The Emmons plate solution assumes unit Lewis and Prandtl numbers and constant rho*mu. The 1 g case uses a local effective
  velocity, not the free-convection similarity solution.
- The 0 g plate with no flow has no steady solution and is given as null.
- Thick-fuel spread is out of the formula's range (S3-spread).
- Moon and Mars: model only (top of this file). S1-order only shows that they lie between 0 g and 1 g in this model.

## What you must verify by hand

1. FLEX column meanings: K in mm²/s and the extinction diameter is the droplet's. This comes from NASA/TP-2015-216046 Appendix
   A.1, matched to the PSI CSV by column name. Spot-check two rows of the CSV against TP Table IX.
2. The Law and Williams property rule (cp of fuel vapour; k = 0.4 k_F + 0.6 k_inf at the mean temperature) is used from
   memory of Turns, *An Introduction to Combustion*, ch. 10. It was **not** checked against a fetched copy.
3. The BASS-II thick-slab numbers were copied by a research agent from the extracted text of NASA/TM-20210011385 Table 5.1.
   Check them against the PDF, and check the O2 averaging (mean of initial and final).
4. The de Ris thin coefficient π/4 and F = 4.76 come from TM-20210011385 Eq. 2.11 (Bhattacharjee et al. 2016). The TM uses
   T_v = 673 K; this model uses 668 K (Ahmad and Faeth, via Zhang et al. 2014).
5. The Roper form used is H/Q = 0.133 s/cm² / ln(1 + 1/S), as quoted by Mikofski and Williams (Combust. Flame 146). Turns
   writes a version with a T_inf/T_F factor, which is 1 here.
6. The literature plate burning rates in `literature.json` are converted from regression rates with rho = 1.19 g/cm³. The
   Singh 2015 thesis averages are load-cell values over the plate. The model is averaged the same way.
7. That no Moon or Mars number appears anywhere without its label. `build.py` labels every case. Check the site panel when it is built.

## Reproducibility

`build.py` recomputes everything from `datasets/`, `properties.json` and `literature.json`, with seed 42 for the bootstrap.
**R-rebuild: pass.** Both outputs were deleted and rebuilt twice, giving byte-identical files. The hashes are in
`models/m3-drift/REPORT.md`, "Reproducibility".
