# M7 report for the reviewer

Feature M7, extinction and cool flames. Branch `feat/m7-extinction`. Written 14 Nov 2026 by Claude Code (Claude Opus 5.5) for the M7 owner. All numbers come from `results.json`, written by `build.py`.

## Summary

| | Headline | 95% range | Baseline | Pass rule (RULES.md) |
|---|---|---|---|---|
| Will a droplet flame go out? (FLEX) | **AUC 0.90** | 0.84–0.95 | oxygen alone 0.81 | **R1 met** (needed ≥ 0.80, and the range low end above 0.81) |
| How fast does it burn? (FLEX) | **MAE 0.052 mm²/s**, R² 0.67 | 0.043–0.062 | d² law 0.079 (R² 0.39); per-fuel mean 0.104 | **R2 met** (beat both baselines in 20/20 repeats; needed 16) |
| Does it burn on after the visible flame goes out until the fuel is gone? (CFI) | **AUC 0.82** | 0.70–0.92 | pressure alone 0.78 | **R3 met** (range low end > 0.5) |

**One-sentence limit.** These are microgravity droplet results for two FLEX fuels and one CFI fuel family, inside the tested ranges. They say nothing about Moon or Mars gravity, and nothing about whether any atmosphere or material is safe.

**Above expectation.** RULES.md expected an extinction AUC of 0.80–0.87; we got 0.90. No median is above 0.95, so the formal leakage trigger did not fire. The leakage checks were still run (see "Leakage check" below) and found no leak.

## R1. Extinction (FLEX, PSI-69)

- **Rows.** 260 burns: 153 methanol, 107 heptane. 178 extinguished and 82 not. 80 test dates; 47 nominal atmospheres.
- **Split.** `StratifiedGroupKFold` with 5 folds, repeated 20 times (seeds 0–19), grouped by test date. Every one of the 100 folds asserts that no date is in both train and test.

| Model on the same splits | Median AUC | 95% session bootstrap |
|---|---|---|
| **Headline: nested choice among the three below** | **0.899** | 0.843–0.947 |
| Logistic regression, raw inputs + fuel interactions (C = 1) | 0.895 | 0.836–0.939 |
| Logistic regression, physics features (C = 1) | 0.896 | 0.838–0.940 |
| Gaussian-process classifier | 0.891 | 0.831–0.939 |
| Baseline: best single input (oxygen, picked inside each fold) | 0.806 | 0.712–0.884 |
| Baseline: majority class | 0.485 | (a constant per fold) |

- **Choices in the 100 outer folds:**
  - physics-feature logistic regression: 70;
  - Gaussian process: 15;
  - raw logistic regression: 15.
  - The model refitted on all burns is the physics-feature logistic regression with C = 10.
- **Calibration.** Brier score 0.111, against 0.216 for always predicting the training prevalence. The 5-bin calibration plot is `checks/extinction_roc_calibration.png`.
- **Drivers:** oxygen 56%, initial droplet size 19%, fuel 15%, CO2 5%, helium 5%, pressure 0%.

**Sensitivity and a stricter split** (same nested procedure; reported, not pass rules):

| Variant | Rows | Median AUC | 95% range | Note |
|---|---|---|---|---|
| S1: "Disruption" burns dropped | 205 | 0.891 | 0.800–0.956 | The label choice barely matters |
| S2: label = visible extinction diameter recorded > 0 | 195 | 0.925 | 0.781–0.993 | **Only 8 negatives**, so this score is not reliable |
| Whole nominal atmospheres held out (47 groups) | 260 | 0.901 | 0.837–0.951 | Not lower than the session split, against the expectation in RULES.md. Burns from the same atmosphere spread over several dates, so the session split was already strict. |

**Oxygen level where the model gives a 50% chance of extinction.**
- This is a model output (`status: model`), for a 3 mm droplet.
- The range comes from 200 session-bootstrap refits.
- These are not flammability limits and are reported here only.

| Fuel | Pressure | No added gas | 20% CO2 instead of N2 | 20% He instead of N2 |
|---|---|---|---|---|
| methanol | 0.7 atm | 22.4% (20.0–24.2) | 24.9% (22.9–26.9) | 26.5% (23.8–31.7) |
| methanol | 1.0 atm | 21.7% (20.3–23.4) | 24.0% (22.4–28.2) | 25.2% (22.8–30.9) |
| heptane | 0.7 atm | 20.1% (17.8–21.6) | 22.4% (20.5–24.0) | 23.1% (20.8–26.9) |
| heptane | 1.0 atm | 19.5% (18.7–20.9) | 21.7% (20.8–23.8) | 22.3% (20.6–26.9) |

How to read this table:
- In this model, putting 20% CO2 or He in place of N2 moves the 50% point up by about 2–3 O2 points.
- **CO2 and He cannot be told apart.** Their ranges overlap.
- In some bootstrap refits with He, the 50% point lies above 34% O2, the top of the tested range: methanol 0.7 atm in 5 of 200 refits, methanol 1 atm in 12, heptane 1 atm in 3. Those refits are left out of the range, so the upper ends of the He ranges are understated.
- The chance falls smoothly with oxygen; there is no sharp limit.
- For context only (`reported`, not checked): NASA's methanol paper (NTRS 20130014061) gives a limiting oxygen index of "around 12% to 13% oxygen by volume". That is the level where the flame cannot burn at all. Our 50% point is a different quantity: the oxygen level at which half the burns end in extinction.

**Suppressant summary** (`data/flex_suppression.json`, all 273 burns after removing the duplicate):

| Added gas | Burns | Ended in extinction |
|---|---|---|
| None (O2/N2 only) | 100 | 57 |
| CO2 | 123 | 88 |
| He | 50 | 40 |

FLEX aimed at near-limit conditions, so these shares follow the test plan. The file's `source` text says so.

## R2. Burning rate (FLEX)

| Model | Median MAE, mm²/s | 95% range | Median R² |
|---|---|---|---|
| **Headline: d² law × ridge correction** (α = 10 picked in all 100 folds) | **0.0516** | 0.0434–0.0617 | **0.67** |
| Baseline: d² law, one constant per fuel | 0.0791 | 0.0671–0.0931 | 0.39 |
| Baseline: per-fuel mean | 0.1044 | 0.0891–0.1213 | 0.02 |
| Textbook d² law, no fitted constant | 0.6036 | 0.5049–0.7100 | −29.3 |

- The R² is at the top of the expected 0.3–0.7.
- **Drivers:** oxygen 55%, helium 21%, droplet size 17%, CO2 7%, pressure 1%, fuel 0% (the d² baseline carries the fuel difference).
- **Fitted d² constants on all burns:** 0.63 × the textbook value 8/ρ_l for methanol, and 0.33 × for heptane (raw values 6698 and 4315 against 10690 and 13039 in the code's units).
  - So the textbook law, with 800 K gas properties, overpredicts methanol by about 1.6× and heptane by about 3×. Heptane's sooty, radiating flame is the expected cause, but that is not tested here.
- **d²-law consistency check** (155 extinguished burns): the measured burn time divided by (d0² − d_ext²)/K has a median of 1.05 (IQR 1.03–1.09).
  - So the table's K, diameters and burn times agree with each other within about 5%.
  - The extra 5% is consistent with the ignition period before steady burning.
- **Point ranges:** prediction × 0.72 to ×1.38, covering 95% of burns.

## R3. Cool flames (CFI, PSI-39; CFI-G, PSI-159)

**Why the target is the end state and not whether a cool flame appeared.**
- A missing cool-flame burning rate (`kcool`) usually means the droplet drifted out of the camera view. Crew comments:
  - FLEX-1214: "Droplet leaves FOVs shortly after cool flame burning starts".
  - FLEX-1229: "Hot flame radiatively extinguished, then burned with a cool flame" (no `kcool` recorded).
- A presence/absence classifier would have learned camera drift.
- The end state (`Dext,cool` = 0, the droplet used up, versus > 0) is measured for 117 burns. The CFI report explains it: "as the pressure is increased above approximately 2 atm, reignitions were commonly observed, eventually leading to complete combustion of the fuel droplet".

| Model | Median AUC | 95% session bootstrap |
|---|---|---|
| **Headline: logistic regression** (C picked inside each fold: C = 1 in 50 folds, 10 in 45, 0.1 in 5) | **0.824** | 0.698–0.916 |
| Baseline: best single input (pressure) | 0.781 | 0.632–0.906 |
| S3: burns with an extrapolated cool-flame extinction diameter dropped (85 rows) | 0.845 | 0.687–0.964 |

- **Drivers:** pressure 51%, fuel blend 34%, droplet size 9%, helium 5%, fibre 1%, oxygen 0%. Oxygen was only ever 17% or 21%.
- **Model fitted on all burns.** For a 4.3 mm free n-dodecane droplet in air, the chance of the droplet being used up passes 50% at about **3.2 atm**.
- The fuel-blend coefficient is negative: more iso-dodecane goes with "used up". That is an association within the CFI test plan, where the blends were run more often at high pressure. It is not a chemistry finding. The CFI report itself says iso-dodecane "reduces the tendency to form cool flames".

**Observed cases (the conditions where cool flames appear):**

| Pressure | He | Burns | Droplet used up | Median cool-flame extinction diameter when fuel was left |
|---|---|---|---|---|
| 0.5 atm | 0 | 8 | 0 | 3.39 mm |
| 0.75 atm | 0 | 9 | 0 | 0.90 mm |
| 1 atm | 0 | 22 | 3 | 0.52 mm |
| 1 atm | 0.29 | 7 | 0 | 3.92 mm |
| 1 atm | 0.59 | 3 | 0 | 2.54 mm |
| 1.25 atm | 0 | 10 | 4 | 0.46 mm |
| 2 atm | 0 | 11 | 9 | 1.56 mm |
| 3 atm | 0 | 22 | 18 | 0.89 mm |
| 3 atm | 0.29 | 5 | 4 | 0.38 mm |
| 3 atm | 0.59 | 5 | 3 | 3.21 mm |
| 5 atm | 0 | 7 | 6 | 0.19 mm |
| 5 atm | 0.29 | 4 | 1 | 1.55 mm |
| 5 atm | 0.59 | 4 | 0 | 0.26 mm |

- A cool-flame burning rate was measured in 124 of the 145 analysed CFI burns.
- **CFI-G:** cool flames are recorded in 7 rows, all 30% n-butane at 2.03 bar with XO2 0.39–0.40 (tests 21174 C3, C4, D1, F1, C6 and 21291 A1, C1).
- The CFI-G report: "These cool flames were observed only with the following conditions: a) concentrations of 30 vol% n-butane and 40 vol% O2, b) normal flames, c) a pressure of 2.03 bar, and d) mass flow rates between 0.75 – 1.5 mg/s."

## Leakage check (step 6)

- **Group overlap.** Asserted on every outer fold (100 per run). No session was ever on both sides.
- **Inputs.** Only pre-burn conditions are used.
  - FLEX: O2, CO2, He, pressure, initial diameter, fuel.
  - CFI: pressure, O2, He, initial diameter, fuel blend, fibre.
  - Excluded, because they are measured after ignition or define the label:
    - extinction diameters, burning rates, burn time, reignitions, `Extrap CF?`, radiometer columns, comments;
    - identifiers and dates.
- **Label permutation.** Shuffled labels sent through the same grouped splits give AUC 0.48 for extinction (max 0.57 over 20 shuffles) and 0.46 for cool flame (max 0.60). Real labels give 0.90 and 0.82.
- **Single inputs.** The best single input explains much of each score:
  - FLEX: oxygen alone 0.82; fuel 0.65; CO2 0.58; droplet size 0.56; He 0.56; pressure 0.51.
  - CFI: pressure alone 0.80; fuel blend 0.67; fibre 0.60.
  - No single input separates the classes, which is what a leaked column usually does.
- **Conclusion.** No leakage found. The extinction AUC sits above the expected range because oxygen is a strong single predictor and droplet size and fuel add to it.

## Pass rules: met or missed

| Rule | Target | Result | |
|---|---|---|---|
| R1 | median AUC ≥ 0.80 and range low end > single-input baseline | 0.899; 0.843 > 0.806 | met |
| R2 | MAE below the d² law and the per-fuel mean in ≥ 16/20 repeats | 20/20 | met |
| R3 | ≥ 10 per class from ≥ 3 sessions; range low end > 0.5 | 48/69 burns, 22/30 sessions; 0.698 | met |
| Expectation (not a rule) | extinction AUC 0.80–0.87 | 0.90 | above; checked for leakage, none found |
| Expectation (not a rule) | burning-rate R² 0.3–0.7 | 0.67 | inside |
| Expectation (not a rule) | atmosphere split lower than session split | 0.901 vs 0.899 | not lower |

## Decisions I made without you

The full list is in [README.md](README.md#decisions). The ones most worth a second look:
1. FLEX extinction label = NASA's `Test end` "Extinction", with "Disruption" counted as "did not go out" (S1 tests this).
2. Session = test date.
3. Cool-flame target = end state, not presence.
4. CFI-G is used for observed cases only.
5. The d² law uses 800 K gas properties and one fitted constant per fuel.

## Please check by hand

1. **What FLEX "Test end" means.** I found no public definition. If anyone in the team can ask NASA GRC or find a FLEX data note, confirm that "Disruption" is not a kind of extinction. If it is, S1 (0.89) is the safer headline.
2. **`m7/properties.csv`.** Each constant has a NIST or IUPAC URL; open two or three and check the value.
3. **Odd CFI entries:**
   - FLEX-1301 is dated 2017-07-29 between tests dated 06-29.
   - FLEX-1274A has a hot-flame extinction diameter (5.545 mm) above its initial diameter (4.67 mm).
   - The CFI report's Figure 3 caption gives FLEX-1268 as 12% O2; the spreadsheet says 21%.
4. **The site.** Run `python -m http.server` in the repo root and open the Predict and Respond pages.
   - Three M7 cards should show, plus the suppressant bars.
   - The banner should list two fewer missing files.
   - The extinction and cool-flame scatter plots show 0/1 outcomes against predicted chance. That is correct, but it is unusual to look at.
5. **Evidence check E5** ("Extinction model on held-out FLEX sessions") is owned by the evidence lane. Its value is AUC 0.90 (0.84–0.95), grouped by session. I did not edit `data/evidence.json`.
6. **Shared files touched** (yours to agree with the team; each is in its own commit):
   - `AGENTS.md`, `docs/plan.md` and `CLAUDE.md` copied into the repo;
   - `models/README.md`;
   - one appended row in `datasets/psi/MANIFEST.csv`;
   - `REFERENCES.md` and `AI_LOG.md` created.

## Reproducibility

`python models/m7-extinction/build.py --clean` was run from no outputs, then `python models/m7-extinction/build.py` again. The four output files had identical sha256 both times (recorded in the commit message of the outputs commit). Runtime was 699 s and 617 s on 8 cores.
