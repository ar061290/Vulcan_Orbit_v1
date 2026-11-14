# M6b: flame spread predictor and growth simulation

**Questions.**
- How fast does a flame spread over this solid, at this airflow, O2 and pressure?
- Will it spread at all?
- Starting from what the camera sees now, how does the burning area develop?

**Where it fits.** CV model (flame state) → **M6b growth simulation** → risk assessment.
- M6b builds on M6 (final, unchanged) and reads M6's files.
- It does not modify any M6 file or M6's entry in `data/models.json`.

**One command:**

```
python models/m6b-predictor/build.py           # about 8 min (456 s here; most of it is the 200-input growth checks)
python models/m6b-predictor/build.py --clean   # removes only M6b's outputs and its two manifest lines
```

It writes:
- `data/spread_predictor.json` and `data/growth_examples.json`, both `status: "model"`;
- their two lines in `data/manifest.json`;
- `results.json` and the plots in `checks/`.

`fetch_sources.py` re-downloads the one public paper whose numbers are transcribed in `source/` and checks its hash.

**Files.**

| File | What |
|---|---|
| `DOMAIN.md` | every spread-rate number available, its range and source (written before fitting) |
| `RULES.md` | pass rules, committed alone before fitting (a179453) |
| `predictor.py` | spread rates (lo, mid, hi), regime, calibration label, in-domain flag, will-it-spread verdict |
| `growth.py` | `simulate(flame_state, fuel, conditions, params)`: pure function, numpy only |
| `GROWTH_API.md` | the same function specified for a JavaScript port |
| `CONTRACT_PROPOSAL.md` | shapes of the two new files and of the CV "flame state" (for the lead) |
| `REPORT.md` | numbers for the reviewer, worked examples, check-by-hand list |

## Data

The full list is in `DOMAIN.md`.

| Use | Data | n | Status |
|---|---|---|---|
| Opposed-flow calibration | BASS-II PMMA slabs, NASA/TM-20210011385 Table 5.1 via M6 (PSI-25) | 39 points, 7 sessions | real |
| Concurrent-flow calibration | Saffire I, III, IV, V and two BASS fabric tests (Olson et al., Table 1) | 6 | reported |
| **Independent check, concurrent** | Saffire-II SIBAL samples 2-5 and 2-6 (PSI-99) | 2 | real |
| **Independent check, opposed thin** | 100 µm PMMA film (Bhattacharjee et al. 2016) | 1 | reported |
| Will it spread at all | observed no-spread cases from M6's `no_spread_cases.csv` with a numeric flow (`source/no_spread_placed.csv`) | 8 real + 12 reported | real / reported |
| Burnout | PMMA regression 0.01–0.04 mm/s (PSI-99 Note 4); SIBAL burnout time ≈ 22 s (Olson et al.) | – | real / reported |

## Method

1. **Opposed flow (PMMA).** M6's de Ris formulas (same properties, same thin/thick rule) × one factor per regime, fitted as the mean log ratio.
   - Pressure enters only through the physics: the thick formula scales with gas density, so ∝ P.
2. **Concurrent flow (cellulose fabric).**
   - The law is the documented scaling V_f ∝ U · X_O2 · P^½ / area density (Olson et al., citing Olson and Miller 2009 and Thomsen et al. 2019).
   - It has no published constant, so it is × one fitted constant K.
   - No uncalibrated concurrent model can be run from documented values: the heat-flux profile and preheat length it would need are printed only as graphs.
3. **Ranges.** Ranges come from held-out log residuals, as in M6. Coverage is tested with a nested split, so the range is never judged on the rows that built it.
4. **No machine learning** beyond these three constants.
5. **Will it spread at all.** Boxes around observed NASA no-spread cases of the same material, flow direction and geometry:
   - "observed no-spread" within ±0.5 points O2 and ±max(0.5 cm/s, 10%) flow;
   - "near observed extinction" within ±1.5 points O2 and a factor 2 in flow.

   No boundary is drawn beyond the boxes. Real and reported cases are listed separately.
6. **Growth simulation.**
   - **Grid.** A 2-D grid over the fuel.
   - **Spread shape.** The flame front advances with a convex spread shape:
     - opposed rate upwind;
     - concurrent rate downwind;
     - cross-flow rate = their mean.
   - **Arrival times.** Exact Huygens arrival times.
   - **Burnout.** Fuel burns out behind the front after a burnout time.
   - **Runs.** lo, mid and hi rates.

   The outputs are area over time, maximum area and its time, end time, area consumed and the stop reason. Details: `RULES.md` §6 and `GROWTH_API.md`.

## Scores (held-out; full numbers in REPORT.md)

| | Model | Baseline(s) | Rule |
|---|---|---|---|
| Opposed, PMMA slabs (sessions held out) | **MAE 0.020 mm/s** [0.015–0.023], R² 0.37 | M6 one constant: 0.033 mm/s (R² −0.68); raw de Ris: 0.163 (R² −40) | R1 ≤ 0.033: **pass** |
| Opposed range coverage (nested) | **87%** (34/39), range ×0.43–3.05 | – | R2 ≥ 80%: **pass** |
| Concurrent, 6 flights (leave one out) | MAE 1.04 mm/s; nested coverage 5/6; range ×0.58–1.83 | mean of the training flights: MAE 1.06 mm/s | R3 ≥ 80%: **pass** |
| Saffire-II, independent (PSI-99) | 2-5: pred 2.89 [1.68–5.30] vs 2.1; 2-6: 2.89 vs 2.6 | – | R4a both inside: **pass** |
| 100 µm film, independent | slab-calibrated 1.08 [0.47–3.30] vs 2.2; raw de Ris 2.29 | – | R4b inside: **pass** (but see limits) |
| Growth checks G1–G5 | all pass | – | **pass** |

## Limits

- **Small, narrow data.**
  - Opposed: 39 PMMA-slab points from 7 sessions, about 1 atm.
  - Concurrent: 6 reported flights, one material family, 19–25 cm/s.
  - Everything else is extrapolation and is flagged `in_domain: false`.
- **The concurrent law barely beats a constant.** Held-out MAE 1.04 vs 1.06 mm/s. Olson et al. show duct size changes the spread rate about twofold at the same flow, and the law has no duct term. The range (×0.58–1.83) is what to trust, not the central value.
- **Films.** The slab-calibrated thin factor (0.47) halves the film's rate. Raw de Ris matched the film better (2.29 vs 2.2). The range still covered it, but **films stay out of domain**: do not apply the slab factor to films without more film data.
- **Saffire-II is formally out of domain.** Its pressure (103 kPa, reported) is 1 kPa above the calibration box. The check passes, but the flag stays.
- **Zeros the simulation has to assume.**
  - Opposed spread over SIBAL has no data, so it is 0 and upwind growth of fabric is not simulated.
  - Downwind spread over thin PMMA is set equal to the opposed rate.
  - Downwind over thick PMMA uses the PSI-99 anchored-flame bound (0–0.167 mm/s) at every condition, flagged.
- **The cross-flow rate (mean of the two) has no data behind it.**
- **The initial region is assumed fully burning at the frame time.** That produces the short peak when it all burns out together (example 2, mid run).
- **Area curves step by one grid column.** That shows as a small sawtooth.
- **"Spreads" only means that no observed no-spread case is near.**
  - It is not a flammability claim. For example, SIBAL below 16.4% O2 at high flow shows "spreads" only because nothing was tested there.
  - Nothing here says a material, atmosphere or situation is safe.
- **Microgravity only.** No Moon or Mars prediction.
- **Not a reproduction of real spacecraft fires.** This is a reduced-order model calibrated to NASA ISS and spacecraft data.

## Decisions

1. **Branch.** `feat/m6b-predictor` was made from `feat/m6-spread` (d85a2a6), which contains both M6 and M7, as the person asked. Not pushed, not merged.
2. **One paper read without asking first.**
   - The standing preference for this project is to ask before downloading data. This brief said to work without stopping.
   - The concurrent law, its six calibration points, the SIBAL burnout time and the area densities come from one public accepted manuscript: Olson et al., UCL Discovery eprint 10164340. It was read through a web fetch, kept in `datasets/raw/m6b/` (git-ignored) and transcribed with quotes.
   - **The M6b owner should confirm or veto this.** Without it, the concurrent rate would be `null` (no constant), the fabric examples could not run, and Saffire-II could be compared with nothing.
3. **Concurrent is calibrated, not raw physics.** The brief allowed "calibrate concurrent on nothing" only if Saffire-II were the only concurrent data. It is not: six other flights are printed in the paper. So K is fitted on those, and Saffire-II stays a clean held-out check.
4. **Saffire-II sample 2-6.**
   - **Flow conflict.** PSI-99 says 20 cm/s; Olson et al. say 25 cm/s. PSI-99 (NASA's data file) is primary; 25 cm/s is run as a sensitivity, and the prediction stays inside the range.
   - **Blank material.** Its material cell is blank; it is read as SIBAL, matching 2-5 and the paper.
   - **Pressure.** PSI-99 has no pressure; 103 kPa is taken from the paper (reported).
5. **"037 mm".** The printed SIBAL thickness is ambiguous and is not used. The concurrent law uses area density (18.05 mg/cm²).
6. **Pressure box for PMMA:** 0.97–1.03 atm. BASS-II is "about 1 atm" (report p. 11), with 99.2–99.5 kPa reported for the film tests. RULES.md said only "about 1 atm", so the numeric box is set here.
7. **Concurrent domain** = the exact box of the six calibration rows (flow 19–25 cm/s, O2 21.2–26.9%, 76–102 kPa, 18.05–18.1 mg/cm²). It is not widened after seeing that Saffire-II sits 1 kPa outside it.
8. **Verdict match key adds geometry** (film / slab / rod / fabric) to "same material and flow direction". Without it, the 100–200 µm film blow-offs at 10 cm/s and 17.2–17.4% O2 would mark slab conditions where BASS-II slabs did spread (M18 at 10 cm/s, 17.6%). Rods are not modelled, so rod cases are never matched.
9. **Sample width** is not part of the verdict match. The 1.2 cm SIBAL cases also apply to wider fabric, and the matched case list shows each case so the reader can judge. Cotton uses the SIBAL cases (no cotton cases exist).
10. **Cases not placed.** 20 PSI-25 cases record extinction only as "5 down to ext" and similar, so they have no flow to place. They stay listed in M6's `no_spread_cases.csv` and are not drawn.
11. **Overall verdict** for the simulation = the worse of the two flow directions. "Observed no-spread" means no growth at all; the initial flame then burns out.
12. **Exact propagation instead of explicit time steps.** The front at each output time is the level set of exact arrival times for the convex spread shape. This is the same thing as time-stepping the front, but without numerical diffusion, and it makes the hand-calculation check exact to one cell.
13. **Initial region.** An ellipse in the CV bounding box, scaled to the CV area. All of it is taken as burning at the frame time, because the CV gives no age per pixel.
14. **lo/hi pairing.** The lo run uses low rates with fast burnout; the hi run uses high rates with slow burnout. That gives an area envelope rather than a statistical interval. The central regression is 0.02 mm/s, the geometric mean of PSI-99's 0.01–0.04.
15. **Disclosure on the opposed model.**
    - The one-factor-per-regime form was written into RULES.md before fitting. It was chosen *after* M6 had shown that thickness and sides drove its errors.
    - The improvement over M6's model (0.020 vs 0.033 mm/s) is therefore not a blind result in the way M6's own pre-registration was.
    - M6's result stands as M6's; M6b's model is reported under M6b's rules.
16. **de Ris code.** It is copied from M6's `build.py`, because importing that script would run its command-line path. `build.py` asserts that the copy reproduces M6's `de_ris_mm_s` column within 1e-4 mm/s.
17. **No `models.json` entry for M6b.** The brief named only the two new files. M6's entry is untouched (sha of the entry checked equal to `feat/m6-spread`). M6b's headline scores are in `spread_predictor.json` → `scores`.
18. **Example 2 geometry.** The 8.5 cm length is the BASS-II slab length in NASA/TM-20210011385 App. D. Table 5.1 gives no length.
19. **Status `model`** for both files: they are model outputs built from real and reported inputs, and every source is labelled inside.
