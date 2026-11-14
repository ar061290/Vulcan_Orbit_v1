# M6 pass rules

Written 14 Nov 2026, before any M6 model was fitted, and committed on its own. These rules are not edited after results are seen. Misses are reported as misses.

**What had been looked at before writing them.**
- The columns, row counts, ranges and session counts listed in `DATA.md`.
- One hand estimate of the de Ris thick-fuel formula, made while reading the paper: about 0.23 mm/s at 10 cm/s and 21% O2. It is several times the 0.03–0.07 mm/s printed in Table 5.1 at 10 cm/s.

No model had been fitted and no score computed.

## Data

- **Rows.** The 39 (test, velocity) pairs of Table 5.1 that have a measured spread rate. They come from 18 tests and 7 ISS sessions. All are PMMA slabs in opposed flow at about 1 atm.
- **Target.** Spread rate in mm/s.
- **Inputs** (the only columns any model may see):
  - thickness (mm);
  - width (cm);
  - sides burning (1 or 2);
  - opposed-flow velocity (cm/s);
  - O2 (vol%) for that segment.
- **Never inputs:**
  - spread rate, burn time, test id, sample id, session, segment number;
  - initial or final O2 on their own. They are used only to form the segment O2.
- **Segment O2.** O2 is assumed to fall linearly in time from the initial to the final value, and the listed velocity segments are assumed to have equal duration. Segment *k* of *n* gets O2 at time fraction (*k* − 0.5)/*n*.

## Physics baseline: de Ris, no fitted constant

- **Thin and thick formulas.** These are the published grouped coefficients of Bhattacharjee et al. (2016), Eq. (6). *F* is the de Ris flame coefficient and *τ* is the burning half-thickness in metres.
  - Thin fuel: V_f,thin = 2.34 × 10⁻⁸ · *F* / *τ*
  - Thick fuel: V_f,thick = 9.72 × 10⁻⁵ · V_g · *F*²
- **Burning half-thickness.** *τ* is half the thickness for a two-sided burn, and the full thickness for a one-sided burn. A one-sided slab on its backing behaves as half of a symmetric slab twice as thick.
- **Choosing thin or thick.** The formulas are chosen by thickness. The fuel is thin when *τ* is below *τ*_cr, the half-thickness at which the two formulas give the same speed, and thick above it. This is the same as taking the larger of the two values.
- **Flame coefficient at other O2 levels.**
  - *F* = (*T*_f − *T*_v)/(*T*_v − *T*∞), with *T*_v = 673 K and *T*∞ = 300 K.
  - At 21% O2, *F* = 4.89 (paper), which fixes *T*_f.
  - At other O2 levels, *T*_f − *T*∞ is scaled in proportion to the O2 mass fraction of the O2/N2 mixture (flame-sheet scaling).
- **Every property value** is in `source/properties.csv` with its source, marked `reported`.

## Learned correction

- **What it fits.** The target is the log ratio *r* = ln(observed / de Ris).
- **Prediction.** de Ris × exp(*r̂*).
- **Candidates, in order of simplicity:**
  - (a) **Calibrated de Ris:** a constant *r̂* equal to the training mean.
  - (b) **Linear regression** on the standardised inputs ln(thickness), ln(velocity), O2, sides and width.
  - (c) **Gaussian process:** ConstantKernel × RBF with one length scale per input, plus WhiteKernel, normalize_y, on the same 5 standardised inputs, 3 optimiser restarts.
  - (d) **Small gradient-boosted trees:** 100 trees, depth 2, learning rate 0.05, subsample 0.8, on the 5 raw inputs.
- **Seeds.** All are fixed at 0.

## Validation (V)

- **Primary split.** Leave one ISS session out: 7 folds, grouped by `GMT` day.
- **Why sessions and not samples.**
  - The O2 sensor was re-zeroed "for the day via a constant offset" (ReadMe). The crew, calibration and air-display readings are shared within a day.
  - Holding out whole days is therefore the stricter test.
  - 7 sessions is few but workable: each fold still trains on at least 26 points.
- **Secondary split.** Leave one test (sample) out, 18 folds, reported beside the primary.
- **Assertion.** The code asserts on every fold that no session (and no test) is on both sides.
- **Scores.** Each is computed on the pooled held-out predictions of all folds.
- **Score range.** A 95% session-bootstrap interval from 2000 replicates, seed 0. Sessions are resampled with replacement and the pooled metric is recomputed on their rows.
- **Point ranges** (`lo`, `hi`). The prediction × exp of the 2.5th and 97.5th percentiles of the pooled held-out log residuals of the chosen model.

## Model choice (C)

- The *best* candidate is the one with the highest primary held-out R².
- The **final** model is the simplest candidate, in the order a < b < c < d, whose held-out R² is at least the lower bound of the best candidate's R² range.
- This choice uses the same held-out predictions it reports, which makes it slightly optimistic. This is disclosed. A nested split is not possible with 7 sessions.

## Metrics and pass rules

Both metrics are on the primary split, for the final model.

- **R²**, computed in mm/s.
- **MAE** in **mm/s**.

| Rule | Pass condition |
|---|---|
| **P1, accuracy** | Held-out R² ≥ **0.60**. The plan expects about 0.6 to 0.7, the noise limit of such data, and nothing higher is promised. |
| **P2, beats the physics** | The final model's held-out MAE is below de Ris's MAE **and** its R² is above de Ris's R², on the same rows. |
| **P3, learned part earns its place** | If the final model is (b), (c) or (d), its R² must exceed the calibrated de Ris (a) R². If (a) is chosen, P3 is reported as "not applicable: no learned shape kept". |
| **P4, honest range** | The score range is reported. A lower bound below 0.3 is reported as a weakness, not hidden. |

## Drivers (D)

- **Method.** Permutation importance on held-out data. Each input is shuffled across all 39 rows, 50 repeats with seed 0. Each row is then predicted by the model of the fold that held it out, so that model never saw that row's session.
- **Full pipeline.** The shuffled input feeds both the de Ris formula and the correction.
- **Shares.** The rise in MAE is averaged, negative values are set to 0, and the result is normalised so the shares sum to 1.

## Leakage check (L)

- **Trigger.** If any held-out R² is above **0.90**, leakage is assumed until shown otherwise. Then all of the following are reported:
  1. group disjointness on every fold (also asserted on every run);
  2. the list of inputs, checked against columns that encode the spread rate;
  3. a target-permutation test: 20 shuffles of the target through the same split, where the mean R² should be at or below 0.
- **Always reported.** Checks 1 and 2 are reported on every run.

## Flammability view (F)

- **What is listed.** Observed no-spread, extinction, no-ignition and blow-off cases only. They are taken from the PSI-25 text columns (`real`) and from report Tables 7.1 and 2.1 (`reported`).
- **No boundary.** No boundary is fitted or drawn beyond the observed cases.
