# M7: extinction and cool flames

**Questions.**
- Will a burning fuel droplet's flame go out on its own?
- How fast does the droplet burn?
- After the visible flame goes out, can the droplet keep burning invisibly until the fuel is gone?

**Data.**
- NASA FLEX (PSI-69): droplet burns on the ISS.
- NASA CFI (PSI-39): cool-flame droplet burns.
- NASA ACME CFI-G (PSI-159): gas flames, observed cases only.
- Every column used, with its quoted meaning, is in [DATA.md](DATA.md). The pass rules, written before training, are in [RULES.md](RULES.md). The reviewer's report is [REPORT.md](REPORT.md).

**Rebuild.** `python models/m7-extinction/build.py --clean` takes 10–14 minutes on 8 cores and regenerates:
- `data/flex_suppression.json`;
- the `m7-*` entries in `data/models.json`;
- the manifest lines;
- `results.json` (every number below);
- `checks/*.png`.

Run it twice and the outputs are byte-identical. `fetch_extra.py` re-downloads the extra PSI files and checks their sha256.

## Results (whole ISS test sessions held out)

| Model (`data/models.json` id) | Metric | Score | 95% range | Baseline | Rule |
|---|---|---|---|---|---|
| Flame goes out, FLEX (`m7-extinction`) | AUC | **0.90** | 0.84–0.95 | best single input (oxygen) 0.81; majority 0.49 | R1 met |
| Burning rate K, FLEX (`m7-burning-rate`) | MAE, mm²/s | **0.052** | 0.043–0.062 | d² law (one constant per fuel) 0.079; per-fuel mean 0.104 | R2 met |
| Burns on until the fuel is gone, CFI (`m7-cool-flame`) | AUC | **0.82** | 0.70–0.92 | best single input (pressure) 0.78 | R3 met |

- The scores are medians over 20 repeats of 5-fold cross-validation grouped by ISS test date.
- The ranges are 95% session-bootstrap intervals.
- Burning-rate R² on held-out sessions: 0.67 for the model, 0.39 for the d² law.
- Suppressant counts (`data/flex_suppression.json`): no added gas 57/100 extinguished, CO2 88/123, He 40/50. These are counts, not a comparison of the gases; see Limits.

## Method

**Extinction (FLEX, 260 burns).**
- The label is NASA's `Test end`: "Extinction" (178) versus "Disruption" or "Completion" (82).
- Inputs: O2, CO2 and He fractions; pressure; initial droplet diameter; fuel.
- Inside every training split, an inner grouped CV picks one of three candidates:
  1. logistic regression on the raw inputs plus fuel interactions;
  2. logistic regression on physics features: inert heat capacity per mole of O2, O2 partial pressure, and gas conductivity/heat capacity relative to air;
  3. a Gaussian-process classifier.
- The physics-feature logistic regression won 70 of the 100 outer folds, the GP 15 and the raw logistic regression 15.
- Each candidate alone, on the same splits: 0.895, 0.896 and 0.891.

**Burning rate (FLEX, 256 burns).**
- Baseline: the quasi-steady d² law, K = C_fuel · (λ/c_p) · ln(1 + B), with NIST constants (`m7/properties.csv`) and one constant per fuel fitted on the training split.
- Model: that baseline multiplied by exp(ridge correction on the same six inputs). Ridge with α = 10 won every fold; the GP correction never did.
- With no fitted constant, the textbook law overpredicts K by a mean of 0.60 mm²/s, about twice the measured value. That bias is the reason for the per-fuel constant.

**Cool flame (CFI, 117 burns).**
- The label comes from NASA's analysis column `Dext,cool`:
  - **0** = the droplet was used up after the visible flame went out (48 burns);
  - **> 0** = the cool flame went out and left fuel (69 burns).
- Inputs: pressure, O2, He, droplet size, n-dodecane share of the fuel, support fibre.
- Model: logistic regression, with its strength chosen inside each split.

**Drivers** (permutation importance on held-out folds):
- Extinction: oxygen 56%, initial droplet size 19%, fuel 15%, CO2 5%, helium 5%, pressure 0%.
- Burning rate: oxygen 55%, helium 21%, initial droplet size 17%, CO2 7%, pressure 1%, fuel 0%. The d² baseline already carries the fuel difference.
- Cool flame: pressure 51%, fuel blend 34%, droplet size 9%, helium 5%, fibre 1%, oxygen 0%.

## Where cool flames appear (observed, no model)

**CFI droplets** (n-dodecane and n-dodecane/iso-dodecane, 3.8–6.4 mm, 0.5–5 atm, 17–21% O2, 0–59% He):
- A burning rate was measured for a cool flame following the visible flame's radiative extinction in **124 of 145** analysed burns. The rest mostly drifted out of the camera's view.
- At 0.5–0.75 atm in air, the cool flame always went out and left fuel (0/17 used up).
- At 2–5 atm the droplet was usually used up: 33/40 without helium (24/29 in air, 21% O2). The CFI report links this to repeated reignitions above about 2 atm.

**CFI-G gas flames:** the report states "These cool flames were observed only with the following conditions: a) concentrations of 30 vol% n-butane and 40 vol% O2, b) normal flames, c) a pressure of 2.03 bar, and d) mass flow rates between 0.75 – 1.5 mg/s."

**FLEX table:** it has no cool-flame flag. NASA's papers report cool flames after radiative extinction of large n-alkane droplets (NTRS 20140006750), but which FLEX rows had one cannot be told from the table.

## Limits

- **Microgravity only.**
  - FLEX: two fuels, 1.1–4.7 mm droplets, 0.7–3.1 atm, 12–34% O2.
  - CFI: one fuel family, 0.5–5 atm.
  - Nothing here applies to Moon or Mars gravity.
- **The FLEX outcome label is not defined in any public NASA document we found.**
  - Dropping "Disruption" burns gives AUC 0.89. Using "a visible extinction diameter was recorded" as the label gives 0.93, but with only 8 negatives, so that number is unreliable.
- **FLEX picked near-limit conditions on purpose**, so the shares in `flex_suppression.json` reflect the test plan. They do not show that one gas puts flames out better than another.
- **The O2 levels at 50% chance of extinction are model output** for 3 mm droplets inside the tested range (see REPORT.md). They are not flammability limits, and a low chance of extinction never makes an atmosphere safe.
- **"Used up" in CFI** includes droplets finished by a reignited hot flame. Whether a cool flame appears at all is not modelled.
- **The burning-rate model** underpredicts the fastest and slowest burns (see `checks/burning_rate_obs_pred.png`).

## Decisions

Judgement calls made without the owner. Each is printed by `build.py` and stored in `results.json`.

1. **Extinction label.** "Extinction" = 1; "Disruption" and "Completion" = 0.
   - Reason: it uses NASA's own label without reinterpreting it, and Disruption burns are mostly vigorous high-O2 burns, not near-limit extinction.
   - Sensitivity checks S1 and S2 in REPORT.md test the choice.
2. **Session = ISS test date.** The FLEX table has no session or chamber-fill id.
   - A stricter split that holds out whole atmospheres is also reported: AUC 0.90.
3. **Cool-flame target = end state, not presence.**
   - A missing `kcool` usually means the droplet left the camera view (crew comments for FLEX-1214, 1216, 1229 and others), so "no cool flame" cannot be read from the spreadsheet.
   - The end state (`Dext,cool` = 0 versus > 0) is measured, and the CFI report explains it.
4. **CFI-G is not modelled.**
   - `Cool flame?` is filled for 8 of 179 rows; blank means not assessed.
   - SE/FT is cut off by the test timer and the burner temperature limit.
5. **Cleaning** (no values filled in):
   - FLEX C11M201 (pressure listed as 0 mmHg) is left out of the models.
   - The duplicate 193F001 (#73) is dropped.
   - 13 burns without pressure or diameter are left out.
   - The FLEX file's en-dash cells count as missing.
6. **d² law constants.**
   - Gas properties are taken at a fixed 800 K.
   - Mixture conductivity uses Mason–Saxena.
   - The ambient temperature (25 °C) comes from the FLEX-2 table for the same chamber, because FLEX lists none.
   - One constant per fuel absorbs the choice of reference temperature.
7. **Nested model selection.** The headline score is that of the whole select-then-fit procedure, so picking the best of three candidates does not inflate it.
8. **Majority baseline.** The pooled AUC of per-fold constant predictions is 0.49, not exactly 0.5, because each fold predicts its own training prevalence. It is reported as computed.
9. **Burning-rate point ranges** = prediction × the 2.5th and 97.5th percentiles of all out-of-fold residual ratios (×0.72 to ×1.38). They cover 95% of burns by construction.
10. **Label-permutation check.** It runs on every build (shuffled labels, fast logistic model, same grouped splits), not only when an AUC is above 0.95. Extinction gave 0.48, cool flame 0.46.
11. **Build speed.** The CV folds run in parallel with one BLAS thread per process, which keeps results identical between runs. The full 20-repeat build takes 10–14 minutes (617–807 s over three runs), under the 15-minute limit in RULES.md, so all 20 repeats were kept.

## Files

| File | What |
|---|---|
| `build.py` | One command rebuilds everything |
| `fetch_extra.py` | Downloads the approved CFI spreadsheet and the two final reports |
| `m7/load.py` | Readers and cleaning |
| `m7/physics.py`, `m7/properties.csv` | d² law, mixture properties, cited constants |
| `m7/estimators.py`, `m7/cv.py` | Candidates, baselines, nested selection, grouped CV, bootstrap |
| `m7/extinction.py`, `m7/burning_rate.py`, `m7/cool_flame.py` | R1–R3 |
| `m7/outputs.py`, `m7/contract_check.py` | Contract-shaped writers, merge-safe `models.json`, exact-shape validator with a break-it-on-purpose self-test |
| `results.json` | Every number in this README and REPORT.md |
| `checks/` | ROC and calibration, P(extinction) vs O2, burning-rate obs vs pred, cool-flame end state by pressure |
