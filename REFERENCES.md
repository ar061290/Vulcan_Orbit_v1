# References

Every dataset, paper, library and outside source used by the flame simulation (`models/flame-sim/`) and the LBM smoke drift
(`models/m3-drift/`). Numbers taken from papers carry status "reported" in our files. Items a research agent could not verify
from a fetched source are listed in the two REPORTs under "What you must verify by hand".

## NASA PSI datasets (CC0-1.0, cite by DOI)

| PSI id | DOI | Page | Used for |
|---|---|---|---|
| PSI-25 | [10.60555/4qc4-de67](https://doi.org/10.60555/4qc4-de67) | https://psi.nasa.gov/physci/repo/data/investigations/PSI-25 | BASS-II: test conditions (summary table); spread-rate numbers come from the BASS-II summary report (below) |
| PSI-68 | [10.60555/byp8-h018](https://doi.org/10.60555/byp8-h018) | https://psi.nasa.gov/physci/repo/data/investigations/PSI-68 | FLEX-2: checked, not used (summary table lists test ranges only) |
| PSI-69 | [10.60555/mbq8-0451](https://doi.org/10.60555/mbq8-0451) | https://psi.nasa.gov/physci/repo/data/investigations/PSI-69 | FLEX: droplet burning-rate constant, extinction diameter, test end (flame-sim stage 1 checks) |
| PSI-100 | [10.60555/040q-4h36](https://doi.org/10.60555/040q-4h36) | https://psi.nasa.gov/physci/repo/data/investigations/PSI-100 | Saffire-III: via data/drift_calibration.json (mixing, clearance, detector delay) used by M3 |
| PSI-102 | [10.60555/gd4k-8h62](https://doi.org/10.60555/gd4k-8h62) | https://psi.nasa.gov/physci/repo/data/investigations/PSI-102 | SAME: lowest flight weight-loss rate, low end of the M3 smoke release range |

Dataset file checksums: `datasets/psi/MANIFEST.csv`.

## NASA reports and papers

| Source | Used for |
|---|---|
| Link, D. E. Jr. & Balistreri, S. F. Jr., "Inter-Module Ventilation Changes to the International Space Station Vehicle...", 45th ICES, Bellevue WA, 2015. NTRS 20150009509, https://ntrs.nasa.gov/citations/20150009509 | Cabin aisleway air velocity requirement: "between 4.6 and 12.2 meters per minute (15 and 40 feet per minute)" (p. 9). Sets the M3 ventilation speeds 0.077 to 0.203 m/s |
| Olson, S. L., Ferkul, P. V., Bhattacharjee, S., Miller, F. J., Fernandez-Pello, C., Link, S., T'ien, J. S., Wichman, I., "Burning and Suppression of Solids-II (BASS-II) Summary Report", NASA/TM-20210011385, 2021. https://ntrs.nasa.gov/citations/20210011385 | Thick PMMA spread rates (Table 5.1), thin PMMA 2.2 mm/s (Secs. 2.2.5, 2.3.7), extinction velocities (Table 2.1), de Ris pi/4 thin form and F = 4.76 (Eq. 2.11), gas activation energy 1.45e5 J/mol (Sec. 6.1) |
| Bhattacharjee, S., Simsek, A., Olson, S., Ferkul, P., Combust. Flame 163 (2016) 472-477, doi:10.1016/j.combustflame.2015.10.023 | Reprinted in the TM above (Sec. 2.2); journal version not opened |
| Bhattacharjee, S., Laue, M., Carmignani, L., Ferkul, P., Olson, S., Fire Safety J. 79 (2016) 111-118, doi:10.1016/j.firesaf.2015.11.011 | Reprinted in the TM above (Sec. 2.3); journal version not opened |
| Ferkul, P. et al., BASS-II poster, ASGSR 2014, NTRS 20160000593 | Blow-off near 40 cm/s for 0.1 mm PMMA (slide 13), extinction calibration point |
| Dietrich, D. L. et al., "Detailed Results From the Flame Extinguishment Experiment (FLEX)...", NASA/TP-2015-216046. NTRS 20150023456 | FLEX column definitions (Appendix A.1), K units mm2/s |
| Nayagam, V., Dietrich, D. L., Hicks, M. C., Williams, F. A., "Cool-flame extinction during n-alkane droplet combustion in microgravity", 2014, NTRS 20140006750 | Radiative extinction of large heptane droplets (context for the criterion) |
| Zhao, X., T'ien, J. S., Ferkul, P. V., Olson, S. L., 9th US National Combustion Meeting 2015, NTRS 20150008962 | SIBAL thickness 0.32 mm, area density |
| Olson, S. L. et al., "The effect of duct size, sample size, and fuel composition on concurrent flame spread over large cellulose samples in microgravity" (accepted manuscript), https://discovery.ucl.ac.uk/id/eprint/10164340/ | SIBAL composition, area density, specific heats, pyrolysis temperature |
| Carmignani, L., PhD dissertation, "Opposed-Flow Flame Spread over Solid Fuels in Different Burning Regimes", UCSD/SDSU 2019, https://escholarship.org/content/qt0rb693zc/qt0rb693zc.pdf | PMMA and gas properties (Table A.1), de Ris formulas (Eqs. 3.1, 3.2), F range 4.4 to 5.5 |
| Zhang, J. et al., "Burning on flat wicks at various orientations", J. Fire Sciences 32(1) (2014) 52-71 (Ahmad and Faeth properties) | PMMA T_v = 668 K, heat of gasification 1600 kJ/kg, B = 1.6 |
| Ananth, R., Ndubizu, C. C., Tatem, P. A., "Flow past a burning solid surface", NRL, https://www.nist.gov/document/r0201328pdf | PMMA local burning rate at 6 cm, 0.60 m/s (stage 2 check) |
| Ndubizu, C. C., Ananth, R., Tatem, P. A., Halon Options Technical Working Conference 2001, https://www.nist.gov/document/r0200517pdf | PMMA peak regression rate at 3 mm, 0.84 m/s (stage 2 check) |
| Singh, PhD thesis, University of Maryland, 2015 (DRUM) | PMMA average burning rates, forced and free convection (stage 2 check) |
| Mikofski and Williams et al., Combust. Flame 146 (postprint), https://escholarship.org/uc/item/2t05897w | Roper (1977) correlation as quoted: H/Q = 0.133 s/cm2 / ln(1+1/S) |
| Roper, F. G., Combust. Flame 29 (1977) 219-226 | Laminar jet flame height correlation (via the quote above) |
| Sunderland, P. B. et al., Combust. Flame (1999), "Shapes of buoyant and nonbuoyant laminar jet diffusion flames" | Context: Roper vs measured flame lengths |
| Emmons, H. W., ZAMM 36 (1956) 60-71 | Flat-plate boundary-layer burning (stage 2) |
| de Ris, J. N., Proc. Combust. Inst. 12 (1969) 241-252 | Opposed-flow spread formulas (stage 3) |
| Ghia, U., Ghia, K. N., Shin, C. T., J. Comput. Phys. 48 (1982) 387-411, doi:10.1016/0021-9991(82)90058-4 | Lid-driven cavity benchmark (M3 check V-b); transcriptions cross-checked, see `models/m3-drift/ghia1982.json` |
| Ginzburg, I., Verhaeghe, F., d'Humieres, D., Commun. Comput. Phys. 3 (2008) 427 | TRT collision and the magic parameter 3/16 (optional in `lbm.py`) |
| Guo, Z., Zheng, C., Shi, B., Phys. Rev. E 65 (2002) 046308 | Body-force scheme in `lbm.py` |
| Ladd, A. J. C., J. Fluid Mech. 271 (1994) 285 | Moving-wall bounce-back |
| Turns, S. R., An Introduction to Combustion (McGraw-Hill), ch. 10 | d-squared law; Law and Williams property rule (not checked against a fetched copy) |
| Law, C. K., Williams, F. A., Combust. Flame 19 (1972) 393 | Property rule for droplet burning (via Turns) |

## Property data

| Source | Used for |
|---|---|
| NIST Chemistry WebBook (webbook.nist.gov): C142825 n-heptane, C64175 ethanol, C67561 methanol, phase-change and fluid-property pages | Boiling points, latent heats (Majer and Svoboda 1985), liquid density and cp |
| PubChem CID 702 (CRC Handbook 95th ed. p. 3-246) | Ethanol liquid density |
| Wikipedia, "Heat of combustion", lower heating value table | Cross-check only of Cantera's heating values |
| San Diego mechanism transport file, https://web.eng.ucsd.edu/mae/groups/combustion/sdmech/sandiego20161214/sandiego20160815_trans.txt | Lennard-Jones parameters for He, n-heptane, ethanol |
| TNF Workshop radiation model, https://tnfworkshop.org/radiation/ (RADCAL: Grosshandler, NIST TN 1402, 1993; Barlow et al., Combust. Flame 127 (2001) 2102) | Planck-mean absorption of CO2 and H2O |

## Software

| Library | Version | Used for |
|---|---|---|
| Cantera | 3.2.0 | Equilibrium, thermo, transport; mechanisms gri30.yaml (GRI-Mech 3.0, Smith et al.) and example_data/n-hexane-NUIG-2015.yaml (Zhang et al., NUIG, 2015), both shipped with Cantera |
| NumPy | 2.5.4 | arrays |
| SciPy | 1.18.1 | ODE solver, root finding, Lambert W |
| Numba | 0.68.1 (llvmlite 0.50.0) | LBM and scalar kernels |

## Inside this repo

| Item | Used for |
|---|---|
| `data/drift_calibration.json` (engine/calibrate.py, Saffire-III PSI-100) | M3 mixing values (0.004, 0.02, 0.1 m2/s), clearance time range, detector delay range |
| `engine/drift.py`, `engine/drift_core.py` | M3 cross-check X-agree / X-time (imported read-only); alarm level 1 mg/m3 (NASA Saffire analysis ICES-2024-365, as cited in engine/drift.py); 2 mg/s upper release value |

## M4 detection latency (models/m4-latency)
- NASA PSI-100, Saffire-III flight telemetry, doi 10.60555/040q-4h36, CC0-1.0. File: `PSI-100_Raw Data_Saffire_Data_Table2017.161.00.42.03-EU.csv`.
- Published smoke-detector thresholds (context only; cannot be applied to the raw PSI-100 counts):
  - ISS detector calibrated to alarm at 1 %/ft obscuration (3.3 %/m): NASA NTRS 20170000248, https://ntrs.nasa.gov/api/citations/20170000248/downloads/20170000248.pdf
  - ISS detection threshold about 10 mg/m3; Space Shuttle 2 mg/m3: NASA NTRS 20170002629, https://ntrs.nasa.gov/api/citations/20170002629/downloads/20170002629.pdf

## M5 smoke miss risk (models/m5-smoke-miss)
- Urban, D. L., Ruff, G. A., Greenberg, P. S., Fischer, D., Meyer, M., Mulholland, G., Yuan, Z., Bryg, V., Cleary, T., Yang, J. (2012).
  Particle Morphology and Size Results from the Smoke Aerosol Measurement Experiment-2. 42nd ICES, AIAA 2012-3536. NASA NTRS 20130000422,
  https://ntrs.nasa.gov/api/citations/20130000422/downloads/20130000422.pdf . Table 1 (per-material sizes) transcribed and checked against the PDF;
  Figures 6-8 (16 flight tests) read from the PDF's vector drawing by `extract.py`.
- NASA PSI-101 (SAME-R test table) and PSI-102 (SAME): test conditions; no particle sizes.
- scikit-learn 1.9.1 (logistic regression, metrics); pdfplumber (reading the PDF drawing).
