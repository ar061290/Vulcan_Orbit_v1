# M6b report for the reviewer

Feature M6b, flame spread predictor and growth simulation. Branch `feat/m6b-predictor` (on top of M6 and M7). Written 14 Nov 2026 by Claude Code for the M6b owner.

All numbers are printed by `python models/m6b-predictor/build.py` and stored in `results.json`. A second clean build reproduced every output byte for byte (see "Rebuild").

## Headline

- **Opposed flow over PMMA, whole ISS sessions held out.** Held-out MAE **0.020 mm/s** [0.015–0.023]. Ranges cover **87%** of held-out points (nested).
  - Baselines on the same split: M6's one-constant model 0.033 mm/s; raw de Ris 0.163 mm/s.
- **Concurrent flow over fabric.**
  - Saffire-II (PSI-99, never used in calibration): predicted **2.89 mm/s [1.68–5.30]** against measured 2.1 and 2.6.
  - On the six calibration flights the law barely beats a constant (MAE 1.04 vs 1.06 mm/s).
- **Rules.** All 5 calibration rules and all 5 growth-simulation checks pass.

**One-sentence limit.** This is a reduced-order model calibrated on 39 BASS-II slab points and 6 reported fabric flights at about 1 atm in microgravity; outside those boxes every number is an extrapolation and is flagged as such.

## 1. Calibration factors

| Regime | Factor (all rows) | Per held-out-session folds | Rows | Range applied to a prediction |
|---|---|---|---|---|
| Opposed, thin (de Ris) | **0.472** × de Ris | 0.426–0.504 | 11 (4 tests, 3 sessions) | ×0.431 to ×3.051 |
| Opposed, thick (de Ris) | **0.172** × de Ris | 0.143–0.186 | 28 (15 tests, 7 sessions) | (same, pooled) |
| M6 one constant (baseline B2) | 0.229 × de Ris | – | 39 | – |
| Concurrent, K in V = K·U·X_O2·√(P/1 atm)·(18.05/area density) | **0.0649** | 0.0586–0.0710 (leave one flight out) | 6 | ×0.582 to ×1.833 |

Notes on the factors:
- de Ris overpredicts thick slabs about 5.8-fold and thin-regime slabs about 2.1-fold. M6's single constant sits between the two (4.4-fold as a geometric mean; M6 quotes 3.5-fold as the median ratio), which is why M6's errors were driven by thickness.
- No fold lacked a regime, so the pooled fallback in RULES §1 was never used.

## 2. Held-out scores against the rules

### Opposed flow, PMMA slabs (leave one ISS session out, 7 folds)

| Model | MAE (mm/s) [95% session bootstrap] | R² |
|---|---|---|
| **Kept: de Ris × factor per regime** | **0.0200** [0.0155, 0.0230] | 0.373 |
| B2: M6's model, de Ris × one constant | 0.0329 [0.0234, 0.0398] | −0.680 |
| B1: raw de Ris | 0.1626 [0.1039, 0.2284] | −40.0 |

| Regime | n | MAE kept | MAE B2 | Nested coverage |
|---|---|---|---|---|
| thin | 11 | 0.0192 | 0.0449 | 100% |
| thick | 28 | 0.0204 | 0.0282 | 82% |

- **R1** (MAE ≤ 0.033 mm/s): **pass**, 0.020.
- **R2** (nested coverage ≥ 80%): **pass**, 87% (34/39). The 5 misses:
  - M3 at 20 cm/s (GMT192, 0.024 mm/s);
  - M4 at 5 and 3 cm/s (GMT212);
  - M13 at 4 cm/s (GMT212);
  - M20 at 10 cm/s (GMT213, 0.012 mm/s, the slowest point).
- The range shipped in the site file (×0.43–3.05, from all 39 held-out residuals) covers 95% of the same rows. That figure is in-sample, which is why R2 uses the nested figure.
- The R² of 0.37 is reported for comparison with M6 only; it is not a rule here.

### Concurrent flow, cellulose fabric (leave one flight out, 6 folds)

| Flight | Material | Observed (mm/s) | Held-out prediction | ln(obs/pred) | Inside nested range |
|---|---|---|---|---|---|
| Saffire I | SIBAL | 1.80 | 3.09 | −0.54 | yes |
| Saffire III | SIBAL | 2.30 | 3.67 | −0.47 | yes |
| Saffire IV | SIBAL | 3.60 | 2.85 | +0.23 | yes |
| Saffire V | cotton | 3.40 | 2.94 | +0.15 | yes |
| BASS (1.2 cm) | SIBAL | 2.70 | 2.63 | +0.02 | yes |
| BASS (2.2 cm) | SIBAL | 5.10 | 2.78 | +0.61 | **no** |

- **Accuracy.** MAE 1.04 mm/s against 1.06 mm/s for the mean-of-training baseline. **The law adds almost nothing over a constant on these six points.**
  - Flow and O2 vary little here (19–25 cm/s, 21–27%), so the law has little to work with.
  - The scatter comes from duct and sample size: Saffire IV in a smaller duct spread twice as fast as Saffire I at the same flow (Olson et al.). The law has no term for that.
- **R3** (nested coverage ≥ 80%): **pass**, 5/6 (83%). The miss is the 2.2 cm BASS sample, in the smallest duct.

## 3. Independent checks (never calibrated on)

| Check | Measured | Predicted [range] | Pred/obs | Inside | In domain |
|---|---|---|---|---|---|
| Saffire-II 2-5, 20 cm/s, 22.1% O2 (PSI-99, real) | 2.1 mm/s | 2.89 [1.68, 5.30] | 1.38 | yes | no (103 kPa > 102) |
| Saffire-II 2-6, 20 cm/s (PSI-99) | 2.6 mm/s | 2.89 [1.68, 5.30] | 1.11 | yes | no (same) |
| *Sensitivity:* 2-6 at 25 cm/s (Olson et al. flow) | 2.6 mm/s | 3.61 [2.10, 6.62] | 1.39 | yes | no |
| 100 µm PMMA film, 3 cm/s, 21% (reported) | 2.2 mm/s | 1.08 [0.47, 3.30] | 0.49 | yes | no (thinner than any slab) |
| *Same film, raw de Ris* | 2.2 mm/s | 2.29 | 1.04 | – | – |

- **R4a** (both Saffire-II points inside): **pass**. MAE 0.54 mm/s; the model overpredicts both.
- **R4b** (film inside): **pass**, but only because the range is wide.
  - The slab-calibrated thin factor halves the film rate, while raw de Ris is within 4%.
  - The film was used by its authors to compare with the formula (they derived F = 4.76 from it), so raw de Ris agreeing is not a blind test.
  - The honest reading: slab heat losses do not carry over to films. Films stay `in_domain: false`.
- **Saffire-II burn times.** The worked example with the Saffire-II layout (§6) burns out in 89–192 s (mid 121 s), against PSI-99's recorded burn times of 145 s and 115 s. Not scored.

## 4. Will it spread at all: basis of the verdict

- **Cases.** 20 placed cases (`source/no_spread_placed.csv`):
  - 8 real (PSI-25 flow text): films B14, B18, B19; slab M17; rod P8 at 5/10/15 cm/s; rod O22.
  - 12 reported: 10 SIBAL rows of Table 7.1; 2 thin-film rows of Table 2.1.
- **Boxes.** As in RULES §4. Geometry (film / slab / fabric) is part of the match (README Decision 8); rods are not modelled.
- **Cells per verdict** on the site grid (21 O2 × 26 flow = 546 cells per case):

  | Case | Spreads | Near | Observed no-spread |
  |---|---|---|---|
  | PMMA film, opposed | 506 | 35 | 5 |
  | PMMA slab 1 mm / 5 mm, opposed | 541 | 2 | 3 |
  | SIBAL, concurrent | 465 | 73 | 8 |
  | concurrent PMMA, opposed SIBAL | 546 | 0 | 0 (no cases) |

- **What "spreads" means.** Only that no case is near. SIBAL at 15% O2 and high flow shows "spreads" because nothing was tested there; its in-domain flag is 0.

## 5. Growth-simulation checks (RULES §6)

| Check | Result |
|---|---|
| **G1, hand calculation** | **Pass.** 1 mm two-sided PMMA strip at zero flow, 21% O2 (rate 0.108 mm/s, dx 0.1 cm). Front at 451, 902 and 1353 s: simulated 5.30, 10.20, 15.10 cm against hand-calculated 5.375, 10.25, 15.125 cm. Differences −0.075, −0.05, −0.025 cm, all within one cell. Zero flow is outside the data (an observed extinction regime for films); G1 checks kinematics only. |
| **G2, fuel edge** | **Pass.** Every cell reached; the last cell reached is the last column (199 of 199); stop reason "fuel edge"; final area 0. |
| **G3, observed no-spread** | **Pass.** 16/16 placed cases of modelled geometries (4 real, 12 reported) give no growth beyond the initial region and stop reason "observed no-spread conditions". |
| **G4, area ≥ 0** | **Pass.** 203 inputs (3 examples + 200 random, seed 0) × 2 lengths × 3 runs; no negative area. |
| **G5, longer fuel never shrinks the fire** | **Pass.** Doubling the length on the same cells never lowered the maximum area of any run (0 failures in 609). |

Not scored: lo ≤ mid ≤ hi maximum area held in all three examples.

## 6. Worked examples (`data/growth_examples.json`; plot `checks/growth_examples.png`)

### Example 1: thin SIBAL fabric panel in concurrent flow (Saffire-II layout)

- **Inputs.** Fuel 5 × 29 cm SIBAL; flame a 0.5 cm band across the upstream edge (2.4 cm² on the grid); 20 cm/s along the length; 22.1% O2; 103 kPa.
- **Verdict.** "Spreads" (no case near).
- **Rates.** Downwind 2.89 mm/s [1.68–5.30]; upwind 0 (assumed); cross-flow 1.45.
- **Burnout.** 22 s (hi run 35 s).

| Run | Max burning area | At | Ends | Area consumed | Stop |
|---|---|---|---|---|---|
| lo | 20.7 cm² | 21.8 s | 191.5 s | 145 cm² | fuel edge |
| mid | 33.9 cm² | 21.9 s | 120.7 s | 145 cm² | fuel edge |
| hi | 94.9 cm² | 35.0 s | 88.9 s | 145 cm² | fuel edge |

- **Calibrated:** the downwind rate (K from 6 flights; checked against this very layout's PSI-99 rates, which it overpredicts 1.1–1.4×).
- **Extrapolated:** the pressure is 1 kPa above the calibration box.
- **Assumed:** upwind 0; cross-flow = mean; burnout 22 s (reported).

### Example 2: thick PMMA slab in opposed flow

- **Inputs.** Fuel 2.2 × 8.5 cm, 5 mm thick, both faces burning; flame 0.5 cm at the downstream end (1.0 cm²); 10 cm/s; 21% O2; 1 atm.
- **Verdict.** "Spreads".
- **Rates.** Upwind (opposed) 0.040 mm/s [0.017–0.122]. Downwind 0 [0–0.167] (observed bound). Cross-flow 0.020.
- **Burnout.** 2.5 mm ÷ regression: 62.5 / 125 / 250 s.

| Run | Max burning area | At | Ends | Area consumed | Stop |
|---|---|---|---|---|---|
| lo | 1.22 cm² | 49 s | 4726 s | 18.7 cm² | fuel edge |
| mid | 2.11 cm² | 124 s | 2135 s | 18.7 cm² | fuel edge |
| hi | 7.81 cm² | 250 s | 906 s | 18.7 cm² | fuel edge |

- **Calibrated, in domain:** the upwind rate (thick-regime factor; 10 cm/s, 21% and 5 mm are inside the BASS-II box).
- **Extrapolated:** the downwind bound comes from one PSI-99 observation at 20 cm/s and 22% O2; it is applied here at 10 cm/s and drives the hi run.
- **Assumed:** cross-flow = mean; the initial region all ignited at t = 0. That causes the mid-run peak at 124 s, when it burns out together; after it the steady burning area is about 1.1 cm².

### Example 3: low-flow case that ends in extinction

- **Inputs.** SIBAL 2.2 × 10 cm; flame on the first 1 cm (2.0 cm²); 2.2 cm/s; 18.7% O2. These are BASS-II test GMT45-T4's final conditions.
- **Verdict.** **Observed no-spread**:
  - GMT45-T4 (reported, "Quenched") is matched exactly;
  - GMT100-T13, GMT175-T18 and GMT190-T20 are near.
- **Result.** No growth. The existing flame area (2.0 cm²) burns out by 22 s (hi run 35 s). Stop reason "observed no-spread conditions". In the real test the flame quenched (Table 7.1); the simulation does not model how fast.
- **Calibrated:** nothing about the outcome. The verdict is an observation, not a model.
- **Extrapolated:** the concurrent rate (0.27 mm/s) is shown but not used; 2.2 cm/s is far below the 19–25 cm/s calibration box.

## 7. Where the predictor is calibrated and where it extrapolates

| Material, direction | Calibrated box (in domain) | Outside the box |
|---|---|---|
| PMMA, opposed, thick regime | burning half-thickness 1–5 mm, 3–21 cm/s, 17.1–22.1% O2, 0.97–1.03 atm | everything else, including all O2 above 22.1% and all pressures other than about 1 atm |
| PMMA, opposed, thin regime | half-thickness 0.5–1 mm, 2–10 cm/s, 17.4–19.1% O2, about 1 atm | films (< 0.5 mm), O2 above 19.1% |
| PMMA, concurrent, thick regime | observed bound only near 18–22 cm/s and 21.4–22.6% O2 | everywhere else (bound applied, flagged) |
| PMMA, concurrent, thin regime | none | `null`; the simulation assumes the opposed rate |
| SIBAL / cotton, concurrent | 19–25 cm/s, 21.2–26.9% O2, 76–102 kPa, 18.05–18.1 mg/cm² | everything else |
| SIBAL, opposed | none | `null`; the simulation assumes 0 |

On the 1 atm site grid, the in-domain cells are:
- PMMA 5 mm opposed: 45 of 546;
- PMMA 1 mm opposed: 10;
- SIBAL concurrent: 15;
- thick PMMA concurrent: 3;
- films and opposed SIBAL: 0.

## 8. Decisions and limits

See `README.md`, which has 19 decisions and the limits. The ones a reviewer should weigh first:

- **Decision 2.** One public paper was read through a web fetch without asking first. It supplies the concurrent law, its calibration points and the SIBAL burnout time.
- **Decision 15.** The per-regime opposed model was chosen after M6's driver analysis, so its gain over M6 is not blind.
- **Limit.** The concurrent law ≈ a constant on its own calibration data.

## Rebuild

- `build.py --clean` then `build.py` from scratch reproduced `data/spread_predictor.json` (202,673 B), `data/growth_examples.json` (35,841 B), `results.json`, the manifest and all plots **byte for byte**. `git status` was clean after the rebuild.
- M6's files and M6's `models.json` entry are unchanged: `git diff feat/m6-spread -- models/m6-spread data/models.json` is empty, and the entry hash is 2ea37cfc34d75942 on both branches.

## Check by hand

1. **`source/concurrent_reported.csv` against Olson et al. Table 1** (PDF p. 9; `python models/m6b-predictor/fetch_sources.py`). Check especially:
   - the Saffire II sample 6 flow (25 in the paper vs 20 in PSI-99);
   - Saffire V at 76 kPa and 26.9% O2.
2. **PSI-99 rows 2-5 and 2-6.** Read the "?-g Spread Length" column as the microgravity spread rate, and the blank material of 2-6 as SIBAL.
3. **The film point:** 3 cm/s and 21% O2 for the 2.2 mm/s test (FSJ 2016 pp. 115–116). The paper is explicit about 3 cm/s; 21% is from "Most conditions are kept similar".
4. **The SIBAL burnout time** "approximately 22 s" (Olson et al. p. 17) and its use as a per-cell burning duration.
5. **The no-spread placements** in `source/no_spread_placed.csv`, especially B14 (placed at 2 cm/s from "5 3 2 ext") and O22 (placed at 26.5 cm/s).
6. **Whether the team accepts** the concurrent calibration on `reported` flights (Decision 3), or prefers `null` concurrent rates until NASA data files hold them.
7. **The CV flame-state shape** in `CONTRACT_PROPOSAL.md` with the CV teammate. In particular, coordinates must be fuel-surface centimetres.
8. **Droplets.** M7 exports no K(conditions) table. Ask the M7 owner for one before the site shows droplet burnout times (`GROWTH_API.md` Step 0).
