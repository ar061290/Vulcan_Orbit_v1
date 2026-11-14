# Smoke drift model: how it was checked

Run order: `python engine/calibrate.py` (about 4 min), then `python engine/drift.py` (about 10 min). Every check below is rerun each time, and failures stay on the Evidence page.

## Data used, and what each dataset is used for
| Dataset | What it sets |
|---|---|
| Saffire-III flight telemetry (PSI-100) | Tuning: how fast the air clears smoke, the mixing value, and the detector delay. Test: the held-out smoke-wire puff |
| Saffire-I and II sample tables (PSI-98, 99) | How long simulated fires burn (70 to 900 s, as measured) |
| SAME (PSI-102) | Low end of the smoke release range (1 to 2 mg/min weight loss) |
| NASA ventilation requirement (NTRS 20150009509) | Airflow 0.05 to 0.20 m/s |

FLEX, BASS-II, CFI and the other flame investigations measure flames, not smoke transport, so they do not feed this model.

## Results (latest run)
| Check | Result |
|---|---|
| V1 mass conserved, with recirculation | pass, 1.0000 |
| V2 air continuity | pass, 1.8e-11 |
| V3 symmetry with fans off | pass, 0.1% |
| V4 exact advection-diffusion answer | pass, 1.6% error (old first-order scheme: 16.7%) |
| V5 grid halved | **fail**: worst pair differs 10% (limit under 10%); all 12 pairs agree on alarm vs no alarm |
| V6 airflow scaling | pass, ratio 3.2 |
| V7 fit to the Saffire-III burn | pass, R2 0.90 |
| V8 held-out smoke-wire puff timing | **fail**: model peaks 18 s early on average; shape R2 0.05 |
| R1 air return beats ceiling by 5 points in all 3 cabins | **fail**: 4 to 5 points |
| R2 fire size matters more than position | pass: fires over 0.5 mg/s are caught about 100% of the time, against about 49% overall |

## What changed from the first version, and why the headline changed
* Second-order van Leer advection replaces first-order upwind. The old scheme added numerical mixing about as large as the assumed real mixing.
* Filtered recirculation: part of the smoke leaving at the return comes back with the supply air. The flight record needs this: it shows a slow tail after flame-out.
* Detectors average a 0.2 m patch of air, and alarm times include the delay tuned on flight data.
* Fires burn for measured durations and release 0.017 to 2 mg/s, not a constant 0.2 to 5 mg/s forever.

The first version said a detector at the air return caught 70% of fires within 2 minutes and a ceiling detector caught 11%. With the settings the flight data supports, that gap shrinks to 49% vs 44% (R1 fails), so we dropped that claim. What holds up instead: fires releasing over 0.5 mg/s are caught almost wherever the detector is. Fires under 0.1 mg/s are almost never caught within 2 minutes by any wall detector. Placement only matters for fires in between (59% vs 45%).

## What the flight data cannot tell us
One detector in one vehicle. The record fixes how fast smoke clears (2 to 4 minutes). It does not fix how smoke spreads across a cabin: mixing values from 0.004 to 0.1 m2/s fit equally well. Every what-if result is reported as a range over the settings the record cannot rule out.
