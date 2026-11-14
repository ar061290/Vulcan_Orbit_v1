# M6 report for the reviewer

Built 14 Nov 2026 with `python models/m6-spread/build.py` (about 30 s, byte-identical on a second run). All numbers below are printed by that build and stored in `results.json`.

## Headline

**Held-out R² = −0.68 [95% range −3.87 to −0.14], mean error 0.033 mm/s [0.023–0.040].**

- **Model.** de Ris × one fitted constant, with whole ISS sessions held out.
- **Baseline.** de Ris alone scores R² −40.0 [−225 to −11.4] with a mean error of 0.163 mm/s.
- **Against the target.** The rule-chosen model misses the 0.6 target.
- **Best candidate.** Boosted trees reach R² 0.33 with sessions held out, but the range is −2.3 to 0.81.
- **Single tests held out.** The Gaussian-process correction reaches 0.66 [0.41–0.77].

**What this means.** With 39 points from 7 sessions, the data supports this much:
- the spread-rate *level* for these PMMA slabs (de Ris over-predicts it about 3.5-fold);
- the effect of thickness and one- vs two-sided burning.

It does not yet support a correction that carries over to a new ISS session.

## All scores (held-out, spread rate in mm/s)

| Model | R², sessions out [95% range] | MAE, sessions out [range] | R², tests out [range] | MAE, tests out |
|---|---|---|---|---|
| de Ris, no fit (baseline) | −40.03 [−224.8, −11.45] | 0.163 [0.104, 0.228] | n/a | n/a |
| **(a) one constant, kept** | **−0.68 [−3.87, −0.14]** | **0.033 [0.023, 0.040]** | −0.77 [−3.58, −0.20] | 0.034 |
| (b) linear | 0.26 [−2.28, 0.58] | 0.019 [0.012, 0.028] | 0.46 [0.22, 0.65] | 0.015 |
| (c) Gaussian process | 0.01 [−5.10, 0.76] | 0.021 [0.008, 0.036] | 0.66 [0.41, 0.77] | 0.012 |
| (d) boosted trees, depth 2 | 0.33 [−2.34, 0.81] | 0.019 [0.012, 0.026] | 0.60 [−0.14, 0.85] | 0.013 |

**Point ranges.** Prediction × [0.33, 2.96]: exp of the 2.5th and 97.5th percentiles of the held-out log residuals. 37 of the 39 observations (95%) fall inside their range.

**Points per held-out session.**

| Session (GMT day) | Points |
|---|---|
| 51 | 7 |
| 188 | 1 |
| 192 | 13 |
| 196 | 5 |
| 204 | 7 |
| 212 | 5 |
| 213 | 1 |

Session 192 holds almost all the 1.2 cm-wide samples. When it is held out, the models must predict width effects they have barely seen. This is the main reason the session split is so much harsher than the test split.

## Pass rules (`RULES.md`, committed before training in 98e8c2f)

| Rule | Result |
|---|---|
| P1: R² ≥ 0.60 (sessions held out) | **MISS**: −0.68 |
| P2: beats de Ris on MAE and R² | **PASS**: MAE 0.033 vs 0.163; R² −0.68 vs −40.0 |
| P3: learned part beats one constant | **Not applicable**: the rule kept the one-constant model. (b) and (d) do beat it, at 0.26 and 0.33. |
| P4: range reported | Reported. The lower bound −3.87 is below 0.3, so it is flagged as a **weakness**. |
| Choice rule C | Best = (d), at 0.33 with lower bound −2.34. The simplest model at or above −2.34 is (a), so (a) was kept, applied as written. |

## Drivers (kept model, permutation on held-out data, shares sum to 1)

| Input | Share | Rise in MAE when shuffled (mm/s) |
|---|---|---|
| Fuel thickness | 0.794 | 0.0032 |
| One or two sides burning | 0.206 | 0.0008 |
| Opposed-flow speed | 0 | 0 |
| Oxygen | 0 | 0 |
| Sample width | 0 | 0 |

The kept model uses flow speed and O2 only through the de Ris formula. Shuffling them does not raise the held-out error. So the formula's flow and O2 dependence does not help predict a new session of these slabs.

Within single tests the data does show spread slowing as the flow is turned down. For example, M7 went from 0.106 mm/s at 10 cm/s to 0.07 mm/s at 3 cm/s.

## Leakage check

- **Not triggered.** No held-out R² was above 0.90; the highest was 0.66.
- **Group overlap.** It is asserted on every fold that no session and no test sits on both sides.
- **Inputs.** The inputs are thickness, width, sides, velocity and segment O2. None encodes the spread rate: burn time, test, sample, session and segment are excluded by code.

## Observed no-spread cases

These come from `no_spread_cases.csv` and are listed as observed, with no boundary drawn.

**From NASA's PSI-25 table (`real`, words as written in the flow columns): 26 tests.**

- **Thin PMMA films (Bhattacharjee).**
  - B18 and B19 blew off at 10 cm/s, at 17.4% and 17.3% O2.
  - B14 and B21 went out as the flow was turned down: B14 at 15.0% O2 (final O2 missing), B21 at 20.8–20.6% O2.
- **PMMA slab (Miller).** M17 went out when the flow reached 0 (18.8–17.1% O2).
- **PMMA rods ignited upstream (Olson, concurrent).**
  - Went out or blew off as the flow changed: O4, O6, O7, O8a, O8b, O9, O11, O14, O19 and O22, all at 13.6–16.7% O2.
  - O12 did not ignite at any flow at 13.6% O2.
- **PMMA rods ignited downstream (Fernandez-Pello, opposed).**
  - Went out as the flow was turned down: P1, P5, P9, P10, P13a, P13b, P22a, P22b and P25, at 16.4–20.9% O2.
  - P8 "would not stay lit" at 5 cm/s and 16.4% O2.
- **Bad O2 readings.** P22a ("20.8 to 0.6") and P22b ("20.0 to 39.1") have O2 readings that are impossible as printed. They are flagged, not corrected.

**From the BASS-II report (`reported`): 17 cases.**

- **SIBAL fabric in concurrent flow (Table 7.1).**
  - Quenched at low flow: 6 tests, 16.9–18.7% O2.
  - No ignition: 3 tests at 16.4–16.8% O2, plus 3 reused samples.
  - Blow-off: 1 test at 17.2% O2, at a flow raised from 11 to 47 cm/s.
  - Two tests did **not** blow off even at 29 and 53 cm/s.
- **Thin PMMA (Table 2.1).** The flame went out below 1.0 ± 0.5 cm/s opposed flow at 21% O2, and below 3.0 ± 0.5 cm/s at 16% O2.

## Decisions and limits

See `README.md`, which lists 16 decisions and the limits. The most important:

- **Source of the spread rates.** They come from Table 5.1 of NASA's BASS-II Summary Report, because no PSI data table has them. The table was transcribed by hand and cross-checked against the PSI-25 table.
- **Status label.** `models.json` keeps its file-level status `real`.
- **Scope.** PMMA slabs, opposed flow, about 1 atm only. Pressure was never varied, so it is not an input.

## Check by hand

1. **Table 5.1 transcription.** Check `source/table5_1_transcribed.csv` against the report page:
   - run `python models/m6-spread/fetch_sources.py`, then open PDF page 65;
   - check especially that velocities pair with spread rates in the order printed (M7, M8, M11, M13, M14, M16, M17), and the values 0.0373, 0.0624, 0.0353 and 0.1309.
2. **Status label.** Whether the team accepts `real` for spread rates taken from NASA's report table, or wants a per-entry `reported` label (contract change, lead's call).
3. **What the site shows.** The site will show a negative R² for M6. Decide whether that is acceptable or whether the panel needs a note. Showing the boosted-tree model instead would break the rule fixed before training, and would have to be presented as a post-hoc choice.
4. **The two de Ris constants** (2.34 × 10⁻⁸ and 9.72 × 10⁻⁵) and *F* = 4.89, against Bhattacharjee et al. (2016) Fire Safety Journal 79, p. 116.
5. **Missing papers.** The PI papers for rods (Link et al. 2018, Sci. Rep. 8:120, open access) and fabric (Zhao et al. 2017) may hold spread-rate tables that would add other fuels. Fetching them needs the person's approval.
