# M6 data inventory

Written 14 Nov 2026, before any model was fitted.

## Finding 1: NASA's PSI tables hold no BASS-II spread rates

The planned target, a measured flame-spread rate per BASS-II test, is **not** a column in any NASA PSI table.

- **BASS-II summary table** (`datasets/psi/PSI-25/PSI-25_Experimental table_BASS-II.csv`, 129 rows). It holds test id, date, sample, fuel, flow restrictor, fan and air-speed displays, radiometer gain, frames shot, O2, CO2 and CO. There is no spread rate.
- **BASS-II ReadMe.** It says: "Spreadsheets folder has test matrix and fan calibration information."
- **BASS** (`PSI-26`, 122 rows). The table holds only date, GMT, test number, sample and fuel.
- **Full PSI-25 file list** (read 14 Nov 2026 from `psi.nasa.gov/geode-py/ws/repo/investigations/PSI-25`). There are no analysed-data files. The investigation holds raw video and stills (0.4–2.4 GB per test), engineering documents, the requirements document and the 49 MB **BASS-II Summary Report**.

The spread rates M6 uses therefore come from the one place NASA tabulated them for BASS-II: **Table 5.1 of the BASS-II Summary Report**. It is stored in PSI-25 and the person approved the download on 14 Nov 2026.

That table covers the Miller and Wichman PMMA-slab tests, all in opposed flow. Spread rates for the thin films, rods and fabric appear only as figures, in this report and in the papers. They were not digitised (see README Decisions).

## Files used

| Role | File | PSI id / DOI | Rows | sha256 (first 16) |
|---|---|---|---|---|
| Test conditions, session, O2 (real) | `datasets/psi/PSI-25/PSI-25_Experimental table_BASS-II.csv` | PSI-25, [10.60555/4qc4-de67](https://doi.org/10.60555/4qc4-de67) | 129 tests (20 are Miller slab tests M1–M20) | 71e792bf6b5fb5ea |
| Column meanings | `datasets/raw/m6/PSI-25_Science Documents_BASS-II_ReadMe.docx` (git-ignored) | PSI-25 | n/a | 69f32647792f54ab |
| Spread rates (Table 5.1), extinction tables 2.1 and 7.1 | `datasets/raw/m6/PSI-25_Reports_BASS-II Summary Report.pdf` (git-ignored). NASA/TM-20210011385, also NTRS 20210011385 | PSI-25, [10.60555/4qc4-de67](https://doi.org/10.60555/4qc4-de67) | Table 5.1: 20 tests | 5ffa911fd9b6356f |
| de Ris coefficients | `datasets/raw/m6/bhattacharjee2016_firesaf_79_111.pdf` (git-ignored, paywalled, supplied by the person) | [10.1016/j.firesaf.2015.11.011](https://doi.org/10.1016/j.firesaf.2015.11.011) | n/a | ca06ad56bd5fff0e |
| T_v, Table 1 | `datasets/raw/m6/bhattacharjee2016_combustflame_163_472.pdf` (git-ignored, paywalled, supplied by the person) | [10.1016/j.combustflame.2015.10.023](https://doi.org/10.1016/j.combustflame.2015.10.023) | n/a | 2353e335ffbfde46 |
| Context only | `datasets/raw/m6/NTRS-20160000593_Ferkul_BASS-II_results.pdf` (git-ignored) | NTRS 20160000593 | n/a | 9f2c89db9e1954c3 |

- **Paywalled papers.** They are never committed. `fetch_sources.py` re-downloads only the two public NASA files.
- **Transcriptions.** Table 5.1 was transcribed by hand from the rendered page into `source/table5_1_transcribed.csv`. Page and file hash are in its header.
- **Cross-check against the PSI table.** `build.py` checks the transcription against the PSI-25 table. All 20 tests' initial and final O2 must match. The thickness and width written in the PSI `Fuel Sample Material` text must not contradict it.

## Columns used

### PSI-25 Experimental table (meanings quoted from the BASS-II ReadMe)

| Column | Meaning (quoted) | Used for |
|---|---|---|
| `Test #` | "Initial of PI name followed by test number from the initial matrix. If multiple runs with same sample on same day, a and b are used to designate." | join key to Table 5.1 (M1–M20) |
| `Date`, `GMT` | "actual date of experiment" and "GMT- number is day of the year" | **session id for grouped validation** (GMT day) |
| `Sample #` | "some samples were used for multiple runs." | check: each Miller test has its own sample |
| `Fuel Sample Material` | "self explanatory" | cross-check of thickness and width |
| `Fan display` | "instantaneous fan voltagex10 on the video display ... Also listed sometimes are pot settings on the control box." | flammability view only (raw text) |
| `Air display` | "flow speed measured in the duct in cm/s on the video display. Response time is very slow (~ 1 min), so reading is only steady for long times at the same flow setting." | flammability view only (raw text) |
| `Calibrated initial O2 % by vol`, `Calibrated final O2 % by vol` | "The O2 sensor was out of calibration, so the MCA ISS reading was used to correct the initial ISS 'air' reading of the sensor for the day via a constant offset." | O2 per measurement; cross-check |

**Unit note.** The air display is in cm/s, as the ReadMe states. In the PSI table it is a free-text list of the settings used during a test, such as `10 5 3 0ext`. So M6 does not take its velocities from it. They come from Table 5.1, where each velocity is paired with its spread rate.

### Table 5.1 (BASS-II Summary Report, p. 57)

The header units are as printed: "Thickness, mm; Width, cm; One or two sides burning; Velocity, cm/s; Spread rate, mm/s; Burn time, min; Initial O2, vol%; Final O2, vol%".

The text on p. 56 says:
- "A total of 20 PMMA flat samples were burnt ... The sample thickness varied from 1 to 5 mm thick. The samples burnt were either 1 or 2 cm wide. All the burns are either one sided or two sided. The airflow was always opposed. Airflow speeds ranging from as low as 3 cm/s up to 20 cm/s were used in the flow duct."
- "The still images and videos from the data are tracked using Spotlight-16 (NASA image tracking software) ... Data are then imported to Excel ... to obtain flame spread rates."

The table prints widths of 1.2 and 2.2 cm, where the text says "1 or 2 cm wide". The table values are used.

## The quantities M6 needs

| Needed | Where it comes from | Status |
|---|---|---|
| Spread rate, **mm/s** | Table 5.1 | real NASA measurement, transcribed from NASA's report (see README Decisions on the status label) |
| Fuel material | PMMA (cast slab) only. Table 5.1 covers PMMA only. | n/a |
| Geometry, thickness | flat slab; 1–5 mm thick; 1.2 or 2.2 cm wide; one- or two-sided burning | Table 5.1, cross-checked with PSI-25 |
| Flow speed, **cm/s** | Table 5.1, one value per measured segment | Table 5.1 |
| Flow direction | opposed, every test ("The airflow was always opposed") | Table 5.1 text |
| O2, **vol%** | initial and final per test (Table 5.1 = PSI-25). Per segment it is estimated by linear decay in time (README Decisions). | real |
| Pressure | **Not recorded per test in any BASS-II file.** The report's MSG calculations use P = 1 atm (p. 11), and the Bhattacharjee paper reports 99.2–99.5 kPa for its tests. Every test is at about 1 atm, so pressure cannot be a model input. | n/a |
| Test / session id | `Test #` (one sample per test) and `GMT` day (session) | real |

## Rows, missing values and what remains

- **Table 5.1:** 20 tests, giving 43 (test, velocity) pairs.
  - M6 (2 pairs) and M12 (2 pairs) are "Not tracked", with no spread rate.
  - **39 measured spread rates from 18 tests in 7 ISS sessions remain.** No other column is missing for these rows.
- **Sessions, by GMT day of 2014, with measured points:**

  | GMT day | Tests | Points |
  |---|---|---|
  | 51 | M1, M2, M5, M14 | 7 |
  | 188 | M15 | 1 |
  | 192 | M3, M7, M8, M9, M11 | 13 |
  | 196 | M17, M18 | 5 |
  | 204 | M10, M16, M19 | 7 |
  | 212 | M4, M13 | 5 |
  | 213 | M20 | 1 |

- **Ranges:**
  - spread 0.012–0.144 mm/s;
  - velocity 2–21 cm/s;
  - O2 16.8–22.2 vol% at test ends;
  - thickness 1–5 mm.

## Other PSI tables reviewed and not used

- **Saffire-II (PSI-99).** It has two microgravity spread rates, both for SIBAL fabric in concurrent flow (2.1 and 2.6 mm/s). That is too few points, and a different fuel and flow direction.
- **PSI-62** (concurrent-spread modelling). It holds metadata only and no table.
- **PSI-26 BASS.** No spread rates (see Finding 1).

## Flammability view sources

1. **Real, PSI-25 table.** These are tests whose `Fan display` or `Air display` text records extinction, blow-off or no ignition: "ext", "extinguished", "blowoff", "no ign", "would not stay lit". `build.py` lists them with the raw text, fuel and O2. They are not interpreted beyond the words written.
2. **Reported, BASS-II Summary Report.**
   - Table 7.1: SIBAL fabric in concurrent flow; quenched, no ignition and blow-off cases.
   - Table 2.1: thin PMMA radiative-extinction velocity at 21% and 16% O2.

   Both are transcribed in `source/no_spread_reported.csv`.
