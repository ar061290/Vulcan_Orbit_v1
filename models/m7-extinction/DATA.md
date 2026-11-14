# M7 data inventory

Every number M7 publishes comes from the files below. Column meanings are quoted from the file header or from the documentation named next to them. Where a meaning had to be inferred, it says so.

Licence of all PSI files: CC0-1.0. NASA asks that each investigation be cited by its DOI (see `REFERENCES.md`).

## Files used by `build.py`

### PSI-69 FLEX: `datasets/psi/PSI-69/PSI-69_Experimental table_FLEX.csv`

- DOI 10.60555/mbq8-0451. sha256 `37c88ce8…7e1b96` (`datasets/psi/MANIFEST.csv`).
- This is the only file PSI holds for FLEX. The API lists one file and no data dictionary.
- **274 rows**, one per droplet burn, from 5 Mar 2009 to 8 Dec 2011. Fuels are methanol and n-heptane.
- The file is cp1252. Byte 0x96 (an en dash) marks an empty cell 34 times.

| Need | Column (verbatim header) | Meaning and unit | Where the meaning comes from |
|---|---|---|---|
| Test id | `FLEX Identifier` | ISS test-point code (e.g. `C08H101`) | header |
| Session | `Test Date` | Date of the burn on orbit; M/D/YYYY or M/D/YY | header |
| Fuel | `Fuel` | `Methanol` or `Heptane` | header |
| Pressure | `Ambient pressure; mmHg` | Chamber pressure, **mmHg**. Divided by 760 to give atm. | header (unit in the header) |
| O2 | `O initial ambient composition; mole fraction` | O2 mole fraction (the subscript "2" is lost in the export) | header; PSI-69 objective: "gaseous fire suppressants such as CO2, He" |
| N2 | `N initial ambient composition; mole fraction` | N2 mole fraction (balance gas) | header |
| CO2 | `CO initial ambient composition; mole fraction` | CO2 mole fraction (the subscript is lost; this is not CO) | header; the CO2 values (0.05–0.7) match the CO2-dilution series named `C..` in `FLEX Identifier` and the NTRS papers below |
| He | `He initial ambient composition; mole fraction` | He mole fraction | header |
| Droplet size | `Droplet initial diameter; mm` | Initial droplet diameter d0, **mm** | header |
| Extinction diameter | `Visible flame extinction diameter; mm` | Droplet diameter when the visible flame went out, **mm** | header |
| Burning rate | `Burning rate; mm` | Burning-rate constant K = −dD²/dt, **mm²/s**. The header shows "mm" because the superscript and "/s" were lost in the export. | NTRS 20140006750 (Nayagam et al. 2014, FLEX): "The burning rate constants K (=dD2/dt) … were found to be 0.41 and 0.33 mm2/s". NTRS 20130014061 (FLEX methanol): axes "Kex (mm2/s)". Values in this column, 0.05–1.06, are in that range. |
| Burn time | `Burn time; s` | Burn duration, **s** | header |
| Outcome | `Test end` | `Extinction` 186, `Disruption` 61, `Completion` 27 | **No public definition found.** The PSI-69 approach text says tests were repeated "if finite extinction diameter at flame extinction observed" and that some sequences were "burn to completion followed by a no ignition test". NTRS 20140006750: "smaller droplets burned to completion or disruptively extinguished". |

**Columns that do not exist:**
- No flag for whether a cool flame followed the visible flame's extinction.
- No "no ignition" tests, so the limiting oxygen level cannot be read from the table directly.
- No ambient temperature.
- No droplet translation speed.

### PSI-39 CFI: `datasets/psi/PSI-39/PSI-39_Science Documents_CFI_DataSummary_Spreadsheet_Jan2021.xlsx`

- DOI 10.60555/m6pj-a914. sha256 `a5b04b6a…dd8`.
- Fetched by `fetch_extra.py` on 14 Nov 2026 with the owner's approval. A row was appended to `MANIFEST.csv`.
- **227 tests** (FLEX-1206 to FLEX-1431). 146 have "Completed Analysis? = Yes".
- CFI final report: "Pure n-dodecane data: FLEX-1206 to FLEX-1284; N-dodecane/Iso-dodecane (75%-25% & 60%-40%) mixture data: FLEX-1285 to FLEX-1387; Farnesane data: FLEX-1388 to FLEX-1431". The farnesane tests have no analysed values.

| Need | Sheet → column (verbatim) | Meaning and unit | Source |
|---|---|---|---|
| Test id | Master → `Flex Number` | CFI test number | header |
| Session | Master → `Test Date` | Date of the burn | header |
| Pressure | Master → `Pressure` (text, e.g. `.5 atm`) and DATA → `Pressure (atm)` | **atm**. The two agree wherever both are filled in (checked in code). | header |
| O2 | Master → `Oxygen` | O2 mole fraction | header; the report says "Helium dilution by 29% and 59% with O2 mole fraction at 0.21" |
| N2 | Master → `Nitrogen` | N2 mole fraction | header |
| He | Master → `Helium` | He mole fraction | header; report as above |
| Support | Master → `Fiber` | `Yes` = droplet on a support fibre, `No` = free-floating | header; report: "Droplets of fuel are dispensed and suspended between hypodermic needles or tethered using silicon-carbide fibers" (PSI-39 approach) |
| Fuel | Master → `Fuel` | `C12H26` (n-dodecane) or `[.75]/[.25] C12H26/iso-dodecane` etc. | The report gives the fractions "by mass": "N-dodecane/Iso-dodecane mixtures: 75/25% and 60/40% by mass" |
| Droplet size | DATA → `D0 ( mm )` | Initial diameter, **mm** | header |
| Visible flame out | DATA → `Dext, hot ( mm )` | Droplet diameter at hot-flame extinction, **mm** | header; report: the hot flame "extinguishes due to radiative heat loss followed by cool flame" |
| Rates | DATA → `khot ( mm^2/s )`, `kcool ( mm^2/s )` | Hot- and cool-flame burning-rate constants, **mm²/s** | header |
| Cool flame out | DATA → `Dext,cool ( mm )` | Droplet diameter at cool-flame extinction, **mm**. **0 means the droplet was used up.** | header; report §5.3: "as the pressure is increased above approximately 2 atm, reignitions were commonly observed, eventually leading to complete combustion of the fuel droplet" |
| (not an input) | DATA → `Reignitions`, `Extrap CF?`, radiometer columns, `HF Burn Time` | Measured after ignition | `Extrap CF?` is not defined. **Inferred:** 1 = cool-flame extinction diameter extrapolated. It is used only for a sensitivity check. |
| Quality flag | DATA → `Completed Analysis?` | `Yes`/`No` | header |
| Notes | Comments → `Comments` | Real-time notes on each burn | header |

**What CFI cannot tell us: whether a cool flame appeared.**
- A missing `kcool` does not mean "no cool flame".
  - FLEX-1214: "Droplet leaves FOVs shortly after cool flame burning starts".
  - FLEX-1229: "Hot flame radiatively extinguished, then burned with a cool flame".
  - FLEX-1291: "Vapor cloud starts to form … (after cool flame extinction)".
  - Each of these has no `kcool`.
- So M7 models the cool flame's **end state** (fuel used up versus fuel left), not its presence.

**Odd entries, kept as given and flagged for a hand check:**
- FLEX-1301 is dated 2017-07-29 but sits between tests dated 2017-06-29. It is probably a typo; at worst it becomes its own session.
- FLEX-1274A has a hot-flame extinction diameter (5.545 mm) larger than its initial diameter (4.67 mm).
- The report's Figure 3 caption gives FLEX-1268 as "12%O2 – 50% N2 – 29% Helium", while the spreadsheet lists O2 0.21. M7 uses the spreadsheet.

### PSI-159 ACME CFI-G: `datasets/psi/PSI-159/PSI-159_Experimental table_CFI-G_Normal Flames.csv`

- DOI 10.60555/cyt1-kh64. **179 rows** of gas-fuelled spherical-burner flames.
- Used only to describe observed cases. There is no model.

| Column (verbatim) | Meaning | Source |
|---|---|---|
| `Cool flame?` | `yes, PCI-x`/`no, PCI-hot`. Filled for 8 rows only. **Blank = not assessed.** | CFI-G final report: "evidence of cool flames was first discovered in review of the data a few days after the testing. During that testing, it wasn't known that the cool flames were present after hot flame extinction and the tests were terminated" |
| `Self-ext or flow term` | `SE` = flame went out on its own (radiative extinction), `FT` = flow terminated | Report: "Among them, 189 flames experienced radiative extinction, and the rest were extinguished when their flow was terminated, either because the preset flow time was out or the burner overheated." |
| `XO2 before test`, `approx p (bar)`, `Xf`, `mHC (mg/s)` | Ambient O2 mole fraction, pressure (bar), fuel mole fraction in the burner feed, fuel mass flow (mg/s) | header |

The report's own summary is used verbatim on the site: "Of those that extinguished radiatively, 15 subsequently reignited as cool diffusion flames. These cool flames were observed only with the following conditions: a) concentrations of 30 vol% n-butane and 40 vol% O2, b) normal flames, c) a pressure of 2.03 bar, and d) mass flow rates between 0.75 – 1.5 mg/s."

The SE/FT outcome is **not** modelled. A flow-terminated flame was stopped by the preset timer or the burner temperature limit, so "did not go out" is cut off by the test rather than observed.

## Documentation fetched (not read by `build.py`)

These are in `datasets/raw/` (git-ignored); `fetch_extra.py` re-downloads them and checks the sha256.

| File | sha256 | Used for |
|---|---|---|
| `datasets/raw/PSI-39/PSI-39_Reports_CFI Science Final Report.pdf` (Nayagam and Dietrich, 23 Jul 2020) | `e15158689180314583917200a071730d3aed9088e1ae689b847bd416674010f9` | CFI column meanings and quotes above |
| `datasets/raw/PSI-159/PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf` (21 Nov 2022) | `f6cce7cc08ca69c155994d7a8898e21cd4aba122f4e46d5e00708e4889a1ebab` | CFI-G column meanings and quotes above |

These NTRS papers were read online and not saved:
- **20140006750:** Nayagam, Dietrich, Hicks, Williams, "Cool-flame extinction during n-alkane droplet combustion in microgravity", 2014 Spring Technical Meeting, Central States Section of the Combustion Institute.
- **20130014061:** Nayagam, Dietrich, Hicks, Williams, "Methanol droplet combustion in oxygen-inert environments in microgravity", 8th US National Combustion Meeting, 2013. It contains: "the limiting oxygen index for methanol in these diluent gases is around 12% to 13% oxygen by volume" (`reported`; quoted as context only).

## Physical constants (`m7/properties.csv`)

- The d²-law baseline needs fuel and gas properties. Each value has a source URL, and all were retrieved on 14 Nov 2026:
  - NIST Chemistry WebBook: boiling point, liquid density, heat of vaporisation, heat of combustion, and gas k, c_p and μ at 800 K and 1 atm.
  - IUPAC: atomic weights.
- These are `reported` values: we quote them, we did not measure them.
- The ambient temperature (25 °C) comes from the PSI-68 FLEX-2 table for the same MDCA chamber, because FLEX does not list one.

## Files looked at and not used

| PSI | File | Why not |
|---|---|---|
| PSI-68 FLEX-2 | `PSI-68_Experimental table_Flex2.csv` (8 rows) | Test-matrix ranges per fuel ("0.17; 0.21;0.25; 0.3" O2, "0.5; 1.0; 1.5; 2.0; or 3.0" atm). No per-test results. PSI holds no other FLEX-2 file. Only the ambient-temperature value is used (see above). |
| PSI-39 CFI | `PSI-39_Experimental table_CFI.csv` (87 rows, 8 repeated) | Same conditions as the spreadsheet's Master Sheet, with no outcomes. Superseded by the spreadsheet. |
| PSI-159 CFI-G | `…Inverse Flames.csv` (154 rows) | No cool-flame column |
| PSI-117 | analysed-data CSVs | Points digitised from published figures, partly simulation, derived from the same FLEX/CFI burns. Kept as context; the CFI spreadsheet is the primary source. |
| PSI-142 | summary and xlsx | Ground counterflow flames with ozone, not microgravity |

## Cleaning decisions (applied in `m7/load.py`, printed by `build.py`)

1. FLEX is read as cp1252. En-dash cells and text such as `~6` become missing; no value is filled in.
2. FLEX C11M201 (#114) lists 0 mmHg. That pressure is treated as missing, so the burn is out of the models but still counted in `flex_suppression.json`.
3. FLEX 193F001 appears twice (#70 and #73, same date and time). #70 is kept.
4. 13 FLEX burns lack pressure or initial diameter and are left out of the models. That leaves **260 burns**: 178 Extinction, 55 Disruption, 27 Completion, across 80 test dates and 47 nominal atmospheres. 256 of them have a burning rate.
5. CFI: 117 analysed burns have both the hot- and cool-flame extinction diameters recorded. 48 were used up (`Dext,cool` = 0) and 69 left fuel, across 39 test dates. 32 of the 117 are flagged `Extrap CF? = 1`.
