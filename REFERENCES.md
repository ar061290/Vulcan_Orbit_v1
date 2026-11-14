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

File names, sizes and sha256: `datasets/psi/MANIFEST.csv`. Documents in `datasets/raw/` are listed in `models/m7-extinction/DATA.md`.

## NASA reports and papers

- Nayagam V., Dietrich D. L., *Cool Flame Investigation (CFI) Science Final Report*, 23 July 2020. PSI-39 file `PSI-39_Reports_CFI Science Final Report.pdf`. (M7)
- *ACME/CFI-G Final Report (2022)*, 21 November 2022. PSI-159 file `PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf`. (M7)
- Nayagam V., Dietrich D. L., Hicks M. C., Williams F. A., "Cool-flame extinction during n-alkane droplet combustion in microgravity", Spring Technical Meeting of the Central States Section of the Combustion Institute, 2014. NASA NTRS [20140006750](https://ntrs.nasa.gov/citations/20140006750). Quoted for the unit of K and for "disruptively extinguished". (M7)
- Nayagam V., Dietrich D. L., Hicks M. C., Williams F. A., "Methanol droplet combustion in oxygen-inert environments in microgravity", 8th US National Combustion Meeting, 2013. NASA NTRS [20130014061](https://ntrs.nasa.gov/citations/20130014061). Unit of K; limiting oxygen index quoted as context (`reported`). (M7)

## Physical constants and formulas

- NIST Chemistry WebBook, NIST Standard Reference Database 69 (Linstrom P. J., Mallard W. G., eds.): fluid properties of N2, O2, CO2, He, methanol, n-heptane and water, and liquid enthalpies of combustion of methanol (Chao and Rossini, 1965) and n-heptane. https://webbook.nist.gov, retrieved 14 Nov 2026. One URL per value in `models/m7-extinction/m7/properties.csv`. (M7)
- IUPAC Commission on Isotopic Abundances and Atomic Weights, standard atomic weights. https://iupac.qmul.ac.uk/AtWt/. (M7)
- Law C. K., *Combustion Physics*, Cambridge University Press, 2006, ch. 6 (quasi-steady droplet burning, d-squared law). (M7)
- Turns S. R., *An Introduction to Combustion*, 3rd ed., McGraw-Hill, 2012, sec. 10.5 (droplet burning-rate constant and transfer number). (M7)
- Poling B. E., Prausnitz J. M., O'Connell J. P., *The Properties of Gases and Liquids*, 5th ed., McGraw-Hill, 2001, eqs. 10-6.1 and 10-6.2 (Wassiljewa equation with Mason-Saxena coefficients for gas-mixture conductivity). (M7)

## Libraries

| Library | Version | Licence | Used by |
|---|---|---|---|
| NumPy | 2.5.4 | BSD-3-Clause | M7 |
| pandas | 3.1.1 | BSD-3-Clause | M7 |
| SciPy | 1.18.1 | BSD-3-Clause | M7 |
| scikit-learn (Pedregosa et al., JMLR 12, 2011) | 1.9.1 | BSD-3-Clause | M7 |
| joblib | 1.6.0 | BSD-3-Clause | M7 |
| Matplotlib | 3.11.2 | Matplotlib licence (PSF-based) | M7 (check plots) |
| openpyxl | 3.1.5 | MIT | M7 (reads the CFI .xlsx) |

## Ideas from other teams

None used by M7.

## AI assistance

See `AI_LOG.md`.
