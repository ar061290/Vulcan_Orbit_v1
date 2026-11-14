# M5 smoke miss risk: pass rules (written before any model is trained)

## Question
Will a light-scattering smoke detector (the ISS type) see this smoke, given the material and conditions?

## Data
- NASA SAME-2 / SAME-R flight results, Urban et al. 2012, AIAA 2012-3536 (NTRS 20130000422):
  - Table 1: geometric mean diameter Dg and geometric standard deviation sigma_g for 5 materials, unaged and aged 720 s.
  - Figures 6 to 8: per-test Dg and sigma_g against air velocity (0 to 8 cm/s) for lampwick, Kapton and Teflon,
    traced from the figure (digitised). Tracing error is measured and reported (check M5-trace).
- NASA PSI-101 (SAME-R test table, doi in datasets/psi/MANIFEST.csv): test conditions only; it has no sizes.

## Label (fixed now, before seeing per-test data)
- Smoke is lognormal (the papers' own assumption, checked in M5-lognormal). Mass median diameter
  MMD = Dg * exp(3 (ln sigma_g)^2).
- A case is **likely missed** when more than half of its smoke mass is in particles smaller than the detector's
  sensitive size: MMD < d_det. Headline d_det = 500 nm; 300 nm and 1000 nm reported as sensitivity.
  (d_det is not one agreed number in the sources; that is why three are reported.)

## Model
- Logistic regression (scikit-learn, L2, C = 1, class_weight balanced) on: material (one-hot), air velocity (cm/s), aged (0/1).
- Validation: grouped. Each traced test run is one group (its unaged and aged points stay together if both exist).
  Leave-one-group-out predictions. 95% range from 2,000 bootstrap resamples of those predictions (seed 42).
- Baselines beside it: (1) majority class; (2) material-only lookup from Table 1 (the paper's own per-material result).

## Checks
| Id | Check | Pass rule |
|---|---|---|
| M5-lognormal | Table 1's own count mean diameter and diameter of average mass are reproduced from Dg and sigma_g | every one within 10% |
| M5-trace | Tracing error: digitise a known gridline/tick set and the paper's fitted line ends | median error under 3% of the axis range |
| M5-auc | Logistic model, leave-one-group-out | AUC >= 0.75 |
| M5-bacc | Balanced accuracy at 0.5 | >= 0.70, and not below the material-only baseline |
| M5-base | Baselines reported beside the score | reported |
| M5-drivers | Permutation importance of each input | reported |
| M5-sens | Same model at d_det = 300 and 1000 nm | reported, no pass rule |
If the traced data cannot be obtained, M5-auc, M5-bacc and M5-drivers are "not run: no data" and only the Table 1 physics result ships.
