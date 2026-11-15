# M6: Flame spread over solids in microgravity (NASA BASS-II)

**Question.** How fast does a flame spread over a solid fuel in microgravity, given airflow speed, oxygen level, pressure and fuel?

**One command:**

```
python models/m6-spread/build.py
```

It runs in about 30 s and writes:
- the `m6` entry in `data/models.json`;
- the `models` line in `data/manifest.json`;
- `bass2_clean.csv`, `no_spread_cases.csv`, `results.json` and `checks/obs_pred.png`.

`--clean` removes only those outputs. `python models/m6-spread/fetch_sources.py` re-downloads the public NASA source documents and checks their hashes.

## Data

The full inventory is in `DATA.md`.

- **No spread-rate table in PSI.** NASA's PSI archive has no BASS-II spread-rate table. The only tabulated BASS-II spread rates are in **Table 5.1 of NASA's BASS-II Summary Report** (NASA/TM-20210011385, a PSI-25 file).
- **What M6 uses.** That table gives **39 measured spread rates, from 18 tests in 7 ISS sessions**:
  - PMMA slabs 1–5 mm thick, 1.2 or 2.2 cm wide, burning on one or both sides;
  - opposed flow at 2–21 cm/s;
  - 16.8–22.2% O2;
  - about 1 atm.
- **Joined to the PSI-25 table.** Session (GMT day), date and sample come from the PSI-25 experimental table. Its O2 values match the report for all 20 tests.
- **Where it lives.**
  - `source/table5_1_transcribed.csv`: hand transcription with page and file hash.
  - `source/properties.csv`: every de Ris property value with its source.
  - `bass2_clean.csv`: the cleaned table, handed to the flame-simulation stage 3.

## Method

1. **Physics baseline (de Ris, no fitted constant).**
   - The thin-fuel formula V_f = 2.34 × 10⁻⁸ *F*/*τ* or the thick-fuel formula V_f = 9.72 × 10⁻⁵ V_g *F*², chosen by burning half-thickness *τ*. Coefficients are from Bhattacharjee et al. (2016), Eq. (6).
   - *F* = 4.89 at 21% O2 (same paper). At other O2 levels, *F* is scaled through the flame temperature in proportion to the O2 mass fraction.
   - *T*_v = 673 K and *T*∞ = 300 K.
2. **Learned correction** of ln(observed/de Ris). Tried in order of simplicity:
   - (a) one constant;
   - (b) linear regression;
   - (c) Gaussian process;
   - (d) small gradient-boosted trees, depth 2.

   Inputs: thickness, width, sides, velocity and O2. Seeds are fixed.
3. **Validation.**
   - Primary: leave one ISS session out (7 folds).
   - Secondary: leave one test out (18 folds).
   - Ranges: 95% session bootstrap. Point ranges: from the pooled held-out log residuals.
4. **Model choice (rule fixed in advance).** Keep the simplest candidate whose held-out R² is at or above the lower bound of the best candidate's range.

## Scores

These are held-out scores, in mm/s. Rules are in `RULES.md`; full numbers are in `results.json` and `REPORT.md`.

| Model | R², sessions held out [95% range] | MAE (mm/s), sessions held out | R², tests held out |
|---|---|---|---|
| de Ris, no fit (baseline) | −40.0 [−225, −11.4] | 0.163 | n/a (no fitting) |
| **(a) de Ris × one constant (kept, by the rule)** | **−0.68 [−3.87, −0.14]** | **0.033** | −0.77 |
| (b) de Ris × linear correction | 0.26 [−2.28, 0.58] | 0.019 | 0.46 |
| (c) de Ris × Gaussian-process correction | 0.01 [−5.10, 0.76] | 0.021 | 0.66 |
| (d) de Ris × boosted-tree correction | 0.33 [−2.34, 0.81] | 0.019 | 0.60 |

- **Misses the target.** The headline (a) misses the 0.6 target.
- **Why (a) was kept.** The best candidate (d) has a range reaching −2.3, so the pre-set rule keeps the one-constant model. The rule was not changed after the results were seen.
- **Single tests vs whole sessions.** Holding out single tests, the flexible corrections reach about 0.6–0.66. But whole held-out sessions differ in width and O2 from the rest, and there they do not hold up.
- **Drivers of the kept model** (permutation on held-out data):

  | Input | Share |
  |---|---|
  | Fuel thickness | 0.79 |
  | One or two sides burning | 0.21 |
  | Flow speed, O2 and width | 0 |

  Shuffling flow speed or O2 through the de Ris formula does not raise the held-out error.

## Limits

- **Narrow scope.** PMMA slabs in opposed flow only.
  - Thin films, rods and fabric have spread rates only as figures, which were not digitised.
  - There is no concurrent-flow spread rate.
  - There is no pressure variation: every test was at about 1 atm and pressure is not recorded per test.
- **O2 per flow step is estimated**, assuming linear decay and equal step lengths. Only start and end readings exist.
- **The de Ris formula over-predicts these slabs about 3.5-fold** with published constants. Heat loss to the holder or backing, finite width and near-limit low flows are possible reasons. These are not tested here.
- **Small data.** 39 points from 7 sessions, and one session holds 13 of them, so every range is wide.
- **Microgravity only.** Nothing here applies to Moon or Mars gravity.
- **No safety claims.** A slow predicted spread does not make a material or atmosphere safe.

## Decisions

1. **Branch.** `feat/m6-spread` was made from `feat/m6-flame-spread`, which holds M7 plus `main` at 06aeff3, as the person decided. It is not pushed or merged. `feat/m6-flame-spread` on GitHub was left as it was.
2. **Spread-rate source.** PSI has no BASS-II spread-rate table, confirmed from the full PSI-25 file list and the BASS-II ReadMe. The person approved downloading NASA's BASS-II Summary Report from PSI-25, and Table 5.1 of that report was used.
   - It was transcribed by hand from the rendered page.
   - `build.py` checks that O2, thickness and width agree with NASA's PSI-25 table.
   - The other BASS-II spread rates (thin films, rods, fabric) are printed only as graphs. They were **not** digitised: values read off a graph would be our readings, not NASA's numbers.
3. **Status label.**
   - The `models.json` status is one per file and shared with M7, and `CONTRACT.md` has no per-entry status. The file stays `"real"`, as the person's brief asked.
   - The spread rates are NASA's own flight measurements from NASA's PSI archive, but they were taken from a report table rather than a data file. The de Ris constants are `reported` (from papers). The entry's `data` and `method` text say this.
   - If the team wants a separate `reported` label for M6, that needs a contract change, which is for the lead to decide.
4. **Branch-name mismatch.** The brief named the branch `feat/m6-spread`, while the earlier conversation created `feat/m6-flame-spread`. Both point at the same base, and M6 work is only on `feat/m6-spread`.
5. **Validation grouping.** Primary grouping is by ISS session (GMT day), not by sample. The O2 sensor was offset-corrected "for the day" (ReadMe), so readings within a day share an error. Leave-one-test-out is reported as the secondary split.
6. **Segment O2.** The table gives O2 only at the start and end of each test. Each flow step gets the O2 at its midpoint, assuming linear decay (the report's own approach in §5.4) and equal step durations.
7. **Burning half-thickness.** For a two-sided burn it is half the slab. For a one-sided burn it is the full slab: one face is on a backing, so the slab acts as half of a symmetric slab twice as thick.
8. **O2 dependence of *F*.**
   - Only *F* at 21% O2 is published (4.89). *T*_f − *T*∞ is scaled with the O2 mass fraction of an O2/N2 mixture (flame-sheet scaling).
   - *T*∞ = 300 K is the value the same report uses for the MSG gas (§1.5). *T*_v = 673 K is from Bhattacharjee et al. (2016, Combust. Flame) and the report §2.2.
9. **Individual properties.** The paper prints density, specific heat and conductivity only inside the two grouped coefficients. The individual values are left `null` in `source/properties.csv` rather than filled with "typical" numbers.
10. **Model choice.** The rule fixed before training picked (a). It was applied as written, not overridden, even though (b) and (d) score higher.
11. **Entry id.** The id is `"m6"`, as the brief specifies (M7 uses `m7-*`).
12. **Shared files I did not touch.**
    - `datasets/psi/MANIFEST.csv`: it is outside M6's allowed files. Instead, provenance (URLs, sha256) is in `DATA.md` and `fetch_sources.py`.
    - `models/README.md` features table: also outside M6's files.
13. **Manifest line.** In `data/manifest.json`, the `models` line keeps status `real`. Its `what` text now names M6 and M7.
14. **Flammability view.**
    - It lists PSI-25 tests whose flow text contains "ext", "extinguished", "blowoff", "no ign", "would not stay lit" or "out", word for word.
    - O2 readings that are impossible as printed (for example "20.8 to 0.6") are flagged, never corrected.
    - From report Table 7.1, only rows with an outcome comment (no ignition, quenched, blow-off, no blow-off) are listed.
15. **Unrelated upload.** Of the three papers the person uploaded, `amin2017.pdf` (soot in ethylene counterflow flames) is unrelated to BASS and was not used. The two Bhattacharjee papers are kept in `datasets/raw/m6/` (git-ignored, paywalled, never committed).
16. **Disclosed in `RULES.md`.** One hand estimate of the de Ris value was made while reading the paper, before the rules were written.
