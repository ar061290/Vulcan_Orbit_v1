# M7 pass rules

Written 14 Nov 2026, before any M7 model was fitted, and committed on its own. These rules are not edited after results are seen. Misses are reported as misses.

What was looked at before writing them:
- class counts per table;
- the CFI end state counted by pressure;
- column meanings.

All of it is recorded in `DATA.md`. No model, baseline or score had been computed.

## Shared procedure (R1–R3)

- **Groups.** A group is a test session, meaning one test date.
  - FLEX: `Test Date`, 80 groups.
  - CFI: Master Sheet `Test Date`, 39 groups.
  - The code asserts that no group is ever in both the training and test part of a split.
- **Outer split.** `StratifiedGroupKFold(n_splits=5, shuffle=True)`, repeated 20 times with seeds 0–19.
  - Classification stratifies on the label; regression stratifies on fuel.
  - The repeats can be cut to 10 if one full build takes longer than 15 minutes. That changes only the precision of the range, not any rule.
- **Inner selection.** Inside each outer training part, `StratifiedGroupKFold(n_splits=4, shuffle=True)` picks among the candidates listed per model.
  - The pick is by pooled inner AUC for classifiers and pooled inner MAE for regression.
  - The headline score is therefore the score of the whole procedure, selection included.
- **Score.** The median, over the 20 repeats, of the metric computed on the pooled out-of-fold predictions of that repeat.
- **Score range.** A 95% session-bootstrap interval from 2000 replicates.
  - Replicate *b* resamples sessions with replacement and computes the metric for repeat *b* mod 20 on the resampled rows.
  - A replicate with only one class is redrawn.
- **Point ranges** (`lo`, `hi`):
  - Classifiers: the 2.5th and 97.5th percentiles of the row's 20 out-of-fold probabilities. `pred` is their median.
  - Burning rate: `pred` × exp of the 2.5th and 97.5th percentiles of all pooled out-of-fold log residuals.
- **Drivers.**
  - Each raw input is permuted 5 times on every outer test fold of the headline procedure.
  - The loss in AUC (or rise in MAE) is averaged, negative values are set to 0, and the shares are normalised to sum to 1.
- **Leakage trigger.** If any headline AUC is above 0.95, all of the following are run and reported. (1) is asserted on every split regardless.
  1. The group-overlap check.
  2. The list of inputs, checked against outcome-derived columns.
  3. A label-permutation test: 20 label shuffles through the same outer CV, where the mean AUC should be about 0.5.
  4. The AUC of each single input.
- **Seeds.** All random seeds are fixed.

## R1. Will a droplet flame go out? (FLEX, PSI-69)

- **Rows.** The 260 FLEX burns with pressure, composition and initial diameter.
- **Label (primary).** 1 = `Test end` is "Extinction"; 0 = "Disruption" or "Completion".
- **Inputs.** O2, CO2 and He mole fractions; pressure (atm); initial diameter (mm); fuel (heptane = 1, methanol = 0). N2 is the balance.
  - Never inputs: extinction diameter, burning rate, burn time, test end, identifiers, date.
- **Candidates for inner selection:**
  - (a) Logistic regression, L2, on the standardised inputs plus heptane×O2 and heptane×d0, with C ∈ {0.1, 1, 10}.
  - (b) Logistic regression, L2, on physics features, with C ∈ {0.1, 1, 10}. The features:
    - inert molar heat capacity per mole of O2, using N2, CO2 and He c_p at 800 K;
    - O2 partial pressure (atm);
    - mixture k/c_p relative to air (800 K);
    - d0, heptane and heptane×d0.
  - (c) Gaussian-process classifier: ConstantKernel × Matern(ν = 1.5, one length scale per input) on the 6 standardised raw inputs.
- **Baselines.**
  - Majority class (AUC 0.5 by construction).
  - Single-variable rule: the single input with the best training-fold AUC, with a 1-D logistic fit, chosen inside every outer training part.
- **Metric.** ROC AUC. Also the Brier score next to the no-skill Brier score (training prevalence).
- **PASS R1:**
  - the median AUC is at least **0.80**, AND
  - the lower end of the score range is above the single-variable baseline's median AUC.
  - Expected: 0.80 to 0.87.
- **Reported, not pass rules:**
  - (a), (b) and (c) each with fixed settings (C = 1) on the same splits.
  - **S1:** drop "Disruption" burns.
  - **S2:** label = visible-flame extinction diameter recorded > 0 mm; burns without a recorded value are dropped.
  - **Stricter split:** whole nominal atmospheres held out (47 groups). Expected lower than R1.

## R2. How fast does the droplet burn? (FLEX, PSI-69)

- **Rows.** The R1 rows that have a burning rate (256).
- **Target.** K, the burning-rate constant in mm²/s.
- **Baselines.**
  - Per-fuel training mean.
  - **d²-law:** K = C_fuel × (λ/c_p)_mix × ln(1 + B), where B = (Y_O2 × LHV / ν_O2 + c_p,mix × (T∞ − T_boil)) / h_fg.
    - Y_O2 is the ambient O2 mass fraction and ν_O2 the stoichiometric O2-to-fuel mass ratio.
    - The mixture gas properties are at 800 K; λ_mix uses the Mason–Saxena rule.
    - Every constant is in `m7/properties.csv`.
    - One constant C_fuel per fuel is fitted by least squares on the training part only.
- **Model.** d²-law × exp(f(inputs)), with f fitted to log(K / K_d²) on the R1 inputs.
  - Candidates: Ridge with α ∈ {0.1, 1, 10}, or a Gaussian-process regression (Matern with one length scale per input, plus a white-noise term).
  - Chosen by inner grouped MAE.
- **Metric.** MAE in mm²/s. R² is also reported.
- **PASS R2:** the model's MAE is below both the d²-law MAE and the per-fuel-mean MAE in at least **16 of the 20** repeats.
  - Expected R²: 0.3 to 0.7.
- **Reported, not pass rules:**
  - The textbook d² law with no fitted constant (8λ/(ρ_l c_p) ln(1 + B)).
  - A consistency check: measured burn time against (d0² − d_ext²)/K.

## R3. After the visible flame goes out, does the droplet keep burning until the fuel is gone? (CFI, PSI-39)

- **Rows.** The 117 analysed CFI burns with both the hot- and cool-flame extinction diameters recorded.
- **Label.** 1 = `Dext,cool` recorded as 0 (droplet used up); 0 = `Dext,cool` > 0 (the cool flame went out and left fuel).
- **Inputs.** Pressure (atm), O2 and He mole fractions, initial diameter (mm), n-dodecane mass fraction of the fuel, fibre (1/0).
  - Never inputs: hot- or cool-flame extinction diameter, khot, kcool, reignitions, `Extrap CF?`, radiometer columns, burn time, comments.
- **Condition for fitting a classifier.** At least 10 burns per class, drawn from at least 3 sessions each.
  - Counted before fitting: 48 burns from 22 sessions, and 69 burns from 30 sessions. The condition is met.
- **Model.** Logistic regression, L2, with C ∈ {0.1, 1, 10} chosen by inner grouped CV.
- **Baselines.** Majority class; the single-variable rule as in R1.
- **Metric.** ROC AUC.
- **PASS R3:** the lower end of the score range is above **0.5**.
  - Expected: high, because the CFI report ties complete consumption to pressures above about 2 atm. An AUC above 0.95 triggers the leakage checks.
- **Reported, not a pass rule. S3:** drop the burns flagged `Extrap CF? = 1`.

## R4. Suppressant summary (`data/flex_suppression.json`)

- Counts of FLEX burns and of "Extinction" outcomes, grouped by added gas: none (O2/N2 only), CO2, He.
- There is no pass rule; these are counts.
- The file says that the shares reflect the near-limit test plan, not a controlled comparison of the gases.
