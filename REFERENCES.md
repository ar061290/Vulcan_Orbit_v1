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
| Dietrich, D. L. et al., "Detailed Results From the Flame Extinguishment Experiment (FLEX)...", NASA/TP-2015-216046. NTRS 20150023456 | FLEX column definitions (Appendix A.1), K units mm2/s. We found no definition of the outcome label `Test end` there or elsewhere (models/m7-extinction/DATA.md) |
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

Every dataset, paper, library and outside idea used in Vulcan Orbit. Add yours under the right heading, in the same commit as the work that uses it (AGENTS.md rule 6). NASA asks that each PSI investigation be cited by its DOI.
## NASA datasets (Physical Sciences Informatics, psi.nasa.gov, CC0-1.0)
| PSI id | Investigation | DOI | Used by | How |
|---|---|---|---|---|
| PSI-69 | Flame Extinguishment Experiment (FLEX) | [10.60555/mbq8-0451](https://doi.org/10.60555/mbq8-0451) | M7 | Extinction and burning-rate models; `data/flex_suppression.json` |
| PSI-39 | Cool Flames Investigation (CFI) | [10.60555/m6pj-a914](https://doi.org/10.60555/m6pj-a914) | M7 | Cool-flame end-state model (data-summary spreadsheet); final report for column meanings |
| PSI-159 | ACME Cool Flames Investigation with Gases (CFI-G) | [10.60555/cyt1-kh64](https://doi.org/10.60555/cyt1-kh64) | M7 | Observed cool-flame cases; final report quoted |
| PSI-68 | Flame Extinguishment Experiment - 2 (FLEX-2) | [10.60555/byp8-h018](https://doi.org/10.60555/byp8-h018) | M7 | Ambient chamber temperature (25 °C) for the d-squared law; test-matrix context |
| PSI-117 | Effect of External Thermo-Convective Perturbation on Cool Flame Dynamics | [10.60555/gz0q-b577](https://doi.org/10.60555/gz0q-b577) | M7 | Reviewed as context only |
| PSI-142 | Quantitative Studies of Cool Flame Transitions at Radiation/Stretch Extinction Using Counterflow Flames | [10.60555/80qf-vj95](https://doi.org/10.60555/80qf-vj95) | M7 | Reviewed as context only |
| PSI-25 | Burning and Suppression of Solids - II (BASS-II) | [10.60555/4qc4-de67](https://doi.org/10.60555/4qc4-de67) | M6 | Experimental table (sessions, O2, flow text for the no-spread cases); ReadMe for column meanings; BASS-II Summary Report (Table 5.1 spread rates, Tables 2.1 and 7.1). M6b: the same rows through M6's files, opposed-flow calibration; Table 7.1 and PSI-25 flow text for the will-it-spread verdict |
| PSI-26 | Burning and Suppression of Solids (BASS) | [10.60555/58h4-dy80](https://doi.org/10.60555/58h4-dy80) | M6, M6b | Reviewed: no spread or regression rates in its table or as-run matrix |
| PSI-99 | Saffire-II | [10.60555/2chp-m469](https://doi.org/10.60555/2chp-m469) | M6, M6b | M6: reviewed, not used. M6b: the two SIBAL concurrent spread rates (2.1, 2.6 mm/s) are the independent check of the concurrent predictor; Note 4 PMMA regression rate (0.01–0.04 mm/s) for burnout; samples 2-8/2-9 (anchored thick PMMA) as the downstream bound |
| PSI-98 | Saffire-I | [10.60555/0t15-1z43](https://doi.org/10.60555/0t15-1z43) | M6b | Reviewed: burn times only, no spread rate; its concurrent spread rate is used from Olson et al. (below) |

File names, sizes and sha256: `datasets/psi/MANIFEST.csv`. Documents in `datasets/raw/` are listed in `models/m7-extinction/DATA.md` and `models/m6-spread/DATA.md`.

## NASA reports and papers

- Nayagam V., Dietrich D. L., *Cool Flame Investigation (CFI) Science Final Report*, 23 July 2020. PSI-39 file `PSI-39_Reports_CFI Science Final Report.pdf`. (M7)
- *ACME/CFI-G Final Report (2022)*, 21 November 2022. PSI-159 file `PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf`. (M7)
- Nayagam V., Dietrich D. L., Hicks M. C., Williams F. A., "Cool-flame extinction during n-alkane droplet combustion in microgravity", Spring Technical Meeting of the Central States Section of the Combustion Institute, 2014. NASA NTRS [20140006750](https://ntrs.nasa.gov/citations/20140006750). Quoted for the unit of K and for "disruptively extinguished". (M7)
- Nayagam V., Dietrich D. L., Hicks M. C., Williams F. A., "Methanol droplet combustion in oxygen-inert environments in microgravity", 8th US National Combustion Meeting, 2013. NASA NTRS [20130014061](https://ntrs.nasa.gov/citations/20130014061). Unit of K; limiting oxygen index quoted as context (`reported`). (M7)
- Olson S. L., Ferkul P. V., Bhattacharjee S., Miller F. J., Fernandez-Pello C., Link S., T'ien J. S., Wichman I., *Burning and Suppression of Solids-II (BASS-II) Summary Report*, NASA/TM-20210011385, 2021. PSI-25 file `PSI-25_Reports_BASS-II Summary Report.pdf`; also NASA NTRS [20210011385](https://ntrs.nasa.gov/citations/20210011385). Table 5.1 (spread rates, transcribed), Table 2.1 and Table 7.1 (no-spread cases, `reported`), T∞ = 300 K (§1.5), T_v = 673 K (§2.2). (M6)
- Ferkul P. V., Bhattacharjee S., Fernandez-Pello C., Miller F., Olson S. L., Takahashi F., T'ien J. S., *Combustion of Solids in Microgravity: Results from the BASS-II Experiment*, NASA NTRS [20160000593](https://ntrs.nasa.gov/citations/20160000593). Context only. (M6)
- Olson S. L., Ruff G. A., Ferkul P. V., Owens J. C., Easton J., Liao Y.-T., T'ien J. S., Toth B., Jomaas G., Fernandez-Pello C., Legros G., Guibaud A., Fujita O., Smirnov N., Urban D. L., "The effect of duct size, sample size, and fuel composition on concurrent flame spread over large cellulose samples in microgravity", accepted author manuscript (journal and year not printed in the manuscript), UCL Discovery eprint [10164340](https://discovery.ucl.ac.uk/id/eprint/10164340/), read 14 Nov 2026 (copy in `datasets/raw/m6b/`, not committed). Table 1 concurrent spread rates for Saffire I, III, IV, V and two BASS tests (calibration of the concurrent constant, `reported`); SIBAL and cotton area densities; steady SIBAL burnout time ≈ 22 s; the concurrent scaling Vf ∝ U · O2 · P^½. (M6b)
- Olson S. L., Miller F. J., "Experimental comparison of opposed and concurrent flame spread in a forced convective microgravity environment", *Proc. Combust. Inst.* 32 (2009) 2445–2452, and Thomsen M., Fernandez-Pello C., Urban D. L., Ruff G. A., Olson S. L., "On simulating concurrent flame spread in reduced gravity by reducing ambient pressure", *Proc. Combust. Inst.* 37 (2019) 3793–3800: the sources Olson et al. cite for the concurrent scaling. Not read by us; cited through Olson et al. (M6b)
- Bhattacharjee S., Laue M., Carmignani L., Ferkul P. V., Olson S. L., "Opposed-flow flame spread: a comparison of microgravity and normal gravity experiments to establish the thermal regime", *Fire Safety Journal* 79 (2016) 111–118, doi:[10.1016/j.firesaf.2015.11.011](https://doi.org/10.1016/j.firesaf.2015.11.011). de Ris thin and thick coefficients (Eq. 6) and flame coefficient F_adb = 4.89 (Eq. 7), `reported`. (M6). M6b: the 2.2 mm/s steady spread over a 100 µm film at 3 cm/s (pp. 115–116), `reported`, used only as an independent check. (M6b)
- Bhattacharjee S., Simsek A., Olson S., Ferkul P., "The critical flow velocity for radiative extinction in opposed-flow flame spread in a microgravity environment: a comparison of experimental, computational, and theoretical results", *Combustion and Flame* 163 (2016) 472–477, doi:[10.1016/j.combustflame.2015.10.023](https://doi.org/10.1016/j.combustflame.2015.10.023). Vaporization temperature 673 K, `reported`. (M6)

## Physical constants and formulas
- NIST Chemistry WebBook, NIST Standard Reference Database 69 (Linstrom P. J., Mallard W. G., eds.): fluid properties of N2, O2, CO2, He, methanol, n-heptane and water, and liquid enthalpies of combustion of methanol (Chao and Rossini, 1965) and n-heptane. https://webbook.nist.gov, retrieved 14 Nov 2026. One URL per value in `models/m7-extinction/m7/properties.csv`. (M7)
- IUPAC Commission on Isotopic Abundances and Atomic Weights, standard atomic weights. https://iupac.qmul.ac.uk/AtWt/. (M7)
- Law C. K., *Combustion Physics*, Cambridge University Press, 2006, ch. 6 (quasi-steady droplet burning, d-squared law). (M7)
- Turns S. R., *An Introduction to Combustion*, 3rd ed., McGraw-Hill, 2012, sec. 10.5 (droplet burning-rate constant and transfer number). (M7)
- Poling B. E., Prausnitz J. M., O'Connell J. P., *The Properties of Gases and Liquids*, 5th ed., McGraw-Hill, 2001, eqs. 10-6.1 and 10-6.2 (Wassiljewa equation with Mason-Saxena coefficients for gas-mixture conductivity). (M7)
- de Ris J. N., "Spread of a laminar diffusion flame", *Twelfth Symposium (International) on Combustion*, The Combustion Institute, 1969: the thin- and thick-fuel opposed-flow spread formulas, used in the coefficient form of Bhattacharjee et al. (2016). (M6)

## Libraries
| Library | Version | Licence | Used by |
|---|---|---|---|
| NumPy | 2.5.4 | BSD-3-Clause | M6, M7, M6b |
| pandas | 3.1.1 | BSD-3-Clause | M6, M7, M6b |
| SciPy | 1.18.1 | BSD-3-Clause | M6, M7 |
| scikit-learn (Pedregosa et al., JMLR 12, 2011) | 1.9.1 | BSD-3-Clause | M6, M7 |
| joblib | 1.6.0 | BSD-3-Clause | M7 |
| Matplotlib | 3.11.2 | Matplotlib licence (PSF-based) | M6, M7, M6b (check plots) |
| openpyxl | 3.1.5 | MIT | M7 (reads the CFI .xlsx) |
## Ideas from other teams

None used by M7, M6 or M6b. The R² 0.6–0.7 expectation for spread models is the plan's note on a competitor (`docs/plan.md`), used only to set the M6 target.

## AI assistance
See `AI_LOG.md`.

## More NASA PSI datasets used (audit, 14 Nov 2026)
| PSI | Title | DOI | Used for |
|---|---|---|---|
| PSI-98 | Spacecraft Fire Safety Experiment-I | [10.60555/0t15-1z43](https://doi.org/10.60555/0t15-1z43) | Saffire-I: burn times for the drift what-if runs (engine/drift.py); Investigations page |
| PSI-99 | Spacecraft Fire Experiment-II | [10.60555/2chp-m469](https://doi.org/10.60555/2chp-m469) | Saffire-II: burn times for the drift what-if runs (engine/drift.py); Investigations page |
| PSI-101 | Smoke Aerosol Measurement Experiment-Reflight | [10.60555/2np7-jv14](https://doi.org/10.60555/2np7-jv14) | SAME-R: test conditions (no sizes); Investigations page; M5 context |
| PSI-22 | Advanced Combustion via Microgravity Experiments Electric-Field Effects on Laminar Diffusion Flames | [10.60555/se5a-8c73](https://doi.org/10.60555/se5a-8c73) | ACME E-FIELD Flames: Investigations page |
| PSI-26 | Burning and Suppression of Solids | [10.60555/58h4-dy80](https://doi.org/10.60555/58h4-dy80) | BASS: Investigations page |
| PSI-47 | Dust and Aerosol Measurement Feasibility Test / Dust and Aerosol Measurement Feasibility Test-2 | [10.60555/ztgj-d202](https://doi.org/10.60555/ztgj-d202) | DAFT / DAFT-2: Investigations page |
| PSI-106 | Structure and Liftoff In Combustion Experiment | [10.60555/pm12-rg61](https://doi.org/10.60555/pm12-rg61) | SLICE: Investigations page |
| PSI-107 | Smoke Point In Co-flow Experiment | [10.60555/9kbh-e962](https://doi.org/10.60555/9kbh-e962) | SPICE: Investigations page |
| PSI-10 | Advanced Combustion via Microgravity Experiments / Flame Design | [10.60555/w4zy-bt45](https://doi.org/10.60555/w4zy-bt45) | ACME Flame Design: Investigations page |
| PSI-20 | Advanced Combustion via Microgravity Experiments - Burning Rate Emulator | [10.60555/vb93-3y72](https://doi.org/10.60555/vb93-3y72) | ACME BRE: Investigations page |

## Sources checked in the audit (14 Nov 2026)
| Source | What we took from it |
|---|---|
| Link & Balistreri, ICES 2015, NASA NTRS 20150009509, p. 10, https://ntrs.nasa.gov/api/citations/20150009509/downloads/20150009509.pdf | "an effective atmosphere velocity in the cabin aisleway must be maintained between 4.6 and 12.2 meters per minute" = 0.077 to 0.203 m/s. Both drift models now use this range; the earlier 0.05 m/s low end had no source and was removed. |
| "Preliminary Results from the Saffire VI Experiment", ICES-2024-365, NASA NTRS 20240002981 | 1 mg/m3 called "a relatively tight alarm threshold"; far-field detector reached it at 981 s in Saffire VI-3. Used as the headline alarm level in both drift models. |
| Urban et al., "Fire Detection Tradeoffs as a Function of Vehicle Parameters", ICES 2016, NASA NTRS 20170002629 | ISS detection threshold about 10 mg/m3; Space Shuttle 2 mg/m3. Drift what-if results now also reported at 10 mg/m3. |
| NASA NTRS 20170000248 | ISS detector: forward light scattering, calibrated to alarm at 1 %/ft obscuration for smolder smoke. |
| NASA NTRS 20150010172 | Previously cited for SAME-R particle sizes. It is a presentation with no size numbers in its record; replaced by AIAA 2012-3536 (NTRS 20130000422). |
| PMC7918997 | Previously listed on the About page; could not be opened to verify (site blocks automated access). Removed until a person checks it. |

## Added on feat/site-v2 (14 Nov 2026)

| Source | Used for |
|---|---|
| NASA PSI-22 ACME E-FIELD Flames, doi:10.60555/se5a-8c73 | data/efield.json (test days, flames ignited, objectives quoted) |
| NASA PSI-47 DAFT / DAFT-2, doi:10.60555/ztgj-d202 | data/daft.json (sessions, objective quote) |
| NASA PSI-69 FLEX, PSI-39 CFI, PSI-25 BASS-II, PSI-159 CFI-G, PSI-10 Flame Design summary tables | data/gaps.json (tested oxygen and pressure points) |
| Press Information Bureau, 18 Sep 2024, https://pib.gov.in/PressReleasePage.aspx?PRID=2055992 | India card: BAS-1 by Dec 2028, operational BAS by 2035 (official) |
| India Science, Technology & Innovation portal, IIT Madras smoke characterisation Phase II, https://www.indiascienceandtechnology.gov.in/technologies/smoke-characteristation-flaming-and-smouldering-materials-micro-gravity-phase-ii | India card (official) |
| Starlust, 6 Sep 2026; CXO Digital Pulse (Lok Sabha reply, 29 Jul 2026) | India card: Gaganyaan schedule (official via news) |
| Drishti IAS summary of The Hindu, 22 May 2026 | India card: Gaganyaan smoke detectors and water mist (news only) |
| Competitor and NASA-results research, 14 Nov 2026 | reports/Flame in Free Fall research.md (every claim cited there) |
| Google Fonts: Atkinson Hyperlegible, Bricolage Grotesque, IBM Plex Mono, Special Elite, Libre Caslon Text (SIL Open Font License) | Site typography (corrected 15 Nov 2026) |

## Added 14 Nov 2026 (evening)

| Source | Used for |
|---|---|
| Urban, Ruff, Ferkul et al., Saffire VI preliminary results, ICES-2024-365, https://ntrs.nasa.gov/citations/20240002981 | data/saffire_gas.json (gas rise, heat release, 981 s alarm; reported); Saffire IV-VI points on the gap map |
| NASA Exploration Atmospheres Working Group, NASA/TP-2010-216134 | 8.2 psia / 34% O2 recommendation, used as a probe on the gap map (corrected 15 Nov 2026 from 8.0 psia / 32%) |
| NASA-STD-7009A, Standard for Models and Simulations | Credibility factors in the "Made by" boxes (self-assessed) |
| Rate-of-rise smoke alarm logic proposed for spacecraft light-scattering detectors (see reports/Elevating Vulcan Orbit for judges.md for the citation) | Idea tested in models/m4-latency/rate_of_rise.py |

## Added 15 Nov 2026 (verification pass)

| Source | Used for |
|---|---|
| Urban et al., ICES-2021-266 (Saffire IV-V), https://ntrs.nasa.gov/api/citations/20210011521/downloads/ICES%202021-266%200503-2021%20final.pdf | Saffire-III flow as flown (25 cm/s, Table 2); Saffire V "flame came back" plaque |
| Meyer et al., Fire Safety Journal 98:74-81 (2018), doi:10.1016/j.firesaf.2018.04.004; NIST summary via ScienceDaily (https://www.sciencedaily.com/releases/2018/05/180501161830.htm) | The ISS detector frequently failed to detect the smaller smoke particles from Teflon and Kapton |
| NASA Glenn BASS-II page, https://www1.grc.nasa.gov/space/iss-research/msg/bass-2/ | "Models predict higher spread rates than observed" (cross-check with M6) |
| NASA NTRS 20160000593 | BASS-II low-oxygen spread limits (cross-check with M6b) |
| Dietrich et al. 2014, Microgravity Sci. Technol. 26:65-76; Nayagam et al., NTRS 20130014061 | FLEX limiting oxygen (cross-check with M7) |
| Kim et al., Proc. Combust. Inst. 39 (2023) | Cool diffusion flames not seen below 2 bar (cross-check with M7 cool flame) |
| scikit-learn User Guide 3.1.5 and permutation_test_score | Method for scripts/permutation_tests.py |
| Mitchell et al., Model Cards for Model Reporting (2019), arXiv:1810.03993 | Model cards page |
| Rival public projects reviewed 15 Nov 2026 (see Competitor intel report) | Ideas only: judge mode, cross-check table, data fingerprints; no code copied |
