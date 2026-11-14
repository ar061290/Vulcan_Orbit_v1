# Datasets

## Get the NASA data (run on the work machine)

```
python scripts/download_psi.py
```

About 9 MB. It pulls the summary table of every fire-safety investigation in NASA's Physical Sciences Informatics archive, the Saffire-III telemetry, and a few small analysis files, into `datasets/psi/<PSI id>/`. It writes `datasets/psi/MANIFEST.csv` with each file's DOI, source page, size and checksum; copy that into the References.

- Small tables in `datasets/psi/` are committed so the whole team has the same files.
- Anything large goes in `datasets/raw/`, which git ignores.
- Cleaned JSON that the site reads lives in `data/` (see CONTRACT.md).

## What is in the archive (checked on psi.nasa.gov, 14 Nov 2026)

| PSI id | Investigation | Summary table rows | Notes |
|---|---|---|---|
| PSI-100 | Saffire-III | 2 samples | Telemetry: 11,450 rows; 4 radiometers, 2 anemometers, smoke-detector obscuration (x2) and scatter (x2), pressure, temperature |
| PSI-99 | Saffire-II | 15 | Nine material samples; burn length in orbit vs on Earth |
| PSI-98 | Saffire-I | 1 | Telemetry spreadsheet available |
| PSI-102 | SAME | 8 | |
| PSI-101 | SAME-R | 109 | Material, airflow, ageing time per smoke test |
| PSI-47 | DAFT | small | Dust |
| PSI-69 | FLEX | 274 | Fuel, pressure, O2/N2/CO2/He, droplet size, extinction diameter, burning rate |
| PSI-68 | FLEX-2 | small | |
| PSI-39 | CFI | table | Cool flames, droplets |
| PSI-25 | BASS-II | 129 | Material, flow, O2, CO2, CO |
| PSI-26 | BASS | table | |
| PSI-107 | SPICE | table | Smoke point |
| PSI-106 | SLICE | small | |
| PSI-22 | ACME E-FIELD Flames | 32 | Mesh polarity, fuel, flames ignited |
| PSI-159 | ACME CFI-G | 2 tables | Normal and inverse flames |
| PSI-10 | ACME Flame Design | 2 tables | |
| PSI-20, 21, 23 | ACME BRE, CLD Flame, s-Flame | small | |
| PSI-117, 142, 115, 62, 60 | Ground studies using the flight data | varies | Cool-flame analysis tables are useful |

Licence: CC0-1.0. NASA asks that each investigation be cited by its DOI.
