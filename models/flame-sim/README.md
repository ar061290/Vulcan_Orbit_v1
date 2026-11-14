# Flame simulation (stages 1 to 3)

Reduced-order physics for flames at 0 g, Moon (0.16 g), Mars (0.38 g) and Earth (1 g) gravity. No combustion CFD. Status of
every output: **model**. The model is checked against NASA flight data (FLEX, BASS-II) and against published correlations. It
is not fitted to them, except for the few lumped constants named below.

**Honesty rule.** NASA data exists only at 0 g and 1 g. Every Moon and Mars number is **model only, not validated; lies between
NASA's microgravity and Earth results**. Each such record says so in its `gravity_label`. None of them is a prediction. This model
does not say any material or atmosphere is safe, and it does not predict real spacecraft fires.

```
python models/flame-sim/build.py     # about 4 minutes; writes data/flame_static.json, data/flame_spread.json, models/flame-sim/results.json
```

Pass rules: `RULES.md`, committed before any check was run. Results and misses: `REPORT.md`.

## Inputs (every case)

| Input | Values |
|---|---|
| Gravity | 0, 0.16, 0.38, 1 g |
| Fuel | methane, ethylene, propane, n-heptane, ethanol; methanol added as a check-only fuel (FLEX has methanol data) |
| O2 mole fraction | 0.21 and 0.34, balance N2 |
| Pressure | 101.3 kPa and 70.3 kPa (10.2 psi) |
| Forced airflow | 0, 0.05, 0.10, 0.20 m/s |

## Data

| Data | Use | File / source |
|---|---|---|
| FLEX (PSI-69, doi 10.60555/mbq8-0451) | Checks S1-K, S1-ext | `datasets/psi/PSI-69/PSI-69_Experimental table_FLEX.csv` |
| BASS-II summary report, NASA/TM-20210011385 (Olson et al. 2021) | Check S3-spread (Table 5.1, Secs. 2.2.5, 2.3.7); extinction calibration points (Table 2.1); gas-phase activation energy (Sec. 6.1) | https://ntrs.nasa.gov/citations/20210011385 |
| BASS-II summary table (PSI-25, doi 10.60555/4qc4-de67) | Test conditions only: the table has no spread-rate column | `datasets/psi/PSI-25/` |
| Property sources | every number in `properties.json` has its source next to it | `properties.json`, `literature.json` |

**Column meanings (FLEX), as AGENTS.md asks.** From NASA/TP-2015-216046 (Dietrich et al. 2015), Appendix A.1:
"Burning rate—average burning rate constant from a linear fit of the droplet diameter squared versus time from shortly after
ignition to extinction", with the unit "Burning rate, mm2/s" in the Table IX header. The PSI column header "Burning rate; mm" is
therefore K in mm²/s. "Visible flame extinction diameter—droplet diameter at the time the visible flame extinguished". This is the
droplet's diameter, not the flame's. The CSV columns were matched to Table IX by name, because the PSI page gives no column
documentation.

## Method

**Stage 1. Static flame in open air**

- *Chemistry* (`chem.py`). Cantera 3.2.0 equilibrium (constant H and P) of the stoichiometric mixture at 298.15 K gives T_ad and
  the products. Mechanisms:
  - gri30.yaml for methane, ethylene and propane;
  - n-hexane-NUIG-2015.yaml (shipped with Cantera in `example_data`) for n-heptane, ethanol, methanol, and any oxidiser with helium.
  - The lower heating value comes from the species enthalpies. It is within 5.9 % of the reported table in `properties.json`.
  - Z_st = 1/(1 + s/Y_O2). Transport is mixture-averaged, using gri30 plus HE, NC7H16 and C2H5OH with San Diego Lennard-Jones parameters.
- *Droplets* (`droplet.py`). d-squared law:
  - B = (Y_O2 LHV/s + cp (T_inf - T_b))/h_fg
  - K = 8 k_g/(rho_l cp_g) ln(1+B)
  - t_b = d0²/K
  - r_f/r_s = ln(1+B)/ln(1+Y_O2/s)
  - Gas properties are taken at the mean of T_b and T_f with the Law and Williams rule (cp of fuel vapour; k = 0.4 k_fuel + 0.6 k_ambient).
  - Methane, ethylene and propane are gases at cabin conditions, so their droplet values are null.
- *Radiative extinction* (`droplet.py`). Optically thin loss from the hot gas around the flame sheet:
  - Q_r = 4 sigma kappa_P (T_f⁴ - T_inf⁴) G (4/3) pi r_f³, with kappa_P from the TNF/RADCAL Planck-mean fits for CO2 and H2O.
  - Heat release is Q_c = (pi/4) rho_l K d LHV. The loss fraction chi = Q_r/Q_c grows as d².
  - Extinction occurs when T_f - chi (T_f - T_inf) < T_lim.
  - G and T_lim are the only tuned constants. They are tuned on half the FLEX test dates, and the other half is held out.
  - The criterion is quasi-steady, so it ignores the slow growth of the flame after ignition.
- *Flame shape* (`shape.py`). Point fuel source in a uniform flow:
  - Z = m_dot/(4 pi rhoD r) exp(-U r (1 - cos phi)/(2D)), with the flame at Z = Z_st, solved in closed form with the Lambert W function.
  - U = forced flow (along x) + sqrt(g L (T_f - T_inf)/T_inf) (along z, zero at 0 g).
  - The temperature field is the Burke-Schumann flame-sheet profile in Z.
  - Each case gives 72 contour points and a 31 x 31 temperature grid.

**Stage 2. Flame on a surface** (`surface.py`). This is the Emmons (1956) forced-flow flat-plate solution:

- 2 f''' + f f'' = 0, with f'(0) = 0, f'(inf) = 1 and f(0) = -2B f''(0), solved by shooting.
- m''(x) = rho U B f''(0)/sqrt(Re_x).
- The flame sits where f' = 1 - Z_st(1+B)/B.
- The standoff comes from the Howarth transform with the flame-sheet temperature.
- For B → 0 the solver returns the Blasius value f''(0) = 0.332.
- At 1 g the plate is vertical with flow up it, and the local effective velocity is U + sqrt(g x (T_f - T_inf)/T_inf).
- PMMA B is computed from the cited heat of combustion and heat of gasification: 1.69 in air, against 1.6 reported by Ahmad and Faeth.

**Stage 3. Flame spread** (`spread.py`).

- *Spread rate.* de Ris thermal-regime formulas, as written by Carmignani (2019):
  - thin: (pi/4) k_g F/(rho_s c_s tau)
  - thick: V_g (k rho c)_g/(k rho c)_s F²
  - The larger of the two applies.
  - F = 4.76 in air (Carmignani), scaled to other O2 levels with the flame-sheet temperature.
- *Extinction limits* (reduced forms of our own, each tied to one reported BASS-II point):
  - Blow-off when a Damkohler number with E = 1.45e5 J/mol (BASS-II TM Sec. 6.1) falls below 1. Set so that 100 µm PMMA blows off
    at 40 cm/s in air.
  - Quenching when the surface-radiation number exceeds R_c. Set so that thin PMMA quenches at 1.0 cm/s in air (TM Table 2.1).
- *Front marching.* The front marches over a 20 x 2 cm sample. The burning zone behind the front lasts as long as the fuel takes
  to burn through at the stage 2 burning flux. The output gives front position and burning area over time; M3 uses the area to
  grow its smoke source.

## Decisions (made without asking, as the brief instructs)

1. **n-heptane and ethanol mechanism.** Cantera ships one mechanism that has both: n-hexane-NUIG-2015 (1268 species). It is used
   for equilibrium. It has no transport data, so transport uses gri30 plus three added species. Their Lennard-Jones parameters
   come from the San Diego file (sources in `properties.json`).
2. **Methanol added as a check-only fuel.** FLEX has only heptane and methanol, so ethanol cannot be checked against FLEX.
   Methanol gives the droplet model a second fuel to be checked on.
3. **Gaseous fuels have no droplet values.** Methane, ethylene and propane would need cryogenic liquid properties. They are null,
   with the reason given in the file.
4. **Shape-case sources.** Liquid fuels use a 3 mm droplet (the FLEX "smaller droplet size (≈ 3 mm)" in the PSI-69 description).
   Gaseous fuels use a 5 cm³/s gas jet. The jet flow is a scenario input of the order used in laminar jet-flame work, not a
   measured value.
5. **Buoyant velocity prefactor = 1.** The spec gives only the scaling, so absolute 1 g sizes carry this uncertainty.
6. **Train/held-out split for FLEX.** Test dates are sorted and alternate dates go to each half (grouped validation, AGENTS.md).
7. **Flame temperature for solids.** It is anchored by Carmignani's F = 4.76 for air and scaled with Z_st for other O2 levels.
   This avoids a solid-fuel equilibrium calculation that Cantera cannot do for PMMA.
8. **SIBAL (cotton-fibreglass) plate and spread cases are left out.** No verified heat of combustion or heat of gasification for
   cotton was found, and AGENTS.md says not to fill in typical values. The SIBAL area density, thickness and composition are in
   `properties.json` for when they are found.
9. **The extinction correction to the spread rate has our own form**, sqrt(1 - R/R_c) sqrt(1 - 1/Da). It is not from a paper.
   The REPORT says so beside every number that uses it.

## Limits

- Reduced-order physics. The flame shape assumes a point source and a uniform flow. Real flames have variable density and
  buoyancy that changes along the flame.
- The d-squared law is quasi-steady, and FLEX K values include unsteady effects (fuel-vapour accumulation, cool flames for heptane).
- The Emmons solution assumes unit Lewis and Prandtl numbers and constant rho mu. The 1 g plate uses a local effective velocity,
  not the free-convection similarity solution.
- de Ris formulas assume a steady thermal regime. Thick PMMA in microgravity was not steady in BASS-II (the O2 also drifted during
  tests).
- Moon and Mars: model only (see the top of this file).
