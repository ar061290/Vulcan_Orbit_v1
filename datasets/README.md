# Raw datasets

Raw NASA files live here on your own machine and are not committed (see .gitignore). Cleaned, small JSON goes in `data/`.

Download list (NASA Physical Sciences Informatics, https://psi.nasa.gov/physci/repo/search?q=combustion). IDs were reported second-hand; confirm each on the site.

| Folder | Investigation | PSI id | What to grab first |
|---|---|---|---|
| saffire3/ | Saffire-III | PSI-100 | 1 Hz telemetry (radiometers, smoke detector obscuration and scatter), burn summary table |
| saffire1/, saffire2/ | Saffire-I, -II | PSI-98, PSI-99 | Burn summary tables |
| same/, samer/ | SAME, SAME-R | PSI-102, PSI-101 | Particle size tables; SAME-R housekeeping CSVs |
| daft/ | DAFT / DAFT-2 | PSI-47 | Dust size summary |
| flex/ | FLEX | PSI-69 | Experimental summary table (CSV) |
| flex2/ | FLEX-2 | PSI-68 | Summary table |
| bass2/, bass/ | BASS-II, BASS | PSI-25, PSI-26 | Test matrix |
| spice/ | SPICE | PSI-107 | Smoke point table |
| efield/ | ACME E-FIELD Flames | PSI-22 | Test-level table |
| cfig/ | ACME CFI-G | PSI-159 | Test-level table |
| flamedesign/ | ACME Flame Design | PSI-10 | Test-level table |

Skip raw video archives; they are very large and not needed for the first models.

Challenge resource list (also NASA): the PSI combustion search above, NASA Glenn Combustion Science pages, "A Researcher's Guide to ISS Combustion Science" (2015), the ScienceCasts video, the Apollo 1 and Apollo 13 safety pages, the Mir fire history page, and three NASA Spinoff pages. Keep a copy of each PDF or page you cite in `datasets/reports/`.

Record every file you download in `datasets/MANIFEST.csv`: file, source URL, date, size.
