# M6b data domain

Written 14 Nov 2026, before any M6b model was fitted. It lists every microgravity spread-rate number available to M6b, what it covers, and what was looked at and left out.

**Scope rule.** M6b uses NASA data in this repo, M6's files (unchanged), and values printed in papers (status `reported`). One public paper was read for the concurrent-flow law and its calibration points (see "Concurrent flow" below and README Decisions). Nothing here is digitised from a graph.

## Summary: what is measured where

| Material | Flow direction | Thickness | Flow (cm/s) | O2 (vol%) | Pressure | n | Status | Use in M6b |
|---|---|---|---|---|---|---|---|---|
| PMMA slab, de Ris **thick** regime | opposed | 1–5 mm (burning half-thickness 1.0–5.0 mm) | 3–21 | 17.1–22.1 (segment) | about 1 atm | 28 points, 15 tests, 7 sessions | real (NASA report table, via M6) | calibrates the opposed-thick factor |
| PMMA slab, de Ris **thin** regime | opposed | 1–2 mm, two-sided (half-thickness 0.5–1.0 mm) | 2–10 | 17.4–19.1 (segment) | about 1 atm | 11 points, 4 tests, 3 sessions | real (via M6) | calibrates the opposed-thin factor |
| PMMA film | opposed | 0.1 mm, two-sided | 3 | 21 | 99.2–99.5 kPa | 1 | reported | **independent check** (never calibrates) |
| SIBAL cotton-fiberglass fabric | concurrent | 18.05 mg/cm² (about 0.32 mm) | 19–25 | 21.2–23.1 | 99–102 kPa | 5 | reported | calibrates the concurrent constant |
| Cotton fabric | concurrent | 18.1 mg/cm² | 20 | 26.9 | 76 kPa | 1 | reported | calibrates the concurrent constant (same law) |
| SIBAL fabric (Saffire-II) | concurrent | "037 mm" as printed | 20 | ~22.1 | not in the table | 2 | **real** (PSI-99) | **independent check** (never calibrates) |
| PMMA, thick (1 cm, Saffire-II) | concurrent | 1 cm and "See Fig. 5" | 20 | 22.1–21.9 | not in the table | 2 samples, no spread rate | real (PSI-99) | documented bound only: flame anchored, ≤ 10 cm damage in 600 s |
| SIBAL fabric | opposed | — | — | — | — | 0 spread rates | — | none: no data, no model (`null`) |
| PMMA film or slab | concurrent, thin regime | — | — | — | — | 0 | — | none (`null`) |

The calibrated domain of each regime is the box of its calibration rows above. Outside it, every output carries `in_domain: false`.

## Opposed flow, PMMA slabs (real, through M6)

- **File.** `models/m6-spread/bass2_clean.csv`, written by M6 from Table 5.1 of NASA's BASS-II Summary Report (NASA/TM-20210011385, a PSI-25 file, doi:10.60555/4qc4-de67) joined to the PSI-25 Experimental table. Column meanings are quoted in `models/m6-spread/DATA.md`. Units in the file header: "thickness mm, width cm, velocity cm/s (opposed), O2 vol%, spread and de Ris mm/s".
- **Rows.** 39 measured spread rates, 18 tests, 7 ISS sessions (GMT days). 4 rows are "Not tracked" and are not used.
- **Regime split** (M6's rule: thin when the burning half-thickness τ is below τ_cr, where the two de Ris formulas are equal; the regime of a row can change with its flow):

  | Regime | Points | Tests | Sessions | Half-thickness (mm) | Flow (cm/s) | Segment O2 (%) | Widths (cm) | Sides | Spread (mm/s) |
  |---|---|---|---|---|---|---|---|---|---|
  | thick | 28 | 15 | 7 | 1.0–5.0 | 3–21 | 17.08–22.10 | 1.2, 2.2 | 1, 2 | 0.012–0.071 |
  | thin | 11 | 4 | 3 (GMT192, 196, 204) | 0.5–1.0 | 2–10 | 17.38–19.12 | 1.2, 2.2 | 2 | 0.026–0.144 |

- **Pressure.** Not recorded per test. The report uses 1 atm for the MSG (p. 11); Bhattacharjee et al. report 99.2–99.5 kPa.

## Opposed flow, thin PMMA film (reported)

- **File.** `source/opposed_thin_reported.csv`. One steady spread rate: **2.2 mm/s** over a 100 µm film burning on both faces, 3 cm/s opposed flow, 21% O2, 2 cm wide (Bhattacharjee et al. 2016, FSJ 79 pp. 115–116, and Combust. Flame 163 p. 3; the same sentence is in NASA/TM-20210011385 p. 20). Quotes are in the file header.
- Other film spread rates exist only in figures (FSJ Fig. 8, report Fig. 2.19) and are not digitised.

## Concurrent flow, SIBAL fabric, Saffire-II (real): the independent check

- **File.** `datasets/psi/PSI-99/PSI-99_Experimental table_SAFFIRE-2.csv` (PSI-99, doi:10.60555/2chp-m469, 1973 bytes, sha256 3c24390b9ef86f3d). The PSI-99 investigation text: "Saffire-II has a sample card that contains 9 samples, each 5 cm x 29 cm. Depending on the sample material, the Saffire-II was conducted at an air flow velocity of either 20 or 30 cm/s, the flow being either concurrent or opposed."
- **Columns used, as printed** (no separate ReadMe; units are inside the cells): `Material`, `Samle Thickness ` (sic), `Sample Length `, `Sample Width (cm)`, `Air Flow (cm/s)`, `Percent O2 (Note 1)`, `Burn Time (s)`, `Flow Direction`, `?-g Burn Length`, `?-g Spread Length` (the "?" is a lost "µ" in the export; the cells hold "2.1 mm/s" and "2.6 mm/s", so this column is the microgravity spread rate).
- **Rows:**

  | Sample | Material | Thickness as printed | Size | Flow | O2 | Burn time | Direction | µg burn length | µg spread |
  |---|---|---|---|---|---|---|---|---|---|
  | 2-5 | Cotton-Fiberglass (SIBAL) | 037 mm | 29 × 5 cm | 20 cm/s | ~ 22.1 | 145 s | Concurrent | 29 cm | **2.1 mm/s** |
  | 2-6 | (blank) | 037 mm | 29 × 5 cm | 20 cm/s | ~ 22.1 | 115 s | Concurrent | 29 cm | **2.6 mm/s** |

- **Note 1** (O2): "Derived from measured CO2 production and referenced to initial O2 concentration reported by ISS."
- **Issues recorded, not corrected:**
  - 2-6 has a blank `Material`. Its thickness, size and spread column match 2-5, and the Olson et al. paper lists Saffire II samples 5 and 6 as SIBAL. Read as SIBAL.
  - "037 mm" is ambiguous (0.37 mm?). Saffire-I's table prints SIBAL as "0.37" in a "(cm)" column; the BASS-II report gives "about 0.32 mm". M6b does not use thickness for fabric; it uses area density.
  - **Flow conflict.** PSI-99 gives 20 cm/s for 2-6; Olson et al. Table 1 gives 25 cm/s for Saffire II sample 6. PSI-99 (NASA's data file) is primary; 25 cm/s is run as a sensitivity.
  - Pressure is not in PSI-99. Olson et al. give 103 kPa for Saffire II (reported).

## Concurrent flow, other flights (reported): the calibration set

- **Source.** Olson et al., "The effect of duct size, sample size, and fuel composition on concurrent flame spread over large cellulose samples in microgravity", accepted author manuscript, UCL Discovery eprint 10164340, Table 1 (PDF p. 9). Read on 14 Nov 2026; a copy is in `datasets/raw/m6b/` (git-ignored, sha256 455b945bb5cb50eb5e5e34e0c8e8911a561d6336ffb942f185d28e4f13e9f3cc). Transcribed in `source/concurrent_reported.csv`.
- **Six rows used** (Saffire-II rows excluded, see above): Saffire I (0.18 cm/s), Saffire III (0.23), Saffire IV (0.36), Saffire V cotton (0.34), BASS 1.2 cm (0.27), BASS 2.2 cm (0.51). Flow 19–25 cm/s, O2 21.2–26.9%, 76–102 kPa, three duct sizes, sample widths 1.2–40.6 cm.
- **The paper's warning:** "The flame spread rates and flame lengths were strongly affected by duct size even for the relatively large ducts (> 30 cm tall)." Saffire IV spread twice as fast as Saffire I at the same flow. A law with flow, O2 and pressure only cannot capture this; the spread shows up in the range.

## Other tables reviewed

- **PSI-26 (BASS).** `PSI-26_Experimental table_BASS.csv` holds date, GMT, test, sample and fuel only. The as-run matrix has crew notes (for example "spread very slowly upwind", "Burned completely") and `O2 % by volume`, `pressure, atm` columns, but **no spread or regression rate**. Not used.
- **PSI-98 (Saffire-I).** One SIBAL concurrent and one opposed sample, with burn times (420 s, 70 s) but **no spread-rate column**. Its length and width columns (40.6, 94 cm) are swapped relative to the investigation text ("approximately 0.94 meters long and 0.4 meters wide"). Its concurrent spread rate appears in Olson et al. Table 1 (0.18 cm/s) and is used from there.
- **PSI-99 thick PMMA (2-8, 2-9).** No spread rate. Note 4: "The flames remain anchored at the base of the sample which has a very slow regression rate (0.01 to 0.04 mm/s)". Used for the regression rate of PMMA and as the observed downstream behaviour of thick PMMA (≤ 10 cm damage in 600 s → ≤ 0.17 mm/s).
- **BASS-II report text.** Mentions a PMMA rod regression of 0.0385 mm/s (section 6.1, Olson rods) and a BASS one-sided slab at 0.037 mm/s (App. D.7, flow not stated). Rods are not modelled; the D.7 slab lacks its flow and O2, so it is not used.

## Fuel burnout values

| Fuel | Value | Source | Status |
|---|---|---|---|
| SIBAL | steady burnout time ≈ 22 s; transient peak ~30–35 s | Olson et al. pp. 17–18 | reported |
| PMMA | regression 0.01–0.04 mm/s; burnout time = burning half-thickness ÷ regression | PSI-99 Note 4 | real |

All values with quotes: `source/properties_m6b.csv`.

## Observed no-spread cases

From M6's `no_spread_cases.csv` (26 real, 17 reported). 20 can be placed at a numeric flow and O2 (`source/no_spread_placed.csv`): 8 real (films B14, B18, B19; slab M17; rod P8 at 3 flows; rod O22) and 12 reported (10 SIBAL Table 7.1 rows, 2 film rows of Table 2.1). The other 20 real cases record the outcome only as "5 down to ext" or similar, with no number for the flow at extinction; they are listed, not placed.

## What was looked at before RULES.md

The ranges and counts above, the Saffire-II rows, and the published numbers in the two papers. No model was fitted and no prediction was compared with any measurement.
