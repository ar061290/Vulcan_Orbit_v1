# M6b pass rules

Written 14 Nov 2026, before any M6b model was fitted, and committed on its own ("M6b: rules before fitting"). These rules are not edited after results are seen. Misses are reported as misses.

**What had been looked at before writing them.**
- The ranges, counts and source rows in `DOMAIN.md`, and M6's published results (`models/m6-spread/REPORT.md`).
- While planning, the agent made two rough mental estimates. Neither was computed by code and neither changed a rule:
  1. A single concurrent constant from the six reported flights would put Saffire-II near 2.9 mm/s (measured 2.1 and 2.6).
  2. The thin-regime slab rows sit near half of de Ris, which would put the 100 µm film near 1.1 mm/s (measured 2.2).

No model had been fitted and no score computed.

## 1. Opposed flow, PMMA (calibration on BASS-II slabs)

- **Rows.** The 39 measured rows of `models/m6-spread/bass2_clean.csv` (M6, unchanged). Inputs: thickness, sides burning, opposed velocity, segment O2. Pressure 1 atm.
- **Physics.** M6's de Ris baseline, re-implemented from `models/m6-spread/build.py` and checked to equal the file's `de_ris_mm_s` column within 1e-4 mm/s. Regime per row by M6's rule (thin when τ < τ_cr).
- **Pressure** (only through the physics). Thick formula ∝ ρ_g ∝ P; thin formula independent of P. Every BASS-II row is at about 1 atm, so any other pressure is flagged as extrapolation.
- **Model (kept, no alternatives).** One factor per regime: f_thin, f_thick = exp(mean of ln(observed / de Ris)) over the training rows of that regime. If a training fold has no row of a regime, that regime uses the pooled factor over all training rows (stated if it happens).
- **Baselines, same split:**
  - (B1) raw de Ris, no fit;
  - (B2) M6's model: de Ris × one constant over all rows.
- **Split.** Leave one ISS session out (7 folds, `session` column). The code asserts on every fold that no session or test is on both sides.
- **Shipped range.** prediction × exp(2.5th, 97.5th percentile of the pooled leave-one-session-out held-out log residuals, all 39 rows).
- **Nested coverage (honest test of the range).** For each held-out session S:
  1. Fit the factors on the other sessions.
  2. Build a range from the leave-one-session-out residuals *of those other sessions only* (inner loop, same percentiles).
  3. Check whether each row of S falls inside.

| Rule | Metric | Pass condition |
|---|---|---|
| **R1** | Pooled held-out MAE (mm/s), session split | ≤ **0.033** (M6's one-constant MAE, 0.0329) |
| **R2** | Nested range coverage on the 39 rows | ≥ **80%** |

Both are reported beside B1 and B2, with a 95% session-bootstrap range (2000 replicates, seed 0) on the MAE.

## 2. Concurrent flow, thin cellulose fabric (calibration on reported flights)

- **Law** (Olson et al., refs 8 and 24 therein; status `reported`): V_f = K · U · X_O2 · (P / 101.325 kPa)^½ · (18.05 mg/cm² / area density).
  - U is the free-stream flow (cm/s).
  - X_O2 is the O2 mole fraction.
  - **The law has no published constant, so it cannot be run uncalibrated.** K is fitted.
- **Rows.** The six `role = calibration` rows of `source/concurrent_reported.csv`. The Saffire-II rows never enter.
- **K** = exp(mean ln(V_obs / law with K = 1)).
- **Split.** Leave one flight out (6 folds; each row is its own flight/test).
- **Baseline.** Mean spread rate of the training rows (trivial predictor), same split.
- **Shipped range.** prediction × exp(min, max) of the 6 leave-one-out log residuals. Percentiles are meaningless at n = 6.
- **Nested coverage.** Each held-out row's range comes from the min/max of the inner leave-one-out residuals of the other 5 rows.

| Rule | Metric | Pass condition |
|---|---|---|
| **R3** | Nested coverage on the 6 rows | ≥ **80%** (that is, at least 5 of 6). Held-out MAE in mm/s reported beside the baseline. |

## 3. Independent checks (data the calibration never saw)

| Rule | Check | Pass condition |
|---|---|---|
| **R4a** | Saffire-II SIBAL 2-5 and 2-6 (PSI-99, `real`), predicted with K from all six rows. Inputs: 20 cm/s (PSI-99), X_O2 = 0.221, P = 103 kPa (reported, Olson et al.), 18.05 mg/cm². | **Both** measured rates inside the shipped range. Each prediction, its range and its error are reported. Sensitivity (not scored): 2-6 at 25 cm/s, the flow Olson et al. print. |
| **R4b** | 100 µm PMMA film (reported): 3 cm/s, 21% O2, two-sided, 99.35 kPa. Predicted with f_thin from all 39 rows. | Measured 2.2 mm/s inside the shipped range. Raw de Ris reported beside it. The film is thinner than any calibration row, so a miss is reported as "do not apply the slab factor to films" and films stay `in_domain: false`. |

The code asserts that no check row is in any calibration set.

## 4. Will it spread at all (verdict rule V)

- **Cases.** `source/no_spread_placed.csv` (20 cases with a numeric flow at the outcome). Real and reported are kept apart in every output.
- **Match key.** material + flow direction + geometry class:
  - film: PMMA under 0.5 mm;
  - slab: PMMA 0.5 mm and over;
  - rod: not modelled, never matched;
  - fabric: SIBAL.
- **Observed no-spread box** for a case with flow [Ulo, Uhi] and O2 [Olo, Ohi]:
  - O2 in [Olo − 0.5, Ohi + 0.5];
  - flow in [max(0, Ulo − max(0.5, 0.1·Ulo)), Uhi + max(0.5, 0.1·Uhi)].
- **Near observed extinction box:**
  - O2 in [Olo − 1.5, Ohi + 1.5];
  - flow in [max(0, Ulo/2 − 0.5), 2·Uhi + 0.5].
- **Precedence.** Observed no-spread, then near, then "spreads". "Spreads" means only that no observed no-spread case is near; it is not a claim that the input is flammable or safe.
- **Why these distances:**
  - ±0.5 cm/s is the velocity uncertainty NASA/TM-20210011385 Table 2.1 prints. The air display "Response time is very slow (~ 1 min)" (BASS-II ReadMe).
  - O2 falls 0.4–3 points within one BASS-II test (PSI-25 initial vs final), so ±0.5 is the reading itself and ±1.5 is a typical in-test drift.
  - A factor of 2 in flow is the largest within-test change in spread rate seen in the last steps before extinction in BASS-II (M17: 0.053 to 0.026 mm/s; M18: 0.026 to 0.013 mm/s).
- **No boundary** is drawn beyond these boxes, and nothing is inferred from monotonic trends.

## 5. Spread rates used by the growth simulation

| Material, direction | Rate (lo / mid / hi) | Label |
|---|---|---|
| PMMA, opposed | calibrated de Ris (§1) with the shipped range | calibrated |
| PMMA thick regime, concurrent | 0 / 0 / 10 cm ÷ 600 s = 0.167 mm/s (PSI-99 2-8: flame anchored, ~10 cm damage in 600 s) | observed bound, in domain only near 20 cm/s and 22% O2 |
| PMMA thin regime, concurrent | `null` (no data). The simulation uses the opposed rate. | assumed |
| SIBAL, concurrent | §2 with its shipped range | calibrated |
| SIBAL, opposed | `null` (no data, no model). The simulation uses 0. | assumed |

## 6. Growth simulation and its checks

- **Grid.** The fuel surface is W × L cm, with x along the length and y across.
- **Cell size.** dx = min(0.25 cm, L/200, W/4), square cells; the first value is the default.
- **Initial burning region.** An ellipse centred on the CV centroid, with the bounding-box aspect ratio, scaled to the CV area and clipped to the fuel. If no cell centre falls inside, the centroid's cell is used.
- **Front.** The burning region grows with a convex spread shape made of two half-ellipses sharing the cross-flow axis:
  - downwind semi-axis V_c, upwind semi-axis V_o, cross-flow semi-axis V_s = (V_c + V_o)/2;
  - arrival time of a cell = min over initial cells of the shape's gauge distance (exact Huygens propagation for a convex shape on a convex fuel);
  - the front at time t is the set of cells with arrival time ≤ t;
  - zero flow: isotropic with the opposed formula's rate at U = 0.
- **Verdict "observed no-spread".** No cell outside the initial region ever ignites.
- **Burnout.** A cell burns from its arrival time for t_b:
  - SIBAL 22 s (high-area run 35 s);
  - PMMA: burning half-thickness ÷ regression, with regression 0.04 / 0.02 / 0.01 mm/s for the lo / mid / hi runs (0.02 = geometric mean of the PSI-99 range).
- **Runs.** lo = low spread + fast burnout; mid = central; hi = high spread + slow burnout. This gives an area envelope.
- **Stop reason:**
  - "observed no-spread conditions" when that verdict holds;
  - otherwise "fuel edge" when every fuel cell is reached;
  - otherwise "burned out" (growth stopped inside the fuel and everything lit burned out).

| Check | Pass condition (every one must pass) |
|---|---|
| **G1, hand calculation** | PMMA slab 1 mm, two-sided, strip 1 × 20 cm, flow 0, 21% O2, 1 atm, flame bbox [0, 0, 0.5, 1] cm. On the centre row, at t = 25%, 50% and 75% of the time to reach x = 20 cm: the front position (cell centre + dx/2) differs from x_e + V·t by ≤ dx. x_e is the downstream edge of the initial cells on that row; V is the predictor's mid rate. Zero flow is extrapolation (`in_domain: false`); G1 checks kinematics only. |
| **G2, fuel edge** | Same strip run to the end: every fuel cell is reached; the last cell reached is the last column (x = L − dx/2); no ignited cell lies outside [0, L] × [0, W]; the stop reason is "fuel edge"; the burning area is 0 at the end. |
| **G3, no-spread** | For every placed case of a modelled geometry (film 0.1 mm, slab 2 mm, SIBAL fabric), at its central flow and O2: the area ever ignited equals the initial area and the stop reason is "observed no-spread conditions". |
| **G4, non-negative** | The burning area is ≥ 0 at every time for the 3 worked examples and 200 random inputs (seed 0; material, thickness, flow 0–50 cm/s, flow direction 0–360°, O2 15–35%, fuel 1–40 × 2–100 cm, flame inside the fuel). |
| **G5, monotone in length** | For the same 3 + 200 inputs, doubling the fuel length (flame at the same absolute position) never lowers the maximum area of the lo, mid or hi run (tolerance 1e-9 cm²). |

**Reported, not scored:**
- lo ≤ mid ≤ hi maximum area;
- the simulated end time of the Saffire-II-layout example against PSI-99's burn times (145 s and 115 s).

## 7. Outputs

- `data/spread_predictor.json` and `data/growth_examples.json`, status `model`, in the shapes proposed in `CONTRACT_PROPOSAL.md`.
- Seeds fixed at 0. One command: `python models/m6b-predictor/build.py`.
