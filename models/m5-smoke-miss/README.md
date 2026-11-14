# M5 smoke miss risk (NASA SAME-2 / SAME-R)

**Question.** Will a light-scattering smoke detector (the ISS type) see this smoke? A case counts as **likely missed** when
more than half of its smoke mass is in particles finer than the detector's sensitive size (500 nm headline; 300 and
1000 nm reported). The label was fixed in `RULES.md` before any per-test data was read.

```
python models/m5-smoke-miss/extract.py path/to/20130000422.pdf   # optional: re-read Figures 6-8 into traced.csv
python models/m5-smoke-miss/build.py                             # trains, checks, writes data/smoke_sizes.json and the models.json entry
```

## Data
- **Urban et al. 2012, AIAA 2012-3536 (NASA NTRS 20130000422).**
  - Table 1: Dg, count mean diameter, diameter of average mass and sigma_g for 5 materials, unaged and aged 720 s
    (baseline runs, 8 cm/s). Transcribed into `table1.json` and checked against the PDF page image.
  - Figures 6 to 8: 16 individual flight tests (4 lampwick, 7 Kapton, 5 Teflon) at 0 to 8 cm/s air velocity.
- **Why not the 109-row PSI-101 table?** It holds test conditions only. NASA has not published per-test sizes as a table,
  so the 16 plotted tests are the per-test data that exist.
- **How the figures were read.** The figures are vector drawings, so `extract.py` reads every marker's exact position
  from the PDF's drawing commands; nothing is traced by eye.
  - Axes are calibrated from the tick labels.
  - Series are identified by marker colour against the legend.
  - Points at the same air velocity are paired into tests by requiring each test's four values to obey the lognormal
    (Hatch-Choate) relations.

## Method
- Label per test: mass median diameter MMD = CMD x (DAM/CMD)^2.5 (lognormal, Hatch-Choate); missed if MMD < 500 nm.
- Model: logistic regression (scikit-learn 1.9.1, L2, C = 1, balanced classes) on material (one-hot) and air velocity.
  All 16 tests are unaged, so aging is not a model input; its effect is reported from Table 1.
- Validation: leave one flight test out (16 folds); 95 % ranges from 2,000 bootstrap resamples (seed 42).
- Baselines: majority class; material only (Table 1's per-material result).

## Results
| | Score | Range | Pass rule | |
|---|---|---|---|---|
| AUC, leave-one-test-out | 0.746 | 0.44 to 1.00 | >= 0.75 | **fail (by 0.004)** |
| Balanced accuracy | 0.762 | 0.53 to 0.94 | >= 0.70 and >= material-only | pass |
| Material-only baseline (Table 1) | balanced accuracy 0.746 | | | |
| Majority class | 0.50 | | | |

- **Drivers.** Air velocity 76 %, material 24 % (permutation importance). Faster air past the sample gives finer smoke:
  Kapton at 2 to 4 cm/s is mostly large enough, and at 8 cm/s it is mostly too fine.
- **Per material, from Table 1.** Share of smoke mass finer than 500 nm:
  - Kapton: 82 % (81 % aged)
  - Teflon: 48 % (32 % aged)
  - Lampwick: 32 % (30 % aged)
  - Pyrell: 20 % (14 % aged)
  - Silicone: 9 % (8 % aged)

## Checks (RULES.md)
- **M5-trace: pass.**
  - Axis fit within 0.02 % of range.
  - Every test's Dg and sigma_g rebuilt from its own moments within 0.05 %.
  - Cross-check: the four Kapton tests drawn at the same 8 cm/s position average to Table 1's Kapton row exactly
    (CMD 0.056, DAM 0.101 um).
- **M5-lognormal: fail.** 9 of 10 Table 1 rows reproduce within 1 %, but Teflon unaged is off by +9 % and +21 %. The PDF
  image shows the same numbers, so this is in the paper itself, not a transcription error.
- **M5-auc: fail** (0.746 vs 0.75). **M5-bacc: pass**, but only 0.016 above the material-only baseline, which is well
  inside the range.
- **M5-sens.** At 300 nm: AUC 0.85, balanced accuracy 0.81, material-only 0.85. At 1000 nm, only 2 of the 16 tests
  count as "seen", so the scores mean nothing.

## Limits
- 16 tests, 3 materials, unaged smoke, 0 to 8 cm/s. The model does not reach past these.
- The "sensitive size" of a light-scattering detector is not one agreed number; the label depends on it.
- On this data the model barely beats knowing the material. Its use is showing *how airflow shifts* the risk, not a
  better classifier.
- This is not a detector certification, and it does not say station detectors fail in general. The documented weakness
  is fine smoke from specific materials (Kapton, Teflon).
