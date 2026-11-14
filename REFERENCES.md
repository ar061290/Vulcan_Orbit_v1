# References

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
